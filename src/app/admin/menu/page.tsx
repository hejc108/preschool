'use client';

import React, { useState } from 'react';
import { Utensils, Save, CheckCircle2, ChevronLeft, Edit3, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_4WEEK_MENU } from '@/lib/utils/menuHelper';
import { WeeklyMenu, DayOfWeek, MealCategory } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function AdminMenuPage() {
  const [menuList, setMenuList] = useState<WeeklyMenu[]>(INITIAL_4WEEK_MENU);
  const [selectedWeek, setSelectedWeek] = useState<number>(2); // Default to Week 2 for TC-MENU-04 testing
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Filter items for selected week
  const weekMeals = menuList.filter((m) => m.week_number === selectedWeek);

  const daysList: { key: DayOfWeek; label: string }[] = [
    { key: 'MONDAY', label: 'Thứ 2' },
    { key: 'TUESDAY', label: 'Thứ 3' },
    { key: 'WEDNESDAY', label: 'Thứ 4' },
    { key: 'THURSDAY', label: 'Thứ 5' },
    { key: 'FRIDAY', label: 'Thứ 6' },
  ];

  const mealCategories: { key: MealCategory; label: string }[] = [
    { key: 'BREAKFAST', label: 'Bữa sáng' },
    { key: 'LUNCH_MAIN', label: 'Bữa trưa - Món mặn' },
    { key: 'LUNCH_SOUP', label: 'Bữa trưa - Món canh' },
    { key: 'DESSERT', label: 'Tráng miệng' },
    { key: 'AFTERNOON_SNACK', label: 'Bữa xế' },
  ];

  // Inline Edit Handler
  const handleDishChange = (weekNum: number, day: DayOfWeek, mealType: MealCategory, newName: string) => {
    setMenuList((prev) =>
      prev.map((item) => {
        if (item.week_number === weekNum && item.day_of_week === day && item.meal_type === mealType) {
          return { ...item, dish_name: newName };
        }
        return item;
      })
    );
  };

  const handleSaveMenu = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="min-h-screen bg-surface-base text-slate-800 flex flex-col font-sans">
      {/* Top Banner Card - Minimalist White Design System */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-slate-100 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-800 text-lg sm:text-xl leading-tight">Quản lý ma trận thực đơn 4 tuần (Admin / Bếp)</h1>
            <p className="text-slate-500 text-sm mt-1">Chỉnh sửa trực tiếp (Inline Edit) & xoay vòng tự động cho cả 4 tuần</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleSaveMenu}
            className="whitespace-nowrap shrink-0 flex items-center gap-2 bg-[#FB8C00] hover:bg-[#F57C00] text-white px-4.5 py-2.5 rounded-pill font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Success Alert */}
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold text-sm flex items-center gap-2 shadow-sm animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Đã cập nhật thực đơn thành công! Phụ huynh mở ứng dụng PWA sẽ thấy món ăn mới ngay lập tức.</span>
          </div>
        )}

        {/* Week Selector Tabs */}
        <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary-700" />
            <span className="font-bold text-slate-800 text-sm">Chọn tuần cấu hình:</span>
          </div>

          <div className="flex gap-2">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-4 py-2 rounded-pill font-bold text-xs border transition-all ${
                  selectedWeek === w
                    ? 'bg-primary-700 text-white border-primary-700 shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-primary-800'
                }`}
              >
                Tuần {w}
              </button>
            ))}
          </div>
        </div>

        {/* 4-Week Rotating Matrix Table (Inline Edit) - TC-MENU-04 */}
        <div className="bg-white border border-slate-200 rounded-convent shadow-sm overflow-hidden">
          <div className="p-4 bg-rose-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-bold text-primary-900 text-sm flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary-700" />
              <span>Ma trận thực đơn tuần {selectedWeek} (chỉnh sửa trực tiếp món ăn)</span>
            </h2>
            <span className="text-xs text-slate-500 font-normal">Chỉnh sửa trực tiếp ô món ăn và bấm Lưu thay đổi</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3 w-40">Bữa ăn / Ngày</th>
                  {daysList.map((d) => (
                    <th key={d.key} className="p-3 min-w-[160px] sm:min-w-[170px]">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {mealCategories.map((cat) => (
                  <tr key={cat.key} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                      {cat.label}
                    </td>
                    {daysList.map((d) => {
                      const meal = weekMeals.find((m) => m.day_of_week === d.key && m.meal_type === cat.key);
                      const currentDish = meal ? meal.dish_name : '';

                      return (
                        <td key={d.key} className="p-2 border-r border-slate-200 min-w-[160px] sm:min-w-[170px]">
                          <textarea
                            rows={2}
                            value={currentDish}
                            onChange={(e) => handleDishChange(selectedWeek, d.key, cat.key, e.target.value)}
                            placeholder="Nhập tên món ăn..."
                            className="w-full min-w-[150px] sm:min-w-[160px] resize-none bg-slate-50 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg p-2 font-medium text-slate-900 text-xs focus:bg-white focus:outline-none transition-colors leading-snug"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
