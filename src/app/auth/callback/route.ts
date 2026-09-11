import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') || '/admin/dashboard';

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
      process.env.SUPABASE_PUBLISHABLE_KEY || '';

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Fallbackredirect về trang auth nếu không có code hoặc lỗi
  return NextResponse.redirect(`${origin}${redirectTo}`);
}
