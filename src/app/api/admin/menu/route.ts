import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { WeeklyMenu } from '@/lib/types/schema';
import { INITIAL_4WEEK_MENU } from '@/lib/utils/menuHelper';

export const dynamic = 'force-dynamic';

declare global {
  var __SUONGMAI_WEEKLY_MENU__: WeeklyMenu[] | undefined;
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

function getMenuFilePath(): string {
  return path.resolve(process.cwd(), 'src/lib/data/weekly_menu.json');
}

function readMenuFromFile(): WeeklyMenu[] | null {
  try {
    const filePath = getMenuFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as WeeklyMenu[];
      }
    }
  } catch (err) {
    console.warn('Read weekly_menu.json notice:', err);
  }
  return null;
}

function writeMenuToFile(menu: WeeklyMenu[]): boolean {
  try {
    const filePath = getMenuFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(menu, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('Write weekly_menu.json notice:', err);
    return false;
  }
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

    // 1. Try fetching from Supabase DB table with timeout
    if (supabase) {
      try {
        const { data, error } = await withTimeout<any>(
          supabase
            .from('weekly_menus')
            .select('*')
            .order('week_number', { ascending: true }),
          2000
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
          return NextResponse.json({ success: true, count: menu.length, source: 'supabase', menu });
        }
      } catch (dbErr) {
        // Table not yet migrated or query timed out
      }
    }

    // 2. Try in-memory cache
    if (globalThis.__SUONGMAI_WEEKLY_MENU__ && globalThis.__SUONGMAI_WEEKLY_MENU__.length > 0) {
      return NextResponse.json({
        success: true,
        count: globalThis.__SUONGMAI_WEEKLY_MENU__.length,
        source: 'memory_cache',
        menu: globalThis.__SUONGMAI_WEEKLY_MENU__,
      });
    }

    // 3. Try reading from server JSON file
    const fileMenu = readMenuFromFile();
    if (fileMenu && fileMenu.length > 0) {
      globalThis.__SUONGMAI_WEEKLY_MENU__ = fileMenu;
      return NextResponse.json({
        success: true,
        count: fileMenu.length,
        source: 'file_storage',
        menu: fileMenu,
      });
    }

    // 4. Default fallback to initial seed
    globalThis.__SUONGMAI_WEEKLY_MENU__ = INITIAL_4WEEK_MENU;
    return NextResponse.json({
      success: true,
      count: INITIAL_4WEEK_MENU.length,
      source: 'initial_seed',
      menu: INITIAL_4WEEK_MENU,
    });
  } catch (err: any) {
    console.error('GET /api/admin/menu error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error', menu: INITIAL_4WEEK_MENU },
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

    // 1. Update in-memory cache
    globalThis.__SUONGMAI_WEEKLY_MENU__ = sanitizedMenu;

    // 2. Persist to server JSON file
    writeMenuToFile(sanitizedMenu);

    // 3. Try syncing to Supabase DB
    let dbSynced = false;
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
          2000
        );

        if (!upsertErr) {
          dbSynced = true;
        } else {
          console.warn('weekly_menus table upsert notice:', upsertErr.message);
        }
      } catch (dbErr) {
        // Migration may not have run on Supabase, but local storage succeeded
        console.warn('weekly_menus sync notice (fallback active):', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật thực đơn thành công',
      count: sanitizedMenu.length,
      db_synced: dbSynced,
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
