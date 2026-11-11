import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import {
  assertParentStudentAccess,
  assertTeacherStudentAccess,
  requireActiveRole,
} from '@/lib/auth/sessionContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizePickup(row: any) {
  return {
    id: row.id,
    student_id: row.student_id,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone,
    avatar_url: row.avatar_url || '',
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : row.approval_status !== 'REJECTED',
    approval_status: row.approval_status || (row.is_active !== false ? 'APPROVED' : 'PENDING'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function resolvePickupOwnerStudentId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  pickupId: string
): Promise<{ studentId: string | null; table: 'pickup_authorizations' | 'authorized_pickups' | null }> {
  const { data: authRow, error: authErr } = await supabase
    .from('pickup_authorizations')
    .select('id, student_id')
    .eq('id', pickupId)
    .maybeSingle();

  if (!authErr && authRow?.student_id) {
    return { studentId: authRow.student_id, table: 'pickup_authorizations' };
  }

  const { data: legacyRow, error: legacyErr } = await supabase
    .from('authorized_pickups')
    .select('id, student_id')
    .eq('id', pickupId)
    .maybeSingle();

  if (!legacyErr && legacyRow?.student_id) {
    return { studentId: legacyRow.student_id, table: 'authorized_pickups' };
  }

  return { studentId: null, table: null };
}

// GET: Lấy danh sách người đón được ủy quyền theo student_id
export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã học sinh (student_id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (ctx.activeRole === 'PARENT') {
      const denied = assertParentStudentAccess(ctx, [studentId]);
      if (denied) return denied;
    } else if (ctx.activeRole === 'TEACHER') {
      const denied = await assertTeacherStudentAccess(ctx, [studentId]);
      if (denied) return denied;
    }

    const supabase = getSupabaseAdminClient(false);

    // 1. Thử truy vấn bảng pickup_authorizations
    const { data: authData, error: authError } = await supabase
      .from('pickup_authorizations')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (!authError && Array.isArray(authData)) {
      return NextResponse.json(
        { success: true, pickups: authData.map(normalizePickup), source: 'pickup_authorizations' },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fallback nếu bảng pickup_authorizations chưa tạo
    const { data: legacyData, error: legacyError } = await supabase
      .from('authorized_pickups')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (legacyError) {
      console.error('[API GET /api/parent/pickups] Supabase error:', legacyError.message);
      return NextResponse.json(
        { success: false, error: legacyError.message, pickups: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, pickups: (legacyData || []).map(normalizePickup), source: 'authorized_pickups' },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API GET /api/parent/pickups] Exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ', pickups: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// POST: Phụ huynh đăng ký thêm người đón ủy quyền mới
export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const { student_id, name, relationship, phone, avatar_url, is_active } = body;

    if (!student_id || !name?.trim() || !relationship?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng điền đầy đủ: Họ tên, Mối quan hệ và Số điện thoại.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const denied = assertParentStudentAccess(ctx, [student_id]);
    if (denied) return denied;

    const supabase = getSupabaseAdminClient(false);
    const activeFlag = is_active !== undefined ? Boolean(is_active) : true;

    // 1. Thử insert vào bảng pickup_authorizations
    const newAuthRecord = {
      student_id,
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      avatar_url: (avatar_url || '').trim() || null,
      is_active: activeFlag,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: authData, error: authError } = await supabase
      .from('pickup_authorizations')
      .insert([newAuthRecord])
      .select()
      .single();

    if (!authError && authData) {
      return NextResponse.json(
        {
          success: true,
          message: 'Ủy quyền người đón thành công!',
          pickup: normalizePickup(authData),
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fallback nếu bảng pickup_authorizations chưa tạo
    const legacyRecord = {
      student_id,
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      avatar_url:
        (avatar_url || '').trim() ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      approval_status: activeFlag ? 'APPROVED' : 'PENDING',
    };

    const { data: legacyData, error: legacyError } = await supabase
      .from('authorized_pickups')
      .insert([legacyRecord])
      .select()
      .single();

    if (legacyError) {
      console.error('[API POST /api/parent/pickups] Insert error:', legacyError.message);
      return NextResponse.json(
        { success: false, error: legacyError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Ủy quyền người đón thành công!',
        pickup: normalizePickup(legacyData),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API POST /api/parent/pickups] Exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// PUT: Cập nhật thông tin hoặc Bật/Tắt trạng thái is_active của người đón
export async function PUT(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const { id, name, relationship, phone, avatar_url, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã người đón (id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseAdminClient(false);
    const owner = await resolvePickupOwnerStudentId(supabase, id);
    if (!owner.studentId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy bản ghi người đón.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const denied = assertParentStudentAccess(ctx, [owner.studentId]);
    if (denied) return denied;

    const updateFields: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateFields.name = name.trim();
    if (relationship !== undefined) updateFields.relationship = relationship.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;
    if (is_active !== undefined) updateFields.is_active = Boolean(is_active);

    if (owner.table === 'pickup_authorizations') {
      const { data: authData, error: authError } = await supabase
        .from('pickup_authorizations')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (authError) {
        return NextResponse.json(
          { success: false, error: authError.message },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Cập nhật thông tin người đón thành công!',
          pickup: normalizePickup(authData),
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const legacyUpdateFields: any = {};
    if (name !== undefined) legacyUpdateFields.name = name.trim();
    if (relationship !== undefined) legacyUpdateFields.relationship = relationship.trim();
    if (phone !== undefined) legacyUpdateFields.phone = phone.trim();
    if (avatar_url !== undefined) legacyUpdateFields.avatar_url = avatar_url;
    if (is_active !== undefined) {
      legacyUpdateFields.approval_status = is_active ? 'APPROVED' : 'REJECTED';
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from('authorized_pickups')
      .update(legacyUpdateFields)
      .eq('id', id)
      .select()
      .single();

    if (legacyError) {
      console.error('[API PUT /api/parent/pickups] Update error:', legacyError.message);
      return NextResponse.json(
        { success: false, error: legacyError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Cập nhật thông tin người đón thành công!',
        pickup: normalizePickup(legacyData),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API PUT /api/parent/pickups] Exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// DELETE: Xóa người đón ủy quyền
export async function DELETE(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const pickupId = searchParams.get('id');

    if (!pickupId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã người đón (id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseAdminClient(false);
    const owner = await resolvePickupOwnerStudentId(supabase, pickupId);
    if (!owner.studentId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy bản ghi người đón.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const denied = assertParentStudentAccess(ctx, [owner.studentId]);
    if (denied) return denied;

    const targetTable = owner.table || 'pickup_authorizations';
    const { error: deleteErr } = await supabase
      .from(targetTable)
      .delete()
      .eq('id', pickupId);

    if (deleteErr) {
      console.error(`[API DELETE /api/parent/pickups] Delete error (${targetTable}):`, deleteErr.message);
      return NextResponse.json(
        { success: false, error: deleteErr.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Đã xóa người đón ủy quyền thành công.' },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[API DELETE /api/parent/pickups] Exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
