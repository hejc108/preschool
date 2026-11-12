'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import {
  MenuCalendarAssignment,
  MenuCycleConfig,
  MenuCycleMode,
  MenuCycleResolution,
  MenuWeek5Fallback,
  MonthWeekInfo,
} from '@/lib/types/schema';
import {
  DEFAULT_MENU_CYCLE_CONFIG,
  getSchoolWeeksOfMonth,
  getVietnamDateParts,
  normalizeWeek5Fallback,
  resolveMenuCycleContext,
} from '@/lib/utils/menuHelper';

export interface MenuCycleSettingsPanelProps {
  /** Compact visual mode when embedded inside /admin/menu */
  compact?: boolean;
  /** Callback fired after settings are saved successfully */
  onSaved?: (payload: {
    config: MenuCycleConfig;
    resolution: MenuCycleResolution;
  }) => void;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, idx) => idx + 1);

/**
 * Reusable Admin panel for configuring monthly menu cycle mode:
 * - Mode 1 (AUTO_ROTATE_4): Auto-reset Tuần 1..4 every month + configurable Week 5 fallback (Tuần 1..4).
 * - Mode 2 (MANUAL_CALENDAR): Assign specific base menu set (1..4) per actual Mon-Fri school week of a month.
 */
export function MenuCycleSettingsPanel({
  compact = false,
  onSaved,
}: MenuCycleSettingsPanelProps) {
  const initialParts = useMemo(() => getVietnamDateParts(), []);

  const [selectedYear, setSelectedYear] = useState<number>(initialParts.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialParts.month);
  const [cycleMode, setCycleMode] = useState<MenuCycleMode>(DEFAULT_MENU_CYCLE_CONFIG.cycle_mode);
  const [week5Fallback, setWeek5Fallback] = useState<MenuWeek5Fallback>(
    DEFAULT_MENU_CYCLE_CONFIG.week_5_fallback
  );
  const [assignmentsByMonth, setAssignmentsByMonth] = useState<
    Record<string, MenuCalendarAssignment[]>
  >({});

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const monthKey = `${selectedYear}-${selectedMonth}`;

  const fetchSettings = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/menu/settings?year=${year}&month=${month}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Không thể tải cấu hình (${res.status})`);
      }

      if (json.config) {
        setCycleMode(
          json.config.cycle_mode === 'MANUAL_CALENDAR' ? 'MANUAL_CALENDAR' : 'AUTO_ROTATE_4'
        );
        setWeek5Fallback(
          normalizeWeek5Fallback(json.config.week_5_fallback ?? json.config.week5_fallback)
        );
      }

      const key = `${year}-${month}`;
      const loadedAssignments: MenuCalendarAssignment[] = Array.isArray(json.assignments)
        ? json.assignments
        : [];
      setAssignmentsByMonth((prev) => ({
        ...prev,
        [key]: loadedAssignments,
      }));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi tải cấu hình chu kỳ thực đơn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings(selectedYear, selectedMonth);
  }, [fetchSettings, selectedYear, selectedMonth]);

  const currentConfig: MenuCycleConfig = useMemo(
    () => ({
      id: 'default',
      cycle_mode: cycleMode,
      week_5_fallback: week5Fallback,
    }),
    [cycleMode, week5Fallback]
  );

  const currentMonthAssignments = useMemo(
    () => assignmentsByMonth[monthKey] || [],
    [assignmentsByMonth, monthKey]
  );

  // Today's resolution context using live form values so Admin immediately previews impact
  const liveTodayResolution = useMemo(
    () =>
      resolveMenuCycleContext({
        config: currentConfig,
        assignments: Object.values(assignmentsByMonth).flat(),
        displayYear: selectedYear,
        displayMonth: selectedMonth,
      }),
    [currentConfig, assignmentsByMonth, selectedYear, selectedMonth]
  );

  // School weeks (Mon-Fri only) of the currently viewed month
  const monthWeeks: MonthWeekInfo[] = useMemo(() => {
    const isCurrentEffectiveMonth =
      selectedYear === liveTodayResolution.year && selectedMonth === liveTodayResolution.month;

    return getSchoolWeeksOfMonth({
      year: selectedYear,
      month: selectedMonth,
      config: currentConfig,
      assignments: currentMonthAssignments,
      currentWeekOfMonth: isCurrentEffectiveMonth ? liveTodayResolution.week_of_month : null,
    });
  }, [
    selectedYear,
    selectedMonth,
    currentConfig,
    currentMonthAssignments,
    liveTodayResolution.year,
    liveTodayResolution.month,
    liveTodayResolution.week_of_month,
  ]);

  const handleShiftMonth = (delta: number) => {
    const nextDate = new Date(Date.UTC(selectedYear, selectedMonth - 1 + delta, 1));
    setSelectedYear(nextDate.getUTCFullYear());
    setSelectedMonth(nextDate.getUTCMonth() + 1);
  };

  const handleAssignmentChange = (weekInfo: MonthWeekInfo, assignedMenuWeek: number) => {
    setAssignmentsByMonth((prev) => {
      const existing = prev[monthKey] || [];
      const filtered = existing.filter((a) => Number(a.week_of_month) !== weekInfo.week_of_month);
      return {
        ...prev,
        [monthKey]: [
          ...filtered,
          {
            year: selectedYear,
            month: selectedMonth,
            week_of_month: weekInfo.week_of_month,
            assigned_menu_week: assignedMenuWeek,
            week_start_date: weekInfo.start_date,
            week_end_date: weekInfo.end_date,
          },
        ],
      };
    });
  };

  const handleSaveSettings = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    setSavedNotice(null);

    try {
      const payloadAssignments = monthWeeks.map((w) => ({
        week_of_month: w.week_of_month,
        assigned_menu_week: w.assigned_menu_week,
      }));

      const res = await fetch('/api/admin/menu/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_mode: cycleMode,
          week_5_fallback: week5Fallback,
          year: selectedYear,
          month: selectedMonth,
          assignments: cycleMode === 'MANUAL_CALENDAR' ? payloadAssignments : undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Không thể lưu cấu hình (${res.status})`);
      }

      if (Array.isArray(json.assignments)) {
        setAssignmentsByMonth((prev) => ({
          ...prev,
          [monthKey]: json.assignments,
        }));
      }

      const modeText =
        cycleMode === 'MANUAL_CALENDAR'
          ? `Chỉ định thủ công (Tháng ${selectedMonth}/${selectedYear})`
          : `Tự động xoay vòng 4 tuần (Tuần 5 → Tuần ${week5Fallback})`;

      setSavedNotice(
        json.warning
          ? `Đã lưu: ${modeText}. Lưu ý: ${json.warning}`
          : `Đã lưu thành công cấu hình: ${modeText}`
      );
      setTimeout(() => setSavedNotice(null), 5000);

      if (onSaved && json.config && json.resolution) {
        onSaved({ config: json.config, resolution: json.resolution });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi lưu cấu hình chu kỳ thực đơn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${
        compact ? '' : ''
      }`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              Cấu hình chu kỳ thực đơn theo tháng (Thứ 2 – Thứ 6)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chỉ tính tuần có ngày đi học từ Thứ 2 đến Thứ 6. Nếu mùng 1 là Thứ 7/CN, Thứ 2 đầu
              tiên bắt đầu Tuần 1.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-primary-700 hover:bg-primary-800 disabled:bg-slate-300 text-white shadow-sm transition-all cursor-pointer shrink-0"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu cấu hình...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Lưu cấu hình chu kỳ</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Alerts */}
        {savedNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs sm:text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Status Preview Banner */}
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-sky-900">
              <CalendarDays className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Trạng thái áp dụng hôm nay:</span>
              <span className="text-sky-700">{liveTodayResolution.full_date_label}</span>
            </div>
            <div className="text-slate-600 flex flex-wrap items-center gap-2">
              {liveTodayResolution.is_weekend ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                  {liveTodayResolution.weekend_notice} • {liveTodayResolution.preview_label}
                </span>
              ) : null}
              <span>
                Đang hiển thị dữ liệu của{' '}
                <strong className="text-primary-800">
                  Bộ thực đơn Tuần {liveTodayResolution.menu_week_number}
                </strong>{' '}
                (Ngày trong ma trận: <strong>{liveTodayResolution.weekday_vi}</strong>)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchSettings(selectedYear, selectedMonth)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-sky-200 text-sky-800 hover:bg-sky-100 font-semibold self-start sm:self-center cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Mode Selector (2 Modes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCycleMode('AUTO_ROTATE_4')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              cycleMode === 'AUTO_ROTATE_4'
                ? 'border-primary-600 bg-rose-50/50 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Chế độ 1: Tự động xoay vòng 4 tuần
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  cycleMode === 'AUTO_ROTATE_4'
                    ? 'bg-primary-700 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {cycleMode === 'AUTO_ROTATE_4' ? 'Đang chọn' : 'Tự động'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Mỗi đầu tháng tự động bắt đầu lại từ Tuần 1 → Tuần 4 theo lịch đi học Thứ 2 – Thứ 6.
              Nếu tháng có 5 tuần học sẽ áp dụng quy tắc tuần dự phòng bên dưới.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setCycleMode('MANUAL_CALENDAR')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              cycleMode === 'MANUAL_CALENDAR'
                ? 'border-primary-600 bg-rose-50/50 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Chế độ 2: Chỉ định thủ công theo từng tuần
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  cycleMode === 'MANUAL_CALENDAR'
                    ? 'bg-primary-700 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {cycleMode === 'MANUAL_CALENDAR' ? 'Đang chọn' : 'Thủ công'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Hiển thị từng tuần học thực tế trong tháng (Tuần 1 → Tuần 4/5 kèm khoảng ngày T2–T6)
              và cho phép gán chính xác bộ thực đơn (Tuần 1..4) cho từng tuần.
            </p>
          </button>
        </div>

        {/* Mode 1 Option: Week 5 Fallback Dropdown (Tuần 1..4) */}
        {cycleMode === 'AUTO_ROTATE_4' && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label
                htmlFor="week-5-fallback-select"
                className="flex items-center gap-2 text-xs font-bold text-slate-800"
              >
                <Info className="w-4 h-4 text-primary-700 shrink-0" />
                <span>Thực đơn dự phòng khi tháng có Tuần học thứ 5 (Tuần 5):</span>
              </label>
              <p className="text-[11px] text-slate-500 pl-6">
                Tự động lấy bộ thực đơn của tuần được chọn để phục vụ từ Thứ 2 đến Thứ 6 của Tuần 5.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
              <span className="text-xs font-semibold text-slate-600">Lặp lại theo:</span>
              <select
                id="week-5-fallback-select"
                value={week5Fallback}
                onChange={(e) => setWeek5Fallback(normalizeWeek5Fallback(e.target.value))}
                className="h-9 px-3 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:border-primary-600 focus:outline-none cursor-pointer"
              >
                {([1, 2, 3, 4] as MenuWeek5Fallback[]).map((option) => (
                  <option key={option} value={option}>
                    Tuần {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Month Picker + Calendar Weeks Preview / Manual Assignment Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-700" />
              <span className="font-bold text-slate-800 text-xs sm:text-sm">
                {cycleMode === 'MANUAL_CALENDAR'
                  ? `Phân bổ bộ thực đơn tháng ${selectedMonth}/${selectedYear}`
                  : `Lịch tuần học dự kiến tháng ${selectedMonth}/${selectedYear}`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-8 px-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-8 px-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
              >
                {[initialParts.year - 1, initialParts.year, initialParts.year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary-700" />
              <span>Đang tải lịch tuần học tháng {selectedMonth}/{selectedYear}...</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {monthWeeks.map((week) => (
                <div
                  key={week.week_of_month}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    week.is_current ? 'bg-sky-50/70' : 'bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        Tuần {week.week_of_month} (Tháng {week.month})
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {week.school_days_label}
                      </span>
                      {week.is_current && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                          ★ Tuần hiện tại
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {week.days.map((d) => (
                        <span
                          key={d.date}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            d.date === liveTodayResolution.effective_date
                              ? 'bg-sky-600 text-white border-sky-600 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {d.short_label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {cycleMode === 'MANUAL_CALENDAR' ? (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-500">
                          Áp dụng:
                        </label>
                        <select
                          value={week.assigned_menu_week}
                          onChange={(e) =>
                            handleAssignmentChange(week, Number(e.target.value))
                          }
                          className="h-9 px-3 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:border-primary-600 focus:outline-none"
                        >
                          {[1, 2, 3, 4].map((setNum) => (
                            <option key={setNum} value={setNum}>
                              Bộ thực đơn Tuần {setNum}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-rose-50 text-primary-800 border border-rose-200 text-xs font-bold">
                        {week.week_of_month === 5
                          ? `Áp dụng theo Thực đơn Tuần ${week.assigned_menu_week}`
                          : `Bộ thực đơn Tuần ${week.assigned_menu_week}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
