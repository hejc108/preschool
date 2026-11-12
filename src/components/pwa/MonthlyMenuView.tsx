'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Moon,
  RefreshCw,
  Utensils,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useActiveRole } from '@/components/auth/ActiveRoleContext';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';
import {
  DayOfWeek,
  MealCategory,
  MenuCycleResolution,
  MonthWeekInfo,
  WeeklyMenu,
} from '@/lib/types/schema';
import {
  checkDishAllergen,
  getSchoolWeeksOfMonth,
  resolveMenuCycleContext,
} from '@/lib/utils/menuHelper';

export interface MonthlyMenuViewProps {
  role: 'PARENT' | 'TEACHER';
  backHref: string;
}

const DAY_LABELS_FULL: Record<DayOfWeek, string> = {
  MONDAY: 'Thứ Hai',
  TUESDAY: 'Thứ Ba',
  WEDNESDAY: 'Thứ Tư',
  THURSDAY: 'Thứ Năm',
  FRIDAY: 'Thứ Sáu',
};

const DAY_LABELS_SHORT: Record<DayOfWeek, string> = {
  MONDAY: 'Thứ 2',
  TUESDAY: 'Thứ 3',
  WEDNESDAY: 'Thứ 4',
  THURSDAY: 'Thứ 5',
  FRIDAY: 'Thứ 6',
};

const MEAL_CATEGORIES: { key: MealCategory; label: string; icon: string }[] = [
  { key: 'BREAKFAST', label: 'Bữa sáng (07:30)', icon: '🥣' },
  { key: 'LUNCH_MAIN', label: 'Bữa trưa - Món mặn (11:00)', icon: '🍲' },
  { key: 'LUNCH_SOUP', label: 'Bữa trưa - Món canh (11:00)', icon: '🥣' },
  { key: 'DESSERT', label: 'Tráng miệng (11:30)', icon: '🍎' },
  { key: 'AFTERNOON_SNACK', label: 'Bữa xế (14:15)', icon: '🥛' },
];

const jsonFetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.error || `Request failed (${res.status})`);
  }
  return json;
};

/**
 * Shared full monthly school-week menu viewer for /parent/menu and /teacher/menu.
 * Displays actual Mon-Fri school weeks for the viewed month with exact date ranges.
 */
