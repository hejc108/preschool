import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

function getSupabaseClient() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const url = rawUrl.trim().replace(/^["']|["']$/g, '');

  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    FALLBACK_ANON_KEY;
  const key = rawKey.trim().replace(/^["']|["']$/g, '') || FALLBACK_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePickup(row: any) {
  return {
    id: row.id,
    student_id: row.student_id,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone,
    avatar_url: row.avatar_url || '',
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : (row.approval_status !== 'REJECTED'),
    approval_status: row.approval_status || (row.is_active !== false ? 'APPROVED' : 'PENDING'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET: Lấy danh sách người đón được ủy quyền theo student_id từ Supabase
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã học sinh (student_id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase Client.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

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
    const body = await request.json().catch(() => ({}));
    const { student_id, name, relationship, phone, avatar_url, is_active } = body;

    if (!student_id || !name?.trim() || !relationship?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng điền đầy đủ: Họ tên, Mối quan hệ và Số điện thoại.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase Client.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

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
    const body = await request.json().catch(() => ({}));
    const { id, name, relationship, phone, avatar_url, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã người đón (id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase Client.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const updateFields: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateFields.name = name.trim();
    if (relationship !== undefined) updateFields.relationship = relationship.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;
    if (is_active !== undefined) updateFields.is_active = Boolean(is_active);

    // 1. Thử cập nhật trên bảng pickup_authorizations
    const { data: authData, error: authError } = await supabase
      .from('pickup_authorizations')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (!authError && authData) {
      return NextResponse.json(
        {
          success: true,
          message: 'Cập nhật thông tin người đón thành công!',
          pickup: normalizePickup(authData),
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fallback nếu bảng pickup_authorizations chưa có
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
    const { searchParams } = new URL(request.url);
    const pickupId = searchParams.get('id');

    if (!pickupId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã người đón (id).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase Client.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Thử xóa từ pickup_authorizations
    const { error: authError } = await supabase
      .from('pickup_authorizations')
      .delete()
      .eq('id', pickupId);

    if (!authError) {
      return NextResponse.json(
        { success: true, message: 'Đã xóa người đón ủy quyền thành công.' },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fallback xóa từ authorized_pickups
    const { error: legacyError } = await supabase
      .from('authorized_pickups')
      .delete()
      .eq('id', pickupId);

    if (legacyError) {
      console.error('[API DELETE /api/parent/pickups] Delete error:', legacyError.message);
      return NextResponse.json(
        { success: false, error: legacyError.message },
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
