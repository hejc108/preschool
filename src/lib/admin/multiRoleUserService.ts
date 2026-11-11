import staffCatalog from '@/lib/data/staff_catalog.json';
import {
  DEFAULT_UUID_TO_NAME,
  resolveCanonicalClassId,
  resolveClassDisplayName,
} from '@/lib/constants/classes';
import {
  executeWithContextFallback,
  getHighestPriorityRole,
  normalizeRole,
  SessionContext,
  sortRolesByPriority,
} from '@/lib/auth/sessionContext';
import { getSupabaseConfig } from '@/lib/supabase/server';
import { AssignableRole, ParentStudentRelation, Profile, UserRole } from '@/lib/types/schema';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ASSIGNABLE_ROLES: AssignableRole[] = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'PARENT',
  'STAFF',
];

export function ensureValidUuid(candidate?: string): string {
  if (candidate && UUID_REGEX.test(String(candidate))) return String(candidate);
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
}

export function toGuardianRelationship(
  input: string
): 'BỐ' | 'MẸ' | 'ÔNG' | 'BÀ' | 'NGƯỜI GIÁM HỘ' {
  const s = (input || '').toLowerCase().trim();
  if (s === 'bố' || s === 'bo' || s === 'father') return 'BỐ';
  if (s === 'mẹ' || s === 'me' || s === 'mother') return 'MẸ';
  if (s === 'ông' || s === 'ong') return 'ÔNG';
  if (s === 'bà' || s === 'ba') return 'BÀ';
  return 'NGƯỜI GIÁM HỘ';
}

export async function fetchRelationsFromSupabase(
  ctx: SessionContext
): Promise<ParentStudentRelation[]> {
  try {
    const [spRes, sgRes] = await Promise.all([
      executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('student_parents')
          .select(
            'student_id, parent_user_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, classes(id, name)), profiles(id, email, full_name)'
          )
          .order('created_at', { ascending: true })
      ),
      executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('student_guardians')
          .select(
            'id, student_id, guardian_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, classes(id, name)), profiles(id, email, full_name)'
          )
          .order('created_at', { ascending: true })
      ),
    ]);

    const dedupe = new Map<string, ParentStudentRelation>();

    const collect = (row: any, parentKey: 'parent_user_id' | 'guardian_id') => {
      const parentId = row[parentKey];
      const studentId = row.student_id;
      if (!parentId || !studentId) return;
      const key = `${studentId}:${parentId}`;
      if (dedupe.has(key)) return;

      const studentObj = Array.isArray(row.students) ? row.students[0] : row.students;
      const profileObj = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const classObj = studentObj?.classes
        ? Array.isArray(studentObj.classes)
          ? studentObj.classes[0]
          : studentObj.classes
        : null;

      dedupe.set(key, {
        id: row.id || key,
        parent_id: parentId,
        parent_email: (profileObj?.email || '').toLowerCase().trim(),
        student_id: studentId,
        student_name: studentObj?.full_name || 'Học sinh Sương Mai',
        student_code: studentObj?.student_code || '',
        class_name: classObj?.name || 'Mầm',
        relationship: row.relationship || 'Phụ huynh',
        is_verified: true,
        created_at: row.created_at,
      });
    };

    if (!spRes.error && Array.isArray(spRes.data)) {
      spRes.data.forEach((r: any) => collect(r, 'parent_user_id'));
    }
    if (!sgRes.error && Array.isArray(sgRes.data)) {
      sgRes.data.forEach((r: any) => collect(r, 'guardian_id'));
    }

    const mapped = Array.from(dedupe.values());
    globalThis.__SUONGMAI_RELATIONS_CACHE__ = mapped;
    return mapped;
  } catch (e: any) {
    console.warn('[fetchRelationsFromSupabase EXCEPTION]:', e?.message || e);
    return globalThis.__SUONGMAI_RELATIONS_CACHE__ || [];
  }
}

