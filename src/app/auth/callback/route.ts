import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserApprovalStatus, registerGoogleUserIfMissing } from '@/lib/utils/approvalHelper';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  let userEmail = searchParams.get('email') || '';
  let fullName = '';
  let avatarUrl = '';

  if (code) {
    const supabaseUrl = 
      process.env.NEXT_PUBLIC_SUPABASE_URL || 
      process.env.SUPABASE_URL || 
      'https://yrieuamibqjyaslprdeo.supabase.co';
    const supabaseAnonKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
      process.env.SUPABASE_PUBLISHABLE_KEY || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key';

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.user?.email) {
          userEmail = data.user.email;
          fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
          avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || '';
        } else if (error) {
          console.error('OAuth code exchange error from Supabase:', error.message);
        }
      } catch (e) {
        console.warn('OAuth code exchange exception:', e);
      }
    }
  }

  // Process extracted email or redirect to login failure
  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();

    // Register or upsert profile directly into Supabase PostgreSQL DB
    registerGoogleUserIfMissing(cleanEmail, fullName, avatarUrl);

    // Fetch live profile status from global cache or Supabase DB
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
      // Pending or new user: Register profile as PENDING DB record, delete active session, redirect to pending page
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
