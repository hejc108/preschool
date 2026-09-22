import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAndExtractCookieValue } from '@/lib/utils/cookieSigner';

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

  // Cryptographically verify HMAC SHA-256 signatures before trusting any cookie values
  const sessionCookie = await verifyAndExtractCookieValue(rawSession);
  const emailCookie = (await verifyAndExtractCookieValue(rawEmail))?.toLowerCase().trim() || '';
  const roleCookie = (await verifyAndExtractCookieValue(rawRole)) || '';
  const usernameCookie = (await verifyAndExtractCookieValue(rawUsername)) || '';

  // If approved active user accesses /auth/pending-approval, redirect to proper active portal
  if (pathname === '/auth/pending-approval' && sessionCookie === 'active' && roleCookie && roleCookie !== 'GUEST') {
    if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'STAFF'].includes(roleCookie)) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    if (roleCookie === 'TEACHER') {
      return NextResponse.redirect(new URL('/teacher', request.url));
    }
    if (roleCookie === 'PARENT') {
      return NextResponse.redirect(new URL('/parent', request.url));
    }
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isTeacherRoute = pathname.startsWith('/teacher');
  const isParentRoute = pathname.startsWith('/parent');
  const isProtected = isAdminRoute || isTeacherRoute || isParentRoute;

  if (isProtected) {
    const isSuperOrSchoolAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(roleCookie);
    const isStaff = roleCookie === 'STAFF';
    const isTeacher = roleCookie === 'TEACHER';
    const isParent = roleCookie === 'PARENT';
    const isSadmin =
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
        return res;
      }
      const loginUrl = new URL(isAdminRoute ? '/admin/login' : '/auth', request.url);
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
        return NextResponse.redirect(teacherUrl);
      }
      if (isParent) {
        const parentUrl = new URL('/parent', request.url);
        parentUrl.searchParams.set('warning', 'unauthorized_admin_access');
        return NextResponse.redirect(parentUrl);
      }
      const pendingUrl = new URL('/auth/pending-approval', request.url);
      pendingUrl.searchParams.set('email', emailCookie);
      return NextResponse.redirect(pendingUrl);
    }

    // Rule 3: Enforce Teacher Boundary (Parents attempt /teacher -> redirected to /parent)
    if (isTeacherRoute && !isTeacher && !isSuperOrSchoolAdmin && !isStaff) {
      if (isParent) {
        const parentUrl = new URL('/parent', request.url);
        parentUrl.searchParams.set('warning', 'wrong_role');
        return NextResponse.redirect(parentUrl);
      }
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // Rule 4: Enforce Parent Boundary (Teachers attempt /parent -> redirected to /teacher)
    if (isParentRoute && !isParent && !isSuperOrSchoolAdmin && !isStaff) {
      if (isTeacher) {
        const teacherUrl = new URL('/teacher', request.url);
        teacherUrl.searchParams.set('warning', 'wrong_role');
        return NextResponse.redirect(teacherUrl);
      }
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*', '/auth/pending-approval'],
};