export async function fetchAdminUsersWithRoles(
  ctx: SessionContext,
  options?: { email?: string }
) {
  const isSuperAdmin = ctx.activeRole === 'SUPER_ADMIN';
  const targetEmail = options?.email ? options.email.toLowerCase().trim() : '';

  let allowTemporaryStaff = false;
  if (typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_SYSTEM_SETTINGS__) {
    allowTemporaryStaff =
      globalThis.__SUONGMAI_SYSTEM_SETTINGS__.allow_school_admin_view_temporary_staff;
  }

  const [settingRes, profRes, urRes, spRes, sgRes, assignRes] = await Promise.all([
    executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('system_settings')
        .select('value')
        .eq('key', 'allow_school_admin_view_temporary_staff')
        .maybeSingle()
    ),
    executeWithContextFallback(ctx, async (sb) =>
      await sb.from('profiles').select('*').order('created_at', { ascending: false })
    ),
    executeWithContextFallback(ctx, async (sb) =>
      await sb.from('user_roles').select('user_id, role_name')
    ),
    executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('student_parents')
        .select(
          'parent_user_id, student_id, relationship, students(id, full_name, student_code, class_id, classes(id, name))'
        )
    ),
    executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('student_guardians')
        .select(
          'guardian_id, student_id, relationship, students(id, full_name, student_code, class_id, classes(id, name))'
        )
    ),
    executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('teacher_class_assignments')
        .select('teacher_id, teacher_email, class_id, class_name')
    ),
  ]);

  if (settingRes.data && settingRes.data.value !== undefined) {
    allowTemporaryStaff = Boolean(settingRes.data.value);
  }

  const rolesMap = new Map<string, UserRole[]>();
  const urRows = urRes.data || [];
  urRows.forEach((r: any) => {
    const list = rolesMap.get(r.user_id) || [];
    const norm = normalizeRole(r.role_name);
    if (norm !== 'GUEST') list.push(norm);
    rolesMap.set(r.user_id, list);
  });

  const studentsMap = new Map<
    string,
    Array<{
      student_id: string;
      full_name: string;
      student_code: string;
      class_name: string;
      relationship: string;
    }>
  >();
  const addStudentLink = (userId: string, row: any) => {
    if (!userId || !row?.student_id) return;
    const list = studentsMap.get(userId) || [];
    if (list.some((x) => x.student_id === row.student_id)) return;
    const st = Array.isArray(row.students) ? row.students[0] : row.students;
    const cls = st?.classes ? (Array.isArray(st.classes) ? st.classes[0] : st.classes) : null;
    list.push({
      student_id: row.student_id,
      full_name: st?.full_name || 'Bé',
      student_code: st?.student_code || '',
      class_name: cls?.name || DEFAULT_UUID_TO_NAME[st?.class_id] || '',
      relationship: row.relationship || 'Phụ huynh',
    });
    studentsMap.set(userId, list);
  };
  (spRes.data || []).forEach((r: any) => addStudentLink(r.parent_user_id, r));
  (sgRes.data || []).forEach((r: any) => addStudentLink(r.guardian_id, r));

  const classAssignMap = new Map<string, Array<{ class_id: string; class_name: string }>>();
  (assignRes.data || []).forEach((a: any) => {
    const key = (a.teacher_email || '').toLowerCase().trim();
    if (!key) return;
    const list = classAssignMap.get(key) || [];
    list.push({ class_id: a.class_id, class_name: a.class_name || '' });
    classAssignMap.set(key, list);
  });

  const profileMap = new Map<string, any>();

  (staffCatalog as any[]).forEach((staff) => {
    const cleanEmail = staff.email.toLowerCase().trim();
    const normalized = normalizeRole(staff.role);
    profileMap.set(cleanEmail, {
      ...staff,
      role: normalized,
      roles: normalized !== 'GUEST' ? [normalized] : [],
      linked_students: [],
      assigned_classes: classAssignMap.get(cleanEmail) || [],
      is_temporary: Boolean(staff.is_temporary),
    });
  });

  const dbProfiles = profRes.data || [];
  for (const dbP of dbProfiles) {
    const email = (dbP.email || '').toLowerCase().trim();
    if (!email) continue;

    const existing = profileMap.get(email) || {};
    let baseRole = normalizeRole(dbP.role || existing.role || 'GUEST');
    if (email === 'luciaxuan178@gmail.com' && baseRole === 'SUPER_ADMIN') {
      baseRole = 'SCHOOL_ADMIN';
    }

    const dbUserRoles = rolesMap.get(dbP.id) || [];
    const linkedStudents = studentsMap.get(dbP.id) || [];
    const assignedClasses = classAssignMap.get(email) || existing.assigned_classes || [];

    // Authoritative read: trust public.user_roles rows whenever present; preserve baseRole only as fallback
    const heldRoles = sortRolesByPriority([
      ...dbUserRoles,
      ...(dbUserRoles.length === 0 && baseRole !== 'GUEST' ? [baseRole] : []),
      ...(linkedStudents.length > 0 ? (['PARENT'] as UserRole[]) : []),
    ]);

    profileMap.set(email, {
      ...existing,
      ...dbP,
      id: dbP.id || existing.id,
      full_name: dbP.full_name || existing.full_name,
      role: heldRoles[0] || baseRole,
      roles: heldRoles,
      linked_students: linkedStudents,
      assigned_classes: assignedClasses,
      phone: dbP.phone || existing.phone,
      avatar_url: dbP.avatar_url || existing.avatar_url,
      approval_status: dbP.approval_status || existing.approval_status || 'PENDING',
      assigned_class_name: dbP.assigned_class_name || existing.assigned_class_name,
      is_temporary:
        dbP.is_temporary !== undefined ? Boolean(dbP.is_temporary) : Boolean(existing.is_temporary),
      created_at: dbP.created_at || existing.created_at,
    });
  }

  const allUsers = Array.from(profileMap.values());
  const filteredUsers = allUsers.filter((u) => {
    if (!isSuperAdmin && !allowTemporaryStaff && u.is_temporary) {
      return false;
    }
    if (targetEmail && (u.email || '').toLowerCase().trim() !== targetEmail) {
      return false;
    }
    return true;
  });

  const { isValidServiceRoleKey, serviceRoleKeyKind, jwtSecret } = getSupabaseConfig();
  const hasAuthRlsPath =
    isValidServiceRoleKey ||
    Boolean(jwtSecret && !ctx.profileId.startsWith('bootstrap-')) ||
    Boolean(ctx.supabaseAccessToken);
  const dbWarning =
    urRes.error?.message ||
    profRes.error?.message ||
    spRes.error?.message ||
    (!hasAuthRlsPath
      ? serviceRoleKeyKind === 'invalid_publishable' || serviceRoleKeyKind === 'invalid_anon_jwt'
        ? 'Biến SUPABASE_SERVICE_ROLE_KEY trên server đang chứa publishable/anon key nên truy vấn user_roles/students có thể bị chặn bởi RLS.'
        : 'Thiếu SUPABASE_SERVICE_ROLE_KEY hợp lệ trên server: truy vấn user_roles/students có thể bị chặn bởi RLS.'
      : null);

  return {
    users: filteredUsers,
    targetUser: targetEmail ? filteredUsers[0] || null : null,
    isSuperAdmin,
    allowTemporaryStaff,
    hasServiceRoleKey: isValidServiceRoleKey,
    dbWarning,
  };
}

