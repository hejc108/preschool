import { NextResponse } from 'next/server';
import { UserRole } from '@/lib/types/schema';
import {
  COOKIE_NAMES,
  verifyAndExtractCookieValue,
} from '@/lib/utils/cookieSigner';
import {
  AuthDbContext,
  executeWithPrivilegedFallback,
  getSupabaseAdminClient,
  getSupabaseConfig,
  getSupabaseRlsScopedClient,
  isJwtExpired,
  NO_CACHE_HEADERS,
} from '@/lib/supabase/server';
import { DEFAULT_UUID_TO_NAME, expandClassIdAliases } from '@/lib/constants/classes';

export const ROLE_PRIORITY: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  SCHOOL_ADMIN: 4,
  ADMIN: 4,
  TEACHER: 3,
  STAFF: 2,
  PARENT: 1,
  GUEST: 0,
};

export interface LinkedStudentSummary {
  id: string;
  student_code?: string;
  full_name: string;
  class_id?: string | null;
  class_name?: string;
  allergies?: string;
  avatar_url?: string;
  relationship?: string;
}

export interface SessionContext {
  profileId: string;
  authUserId?: string | null;
  email: string;
  fullName: string;
  avatarUrl?: string;
  approvalStatus: 'PENDING' | 'ACTIVE' | 'REJECTED';
  primaryRole: UserRole;
  roles: UserRole[];
  activeRole: UserRole;
  activeRoleInvalid: boolean;
  assignedClassIds: string[];
  linkedStudentIds: string[];
  linkedStudents: LinkedStudentSummary[];
  supabaseAccessToken?: string | null;
}

export function normalizeRole(raw: unknown): UserRole {
  const r = String(raw || '')
    .trim()
    .toUpperCase();
  if (r === 'ADMIN') return 'SCHOOL_ADMIN';
  if (
    r === 'SUPER_ADMIN' ||
    r === 'SCHOOL_ADMIN' ||
    r === 'TEACHER' ||
    r === 'STAFF' ||
    r === 'PARENT' ||
    r === 'GUEST'
  ) {
    return r;
  }
  return 'GUEST';
}

export function sortRolesByPriority(roles: Iterable<UserRole>): UserRole[] {
  const unique = Array.from(
    new Set(
      Array.from(roles)
        .map(normalizeRole)
        .filter((r) => r !== 'GUEST')
    )
  );
  return unique.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]);
}

export function getHighestPriorityRole(roles: Iterable<UserRole>): UserRole {
  const sorted = sortRolesByPriority(roles);
  return sorted[0] || 'GUEST';
}

export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) map[key] = val;
  }
  return map;
}

