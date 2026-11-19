'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  /** Initial collapsed state (defaults to false, set true on Teacher portal to save space) */
  defaultCollapsed?: boolean;
}

interface MealThumbnailProps {
  meal: WeeklyMenu;
  fallbackIcon: any;
  alt: string;
}

function MealThumbnail({ meal, fallbackIcon: FallbackIcon, alt }: MealThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  // Priority (a): custom_image_url / image_url from DB/Storage
  // Priority (b): matched preset image under /images/meals/
  const typeKey = (meal.meal_type || '').toLowerCase().replace(/_/g, '-');
  const presetSrc = `/images/meals/${typeKey}.svg`;
  const primarySrc = meal.custom_image_url || meal.image_url || presetSrc;

  const [imgSrc, setImgSrc] = useState(primarySrc);

  useEffect(() => {
    setHasError(false);
    const updated = meal.custom_image_url || meal.image_url || presetSrc;
    setImgSrc(updated);
  }, [meal.custom_image_url, meal.image_url, presetSrc]);

  const handleImageError = () => {
    if (imgSrc !== presetSrc) {
      // Step down to preset fallback before placeholder icon
      setImgSrc(presetSrc);
    } else {
      // Step down to safe fallback icon (c)
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
        <FallbackIcon className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100 shadow-2xs">
      <img
        src={imgSrc}
        alt={alt}
        loading="lazy"
        onError={handleImageError}
        className="w-12 h-12 rounded-xl object-cover shrink-0"
      />
    </div>
  );
}

interface SessionConfig {
  sessionKey: 'BREAKFAST' | 'LUNCH' | 'SNACK';
  title: string;
  sessionBadge: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: any;
}

const SESSION_META: Record<string, SessionConfig> = {
  BREAKFAST: {
    sessionKey: 'BREAKFAST',
    title: 'Bữa sáng',
    sessionBadge: 'Sáng',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    icon: Sun,
  },
  LUNCH: {
    sessionKey: 'LUNCH',
    title: 'Bữa trưa',
    sessionBadge: 'Trưa',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    icon: Utensils,
  },
  SNACK: {
    sessionKey: 'SNACK',
    title: 'Bữa xế',
    sessionBadge: 'Xế',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200',
    icon: Coffee,
  },
};

/** Clean dish sub-labels without repetitive prefixes */
const DISH_ROLE_LABEL: Record<MealCategory, { roleLabel: string; chipBg: string; chipText: string }> = {
  BREAKFAST: {
    roleLabel: 'Món sáng chính',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
  },
  LUNCH_MAIN: {
    roleLabel: 'Món chính',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
  },
  LUNCH_SOUP: {
    roleLabel: 'Món canh',
    chipBg: 'bg-teal-50',
    chipText: 'text-teal-700',
  },
  DESSERT: {
    roleLabel: 'Tráng miệng',
    chipBg: 'bg-rose-50',
    chipText: 'text-rose-700',
  },
  AFTERNOON_SNACK: {
    roleLabel: 'Bữa phụ',
    chipBg: 'bg-orange-50',
    chipText: 'text-orange-700',
  },
};

/**
 * Shared Home Menu Today card for both Parent and Teacher Mobile PWAs.
 * Features:
 * - Grouped cleanly by session (Sáng, Trưa, Xế) with no repetitive prefixes
 * - 12x12 square thumbnails with 3-tier fallback (Upload -> Preset SVG -> Fallback Icon)
 * - Zero repeated "Tuần X Tháng Y" labels
 * - Collapsible for teacher screen optimization
 */
export function MenuTodayCard({
  menuPayload,
  fullViewHref,
  studentAllergies,
  collapsible = false,
  defaultCollapsed = false,
}: MenuTodayCardProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);

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

  // Clean Session Groups: Sáng, Trưa, Xế
  const groupedSessions = useMemo(() => {
    const breakfast = todayMeals.filter((m) => m.meal_type === 'BREAKFAST');
    const lunch = todayMeals.filter((m) =>
      ['LUNCH_MAIN', 'LUNCH_SOUP', 'DESSERT'].includes(m.meal_type)
    );
    const snack = todayMeals.filter((m) => m.meal_type === 'AFTERNOON_SNACK');

    const groups: Array<{ meta: SessionConfig; meals: WeeklyMenu[] }> = [];
    if (breakfast.length > 0) groups.push({ meta: SESSION_META.BREAKFAST, meals: breakfast });
    if (lunch.length > 0) groups.push({ meta: SESSION_META.LUNCH, meals: lunch });
    if (snack.length > 0) groups.push({ meta: SESSION_META.SNACK, meals: snack });

    return groups;
  }, [todayMeals]);

  return (
    <div className="bg-white border border-amber-100/90 rounded-2xl p-4 shadow-xs space-y-3.5 overflow-x-hidden min-w-0 w-full text-slate-800 font-sans">
      {/* Header Row — Zero Repetition */}
      <div className="flex items-start justify-between gap-2 border-b border-amber-100/60 pb-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Utensils className="w-4 h-4 text-teal-600 shrink-0" />
            <h3 className="font-bold text-teal-950 text-sm sm:text-base leading-tight truncate">
              Thực đơn hôm nay
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 shrink-0">
              {cycleResolution.short_display_label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 min-w-0">
            <CalendarDays className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              {cycleResolution.weekday_vi}, ngày {cycleResolution.effective_date_formatted}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-center">
          <Link
            href={fullViewHref}
            className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-0.5 whitespace-nowrap px-2 py-1 rounded-lg hover:bg-teal-50 transition"
          >
            <span>Xem 4 tuần</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? 'Mở rộng thực đơn hôm nay' : 'Thu gọn thực đơn hôm nay'}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-600 transition cursor-pointer shrink-0"
              title={isCollapsed ? 'Mở rộng thực đơn' : 'Thu gọn thực đơn'}
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Weekend Notice */}
      {cycleResolution.is_weekend && (
        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-amber-900 flex items-center gap-1.5 min-w-0">
            <Moon className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">{cycleResolution.weekend_notice || 'Trường nghỉ cuối tuần'}</span>
          </span>
          {cycleResolution.preview_label && (
            <span className="px-2.5 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 font-bold text-xs shrink-0">
              {cycleResolution.preview_label}
            </span>
          )}
        </div>
      )}

      {/* Collapsed State Bar (Compact view for Teacher portal) */}
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-700 truncate">
              {todayMeals.length > 0
                ? `${todayMeals.length} món ăn đã lên lịch (Bấm để xem chi tiết)`
                : 'Nhà trường đang cập nhật thực đơn'}
            </span>
          </div>
          <span className="text-teal-700 font-bold flex items-center gap-1 shrink-0">
            Mở rộng <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* Expanded Meals Content */}
      {!isCollapsed && (
        <>
          {todayMeals.length === 0 ? (
            <div className="py-5 px-3 text-center bg-amber-50/30 border border-dashed border-amber-200/80 rounded-xl">
              <p className="text-xs font-semibold text-slate-600">
                Nhà trường đang cập nhật thực đơn dinh dưỡng hôm nay
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {groupedSessions.map(({ meta, meals }) => {
                const SessionIcon = meta.icon;

                return (
                  <div key={meta.sessionKey} className="space-y-2">
                    {/* Session Sub-header */}
                    <div className="flex items-center gap-2 px-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder} shrink-0`}
                      >
                        <SessionIcon className="w-3.5 h-3.5" />
                        <span>{meta.title}</span>
                      </span>
                      <div className="h-px bg-slate-100 flex-1 min-w-0" />
                    </div>

                    {/* Meal items for this session */}
                    <div className="space-y-2">
                      {meals.map((meal) => {
                        const dishRole = DISH_ROLE_LABEL[meal.meal_type as MealCategory] || {
                          roleLabel: 'Món ăn',
                          chipBg: 'bg-slate-50',
                          chipText: 'text-slate-700',
                        };

                        const allergenCheck = studentAllergies
                          ? checkDishAllergen(meal.dish_name, meal.allergens, studentAllergies)
                          : { hasAllergen: false };

                        return (
                          <div
                            key={meal.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                              allergenCheck.hasAllergen
                                ? 'bg-rose-50/40 border-rose-200'
                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                            }`}
                          >
                            {/* Square thumbnail: 12x12 (48px) with 3-tier fallback */}
                            <MealThumbnail
                              meal={meal}
                              fallbackIcon={meta.icon}
                              alt={meal.dish_name}
                            />

                            {/* Dish Info without repetitive prefixes */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-md font-semibold ${dishRole.chipBg} ${dishRole.chipText} shrink-0`}
                                >
                                  {dishRole.roleLabel}
                                </span>

                                {allergenCheck.hasAllergen && (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                                    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>{allergenCheck.warningLabel || 'Cảnh báo dị ứng'}</span>
                                  </span>
                                )}
                              </div>

                              <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 min-w-0">
                                {meal.dish_name}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
