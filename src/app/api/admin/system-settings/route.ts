import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

declare global {
  var __SUONGMAI_SYSTEM_SETTINGS__: {
    allow_school_admin_view_non_regular: boolean;
    allow_school_admin_view_temporary_staff: boolean;
  } | undefined;
}

if (!globalThis.__SUONGMAI_SYSTEM_SETTINGS__) {
  globalThis.__SUONGMAI_SYSTEM_SETTINGS__ = {
    allow_school_admin_view_non_regular: false,
    allow_school_admin_view_temporary_staff: false,
  };
}

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://yrieuamibqjyaslprdeo.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const settings = { ...globalThis.__SUONGMAI_SYSTEM_SETTINGS__! };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('key, value');

        if (!error && data) {
          data.forEach((row: { key: string; value: any }) => {
            if (row.key === 'allow_school_admin_view_non_regular') {
              settings.allow_school_admin_view_non_regular = Boolean(row.value);
            } else if (row.key === 'allow_school_admin_view_temporary_staff') {
              settings.allow_school_admin_view_temporary_staff = Boolean(row.value);
            }
          });
          globalThis.__SUONGMAI_SYSTEM_SETTINGS__ = { ...settings };
        }
      } catch (dbErr) {
        // Table not created yet; fallback gracefully to cache
      }
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    console.error('GET /api/admin/system-settings error:', err);
    return NextResponse.json(
      {
        success: true,
        settings: globalThis.__SUONGMAI_SYSTEM_SETTINGS__ || {
          allow_school_admin_view_non_regular: false,
          allow_school_admin_view_temporary_staff: false,
        },
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseClient();

    const current = { ...globalThis.__SUONGMAI_SYSTEM_SETTINGS__! };

    // Support single key-value update: { key: '...', value: true/false }
    if (typeof body.key === 'string' && typeof body.value === 'boolean') {
      if (body.key === 'allow_school_admin_view_non_regular') {
        current.allow_school_admin_view_non_regular = body.value;
      } else if (body.key === 'allow_school_admin_view_temporary_staff') {
        current.allow_school_admin_view_temporary_staff = body.value;
      }
    }

    // Support batch update: { allow_school_admin_view_non_regular: true, ... }
    if (typeof body.allow_school_admin_view_non_regular === 'boolean') {
      current.allow_school_admin_view_non_regular = body.allow_school_admin_view_non_regular;
    }
    if (typeof body.allow_school_admin_view_temporary_staff === 'boolean') {
      current.allow_school_admin_view_temporary_staff = body.allow_school_admin_view_temporary_staff;
    }

    globalThis.__SUONGMAI_SYSTEM_SETTINGS__ = { ...current };

    // Persist to Supabase if available
    if (supabase) {
      try {
        const rows = [
          {
            key: 'allow_school_admin_view_non_regular',
            value: current.allow_school_admin_view_non_regular,
            updated_at: new Date().toISOString(),
          },
          {
            key: 'allow_school_admin_view_temporary_staff',
            value: current.allow_school_admin_view_temporary_staff,
            updated_at: new Date().toISOString(),
          },
        ];

        await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
      } catch (persistErr) {
        console.warn('Persist system_settings warning:', persistErr);
      }
    }

    return NextResponse.json({
      success: true,
      settings: current,
    });
  } catch (err: any) {
    console.error('POST /api/admin/system-settings error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
