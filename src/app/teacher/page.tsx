'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle2, HeartPulse, Utensils, Lock, 
  ChevronLeft, Plus, Sparkles, Check, AlertCircle, LogOut, 
  UserCheck, ShieldAlert, Phone, RefreshCw, ChevronDown, Layers
} from 'lucide-react';
import Link from 'next/link';
import { 
  INITIAL_STUDENTS, 
  INITIAL_MEDICATIONS, 
  INITIAL_ABSENCE_REQUESTS, 
  INITIAL_MEAL_EXCEPTIONS 
} from '@/lib/supabase/client';
import { MedicationRequest, MealException, AbsenceRequest, Student, ParentContact, AuthorizedPickup } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { hasRealAllergy, translateAllergy, isNonRegularStudent } from '@/lib/utils/studentClassification';

export interface AssignedClass {
  id: string;
  name: string;
}

export interface TeacherStudent extends Student {
  attendance: 'PRESENT' | 'PRESENT_LATE' | 'ABSENT';
  checkedOut: boolean;
  checkoutReason: string;
  is_official?: boolean;
  is_non_regular?: boolean;
}

export interface ClassCacheData {
  students: TeacherStudent[];
  medications: MedicationRequest[];
  mealExceptions: MealException[];
  timestamp: number;
}
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { fetchLiveProfilesFromSupabase, getStoredProfiles, getStoredRelations, saveStoredProfiles } from '@/lib/utils/approvalHelper';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

import { supabase } from '@/lib/supabase/client';

function translateReasonTag(tag: string, language: string): string {
  if (language !== 'en') return tag;
  const tagMap: Record<string, string> = {
    '#Biếng_ăn': '#Poor_appetite',
    '#Chỉ_uống_canh': '#Soup_only',
    '#Khó_tiêu': '#Indigestion',
    '#Mệt_mỏi': '#Fatigued',
    '#Dị_ứng_thức_ăn': '#Food_allergy',
  };
  return tagMap[tag] || tag;
}

