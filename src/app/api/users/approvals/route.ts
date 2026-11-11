import { NextResponse } from 'next/server';
import {
  executeWithAdminFallback,
  getSupabaseAdminClient,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  getHighestPriorityRole,
  getSessionContext,
  isAdminRole,
  normalizeRole,
  requireActiveRole,
  sortRolesByPriority,
} from '@/lib/auth/sessionContext';
import {
  DEFAULT_UUID_TO_NAME,
  resolveCanonicalClassId,
  resolveClassDisplayName,
} from '@/lib/constants/classes';
import { AssignableRole, ParentStudentRelation, Profile, UserRole } from '@/lib/types/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INITIAL_SERVER_PROFILES: Profile[] = [
  {
    id: 'u-super-admin-sadmin',
    full_name: 'Quản Trị Tối Cao (Super Admin)',
    email: 'sadmin@suongmai.edu.vn',
    role: 'SUPER_ADMIN',
    roles: ['SUPER_ADMIN'],
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSIGNABLE_ROLES: AssignableRole[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STAFF'];

declare global {
  var __SUONGMAI_PROFILES_CACHE__: Profile[] | undefined;
  var __SUONGMAI_RELATIONS_CACHE__: ParentStudentRelation[] | undefined;
}

if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
  globalThis.__SUONGMAI_PROFILES_CACHE__ = [...INITIAL_SERVER_PROFILES];
}
if (!globalThis.__SUONGMAI_RELATIONS_CACHE__) {
  globalThis.__SUONGMAI_RELATIONS_CACHE__ = [];
}

function ensureValidUuid(candidate?: string): string {
  if (candidate && UUID_REGEX.test(String(candidate))) return String(candidate);
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
}

function toGuardianRelationship(input: string): 'BỐ' | 'MẸ' | 'ÔNG' | 'BÀ' | 'NGƯỜI GIÁM HỘ' {
  const s = (input || '').toLowerCase().trim();
  if (s === 'bố' || s === 'bo' || s === 'father') return 'BỐ';
  if (s === 'mẹ' || s === 'me' || s === 'mother') return 'MẸ';
  if (s === 'ông' || s === 'ong') return 'ÔNG';
  if (s === 'bà' || s === 'ba') return 'BÀ';
  return 'NGƯỜI GIÁM HỘ';
}

async function fetchRelationsFromSupabase(): Promise<ParentStudentRelation[]> {
  try {
    const [spRes, sgRes] = await Promise.all([
      executeWithAdminFallback(async (sb) =>
        await sb
          .from('student_parents')
          .select(
            'student_id, parent_user_id, relationship, is_primary, created_at, students(id, full_name, student_code, class_id, classes(id, name)), profiles(id, email, full_name)'
          )
          .order('created_at', { ascending: true })
      ),
      executeWithAdminFallback(async (sb) =>
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
    console.warn('[API GET RELATIONS EXCEPTION]:', e?.message || e);
    return globalThis.__SUONGMAI_RELATIONS_CACHE__ || [];
  }
}

export async function GET(request: Request) {
  const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
  if ('response' in auth) return auth.response;

  const serverCache = [...(globalThis.__SUONGMAI_PROFILES_CACHE__ || INITIAL_SERVER_PROFILES)];
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let dbProfilesCount = 0;
  let dbErrorDetail: string | null = null;
  let relations: ParentStudentRelation[] = [];
  const rolesByUserId = new Map<string, UserRole[]>();

  try {
    const [profRes, urRes, rels] = await Promise.all([
      executeWithAdminFallback(async (sb) =>
        await sb.from('profiles').select('*').order('created_at', { ascending: false })
      ),
      executeWithAdminFallback(async (sb) =>
        await sb.from('user_roles').select('user_id, role_name')
      ),
      fetchRelationsFromSupabase(),
    ]);

    relations = rels;

    if (!urRes.error && Array.isArray(urRes.data)) {
      urRes.data.forEach((row: any) => {
        const list = rolesByUserId.get(row.user_id) || [];
        list.push(normalizeRole(row.role_name));
        rolesByUserId.set(row.user_id, list);
      });
    }

    if (profRes.error) {
      dbErrorDetail = profRes.error.message;
      console.error('[API GET APPROVALS ERROR]:', profRes.error.message);
    } else if (Array.isArray(profRes.data) && profRes.data.length > 0) {
      dbProfilesCount = profRes.data.length;
      for (const dbProfile of profRes.data as Profile[]) {
        const idx = serverCache.findIndex(
          (p) => p.email.toLowerCase().trim() === dbProfile.email?.toLowerCase().trim()
        );
        if (idx !== -1) {
          serverCache[idx] = { ...serverCache[idx], ...dbProfile };
        } else {
          serverCache.push(dbProfile);
        }
      }
    }
  } catch (e: any) {
    dbErrorDetail = e?.message || String(e);
    console.warn('[API GET APPROVALS EXCEPTION]:', dbErrorDetail);
  }

  const sadminIdx = serverCache.findIndex(
    (p) => p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn'
  );
  if (sadminIdx === -1) {
    serverCache.unshift(INITIAL_SERVER_PROFILES[0]);
  } else {
    serverCache[sadminIdx].role = 'SUPER_ADMIN';
    serverCache[sadminIdx].approval_status = 'ACTIVE';
  }

  const DEPRECATED_MOCK_EMAILS = [
    'admin@suongmai.edu.vn',
    'so.maria@suongmai.edu.vn',
    'teacher@suongmai.edu.vn',
    'teacher.pending@suongmai.edu.vn',
    'parent@suongmai.edu.vn',
    'parent.pending@gmail.com',
  ];

  const sanitized = serverCache
    .filter((p) => {
      const clean = (p.email || '').toLowerCase().trim();
      return Boolean(clean) && !DEPRECATED_MOCK_EMAILS.includes(clean);
    })
    .map((p) => {
      const clean = (p.email || '').toLowerCase().trim();
      const baseRole =
        clean === 'luciaxuan178@gmail.com' && p.role === 'SUPER_ADMIN'
          ? 'SCHOOL_ADMIN'
          : normalizeRole(p.role);

      const hasRel = relations.some(
        (r) => r.parent_id === p.id || r.parent_email?.toLowerCase().trim() === clean
      );
      const heldRoles = sortRolesByPriority([
        ...(rolesByUserId.get(p.id) || []),
        ...(baseRole !== 'GUEST' ? [baseRole] : []),
        ...(hasRel ? (['PARENT'] as UserRole[]) : []),
      ]);

      return {
        ...p,
        role: heldRoles[0] || baseRole,
        roles: heldRoles,
      };
    });

  globalThis.__SUONGMAI_PROFILES_CACHE__ = sanitized;
  return NextResponse.json(
    {
      success: true,
      profiles: sanitized,
      data: sanitized,
      users: sanitized,
      relations,
      pendingProfiles: sanitized.filter(
        (p) => (p.approval_status || 'PENDING').toUpperCase() === 'PENDING'
      ),
      debug: {
        hasServiceRoleKey,
        dbProfilesCount,
        totalProfilesCount: sanitized.length,
        relationsCount: relations.length,
        dbError: dbErrorDetail,
      },
    },
    { headers: NO_CACHE_HEADERS }
  );
}

/**
 * Registers or resolves the caller's own Google OAuth profile cleanly.
 * Requires either an active Admin session OR a valid Supabase Bearer JWT matching body.email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let email = (body.email || '').toLowerCase().trim();
    const fullName = body.full_name || '';
    const avatarUrl = body.avatar_url;

    // Authenticate caller: Admin session OR matching Supabase Bearer JWT
    const { ctx } = await getSessionContext(request);
    let bearerUser: { id?: string; email?: string } | null = null;

    if (!ctx || !isAdminRole(ctx.activeRole)) {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
      if (token) {
        const sb = getSupabaseAdminClient();
        const { data } = await sb.auth.getUser(token);
        if (data?.user?.email) {
          bearerUser = { id: data.user.id, email: data.user.email.toLowerCase().trim() };
        }
      }
    }

    if (bearerUser?.email) {
      if (email && email !== bearerUser.email) {
        return NextResponse.json(
          { success: false, message: 'Email không khớp với phiên đăng nhập.' },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      email = bearerUser.email;
    } else if (!ctx || (!isAdminRole(ctx.activeRole) && ctx.email !== email)) {
      return NextResponse.json(
        { success: false, message: 'Yêu cầu xác thực hợp lệ.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email là bắt buộc' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const serverCache = [...(globalThis.__SUONGMAI_PROFILES_CACHE__ || INITIAL_SERVER_PROFILES)];
    const existing = serverCache.find((p) => p.email.toLowerCase().trim() === email);

    const isSadmin = email === 'sadmin@suongmai.edu.vn';
    const isSchoolAdmin = email === 'luciaxuan178@gmail.com';
    const generatedId = ensureValidUuid(existing?.id);

    const newProfile: Profile = existing || {
      id: generatedId,
      auth_user_id: bearerUser?.id || null,
      email,
      full_name: fullName || (isSadmin ? 'Quản Trị Tối Cao (Super Admin)' : email.split('@')[0]),
      role: isSadmin ? 'SUPER_ADMIN' : isSchoolAdmin ? 'SCHOOL_ADMIN' : 'GUEST',
      approval_status: isSadmin || isSchoolAdmin ? 'ACTIVE' : 'PENDING',
      avatar_url:
        avatarUrl ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
    };

    const { data: dbExisting } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('profiles')
        .select('id, auth_user_id, role, approval_status, full_name, avatar_url')
        .ilike('email', email)
        .maybeSingle()
    );

    if (dbExisting) {
      newProfile.id = dbExisting.id;
      newProfile.role = normalizeRole(dbExisting.role);
      newProfile.approval_status = dbExisting.approval_status;
      newProfile.full_name = dbExisting.full_name || newProfile.full_name;
      if (bearerUser?.id && !dbExisting.auth_user_id) {
        await executeWithAdminFallback(async (sb) =>
          await sb.from('profiles').update({ auth_user_id: bearerUser!.id }).eq('id', dbExisting.id)
        );
      }
    } else {
      const insertPayload: Record<string, any> = {
        id: ensureValidUuid(newProfile.id),
        email: newProfile.email,
        full_name: newProfile.full_name,
        role: newProfile.role,
        approval_status: newProfile.approval_status,
        avatar_url: newProfile.avatar_url,
        created_at: newProfile.created_at,
      };
      if (bearerUser?.id) insertPayload.auth_user_id = bearerUser.id;
      await executeWithAdminFallback(async (sb) => await sb.from('profiles').insert(insertPayload));

      if (newProfile.role === 'SUPER_ADMIN' || newProfile.role === 'SCHOOL_ADMIN') {
        await executeWithAdminFallback(async (sb) =>
          await sb.from('user_roles').upsert(
            { user_id: insertPayload.id, role_name: newProfile.role },
            { onConflict: 'user_id,role_name', ignoreDuplicates: true }
          )
        );
      }
    }

    return NextResponse.json({ success: true, profile: newProfile }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email là bắt buộc' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { data: existingDbProfile } = await executeWithAdminFallback(async (sb) =>
      await sb.from('profiles').select('*').ilike('email', email).maybeSingle()
    );

    const serverCache = [...(globalThis.__SUONGMAI_PROFILES_CACHE__ || INITIAL_SERVER_PROFILES)];
    const idx = serverCache.findIndex((p) => p.email.toLowerCase().trim() === email);
    const resolvedId = ensureValidUuid(
      existingDbProfile?.id || (idx !== -1 ? serverCache[idx].id : undefined)
    );

    // Fetch existing user_roles
    const { data: existingRoleRows } = await executeWithAdminFallback(async (sb) =>
      await sb.from('user_roles').select('role_name').eq('user_id', resolvedId)
    );
    const currentRoles = (existingRoleRows || []).map((r: any) => normalizeRole(r.role_name));
    if (existingDbProfile?.role && normalizeRole(existingDbProfile.role) !== 'GUEST') {
      currentRoles.push(normalizeRole(existingDbProfile.role));
    }

    // Resolve requested multi-role list vs legacy single role
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
        ...(ASSIGNABLE_ROLES.includes(requestedSingle as AssignableRole)
          ? [requestedSingle]
          : []),
        ...(retainedParent ? (['PARENT'] as UserRole[]) : []),
      ]) as AssignableRole[];
    } else {
      effectiveRoles = sortRolesByPriority(
        currentRoles.filter((r): r is AssignableRole =>
          ASSIGNABLE_ROLES.includes(r as AssignableRole)
        )
      ) as AssignableRole[];
    }

    // Only SUPER_ADMIN can assign/grant SUPER_ADMIN or SCHOOL_ADMIN
    const tryingAdminGrant = effectiveRoles.some(
      (r) => (r === 'SUPER_ADMIN' || r === 'SCHOOL_ADMIN') && !currentRoles.includes(r)
    );
    if (tryingAdminGrant && ctx.activeRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_ROLE_ESCALATION',
          message: 'Chỉ Quản trị tối cao (SUPER_ADMIN) mới có quyền cấp vai trò Quản trị trường.',
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const resolvedStatus =
      body.approval_status ||
      existingDbProfile?.approval_status ||
      (idx !== -1 ? serverCache[idx].approval_status : 'ACTIVE');

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
      const { data: classesData } = await executeWithAdminFallback(async (sb) =>
        await sb.from('classes').select('id, name')
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
        : existingDbProfile?.assigned_class_name ?? (idx !== -1 ? serverCache[idx].assigned_class_name : null);

    const resolvedClassId = !holdsTeacher ? null : derivedClassId;
    const resolvedClassName = !holdsTeacher ? null : derivedClassNames;

    const upsertPayload: Record<string, any> = {
      id: resolvedId,
      email,
      full_name:
        body.full_name ||
        existingDbProfile?.full_name ||
        (idx !== -1 ? serverCache[idx].full_name : email.split('@')[0]),
      role: primaryRole,
      approval_status: resolvedStatus,
      assigned_class_id: resolvedClassId,
      assigned_class_name: resolvedClassName,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedData, error: upsertErr } = await executeWithAdminFallback(async (sb) =>
      await sb.from('profiles').upsert(upsertPayload, { onConflict: 'email' }).select()
    );

    if (upsertErr) {
      return NextResponse.json(
        {
          success: false,
          message: `Không thể lưu vai trò vào Supabase: ${upsertErr.message}`,
        },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const persistedId =
      upsertedData && upsertedData.length > 0 ? upsertedData[0].id : resolvedId;

    // 1. Sync public.user_roles
    if (resolvedStatus !== 'REJECTED' && (isExplicitRolesArray || body.role)) {
      if (effectiveRoles.length > 0) {
        await executeWithAdminFallback(async (sb) =>
          await sb.from('user_roles').upsert(
            effectiveRoles.map((role_name) => ({ user_id: persistedId, role_name })),
            { onConflict: 'user_id,role_name', ignoreDuplicates: true }
          )
        );
      }

      if (isExplicitRolesArray) {
        const removedRoles = ASSIGNABLE_ROLES.filter((r) => !effectiveRoles.includes(r));
        if (removedRoles.length > 0) {
          await executeWithAdminFallback(async (sb) =>
            await sb
              .from('user_roles')
              .delete()
              .eq('user_id', persistedId)
              .in('role_name', removedRoles)
          );
        }
      }
    }

    // 2. Sync teacher_class_assignments cleanly when TEACHER role changes or class_ids provided
    if (holdsTeacher && Array.isArray(body.assigned_class_ids)) {
      await executeWithAdminFallback(async (sb) =>
        await sb.from('teacher_class_assignments').delete().eq('teacher_email', email)
      );

      if (canonicalClassIds.length > 0) {
        await executeWithAdminFallback(async (sb) =>
          await sb.from('teacher_class_assignments').insert(
            canonicalClassIds.map((cid) => ({
              teacher_email: email,
              teacher_id: persistedId,
              class_id: cid,
              class_name: resolveClassDisplayName(cid, liveClassesList) || DEFAULT_UUID_TO_NAME[cid] || '',
              academic_year: '2026-2027',
              is_main_teacher: true,
            }))
          )
        );
      }
    } else if (!holdsTeacher && isExplicitRolesArray) {
      await executeWithAdminFallback(async (sb) =>
        await sb.from('teacher_class_assignments').delete().eq('teacher_email', email)
      );
    }

    // 3. Sync student_parents & student_guardians ONLY when student_ids passed or explicit clear requested
    // CR-01 BUGFIX: NEVER auto-delete student links when approving/granting TEACHER or STAFF!
    if (Array.isArray(body.student_ids) && UUID_REGEX.test(String(persistedId))) {
      const uniqueStudentIds: string[] = Array.from(
        new Set<string>(
          body.student_ids
            .map((id: any) => String(id || '').trim())
            .filter((id: string) => UUID_REGEX.test(id))
        )
      );

      await Promise.all([
        executeWithAdminFallback(async (sb) =>
          await sb.from('student_parents').delete().eq('parent_user_id', persistedId)
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('student_guardians').delete().eq('guardian_id', persistedId)
        ),
      ]);

      if (uniqueStudentIds.length > 0) {
        await Promise.all([
          executeWithAdminFallback(async (sb) =>
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
          executeWithAdminFallback(async (sb) =>
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

        if (!holdsParent) {
          await executeWithAdminFallback(async (sb) =>
            await sb.from('user_roles').upsert(
              { user_id: persistedId, role_name: 'PARENT' },
              { onConflict: 'user_id,role_name', ignoreDuplicates: true }
            )
          );
          effectiveRoles = sortRolesByPriority([
            ...effectiveRoles,
            'PARENT' as AssignableRole,
          ]) as AssignableRole[];
        }
      }
    } else if (body.clear_student_links === true && UUID_REGEX.test(String(persistedId))) {
      await Promise.all([
        executeWithAdminFallback(async (sb) =>
          await sb.from('student_parents').delete().eq('parent_user_id', persistedId)
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('student_guardians').delete().eq('guardian_id', persistedId)
        ),
      ]);
    }

    const relations = await fetchRelationsFromSupabase();
    const targetProfile = {
      ...(existingDbProfile || {}),
      ...(upsertedData?.[0] || upsertPayload),
      id: persistedId,
      roles: effectiveRoles,
    };

    return NextResponse.json(
      {
        success: true,
        profile: targetProfile,
        relations,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[APPROVE EXCEPTION] PUT handler error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email là bắt buộc' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (globalThis.__SUONGMAI_PROFILES_CACHE__) {
      globalThis.__SUONGMAI_PROFILES_CACHE__ = globalThis.__SUONGMAI_PROFILES_CACHE__.filter(
        (p) => p.email.toLowerCase().trim() !== email
      );
    }

    await executeWithAdminFallback(async (sb) =>
      await sb.from('profiles').delete().eq('email', email)
    );

    return NextResponse.json(
      { success: true, message: `Đã xóa tài khoản ${email}` },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
