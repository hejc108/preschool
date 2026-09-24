'use client';

import React, { useState } from 'react';
import { Users, CheckCircle, Clock, Utensils, HeartPulse, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_CLASSES, INITIAL_KITCHEN_ORDERS } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function AdminDashboardPage() {
  const { t, language } = useLanguage();
  const [classes] = useState(INITIAL_CLASSES);
  const [kitchenOrders] = useState(INITIAL_KITCHEN_ORDERS);

  const totalEnrolled = classes.reduce((sum, c) => sum + (c.total_students || 0), 0);
  const totalMeals = kitchenOrders.reduce((sum, k) => sum + k.final_meals_count, 0);
  const totalAbsences = kitchenOrders.reduce((sum, k) => sum + k.valid_absences + k.late_absences, 0);
  const totalLateArrivals = kitchenOrders.reduce((sum, k) => sum + k.late_arrivals, 0);
  const presentCount = totalEnrolled - totalAbsences + totalLateArrivals;

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>{t('admin.dashboard.title')}</span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('common.school_name')} • {new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
            <span className="text-xs text-slate-500 font-medium block">{t('admin.dashboard.total_enrolled')}</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block font-mono">{totalEnrolled}</span>
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
            <span className="text-xs text-slate-500 font-medium block">{t('admin.dashboard.present_count')}</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">{presentCount}</span>
            <span className="text-[11px] text-slate-500 mt-1 inline-block">
              {t('admin.dashboard.attendance_rate')} <strong className="text-emerald-700 font-mono">{Math.round((presentCount / totalEnrolled) * 100)}%</strong>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-convent flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium block">{t('admin.dashboard.late_arrivals')}</span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block font-mono">+{totalLateArrivals}</span>
            <span className="text-[11px] text-amber-700 mt-1 inline-flex items-center gap-1 font-semibold">
              <Clock className="w-3 h-3" /> Tự động cộng +{totalLateArrivals}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-convent flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium block">{t('admin.dashboard.meals_ordered')}</span>
            <span className="text-2xl font-bold text-sky-600 mt-1 block font-mono">{totalMeals}</span>
            <span className="text-[11px] text-sky-700 mt-1 inline-flex items-center gap-1 font-semibold">
              <Utensils className="w-3 h-3" /> {t('admin.dashboard.deducted_note')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <Utensils className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Class Roll Call Status & Kitchen Aggregation Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Overview */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-convent p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-sky-900">{t('admin.dashboard.class_status_title')}</h3>
          </div>

          <div className="space-y-3">
            {classes.map((cls) => {
              const order = kitchenOrders.find((k) => k.class_id === cls.id);
              const total = cls.total_students || 0;
              const absences = (order?.valid_absences || 0) + (order?.late_absences || 0);
              const present = total - absences + (order?.late_arrivals || 0);
              const percent = Math.round((present / total) * 100);

              return (
                <div key={cls.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{cls.name}</h4>
                      <p className="text-xs text-slate-500">{cls.teacher_name} • Room: {cls.room_number}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-emerald-600">{present}/{total}</span>
                      <span className="text-xs text-slate-500 block">({percent}%)</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-sky-500 h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 text-slate-600">
                    <span>{t('admin.dashboard.valid_absences')} <strong className="text-slate-800">{order?.valid_absences}</strong></span>
                    <span>{t('admin.dashboard.late_absences')} <strong className="text-rose-500">{order?.late_absences}</strong></span>
                    <span>{t('admin.dashboard.late_arrivals_trigger')} <strong className="text-amber-600">+{order?.late_arrivals}</strong></span>
                    <span>{t('admin.dashboard.meals_kitchen')} <strong className="text-sky-600 font-mono font-bold">{order?.final_meals_count}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Realtime Event Feed */}
        <div className="bg-white border border-slate-200 rounded-convent p-6 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-sky-900 mb-4 flex items-center justify-between">
            <span>{t('admin.dashboard.realtime_feed_title')}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
          </h3>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between text-amber-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {t('admin.dashboard.late_arrivals')}
                </span>
                <span className="font-mono text-[10px] text-slate-400">08:42 AM</span>
              </div>
              <p className="text-slate-700">
                {language === 'vi' ? 'Bé' : 'Child'} <strong className="text-slate-900">Trần Gia Bảo</strong> (Mầm 1) <span className="text-amber-700 font-mono font-bold">+{totalLateArrivals}</span>.
              </p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  {t('teacher.dispatched_done')}
                </span>
                <span className="font-mono text-[10px] text-slate-400">08:30 AM</span>
              </div>
              <p className="text-slate-700">
                Sơ Maria Tươi • Mầm 1 (Rose). 23 {language === 'vi' ? 'suất ăn' : 'meals'}.
              </p>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between text-sky-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-sky-600" />
                  {t('teacher.tab_medication')}
                </span>
                <span className="font-mono text-[10px] text-slate-400">07:55 AM</span>
              </div>
              <p className="text-slate-700">
                {t('common.parent_name')}: <strong className="text-slate-900">Lê Minh Anh</strong> (Siro Astex 5ml - 11:30).
              </p>
            </div>
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

