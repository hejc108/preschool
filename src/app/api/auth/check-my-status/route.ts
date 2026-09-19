import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key';

  if (url && key) {
    return createClient(url, key);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let email = (searchParams.get('email') || '').toLowerCase().trim();

    if (!email) {
      const cookieEmail = request.headers.get('cookie')?.match(/suongmai_user_email=([^;]+)/);
      if (cookieEmail) {
        email = decodeURIComponent(cookieEmail[1]).toLowerCase().trim();
      }
    }

    if (!email) {
      return NextResponse.json({ isApproved: false, status: 'PENDING', message: 'Email không tìm thấy' });
    }

    // Special check for sadmin@suongmai.edu.vn
    if (email === 'sadmin@suongmai.edu.vn') {
      const response = NextResponse.json({
        isApproved: true,
        status: 'ACTIVE',
        role: 'SUPER_ADMIN',
        redirectUrl: '/admin/dashboard',
      });
      response.cookies.set('suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_email', email, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_role', 'SUPER_ADMIN', { path: '/', maxAge: 86400, sameSite: 'lax' });
      return response;
    }

    let profile: any = null;

    // 1. Direct DB query using Service Role / Anon Key bypassing RLS/Cache
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('email', email).single();
        if (!error && data) {
          profile = data;
        }
      } catch (e) {}
    }

    // 2. Global in-memory cache fallback
    if (!profile && typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_PROFILES_CACHE__) {
      profile = globalThis.__SUONGMAI_PROFILES_CACHE__.find((p) => p.email.toLowerCase().trim() === email);
    }

    if (!profile) {
      return NextResponse.json({ isApproved: false, status: 'PENDING', message: 'Tài khoản chưa có trong CSDL' });
    }

    const isApproved = profile.approval_status === 'ACTIVE';
    const role = profile.role || 'PARENT';

    if (isApproved) {
      let redirectUrl = '/parent';
      if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(role)) {
        redirectUrl = '/admin/dashboard';
      } else if (role === 'TEACHER') {
        redirectUrl = '/teacher/lesson-plans/new';
      } else if (role === 'PARENT') {
        redirectUrl = '/parent';
      } else if (role === 'KITCHEN_STAFF') {
        redirectUrl = '/admin/menu';
      } else if (role === 'NURSE_STAFF') {
        redirectUrl = '/admin/health';
      }

      const response = NextResponse.json({
        isApproved: true,
        status: 'ACTIVE',
        role,
        redirectUrl,
        profile,
      });

      response.cookies.set('suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_email', email, { path: '/', maxAge: 86400, sameSite: 'lax' });
      response.cookies.set('suongmai_user_role', role, { path: '/', maxAge: 86400, sameSite: 'lax' });

      return response;
    }

    return NextResponse.json({
      isApproved: false,
      status: profile.approval_status || 'PENDING',
      role: profile.role || 'GUEST',
    });
  } catch (error: any) {
    return NextResponse.json({ isApproved: false, status: 'PENDING', message: error.message }, { status: 500 });
  }
}
