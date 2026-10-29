'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Save, CheckCircle2, ChevronLeft, AlertCircle, Users, Search, RefreshCw, X, Check } from 'lucide-react';
import Link from 'next/link';
import { calculateBMI, classifyWHOGrowthStatus, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { HealthTerm } from '@/lib/types/schema';

interface StudentHealthItem {
  id: string;
  student_code: string;
  full_name: string;
  dob: string;
  gender: string;
  class_id: string;
  class_name: string;
  citizen_id?: string | null;
  is_official?: boolean;
  is_non_regular?: boolean;
}

const DEFAULT_CLASSES = [
  { id: '14ccdb7e-c341-4fe4-8a59-78b2a2914096', name: 'Nhà trẻ' },
  { id: '5b61ec3a-11ef-4ca0-b914-97b35f9f3762', name: 'Mầm' },
  { id: '9d953115-1de9-4a56-a75c-eadcf903f398', name: 'Chồi' },
  { id: 'ebe8ec4d-1cf5-406a-9483-f0d90ccc71fd', name: 'Lá 1' },
  { id: '86b1e783-b643-41a5-9833-194b5a29d2e1', name: 'Lá 2' },
];

function safeParseFloat(val: any): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(',', '.');
  if (s === '' || s.toLowerCase() === 'null') return null;
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

export default function AdminHealthPage() {
  const [classesList, setClassesList] = useState(DEFAULT_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<string>('5b61ec3a-11ef-4ca0-b914-97b35f9f3762'); // Default: Mầm
  const [selectedTerm, setSelectedTerm] = useState<HealthTerm>('Q1');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [allStudents, setAllStudents] = useState<StudentHealthItem[]>([]);
  const [recordsMap, setRecordsMap] = useState<Record<string, { weight_kg: any; height_cm: any; notes: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Modern Toast Notification state
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    if (type === 'success') {
      setSavedSuccess(true);
      setValidationError(null);
    } else {
      setValidationError(message);
    }
  };

  useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, show: false } : null));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load health data from API route
  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setValidationError(null);
      const res = await fetch(`/api/admin/health?term=${selectedTerm}&academic_year=${academicYear}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          if (json.classes && json.classes.length > 0) {
            setClassesList(json.classes);
          }
          if (json.students) {
            setAllStudents(json.students);
          }
          if (json.recordsMap) {
            setRecordsMap(json.recordsMap);
          }
        }
      } else {
        showToast('error', 'Không thể tải dữ liệu sức khỏe từ máy chủ.');
      }
    } catch (e: any) {
      console.error('Error loading health data:', e);
      showToast('error', e?.message || 'Lỗi kết nối khi tải dữ liệu sức khỏe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [selectedTerm, academicYear]);

  const selectedClassObj =
    classesList.find((c) => c.id === selectedClassId) ||
    DEFAULT_CLASSES.find((c) => c.id === selectedClassId);
  const selectedClassName = selectedClassObj?.name || 'Mầm';

  // Filter students for the selected class and sort by student code
  const classStudents = allStudents
    .filter(
      (s) =>
        s.class_id === selectedClassId ||
        s.class_name === selectedClassName ||
        s.class_id === selectedClassObj?.id
    )
    .sort((a, b) => a.student_code.localeCompare(b.student_code));

  // Field change handler
  const handleInputChange = (studentId: string, field: 'weight_kg' | 'height_cm' | 'notes', value: any) => {
    setValidationError(null);
    setRecordsMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  // Quick single row save handler
  const handleSaveRow = async (studentId: string) => {
    const student = classStudents.find((s) => s.id === studentId);
    if (!student) return;

    const data = recordsMap[studentId] || { weight_kg: null, height_cm: null, notes: '' };
    const w = safeParseFloat(data.weight_kg);
    const h = safeParseFloat(data.height_cm);

    if (w !== null && (w < 0 || w > 150)) {
      showToast('error', `Cân nặng của bé ${student.full_name} (${w} kg) không hợp lệ (phải từ 0 đến 150 kg).`);
      return;
    }
    if (h !== null && (h < 0 || h > 220)) {
      showToast('error', `Chiều cao của bé ${student.full_name} (${h} cm) không hợp lệ (phải từ 0 đến 220 cm).`);
      return;
    }

    setRowSavingId(studentId);
    try {
      const payload = {
        student_id: student.id,
        student_name: student.full_name,
        term: selectedTerm || 'Q1',
        academic_year: academicYear || '2026-2027',
        record_date: new Date().toISOString().split('T')[0],
        weight: w,
        height: h,
        notes: (data.notes || '').trim(),
      };

      const res = await fetch('/api/admin/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: payload }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        showToast('success', `Đã lưu thành công sổ sức khỏe bé ${student.full_name}!`);
      } else {
        showToast('error', json.error || `Không thể lưu số liệu của bé ${student.full_name}.`);
      }
    } catch (e: any) {
      showToast('error', e?.message || `Lỗi kết nối khi lưu bé ${student.full_name}`);
    } finally {
      setRowSavingId(null);
    }
  };

  // Batch Save handler with rigorous validation and zero silent returns
  const handleSaveBatch = async () => {
    if (isSubmitting || loading) return;

    if (classStudents.length === 0) {
      showToast('error', `Lớp ${selectedClassName} hiện chưa có danh sách học sinh để lưu sổ sức khỏe.`);
      return;
    }

    // Client-side validations
    for (const st of classStudents) {
      const data = recordsMap[st.id];
      if (data) {
        const w = safeParseFloat(data.weight_kg);
        const h = safeParseFloat(data.height_cm);

        if (w !== null && (w < 0 || w > 150)) {
          showToast('error', `Cân nặng (${w} kg) của bé ${st.full_name} không hợp lệ! Vui lòng nhập từ 0 đến 150 kg.`);
          return;
        }
        if (h !== null && (h < 0 || h > 220)) {
          showToast('error', `Chiều cao (${h} cm) của bé ${st.full_name} không hợp lệ! Vui lòng nhập từ 0 đến 220 cm.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const payloadRecords = classStudents.map((st) => {
        const d = recordsMap[st.id] || { weight_kg: null, height_cm: null, notes: '' };
        const w = safeParseFloat(d.weight_kg);
        const h = safeParseFloat(d.height_cm);

        return {
          student_id: st.id,
          student_name: st.full_name,
          term: selectedTerm || 'Q1',
          academic_year: academicYear || '2026-2027',
          record_date: new Date().toISOString().split('T')[0],
          weight: w,
          height: h,
          notes: (d.notes || '').trim(),
        };
      });

      const res = await fetch('/api/admin/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: selectedTerm,
          academic_year: academicYear,
          records: payloadRecords,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        showToast(
          'success',
          `Đã lưu thành công ${json.saved_count || payloadRecords.length} bản ghi sức khỏe cho Lớp ${selectedClassName}!`
        );
      } else {
        showToast('error', json.error || 'Máy chủ báo lỗi khi lưu sổ sức khỏe.');
      }
    } catch (e: any) {
      console.error('Error saving batch health records:', e);
      showToast('error', e?.message || 'Lỗi kết nối mạng khi lưu sổ sức khỏe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6 relative">
      {/* Toast Notification Container */}
      {toast && toast.show && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full animate-slide-in">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-start gap-3 transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToast((prev) => (prev ? { ...prev, show: false } : null))}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-sm shrink-0 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-800 text-lg sm:text-xl leading-tight">
              Sổ theo dõi sức khỏe định kỳ học sinh (Y tế / Giáo viên)
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Tự động tính BMI & xếp loại thể trạng chuẩn WHO • Đợt khám {selectedTerm} ({academicYear})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHealthData}
            disabled={loading || isSubmitting}
            className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSaveBatch}
            disabled={isSubmitting || loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            <span>{isSubmitting ? 'Đang lưu sổ sức khỏe...' : 'Lưu sổ sức khỏe lớp'}</span>
          </button>
        </div>
      </div>

      {/* Validation or Success Alerts (In-page) */}
      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold text-xs flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold text-sm flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            Đã lưu thành công dữ liệu sổ sức khỏe cho Lớp {selectedClassName}! Dữ liệu đã đồng bộ sang màn hình Cổng Phụ huynh.
          </span>
        </div>
      )}

      {/* Filter Controls (Select Class & Term) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chọn lớp học (*)</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={isSubmitting || loading}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          >
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                Lớp {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quý kiểm tra (*)</label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value as HealthTerm)}
            disabled={isSubmitting || loading}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          >
            <option value="Q1">Quý 1 (Đầu năm học - Tháng 9)</option>
            <option value="Q2">Quý 2 (Tháng 12)</option>
            <option value="Q3">Quý 3 (Tháng 3)</option>
            <option value="Q4">Quý 4 (Cuối năm - Tháng 5)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Năm học (*)</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            disabled={isSubmitting || loading}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Batch Entry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>
              Danh sách theo dõi sức khỏe - Lớp {selectedClassName} ({classStudents.length} bé)
            </span>
          </h2>
          <span className="text-xs text-slate-500 font-normal">Dùng phím Tab để chuyển ô nhanh • Hỗ trợ dấu phẩy thập phân (vd: 14,5)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="p-3 w-12 text-center whitespace-nowrap">STT</th>
                <th className="p-3 min-w-[110px] whitespace-nowrap">Mã học sinh</th>
                <th className="p-3 min-w-[120px] whitespace-nowrap">Mã định danh</th>
                <th className="p-3 min-w-[150px] whitespace-nowrap">Họ và tên</th>
                <th className="p-3 min-w-[110px] whitespace-nowrap">Cân nặng (kg)</th>
                <th className="p-3 min-w-[110px] whitespace-nowrap">Chiều cao (cm)</th>
                <th className="p-3 min-w-[70px] whitespace-nowrap">BMI</th>
                <th className="p-3 min-w-[160px] whitespace-nowrap">Xếp loại WHO</th>
                <th className="p-3 min-w-[180px] w-full">Nhận xét y tế</th>
                <th className="p-3 w-20 text-center whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                      <span>Đang nạp dữ liệu sổ sức khỏe lớp {selectedClassName}...</span>
                    </div>
                  </td>
                </tr>
              ) : classStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    Chưa có dữ liệu học sinh trong lớp {selectedClassName}.
                  </td>
                </tr>
              ) : (
                classStudents.map((st, idx) => {
                  const data = recordsMap[st.id] || { weight_kg: '', height_cm: '', notes: '' };
                  const w = safeParseFloat(data.weight_kg);
                  const h = safeParseFloat(data.height_cm);
                  const bmi = w !== null && h !== null && h > 0 ? calculateBMI(w, h) : 0;
                  const status = bmi > 0 ? classifyWHOGrowthStatus(bmi) : 'NORMAL';
                  const display = getGrowthStatusDisplay(status);
                  const isRowSaving = rowSavingId === st.id;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap min-w-[110px]">
                        {st.student_code}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap min-w-[120px] text-xs font-semibold">
                        {st.citizen_id || (
                          <span className="text-slate-400 italic">Chưa có</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap min-w-[150px]">
                        <div>{st.full_name}</div>
                        {st.is_non_regular && (
                          <span className="text-[10px] text-amber-700 font-normal">
                            (Bổ sung ngoài danh sách)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={data.weight_kg !== null && data.weight_kg !== undefined ? data.weight_kg : ''}
                          onChange={(e) => handleInputChange(st.id, 'weight_kg', e.target.value)}
                          placeholder="kg..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={data.height_cm !== null && data.height_cm !== undefined ? data.height_cm : ''}
                          onChange={(e) => handleInputChange(st.id, 'height_cm', e.target.value)}
                          placeholder="cm..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg p-2 font-mono font-bold text-slate-900 text-xs focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="p-3 font-mono font-extrabold text-slate-900 text-sm whitespace-nowrap min-w-[70px]">
                        {bmi > 0 ? bmi : '--'}
                      </td>
                      <td className="p-3 min-w-[160px] align-middle">
                        {bmi > 0 ? (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap inline-flex items-center shadow-2xs ${display.bgClass} ${display.textClass}`}
                          >
                            {display.text}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Chờ đo</span>
                        )}
                      </td>
                      <td className="p-3 w-full min-w-[180px]">
                        <input
                          type="text"
                          value={data.notes || ''}
                          onChange={(e) => handleInputChange(st.id, 'notes', e.target.value)}
                          placeholder="Nhận xét y tế..."
                          className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg p-2 text-slate-800 text-xs focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(st.id)}
                          disabled={isRowSaving || isSubmitting}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                          title={`Lưu riêng cho bé ${st.full_name}`}
                        >
                          {isRowSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
