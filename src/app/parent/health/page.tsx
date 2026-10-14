'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Activity, ShieldCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { HealthRecord } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

export default function ParentHealthPage() {
  const [childInfo, setChildInfo] = useState<{ name: string; className: string }>({
    name: 'Bé',
    className: 'Mầm',
  });
  const [records, setRecords] = useState<HealthRecord[]>([]);

  useEffect(() => {
    async function loadHealthData() {
      try {
        const { data: students } = await supabase.from('students').select('*').limit(1);
        if (students && students.length > 0) {
          setChildInfo({
            name: students[0].full_name,
            className: students[0].class_name || 'Mầm',
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadHealthData();
  }, []);

  const latest = records[records.length - 1];
  const displayInfo = latest ? getGrowthStatusDisplay(latest.growth_status) : null;

  const termsList = [
    { term: 'Q1', label: 'Quý 1 (Tháng 9)' },
    { term: 'Q2', label: 'Quý 2 (Tháng 12)' },
    { term: 'Q3', label: 'Quý 3 (Tháng 3)' },
    { term: 'Q4', label: 'Quý 4 (Tháng 5)' },
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
            <h1 className="font-bold text-white text-base leading-tight">Sổ Theo Dõi Sức Khỏe Theo Quý</h1>
            <p className="text-xs text-rose-100 font-medium">{childInfo.name} • Lớp {childInfo.className}</p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {latest && displayInfo ? (
          <>
            {/* 1. LATEST WHO GROWTH SUMMARY CARD */}
            <div className={`p-4 rounded-convent border shadow-sm space-y-3 ${displayInfo.bgClass}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Chỉ Số Gần Nhất ({latest.term} - Năm học {latest.academic_year})</span>
                </span>
                <span className={`px-3 py-1 rounded-pill text-xs font-bold border ${displayInfo.bgClass} ${displayInfo.textClass}`}>
                  {displayInfo.text}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cân nặng</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">{latest.weight_kg} kg</span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Chiều cao</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">{latest.height_cm} cm</span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Chỉ số BMI</span>
                  <span className="text-base font-extrabold text-sky-700 font-mono">{latest.bmi}</span>
                </div>
              </div>
            </div>

            {/* 2. QUARTERLY GROWTH PROGRESS CHART / TIMELINE */}
            <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                  <span>Biểu Đồ Tăng Trưởng Chiều Cao & Cân Nặng</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Chuẩn WHO 2026</span>
              </div>

              <div className="space-y-3">
                {termsList.map((tObj) => {
                  const rec = records.find((r) => r.term === tObj.term);
                  return (
                    <div key={tObj.term} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          rec ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {tObj.term}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{tObj.label}</h4>
                          {rec ? (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Đo ngày: {rec.measured_date}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Chờ đo định kỳ --</span>
                          )}
                        </div>
                      </div>

                      <div>
                        {rec ? (
                          <div className="text-right font-mono font-bold text-slate-800">
                            <div>{rec.weight_kg} kg • {rec.height_cm} cm</div>
                            <span className="text-[10px] text-emerald-700 font-semibold">BMI: {rec.bmi}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 font-bold">--</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CLINICAL MEDICAL REMARKS */}
            {latest.notes && (
              <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Nhận Xét Y Tế Lâm Sàng Từ Cán Bộ Y Tế Lớp
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                  &quot;{latest.notes}&quot;
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Chưa có số liệu khám sức khỏe định kỳ</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Dữ liệu chiều cao, cân nặng và chỉ số BMI của bé sẽ được cập nhật định kỳ hàng quý sau các đợt kiểm tra sức khỏe tại trường.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
