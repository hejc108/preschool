'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Save,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  Users,
  Search,
  RefreshCw,
  X,
  Check,
  Database,
  Copy,
  ExternalLink,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { calculateBMI, classifyWHOGrowthStatus, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { HealthTerm } from '@/lib/types/schema';
import { useHealthWithRealtime } from '@/lib/hooks/useHealthWithRealtime';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

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

const SQL_MIGRATION_SCRIPT = `-- ==============================================================================
-- Migration: Tạo bảng health_records trên Supabase cho Mầm Non Sương Mai
-- Chạy câu lệnh này tại: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL DEFAULT 'Q1',
  academic_year VARCHAR(50) NOT NULL DEFAULT '2026-2027',
  measured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  record_date DATE DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  weight NUMERIC(5,2),
  height NUMERIC(5,2),
  bmi NUMERIC(5,2),
  growth_status VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_health_records_student_term UNIQUE (student_id, term)
);

CREATE INDEX IF NOT EXISTS idx_health_records_student_id ON public.health_records(student_id);
CREATE INDEX IF NOT EXISTS idx_health_records_term ON public.health_records(term);

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to health_records" ON public.health_records;
CREATE POLICY "Allow all access to health_records"
ON public.health_records FOR ALL
USING (true)
WITH CHECK (true);`;

function safeParseFloat(val: any): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(',', '.');
  if (s === '' || s.toLowerCase() === 'null') return null;
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

export default function AdminHealthPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('5b61ec3a-11ef-4ca0-b914-97b35f9f3762'); // Default: Mầm
  const [selectedTerm, setSelectedTerm] = useState<HealthTerm>('Q1');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');

  // Custom hook: SWR Cache + Supabase Realtime Subscription
  const {
    classes: realtimeClasses,
    students: realtimeStudents,
    recordsMap: realtimeRecordsMap,
    hasSupabaseTable: realtimeHasSupabaseTable,
    isLoading,
    isValidating,
    mutate,
  } = useHealthWithRealtime({
    term: selectedTerm,
    academicYear,
  });

  const [classesList, setClassesList] = useState(DEFAULT_CLASSES);
  const [allStudents, setAllStudents] = useState<StudentHealthItem[]>([]);
  const [recordsMap, setRecordsMap] = useState<Record<string, { weight_kg: any; height_cm: any; notes: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [hasSupabaseTable, setHasSupabaseTable] = useState<boolean>(true);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [saveBtnStatus, setSaveBtnStatus] = useState<'idle' | 'success' | 'warning'>('idle');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  // Xác thực quyền Super Admin (chỉ Super Admin mới xem được cờ/nhãn bổ sung ngoài danh sách)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let role = '';
      let email = '';
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          role = parsed.role || '';
          email = (parsed.email || '').toLowerCase().trim();
        } catch (e) {}
      }
      const matchRole = document.cookie.match(/suongmai_user_role=([^;]+)/);
      if (matchRole) role = parseSignedCookieClient(matchRole[1]);
      const matchEmail = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (matchEmail) email = parseSignedCookieClient(matchEmail[1]).toLowerCase().trim();

      const cleanEmail = email.toLowerCase().trim();
      const isSuper =
        cleanEmail !== 'hejc108@gmail.com' &&
        cleanEmail !== 'luciaxuan178@gmail.com' &&
        (role === 'SUPER_ADMIN' ||
          cleanEmail === 'sadmin@suongmai.edu.vn');
      setIsSuperAdmin(isSuper);
    }
  }, []);

  // Quản lý các ô input đang chỉnh sửa (dirty) để Realtime ngầm không ghi đè giá trị hoặc làm mất focus
  const dirtyRecordsRef = useRef<Record<string, Record<string, boolean>>>({});

  // Đồng bộ danh mục lớp
  useEffect(() => {
    if (realtimeClasses && realtimeClasses.length > 0) {
      setClassesList(realtimeClasses);
    }
  }, [realtimeClasses]);

  // Đồng bộ danh sách học sinh
  useEffect(() => {
    if (realtimeStudents && realtimeStudents.length > 0) {
      setAllStudents(realtimeStudents);
    }
  }, [realtimeStudents]);

  // Đồng bộ trạng thái bảng CSDL Supabase
  useEffect(() => {
    setHasSupabaseTable(realtimeHasSupabaseTable);
  }, [realtimeHasSupabaseTable]);

  // Hợp nhất dữ liệu số đo sức khỏe từ SWR/Realtime mà KHÔNG ghi đè các ô đang gõ dở
  useEffect(() => {
    if (!realtimeRecordsMap) return;
    setRecordsMap((prev) => {
      const next = { ...prev };
      Object.keys(realtimeRecordsMap).forEach((stId) => {
        const serverRec = realtimeRecordsMap[stId];
        const dirtyStudent = dirtyRecordsRef.current[stId] || {};
        const prevRec = prev[stId] || { weight_kg: '', height_cm: '', notes: '' };

        next[stId] = {
          weight_kg: dirtyStudent.weight_kg ? prevRec.weight_kg : (serverRec.weight_kg ?? ''),
          height_cm: dirtyStudent.height_cm ? prevRec.height_cm : (serverRec.height_cm ?? ''),
          notes: dirtyStudent.notes ? prevRec.notes : (serverRec.notes ?? ''),
        };
      });
      return next;
    });
  }, [realtimeRecordsMap]);

  // Modern Toast Notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ show: true, type, message });
    if (type === 'success') {
      setSavedSuccess(message);
      setValidationError(null);
    } else if (type === 'warning') {
      setSavedSuccess(message);
      setValidationError(null);
    } else {
      setValidationError(message);
    }
  };

  useEffect(() => {
    if (toast?.show) {
      const timer = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, show: false } : null));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
    .sort((a, b) => (a.student_code || '').localeCompare(b.student_code || ''));

  // Field change handler: Ghi nhận trạng thái dirty cho ô input đang chỉnh sửa
  const handleInputChange = (studentId: string, field: 'weight_kg' | 'height_cm' | 'notes', value: any) => {
    setValidationError(null);
    if (!dirtyRecordsRef.current[studentId]) {
      dirtyRecordsRef.current[studentId] = {};
    }
    dirtyRecordsRef.current[studentId][field] = true;

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
        delete dirtyRecordsRef.current[studentId];
        mutate();
        if (json.synced_supabase) {
          showToast('success', `Đã lưu vào Database Supabase cho bé ${student.full_name}!`);
        } else {
          showToast('warning', `Đã lưu tạm thời bé ${student.full_name} (Database Supabase chưa có bảng health_records).`);
        }
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
    if (isSubmitting) return;

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
    setSaveBtnStatus('idle');

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
        dirtyRecordsRef.current = {};
        mutate();
        if (json.synced_supabase) {
          setSaveBtnStatus('success');
          setHasSupabaseTable(true);
          showToast(
            'success',
            `Đã lưu thành công ${json.saved_count || payloadRecords.length} bản ghi vào Database Supabase!`
          );
        } else {
          setSaveBtnStatus('warning');
          setHasSupabaseTable(false);
          showToast(
            'warning',
            `Đã lưu ${json.saved_count || payloadRecords.length} bản ghi vào bộ nhớ hệ thống. (Lưu ý: Bảng health_records chưa tạo trên Supabase, bấm "Xem mã SQL" để kích hoạt lưu vĩnh viễn).`
          );
        }
        setTimeout(() => setSaveBtnStatus('idle'), 4000);
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

  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  const handleSyncAllCatalog = async () => {
    if (isSyncingAll || isSubmitting) return;
    setIsSyncingAll(true);
    try {
      const res = await fetch('/api/admin/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_all_catalog: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        dirtyRecordsRef.current = {};
        mutate();
        if (json.synced_supabase) {
          setHasSupabaseTable(true);
          showToast('success', `Đã đồng bộ thành công toàn bộ ${json.saved_count || 170} hồ sơ sức khỏe vào Database Supabase!`);
        } else {
          setHasSupabaseTable(false);
          setShowSqlModal(true);
          showToast(
            'warning',
            'CSDL Supabase chưa có bảng health_records. Vui lòng bấm "Sao chép mã SQL" và chạy trên Supabase trước.'
          );
        }
      } else {
        showToast('error', json.error || 'Lỗi khi đồng bộ dữ liệu vào Supabase.');
      }
    } catch (e: any) {
      showToast('error', e?.message || 'Lỗi kết nối khi đồng bộ dữ liệu.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Xuất báo cáo y tế / sổ sức khỏe ra file Excel (.CSV UTF-8 BOM)
  const handleExportHealthExcel = () => {
    if (classStudents.length === 0) {
      showToast('warning', 'Không có dữ liệu học sinh trong lớp để xuất báo cáo.');
      return;
    }

    const headers = [
      'STT',
      'Mã Học Sinh',
      'Mã Định Danh (11 số)',
      'Họ Và Tên',
      'Lớp',
      'Cân Nặng (kg)',
      'Chiều Cao (cm)',
      'Chỉ Số BMI',
      'Đánh Giá Thể Trạng',
      'Nhận Xét Y Tế',
    ];

    const rows = classStudents.map((st, idx) => {
      const data = recordsMap[st.id] || { weight_kg: '', height_cm: '', notes: '' };
      const w = safeParseFloat(data.weight_kg);
      const h = safeParseFloat(data.height_cm);
      const bmi = w !== null && h !== null && h > 0 ? calculateBMI(w, h) : 0;
      const status = bmi > 0 ? classifyWHOGrowthStatus(bmi) : 'NORMAL';
      const display = getGrowthStatusDisplay(status);

      return [
        idx + 1,
        `"${st.student_code}"`,
        `"${st.citizen_id || ''}"`,
        `"${st.full_name}"`,
        `"${st.class_name || selectedClassName}"`,
        w !== null ? w : '',
        h !== null ? h : '',
        bmi > 0 ? bmi : '',
        `"${bmi > 0 ? display.text : 'Chờ đo'}"`,
        `"${(data.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_suc_khoe_Lop_${selectedClassName}_${selectedTerm}_${academicYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6 relative">
      {/* Toast Notification Container */}
      {toast && toast.show && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full shadow-2xl transition-all">
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-500/10'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-amber-500/10'
                : 'bg-rose-50 border-rose-300 text-rose-900 shadow-rose-500/10'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : toast.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToast((prev) => (prev ? { ...prev, show: false } : null))}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SQL Script Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Mã SQL Kích Hoạt Bảng Sức Khỏe Trên Supabase</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
              <p>
                Để dữ liệu được lưu vĩnh viễn vào cơ sở dữ liệu Supabase, bạn chỉ cần thực hiện 3 bước đơn giản:
              </p>
              <ol className="list-decimal pl-4 space-y-1 font-medium text-slate-700">
                <li>Bấm nút <strong>Sao chép mã SQL</strong> bên dưới.</li>
                <li>
                  Mở{' '}
                  <a
                    href="https://supabase.com/dashboard/project/yrieuamibqjyaslprdeo/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-600 font-bold underline inline-flex items-center gap-1"
                  >
                    Supabase SQL Editor <ExternalLink className="w-3 h-3" />
                  </a>
                  .
                </li>
                <li>Dán (Paste) câu lệnh vào ô truy vấn và bấm <strong>Run</strong> (màu xanh).</li>
                <li>Quay lại trang này và bấm nút <strong>&quot;Đồng bộ 170 hồ sơ&quot;</strong> để nạp toàn bộ dữ liệu vào Database!</li>
              </ol>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed">
                {SQL_MIGRATION_SCRIPT}
              </pre>
              <button
                onClick={handleCopySql}
                className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép mã SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Warning Banner if Supabase table not created yet */}
      {!hasSupabaseTable && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">CSDL Supabase chưa tạo bảng <code>public.health_records</code>:</span>
              <p className="text-amber-800 font-normal mt-0.5">
                Dữ liệu hiện đang lưu trong bộ nhớ ứng dụng. Vui lòng bấm &quot;Lấy mã SQL tạo bảng&quot; và dán vào Supabase Dashboard để lưu vĩnh viễn vào Database.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSqlModal(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Lấy mã SQL tạo bảng</span>
            </button>
            <button
              onClick={handleSyncAllCatalog}
              disabled={isSyncingAll}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>Đã chạy SQL? Bấm đồng bộ ngay</span>
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
              Tự động tính BMI & đánh giá thể trạng học sinh • Đợt khám {selectedTerm} ({academicYear})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => mutate()}
            disabled={isSubmitting || isSyncingAll}
            className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportHealthExcel}
            disabled={isSubmitting || isSyncingAll || classStudents.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs shadow-sm whitespace-nowrap text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Xuất danh sách sổ sức khỏe ra file Excel (.CSV)"
          >
            <Download className="w-3.5 h-3.5 shrink-0 text-sky-600" />
            <span>Xuất báo cáo y tế</span>
          </button>

          <button
            onClick={handleSyncAllCatalog}
            disabled={isSyncingAll || isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs shadow-sm whitespace-nowrap text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Đồng bộ toàn bộ 170 học sinh của cả 5 lớp vào Database Supabase"
          >
            {isSyncingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-emerald-600" />
            ) : (
              <Database className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            )}
            <span>{isSyncingAll ? 'Đang nạp 170 hồ sơ...' : 'Đồng bộ 170 hồ sơ'}</span>
          </button>

          <button
            onClick={handleSaveBatch}
            disabled={isSubmitting || isSyncingAll}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-sm whitespace-nowrap text-white transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-95 ${
              saveBtnStatus === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : saveBtnStatus === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            ) : saveBtnStatus === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : saveBtnStatus === 'warning' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isSubmitting
                ? 'Đang gửi lưu dữ liệu...'
                : saveBtnStatus === 'success'
                ? 'Đã lưu Database thành công!'
                : saveBtnStatus === 'warning'
                ? 'Đã lưu tạm (Bấm xem SQL)'
                : 'Lưu sổ sức khỏe lớp'}
            </span>
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
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-sm ${
            saveBtnStatus === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveBtnStatus === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{savedSuccess}</span>
          </div>

          {!hasSupabaseTable && (
            <button
              onClick={() => setShowSqlModal(true)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer"
            >
              Xem mã SQL
            </button>
          )}
        </div>
      )}

      {/* Filter Controls (Select Class & Term) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Chọn lớp học (*)</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Batch Entry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
        {/* Thanh loading siêu mỏng ở mép trên cùng khi dữ liệu đang làm mới ngầm (SWR Revalidating) */}
        {isValidating && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-100 overflow-hidden z-20">
            <div className="h-full bg-emerald-500 animate-pulse w-full" />
          </div>
        )}
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
                <th className="p-3 min-w-[160px] whitespace-nowrap">Đánh giá thể trạng</th>
                <th className="p-3 min-w-[180px] w-full">Nhận xét y tế</th>
                <th className="p-3 w-20 text-center whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {(isLoading && classStudents.length === 0) ? (
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
                        {isSuperAdmin && st.is_non_regular && (
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
