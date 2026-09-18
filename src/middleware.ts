import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin, /teacher, and /parent routes
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/teacher') || pathname.startsWith('/parent');

  if (isProtected) {
    const sessionCookie = request.cookies.get('suongmai_session');
    const hasSupabaseToken = Array.from(request.cookies.getAll()).some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );

    // If no valid auth session cookie exists, block access and redirect to /auth
    if (!sessionCookie && !hasSupabaseToken) {
      const loginUrl = new URL('/auth', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      loginUrl.searchParams.set('unauthorized', 'true');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*'],
};
