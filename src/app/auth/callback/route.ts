import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkUserApprovalStatus, registerGoogleUserIfMissing } from '@/lib/utils/approvalHelper';
import { setSignedCookie, parseSignedCookieClient } from '@/lib/utils/cookieSigner';

const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaWV1YW1pYnFqeWFzbHByZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTQxNTAsImV4cCI6MjEwNDYzMDE1MH0.q8OQ1wDnsTWCniXmHXjzLAQ_q-k0VrjX99kSK_TYAEw';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidUuid(candidate?: string): string {
  if (candidate && UUID_REGEX.test(candidate)) return candidate;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
}

function getSupabaseAdminClient(preferAnon = false) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const url = rawUrl.trim().replace(/^["']|["']$/g, '');
  const rawKey = preferAnon
    ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
       process.env.SUPABASE_ANON_KEY ||
       FALLBACK_ANON_KEY)
    : (process.env.SUPABASE_SERVICE_ROLE_KEY ||
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
       process.env.SUPABASE_ANON_KEY ||
       FALLBACK_ANON_KEY);
  const key = rawKey.trim().replace(/^["']|["']$/g, '') || FALLBACK_ANON_KEY;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getValidKey(keys: (string | undefined)[]) {
  for (const raw of keys) {
    if (!raw) continue;
    const clean = raw.trim().replace(/^["']|["']$/g, '');
    if (clean && !clean.includes('your-production') && !clean.includes('mock-key')) {
      return clean;
    }
  }
  return '';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error_description') || searchParams.get('error');

  // 0. If OAuth provider returned an explicit error (e.g. access_denied)
  if (oauthError && !code) {
    console.error('[AUTH CALLBACK OAUTH ERROR FROM PROVIDER]:', oauthError);
    const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(oauthError)}`);
    response.cookies.delete('suongmai_session');
    return response;
  }

  let userEmail = searchParams.get('email') || '';
  let fullName = '';
  let avatarUrl = '';
  let userId = '';

  if (!userEmail) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/suongmai_user_email=([^;]+)/);
    if (match) {
      userEmail = parseSignedCookieClient(match[1]);
    }
  }

  if (code) {
    const cookieStore = cookies();
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
    const url = rawUrl.trim().replace(/^["']|["']$/g, '');

    const anonKey =
      getValidKey([
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        process.env.SUPABASE_ANON_KEY,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        process.env.SUPABASE_PUBLISHABLE_KEY,
      ]) || FALLBACK_ANON_KEY;

    const supabaseSsr = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
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
        response.cookies.delete('suongmai_session');
        return response;
      }

      if (data.user?.email) {
        userEmail = data.user.email;
        userId = data.user.id;
        fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
        avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '';
      } else {
        console.error('[AUTH CALLBACK ERROR] exchangeCodeForSession succeeded but no user email returned');
        const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent('Không lấy được email từ tài khoản Google')}`);
        response.cookies.delete('suongmai_session');
        return response;
      }
    } catch (e: any) {
      console.error('[AUTH CALLBACK OAUTH EXCEPTION]:', e);
      const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(e.message || 'Lỗi hệ thống khi xác thực OAuth')}`);
      response.cookies.delete('suongmai_session');
      return response;
    }
  }

  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();
    const resolvedName = fullName || cleanEmail.split('@')[0];
    const resolvedAvatar = avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    let dbProfileSaved: any = null;

    // 1. Upsert into profiles DB with automatic fallback to Anon Key if Service Role Key is invalid
    try {
      let supabaseAdmin = getSupabaseAdminClient(false);
      
      let { data: existingDbProfile, error: findErr } = await supabaseAdmin
        .from('profiles')
        .select('id, role, approval_status, assigned_class_id, assigned_class_name, phone, is_temporary')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (findErr && (findErr.message?.includes('Invalid API key') || findErr.message?.includes('JWT'))) {
        supabaseAdmin = getSupabaseAdminClient(true);
        const retry = await supabaseAdmin
          .from('profiles')
          .select('id, role, approval_status, assigned_class_id, assigned_class_name, phone, is_temporary')
          .eq('email', cleanEmail)
          .maybeSingle();
        existingDbProfile = retry.data;
      }

      const isSuper = cleanEmail === 'sadmin@suongmai.edu.vn';
      const isPrincipal = cleanEmail === 'luciaxuan178@gmail.com';
      const resolvedExistingRole =
        isPrincipal && existingDbProfile?.role === 'SUPER_ADMIN'
          ? 'SCHOOL_ADMIN'
          : existingDbProfile?.role;
      const profilePayload: any = {
        id: ensureValidUuid(existingDbProfile?.id || userId),
        email: cleanEmail,
        full_name: resolvedName,
        avatar_url: resolvedAvatar,
        role: resolvedExistingRole || (isSuper ? 'SUPER_ADMIN' : isPrincipal ? 'SCHOOL_ADMIN' : 'GUEST'),
        approval_status: existingDbProfile ? existingDbProfile.approval_status : (isSuper || isPrincipal ? 'ACTIVE' : 'PENDING'),
        updated_at: new Date().toISOString(),
      };

      if (existingDbProfile?.assigned_class_name) {
        profilePayload.assigned_class_name = existingDbProfile.assigned_class_name;
      }
      if (existingDbProfile?.assigned_class_id) {
        profilePayload.assigned_class_id = existingDbProfile.assigned_class_id;
      }
      if (existingDbProfile?.phone) {
        profilePayload.phone = existingDbProfile.phone;
      }
      if (existingDbProfile?.is_temporary !== undefined) {
        profilePayload.is_temporary = existingDbProfile.is_temporary;
      }

      let { data: upsertData, error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'email' })
        .select();

      if (upsertErr && (upsertErr.message?.includes('Invalid API key') || upsertErr.message?.includes('JWT'))) {
        supabaseAdmin = getSupabaseAdminClient(true);
        const retryUpsert = await supabaseAdmin
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'email' })
          .select();
        upsertData = retryUpsert.data;
        upsertErr = retryUpsert.error;
      }

      if (upsertErr || !upsertData || upsertData.length === 0) {
        console.error('[AUTH CALLBACK ERROR] Ghi dữ liệu profile vào Supabase DB thất bại:', upsertErr);
      } else {
        dbProfileSaved = upsertData[0];
        console.log('[AUTH CALLBACK SUCCESS] Ghi/Cập nhật profile vào Supabase DB thành công:', upsertData[0]);
      }
    } catch (adminErr: any) {
      console.error('[AUTH CALLBACK EXCEPTION] Supabase Admin Client Exception:', adminErr.message || adminErr);
    }

    // 2. Also register in local server memory cache
    registerGoogleUserIfMissing(cleanEmail, resolvedName, resolvedAvatar);

    // 3. Fetch live profile status to determine redirect
    let liveProfile: any = dbProfileSaved;
    if (!liveProfile && typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_PROFILES_CACHE__) {
      liveProfile = globalThis.__SUONGMAI_PROFILES_CACHE__.find((p) => p.email.toLowerCase().trim() === cleanEmail);
    }

    const status = checkUserApprovalStatus(cleanEmail);
    const isApproved = liveProfile?.approval_status === 'ACTIVE' || status.approvalStatus === 'ACTIVE';
    const resolvedRole = liveProfile?.role || status.profile?.role || 'PARENT';

    const nextParam = searchParams.get('next') || searchParams.get('returnUrl');

    if (isApproved) {
      let targetUrl = '/parent';
      const hasChildren = status.isParentVerified || (status.linkedStudents && status.linkedStudents.length > 0);

      if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(resolvedRole)) {
        targetUrl = nextParam && nextParam.startsWith('/') ? nextParam : '/admin/dashboard';
      } else if (resolvedRole === 'TEACHER') {
        if (nextParam && nextParam.startsWith('/parent') && hasChildren) {
          targetUrl = nextParam;
        } else if (nextParam && nextParam.startsWith('/teacher')) {
          targetUrl = nextParam;
        } else {
          targetUrl = '/teacher';
        }
      } else if (resolvedRole === 'PARENT') {
        if (nextParam && nextParam.startsWith('/parent')) {
          targetUrl = nextParam;
        } else if (nextParam && nextParam.startsWith('/teacher')) {
          targetUrl = '/parent?warning=wrong_role';
        } else {
          targetUrl = '/parent';
        }
      } else if (resolvedRole === 'KITCHEN_STAFF') {
        targetUrl = '/admin/menu';
      } else if (resolvedRole === 'NURSE_STAFF') {
        targetUrl = '/admin/health';
      }

      const response = NextResponse.redirect(`${origin}${targetUrl}`);
      await setSignedCookie(response, 'suongmai_session', 'active', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, 'suongmai_user_email', cleanEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, 'suongmai_user_role', resolvedRole, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      if (hasChildren) {
        await setSignedCookie(response, 'suongmai_has_children', 'true', {
          path: '/',
          maxAge: 86400,
          sameSite: 'lax',
        });
      } else {
        response.cookies.delete('suongmai_has_children');
      }
      return response;
    } else {
      // Pending user: Redirect to /auth/pending-approval
      const pendingRedirect = `${origin}/auth/pending-approval?type=${status.pendingType || 'unknown'}&email=${encodeURIComponent(cleanEmail)}`;
      const response = NextResponse.redirect(pendingRedirect);
      response.cookies.delete('suongmai_session');
      await setSignedCookie(response, 'suongmai_user_email', cleanEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      await setSignedCookie(response, 'suongmai_user_role', 'GUEST', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      return response;
    }
  }

  // Fallback if no user email could be identified: redirect with explicit error parameter
  console.error('[AUTH CALLBACK ERROR] Không thể xác định email người dùng');
  const response = NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent('Không thể xác thực thông tin đăng nhập từ Google. Vui lòng thử lại.')}`);
  response.cookies.delete('suongmai_session');
  return response;
}
