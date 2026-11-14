'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  Utensils,
  Save,
  CheckCircle2,
  ChevronLeft,
  Edit3,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
  CalendarDays,
  RefreshCw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import defaultWeeklyMenu from '@/lib/data/weekly_menu.json';
import { INITIAL_4WEEK_MENU, resolveMenuCycleContext } from '@/lib/utils/menuHelper';
import {
  WeeklyMenu,
  DayOfWeek,
  MealCategory,
  MenuCycleResolution,
} from '@/lib/types/schema';
import { MenuCycleSettingsPanel } from '@/components/admin/MenuCycleSettingsPanel';

const LOCAL_STORAGE_KEY = 'suongmai_weekly_menu';

function AdminMenuContent() {
  const searchParams = useSearchParams();
  const [isCycleModalOpen, setIsCycleModalOpen] = useState<boolean>(() => {
    const tab = searchParams.get('tab');
    return tab === 'cycle' || tab === 'settings';
  });

  const [menuList, setMenuList] = useState<WeeklyMenu[]>(
    (defaultWeeklyMenu as WeeklyMenu[]) || INITIAL_4WEEK_MENU
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(2); // Default to Week 2 for TC-MENU-04 testing
  const [cycleResolution, setCycleResolution] = useState<MenuCycleResolution>(() =>
    resolveMenuCycleContext()
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync modal state if query param changes (e.g. forward/back navigation or redirected from /admin/menu/settings)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'cycle' || tab === 'settings') {
      setIsCycleModalOpen(true);
    }
  }, [searchParams]);

  const handleCloseCycleModal = () => {
    setIsCycleModalOpen(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/admin/menu');
    }
  };

  const fetchMenuFromServer = useCallback(async (hasLocal: boolean) => {
    try {
      const res = await fetch('/api/admin/menu', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.cycle) {
          setCycleResolution(json.cycle);
        }
        if (json.menu && Array.isArray(json.menu) && json.menu.length > 0) {
          if (json.has_db || !hasLocal) {
            setMenuList(json.menu);
            if (typeof window !== 'undefined') {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.menu));
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching menu from server:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

    void fetchMenuFromServer(hasLocal);
  }, [fetchMenuFromServer]);

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
  const handleDishChange = (
    weekNum: number,
    day: DayOfWeek,
    mealType: MealCategory,
    newName: string
  ) => {
    setMenuList((prev) => {
      const exists = prev.some(
        (item) =>
          item.week_number === weekNum &&
          item.day_of_week === day &&
          item.meal_type === mealType
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
        if (
          item.week_number === weekNum &&
          item.day_of_week === day &&
          item.meal_type === mealType
        ) {
          return { ...item, dish_name: newName };
        }
        return item;
      });
    });
  };

  // Lưu thực đơn
  const handleSaveMenu = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    // 1. Lưu ngay vào LocalStorage phía Client (Chống mất dữ liệu tức thì trên thiết bị này)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(menuList));
      } catch (e) {}
    }

    // 2. Gửi request POST lên Server API để đồng bộ
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
      setErrorMessage(
        err?.message || 'Không thể kết nối đến máy chủ để lưu thực đơn.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-slate-800 flex flex-col font-sans">
      {/* Top Banner Card - Thiết kế 1 hàng thoáng, chuẩn phân cấp, không tab lặp */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sm:py-5 shadow-xs sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Bên trái: Nút quay lại & Tiêu đề chính */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-xs shrink-0 transition-colors"
              title="Quay lại Tổng quan Quản trị"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                Quản lý thực đơn
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                Lên thực đơn dinh dưỡng theo tuần và lịch xoay vòng tự động.
              </p>
            </div>
          </div>

          {/* Bên phải: Đúng 2 nút bấm chuẩn mực, không icon emoji trùng lặp */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start sm:self-auto">
            {/* Nút phụ: Cấu hình chu kỳ */}
            <button
              type="button"
              onClick={() => setIsCycleModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-full font-semibold text-xs sm:text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Cấu hình chu kỳ</span>
            </button>

            {/* Nút chính: Lưu thay đổi (Màu đỏ thương hiệu bg-red-600) */}
            <button
              type="button"
              onClick={handleSaveMenu}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 sm:py-2.5 rounded-full font-semibold text-xs sm:text-sm shadow-xs whitespace-nowrap bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white transition-all active:scale-95 cursor-pointer"
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
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Success Alert */}
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold text-sm flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Đã lưu thành công! Thực đơn tuần đã được cập nhật và đồng bộ sang ứng dụng Phụ huynh.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold text-sm flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage} (Dữ liệu đã được lưu dự phòng vào bộ nhớ trình duyệt).</span>
          </div>
        )}

        {/* Khung thông báo trạng thái gọn gàng 1 dòng duy nhất, không lặp nút */}
        <div className="bg-sky-50/80 border border-sky-200 rounded-xl px-4 py-3 shadow-2xs flex items-center gap-2.5 text-xs sm:text-sm text-sky-900">
          <CalendarDays className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            {cycleResolution.full_date_label} • Đang áp dụng:{' '}
            <strong className="font-semibold text-sky-950">
              Bộ thực đơn Tuần {cycleResolution.menu_week_number}
            </strong>{' '}
            ({cycleResolution.cycle_mode === 'MANUAL_CALENDAR'
              ? 'Chỉ định thủ công'
              : 'Chu kỳ xoay vòng 4 tuần'})
          </span>
        </div>

        {/* Week Selector Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary-700 shrink-0" />
            <span className="font-bold text-slate-800 text-sm">Chọn bộ thực đơn mẫu:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((w) => {
              const isLiveWeek = cycleResolution.menu_week_number === w;
              return (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`min-w-[96px] h-[36px] px-3.5 rounded-full text-sm font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    selectedWeek === w
                      ? 'bg-primary-700 text-white shadow-xs font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <span>Tuần {w}</span>
                  {isLiveWeek && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        selectedWeek === w
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Hôm nay
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weekly Menu Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-rose-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-bold text-primary-900 text-sm flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary-700" />
              <span>Thực đơn tuần {selectedWeek}</span>
            </h2>
            <span className="text-xs text-slate-500 font-normal">
              Nhập món ăn vào từng bữa và bấm &quot;Lưu thay đổi&quot;
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary-700 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Đang tải thực đơn tuần từ hệ thống...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3 min-w-[180px] whitespace-nowrap">Bữa ăn / Ngày</th>
                    {daysList.map((d) => (
                      <th
                        key={d.key}
                        className="p-3 min-w-[190px] sm:min-w-[200px] whitespace-nowrap"
                      >
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
                        const meal = weekMeals.find(
                          (m) => m.day_of_week === d.key && m.meal_type === cat.key
                        );
                        const currentDish = meal ? meal.dish_name : '';

                        return (
                          <td
                            key={d.key}
                            className="p-2 border-r border-slate-200 min-w-[190px] sm:min-w-[200px]"
                          >
                            <textarea
                              rows={2}
                              value={currentDish}
                              onChange={(e) =>
                                handleDishChange(
                                  selectedWeek,
                                  d.key,
                                  cat.key,
                                  e.target.value
                                )
                              }
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

      {/* Modal Hộp thoại Cấu hình chu kỳ thực đơn theo tháng */}
      {isCycleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
          onClick={handleCloseCycleModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Cấu hình chu kỳ thực đơn theo tháng
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Điều chỉnh chế độ xoay vòng tự động 4 tuần hoặc chỉ định thủ công theo tuần học trong tháng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCycleModal}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Đóng hộp thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              <MenuCycleSettingsPanel
                compact={false}
                onSaved={({ resolution }) => {
                  setCycleResolution(resolution);
                  handleCloseCycleModal();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <RefreshCw className="w-5 h-5 animate-spin text-primary-700" />
            <span>Đang tải thực đơn...</span>
          </div>
        </div>
      }
    >
      <AdminMenuContent />
    </Suspense>
  );
}
