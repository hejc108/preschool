'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Baby,
  Check,
  Crown,
  GraduationCap,
  Heart,
  ChefHat,
  RefreshCw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { Profile, Student, UserRole } from '@/lib/types/schema';
import { DEFAULT_CLASSES_LIST, resolveCanonicalClassId } from '@/lib/constants/classes';
import { saveMultiRoleUser } from '@/lib/utils/approvalHelper';
import { normalizeVietnameseSearch } from '@/lib/utils/textSearch';

export { normalizeVietnameseSearch };

function extractStudentsPayload(json: any): Student[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.students)) return json.students;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

function mergeStudentsById(existing: Student[], incoming: Student[]): Student[] {
  if (incoming.length === 0) return existing;
  const map = new Map<string, Student>();
  existing.forEach((s) => map.set(s.id, s));
  incoming.forEach((s) => map.set(s.id, { ...(map.get(s.id) || {}), ...s }));
  return Array.from(map.values());
}

export interface MultiRoleEditorModalProps {
  user: Profile;
  isSuperAdmin: boolean;
  students: Student[];
  loadingStudents?: boolean;
  studentsError?: string | null;
  availableClasses?: Array<{ id: string; name: string }>;
  initialRoles?: UserRole[];
  initialClassIds?: string[];
  initialStudentIds?: string[];
  onStudentsLoaded?: (students: Student[]) => void;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
  onError?: (message: string) => void;
}

const SELECTABLE_ROLES: Array<{
  role: UserRole;
  label: string;
  desc: string;
  requiresSuperAdmin?: boolean;
}> = [
  { role: 'PARENT', label: 'Phụ huynh', desc: 'Theo dõi con em, xin nghỉ & đăng ký đón bé' },
  { role: 'TEACHER', label: 'Giáo viên', desc: 'Điểm danh, báo ăn, duyệt đơn lớp phụ trách' },
  { role: 'STAFF', label: 'Cán bộ Bếp / Y tế', desc: 'Quản lý thực đơn, suất ăn & sổ sức khỏe' },
  {
    role: 'SCHOOL_ADMIN',
    label: 'Quản trị trường',
    desc: 'Điều hành toàn trường trên Admin Web',
    requiresSuperAdmin: true,
  },
];

function normalizeRoleArray(raw: unknown[], fallback: UserRole[]): UserRole[] {
  const normalized = Array.from(
    new Set(
      raw
        .map((r) => (String(r || '').toUpperCase().trim() === 'ADMIN' ? 'SCHOOL_ADMIN' : String(r || '').toUpperCase().trim()))
        .filter((r): r is UserRole => Boolean(r) && r !== 'GUEST')
    )
  );
  return normalized.length > 0 ? normalized : fallback;
}

