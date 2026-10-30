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

    const { data, error } = await supabase
      .from('authorized_pickups')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API GET /api/parent/pickups] Supabase error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message, pickups: [] },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, pickups: data || [] },
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
    const { student_id, name, relationship, phone, avatar_url } = body;

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

    const newRecord = {
      student_id,
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      avatar_url:
        (avatar_url || '').trim() ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      approval_status: 'PENDING',
    };

    const { data, error } = await supabase
      .from('authorized_pickups')
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      console.error('[API POST /api/parent/pickups] Insert error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Đăng ký người đón thành công!', pickup: data },
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

    const { error } = await supabase
      .from('authorized_pickups')
      .delete()
      .eq('id', pickupId);

    if (error) {
      console.error('[API DELETE /api/parent/pickups] Delete error:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Đã xóa người đón thành công.' },
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
