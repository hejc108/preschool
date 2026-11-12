import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import { NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { MenuCycleMode, MenuWeek5Fallback } from '@/lib/types/schema';
import { getVietnamDateParts } from '@/lib/utils/menuHelper';
import {
  resolveServerMenuCycle,
  saveMenuCycleSettings,
} from '@/lib/menu/menuCycleService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseTargetMonth(searchParams: URLSearchParams): {
  year: number;
  month: number;
  dateInput?: string;
} {
  const nowParts = getVietnamDateParts();
  const rawDate = searchParams.get('date');
  const dateInput =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim()) ? rawDate.trim() : undefined;

  const rawYear = Number(searchParams.get('year'));
  const rawMonth = Number(searchParams.get('month'));
  const year =
    Number.isInteger(rawYear) && rawYear >= 2020 && rawYear <= 2100 ? rawYear : nowParts.year;
  const month =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : nowParts.month;

  return { year, month, dateInput };
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'STAFF']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const { year, month, dateInput } = parseTargetMonth(searchParams);

    const { resolution, config, assignments } = await resolveServerMenuCycle(ctx, {
      dateInput,
      displayYear: year,
      displayMonth: month,
    });

    const monthAssignments = assignments.filter(
      (a) => Number(a.year) === year && Number(a.month) === month
    );

    return NextResponse.json(
      {
        success: true,
        config,
        year,
        month,
        display_label: resolution.display_label,
        full_date_label: resolution.full_date_label,
        month_weeks: resolution.month_weeks,
        assignments: monthAssignments,
        resolution,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('GET /api/admin/menu/settings error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Không thể tải cấu hình chu kỳ thực đơn',
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu yêu cầu không hợp lệ' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const cycleMode = body.cycle_mode as MenuCycleMode;
    if (cycleMode !== 'AUTO_ROTATE_4' && cycleMode !== 'MANUAL_CALENDAR') {
      return NextResponse.json(
        {
          success: false,
          error: 'cycle_mode phải là AUTO_ROTATE_4 hoặc MANUAL_CALENDAR',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const rawFallbackInput = body.week_5_fallback ?? body.week5_fallback;
    const rawFallback = rawFallbackInput !== undefined ? Number(rawFallbackInput) : 1;
    if (!Number.isInteger(rawFallback) || rawFallback < 1 || rawFallback > 4) {
      return NextResponse.json(
        {
          success: false,
          error: 'week_5_fallback phải là số nguyên từ 1 đến 4',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const week5Fallback = rawFallback as MenuWeek5Fallback;

    const nowParts = getVietnamDateParts();
    const targetYear = body.year !== undefined ? Number(body.year) : nowParts.year;
    const targetMonth = body.month !== undefined ? Number(body.month) : nowParts.month;

    if (
      !Number.isInteger(targetYear) ||
      targetYear < 2020 ||
      targetYear > 2100 ||
      !Number.isInteger(targetMonth) ||
      targetMonth < 1 ||
      targetMonth > 12
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tháng/năm cấu hình không hợp lệ',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    let sanitizedAssignments:
      | Array<{ week_of_month: number; assigned_menu_week: number }>
      | undefined;

    if (body.assignments !== undefined) {
      if (!Array.isArray(body.assignments)) {
        return NextResponse.json(
          { success: false, error: 'Danh sách assignments phải là mảng' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      sanitizedAssignments = body.assignments
        .map((item: any) => ({
          week_of_month: Number(item?.week_of_month),
          assigned_menu_week: Number(item?.assigned_menu_week),
        }))
        .filter(
          (item: { week_of_month: number; assigned_menu_week: number }) =>
            Number.isInteger(item.week_of_month) &&
            item.week_of_month >= 1 &&
            item.week_of_month <= 5 &&
            Number.isInteger(item.assigned_menu_week) &&
            item.assigned_menu_week >= 1 &&
            item.assigned_menu_week <= 4
        );
    }

    const saved = await saveMenuCycleSettings(ctx, {
      cycle_mode: cycleMode,
      week_5_fallback: week5Fallback,
      year: targetYear,
      month: targetMonth,
      assignments: sanitizedAssignments,
    });

    if (
      saved.persisted_to === 'memory' &&
      saved.error_message &&
      /permission|policy|rls|denied|forbidden|jwt/i.test(saved.error_message)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `CSDL từ chối lưu cấu hình: ${saved.error_message}`,
          persisted_to: saved.persisted_to,
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const resolvedAfterSave = await resolveServerMenuCycle(ctx, {
      displayYear: targetYear,
      displayMonth: targetMonth,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Đã lưu cấu hình chu kỳ thực đơn theo tháng',
        persisted_to: saved.persisted_to,
        db_synced: saved.persisted_to !== 'memory',
        warning:
          saved.persisted_to === 'memory'
            ? saved.error_message || 'Đang lưu tạm trên bộ nhớ máy chủ'
            : undefined,
        config: resolvedAfterSave.config,
        year: targetYear,
        month: targetMonth,
        display_label: resolvedAfterSave.resolution.display_label,
        full_date_label: resolvedAfterSave.resolution.full_date_label,
        month_weeks: resolvedAfterSave.resolution.month_weeks,
        assignments: resolvedAfterSave.assignments.filter(
          (a) => Number(a.year) === targetYear && Number(a.month) === targetMonth
        ),
        resolution: resolvedAfterSave.resolution,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('POST /api/admin/menu/settings error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Lỗi máy chủ khi lưu cấu hình chu kỳ thực đơn',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
