'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Coffee,
  Moon,
  Sparkles,
  Sun,
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

const MEAL_CONFIG: Record<
  MealCategory,
  { label: string; badgeBg: string; badgeText: string; cardBg: string; borderColor: string; icon: any }
> = {
  BREAKFAST: {
    label: 'Bữa sáng',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    cardBg: 'bg-amber-50/50',
    borderColor: 'border-amber-100',
    icon: Sun,
  },
  LUNCH_MAIN: {
    label: 'Trưa • Món mặn',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    cardBg: 'bg-emerald-50/40',
    borderColor: 'border-emerald-100',
    icon: Utensils,
  },
  LUNCH_SOUP: {
    label: 'Trưa • Món canh',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    cardBg: 'bg-teal-50/40',
    borderColor: 'border-teal-100',
    icon: Utensils,
  },
  DESSERT: {
    label: 'Tráng miệng',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    cardBg: 'bg-rose-50/40',
    borderColor: 'border-rose-100',
    icon: Sparkles,
  },
  AFTERNOON_SNACK: {
    label: 'Bữa xế',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    cardBg: 'bg-orange-50/50',
    borderColor: 'border-orange-100',
    icon: Coffee,
  },
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
    <div className="bg-white border border-amber-100/80 rounded-2xl p-4 shadow-xs space-y-3">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 border-b border-amber-100/60 pb-2.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-start gap-2 text-teal-950 font-bold text-xs">
            <Utensils className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span className="leading-snug">
              {cycleResolution.today_card_title ||
                `Thực đơn hôm nay • ${cycleResolution.short_display_label}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <CalendarDays className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{cycleResolution.full_date_label}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={fullViewHref}
            className="text-[11px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-0.5 whitespace-nowrap"
          >
            Xem 4 tuần <ArrowRight className="w-3 h-3" />
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
        <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
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
            <div className="py-4 px-3 text-center bg-amber-50/30 border border-dashed border-amber-200/60 rounded-xl">
              <p className="text-xs font-semibold text-slate-500">
                Nhà trường đang cập nhật thực đơn
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {todayMeals.map((meal) => {
                const cfg = MEAL_CONFIG[meal.meal_type as MealCategory] || {
                  label: meal.meal_type,
                  badgeBg: 'bg-slate-100',
                  badgeText: 'text-slate-700',
                  cardBg: 'bg-slate-50',
                  borderColor: 'border-slate-100',
                  icon: Utensils,
                };
                const MealIcon = cfg.icon;

                const allergenCheck = studentAllergies
                  ? checkDishAllergen(meal.dish_name, meal.allergens, studentAllergies)
                  : { hasAllergen: false };

                return (
                  <div
                    key={meal.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${cfg.cardBg} ${cfg.borderColor} transition-colors`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${cfg.badgeBg} ${cfg.badgeText} flex items-center justify-center shrink-0`}>
                        <MealIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className={`text-[10px] font-bold block leading-none mb-0.5 ${cfg.badgeText}`}>
                          {cfg.label}
                        </span>
                        <span className="font-bold text-slate-800 text-xs truncate block">{meal.dish_name}</span>
                      </div>
                    </div>

                    {allergenCheck.hasAllergen && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0">
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
