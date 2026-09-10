'use client';

import React, { useState, useEffect } from 'react';
import { Utensils, Lock, Unlock, RefreshCw, Sparkles, AlertTriangle, ShieldCheck, Clock, Check, X, AlertCircle } from 'lucide-react';
import { INITIAL_KITCHEN_ORDERS, INITIAL_STUDENTS } from '@/lib/supabase/client';
import { KitchenMealOrder } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function KitchenMonitorPage() {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<KitchenMealOrder[]>(INITIAL_KITCHEN_ORDERS);
  const [isLocked, setIsLocked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cutoffTime] = useState('08:30');
  const [triggerLog, setTriggerLog] = useState<string[]>([]);

  // Auto-lock timer: Automatically lock if current time >= 08:30 AM
  useEffect(() => {
    const checkAutoCutoff = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const [targetHours, targetMinutes] = cutoffTime.split(':').map(Number);

      if (currentHours > targetHours || (currentHours === targetHours && currentMinutes >= targetMinutes)) {
        if (!isLocked) {
          setIsLocked(true);
          const nowStr = now.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US');
          setTriggerLog((prev) => [
            `[${nowStr}] ⏰ TỰ ĐỘNG CHỐT BẾP 08:30: Hệ thống đã tự động khóa sổ báo suất ăn theo khung giờ cấu hình.`,
            ...prev,
          ]);
        }
      }
    };

    checkAutoCutoff();
    const interval = setInterval(checkAutoCutoff, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [cutoffTime, isLocked, language]);

  // Calculate totals
  const totalBase = orders.reduce((sum, o) => sum + o.base_enrollment, 0);
  const totalValidAbsences = orders.reduce((sum, o) => sum + o.valid_absences, 0);
  const totalLateAbsences = orders.reduce((sum, o) => sum + o.late_absences, 0);
  const totalLateArrivals = orders.reduce((sum, o) => sum + o.late_arrivals, 0);
  const totalFinalMeals = orders.reduce((sum, o) => sum + o.final_meals_count, 0);

  // SIMULATE TRIGGER: trg_late_arrival_adjustment
  const handleSimulateLateArrival = (classId: string) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.class_id === classId) {
          const updatedLate = order.late_arrivals + 1;
          const updatedMeals = order.final_meals_count + 1;
          return {
            ...order,
            late_arrivals: updatedLate,
            final_meals_count: updatedMeals,
          };
        }
        return order;
      })
    );

    const targetClass = orders.find((o) => o.class_id === classId);
    const nowStr = new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US');
    const logMsg = `[${nowStr}] TRIGGER trg_late_arrival_adjustment: ${language === 'vi' ? 'Bổ sung' : 'Added'} 1 'PRESENT_LATE' (${targetClass?.class_name}). Bếp: +1 (Suất mới: ${
      (targetClass?.final_meals_count || 0) + 1
    })`;
    setTriggerLog((prev) => [logMsg, ...prev]);
  };

  const handleOpenConfirmModal = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmToggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    setShowConfirmModal(false);

    const nowStr = new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US');
    if (newLockState) {
      setTriggerLog((prev) => [`[${nowStr}] CHỐT BẾP (Xác thực Admin): Ban Giám Hiệu đã xác nhận khóa sổ báo suất ăn ngày hôm nay.`, ...prev]);
    } else {
      setTriggerLog((prev) => [`[${nowStr}] MỞ KHÓA BẾP (Xác thực Admin): Ban Giám Hiệu đã mở khóa sổ báo suất ăn.`, ...prev]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-convent flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-sky-900 tracking-tight">{t('admin.kitchen.title')}</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-pill text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {t('admin.kitchen.auto_cutoff_badge')}
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenConfirmModal}
          className={`flex items-center gap-2 font-semibold px-4 py-2.5 rounded-pill transition-all shadow-sm text-sm ${
            isLocked
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
          }`}
        >
          {isLocked ? <Lock className="w-4 h-4 text-emerald-600" /> : <Unlock className="w-4 h-4" />}
          <span>{isLocked ? t('admin.kitchen.lock_badge') : t('admin.kitchen.btn_lock')}</span>
        </button>
      </div>

      {/* Realtime Aggregation Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">{t('admin.kitchen.total_base')}</span>
          <span className="text-2xl font-bold text-slate-800 font-mono mt-1 block">{totalBase}</span>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">{t('admin.kitchen.valid_absent')}</span>
          <span className="text-2xl font-bold text-emerald-600 font-mono mt-1 block">-{totalValidAbsences}</span>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">{t('admin.kitchen.late_absent')}</span>
          <span className="text-2xl font-bold text-slate-400 font-mono mt-1 block">-{totalLateAbsences}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">({language === 'vi' ? 'Vẫn tính suất' : 'Meal counted'})</span>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
          <span className="text-xs text-amber-800 font-bold block">{t('admin.kitchen.late_trigger')}</span>
          <span className="text-2xl font-bold text-amber-700 font-mono mt-1 block">+{totalLateArrivals}</span>
        </div>
        <div className="col-span-2 md:col-span-1 bg-sky-50 border border-sky-200 p-4 rounded-xl text-center shadow-sm">
          <span className="text-xs text-sky-800 font-extrabold uppercase tracking-wider block">{t('admin.kitchen.total_meals')}</span>
          <span className="text-3xl font-extrabold text-sky-700 font-mono mt-1 block">{totalFinalMeals}</span>
        </div>
      </div>

      {/* Main Aggregation Table */}
      <div className="bg-white border border-slate-200 rounded-convent overflow-hidden shadow-sm text-slate-800">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sky-900 text-base flex items-center gap-2">
            <Utensils className="w-5 h-5 text-sky-600" />
            <span>{t('admin.kitchen.summary_table_title')}</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-sky-50 text-xs font-bold text-sky-900 tracking-wider border-b border-sky-100">
              <tr>
                <th className="py-3.5 px-4">{t('admin.kitchen.col_class')}</th>
                <th className="py-3.5 px-4 text-center">{t('admin.kitchen.col_base')}</th>
                <th className="py-3.5 px-4 text-center">{t('admin.kitchen.valid_absent')}</th>
                <th className="py-3.5 px-4 text-center">{t('admin.kitchen.late_absent')}</th>
                <th className="py-3.5 px-4 text-center">{t('admin.kitchen.col_late')}</th>
                <th className="py-3.5 px-4 text-center">{t('admin.kitchen.col_final')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-sky-50/50 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                    {order.class_name}
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-medium">{order.base_enrollment}</td>
                  <td className="py-4 px-4 text-center font-mono text-emerald-600 font-bold">-{order.valid_absences}</td>
                  <td className="py-4 px-4 text-center font-mono text-slate-400">-{order.late_absences}</td>
                  <td className="py-4 px-4 text-center font-mono text-amber-700 font-bold bg-amber-50 rounded-lg">
                    +{order.late_arrivals}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-lg font-extrabold text-sky-700">
                    {order.final_meals_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dietary & Allergy Watchlist */}
      <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm">
        <h3 className="text-base font-bold text-sky-900 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>{t('admin.kitchen.allergy_title')}</span>
        </h3>
        <p className="text-xs text-slate-500 mb-3.5">
          {t('admin.kitchen.allergy_subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {INITIAL_STUDENTS.filter((s) => s.allergies !== 'Không').map((student) => (
            <div key={student.id} className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-slate-900 text-sm truncate">{student.full_name}</span>
                <span className="text-slate-500 text-xs whitespace-nowrap shrink-0">({student.class_name})</span>
              </div>
              <span className="px-2.5 py-1 bg-sky-100 border border-sky-200 text-sky-800 rounded-pill font-bold whitespace-nowrap shrink-0">
                ⚠️ {student.allergies}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ADMIN CONFIRMATION MODAL OVERLAY */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-convent max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 relative">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-full ${isLocked ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600'}`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isLocked ? t('admin.kitchen.confirm_unlock_title') : t('admin.kitchen.confirm_lock_title')}
                </h3>
                <span className="text-xs font-semibold text-slate-400">Giờ Cut-off: {cutoffTime} AM</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {isLocked ? t('admin.kitchen.confirm_unlock_desc') : t('admin.kitchen.confirm_lock_desc')}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-pill transition-colors"
              >
                {t('admin.kitchen.btn_cancel')}
              </button>
              <button
                onClick={handleConfirmToggleLock}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-pill shadow-sm transition-all flex items-center gap-2 ${
                  isLocked ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{t('admin.kitchen.btn_confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

