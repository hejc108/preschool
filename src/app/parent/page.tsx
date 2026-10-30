'use client';

import React, { useState, useCallback } from 'react';
import { 
  Heart, Calendar, Clock, CheckCircle2, ChevronLeft, Plus, 
  Shield, Sparkles, FileText, Phone, Check, UserCheck, AlertCircle, X,
  Utensils, Activity, ArrowRight, RefreshCw, ShieldAlert, LogOut, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { INITIAL_ABSENCE_REQUESTS, INITIAL_STUDENTS, supabase } from '@/lib/supabase/client';
import { AbsenceRequest, AuthorizedPickup, Student, ParentStudentRelation, WeeklyMenu } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getCurrentMenuWeek, getDayOfWeekEnum, checkDishAllergen } from '@/lib/utils/menuHelper';
import { INITIAL_HEALTH_RECORDS, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { saveStoredRelations } from '@/lib/utils/approvalHelper';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

export interface ParentChild {
  id: string;
  full_name: string;
  class_name: string;
  teacher_name: string;
  student_code: string;
  allergies: string;
  avatar_initials: string;
  attendance_status: string;
  checked_in_time: string;
  checked_out_time?: string;
  checkout_reason?: string;
  avatar_url: string;
}

function formatTimeVN(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  } catch {
    return '';
  }
}

