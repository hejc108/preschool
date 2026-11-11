import { NextResponse } from 'next/server';
import {
  executeWithAdminFallback,
  getSupabaseAdminClient,
  getSupabaseConfig,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import {
  executeWithContextFallback,
  getSessionContext,
  isAdminRole,
  normalizeRole,
  requireActiveRole,
  sortRolesByPriority,
} from '@/lib/auth/sessionContext';
import {
  ensureValidUuid,
  fetchRelationsFromSupabase,
  syncUserMultiRolesAndLinks,
} from '@/lib/admin/multiRoleUserService';
import { ParentStudentRelation, Profile, UserRole } from '@/lib/types/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INITIAL_SERVER_PROFILES: Profile[] = [
  {
    id: 'u-super-admin-sadmin',
    full_name: 'Quản Trị Tối Cao (Super Admin)',
    email: 'sadmin@suongmai.edu.vn',
    role: 'SUPER_ADMIN',
    roles: ['SUPER_ADMIN'],
    approval_status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
];

declare global {
  var __SUONGMAI_PROFILES_CACHE__: Profile[] | undefined;
  var __SUONGMAI_RELATIONS_CACHE__: ParentStudentRelation[] | undefined;
}

if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
  globalThis.__SUONGMAI_PROFILES_CACHE__ = [...INITIAL_SERVER_PROFILES];
}
if (!globalThis.__SUONGMAI_RELATIONS_CACHE__) {
  globalThis.__SUONGMAI_RELATIONS_CACHE__ = [];
}

export async function GET(request: Request) {
  const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
  if ('response' in auth) return auth.response;
  const { ctx } = auth;

  const serverCache = [...(globalThis.__SUONGMAI_PROFILES_CACHE__ || INITIAL_SERVER_PROFILES)];
  const { isValidServiceRoleKey: hasServiceRoleKey } = getSupabaseConfig();

  let dbProfilesCount = 0;
  let dbErrorDetail: string | null = null;
  let relations: ParentStudentRelation[] = [];
  const rolesByUserId = new Map<string, UserRole[]>();

  try {
    const [profRes, urRes, rels] = await Promise.all([
      executeWithContextFallback(ctx, async (sb) =>
        await sb.from('profiles').select('*').order('created_at', { ascending: false })
      ),
      executeWithContextFallback(ctx, async (sb) =>
        await sb.from('user_roles').select('user_id, role_name')
      ),
      fetchRelationsFromSupabase(ctx),
    ]);

    relations = rels;

    if (urRes.error) {
      dbErrorDetail = `user_roles: ${urRes.error.message}`;
    } else if (Array.isArray(urRes.data)) {
      urRes.data.forEach((row: any) => {
        const list = rolesByUserId.get(row.user_id) || [];
        const norm = normalizeRole(row.role_name);
        if (norm !== 'GUEST') list.push(norm);
        rolesByUserId.set(row.user_id, list);
      });
    }

    if (profRes.error) {
      dbErrorDetail = dbErrorDetail || profRes.error.message;
      console.error('[API GET APPROVALS ERROR]:', profRes.error.message);
    } else if (Array.isArray(profRes.data) && profRes.data.length > 0) {
      dbProfilesCount = profRes.data.length;
      for (const dbProfile of profRes.data as Profile[]) {
        const idx = serverCache.findIndex(
          (p) => p.email.toLowerCase().trim() === dbProfile.email?.toLowerCase().trim()
        );
        if (idx !== -1) {
          serverCache[idx] = { ...serverCache[idx], ...dbProfile };
        } else {
          serverCache.push(dbProfile);
        }
      }
    }
  } catch (e: any) {
    dbErrorDetail = e?.message || String(e);
    console.warn('[API GET APPROVALS EXCEPTION]:', dbErrorDetail);
  }

  const sadminIdx = serverCache.findIndex(
    (p) => p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn'
  );
  if (sadminIdx === -1) {
    serverCache.unshift(INITIAL_SERVER_PROFILES[0]);
  } else {
    serverCache[sadminIdx].role = 'SUPER_ADMIN';
    serverCache[sadminIdx].approval_status = 'ACTIVE';
  }

  const DEPRECATED_MOCK_EMAILS = [
    'admin@suongmai.edu.vn',
    'so.maria@suongmai.edu.vn',
    'teacher@suongmai.edu.vn',
    'teacher.pending@suongmai.edu.vn',
    'parent@suongmai.edu.vn',
    'parent.pending@gmail.com',
  ];

  const sanitized = serverCache
    .filter((p) => {
      const clean = (p.email || '').toLowerCase().trim();
      return Boolean(clean) && !DEPRECATED_MOCK_EMAILS.includes(clean);
    })
    .map((p) => {
      const clean = (p.email || '').toLowerCase().trim();
      const baseRole =
        clean === 'luciaxuan178@gmail.com' && p.role === 'SUPER_ADMIN'
          ? 'SCHOOL_ADMIN'
          : normalizeRole(p.role);

      const hasRel = relations.some(
        (r) => r.parent_id === p.id || r.parent_email?.toLowerCase().trim() === clean
      );
      const dbUserRoles = rolesByUserId.get(p.id) || [];
      const heldRoles = sortRolesByPriority([
        ...dbUserRoles,
        ...(dbUserRoles.length === 0 && baseRole !== 'GUEST' ? [baseRole] : []),
        ...(hasRel ? (['PARENT'] as UserRole[]) : []),
      ]);

      return {
        ...p,
        role: heldRoles[0] || baseRole,
        roles: heldRoles,
      };
    });

  globalThis.__SUONGMAI_PROFILES_CACHE__ = sanitized;
  return NextResponse.json(
    {
      success: true,
      profiles: sanitized,
      data: sanitized,
      users: sanitized,
      relations,
      pendingProfiles: sanitized.filter(
        (p) => (p.approval_status || 'PENDING').toUpperCase() === 'PENDING'
      ),
      debug: {
        hasServiceRoleKey,
        dbProfilesCount,
        totalProfilesCount: sanitized.length,
        relationsCount: relations.length,
        dbError: dbErrorDetail,
      },
    },
    { headers: NO_CACHE_HEADERS }
  );
}

