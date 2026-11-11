import { NextResponse } from 'next/server';
import { executeWithAdminFallback, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { DEFAULT_UUID_TO_NAME } from '@/lib/constants/classes';
import { normalizeRole, requireActiveRole, sortRolesByPriority } from '@/lib/auth/sessionContext';
import { UserRole } from '@/lib/types/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toGuardianRelationship(input: string): 'BỐ' | 'MẸ' | 'ÔNG' | 'BÀ' | 'NGƯỜI GIÁM HỘ' {
  const s = (input || '').toLowerCase().trim();
  if (s === 'bố' || s === 'bo' || s === 'father') return 'BỐ';
  if (s === 'mẹ' || s === 'me' || s === 'mother') return 'MẸ';
  if (s === 'ông' || s === 'ong') return 'ÔNG';
  if (s === 'bà' || s === 'ba') return 'BÀ';
  return 'NGƯỜI GIÁM HỘ';
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const studentId = context.params?.id;
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã học sinh.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const [{ data: student, error: stErr }, { data: spRows }, { data: sgRows }, { data: pickups }, { data: profiles }, { data: allUserRoles }] =
      await Promise.all([
        executeWithAdminFallback(async (sb) =>
          await sb.from('students').select('*, classes(id, name)').eq('id', studentId).maybeSingle()
        ),
        executeWithAdminFallback(async (sb) =>
          await sb
            .from('student_parents')
            .select('student_id, parent_user_id, relationship, is_primary, created_at')
            .eq('student_id', studentId)
        ),
        executeWithAdminFallback(async (sb) =>
          await sb
            .from('student_guardians')
            .select('student_id, guardian_id, relationship, is_primary, created_at')
            .eq('student_id', studentId)
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('pickup_authorizations').select('*').eq('student_id', studentId)
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('profiles').select('id, email, full_name, role, phone, avatar_url, approval_status, assigned_class_name').order('full_name', { ascending: true })
        ),
        executeWithAdminFallback(async (sb) =>
          await sb.from('user_roles').select('user_id, role_name')
        ),
      ]);

    if (stErr || !student) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ học sinh.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const roleMap = new Map<string, UserRole[]>();
    (allUserRoles || []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(normalizeRole(r.role_name));
      roleMap.set(r.user_id, arr);
    });

    const profileById = new Map<string, any>();
    const candidateAccounts = (profiles || []).map((p: any) => {
      const roles = sortRolesByPriority([
        ...(roleMap.get(p.id) || []),
        ...(p.role && p.role !== 'GUEST' ? [normalizeRole(p.role)] : []),
      ]);
      const enriched = {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        phone: p.phone || '',
        avatar_url: p.avatar_url || '',
        role: normalizeRole(p.role),
        roles,
        approval_status: p.approval_status || 'ACTIVE',
        assigned_class_name: p.assigned_class_name || '',
      };
      profileById.set(p.id, enriched);
      return enriched;
    });

    const linkedMap = new Map<string, any>();
    (spRows || []).forEach((r: any) => {
      const prof = profileById.get(r.parent_user_id);
      linkedMap.set(r.parent_user_id, {
        parent_user_id: r.parent_user_id,
        relationship: r.relationship || 'Phụ huynh',
        is_primary: Boolean(r.is_primary),
        created_at: r.created_at,
        profile: prof || null,
      });
    });
    (sgRows || []).forEach((r: any) => {
      if (!linkedMap.has(r.guardian_id)) {
        const prof = profileById.get(r.guardian_id);
        linkedMap.set(r.guardian_id, {
          parent_user_id: r.guardian_id,
          relationship: r.relationship || 'Phụ huynh',
          is_primary: Boolean(r.is_primary),
          created_at: r.created_at,
          profile: prof || null,
        });
      }
    });

    const cls = Array.isArray(student.classes) ? student.classes[0] : student.classes;

    return NextResponse.json(
      {
        success: true,
        student: {
          ...student,
          class_name: cls?.name || DEFAULT_UUID_TO_NAME[student.class_id] || 'Chưa phân lớp',
        },
        linked_parents: Array.from(linkedMap.values()),
        authorized_pickups: Array.isArray(pickups) ? pickups : [],
        candidate_accounts: candidateAccounts,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/admin/students/[id]/parents] GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const studentId = context.params?.id;
    const body = await request.json().catch(() => ({}));
    const parentUserId = String(body.parent_user_id || '').trim();
    const relationship = String(body.relationship || 'Phụ huynh').trim();
    const isPrimary = body.is_primary !== undefined ? Boolean(body.is_primary) : true;

    if (!studentId || !parentUserId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu student_id hoặc parent_user_id.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const [{ data: student }, { data: profile }] = await Promise.all([
      executeWithAdminFallback(async (sb) =>
        await sb.from('students').select('id, full_name').eq('id', studentId).maybeSingle()
      ),
      executeWithAdminFallback(async (sb) =>
        await sb.from('profiles').select('id, email, full_name, role, approval_status').eq('id', parentUserId).maybeSingle()
      ),
    ]);

    if (!student || !profile) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy học sinh hoặc tài khoản cần liên kết.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Ensure profile holds its existing primary role in user_roles (if non-GUEST) AND add 'PARENT'
    const currentPrimary = normalizeRole(profile.role);
    const rolesToEnsure = ['PARENT'];
    if (currentPrimary !== 'GUEST' && currentPrimary !== 'PARENT') {
      rolesToEnsure.push(currentPrimary);
    }

    await executeWithAdminFallback(async (sb) =>
      await sb.from('user_roles').upsert(
        rolesToEnsure.map((role_name) => ({ user_id: parentUserId, role_name })),
        { onConflict: 'user_id,role_name', ignoreDuplicates: true }
      )
    );

    // Activate profile if pending/guest, without downgrading TEACHER / SCHOOL_ADMIN primary role
    if (profile.approval_status !== 'ACTIVE' || currentPrimary === 'GUEST') {
      await executeWithAdminFallback(async (sb) =>
        await sb
          .from('profiles')
          .update({
            approval_status: 'ACTIVE',
            role: currentPrimary === 'GUEST' ? 'PARENT' : profile.role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', parentUserId)
      );
    }

    // 2. Write to student_parents
    const { error: spErr } = await executeWithAdminFallback(async (sb) =>
      await sb.from('student_parents').upsert(
        {
          student_id: studentId,
          parent_user_id: parentUserId,
          relationship,
          is_primary: isPrimary,
        },
        { onConflict: 'student_id,parent_user_id' }
      )
    );

    // 3. Mirror to student_guardians for backwards compatibility / pre-00013 safety
    const { error: sgErr } = await executeWithAdminFallback(async (sb) =>
      await sb.from('student_guardians').upsert(
        {
          student_id: studentId,
          guardian_id: parentUserId,
          relationship: toGuardianRelationship(relationship),
          is_primary: isPrimary,
        },
        { onConflict: 'student_id,guardian_id' }
      )
    );

    if (spErr && sgErr) {
      return NextResponse.json(
        { success: false, error: spErr.message || sgErr.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Đã liên kết ${profile.full_name} làm phụ huynh của bé ${student.full_name} và tự động cấp quyền Phụ huynh.`,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/admin/students/[id]/parents] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const studentId = context.params?.id;
    const { searchParams } = new URL(request.url);
    const parentUserId = searchParams.get('parent_user_id') || '';

    if (!studentId || !parentUserId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu student_id hoặc parent_user_id.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    await Promise.all([
      executeWithAdminFallback(async (sb) =>
        await sb
          .from('student_parents')
          .delete()
          .eq('student_id', studentId)
          .eq('parent_user_id', parentUserId)
      ),
      executeWithAdminFallback(async (sb) =>
        await sb
          .from('student_guardians')
          .delete()
          .eq('student_id', studentId)
          .eq('guardian_id', parentUserId)
      ),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: 'Đã gỡ liên kết phụ huynh khỏi học sinh.',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/admin/students/[id]/parents] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
