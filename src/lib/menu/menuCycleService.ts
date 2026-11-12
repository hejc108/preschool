import {
  MenuCalendarAssignment,
  MenuCycleConfig,
  MenuCycleMode,
  MenuCycleResolution,
  MenuWeek5Fallback,
} from '@/lib/types/schema';
import {
  DEFAULT_MENU_CYCLE_CONFIG,
  getSchoolWeeksOfMonth,
  getVietnamDateParts,
  normalizeWeek5Fallback,
  resolveMenuCycleContext,
} from '@/lib/utils/menuHelper';
import { executeWithContextFallback, SessionContext } from '@/lib/auth/sessionContext';

declare global {
  var __SUONGMAI_MENU_CYCLE_CONFIG__: MenuCycleConfig | undefined;
  var __SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__: MenuCalendarAssignment[] | undefined;
}

if (!globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__) {
  globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ = { ...DEFAULT_MENU_CYCLE_CONFIG };
}
if (!globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__) {
  globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__ = [];
}

function isMissingTableOrCacheError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the ')
  );
}

function sanitizeConfig(raw: any): MenuCycleConfig {
  const cycleMode: MenuCycleMode =
    raw?.cycle_mode === 'MANUAL_CALENDAR' ? 'MANUAL_CALENDAR' : 'AUTO_ROTATE_4';
  const week5Fallback = normalizeWeek5Fallback(raw?.week_5_fallback ?? raw?.week5_fallback);
  return {
    id: 'default',
    cycle_mode: cycleMode,
    week_5_fallback: week5Fallback,
    updated_by: raw?.updated_by ?? null,
    updated_at: raw?.updated_at,
  };
}

function sanitizeAssignments(rows: any[]): MenuCalendarAssignment[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      id: r.id ? String(r.id) : undefined,
      year: Number(r.year),
      month: Number(r.month),
      week_of_month: Number(r.week_of_month),
      assigned_menu_week: Number(r.assigned_menu_week),
      week_start_date: String(r.week_start_date || ''),
      week_end_date: String(r.week_end_date || ''),
      notes: r.notes ?? null,
      updated_by: r.updated_by ?? null,
      updated_at: r.updated_at,
    }))
    .filter(
      (a) =>
        Number.isFinite(a.year) &&
        Number.isFinite(a.month) &&
        a.month >= 1 &&
        a.month <= 12 &&
        a.week_of_month >= 1 &&
        a.week_of_month <= 5 &&
        a.assigned_menu_week >= 1 &&
        a.assigned_menu_week <= 4
    );
}

function mergeAssignmentsInMemory(incoming: MenuCalendarAssignment[]): MenuCalendarAssignment[] {
  const map = new Map<string, MenuCalendarAssignment>();
  (globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__ || []).forEach((item) => {
    map.set(`${item.year}-${item.month}-${item.week_of_month}`, item);
  });
  incoming.forEach((item) => {
    map.set(`${item.year}-${item.month}-${item.week_of_month}`, item);
  });
  const merged = Array.from(map.values());
  globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__ = merged;
  return merged;
}

export async function loadMenuCycleConfig(ctx: SessionContext): Promise<{
  config: MenuCycleConfig;
  source: 'supabase' | 'system_settings' | 'memory';
}> {
  // 1. Primary: public.menu_cycle_configs
  try {
    const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('menu_cycle_configs').select('*').eq('id', 'default').maybeSingle()
    );
    if (!error && data) {
      const sanitized = sanitizeConfig(data);
      globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ = sanitized;
      return { config: sanitized, source: 'supabase' };
    }
    if (!error && !data) {
      return {
        config: globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ || { ...DEFAULT_MENU_CYCLE_CONFIG },
        source: 'supabase',
      };
    }
    if (error && !isMissingTableOrCacheError(error)) {
      throw error;
    }
  } catch {
    // Fall through to system_settings / memory
  }

  // 2. Fallback: public.system_settings (if migration 00015 hasn't run yet)
  try {
    const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('system_settings')
        .select('value, updated_at, updated_by')
        .eq('key', 'menu_cycle_config')
        .maybeSingle()
    );
    if (!error && data?.value) {
      const sanitized = sanitizeConfig({
        ...data.value,
        updated_at: data.updated_at,
        updated_by: data.updated_by,
      });
      globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ = sanitized;
      return { config: sanitized, source: 'system_settings' };
    }
  } catch {
    // Ignore fallback read errors
  }

  return {
    config: globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ || { ...DEFAULT_MENU_CYCLE_CONFIG },
    source: 'memory',
  };
}

