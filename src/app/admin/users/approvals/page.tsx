'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  UserPlus,
  Users,
  Baby,
  Sparkles,
  Filter,
  Check,
  X,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { Profile, Student, ParentStudentRelation } from '@/lib/types/schema';
import { INITIAL_STUDENTS } from '@/lib/supabase/client';
import {
  getStoredProfiles,
  getStoredRelations,
  approveTeacherUser,
  approveParentUser,
  rejectUser,
} from '@/lib/utils/approvalHelper';

export default function UserApprovalsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [relations, setRelations] = useState<ParentStudentRelation[]>([]);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED'>('PENDING');

  // Modal for linking parent to student
  const [selectedParentProfile, setSelectedParentProfile] = useState<Profile | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refreshData = () => {
    setProfiles(getStoredProfiles());
    setRelations(getStoredRelations());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApproveTeacher = (email: string, name: string) => {
    approveTeacherUser(email);
    refreshData();
    showToast(`Đã duyệt tài khoản giáo viên cho ${name} (${email}) thành công!`);
  };

  const handleOpenAssignStudentModal = (profile: Profile) => {
    setSelectedParentProfile(profile);
    setSelectedStudentId(students[0]?.id || '');
  };

  const handleConfirmParentStudentLink = () => {
    if (!selectedParentProfile || !selectedStudentId) return;

    const targetStudent = students.find((s) => s.id === selectedStudentId);
    approveParentUser(
      selectedParentProfile.email,
      selectedStudentId,
      targetStudent?.full_name
    );

    refreshData();
    setSelectedParentProfile(null);
    showToast(
      `Đã duyệt phụ huynh ${selectedParentProfile.full_name} và liên kết với học sinh ${targetStudent?.full_name || ''}!`
    );
  };

  const handleReject = (email: string, name: string) => {
    rejectUser(email);
    refreshData();
    showToast(`Đã từ chối quyền truy cập của ${name} (${email})`, 'error');
  };

  // Filtered accounts
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());

    const status = p.approval_status || 'PENDING';
    if (filterTab === 'ALL') return matchesSearch;
    if (filterTab === 'PENDING') return matchesSearch && status === 'PENDING';
    if (filterTab === 'ACTIVE') return matchesSearch && status === 'ACTIVE';
    if (filterTab === 'REJECTED') return matchesSearch && status === 'REJECTED';
    return matchesSearch;
  });

  const pendingCount = profiles.filter((p) => (p.approval_status || 'PENDING') === 'PENDING').length;
  const activeCount = profiles.filter((p) => p.approval_status === 'ACTIVE').length;
  const rejectedCount = profiles.filter((p) => p.approval_status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 border border-sky-200 rounded-pill text-sky-700 text-xs font-bold mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Whitelist Approval Gate (Phân quyền 2 Lớp)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Duyệt tài khoản người dùng</h1>
          <p className="text-slate-500 text-sm mt-1">
            Xác nhận danh tính Google Login cho Giáo viên hoặc Gán hồ sơ con em cho Phụ huynh trước khi mở quyền hệ thống.
          </p>
        </div>

        <button
          onClick={refreshData}
          className="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all border border-slate-200"
        >
          Làm mới dữ liệu
        </button>
      </div>

      {/* Counter Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setFilterTab('PENDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'PENDING'
              ? 'bg-amber-50/80 border-amber-300 shadow-sm ring-2 ring-amber-400'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Chờ duyệt</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-900 mt-2">{pendingCount}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Tài khoản chưa xác nhận</p>
        </div>

        <div
          onClick={() => setFilterTab('ACTIVE')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'ACTIVE'
              ? 'bg-emerald-50/80 border-emerald-300 shadow-sm ring-2 ring-emerald-400'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Đã duyệt</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-2">{activeCount}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Đã mở quyền sử dụng</p>
        </div>

        <div
          onClick={() => setFilterTab('REJECTED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'REJECTED'
              ? 'bg-rose-50/80 border-rose-300 shadow-sm ring-2 ring-rose-400'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">Từ chối</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-900 mt-2">{rejectedCount}</p>
          <p className="text-[11px] text-rose-700 mt-0.5">Bị chặn vào hệ thống</p>
        </div>

        <div
          onClick={() => setFilterTab('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'ALL'
              ? 'bg-sky-50/80 border-sky-300 shadow-sm ring-2 ring-sky-400'
              : 'bg-white border-slate-200 hover:border-sky-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-800">Tất cả tài khoản</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-sky-900 mt-2">{profiles.length}</p>
          <p className="text-[11px] text-sky-700 mt-0.5">Tổng số bản ghi</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo họ tên hoặc email Google..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'PENDING' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'ACTIVE' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã duyệt ({activeCount})
          </button>
          <button
            onClick={() => setFilterTab('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'REJECTED' ? 'bg-white text-rose-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Từ chối ({rejectedCount})
          </button>
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'ALL' ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      {/* User Approval Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Người dùng (Google / Profile)</th>
                <th className="py-3.5 px-4">Vai trò đề xuất</th>
                <th className="py-3.5 px-4">Trạng thái duyệt</th>
                <th className="py-3.5 px-4">Hồ sơ con em liên kết</th>
                <th className="py-3.5 px-4 text-right">Hành động duyệt Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Không có tài khoản nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const status = p.approval_status || 'PENDING';
                  const userRelations = relations.filter(
                    (r) => r.parent_email.toLowerCase().trim() === p.email.toLowerCase().trim() && r.is_verified
                  );

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                            alt={p.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{p.full_name}</p>
                            <p className="font-mono text-slate-500 text-[11px]">{p.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            p.role === 'SUPER_ADMIN' || p.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : p.role === 'TEACHER'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : p.role === 'PARENT'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {p.role === 'TEACHER' ? (
                            <GraduationCap className="w-3.5 h-3.5" />
                          ) : p.role === 'PARENT' ? (
                            <Baby className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                          {p.role}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        {status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã duyệt (ACTIVE)</span>
                          </span>
                        ) : status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Từ chối (REJECTED)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Chờ duyệt (PENDING)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {userRelations.length > 0 ? (
                          <div className="space-y-1">
                            {userRelations.map((r) => (
                              <div
                                key={r.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-medium"
                              >
                                <Baby className="w-3 h-3 text-emerald-600" />
                                <span>{r.student_name || 'Học sinh'}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa gán học sinh</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Approve Teacher Button */}
                          <button
                            onClick={() => handleApproveTeacher(p.email, p.full_name)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>[Xác nhận Giáo viên]</span>
                          </button>

                          {/* Approve Parent Button */}
                          <button
                            onClick={() => handleOpenAssignStudentModal(p)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] rounded-lg shadow-sm transition-all flex items-center gap-1"
                          >
                            <Baby className="w-3.5 h-3.5" />
                            <span>[Gán hồ sơ Con em]</span>
                          </button>

                          {/* Reject Button */}
                          {status !== 'REJECTED' && (
                            <button
                              onClick={() => handleReject(p.email, p.full_name)}
                              title="Từ chối truy cập"
                              className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-lg transition-colors border border-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Gán hồ sơ Con em & Xác nhận phụ huynh */}
      {selectedParentProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <Baby className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Gán hồ sơ học sinh cho Phụ huynh</h3>
              </div>
              <button
                onClick={() => setSelectedParentProfile(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <p className="text-slate-500">Phụ huynh được chọn:</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedParentProfile.full_name}</p>
                <p className="font-mono text-slate-600">{selectedParentProfile.email}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Chọn con em đang theo học trong trường:
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-800 font-medium focus:outline-none focus:border-sky-500"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.student_code}) - Lớp {s.class_name || 'Mầm 1'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setSelectedParentProfile(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmParentStudentLink}
                  className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>[Xác nhận Phụ huynh]</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
