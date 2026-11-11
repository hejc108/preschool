import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  COOKIE_NAMES,
  setSignedCookie,
  verifyAndExtractCookieValue,
} from '@/lib/utils/cookieSigner';
import {
  normalizeRole,
  parseCookieHeader,
  resolveProfileAndRolesByEmail,
} from '@/lib/auth/sessionContext';
import {
  AuthDbContext,
  executeWithPrivilegedFallback,
  getSupabaseConfig,
} from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidUuid(candidate?: string): string {
  if (candidate && UUID_REGEX.test(candidate)) return candidate;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error_description') || searchParams.get('error');
  const isHttps = request.url.startsWith('https://');

  // 0. If OAuth provider returned an explicit error (e.g. access_denied)
  if (oauthError && !code) {
    console.error('[AUTH CALLBACK OAUTH ERROR FROM PROVIDER]:', oauthError);
    const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(oauthError)}`);
    response.cookies.delete(COOKIE_NAMES.SESSION);
    return response;
  }

  let userEmail = '';
  let fullName = '';
  let avatarUrl = '';
  let userId = '';
  let sbAccessToken = '';
  let sbRefreshToken = '';
  const pendingSsrCookies: Array<{ name: string; value: string; options?: any }> = [];

  const rawCookies = parseCookieHeader(request.headers.get('cookie'));
  if (!code && rawCookies[COOKIE_NAMES.EMAIL]) {
    userEmail = (await verifyAndExtractCookieValue(rawCookies[COOKIE_NAMES.EMAIL])) || '';
  }

  if (code) {
    const cookieStore = cookies();
    const { url, anonKey } = getSupabaseConfig();

    const supabaseSsr = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          pendingSsrCookies.push(...cookiesToSet);
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component or Route Handler context
          }
        },
      },
    });

    try {
      const { data, error } = await supabaseSsr.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[EXCHANGE_CODE_ERROR]:', error.message, error.status);
        let errMsg = error.message;
        if (errMsg.includes('Invalid API key')) {
          errMsg = 'Khóa SUPABASE_ANON_KEY trên Vercel không trùng khớp với Supabase (Invalid API key). Vui lòng copy chính xác key "anon public" từ Supabase Dashboard -> API Settings và cập nhật lại biến SUPABASE_ANON_KEY trên Vercel.';
        }
        const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(errMsg)}`);
        response.cookies.delete(COOKIE_NAMES.SESSION);
        return response;
      }

      if (data.user?.email) {
        userEmail = data.user.email;
        userId = data.user.id;
        sbAccessToken = data.session?.access_token || '';
        sbRefreshToken = data.session?.refresh_token || '';
        fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
        avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '';
      } else {
        console.error('[AUTH CALLBACK ERROR] exchangeCodeForSession succeeded but no user email returned');
        const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent('Không lấy được email từ tài khoản Google')}`);
        response.cookies.delete(COOKIE_NAMES.SESSION);
        return response;
      }
    } catch (e: any) {
      console.error('[AUTH CALLBACK OAUTH EXCEPTION]:', e);
      const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(e.message || 'Lỗi hệ thống khi xác thực OAuth')}`);
      response.cookies.delete(COOKIE_NAMES.SESSION);
      return response;
    }
  }

  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();
    const resolvedName = fullName || cleanEmail.split('@')[0];
    const resolvedAvatar = avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
    const callbackAuthCtx: AuthDbContext = {
      profileId: '',
      authUserId: userId && UUID_REGEX.test(userId) ? userId : null,
      email: cleanEmail,
      activeRole: 'GUEST',
      roles: [],
      supabaseAccessToken: sbAccessToken || null,
    };

    let dbProfileSaved: any = null;

    // 1. Kiểm tra xem hồ sơ đã tồn tại trong profiles DB chưa (TUYỆT ĐỐI KHÔNG upsert đè role và approval_status)
    try {
      const { data: existingDbProfile } = await executeWithPrivilegedFallback(
        async (sb) =>
          await sb.from('profiles').select('*').ilike('email', cleanEmail).maybeSingle(),
        callbackAuthCtx
      );

      const isSuper = cleanEmail === 'sadmin@suongmai.edu.vn';
      const isPrincipal = cleanEmail === 'luciaxuan178@gmail.com';

      if (existingDbProfile) {
        // NẾU ĐÃ TỒN TẠI: TUYỆT ĐỐI GIỮ NGUYÊN role VÀ approval_status HIỆN TẠI TRONG DATABASE!
        console.log('[AUTH CALLBACK] Hồ sơ đã tồn tại trong DB, bảo lưu nguyên vẹn vai trò:', {
          email: existingDbProfile.email,
          role: existingDbProfile.role,
          status: existingDbProfile.approval_status
        });
        dbProfileSaved = existingDbProfile;

        const scopedProfileCtx: AuthDbContext = {
          ...callbackAuthCtx,
          profileId: existingDbProfile.id,
          activeRole: normalizeRole(existingDbProfile.role),
          roles: [normalizeRole(existingDbProfile.role)],
        };

        // Chỉ cập nhật avatar, tên mới hoặc auth_user_id (KHÔNG ĐỤNG ĐẾN ROLE HAY STATUS)
        const updateFields: any = {};
        if (userId && UUID_REGEX.test(userId) && existingDbProfile.auth_user_id !== userId) {
          updateFields.auth_user_id = userId;
        }
        if (resolvedName && (!existingDbProfile.full_name || existingDbProfile.full_name === cleanEmail.split('@')[0])) {
          updateFields.full_name = resolvedName;
        }
        if (avatarUrl && !existingDbProfile.avatar_url) {
          updateFields.avatar_url = avatarUrl;
        }
        if (Object.keys(updateFields).length > 0) {
          updateFields.updated_at = new Date().toISOString();
          const { error: upErr } = await executeWithPrivilegedFallback(
            async (sb) =>
              await sb.from('profiles').update(updateFields).eq('id', existingDbProfile.id),
            scopedProfileCtx
          );
          if (upErr && upErr.message?.includes('auth_user_id')) {
            delete updateFields.auth_user_id;
            if (Object.keys(updateFields).length > 1) {
              await executeWithPrivilegedFallback(
                async (sb) =>
                  await sb.from('profiles').update(updateFields).eq('id', existingDbProfile.id),
                scopedProfileCtx
              );
            }
          }
          dbProfileSaved = { ...existingDbProfile, ...updateFields };
        }
      } else {
        // CHỈ TẠO MỚI NẾU LÀ LẦN ĐẦU TIÊN ĐĂNG NHẬP VỚI PENDING (Hoặc ACTIVE nếu là sadmin/Hiệu trưởng)
        console.log('[AUTH CALLBACK] Tài khoản đăng nhập lần đầu tiên, tạo hồ sơ PENDING mới:', cleanEmail);
        const initialRole = isSuper ? 'SUPER_ADMIN' : isPrincipal ? 'SCHOOL_ADMIN' : 'GUEST';
        const initialStatus = isSuper || isPrincipal ? 'ACTIVE' : 'PENDING';
        const validUid = ensureValidUuid(userId);
        const newRecord: any = {
          id: validUid,
          auth_user_id: userId && UUID_REGEX.test(userId) ? userId : validUid,
          email: cleanEmail,
          full_name: resolvedName,
          avatar_url: resolvedAvatar,
          role: initialRole,
          approval_status: initialStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        let { data: insData, error: insErr } = await executeWithPrivilegedFallback(
          async (sb) => await sb.from('profiles').insert(newRecord).select().maybeSingle(),
          callbackAuthCtx
        );

        if (insErr && insErr.message?.includes('auth_user_id')) {
          delete newRecord.auth_user_id;
          const retry = await executeWithPrivilegedFallback(
            async (sb) => await sb.from('profiles').insert(newRecord).select().maybeSingle(),
            callbackAuthCtx
          );
          insData = retry.data;
          insErr = retry.error;
        }

        if (insErr) {
          console.error('[AUTH CALLBACK INSERT ERROR]:', insErr.message);
          dbProfileSaved = newRecord;
        } else {
          dbProfileSaved = insData || newRecord;
        }

        if (dbProfileSaved?.id && (initialRole === 'SUPER_ADMIN' || initialRole === 'SCHOOL_ADMIN')) {
          try {
            await executeWithPrivilegedFallback(
              async (sb) =>
                await sb
                  .from('user_roles')
                  .upsert({ user_id: dbProfileSaved.id, role_name: initialRole }, { onConflict: 'user_id,role_name' }),
              {
                ...callbackAuthCtx,
                profileId: dbProfileSaved.id,
                activeRole: initialRole,
                roles: [initialRole],
              }
            );
          } catch {}
        }
      }
    } catch (adminErr: any) {
      console.error('[AUTH CALLBACK EXCEPTION] Supabase Admin Client Exception:', adminErr.message || adminErr);
    }

    // 2. Cập nhật đồng bộ vào bộ nhớ tạm server (nếu có)
    if (dbProfileSaved && typeof globalThis !== 'undefined') {
      if (!globalThis.__SUONGMAI_PROFILES_CACHE__) {
        globalThis.__SUONGMAI_PROFILES_CACHE__ = [];
      }
      const cIdx = globalThis.__SUONGMAI_PROFILES_CACHE__.findIndex(
        (p) => p.email.toLowerCase().trim() === cleanEmail
      );
      if (cIdx !== -1) {
        globalThis.__SUONGMAI_PROFILES_CACHE__[cIdx] = {
          ...globalThis.__SUONGMAI_PROFILES_CACHE__[cIdx],
          ...dbProfileSaved,
        };
      } else {
        globalThis.__SUONGMAI_PROFILES_CACHE__.push(dbProfileSaved);
      }
    }

    // 3. Phân quyền đa vai trò dựa trên CSDL Supabase
    const previousSignedActive = rawCookies[COOKIE_NAMES.ACTIVE_ROLE]
      ? await verifyAndExtractCookieValue(rawCookies[COOKIE_NAMES.ACTIVE_ROLE])
      : null;
    const requestedCookieRole = previousSignedActive ? normalizeRole(previousSignedActive) : null;

    const sessionCtx = await resolveProfileAndRolesByEmail(
      cleanEmail,
      requestedCookieRole,
      sbAccessToken || null
    );
    const liveProfile: any = dbProfileSaved;
    const isSuper = cleanEmail === 'sadmin@suongmai.edu.vn';
    const isApproved =
      isSuper ||
      sessionCtx?.approvalStatus === 'ACTIVE' ||
      (liveProfile && liveProfile.approval_status === 'ACTIVE');

    const roles = sessionCtx?.roles?.length
      ? sessionCtx.roles
      : [normalizeRole(liveProfile?.role || 'GUEST')].filter((r) => r !== 'GUEST');
    const resolvedPrimaryRole =
      roles[0] || normalizeRole(liveProfile?.role || (isSuper ? 'SUPER_ADMIN' : 'GUEST'));
    const nextParam = searchParams.get('next') || searchParams.get('returnUrl');

    if (isApproved) {
      let activeRole =
        sessionCtx && !sessionCtx.activeRoleInvalid
          ? sessionCtx.activeRole
          : resolvedPrimaryRole;
      let targetUrl = '/parent';
      const hasChildren = Boolean(sessionCtx?.linkedStudentIds?.length || roles.includes('PARENT'));

      if (nextParam && nextParam.startsWith('/parent') && roles.includes('PARENT')) {
        activeRole = 'PARENT';
        targetUrl = nextParam;
      } else if (nextParam && nextParam.startsWith('/teacher') && roles.includes('TEACHER')) {
        activeRole = 'TEACHER';
        targetUrl = nextParam;
      } else if (activeRole === 'SUPER_ADMIN' || activeRole === 'SCHOOL_ADMIN') {
        targetUrl = nextParam && nextParam.startsWith('/') ? nextParam : '/admin/dashboard';
      } else if (activeRole === 'TEACHER') {
        targetUrl = '/teacher';
      } else if (activeRole === 'PARENT') {
        targetUrl = nextParam && nextParam.startsWith('/teacher') ? '/parent?warning=wrong_role' : '/parent';
      } else if (activeRole === 'STAFF') {
        targetUrl = '/admin/menu';
      }

      const response = NextResponse.redirect(`${origin}${targetUrl}`);
      pendingSsrCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      await setSignedCookie(response, COOKIE_NAMES.SESSION, 'active', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.EMAIL, cleanEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ROLE, resolvedPrimaryRole, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ACTIVE_ROLE, activeRole, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      if (sbAccessToken) {
        await setSignedCookie(response, COOKIE_NAMES.SB_ACCESS_TOKEN, sbAccessToken, {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
          httpOnly: true,
          secure: isHttps,
        });
      }
      if (sbRefreshToken) {
        await setSignedCookie(response, COOKIE_NAMES.SB_REFRESH_TOKEN, sbRefreshToken, {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
          httpOnly: true,
          secure: isHttps,
        });
      }
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
    } else {
      const pendingRedirect = `${origin}/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`;
      const response = NextResponse.redirect(pendingRedirect);
      pendingSsrCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      response.cookies.delete(COOKIE_NAMES.SESSION);
      response.cookies.delete(COOKIE_NAMES.ACTIVE_ROLE);
      await setSignedCookie(response, COOKIE_NAMES.EMAIL, cleanEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, COOKIE_NAMES.ROLE, 'GUEST', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      return response;
    }
  }

  console.error('[AUTH CALLBACK ERROR] Không thể xác định email người dùng');
  const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent('Không thể xác thực thông tin đăng nhập từ Google. Vui lòng thử lại.')}`);
  response.cookies.delete(COOKIE_NAMES.SESSION);
  response.cookies.delete(COOKIE_NAMES.ACTIVE_ROLE);
  return response;
}