export async function loadMenuCalendarAssignments(
  ctx: SessionContext,
  months: Array<{ year: number; month: number }>
): Promise<{
  assignments: MenuCalendarAssignment[];
  source: 'supabase' | 'system_settings' | 'memory';
}> {
  const uniquePairs = Array.from(
    new Map(months.map((m) => [`${m.year}-${m.month}`, m])).values()
  );

  // 1. Primary: public.menu_calendar_assignments
  try {
    const years = Array.from(new Set(uniquePairs.map((p) => p.year)));
    const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('menu_calendar_assignments')
        .select('*')
        .in('year', years)
        .order('year', { ascending: true })
        .order('month', { ascending: true })
        .order('week_of_month', { ascending: true })
    );

    if (!error && Array.isArray(data)) {
      const sanitized = sanitizeAssignments(data);
      mergeAssignmentsInMemory(sanitized);
      const pairKeys = new Set(uniquePairs.map((p) => `${p.year}-${p.month}`));
      return {
        assignments: sanitized.filter((a) => pairKeys.has(`${a.year}-${a.month}`)),
        source: 'supabase',
      };
    }
    if (error && !isMissingTableOrCacheError(error)) {
      throw error;
    }
  } catch {
    // Fall through to system_settings / memory
  }

  // 2. Fallback: public.system_settings
  try {
    const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('system_settings')
        .select('value')
        .eq('key', 'menu_calendar_assignments')
        .maybeSingle()
    );
    if (!error && Array.isArray(data?.value)) {
      const sanitized = sanitizeAssignments(data.value);
      mergeAssignmentsInMemory(sanitized);
      const pairKeys = new Set(uniquePairs.map((p) => `${p.year}-${p.month}`));
      return {
        assignments: sanitized.filter((a) => pairKeys.has(`${a.year}-${a.month}`)),
        source: 'system_settings',
      };
    }
  } catch {
    // Ignore fallback errors
  }

  const pairKeys = new Set(uniquePairs.map((p) => `${p.year}-${p.month}`));
  return {
    assignments: (globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__ || []).filter((a) =>
      pairKeys.has(`${a.year}-${a.month}`)
    ),
    source: 'memory',
  };
}

