import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import defaultWeeklyMenu from '@/lib/data/weekly_menu.json';
import { WeeklyMenu } from '@/lib/types/schema';
import { INITIAL_4WEEK_MENU } from '@/lib/utils/menuHelper';

export const dynamic = 'force-dynamic';

declare global {
  var __SUONGMAI_WEEKLY_MENU__: WeeklyMenu[] | undefined;
}

if (!globalThis.__SUONGMAI_WEEKLY_MENU__) {
  globalThis.__SUONGMAI_WEEKLY_MENU__ = (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU;
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

async function withTimeout<T = any>(promiseLike: PromiseLike<T> | Promise<T>, ms = 2500): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promiseLike), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    let menu: WeeklyMenu[] = [];

    // 1. Fetch from Supabase DB table with timeout
    if (supabase) {
      try {
        const { data, error } = await withTimeout<any>(
          supabase
            .from('weekly_menus')
            .select('*')
            .order('week_number', { ascending: true }),
          2500
        );

        if (!error && data && data.length > 0) {
          menu = data.map((row: any) => ({
            id: row.id,
            week_number: row.week_number,
            day_of_week: row.day_of_week,
            meal_type: row.meal_type,
            dish_name: row.dish_name,
            allergens: row.allergens || [],
            created_at: row.created_at,
          }));
          globalThis.__SUONGMAI_WEEKLY_MENU__ = menu;
          return NextResponse.json({
            success: true,
            count: menu.length,
            source: 'supabase',
            has_db: true,
            menu,
          });
        }
      } catch (dbErr) {
        // Table not yet migrated or query timed out
      }
    }

    // 2. Return in-memory cache or default JSON fallback
    const fallbackMenu =
      globalThis.__SUONGMAI_WEEKLY_MENU__ && globalThis.__SUONGMAI_WEEKLY_MENU__.length > 0
        ? globalThis.__SUONGMAI_WEEKLY_MENU__
        : (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU;

    return NextResponse.json({
      success: true,
      count: fallbackMenu.length,
      source: 'fallback',
      has_db: false,
      menu: fallbackMenu,
    });
  } catch (err: any) {
    console.error('GET /api/admin/menu error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error',
        has_db: false,
        menu: (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incomingMenu = body.menu;

    if (!Array.isArray(incomingMenu) || incomingMenu.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mảng dữ liệu thực đơn (menu) không hợp lệ' },
        { status: 400 }
      );
    }

    const sanitizedMenu: WeeklyMenu[] = incomingMenu.map((m: any, idx: number) => ({
      id: m.id || `m-w${m.week_number}-${String(m.day_of_week || '').toLowerCase()}-${String(m.meal_type || '').toLowerCase()}-${idx}`,
      week_number: Number(m.week_number),
      day_of_week: m.day_of_week,
      meal_type: m.meal_type,
      dish_name: String(m.dish_name || '').trim(),
      allergens: Array.isArray(m.allergens) ? m.allergens : [],
    }));

    // Update in-memory cache
    globalThis.__SUONGMAI_WEEKLY_MENU__ = sanitizedMenu;

    // Sync to Supabase DB if table exists
    let dbSynced = false;
    let dbErrorMessage: string | null = null;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const rows = sanitizedMenu.map((m) => ({
          id: m.id,
          week_number: m.week_number,
          day_of_week: m.day_of_week,
          meal_type: m.meal_type,
          dish_name: m.dish_name,
          allergens: m.allergens || [],
          updated_at: new Date().toISOString(),
        }));

        const { error: upsertErr } = await withTimeout<any>(
          supabase
            .from('weekly_menus')
            .upsert(rows, { onConflict: 'week_number,day_of_week,meal_type' }),
          3000
        );

        if (!upsertErr) {
          dbSynced = true;
        } else {
          dbErrorMessage = upsertErr.message;
          console.warn('weekly_menus table upsert notice:', upsertErr.message);
        }
      } catch (dbErr: any) {
        dbErrorMessage = dbErr?.message || 'Database connection error';
        console.warn('weekly_menus sync notice (fallback active):', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: dbSynced
        ? 'Cập nhật thực đơn và đồng bộ CSDL Supabase thành công'
        : 'Đã lưu vào bộ nhớ tạm hệ thống (CSDL Supabase chưa có bảng weekly_menus)',
      count: sanitizedMenu.length,
      db_synced: dbSynced,
      db_error: dbErrorMessage,
      menu: sanitizedMenu,
    });
  } catch (err: any) {
    console.error('POST /api/admin/menu error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
