import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { setSignedCookie } from '@/lib/utils/cookieSigner';

// Central server password storage for sadmin
declare global {
  var __SUONGMAI_SADMIN_PASSWORD__: string | undefined;
}

if (!globalThis.__SUONGMAI_SADMIN_PASSWORD__) {
  globalThis.__SUONGMAI_SADMIN_PASSWORD__ = 'abcd@1234';
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && !key.includes('mock-key')) {
    return createClient(url, key);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username || '').toLowerCase().trim();
    const password = body.password || '';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu' },
        { status: 400 }
      );
    }

    const currentSadminPass = globalThis.__SUONGMAI_SADMIN_PASSWORD__ || 'abcd@1234';
    const isSadminUser = username === 'sadmin' || username === 'sadmin@suongmai.edu.vn';

    if (isSadminUser && password === currentSadminPass) {
      const response = NextResponse.json({
        success: true,
        message: 'Đăng nhập Quản trị viên thành công',
        user: {
          username: 'sadmin',
          email: 'sadmin@suongmai.edu.vn',
          full_name: 'Super Admin (sadmin)',
          role: 'SUPER_ADMIN',
          approval_status: 'ACTIVE',
        },
      });

      // Set cryptographically signed auth cookies for session and middleware
      await setSignedCookie(response, 'suongmai_session', 'active', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, 'suongmai_user_email', 'sadmin@suongmai.edu.vn', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, 'suongmai_user_role', 'SUPER_ADMIN', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, 'suongmai_username', 'sadmin', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });

      return response;
    }

    // Try Supabase auth / DB check for other custom internal admin users if configured
    const supabase = getSupabaseClient();
    if (supabase && username !== 'sadmin') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (!error && data && data.role === 'SUPER_ADMIN') {
          const response = NextResponse.json({
            success: true,
            user: data,
          });
          await setSignedCookie(response, 'suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
          await setSignedCookie(response, 'suongmai_user_email', data.email, { path: '/', maxAge: 86400, sameSite: 'lax' });
          await setSignedCookie(response, 'suongmai_user_role', data.role, { path: '/', maxAge: 86400, sameSite: 'lax' });
          return response;
        }
      } catch (e) {}
    }

    return NextResponse.json(
      { success: false, message: 'Tên đăng nhập hoặc mật khẩu Quản trị không chính xác' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
