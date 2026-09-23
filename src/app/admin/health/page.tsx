'use client';

import React, { useState } from 'react';
import { Activity, Save, CheckCircle2, ChevronLeft, AlertCircle, Users, Search } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_HEALTH_RECORDS, calculateBMI, classifyWHOGrowthStatus, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { HealthRecord, HealthTerm } from '@/lib/types/schema';
import { INITIAL_CLASSES, INITIAL_STUDENTS } from '@/lib/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function AdminHealthPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('c1'); // Mầm 1 (Rose)
  const [selectedTerm, setSelectedTerm] = useState<HealthTerm>('Q3');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');

  // Filter students by selected class
  const classStudents = INITIAL_STUDENTS.filter((s) => s.class_id === selectedClassId);

  // Health records form state mapped by student ID
  const [recordsMap, setRecordsMap] = useState<Record<string, { weight_kg: number; height_cm: number; notes: string }>>({
    s1: { weight_kg: 19.5, height_cm: 112.0, notes: 'Thể trạng chuẩn WHO' },
    s2: { weight_kg: 17.0, height_cm: 106.0, notes: 'Phát triển tốt' },
    s3: { weight_kg: 14.5, height_cm: 101.5, notes: 'Cần bổ sung thêm đạm' },
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Field change handler with validation (TC-HLT-04)
  const handleInputChange = (studentId: string, field: 'weight_kg' | 'height_cm' | 'notes', value: any) => {
    setValidationError(null);

    if (field === 'height_cm' && value > 200) {
      setValidationError('Chiều cao không hợp lệ (> 200 cm)! Vui lòng kiểm tra lại.');
    }
    if ((field === 'weight_kg' || field === 'height_cm') && value < 0) {
      setValidationError('Cân nặng và chiều cao không được mang giá trị âm!');
    }

    setRecordsMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: field === 'notes' ? value : Number(value) || 0,
      },
    }));
  };

  const handleSaveBatch = () => {
    // Check validations
    for (const [stId, data] of Object.entries(recordsMap)) {
      if (data.height_cm > 200 || data.height_cm < 0 || data.weight_kg < 0) {
        setValidationError('Dữ liệu nhập vào chưa hợp lệ! Vui lòng kiểm tra lại các giá trị âm hoặc chiều cao > 200 cm.');
        return;
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="p-4 bg-primary-700 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-primary-800 rounded-pill text-white hover:bg-primary-900 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Nhập liệu sức khỏe định kỳ hàng loạt (Y tế / Giáo viên)</h1>
            <p className="text-xs text-rose-100 font-medium">Tự động tính BMI & xếp loại thể trạng chuẩn WHO</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveBatch}
            className="flex items-center gap-2 bg-[#FB8C00] hover:bg-[#F57C00] text-white px-4.5 py-2.5 rounded-pill font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Lưu sổ sức khỏe lớp</span>
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Validation or Success Alerts */}
        {validationError && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold text-xs flex items-center gap-2 shadow-sm animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold text-sm flex items-center gap-2 shadow-sm animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Đã lưu thành công toàn bộ bản ghi sức khỏe cho lớp! Dữ liệu đã đồng bộ sang màn hình Phụ huynh.</span>
          </div>
        )}

        {/* Filter Controls (Select Class & Term) */}
        <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chọn lớp học (*)</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              {INITIAL_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.teacher_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quý kiểm tra (*)</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as HealthTerm)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option value="Q1">Quý 1 (Tháng 9)</option>
              <option value="Q2">Quý 2 (Tháng 12)</option>
              <option value="Q3">Quý 3 (Tháng 3)</option>
              <option value="Q4">Quý 4 (Tháng 5)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Năm học (*)</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>
        </div>

        {/* Batch Entry Table (TC-HLT-04 & TC-HLT-02) */}
        <div className="bg-white border border-slate-200 rounded-convent shadow-sm overflow-hidden">
          <div className="p-4 bg-rose-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-bold text-primary-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-700" />
              <span>Danh sách nhập số đo sức khỏe - Lớp {INITIAL_CLASSES.find((c) => c.id === selectedClassId)?.name}</span>
            </h2>
            <span className="text-xs text-slate-500 font-normal">Dùng phím Tab để chuyển ô nhanh</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Mã học sinh</th>
                  <th className="p-3 min-w-[160px]">Họ và tên bé</th>
                  <th className="p-3 min-w-[120px]">Cân nặng (kg)</th>
                  <th className="p-3 min-w-[120px]">Chiều cao (cm)</th>
                  <th className="p-3 min-w-[100px]">BMI (Tự động)</th>
                  <th className="p-3 min-w-[190px] sm:min-w-[210px] whitespace-nowrap">Xếp loại thể trạng WHO</th>
                  <th className="p-3 min-w-[200px]">Nhận xét y tế lâm sàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {classStudents.map((st, idx) => {
                  const data = recordsMap[st.id] || { weight_kg: 18.0, height_cm: 108.0, notes: '' };
                  const bmi = calculateBMI(data.weight_kg, data.height_cm);
                  const status = classifyWHOGrowthStatus(bmi);
                  const display = getGrowthStatusDisplay(status);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-primary-800">{st.student_code}</td>
                      <td className="p-3 font-bold text-slate-900">{st.full_name}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.1"
                          value={data.weight_kg || ''}
                          onChange={(e) => handleInputChange(st.id, 'weight_kg', e.target.value)}
                          placeholder="kg..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.5"
                          value={data.height_cm || ''}
                          onChange={(e) => handleInputChange(st.id, 'height_cm', e.target.value)}
                          placeholder="cm..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="p-3 font-mono font-extrabold text-primary-900 text-sm">
                        {bmi > 0 ? bmi : '--'}
                      </td>
                      <td className="p-3 min-w-[190px] sm:min-w-[210px] align-middle">
                        <span className={`px-3 py-1 rounded-pill text-xs font-bold border whitespace-nowrap inline-flex items-center shadow-2xs ${display.bgClass} ${display.textClass}`}>
                          {display.text}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={data.notes}
                          onChange={(e) => handleInputChange(st.id, 'notes', e.target.value)}
                          placeholder="Nhận xét y tế..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg p-2 text-slate-800 text-xs focus:bg-white focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