export async function saveMenuCycleSettings(
  ctx: SessionContext,
  params: {
    cycle_mode: MenuCycleMode;
    week_5_fallback: MenuWeek5Fallback;
    year?: number;
    month?: number;
    assignments?: Array<{ week_of_month: number; assigned_menu_week: number }>;
  }
): Promise<{
  config: MenuCycleConfig;
  assignments: MenuCalendarAssignment[];
  persisted_to: 'supabase' | 'system_settings' | 'memory';
  error_message?: string;
}> {
  const nowIso = new Date().toISOString();
  const nextConfig: MenuCycleConfig = {
    id: 'default',
    cycle_mode: params.cycle_mode === 'MANUAL_CALENDAR' ? 'MANUAL_CALENDAR' : 'AUTO_ROTATE_4',
    week_5_fallback: normalizeWeek5Fallback(params.week_5_fallback),
    updated_by: ctx.email,
    updated_at: nowIso,
  };

  globalThis.__SUONGMAI_MENU_CYCLE_CONFIG__ = nextConfig;

  let nextAssignments: MenuCalendarAssignment[] = [];
  if (params.year && params.month && Array.isArray(params.assignments)) {
    const validWeeks = getSchoolWeeksOfMonth({
      year: params.year,
      month: params.month,
    });
    const weekMap = new Map(validWeeks.map((w) => [w.week_of_month, w]));

    nextAssignments = params.assignments
      .map((item) => {
        const weekInfo = weekMap.get(Number(item.week_of_month));
        if (!weekInfo) return null;
        const assignedWeek = Number(item.assigned_menu_week);
        if (assignedWeek < 1 || assignedWeek > 4) return null;
        return {
          year: params.year!,
          month: params.month!,
          week_of_month: weekInfo.week_of_month,
          assigned_menu_week: assignedWeek,
          week_start_date: weekInfo.start_date,
          week_end_date: weekInfo.end_date,
          updated_by: ctx.email,
          updated_at: nowIso,
        } as MenuCalendarAssignment;
      })
      .filter((x): x is MenuCalendarAssignment => x !== null);

    mergeAssignmentsInMemory(nextAssignments);
  }

  let persistedTo: 'supabase' | 'system_settings' | 'memory' = 'memory';
  let errorMessage: string | undefined;

  // 1. Try saving to dedicated tables
  try {
    const { error: cfgErr } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('menu_cycle_configs').upsert(
        {
          id: 'default',
          cycle_mode: nextConfig.cycle_mode,
          week_5_fallback: nextConfig.week_5_fallback,
          updated_by: ctx.email,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      )
    );

    if (!cfgErr) {
      persistedTo = 'supabase';
      if (nextAssignments.length > 0) {
        const { error: assignErr } = await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('menu_calendar_assignments').upsert(
            nextAssignments.map((a) => ({
              year: a.year,
              month: a.month,
              week_of_month: a.week_of_month,
              assigned_menu_week: a.assigned_menu_week,
              week_start_date: a.week_start_date,
              week_end_date: a.week_end_date,
              updated_by: ctx.email,
              updated_at: nowIso,
            })),
            { onConflict: 'year,month,week_of_month' }
          )
        );
        if (assignErr) {
          errorMessage = assignErr.message;
        }
      }
      return {
        config: nextConfig,
        assignments: nextAssignments,
        persisted_to: persistedTo,
        error_message: errorMessage,
      };
    }

    if (!isMissingTableOrCacheError(cfgErr)) {
      errorMessage = cfgErr.message;
      return {
        config: nextConfig,
        assignments: nextAssignments,
        persisted_to: 'memory',
        error_message: errorMessage,
      };
    }
  } catch (err: any) {
    errorMessage = err?.message;
  }

  // 2. Fallback to system_settings if migration 00015 hasn't run yet
  try {
    const rows: Array<{ key: string; value: any; description: string; updated_at: string; updated_by: string }> = [
      {
        key: 'menu_cycle_config',
        value: {
          cycle_mode: nextConfig.cycle_mode,
          week_5_fallback: nextConfig.week_5_fallback,
        },
        description: 'Cấu hình chế độ chu kỳ thực đơn theo tháng',
        updated_at: nowIso,
        updated_by: ctx.email,
      },
    ];

    if (nextAssignments.length > 0) {
      rows.push({
        key: 'menu_calendar_assignments',
        value: globalThis.__SUONGMAI_MENU_CALENDAR_ASSIGNMENTS__ || nextAssignments,
        description: 'Ánh xạ tuần học trong tháng sang bộ thực đơn 1..4',
        updated_at: nowIso,
        updated_by: ctx.email,
      });
    }

    const { error: ssErr } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('system_settings').upsert(rows, { onConflict: 'key' })
    );

    if (!ssErr) {
      return {
        config: nextConfig,
        assignments: nextAssignments,
        persisted_to: 'system_settings',
      };
    }
    errorMessage = ssErr.message;
  } catch (err: any) {
    errorMessage = err?.message;
  }

  return {
    config: nextConfig,
    assignments: nextAssignments,
    persisted_to: persistedTo,
    error_message: errorMessage,
  };
}

export async function resolveServerMenuCycle(
  ctx: SessionContext,
  options?: {
    dateInput?: Date | string | null;
    displayYear?: number;
    displayMonth?: number;
  }
): Promise<{
  resolution: MenuCycleResolution;
  config: MenuCycleConfig;
  assignments: MenuCalendarAssignment[];
}> {
  const targetParts = getVietnamDateParts(options?.dateInput);
  const { config } = await loadMenuCycleConfig(ctx);

  // Determine months needed (target month, next month in case of Sat/Sun month rollover, and explicit displayYear/Month)
  const monthsToLoad: Array<{ year: number; month: number }> = [
    { year: targetParts.year, month: targetParts.month },
  ];

  // If weekend near end of month, next Monday might fall in next month
  if (targetParts.weekday === 0 || targetParts.weekday === 6) {
    const nextMonth = targetParts.month === 12 ? 1 : targetParts.month + 1;
    const nextYear = targetParts.month === 12 ? targetParts.year + 1 : targetParts.year;
    monthsToLoad.push({ year: nextYear, month: nextMonth });
  }

  if (options?.displayYear && options?.displayMonth) {
    monthsToLoad.push({ year: options.displayYear, month: options.displayMonth });
  }

  const { assignments } = await loadMenuCalendarAssignments(ctx, monthsToLoad);
  const resolution = resolveMenuCycleContext({
    dateInput: options?.dateInput,
    config,
    assignments,
    displayYear: options?.displayYear,
    displayMonth: options?.displayMonth,
  });

  return { resolution, config, assignments };
}
