import { NextResponse } from 'next/server';
import {
  normalizeRole,
  requireAuth,
} from '@/lib/auth/sessionContext';
import {
  COOKIE_NAMES,
  setSignedCookie,
} from '@/lib/utils/cookieSigner';
import {
  getSupabaseAdminClient,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/switch-role
 * Instant server-side active_role update with HMAC-signed cookie & DB verification.
 * Returns 403 FORBIDDEN_ACTIVE_ROLE if the user does not hold target_role in user_roles.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if ('response' in authResult) {
      return authResult.response;
    }
    const { ctx } = authResult;

    if (ctx.approvalStatus !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: 'ACCOUNT_NOT_ACTIVE',
          message: 'Tài khoản chưa được kích hoạt.',
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawTarget = body?.target_role ?? body?.role ?? '';
    const targetRole = normalizeRole(rawTarget);

    if (targetRole === 'GUEST') {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TARGET_ROLE',
          message: 'Vai trò chuyển đổi không hợp lệ.',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Verify against DB user_roles (ctx.roles is already freshly loaded from DB)
    if (!ctx.roles.includes(targetRole)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_ACTIVE_ROLE',
          message: `Tài khoản chưa được cấp quyền ${targetRole}.`,
          held_roles: ctx.roles,
          requested_role: targetRole,
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // Best-effort RPC verification against Postgres Layer-2 context if available
    try {
      const admin = getSupabaseAdminClient();
      await admin.rpc('rpc_set_active_role_context', {
        p_profile_id: ctx.profileId,
        p_active_role: targetRole,
      });
    } catch {
      // Pre-00013 DB or RPC not configured yet; Layer-1 + signed cookie remains active
    }

    const redirectUrl =
      targetRole === 'PARENT'
        ? '/parent'
        : targetRole === 'TEACHER'
          ? '/teacher'
          : '/admin/dashboard';

    const response = NextResponse.json(
      {
        success: true,
        activeRole: targetRole,
        roles: ctx.roles,
        redirectUrl,
      },
      { headers: NO_CACHE_HEADERS }
    );

    await setSignedCookie(response, COOKIE_NAMES.ACTIVE_ROLE, targetRole, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });

    return response;
  } catch (err: any) {
    console.error('[POST /api/auth/switch-role] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: err?.message || 'Không thể chuyển đổi vai trò.',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
