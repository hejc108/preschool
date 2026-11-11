import { NextResponse } from 'next/server';
import defaultWeeklyMenu from '@/lib/data/weekly_menu.json';
import { WeeklyMenu } from '@/lib/types/schema';
import { INITIAL_4WEEK_MENU } from '@/lib/utils/menuHelper';
import { executeWithContextFallback, requireActiveRole } from '@/lib/auth/sessionContext';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  var __SUONGMAI_WEEKLY_MENU__: WeeklyMenu[] | undefined;
}

if (!globalThis.__SUONGMAI_WEEKLY_MENU__) {
  globalThis.__SUONGMAI_WEEKLY_MENU__ = (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU;
}

async function withTimeout<T = any>(promiseLike: PromiseLike<T> | Promise<T>, ms = 4000): Promise<T> {
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

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'TEACHER', 'STAFF', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    let menu: WeeklyMenu[] = [];

    // 1. Fetch from Supabase DB table with Tier 1 -> Tier 2 -> Tier 3 context fallback
    try {
      const { data, error } = await withTimeout<any>(
        executeWithContextFallback(ctx, async (sb) =>
          await sb
            .from('weekly_menus')
            .select('*')
            .order('week_number', { ascending: true })
        ),
        4000
      );

      if (error && isAuthOrRlsError(error)) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            has_db: false,
            menu: [],
          },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }

      if (!error && Array.isArray(data) && data.length > 0) {
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
        return NextResponse.json(
          {
            success: true,
            count: menu.length,
            source: 'supabase',
            has_db: true,
            menu,
          },
          { headers: NO_CACHE_HEADERS }
        );
      }
    } catch {
      // Table not yet migrated or query timed out
    }

    // 2. Return in-memory cache or default JSON fallback
    const fallbackMenu =
      globalThis.__SUONGMAI_WEEKLY_MENU__ && globalThis.__SUONGMAI_WEEKLY_MENU__.length > 0
        ? globalThis.__SUONGMAI_WEEKLY_MENU__
        : (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU;

    return NextResponse.json(
      {
        success: true,
        count: fallbackMenu.length,
        source: 'fallback',
        has_db: false,
        menu: fallbackMenu,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/menu error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error',
        has_db: false,
        menu: (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU,
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'STAFF']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

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

    let dbSynced = false;
    let dbErrorMessage: string | null = null;
    let dbStatus = 500;

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
        executeWithContextFallback(ctx, async (sb) =>
          await sb
            .from('weekly_menus')
            .upsert(rows, { onConflict: 'week_number,day_of_week,meal_type' })
        ),
        4000
      );

      if (!upsertErr) {
        dbSynced = true;
      } else {
        dbErrorMessage = upsertErr.message;
        if (isAuthOrRlsError(upsertErr)) dbStatus = 403;
        console.warn('weekly_menus table upsert notice:', upsertErr.message);
      }
    } catch (dbErr: any) {
      dbErrorMessage = dbErr?.message || 'Database connection error';
      console.warn('weekly_menus sync notice (fallback active):', dbErr);
    }

    if (!dbSynced) {
      return NextResponse.json(
        {
          success: false,
          error: dbErrorMessage
            ? `CSDL Supabase từ chối lưu: ${dbErrorMessage}`
            : 'Không thể kết nối hoặc lưu dữ liệu vào CSDL Supabase.',
          db_synced: false,
          db_error: dbErrorMessage,
          menu: sanitizedMenu,
        },
        { status: dbStatus, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Cập nhật thực đơn và đồng bộ CSDL Supabase thành công',
        count: sanitizedMenu.length,
        db_synced: true,
        menu: sanitizedMenu,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/admin/menu error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
