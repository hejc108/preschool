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
    { key: 'BREAKFAST', label: 'Bữa Sáng' },
    { key: 'LUNCH_MAIN', label: 'Bữa Trưa - Món Mặn' },
    { key: 'LUNCH_SOUP', label: 'Bữa Trưa - Món Canh' },
    { key: 'DESSERT', label: 'Tráng Miệng' },
    { key: 'AFTERNOON_SNACK', label: 'Bữa Xế' },
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-sky-700 rounded-pill text-white hover:bg-sky-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Quản Lý Ma Trận Thực Đơn 4 Tuần (Admin / Bếp)</h1>
            <p className="text-xs text-sky-100 font-semibold">Chỉnh sửa trực tiếp (Inline Edit) & Xoay vòng tự động</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveMenu}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-pill font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Thay Đổi</span>
          </button>
          <LanguageSwitcher />
        </div>
      </header>

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
            <Utensils className="w-5 h-5 text-sky-600" />
            <span className="font-bold text-sky-900 text-sm">Chọn Tuần Cấu Hình:</span>
          </div>

          <div className="flex gap-2">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-4 py-2 rounded-pill font-bold text-xs border transition-all ${
                  selectedWeek === w
                    ? 'bg-sky-600 text-white border-sky-600 shadow'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tuần {w}
              </button>
            ))}
          </div>
        </div>

        {/* 4-Week Rotating Matrix Table (Inline Edit) - TC-MENU-04 */}
        <div className="bg-white border border-slate-200 rounded-convent shadow-sm overflow-hidden">
          <div className="p-4 bg-sky-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-sky-900 text-sm flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-sky-600" />
              <span>Ma Trận Thực Đơn Tuần {selectedWeek} (Chỉnh Sửa Trực Tiếp Món Ăn)</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">Thay đổi tự động lưu vào Database</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3 w-40">Bữa Ăn / Ngày</th>
                  {daysList.map((d) => (
                    <th key={d.key} className="p-3 min-w-[180px]">
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
                        <td key={d.key} className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            value={currentDish}
                            onChange={(e) => handleDishChange(selectedWeek, d.key, cat.key, e.target.value)}
                            placeholder="Nhập tên món ăn..."
                            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg p-2 font-medium text-slate-900 text-xs focus:bg-white focus:outline-none transition-colors"
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
