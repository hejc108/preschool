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
  Camera,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
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
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // State quản lý upload & sửa ảnh thực tế món ăn
  const [editingImageMeal, setEditingImageMeal] = useState<{
    weekNumber: number;
    dayOfWeek: DayOfWeek;
    mealType: MealCategory;
    dishName: string;
    imageUrl?: string | null;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const fetchMenuFromServer = useCallback(async (localDraft: WeeklyMenu[] | null) => {
    try {
      const res = await fetch('/api/admin/menu', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.cycle) {
          setCycleResolution(json.cycle);
        }
        if (json.menu && Array.isArray(json.menu) && json.menu.length > 0) {
          const isPendingSync =
            typeof window !== 'undefined' &&
            localStorage.getItem('suongmai_menu_pending_sync') === 'true';

          // Kiểm tra xem bản nháp trong localStorage có món ăn khác biệt so với CSDL server không
          const hasLocalEdits =
            localDraft &&
            localDraft.length > 0 &&
            (isPendingSync || JSON.stringify(localDraft) !== JSON.stringify(json.menu));

          if (hasLocalEdits && localDraft) {
            // Giữ nguyên bản nháp đã lưu trên trình duyệt của người dùng để không mất dữ liệu chỉnh sửa
            setMenuList(localDraft);
            setSyncNotice('Đang tự động đồng bộ bản nháp thực đơn đã lưu trên trình duyệt này lên máy chủ...');

            // Tự động đồng bộ bản nháp lên CSDL Supabase
            try {
              const syncRes = await fetch('/api/admin/menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menu: localDraft }),
              });
              const syncJson = await syncRes.json().catch(() => ({}));
              if (syncRes.ok && syncJson.success) {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('suongmai_menu_pending_sync');
                }
                setSyncNotice('Đã đồng bộ thành công toàn bộ bản nháp thực đơn từ trình duyệt lên CSDL Supabase!');
                setTimeout(() => setSyncNotice(null), 4000);
              } else {
                setSyncNotice(null);
                setErrorMessage(syncJson.error || 'Lỗi khi đồng bộ dữ liệu bản nháp lên CSDL');
              }
            } catch {
              setSyncNotice(null);
            }
          } else {
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
    let localDraft: WeeklyMenu[] | null = null;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMenuList(parsed);
            localDraft = parsed;
          }
        }
      } catch (e) {}
    }

    void fetchMenuFromServer(localDraft);
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

  // Cập nhật ảnh món ăn
  const handleDishImageChange = (
    weekNum: number,
    day: DayOfWeek,
    mealType: MealCategory,
    newImageUrl: string | null
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
            dish_name: '',
            allergens: [],
            image_url: newImageUrl,
          },
        ];
      }

      return prev.map((item) => {
        if (
          item.week_number === weekNum &&
          item.day_of_week === day &&
          item.meal_type === mealType
        ) {
          return { ...item, image_url: newImageUrl };
        }
        return item;
      });
    });
  };

  // Tải ảnh thực tế món ăn lên máy chủ
  const handleUploadMealImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingImageMeal) return;

    setIsUploadingImage(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/menu/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.url) {
        throw new Error(json.error || 'Không thể tải ảnh món ăn lên máy chủ.');
      }

      handleDishImageChange(
        editingImageMeal.weekNumber,
        editingImageMeal.dayOfWeek,
        editingImageMeal.mealType,
        json.url
      );

      setEditingImageMeal((prev) => (prev ? { ...prev, imageUrl: json.url } : null));
    } catch (err: any) {
      console.error('Lỗi tải ảnh món ăn:', err);
      setUploadError(err?.message || 'Lỗi kết nối khi tải ảnh lên.');
    } finally {
      setIsUploadingImage(false);
      // Reset input value
      e.target.value = '';
    }
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
        if (typeof window !== 'undefined') {
          localStorage.removeItem('suongmai_menu_pending_sync');
        }
        setTimeout(() => setSavedSuccess(false), 3500);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('suongmai_menu_pending_sync', 'true');
        }
        setErrorMessage(json.error || 'Lỗi khi lưu dữ liệu lên máy chủ');
      }
    } catch (err: any) {
      console.error('Lỗi khi gọi API lưu thực đơn:', err);
      if (typeof window !== 'undefined') {
        localStorage.setItem('suongmai_menu_pending_sync', 'true');
      }
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

        {/* Sync Notice Alert */}
        {syncNotice && (
          <div className="p-4 bg-sky-50 border border-sky-300 rounded-xl text-sky-950 font-bold text-sm flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
            <span>{syncNotice}</span>
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
                            <div className="space-y-1.5">
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

                              {/* Media management trigger for school actual meal photo */}
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                {meal?.image_url ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingImageMeal({
                                        weekNumber: selectedWeek,
                                        dayOfWeek: d.key,
                                        mealType: cat.key,
                                        dishName: currentDish,
                                        imageUrl: meal.image_url,
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-semibold transition cursor-pointer"
                                    title="Bấm để xem hoặc đổi ảnh thực tế"
                                  >
                                    <img
                                      src={meal.image_url}
                                      alt={currentDish}
                                      className="w-4 h-4 rounded object-cover border border-emerald-400 shrink-0"
                                    />
                                    <span className="truncate max-w-[110px]">Có ảnh thực tế</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingImageMeal({
                                        weekNumber: selectedWeek,
                                        dayOfWeek: d.key,
                                        mealType: cat.key,
                                        dishName: currentDish,
                                        imageUrl: null,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-[11px] font-medium transition cursor-pointer"
                                    title="Thêm ảnh thực tế món ăn"
                                  >
                                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Thêm ảnh</span>
                                  </button>
                                )}
                              </div>
                            </div>
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

      {/* Modal Upload & Cập nhật ảnh thực tế món ăn */}
      {editingImageMeal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setEditingImageMeal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    Ảnh thực tế món ăn
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tuần {editingImageMeal.weekNumber} •{' '}
                    {daysList.find((d) => d.key === editingImageMeal.dayOfWeek)?.label} •{' '}
                    {mealCategories.find((c) => c.key === editingImageMeal.mealType)?.label}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingImageMeal(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-800">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-xs text-slate-500 font-semibold uppercase">Món ăn:</span>
                <p className="font-bold text-slate-900 text-sm">
                  {editingImageMeal.dishName || '(Chưa nhập tên món ăn)'}
                </p>
              </div>

              {/* Preview image */}
              <div className="text-center space-y-2">
                <span className="text-xs text-slate-500 font-semibold block">Hình ảnh hiển thị:</span>
                <div className="w-36 h-36 mx-auto rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center shadow-inner relative">
                  {editingImageMeal.imageUrl ? (
                    <img
                      src={editingImageMeal.imageUrl}
                      alt={editingImageMeal.dishName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={`/images/meals/${editingImageMeal.mealType.toLowerCase().replace(/_/g, '-')}.svg`}
                      alt="Ảnh mẫu"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-500 italic">
                  {editingImageMeal.imageUrl ? '✓ Đang dùng ảnh thực tế từ nhà trường' : 'Đang dùng ảnh minh họa mặc định'}
                </p>
              </div>

              {/* Upload error message */}
              {uploadError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload trigger */}
              <div className="space-y-2 pt-1">
                <label className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Đang tải ảnh lên...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 shrink-0" />
                      <span>Tải ảnh từ máy tính (Tối đa 8MB)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadMealImage}
                    disabled={isUploadingImage}
                    className="hidden"
                  />
                </label>

                {/* Direct URL input */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Hoặc dán trực tiếp liên kết ảnh (URL):
                  </label>
                  <input
                    type="url"
                    value={editingImageMeal.imageUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value.trim() || null;
                      handleDishImageChange(
                        editingImageMeal.weekNumber,
                        editingImageMeal.dayOfWeek,
                        editingImageMeal.mealType,
                        val
                      );
                      setEditingImageMeal((prev) => (prev ? { ...prev, imageUrl: val } : null));
                    }}
                    placeholder="https://.../mon-an.jpg"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-primary-500 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Delete / Clear button */}
              {editingImageMeal.imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    handleDishImageChange(
                      editingImageMeal.weekNumber,
                      editingImageMeal.dayOfWeek,
                      editingImageMeal.mealType,
                      null
                    );
                    setEditingImageMeal((prev) => (prev ? { ...prev, imageUrl: null } : null));
                  }}
                  className="w-full py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ảnh thực tế (Dùng lại ảnh minh họa)</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setEditingImageMeal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                Xong
              </button>
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
