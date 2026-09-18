import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude /admin/login from protected routes
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isTeacherRoute = pathname.startsWith('/teacher');
  const isParentRoute = pathname.startsWith('/parent');
  const isProtected = isAdminRoute || isTeacherRoute || isParentRoute;

  if (isProtected) {
    const sessionCookie = request.cookies.get('suongmai_session')?.value;
    const emailCookie = request.cookies.get('suongmai_user_email')?.value?.toLowerCase().trim() || '';
    const roleCookie = request.cookies.get('suongmai_user_role')?.value || '';
    const usernameCookie = request.cookies.get('suongmai_username')?.value || '';

    // Rule 1: sadmin (Super Admin) & alanvu755@gmail.com are granted full SUPER_ADMIN access
    const isSadmin =
      roleCookie === 'SUPER_ADMIN' ||
      usernameCookie === 'sadmin' ||
      emailCookie === 'sadmin@suongmai.edu.vn' ||
      emailCookie === 'alanvu755@gmail.com';

    if (isSadmin && sessionCookie === 'active') {
      return NextResponse.next();
    }

    // Rule 2: Unapproved / Pending / Unauthenticated users are redirected
    if (sessionCookie !== 'active' || !emailCookie || roleCookie === 'GUEST') {
      if (emailCookie && emailCookie !== 'sadmin@suongmai.edu.vn') {
        const pendingUrl = new URL('/auth/pending-approval', request.url);
        pendingUrl.searchParams.set('email', emailCookie);
        return NextResponse.redirect(pendingUrl);
      }
      const loginUrl = new URL(isAdminRoute ? '/admin/login' : '/auth', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      loginUrl.searchParams.set('unauthorized', 'true');
      return NextResponse.redirect(loginUrl);
    }

    // Rule 3: Enforce strict role-based route boundaries for approved active users
    const isSuperOrSchoolAdmin = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(roleCookie);
    const isStaff = roleCookie === 'STAFF';
    const isTeacher = roleCookie === 'TEACHER';
    const isParent = roleCookie === 'PARENT';

    if (isAdminRoute && !isSuperOrSchoolAdmin && !isStaff) {
      if (isTeacher) return NextResponse.redirect(new URL('/teacher', request.url));
      if (isParent) return NextResponse.redirect(new URL('/parent', request.url));
      const pendingUrl = new URL('/auth/pending-approval', request.url);
      pendingUrl.searchParams.set('email', emailCookie);
      return NextResponse.redirect(pendingUrl);
    }

    if (isTeacherRoute && !isTeacher && !isSuperOrSchoolAdmin && !isStaff) {
      if (isParent) return NextResponse.redirect(new URL('/parent', request.url));
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    if (isParentRoute && !isParent && !isSuperOrSchoolAdmin && !isStaff) {
      if (isTeacher) return NextResponse.redirect(new URL('/teacher', request.url));
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*'],
};


