'use client';

import React from 'react';
import { ChevronLeft, Activity, Heart, ShieldCheck, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_HEALTH_RECORDS, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function ParentHealthPage() {
  const records = INITIAL_HEALTH_RECORDS.filter((h) => h.student_id === 's1'); // Bé Trần Gia Bảo
  const latest = records[records.length - 1];
  const displayInfo = getGrowthStatusDisplay(latest.growth_status);

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
          <Link href="/parent" className="p-2 bg-primary-800 rounded-pill text-white hover:bg-primary-900 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Sổ Theo Dõi Sức Khỏe Theo Quý</h1>
            <p className="text-xs text-rose-100 font-medium">Trần Gia Bảo • Mầm 1 (Rose)</p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      {/* 1. LATEST WHO GROWTH SUMMARY CARD (TC-HLT-01 & TC-HLT-02) */}
      <div className="p-4 space-y-4">
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

        {/* 2. QUARTERLY GROWTH PROGRESS CHART / TIMELINE (TC-HLT-03) */}
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
        <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-2">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            Nhận Xét Y Tế Lâm Sàng Từ Cán Bộ Y Tế Lớp
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
            &quot;{latest.notes || 'Bé Trần Gia Bảo có chỉ số chiều cao và cân nặng phát triển rất đều đặn qua 3 quý, đạt thể trạng chuẩn WHO. Tinh thần vui vẻ, thể lực khỏe mạnh.'}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
