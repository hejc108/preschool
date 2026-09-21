import { NextResponse } from 'next/server';

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const rawService = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
  const cleanAnon = rawAnon.trim().replace(/^["']|["']$/g, '');
  const cleanService = rawService.trim().replace(/^["']|["']$/g, '');

  return NextResponse.json({
    url: cleanUrl,
    anonKey: {
      present: !!rawAnon,
      length: cleanAnon.length,
      prefix: cleanAnon ? cleanAnon.substring(0, 15) + '...' : 'EMPTY',
      hasQuotes: rawAnon.startsWith('"') || rawAnon.startsWith("'") || rawAnon.endsWith('"') || rawAnon.endsWith("'"),
      hasWhitespace: rawAnon !== rawAnon.trim(),
    },
    serviceRoleKey: {
      present: !!rawService,
      length: cleanService.length,
      prefix: cleanService ? cleanService.substring(0, 15) + '...' : 'EMPTY',
      hasQuotes: rawService.startsWith('"') || rawService.startsWith("'") || rawService.endsWith('"') || rawService.endsWith("'"),
    }
  });
}
