import { NextResponse } from 'next/server';

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

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yrieuamibqjyaslprdeo.supabase.co';
  const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, '');

  const validAnon = getValidKey([
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ]);

  const rawService = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const cleanService = rawService.trim().replace(/^["']|["']$/g, '');

  return NextResponse.json({
    url: cleanUrl,
    anonKey: {
      present: !!validAnon,
      length: validAnon.length,
      prefix: validAnon ? validAnon.substring(0, 15) + '...' : 'EMPTY',
      raw_NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15) + '...' : 'NONE',
      raw_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 15) + '...' : 'NONE',
    },
    serviceRoleKey: {
      present: !!cleanService,
      length: cleanService.length,
      prefix: cleanService ? cleanService.substring(0, 15) + '...' : 'EMPTY',
    }
  });
}
