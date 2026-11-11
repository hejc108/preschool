'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  Utensils,
  ChevronRight,
  CalendarX,
  Check,
  X,
  Megaphone,
  Send,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { INITIAL_CLASSES, INITIAL_KITCHEN_ORDERS } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { DEFAULT_CLASSES_LIST } from '@/lib/constants/classes';

interface AdminAbsenceItem {
  id: string;
  student_id: string;
  student_name: string;
  student_code?: string;
  class_id: string | null;
  class_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  submitted_by_name: string;
  status: string;
  is_fee_credited: boolean;
  acknowledged_by_teacher: boolean;
  submitted_at: string;
}

interface AdminAnnouncementItem {
  id: string;
  title: string;
  content: string;
  target_role: 'ALL' | 'TEACHER' | 'PARENT';
  notification_channel: 'TEACHER' | 'PARENT';
  created_at: string;
}

export default function AdminDashboardPage() {
  const { t, language } = useLanguage();
  const [classes] = useState(INITIAL_CLASSES);
  const [kitchenOrders] = useState(INITIAL_KITCHEN_ORDERS);

  // School-wide Absence Requests from Postgres (/api/absences)
  const [absences, setAbsences] = useState<AdminAbsenceItem[]>([]);
  const [loadingAbsences, setLoadingAbsences] = useState<boolean>(true);
  const [absenceFilter, setAbsenceFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [updatingAbsenceId, setUpdatingAbsenceId] = useState<string | null>(null);

  // School-wide Announcement Broadcaster (/api/announcements)
  const [announcements, setAnnouncements] = useState<AdminAnnouncementItem[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annTargetRole, setAnnTargetRole] = useState<'ALL' | 'TEACHER' | 'PARENT'>('ALL');
  const [annClassId, setAnnClassId] = useState<string>('');
  const [sendingAnn, setSendingAnn] = useState(false);
  const [dashboardNotice, setDashboardNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setDashboardNotice({ text, type });
    setTimeout(() => setDashboardNotice(null), 4000);
  };

  const loadSchoolOperations = useCallback(async () => {
    setLoadingAbsences(true);
    try {
      const [absRes, annRes] = await Promise.all([
        fetch('/api/absences', { cache: 'no-store' }).catch(() => null),
        fetch('/api/announcements', { cache: 'no-store' }).catch(() => null),
      ]);

      if (absRes && absRes.ok) {
        const aJson = await absRes.json().catch(() => ({}));
        if (Array.isArray(aJson.absences)) {
          setAbsences(aJson.absences);
        }
      }

      if (annRes && annRes.ok) {
        const anJson = await annRes.json().catch(() => ({}));
        if (Array.isArray(anJson.announcements)) {
          setAnnouncements(anJson.announcements);
        }
      }
    } finally {
      setLoadingAbsences(false);
    }
  }, []);

  useEffect(() => {
    loadSchoolOperations();
  }, [loadSchoolOperations]);

  const handleUpdateAbsence = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (updatingAbsenceId) return;
    setUpdatingAbsenceId(id);
    try {
      const res = await fetch('/api/absences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          acknowledged_by_teacher: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        showNotice(json.error || 'Không thể cập nhật đơn xin nghỉ.', 'error');
        return;
      }
      showNotice(
        status === 'APPROVED' ? 'Đã duyệt đơn xin nghỉ trên toàn trường.' : 'Đã từ chối đơn xin nghỉ.'
      );
      await loadSchoolOperations();
    } catch {
      showNotice('Lỗi kết nối khi cập nhật đơn xin nghỉ.', 'error');
    } finally {
      setUpdatingAbsenceId(null);
    }
  };

  const handleBroadcastAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim() || sendingAnn) return;
    setSendingAnn(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle.trim(),
          content: annContent.trim(),
          target_role: annTargetRole,
          class_id: annClassId || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        showNotice(json.error || 'Không thể phát thông báo.', 'error');
        return;
      }
      setAnnTitle('');
      setAnnContent('');
      showNotice('Đã gửi thông báo đến đúng kênh vai trò mục tiêu!');
      await loadSchoolOperations();
    } catch {
      showNotice('Lỗi kết nối khi phát thông báo.', 'error');
    } finally {
      setSendingAnn(false);
    }
  };

  const totalEnrolled = classes.reduce((sum, c) => sum + (c.total_students || 0), 0);
  const totalMeals = kitchenOrders.reduce((sum, k) => sum + k.final_meals_count, 0);
  const totalAbsences = kitchenOrders.reduce((sum, k) => sum + k.valid_absences + k.late_absences, 0);
  const totalLateArrivals = kitchenOrders.reduce((sum, k) => sum + k.late_arrivals, 0);
  const presentCount = totalEnrolled - totalAbsences + totalLateArrivals;

  const filteredAbsences = absences.filter((item) => {
    if (absenceFilter === 'PENDING') {
      return item.status === 'SUBMITTED_VALID' || item.status === 'SUBMITTED_LATE';
    }
    if (absenceFilter === 'APPROVED') return item.status === 'APPROVED';
    if (absenceFilter === 'REJECTED') return item.status === 'REJECTED';
    return true;
  });

  const pendingAbsenceCount = absences.filter(
    (a) => a.status === 'SUBMITTED_VALID' || a.status === 'SUBMITTED_LATE'
  ).length;

  return (
    <div className="space-y-6">
      {dashboardNotice && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold ${
            dashboardNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {dashboardNotice.text}
        </div>
      )}

      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>{t('admin.dashboard.title')}</span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('common.school_name')} •{' '}
            {new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/kitchen"
            className="flex items-center gap-2 bg-[#FB8C00] hover:bg-[#F57C00] text-white font-bold px-4.5 py-2.5 rounded-pill transition-all shadow-sm text-sm"
          >
            <Utensils className="w-4 h-4" />
            <span>{t('admin.dashboard.btn_kitchen')}</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-convent flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium block">
              {t('admin.dashboard.total_enrolled')}
            </span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block font-mono">
              {totalEnrolled}
            </span>
            <span className="text-[11px] text-emerald-600 mt-1 inline-flex items-center gap-1 font-semibold">
              <CheckCircle className="w-3 h-3" /> {t('admin.dashboard.classes_count')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-convent flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium block">
              {t('admin.dashboard.present_count')}
            </span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">
              {presentCount}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 inline-block">
              {t('admin.dashboard.attendance_rate')}{' '}
              <strong className="text-emerald-700 font-mono">
                {Math.round((presentCount / totalEnrolled) * 100)}%
              </strong>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-convent flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium block">
              Đơn xin nghỉ chờ xử lý
            </span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block font-mono">
              {pendingAbsenceCount}
            </span>
            <span className="text-[11px] text-amber-700 mt-1 inline-flex items-center gap-1 font-semibold">
              <CalendarX className="w-3 h-3" /> Đồng bộ trực tuyến
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-convent flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium block">
              {t('admin.dashboard.meals_ordered')}
            </span>
            <span className="text-2xl font-bold text-sky-600 mt-1 block font-mono">
              {totalMeals}
            </span>
            <span className="text-[11px] text-sky-700 mt-1 inline-flex items-center gap-1 font-semibold">
              <Utensils className="w-3 h-3" /> {t('admin.dashboard.deducted_note')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <Utensils className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* School-Wide Absence Requests Management + Announcements Broadcaster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Absence Requests Management (All Classes) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-convent p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarX className="w-4 h-4 text-primary-700" />
                <span>Quản lý Đơn Xin Nghỉ Toàn Trường ({absences.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ban Giám Hiệu có thể xem và duyệt đơn xin nghỉ học của học sinh tất cả các lớp.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                {(
                  [
                    { key: 'ALL', label: 'Tất cả' },
                    { key: 'PENDING', label: `Chờ duyệt (${pendingAbsenceCount})` },
                    { key: 'APPROVED', label: 'Đã duyệt' },
                    { key: 'REJECTED', label: 'Từ chối' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAbsenceFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      absenceFilter === tab.key
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={loadSchoolOperations}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-pointer"
                title="Tải lại"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
            {loadingAbsences ? (
              <p className="py-8 text-center text-xs text-slate-500">Đang tải danh sách đơn xin nghỉ...</p>
            ) : filteredAbsences.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Chưa có đơn xin nghỉ nào trong nhóm này.
              </div>
            ) : (
              filteredAbsences.map((abs) => {
                const isPending =
                  abs.status === 'SUBMITTED_VALID' || abs.status === 'SUBMITTED_LATE';
                const isApproved = abs.status === 'APPROVED';
                const isRejected = abs.status === 'REJECTED';
                const busy = updatingAbsenceId === abs.id;

                return (
                  <div
                    key={abs.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/admin/students/${abs.student_id}`}
                            className="font-bold text-slate-900 hover:text-sky-700 hover:underline text-sm"
                          >
                            {abs.student_name}
                          </Link>
                          <span className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-800 rounded-md text-[10px] font-bold">
                            Lớp {abs.class_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isApproved
                              ? 'Đã duyệt'
                              : isRejected
                              ? 'Đã từ chối'
                              : abs.is_fee_credited
                              ? 'Hợp lệ (< 08:30)'
                              : 'Báo muộn (≥ 08:30)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Nghỉ ngày: <strong className="font-mono text-slate-700">{abs.start_date}</strong>
                          {abs.end_date && abs.end_date !== abs.start_date
                            ? ` → ${abs.end_date}`
                            : ''}{' '}
                          • Người gửi: <strong>{abs.submitted_by_name}</strong>
                        </p>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleUpdateAbsence(abs.id, 'APPROVED')}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Duyệt</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleUpdateAbsence(abs.id, 'REJECTED')}
                            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                      Lý do: {abs.reason}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* School Announcement Broadcaster (Role-Isolated Channel Tagging) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-convent p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-sky-600" />
              <span>Gửi Thông Báo Tách Kênh Vai Trò</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông báo gửi riêng tới Giáo viên hoặc Phụ huynh để đảm bảo cô lập ngữ cảnh đa vai trò.
            </p>
          </div>

          <form onSubmit={handleBroadcastAnnouncement} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Đối tượng nhận</label>
                <select
                  value={annTargetRole}
                  onChange={(e) => setAnnTargetRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">Toàn trường (ALL)</option>
                  <option value="TEACHER">Chỉ Giáo viên (TEACHER)</option>
                  <option value="PARENT">Chỉ Phụ huynh (PARENT)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Phạm vi lớp</label>
                <select
                  value={annClassId}
                  onChange={(e) => setAnnClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Toàn bộ các lớp</option>
                  {DEFAULT_CLASSES_LIST.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <input
              type="text"
              required
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Tiêu đề thông báo (VD: Lịch họp chuyên môn / Thực đơn tuần mới)..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
            />

            <textarea
              rows={2}
              required
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              placeholder="Nội dung chi tiết..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none resize-none"
            />

            <button
              type="submit"
              disabled={sendingAnn || !annTitle.trim() || !annContent.trim()}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingAnn ? 'Đang gửi...' : 'Phát thông báo ngay'}</span>
            </button>
          </form>

          {announcements.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2 max-h-44 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Thông báo gần đây ({announcements.length})
              </p>
              {announcements.slice(0, 5).map((an) => (
                <div
                  key={an.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 truncate">{an.title}</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px] shrink-0">
                      {an.target_role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{an.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Class Roll Call Status & Kitchen Aggregation Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-convent p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-sky-900">
              {t('admin.dashboard.class_status_title')}
            </h3>
          </div>

          <div className="space-y-3">
            {classes.map((cls) => {
              const order = kitchenOrders.find((k) => k.class_id === cls.id);
              const total = cls.total_students || 0;
              const absencesCount = (order?.valid_absences || 0) + (order?.late_absences || 0);
              const present = total - absencesCount + (order?.late_arrivals || 0);
              const percent = Math.round((present / total) * 100);

              return (
                <div
                  key={cls.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{cls.name}</h4>
                      <p className="text-xs text-slate-500">
                        {cls.teacher_name} • Room: {cls.room_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        {present}/{total}
                      </span>
                      <span className="text-xs text-slate-500 block">({percent}%)</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 text-slate-600">
                    <span>
                      {t('admin.dashboard.valid_absences')}{' '}
                      <strong className="text-slate-800">{order?.valid_absences}</strong>
                    </span>
                    <span>
                      {t('admin.dashboard.late_absences')}{' '}
                      <strong className="text-rose-500">{order?.late_absences}</strong>
                    </span>
                    <span>
                      {t('admin.dashboard.late_arrivals_trigger')}{' '}
                      <strong className="text-amber-600">+{order?.late_arrivals}</strong>
                    </span>
                    <span>
                      {t('admin.dashboard.meals_kitchen')}{' '}
                      <strong className="text-sky-600 font-mono font-bold">
                        {order?.final_meals_count}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Realtime Summary */}
        <div className="bg-white border border-slate-200 rounded-convent p-6 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-sky-900 mb-4 flex items-center justify-between">
            <span>{t('admin.dashboard.realtime_feed_title')}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live
            </span>
          </h3>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {absences.slice(0, 3).map((abs) => (
              <div
                key={abs.id}
                className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-sky-800 font-bold">
                  <span>Đơn nghỉ • Lớp {abs.class_name}</span>
                  <span className="font-mono text-[10px] text-slate-500">{abs.start_date}</span>
                </div>
                <p className="text-slate-700">
                  Bé <strong>{abs.student_name}</strong>: {abs.reason}
                </p>
              </div>
            ))}

            {absences.length === 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between text-emerald-800 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Hệ thống sẵn sàng
                  </span>
                </div>
                <p className="text-slate-700">
                  Dữ liệu đơn xin nghỉ, điểm danh và thông báo đa vai trò đang được đồng bộ trực tiếp qua PostgreSQL.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 mt-auto">
            <Link
              href="/admin/admissions"
              className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-sky-50 text-slate-700 text-xs font-semibold rounded-pill border border-slate-200 transition-colors"
            >
              <span>{t('admin.dashboard.view_admissions')}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
