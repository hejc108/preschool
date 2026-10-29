'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Save, CheckCircle2, ChevronLeft, AlertCircle, Users, Search, RefreshCw } from 'lucide-react';
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

export default function AdminHealthPage() {
  const [classesList, setClassesList] = useState(DEFAULT_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<string>('5b61ec3a-11ef-4ca0-b914-97b35f9f3762'); // Default: Mầm
  const [selectedTerm, setSelectedTerm] = useState<HealthTerm>('Q1');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [allStudents, setAllStudents] = useState<StudentHealthItem[]>([]);
  const [recordsMap, setRecordsMap] = useState<Record<string, { weight_kg: number; height_cm: number; notes: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Load health data from API route
  const fetchHealthData = async () => {
    try {
      setLoading(true);
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
      }
    } catch (e) {
      console.error('Error loading health data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [selectedTerm, academicYear]);

  const selectedClassObj = classesList.find((c) => c.id === selectedClassId) || DEFAULT_CLASSES.find((c) => c.id === selectedClassId);
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

  // Field change handler with validation (TC-HLT-04)
  const handleInputChange = (studentId: string, field: 'weight_kg' | 'height_cm' | 'notes', value: any) => {
    setValidationError(null);

    if (field === 'height_cm' && Number(value) > 200) {
      setValidationError('Chiều cao không hợp lệ (> 200 cm)! Vui lòng kiểm tra lại.');
    }
    if ((field === 'weight_kg' || field === 'height_cm') && Number(value) < 0) {
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

  // Batch Save handler (TC-HLT-04 & UPSERT)
  const handleSaveBatch = async () => {
    // Check validations
    for (const st of classStudents) {
      const data = recordsMap[st.id];
      if (data) {
        if (data.height_cm > 200 || data.height_cm < 0 || data.weight_kg < 0) {
          setValidationError('Dữ liệu nhập vào chưa hợp lệ! Vui lòng kiểm tra lại các giá trị âm hoặc chiều cao > 200 cm.');
          return;
        }
      }
    }

    setSaving(true);
    setValidationError(null);

    try {
      const payloadRecords = classStudents.map((st) => {
        const d = recordsMap[st.id] || { weight_kg: 0, height_cm: 0, notes: '' };
        return {
          student_id: st.id,
          student_name: st.full_name,
          weight_kg: d.weight_kg || 0,
          height_cm: d.height_cm || 0,
          notes: d.notes || '',
          term: selectedTerm,
          academic_year: academicYear,
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

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        } else {
          setValidationError(json.error || 'Lỗi khi lưu dữ liệu');
        }
      } else {
        setValidationError('Không thể lưu sổ sức khỏe do lỗi máy chủ.');
      }
    } catch (e: any) {
      setValidationError(e?.message || 'Lỗi kết nối khi lưu sổ sức khỏe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Top Banner Card - Minimalist White Design System */}
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
              Nhập liệu sức khỏe định kỳ hàng loạt (Y tế / Giáo viên)
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Tự động tính BMI & xếp loại thể trạng chuẩn WHO • Đợt khám {selectedTerm} ({academicYear})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHealthData}
            disabled={loading}
            className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSaveBatch}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>{saving ? 'Đang lưu...' : 'Lưu sổ sức khỏe lớp'}</span>
          </button>
        </div>
      </div>

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
          <span>Đã lưu thành công toàn bộ bản ghi sức khỏe cho Lớp {selectedClassName}! Dữ liệu đã đồng bộ sang màn hình Phụ huynh.</span>
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Batch Entry Table (TC-HLT-04 & TC-HLT-02) */}
      <div className="bg-white border border-slate-200 rounded-convent shadow-sm overflow-hidden">
        <div className="p-4 bg-rose-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-bold text-primary-900 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-700" />
            <span>
              Danh sách theo dõi sức khỏe - Lớp {selectedClassName} ({classStudents.length} bé)
            </span>
          </h2>
          <span className="text-xs text-slate-500 font-normal">Dùng phím Tab để chuyển ô nhanh</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold text-xs md:text-sm border-b border-slate-200">
              <tr>
                <th className="p-3 w-12 text-center whitespace-nowrap">STT</th>
                <th className="p-3 min-w-[110px] whitespace-nowrap">Mã học sinh</th>
                <th className="p-3 min-w-[120px] whitespace-nowrap">Mã định danh</th>
                <th className="p-3 min-w-[150px] whitespace-nowrap">Họ và tên</th>
                <th className="p-3 min-w-[100px] whitespace-nowrap">Cân nặng (kg)</th>
                <th className="p-3 min-w-[100px] whitespace-nowrap">Chiều cao (cm)</th>
                <th className="p-3 min-w-[70px] whitespace-nowrap">BMI</th>
                <th className="p-3 min-w-[170px] whitespace-nowrap">Xếp loại WHO</th>
                <th className="p-3 min-w-[200px] w-full">Nhận xét y tế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary-600" />
                      <span>Đang nạp dữ liệu sổ sức khỏe lớp {selectedClassName}...</span>
                    </div>
                  </td>
                </tr>
              ) : classStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Chưa có dữ liệu học sinh trong lớp {selectedClassName}.
                  </td>
                </tr>
              ) : (
                classStudents.map((st, idx) => {
                  const data = recordsMap[st.id] || { weight_kg: 0, height_cm: 0, notes: '' };
                  const bmi = calculateBMI(data.weight_kg, data.height_cm);
                  const status = classifyWHOGrowthStatus(bmi);
                  const display = getGrowthStatusDisplay(status);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-primary-800 whitespace-nowrap min-w-[110px]">
                        {st.student_code}
                      </td>
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap min-w-[120px] text-xs font-semibold">
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
                      <td className="p-3 font-mono font-extrabold text-primary-900 text-sm whitespace-nowrap min-w-[70px]">
                        {bmi > 0 ? bmi : '--'}
                      </td>
                      <td className="p-3 min-w-[170px] align-middle">
                        <span
                          className={`px-3 py-1 rounded-pill text-xs font-bold border whitespace-nowrap inline-flex items-center shadow-2xs ${display.bgClass} ${display.textClass}`}
                        >
                          {display.text}
                        </span>
                      </td>
                      <td className="p-3 w-full min-w-[200px]">
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