export default function ParentPwaPage() {
  const { t } = useLanguage();

  const [parentEmail, setParentEmail] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isLoadingRelations, setIsLoadingRelations] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [wrongRoleNotice, setWrongRoleNotice] = useState<boolean>(false);
  const [isTeacherUser, setIsTeacherUser] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('');
  const [liveRelations, setLiveRelations] = useState<ParentStudentRelation[]>([]);
  const [realStudents, setRealStudents] = useState<Student[]>([]);

  // Live Daily Activities & Menu from Supabase
  const [dailyAttendanceMap, setDailyAttendanceMap] = useState<Record<string, any>>({});
  const [dailyMedications, setDailyMedications] = useState<any[]>([]);
  const [dailyMealExceptions, setDailyMealExceptions] = useState<any[]>([]);
  const [liveMenuList, setLiveMenuList] = useState<WeeklyMenu[]>([]);
  const [childHealthMap, setChildHealthMap] = useState<Record<string, any>>({});

  const loadParentData = useCallback(async (rawEmail: string) => {
    const cleanEmail = parseSignedCookieClient(rawEmail).toLowerCase().trim();
    if (!cleanEmail) {
      setIsLoadingRelations(false);
      return;
    }

    try {
      const [statusRes, approvalsRes, studentsRes, menuRes] = await Promise.all([
        fetch(`/api/auth/check-my-status?email=${encodeURIComponent(cleanEmail)}`, { cache: 'no-store' }).catch(() => null),
        fetch('/api/users/approvals', { cache: 'no-store' }).catch(() => null),
        fetch('/api/admin/students', { cache: 'no-store' }).catch(() => null),
        fetch('/api/admin/menu', { cache: 'no-store' }).catch(() => null),
      ]);

      let mergedRelations: ParentStudentRelation[] = [];

      if (statusRes && statusRes.ok) {
        const statusJson = await statusRes.json().catch(() => ({}));
        if (statusJson?.role) {
          const liveRole = statusJson.role;
          setUserRole(liveRole);
          if (String(liveRole).includes('TEACHER')) {
            setIsTeacherUser(true);
          }

          // Update local stored user profile role
          try {
            const saved = localStorage.getItem('suongmai_auth_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              parsed.role = liveRole;
              localStorage.setItem('suongmai_auth_user', JSON.stringify(parsed));
            }
          } catch (e) {}

          // Requirement 2: If live role is TEACHER and has NO linked children:
          if (liveRole === 'TEACHER' && !statusJson.hasChildren) {
            window.location.href = '/teacher';
            return;
          }

          // If live role is admin:
          if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(liveRole) && !statusJson.hasChildren) {
            window.location.href = '/admin/dashboard';
            return;
          }
        }
        if (Array.isArray(statusJson?.linkedStudents) && statusJson.linkedStudents.length > 0) {
          mergedRelations = statusJson.linkedStudents;
        }
      }

      if (approvalsRes && approvalsRes.ok) {
        const approvalsJson = await approvalsRes.json().catch(() => ({}));
        if (Array.isArray(approvalsJson?.relations) && approvalsJson.relations.length > 0) {
          saveStoredRelations(approvalsJson.relations);
          const forParent = approvalsJson.relations.filter(
            (r: ParentStudentRelation) =>
              r.parent_email?.toLowerCase().trim() === cleanEmail && r.is_verified
          );
          if (forParent.length > 0) {
            mergedRelations = forParent;
          }
        }
      }

      if (studentsRes && studentsRes.ok) {
        const studentsJson = await studentsRes.json().catch(() => ({}));
        const list: Student[] = Array.isArray(studentsJson)
          ? studentsJson
          : (studentsJson.students || studentsJson.data || []);
        if (Array.isArray(list) && list.length > 0) {
          setRealStudents(list);
        }
      }

      if (menuRes && menuRes.ok) {
        const menuJson = await menuRes.json().catch(() => ({}));
        if (menuJson?.has_db && Array.isArray(menuJson.menu)) {
          setLiveMenuList(menuJson.menu);
        } else {
          setLiveMenuList([]);
        }
      }

      setLiveRelations(mergedRelations);

      // Fetch real today's attendance & care activities from Supabase for linked students
      const linkedStudentIds = mergedRelations.map((r) => r.student_id).filter(Boolean);
      if (linkedStudentIds.length > 0) {
        try {
          const actRes = await fetch(
            `/api/daily-activities?student_ids=${encodeURIComponent(linkedStudentIds.join(','))}`,
            { cache: 'no-store' }
          );
          if (actRes.ok) {
            const actJson = await actRes.json();
            const attMap: Record<string, any> = {};
            if (Array.isArray(actJson.attendance)) {
              actJson.attendance.forEach((a: any) => {
                attMap[a.student_id] = a;
              });
            }
            setDailyAttendanceMap(attMap);
            setDailyMedications(Array.isArray(actJson.medications) ? actJson.medications : []);
            setDailyMealExceptions(Array.isArray(actJson.meal_exceptions) ? actJson.meal_exceptions : []);
          }
        } catch (actErr) {
          console.warn('[ParentPwaPage] Error fetching daily activities:', actErr);
        }
      }
    } catch (e) {
      console.warn('[ParentPwaPage] Error loading parent data:', e);
    } finally {
      setIsLoadingRelations(false);
    }
  }, []);

  // Read logged in parent email using parseSignedCookieClient and fetch relations from Supabase
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('warning') === 'wrong_role') {
        setWrongRoleNotice(true);
      }

      let emailFound = '';
      let roleFound = '';
      const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (match) emailFound = parseSignedCookieClient(match[1]);

      const roleMatch = document.cookie.match(/suongmai_user_role=([^;]+)/);
      if (roleMatch) roleFound = parseSignedCookieClient(roleMatch[1]);

      if (!emailFound || !emailFound.includes('@')) {
        const saved = localStorage.getItem('suongmai_auth_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.email) emailFound = parseSignedCookieClient(parsed.email);
            if (parsed.role) roleFound = parseSignedCookieClient(parsed.role);
          } catch (e) {}
        }
      }

      if (roleFound) {
        setUserRole(roleFound);
        if (roleFound.includes('TEACHER')) {
          setIsTeacherUser(true);
        }
      }

      if (emailFound && emailFound.includes('@')) {
        const cleanEmail = emailFound.toLowerCase().trim();
        setParentEmail(cleanEmail);
        setIsAuthenticated(true);
        loadParentData(cleanEmail);
      } else {
        // Fallback: check active Supabase Auth session
        supabase.auth
          .getUser()
          .then(({ data }) => {
            if (data?.user?.email) {
              const cleanEmail = data.user.email.toLowerCase().trim();
              setParentEmail(cleanEmail);
              setIsAuthenticated(true);
              loadParentData(cleanEmail);
            } else {
              setIsAuthenticated(false);
              setIsLoadingRelations(false);
            }
          })
          .catch(() => {
            setIsAuthenticated(false);
            setIsLoadingRelations(false);
          });
      }
    }
  }, [loadParentData]);

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
          redirectTo: `${origin}/auth/callback?next=/parent`,
        },
      });
    } catch (err) {
      console.error('In-place Google login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRefreshParentRelations = async () => {
    setRefreshing(true);
    try {
      let targetEmail = parentEmail;
      if (!targetEmail && typeof window !== 'undefined') {
        const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
        if (match) targetEmail = parseSignedCookieClient(match[1]);
      }
      if (targetEmail) {
        setParentEmail(targetEmail.toLowerCase().trim());
        await loadParentData(targetEmail);
      }
    } catch (e) {
      console.warn('Error refreshing parent relations:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

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

  const parentChildren: ParentChild[] = React.useMemo(() => {
    const cleanParentEmail = parseSignedCookieClient(parentEmail || '').toLowerCase().trim();
    const myRels = cleanParentEmail
      ? liveRelations.filter(
          (r) => r.parent_email?.toLowerCase().trim() === cleanParentEmail && r.is_verified
        )
      : liveRelations;

    if (myRels.length === 0) return [];

    return myRels.map((rel) => {
      const st = realStudents.find((s) => s.id === rel.student_id);
      const fullName = st?.full_name || rel.student_name || 'Học sinh Sương Mai';
      const className = st?.class_name || rel.class_name || 'Mầm';
      const studentCode = st?.student_code || rel.student_code || '';
      const allergies = st?.allergies || 'Không';
      const avatarUrl =
        st?.avatar_url ||
        'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80';

      const attRecord = dailyAttendanceMap[rel.student_id];
      const attendanceStatus = attRecord?.status || 'NOT_RECORDED';
      const checkedInTime = attRecord?.checked_in_at ? formatTimeVN(attRecord.checked_in_at) : '';
      const checkedOutTime = attRecord?.checked_out_at ? formatTimeVN(attRecord.checked_out_at) : '';

      return {
        id: rel.student_id,
        full_name: fullName,
        class_name: className,
        teacher_name: `Giáo viên lớp ${className}`,
        student_code: studentCode,
        allergies,
        avatar_initials: fullName
          .split(' ')
          .filter(Boolean)
          .map((w) => w[0])
          .join('')
          .slice(-2)
          .toUpperCase(),
        attendance_status: attendanceStatus,
        checked_in_time: checkedInTime,
        checked_out_time: checkedOutTime,
        checkout_reason: attRecord?.checkout_reason || '',
        avatar_url: avatarUrl,
      };
    });
  }, [realStudents, parentEmail, liveRelations, dailyAttendanceMap]);

  // Selected Child State
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  React.useEffect(() => {
    if (parentChildren.length > 0 && !parentChildren.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(parentChildren[0].id);
    }
  }, [parentChildren, selectedChildId]);

  const selectedChild = parentChildren.find((c) => c.id === selectedChildId) || parentChildren[0] || null;

  // Active Main View Tab
  const [activeNav, setActiveNav] = useState<'TIMELINE' | 'ABSENCE' | 'RECONCILIATION' | 'PICKUPS'>('TIMELINE');

  // Authorized Pickups State (Truy vấn dữ liệu thực tế từ Supabase)
  const [childPickups, setChildPickups] = useState<AuthorizedPickup[]>([]);
  const [isLoadingPickups, setIsLoadingPickups] = useState<boolean>(false);
  const [pickupSubmitting, setPickupSubmitting] = useState<boolean>(false);
  const [showAddPickupModal, setShowAddPickupModal] = useState<boolean>(false);
  const [newPickupName, setNewPickupName] = useState('');
  const [newPickupRel, setNewPickupRel] = useState('Ông Nội');
  const [newPickupPhone, setNewPickupPhone] = useState('');

  // Hàm tải danh sách người đón được ủy quyền của học sinh được chọn từ Supabase
  const loadChildPickups = useCallback(async (studentId: string) => {
    if (!studentId) {
      setChildPickups([]);
      return;
    }
    setIsLoadingPickups(true);
    try {
      const res = await fetch(`/api/parent/pickups?student_id=${encodeURIComponent(studentId)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        setChildPickups(Array.isArray(json.pickups) ? json.pickups : []);
      } else {
        setChildPickups([]);
      }
    } catch (err) {
      console.warn('[ParentPwaPage] Failed to fetch pickups:', err);
      setChildPickups([]);
    } finally {
      setIsLoadingPickups(false);
    }
  }, []);

  // Tự động tải người đón khi đổi bé hoặc chuyển sang tab Người đón
  React.useEffect(() => {
    if (selectedChild?.id) {
      loadChildPickups(selectedChild.id);
    }
  }, [selectedChild?.id, activeNav, loadChildPickups]);

  // Xử lý phụ huynh gửi đơn ủy quyền người đón mới lên Supabase
  const handleParentAddPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPickupName.trim() || !newPickupPhone.trim() || !selectedChild) return;

    setPickupSubmitting(true);
    try {
      const res = await fetch('/api/parent/pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedChild.id,
          name: newPickupName.trim(),
          relationship: newPickupRel,
          phone: newPickupPhone.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.pickup) {
        setChildPickups((prev) => [json.pickup, ...prev]);
        setShowAddPickupModal(false);
        setNewPickupName('');
        setNewPickupPhone('');
        alert('Đã gửi thông tin người đón thành công! Nhà trường sẽ đối chiếu và phê duyệt.');
      } else {
        alert(json.error || 'Có lỗi xảy ra khi lưu người đón.');
      }
    } catch (err: any) {
      alert(err?.message || 'Lỗi kết nối khi gửi thông tin người đón.');
    } finally {
      setPickupSubmitting(false);
    }
  };

  // Xử lý phụ huynh hủy ủy quyền người đón
  const handleParentDeletePickup = async (pickupId: string, pickupName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy ủy quyền đưa đón đối với: ${pickupName}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/parent/pickups?id=${encodeURIComponent(pickupId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setChildPickups((prev) => prev.filter((p) => p.id !== pickupId));
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Không thể xóa người đón.');
      }
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi xóa người đón.');
    }
  };

  // Absence Requests State
  const [absences, setAbsences] = useState<AbsenceRequest[]>(INITIAL_ABSENCE_REQUESTS);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReasonTag, setSelectedReasonTag] = useState('🌡️ Nghỉ ốm / Sốt');
  const [customReason, setCustomReason] = useState('');
  const [simulateLateSubmission, setSimulateLateSubmission] = useState(false);

  // Submit Absence Request
  const handleSubmitAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    const isFeeCredited = !simulateLateSubmission;
    const newStatus = isFeeCredited ? 'SUBMITTED_VALID' : 'SUBMITTED_LATE';
    const reasonText = customReason ? `${selectedReasonTag}: ${customReason}` : selectedReasonTag;

    const newReq: AbsenceRequest = {
      id: `abs-${Date.now()}`,
      student_id: selectedChild.id,
      student_name: selectedChild.full_name,
      start_date: startDate,
      end_date: endDate,
      reason: reasonText,
      submitted_by: 'parent_user',
      status: newStatus,
      is_fee_credited: isFeeCredited,
      submitted_at: new Date().toISOString(),
    };

    setAbsences([newReq, ...absences]);
    setShowAbsenceModal(false);
    setCustomReason('');
  };

  // Filtered Absences for Selected Child
  const childAbsences = selectedChild
    ? absences.filter((a) => a.student_id === selectedChild.id || a.student_name === selectedChild.full_name)
    : [];

  // 4-Week Rotating Menu Logic for Today (from Supabase weekly_menus)
  const currentWeekNum = getCurrentMenuWeek();
  const currentDayOfWeek = getDayOfWeekEnum();
  const mealOrder: Record<string, number> = {
    BREAKFAST: 1,
    LUNCH_MAIN: 2,
    LUNCH_SOUP: 3,
    DESSERT: 4,
    AFTERNOON_SNACK: 5,
  };
  const todayMeals = liveMenuList
    .filter((m) => m.week_number === currentWeekNum && m.day_of_week === currentDayOfWeek)
    .sort((a, b) => (mealOrder[a.meal_type] || 99) - (mealOrder[b.meal_type] || 99));

  // Build real timeline events for selectedChild from Supabase records
  const selectedChildTimelineEvents = React.useMemo(() => {
    if (!selectedChild) return [];
    const events: Array<{
      id: string;
      time: string;
      title: string;
      subtitle: string;
      type: 'CHECKIN' | 'ABSENT' | 'MEDICATION' | 'MEAL' | 'CHECKOUT';
    }> = [];

    if (
      selectedChild.attendance_status === 'PRESENT' ||
      selectedChild.attendance_status === 'PRESENT_LATE'
    ) {
      events.push({
        id: `att-in-${selectedChild.id}`,
        time: selectedChild.checked_in_time || '07:30',
        title: `${t('parent.checked_in_msg')} ${selectedChild.checked_in_time}`,
        subtitle: `${selectedChild.teacher_name}${
          selectedChild.attendance_status === 'PRESENT_LATE' ? ' • Điểm danh đến muộn' : ''
        }`,
        type: 'CHECKIN',
      });
    } else if (
      selectedChild.attendance_status === 'ABSENT_EXCUSED' ||
      selectedChild.attendance_status === 'ABSENT_UNEXCUSED'
    ) {
      events.push({
        id: `att-abs-${selectedChild.id}`,
        time: selectedChild.checked_in_time || '08:00',
        title: 'Ghi nhận nghỉ học hôm nay',
        subtitle: `${selectedChild.teacher_name} • ${
          selectedChild.attendance_status === 'ABSENT_EXCUSED' ? 'Nghỉ có phép' : 'Vắng mặt'
        }`,
        type: 'ABSENT',
      });
    }

    const childMeds = dailyMedications.filter((m) => m.student_id === selectedChild.id);
    childMeds.forEach((med) => {
      events.push({
        id: `med-${med.id}`,
        time: med.administered_at
          ? formatTimeVN(med.administered_at)
          : med.time_slot === 'SLOT_1130'
          ? '11:30'
          : '14:30',
        title:
          med.status === 'ADMINISTERED'
            ? t('teacher.administer_done')
            : 'Phiếu dặn thuốc (Chờ cho uống)',
        subtitle: `${selectedChild.teacher_name} • ${med.medication_name} (${med.dosage})${
          med.instructions ? ` - ${med.instructions}` : ''
        }`,
        type: 'MEDICATION',
      });
    });

    const childMeals = dailyMealExceptions.filter((me) => me.student_id === selectedChild.id);
    childMeals.forEach((me) => {
      events.push({
        id: `meal-${me.id}`,
        time: formatTimeVN(me.created_at) || '12:00',
        title: `Ghi chú bữa ăn (${
          me.meal_type === 'BREAKFAST'
            ? 'Bữa sáng'
            : me.meal_type === 'SNACK'
            ? 'Bữa xế'
            : 'Bữa trưa'
        })`,
        subtitle: `${me.intake_level === 'HALF' ? 'Ăn 1/2 suất (50%)' : 'Bé bỏ ăn'}${
          Array.isArray(me.reason_tags) && me.reason_tags.length > 0
            ? ` • ${me.reason_tags.join(', ')}`
            : ''
        }`,
        type: 'MEAL',
      });
    });

    if (selectedChild.checked_out_time) {
      events.push({
        id: `att-out-${selectedChild.id}`,
        time: selectedChild.checked_out_time,
        title: `Đã đón bé về lúc ${selectedChild.checked_out_time}`,
        subtitle: `${selectedChild.teacher_name}${
          selectedChild.checkout_reason
            ? ` • ${selectedChild.checkout_reason}`
            : ' • Bàn giao an toàn cho phụ huynh'
        }`,
        type: 'CHECKOUT',
      });
    }

    return events;
  }, [selectedChild, dailyMedications, dailyMealExceptions, t]);

  // Live Health Query for Selected Child from Supabase / API
  React.useEffect(() => {
    if (!selectedChild?.id) return;
    const childId = selectedChild.id;

    fetch(`/api/parent/health?student_id=${encodeURIComponent(childId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) {
          setChildHealthMap((prev) => ({
            ...prev,
            [childId]: data.latest || null,
          }));
        }
      })
      .catch((err) => console.warn('Error fetching child health:', err));
  }, [selectedChild?.id]);

  // Latest Health Record for Selected Child
  const latestHealth = selectedChild
    ? (childHealthMap[selectedChild.id] !== undefined
        ? childHealthMap[selectedChild.id]
        : (INITIAL_HEALTH_RECORDS.filter(
            (h) => h.student_id === selectedChild.id || h.student_name === selectedChild.full_name
          ).slice(-1)[0] || null))
    : null;

  const healthDisplay =
    latestHealth && latestHealth.growth_status
      ? getGrowthStatusDisplay(latestHealth.growth_status as any)
      : null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-surface-base to-rose-50/50 text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-amber-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-slate-800 text-center ring-1 ring-secondary-900/10">
          {/* Circular Official Logo */}
          <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-secondary-500 via-primary-600 to-secondary-600 mx-auto mb-4 shadow-xl shadow-secondary-500/20">
            <img 
              src="/images/logo.png" 
              alt="Mầm Non Sương Mai Logo" 
              className="w-full h-full object-cover rounded-full bg-white"
            />
          </div>
          
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sổ Liên Lạc Điện Tử</h1>
          <p className="text-secondary-700 font-bold text-xs mt-1 mb-6">Trường Mầm Non Sương Mai</p>

          <button
            onClick={handleInPlaceGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:border-secondary-500 text-slate-800 font-bold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm mb-4"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isLoggingIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
          </button>

          <p className="text-xs text-slate-500 leading-relaxed mb-4">Dành cho Phụ huynh học sinh trường Mầm Non Sương Mai.</p>

          {/* Direct PWA Install Trigger Banner */}
          <div className="pt-4 border-t border-amber-100 flex items-center justify-between text-left bg-amber-50/60 p-3 rounded-2xl border border-amber-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-secondary-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                📱
              </div>
              <div>
                <p className="text-xs font-bold text-secondary-900">Ứng dụng PWA Sương Mai</p>
                <p className="text-[10px] text-slate-500">Cài lên MH chính để dùng hàng ngày</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-secondary-700 bg-white px-2 py-1 rounded-lg border border-amber-200 shadow-2xs">
              Sẵn sàng cài đặt
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- LOADING STATE WHILE FETCHING RELATIONS FROM SUPABASE ---
  if (isLoadingRelations) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-lg space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-sky-50 border border-sky-200 rounded-2xl text-sky-600 shadow-2xs">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            Đang tải hồ sơ liên kết của bé...
          </h2>
          <p className="text-xs text-slate-500">
            Hệ thống đang đồng bộ dữ liệu Sổ liên lạc từ Trường Mầm Non Sương Mai.
          </p>
        </div>
      </div>
    );
  }

  // --- EMPTY STATE FOR UNLINKED PARENTS (Section III.2 Technical Directive) ---
  if (!selectedChild || parentChildren.length === 0) {
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
            Tài khoản chưa được liên kết với hồ sơ của bé 👨‍👩‍👧
          </h2>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 px-2">
            Tài khoản của bạn đã được xác nhận là Phụ huynh, nhưng hiện chưa được liên kết với hồ sơ của bé. Vui lòng liên hệ Nhà trường để hoàn tất liên kết thông tin cho con.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium mb-6 flex items-center justify-center gap-2">
            <Phone className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Hotline Văn phòng: <strong>028.3896.1234</strong></span>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleRefreshParentRelations}
              disabled={refreshing}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-pill transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>[ 🔄 Kiểm tra lại ]</span>
            </button>

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-24">
      {wrongRoleNotice && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Tài khoản của bạn là Phụ huynh. Hệ thống đã đưa bạn về trang Sổ liên lạc Phụ huynh.</span>
          </div>
          <button onClick={() => setWrongRoleNotice(false)} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2.5">
          {['SUPER_ADMIN', 'ADMIN', 'SCHOOL_ADMIN'].includes(userRole) ? (
            <Link href="/admin/dashboard" className="p-2 bg-sky-700 rounded-pill text-white hover:bg-sky-500 transition-colors" title="Về trang Quản trị">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white">
              SM
            </div>
          )}
          <div>
            <h1 className="font-bold text-white text-base leading-tight">{t('parent.app_title')}</h1>
            <p className="text-xs text-sky-100 font-semibold">{t('common.school_name')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTeacherUser && (
            <Link
              href="/teacher"
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-pill text-[11px] font-bold shadow-sm flex items-center gap-1 transition-all"
              title="Quay lại Cổng Tác Nghiệp Giáo Viên"
            >
              <span>👩‍🏫 Cổng Giáo Viên</span>
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

      {/* TC-AUTH-01 & TC-AUTH-02: DYNAMIC MULTI-CHILD SELECTOR BAR */}
      {/* If parent has 2+ children: Render Selector Bar. If parent has only 1 child: HIDE SELECTOR BAR COMPLETELY */}
      {parentChildren.length >= 2 && (
        <div className="p-3 bg-white border-b border-slate-200">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 px-1">{t('parent.select_child')}</div>
          <div className="grid grid-cols-2 gap-2">
            {parentChildren.map((child) => {
              const isSelected = selectedChildId === child.id;
              return (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`p-2.5 rounded-xl border transition-all text-left flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-sky-50 border-sky-400 text-slate-900 shadow-sm font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {child.avatar_initials}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs truncate font-bold">{child.full_name}</h4>
                    <span className="text-[10px] text-slate-400 block font-mono">{child.class_name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Child Banner Summary */}
      <div className="p-4 bg-gradient-to-r from-sky-50 via-white to-cyan-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <span className="text-xs text-sky-700 font-bold block">{t('parent.today_status')}</span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <span>{selectedChild.full_name}</span>
            <span className="text-xs px-2 py-0.5 bg-sky-100 text-sky-800 rounded-pill font-mono">{selectedChild.class_name}</span>
          </h2>
          {selectedChild.attendance_status === 'PRESENT' || selectedChild.attendance_status === 'PRESENT_LATE' ? (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {selectedChild.checked_out_time
                ? `Đã đón về lúc ${selectedChild.checked_out_time}`
                : `${t('parent.checked_in_msg')} ${selectedChild.checked_in_time}`}
            </p>
          ) : selectedChild.attendance_status === 'ABSENT_EXCUSED' || selectedChild.attendance_status === 'ABSENT_UNEXCUSED' ? (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" /> Nghỉ học hôm nay
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Chưa điểm danh hôm nay
            </p>
          )}
        </div>

        <button
          onClick={() => setShowAbsenceModal(true)}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-pill shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{t('parent.btn_absence')}</span>
        </button>
      </div>

      {/* 4 Main Parent Navigation Tabs (TC-UI-04: Sentence Case "Người đón") */}
      <div className="grid grid-cols-4 bg-white border-b border-slate-200 text-[11px] font-bold text-center">
        <button
          onClick={() => setActiveNav('TIMELINE')}
          className={`py-3 transition-all border-b-2 flex items-center justify-center gap-1 ${
            activeNav === 'TIMELINE' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t('parent.tab_timeline')}</span>
        </button>

        <button
          onClick={() => setActiveNav('ABSENCE')}
          className={`py-3 transition-all border-b-2 flex items-center justify-center gap-1 ${
            activeNav === 'ABSENCE' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{t('parent.tab_absence')}</span>
        </button>

        <button
          onClick={() => setActiveNav('RECONCILIATION')}
          className={`py-3 transition-all border-b-2 flex items-center justify-center gap-1 ${
            activeNav === 'RECONCILIATION' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t('parent.tab_statement')}</span>
        </button>

        <button
          onClick={() => setActiveNav('PICKUPS')}
          className={`py-3 transition-all border-b-2 flex items-center justify-center gap-1 ${
            activeNav === 'PICKUPS' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Người đón</span>
        </button>
      </div>

      {/* --- SECTION 2: CARE TIMELINE FEED & WIDGETS --- */}
      {activeNav === 'TIMELINE' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* 1. KHỐI TRẠNG THÁI & DÒNG THỜI GIAN TRONG NGÀY (DAILY TIMELINE - DỮ LIỆU THẬT TỪ SUPABASE) */}
          <div className="bg-white border border-slate-200 rounded-convent p-4 space-y-4 shadow-sm text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600" />
                <span>{t('parent.timeline_title')}</span>
              </h3>
            </div>

            {selectedChildTimelineEvents.length === 0 ? (
              <div className="py-8 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl space-y-2">
                <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  Chưa có hoạt động mới trong ngày hôm nay
                </p>
                <p className="text-[11px] text-slate-400">
                  Các mốc điểm danh, ăn uống và chăm sóc của bé sẽ tự động cập nhật khi cô giáo ghi nhận tại lớp.
                </p>
              </div>
            ) : (
              <div className="space-y-4 relative pl-5 border-l-2 border-slate-200 text-xs">
                {selectedChildTimelineEvents.map((ev) => (
                  <div key={ev.id} className="relative">
                    <div
                      className={`absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                        ev.type === 'CHECKIN' || ev.type === 'CHECKOUT'
                          ? 'bg-emerald-600'
                          : ev.type === 'MEDICATION'
                          ? 'bg-sky-600'
                          : ev.type === 'MEAL'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    >
                      {ev.type === 'CHECKIN' || ev.type === 'CHECKOUT' ? (
                        <Check className="w-2 h-2 text-white stroke-[3]" />
                      ) : ev.type === 'MEDICATION' ? (
                        <Heart className="w-2 h-2 text-white fill-white" />
                      ) : null}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 font-bold block">{ev.time}</span>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5">{ev.title}</h4>
                    <p className="text-slate-600 mt-0.5">{ev.subtitle}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. KHỐI THỰC ĐƠN HÔM NAY (NẰM NGAY BÊN DƯỚI TIMELINE - DỮ LIỆU THẬT TỪ SUPABASE) */}
          <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                <Utensils className="w-4 h-4 text-sky-600" />
                <span>Thực đơn hôm nay (Tuần {currentWeekNum})</span>
              </div>
              <Link href="/parent/menu" className="text-[11px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-0.5">
                Xem toàn bộ 4 tuần <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {todayMeals.length === 0 ? (
              <div className="py-6 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-500">
                  Nhà trường đang cập nhật thực đơn
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {todayMeals.map((meal) => {
                  const allergenCheck = checkDishAllergen(meal.dish_name, meal.allergens, selectedChild.allergies);
                  return (
                    <div key={meal.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          {meal.meal_type === 'BREAKFAST'
                            ? 'Bữa sáng'
                            : meal.meal_type === 'LUNCH_MAIN'
                            ? 'Trưa - Món mặn'
                            : meal.meal_type === 'LUNCH_SOUP'
                            ? 'Trưa - Món canh'
                            : meal.meal_type === 'DESSERT'
                            ? 'Tráng miệng'
                            : 'Bữa xế'}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">{meal.dish_name}</span>
                      </div>

                      {/* Allergen Warning Badge */}
                      {allergenCheck.hasAllergen && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-pill text-[10px] font-bold flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>{allergenCheck.warningLabel || 'Cảnh báo dị ứng'}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. KHỐI THEO DÕI SỨC KHỎE (GROWTH TRACKER - NẰM DƯỚI THỰC ĐƠN) */}
          <Link
            href={`/parent/health${selectedChild ? `?student_id=${selectedChild.id}` : ''}`}
            className="block p-3.5 bg-gradient-to-r from-emerald-50 via-white to-teal-50 border border-emerald-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Sổ theo dõi thể trạng {latestHealth?.term ? `(${latestHealth.term})` : ''}</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                Xem chi tiết <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            {latestHealth && (latestHealth.weight_kg !== null || latestHealth.height_cm !== null) ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700">
                <div className="flex items-center flex-wrap gap-2 text-slate-900 font-mono text-xs sm:text-sm font-bold">
                  <span className="bg-white/90 px-2 py-0.5 rounded-lg border border-emerald-100">
                    📏 {latestHealth.height_cm !== null && latestHealth.height_cm !== undefined ? `${latestHealth.height_cm} cm` : '--'}
                  </span>
                  <span className="bg-white/90 px-2 py-0.5 rounded-lg border border-emerald-100">
                    ⚖️ {latestHealth.weight_kg !== null && latestHealth.weight_kg !== undefined ? `${latestHealth.weight_kg} kg` : '--'}
                  </span>
                  {latestHealth.term && (
                    <span className="text-[11px] font-sans font-medium text-slate-500">
                      📅 {latestHealth.term}
                    </span>
                  )}
                </div>
                {healthDisplay && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap self-start sm:self-auto ${healthDisplay.bgClass} ${healthDisplay.textClass}`}>
                    {healthDisplay.text}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-[11px] italic bg-slate-50/80 p-2 rounded-xl border border-dashed border-slate-200">
                Nhà trường đang cập nhật số liệu khám sức khỏe đợt này
              </p>
            )}
          </Link>
        </div>
      )}

      {/* --- SECTION 3: SMART ABSENCE REQUEST SYSTEM --- */}
      {activeNav === 'ABSENCE' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3.5 rounded-convent shadow-sm text-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{t('parent.tab_absence')}</h3>
              <p className="text-xs text-slate-500">{t('common.child')}: <strong className="text-sky-700">{selectedChild.full_name}</strong></p>
            </div>

            <button
              onClick={() => setShowAbsenceModal(true)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-pill shadow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ {t('parent.btn_absence')}</span>
            </button>
          </div>

          {/* List of Absences */}
          <div className="space-y-3">
            {childAbsences.length === 0 ? (
              <div className="p-6 bg-white border border-slate-200 rounded-convent text-center text-xs text-slate-400">
                Chưa có đơn xin nghỉ nào được tạo.
              </div>
            ) : (
              childAbsences.map((req) => (
                <div key={req.id} className="p-4 bg-white border border-slate-200 rounded-convent space-y-2.5 shadow-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      📅 {req.start_date} {req.start_date !== req.end_date && `➔ ${req.end_date}`}
                    </span>

                    {req.is_fee_credited ? (
                      <span className="text-[11px] px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-pill font-bold">
                        {t('parent.valid_credit_badge')}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-pill font-bold">
                        {t('parent.late_credit_badge')}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700">
                    <strong className="text-slate-900">{req.reason}</strong>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- SECTION 5: AUTHORIZED PICKUPS SYSTEM --- */}
      {activeNav === 'PICKUPS' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-convent p-4 space-y-4 shadow-sm text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Danh Sách Người Đón Được Ủy Quyền</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Xác thực danh tính người thân đón trẻ khi tan trường</p>
              </div>

              <button
                onClick={() => setShowAddPickupModal(true)}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-2 rounded-pill shadow transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm người đón</span>
              </button>
            </div>

            {/* Loading Indicator */}
            {isLoadingPickups ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600" />
                <p className="text-xs">Đang tải danh sách người đón...</p>
              </div>
            ) : childPickups.length === 0 ? (
              /* EMPTY STATE SẠCH SẼ, TINH GỌN THEO YÊU CẦU */
              <div className="py-10 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-3.5">
                <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-600 mx-auto flex items-center justify-center border border-sky-100 shadow-2xs">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="font-bold text-slate-800 text-sm">
                    Chưa có người đón được ủy quyền
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Chưa có người đón được ủy quyền. Bố/mẹ có thể thêm người nhà (ông, bà, người đưa đón) để nhà trường đối chiếu khi trả trẻ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPickupModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-pill text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm người đón</span>
                </button>
              </div>
            ) : (
              /* Pickups List (DỮ LIỆU THỰC TẾ TỪ SUPABASE) */
              <div className="space-y-3">
                {childPickups.map((pickup) => {
                  const isApproved = pickup.approval_status === 'APPROVED';

                  return (
                    <div
                      key={pickup.id}
                      className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 text-xs transition-all ${
                        isApproved
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-amber-50/30 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {pickup.avatar_url ? (
                          <img
                            src={pickup.avatar_url}
                            alt={pickup.name}
                            className={`w-12 h-12 rounded-full border-2 object-cover shrink-0 ${
                              isApproved ? 'border-emerald-500' : 'border-amber-400'
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {pickup.name?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-white text-slate-800 font-bold text-[10px] rounded-pill border border-slate-200">
                              {pickup.relationship}
                            </span>
                            {isApproved ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-pill border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" /> Đã Xác Thực
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-pill border border-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-700" /> Chờ Phê Duyệt
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm truncate">{pickup.name}</h4>
                          <span className="text-slate-500 font-mono text-[11px]">SĐT: {pickup.phone}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleParentDeletePickup(pickup.id, pickup.name)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Hủy ủy quyền người đón"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER HOTLINE BUTTON (TC-UI-04: Single Phone Icon & Sentence Case) */}
      <footer className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 p-3 z-30 flex items-center justify-between shadow-lg">
        <a
          href="tel:0909123456"
          className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-pill shadow transition-all text-xs"
        >
          <Phone className="w-4 h-4 fill-current" />
          <span>Hotline / Sơ trực ban</span>
        </a>
      </footer>

      {/* ABSENCE MODAL */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent max-w-sm w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600" />
                Tạo Đơn Xin Nghỉ Cho Bé
              </h3>
              <button onClick={() => setShowAbsenceModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <form onSubmit={handleSubmitAbsence} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Từ Ngày (*)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Đến Ngày (*)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Lý Do Nghỉ (*)</label>
                <select
                  value={selectedReasonTag}
                  onChange={(e) => setSelectedReasonTag(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                >
                  <option value="🌡️ Nghỉ ốm / Sốt">🌡️ Nghỉ ốm / Sốt</option>
                  <option value="✈️ Việc gia đình / Về quê">✈️ Việc gia đình / Về quê</option>
                  <option value="🏥 Khám sức khỏe định kỳ">🏥 Khám sức khỏe định kỳ</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow-md transition-all mt-1"
              >
                Gửi Đơn Xin Nghỉ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD AUTHORIZED PICKUP MODAL */}
      {showAddPickupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent max-w-sm w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-sky-600" />
                Thêm Người Đón Được Ủy Quyền
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPickupModal(false)}
                className="text-slate-400 hover:text-slate-800 text-sm p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleParentAddPickup} className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block mb-2">
                  Bé được đón: <strong className="text-sky-700">{selectedChild?.full_name}</strong>
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Họ và tên người đón (*)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newPickupName}
                  onChange={(e) => setNewPickupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quan hệ với bé (*)
                </label>
                <select
                  value={newPickupRel}
                  onChange={(e) => setNewPickupRel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:border-sky-500 focus:outline-none font-medium"
                >
                  <option value="Ông Nội">Ông Nội</option>
                  <option value="Bà Nội">Bà Nội</option>
                  <option value="Ông Ngoại">Ông Ngoại</option>
                  <option value="Bà Ngoại">Bà Ngoại</option>
                  <option value="Bác">Bác</option>
                  <option value="Cô">Cô</option>
                  <option value="Chú">Chú</option>
                  <option value="Dì">Dì</option>
                  <option value="Tài xế đưa đón">Tài xế đưa đón</option>
                  <option value="Người quen / Họ hàng">Người quen / Họ hàng</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Số điện thoại liên hệ (*)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ví dụ: 0912345678"
                  value={newPickupPhone}
                  onChange={(e) => setNewPickupPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="bg-sky-50 border border-sky-100 rounded-xl p-2.5 text-[11px] text-sky-800 leading-relaxed">
                ℹ️ Thông tin người đón sẽ được lưu trực tiếp vào cơ sở dữ liệu nhà trường để các cô giáo đối chiếu khi trả trẻ.
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPickupModal(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-pill transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pickupSubmitting}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-pill shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {pickupSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu người đón</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
