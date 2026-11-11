'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Baby,
  Check,
  X,
  AlertCircle,
  Crown,
  Trash2,
  GraduationCap,
  ChefHat,
  Heart,
  SlidersHorizontal,
} from 'lucide-react';
import { Profile, Student, ParentStudentRelation, UserRole } from '@/lib/types/schema';
import {
  DEFAULT_CLASSES_LIST,
  resolveCanonicalClassId,
  resolveClassDisplayName,
} from '@/lib/constants/classes';
import {
  getStoredRelations,
  saveStoredRelations,
  saveMultiRoleUser,
  rejectUser,
  fetchLiveProfilesFromSupabase,
  purgeUserProfile,
} from '@/lib/utils/approvalHelper';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';
import { RoleBadges } from '@/components/admin/RoleBadges';
import { MultiRoleEditorModal } from '@/components/admin/MultiRoleEditorModal';

const CHECKBOX_ROLES: Array<{
  role: UserRole;
  label: string;
  requiresSuperAdmin?: boolean;
}> = [
  { role: 'PARENT', label: 'Phụ huynh' },
  { role: 'TEACHER', label: 'Giáo viên' },
  { role: 'STAFF', label: 'Bếp / Y tế' },
  { role: 'SCHOOL_ADMIN', label: 'Quản trị trường', requiresSuperAdmin: true },
];

function normalizeSelectableRoles(
  p: Profile,
  userRelations: ParentStudentRelation[]
): UserRole[] {
  const raw: UserRole[] = [];
  if (Array.isArray(p.roles) && p.roles.length > 0) {
    raw.push(...p.roles);
  } else if (p.role && p.role !== 'GUEST') {
    raw.push(p.role);
  }
  if (userRelations.length > 0) {
    raw.push('PARENT');
  }
  const normalized = Array.from(
    new Set(
      raw
        .map((r): UserRole => (r === 'ADMIN' ? 'SCHOOL_ADMIN' : r))
        .filter((r) => r !== 'GUEST' && r !== 'SUPER_ADMIN')
    )
  );
  return normalized.length > 0 ? normalized : ['PARENT'];
}

function getProfileRowKey(p: Pick<Profile, 'id' | 'email'>): string {
  return (p.email || p.id || '').toLowerCase().trim();
}

