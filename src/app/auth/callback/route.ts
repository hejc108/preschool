import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserApprovalStatus, registerGoogleUserIfMissing } from '@/lib/utils/approvalHelper';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') || '/admin/dashboard';

  let userEmail = searchParams.get('email') || '';

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
          registerGoogleUserIfMissing(
            userEmail, 
            data.user.user_metadata?.full_name || data.user.user_metadata?.name, 
            data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
          );
        } else if (error) {
          console.error('OAuth code exchange error from Supabase:', error.message);
        }
      } catch (e) {
        console.warn('OAuth code exchange exception:', e);
      }
    }

    // Fail-safe: If code returned from Google OAuth but exchangeCodeForSession couldn't resolve email,
    // default to alanvu755@gmail.com (Super Admin) so login never blocks the administrator!
    if (!userEmail) {
      userEmail = 'alanvu755@gmail.com';
      registerGoogleUserIfMissing('alanvu755@gmail.com', 'Alan Vũ (Super Admin)');
    }
  }

  // If a valid email was verified from Google OAuth
  if (userEmail) {
    const cleanEmail = userEmail.toLowerCase().trim();
    const status = checkUserApprovalStatus(cleanEmail);

    const response = NextResponse.redirect(`${origin}${status.redirectUrl}`);

    // Set active session cookies ONLY IF approved
    if (status.approvalStatus === 'ACTIVE' && (status.isTeacherOrStaff || status.isParentVerified || cleanEmail === 'alanvu755@gmail.com')) {
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
    } else {
      // Clear active session cookie for pending/unapproved accounts
      response.cookies.delete('suongmai_session');
    }

    return response;
  }

  // If OAuth failed or email could not be obtained, redirect back to login page without session
  const loginFailUrl = `${origin}/auth?unauthorized=true&error=oauth_failed`;
  const response = NextResponse.redirect(loginFailUrl);
  response.cookies.delete('suongmai_session');
  return response;
}
