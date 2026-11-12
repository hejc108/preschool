import { NextResponse } from 'next/server';
import defaultWeeklyMenu from '@/lib/data/weekly_menu.json';
import { DayOfWeek, MenuCycleConfig, MenuCycleResolution, WeeklyMenu } from '@/lib/types/schema';
import {
  DEFAULT_MENU_CYCLE_CONFIG,
  INITIAL_4WEEK_MENU,
  MEAL_TYPE_ORDER,
  resolveMenuCycleContext,
} from '@/lib/utils/menuHelper';
import { resolveServerMenuCycle } from '@/lib/menu/menuCycleService';
import { executeWithContextFallback, requireActiveRole, SessionContext } from '@/lib/auth/sessionContext';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  var __SUONGMAI_WEEKLY_MENU__: WeeklyMenu[] | undefined;
}

if (!globalThis.__SUONGMAI_WEEKLY_MENU__) {
  globalThis.__SUONGMAI_WEEKLY_MENU__ = (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU;
}

const DAY_ORDER: Record<DayOfWeek, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
};

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

function parseCycleQueryParams(request: Request): {
  dateInput?: string;
  displayYear?: number;
  displayMonth?: number;
} {
  try {
    const { searchParams } = new URL(request.url);
    const rawDate = searchParams.get('date');
    const dateInput = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim()) ? rawDate.trim() : undefined;

    const rawYear = Number(searchParams.get('year'));
    const rawMonth = Number(searchParams.get('month'));
    const hasValidMonth =
      Number.isInteger(rawYear) &&
      rawYear >= 2020 &&
      rawYear <= 2100 &&
      Number.isInteger(rawMonth) &&
      rawMonth >= 1 &&
      rawMonth <= 12;

    return {
      dateInput,
      displayYear: hasValidMonth ? rawYear : undefined,
      displayMonth: hasValidMonth ? rawMonth : undefined,
    };
  } catch {
    return {};
  }
}

async function resolveCycleSafely(
  ctx: SessionContext,
  queryParams: { dateInput?: string; displayYear?: number; displayMonth?: number }
): Promise<{ resolution: MenuCycleResolution; config: MenuCycleConfig }> {
  try {
    const res = await withTimeout(resolveServerMenuCycle(ctx, queryParams), 3000);
    return { resolution: res.resolution, config: res.config };
  } catch {
    const fallbackConfig = globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ || { ...DEFAULT_MENU_CYCLE_CONFIG };
    const resolution = resolveMenuCycleContext({
      ...queryParams,
      config: fallbackConfig,
      assignments: globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__ || [],
    });
    return { resolution, config: fallbackConfig };
  }
}

function buildMenuPayload(params: {
  source: 'supabase' | 'fallback';
  hasDb: boolean;
  menu: WeeklyMenu[];
  resolution: MenuCycleResolution;
  config: MenuCycleConfig;
}) {
  const { source, hasDb, menu, resolution, config } = params;

  const currentWeekMenu = menu
    .filter((item) => Number(item.week_number) === resolution.menu_week_number)
    .sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day_of_week] || 99) - (DAY_ORDER[b.day_of_week] || 99);
      if (dayDiff !== 0) return dayDiff;
      return (MEAL_TYPE_ORDER[a.meal_type] || 99) - (MEAL_TYPE_ORDER[b.meal_type] || 99);
    });

  const todayMenu = currentWeekMenu.filter((item) => item.day_of_week === resolution.day_of_week);

  return {
    success: true,
    count: menu.length,
    source,
    has_db: hasDb,
    display_label: resolution.display_label,
    short_display_label: resolution.short_display_label,
    full_date_label: resolution.full_date_label,
    today_card_title: resolution.today_card_title,
    is_weekend: resolution.is_weekend,
    weekend_notice: resolution.weekend_notice,
    preview_label: resolution.preview_label,
    target_date: resolution.target_date,
    effective_date: resolution.effective_date,
    current_week_of_month: resolution.week_of_month,
    current_menu_week: resolution.menu_week_number,
    current_month: resolution.month,
    current_year: resolution.year,
    current_day_of_week: resolution.day_of_week,
    cycle_config: {
      cycle_mode: config.cycle_mode,
      week_5_fallback: config.week_5_fallback,
      updated_at: config.updated_at || null,
    },
    month_weeks: resolution.month_weeks,
    cycle: resolution,
    today_menu: todayMenu,
    current_week_menu: currentWeekMenu,
    menu,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['PARENT', 'TEACHER', 'STAFF', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const queryParams = parseCycleQueryParams(request);
    const { resolution, config } = await resolveCycleSafely(ctx, queryParams);

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
          buildMenuPayload({
            source: 'supabase',
            hasDb: true,
            menu,
            resolution,
            config,
          }),
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
      buildMenuPayload({
        source: 'fallback',
        hasDb: false,
        menu: fallbackMenu,
        resolution,
        config,
      }),
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/menu error:', err);
    const resolution = resolveMenuCycleContext();
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error',
        has_db: false,
        display_label: resolution.display_label,
        full_date_label: resolution.full_date_label,
        cycle: resolution,
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