function decodeCookieJsonValue(rawValue: string): Record<string, any> | null {
  try {
    let text = rawValue;
    try {
      text = decodeURIComponent(rawValue);
    } catch {
      text = rawValue;
    }
    if (text.startsWith('base64-')) {
      const b64 = text.slice(7).replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
      const bin = atob(b64 + pad);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      text = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extracts Supabase OAuth access/refresh tokens from either signed Suong Mai cookies
 * or @supabase/ssr chunked auth-token cookies.
 */
export async function extractSupabaseTokensFromCookies(
  cookies: Record<string, string>
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  const rawAccessCookie = cookies[COOKIE_NAMES.SB_ACCESS_TOKEN];
  if (rawAccessCookie) {
    const verified = await verifyAndExtractCookieValue(rawAccessCookie);
    if (verified && !isJwtExpired(verified)) {
      accessToken = verified;
    }
  }

  const rawRefreshCookie = cookies[COOKIE_NAMES.SB_REFRESH_TOKEN];
  if (rawRefreshCookie) {
    refreshToken = await verifyAndExtractCookieValue(rawRefreshCookie);
  }

  if (accessToken) {
    return { accessToken, refreshToken };
  }

  // Fallback: inspect @supabase/ssr cookies (sb-<project-ref>-auth-token[.0,.1,...])
  const baseNames = new Set<string>();
  for (const key of Object.keys(cookies)) {
    if (key.startsWith('sb-') && key.includes('-auth-token')) {
      baseNames.add(key.replace(/\.\d+$/, ''));
    }
  }

  for (const base of Array.from(baseNames)) {
    let combined = cookies[base] || '';
    if (!combined) {
      const parts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const chunk = cookies[`${base}.${i}`];
        if (!chunk) break;
        parts.push(chunk);
      }
      combined = parts.join('');
    }
    if (!combined) continue;

    const sessionObj = decodeCookieJsonValue(combined);
    const ssrAccess = typeof sessionObj?.access_token === 'string' ? sessionObj.access_token.trim() : '';
    const ssrRefresh =
      typeof sessionObj?.refresh_token === 'string' ? sessionObj.refresh_token.trim() : '';

    if (ssrRefresh && !refreshToken) {
      refreshToken = ssrRefresh;
    }
    if (ssrAccess && !isJwtExpired(ssrAccess)) {
      accessToken = ssrAccess;
      break;
    }
  }

  return { accessToken, refreshToken };
}

export async function resolveProfileAndRolesByEmail(
  emailInput: string,
  claimedActiveRole?: UserRole | null,
  supabaseAccessToken?: string | null
): Promise<SessionContext | null> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return null;

  const cleanCallerToken =
    supabaseAccessToken && !isJwtExpired(supabaseAccessToken) ? supabaseAccessToken : null;

  const bootstrapLookupCtx: AuthDbContext = {
    profileId: '',
    email,
    activeRole: claimedActiveRole && claimedActiveRole !== 'GUEST' ? claimedActiveRole : 'GUEST',
    roles: [],
    supabaseAccessToken: cleanCallerToken,
  };

  let { data: profile, error: profErr } = await executeWithPrivilegedFallback(
    async (sb) => await sb.from('profiles').select('*').ilike('email', email).maybeSingle(),
    bootstrapLookupCtx
  );

  if (profErr) {
    const retry = await getSupabaseAdminClient(true)
      .from('profiles')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    profile = retry.data;
    profErr = retry.error;
  }

  if (!profile) {
    // Fallback bootstrap super/school admin accounts if profile row not seeded yet
    if (email === 'sadmin@suongmai.edu.vn' || email === 'luciaxuan178@gmail.com') {
      const bootRole: UserRole =
        email === 'sadmin@suongmai.edu.vn' ? 'SUPER_ADMIN' : 'SCHOOL_ADMIN';
      const activeRole =
        claimedActiveRole && claimedActiveRole === bootRole ? claimedActiveRole : bootRole;
      return {
        profileId: `bootstrap-${bootRole.toLowerCase()}`,
        email,
        fullName: bootRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Ban Giám Hiệu',
        approvalStatus: 'ACTIVE',
        primaryRole: bootRole,
        roles: [bootRole],
        activeRole,
        activeRoleInvalid: Boolean(claimedActiveRole && claimedActiveRole !== bootRole),
        assignedClassIds: [],
        linkedStudentIds: [],
        linkedStudents: [],
        supabaseAccessToken: cleanCallerToken,
      };
    }
    return null;
  }

  const profileId = profile.id as string;
  const profilePrimaryRole = normalizeRole(profile.role);

  const baseAuthCtx: AuthDbContext = {
    profileId,
    authUserId: profile.auth_user_id || null,
    email,
    activeRole: claimedActiveRole && claimedActiveRole !== 'GUEST' ? claimedActiveRole : profilePrimaryRole,
    roles: profilePrimaryRole !== 'GUEST' ? [profilePrimaryRole] : [],
    supabaseAccessToken: cleanCallerToken,
  };

  // 1. Read multi-role assignments from public.user_roles (with pre-00013 safety & scoped JWT fallback)
  let dbRoles: UserRole[] = [];
  let hasUserRolesTable = true;
  try {
    const { data: urRows, error: urErr } = await executeWithPrivilegedFallback(
      async (sb) => await sb.from('user_roles').select('role_name').eq('user_id', profileId),
      baseAuthCtx
    );

    if (urErr) {
      if (urErr.code === '42P01' || urErr.message?.includes('does not exist')) {
        hasUserRolesTable = false;
      }
    } else if (Array.isArray(urRows)) {
      dbRoles = urRows.map((r: any) => normalizeRole(r.role_name));
    }
  } catch {
    hasUserRolesTable = false;
  }

  const resolvedContextRoles = dbRoles.length > 0 ? dbRoles : baseAuthCtx.roles;

  // 2. Read student links from student_parents + fallback student_guardians
  const studentMap = new Map<string, LinkedStudentSummary>();
  const collectStudentRow = (row: any, relField = 'relationship') => {
    const st = row?.students;
    const sid = row?.student_id || st?.id;
    if (!sid) return;
    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        id: sid,
        student_code: st?.student_code || '',
        full_name: st?.full_name || 'Bé',
        class_id: st?.class_id || null,
        class_name: st?.classes?.name || st?.class_name || DEFAULT_UUID_TO_NAME[st?.class_id] || '',
        allergies: st?.allergies || 'Không',
        avatar_url: st?.avatar_url || '',
        relationship: row?.[relField] || 'Phụ huynh',
      });
    }
  };

  const parentScopeCtx: AuthDbContext = {
    ...baseAuthCtx,
    activeRole: resolvedContextRoles.includes('PARENT') ? 'PARENT' : baseAuthCtx.activeRole,
    roles: resolvedContextRoles,
  };

  try {
    const { data: spRows, error: spErr } = await executeWithPrivilegedFallback(
      async (sb) =>
        await sb
          .from('student_parents')
          .select(
            'student_id, relationship, students(id, full_name, student_code, class_id, allergies, avatar_url, classes(id, name))'
          )
          .eq('parent_user_id', profileId),
      parentScopeCtx
    );

    if (!spErr && Array.isArray(spRows)) {
      spRows.forEach((r) => collectStudentRow(r, 'relationship'));
    }
  } catch {
    // fallback handled below
  }

  try {
    const { data: sgRows, error: sgErr } = await executeWithPrivilegedFallback(
      async (sb) =>
        await sb
          .from('student_guardians')
          .select(
            'student_id, relationship, students(id, full_name, student_code, class_id, allergies, avatar_url, classes(id, name))'
          )
          .eq('guardian_id', profileId),
      parentScopeCtx
    );

    if (!sgErr && Array.isArray(sgRows)) {
      sgRows.forEach((r) => collectStudentRow(r, 'relationship'));
    }
  } catch {
    // noop
  }

  const linkedStudents = Array.from(studentMap.values());
  const linkedStudentIds = linkedStudents.map((s) => s.id);

  // 3. Read teacher class assignments with teacher_class_assignments as canonical source of truth
  const classIdSet = new Set<string>();
  const addClassRef = (cid?: string | null, cname?: string | null) => {
    expandClassIdAliases(cid, cname).forEach((id) => classIdSet.add(id));
  };

  const teacherScopeCtx: AuthDbContext = {
    ...baseAuthCtx,
    activeRole: resolvedContextRoles.includes('TEACHER') ? 'TEACHER' : baseAuthCtx.activeRole,
    roles: resolvedContextRoles,
  };

  let assignmentsTableReady = false;
  try {
    const { data: assignRows, error: assignErr } = await executeWithPrivilegedFallback(
      async (sb) =>
        await sb
          .from('teacher_class_assignments')
          .select('class_id, class_name')
          .or(`teacher_id.eq.${profileId},teacher_email.ilike.${email}`),
      teacherScopeCtx
    );

    if (!assignErr && Array.isArray(assignRows)) {
      assignmentsTableReady = true;
      assignRows.forEach((r: any) => addClassRef(r.class_id, r.class_name));
    }
  } catch {
    assignmentsTableReady = false;
  }

  // Fallback ONLY when teacher_class_assignments table does not exist or could not be queried
  if (!assignmentsTableReady) {
    if (profile.assigned_class_id || profile.assigned_class_name) {
      const names = String(profile.assigned_class_name || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (names.length > 0) {
        names.forEach((n: string) => addClassRef(profile.assigned_class_id, n));
      } else {
        addClassRef(profile.assigned_class_id, null);
      }
    }

    try {
      const { data: mainClassRows } = await executeWithPrivilegedFallback(
        async (sb) => await sb.from('classes').select('id, name').eq('main_teacher_id', profileId),
        teacherScopeCtx
      );
      (mainClassRows || []).forEach((c: any) => addClassRef(c.id, c.name));
    } catch {
      // noop
    }
  }
  const assignedClassIds = Array.from(classIdSet);

  // 4. Assemble effective roles[]
  const effectiveRoleSet = new Set<UserRole>(dbRoles);
  if (!hasUserRolesTable || effectiveRoleSet.size === 0) {
    if (profilePrimaryRole !== 'GUEST') {
      effectiveRoleSet.add(profilePrimaryRole);
    }
    if (linkedStudentIds.length > 0) {
      effectiveRoleSet.add('PARENT');
    }
    if (assignedClassIds.length > 0) {
      effectiveRoleSet.add('TEACHER');
    }
  }

  const roles = sortRolesByPriority(effectiveRoleSet);
  const approvalStatus =
    (profile.approval_status as 'PENDING' | 'ACTIVE' | 'REJECTED') || 'ACTIVE';

  let activeRole: UserRole = roles[0] || 'GUEST';
  let activeRoleInvalid = false;

  if (claimedActiveRole && claimedActiveRole !== 'GUEST') {
    if (roles.includes(claimedActiveRole)) {
      activeRole = claimedActiveRole;
    } else {
      activeRole = claimedActiveRole;
      activeRoleInvalid = true;
    }
  }

  return {
    profileId,
    authUserId: profile.auth_user_id || null,
    email,
    fullName: profile.full_name || email.split('@')[0],
    avatarUrl: profile.avatar_url || undefined,
    approvalStatus,
    primaryRole: roles[0] || profilePrimaryRole,
    roles,
    activeRole,
    activeRoleInvalid,
    assignedClassIds,
    linkedStudentIds,
    linkedStudents,
    supabaseAccessToken: cleanCallerToken,
  };
}

