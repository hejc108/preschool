import { NextResponse } from 'next/server';
import {
  normalizeRole,
  parseCookieHeader,
  resolveProfileAndRolesByEmail,
} from '@/lib/auth/sessionContext';
import {
  COOKIE_NAMES,
  setSignedCookie,
  verifyAndExtractCookieValue,
} from '@/lib/utils/cookieSigner';
import {
  getSupabaseAdminClient,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function computeDefaultRedirect(role: string): string {
  if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN' || role === 'ADMIN') {
    return '/admin/dashboard';
  }
  if (role === 'TEACHER') return '/teacher';
  if (role === 'STAFF') return '/admin/menu';
  return '/parent';
}

export async function POST(request: Request) {
  try {
    const rawCookies = parseCookieHeader(request.headers.get('cookie'));
    const body = await request.json().catch(() => ({}));

    // Verify caller identity strictly via Supabase Bearer token OR signed email cookie
    let verifiedEmail = '';
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : typeof body?.access_token === 'string'
        ? body.access_token.trim()
        : '';

    if (accessToken) {
      const { data, error } = await getSupabaseAdminClient().auth.getUser(accessToken);
      if (!error && data?.user?.email) {
        verifiedEmail = data.user.email.toLowerCase().trim();
      }
    }

    if (!verifiedEmail && rawCookies[COOKIE_NAMES.EMAIL]) {
      const cookieEmail = await verifyAndExtractCookieValue(rawCookies[COOKIE_NAMES.EMAIL]);
      if (cookieEmail) {
        verifiedEmail = cookieEmail.toLowerCase().trim();
      }
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { success: false, message: 'Thiếu token xác thực Google hoặc phiên đăng nhập hợp lệ.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const rawActive = rawCookies[COOKIE_NAMES.ACTIVE_ROLE];
    const verifiedActive = rawActive ? await verifyAndExtractCookieValue(rawActive) : null;
    const requestedActive = verifiedActive ? normalizeRole(verifiedActive) : null;

    const ctx = await resolveProfileAndRolesByEmail(verifiedEmail, requestedActive);
    if (!ctx) {
      return NextResponse.json(
        {
          success: true,
          isApproved: false,
          status: 'PENDING',
          message: 'Tài khoản chưa được khởi tạo',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (ctx.approvalStatus === 'ACTIVE') {
      const activeRole =
        ctx.activeRoleInvalid || ctx.activeRole === 'GUEST'
          ? ctx.primaryRole
          : ctx.activeRole;
      const hasChildren = ctx.linkedStudentIds.length > 0 || ctx.roles.includes('PARENT');
      const redirectUrl = computeDefaultRedirect(activeRole);

      const response = NextResponse.json(
        {
          success: true,
          isApproved: true,
          role: ctx.primaryRole,
          roles: ctx.roles,
          activeRole,
          hasChildren,
          redirectUrl,
          profile: {
            id: ctx.profileId,
            email: ctx.email,
            full_name: ctx.fullName,
            role: ctx.primaryRole,
            roles: ctx.roles,
            active_role: activeRole,
            approval_status: ctx.approvalStatus,
          },
        },
        { headers: NO_CACHE_HEADERS }
      );

      await setSignedCookie(response, COOKIE_NAMES.SESSION, 'active', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.EMAIL, ctx.email, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ROLE, ctx.primaryRole, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ACTIVE_ROLE, activeRole, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      if (hasChildren) {
        await setSignedCookie(response, COOKIE_NAMES.HAS_CHILDREN, 'true', {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        });
      } else {
        response.cookies.delete(COOKIE_NAMES.HAS_CHILDREN);
      }

      return response;
    }

    const response = NextResponse.json(
      {
        success: true,
        isApproved: false,
        status: ctx.approvalStatus,
        message:
          ctx.approvalStatus === 'REJECTED'
            ? 'Yêu cầu truy cập của bạn đã bị từ chối'
            : 'Tài khoản của bạn đang chờ phê duyệt',
      },
      { headers: NO_CACHE_HEADERS }
    );
    response.cookies.delete(COOKIE_NAMES.SESSION);
    response.cookies.delete(COOKIE_NAMES.ACTIVE_ROLE);
    await setSignedCookie(response, COOKIE_NAMES.EMAIL, ctx.email, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
