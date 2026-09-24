'use client';

import React, { useState } from 'react';
import { ChevronLeft, Utensils, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { getCurrentMenuWeek, getDayOfWeekEnum, INITIAL_4WEEK_MENU, checkDishAllergen } from '@/lib/utils/menuHelper';
import { DayOfWeek, MealCategory } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function ParentMenuPage() {
  const defaultWeek = getCurrentMenuWeek();
  const defaultDay = getDayOfWeekEnum();

  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeek);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(defaultDay);
  const [studentAllergies] = useState<string>('Hải sản (Tôm, Cua)'); // Test student allergies

  // Filter menu items for selected week and day
  const filteredMeals = INITIAL_4WEEK_MENU.filter(
    (m) => m.week_number === selectedWeek && m.day_of_week === selectedDay
  );

  const daysList: { key: DayOfWeek; label: string }[] = [
    { key: 'MONDAY', label: 'Thứ 2' },
    { key: 'TUESDAY', label: 'Thứ 3' },
    { key: 'WEDNESDAY', label: 'Thứ 4' },
    { key: 'THURSDAY', label: 'Thứ 5' },
    { key: 'FRIDAY', label: 'Thứ 6' },
  ];

  const mealCategories: { key: MealCategory; label: string; icon: string }[] = [
    { key: 'BREAKFAST', label: 'Bữa sáng (07:30)', icon: '🥣' },
    { key: 'LUNCH_MAIN', label: 'Bữa trưa - Món mặn (11:00)', icon: '🍲' },
    { key: 'LUNCH_SOUP', label: 'Bữa trưa - Món canh (11:00)', icon: '🥣' },
    { key: 'DESSERT', label: 'Tráng miệng (11:30)', icon: '🍎' },
    { key: 'AFTERNOON_SNACK', label: 'Bữa xế (14:15)', icon: '🥛' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans pb-10">
      {/* Top Header */}
      <header className="p-4 bg-primary-700 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/parent" className="w-9 h-9 rounded-full bg-primary-800 hover:bg-primary-900 flex items-center justify-center text-white transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Thực Đơn Xoay Vòng 4 Tuần</h1>
            <p className="text-xs text-rose-100 font-medium">Mầm Non Sương Mai</p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      {/* 1. WEEK SELECTOR TABS (Tuần 1, 2, 3, 4) - TC-MENU-02 */}
      <div className="p-3 bg-white border-b border-slate-200 shadow-sm">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 px-1 flex items-center justify-between">
          <span>Chọn Tuần Thực Đơn (Modulo 4)</span>
          {selectedWeek === defaultWeek && (
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-200 font-bold text-[10px]">
              ★ Tuần Hiện Tại
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((w) => {
            const isSelected = selectedWeek === w;
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`min-w-[70px] sm:min-w-[84px] h-[36px] rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary-700 text-white shadow-sm font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Tuần {w}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. DAY OF WEEK SELECTOR (Thứ 2 -> Thứ 6) */}
      <div className="flex bg-slate-100 p-1 border-b border-slate-200 text-xs font-bold overflow-x-auto">
        {daysList.map((d) => {
          const isSelected = selectedDay === d.key;
          return (
            <button
              key={d.key}
              onClick={() => setSelectedDay(d.key)}
              className={`flex-1 py-2 px-2 text-center rounded-lg transition-all shrink-0 ${
                isSelected
                  ? 'bg-white text-sky-700 shadow-sm font-bold border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {/* 3. MEALS TIMELINE LIST FOR SELECTED DAY */}
      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-sky-900 flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-sky-600" />
            <span>Thực Đơn Ngày {daysList.find((d) => d.key === selectedDay)?.label} (Tuần {selectedWeek})</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">Dị ứng bé: {studentAllergies}</span>
        </div>

        <div className="space-y-3">
          {mealCategories.map((cat) => {
            const meal = filteredMeals.find((m) => m.meal_type === cat.key);
            const dishName = meal ? meal.dish_name : 'Theo kế hoạch nhà bếp';
            const dishAllergens = meal?.allergens;
            const allergenCheck = checkDishAllergen(dishName, dishAllergens, studentAllergies);

            return (
              <div
                key={cat.key}
                className={`p-4 bg-white border rounded-convent shadow-sm space-y-2 relative transition-all ${
                  allergenCheck.hasAllergen ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </span>

                  {/* TC-MENU-03 Allergen Badge */}
                  {allergenCheck.hasAllergen && (
                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-pill text-[10px] font-bold flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>{allergenCheck.warningLabel || 'Cảnh báo dị ứng'}</span>
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900">{dishName}</h3>

                {allergenCheck.hasAllergen && (
                  <p className="text-[11px] text-rose-700 italic border-t border-rose-100 pt-1.5">
                    * Lưu ý: Món ăn này chứa thành phần dị ứng trùng với hồ sơ của bé. Nhân sự bếp sẽ tự động chuyển đổi món thay thế an toàn.
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
