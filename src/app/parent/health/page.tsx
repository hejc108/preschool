'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, Activity, ShieldCheck, TrendingUp, RefreshCw, Calendar, Scale, Ruler } from 'lucide-react';
import Link from 'next/link';
import { getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

interface ChildHealthDetail {
  id: string;
  student_id: string;
  term: string;
  academic_year: string;
  measured_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number;
  growth_status: string;
  notes: string;
}

function ParentHealthContent() {
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('student_id');

  const [childInfo, setChildInfo] = useState<{
    id: string;
    name: string;
    className: string;
    studentCode: string;
  }>({
    id: '',
    name: 'Bé',
    className: 'Mầm',
    studentCode: '',
  });

  const [records, setRecords] = useState<ChildHealthDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStudentAndHealth() {
      try {
        setLoading(true);
        let targetStudentId = studentIdParam;

        // 1. If studentIdParam not passed in URL, resolve from parent stored relations or active user
        if (!targetStudentId && typeof window !== 'undefined') {
          try {
            const storedRels = localStorage.getItem('suongmai_parent_relations_v1');
            if (storedRels) {
              const rels = JSON.parse(storedRels);
              if (Array.isArray(rels) && rels.length > 0) {
                targetStudentId = rels[0].student_id;
              }
            }
          } catch (e) {}

          // Fallback: check cookie email
          if (!targetStudentId) {
            const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
            if (match) {
              const email = parseSignedCookieClient(match[1]).toLowerCase().trim();
              if (email) {
                const appRes = await fetch('/api/users/approvals').catch(() => null);
                if (appRes && appRes.ok) {
                  const appJson = await appRes.json();
                  if (Array.isArray(appJson?.relations)) {
                    const myRel = appJson.relations.find(
                      (r: any) => r.parent_email?.toLowerCase().trim() === email
                    );
                    if (myRel?.student_id) {
                      targetStudentId = myRel.student_id;
                    }
                  }
                }
              }
            }
          }
        }

        // 2. Fetch student profile details
        let studentName = 'Bé';
        let studentClassName = 'Mầm';
        let studentCode = '';

        if (targetStudentId) {
          const { data: stData } = await supabase
            .from('students')
            .select('id, full_name, class_name, student_code')
            .eq('id', targetStudentId)
            .maybeSingle();

          if (stData) {
            studentName = stData.full_name;
            studentClassName = stData.class_name || 'Mầm';
            studentCode = stData.student_code || '';
          }
        } else {
          // Last resort: pick first student
          const { data: stList } = await supabase.from('students').select('*').limit(1);
          if (stList && stList.length > 0) {
            targetStudentId = stList[0].id;
            studentName = stList[0].full_name;
            studentClassName = stList[0].class_name || 'Mầm';
            studentCode = stList[0].student_code || '';
          }
        }

        if (targetStudentId) {
          setChildInfo({
            id: targetStudentId,
            name: studentName,
            className: studentClassName,
            studentCode,
          });

          // 3. Fetch real health records from API
          const healthRes = await fetch(
            `/api/parent/health?student_id=${encodeURIComponent(targetStudentId)}`,
            { cache: 'no-store' }
          );
          if (healthRes.ok) {
            const healthJson = await healthRes.json();
            if (healthJson.success && Array.isArray(healthJson.records)) {
              setRecords(healthJson.records);
            }
          }
        }
      } catch (err) {
        console.error('Error loading parent health detail:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStudentAndHealth();
  }, [studentIdParam]);

  const latest = records.length > 0 ? records[records.length - 1] : null;
  const displayInfo = latest?.growth_status
    ? getGrowthStatusDisplay(latest.growth_status as any)
    : null;

  const termsList = [
    { term: 'Q1', label: 'Quý 1 (Đầu năm học - Tháng 9)' },
    { term: 'Q2', label: 'Quý 2 (Tháng 12)' },
    { term: 'Q3', label: 'Quý 3 (Tháng 3)' },
    { term: 'Q4', label: 'Quý 4 (Cuối năm - Tháng 5)' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans pb-10">
      {/* Top Header */}
      <header className="p-4 bg-primary-700 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link
            href="/parent"
            className="w-9 h-9 rounded-full bg-primary-800 hover:bg-primary-900 flex items-center justify-center text-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Sổ Theo Dõi Thể Trạng Định Kỳ</h1>
            <p className="text-xs text-rose-100 font-medium">
              {childInfo.name} • Lớp {childInfo.className} {childInfo.studentCode ? `(${childInfo.studentCode})` : ''}
            </p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu sổ sức khỏe...</p>
          </div>
        ) : latest && (latest.weight_kg !== null || latest.height_cm !== null) ? (
          <>
            {/* 1. LATEST WHO GROWTH SUMMARY CARD */}
            <div className={`p-4 rounded-2xl border shadow-sm space-y-3 ${displayInfo?.bgClass || 'bg-emerald-50/50 border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>
                    Chỉ số đợt gần nhất (Đợt: {latest.term} • {latest.academic_year})
                  </span>
                </span>
                {displayInfo && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${displayInfo.bgClass} ${displayInfo.textClass}`}
                  >
                    {displayInfo.text}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    📏 Chiều cao
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {latest.height_cm !== null && latest.height_cm !== undefined ? `${latest.height_cm} cm` : '--'}
                  </span>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    ⚖️ Cân nặng
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {latest.weight_kg !== null && latest.weight_kg !== undefined ? `${latest.weight_kg} kg` : '--'}
                  </span>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Chỉ số BMI
                  </span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono">
                    {latest.bmi > 0 ? latest.bmi : '--'}
                  </span>
                </div>
              </div>

              {latest.measured_date && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ngày ghi nhận số liệu: {latest.measured_date}</span>
                </div>
              )}
            </div>

            {/* 2. QUARTERLY GROWTH PROGRESS TIMELINE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Tiến Trình Tăng Trưởng Theo Quý</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Chuẩn WHO</span>
              </div>

              <div className="space-y-3">
                {termsList.map((tObj) => {
                  const rec = records.find((r) => r.term === tObj.term);
                  const w = rec?.weight_kg;
                  const h = rec?.height_cm;
                  const hasData = w !== null && w !== undefined && h !== null && h !== undefined;

                  return (
                    <div
                      key={tObj.term}
                      className="p-3 border border-slate-200 rounded-xl bg-slate-50/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            hasData ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {tObj.term}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{tObj.label}</h4>
                          {hasData ? (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Đo ngày: {rec?.measured_date || 'Đầu năm'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Chờ đo định kỳ --</span>
                          )}
                        </div>
                      </div>

                      <div>
                        {hasData ? (
                          <div className="text-right font-mono font-bold text-slate-800">
                            <div>
                              📏 {h} cm • ⚖️ {w} kg
                            </div>
                            {rec?.bmi && rec.bmi > 0 ? (
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                BMI: {rec.bmi}
                              </span>
                            ) : null}
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

            {/* 3. CLINICAL MEDICAL REMARKS */}
            {latest.notes && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Nhận Xét Y Tế Lâm Sàng Từ Nhà Trường
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                  &quot;{latest.notes}&quot;
                </p>
              </div>
            )}
          </>
        ) : (
          /* Safe Empty State */
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              Nhà trường đang cập nhật số liệu khám sức khỏe đợt này
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto">
              Số liệu chiều cao, cân nặng và chỉ số BMI của bé sẽ tự động hiển thị tại đây sau khi cán bộ y tế trường hoàn tất đợt khám định kỳ.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParentHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ParentHealthContent />
    </Suspense>
  );
}
