import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/sessionContext';
import {
  createSignedActiveRoleJwt,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/auth/realtime-token
 * Mints a short-lived signed HS256 JWT carrying verified `active_role` and `roles`
 * so browser Supabase Realtime WebSockets match Layer-2 Postgres RLS for the active portal.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if ('response' in authResult) {
      return authResult.response;
    }
    const { ctx } = authResult;

    if (
      ctx.approvalStatus !== 'ACTIVE' ||
      ctx.activeRoleInvalid ||
      ctx.activeRole === 'GUEST' ||
      !ctx.roles.includes(ctx.activeRole)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_ACTIVE_ROLE',
          token: null,
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const token = await createSignedActiveRoleJwt({
      profileId: ctx.profileId,
      authUserId: ctx.authUserId,
      email: ctx.email,
      activeRole: ctx.activeRole,
      roles: ctx.roles,
      ttlSeconds: 300,
    });

    return NextResponse.json(
      {
        success: true,
        token,
        activeRole: ctx.activeRole,
        expiresIn: token ? 300 : 0,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[GET /api/auth/realtime-token] Error:', err);
    return NextResponse.json(
      {
        success: false,
        token: null,
        error: err?.message || 'Internal Server Error',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
