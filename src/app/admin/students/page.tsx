'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  Eye,
  Edit3,
  X,
  Phone,
  Heart,
  UserCheck,
  Check,
  Ban,
  Plus,
  Sparkles,
  Filter,
  ArrowRightLeft,
  Clock,
  Camera,
  Trash2,
  Upload,
  ZoomIn,
  Download,
} from 'lucide-react';
import { INITIAL_STUDENTS, INITIAL_CLASSES, INITIAL_KITCHEN_ORDERS } from '@/lib/supabase/client';
import { Student, AuthorizedPickup } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function StudentsDirectoryPage() {
  const { t } = useLanguage();
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [viewStudentId, setViewStudentId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [transferStudent, setTransferStudent] = useState<Student | null>(null);

  // Photo Lightbox preview state (Kích thước lớn)
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    phone?: string;
    badge?: string;
  } | null>(null);

  // --- EXPORT TO EXCEL FUNCTION (.CSV WITH UTF-8 BOM FOR EXCEL) ---
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Mã Bé',
      'Họ Và Tên Bé',
      'Giới Tính',
      'Ngày Sinh',
      'Lớp Học',
      'Lưu Ý Sức Khoẻ & Dị Ứng',
      'Trạng Thái',
      'Thông Tin Cha Mẹ',
      'SĐT Phụ Huynh',
      'Người Đón Ủy Quyền',
    ];

    const rows = filteredStudents.map((s, index) => {
      const parentsInfo =
        s.parents?.map((p) => `${p.relationship}: ${p.name} (${p.phone})`).join('; ') || 'N/A';
      const parentsPhone = s.parents?.map((p) => p.phone).join(' / ') || 'N/A';
      const pickupsInfo =
        s.authorized_pickups
          ?.map(
            (p) =>
              `${p.name} (${p.relationship} - ${p.phone}) [${
                p.approval_status === 'APPROVED' ? 'Đã Xác Thực' : 'Chờ Duyệt'
              }]`
          )
          .join('; ') || 'Không có';

      return [
        index + 1,
        `"${s.student_code}"`,
        `"${s.full_name}"`,
        `"${s.gender}"`,
        `"${s.dob}"`,
        `"${s.class_name || ''}"`,
        `"${s.allergies || 'Không'}"`,
        `"${s.status === 'ACTIVE' ? 'Đang theo học' : 'Đã nghỉ học'}"`,
        `"${parentsInfo.replace(/"/g, '""')}"`,
        `"${parentsPhone.replace(/"/g, '""')}"`,
        `"${pickupsInfo.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.setAttribute('download', `Danh_Sach_Ho_So_Be_Suong_Mai_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Single Class Transfer state
  const [newSingleClass, setNewSingleClass] = useState('Mầm 1 (Rose)');
  const [singleTransferReason, setSingleTransferReason] = useState('');

  // Form state for Admin direct pickup upload inside Edit modal
  const [editPickupName, setEditPickupName] = useState('');
  const [editPickupRel, setEditPickupRel] = useState('Ông Nội');
  const [editPickupPhone, setEditPickupPhone] = useState('');
  const [editPickupAvatar, setEditPickupAvatar] = useState('');

  // Helper for reading image files as Data URLs
  const handleImageFileRead = (file: File, onLoaded: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onLoaded(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const selectedStudent = students.find((s) => s.id === viewStudentId) || null;

  // Realtime Headcount Sync across subsystems
  const syncClassHeadcount = (oldClassName?: string, newClassName?: string, count: number = 1) => {
    if (!oldClassName || !newClassName || oldClassName === newClassName) return;

    const oldClass = INITIAL_CLASSES.find((c) => c.name === oldClassName);
    if (oldClass && oldClass.total_students) {
      oldClass.total_students = Math.max(0, oldClass.total_students - count);
    }
    const newClass = INITIAL_CLASSES.find((c) => c.name === newClassName);
    if (newClass) {
      newClass.total_students = (newClass.total_students || 0) + count;
    }

    const oldOrder = INITIAL_KITCHEN_ORDERS.find((k) => k.class_name === oldClassName);
    if (oldOrder) {
      oldOrder.base_enrollment = Math.max(0, oldOrder.base_enrollment - count);
      oldOrder.final_meals_count = Math.max(0, oldOrder.final_meals_count - count);
    }
    const newOrder = INITIAL_KITCHEN_ORDERS.find((k) => k.class_name === newClassName);
    if (newOrder) {
      newOrder.base_enrollment += count;
      newOrder.final_meals_count += count;
    }
  };

  // Filtered Students list
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_code.toLowerCase().includes(search.toLowerCase());

    const matchesClass = classFilter === 'ALL' || s.class_name === classFilter;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? s.status === 'ACTIVE'
        : s.status !== 'ACTIVE';

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // --- SAVE STUDENT EDITS ---
  const handleSaveEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;

    setStudents((prev) =>
      prev.map((s) => (s.id === editStudent.id ? editStudent : s))
    );

    const index = INITIAL_STUDENTS.findIndex((s) => s.id === editStudent.id);
    if (index !== -1) {
      INITIAL_STUDENTS[index] = editStudent;
    }

    setEditStudent(null);
  };

  // --- SINGLE CLASS TRANSFER HANDLER ---
  const handleExecuteSingleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStudent) return;

    const classIdMap: Record<string, string> = {
      'Mầm 1 (Rose)': 'c1',
      'Chồi 2 (Lily)': 'c2',
      'Lá 3 (Sunflower)': 'c3',
    };
    const oldClass = transferStudent.class_name || '';
    const targetClassId = classIdMap[newSingleClass] || 'c1';

    setStudents((prev) =>
      prev.map((s) =>
        s.id === transferStudent.id
          ? { ...s, class_id: targetClassId, class_name: newSingleClass }
          : s
      )
    );

    const targetSingleton = INITIAL_STUDENTS.find((s) => s.id === transferStudent.id);
    if (targetSingleton) {
      targetSingleton.class_id = targetClassId;
      targetSingleton.class_name = newSingleClass;
    }

    syncClassHeadcount(oldClass, newSingleClass, 1);
    setTransferStudent(null);
    setSingleTransferReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-700" />
            <span>{t('admin.students.title')}</span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('admin.students.subtitle')}
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-pill px-3 py-1.5 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t('admin.students.filter_all_classes')}</option>
              <option value="Mầm 1 (Rose)">Mầm 1 (Rose)</option>
              <option value="Chồi 2 (Lily)">Chồi 2 (Lily)</option>
              <option value="Lá 3 (Sunflower)">Lá 3 (Sunflower)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-pill px-3 py-1.5 text-xs text-slate-700">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t('admin.students.filter_all_statuses')}</option>
              <option value="ACTIVE">{t('admin.students.status_enrolled')}</option>
              <option value="GRADUATED">{t('admin.students.status_graduated')}</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative max-w-xs w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('admin.students.search_placeholder')}
              className="w-full bg-slate-50 border border-slate-200 rounded-pill py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-pill px-3.5 py-2 text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            title="Xuất danh sách hồ sơ bé đang hiển thị ra file Excel (.csv)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-convent overflow-hidden shadow-sm text-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-sky-50 text-xs font-bold text-sky-900 tracking-wider border-b border-sky-100">
              <tr>
                <th className="py-3.5 px-4">{t('admin.students.col_child_id')}</th>
                <th className="py-3.5 px-4">{t('admin.students.col_full_name')}</th>
                <th className="py-3.5 px-4">{t('admin.students.col_class')}</th>
                <th className="py-3.5 px-4">{t('admin.students.col_allergies')}</th>
                <th className="py-3.5 px-4">{t('admin.students.col_status')}</th>
                <th className="py-3.5 px-4 text-center w-36">{t('admin.students.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedStudents.map((s) => {
                const pendingCount =
                  s.authorized_pickups?.filter((p) => p.approval_status === 'PENDING').length || 0;

                return (
                  <tr key={s.id} className="hover:bg-sky-50/50 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-sky-700 text-xs whitespace-nowrap">
                      {s.student_code}
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        {s.avatar_url ? (
                          <img
                            src={s.avatar_url}
                            alt={s.full_name}
                            className="w-10 h-10 rounded-full border-2 border-sky-200 object-cover shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {s.full_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="block font-bold">{s.full_name}</span>
                            {pendingCount > 0 && (
                              <span
                                className="relative inline-flex items-center justify-center p-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-md shadow-xs animate-pulse"
                                title={`${pendingCount} yêu cầu đang chờ duyệt`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-mono text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                                  {pendingCount}
                                </span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {s.parents?.length ? `Phụ huynh: ${s.parents[0].name}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {s.class_name}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {s.allergies === 'Không' ? (
                        <span className="text-slate-400 italic">{t('admin.students.normal_allergy')}</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 rounded-pill font-bold whitespace-nowrap">
                          ⚠️ {s.allergies}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-xs whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-pill font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-slate-100 border border-slate-200 text-slate-600'
                        }`}
                      >
                        {s.status === 'ACTIVE'
                          ? t('admin.students.status_enrolled')
                          : t('admin.students.status_graduated')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center w-36 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {/* 1. XEM ICON BUTTON */}
                        <button
                          onClick={() => setViewStudentId(s.id)}
                          className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg border border-sky-200 transition-colors shadow-xs"
                          title="Xem chi tiết hồ sơ"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* 2. SỬA ICON BUTTON */}
                        <button
                          onClick={() => setEditStudent({ ...s })}
                          className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors shadow-xs"
                          title="Chỉnh sửa thông tin bé"
                        >
                          <Edit3 className="w-4 h-4 text-amber-600" />
                        </button>

                        {/* 3. CHUYỂN LỚP ICON BUTTON */}
                        <button
                          onClick={() => {
                            setTransferStudent(s);
                            setNewSingleClass(s.class_name || 'Mầm 1 (Rose)');
                          }}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors shadow-xs"
                          title="Chuyển lớp học"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800 focus:outline-none"
            >
              <option value={10}>10 / trang</option>
              <option value={25}>25 / trang</option>
              <option value={50}>50 / trang</option>
            </select>
            <span>
              ({(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredStudents.length)} trên tổng {filteredStudents.length} bé)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-pill font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('admin.students.prev_page')}
            </button>

            <span className="font-mono font-bold px-2">
              {currentPage} / {totalPages}
            </span>

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-pill font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('admin.students.next_page')}
            </button>
          </div>
        </div>
      </div>

      {/* READ-ONLY VIEW STUDENT DETAIL MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-convent max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 text-slate-800 relative space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                {selectedStudent.avatar_url ? (
                  <div
                    onClick={() =>
                      setPreviewPhoto({
                        url: selectedStudent.avatar_url!,
                        title: selectedStudent.full_name,
                        subtitle: `Mã bé: ${selectedStudent.student_code} • ${selectedStudent.class_name}`,
                        badge: 'Chân Dung Bé',
                      })
                    }
                    className="relative group cursor-pointer"
                    title="Bấm để xem ảnh phóng to"
                  >
                    <img
                      src={selectedStudent.avatar_url}
                      alt={selectedStudent.full_name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-sky-500 object-cover shadow-md transition-transform group-hover:scale-105 shrink-0"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ZoomIn className="w-6 h-6" />
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-sky-100 border border-sky-300 text-sky-800 flex items-center justify-center font-bold text-2xl shrink-0">
                    {selectedStudent.full_name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{selectedStudent.full_name}</h3>
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-pill">
                      [Chế độ chỉ đọc]
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 text-xs font-mono font-bold rounded-pill">
                      {selectedStudent.student_code}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{selectedStudent.class_name}</span>
                  </div>
                  <p className="text-[11px] text-sky-700 mt-1 flex items-center gap-1">
                    <ZoomIn className="w-3 h-3" /> Bấm vào ảnh bất kỳ để xem kích thước lớn
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewStudentId(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Child Basic Info Card (Including Gender & DOB) */}
            <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Giới tính</span>
                <span className="font-bold text-sky-900">{selectedStudent.gender}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Ngày sinh</span>
                <span className="font-bold text-slate-800 font-mono">{selectedStudent.dob}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Trạng thái</span>
                <span className="font-bold text-emerald-700">
                  {selectedStudent.status === 'ACTIVE' ? 'Đang theo học' : 'Đã nghỉ học'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Lưu ý sức khoẻ</span>
                <span className="font-bold text-sky-800">{selectedStudent.allergies}</span>
              </div>
            </div>

            {/* SECTION 1: PARENTS (CHA / MẸ) */}
            <div>
              <h4 className="text-sm font-bold text-sky-900 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Hồ Sơ Cha / Mẹ (Phụ Huynh Trực Tiếp)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedStudent.parents?.map((parent, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-xs hover:border-sky-300 transition-colors"
                  >
                    <div
                      onClick={() =>
                        setPreviewPhoto({
                          url: parent.avatar_url,
                          title: parent.name,
                          subtitle: `Phụ huynh trực tiếp của bé ${selectedStudent.full_name}`,
                          phone: parent.phone,
                          badge: parent.relationship,
                        })
                      }
                      className="relative group cursor-pointer shrink-0"
                      title="Bấm để xem ảnh phóng to"
                    >
                      <img
                        src={parent.avatar_url}
                        alt={parent.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-rose-200 object-cover shadow-sm transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ZoomIn className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="min-w-0 text-xs space-y-1">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded-pill border border-rose-200 inline-block">
                        {parent.relationship}
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm truncate">{parent.name}</h5>
                      <span className="text-slate-500 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" /> {parent.phone}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({
                            url: parent.avatar_url,
                            title: parent.name,
                            subtitle: `Phụ huynh trực tiếp của bé ${selectedStudent.full_name}`,
                            phone: parent.phone,
                            badge: parent.relationship,
                          })
                        }
                        className="text-[10px] text-sky-600 font-bold hover:underline flex items-center gap-0.5 pt-0.5"
                      >
                        <ZoomIn className="w-3 h-3" /> Phóng to ảnh
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: AUTHORIZED PICKUPS */}
            <div>
              <h4 className="text-sm font-bold text-sky-900 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Thư Viện Ảnh Người Được Ủy Quyền Đón Bé</span>
              </h4>

              {selectedStudent.authorized_pickups && selectedStudent.authorized_pickups.length > 0 ? (
                <div className="space-y-3">
                  {selectedStudent.authorized_pickups.map((pickup) => {
                    const isApproved = pickup.approval_status === 'APPROVED';
                    const isPending = pickup.approval_status === 'PENDING';
                    const isRejected = pickup.approval_status === 'REJECTED';

                    return (
                      <div
                        key={pickup.id}
                        className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs ${
                          isPending
                            ? 'bg-amber-50/60 border-amber-300'
                            : isApproved
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() =>
                              setPreviewPhoto({
                                url: pickup.avatar_url,
                                title: pickup.name,
                                subtitle: `Người đón ủy quyền cho bé ${selectedStudent.full_name}`,
                                phone: pickup.phone,
                                badge: `${pickup.relationship} • ${
                                  isApproved ? 'Đã Xác Thực' : isPending ? 'Chờ Duyệt' : 'Từ Chối'
                                }`,
                              })
                            }
                            className="relative group cursor-pointer shrink-0"
                            title="Bấm để xem ảnh phóng to"
                          >
                            <img
                              src={pickup.avatar_url}
                              alt={pickup.name}
                              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 object-cover shadow-sm transition-transform group-hover:scale-105 ${
                                isPending
                                  ? 'border-amber-400'
                                  : isApproved
                                  ? 'border-emerald-500'
                                  : 'border-rose-400'
                              }`}
                            />
                            <div className="absolute inset-0 bg-slate-900/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn className="w-5 h-5" />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-white text-slate-800 font-bold text-[10px] rounded-pill border border-slate-200">
                                {pickup.relationship}
                              </span>
                              {isApproved && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-pill border border-emerald-300 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Đã Xác Thực
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-pill border border-amber-300">
                                  ⏳ Chờ Duyệt Ảnh
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-pill border border-rose-300">
                                  ✕ Từ Chối
                                </span>
                              )}
                            </div>
                            <h5 className="font-bold text-slate-900 text-sm">{pickup.name}</h5>
                            <span className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-emerald-600" /> {pickup.phone}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhoto({
                                  url: pickup.avatar_url,
                                  title: pickup.name,
                                  subtitle: `Người đón ủy quyền cho bé ${selectedStudent.full_name}`,
                                  phone: pickup.phone,
                                  badge: `${pickup.relationship} • ${
                                    isApproved ? 'Đã Xác Thực' : isPending ? 'Chờ Duyệt' : 'Từ Chối'
                                  }`,
                                })
                              }
                              className="text-[10px] text-sky-600 font-bold hover:underline flex items-center gap-0.5 mt-1"
                            >
                              <ZoomIn className="w-3 h-3" /> Phóng to nhận diện
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Chưa có người đón ngoài phụ huynh đăng ký.
                </p>
              )}
            </div>

            {/* Footer button */}
            <div className="pt-2 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setViewStudentId(null)}
                className="px-6 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-pill transition-colors shadow-xs"
              >
                Đóng Hồ Sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL (SỬA HỒ SƠ & QUẢN LÝ ẢNH ĐỊNH DANH) */}
      {editStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-convent max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                <span>Chỉnh Sửa Hồ Sơ & Quản Lý Ảnh Định Danh ({editStudent.student_code})</span>
              </h3>
              <button
                onClick={() => setEditStudent(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-6 text-xs">
              {/* SECTION 1: CÁC THÔNG TIN CƠ BẢN */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  1. Thông Tin Nhân Thân & Sức Khoẻ
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Họ và tên bé (*)</label>
                    <input
                      type="text"
                      required
                      value={editStudent.full_name}
                      onChange={(e) => setEditStudent({ ...editStudent, full_name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Giới tính (*)</label>
                      <select
                        value={editStudent.gender}
                        onChange={(e) =>
                          setEditStudent({ ...editStudent, gender: e.target.value as 'NAM' | 'NỮ' })
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                      >
                        <option value="NAM">NAM</option>
                        <option value="NỮ">NỮ</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Ngày sinh (*)</label>
                      <input
                        type="date"
                        required
                        value={editStudent.dob}
                        onChange={(e) => setEditStudent({ ...editStudent, dob: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Lưu ý sức khoẻ (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Không, hoặc Dị ứng hải sản..."
                      value={editStudent.allergies}
                      onChange={(e) => setEditStudent({ ...editStudent, allergies: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Trạng thái (*)</label>
                    <select
                      value={editStudent.status}
                      onChange={(e) =>
                        setEditStudent({ ...editStudent, status: e.target.value as 'ACTIVE' | 'GRADUATED' })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value="ACTIVE">{t('admin.students.status_enrolled')}</option>
                      <option value="GRADUATED">{t('admin.students.status_graduated')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ẢNH CHÂN DUNG CỦA BÉ */}
              <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl space-y-3">
                <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-sky-200 pb-2">
                  <Camera className="w-4 h-4 text-sky-600" />
                  2. Ảnh Định Danh Chân Dung Của Bé
                </h4>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {editStudent.avatar_url ? (
                    <img
                      src={editStudent.avatar_url}
                      alt={editStudent.full_name}
                      className="w-20 h-20 rounded-full border-2 border-sky-500 object-cover shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-sky-100 border border-sky-300 text-sky-800 flex items-center justify-center font-bold text-2xl shrink-0">
                      {editStudent.full_name.charAt(0)}
                    </div>
                  )}

                  <div className="space-y-2 flex-1 w-full">
                    <label className="block text-slate-700 font-bold">Tải lên hoặc thay ảnh mới</label>
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 font-semibold rounded-pill cursor-pointer transition-colors shadow-xs flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-sky-600" />
                        <span>Chọn tệp ảnh từ máy...</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageFileRead(file, (url) => {
                                setEditStudent({ ...editStudent, avatar_url: url });
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Hỗ trợ định dạng JPG, PNG. Ảnh chân dung chuẩn giúp giáo viên đối soát điểm danh.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: THÔNG TIN & ẢNH CHA MẸ */}
              <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-3">
                <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-200 pb-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  3. Thông Tin & Ảnh Chân Dung Cha / Mẹ
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editStudent.parents?.map((parent, pIdx) => (
                    <div key={pIdx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                      <div className="flex items-center gap-3">
                        <img
                          src={parent.avatar_url}
                          alt={parent.name}
                          className="w-12 h-12 rounded-full border border-slate-200 object-cover shrink-0"
                        />
                        <div>
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded-pill border border-rose-200">
                            {parent.relationship}
                          </span>
                          <h5 className="font-bold text-slate-800 text-xs mt-0.5">{parent.name}</h5>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <label className="block text-slate-600 font-semibold text-[11px]">Họ tên {parent.relationship}</label>
                          <input
                            type="text"
                            value={parent.name}
                            onChange={(e) => {
                              const newParents = [...(editStudent.parents || [])];
                              newParents[pIdx] = { ...newParents[pIdx], name: e.target.value };
                              setEditStudent({ ...editStudent, parents: newParents });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 font-semibold text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold text-[11px]">Số điện thoại</label>
                          <input
                            type="tel"
                            value={parent.phone}
                            onChange={(e) => {
                              const newParents = [...(editStudent.parents || [])];
                              newParents[pIdx] = { ...newParents[pIdx], phone: e.target.value };
                              setEditStudent({ ...editStudent, parents: newParents });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-pill cursor-pointer transition-colors text-[11px] inline-flex items-center gap-1 mt-1">
                            <Upload className="w-3 h-3 text-slate-500" />
                            <span>Đổi ảnh {parent.relationship}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageFileRead(file, (url) => {
                                    const newParents = [...(editStudent.parents || [])];
                                    newParents[pIdx] = { ...newParents[pIdx], avatar_url: url };
                                    setEditStudent({ ...editStudent, parents: newParents });
                                  });
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: DANH SÁCH NGƯỜI ĐƯA ĐÓN ỦY QUYỀN (THÊM, SỬA ẢNH, XÓA) */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-200 pb-2 gap-1">
                  <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    4. Người Đón Ủy Quyền (Admin Thêm / Tải Ảnh)
                  </h4>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    ✓ Ảnh do Admin tải sẽ TỰ ĐỘNG ĐÃ XÁC THỰC (APPROVED)
                  </span>
                </div>

                {/* List of current authorized pickups */}
                {editStudent.authorized_pickups && editStudent.authorized_pickups.length > 0 ? (
                  <div className="space-y-2.5">
                    {editStudent.authorized_pickups.map((pickup, pickupIdx) => (
                      <div
                        key={pickup.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={pickup.avatar_url}
                            alt={pickup.name}
                            className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-[10px] rounded-pill border border-emerald-200">
                                {pickup.relationship}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-pill flex items-center gap-1">
                                <Check className="w-3 h-3" /> Đã Xác Thực
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-900 text-xs mt-0.5">{pickup.name}</h5>
                            <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-600" /> {pickup.phone}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Change photo button */}
                          <label className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer transition-colors" title="Đổi ảnh đại diện">
                            <Upload className="w-3.5 h-3.5 text-slate-600" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageFileRead(file, (url) => {
                                    const updated = [...(editStudent.authorized_pickups || [])];
                                    updated[pickupIdx] = { ...updated[pickupIdx], avatar_url: url, approval_status: 'APPROVED' };
                                    setEditStudent({ ...editStudent, authorized_pickups: updated });
                                  });
                                }
                              }}
                            />
                          </label>

                          {/* Delete pickup button */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editStudent.authorized_pickups || []).filter((_, idx) => idx !== pickupIdx);
                              setEditStudent({ ...editStudent, authorized_pickups: updated });
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                            title="Xóa người đón này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có người đón ủy quyền nào.</p>
                )}

                {/* Form to add a new pickup inside edit modal */}
                <div className="p-3 bg-emerald-100/50 border border-emerald-300 rounded-xl space-y-2.5">
                  <h5 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    Thêm Người Đón Ủy Quyền Mới (Trực Tiếp Tải Ảnh)
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-700 font-semibold text-[11px] mb-1">Họ tên người đón (*)</label>
                      <input
                        type="text"
                        placeholder="e.g., Nguyễn Văn B"
                        value={editPickupName}
                        onChange={(e) => setEditPickupName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold text-[11px] mb-1">Quan hệ nhân thân (*)</label>
                      <select
                        value={editPickupRel}
                        onChange={(e) => setEditPickupRel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 text-xs"
                      >
                        <option value="Ông Nội">Ông Nội</option>
                        <option value="Ông Ngoại">Ông Ngoại</option>
                        <option value="Bà Nội">Bà Nội</option>
                        <option value="Bà Ngoại">Bà Ngoại</option>
                        <option value="Chú">Chú Ruột</option>
                        <option value="Bác">Bác Ruột</option>
                        <option value="Cô">Cô Ruột</option>
                        <option value="Dì">Dì Ruột</option>
                        <option value="Giúp Việc Gia Đình">Giúp Việc Gia Đình</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold text-[11px] mb-1">Số điện thoại (*)</label>
                      <input
                        type="tel"
                        placeholder="e.g., 0909123456"
                        value={editPickupPhone}
                        onChange={(e) => setEditPickupPhone(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-2">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-semibold rounded-pill cursor-pointer transition-colors shadow-xs flex items-center gap-1 text-xs">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{editPickupAvatar ? 'Đã chọn ảnh người đón ✓' : 'Tải ảnh người đón từ máy...'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageFileRead(file, (url) => {
                                setEditPickupAvatar(url);
                              });
                            }
                          }}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!editPickupName || !editPickupPhone) return;
                        const newPickup: AuthorizedPickup = {
                          id: `p-${Date.now()}`,
                          name: editPickupName,
                          relationship: editPickupRel,
                          phone: editPickupPhone,
                          avatar_url: editPickupAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
                          approval_status: 'APPROVED',
                          approved_by: 'Admin / Sơ (Tải Trực Tiếp Tại Trường)',
                          approved_at: new Date().toISOString(),
                        };
                        const currentPickups = editStudent.authorized_pickups || [];
                        setEditStudent({ ...editStudent, authorized_pickups: [newPickup, ...currentPickups] });
                        setEditPickupName('');
                        setEditPickupPhone('');
                        setEditPickupAvatar('');
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-pill text-xs shadow-xs"
                    >
                      + Thêm Người Đón Này
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-pill border border-slate-200 text-xs transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-pill shadow-md text-xs transition-all active:scale-95"
                >
                  Lưu Thay Đổi Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE CLASS TRANSFER MODAL (CHUYỂN LỚP) */}
      {transferStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-convent max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                <span>Chuyển Lớp Học Sinh</span>
              </h3>
              <button
                onClick={() => setTransferStudent(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteSingleTransfer} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Chuyển bé <strong>{transferStudent.full_name}</strong> (Mã: {transferStudent.student_code}) từ lớp{' '}
                <strong className="text-sky-800">{transferStudent.class_name}</strong> sang lớp mới:
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Lớp học mới (*)</label>
                <select
                  value={newSingleClass}
                  onChange={(e) => setNewSingleClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="Mầm 1 (Rose)">Mầm 1 (Rose)</option>
                  <option value="Chồi 2 (Lily)">Chồi 2 (Lily)</option>
                  <option value="Lá 3 (Sunflower)">Lá 3 (Sunflower)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Lý do chuyển lớp</label>
                <input
                  type="text"
                  placeholder="e.g., Điều chuyển theo độ tuổi hoặc nguyện vọng phụ huynh"
                  value={singleTransferReason}
                  onChange={(e) => setSingleTransferReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-pill font-medium border border-slate-200 text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-pill font-semibold shadow-sm text-xs"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IDENTITY PHOTO LIGHTBOX OVERLAY (KÍCH THƯỚC LỚN) */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-white/20 text-slate-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-5 h-5 text-sky-400" />
                <span className="font-bold text-sm">Ảnh Định Danh Kích Thước Lớn</span>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High Resolution Image Container (Object-Contain, No Distortion) */}
            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>

            {/* Person Details Footer */}
            <div className="p-4 bg-white border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-base text-slate-900">{previewPhoto.title}</h4>
                {previewPhoto.badge && (
                  <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-pill border border-sky-300 shrink-0">
                    {previewPhoto.badge}
                  </span>
                )}
              </div>

              {previewPhoto.subtitle && (
                <p className="text-xs text-slate-500 font-medium">{previewPhoto.subtitle}</p>
              )}

              {previewPhoto.phone && (
                <div className="pt-1 flex items-center gap-2 text-xs font-mono font-bold text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SĐT Liên hệ: {previewPhoto.phone}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-pill transition-colors"
                >
                  Đóng Xem Ảnh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