export function MonthlyMenuView({ role, backHref }: MonthlyMenuViewProps) {
  const initialResolution = useMemo(() => resolveMenuCycleContext(), []);

  const {
    activeRole,
    roles,
    serverSyncedRole,
    email,
    linkedStudents,
    waitForRoleSync,
  } = useActiveRole();

  const [displayYear, setDisplayYear] = useState<number>(initialResolution.year);
  const [displayMonth, setDisplayMonth] = useState<number>(initialResolution.month);
  const [selectedWeekOfMonth, setSelectedWeekOfMonth] = useState<number>(
    initialResolution.week_of_month
  );
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<DayOfWeek>(
    initialResolution.day_of_week
  );
  const hasSyncedInitialServerCycleRef = useRef<boolean>(false);

  const canFetch = Boolean(email);
  const isRealtimeReady = Boolean(email && activeRole === role && serverSyncedRole === role);

  const {
    data: menuPayload,
    isValidating,
    mutate: mutateMenu,
  } = useSWR(
    canFetch ? ['menu-monthly', role, displayYear, displayMonth] : null,
    async () => {
      if (roles.includes(role) && activeRole !== role) {
        await waitForRoleSync(role).catch(() => false);
      }
      return jsonFetcher(`/api/admin/menu?year=${displayYear}&month=${displayMonth}`);
    },
    {
      revalidateOnMount: true,
      keepPreviousData: true,
      refreshInterval: 120000,
    }
  );

  // Realtime updates when admin modifies weekly dishes, cycle mode, or manual month calendar
  useRoleRealtimeSync({
    channelName: email ? `monthly-menu-${role.toLowerCase()}-${email}` : null,
    enabled: isRealtimeReady,
    debounceMs: 250,
    handlers: [
      {
        table: 'weekly_menus',
        onEvent: () => {
          void mutateMenu();
        },
      },
      {
        table: 'menu_cycle_configs',
        onEvent: () => {
          void mutateMenu();
        },
      },
      {
        table: 'menu_calendar_assignments',
        onEvent: () => {
          void mutateMenu();
        },
      },
    ],
  });

  const cycleResolution: MenuCycleResolution = useMemo(() => {
    if (menuPayload?.cycle) {
      return menuPayload.cycle as MenuCycleResolution;
    }
    return resolveMenuCycleContext({
      displayYear,
      displayMonth,
    });
  }, [menuPayload, displayYear, displayMonth]);

  // Sync default selected week/day with authoritative server resolution on first load
  useEffect(() => {
    if (!menuPayload?.cycle || hasSyncedInitialServerCycleRef.current) return;
    hasSyncedInitialServerCycleRef.current = true;
    setSelectedWeekOfMonth(menuPayload.cycle.week_of_month);
    setSelectedDayOfWeek(menuPayload.cycle.day_of_week);
  }, [menuPayload]);

  const monthWeeks: MonthWeekInfo[] = useMemo(() => {
    if (
      Array.isArray(menuPayload?.month_weeks) &&
      menuPayload.month_weeks.length > 0 &&
      Number(menuPayload.month_weeks[0]?.year) === displayYear &&
      Number(menuPayload.month_weeks[0]?.month) === displayMonth
    ) {
      return menuPayload.month_weeks;
    }
    return getSchoolWeeksOfMonth({
      year: displayYear,
      month: displayMonth,
      config: menuPayload?.cycle_config,
      currentWeekOfMonth:
        displayYear === cycleResolution.year && displayMonth === cycleResolution.month
          ? cycleResolution.week_of_month
          : null,
    });
  }, [menuPayload, displayYear, displayMonth, cycleResolution]);

  const selectedWeekObj: MonthWeekInfo = useMemo(() => {
    return (
      monthWeeks.find((w) => w.week_of_month === selectedWeekOfMonth) || monthWeeks[0]
    );
  }, [monthWeeks, selectedWeekOfMonth]);

  const activeDayInfo = useMemo(() => {
    if (!selectedWeekObj || selectedWeekObj.days.length === 0) return null;
    return (
      selectedWeekObj.days.find((d) => d.day_of_week === selectedDayOfWeek) ||
      selectedWeekObj.days[0]
    );
  }, [selectedWeekObj, selectedDayOfWeek]);

  const liveMenuList: WeeklyMenu[] = useMemo(
    () => (menuPayload?.has_db && Array.isArray(menuPayload.menu) ? menuPayload.menu : []),
    [menuPayload]
  );

  const filteredMeals = useMemo(() => {
    if (!selectedWeekObj || !activeDayInfo) return [];
    return liveMenuList.filter(
      (m) =>
        Number(m.week_number) === selectedWeekObj.assigned_menu_week &&
        m.day_of_week === activeDayInfo.day_of_week
    );
  }, [liveMenuList, selectedWeekObj, activeDayInfo]);

  const studentAllergies = useMemo(() => {
    if (role !== 'PARENT') return '';
    const combined = (linkedStudents || [])
      .map((c: any) => c.allergies)
      .filter((a: any) => typeof a === 'string' && a.trim() && a.trim().toLowerCase() !== 'không')
      .join(', ');
    return combined || 'Không';
  }, [role, linkedStudents]);

  const handleSelectWeek = (week: MonthWeekInfo) => {
    setSelectedWeekOfMonth(week.week_of_month);
    const hasCurrentDay = week.days.some((d) => d.day_of_week === selectedDayOfWeek);
    if (!hasCurrentDay && week.days[0]) {
      setSelectedDayOfWeek(week.days[0].day_of_week);
    }
  };

  const handleShiftMonth = (delta: number) => {
    const nextDate = new Date(Date.UTC(displayYear, displayMonth - 1 + delta, 1));
    const nextYear = nextDate.getUTCFullYear();
    const nextMonth = nextDate.getUTCMonth() + 1;
    setDisplayYear(nextYear);
    setDisplayMonth(nextMonth);

    const previewWeeks = getSchoolWeeksOfMonth({ year: nextYear, month: nextMonth });
    if (nextYear === cycleResolution.year && nextMonth === cycleResolution.month) {
      setSelectedWeekOfMonth(cycleResolution.week_of_month);
      setSelectedDayOfWeek(cycleResolution.day_of_week);
    } else if (previewWeeks[0]) {
      setSelectedWeekOfMonth(1);
      setSelectedDayOfWeek(previewWeeks[0].days[0]?.day_of_week || 'MONDAY');
    }
  };

  const handleJumpToToday = () => {
    setDisplayYear(cycleResolution.year);
    setDisplayMonth(cycleResolution.month);
    setSelectedWeekOfMonth(cycleResolution.week_of_month);
    setSelectedDayOfWeek(cycleResolution.day_of_week);
  };

  const isViewingTodayMonth =
    displayYear === cycleResolution.year && displayMonth === cycleResolution.month;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans pb-10">
      {/* Top Header */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={backHref}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 flex items-center justify-center text-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-white text-base leading-tight truncate">
              Thực Đơn Tháng {displayMonth}/{displayYear}
            </h1>
            <p className="text-xs text-sky-100 font-medium truncate">
              {cycleResolution.display_label} • Mầm Non Sương Mai
            </p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      {/* Month Navigator & Today Info */}
      <div className="p-3 bg-white border-b border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleShiftMonth(-1)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
            aria-label="Tháng trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span>
              Tháng {displayMonth}/{displayYear}
            </span>
            {!isViewingTodayMonth && (
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold hover:bg-sky-200 cursor-pointer"
              >
                Về hôm nay
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void mutateMenu()}
              disabled={isValidating}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              aria-label="Làm mới thực đơn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => handleShiftMonth(1)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              aria-label="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gentle Weekend Notice */}
        {cycleResolution.is_weekend && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
            <span className="font-semibold text-amber-900 flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{cycleResolution.weekend_notice || 'Trường nghỉ cuối tuần'}</span>
            </span>
            {cycleResolution.preview_label && (
              <span className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 font-bold text-[10px]">
                {cycleResolution.preview_label}
              </span>
            )}
          </div>
        )}

        {/* School Weeks of Month Tabs */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold text-slate-400 px-1 flex items-center justify-between">
            <span>Tuần học trong tháng (Thứ 2 – Thứ 6)</span>
            {selectedWeekObj?.is_current && (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-200 font-bold text-[10px]">
                ★ Tuần Hiện Tại
              </span>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {monthWeeks.map((week) => {
              const isSelected = selectedWeekObj?.week_of_month === week.week_of_month;
              return (
                <button
                  key={week.week_of_month}
                  type="button"
                  onClick={() => handleSelectWeek(week)}
                  className={`flex-1 min-w-[92px] py-1.5 px-2.5 rounded-xl border text-center transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                      : week.is_current
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent'
                  }`}
                >
                  <div className="text-xs font-bold leading-tight">Tuần {week.week_of_month}</div>
                  <div
                    className={`text-[10px] mt-0.5 font-medium ${
                      isSelected ? 'text-rose-100' : 'text-slate-500'
                    }`}
                  >
                    ({week.date_range_label})
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actual School Days in Selected Week */}
      {selectedWeekObj && (
        <div className="flex bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-bold overflow-x-auto gap-1">
          {selectedWeekObj.days.map((d) => {
            const isSelected = activeDayInfo?.date === d.date;
            const isTodayTarget = d.date === cycleResolution.effective_date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDayOfWeek(d.day_of_week)}
                className={`flex-1 min-w-[64px] py-1.5 px-2 text-center rounded-lg transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-white text-sky-700 shadow-sm font-bold border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="leading-tight">
                  {DAY_LABELS_SHORT[d.day_of_week]}
                  {isTodayTarget ? ' •' : ''}
                </div>
                <div className="text-[10px] font-medium text-slate-400 mt-0.5">{d.date_short}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Meals Timeline List for Selected School Day */}
      <div className="p-4 space-y-3 flex-1">
        {selectedWeekObj && activeDayInfo && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-bold text-sky-900 flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  {DAY_LABELS_FULL[activeDayInfo.day_of_week]}, ngày {activeDayInfo.date_short}/
                  {displayYear}
                </span>
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Tuần {selectedWeekObj.week_of_month} (Tháng {displayMonth}) •{' '}
                {selectedWeekObj.week_of_month === 5 ||
                selectedWeekObj.assigned_menu_week !== selectedWeekObj.week_of_month
                  ? `Áp dụng theo Thực đơn Tuần ${selectedWeekObj.assigned_menu_week}`
                  : `Bộ thực đơn Tuần ${selectedWeekObj.assigned_menu_week}`}
              </p>
            </div>
            {role === 'PARENT' && (
              <span className="text-[11px] text-slate-400 font-mono">
                Dị ứng bé: {studentAllergies}
              </span>
            )}
          </div>
        )}

        <div className="space-y-3">
          {MEAL_CATEGORIES.map((cat) => {
            const meal = filteredMeals.find((m) => m.meal_type === cat.key);
            const dishName = meal ? meal.dish_name : 'Nhà trường đang cập nhật thực đơn';
            const allergenCheck =
              role === 'PARENT' && meal
                ? checkDishAllergen(dishName, meal.allergens, studentAllergies)
                : { hasAllergen: false };

            return (
              <div
                key={cat.key}
                className={`p-4 bg-white border rounded-convent shadow-sm space-y-2 relative transition-all ${
                  allergenCheck.hasAllergen ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </span>

                  {allergenCheck.hasAllergen && (
                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-pill text-[10px] font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>{allergenCheck.warningLabel || 'Cảnh báo dị ứng'}</span>
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900">{dishName}</h3>

                {allergenCheck.hasAllergen && (
                  <p className="text-[11px] text-rose-700 italic border-t border-rose-100 pt-1.5">
                    * Lưu ý: Món ăn này chứa thành phần dị ứng trùng với hồ sơ của bé. Nhân sự bếp
                    sẽ tự động chuyển đổi món thay thế an toàn.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
