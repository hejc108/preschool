import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserApprovalStatus, registerGoogleUserIfMissing } from '@/lib/utils/approvalHelper';

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('[AUTH CALLBACK ERROR] Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Check .env file!');
    throw new Error('[AUTH CALLBACK ERROR] Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const pubKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key';

  return createClient(url, pubKey);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  let userEmail = searchParams.get('email') || '';
  let fullName = '';
  let avatarUrl = '';
  let userId = '';

  if (!userEmail) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/suongmai_user_email=([^;]+)/);
    if (match) {
      userEmail = decodeURIComponent(match[1]);
    }
  }

  if (code) {
    const supabasePublic = getSupabasePublicClient();
    try {
      const { data, error } = await supabasePublic.auth.exchangeCodeForSession(code);
      if (!error && data.user?.email) {
        userEmail = data.user.email;
        userId = data.user.id;
        fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
        avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '';
      } else if (error) {
        console.error('[AUTH CALLBACK OAUTH ERROR] exchangeCodeForSession failed:', error.message);
      }
    } catch (e) {
      console.warn('[AUTH CALLBACK OAUTH EXCEPTION]:', e);
    }
  }

  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();
    const resolvedName = fullName || cleanEmail.split('@')[0];
    const resolvedAvatar = avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    // 1. Mandatory requirement: Upsert into profiles DB using SUPABASE_SERVICE_ROLE_KEY (NO fallback to anon key)
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const { data: existingDbProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role, approval_status')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingDbProfile) {
        // Profile already exists: Preserve existing role & approval_status, update metadata only
        await supabaseAdmin
          .from('profiles')
          .update({
            full_name: resolvedName,
            avatar_url: resolvedAvatar,
            updated_at: new Date().toISOString(),
          })
          .eq('email', cleanEmail);
      } else {
        // New user: Insert default PENDING profile (or SUPER_ADMIN for sadmin)
        const isSadmin = cleanEmail === 'sadmin@suongmai.edu.vn';
        const { error: insertErr } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId || `u-gauth-${Date.now()}`,
            email: cleanEmail,
            full_name: resolvedName,
            avatar_url: resolvedAvatar,
            role: isSadmin ? 'SUPER_ADMIN' : 'GUEST',
            approval_status: isSadmin ? 'ACTIVE' : 'PENDING',
            created_at: new Date().toISOString(),
          });

        if (insertErr) {
          console.error('[AUTH CALLBACK ERROR] Không ghi được profile mới vào Supabase DB:', insertErr.message);
        }
      }
    } catch (adminErr: any) {
      console.error('[AUTH CALLBACK ERROR] Supabase Admin Client Exception:', adminErr.message || adminErr);
    }

    // 2. Also register in local server memory cache
    registerGoogleUserIfMissing(cleanEmail, resolvedName, resolvedAvatar);

    // 3. Fetch live profile status to determine redirect
    let liveProfile: any = null;
    if (typeof globalThis !== 'undefined' && globalThis.__SUONGMAI_PROFILES_CACHE__) {
      liveProfile = globalThis.__SUONGMAI_PROFILES_CACHE__.find((p) => p.email.toLowerCase().trim() === cleanEmail);
    }

    const status = checkUserApprovalStatus(cleanEmail);
    const isApproved = liveProfile?.approval_status === 'ACTIVE' || status.approvalStatus === 'ACTIVE';
    const resolvedRole = liveProfile?.role || status.profile?.role || 'PARENT';

    if (isApproved) {
      let targetUrl = '/parent';
      if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(resolvedRole)) {
        targetUrl = '/admin/dashboard';
      } else if (resolvedRole === 'TEACHER') {
        targetUrl = '/teacher/lesson-plans/new';
      } else if (resolvedRole === 'PARENT') {
        targetUrl = '/parent';
      } else if (resolvedRole === 'KITCHEN_STAFF') {
        targetUrl = '/admin/menu';
      } else if (resolvedRole === 'NURSE_STAFF') {
        targetUrl = '/admin/health';
      }

      const response = NextResponse.redirect(`${origin}${targetUrl}`);
      response.cookies.set('suongmai_session', 'active', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      response.cookies.set('suongmai_user_email', cleanEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      response.cookies.set('suongmai_user_role', resolvedRole, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      return response;
    } else {
      // Pending user: Redirect to /auth/pending-approval
      const pendingRedirect = `${origin}/auth/pending-approval?type=${status.pendingType || 'unknown'}&email=${encodeURIComponent(cleanEmail)}`;
      const response = NextResponse.redirect(pendingRedirect);
      response.cookies.delete('suongmai_session');
      response.cookies.set('suongmai_user_email', cleanEmail, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      response.cookies.set('suongmai_user_role', 'GUEST', {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      return response;
    }
  }

  // If OAuth code exchange is unavailable or email is missing, redirect to Google Email selector
  const loginFailUrl = `${origin}/auth?selectEmail=true`;
  const response = NextResponse.redirect(loginFailUrl);
  response.cookies.delete('suongmai_session');
  return response;
}
