import { NextResponse } from 'next/server';
import { COOKIE_NAMES, setSignedCookie } from '@/lib/utils/cookieSigner';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { normalizeRole } from '@/lib/auth/sessionContext';

// Central server password storage for sadmin
declare global {
  var __SUONGMAI_SADMIN_PASSWORD__: string | undefined;
}

if (!globalThis.__SUONGMAI_SADMIN_PASSWORD__) {
  globalThis.__SUONGMAI_SADMIN_PASSWORD__ = 'abcd@1234';
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

      // Set cryptographically signed auth cookies for session, active_role, and middleware
      await setSignedCookie(response, COOKIE_NAMES.SESSION, 'active', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.EMAIL, 'sadmin@suongmai.edu.vn', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ROLE, 'SUPER_ADMIN', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ACTIVE_ROLE, 'SUPER_ADMIN', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.USERNAME, 'sadmin', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });

      return response;
    }

    // Try Supabase auth / DB check for other custom internal admin users if configured
    const supabase = getSupabaseAdminClient();
    if (supabase && username !== 'sadmin') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (!error && data && data.role === 'SUPER_ADMIN') {
          const normalizedRole = normalizeRole(data.role);
          const response = NextResponse.json({
            success: true,
            user: data,
          });
          await setSignedCookie(response, COOKIE_NAMES.SESSION, 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
          await setSignedCookie(response, COOKIE_NAMES.EMAIL, data.email, { path: '/', maxAge: 86400, sameSite: 'lax' });
          await setSignedCookie(response, COOKIE_NAMES.ROLE, normalizedRole, { path: '/', maxAge: 86400, sameSite: 'lax' });
          await setSignedCookie(response, COOKIE_NAMES.ACTIVE_ROLE, normalizedRole, { path: '/', maxAge: 86400, sameSite: 'lax' });
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
