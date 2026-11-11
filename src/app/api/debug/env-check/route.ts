import { NextResponse } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const config = getSupabaseConfig();

  const validAnon = getValidKey([
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ]);

  return NextResponse.json({
    url: config.url,
    anonKey: {
      present: !!validAnon,
      length: validAnon.length,
      prefix: validAnon ? validAnon.substring(0, 15) + '...' : 'EMPTY',
      raw_NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15) + '...' : 'NONE',
      raw_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.substring(0, 15) + '...' : 'NONE',
    },
    serviceRoleKey: {
      present: !!config.rawServiceRoleKey,
      valid: config.isValidServiceRoleKey,
      kind: config.serviceRoleKeyKind,
      length: config.rawServiceRoleKey.length,
      prefix: config.rawServiceRoleKey ? config.rawServiceRoleKey.substring(0, 15) + '...' : 'EMPTY',
    },
    jwtSecretPresent: !!config.jwtSecret,
  });
}
