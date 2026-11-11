import { NextResponse } from 'next/server';
import { NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import {
  fetchAdminUsersWithRoles,
  syncUserMultiRolesAndLinks,
} from '@/lib/admin/multiRoleUserService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email') || undefined;

    const result = await fetchAdminUsersWithRoles(ctx, { email: emailParam });

    return NextResponse.json(
      {
        success: true,
        total: result.users.length,
        users: result.users,
        user: result.targetUser,
        is_super_admin: result.isSuperAdmin,
        settings: {
          allow_school_admin_view_temporary_staff: result.allowTemporaryStaff,
        },
        debug: {
          hasServiceRoleKey: result.hasServiceRoleKey,
          dbWarning: result.dbWarning,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/users error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const result = await syncUserMultiRolesAndLinks(ctx, body);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'MULTI_ROLE_SYNC_FAILED',
          message: result.message,
        },
        { status: result.status, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: result.profile,
        user: result.profile,
        relations: result.relations,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('PUT /api/admin/users error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error', message: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export const PATCH = PUT;