export function MultiRoleEditorModal({
  user,
  isSuperAdmin,
  students,
  loadingStudents = false,
  studentsError: parentStudentsError = null,
  availableClasses,
  initialRoles,
  initialClassIds,
  initialStudentIds,
  onStudentsLoaded,
  onClose,
  onSaved,
  onError,
}: MultiRoleEditorModalProps) {
  const classOptions = availableClasses && availableClasses.length > 0 ? availableClasses : DEFAULT_CLASSES_LIST;

  const derivedInitialRoles = useMemo<UserRole[]>(() => {
    const raw =
      initialRoles && initialRoles.length > 0
        ? initialRoles
        : user.roles && user.roles.length > 0
        ? user.roles
        : user.role && user.role !== 'GUEST'
        ? [user.role]
        : ['PARENT'];
    return normalizeRoleArray(raw, ['PARENT']);
  }, [user, initialRoles]);

  const extractClassIds = useCallback(
    (sourceUser: Profile, preset?: string[]): string[] => {
      if (preset && preset.length > 0) {
        return Array.from(new Set(preset.map((c) => resolveCanonicalClassId(c, classOptions)).filter(Boolean)));
      }
      const found = new Set<string>();
      if (Array.isArray(sourceUser.assigned_classes)) {
        sourceUser.assigned_classes.forEach((ac) => {
          const cid = resolveCanonicalClassId(ac.class_id || ac.class_name, classOptions);
          if (cid) found.add(cid);
        });
      }
      if (sourceUser.assigned_class_name) {
        sourceUser.assigned_class_name
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((name) => {
            const cid = resolveCanonicalClassId(name, classOptions);
            if (cid) found.add(cid);
          });
      }
      if (sourceUser.assigned_class_id) {
        const cid = resolveCanonicalClassId(sourceUser.assigned_class_id, classOptions);
        if (cid) found.add(cid);
      }
      return Array.from(found);
    },
    [classOptions]
  );

  const derivedInitialClassIds = useMemo<string[]>(
    () => extractClassIds(user, initialClassIds),
    [user, initialClassIds, extractClassIds]
  );

  const derivedInitialStudentIds = useMemo<string[]>(() => {
    if (initialStudentIds) return initialStudentIds;
    if (Array.isArray(user.linked_students)) {
      return user.linked_students.map((ls) => ls.student_id).filter(Boolean);
    }
    return [];
  }, [user, initialStudentIds]);

  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(derivedInitialRoles);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(derivedInitialClassIds);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(derivedInitialStudentIds);
  const [hydratedLinkedStudents, setHydratedLinkedStudents] = useState(user.linked_students || []);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  const [allStudents, setAllStudents] = useState<Student[]>(students);
  const [serverSearchResults, setServerSearchResults] = useState<Student[] | null>(null);
  const [fetchingStudents, setFetchingStudents] = useState<boolean>(false);
  const [searchingStudents, setSearchingStudents] = useState<boolean>(false);
  const [studentsError, setStudentsError] = useState<string | null>(parentStudentsError);

  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Guard flags so async fetches never overwrite selections already modified by the admin
  const dirtyRolesRef = useRef(false);
  const dirtyClassesRef = useRef(false);
  const dirtyStudentsRef = useRef(false);
  const fetchedStudentsOnceRef = useRef(false);
  const lastEmailRef = useRef<string>('');

  // Reset selections only when opening for a different user
  useEffect(() => {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    if (lastEmailRef.current !== cleanEmail) {
      lastEmailRef.current = cleanEmail;
      dirtyRolesRef.current = false;
      dirtyClassesRef.current = false;
      dirtyStudentsRef.current = false;
      setSelectedRoles(derivedInitialRoles);
      setSelectedClassIds(derivedInitialClassIds);
      setSelectedStudentIds(derivedInitialStudentIds);
      setHydratedLinkedStudents(user.linked_students || []);
      setStudentSearch('');
      setServerSearchResults(null);
      setLocalError(null);
    }
  }, [user.email, user.linked_students, derivedInitialRoles, derivedInitialClassIds, derivedInitialStudentIds]);

  // Sync parent students prop into allStudents whenever populated
  useEffect(() => {
    if (Array.isArray(students) && students.length > 0) {
      setAllStudents((prev) => mergeStudentsById(prev, students));
      setStudentsError(null);
    }
  }, [students]);

  useEffect(() => {
    if (parentStudentsError) {
      setStudentsError(parentStudentsError);
    }
  }, [parentStudentsError]);

  // Fetch authoritative multi-role list from public.user_roles via /api/admin/users?email=...
  useEffect(() => {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    if (!cleanEmail) return;

    let cancelled = false;
    setLoadingUserDetails(true);
    fetch(`/api/admin/users?email=${encodeURIComponent(cleanEmail)}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.success) {
          return;
        }
        const fetchedUser: Profile | null = json.user || json.users?.[0] || null;
        if (fetchedUser) {
          if (Array.isArray(fetchedUser.linked_students)) {
            setHydratedLinkedStudents(fetchedUser.linked_students);
          }
          if (!initialRoles && !dirtyRolesRef.current) {
            const dbRoles =
              Array.isArray(fetchedUser.roles) && fetchedUser.roles.length > 0
                ? fetchedUser.roles
                : fetchedUser.role && fetchedUser.role !== 'GUEST'
                ? [fetchedUser.role]
                : [];
            if (dbRoles.length > 0) {
              setSelectedRoles(normalizeRoleArray(dbRoles, ['PARENT']));
            }
          }
          if (!initialClassIds && !dirtyClassesRef.current) {
            const dbClassIds = extractClassIds(fetchedUser);
            if (dbClassIds.length > 0) {
              setSelectedClassIds(dbClassIds);
            }
          }
          if (!initialStudentIds && !dirtyStudentsRef.current && Array.isArray(fetchedUser.linked_students)) {
            setSelectedStudentIds(fetchedUser.linked_students.map((ls) => ls.student_id).filter(Boolean));
          }
        }
      })
      .catch(() => {
        // Keep existing derived props if offline
      })
      .finally(() => {
        if (!cancelled) setLoadingUserDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.email, initialRoles, initialClassIds, initialStudentIds, extractClassIds]);

  const fetchStudentsList = useCallback(async () => {
    setFetchingStudents(true);
    setStudentsError(null);
    try {
      const res = await fetch('/api/admin/students', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        const errText =
          json.error ||
          json.message ||
          `Không thể tải danh sách học sinh (HTTP ${res.status}).`;
        setStudentsError(errText);
        return;
      }
      const list = extractStudentsPayload(json);
      setAllStudents(list);
      onStudentsLoaded?.(list);
    } catch (err: any) {
      setStudentsError(err?.message || 'Lỗi kết nối khi tải danh sách học sinh.');
    } finally {
      fetchedStudentsOnceRef.current = true;
      setFetchingStudents(false);
    }
  }, [onStudentsLoaded]);

  // Auto-fetch default student roster on modal open (even when search box is empty)
  useEffect(() => {
    if (!fetchedStudentsOnceRef.current && !fetchingStudents) {
      void fetchStudentsList();
    }
  }, [fetchingStudents, fetchStudentsList]);

  // Debounced (300ms) server search via /api/admin/students?q=... when typing
  useEffect(() => {
    const trimmed = studentSearch.trim();
    if (!trimmed) {
      setServerSearchResults(null);
      setSearchingStudents(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const res = await fetch(`/api/admin/students?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          return;
        }
        const matches = extractStudentsPayload(json);
        setServerSearchResults(matches);
        if (matches.length > 0) {
          setAllStudents((prev) => mergeStudentsById(prev, matches));
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Keep client-side filtered allStudents visible if transient network error
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchingStudents(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [studentSearch]);

  const isTargetSuperAdmin =
    user.role === 'SUPER_ADMIN' || user.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn';

  const toggleRole = (role: UserRole) => {
    if (role === 'SCHOOL_ADMIN' && !isSuperAdmin) return;
    dirtyRolesRef.current = true;
    const enablingParent = role === 'PARENT' && !selectedRoles.includes('PARENT');
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    if (enablingParent && (allStudents.length === 0 || Boolean(studentsError)) && !fetchingStudents) {
      void fetchStudentsList();
    }
  };

  const toggleClass = (cid: string) => {
    dirtyClassesRef.current = true;
    setSelectedClassIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const toggleStudent = (sid: string) => {
    dirtyStudentsRef.current = true;
    setSelectedStudentIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const filteredStudents = useMemo(() => {
    const q = normalizeVietnameseSearch(studentSearch);
    if (!q) return allStudents;

    const localMatches = allStudents.filter((s) => {
      return (
        normalizeVietnameseSearch(s.full_name).includes(q) ||
        normalizeVietnameseSearch(s.student_code).includes(q) ||
        normalizeVietnameseSearch(s.class_name || '').includes(q) ||
        normalizeVietnameseSearch(s.citizen_id || '').includes(q)
      );
    });

    if (!serverSearchResults || serverSearchResults.length === 0) {
      return localMatches;
    }

    const matchingServer = serverSearchResults.filter((s) => {
      return (
        normalizeVietnameseSearch(s.full_name).includes(q) ||
        normalizeVietnameseSearch(s.student_code).includes(q) ||
        normalizeVietnameseSearch(s.class_name || '').includes(q) ||
        normalizeVietnameseSearch(s.citizen_id || '').includes(q)
      );
    });

    return mergeStudentsById(localMatches, matchingServer);
  }, [allStudents, serverSearchResults, studentSearch]);

  const handleSave = async () => {
    setLocalError(null);
    const rolesToPersist: UserRole[] = isTargetSuperAdmin
      ? Array.from(new Set<UserRole>(['SUPER_ADMIN', ...selectedRoles]))
      : Array.from(new Set<UserRole>(selectedRoles));

    if (rolesToPersist.length === 0) {
      setLocalError('Vui lòng chọn ít nhất 1 vai trò cho tài khoản này.');
      return;
    }

    if (rolesToPersist.includes('TEACHER') && selectedClassIds.length === 0) {
      setLocalError('Vui lòng chọn ít nhất 1 lớp phụ trách khi cấp quyền Giáo viên.');
      return;
    }

    setSaving(true);
    try {
      const assignedNames = classOptions
        .filter((c) => selectedClassIds.includes(c.id))
        .map((c) => c.name)
        .join(', ');

      await saveMultiRoleUser({
        email: user.email,
        roles: rolesToPersist,
        approval_status: 'ACTIVE',
        assigned_class_id: rolesToPersist.includes('TEACHER') ? selectedClassIds[0] || null : null,
        assigned_class_name: rolesToPersist.includes('TEACHER') ? assignedNames || null : null,
        assigned_class_ids: rolesToPersist.includes('TEACHER') ? selectedClassIds : [],
        student_ids: selectedStudentIds,
        clear_student_links: selectedStudentIds.length === 0 && !rolesToPersist.includes('PARENT'),
      });

      const roleText = rolesToPersist.join(' + ');
      await onSaved(`Đã lưu phân quyền [${roleText}] cho ${user.full_name}.`);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Lưu phân quyền thất bại.';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  const isRefreshingStudents = loadingStudents || fetchingStudents;
  const isStudentListLoading = isRefreshingStudents && allStudents.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Phân quyền Đa vai trò (Multi-Role)
              </h3>
              <p className="text-xs text-slate-500">
                Cho phép giữ đồng thời nhiều vai trò (ví dụ Giáo viên + Phụ huynh)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* User Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                <span>{user.full_name}</span>
                {isTargetSuperAdmin && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold inline-flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Super Admin
                  </span>
                )}
              </p>
              <p className="text-xs font-mono text-slate-500 truncate">{user.email}</p>
            </div>
            {loadingUserDetails && (
              <span className="text-[11px] font-medium text-slate-500 shrink-0">
                Đang đồng bộ quyền...
              </span>
            )}
          </div>

          {localError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {/* 1. Multi-Role Checkboxes */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              1. Chọn vai trò được kích hoạt (tích 1 hoặc nhiều)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SELECTABLE_ROLES.map((item) => {
                const checked = selectedRoles.includes(item.role);
                const disabled = Boolean(item.requiresSuperAdmin && !isSuperAdmin);
                return (
                  <label
                    key={item.role}
                    className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                      disabled
                        ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                        : checked
                        ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300 cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleRole(item.role)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <div className="min-w-0 text-xs">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {item.role === 'TEACHER' && <GraduationCap className="w-3.5 h-3.5 text-primary-700" />}
                        {item.role === 'PARENT' && <Heart className="w-3.5 h-3.5 text-sky-600" />}
                        {item.role === 'STAFF' && <ChefHat className="w-3.5 h-3.5 text-amber-700" />}
                        {item.role === 'SCHOOL_ADMIN' && <Crown className="w-3.5 h-3.5 text-purple-600" />}
                        <span>{item.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 2. Teacher Class Assignment */}
          {selectedRoles.includes('TEACHER') && (
            <div className="space-y-2 p-4 bg-rose-50/40 border border-rose-200 rounded-xl">
              <label className="block text-xs font-bold uppercase tracking-wider text-primary-900">
                2. Phân công lớp phụ trách (Giáo viên)
              </label>
              <div className="flex flex-wrap gap-2">
                {classOptions.map((c) => {
                  const active = selectedClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-primary-700 text-white border-primary-800 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>{active ? '✓' : '+'}</span>
                      <span>Lớp {c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Parent Child Linking */}
          {(selectedRoles.includes('PARENT') || selectedStudentIds.length > 0) && (
            <div className="space-y-2.5 p-4 bg-sky-50/40 border border-sky-200 rounded-xl">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-sky-900">
                  {selectedRoles.includes('TEACHER') ? '3.' : '2.'} Liên kết hồ sơ con em (Phụ huynh)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isRefreshingStudents}
                    onClick={fetchStudentsList}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-semibold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 disabled:opacity-50 cursor-pointer"
                    title="Tải lại danh sách học sinh"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingStudents ? 'animate-spin' : ''}`} />
                    <span>Tải lại ({allStudents.length})</span>
                  </button>
                  <span className="text-[11px] font-bold text-sky-700 bg-white px-2.5 py-0.5 rounded-pill border border-sky-200">
                    Đã chọn: {selectedStudentIds.length} bé
                  </span>
                </div>
              </div>

              {selectedStudentIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudentIds.map((sid) => {
                    const st = allStudents.find((s) => s.id === sid);
                    const fallback = hydratedLinkedStudents.find((ls) => ls.student_id === sid);
                    const name = st?.full_name || fallback?.full_name || 'Học sinh';
                    const cls = st?.class_name || fallback?.class_name || '';
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => toggleStudent(sid)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                        title="Bấm để bỏ chọn bé này"
                      >
                        <Baby className="w-3 h-3" />
                        <span>
                          {name}
                          {cls && cls !== 'Chưa phân lớp' ? ` - Lớp ${cls}` : ''}
                        </span>
                        <X className="w-3 h-3" />
                      </button>
                    );
                  })}
                </div>
              )}

              {studentsError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{studentsError}</span>
                  </span>
                  <button
                    type="button"
                    onClick={fetchStudentsList}
                    className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 font-bold text-[11px] hover:bg-rose-100 shrink-0 cursor-pointer"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm tên bé, mã học sinh hoặc lớp..."
                  className="w-full bg-white border border-slate-300 focus:border-sky-500 rounded-xl py-2 pl-9 pr-24 text-xs text-slate-800 focus:outline-none"
                />
                {searchingStudents && (
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-medium text-sky-600 pointer-events-none">
                    Đang tìm...
                  </span>
                )}
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => setStudentSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-white">
                {isStudentListLoading || (searchingStudents && filteredStudents.length === 0) ? (
                  <p className="py-6 text-center text-xs text-slate-500">Đang tải danh sách học sinh...</p>
                ) : filteredStudents.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-xs text-slate-500">
                      {studentsError
                        ? 'Không tìm thấy học sinh nào (không thể tải dữ liệu từ máy chủ).'
                        : allStudents.length === 0
                        ? 'Không tìm thấy học sinh nào.'
                        : 'Không tìm thấy học sinh nào phù hợp từ khóa tìm kiếm.'}
                    </p>
                    {allStudents.length === 0 && (
                      <button
                        type="button"
                        onClick={fetchStudentsList}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Tải danh sách học sinh</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredStudents.map((s) => {
                    const checked = selectedStudentIds.includes(s.id);
                    const classDisplay =
                      s.class_name && s.class_name !== 'Chưa phân lớp'
                        ? `Lớp ${s.class_name}`
                        : 'Chưa phân lớp';
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                          checked
                            ? 'bg-sky-50 border-sky-300'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {s.full_name} — {classDisplay}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Mã: {s.student_code}
                            </p>
                          </div>
                        </div>
                        {checked && (
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md">
                            Đã chọn
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-sm transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Đang đồng bộ...' : 'Lưu phân quyền'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
