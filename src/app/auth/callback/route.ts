import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserApprovalStatus, registerGoogleUserIfMissing } from '@/lib/utils/approvalHelper';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo');

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
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user?.email) {
        userEmail = data.user.email;
        registerGoogleUserIfMissing(userEmail, data.user.user_metadata?.full_name, data.user.user_metadata?.avatar_url);
      }
    }
  }

  if (userEmail) {
    const status = checkUserApprovalStatus(userEmail);
    const response = NextResponse.redirect(`${origin}${status.redirectUrl}`);

    // If approved, set security cookie & store user state
    if (status.approvalStatus === 'ACTIVE' && (status.isTeacherOrStaff || status.isParentVerified)) {
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
    }

    return response;
  }

  // Fallback redirect to default route or /auth
  const defaultTarget = redirectTo || '/auth';
  return NextResponse.redirect(`${origin}${defaultTarget}`);
}
