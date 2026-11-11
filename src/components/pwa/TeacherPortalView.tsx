'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  HeartPulse,
  Layers,
  Lock,
  LogOut,
  Phone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Utensils,
} from 'lucide-react';
import {
  AbsenceRequest,
  AuthorizedPickup,
  MealException,
  MedicationRequest,
  ParentContact,
  Student,
} from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { hasRealAllergy, translateAllergy } from '@/lib/utils/studentClassification';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useActiveRole } from '@/components/auth/ActiveRoleContext';
import { RoleSwitcher } from '@/components/auth/RoleSwitcher';
import { AnnouncementsStrip } from '@/components/pwa/AnnouncementsStrip';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';
import {
  readVerifiedTeacherClasses,
  writeVerifiedTeacherClasses,
} from '@/lib/utils/teacherClassCache';

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

const jsonFetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.error || `Request failed (${res.status})`);
  }
  return json;
};

function getActiveClassStorageKey(email?: string | null): string {
  const normalized = (email || '').trim().toLowerCase();
  return normalized
    ? `suongmai_teacher_active_class_id:${normalized}`
    : 'suongmai_teacher_active_class_id';
}

export function TeacherPortalView() {
  const { t, language } = useLanguage();
  const {
    activeRole,
    profileId,
    isLoading: isLoadingSession,
    isSwitching,
    email,
    fullName,
    avatarUrl,
    linkedStudents,
    refreshSession,
    logout,
  } = useActiveRole();

  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'MEDICATION' | 'MEALS' | 'CHECKOUT'>('ATTENDANCE');
  const [activeClass, setActiveClass] = useState<AssignedClass | null>(null);
  const [refreshingClass, setRefreshingClass] = useState<boolean>(false);
  const [isFinalizingKitchen, setIsFinalizingKitchen] = useState<boolean>(false);

  // Local optimistic student list mirrored from SWR per class
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [mealExceptions, setMealExceptions] = useState<MealException[]>([]);

  // Medication Modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMedStudentId, setNewMedStudentId] = useState('');
  const [newMedSlot, setNewMedSlot] = useState<'SLOT_1130' | 'SLOT_1430'>('SLOT_1130');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedNotes, setNewMedNotes] = useState('');

  // Meal Exceptions Form
  const [selectedStudentForMeal, setSelectedStudentForMeal] = useState('');
  const [selectedIntakeLevel, setSelectedIntakeLevel] = useState<'HALF' | 'REFUSED'>('HALF');
  const [selectedTags, setSelectedTags] = useState<string[]>(['#Biếng_ăn']);

  // Checkout Modals
  const [showLateCheckoutModal, setShowLateCheckoutModal] = useState(false);
  const [lateStudentId, setLateStudentId] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState('Phụ huynh bận công việc đột xuất');
  const [viewPickupStudentId, setViewPickupStudentId] = useState<string | null>(null);

  const isTeacherReady = Boolean(email && activeRole === 'TEACHER' && !isSwitching);

  // Per-email verified class cache prevents blank/unassigned flash during role switch,
  // while SWR ALWAYS revalidates in background on mount to pick up live BGH changes.
  const cachedClasses = useMemo(() => readVerifiedTeacherClasses(email), [email]);

  // 1. Assigned classes (role-prefixed SWR key)
  const {
    data: classesPayload,
    error: classesError,
    isLoading: loadingClasses,
    isValidating: validatingClasses,
    mutate: mutateClasses,
  } = useSWR(
    isTeacherReady ? ['role', 'TEACHER', 'classes', email] : null,
    () => jsonFetcher(`/api/teacher/classes?email=${encodeURIComponent(email)}`),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      refreshInterval: 60000,
    }
  );

  const hasVerifiedClassPayload = Boolean(
    classesPayload?.success === true && Array.isArray(classesPayload.classes)
  );

  const serverClasses: AssignedClass[] = useMemo(() => {
    if (!hasVerifiedClassPayload) return [];
    return classesPayload.classes.map((c: any) => ({
      id: c.class_id || c.id,
      name: c.class_name || c.name,
    }));
  }, [classesPayload, hasVerifiedClassPayload]);

  // Synchronize verified cache strictly when authoritative server response succeeds
  useEffect(() => {
    if (!email || !hasVerifiedClassPayload) return;
    writeVerifiedTeacherClasses(email, classesPayload?.email, serverClasses);
    if (serverClasses.length === 0 && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(getActiveClassStorageKey(email));
    }
  }, [email, classesPayload, hasVerifiedClassPayload, serverClasses]);

  const assignedClasses: AssignedClass[] = useMemo(() => {
    if (hasVerifiedClassPayload) {
      return serverClasses;
    }
    return cachedClasses;
  }, [hasVerifiedClassPayload, serverClasses, cachedClasses]);

  // Preselect class from per-email sessionStorage or first assigned class
  useEffect(() => {
    if (assignedClasses.length === 0) {
      setActiveClass(null);
      return;
    }
    setActiveClass((prev) => {
      if (prev && assignedClasses.some((c) => c.id === prev.id)) return prev;
      const savedClassId =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(getActiveClassStorageKey(email))
          : null;
      return assignedClasses.find((c) => c.id === savedClassId) || assignedClasses[0];
    });
  }, [assignedClasses, email]);

  const handleSelectClass = (c: AssignedClass) => {
    if (activeClass?.id === c.id) return;
    // Clear previous class student arrays immediately so no other class data flickers while loading
    setStudents([]);
    setMedications([]);
    setMealExceptions([]);
    setActiveClass(c);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(getActiveClassStorageKey(email), c.id);
    }
  };

  // 2. Class roster, attendance, medications, meal exceptions (role-prefixed SWR key)
  const {
    data: attendancePayload,
    isLoading: loadingStudents,
    mutate: mutateAttendance,
  } = useSWR(
    isTeacherReady && activeClass ? ['role', 'TEACHER', 'attendance', activeClass.id] : null,
    () =>
      jsonFetcher(
        `/api/teacher/attendance?class_id=${encodeURIComponent(
          activeClass!.id
        )}&class_name=${encodeURIComponent(activeClass!.name)}`
      ),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  );

  useEffect(() => {
    if (!activeClass) {
      setStudents([]);
      setMedications([]);
      setMealExceptions([]);
      return;
    }
    if (!attendancePayload) return;
    const nextStudents: TeacherStudent[] = Array.isArray(attendancePayload.students)
      ? attendancePayload.students
      : [];
    const nextMeds: MedicationRequest[] = Array.isArray(attendancePayload.medications)
      ? attendancePayload.medications
      : [];
    const nextMeals: MealException[] = Array.isArray(attendancePayload.meal_exceptions)
      ? attendancePayload.meal_exceptions
      : [];

    setStudents(nextStudents);
    setMedications(nextMeds);
    setMealExceptions(nextMeals);

    if (nextStudents.length > 0) {
      setNewMedStudentId((prev) =>
        nextStudents.some((s) => s.id === prev) ? prev : nextStudents[0].id
      );
      setSelectedStudentForMeal((prev) =>
        nextStudents.some((s) => s.id === prev) ? prev : nextStudents[0].id
      );
    }
  }, [activeClass, attendancePayload]);

  // 3. Kitchen report status
  const { data: kitchenReportData, mutate: mutateKitchenReport } = useSWR(
    isTeacherReady && activeClass ? ['role', 'TEACHER', 'kitchen-report', activeClass.id] : null,
    () =>
      jsonFetcher(
        `/api/teacher/attendance/kitchen-report?class_id=${encodeURIComponent(activeClass!.id)}`
      ),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  );

  const isKitchenLocked =
    kitchenReportData?.uiState === 'PAST_CUTOFF_LOCKED' ||
    kitchenReportData?.uiState === 'MAX_UPDATES_REACHED' ||
    kitchenReportData?.uiState === 'WEEKEND';

  // 4. Class absence requests via Postgres-backed /api/absences
  const { data: absencesPayload, mutate: mutateAbsences } = useSWR(
    isTeacherReady && activeClass ? ['role', 'TEACHER', 'absences', activeClass.id] : null,
    () => jsonFetcher(`/api/absences?class_id=${encodeURIComponent(activeClass!.id)}`),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  );

  const absences: AbsenceRequest[] = Array.isArray(absencesPayload?.absences)
    ? absencesPayload.absences
    : [];

  const activeClassIdRef = useRef<string | null>(activeClass?.id || null);
  useEffect(() => {
    activeClassIdRef.current = activeClass?.id || null;
  }, [activeClass]);

  const classStudentIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    classStudentIdsRef.current = new Set(students.map((s) => s.id));
  }, [students]);

  const matchesActiveClassStudent = useCallback((payload: any) => {
    if (!activeClassIdRef.current) return false;
    const sid = payload?.new?.student_id ?? payload?.old?.student_id ?? payload?.new?.id;
    if (!sid || classStudentIdsRef.current.size === 0) return true;
    return classStudentIdsRef.current.has(sid);
  }, []);

  // Supabase Realtime sync scoped cleanly to TEACHER role + assigned class
  useRoleRealtimeSync({
    channelName: email ? `teacher-portal-${profileId || email}` : null,
    enabled: isTeacherReady,
    debounceMs: 250,
    handlers: [
      {
        table: 'teacher_class_assignments',
        onEvent: () => {
          void mutateClasses();
          void refreshSession();
        },
      },
      {
        table: 'user_roles',
        onEvent: () => {
          void refreshSession();
          void mutateClasses();
        },
      },
      {
        table: 'attendance_records',
        match: matchesActiveClassStudent,
        onEvent: () => {
          if (activeClassIdRef.current) void mutateAttendance();
        },
      },
      {
        table: 'medication_requests',
        match: matchesActiveClassStudent,
        onEvent: () => {
          if (activeClassIdRef.current) void mutateAttendance();
        },
      },
      {
        table: 'meal_exceptions',
        match: matchesActiveClassStudent,
        onEvent: () => {
          if (activeClassIdRef.current) void mutateAttendance();
        },
      },
      {
        table: 'students',
        onEvent: () => {
          if (activeClassIdRef.current) void mutateAttendance();
        },
      },
      {
        table: 'absence_requests',
        match: matchesActiveClassStudent,
        onEvent: () => {
          if (activeClassIdRef.current) {
            void mutateAbsences();
            void mutateAttendance();
          }
        },
      },
      {
        table: 'kitchen_daily_reports',
        onEvent: () => {
          if (activeClassIdRef.current) void mutateKitchenReport();
        },
      },
      {
        table: 'kitchen_meal_orders',
        onEvent: () => {
          if (activeClassIdRef.current) void mutateKitchenReport();
        },
      },
    ],
  });

  const ownChildIds = useMemo(
    () => new Set(linkedStudents.map((c) => c.student_id || c.id)),
    [linkedStudents]
  );

  const officialStudents = useMemo(
    () => students.filter((s) => s.is_official !== false && !s.is_non_regular),
    [students]
  );

  const handleRefreshClassAssignment = async () => {
    setRefreshingClass(true);
    try {
      await Promise.all([refreshSession(), mutateClasses()]);
    } finally {
      setTimeout(() => setRefreshingClass(false), 400);
    }
  };

  // --- ATTENDANCE & KITCHEN ---
  const postTeacherAction = async (
    payload: Record<string, any>
  ): Promise<{ ok: boolean; json: any; error?: string }> => {
    try {
      const res = await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        await mutateAttendance();
        return { ok: false, json, error: json.message || json.error || `HTTP ${res.status}` };
      }
      return { ok: true, json };
    } catch (e: any) {
      await mutateAttendance();
      return { ok: false, json: {}, error: e?.message || 'Lỗi kết nối máy chủ' };
    }
  };

  const syncAttendanceToDb = async (records: Array<{ student_id: string; status: string }>) => {
    const result = await postTeacherAction({
      action: 'UPSERT_ATTENDANCE',
      records,
    });
    if (!result.ok) {
      console.error('Failed to sync attendance to DB:', result.error);
    }
    return result;
  };

  const handleSelectAllPresent = () => {
    if (isKitchenLocked) return;
    const updated = students.map((s) => {
      const hasAbsence = absences.some(
        (a) =>
          a.student_id === s.id &&
          (a.status === 'SUBMITTED_VALID' || a.status === 'APPROVED')
      );
      return {
        ...s,
        attendance: (hasAbsence ? 'ABSENT' : 'PRESENT') as 'PRESENT' | 'PRESENT_LATE' | 'ABSENT',
      };
    });
    setStudents(updated);
    mutateAttendance(
      (prev: any) => (prev ? { ...prev, students: updated } : prev),
      { revalidate: false }
    );
    void syncAttendanceToDb(
      updated.map((s) => ({
        student_id: s.id,
        status: s.attendance === 'ABSENT' ? 'ABSENT_EXCUSED' : s.attendance,
      }))
    );
  };

  const handleToggleAttendance = (
    id: string,
    status: 'PRESENT' | 'PRESENT_LATE' | 'ABSENT'
  ) => {
    if (isKitchenLocked) return;
    const updated = students.map((s) => (s.id === id ? { ...s, attendance: status } : s));
    setStudents(updated);
    mutateAttendance(
      (prev: any) => (prev ? { ...prev, students: updated } : prev),
      { revalidate: false }
    );
    void syncAttendanceToDb([
      {
        student_id: id,
        status: status === 'ABSENT' ? 'ABSENT_UNEXCUSED' : status,
      },
    ]);
  };

  // Teacher in TEACHER mode approves or rejects ANY absence in assigned class (including own child!)
  const handleUpdateAbsenceStatus = async (
    absenceId: string,
    targetStatus: 'APPROVED' | 'REJECTED'
  ) => {
    const updatedList = absences.map((a) =>
      a.id === absenceId
        ? {
            ...a,
            status: targetStatus,
            acknowledged_by_teacher: true,
          }
        : a
    );
    mutateAbsences(
      (prev: any) => (prev ? { ...prev, absences: updatedList } : prev),
      { revalidate: false }
    );

    try {
      const res = await fetch('/api/absences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: absenceId,
          status: targetStatus,
          acknowledged_by_teacher: true,
        }),
      });
      if (!res.ok) {
        await mutateAbsences();
      } else {
        mutateAbsences();
      }
    } catch (err) {
      console.error('Failed to update absence status:', err);
      mutateAbsences();
    }
  };

  const handleDispatchToKitchen = async () => {
    if (!activeClass || isKitchenLocked || isFinalizingKitchen) return;

    const officialPresentCount = officialStudents.filter(
      (s) => s.attendance === 'PRESENT' || s.attendance === 'PRESENT_LATE'
    ).length;

    const isUpdate = kitchenReportData?.report && kitchenReportData.report.update_count === 0;
    const confirmMessage = isUpdate
      ? `Xác nhận cập nhật lại sĩ số báo bếp Lớp ${activeClass.name}: ${officialPresentCount}/${officialStudents.length} suất ăn?\n(Lưu ý: Đây là lần cập nhật phát sinh cuối cùng trong ngày)`
      : `Xác nhận chốt sĩ số báo bếp Lớp ${activeClass.name}: ${officialPresentCount}/${officialStudents.length} suất ăn?`;

    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
      return;
    }

    setIsFinalizingKitchen(true);
    try {
      await syncAttendanceToDb(
        students.map((s) => ({
          student_id: s.id,
          status: s.attendance === 'ABSENT' ? 'ABSENT_UNEXCUSED' : s.attendance,
        }))
      );

      const res = await fetch('/api/teacher/attendance/kitchen-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: activeClass.id,
          present_count: officialPresentCount,
          submitted_by: email || fullName || 'Giáo viên',
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(`⚠️ ${json.error || 'Không thể chốt báo bếp'}`);
        await mutateKitchenReport();
        return;
      }

      await mutateKitchenReport();
      alert(
        `⚡ ${json.message || 'Thành công'}\n\n• Lớp: ${activeClass.name}\n• Sĩ số ăn bán trú: ${officialPresentCount}/${officialStudents.length} bé`
      );
    } catch (e: any) {
      alert(`⚠️ Lỗi khi chốt báo bếp: ${e.message || e}`);
    } finally {
      setIsFinalizingKitchen(false);
    }
  };

  // --- MEDICATION & MEALS & CHECKOUT ---
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
    const nextMeds = [tempMed, ...medications];
    setMedications(nextMeds);
    setShowAddMedModal(false);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedNotes('');

    const result = await postTeacherAction({
      action: 'ADD_MEDICATION',
      student_id: tempMed.student_id,
      time_slot: tempMed.time_slot,
      medication_name: tempMed.medication_name,
      dosage: tempMed.dosage,
      instructions: tempMed.instructions,
    });
    if (result.ok) {
      if (result.json?.medication) {
        setMedications((prev) => prev.map((m) => (m.id === tempMed.id ? result.json.medication : m)));
      }
      mutateAttendance();
    } else if (result.error) {
      alert(`⚠️ Không thể lưu phiếu dặn thuốc: ${result.error}`);
    }
  };

  const handleAdministerMed = async (medId: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, status: 'ADMINISTERED' } : m))
    );
    const result = await postTeacherAction({
      action: 'ADMINISTER_MEDICATION',
      id: medId,
    });
    if (result.ok) {
      mutateAttendance();
    } else if (result.error) {
      alert(`⚠️ Không thể cập nhật trạng thái uống thuốc: ${result.error}`);
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
    const result = await postTeacherAction({
      action: 'ADD_MEAL_EXCEPTION',
      student_id: selectedStudentForMeal,
      meal_type: 'LUNCH',
      intake_level: selectedIntakeLevel,
      reason_tags: selectedTags,
    });
    if (result.ok) {
      mutateAttendance();
      alert(`${t('teacher.btn_save_meal_exception')}: ${student?.full_name}`);
    } else if (result.error) {
      alert(`⚠️ Không thể lưu ghi chú bữa ăn: ${result.error}`);
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleMassCheckout = async () => {
    const updated = students.map((s) => ({ ...s, checkedOut: true }));
    setStudents(updated);
    const result = await postTeacherAction({
      action: 'CHECKOUT',
      student_ids: students.map((s) => s.id),
    });
    if (result.ok) {
      mutateAttendance();
      alert(`✅ ${t('teacher.checkout_done')}`);
    } else if (result.error) {
      alert(`⚠️ Không thể cập nhật trả trẻ: ${result.error}`);
    }
  };

  const handleQuickCheckoutStudent = async (
    studentId: string,
    reason = 'Người thân đón (Đã đối soát khuôn mặt)'
  ) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, checkedOut: true, checkoutReason: reason } : s))
    );
    const result = await postTeacherAction({
      action: 'CHECKOUT',
      student_ids: [studentId],
      checkout_reason: reason,
    });
    if (result.ok) {
      mutateAttendance();
    } else if (result.error) {
      alert(`⚠️ Không thể xác nhận trả trẻ: ${result.error}`);
    }
  };

  const handleSaveLateCheckout = async () => {
    if (!lateStudentId) return;
    const targetId = lateStudentId;
    const targetReason = lateReason;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === targetId ? { ...s, checkedOut: true, checkoutReason: targetReason } : s
      )
    );
    setShowLateCheckoutModal(false);
    setLateStudentId(null);
    const result = await postTeacherAction({
      action: 'CHECKOUT',
      student_ids: [targetId],
      checkout_reason: targetReason,
    });
    if (result.ok) {
      mutateAttendance();
    } else if (result.error) {
      alert(`⚠️ Không thể lưu ghi nhận đón muộn: ${result.error}`);
    }
  };

  // Strict gates so transient loading/switching/API errors NEVER flash the "Chưa phân công lớp" screen
  const isWaitingInitialClasses =
    !hasVerifiedClassPayload &&
    !classesError &&
    assignedClasses.length === 0 &&
    (loadingClasses || validatingClasses || isLoadingSession || isSwitching || !isTeacherReady);

  const hasFatalClassLoadError =
    !hasVerifiedClassPayload && Boolean(classesError) && assignedClasses.length === 0;

  const isAuthoritativeUnassigned =
    !isLoadingSession &&
    !isSwitching &&
    !loadingClasses &&
    !classesError &&
    hasVerifiedClassPayload &&
    serverClasses.length === 0;

  const renderCalmHeaderBar = () => (
    <header className="px-3 py-2.5 bg-primary-700 text-white flex items-center justify-between gap-2 shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName || 'Giáo viên'}
            className="w-8 h-8 rounded-full object-cover border border-white/40 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
            SM
          </div>
        )}
        <span className="font-bold text-sm truncate">{t('teacher.app_title')}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <RoleSwitcher currentPortal="TEACHER" />
        <LanguageSwitcher />
      </div>
    </header>
  );

  // Loading state when class list has never been verified yet and cache is empty
  if (isWaitingInitialClasses) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans">
        {renderCalmHeaderBar()}
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-lg space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl text-primary-700">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Đang tải danh sách lớp phân công...
            </h2>
            <p className="text-xs text-slate-500">
              Hệ thống đang đồng bộ dữ liệu phân công mới nhất từ nhà trường.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // API / Auth / RLS error state (distinct from genuinely having 0 assigned classes!)
  if (hasFatalClassLoadError) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans">
        {renderCalmHeaderBar()}
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl mb-4 text-rose-600">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Chưa thể tải danh sách lớp giảng dạy
            </h2>
            <p className="text-slate-600 text-xs leading-relaxed mb-5">
              Kết nối máy chủ hoặc phiên phân quyền vừa được làm mới. Vui lòng thử tải lại để đồng bộ lớp của bạn.
            </p>
            <button
              onClick={handleRefreshClassAssignment}
              disabled={refreshingClass}
              className="w-full py-3 bg-primary-700 hover:bg-primary-800 text-white font-bold text-sm rounded-full transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingClass ? 'animate-spin' : ''}`} />
              <span>Thử tải lại phân công lớp</span>
            </button>
            <button
              onClick={logout}
              className="w-full mt-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unassigned Teacher Empty State (strictly rendered ONLY when HTTP 200 success: true returned 0 classes)
  if (isAuthoritativeUnassigned) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans">
        {renderCalmHeaderBar()}

        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl mb-4 text-amber-600">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Tài khoản Giáo viên chưa phân công lớp
            </h2>
            <p className="text-slate-600 text-xs leading-relaxed mb-5">
              Vui lòng liên hệ Ban Giám Hiệu để được xếp lớp giảng dạy.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium mb-5 flex items-center justify-center gap-2">
              <Phone className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Hotline Ban Giám Hiệu: <strong>028.3896.1234</strong></span>
            </div>
            <button
              onClick={handleRefreshClassAssignment}
              disabled={refreshingClass}
              className="w-full py-3 bg-primary-700 hover:bg-primary-800 text-white font-bold text-sm rounded-full transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingClass ? 'animate-spin' : ''}`} />
              <span>Kiểm tra lại phân công</span>
            </button>
            <button
              onClick={logout}
              className="w-full mt-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-20">
      {/* Mobile Top Header — Calm UI Hướng A: Warm Brand Red + Frosted Glass Pill Toggle, Zero /admin links, Zero animate-pulse */}
      <header className="px-3 py-2.5 bg-primary-700 text-white flex items-center justify-between gap-2 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName || 'Giáo viên'}
              className="w-8 h-8 rounded-full object-cover border border-white/40 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
              SM
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-extrabold text-white text-sm leading-tight truncate">
              {t('teacher.app_title')}
            </h1>

            {assignedClasses.length > 1 ? (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="relative inline-block">
                  <select
                    value={activeClass?.id || ''}
                    onChange={(e) => {
                      const sel = assignedClasses.find((c) => c.id === e.target.value);
                      if (sel) handleSelectClass(sel);
                    }}
                    className="bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] py-0.5 pl-2 pr-5 rounded-full border border-white/25 appearance-none cursor-pointer focus:outline-none max-w-[115px] truncate"
                  >
                    {assignedClasses.map((c) => (
                      <option key={c.id} value={c.id} className="text-slate-900 font-bold bg-white">
                        Lớp {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-white absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-rose-100 font-medium truncate">
                Lớp {activeClass?.name || '...'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <RoleSwitcher currentPortal="TEACHER" />
          <LanguageSwitcher />
          <button
            onClick={logout}
            className="p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer shrink-0"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      {/* Non-blocking background sync/retry banner when cached classes are shown during transient error */}
      {classesError && cachedClasses.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-amber-800">
          <span className="truncate font-medium">
            Đang hiển thị phân công đã lưu • Chưa đồng bộ được máy chủ
          </span>
          <button
            type="button"
            onClick={handleRefreshClassAssignment}
            disabled={refreshingClass}
            className="font-bold text-primary-700 hover:underline shrink-0 cursor-pointer"
          >
            Đồng bộ lại
          </button>
        </div>
      )}

      {/* Multi-Class Quick Switch Bar (Calm UI) */}
      {assignedClasses.length > 1 && (
        <div className="bg-primary-800/95 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto border-b border-primary-600/40 sticky top-[52px] z-10 shadow-2xs">
          <span className="text-[10px] text-rose-200 whitespace-nowrap font-semibold flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3 text-rose-200" /> Chọn lớp:
          </span>
          <div className="flex items-center gap-1">
            {assignedClasses.map((c) => {
              const isActive = activeClass?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectClass(c)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'bg-white/10 text-rose-100 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#86EFAC]" />}
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
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'ATTENDANCE'
              ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold'
              : 'border-transparent text-slate-400'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('teacher.tab_attendance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('MEDICATION')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 relative cursor-pointer ${
            activeTab === 'MEDICATION'
              ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold'
              : 'border-transparent text-slate-400'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>{t('teacher.tab_medication')}</span>
          {medications.filter((m) => m.status === 'PENDING').length > 0 && (
            <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-[#86EFAC] ring-1 ring-slate-300" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('MEALS')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'MEALS'
              ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold'
              : 'border-transparent text-slate-400'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>{t('teacher.tab_meals')}</span>
        </button>

        <button
          onClick={() => setActiveTab('CHECKOUT')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 cursor-pointer ${
            activeTab === 'CHECKOUT'
              ? 'border-primary-700 text-primary-700 bg-rose-50/60 font-extrabold'
              : 'border-transparent text-slate-400'
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span>{t('teacher.tab_checkout')}</span>
        </button>
      </div>

      {/* Role-scoped Announcements Strip */}
      <div className="px-4 pt-3">
        <AnnouncementsStrip portalRole="TEACHER" />
      </div>

      {/* --- TAB 1: MORNING ATTENDANCE --- */}
      {activeTab === 'ATTENDANCE' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto pb-28">
          {kitchenReportData?.isWeekend && (
            <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-2xl text-xs text-slate-700 flex items-center gap-2.5 shadow-2xs">
              <span className="text-xl shrink-0">📅</span>
              <div>
                <p className="font-bold text-slate-800">Thông báo cuối tuần:</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Hôm nay là cuối tuần - Trường nghỉ học, hệ thống đóng điểm danh &amp; báo bếp
                </p>
              </div>
            </div>
          )}

          {/* Quick Action Bar */}
          <div className="flex items-center justify-between bg-white border border-rose-100 p-3 rounded-2xl shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-bold">{t('teacher.class_headcount')}</span>
              <span className="px-2 py-0.5 bg-rose-50 text-primary-800 border border-rose-200 rounded-full font-extrabold text-xs">
                {officialStudents.filter((s) => s.attendance === 'PRESENT' || s.attendance === 'PRESENT_LATE').length} / {officialStudents.length}
              </span>
            </div>

            <button
              onClick={handleSelectAllPresent}
              disabled={isKitchenLocked || Boolean(kitchenReportData?.isWeekend)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-primary-600 text-primary-700 hover:bg-rose-50 disabled:opacity-50 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary-700" />
              <span>{t('teacher.btn_select_all')}</span>
            </button>
          </div>

          {/* Class Absence Notices from Postgres (/api/absences) — NEVER disabled for Teacher's own child */}
          {absences.map((abs) => {
            const isApproved = abs.status === 'APPROVED';
            const isRejected = abs.status === 'REJECTED';
            const isOwnChild = ownChildIds.has(abs.student_id);

            return (
              <div
                key={abs.id}
                className="p-3.5 bg-white border border-slate-200 rounded-2xl text-xs space-y-2 text-slate-800 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-primary-700 shrink-0" />
                    <span>{t('teacher.absence_notice')}</span>
                    {isOwnChild && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                        Con của bạn
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      abs.is_fee_credited
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {abs.status === 'SUBMITTED_LATE' ? 'Báo muộn (≥08:30)' : 'Hợp lệ (<08:30)'}
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed">
                  {t('common.child')}:{' '}
                  <strong className="text-slate-900 font-bold text-sm">{abs.student_name}</strong> •{' '}
                  <span className="font-mono text-[11px] text-slate-500">
                    {abs.start_date}
                    {abs.end_date && abs.end_date !== abs.start_date ? ` → ${abs.end_date}` : ''}
                  </span>{' '}
                  • <em>&quot;{abs.reason}&quot;</em>
                </p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {isApproved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Đã duyệt
                    </span>
                  ) : isRejected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      Đã từ chối
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateAbsenceStatus(abs.id, 'REJECTED')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-full text-xs transition-colors cursor-pointer"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateAbsenceStatus(abs.id, 'APPROVED')}
                        className="px-3.5 py-1.5 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-full text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Duyệt đơn</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Student Roll Call List */}
          {loadingStudents ? (
            <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-rose-100 p-6 shadow-2xs">
              <div className="w-8 h-8 border-3 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-600 font-semibold">
                Đang tải danh sách học sinh Lớp {activeClass?.name || '...'}
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              Chưa có học sinh nào trong Lớp {activeClass?.name || '...'}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {students.map((student) => {
                const hasMedToday = medications.some((m) => m.student_id === student.id);
                const hasAllergy = hasRealAllergy(student.allergies);
                const isAttendanceDisabled = isKitchenLocked || Boolean(kitchenReportData?.isWeekend);

                return (
                  <div
                    key={student.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2.5 shadow-sm"
                  >
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
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {student.full_name}
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">
                            {student.student_code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                        {hasMedToday && (
                          <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold flex items-center gap-1">
                            💊 {language === 'en' ? 'Medication' : 'Có dặn thuốc'}
                          </span>
                        )}
                        {hasAllergy && (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-bold">
                            ⚠️ {translateAllergy(student.allergies, language)}
                          </span>
                        )}
                      </div>
                    </div>

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
                            ? 'bg-slate-700 text-white shadow-sm font-bold'
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

          {/* Fixed Bottom Dispatch Button */}
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white/95 border-t border-rose-100 backdrop-blur-md z-30">
            {(() => {
              const uiState =
                kitchenReportData?.uiState ||
                (isKitchenLocked ? 'PAST_CUTOFF_LOCKED' : 'NOT_FINALIZED');
              const report = kitchenReportData?.report;

              const formatSubmittedTime = (isoString?: string) => {
                if (!isoString) return '';
                try {
                  return new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }).format(new Date(isoString));
                } catch {
                  return '';
                }
              };

              const submittedTime = formatSubmittedTime(
                report?.last_submitted_at || report?.first_submitted_at
              );

              if (uiState === 'WEEKEND') {
                return (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-slate-100 text-slate-400 border border-slate-200 shadow-2xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <span>📅 Cuối tuần - Trường nghỉ học</span>
                  </button>
                );
              }

              if (uiState === 'PAST_CUTOFF_LOCKED') {
                return (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-slate-100 text-slate-400 border border-slate-200 shadow-2xs flex items-center justify-center gap-2 cursor-not-allowed text-center"
                  >
                    <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      🔒 Đã khóa chốt bếp (Sau 08:00) - Liên hệ BGH nếu cần điều chỉnh
                    </span>
                  </button>
                );
              }

              if (uiState === 'MAX_UPDATES_REACHED') {
                return (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-full font-bold text-sm bg-slate-100 text-slate-500 border border-slate-300 shadow-2xs flex items-center justify-center gap-2 cursor-not-allowed text-center"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      ✓ Đã cập nhật lúc {submittedTime || 'sáng nay'} (
                      {report?.final_count ?? officialStudents.length} suất) - Đã hết lượt sửa
                    </span>
                  </button>
                );
              }

              if (uiState === 'FINALIZED_CAN_UPDATE') {
                return (
                  <button
                    onClick={handleDispatchToKitchen}
                    disabled={isFinalizingKitchen}
                    className="w-full py-3.5 px-4 rounded-full font-extrabold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    <span className="truncate">
                      {isFinalizingKitchen
                        ? 'Đang cập nhật...'
                        : `✓ Đã chốt lúc ${submittedTime || 'sáng nay'} (${
                            report?.final_count ?? officialStudents.length
                          } suất) - Bấm để cập nhật lại (còn 1 lần)`}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  onClick={handleDispatchToKitchen}
                  disabled={isFinalizingKitchen}
                  className="w-full py-3.5 px-4 rounded-full font-extrabold text-sm bg-primary-700 hover:bg-primary-800 text-white shadow-xl shadow-primary-700/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-white shrink-0" />
                  <span>
                    {isFinalizingKitchen ? 'Đang chốt báo bếp...' : t('teacher.btn_dispatch_kitchen')}
                  </span>
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
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-pill shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('teacher.btn_add_med')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {medications.map((med) => (
              <div
                key={med.id}
                className="p-4 bg-white border border-slate-200 rounded-convent space-y-3 shadow-sm text-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 bg-sky-50 text-sky-800 rounded-pill border border-sky-200">
                      {med.time_slot === 'SLOT_1130' ? t('teacher.slot_1130') : t('teacher.slot_1430')}
                    </span>
                    <h4 className="font-bold text-slate-900 text-base mt-1">{med.student_name}</h4>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-pill font-bold border ${
                      med.status === 'ADMINISTERED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {med.status === 'ADMINISTERED'
                      ? t('teacher.med_status_done')
                      : t('teacher.med_status_pending')}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div>
                    <strong className="text-slate-700">{t('teacher.med_name')}</strong>{' '}
                    <span className="text-sky-700 font-bold">{med.medication_name}</span>
                  </div>
                  <div>
                    <strong className="text-slate-700">{t('teacher.med_dosage')}</strong> {med.dosage}
                  </div>
                  {med.instructions && (
                    <div className="text-slate-500">
                      {t('teacher.med_instructions')} {med.instructions}
                    </div>
                  )}
                </div>

                {med.status !== 'ADMINISTERED' ? (
                  <button
                    onClick={() => handleAdministerMed(med.id)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-pill shadow-md transition-all cursor-pointer"
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

          {showAddMedModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-convent max-w-sm w-full p-5 space-y-3.5 text-xs shadow-2xl text-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="font-bold text-sky-900 text-sm">{t('teacher.med_title')}</h3>
                  <button
                    onClick={() => setShowAddMedModal(false)}
                    className="text-slate-400 hover:text-slate-800 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddMedication} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      {t('common.child')} (*)
                    </label>
                    <select
                      value={newMedStudentId}
                      onChange={(e) => setNewMedStudentId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.student_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      {t('teacher.med_time_slot')}
                    </label>
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
                    <label className="block text-slate-700 font-semibold mb-1">
                      {t('teacher.med_name_label')}
                    </label>
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
                    <label className="block text-slate-700 font-semibold mb-1">
                      {t('teacher.med_dosage_label')}
                    </label>
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
                    <label className="block text-slate-700 font-semibold mb-1">
                      {t('teacher.med_notes_label')}
                    </label>
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
                    className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow-md transition-all mt-2 cursor-pointer"
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
              <code className="font-mono text-emerald-600 font-bold">LUNCH</code> •{' '}
              <code className="font-mono text-sky-700 font-bold">intake_level</code> &amp;{' '}
              <code className="font-mono text-sky-700 font-bold">reason_tags</code>.
            </p>
          </div>

          <form
            onSubmit={handleSaveMealException}
            className="p-4 bg-white border border-slate-200 rounded-convent space-y-3.5 text-xs shadow-sm text-slate-800"
          >
            <h4 className="font-bold text-sky-900 text-sm">{t('teacher.meal_tag_form_title')}</h4>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">{t('common.child')} (*)</label>
              <select
                value={selectedStudentForMeal}
                onChange={(e) => setSelectedStudentForMeal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.student_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {t('teacher.meal_level_label')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIntakeLevel('HALF')}
                  className={`py-2.5 rounded-pill text-xs font-bold border transition-all cursor-pointer ${
                    selectedIntakeLevel === 'HALF'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-md'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {t('teacher.intake_half')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIntakeLevel('REFUSED')}
                  className={`py-2.5 rounded-pill text-xs font-bold border transition-all cursor-pointer ${
                    selectedIntakeLevel === 'REFUSED'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {t('teacher.intake_refused')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Reason Tags (*)</label>
              <div className="flex flex-wrap gap-2">
                {['#Biếng_ăn', '#Chỉ_uống_canh', '#Khó_tiêu', '#Mệt_mỏi', '#Dị_ứng_thức_ăn'].map(
                  (tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`px-3 py-1.5 rounded-pill text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white border border-sky-500 shadow-sm'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {translateReasonTag(tag, language)}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow transition-all mt-1 cursor-pointer"
            >
              {t('teacher.btn_save_meal_exception')}
            </button>
          </form>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
              {t('teacher.meal_exception_list')}
            </h4>
            {mealExceptions.map((ex) => (
              <div
                key={ex.id}
                className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-slate-900 text-sm">{ex.student_name}</h5>
                    <span className="font-mono text-[10px] px-2.5 py-0.5 bg-sky-50 text-sky-800 font-bold rounded-pill border border-sky-200">
                      {ex.intake_level === 'HALF'
                        ? t('teacher.intake_half')
                        : ex.intake_level === 'REFUSED'
                        ? t('teacher.intake_refused')
                        : ex.intake_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {ex.reason_tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-pill font-mono text-[10px]"
                      >
                        {translateReasonTag(tag, language)}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(ex.created_at || '').toLocaleTimeString(
                    language === 'vi' ? 'vi-VN' : 'en-US'
                  )}
                </span>
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
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-pill shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('teacher.btn_mass_checkout')}</span>
            </button>
          </div>

          {loadingStudents ? (
            <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <div className="w-8 h-8 border-3 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-600 font-semibold">
                Đang tải danh sách học sinh Lớp {activeClass?.name || '...'}
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              Chưa có học sinh nào trong Lớp {activeClass?.name || '...'}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {students.map((student) => {
                const activePickups = (student.authorized_pickups || []).filter(
                  (p: AuthorizedPickup) => p.is_active !== false && p.approval_status !== 'REJECTED'
                );

                return (
                  <div
                    key={student.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-convent text-xs shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
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
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {student.full_name}
                          </h4>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {student.student_code}
                          </span>
                          {student.checkoutReason && (
                            <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                              {student.checkoutReason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {activePickups.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setViewPickupStudentId(student.id)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-pill font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đối soát ({activePickups.length})</span>
                          </button>
                        )}

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
                            className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-pill font-bold transition-all shadow flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{t('teacher.checkout_late')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {activePickups.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] bg-slate-50/70 -mx-3.5 -mb-3.5 px-3.5 py-2 rounded-b-convent">
                        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                          <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                            Người đón ủy quyền:
                          </span>
                          {activePickups.map((p: AuthorizedPickup) => (
                            <div
                              key={p.id}
                              onClick={() => setViewPickupStudentId(student.id)}
                              className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-pill px-2 py-0.5 text-[11px] cursor-pointer hover:border-emerald-400 transition-all shrink-0"
                            >
                              {p.avatar_url ? (
                                <img
                                  src={p.avatar_url}
                                  alt={p.name}
                                  className="w-4 h-4 rounded-full object-cover border border-emerald-500 shrink-0"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                                  {p.name.charAt(0)}
                                </div>
                              )}
                              <span className="font-bold text-slate-800">{p.name}</span>
                              <span className="text-[10px] text-slate-500">({p.relationship})</span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewPickupStudentId(student.id)}
                          className="text-[11px] text-emerald-700 font-bold hover:underline shrink-0 ml-2 cursor-pointer"
                        >
                          Đối chiếu →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pickup Cross-Check Modal */}
          {viewPickupStudentId &&
            (() => {
              const st = students.find((s) => s.id === viewPickupStudentId);
              if (!st) return null;
              const activePickups = (st.authorized_pickups || []).filter(
                (p: AuthorizedPickup) => p.is_active !== false && p.approval_status !== 'REJECTED'
              );
              const inactivePickups = (st.authorized_pickups || []).filter(
                (p: AuthorizedPickup) => p.is_active === false
              );

              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-convent max-w-md w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>Đối Soát Người Đón Bé</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setViewPickupStudentId(null)}
                        className="text-slate-400 hover:text-slate-800 text-sm p-1 rounded-full cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center gap-3">
                      {st.avatar_url ? (
                        <img
                          src={st.avatar_url}
                          alt={st.full_name}
                          className="w-12 h-12 rounded-full border-2 border-sky-400 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-800 font-bold text-sm flex items-center justify-center shrink-0">
                          {st.full_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{st.full_name}</h4>
                        <span className="text-xs text-sky-700 font-mono font-semibold">
                          {st.student_code}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {activePickups.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-600 text-xs">
                          Bé chưa có người đón ủy quyền hợp lệ. Chỉ phụ huynh ruột mới được nhận trẻ.
                        </div>
                      ) : (
                        activePickups.map((pickup: AuthorizedPickup) => (
                          <div
                            key={pickup.id}
                            className="p-3 bg-emerald-50/50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {pickup.avatar_url ? (
                                <img
                                  src={pickup.avatar_url}
                                  alt={pickup.name}
                                  className="w-14 h-14 rounded-full border-2 border-emerald-500 object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-400 font-bold text-base flex items-center justify-center shrink-0">
                                  {pickup.name?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="px-2 py-0.5 bg-white text-emerald-800 font-bold text-[10px] rounded-pill border border-emerald-300">
                                  {pickup.relationship}
                                </span>
                                <h4 className="font-extrabold text-slate-900 text-sm truncate mt-0.5">
                                  {pickup.name}
                                </h4>
                                <a
                                  href={`tel:${pickup.phone}`}
                                  className="text-sky-700 font-mono font-bold text-xs inline-flex items-center gap-1 mt-0.5 hover:underline"
                                >
                                  <Phone className="w-3 h-3 fill-current" />
                                  <span>{pickup.phone}</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      {inactivePickups.length > 0 && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                          <span className="font-bold text-rose-700 text-[11px] block">
                            ⚠️ Người đón đang tạm ngưng ({inactivePickups.length}):
                          </span>
                          {inactivePickups.map((ip: AuthorizedPickup) => (
                            <div key={ip.id} className="text-[11px] text-rose-800">
                              • {ip.name} ({ip.relationship}) - {ip.phone}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {st.parents?.map((parent: ParentContact, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2"
                        >
                          <img
                            src={parent.avatar_url}
                            alt={parent.name}
                            className="w-8 h-8 rounded-full border border-slate-300 object-cover shrink-0"
                          />
                          <div className="min-w-0 text-[11px]">
                            <span className="font-bold block text-slate-800 truncate">{parent.name}</span>
                            <span className="text-slate-500 block text-[10px]">
                              {parent.relationship}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setViewPickupStudentId(null)}
                        className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-pill cursor-pointer"
                      >
                        Đóng
                      </button>
                      {!st.checkedOut && (
                        <button
                          type="button"
                          onClick={() => {
                            handleQuickCheckoutStudent(
                              st.id,
                              'Người thân đón (Đã đối soát khuôn mặt & SĐT)'
                            );
                            setViewPickupStudentId(null);
                          }}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-pill shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Xác nhận khớp - Trả trẻ</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Late Checkout Modal */}
          {showLateCheckoutModal &&
            (() => {
              const currentLateStudent = students.find((s) => s.id === lateStudentId);
              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-convent max-w-md w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-slate-700" />
                        {t('teacher.modal_late_checkout')}
                      </h3>
                      <button
                        onClick={() => setShowLateCheckoutModal(false)}
                        className="text-slate-400 hover:text-slate-800 cursor-pointer"
                      >
                        ✕
                      </button>
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
                          <h4 className="font-bold text-slate-900 text-sm">
                            {currentLateStudent.full_name}
                          </h4>
                          <span className="text-xs text-sky-700 font-mono font-semibold">
                            {currentLateStudent.student_code}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          {t('teacher.late_pickup_reason_label')}
                        </label>
                        <select
                          value={lateReason}
                          onChange={(e) => setLateReason(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        >
                          <option value="Phụ huynh bận công việc đột xuất">
                            1.{' '}
                            {language === 'en'
                              ? 'Parent busy with unexpected work'
                              : 'Phụ huynh bận công việc đột xuất'}
                          </option>
                          <option value="Kẹt xe giờ cao điểm">
                            2.{' '}
                            {language === 'en' ? 'Heavy rush-hour traffic' : 'Kẹt xe giờ cao điểm'}
                          </option>
                          <option value="Đón bé muộn do thời tiết mưa to">
                            3.{' '}
                            {language === 'en'
                              ? 'Late pickup due to heavy rain'
                              : 'Đón bé muộn do thời tiết mưa to'}
                          </option>
                          <option value="Người thân đón thay (Đã xác minh khuôn mặt)">
                            4.{' '}
                            {language === 'en'
                              ? 'Authorized relative pickup (Face verified)'
                              : 'Người thân đón thay (Đã xác minh khuôn mặt)'}
                          </option>
                        </select>
                      </div>

                      <button
                        onClick={handleSaveLateCheckout}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-pill shadow transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer"
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