export async function syncUserMultiRolesAndLinks(
  ctx: SessionContext,
  body: Record<string, any>
): Promise<
  | {
      ok: true;
      profile: Profile & { roles: UserRole[] };
      relations: ParentStudentRelation[];
    }
  | {
      ok: false;
      status: number;
      error?: string;
      message: string;
    }
> {
  const email = String(body.email || '').toLowerCase().trim();
  if (!email) {
    return { ok: false, status: 400, message: 'Email là bắt buộc' };
  }

  const { data: existingDbProfile, error: existingErr } = await executeWithContextFallback(
    ctx,
    async (sb) => await sb.from('profiles').select('*').ilike('email', email).maybeSingle()
  );

  if (existingErr) {
    return {
      ok: false,
      status: 500,
      message: `Lỗi truy vấn hồ sơ người dùng: ${existingErr.message}`,
    };
  }

  const serverCache = [...(globalThis.__SUONGMAI_PROFILES_CACHE__ || [])];
  const idx = serverCache.findIndex((p) => p.email?.toLowerCase().trim() === email);
  const catalogMatch = (staffCatalog as any[]).find(
    (s) => s.email?.toLowerCase().trim() === email
  );
  const resolvedId = ensureValidUuid(
    existingDbProfile?.id || (idx !== -1 ? serverCache[idx].id : catalogMatch?.id)
  );

  const { data: existingRoleRows } = await executeWithContextFallback(
    ctx,
    async (sb) => await sb.from('user_roles').select('role_name').eq('user_id', resolvedId)
  );

  const currentRoles: UserRole[] = (existingRoleRows || []).map((r: any) =>
    normalizeRole(r.role_name)
  );
  if (existingDbProfile?.role && normalizeRole(existingDbProfile.role) !== 'GUEST') {
    currentRoles.push(normalizeRole(existingDbProfile.role));
  }

  let effectiveRoles: AssignableRole[] = [];
  const isExplicitRolesArray = Array.isArray(body.roles);

  if (isExplicitRolesArray) {
    effectiveRoles = sortRolesByPriority(
      body.roles
        .map((r: unknown) => normalizeRole(r))
        .filter((r: UserRole): r is AssignableRole =>
          ASSIGNABLE_ROLES.includes(r as AssignableRole)
        )
    ) as AssignableRole[];
  } else if (body.role) {
    const requestedSingle = normalizeRole(body.role);
    const retainedParent =
      body.clear_student_links !== true &&
      (requestedSingle === 'TEACHER' || requestedSingle === 'STAFF') &&
      currentRoles.includes('PARENT');

    effectiveRoles = sortRolesByPriority([
      ...(ASSIGNABLE_ROLES.includes(requestedSingle as AssignableRole) ? [requestedSingle] : []),
      ...(retainedParent ? (['PARENT'] as UserRole[]) : []),
    ]) as AssignableRole[];
  } else {
    effectiveRoles = sortRolesByPriority(
      currentRoles.filter((r): r is AssignableRole =>
        ASSIGNABLE_ROLES.includes(r as AssignableRole)
      )
    ) as AssignableRole[];
  }

  const tryingAdminGrant = effectiveRoles.some(
    (r) => (r === 'SUPER_ADMIN' || r === 'SCHOOL_ADMIN') && !currentRoles.includes(r)
  );
  if (tryingAdminGrant && ctx.activeRole !== 'SUPER_ADMIN') {
    return {
      ok: false,
      status: 403,
      error: 'FORBIDDEN_ROLE_ESCALATION',
      message: 'Chỉ Quản trị tối cao (SUPER_ADMIN) mới có quyền cấp vai trò Quản trị trường.',
    };
  }

  const resolvedStatus =
    body.approval_status ||
    existingDbProfile?.approval_status ||
    (idx !== -1 ? serverCache[idx].approval_status : 'ACTIVE');

  if (resolvedStatus !== 'REJECTED' && effectiveRoles.length === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Vui lòng chọn ít nhất 1 vai trò hợp lệ cho tài khoản.',
    };
  }

  const primaryRole: UserRole =
    resolvedStatus === 'REJECTED'
      ? existingDbProfile?.role || 'GUEST'
      : getHighestPriorityRole(effectiveRoles) ||
        (body.role ? normalizeRole(body.role) : existingDbProfile?.role || 'GUEST');

  const holdsTeacher = effectiveRoles.includes('TEACHER');
  const holdsParent = effectiveRoles.includes('PARENT');

  let canonicalClassIds: string[] = [];
  let liveClassesList: Array<{ id: string; name: string }> = [];

  if (holdsTeacher && Array.isArray(body.assigned_class_ids)) {
    const { data: classesData } = await executeWithContextFallback(
      ctx,
      async (sb) => await sb.from('classes').select('id, name')
    );
    liveClassesList = Array.isArray(classesData) ? classesData : [];
    canonicalClassIds = Array.from(
      new Set(
        body.assigned_class_ids
          .filter(Boolean)
          .map((rawId: unknown) => resolveCanonicalClassId(String(rawId), liveClassesList))
          .filter(Boolean)
      )
    );
  }

  const derivedClassId =
    canonicalClassIds.length > 0
      ? canonicalClassIds[0]
      : body.assigned_class_id !== undefined && body.assigned_class_id !== null
      ? resolveCanonicalClassId(String(body.assigned_class_id), liveClassesList)
      : existingDbProfile?.assigned_class_id ?? (idx !== -1 ? serverCache[idx].assigned_class_id : null);

  const derivedClassNames =
    canonicalClassIds.length > 0
      ? canonicalClassIds
          .map((cid) => resolveClassDisplayName(cid, liveClassesList) || DEFAULT_UUID_TO_NAME[cid] || cid)
          .filter(Boolean)
          .join(', ')
      : body.assigned_class_name !== undefined
      ? body.assigned_class_name
      : existingDbProfile?.assigned_class_name ??
        (idx !== -1 ? serverCache[idx].assigned_class_name : null);

  const resolvedClassId = !holdsTeacher ? null : derivedClassId;
  const resolvedClassName = !holdsTeacher ? null : derivedClassNames;

  const upsertPayload: Record<string, any> = {
    id: resolvedId,
    email,
    full_name:
      body.full_name ||
      existingDbProfile?.full_name ||
      (idx !== -1 ? serverCache[idx].full_name : catalogMatch?.full_name || email.split('@')[0]),
    role: primaryRole,
    approval_status: resolvedStatus,
    assigned_class_id: resolvedClassId,
    assigned_class_name: resolvedClassName,
    updated_at: new Date().toISOString(),
  };

  const { data: upsertedData, error: upsertErr } = existingDbProfile?.id
    ? await executeWithContextFallback(
        ctx,
        async (sb) =>
          await sb
            .from('profiles')
            .update({
              full_name: upsertPayload.full_name,
              role: upsertPayload.role,
              approval_status: upsertPayload.approval_status,
              assigned_class_id: upsertPayload.assigned_class_id,
              assigned_class_name: upsertPayload.assigned_class_name,
              updated_at: upsertPayload.updated_at,
            })
            .eq('id', existingDbProfile.id)
            .select()
      )
    : await executeWithContextFallback(
        ctx,
        async (sb) => await sb.from('profiles').upsert(upsertPayload, { onConflict: 'email' }).select()
      );

  if (upsertErr) {
    return {
      ok: false,
      status: 500,
      message: `Không thể lưu hồ sơ vào Supabase: ${upsertErr.message}`,
    };
  }

  const persistedId =
    upsertedData && upsertedData.length > 0 ? upsertedData[0].id : resolvedId;

  // 1. Sync public.user_roles atomically with strict error & read-back verification
  if (resolvedStatus !== 'REJECTED' && (isExplicitRolesArray || body.role)) {
    if (isExplicitRolesArray) {
      const removedRoles = ASSIGNABLE_ROLES.filter((r) => !effectiveRoles.includes(r));
      if (removedRoles.length > 0) {
        const { error: delRolesErr } = await executeWithContextFallback(ctx, async (sb) =>
          await sb
            .from('user_roles')
            .delete()
            .eq('user_id', persistedId)
            .in('role_name', removedRoles)
        );
        if (delRolesErr) {
          return {
            ok: false,
            status: 500,
            message: `Không thể cập nhật thu hồi vai trò cũ trong user_roles: ${delRolesErr.message}`,
          };
        }
      }
    }

    if (effectiveRoles.length > 0) {
      const { error: urUpsertErr } = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('user_roles').upsert(
          effectiveRoles.map((role_name) => ({ user_id: persistedId, role_name })),
          { onConflict: 'user_id,role_name', ignoreDuplicates: true }
        )
      );
      if (urUpsertErr) {
        return {
          ok: false,
          status: 500,
          message: `Không thể lưu đủ vai trò [${effectiveRoles.join(', ')}] vào user_roles: ${urUpsertErr.message}. Kiểm tra SUPABASE_SERVICE_ROLE_KEY hoặc quyền RLS Admin trên user_roles.`,
        };
      }

      // Read back to verify ALL requested roles persisted intact (never silently drop a role!)
      const { data: verifiedRows, error: verifyErr } = await executeWithContextFallback(
        ctx,
        async (sb) => await sb.from('user_roles').select('role_name').eq('user_id', persistedId)
      );
      if (verifyErr) {
        return {
          ok: false,
          status: 500,
          message: `Không thể xác minh dữ liệu user_roles sau khi lưu: ${verifyErr.message}`,
        };
      }
      const verifiedSet = new Set(
        (verifiedRows || []).map((r: any) => normalizeRole(r.role_name))
      );
      const missingRoles = effectiveRoles.filter((r) => !verifiedSet.has(r));
      if (missingRoles.length > 0) {
        return {
          ok: false,
          status: 500,
          message: `Đồng bộ user_roles không đầy đủ — thiếu vai trò [${missingRoles.join(', ')}] trong CSDL. Vui lòng kiểm tra SUPABASE_SERVICE_ROLE_KEY trên server.`,
        };
      }
    }
  }

  // 2. Sync teacher_class_assignments
  if (holdsTeacher && Array.isArray(body.assigned_class_ids)) {
    const { error: delAssignErr } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('teacher_class_assignments').delete().ilike('teacher_email', email)
    );
    if (delAssignErr) {
      return {
        ok: false,
        status: 500,
        message: `Không thể xóa phân công lớp cũ: ${delAssignErr.message}`,
      };
    }

    if (canonicalClassIds.length > 0) {
      const { error: insAssignErr } = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('teacher_class_assignments').insert(
          canonicalClassIds.map((cid) => ({
            teacher_email: email,
            teacher_id: persistedId,
            class_id: cid,
            class_name:
              resolveClassDisplayName(cid, liveClassesList) || DEFAULT_UUID_TO_NAME[cid] || '',
            academic_year: '2026-2027',
            is_main_teacher: true,
          }))
        )
      );
      if (insAssignErr) {
        return {
          ok: false,
          status: 500,
          message: `Không thể lưu phân công lớp mới: ${insAssignErr.message}`,
        };
      }
    }
  } else if (!holdsTeacher && isExplicitRolesArray) {
    await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('teacher_class_assignments').delete().ilike('teacher_email', email)
    );
  }

  // 3. Sync student_parents & student_guardians ONLY when student_ids/children_ids passed or explicit clear requested
  const incomingStudentIds = Array.isArray(body.student_ids)
    ? body.student_ids
    : Array.isArray(body.children_ids)
    ? body.children_ids
    : null;

  if (incomingStudentIds && UUID_REGEX.test(String(persistedId))) {
    const uniqueStudentIds: string[] = Array.from(
      new Set<string>(
        incomingStudentIds
          .map((id: any) => String(id || '').trim())
          .filter((id: string) => UUID_REGEX.test(id))
      )
    );

    const [delSpRes, delSgRes] = await Promise.all([
      executeWithContextFallback(ctx, async (sb) =>
        await sb.from('student_parents').delete().eq('parent_user_id', persistedId)
      ),
      executeWithContextFallback(ctx, async (sb) =>
        await sb.from('student_guardians').delete().eq('guardian_id', persistedId)
      ),
    ]);
    if (delSpRes.error && delSgRes.error) {
      return {
        ok: false,
        status: 500,
        message: `Không thể cập nhật liên kết con em: ${delSpRes.error.message}`,
      };
    }

    if (uniqueStudentIds.length > 0) {
      const [spInsRes, sgInsRes] = await Promise.all([
        executeWithContextFallback(ctx, async (sb) =>
          await sb.from('student_parents').upsert(
            uniqueStudentIds.map((studentId, index) => ({
              student_id: studentId,
              parent_user_id: persistedId,
              relationship: String(body.relationship || 'Phụ huynh'),
              is_primary: index === 0,
            })),
            { onConflict: 'student_id,parent_user_id' }
          )
        ),
        executeWithContextFallback(ctx, async (sb) =>
          await sb.from('student_guardians').upsert(
            uniqueStudentIds.map((studentId, index) => ({
              student_id: studentId,
              guardian_id: persistedId,
              relationship: toGuardianRelationship(String(body.relationship || 'NGƯỜI GIÁM HỘ')),
              is_primary: index === 0,
            })),
            { onConflict: 'student_id,guardian_id' }
          )
        ),
      ]);

      if (spInsRes.error && sgInsRes.error) {
        return {
          ok: false,
          status: 500,
          message: `Không thể liên kết hồ sơ con em: ${spInsRes.error.message}`,
        };
      }

      if (!holdsParent) {
        const { error: parentRoleErr } = await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('user_roles').upsert(
            { user_id: persistedId, role_name: 'PARENT' },
            { onConflict: 'user_id,role_name', ignoreDuplicates: true }
          )
        );
        if (parentRoleErr) {
          return {
            ok: false,
            status: 500,
            message: `Không thể bổ sung vai trò Phụ huynh vào user_roles: ${parentRoleErr.message}`,
          };
        }
        effectiveRoles = sortRolesByPriority([
          ...effectiveRoles,
          'PARENT' as AssignableRole,
        ]) as AssignableRole[];
      }
    }
  } else if (body.clear_student_links === true && UUID_REGEX.test(String(persistedId))) {
    await Promise.all([
      executeWithContextFallback(ctx, async (sb) =>
        await sb.from('student_parents').delete().eq('parent_user_id', persistedId)
      ),
      executeWithContextFallback(ctx, async (sb) =>
        await sb.from('student_guardians').delete().eq('guardian_id', persistedId)
      ),
    ]);
  }

  const relations = await fetchRelationsFromSupabase(ctx);
  const targetProfile: Profile & { roles: UserRole[] } = {
    ...(existingDbProfile || {}),
    ...(upsertedData?.[0] || upsertPayload),
    id: persistedId,
    role: effectiveRoles[0] || primaryRole,
    roles: effectiveRoles,
  };

  if (globalThis.__SUONGMAI_PROFILES_CACHE__) {
    const cacheIdx = globalThis.__SUONGMAI_PROFILES_CACHE__.findIndex(
      (p) => p.email?.toLowerCase().trim() === email
    );
    if (cacheIdx !== -1) {
      globalThis.__SUONGMAI_PROFILES_CACHE__[cacheIdx] = {
        ...globalThis.__SUONGMAI_PROFILES_CACHE__[cacheIdx],
        ...targetProfile,
      };
    } else {
      globalThis.__SUONGMAI_PROFILES_CACHE__.push(targetProfile);
    }
  }

  return {
    ok: true,
    profile: targetProfile,
    relations,
  };
}
