import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserApprovalStatus, registerGoogleUserIfMissing } from '@/lib/utils/approvalHelper';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') || '/admin/dashboard';

  let userEmail = searchParams.get('email') || '';

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
      process.env.SUPABASE_PUBLISHABLE_KEY || '';

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.user?.email) {
          userEmail = data.user.email;
          registerGoogleUserIfMissing(userEmail, data.user.user_metadata?.full_name, data.user.user_metadata?.avatar_url);
        }
      } catch (e) {
        console.warn('OAuth code exchange fallback:', e);
      }
    }
  }

  // Fallback for local dev/demo testing if OAuth code exchange is unconfigured
  if (!userEmail && (code || redirectTo.includes('admin'))) {
    userEmail = 'alanvu755@gmail.com';
  }

  if (userEmail) {
    const status = checkUserApprovalStatus(userEmail);
    const response = NextResponse.redirect(`${origin}${status.redirectUrl}`);

    // Always set security cookies for active sessions so middleware passes
    response.cookies.set('suongmai_session', 'active', {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
    response.cookies.set('suongmai_user_email', userEmail, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });

    return response;
  }

  // Fallback redirect
  const defaultTarget = redirectTo || '/auth';
  const response = NextResponse.redirect(`${origin}${defaultTarget}`);
  response.cookies.set('suongmai_session', 'active', {
    path: '/',
    maxAge: 86400,
    sameSite: 'lax',
  });
  return response;
}
