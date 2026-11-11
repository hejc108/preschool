import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  COOKIE_NAMES,
  setSignedCookie,
  verifyAndExtractCookieValue,
} from '@/lib/utils/cookieSigner';
import {
  createSignedActiveRoleJwt,
  FALLBACK_ANON_KEY,
  getSupabaseConfig,
} from '@/lib/supabase/server';
import {
  extractSupabaseTokensFromCookies,
  normalizeRole,
  parseCookieHeader,
  sortRolesByPriority,
} from '@/lib/auth/sessionContext';
import { UserRole } from '@/lib/types/schema';

interface LiveAuthState {
  profileId?: string;
  primaryRole: UserRole;
  roles: UserRole[];
  approval_status: string;
  hasChildren: boolean;
}

async function fetchLiveAuthState(
  email: string,
  callerAccessToken?: string | null
): Promise<LiveAuthState | null> {
  try {
    const { url: baseUrl, serviceRoleKey: serviceKey, anonKey } = getSupabaseConfig();

    const restFetch = async (path: string, bearerOverride?: string | null) => {
      const apiKey = serviceKey ? serviceKey : anonKey;
      const bearer =
        bearerOverride || (serviceKey ? serviceKey : callerAccessToken || anonKey);
      const makeHeaders = (k: string, b: string) => ({
        apikey: k,
        Authorization: `Bearer ${b}`,
      });

      const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
        headers: makeHeaders(apiKey, bearer),
        cache: 'no-store',
      });
      if (!res.ok && (apiKey !== FALLBACK_ANON_KEY || bearer !== FALLBACK_ANON_KEY)) {
        return fetch(`${baseUrl}/rest/v1/${path}`, {
          headers: makeHeaders(
            FALLBACK_ANON_KEY,
            bearerOverride || callerAccessToken || FALLBACK_ANON_KEY
          ),
          cache: 'no-store',
        });
      }
      return res;
    };

    const profileRes = await restFetch(
      `profiles?email=ilike.${encodeURIComponent(email)}&select=id,auth_user_id,role,approval_status&limit=1`
    );
    if (!profileRes.ok) return null;
    const rows = await profileRes.json();
    const profile = Array.isArray(rows) ? rows[0] : null;
    if (!profile) return null;

    const profileId = profile.id as string;
    const dbPrimary = normalizeRole(profile.role);
    let scopedBearer: string | null = null;
    if (!serviceKey) {
      scopedBearer = await createSignedActiveRoleJwt({
        profileId,
        authUserId: profile.auth_user_id || null,
        email,
        activeRole: dbPrimary !== 'GUEST' ? dbPrimary : 'PARENT',
        roles: dbPrimary !== 'GUEST' ? [dbPrimary] : [],
      });
    }

    const parentBearer = !serviceKey
      ? await createSignedActiveRoleJwt({
          profileId,
          authUserId: profile.auth_user_id || null,
          email,
          activeRole: 'PARENT',
          roles: ['PARENT'],
        })
      : null;

    const effectiveDefaultBearer = scopedBearer || callerAccessToken || null;
    const effectiveParentBearer = parentBearer || scopedBearer || callerAccessToken || null;

    const [urRes, spRes, sgRes] = await Promise.all([
      restFetch(
        `user_roles?user_id=eq.${encodeURIComponent(profileId)}&select=role_name`,
        effectiveDefaultBearer
      ),
      restFetch(
        `student_parents?parent_user_id=eq.${encodeURIComponent(profileId)}&select=student_id&limit=1`,
        effectiveParentBearer
      ),
      restFetch(
        `student_guardians?guardian_id=eq.${encodeURIComponent(profileId)}&select=student_id&limit=1`,
        effectiveParentBearer
      ),
    ]);

    const roleSet = new Set<UserRole>();
    if (urRes.ok) {
      const urRows = await urRes.json().catch(() => []);
      if (Array.isArray(urRows)) {
        urRows.forEach((r: any) => {
          const norm = normalizeRole(r.role_name);
          if (norm !== 'GUEST') roleSet.add(norm);
        });
      }
    }

    let hasChildren = false;
    if (spRes.ok) {
      const spRows = await spRes.json().catch(() => []);
      if (Array.isArray(spRows) && spRows.length > 0) hasChildren = true;
    }
    if (!hasChildren && sgRes.ok) {
      const sgRows = await sgRes.json().catch(() => []);
      if (Array.isArray(sgRows) && sgRows.length > 0) hasChildren = true;
    }

    if (roleSet.size === 0 && dbPrimary !== 'GUEST') {
      roleSet.add(dbPrimary);
    }
    if (hasChildren && (roleSet.size === 0 || !urRes.ok)) {
      roleSet.add('PARENT');
    }

    const roles = sortRolesByPriority(roleSet);
    const primaryRole = roles[0] || dbPrimary;

    return {
      profileId,
      primaryRole,
      roles,
      approval_status: profile.approval_status || 'PENDING',
      hasChildren: hasChildren || roles.includes('PARENT'),
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const rawSession = request.cookies.get(COOKIE_NAMES.SESSION)?.value;
  const rawEmail = request.cookies.get(COOKIE_NAMES.EMAIL)?.value;
  const rawRole = request.cookies.get(COOKIE_NAMES.ROLE)?.value;
  const rawActiveRole = request.cookies.get(COOKIE_NAMES.ACTIVE_ROLE)?.value;
  const rawUsername = request.cookies.get(COOKIE_NAMES.USERNAME)?.value;
  const rawHasChildren = request.cookies.get(COOKIE_NAMES.HAS_CHILDREN)?.value;

  let sessionCookie = await verifyAndExtractCookieValue(rawSession);
  const emailCookie =
    (await verifyAndExtractCookieValue(rawEmail))?.toLowerCase().trim() || '';
  let roleCookie = normalizeRole(await verifyAndExtractCookieValue(rawRole));
  let activeRoleCookie = normalizeRole(await verifyAndExtractCookieValue(rawActiveRole));
  const usernameCookie = (await verifyAndExtractCookieValue(rawUsername)) || '';
  let hasChildrenCookie = (await verifyAndExtractCookieValue(rawHasChildren)) === 'true';

  let roles: UserRole[] = roleCookie !== 'GUEST' ? [roleCookie] : [];
  if (hasChildrenCookie && !roles.includes('PARENT')) {
    roles = sortRolesByPriority([...roles, 'PARENT' as UserRole]);
  }

  let cookiesDirty = false;
  if (emailCookie && emailCookie !== 'sadmin@suongmai.edu.vn') {
    const parsedCookieMap = parseCookieHeader(request.headers.get('cookie'));
    const { accessToken: sbAccessToken } = await extractSupabaseTokensFromCookies(parsedCookieMap);
    const live = await fetchLiveAuthState(emailCookie, sbAccessToken);
    if (live) {
      const effectiveRoles =
        emailCookie === 'luciaxuan178@gmail.com'
          ? sortRolesByPriority(
              live.roles.map((r) => (r === 'SUPER_ADMIN' ? 'SCHOOL_ADMIN' : r))
            )
          : live.roles;

      const latestPrimary = effectiveRoles[0] || live.primaryRole;
      roles = effectiveRoles;

      if (live.approval_status === 'ACTIVE') {
        if (
          roleCookie !== latestPrimary ||
          sessionCookie !== 'active' ||
          hasChildrenCookie !== live.hasChildren
        ) {
          cookiesDirty = true;
        }
        roleCookie = latestPrimary;
        sessionCookie = 'active';
        hasChildrenCookie = live.hasChildren;
        if (activeRoleCookie === 'GUEST' || !roles.includes(activeRoleCookie)) {
          activeRoleCookie = latestPrimary;
          cookiesDirty = true;
        }
      } else if (live.approval_status === 'PENDING' || live.approval_status === 'REJECTED') {
        if (roleCookie !== latestPrimary) cookiesDirty = true;
        roleCookie = latestPrimary;
        activeRoleCookie = 'GUEST';
        sessionCookie = null;
      }
    }
  } else if (emailCookie === 'sadmin@suongmai.edu.vn') {
    roles = ['SUPER_ADMIN'];
    roleCookie = 'SUPER_ADMIN';
    if (activeRoleCookie === 'GUEST') activeRoleCookie = 'SUPER_ADMIN';
  }

  // Align active_role context seamlessly when entering /admin, /teacher, or /parent routes
  const isAdminRoute = pathname.startsWith('/admin');
  const isTeacherRoute = pathname.startsWith('/teacher');
  const isParentRoute = pathname.startsWith('/parent');
  const isProtected = isAdminRoute || isTeacherRoute || isParentRoute;

  let nextActiveRole: UserRole =
    activeRoleCookie !== 'GUEST' && roles.includes(activeRoleCookie)
      ? activeRoleCookie
      : roleCookie;

  const hasAdminRole =
    roles.includes('SUPER_ADMIN') ||
    roles.includes('SCHOOL_ADMIN') ||
    usernameCookie === 'sadmin' ||
    emailCookie === 'sadmin@suongmai.edu.vn';
  const hasStaffRole = roles.includes('STAFF');
  const hasTeacherRole = roles.includes('TEACHER');
  const hasParentRole = roles.includes('PARENT') || hasChildrenCookie;

  if (isAdminRoute && hasAdminRole) {
    const adminRole: UserRole = roles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'SCHOOL_ADMIN';
    if (nextActiveRole !== adminRole) {
      nextActiveRole = adminRole;
      cookiesDirty = true;
    }
  } else if (isAdminRoute && hasStaffRole) {
    if (nextActiveRole !== 'STAFF') {
      nextActiveRole = 'STAFF';
      cookiesDirty = true;
    }
  } else if (isTeacherRoute && hasTeacherRole) {
    if (nextActiveRole !== 'TEACHER') {
      nextActiveRole = 'TEACHER';
      cookiesDirty = true;
    }
  } else if (isParentRoute && hasParentRole) {
    if (nextActiveRole !== 'PARENT') {
      nextActiveRole = 'PARENT';
      cookiesDirty = true;
    }
  }

  const attachUpdatedCookies = async (res: NextResponse) => {
    if (cookiesDirty && emailCookie) {
      if (sessionCookie === 'active') {
        await setSignedCookie(res, COOKIE_NAMES.SESSION, 'active', {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        });
      }
      await setSignedCookie(res, COOKIE_NAMES.EMAIL, emailCookie, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(res, COOKIE_NAMES.ROLE, roleCookie, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      if (nextActiveRole && nextActiveRole !== 'GUEST') {
        await setSignedCookie(res, COOKIE_NAMES.ACTIVE_ROLE, nextActiveRole, {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        });
      }
      if (hasChildrenCookie) {
        await setSignedCookie(res, COOKIE_NAMES.HAS_CHILDREN, 'true', {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        });
      } else {
        res.cookies.delete(COOKIE_NAMES.HAS_CHILDREN);
      }
    }
    return res;
  };

  if (pathname === '/auth/pending-approval' && sessionCookie === 'active' && roleCookie !== 'GUEST') {
    if (hasAdminRole || hasStaffRole) {
      return attachUpdatedCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)));
    }
    if (hasTeacherRole) {
      return attachUpdatedCookies(NextResponse.redirect(new URL('/teacher', request.url)));
    }
    if (hasParentRole) {
      return attachUpdatedCookies(NextResponse.redirect(new URL('/parent', request.url)));
    }
  }

  if (isProtected) {
    if (sessionCookie !== 'active' || !emailCookie || roleCookie === 'GUEST') {
      if (emailCookie && emailCookie !== 'sadmin@suongmai.edu.vn') {
        const pendingUrl = new URL('/auth/pending-approval', request.url);
        pendingUrl.searchParams.set('email', emailCookie);
        const res = NextResponse.redirect(pendingUrl);
        if (!sessionCookie && rawSession) res.cookies.delete(COOKIE_NAMES.SESSION);
        return attachUpdatedCookies(res);
      }
      const loginUrl = new URL('/auth', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      const res = NextResponse.redirect(loginUrl);
      if (!sessionCookie && rawSession) res.cookies.delete(COOKIE_NAMES.SESSION);
      return res;
    }

    if (isAdminRoute && !hasAdminRole && !hasStaffRole) {
      if (hasTeacherRole) {
        const teacherUrl = new URL('/teacher', request.url);
        teacherUrl.searchParams.set('warning', 'unauthorized_admin_access');
        return attachUpdatedCookies(NextResponse.redirect(teacherUrl));
      }
      if (hasParentRole) {
        const parentUrl = new URL('/parent', request.url);
        parentUrl.searchParams.set('warning', 'unauthorized_admin_access');
        return attachUpdatedCookies(NextResponse.redirect(parentUrl));
      }
      const pendingUrl = new URL('/auth/pending-approval', request.url);
      pendingUrl.searchParams.set('email', emailCookie);
      return attachUpdatedCookies(NextResponse.redirect(pendingUrl));
    }

    const isSensitiveAdminRoute =
      pathname.startsWith('/admin/settings/security') ||
      pathname.startsWith('/admin/settings/email');

    const isStrictSuperAdmin =
      emailCookie !== 'hejc108@gmail.com' &&
      emailCookie !== 'luciaxuan178@gmail.com' &&
      (roles.includes('SUPER_ADMIN') || emailCookie === 'sadmin@suongmai.edu.vn');

    if (isSensitiveAdminRoute && !isStrictSuperAdmin) {
      const dashboardUrl = new URL('/admin/dashboard', request.url);
      dashboardUrl.searchParams.set('warning', 'super_admin_required');
      return attachUpdatedCookies(NextResponse.redirect(dashboardUrl));
    }

    if (isTeacherRoute && !hasTeacherRole && !hasAdminRole && !hasStaffRole) {
      if (hasParentRole) {
        const parentUrl = new URL('/parent', request.url);
        parentUrl.searchParams.set('warning', 'wrong_role');
        return attachUpdatedCookies(NextResponse.redirect(parentUrl));
      }
      return attachUpdatedCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)));
    }

    if (isParentRoute && !hasParentRole && !hasAdminRole && !hasStaffRole) {
      if (hasTeacherRole) {
        return attachUpdatedCookies(NextResponse.redirect(new URL('/teacher', request.url)));
      }
      return attachUpdatedCookies(NextResponse.redirect(new URL('/admin/dashboard', request.url)));
    }
  }

  return attachUpdatedCookies(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/parent/:path*', '/auth/pending-approval'],
};