/**
 * Extracts and verifies the authenticated session context from either:
 * 1) HMAC-SHA256 signed session & active_role cookies, OR
 * 2) Supabase Bearer JWT in Authorization header.
 */
export async function getSessionContext(request: Request): Promise<{
  ctx: SessionContext | null;
  tamperedCookie?: boolean;
}> {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  // Path A: Signed cookies (primary browser/PWA auth mechanism)
  const rawSessionCookie = cookies[COOKIE_NAMES.SESSION];
  const rawEmailCookie = cookies[COOKIE_NAMES.EMAIL];
  const rawActiveRoleCookie = cookies[COOKIE_NAMES.ACTIVE_ROLE];

  let email: string | null = null;
  let claimedActiveRole: UserRole | null = null;
  let supabaseAccessToken: string | null = null;

  if (rawSessionCookie && rawEmailCookie) {
    const [verifiedSession, verifiedEmail] = await Promise.all([
      verifyAndExtractCookieValue(rawSessionCookie),
      verifyAndExtractCookieValue(rawEmailCookie),
    ]);

    if (!verifiedSession || !verifiedEmail) {
      return { ctx: null, tamperedCookie: true };
    }

    email = verifiedEmail.toLowerCase().trim();

    if (rawActiveRoleCookie) {
      const verifiedActive = await verifyAndExtractCookieValue(rawActiveRoleCookie);
      if (!verifiedActive) {
        return { ctx: null, tamperedCookie: true };
      }
      claimedActiveRole = normalizeRole(verifiedActive);
    }

    const cookieTokens = await extractSupabaseTokensFromCookies(cookies);
    supabaseAccessToken =
      cookieTokens.accessToken ||
      (bearerToken && !isJwtExpired(bearerToken) ? bearerToken : null);
  } else if (bearerToken) {
    // Path B: Bearer JWT fallback (automated tests / Supabase SDK calls)
    const sb = getSupabaseAdminClient();
    const { data, error } = await sb.auth.getUser(bearerToken);
    if (!error && data?.user?.email) {
      email = data.user.email.toLowerCase().trim();
      supabaseAccessToken = bearerToken;
      const jwtActive =
        (data.user.app_metadata as any)?.active_role ||
        (data.user.user_metadata as any)?.active_role;
      if (jwtActive) {
        claimedActiveRole = normalizeRole(jwtActive);
      }
    }
  }

  if (!email) {
    return { ctx: null };
  }

  const ctx = await resolveProfileAndRolesByEmail(email, claimedActiveRole, supabaseAccessToken);
  return { ctx };
}