/**
 * Registers or resolves the caller's own Google OAuth profile cleanly.
 * Requires either an active Admin session OR a valid Supabase Bearer JWT matching body.email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let email = (body.email || '').toLowerCase().trim();
    const fullName = body.full_name || '';
    const avatarUrl = body.avatar_url;

    const { ctx } = await getSessionContext(request);
    let bearerUser: { id?: string; email?: string } | null = null;

    if (!ctx || !isAdminRole(ctx.activeRole)) {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
      if (token) {
        const sb = getSupabaseAdminClient();
        const { data } = await sb.auth.getUser(token);
        if (data?.user?.email) {
          bearerUser = { id: data.user.id, email: data.user.email.toLowerCase().trim() };
        }
      }
    }

    if (bearerUser?.email) {
      if (email && email !== bearerUser.email) {
        return NextResponse.json(
          { success: false, message: 'Email không khớp với phiên đăng nhập.' },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      email = bearerUser.email;
    } else if (!ctx || (!isAdminRole(ctx.activeRole) && ctx.email !== email)) {
      return NextResponse.json(
        { success: false, message: 'Yêu cầu xác thực hợp lệ.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email là bắt buộc' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const serverCache = [...(globalThis.__SUONGMAI_PROFILES_CACHE__ || INITIAL_SERVER_PROFILES)];
    const existing = serverCache.find((p) => p.email.toLowerCase().trim() === email);

    const isSadmin = email === 'sadmin@suongmai.edu.vn';
    const isSchoolAdmin = email === 'luciaxuan178@gmail.com';
    const generatedId = ensureValidUuid(existing?.id);

    const newProfile: Profile = existing || {
      id: generatedId,
      auth_user_id: bearerUser?.id || null,
      email,
      full_name: fullName || (isSadmin ? 'Quản Trị Tối Cao (Super Admin)' : email.split('@')[0]),
      role: isSadmin ? 'SUPER_ADMIN' : isSchoolAdmin ? 'SCHOOL_ADMIN' : 'GUEST',
      approval_status: isSadmin || isSchoolAdmin ? 'ACTIVE' : 'PENDING',
      avatar_url:
        avatarUrl ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
    };

    const { data: dbExisting } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('profiles')
        .select('id, auth_user_id, role, approval_status, full_name, avatar_url')
        .ilike('email', email)
        .maybeSingle()
    );

    if (dbExisting) {
      newProfile.id = dbExisting.id;
      newProfile.role = normalizeRole(dbExisting.role);
      newProfile.approval_status = dbExisting.approval_status;
      newProfile.full_name = dbExisting.full_name || newProfile.full_name;
      if (bearerUser?.id && !dbExisting.auth_user_id) {
        await executeWithAdminFallback(async (sb) =>
          await sb.from('profiles').update({ auth_user_id: bearerUser!.id }).eq('id', dbExisting.id)
        );
      }
    } else {
      const insertPayload: Record<string, any> = {
        id: ensureValidUuid(newProfile.id),
        email: newProfile.email,
        full_name: newProfile.full_name,
        role: newProfile.role,
        approval_status: newProfile.approval_status,
        avatar_url: newProfile.avatar_url,
        created_at: newProfile.created_at,
      };
      if (bearerUser?.id) insertPayload.auth_user_id = bearerUser.id;
      await executeWithAdminFallback(async (sb) => await sb.from('profiles').insert(insertPayload));

      if (newProfile.role === 'SUPER_ADMIN' || newProfile.role === 'SCHOOL_ADMIN') {
        await executeWithAdminFallback(async (sb) =>
          await sb.from('user_roles').upsert(
            { user_id: insertPayload.id, role_name: newProfile.role },
            { onConflict: 'user_id,role_name', ignoreDuplicates: true }
          )
        );
      }
    }

    return NextResponse.json({ success: true, profile: newProfile }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
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
        relations: result.relations,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('[APPROVE EXCEPTION] PUT handler error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email là bắt buộc' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (globalThis.__SUONGMAI_PROFILES_CACHE__) {
      globalThis.__SUONGMAI_PROFILES_CACHE__ = globalThis.__SUONGMAI_PROFILES_CACHE__.filter(
        (p) => p.email.toLowerCase().trim() !== email
      );
    }

    const { error: delErr } = await executeWithContextFallback(auth.ctx, async (sb) =>
      await sb.from('profiles').delete().eq('email', email)
    );
    if (delErr) {
      return NextResponse.json(
        { success: false, message: `Không thể xóa tài khoản: ${delErr.message}` },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, message: `Đã xóa tài khoản ${email}` },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
