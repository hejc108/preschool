'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Heart,
  LogOut,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { AbsenceRequest, AuthorizedPickup } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { useActiveRole } from '@/components/auth/ActiveRoleContext';
import { RoleSwitcher } from '@/components/auth/RoleSwitcher';
import { AnnouncementsStrip } from '@/components/pwa/AnnouncementsStrip';
import { NotificationBell } from '@/components/pwa/NotificationBell';
import { MenuTodayCard } from '@/components/pwa/MenuTodayCard';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';

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

const jsonFetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.error || `Request failed (${res.status})`);
  }
  return json;
};

export function ParentPortalView() {
  const { t } = useLanguage();
  const {
    activeRole,
    serverSyncedRole,
    profileId,
    fullName,
    avatarUrl,
    linkedStudents,
    isLoading: isLoadingSession,
    waitForRoleSync,
    refreshSession,
    logout,
  } = useActiveRole();

  const [refreshing, setRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeNav, setActiveNav] = useState<'TIMELINE' | 'ABSENCE' | 'RECONCILIATION' | 'PICKUPS'>(
    'TIMELINE'
  );

  // Absence Form Modal State
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReasonTag, setSelectedReasonTag] = useState('🌡️ Nghỉ ốm / Sốt');
  const [customReason, setCustomReason] = useState('');
  const [submittingAbsence, setSubmittingAbsence] = useState(false);

  // Pickup Modal State
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [showAddPickupModal, setShowAddPickupModal] = useState(false);
  const [editingPickupId, setEditingPickupId] = useState<string | null>(null);
  const [pickupFormName, setPickupFormName] = useState('');
  const [pickupFormRel, setPickupFormRel] = useState('Bà Ngoại');
  const [pickupFormPhone, setPickupFormPhone] = useState('');
  const [pickupFormAvatar, setPickupFormAvatar] = useState('');
  const [pickupFormIsActive, setPickupFormIsActive] = useState<boolean>(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isParentReady = activeRole === 'PARENT';
  const isParentRealtimeReady = isParentReady && serverSyncedRole === 'PARENT';

  const fetchAsParent = useCallback(
    async (url: string) => {
      const aligned = await waitForRoleSync('PARENT');
      if (!aligned) {
        throw new Error('ROLE_SWITCH_CANCELLED');
      }
      return jsonFetcher(url);
    },
    [waitForRoleSync]
  );

  const childIdsKey = useMemo(
    () =>
      linkedStudents
        .map((c) => c.student_id || c.id)
        .filter(Boolean)
        .join(','),
    [linkedStudents]
  );

  // 1. Daily activities (attendance, medications, meal exceptions) via strictly scoped /api/daily-activities
  const { data: activitiesPayload, mutate: mutateActivities } = useSWR(
    isParentReady && childIdsKey ? ['role', 'PARENT', 'daily-activities', childIdsKey] : null,
    () => fetchAsParent(`/api/daily-activities?student_ids=${encodeURIComponent(childIdsKey)}`),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      keepPreviousData: true,
      refreshInterval: 30000,
    }
  );

  // 2. Weekly Menu via /api/admin/menu (server allows PARENT role)
  const { data: menuPayload, mutate: mutateMenu } = useSWR(
    isParentReady ? ['role', 'PARENT', 'menu'] : null,
    () => fetchAsParent('/api/admin/menu'),
    {
      revalidateOnMount: true,
      keepPreviousData: true,
      refreshInterval: 120000,
    }
  );

  const dailyAttendanceMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(activitiesPayload?.attendance)) {
      activitiesPayload.attendance.forEach((a: any) => {
        map[a.student_id] = a;
      });
    }
    return map;
  }, [activitiesPayload]);

  const dailyMedications: any[] = useMemo(
    () => (Array.isArray(activitiesPayload?.medications) ? activitiesPayload.medications : []),
    [activitiesPayload]
  );
  const dailyMealExceptions: any[] = useMemo(
    () =>
      Array.isArray(activitiesPayload?.meal_exceptions) ? activitiesPayload.meal_exceptions : [],
    [activitiesPayload]
  );

  const parentChildren: ParentChild[] = useMemo(() => {
    return linkedStudents.map((rel) => {
      const sid = rel.student_id || rel.id;
      const childName = rel.full_name || rel.student_name || 'Học sinh Sương Mai';
      const className = rel.class_name || 'Mầm';
      const attRecord = dailyAttendanceMap[sid];

      return {
        id: sid,
        full_name: childName,
        class_name: className,
        teacher_name: `Giáo viên lớp ${className}`,
        student_code: rel.student_code || '',
        allergies: rel.allergies || 'Không',
        avatar_initials: childName
          .split(' ')
          .filter(Boolean)
          .map((w) => w[0])
          .join('')
          .slice(-2)
          .toUpperCase(),
        attendance_status: attRecord?.status || 'NOT_RECORDED',
        checked_in_time: attRecord?.checked_in_at ? formatTimeVN(attRecord.checked_in_at) : '',
        checked_out_time: attRecord?.checked_out_at ? formatTimeVN(attRecord.checked_out_at) : '',
        checkout_reason: attRecord?.checkout_reason || '',
        avatar_url:
          rel.avatar_url ||
          'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
      };
    });
  }, [linkedStudents, dailyAttendanceMap]);

  const selectedChild =
    parentChildren.find((c) => c.id === selectedChildId) || parentChildren[0] || null;

  // 3. Pickups for selected child (role-prefixed SWR key)
  const {
    data: pickupsPayload,
    isLoading: isLoadingPickups,
    mutate: mutatePickups,
  } = useSWR(
    isParentReady && selectedChild ? ['role', 'PARENT', 'pickups', selectedChild.id] : null,
    () => fetchAsParent(`/api/parent/pickups?student_id=${encodeURIComponent(selectedChild!.id)}`),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      keepPreviousData: true,
      refreshInterval: 60000,
    }
  );
  const childPickups: AuthorizedPickup[] = Array.isArray(pickupsPayload?.pickups)
    ? pickupsPayload.pickups
    : [];

  // 4. Health latest record for selected child (role-prefixed SWR key)
  const { data: healthPayload, mutate: mutateHealth } = useSWR(
    isParentReady && selectedChild ? ['role', 'PARENT', 'health', selectedChild.id] : null,
    () => fetchAsParent(`/api/parent/health?student_id=${encodeURIComponent(selectedChild!.id)}`),
    {
      revalidateOnMount: true,
      keepPreviousData: true,
      refreshInterval: 120000,
    }
  );
  const latestHealth = healthPayload?.latest || null;
  const healthDisplay =
    latestHealth && latestHealth.growth_status
      ? getGrowthStatusDisplay(latestHealth.growth_status as any)
      : null;

  // 5. Absences for selected child from Postgres (/api/absences)
  const { data: absencesPayload, mutate: mutateAbsences } = useSWR(
    isParentReady && selectedChild ? ['role', 'PARENT', 'absences', selectedChild.id] : null,
    () => fetchAsParent(`/api/absences?student_id=${encodeURIComponent(selectedChild!.id)}`),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      keepPreviousData: true,
      refreshInterval: 30000,
    }
  );
  const childAbsences: AbsenceRequest[] = Array.isArray(absencesPayload?.absences)
    ? absencesPayload.absences
    : [];

  const linkedChildIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    linkedChildIdsRef.current = new Set(linkedStudents.map((c) => c.student_id || c.id));
  }, [linkedStudents]);

  const matchesLinkedChild = useCallback((payload: any) => {
    if (linkedChildIdsRef.current.size === 0) return false;
    const sid = payload?.new?.student_id ?? payload?.old?.student_id;
    return !sid || linkedChildIdsRef.current.has(sid);
  }, []);

  // Supabase Realtime strictly isolated to parent's own children
  useRoleRealtimeSync({
    channelName: profileId ? `parent-portal-${profileId}` : null,
    enabled: isParentRealtimeReady && Boolean(profileId),
    debounceMs: 250,
    handlers: [
      {
        table: 'student_parents',
        onEvent: () => {
          void refreshSession();
          void mutateActivities();
        },
      },
      {
        table: 'student_guardians',
        onEvent: () => {
          void refreshSession();
          void mutateActivities();
        },
      },
      {
        table: 'attendance_records',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutateActivities();
        },
      },
      {
        table: 'medication_requests',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutateActivities();
        },
      },
      {
        table: 'meal_exceptions',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutateActivities();
        },
      },
      {
        table: 'absence_requests',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutateAbsences();
          void mutateActivities();
        },
      },
      {
        table: 'pickup_authorizations',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutatePickups();
        },
      },
      {
        table: 'authorized_pickups',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutatePickups();
        },
      },
      {
        table: 'health_records',
        match: matchesLinkedChild,
        onEvent: () => {
          void mutateHealth();
        },
      },
      {
        table: 'weekly_menus',
        onEvent: () => {
          void mutateMenu();
        },
      },
      {
        table: 'menu_cycle_configs',
        onEvent: () => {
          void mutateMenu();
        },
      },
      {
        table: 'menu_calendar_assignments',
        onEvent: () => {
          void mutateMenu();
        },
      },
    ],
  });

  const handleRefreshParentRelations = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSession(),
        mutateActivities(),
        mutateAbsences(),
        mutatePickups(),
        mutateHealth(),
        mutateMenu(),
      ]);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  // --- SUBMIT ABSENCE TO POSTGRES ---
  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || submittingAbsence) return;
    const reasonText = customReason.trim()
      ? `${selectedReasonTag}: ${customReason.trim()}`
      : selectedReasonTag;

    setSubmittingAbsence(true);
    try {
      const aligned = await waitForRoleSync('PARENT');
      if (!aligned) return;
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedChild.id,
          start_date: startDate,
          end_date: endDate,
          reason: reasonText,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        alert(json.error || 'Không thể gửi đơn xin nghỉ.');
        return;
      }

      await mutateAbsences();
      setShowAbsenceModal(false);
      setCustomReason('');
      setActiveNav('ABSENCE');
    } catch (err: any) {
      alert(err?.message || 'Lỗi kết nối khi gửi đơn xin nghỉ.');
    } finally {
      setSubmittingAbsence(false);
    }
  };

  // --- AUTHORIZED PICKUPS HANDLERS ---
  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        const rawDataUrl = readerEvent.target?.result as string;
        if (!rawDataUrl) {
          setIsUploadingAvatar(false);
          return;
        }

        const img = new Image();
        img.onload = async () => {
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            try {
              const aligned = await waitForRoleSync('PARENT');
              if (!aligned) {
                setPickupFormAvatar(compressedDataUrl);
                setIsUploadingAvatar(false);
                return;
              }
              const res = await fetch('/api/parent/pickups/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  student_id: selectedChild?.id || 'common',
                  dataUrl: compressedDataUrl,
                }),
              });
              const json = await res.json().catch(() => ({}));
              setPickupFormAvatar(res.ok && json.success && json.url ? json.url : compressedDataUrl);
            } catch {
              setPickupFormAvatar(compressedDataUrl);
            }
          }
          setIsUploadingAvatar(false);
        };
        img.onerror = () => {
          setPickupFormAvatar(rawDataUrl);
          setIsUploadingAvatar(false);
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingAvatar(false);
    }
  };

  const handleOpenAddPickupModal = () => {
    setEditingPickupId(null);
    setPickupFormName('');
    setPickupFormRel('Bà Ngoại');
    setPickupFormPhone('');
    setPickupFormAvatar('');
    setPickupFormIsActive(true);
    setShowAddPickupModal(true);
  };

  const handleOpenEditPickupModal = (pickup: AuthorizedPickup) => {
    setEditingPickupId(pickup.id);
    setPickupFormName(pickup.name);
    setPickupFormRel(pickup.relationship);
    setPickupFormPhone(pickup.phone);
    setPickupFormAvatar(pickup.avatar_url || '');
    setPickupFormIsActive(pickup.is_active !== false);
    setShowAddPickupModal(true);
  };

  const handleTogglePickupActive = async (pickup: AuthorizedPickup) => {
    const currentActive = pickup.is_active !== false;
    const nextStatus = !currentActive;

    mutatePickups(
      (prev: any) =>
        prev
          ? {
              ...prev,
              pickups: (prev.pickups || []).map((p: AuthorizedPickup) =>
                p.id === pickup.id ? { ...p, is_active: nextStatus } : p
              ),
            }
          : prev,
      { revalidate: false }
    );

    try {
      const aligned = await waitForRoleSync('PARENT');
      if (!aligned) return;
      const res = await fetch('/api/parent/pickups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pickup.id, is_active: nextStatus }),
      });
      if (!res.ok) {
        mutatePickups();
        alert('Không thể cập nhật trạng thái người đón.');
      }
    } catch (err: any) {
      mutatePickups();
      alert(err?.message || 'Lỗi kết nối khi cập nhật trạng thái.');
    }
  };

  const handleSavePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupFormName.trim() || !pickupFormPhone.trim() || !selectedChild) return;

    setPickupSubmitting(true);
    try {
      const aligned = await waitForRoleSync('PARENT');
      if (!aligned) return;
      const res = await fetch('/api/parent/pickups', {
        method: editingPickupId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingPickupId
            ? {
                id: editingPickupId,
                name: pickupFormName.trim(),
                relationship: pickupFormRel,
                phone: pickupFormPhone.trim(),
                avatar_url: pickupFormAvatar.trim(),
                is_active: pickupFormIsActive,
              }
            : {
                student_id: selectedChild.id,
                name: pickupFormName.trim(),
                relationship: pickupFormRel,
                phone: pickupFormPhone.trim(),
                avatar_url: pickupFormAvatar.trim(),
                is_active: pickupFormIsActive,
              }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        await mutatePickups();
        setShowAddPickupModal(false);
        alert(
          editingPickupId
            ? 'Đã cập nhật thông tin người đón thành công!'
            : 'Đã thêm người đón ủy quyền thành công!'
        );
      } else {
        alert(json.error || 'Có lỗi xảy ra khi lưu người đón.');
      }
    } catch (err: any) {
      alert(err?.message || 'Lỗi kết nối khi lưu thông tin người đón.');
    } finally {
      setPickupSubmitting(false);
    }
  };

  const handleParentDeletePickup = async (pickupId: string, pickupName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy ủy quyền đưa đón đối với: ${pickupName}?`)) {
      return;
    }
    try {
      const aligned = await waitForRoleSync('PARENT');
      if (!aligned) return;
      const res = await fetch(`/api/parent/pickups?id=${encodeURIComponent(pickupId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        mutatePickups();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Không thể xóa người đón.');
      }
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi xóa người đón.');
    }
  };

  // Timeline events
  const selectedChildTimelineEvents = useMemo(() => {
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

    dailyMedications
      .filter((m) => m.student_id === selectedChild.id)
      .forEach((med) => {
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

    dailyMealExceptions
      .filter((me) => me.student_id === selectedChild.id)
      .forEach((me) => {
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

  // Authoritative Unlinked Parent Empty State (only when session settled with 0 linked students)
  if (!isLoadingSession && (!selectedChild || parentChildren.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans">
        <header className="px-2.5 sm:px-3 py-2 bg-sky-600 text-white flex items-center justify-between gap-1.5 sm:gap-2 shadow-md overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Phụ huynh'}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/40 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
                SM
              </div>
            )}
            <span className="font-bold text-xs sm:text-sm leading-tight truncate line-clamp-1">
              {t('parent.app_title')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell portalRole="PARENT" />
            <RoleSwitcher currentPortal="PARENT" />
            <LanguageSwitcher compact />
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-sky-50 border border-sky-200 rounded-2xl mb-4 text-sky-600">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Tài khoản chưa liên kết hồ sơ bé
            </h2>
            <p className="text-slate-600 text-xs leading-relaxed mb-5">
              Vui lòng liên hệ Văn phòng Nhà trường để hoàn tất liên kết thông tin học sinh cho gia đình.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium mb-5 flex items-center justify-center gap-2">
              <Phone className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Hotline Văn phòng: <strong>028.3896.1234</strong></span>
            </div>
            <button
              onClick={handleRefreshParentRelations}
              disabled={refreshing}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-full transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Kiểm tra lại</span>
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

  // Fallback shell only on uncached cold hydration before selectedChild arrives (no blocking message screen)
  if (!selectedChild) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-24">
        <header className="px-2.5 sm:px-3 py-2 bg-sky-600 text-white flex items-center justify-between gap-1.5 sm:gap-2 sticky top-0 z-20 shadow-md overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
              SM
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <h1 className="font-bold text-white text-xs sm:text-sm leading-tight truncate line-clamp-1">
                {t('parent.app_title')}
              </h1>
              <p className="text-[11px] text-sky-100 font-medium leading-tight truncate line-clamp-1">
                {t('common.school_name')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell portalRole="PARENT" />
            <RoleSwitcher currentPortal="PARENT" />
            <LanguageSwitcher compact />
          </div>
        </header>
        <div className="p-4 space-y-3">
          <div className="h-20 rounded-2xl bg-white border border-slate-200" />
          <div className="h-32 rounded-2xl bg-white border border-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-800 flex flex-col max-w-md mx-auto border-x border-amber-900/10 shadow-2xl font-sans relative pb-24 overflow-x-hidden min-w-0 w-full">
      {/* Mobile Top Header — Calm & Warm Child-Friendly Teal */}
      <header className="px-3.5 py-2.5 bg-teal-700 text-white flex items-center justify-between sticky top-0 z-20 shadow-xs border-b border-teal-800/20 overflow-x-hidden min-w-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Phụ huynh'}
                className="w-9 h-9 rounded-full object-cover border-2 border-white/60 shadow-2xs"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-teal-600 border border-teal-400 flex items-center justify-center font-bold text-xs text-white shadow-2xs">
                {selectedChild?.avatar_initials || 'SM'}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-teal-700 rounded-full" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
              {selectedChild
                ? `Chào ba/mẹ bé ${selectedChild.full_name}`
                : fullName
                ? `Chào ${fullName}`
                : t('parent.app_title')}
            </h1>
            <p className="text-xs text-teal-100 font-medium leading-tight truncate mt-0.5">
              {t('common.school_name')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <NotificationBell portalRole="PARENT" />
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
            title="Cài đặt & Hồ sơ"
            aria-label="Mở cài đặt & hồ sơ"
          >
            <Settings className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      {/* Multi-child selector bar */}
      {parentChildren.length >= 2 && selectedChild && (
        <div className="p-3 bg-white/90 border-b border-amber-900/5 overflow-x-hidden min-w-0">
          <div className="text-xs uppercase font-bold text-slate-500 mb-1.5 px-1 tracking-wider">
            {t('parent.select_child')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {parentChildren.map((child) => {
              const isSelected = selectedChild.id === child.id;
              return (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`p-2.5 rounded-2xl border transition-all text-left flex items-center gap-2.5 cursor-pointer min-w-0 ${
                    isSelected
                      ? 'bg-teal-50/80 border-teal-400 text-slate-900 shadow-xs font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {child.avatar_initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm truncate font-bold">{child.full_name}</h4>
                    <span className="text-xs text-slate-500 block font-mono">
                      {child.class_name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Child Status Hero Card */}
      {selectedChild && (
        <div className="mx-3.5 mt-3.5 p-4 rounded-2xl bg-gradient-to-br from-teal-50/80 via-white to-amber-50/40 border border-teal-100/80 shadow-[0_4px_20px_rgba(13,148,136,0.06)] flex items-center justify-between gap-3 overflow-x-hidden min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              {selectedChild.avatar_initials}
            </div>

            <div className="min-w-0 space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {selectedChild.full_name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 bg-teal-100/90 text-teal-800 rounded-full font-bold shrink-0">
                  {selectedChild.class_name}
                </span>
              </div>

              <div className="min-w-0">
                {selectedChild.attendance_status === 'PRESENT' ||
                selectedChild.attendance_status === 'PRESENT_LATE' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-2.5 py-1 rounded-full max-w-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {selectedChild.checked_out_time
                        ? `Đã đón lúc ${selectedChild.checked_out_time}`
                        : `${t('parent.checked_in_msg')} ${selectedChild.checked_in_time}`}
                    </span>
                  </span>
                ) : selectedChild.attendance_status === 'ABSENT_EXCUSED' ||
                  selectedChild.attendance_status === 'ABSENT_UNEXCUSED' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200/90 px-2.5 py-1 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Nghỉ học hôm nay</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200/90 px-2.5 py-1 rounded-full">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Chưa điểm danh hôm nay</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAbsenceModal(true)}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 min-h-[40px] rounded-xl shadow-xs shrink-0 cursor-pointer transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nghỉ phép</span>
          </button>
        </div>
      )}

      {/* Modern 4-Item Sub-Navigation Rounded Pill Tabs — Shortened Labels & 44px Touch Targets */}
      <div className="mx-3.5 mt-3 p-1.5 bg-slate-200/80 rounded-2xl grid grid-cols-4 gap-1 text-[13px] font-semibold overflow-x-hidden min-w-0">
        <button
          type="button"
          onClick={() => setActiveNav('TIMELINE')}
          className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0 ${
            activeNav === 'TIMELINE'
              ? 'bg-white text-teal-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="truncate">Nhật ký</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('ABSENCE')}
          className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0 ${
            activeNav === 'ABSENCE'
              ? 'bg-white text-teal-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">Nghỉ phép</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('RECONCILIATION')}
          className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0 ${
            activeNav === 'RECONCILIATION'
              ? 'bg-white text-teal-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">Xuất ăn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('PICKUPS')}
          className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-0 ${
            activeNav === 'PICKUPS'
              ? 'bg-white text-teal-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">Người đón</span>
        </button>
      </div>

      {/* Role-scoped Announcements Strip */}
      <div className="px-3.5 pt-3 overflow-x-hidden min-w-0">
        <AnnouncementsStrip portalRole="PARENT" />
      </div>

      {/* --- SECTION 2: CARE TIMELINE FEED & WIDGETS --- */}
      {activeNav === 'TIMELINE' && selectedChild && (
        <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="bg-white border border-amber-100/90 rounded-2xl p-4 space-y-3.5 shadow-xs text-slate-800 overflow-x-hidden min-w-0">
            <div className="flex items-center justify-between border-b border-amber-100/60 pb-3">
              <h3 className="font-bold text-teal-950 text-sm sm:text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{t('parent.timeline_title')}</span>
              </h3>
            </div>

            {/* Seamless Timeline: Automatically collapse / hide empty intervals */}
            {selectedChildTimelineEvents.length === 0 ? (
              <div className="py-2.5 px-3 bg-teal-50/50 border border-teal-100/80 rounded-xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    Chưa có hoạt động mới ghi nhận hôm nay
                  </p>
                </div>
                <span className="text-xs text-teal-700 font-bold shrink-0">Tự động cập nhật</span>
              </div>
            ) : (
              <div className="space-y-4 relative pl-5 border-l-2 border-teal-200 text-xs">
                {selectedChildTimelineEvents.map((ev) => (
                  <div key={ev.id} className="relative min-w-0">
                    <div
                      className={`absolute -left-[25px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                        ev.type === 'CHECKIN' || ev.type === 'CHECKOUT'
                          ? 'bg-emerald-600'
                          : ev.type === 'MEDICATION'
                          ? 'bg-teal-600'
                          : ev.type === 'MEAL'
                          ? 'bg-amber-600'
                          : 'bg-rose-500'
                      }`}
                    >
                      {ev.type === 'CHECKIN' || ev.type === 'CHECKOUT' ? (
                        <Check className="w-2 h-2 text-white stroke-[3]" />
                      ) : ev.type === 'MEDICATION' ? (
                        <Heart className="w-2 h-2 text-white fill-white" />
                      ) : null}
                    </div>
                    <span className="font-mono text-xs text-slate-400 font-bold block">
                      {ev.time}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">{ev.title}</h4>
                    <p className="text-slate-600 text-[13px] mt-0.5 leading-snug line-clamp-2">{ev.subtitle}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Menu Today */}
          <MenuTodayCard
            menuPayload={menuPayload}
            fullViewHref="/parent/menu"
            studentAllergies={selectedChild.allergies}
          />

          {/* Growth Tracker */}
          <Link
            href={`/parent/health${selectedChild ? `?student_id=${selectedChild.id}` : ''}`}
            className="block p-4 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 border border-emerald-200/80 rounded-2xl shadow-xs hover:shadow-sm transition-all text-xs overflow-x-hidden min-w-0"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm sm:text-base">
                <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Sổ theo dõi thể trạng {latestHealth?.term ? `(${latestHealth.term})` : ''}</span>
              </div>
              <span className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                Chi tiết <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            {latestHealth &&
            (latestHealth.weight_kg !== null || latestHealth.height_cm !== null) ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-slate-700 min-w-0">
                <div className="flex items-center flex-wrap gap-2 text-slate-900 font-mono text-xs sm:text-sm font-bold min-w-0">
                  <span className="bg-white/95 px-3 py-1.5 rounded-xl border border-emerald-200/80 shadow-2xs whitespace-nowrap">
                    📏{' '}
                    {latestHealth.height_cm !== null && latestHealth.height_cm !== undefined
                      ? `${latestHealth.height_cm} cm`
                      : '--'}
                  </span>
                  <span className="bg-white/95 px-3 py-1.5 rounded-xl border border-teal-200/80 shadow-2xs whitespace-nowrap">
                    ⚖️{' '}
                    {latestHealth.weight_kg !== null && latestHealth.weight_kg !== undefined
                      ? `${latestHealth.weight_kg} kg`
                      : '--'}
                  </span>
                </div>
                {healthDisplay && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap self-start sm:self-auto ${healthDisplay.bgClass} ${healthDisplay.textClass}`}
                  >
                    {healthDisplay.text}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic bg-white/70 p-3 rounded-xl border border-dashed border-emerald-200/60 leading-relaxed">
                Nhà trường đang cập nhật số liệu khám sức khỏe đợt này
              </p>
            )}
          </Link>
        </div>
      )}

      {/* --- SECTION 3: SMART ABSENCE REQUEST SYSTEM (Postgres-backed) --- */}
      {activeNav === 'ABSENCE' && selectedChild && (
        <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="flex items-center justify-between bg-white border border-amber-900/10 p-4 rounded-2xl shadow-xs text-slate-800 overflow-x-hidden min-w-0 gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">{t('parent.tab_absence')}</h3>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 truncate">
                {t('common.child')}:{' '}
                <strong className="text-teal-700">{selectedChild.full_name}</strong>
              </p>
            </div>

            <button
              onClick={() => setShowAbsenceModal(true)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 min-h-[40px] rounded-xl shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{t('parent.btn_absence')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {childAbsences.length === 0 ? (
              <div className="p-6 bg-white border border-dashed border-amber-200/80 rounded-2xl text-center text-xs sm:text-sm text-slate-500">
                Chưa có đơn xin nghỉ nào được tạo cho bé.
              </div>
            ) : (
              childAbsences.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-white border border-amber-900/10 rounded-2xl space-y-2.5 shadow-xs text-slate-800 overflow-x-hidden min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                      📅 {req.start_date} {req.start_date !== req.end_date && `➔ ${req.end_date}`}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {req.is_fee_credited ? (
                        <span className="text-xs px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold">
                          {t('parent.valid_credit_badge')}
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-bold">
                          {t('parent.late_credit_badge')}
                        </span>
                      )}

                      {req.status === 'APPROVED' && (
                        <span className="text-xs px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full font-bold">
                          Cô đã duyệt
                        </span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="text-xs px-2.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-full font-bold">
                          Từ chối
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[13px] sm:text-sm text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">{req.reason}</strong>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- SECTION 4: FEE / ABSENCE RECONCILIATION --- */}
      {activeNav === 'RECONCILIATION' && selectedChild && (
        <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="bg-white border border-amber-900/10 rounded-2xl p-4 space-y-3.5 shadow-xs text-xs overflow-x-hidden min-w-0">
            <h3 className="font-bold text-teal-950 text-sm sm:text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Đối soát tiền ăn bán trú ({selectedChild.full_name})</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl">
                <span className="text-xs text-emerald-800 font-semibold block">Nghỉ hợp lệ (&lt;08:30)</span>
                <strong className="text-xl font-mono text-emerald-900 font-bold block mt-1">
                  {childAbsences.filter((a) => a.is_fee_credited).length} đơn
                </strong>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-700 font-semibold block">Báo muộn (&ge;08:30)</span>
                <strong className="text-xl font-mono text-slate-900 font-bold block mt-1">
                  {childAbsences.filter((a) => !a.is_fee_credited).length} đơn
                </strong>
              </div>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
              Các ngày nghỉ báo trước 08:30 sáng được hoàn tiền ăn bán trú vào kỳ đối soát cuối tháng của nhà trường.
            </p>
          </div>
        </div>
      )}

      {/* --- SECTION 5: AUTHORIZED PICKUPS SYSTEM --- */}
      {activeNav === 'PICKUPS' && selectedChild && (
        <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="bg-white border border-amber-900/10 rounded-2xl p-4 space-y-4 shadow-xs text-slate-800 overflow-x-hidden min-w-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-teal-950 text-sm sm:text-base flex items-center gap-2 truncate">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Người Đón Được Ủy Quyền</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Xác thực danh tính người thân đón trẻ khi tan trường
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddPickupModal}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs sm:text-sm font-bold px-3.5 py-2.5 min-h-[40px] rounded-xl shadow-xs shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm người đón</span>
              </button>
            </div>

            {isLoadingPickups && childPickups.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                <p className="text-xs sm:text-sm">Đang tải danh sách người đón...</p>
              </div>
            ) : childPickups.length === 0 ? (
              <div className="py-10 px-4 text-center bg-teal-50/20 border border-dashed border-teal-200/80 rounded-2xl space-y-3.5">
                <div className="w-14 h-14 rounded-full bg-teal-50 text-teal-600 mx-auto flex items-center justify-center border border-teal-100">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                    Chưa có người đón được ủy quyền
                  </h4>
                  <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed">
                    Bố/mẹ có thể thêm người nhà (ông, bà, người đưa đón) để nhà trường đối chiếu khi trả trẻ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddPickupModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer min-h-[40px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm người đón ủy quyền</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {childPickups.map((pickup) => {
                  const isActive = pickup.is_active !== false;
                  return (
                    <div
                      key={pickup.id}
                      className={`p-3.5 border rounded-2xl flex items-center justify-between gap-3 text-xs transition-all overflow-x-hidden min-w-0 ${
                        isActive
                          ? 'bg-emerald-50/20 border-emerald-200'
                          : 'bg-slate-50/70 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {pickup.avatar_url ? (
                          <img
                            src={pickup.avatar_url}
                            alt={pickup.name}
                            className={`w-12 h-12 rounded-full border-2 object-cover shrink-0 ${
                              isActive ? 'border-emerald-500' : 'border-slate-300 grayscale'
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {pickup.name?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="px-2.5 py-0.5 bg-white text-slate-800 font-bold text-xs rounded-full border border-slate-200">
                              {pickup.relationship}
                            </span>
                            {isActive ? (
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-700" /> Đang kích hoạt
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-300 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-500" /> Tạm ngưng đón
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">{pickup.name}</h4>
                          <a
                            href={`tel:${pickup.phone}`}
                            className="text-teal-700 hover:text-teal-900 font-mono text-xs sm:text-[13px] inline-flex items-center gap-1 hover:underline mt-0.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{pickup.phone}</span>
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePickupActive(pickup)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition min-h-[36px] ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{isActive ? 'Bật' : 'Tắt'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditPickupModal(pickup)}
                          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer transition"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleParentDeletePickup(pickup.id, pickup.name)}
                          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                          title="Xóa người đón"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* FOOTER HOTLINE — Sleek Floating Bar */}
      <footer className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-amber-900/10 p-2.5 z-30 flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <a
          href="tel:0909123456"
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all text-xs"
        >
          <Phone className="w-3.5 h-3.5 fill-current" />
          <span>Hotline trực ban: 0909 123 456</span>
        </a>
      </footer>

      {/* ABSENCE MODAL */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-amber-900/10 rounded-2xl max-w-sm w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>Tạo Đơn Xin Nghỉ Cho Bé</span>
              </h3>
              <button
                onClick={() => setShowAbsenceModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAbsence} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Từ Ngày (*)</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono focus:bg-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Đến Ngày (*)</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono focus:bg-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Lý Do Nghỉ (*)</label>
                <select
                  value={selectedReasonTag}
                  onChange={(e) => setSelectedReasonTag(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:border-teal-500 focus:outline-none font-medium"
                >
                  <option value="🌡️ Nghỉ ốm / Sốt">🌡️ Nghỉ ốm / Sốt</option>
                  <option value="✈️ Việc gia đình / Về quê">✈️ Việc gia đình / Về quê</option>
                  <option value="🏥 Khám sức khỏe định kỳ">🏥 Khám sức khỏe định kỳ</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Ghi chú thêm (nếu có)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bé hơi sốt nhẹ từ tối qua..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingAbsence}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold rounded-xl shadow-xs transition-all mt-1 cursor-pointer"
              >
                {submittingAbsence ? 'Đang gửi đơn...' : 'Gửi Đơn Xin Nghỉ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT AUTHORIZED PICKUP MODAL */}
      {showAddPickupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-amber-900/10 rounded-2xl max-w-sm w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <span>{editingPickupId ? 'Chỉnh Sửa Người Đón' : 'Thêm Người Đón Ủy Quyền'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPickupModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePickupSubmit} className="space-y-3.5 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">
                  Bé được đón: <strong className="text-teal-700">{selectedChild?.full_name}</strong>
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Ảnh chân dung người đón
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleAvatarFileSelected}
                />

                {pickupFormAvatar ? (
                  <div className="flex items-center gap-3 bg-teal-50/60 border border-teal-200 rounded-2xl p-2.5">
                    <img
                      src={pickupFormAvatar}
                      alt="Ảnh chân dung"
                      className="w-14 h-14 rounded-full object-cover border-2 border-teal-500 shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã có ảnh chân dung
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                        >
                          Đổi ảnh khác
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickupFormAvatar('')}
                          className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Xóa ảnh
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="w-full py-3 px-4 border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/40 rounded-2xl flex items-center justify-center gap-2 text-teal-700 font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 text-teal-600" />
                    <span>{isUploadingAvatar ? 'Đang xử lý ảnh...' : 'Chụp / Tải ảnh chân dung'}</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Họ và tên người đón (*)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Thị Hoa"
                  value={pickupFormName}
                  onChange={(e) => setPickupFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quan hệ với bé (*)
                </label>
                <select
                  value={pickupFormRel}
                  onChange={(e) => setPickupFormRel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:border-teal-500 focus:outline-none font-medium"
                >
                  <option value="Bà Ngoại">Bà Ngoại</option>
                  <option value="Ông Ngoại">Ông Ngoại</option>
                  <option value="Bà Nội">Bà Nội</option>
                  <option value="Ông Nội">Ông Nội</option>
                  <option value="Bác">Bác</option>
                  <option value="Cô">Cô</option>
                  <option value="Chú">Chú</option>
                  <option value="Dì">Dì</option>
                  <option value="Tài xế">Tài xế</option>
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
                  value={pickupFormPhone}
                  onChange={(e) => setPickupFormPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono focus:bg-white focus:border-teal-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 bg-slate-50 p-2.5 border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickupFormIsActive}
                  onChange={(e) => setPickupFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-800 text-xs block">
                    Kích hoạt quyền đón bé ngay
                  </span>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPickupModal(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pickupSubmitting}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <span>{pickupSubmitting ? 'Đang lưu...' : editingPickupId ? 'Lưu thay đổi' : 'Lưu người đón'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE & UTILITIES DRAWER / MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity">
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-amber-900/10 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Hồ sơ & Tiện ích</h3>
                  <p className="text-[11px] text-teal-100 font-medium">Cổng thông tin Phụ huynh</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* User Profile Card */}
              <div className="p-3.5 bg-gradient-to-br from-teal-50/70 via-white to-amber-50/40 rounded-2xl border border-teal-100 flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Phụ huynh'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-teal-500 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-2xs">
                    {fullName ? fullName.charAt(0) : 'SM'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{fullName || 'Phụ huynh học sinh'}</h4>
                  <p className="text-xs text-teal-700 font-medium truncate">Tài khoản Phụ huynh</p>
                  {parentChildren.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {parentChildren.map((child) => (
                        <span
                          key={child.id}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-teal-200 text-teal-800"
                        >
                          Bé {child.full_name} ({child.class_name})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Role Switcher Section */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chuyển đổi vai trò & Cổng
                </span>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Vai trò hiện tại:</span>
                  <RoleSwitcher currentPortal="PARENT" />
                </div>
              </div>

              {/* Language Switcher Section */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ngôn ngữ hiển thị
                </span>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Ngôn ngữ:</span>
                  <LanguageSwitcher compact={false} />
                </div>
              </div>

              {/* School Support Hotline */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Liên hệ nhà trường
                </span>
                <a
                  href="tel:0909123456"
                  className="p-3 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 rounded-2xl flex items-center justify-between transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2 text-amber-900 font-semibold">
                    <Phone className="w-4 h-4 text-amber-700" />
                    <span>Hotline / Sơ trực ban:</span>
                  </div>
                  <strong className="text-amber-800 font-mono">0909 123 456</strong>
                </a>
              </div>

              {/* Logout Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Đăng xuất khỏi hệ thống</span>
                </button>
              </div>

              {/* System Branding Info */}
              <div className="text-center pt-1 text-[11px] text-slate-400">
                <span>Hệ thống Quản lý Mầm non Sương Mai • v2.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
