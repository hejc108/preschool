import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && !key.includes('mock-key')) {
    return createClient(url, key);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    let email = '';
    try {
      const body = await request.json();
      email = (body.email || '').toLowerCase().trim();
    } catch (e) {}

    if (!email) {
      const cookieEmail = request.headers.get('cookie')?.match(/suongmai_user_email=([^;]+)/);
      if (cookieEmail) {
        email = decodeURIComponent(cookieEmail[1]).toLowerCase().trim();
      }
    }

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email là bắt buộc' }, { status: 400 });
    }

    const isSadmin = email === 'sadmin@suongmai.edu.vn';
    if (isSadmin) {
      const response = NextResponse.json({
        success: true,
        isApproved: true,
        role: 'SUPER_ADMIN',
        redirectUrl: '/admin/dashboard',
      });
      response.cookies.set('suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_email', email, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_role', 'SUPER_ADMIN', { path: '/', maxAge: 86400, sameSite: 'lax' });
      return response;
    }

    let profile: any = null;

    // 1. Query Supabase PostgreSQL DB
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('email', email).single();
        if (!error && data) {
          profile = data;
        }
      } catch (e) {}
    }

    // 2. Query in-memory / global profile fallback if DB fetch returned empty
    if (!profile && typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_PROFILES_CACHE__) {
      profile = globalThis.__SUONGMAI_PROFILES_CACHE__.find((p) => p.email.toLowerCase().trim() === email);
    }

    if (!profile) {
      return NextResponse.json({ success: true, isApproved: false, status: 'PENDING', message: 'Tài khoản chưa được khởi tạo' });
    }

    if (profile.approval_status === 'ACTIVE') {
      const targetRole = profile.role || 'PARENT';
      let redirectUrl = '/parent';
      if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(targetRole)) {
        redirectUrl = '/admin/dashboard';
      } else if (targetRole === 'TEACHER') {
        redirectUrl = '/teacher';
      }

      const response = NextResponse.json({
        success: true,
        isApproved: true,
        role: targetRole,
        redirectUrl,
        profile,
      });

      response.cookies.set('suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_email', email, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_role', targetRole, { path: '/', maxAge: 86400, sameSite: 'lax' });

      return response;
    }

    if (profile.approval_status === 'REJECTED') {
      const response = NextResponse.json({
        success: true,
        isApproved: false,
        status: 'REJECTED',
        message: 'Yêu cầu truy cập của bạn đã bị từ chối',
      });
      response.cookies.delete('suongmai_session');
      return response;
    }

    const response = NextResponse.json({
      success: true,
      isApproved: false,
      status: 'PENDING',
      message: 'Tài khoản của bạn đang chờ phê duyệt',
    });
    response.cookies.delete('suongmai_session');
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
