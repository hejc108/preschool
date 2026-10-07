import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify authorization header if CRON_SECRET is configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized cron trigger request' },
      { status: 401 }
    );
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!rawUrl || !rawAnonKey) {
    return NextResponse.json({
      success: true,
      mode: 'mock_ping',
      message: 'Supabase credentials not configured in environment variables. Local mock ping acknowledged.',
      timestamp: new Date().toISOString(),
    });
  }

  const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
  const cleanAnonKey = rawAnonKey.trim().replace(/^["']|["']$/g, '');

  try {
    const supabase = createClient(cleanUrl, cleanAnonKey);
    // Lightweight keep-alive query to maintain traffic and prevent automatic project pause
    const { data, error } = await supabase.from('profiles').select('id').limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        mode: 'supabase_ping_error',
        error: error.message,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mode: 'supabase_live_ping',
      message: 'Supabase database pinged successfully to prevent auto-pause.',
      recordCount: data?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      mode: 'ping_exception',
      error: err.message || 'Unknown exception during ping',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
