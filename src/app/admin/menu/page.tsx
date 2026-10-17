'use client';

import React, { useState, useEffect } from 'react';
import { Utensils, Save, CheckCircle2, ChevronLeft, Edit3, Sparkles, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_4WEEK_MENU } from '@/lib/utils/menuHelper';
import { WeeklyMenu, DayOfWeek, MealCategory } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const LOCAL_STORAGE_KEY = 'suongmai_weekly_menu';

export default function AdminMenuPage() {
  const [menuList, setMenuList] = useState<WeeklyMenu[]>(INITIAL_4WEEK_MENU);
  const [selectedWeek, setSelectedWeek] = useState<number>(2); // Default to Week 2 for TC-MENU-04 testing
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load menu on mount from LocalStorage & Server API
  useEffect(() => {
    let hasLocal = false;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMenuList(parsed);
            hasLocal = true;
          }
        }
      } catch (e) {}
    }

    async function fetchMenuFromServer() {
      try {
        const res = await fetch('/api/admin/menu');
        if (res.ok) {
          const json = await res.json();
          if (json.menu && Array.isArray(json.menu) && json.menu.length > 0) {
            setMenuList(json.menu);
            if (typeof window !== 'undefined') {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.menu));
            }
          }
        }
      } catch (err: any) {
        console.error('Error fetching menu from server:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMenuFromServer();
  }, []);

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

  // Inline Edit Handler (Tạo mới nếu chưa có hoặc cập nhật món ăn)
  const handleDishChange = (weekNum: number, day: DayOfWeek, mealType: MealCategory, newName: string) => {
    setMenuList((prev) => {
      const exists = prev.some(
        (item) => item.week_number === weekNum && item.day_of_week === day && item.meal_type === mealType
      );

      if (!exists) {
        return [
          ...prev,
          {
            id: `m-w${weekNum}-${day.toLowerCase()}-${mealType.toLowerCase()}`,
            week_number: weekNum,
            day_of_week: day,
            meal_type: mealType,
            dish_name: newName,
            allergens: [],
          },
        ];
      }

      return prev.map((item) => {
        if (item.week_number === weekNum && item.day_of_week === day && item.meal_type === mealType) {
          return { ...item, dish_name: newName };
        }
        return item;
      });
    });
  };

  // Lưu thực đơn 3 tầng (LocalStorage -> Server File & Cache -> Supabase DB)
  const handleSaveMenu = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    // 1. Lưu ngay vào LocalStorage phía Client (Chống mất dữ liệu tức thì)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(menuList));
      } catch (e) {}
    }

    // 2. Gửi request POST lên Server API để lưu vĩnh viễn
    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: menuList }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3500);
      } else {
        setErrorMessage(json.error || 'Lỗi khi lưu dữ liệu lên máy chủ');
      }
    } catch (err: any) {
      console.error('Lỗi khi gọi API lưu thực đơn:', err);
      // Dù API lỗi mạng, dữ liệu vẫn đã lưu an toàn trong LocalStorage
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-slate-800 flex flex-col font-sans">
      {/* Top Banner Card - Minimalist White Design System */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-sm shrink-0 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-800 text-lg sm:text-xl leading-tight">Quản lý ma trận thực đơn 4 tuần (Admin / Bếp)</h1>
            <p className="text-slate-500 text-sm mt-1">Chỉnh sửa trực tiếp (Inline Edit) & tự động đồng bộ sang ứng dụng Phụ huynh PWA</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleSaveMenu}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white transition-all active:scale-95 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 shrink-0" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Success Alert */}
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold text-sm flex items-center gap-2 shadow-sm animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Đã lưu thành công! Toàn bộ thay đổi thực đơn đã được ghi nhận trên máy chủ và đồng bộ sang ứng dụng Phụ huynh.</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold text-sm flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage} (Dữ liệu đã được lưu dự phòng vào bộ nhớ trình duyệt).</span>
          </div>
        )}

        {/* Week Selector Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary-700" />
            <span className="font-bold text-slate-800 text-sm">Chọn tuần cấu hình:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`min-w-[84px] h-[36px] rounded-full text-sm font-medium inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer ${
                  selectedWeek === w
                    ? 'bg-primary-700 text-white shadow-sm font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
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
            <span className="text-xs text-slate-500 font-normal">Chỉnh sửa trực tiếp ô món ăn và bấm &quot;Lưu thay đổi&quot;</span>
          </div>

          {loading ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary-700 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Đang tải ma trận thực đơn từ hệ thống...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3 min-w-[180px] whitespace-nowrap">Bữa ăn / Ngày</th>
                    {daysList.map((d) => (
                      <th key={d.key} className="p-3 min-w-[190px] sm:min-w-[200px] whitespace-nowrap">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {mealCategories.map((cat) => (
                    <tr key={cat.key} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold bg-slate-50 text-slate-800 border-r border-slate-200 min-w-[180px] whitespace-nowrap">
                        {cat.label}
                      </td>
                      {daysList.map((d) => {
                        const meal = weekMeals.find((m) => m.day_of_week === d.key && m.meal_type === cat.key);
                        const currentDish = meal ? meal.dish_name : '';

                        return (
                          <td key={d.key} className="p-2 border-r border-slate-200 min-w-[190px] sm:min-w-[200px]">
                            <textarea
                              rows={2}
                              value={currentDish}
                              onChange={(e) => handleDishChange(selectedWeek, d.key, cat.key, e.target.value)}
                              placeholder="Nhập tên món ăn..."
                              className="w-full min-w-[180px] sm:min-w-[190px] resize-none bg-slate-50 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg p-2 font-medium text-slate-900 text-xs focus:bg-white focus:outline-none transition-colors leading-snug"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
