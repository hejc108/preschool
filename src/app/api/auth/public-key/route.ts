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
  const url = rawUrl.trim().replace(/^["']|["']$/g, '');

  const anonKey = getValidKey([
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ]);

  return NextResponse.json({ url, anonKey });
}
