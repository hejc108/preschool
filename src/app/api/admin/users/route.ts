import { NextResponse } from 'next/server';
import { executeWithAdminFallback, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import staffCatalog from '@/lib/data/staff_catalog.json';
import {
  normalizeRole,
  requireActiveRole,
  sortRolesByPriority,
} from '@/lib/auth/sessionContext';
import { UserRole } from '@/lib/types/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const isSuperAdmin = ctx.activeRole === 'SUPER_ADMIN';

    // 1. Read global system settings
    let allowTemporaryStaff = false;
    if (typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_SYSTEM_SETTINGS__) {
      allowTemporaryStaff =
        globalThis.__SUONGMAI_SYSTEM_SETTINGS__.allow_school_admin_view_temporary_staff;
    }

    const [{ data: settingRow }, { data: dbProfiles }, { data: urRows }, { data: spRows }, { data: sgRows }, { data: assignRows }] =
      await Promise.all([
        executeWithAdminFallback(async (sb) =>
          await sb
            .from('system_settings')
            .select('value')
            .eq('key', 'allow_school_admin_view_temporary_staff')
            .maybeSingle()
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('profiles').select('*').order('created_at', { ascending: false })
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('user_roles').select('user_id, role_name')
        ),
        executeWithAdminFallback(async (sb) =>
          await sb
            .from('student_parents')
            .select('parent_user_id, student_id, relationship, students(id, full_name, student_code, class_id, classes(id, name))')
        ),
        executeWithAdminFallback(async (sb) =>
          await sb
            .from('student_guardians')
            .select('guardian_id, student_id, relationship, students(id, full_name, student_code, class_id, classes(id, name))')
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('teacher_class_assignments').select('teacher_id, teacher_email, class_id, class_name')
        ),
      ]);

    if (settingRow && settingRow.value !== undefined) {
      allowTemporaryStaff = Boolean(settingRow.value);
    }

    const rolesMap = new Map<string, UserRole[]>();
    (urRows || []).forEach((r: any) => {
      const list = rolesMap.get(r.user_id) || [];
      list.push(normalizeRole(r.role_name));
      rolesMap.set(r.user_id, list);
    });

    const studentsMap = new Map<string, Array<{ student_id: string; full_name: string; student_code: string; class_name: string; relationship: string }>>();
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
        class_name: cls?.name || '',
        relationship: row.relationship || 'Phụ huynh',
      });
      studentsMap.set(userId, list);
    };
    (spRows || []).forEach((r: any) => addStudentLink(r.parent_user_id, r));
    (sgRows || []).forEach((r: any) => addStudentLink(r.guardian_id, r));

    const classAssignMap = new Map<string, Array<{ class_id: string; class_name: string }>>();
    (assignRows || []).forEach((a: any) => {
      const key = (a.teacher_email || '').toLowerCase().trim();
      if (!key) return;
      const list = classAssignMap.get(key) || [];
      list.push({ class_id: a.class_id, class_name: a.class_name || '' });
      classAssignMap.set(key, list);
    });

    // 2. Merge DB profiles with standard Staff Catalog
    const profileMap = new Map<string, any>();

    staffCatalog.forEach((staff: any) => {
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

    for (const dbP of dbProfiles || []) {
      const email = (dbP.email || '').toLowerCase().trim();
      if (!email) continue;

      const existing = profileMap.get(email) || {};
      let baseRole = normalizeRole(dbP.role || existing.role || 'GUEST');
      if (email === 'luciaxuan178@gmail.com' && baseRole === 'SUPER_ADMIN') {
        baseRole = 'SCHOOL_ADMIN';
      }

      const linkedStudents = studentsMap.get(dbP.id) || [];
      const heldRoles = sortRolesByPriority([
        ...(rolesMap.get(dbP.id) || []),
        ...(baseRole !== 'GUEST' ? [baseRole] : []),
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
        assigned_classes: classAssignMap.get(email) || existing.assigned_classes || [],
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
      return true;
    });

    return NextResponse.json(
      {
        success: true,
        total: filteredUsers.length,
        users: filteredUsers,
        is_super_admin: isSuperAdmin,
        settings: {
          allow_school_admin_view_temporary_staff: allowTemporaryStaff,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/users error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
