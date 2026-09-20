'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Crown,
  ChefHat,
  HeartPulse,
  ChevronDown,
} from 'lucide-react';
import { Profile, Student, ParentStudentRelation, UserRole } from '@/lib/types/schema';
import { INITIAL_STUDENTS, INITIAL_CLASSES, supabase } from '@/lib/supabase/client';
import {
  getStoredProfiles,
  getStoredRelations,
  approveTeacherUser,
  approveStaffUser,
  approveParentUser,
  promoteToSchoolAdmin,
  rejectUser,
  fetchLiveProfilesFromSupabase,
  purgeUserProfile,
} from '@/lib/utils/approvalHelper';

export default function UserApprovalsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [relations, setRelations] = useState<ParentStudentRelation[]>([]);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [classes] = useState(INITIAL_CLASSES);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED'>('PENDING');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('admin@suongmai.edu.vn');

  // Selected role & assigned class state per user row
  const [rowRoles, setRowRoles] = useState<Record<string, UserRole>>({});
  const [rowClasses, setRowClasses] = useState<Record<string, string>>({});

  // Multi-student selection modal for parent linking
  const [parentModalUser, setParentModalUser] = useState<Profile | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pending-users');
      const json = await res.json();
      if (json.success && Array.isArray(json.profiles)) {
        setProfiles(json.profiles);
        setRelations(getStoredRelations());

        const initialRoles: Record<string, UserRole> = {};
        const initialClasses: Record<string, string> = {};
        json.profiles.forEach((p: Profile) => {
          initialRoles[p.id] = p.role || 'PARENT';
          initialClasses[p.id] = p.assigned_class_id || classes[0]?.id || 'c1';
        });
        setRowRoles((prev) => ({ ...initialRoles, ...prev }));
        setRowClasses((prev) => ({ ...initialClasses, ...prev }));
        return;
      }
    } catch (e) {}

    const list = await fetchLiveProfilesFromSupabase();
    setProfiles(list);
    setRelations(getStoredRelations());

    // Init row state
    const initialRoles: Record<string, UserRole> = {};
    const initialClasses: Record<string, string> = {};
    list.forEach((p) => {
      initialRoles[p.id] = p.role || 'PARENT';
      initialClasses[p.id] = p.assigned_class_id || classes[0]?.id || 'c1';
    });
    setRowRoles((prev) => ({ ...initialRoles, ...prev }));
    setRowClasses((prev) => ({ ...initialClasses, ...prev }));
  }, [classes]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let emailFound = '';
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.email) emailFound = parsed.email;
        } catch (e) {}
      }
      if (!emailFound && document.cookie) {
        const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
        if (match) emailFound = decodeURIComponent(match[1]);
      }
      if (emailFound) setCurrentUserEmail(emailFound);
    }
    refreshData();
  }, [refreshData]);

  const isSuperAdmin = true;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- ACTIONS ---
  const handleApproveTeacher = async (user: Profile) => {
    try {
      const targetClassId = rowClasses[user.id] || classes[0]?.id || 'c1';
      const targetClass = classes.find((c) => c.id === targetClassId);
      await approveTeacherUser(user.email, targetClassId, targetClass?.name);
      await refreshData();
      showToast(`Đã kích hoạt quyền Giáo viên cho ${user.full_name} (Lớp ${targetClass?.name || ''})!`);
    } catch (err: any) {
      showToast(err.message || 'Phê duyệt thất bại!', 'error');
    }
  };

  const handleApproveStaff = async (user: Profile) => {
    try {
      await approveStaffUser(user.email);
      await refreshData();
      showToast(`Đã kích hoạt quyền Cán bộ Bếp / Y tế cho ${user.full_name}!`);
    } catch (err: any) {
      showToast(err.message || 'Phê duyệt thất bại!', 'error');
    }
  };

  const handlePromoteSchoolAdmin = async (user: Profile) => {
    try {
      await promoteToSchoolAdmin(user.email, currentUserEmail);
      await refreshData();
      showToast(`Đã nâng quyền Quản trị trường (School Admin) cho ${user.full_name}!`);
    } catch (err: any) {
      showToast(err.message || 'Chỉ Super Admin mới được cấp quyền!', 'error');
    }
  };

  const handleOpenParentModal = (user: Profile) => {
    setParentModalUser(user);
    // Find existing relations for this parent email
    const existing = relations
      .filter((r) => r.parent_email.toLowerCase().trim() === user.email.toLowerCase().trim())
      .map((r) => r.student_id);

    setSelectedStudentIds(existing.length > 0 ? existing : [students[0]?.id || 's1']);
  };

  const handleToggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleConfirmParentApproval = async () => {
    if (!parentModalUser) return;
    if (selectedStudentIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 học sinh để gán cho phụ huynh!', 'error');
      return;
    }

    try {
      await approveParentUser(parentModalUser.email, selectedStudentIds);
      await refreshData();
      setParentModalUser(null);
      showToast(`Đã duyệt phụ huynh ${parentModalUser.full_name} và liên kết ${selectedStudentIds.length} bé thành công!`);
    } catch (err: any) {
      showToast(err.message || 'Phê duyệt Phụ huynh thất bại!', 'error');
    }
  };

  const handleReject = async (user: Profile) => {
    try {
      await rejectUser(user.email);
      await refreshData();
      showToast(`Đã từ chối / chặn truy cập của ${user.full_name} (${user.email})`, 'error');
    } catch (err: any) {
      showToast(err.message || 'Từ chối thất bại!', 'error');
    }
  };

  const handlePurgeAlanvu755 = async () => {
    try {
      await purgeUserProfile('alanvu755@gmail.com');
      await refreshData();
      showToast('Đã xóa sạch dữ liệu alanvu755@gmail.com! Bạn có thể đăng ký/đăng nhập lại từ đầu.', 'success');
    } catch (e) {
      showToast('Lỗi khi làm sạch dữ liệu!', 'error');
    }
  };

  // --- FILTERING ---
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
    <div className="space-y-6 font-sans">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 border border-sky-200 rounded-pill text-sky-700 text-xs font-bold mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Whitelist Approval Gate & RBAC 5 Cấp Độ</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Danh sách yêu cầu truy cập xét duyệt</h1>
          <p className="text-slate-500 text-sm mt-1">
            Duyệt quyền Phụ huynh (gán bé), Giáo viên (gán lớp), Cán bộ Bếp/Y tế, hoặc nâng quyền Quản trị trường.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs font-bold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Alan Vũ (Super Admin)</span>
            </div>
          )}
          <button
            onClick={handlePurgeAlanvu755}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Xóa sạch dữ liệu alanvu755@gmail.com khỏi bộ nhớ và CSDL"
          >
            <span>🧹 Xóa sạch alanvu755</span>
          </button>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔄 Tải lại danh sách</span>
          </button>
        </div>
      </div>

      {/* Filter Stats & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tên hoặc email Google..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'PENDING' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã duyệt ({activeCount})
          </button>
          <button
            onClick={() => setFilterTab('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'REJECTED' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã từ chối ({rejectedCount})
          </button>
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'ALL' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({profiles.length})
          </button>
        </div>
      </div>

      {/* User Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Họ tên & Email Google</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Đề xuất Vai trò (RBAC)</th>
                <th className="py-3.5 px-4 text-right">Hành động duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    Không có tài khoản nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const status = p.approval_status || 'PENDING';
                  const userRelations = relations.filter(
                    (r) => r.parent_email.toLowerCase().trim() === p.email.toLowerCase().trim() && r.is_verified
                  );
                  const selectedRole = rowRoles[p.id] || p.role || 'PARENT';
                  const selectedClassId = rowClasses[p.id] || p.assigned_class_id || 'c1';

                  const isSuperAdminAccount = p.role === 'SUPER_ADMIN' || p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                            alt={p.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-sm"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 text-sm">{p.full_name}</p>
                              {isSuperAdminAccount && (
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold text-[10px] flex items-center gap-1 border border-indigo-200">
                                  <Crown className="w-3 h-3 text-indigo-600" />
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-slate-500 text-[11px] mt-0.5">{p.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã duyệt</span>
                          </span>
                        ) : status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Đã từ chối</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </td>

                      {/* Role Selector Dropdown */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <select
                            disabled={isSuperAdminAccount}
                            value={selectedRole}
                            onChange={(e) =>
                              setRowRoles((prev) => ({ ...prev, [p.id]: e.target.value as UserRole }))
                            }
                            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                          >
                            <option value="PARENT">Phụ huynh</option>
                            <option value="TEACHER">Giáo viên</option>
                            <option value="STAFF">Cán bộ Bếp / Y tế</option>
                            <option value="SCHOOL_ADMIN">Quản trị trường (Admin)</option>
                          </select>

                          {/* Role detail badge */}
                          {selectedRole === 'PARENT' && (
                            <p className="text-[11px] text-slate-500">
                              {userRelations.length > 0 ? (
                                <span className="text-emerald-700 font-medium">
                                  Đã liên kết {userRelations.length} bé ({userRelations.map((r) => r.student_name).join(', ')})
                                </span>
                              ) : (
                                <span className="text-amber-700 font-medium">(Chưa liên kết bé nào)</span>
                              )}
                            </p>
                          )}

                          {selectedRole === 'TEACHER' && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[11px] text-slate-500">Lớp:</span>
                              <select
                                value={selectedClassId}
                                onChange={(e) =>
                                  setRowClasses((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                                className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md py-1 px-2 text-[11px] font-bold"
                              >
                                {classes.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {selectedRole === 'SCHOOL_ADMIN' && (
                            <p className="text-[10px] text-indigo-700 font-bold">
                              {!isSuperAdmin ? '(Chỉ Alan Vũ được cấp)' : 'Quyền BGH/Hiệu trưởng'}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        {isSuperAdminAccount ? (
                          <span className="text-xs text-indigo-700 font-bold italic">Tài khoản Super Admin Cố Định</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* Parent Actions */}
                            {selectedRole === 'PARENT' && (
                              <>
                                <button
                                  onClick={() => handleOpenParentModal(p)}
                                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold text-[11px] rounded-xl transition-all flex items-center gap-1 shadow-sm"
                                >
                                  <Baby className="w-3.5 h-3.5 text-sky-600" />
                                  <span>[🔗 Gán hồ sơ con]</span>
                                </button>
                                <button
                                  onClick={() => handleOpenParentModal(p)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-xl transition-all flex items-center gap-1 shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>[✓ Duyệt]</span>
                                </button>
                              </>
                            )}

                            {/* Teacher Actions */}
                            {selectedRole === 'TEACHER' && (
                              <button
                                onClick={() => handleApproveTeacher(p)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded-xl transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>[✓ Kích hoạt]</span>
                              </button>
                            )}

                            {/* Staff Actions */}
                            {selectedRole === 'STAFF' && (
                              <button
                                onClick={() => handleApproveStaff(p)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-xl transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>[✓ Kích hoạt]</span>
                              </button>
                            )}

                            {/* School Admin Actions */}
                            {selectedRole === 'SCHOOL_ADMIN' && (
                              <button
                                disabled={!isSuperAdmin}
                                onClick={() => handlePromoteSchoolAdmin(p)}
                                className={`px-3 py-1.5 text-white font-semibold text-[11px] rounded-xl transition-all flex items-center gap-1 shadow-sm ${
                                  isSuperAdmin
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                <Crown className="w-3.5 h-3.5" />
                                <span>[✓ Nâng quyền]</span>
                              </button>
                            )}

                            {/* Reject / Block Button */}
                            {status !== 'REJECTED' && (
                              <button
                                onClick={() => handleReject(p)}
                                title="Từ chối / Chặn truy cập"
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-semibold text-[11px] rounded-xl transition-all border border-slate-200 flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>[✕ Từ chối]</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Gán 1 hoặc Nhiều học sinh cho Phụ huynh */}
      {parentModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <Baby className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Gán hồ sơ con em cho Phụ huynh</h3>
                  <p className="text-xs text-slate-500">Chọn 1 hoặc nhiều học sinh thuộc gia đình</p>
                </div>
              </div>
              <button
                onClick={() => setParentModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <p className="text-slate-500 font-medium">Tài khoản Google Phụ huynh:</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{parentModalUser.full_name}</p>
                <p className="font-mono text-slate-600">{parentModalUser.email}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Danh sách học sinh đang theo học tại trường (Tích chọn):
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {students.map((s) => {
                    const isChecked = selectedStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleToggleStudentSelection(s.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                          />
                          <img
                            src={s.avatar_url || 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80'}
                            alt={s.full_name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{s.full_name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Mã: {s.student_code} • Lớp {s.class_name || 'Mầm 1'}
                            </p>
                          </div>
                        </div>

                        {isChecked && (
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">
                            Đã chọn
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setParentModalUser(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmParentApproval}
                  className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>[✓ Xác nhận & Duyệt Phụ huynh]</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