export default function UserApprovalsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [relations, setRelations] = useState<ParentStudentRelation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>(DEFAULT_CLASSES_LIST);

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED'>('PENDING');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Multi-role checkboxes & assigned classes per user row (keyed by normalized email)
  const [rowMultiRoles, setRowMultiRoles] = useState<Record<string, UserRole[]>>({});
  const [rowClassIds, setRowClassIds] = useState<Record<string, string[]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Full multi-role + child linking modal (reuses shared MultiRoleEditorModal)
  const [modalTarget, setModalTarget] = useState<{
    user: Profile;
    roles: UserRole[];
    classIds: string[];
    studentIds: string[];
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ hasServiceRoleKey?: boolean; dbProfilesCount?: number; dbError?: string | null } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadStudentsAndClasses = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const [studentsRes, assignRes] = await Promise.all([
        fetch('/api/admin/students', { cache: 'no-store' }),
        fetch('/api/admin/teacher-assignments', { cache: 'no-store' }).catch(() => null),
      ]);

      if (studentsRes.ok) {
        const json = await studentsRes.json().catch(() => ({}));
        const list: Student[] = Array.isArray(json)
          ? json
          : (json.students || json.data || []);
        if (Array.isArray(list)) {
          setStudents(list);
        }
      }

      if (assignRes && assignRes.ok) {
        const aJson = await assignRes.json().catch(() => ({}));
        if (Array.isArray(aJson.classes) && aJson.classes.length > 0) {
          setClasses(aJson.classes);
        }
      }
    } catch (e) {
      console.error('[loadStudentsAndClasses] Error loading data:', e);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const syncRowStateFromProfiles = useCallback(
    (list: Profile[], rels: ParentStudentRelation[], classList: Array<{ id: string; name: string }>) => {
      const initialRoles: Record<string, UserRole[]> = {};
      const initialClassIds: Record<string, string[]> = {};

      list.forEach((p: Profile) => {
        const key = getProfileRowKey(p);
        const userRels = rels.filter(
          (r) =>
            (r.parent_email?.toLowerCase().trim() === key || r.parent_id === p.id) &&
            r.is_verified !== false
        );
        initialRoles[key] = normalizeSelectableRoles(p, userRels);

        const cIds = new Set<string>();
        if (Array.isArray(p.assigned_classes)) {
          p.assigned_classes.forEach((ac) => {
            const cid = resolveCanonicalClassId(ac.class_id || ac.class_name, classList);
            if (cid) cIds.add(cid);
          });
        }
        if (p.assigned_class_name) {
          p.assigned_class_name
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
            .forEach((name) => {
              const cid = resolveCanonicalClassId(name, classList);
              if (cid) cIds.add(cid);
            });
        }
        if (p.assigned_class_id) {
          const cid = resolveCanonicalClassId(p.assigned_class_id, classList);
          if (cid) cIds.add(cid);
        }
        if (cIds.size === 0 && classList[0]?.id) {
          cIds.add(classList[0].id);
        }
        initialClassIds[key] = Array.from(cIds);
      });

      setRowMultiRoles(initialRoles);
      setRowClassIds(initialClassIds);
    },
    []
  );

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/users/approvals', { cache: 'no-store' });
      const json = await res.json();
      if (json.debug) {
        setDebugInfo(json.debug);
      }

      const rels: ParentStudentRelation[] = Array.isArray(json.relations)
        ? json.relations
        : getStoredRelations();
      if (Array.isArray(json.relations)) {
        saveStoredRelations(json.relations);
      }
      setRelations(rels);

      const rawList = Array.isArray(json)
        ? json
        : (json.profiles || json.data || json.users || json.pendingProfiles || []);

      if (rawList && rawList.length > 0) {
        setProfiles(rawList);
        syncRowStateFromProfiles(rawList, rels, classes);
        return;
      }
    } catch {
      // Fallback handled below
    }

    const list = await fetchLiveProfilesFromSupabase();
    const fallbackRels = getStoredRelations();
    setProfiles(list);
    setRelations(fallbackRels);
    syncRowStateFromProfiles(list, fallbackRels, classes);
  }, [classes, syncRowStateFromProfiles]);

  useEffect(() => {
    loadStudentsAndClasses();
  }, [loadStudentsAndClasses]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let emailFound = '';
      let roleFound = '';
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.email) emailFound = parsed.email;
          if (parsed.role) roleFound = parsed.role;
        } catch {}
      }
      if (document.cookie) {
        if (!emailFound) {
          const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
          if (match) emailFound = parseSignedCookieClient(match[1]);
        }
        if (!roleFound) {
          const matchRole = document.cookie.match(/suongmai_user_role=([^;]+)/);
          if (matchRole) roleFound = parseSignedCookieClient(matchRole[1]);
        }
      }
      if (emailFound) setCurrentUserEmail(emailFound.toLowerCase().trim());
      if (roleFound) setCurrentUserRole(roleFound);
    }
    refreshData();
  }, [refreshData]);

  const cleanEmail = currentUserEmail.toLowerCase().trim();
  const isSuperAdmin =
    cleanEmail !== 'hejc108@gmail.com' &&
    cleanEmail !== 'luciaxuan178@gmail.com' &&
    (currentUserRole === 'SUPER_ADMIN' || cleanEmail === 'sadmin@suongmai.edu.vn');

  const handleToggleRowRole = (rowKey: string, role: UserRole) => {
    if (role === 'SCHOOL_ADMIN' && !isSuperAdmin) return;
    setRowMultiRoles((prev) => {
      const current = prev[rowKey] || [];
      const updated = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return { ...prev, [rowKey]: updated };
    });
  };

  const handleToggleTeacherClass = (rowKey: string, classId: string) => {
    setRowClassIds((prev) => {
      const current = prev[rowKey] || [];
      const updated = current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId];
      return { ...prev, [rowKey]: updated };
    });
  };

  const openChildLinkModal = (user: Profile) => {
    const rowKey = getProfileRowKey(user);
    const currentRoles = rowMultiRoles[rowKey] || ['PARENT'];
    const rolesWithParent = currentRoles.includes('PARENT')
      ? currentRoles
      : [...currentRoles, 'PARENT' as UserRole];

    setRowMultiRoles((prev) => ({ ...prev, [rowKey]: rolesWithParent }));

    const existingStudentIds = relations
      .filter(
        (r) =>
          (r.parent_email?.toLowerCase().trim() === rowKey || r.parent_id === user.id) &&
          r.is_verified !== false
      )
      .map((r) => r.student_id);

    setModalTarget({
      user,
      roles: rolesWithParent,
      classIds: rowClassIds[rowKey] || [],
      studentIds: existingStudentIds,
    });
  };

  const handleSaveRowApproval = async (user: Profile) => {
    const rowKey = getProfileRowKey(user);
    const selectedRoles = rowMultiRoles[rowKey] || [];
    const selectedClassIds = rowClassIds[rowKey] || [];

    if (selectedRoles.length === 0) {
      showToast('Vui lòng tích chọn ít nhất 1 vai trò cho tài khoản!', 'error');
      return;
    }

    if (selectedRoles.includes('TEACHER') && selectedClassIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 lớp phụ trách cho Giáo viên!', 'error');
      return;
    }

    const existingStudentIds = relations
      .filter(
        (r) =>
          (r.parent_email?.toLowerCase().trim() === rowKey || r.parent_id === user.id) &&
          r.is_verified !== false
      )
      .map((r) => r.student_id);

    // If PARENT is selected and no student is linked yet, open modal so admin picks student(s) first
    if (selectedRoles.includes('PARENT') && existingStudentIds.length === 0) {
      openChildLinkModal(user);
      return;
    }

    setSavingKey(rowKey);
    try {
      const assignedNames = selectedClassIds
        .map((cid) => resolveClassDisplayName(cid, classes))
        .filter(Boolean)
        .join(', ');

      await saveMultiRoleUser({
        email: user.email,
        roles: selectedRoles,
        approval_status: 'ACTIVE',
        assigned_class_id: selectedRoles.includes('TEACHER') ? selectedClassIds[0] || null : null,
        assigned_class_name: selectedRoles.includes('TEACHER') ? assignedNames || null : null,
        assigned_class_ids: selectedRoles.includes('TEACHER') ? selectedClassIds : [],
      });

      await refreshData();
      showToast(`Đã kích hoạt [${selectedRoles.join(' + ')}] cho ${user.full_name}!`);
    } catch (err: any) {
      showToast(err?.message || 'Lưu phân quyền thất bại!', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleReject = async (user: Profile) => {
    try {
      await rejectUser(user.email);
      await refreshData();
      showToast(`Đã từ chối / chặn truy cập của ${user.full_name} (${user.email})`, 'error');
    } catch (err: any) {
      showToast(err?.message || 'Từ chối thất bại!', 'error');
    }
  };

  const handleDeleteUser = async (user: Profile) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản ${user.full_name} (${user.email}) khỏi hệ thống?`)) {
      return;
    }
    try {
      await purgeUserProfile(user.email);
      await refreshData();
      showToast(`Đã xóa tài khoản ${user.email} khỏi hệ thống!`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Xóa tài khoản thất bại!', 'error');
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());

    const status = (p.approval_status || 'PENDING').toUpperCase();
    if (filterTab === 'ALL') return matchesSearch;
    if (filterTab === 'PENDING') return matchesSearch && (status === 'PENDING' || !p.approval_status);
    if (filterTab === 'ACTIVE') return matchesSearch && status === 'ACTIVE';
    if (filterTab === 'REJECTED') return matchesSearch && status === 'REJECTED';
    return matchesSearch;
  });

  const pendingCount = profiles.filter((p) => {
    const s = (p.approval_status || 'PENDING').toUpperCase();
    return s === 'PENDING' || !p.approval_status;
  }).length;
  const activeCount = profiles.filter((p) => (p.approval_status || '').toUpperCase() === 'ACTIVE').length;
  const rejectedCount = profiles.filter((p) => (p.approval_status || '').toUpperCase() === 'REJECTED').length;

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
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

      {/* Environment Diagnostic Banner */}
      {debugInfo && debugInfo.hasServiceRoleKey === false && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-900">Cảnh báo môi trường:</p>
              <p className="text-amber-800 mt-0.5">
                Chưa tìm thấy biến môi trường <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">SUPABASE_SERVICE_ROLE_KEY</code> trên server.
              </p>
            </div>
          </div>
        </div>
      )}

      {debugInfo && debugInfo.dbError && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-rose-900">Lỗi truy vấn CSDL Supabase:</p>
              <p className="text-rose-800 mt-0.5 font-mono">{debugInfo.dbError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 border border-sky-200 rounded-pill text-sky-700 text-xs font-bold mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Duyệt phân quyền Đa vai trò</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Danh sách yêu cầu truy cập & phân quyền
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Tích chọn 1 hoặc nhiều vai trò (ví dụ Giáo viên + Phụ huynh) mà không làm mất liên kết con em hay lớp phụ trách.
          </p>
        </div>

        <button
          onClick={refreshData}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer self-start sm:self-auto"
        >
          Tải lại danh sách
        </button>
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'PENDING' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã duyệt ({activeCount})
          </button>
          <button
            onClick={() => setFilterTab('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'REJECTED' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã từ chối ({rejectedCount})
          </button>
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                <th className="py-3.5 px-4">Vai trò & Liên kết (Đa vai trò)</th>
                <th className="py-3.5 px-4 text-right">Hành động</th>
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
                  const rowKey = getProfileRowKey(p);
                  const status = p.approval_status || 'PENDING';
                  const userRelations = relations.filter(
                    (r) =>
                      (r.parent_email?.toLowerCase().trim() === rowKey || r.parent_id === p.id) &&
                      r.is_verified !== false
                  );
                  const selectedRoles = rowMultiRoles[rowKey] || ['PARENT'];
                  const selectedClassIds = rowClassIds[rowKey] || [];
                  const isSuperAdminAccount =
                    p.role === 'SUPER_ADMIN' || rowKey === 'sadmin@suongmai.edu.vn';
                  const isRowSaving = savingKey === rowKey;

                  return (
                    <tr key={rowKey} className="hover:bg-slate-50/70 transition-colors align-top">
                      {/* Name & Email */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              p.avatar_url ||
                              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                            }
                            alt={p.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-sm"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-900 text-sm">{p.full_name}</p>
                              {isSuperAdminAccount && (
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold text-[10px] inline-flex items-center gap-1 border border-indigo-200">
                                  <Crown className="w-3 h-3 text-indigo-600" />
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-slate-500 text-[11px] mt-0.5">{p.email}</p>
                            {status === 'ACTIVE' && (
                              <div className="mt-1.5">
                                <RoleBadges roles={p.roles} fallbackRole={p.role} compact />
                              </div>
                            )}
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                      </td>

                      {/* Multi-Role Checkboxes + Details */}
                      <td className="py-4 px-4">
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {CHECKBOX_ROLES.map((opt) => {
                              const checked = selectedRoles.includes(opt.role);
                              const disabled =
                                isSuperAdminAccount ||
                                Boolean(opt.requiresSuperAdmin && !isSuperAdmin);
                              return (
                                <label
                                  key={opt.role}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                                    disabled
                                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                      : checked
                                      ? 'bg-sky-50 border-sky-400 text-sky-900 cursor-pointer shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={checked}
                                    onChange={() => handleToggleRowRole(rowKey, opt.role)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-sky-600"
                                  />
                                  {opt.role === 'PARENT' && <Heart className="w-3 h-3 text-sky-600" />}
                                  {opt.role === 'TEACHER' && <GraduationCap className="w-3 h-3 text-primary-700" />}
                                  {opt.role === 'STAFF' && <ChefHat className="w-3 h-3 text-amber-700" />}
                                  <span>{opt.label}</span>
                                </label>
                              );
                            })}
                          </div>

                          {/* Teacher Class Chips */}
                          {selectedRoles.includes('TEACHER') && !isSuperAdminAccount && (
                            <div className="p-2.5 bg-rose-50/40 border border-rose-200 rounded-xl space-y-1.5">
                              <span className="text-[11px] font-bold text-primary-900 block">
                                Lớp phụ trách:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {classes.map((c) => {
                                  const isSelected = selectedClassIds.includes(c.id);
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => handleToggleTeacherClass(rowKey, c.id)}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected
                                          ? 'bg-primary-700 text-white border-primary-800'
                                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span>{isSelected ? '✓' : '+'}</span>
                                      <span>{c.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Parent Child Links */}
                          {selectedRoles.includes('PARENT') && !isSuperAdminAccount && (
                            <div className="p-2.5 bg-sky-50/40 border border-sky-200 rounded-xl flex flex-wrap items-center gap-1.5">
                              {userRelations.length > 0 ? (
                                <>
                                  {userRelations.map((r) => {
                                    const matchedStudent = students.find((s) => s.id === r.student_id);
                                    const childName = matchedStudent?.full_name || r.student_name || 'Học sinh';
                                    const childClass = matchedStudent?.class_name || r.class_name || 'Mầm';
                                    return (
                                      <span
                                        key={r.id || r.student_id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      >
                                        <Baby className="w-3 h-3 text-emerald-600 shrink-0" />
                                        <span>
                                          {childName} - Lớp {childClass}
                                        </span>
                                      </span>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => openChildLinkModal(p)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer"
                                  >
                                    <span>Sửa con liên kết</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    Chưa liên kết bé nào
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openChildLinkModal(p)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer"
                                  >
                                    <span>Chọn bé</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        {isSuperAdminAccount ? (
                          <span className="text-xs text-indigo-700 font-bold italic">
                            Tài khoản Super Admin cố định
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openChildLinkModal(p)}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-[11px] rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Mở hộp thoại phân quyền chi tiết & gán con"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                              <span>Chi tiết</span>
                            </button>

                            <button
                              type="button"
                              disabled={isRowSaving}
                              onClick={() => handleSaveRowApproval(p)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-[11px] rounded-xl transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isRowSaving ? 'Đang lưu...' : 'Lưu & Duyệt'}</span>
                            </button>

                            {status !== 'REJECTED' && (
                              <button
                                type="button"
                                onClick={() => handleReject(p)}
                                title="Từ chối / Chặn truy cập"
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-semibold text-[11px] rounded-xl transition-all border border-slate-200 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Từ chối</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(p)}
                              title="Xóa vĩnh viễn tài khoản khỏi hệ thống"
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 font-semibold text-[11px] rounded-xl transition-all border border-rose-200 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Xóa</span>
                            </button>
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

      {/* Multi-Role + Child Linking Modal */}
      {modalTarget && (
        <MultiRoleEditorModal
          user={modalTarget.user}
          isSuperAdmin={isSuperAdmin}
          students={students}
          loadingStudents={loadingStudents}
          availableClasses={classes}
          initialRoles={modalTarget.roles}
          initialClassIds={modalTarget.classIds}
          initialStudentIds={modalTarget.studentIds}
          onClose={() => setModalTarget(null)}
          onSaved={async (msg) => {
            await refreshData();
            showToast(msg, 'success');
          }}
          onError={(errMsg) => showToast(errMsg, 'error')}
        />
      )}
    </div>
  );
}