export async function requireAuth(
  request: Request
): Promise<{ ctx: SessionContext } | { response: NextResponse }> {
  const { ctx, tamperedCookie } = await getSessionContext(request);
  if (!ctx) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: tamperedCookie ? 'INVALID_SESSION_SIGNATURE' : 'UNAUTHORIZED',
          message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
        },
        { status: 401, headers: NO_CACHE_HEADERS }
      ),
    };
  }
  return { ctx };
}

/**
 * Enforces Layer-1 active_role authorization.
 * - Rejects pending/rejected users with 403.
 * - Rejects users whose active_role cookie does not exist in user_roles with 403.
 * - Rejects cross-role API calls (e.g., active_role = 'PARENT' hitting /api/teacher/*) with 403 Forbidden.
 */
export async function requireActiveRole(
  request: Request,
  allowedActiveRoles: UserRole[]
): Promise<{ ctx: SessionContext } | { response: NextResponse }> {
  const authResult = await requireAuth(request);
  if ('response' in authResult) {
    return authResult;
  }
  const { ctx } = authResult;

  if (ctx.approvalStatus !== 'ACTIVE') {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: 'ACCOUNT_NOT_ACTIVE',
          message: 'Tài khoản chưa được Ban Giám Hiệu kích hoạt.',
          approval_status: ctx.approvalStatus,
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      ),
    };
  }

  const normalizedAllowed = allowedActiveRoles.map(normalizeRole);

  if (
    ctx.activeRoleInvalid ||
    !ctx.roles.includes(ctx.activeRole) ||
    !normalizedAllowed.includes(ctx.activeRole)
  ) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_ACTIVE_ROLE',
          message: `Vai trò đang hoạt động (${ctx.activeRole}) không có quyền thực hiện thao tác này.`,
          active_role: ctx.activeRole,
          held_roles: ctx.roles,
          required_roles: normalizedAllowed,
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      ),
    };
  }

  return { ctx };
}

