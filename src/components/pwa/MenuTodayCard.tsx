'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Moon,
  Utensils,
} from 'lucide-react';
import { MealCategory, MenuCycleResolution, WeeklyMenu } from '@/lib/types/schema';
import {
  checkDishAllergen,
  MEAL_TYPE_ORDER,
  resolveMenuCycleContext,
} from '@/lib/utils/menuHelper';

export interface MenuTodayCardProps {
  /** Response payload returned by GET /api/admin/menu */
  menuPayload: any;
  /** Route for full monthly/weekly menu exploration (/parent/menu or /teacher/menu) */
  fullViewHref: string;
  /** Optional student allergies string (Parent portal passes selected child allergies) */
  studentAllergies?: string;
  /** Allow collapsing card body (useful on dense Teacher roll-call home screen) */
  collapsible?: boolean;
}

const MEAL_LABELS: Record<MealCategory, string> = {
  BREAKFAST: 'Bữa sáng',
  LUNCH_MAIN: 'Trưa - Món mặn',
  LUNCH_SOUP: 'Trưa - Món canh',
  DESSERT: 'Tráng miệng',
  AFTERNOON_SNACK: 'Bữa xế',
};

/**
 * Shared Home Menu Today card for both Parent and Teacher Mobile PWAs.
 * Renders standardized monthly school-week date labels and weekend Monday previews.
 */
export function MenuTodayCard({
  menuPayload,
  fullViewHref,
  studentAllergies,
  collapsible = false,
}: MenuTodayCardProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const cycleResolution: MenuCycleResolution = useMemo(() => {
    if (menuPayload?.cycle) {
      return menuPayload.cycle as MenuCycleResolution;
    }
    return resolveMenuCycleContext();
  }, [menuPayload]);

  const todayMeals: WeeklyMenu[] = useMemo(() => {
    if (!menuPayload?.has_db) return [];

    if (Array.isArray(menuPayload.today_menu) && menuPayload.today_menu.length > 0) {
      return [...menuPayload.today_menu].sort(
        (a, b) => (MEAL_TYPE_ORDER[a.meal_type as MealCategory] || 99) - (MEAL_TYPE_ORDER[b.meal_type as MealCategory] || 99)
      );
    }

    const list: WeeklyMenu[] = Array.isArray(menuPayload.menu) ? menuPayload.menu : [];
    return list
      .filter(
        (m) =>
          Number(m.week_number) === cycleResolution.menu_week_number &&
          m.day_of_week === cycleResolution.day_of_week
      )
      .sort((a, b) => (MEAL_TYPE_ORDER[a.meal_type] || 99) - (MEAL_TYPE_ORDER[b.meal_type] || 99));
  }, [menuPayload, cycleResolution]);

  return (
    <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-3">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-start gap-2 text-sky-900 font-bold text-xs">
            <Utensils className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              {cycleResolution.today_card_title ||
                `Thực đơn hôm nay • ${cycleResolution.short_display_label}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <CalendarDays className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>{cycleResolution.full_date_label}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={fullViewHref}
            className="text-[11px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-0.5 whitespace-nowrap"
          >
            Xem toàn bộ 4 tuần <ArrowRight className="w-3 h-3" />
          </Link>

          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? 'Mở rộng thực đơn' : 'Thu gọn thực đơn'}
              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Gentle Weekend Notice & Next Monday Preview Badge */}
      {cycleResolution.is_weekend && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
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

      {/* Meals List */}
      {!isCollapsed && (
        <>
          {todayMeals.length === 0 ? (
            <div className="py-5 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs font-semibold text-slate-500">
                Nhà trường đang cập nhật thực đơn
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {todayMeals.map((meal) => {
                const allergenCheck = studentAllergies
                  ? checkDishAllergen(meal.dish_name, meal.allergens, studentAllergies)
                  : { hasAllergen: false };

                return (
                  <div
                    key={meal.id}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {MEAL_LABELS[meal.meal_type] || meal.meal_type}
                      </span>
                      <span className="font-bold text-slate-800 text-xs">{meal.dish_name}</span>
                    </div>

                    {allergenCheck.hasAllergen && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-pill text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>{allergenCheck.warningLabel || 'Cảnh báo dị ứng'}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