export default function TeacherPwaPage() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'MEDICATION' | 'MEALS' | 'CHECKOUT'>('ATTENDANCE');

  // Teacher class assignment state (T1 = assigned, T0 = unassigned empty state)
  const [isClassAssigned, setIsClassAssigned] = useState<boolean>(true);
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [activeClass, setActiveClass] = useState<AssignedClass | null>(null);
  const [assignedClassName, setAssignedClassName] = useState<string>('Mầm');
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [refreshingClass, setRefreshingClass] = useState<boolean>(false);
  const [teacherEmail, setTeacherEmail] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [hasParentAccess, setHasParentAccess] = useState<boolean>(false);

  // Attendance & SWR Cache State
  const [students, setStudents] = useState<TeacherStudent[]>([]);

  // Sĩ số chính thức (đúng định mức 170 bé) & Học sinh ngoài danh sách (21 bé bổ sung)
  const officialStudents = useMemo(
    () => students.filter((s) => s.is_official !== false && !s.is_non_regular),
    [students]
  );
  const nonRegularStudents = useMemo(
    () => students.filter((s) => s.is_official === false || s.is_non_regular),
    [students]
  );

  const [isKitchenLocked, setIsKitchenLocked] = useState(false);
  const [kitchenReportData, setKitchenReportData] = useState<{
    isWeekend?: boolean;
    isPastCutoff?: boolean;
    currentVietnamTime?: string;
    report?: any;
    canFinalize?: boolean;
    canUpdate?: boolean;
    remainingUpdates?: number;
    uiState?: 'WEEKEND' | 'NOT_FINALIZED' | 'FINALIZED_CAN_UPDATE' | 'MAX_UPDATES_REACHED' | 'PAST_CUTOFF_LOCKED';
  } | null>(null);
  const [isFinalizingKitchen, setIsFinalizingKitchen] = useState(false);
  const [absences, setAbsences] = useState<AbsenceRequest[]>(INITIAL_ABSENCE_REQUESTS);

  // Medication State
  const [medications, setMedications] = useState<MedicationRequest[]>(INITIAL_MEDICATIONS);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMedStudentId, setNewMedStudentId] = useState('');
  const [newMedSlot, setNewMedSlot] = useState<'SLOT_1130' | 'SLOT_1430'>('SLOT_1130');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedNotes, setNewMedNotes] = useState('');

  // Meal Exceptions State
  const [mealExceptions, setMealExceptions] = useState<MealException[]>(INITIAL_MEAL_EXCEPTIONS);
  const [selectedStudentForMeal, setSelectedStudentForMeal] = useState('');
  const [selectedIntakeLevel, setSelectedIntakeLevel] = useState<'HALF' | 'REFUSED'>('HALF');
  const [selectedTags, setSelectedTags] = useState<string[]>(['#Biếng_ăn']);

  // In-Memory SWR Cache for classes
  const [classDataCache, setClassDataCache] = useState<Record<string, ClassCacheData>>({});
  const classDataCacheRef = useRef<Record<string, ClassCacheData>>({});
  useEffect(() => {
    classDataCacheRef.current = classDataCache;
  }, [classDataCache]);

  const activeClassRef = useRef<AssignedClass | null>(activeClass);
  useEffect(() => {
    activeClassRef.current = activeClass;
  }, [activeClass]);

  // Synchronous cache updater for current active class to prevent stale data on rapid tab switching
  const updateActiveCache = (updater: (prevEntry: ClassCacheData) => ClassCacheData) => {
    if (!activeClass) return;
    const cid = activeClass.id;
    setClassDataCache((prev) => {
      const current = prev[cid] || {
        students: [],
        medications: [],
        mealExceptions: [],
        timestamp: Date.now(),
      };
      const updated = updater(current);
      classDataCacheRef.current[cid] = updated;
      return { ...prev, [cid]: updated };
    });
  };

  // SWR Fetcher: Fetches fresh data for target class from optimized Server API
  const fetchClassData = async (targetClass: AssignedClass, isBackground = false) => {
    const isCached = Boolean(classDataCacheRef.current[targetClass.id]);
    if (!isCached && !isBackground) {
      setLoadingStudents(true);
    }

    try {
      const res = await fetch(
        `/api/teacher/attendance?class_id=${encodeURIComponent(targetClass.id)}&class_name=${encodeURIComponent(targetClass.name)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        const freshStudents: TeacherStudent[] = json.students || [];
        const freshMeds: MedicationRequest[] = json.medications || [];
        const freshMeals: MealException[] = json.meal_exceptions || [];

        const cacheEntry: ClassCacheData = {
          students: freshStudents,
          medications: freshMeds,
          mealExceptions: freshMeals,
          timestamp: Date.now(),
        };

        setClassDataCache((prev) => ({
          ...prev,
          [targetClass.id]: cacheEntry,
        }));
        classDataCacheRef.current[targetClass.id] = cacheEntry;

        if (activeClassRef.current?.id === targetClass.id) {
          setStudents(freshStudents);
          if (freshMeds.length > 0) setMedications(freshMeds);
          if (freshMeals.length > 0) setMealExceptions(freshMeals);
          if (freshStudents.length > 0) {
            setNewMedStudentId((prev) => prev || freshStudents[0].id);
            setSelectedStudentForMeal((prev) => prev || freshStudents[0].id);
          }
        }
        return cacheEntry;
      } else {
        // Fallback: direct Supabase fetch
        let baseStudents: any[] = [];
        const { data } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', targetClass.id)
          .order('full_name', { ascending: true });

        if (data && data.length > 0) {
          baseStudents = data;
        } else {
          const sRes = await fetch('/api/admin/students', { cache: 'no-store' });
          if (sRes.ok) {
            const sJson = await sRes.json();
            baseStudents = (sJson.students || []).filter(
              (s: any) =>
                s.class_id === targetClass.id ||
                s.class_name?.toLowerCase().trim() === targetClass.name.toLowerCase().trim()
            );
          }
        }

        const mapped: TeacherStudent[] = baseStudents.map((s: any) => {
          const isNonReg = isNonRegularStudent(s, targetClass.name);
          return {
            ...s,
            attendance: 'PRESENT' as const,
            checkedOut: false,
            checkoutReason: '',
            is_official: !isNonReg,
            is_non_regular: isNonReg,
          };
        });

        const fallbackEntry: ClassCacheData = {
          students: mapped,
          medications: [],
          mealExceptions: [],
          timestamp: Date.now(),
        };
        setClassDataCache((prev) => ({ ...prev, [targetClass.id]: fallbackEntry }));
        classDataCacheRef.current[targetClass.id] = fallbackEntry;
        if (activeClassRef.current?.id === targetClass.id) {
          setStudents(mapped);
        }
        return fallbackEntry;
      }
    } catch (e) {
      console.warn('[TeacherSWR] Error fetching class data:', e);
    } finally {
      if (activeClassRef.current?.id === targetClass.id) {
        setLoadingStudents(false);
      }
    }
  };

  const fetchKitchenReportStatus = async (classId: string) => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/teacher/attendance/kitchen-report?class_id=${encodeURIComponent(classId)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        setKitchenReportData(json);
        if (json.uiState === 'PAST_CUTOFF_LOCKED' || json.uiState === 'MAX_UPDATES_REACHED' || json.uiState === 'WEEKEND') {
          setIsKitchenLocked(true);
        } else {
          setIsKitchenLocked(false);
        }
      }
    } catch (e) {
      console.warn('Lỗi tải trạng thái báo bếp:', e);
    }
  };

  // Instant SWR Switch (<0.1s switch, zero lag, no 0/0 screen)
  const handleSelectClass = (c: AssignedClass) => {
    if (activeClass?.id === c.id) return;

    setActiveClass(c);
    setAssignedClassName(c.name);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('suongmai_teacher_active_class_id', c.id);
    }

    // A. Check in-memory cache:
    const cached = classDataCacheRef.current[c.id];
    if (cached) {
      // 0s instant render, no loading spinner, no "0/0" blank screen!
      setStudents(cached.students);
      setMedications(cached.medications);
      setMealExceptions(cached.mealExceptions);
      setLoadingStudents(false);
      if (cached.students.length > 0) {
        setNewMedStudentId(cached.students[0].id);
        setSelectedStudentForMeal(cached.students[0].id);
      }
    } else {
      // Only show loading on very first open
      setStudents([]);
      setLoadingStudents(true);
    }

    // B. Revalidate fresh data from Supabase in background
    fetchClassData(c, Boolean(cached));
    fetchKitchenReportStatus(c.id);
  };

  // Initial class load
  useEffect(() => {
    if (!activeClass) return;
    const isCached = Boolean(classDataCacheRef.current[activeClass.id]);
    fetchClassData(activeClass, isCached);
    fetchKitchenReportStatus(activeClass.id);
  }, [activeClass]);

  // Background Preload: Silently warm up cache for other assigned classes
  useEffect(() => {
    if (assignedClasses.length > 1) {
      assignedClasses.forEach((cls) => {
        if (!classDataCacheRef.current[cls.id]) {
          fetchClassData(cls, true);
        }
      });
    }
  }, [assignedClasses]);

  const handleLogout = async () => {
    try {
      if (supabase && supabase.auth) await supabase.auth.signOut();
    } catch (e) {}
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    const cookiesToClear = [
      'suongmai_session',
      'suongmai_user_email',
      'suongmai_user_role',
      'suongmai_username',
      'suongmai_has_children',
    ];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('suongmai_auth_user');
      localStorage.removeItem('suongmai_user_profiles_v1');
      localStorage.removeItem('suongmai_parent_relations_v1');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.includes('supabase') || key.includes('suongmai')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      window.location.href = '/auth';
    }
  };

  const loadTeacherAssignments = async (email: string) => {
    try {
      const res = await fetch(`/api/teacher/classes?email=${encodeURIComponent(email)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.classes && json.classes.length > 0) {
          const list: AssignedClass[] = json.classes.map((a: any) => ({
            id: a.class_id,
            name: a.class_name,
          }));
          setAssignedClasses(list);
          setIsClassAssigned(true);

          // Check sessionStorage for remembered active class
          const savedClassId =
            typeof window !== 'undefined'
              ? sessionStorage.getItem('suongmai_teacher_active_class_id')
              : null;
          const found = list.find((c) => c.id === savedClassId);
          const chosen = found || list[0];

          setActiveClass(chosen);
          setAssignedClassName(chosen.name);
          return;
        }
      }
    } catch (e) {
      console.warn('API teacher classes notice:', e);
    }

    // Fallback: Check profile
    const profiles = getStoredProfiles();
    const profile = profiles.find((p) => p.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (profile && profile.role === 'TEACHER') {
      if (!profile.assigned_class_id && !profile.assigned_class_name) {
        setIsClassAssigned(false);
        setAssignedClasses([]);
        setActiveClass(null);
      } else {
        setIsClassAssigned(true);
        const rawNames = profile.assigned_class_name || 'Mầm';
        const names = rawNames.split(',').map((n) => n.trim()).filter(Boolean);
        const fallbackClasses: AssignedClass[] = names.map((name) => ({
          id: profile.assigned_class_id || `c-${name.toLowerCase().replace(/\s+/g, '')}`,
          name,
        }));
        setAssignedClasses(fallbackClasses);
        const savedClassId =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('suongmai_teacher_active_class_id')
            : null;
        const found = fallbackClasses.find((c) => c.id === savedClassId);
        const chosen = found || fallbackClasses[0];
        setActiveClass(chosen);
        setAssignedClassName(chosen.name);
      }
    }
  };

  useEffect(() => {
    async function checkAuthAndRole() {
      if (typeof window === 'undefined') return;

      let emailFound = '';
      let roleFound = '';
      const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (match) emailFound = parseSignedCookieClient(match[1]);

      const roleMatch = document.cookie.match(/suongmai_user_role=([^;]+)/);
      if (roleMatch) roleFound = parseSignedCookieClient(roleMatch[1]);

      if (!emailFound) {
        const saved = localStorage.getItem('suongmai_auth_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.email) emailFound = parsed.email;
            if (parsed.role) roleFound = parsed.role;
          } catch (e) {}
        }
      }

      if (!emailFound) {
        // Fallback: check active Supabase Auth session
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user?.email) {
            emailFound = data.user.email.toLowerCase().trim();
          }
        } catch (e) {}
      }

      if (!emailFound) {
        setIsAuthenticated(false);
        setIsCheckingStatus(false);
        return;
      }

      const cleanEmail = emailFound.toLowerCase().trim();
      setTeacherEmail(cleanEmail);
      setIsAuthenticated(true);

      // Verify live role from Supabase DB via check-my-status (no-cache)
      try {
        const res = await fetch(`/api/auth/check-my-status?email=${encodeURIComponent(cleanEmail)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.isApproved) {
            const liveRole = json.role || 'TEACHER';
            setUserRole(liveRole);

            // Update localStorage auth user
            try {
              const saved = localStorage.getItem('suongmai_auth_user');
              const parsed = saved ? JSON.parse(saved) : {};
              parsed.email = cleanEmail;
              parsed.role = liveRole;
              localStorage.setItem('suongmai_auth_user', JSON.stringify(parsed));
            } catch (e) {}

            // Update cached profile in localStorage if exists
            const profiles = getStoredProfiles();
            const pIdx = profiles.findIndex((p) => p.email.toLowerCase().trim() === cleanEmail);
            if (pIdx !== -1) {
              profiles[pIdx].role = liveRole;
              profiles[pIdx].approval_status = 'ACTIVE';
              saveStoredProfiles(profiles);
            }

            // Requirement 2: If live role is PARENT, redirect to /parent
            if (liveRole === 'PARENT') {
              window.location.href = '/parent';
              return;
            }

            if (json.hasChildren) {
              setHasParentAccess(true);
            }

            await loadTeacherAssignments(cleanEmail);
            setIsCheckingStatus(false);
            return;
          } else {
            // Not approved yet
            window.location.href = `/auth/pending-approval?type=teacher&email=${encodeURIComponent(cleanEmail)}`;
            return;
          }
        }
      } catch (err) {
        console.warn('[TeacherPwaPage] Error checking status:', err);
      }

      // Fallback if network failed
      const profiles = getStoredProfiles();
      const profile = profiles.find((p) => p.email.toLowerCase().trim() === cleanEmail);
      const fallbackRole = profile?.role || roleFound || 'TEACHER';
      setUserRole(fallbackRole);

      if (fallbackRole === 'PARENT') {
        window.location.href = '/parent';
        return;
      }

      const hasCookieFlag = document.cookie.includes('suongmai_has_children');
      const relations = getStoredRelations();
      const hasChildInRelations = relations.some(
        (r) => r.parent_email?.toLowerCase().trim() === cleanEmail && r.is_verified
      );
      if (hasCookieFlag || hasChildInRelations) {
        setHasParentAccess(true);
      }

      await loadTeacherAssignments(cleanEmail);
      setIsCheckingStatus(false);
    }

    checkAuthAndRole();
  }, []);

  const handleInPlaceGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      let activeSupabase = supabase;
      try {
        const keyRes = await fetch('/api/auth/public-key');
        const keyData = await keyRes.json();
        if (keyData.url && keyData.anonKey && !keyData.anonKey.includes('mock-key')) {
          const { createBrowserClient } = await import('@supabase/ssr');
          activeSupabase = createBrowserClient(keyData.url, keyData.anonKey);
        }
      } catch (e) {}

      await activeSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=/teacher`,
        },
      });
    } catch (err) {
      console.error('In-place Google login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRefreshClassAssignment = async () => {
    setRefreshingClass(true);
    try {
      if (teacherEmail) {
        await loadTeacherAssignments(teacherEmail);
      }
    } catch (e) {
      console.warn('Error checking teacher class assignment:', e);
    } finally {
      setTimeout(() => setRefreshingClass(false), 500);
    }
  };

  // Late Checkout State
  const [showLateCheckoutModal, setShowLateCheckoutModal] = useState(false);
  const [lateStudentId, setLateStudentId] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState('Phụ huynh bận công việc đột xuất');

  // --- TEACHER EMPTY STATE (Section III.2 Technical Directive) ---
  if (!isClassAssigned) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>

        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 text-center shadow-xl relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl mb-4 text-amber-600 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-amber-900 tracking-tight mb-3">
            Tài khoản Giáo viên chưa phân công lớp 🏫
          </h2>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 px-2">
            Tài khoản Giáo viên của bạn chưa được phân công lớp phụ trách. Vui lòng liên hệ Ban Giám Hiệu để được xếp lớp giảng dạy.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium mb-6 flex items-center justify-center gap-2">
            <Phone className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Hotline Ban Giám Hiệu: <strong>028.3896.1234</strong></span>
          </div>

          <button
            onClick={handleRefreshClassAssignment}
            disabled={refreshingClass}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-pill transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingClass ? 'animate-spin' : ''}`} />
            <span>[ 🔄 Kiểm tra lại ]</span>
          </button>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-pill transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Đăng xuất / Đổi tài khoản khác</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ACTIONS & HANDLERS ---

  const syncAttendanceToDb = async (records: Array<{ student_id: string; status: string }>) => {
    try {
      await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPSERT_ATTENDANCE',
          records,
        }),
      });
    } catch (e) {
      console.error('Failed to sync attendance to Supabase:', e);
    }
  };

  const handleSelectAllPresent = () => {
    if (isKitchenLocked) return;
    const updated = students.map((s) => {
      const hasAbsence = absences.some((a) => a.student_id === s.id && a.status === 'SUBMITTED_VALID');
      return {
        ...s,
        attendance: (hasAbsence ? 'ABSENT' : 'PRESENT') as 'PRESENT' | 'PRESENT_LATE' | 'ABSENT',
      };
    });
    setStudents(updated);
    updateActiveCache((entry) => ({
      ...entry,
      students: updated,
    }));
    syncAttendanceToDb(
      updated.map((s) => ({
        student_id: s.id,
        status: s.attendance === 'ABSENT' ? 'ABSENT_EXCUSED' : s.attendance,
      }))
    );
  };

  const handleToggleAttendance = (id: string, status: 'PRESENT' | 'PRESENT_LATE' | 'ABSENT') => {
    if (isKitchenLocked) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attendance: status } : s))
    );
    updateActiveCache((entry) => ({
      ...entry,
      students: entry.students.map((s) => (s.id === id ? { ...s, attendance: status } : s)),
    }));
    syncAttendanceToDb([
      {
        student_id: id,
        status: status === 'ABSENT' ? 'ABSENT_UNEXCUSED' : status,
      },
    ]);
  };

  const handleAcknowledgeAbsence = (absenceId: string) => {
    setAbsences((prev) =>
      prev.map((a) => (a.id === absenceId ? { ...a, acknowledged_by_teacher: true } : a))
    );
  };

  const handleDispatchToKitchen = async () => {
    if (!activeClass || isKitchenLocked || isFinalizingKitchen) return;

    const officialPresentCount = officialStudents.filter(
      (s) => s.attendance === 'PRESENT' || s.attendance === 'PRESENT_LATE'
    ).length;

    const isUpdate = kitchenReportData?.report && kitchenReportData.report.update_count === 0;
    const confirmMessage = isUpdate
      ? `Xác nhận cập nhật lại sĩ số báo bếp Lớp ${activeClass.name}: ${officialPresentCount}/${officialStudents.length} suất ăn?\n(Lưu ý: Đây là lần cập nhật phát sinh cuối cùng trong ngày)`
      : `Xác nhận chốt sĩ số báo bếp Lớp ${activeClass.name}: ${officialPresentCount}/${officialStudents.length} suất ăn cho học sinh chính quy?`;

    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
      return;
    }

    setIsFinalizingKitchen(true);

    try {
      // 1. Đồng bộ điểm danh toàn bộ học sinh
      await syncAttendanceToDb(
        students.map((s) => ({
          student_id: s.id,
          status: s.attendance === 'ABSENT' ? 'ABSENT_UNEXCUSED' : s.attendance,
        }))
      );

      // 2. Gửi request chốt báo bếp lên API Route
      const res = await fetch('/api/teacher/attendance/kitchen-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: activeClass.id,
          present_count: officialPresentCount,
          submitted_by: teacherEmail || 'Giáo viên',
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(`⚠️ ${json.error || 'Không thể chốt báo bếp'}`);
        await fetchKitchenReportStatus(activeClass.id);
        return;
      }

      await fetchKitchenReportStatus(activeClass.id);

      alert(`⚡ ${json.message || 'Thành công'}\n\n• Lớp: ${activeClass.name}\n• Sĩ số ăn bán trú: ${officialPresentCount}/${officialStudents.length} bé`);
    } catch (e: any) {
      alert(`⚠️ Lỗi khi chốt báo bếp: ${e.message || e}`);
    } finally {
      setIsFinalizingKitchen(false);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === newMedStudentId);
    const tempMed: MedicationRequest = {
      id: `m-${Date.now()}`,
      student_id: newMedStudentId,
      student_name: student?.full_name || 'Bé',
      date: new Date().toISOString().split('T')[0],
      time_slot: newMedSlot,
      medication_name: newMedName,
      dosage: newMedDosage,
      instructions: newMedNotes,
      status: 'PENDING',
    };
    setMedications([tempMed, ...medications]);
    updateActiveCache((entry) => ({
      ...entry,
      medications: [tempMed, ...entry.medications],
    }));
    setShowAddMedModal(false);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedNotes('');

    try {
      const res = await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_MEDICATION',
          student_id: tempMed.student_id,
          time_slot: tempMed.time_slot,
          medication_name: tempMed.medication_name,
          dosage: tempMed.dosage,
          instructions: tempMed.instructions,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.medication) {
          setMedications((prev) => prev.map((m) => (m.id === tempMed.id ? json.medication : m)));
          updateActiveCache((entry) => ({
            ...entry,
            medications: entry.medications.map((m) => (m.id === tempMed.id ? json.medication : m)),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to save medication to DB:', err);
    }
  };

  const handleAdministerMed = async (medId: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, status: 'ADMINISTERED' } : m))
    );
    updateActiveCache((entry) => ({
      ...entry,
      medications: entry.medications.map((m) => (m.id === medId ? { ...m, status: 'ADMINISTERED' } : m)),
    }));
    try {
      await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADMINISTER_MEDICATION',
          id: medId,
        }),
      });
    } catch (err) {
      console.error('Failed to administer medication in DB:', err);
    }
  };

  const handleSaveMealException = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === selectedStudentForMeal);
    const newEx: MealException = {
      id: `me-${Date.now()}`,
      student_id: selectedStudentForMeal,
      student_name: student?.full_name || 'Bé',
      date: new Date().toISOString().split('T')[0],
      meal_type: 'LUNCH',
      intake_level: selectedIntakeLevel,
      reason_tags: selectedTags,
      created_at: new Date().toISOString(),
    };
    setMealExceptions([newEx, ...mealExceptions]);
    updateActiveCache((entry) => ({
      ...entry,
      mealExceptions: [newEx, ...entry.mealExceptions],
    }));
    try {
      await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_MEAL_EXCEPTION',
          student_id: selectedStudentForMeal,
          meal_type: 'LUNCH',
          intake_level: selectedIntakeLevel,
          reason_tags: selectedTags,
        }),
      });
    } catch (err) {
      console.error('Failed to save meal exception to DB:', err);
    }
    alert(`${t('teacher.btn_save_meal_exception')}: ${student?.full_name}`);
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleMassCheckout = async () => {
    const updated = students.map((s) => ({ ...s, checkedOut: true }));
    setStudents(updated);
    updateActiveCache((entry) => ({
      ...entry,
      students: updated,
    }));
    try {
      await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECKOUT',
          student_ids: students.map((s) => s.id),
        }),
      });
    } catch (err) {
      console.error('Failed to mass checkout in DB:', err);
    }
    alert(`✅ ${t('teacher.checkout_done')}`);
  };

  const handleSaveLateCheckout = async () => {
    if (!lateStudentId) return;
    const targetId = lateStudentId;
    const targetReason = lateReason;
    const updated = students.map((s) =>
      s.id === targetId ? { ...s, checkedOut: true, checkoutReason: targetReason } : s
    );
    setStudents(updated);
    updateActiveCache((entry) => ({
      ...entry,
      students: updated,
    }));
    setShowLateCheckoutModal(false);
    setLateStudentId(null);
    try {
      await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECKOUT',
          student_ids: [targetId],
          checkout_reason: targetReason,
        }),
      });
    } catch (err) {
      console.error('Failed to save late checkout in DB:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-surface-base to-amber-50/50 text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-rose-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-slate-800 text-center ring-1 ring-primary-900/10">
          {/* Circular Official Logo */}
          <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-primary-700 via-secondary-500 to-primary-600 mx-auto mb-4 shadow-xl shadow-primary-700/20">
            <img 
              src="/images/logo.png" 
              alt="Mầm Non Sương Mai Logo" 
              className="w-full h-full object-cover rounded-full bg-white"
            />
          </div>
          
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Cổng Tác Nghiệp Giáo Viên</h1>
          <p className="text-primary-700 font-bold text-xs mt-1 mb-6">Trường Mầm Non Sương Mai</p>

          <button
            onClick={handleInPlaceGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:border-primary-500 text-slate-800 font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm mb-4"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isLoggingIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
          </button>

          <p className="text-xs text-slate-500 leading-relaxed mb-4">Dành cho Giáo viên & BGH trường Mầm Non Sương Mai.</p>

          {/* Direct PWA Install Trigger Banner */}
          <div className="pt-4 border-t border-rose-100 flex items-center justify-between text-left bg-rose-50/60 p-3 rounded-2xl border border-rose-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                📱
              </div>
              <div>
                <p className="text-xs font-bold text-primary-900">Ứng dụng PWA Sương Mai</p>
                <p className="text-[10px] text-slate-500">Cài lên MH chính để dùng nhanh</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-primary-700 bg-white px-2 py-1 rounded-lg border border-rose-200 shadow-2xs">
              Sẵn sàng cài đặt
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isCheckingStatus && isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-lg space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl text-primary-700 shadow-2xs">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            Đang đồng bộ quyền truy cập Giáo viên...
          </h2>
          <p className="text-xs text-slate-500">
            Hệ thống đang kiểm tra trạng thái phân công tác nghiệp từ Trường Mầm Non Sương Mai.
          </p>
        </div>
      </div>
    );
  }

  if (userRole === 'PARENT') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-convent p-6 sm:p-8 shadow-xl relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 border border-amber-200 rounded-convent mb-4 text-amber-600 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">Tài Khoản Phụ Huynh</h2>
          <p className="text-slate-600 text-xs leading-relaxed mb-6">
            Bạn đang đăng nhập bằng tài khoản Phụ huynh (<span className="font-semibold text-slate-800">{teacherEmail}</span>). Bạn không có quyền truy cập Cổng Tác Nghiệp Giáo Viên.
          </p>

          <div className="space-y-3">
            <Link
              href="/parent"
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-pill shadow-sm transition-all text-sm"
            >
              <span>Chuyển Đến Trang Phụ Huynh</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-pill transition-all text-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('teacher.switch_account')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-20">
      {/* Mobile Top Header - Official Warm Brand Red */}
      <header className="px-3 py-2.5 bg-primary-700 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          {['SUPER_ADMIN', 'ADMIN', 'SCHOOL_ADMIN'].includes(userRole) ? (
            <Link
              href="/admin/dashboard"
              className="p-1.5 bg-primary-800 rounded-pill text-white hover:bg-primary-600 transition-colors shrink-0"
              title="Về trang Quản trị"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
              SM
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-extrabold text-white text-sm sm:text-base leading-tight truncate">
              {t('teacher.app_title')}
            </h1>

            {/* Class Selector Dropdown in Header */}
            {assignedClasses.length > 1 ? (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-rose-200 font-medium whitespace-nowrap">Đang xem:</span>
                <div className="relative inline-block">
                  <select
                    value={activeClass?.id || ''}
                    onChange={(e) => {
                      const sel = assignedClasses.find((c) => c.id === e.target.value);
                      if (sel) handleSelectClass(sel);
                    }}
                    className="bg-white/20 hover:bg-white/30 text-white font-extrabold text-[11px] py-0.5 pl-1.5 pr-5 rounded-md border border-white/30 appearance-none cursor-pointer focus:outline-none max-w-[110px] sm:max-w-[140px] truncate"
                  >
                    {assignedClasses.map((c) => (
                      <option key={c.id} value={c.id} className="text-slate-900 font-bold bg-white">
                        Lớp {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-white absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-rose-100 font-semibold truncate">
                Lớp {activeClass?.name || assignedClassName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
          {hasParentAccess && (
            <Link
              href="/parent"
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-pill text-[10px] sm:text-[11px] font-bold shadow-sm flex items-center gap-1 transition-all shrink-0 whitespace-nowrap animate-pulse hover:animate-none"
              title="Chuyển sang Cổng Phụ huynh xem thông tin con"
            >
              <span>👨‍👧 Con tôi</span>
            </Link>
          )}
          <LanguageSwitcher />
          <button
            onClick={handleLogout}
            className="p-1.5 bg-white/15 hover:bg-white/25 active:bg-white/35 text-white rounded-full transition-all flex items-center gap-1 cursor-pointer shrink-0"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4 text-white" />
            <span className="text-[10px] font-bold hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Segmented Control Bar (Pills) for Multi-Class Quick Switch */}
      {assignedClasses.length > 1 && (
        <div className="bg-primary-800/95 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto border-b border-primary-600/40 sticky top-[48px] sm:top-[52px] z-10 shadow-xs">
          <span className="text-[10px] text-rose-200 whitespace-nowrap font-semibold flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3 text-rose-300" /> Chọn lớp:
          </span>
          <div className="flex items-center gap-1">
            {assignedClasses.map((c) => {
              const isActive = activeClass?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectClass(c)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold ring-1 ring-amber-300'
                      : 'bg-primary-900/50 text-rose-100 hover:bg-primary-900/80 hover:text-white'
                  }`}
                >
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4 Main Mobile Navigation Tabs */}
      <div className="grid grid-cols-4 bg-white border-b border-slate-200 text-[11px] font-bold text-center">
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 ${
            activeTab === 'ATTENDANCE' ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('teacher.tab_attendance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('MEDICATION')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 relative ${
            activeTab === 'MEDICATION' ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>{t('teacher.tab_medication')}</span>
          {medications.filter((m) => m.status === 'PENDING').length > 0 && (
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-secondary-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('MEALS')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 ${
            activeTab === 'MEALS' ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>{t('teacher.tab_meals')}</span>
        </button>

        <button
          onClick={() => setActiveTab('CHECKOUT')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 ${
            activeTab === 'CHECKOUT' ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span>{t('teacher.tab_checkout')}</span>
        </button>
      </div>

      {/* --- TAB 1: MORNING ATTENDANCE --- */}
      {activeTab === 'ATTENDANCE' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto pb-28">
          {/* Weekend Notification Banner */}
          {kitchenReportData?.isWeekend && (
            <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-2xl text-xs text-slate-700 flex items-center gap-2.5 shadow-xs">
              <span className="text-xl shrink-0">📅</span>
              <div>
                <p className="font-extrabold text-slate-800">Thông báo cuối tuần:</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Hôm nay là cuối tuần - Trường nghỉ học, hệ thống đóng điểm danh &amp; báo bếp
                </p>
              </div>
            </div>
          )}

          {/* Quick Action Bar & Summary Count */}
          <div className="flex items-center justify-between bg-white border border-rose-100 p-3 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-bold">{t('teacher.class_headcount')}</span>
              <span className="px-2 py-0.5 bg-rose-50 text-primary-800 border border-rose-200 rounded-full font-extrabold text-xs">
                {officialStudents.filter((s) => s.attendance === 'PRESENT' || s.attendance === 'PRESENT_LATE').length} / {officialStudents.length}
              </span>
            </div>

            <button
              onClick={handleSelectAllPresent}
              disabled={isKitchenLocked || Boolean(kitchenReportData?.isWeekend)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-primary-600 text-primary-700 hover:bg-rose-50 active:bg-rose-100 disabled:opacity-50 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary-700" />
              <span>{t('teacher.btn_select_all')}</span>
            </button>
          </div>

          {/* Approved Absence Notices Card */}
          {absences.map((abs) => (
            <div key={abs.id} className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs space-y-2 text-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-secondary-600 shrink-0" />
                  {t('teacher.absence_notice')}
                </span>
                <span className="text-[10px] font-mono text-slate-500 font-medium">&lt;08:30 AM</span>
              </div>
              
              {/* Display Child Name First */}
              <p className="text-slate-800 leading-relaxed">
                {t('common.child')}: <strong className="text-slate-900 font-extrabold text-sm">{abs.student_name}</strong> • {t('teacher.parent_label')} <em>&quot;{abs.reason}&quot;</em>.
              </p>

              <div className="flex items-center justify-between pt-1">
                {abs.acknowledged_by_teacher ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-extrabold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> {t('teacher.ack_done')}
                  </span>
                ) : (
                  <button
                    onClick={() => handleAcknowledgeAbsence(abs.id)}
                    className="ml-auto px-3.5 py-1.5 bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white font-extrabold rounded-full text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>{t('teacher.ack_btn')}</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Student Roll Call List */}
          {loadingStudents ? (
            <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-rose-100 p-6 shadow-xs">
              <div className="w-8 h-8 border-3 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-600 font-semibold">
                Đang tải danh sách học sinh Lớp {activeClass?.name || assignedClassName}...
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              Chưa có học sinh nào trong Lớp {activeClass?.name || assignedClassName}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Toàn bộ danh sách học sinh hiển thị đồng nhất, sạch đẹp, không viền vàng, không tag Bổ sung */}
              {students.map((student) => {
                const hasMedToday = medications.some((m) => m.student_id === student.id);
                const hasAllergy = hasRealAllergy(student.allergies);
                const isAttendanceDisabled = isKitchenLocked || Boolean(kitchenReportData?.isWeekend);

                return (
                  <div key={student.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {student.avatar_url ? (
                          <img
                            src={student.avatar_url}
                            alt={student.full_name}
                            className="w-10 h-10 rounded-full border-2 border-rose-200 object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-primary-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {student.full_name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{student.full_name}</h4>
                          <span className="text-xs text-slate-400 font-mono">{student.student_code}</span>
                        </div>
                      </div>

                      {/* Medical & Allergy Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                        {hasMedToday && (
                          <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold flex items-center gap-1">
                            💊 {language === 'en' ? 'Medication' : 'Có dặn thuốc'}
                          </span>
                        )}
                        {hasAllergy && (
                          <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-secondary-800 border border-amber-200 rounded-full font-bold">
                            ⚠️ {translateAllergy(student.allergies, language)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Concise 3-State Thumb Buttons ([ Có mặt ] - [ Đến muộn ] - [ Vắng ]) */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => handleToggleAttendance(student.id, 'PRESENT')}
                        disabled={isAttendanceDisabled}
                        className={`h-[38px] px-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex items-center justify-center cursor-pointer ${
                          student.attendance === 'PRESENT'
                            ? 'bg-emerald-600 text-white shadow-sm font-bold'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {t('teacher.btn_present')}
                      </button>

                      <button
                        onClick={() => handleToggleAttendance(student.id, 'PRESENT_LATE')}
                        disabled={isAttendanceDisabled}
                        className={`h-[38px] px-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex items-center justify-center cursor-pointer ${
                          student.attendance === 'PRESENT_LATE'
                            ? 'bg-secondary-600 text-white shadow-sm font-bold'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {t('teacher.btn_late')}
                      </button>

                      <button
                        onClick={() => handleToggleAttendance(student.id, 'ABSENT')}
                        disabled={isAttendanceDisabled}
                        className={`h-[38px] px-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex items-center justify-center cursor-pointer ${
                          student.attendance === 'ABSENT'
                            ? 'bg-rose-500 text-white shadow-sm font-bold'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {t('teacher.btn_absent')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fixed Bottom Dispatch Button (5 Dynamic States) */}
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white/95 border-t border-rose-100 backdrop-blur-md z-30">
            {(() => {
              const uiState = kitchenReportData?.uiState || (isKitchenLocked ? 'PAST_CUTOFF_LOCKED' : 'NOT_FINALIZED');
              const report = kitchenReportData?.report;

              const formatSubmittedTime = (isoString?: string) => {
                if (!isoString) return '';
                try {
                  const d = new Date(isoString);
                  return new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }).format(d);
                } catch {
                  return '';
                }
              };

              const submittedTime = formatSubmittedTime(report?.last_submitted_at || report?.first_submitted_at);

              // 1. Cuối tuần (Thứ 7 / CN): Vô hiệu hóa
              if (uiState === 'WEEKEND') {
                return (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-slate-100 text-slate-400 border border-slate-200 shadow-xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <span>📅 Cuối tuần - Trường nghỉ học</span>
                  </button>
                );
              }

              // 2. Quá 08:00 sáng: Tự động khóa cứng
              if (uiState === 'PAST_CUTOFF_LOCKED') {
                return (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-slate-100 text-slate-400 border border-slate-200 shadow-xs flex items-center justify-center gap-2 cursor-not-allowed text-center"
                  >
                    <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">🔒 Đã khóa chốt bếp (Sau 08:00) - Liên hệ BGH nếu cần điều chỉnh</span>
                  </button>
                );
              }

              // 3. Đã dùng hết lượt sửa (update_count = 1): Khóa cứng
              if (uiState === 'MAX_UPDATES_REACHED') {
                return (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-slate-100 text-slate-500 border border-slate-300 shadow-xs flex items-center justify-center gap-2 cursor-not-allowed text-center"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      ✓ Đã cập nhật lúc {submittedTime || 'sáng nay'} ({report?.final_count ?? officialStudents.length} suất) - Đã hết lượt sửa
                    </span>
                  </button>
                );
              }

              // 4. Đã chốt lần 1, còn trước 08:00 (update_count = 0): Cho phép cập nhật phát sinh lần cuối
              if (uiState === 'FINALIZED_CAN_UPDATE') {
                return (
                  <button
                    onClick={handleDispatchToKitchen}
                    disabled={isFinalizingKitchen}
                    className="w-full py-3.5 px-4 rounded-full font-extrabold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    <span className="truncate">
                      {isFinalizingKitchen
                        ? 'Đang cập nhật...'
                        : `✓ Đã chốt lúc ${submittedTime || 'sáng nay'} (${report?.final_count ?? officialStudents.length} suất) - Bấm để cập nhật lại (còn 1 lần)`}
                    </span>
                  </button>
                );
              }

              // 5. Chưa chốt (Trước 08:00, chưa có bản ghi)
              return (
                <button
                  onClick={handleDispatchToKitchen}
                  disabled={isFinalizingKitchen}
                  className="w-full py-3.5 px-4 rounded-full font-extrabold text-sm bg-primary-700 hover:bg-primary-800 text-white shadow-xl shadow-primary-700/30 active:scale-[0.98] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-white shrink-0" />
                  <span>{isFinalizingKitchen ? 'Đang chốt báo bếp...' : t('teacher.btn_dispatch_kitchen')}</span>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* --- TAB 2: FAST MEDICATION LOGGER --- */}
      {activeTab === 'MEDICATION' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3.5 rounded-convent shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{t('teacher.med_title')}</h3>
              <p className="text-xs text-sky-600 font-semibold">{t('teacher.no_photo_rule')}</p>
            </div>

            <button
              onClick={() => setShowAddMedModal(true)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-pill shadow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{t('teacher.btn_add_med')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {medications.map((med) => (
              <div key={med.id} className="p-4 bg-white border border-slate-200 rounded-convent space-y-3 shadow-sm text-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 bg-sky-50 text-sky-800 rounded-pill border border-sky-200">
                      {med.time_slot === 'SLOT_1130' ? t('teacher.slot_1130') : t('teacher.slot_1430')}
                    </span>
                    <h4 className="font-bold text-slate-900 text-base mt-1">{med.student_name}</h4>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-pill font-bold border ${
                    med.status === 'ADMINISTERED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {med.status === 'ADMINISTERED' ? t('teacher.med_status_done') : t('teacher.med_status_pending')}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div><strong className="text-slate-700">{t('teacher.med_name')}</strong> <span className="text-sky-700 font-bold">{med.medication_name}</span></div>
                  <div><strong className="text-slate-700">{t('teacher.med_dosage')}</strong> {med.dosage}</div>
                  {med.instructions && <div className="text-slate-500">{t('teacher.med_instructions')} {med.instructions}</div>}
                </div>

                {med.status !== 'ADMINISTERED' ? (
                  <button
                    onClick={() => handleAdministerMed(med.id)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-pill shadow-md transition-all active:scale-98"
                  >
                    {t('teacher.btn_administer')}
                  </button>
                ) : (
                  <span className="block text-center text-xs text-emerald-600 font-bold">
                    {t('teacher.administer_done')}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Add Medication Modal */}
          {showAddMedModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-convent max-w-sm w-full p-5 space-y-3.5 text-xs shadow-2xl text-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-sky-900 text-sm">{t('teacher.med_title')}</h3>
                  <button onClick={() => setShowAddMedModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
                </div>

                <form onSubmit={handleAddMedication} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">{t('common.child')} (*)</label>
                    <select
                      value={newMedStudentId}
                      onChange={(e) => setNewMedStudentId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.student_code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">{t('teacher.med_time_slot')}</label>
                    <select
                      value={newMedSlot}
                      onChange={(e) => setNewMedSlot(e.target.value as 'SLOT_1130' | 'SLOT_1430')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sky-700 font-bold"
                    >
                      <option value="SLOT_1130">{t('teacher.slot_1130')}</option>
                      <option value="SLOT_1430">{t('teacher.slot_1430')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">{t('teacher.med_name_label')}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Siro Ho Astex"
                      value={newMedName}
                      onChange={(e) => setNewMedName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">{t('teacher.med_dosage_label')}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 5ml"
                      value={newMedDosage}
                      onChange={(e) => setNewMedDosage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">{t('teacher.med_notes_label')}</label>
                    <input
                      type="text"
                      placeholder="..."
                      value={newMedNotes}
                      onChange={(e) => setNewMedNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow-md transition-all mt-2"
                  >
                    {t('common.save')}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: MEAL EXCEPTIONS TAGGING --- */}
      {activeTab === 'MEALS' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-convent text-xs space-y-1 text-slate-800">
            <span className="font-bold text-sky-900 block">{t('teacher.meal_rules_title')}</span>
            <p className="text-slate-700">
              <code className="font-mono text-emerald-600 font-bold">LUNCH</code> • <code className="font-mono text-sky-700 font-bold">intake_level</code> & <code className="font-mono text-sky-700 font-bold">reason_tags</code>.
            </p>
          </div>

          {/* Form Tag Exception */}
          <form onSubmit={handleSaveMealException} className="p-4 bg-white border border-slate-200 rounded-convent space-y-3.5 text-xs shadow-sm text-slate-800">
            <h4 className="font-bold text-sky-900 text-sm">{t('teacher.meal_tag_form_title')}</h4>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('common.child')} (*)</label>
              <select
                value={selectedStudentForMeal}
                onChange={(e) => setSelectedStudentForMeal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.student_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('teacher.meal_level_label')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIntakeLevel('HALF')}
                  className={`py-2.5 rounded-pill text-xs font-bold border transition-all ${
                    selectedIntakeLevel === 'HALF' ? 'bg-amber-500 text-white border-amber-400 shadow-md' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {t('teacher.intake_half')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIntakeLevel('REFUSED')}
                  className={`py-2.5 rounded-pill text-xs font-bold border transition-all ${
                    selectedIntakeLevel === 'REFUSED' ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {t('teacher.intake_refused')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Reason Tags (*)</label>
              <div className="flex flex-wrap gap-2">
                {['#Biếng_ăn', '#Chỉ_uống_canh', '#Khó_tiêu', '#Mệt_mỏi', '#Dị_ứng_thức_ăn'].map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-3 py-1.5 rounded-pill text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-sky-600 text-white border border-sky-500 shadow-sm'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {translateReasonTag(tag, language)}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow transition-all mt-1"
            >
              {t('teacher.btn_save_meal_exception')}
            </button>
          </form>

          {/* Meal Exceptions Registry List */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">{t('teacher.meal_exception_list')}</h4>
            {mealExceptions.map((ex) => (
              <div key={ex.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-slate-900 text-sm">{ex.student_name}</h5>
                    <span className="font-mono text-[10px] px-2.5 py-0.5 bg-sky-50 text-sky-800 font-bold rounded-pill border border-sky-200">
                      {ex.intake_level === 'HALF' ? t('teacher.intake_half') : ex.intake_level === 'REFUSED' ? t('teacher.intake_refused') : ex.intake_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {ex.reason_tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-pill font-mono text-[10px]">
                        {translateReasonTag(tag, language)}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{new Date(ex.created_at || '').toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: AFTERNOON HANDOVER & CHECKOUT --- */}
      {activeTab === 'CHECKOUT' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="p-4 bg-white border border-slate-200 rounded-convent space-y-3 shadow-sm text-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{t('teacher.checkout_title')}</h3>
                <p className="text-xs text-slate-500">16:30 - 17:00 PM</p>
              </div>
              <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-pill border border-emerald-200">
                17:00 PM
              </span>
            </div>

            <button
              onClick={handleMassCheckout}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-pill shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('teacher.btn_mass_checkout')}</span>
            </button>
          </div>

          {loadingStudents ? (
            <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="w-8 h-8 border-3 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-600 font-semibold">
                Đang tải danh sách học sinh Lớp {activeClass?.name || assignedClassName}...
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              Chưa có học sinh nào trong Lớp {activeClass?.name || assignedClassName}.
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Official Students (100% quota) */}
              <div className="space-y-2.5">
                {officialStudents.map((student) => (
                  <div key={student.id} className="p-3.5 bg-white border border-slate-200 rounded-convent flex items-center justify-between text-xs shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={student.full_name}
                          className="w-10 h-10 rounded-full border-2 border-sky-200 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {student.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{student.full_name}</h4>
                        <span className="text-slate-400 font-mono text-[11px]">{student.student_code}</span>
                        {student.checkoutReason && (
                          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">⚠️ {student.checkoutReason}</div>
                        )}
                      </div>
                    </div>

                    {student.checkedOut ? (
                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-pill font-bold flex items-center gap-1 shrink-0">
                        <Check className="w-3.5 h-3.5" /> {t('teacher.checkout_done')}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setLateStudentId(student.id);
                          setShowLateCheckoutModal(true);
                        }}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-pill font-bold transition-all shadow active:scale-95 flex items-center gap-1 shrink-0"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{t('teacher.checkout_late')}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 2. Non-Regular / Supplemental Students Section */}
              {nonRegularStudents.length > 0 && (
                <div className="pt-4 border-t-2 border-dashed border-amber-200 space-y-3">
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">📋</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
                        <span>Danh sách trả trẻ ngoài quy chế / bổ sung</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-extrabold">
                          {nonRegularStudents.length} bé
                        </span>
                      </h4>
                      <p className="text-[11px] text-amber-700/90 mt-0.5">
                        Xác nhận bàn giao học sinh tiếp nhận ngoài danh sách chính thức.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {nonRegularStudents.map((student) => (
                      <div key={student.id} className="p-3.5 bg-amber-50/30 border border-amber-200/60 rounded-convent flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {student.avatar_url ? (
                            <img
                              src={student.avatar_url}
                              alt={student.full_name}
                              className="w-10 h-10 rounded-full border-2 border-amber-200 object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {student.full_name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{student.full_name}</h4>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 font-mono text-[11px]">{student.student_code}</span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold">
                                Bổ sung
                              </span>
                            </div>
                            {student.checkoutReason && (
                              <div className="text-[11px] text-amber-700 font-semibold mt-0.5">⚠️ {student.checkoutReason}</div>
                            )}
                          </div>
                        </div>

                        {student.checkedOut ? (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-pill font-bold flex items-center gap-1 shrink-0">
                            <Check className="w-3.5 h-3.5" /> {t('teacher.checkout_done')}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setLateStudentId(student.id);
                              setShowLateCheckoutModal(true);
                            }}
                            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-pill font-bold transition-all shadow active:scale-95 flex items-center gap-1 shrink-0"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{t('teacher.checkout_late')}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Late Checkout / Handover Verification Modal */}
          {showLateCheckoutModal && (() => {
            const currentLateStudent = students.find((s) => s.id === lateStudentId);
            return (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-slate-200 rounded-convent max-w-md w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      {t('teacher.modal_late_checkout')}
                    </h3>
                    <button onClick={() => setShowLateCheckoutModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
                  </div>

                  {currentLateStudent && (
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3">
                      {currentLateStudent.avatar_url && (
                        <img
                          src={currentLateStudent.avatar_url}
                          alt={currentLateStudent.full_name}
                          className="w-12 h-12 rounded-full border-2 border-sky-400 object-cover shrink-0"
                        />
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{currentLateStudent.full_name}</h4>
                        <span className="text-xs text-sky-700 font-mono font-semibold">{currentLateStudent.student_code}</span>
                      </div>
                    </div>
                  )}

                  {/* VISUAL FACE VERIFICATION SECTION */}
                  <div className="space-y-2">
                    <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>{t('teacher.face_verification_title')}</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      {currentLateStudent?.parents?.map((parent: ParentContact, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                          <img src={parent.avatar_url} alt={parent.name} className="w-9 h-9 rounded-full border border-slate-300 object-cover shrink-0" />
                          <div className="min-w-0 text-[11px]">
                            <span className="font-bold block text-slate-800 truncate">{parent.name}</span>
                            <span className="text-slate-500 block text-[10px]">{parent.relationship}</span>
                          </div>
                        </div>
                      ))}

                      {/* HARD GATE SAFETY FILTER: ONLY DISPLAY APPROVED PICKUPS */}
                      {currentLateStudent?.authorized_pickups
                        ?.filter((pickup: AuthorizedPickup) => pickup.approval_status === 'APPROVED')
                        .map((pickup: AuthorizedPickup) => (
                          <div key={pickup.id} className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 col-span-2">
                            <img src={pickup.avatar_url} alt={pickup.name} className="w-9 h-9 rounded-full border-2 border-emerald-500 object-cover shrink-0" />
                            <div className="min-w-0 text-[11px]">
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[9px] rounded-pill border border-emerald-300 inline-block">
                                {t('teacher.authorized_pickup')} {pickup.relationship} {t('teacher.approved_tag')}
                              </span>
                              <span className="font-bold block text-slate-800 truncate">{pickup.name}</span>
                              <span className="text-slate-500 text-[10px] font-mono">{t('common.phone')}: {pickup.phone}</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Pending Safety Notice */}
                    {currentLateStudent?.authorized_pickups?.some((p) => p.approval_status !== 'APPROVED') && (
                      <p className="text-[10px] text-amber-700 font-semibold italic bg-amber-50 p-2 rounded-lg border border-amber-200">
                        {t('teacher.pending_pickup_notice')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">{t('teacher.late_pickup_reason_label')}</label>
                      <select
                        value={lateReason}
                        onChange={(e) => setLateReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                      >
                        <option value="Phụ huynh bận công việc đột xuất">1. {language === 'en' ? 'Parent busy with unexpected work' : 'Phụ huynh bận công việc đột xuất'}</option>
                        <option value="Kẹt xe giờ cao điểm">2. {language === 'en' ? 'Heavy rush-hour traffic' : 'Kẹt xe giờ cao điểm'}</option>
                        <option value="Đón bé muộn do thời tiết mưa to">3. {language === 'en' ? 'Late pickup due to heavy rain' : 'Đón bé muộn do thời tiết mưa to'}</option>
                        <option value="Người thân đón thay (Đã xác minh khuôn mặt)">4. {language === 'en' ? 'Authorized relative pickup (Face verified)' : 'Người thân đón thay (Đã xác minh khuôn mặt)'}</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSaveLateCheckout}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-pill shadow transition-all mt-2 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t('teacher.btn_confirm_face_handover')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