export function isAdminRole(role: UserRole): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'SCHOOL_ADMIN';
}

export function assertTeacherClassAccess(
  ctx: SessionContext,
  classId: string | null | undefined
): NextResponse | null {
  if (isAdminRole(ctx.activeRole)) return null;
  if (ctx.activeRole !== 'TEACHER') {
    return NextResponse.json(
      {
        success: false,
        error: 'FORBIDDEN_ACTIVE_ROLE',
        message: 'Chỉ chế độ Giáo viên mới được thao tác dữ liệu lớp.',
      },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  if (!classId || !ctx.assignedClassIds.includes(classId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'FORBIDDEN_CLASS_SCOPE',
        message: 'Bạn không được phân công phụ trách lớp học này.',
      },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  return null;
}

export async function assertTeacherStudentAccess(
  ctx: SessionContext,
  studentIds: string[]
): Promise<NextResponse | null> {
  if (isAdminRole(ctx.activeRole)) return null;
  if (ctx.activeRole !== 'TEACHER') {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN_ACTIVE_ROLE', message: 'Chế độ hiện tại không phải Giáo viên.' },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  if (studentIds.length === 0) return null;

  const { data: students } = await executeWithContextFallback(
    ctx,
    async (sb) => await sb.from('students').select('id, class_id').in('id', studentIds)
  );

  if (!students || students.length !== studentIds.length) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN_STUDENT_SCOPE', message: 'Không tìm thấy học sinh trong phạm vi lớp phụ trách.' },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  const unauthorized = students.some(
    (s: any) => !s.class_id || !ctx.assignedClassIds.includes(s.class_id)
  );
  if (unauthorized) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN_STUDENT_SCOPE', message: 'Học sinh không thuộc lớp giáo viên đang phụ trách.' },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  return null;
}

export function assertParentStudentAccess(
  ctx: SessionContext,
  studentIds: string[]
): NextResponse | null {
  if (isAdminRole(ctx.activeRole)) return null;
  if (ctx.activeRole !== 'PARENT') {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN_ACTIVE_ROLE', message: 'Chế độ hiện tại không phải Phụ huynh.' },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  if (studentIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN_STUDENT_SCOPE', message: 'Thiếu thông tin học sinh liên kết.' },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  const unauthorized = studentIds.some((sid) => !ctx.linkedStudentIds.includes(sid));
  if (unauthorized) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN_STUDENT_SCOPE', message: 'Không có quyền truy cập hồ sơ học sinh này.' },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  return null;
}

/**
 * Returns an RLS-enforced Supabase client scoped to the caller's verified activeRole
 * when SUPABASE_JWT_SECRET is available, otherwise returns null so caller uses verified admin client.
 */
export async function getScopedDbClient(ctx: SessionContext) {
  return getSupabaseRlsScopedClient({
    profileId: ctx.profileId,
    authUserId: ctx.authUserId,
    email: ctx.email,
    activeRole: ctx.activeRole,
    roles: ctx.roles,
  });
}

/**
 * Executes a DB callback using Service Role if valid, otherwise falls back to
 * an authenticated HS256 JWT scoped to the verified SessionContext before anon.
 */
export async function executeWithContextFallback<T>(
  ctx: SessionContext,
  fn: Parameters<typeof executeWithPrivilegedFallback<T>>[0]
): Promise<{ data: T; error: any }> {
  return executeWithPrivilegedFallback<T>(fn, {
    profileId: ctx.profileId,
    authUserId: ctx.authUserId,
    email: ctx.email,
    activeRole: ctx.activeRole,
    roles: ctx.roles,
    supabaseAccessToken: ctx.supabaseAccessToken || null,
  });
}
