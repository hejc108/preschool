import { NextResponse } from 'next/server';
import {
  getSessionContext,
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

function computeDefaultRedirect(activeRole: string): string {
  if (activeRole === 'SUPER_ADMIN' || activeRole === 'SCHOOL_ADMIN' || activeRole === 'ADMIN') {
    return '/admin/dashboard';
  }
  if (activeRole === 'TEACHER') return '/teacher';
  if (activeRole === 'PARENT') return '/parent';
  if (activeRole === 'STAFF') return '/admin/menu';
  return '/parent';
}

export async function GET(request: Request) {
  try {
    const rawCookies = parseCookieHeader(request.headers.get('cookie'));
    const rawEmailCookie = rawCookies[COOKIE_NAMES.EMAIL];
    const rawRoleCookie = rawCookies[COOKIE_NAMES.ROLE];
    const rawActiveCookie = rawCookies[COOKIE_NAMES.ACTIVE_ROLE];

    const currentCookieRole = rawRoleCookie
      ? (await verifyAndExtractCookieValue(rawRoleCookie)) || ''
      : '';
    const currentSignedActive = rawActiveCookie
      ? (await verifyAndExtractCookieValue(rawActiveCookie)) || ''
      : '';

    // 1. Identify caller strictly via signed cookies or verified Supabase Bearer JWT
    const { ctx: existingCtx } = await getSessionContext(request);
    let verifiedEmail = existingCtx?.email || '';

    if (!verifiedEmail && rawEmailCookie) {
      verifiedEmail =
        (await verifyAndExtractCookieValue(rawEmailCookie))?.toLowerCase().trim() || '';
    }

    if (!verifiedEmail) {
      const authHeader = request.headers.get('authorization') || '';
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token) {
          const { data, error } = await getSupabaseAdminClient().auth.getUser(token);
          if (!error && data?.user?.email) {
            verifiedEmail = data.user.email.toLowerCase().trim();
          }
        }
      }
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        {
          isApproved: false,
          status: 'UNAUTHENTICATED',
          message: 'Phiên đăng nhập chưa được xác thực.',
        },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const claimedActive = currentSignedActive ? normalizeRole(currentSignedActive) : null;
    const ctx =
      existingCtx || (await resolveProfileAndRolesByEmail(verifiedEmail, claimedActive));

    if (!ctx) {
      return NextResponse.json(
        { isApproved: false, status: 'PENDING', message: 'Tài khoản chưa có trong CSDL' },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const activeRole =
      ctx.activeRoleInvalid || ctx.activeRole === 'GUEST'
        ? ctx.primaryRole
        : ctx.activeRole;

    if (ctx.approvalStatus === 'ACTIVE') {
      const hasChildren = ctx.linkedStudentIds.length > 0 || ctx.roles.includes('PARENT');
      const roleChanged = Boolean(currentCookieRole && currentCookieRole !== ctx.primaryRole);
      const redirectUrl = computeDefaultRedirect(activeRole);

      const response = NextResponse.json(
        {
          isApproved: true,
          status: 'ACTIVE',
          email: ctx.email,
          fullName: ctx.fullName,
          avatarUrl: ctx.avatarUrl || null,
          profileId: ctx.profileId,
          role: ctx.primaryRole,
          roles: ctx.roles,
          activeRole,
          previousCookieRole: currentCookieRole || null,
          roleChanged,
          hasChildren,
          assignedClassIds: ctx.assignedClassIds,
          linkedStudents: ctx.linkedStudents.map((st) => ({
            id: st.id,
            student_id: st.id,
            full_name: st.full_name,
            student_name: st.full_name,
            student_code: st.student_code || '',
            class_id: st.class_id || null,
            class_name: st.class_name || 'Mầm',
            allergies: st.allergies || 'Không',
            avatar_url: st.avatar_url || '',
            relationship: st.relationship || 'Phụ huynh',
            parent_email: ctx.email,
            is_verified: true,
          })),
          redirectUrl,
          profile: {
            id: ctx.profileId,
            auth_user_id: ctx.authUserId,
            email: ctx.email,
            full_name: ctx.fullName,
            avatar_url: ctx.avatarUrl,
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

    const pendingResponse = NextResponse.json(
      {
        isApproved: false,
        status: ctx.approvalStatus || 'PENDING',
        role: ctx.primaryRole || 'GUEST',
        roles: ctx.roles,
        activeRole: 'GUEST',
        linkedStudents: [],
      },
      { headers: NO_CACHE_HEADERS }
    );
    pendingResponse.cookies.delete(COOKIE_NAMES.SESSION);
    pendingResponse.cookies.delete(COOKIE_NAMES.ACTIVE_ROLE);
    await setSignedCookie(pendingResponse, COOKIE_NAMES.ROLE, ctx.primaryRole || 'GUEST', {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
    return pendingResponse;
  } catch (error: any) {
    return NextResponse.json(
      { isApproved: false, status: 'PENDING', message: error?.message || 'Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
