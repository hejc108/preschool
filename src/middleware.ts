import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAndExtractCookieValue, setSignedCookie } from '@/lib/utils/cookieSigner';

const FALLBACK_SUPABASE_URL = 'https://yrieuamibqjyaslprdeo.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

async function fetchLiveProfileRole(
  email: string
): Promise<{ role: string; approval_status: string; id?: string } | null> {
  try {
    const rawUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      FALLBACK_SUPABASE_URL;
    const baseUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      FALLBACK_ANON_KEY;
    const apiKey = rawKey.trim().replace(/^["']|["']$/g, '') || FALLBACK_ANON_KEY;

    const res = await fetch(
      `${baseUrl}/rest/v1/profiles?email=ilike.${encodeURIComponent(email)}&select=id,role,approval_status&limit=1`,
      {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok && apiKey !== FALLBACK_ANON_KEY) {
      const retry = await fetch(
        `${baseUrl}/rest/v1/profiles?email=ilike.${encodeURIComponent(email)}&select=id,role,approval_status&limit=1`,
        {
          headers: {
            apikey: FALLBACK_ANON_KEY,
            Authorization: `Bearer ${FALLBACK_ANON_KEY}`,
          },
          cache: 'no-store',
        }
      );
      if (retry.ok) {
        const rows = await retry.json();
        if (Array.isArray(rows) && rows[0]) return rows[0];
      }
      return null;
    }

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  } catch (e) {}
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude /admin/login from protected routes
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const rawSession = request.cookies.get('suongmai_session')?.value;
  const rawEmail = request.cookies.get('suongmai_user_email')?.value;
  const rawRole = request.cookies.get('suongmai_user_role')?.value;
  const rawUsername = request.cookies.get('suongmai_username')?.value;
  const rawHasChildren = request.cookies.get('suongmai_has_children')?.value;

  // Cryptographically verify HMAC SHA-256 signatures before trusting any cookie values
  let sessionCookie = await verifyAndExtractCookieValue(rawSession);
  const emailCookie = (await verifyAndExtractCookieValue(rawEmail))?.toLowerCase().trim() || '';
  let roleCookie = (await verifyAndExtractCookieValue(rawRole)) || '';
  const usernameCookie = (await verifyAndExtractCookieValue(rawUsername)) || '';
  const hasChildrenCookie = (await verifyAndExtractCookieValue(rawHasChildren)) === 'true';

  // Live role sync from Supabase public.profiles to prevent stale role cookies
  let roleChangedInDb = false;
  if (emailCookie && emailCookie !== 'sadmin@suongmai.edu.vn') {
    const dbProfile = await fetchLiveProfileRole(emailCookie);
    if (dbProfile) {
      const latestRole =
        emailCookie === 'luciaxuan178@gmail.com' && dbProfile.role === 'SUPER_ADMIN'
          ? 'SCHOOL_ADMIN'
          : (dbProfile.role || 'GUEST');
      if (dbProfile.approval_status === 'ACTIVE') {
        if (roleCookie !== latestRole || sessionCookie !== 'active') {
          roleChangedInDb = true;
        }
        roleCookie = latestRole;
        sessionCookie = 'active';
      } else if (dbProfile.approval_status === 'PENDING' || dbProfile.approval_status === 'REJECTED') {
        if (roleCookie !== latestRole) {
          roleChangedInDb = true;
        }
        roleCookie = latestRole;
        sessionCookie = null;
      }
    }
  }

  const attachUpdatedCookies = async (res: NextResponse) => {
    if (roleChangedInDb && emailCookie) {
      if (sessionCookie === 'active') {
        await setSignedCookie(res, 'suongmai_session', 'active', { path: '/', maxAge: 86400, sameSite: 'lax' });
      }
      await setSignedCookie(res, 'suongmai_user_email', emailCookie, { path: '/', maxAge: 86400, sameSite: 'lax' });
      await setSignedCookie(res, 'suongmai_user_role', roleCookie, { path: '/', maxAge: 86400, sameSite: 'lax' });
    }
    return res;
  };

  // If approved active user accesses /auth/pending-approval, redirect to proper active portal
  if (pathname === '/auth/pending-approval' && sessionCookie === 'active' && roleCookie && roleCookie !== 'GUEST') {
    if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'STAFF'].includes(roleCookie)) {
      return attachUpdatedCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)));
    }
    if (roleCookie === 'TEACHER') {
      return attachUpdatedCookies(NextResponse.redirect(new URL('/teacher', request.url)));
    }
    if (roleCookie === 'PARENT') {
      return attachUpdatedCookies(NextResponse.redirect(new URL('/parent', request.url)));
    }
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isTeacherRoute = pathname.startsWith('/teacher');
  const isParentRoute = pathname.startsWith('/parent');
  const isProtected = isAdminRoute || isTeacherRoute || isParentRoute;

  if (isProtected) {
    const isSuperAdmin = roleCookie === 'SUPER_ADMIN';
    const isSuperOrSchoolAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(roleCookie);
    const isStaff = roleCookie === 'STAFF';
    const isTeacher = roleCookie === 'TEACHER';
    const isParent = roleCookie === 'PARENT';
    const isSadmin =
      isSuperAdmin ||
      isSuperOrSchoolAdmin ||
      usernameCookie === 'sadmin' ||
      emailCookie === 'sadmin@suongmai.edu.vn';

    // Rule 1: Force PENDING or Unauthenticated users to /auth/pending-approval
    if (sessionCookie !== 'active' || !emailCookie || roleCookie === 'GUEST') {
      if (emailCookie && emailCookie !== 'sadmin@suongmai.edu.vn') {
        const pendingUrl = new URL('/auth/pending-approval', request.url);
        pendingUrl.searchParams.set('email', emailCookie);
        const res = NextResponse.redirect(pendingUrl);
        if (!sessionCookie && rawSession) res.cookies.delete('suongmai_session');
        return attachUpdatedCookies(res);
      }
      const loginUrl = new URL('/auth', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      const res = NextResponse.redirect(loginUrl);
      if (!sessionCookie && rawSession) res.cookies.delete('suongmai_session');
      return res;
    }

    // Rule 2: Enforce Strict Admin Access (Only Super Admin, School Admin, Staff)
    if (isAdminRoute && !isSadmin && !isStaff) {
      if (isTeacher) {
        const teacherUrl = new URL('/teacher', request.url);
        teacherUrl.searchParams.set('warning', 'unauthorized_admin_access');
        return attachUpdatedCookies(NextResponse.redirect(teacherUrl));
      }
      if (isParent) {
        const parentUrl = new URL('/parent', request.url);
        parentUrl.searchParams.set('warning', 'unauthorized_admin_access');
        return attachUpdatedCookies(NextResponse.redirect(parentUrl));
      }
      const pendingUrl = new URL('/auth/pending-approval', request.url);
      pendingUrl.searchParams.set('email', emailCookie);
      return attachUpdatedCookies(NextResponse.redirect(pendingUrl));
    }

    // Rule 2.1: CHỐT CHẶN 3: Cô lập quyền bảo mật & cấu hình nhạy cảm chỉ dành riêng cho SUPER_ADMIN
    const isSensitiveAdminRoute =
      pathname.startsWith('/admin/settings/security') ||
      pathname.startsWith('/admin/settings/email');

    const isStrictSuperAdmin =
      emailCookie !== 'hejc108@gmail.com' &&
      emailCookie !== 'luciaxuan178@gmail.com' &&
      (roleCookie === 'SUPER_ADMIN' ||
       emailCookie === 'sadmin@suongmai.edu.vn');

    if (isSensitiveAdminRoute && !isStrictSuperAdmin) {
      const dashboardUrl = new URL('/admin/dashboard', request.url);
      dashboardUrl.searchParams.set('warning', 'super_admin_required');
      return attachUpdatedCookies(NextResponse.redirect(dashboardUrl));
    }

    // Rule 3: Enforce Teacher Boundary (Parents attempt /teacher -> redirected to /parent)
    if (isTeacherRoute && !isTeacher && !isSuperOrSchoolAdmin && !isStaff) {
      if (isParent) {
        const parentUrl = new URL('/parent', request.url);
        parentUrl.searchParams.set('warning', 'wrong_role');
        return attachUpdatedCookies(NextResponse.redirect(parentUrl));
      }
      return attachUpdatedCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)));
    }

    // Rule 4: Enforce Parent Boundary (Xử lý tài khoản Đa vai trò: Cô giáo kiêm Phụ huynh)
    if (isParentRoute && !isParent && !isSuperOrSchoolAdmin && !isStaff) {
      if (isTeacher && hasChildrenCookie) {
        return attachUpdatedCookies(NextResponse.next());
      }
      if (isTeacher) {
        const teacherUrl = new URL('/teacher', request.url);
        return attachUpdatedCookies(NextResponse.redirect(teacherUrl));
      }
      return attachUpdatedCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)));
    }
  }

  return attachUpdatedCookies(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*', '/auth/pending-approval'],
};
