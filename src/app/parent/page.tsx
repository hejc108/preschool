'use client';

import React, { useState } from 'react';
import { 
  Heart, Calendar, Clock, CheckCircle2, ChevronLeft, Plus, 
  Shield, Sparkles, FileText, Phone, Check, UserCheck, AlertCircle, X,
  Utensils, Activity, ArrowRight, RefreshCw, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { INITIAL_ABSENCE_REQUESTS, INITIAL_STUDENTS } from '@/lib/supabase/client';
import { AbsenceRequest, AuthorizedPickup, Student, ParentStudentRelation } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getCurrentMenuWeek, getDayOfWeekEnum, INITIAL_4WEEK_MENU, checkDishAllergen } from '@/lib/utils/menuHelper';
import { INITIAL_HEALTH_RECORDS, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';
import { getStoredRelations, fetchLiveProfilesFromSupabase } from '@/lib/utils/approvalHelper';

// Demo Parent Profiles for Testing Data Isolation & Selector Logic
const MOCK_PARENT_PROFILES = [
  {
    id: 'p0',
    name: 'Phụ huynh P0 (Chưa gán con - Empty State)',
    children: [],
  },
  {
    id: 'p1',
    name: 'Phụ huynh P1 (1 con duy nhất - TC-AUTH-01)',
    children: [
      {
        id: 's1',
        full_name: 'Trần Gia Bảo',
        class_name: 'Mầm 1 (Rose)',
        teacher_name: 'Sơ Maria Tươi',
        student_code: 'SM-2026-001',
        allergies: 'Hải sản (Tôm, Cua)',
        avatar_initials: 'GB',
        attendance_status: 'PRESENT',
        checked_in_time: '07:45',
        avatar_url: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 'p2',
    name: 'Phụ huynh P2 (Multi-child 2 con - TC-AUTH-02)',
    children: [
      {
        id: 's1',
        full_name: 'Trần Gia Bảo',
        class_name: 'Mầm 1 (Rose)',
        teacher_name: 'Sơ Maria Tươi',
        student_code: 'SM-2026-001',
        allergies: 'Hải sản (Tôm, Cua)',
        avatar_initials: 'GB',
        attendance_status: 'PRESENT',
        checked_in_time: '07:45',
        avatar_url: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
      },
      {
        id: 's4',
        full_name: 'Phạm Quỳnh Chi',
        class_name: 'Chồi 2 (Lily)',
        teacher_name: 'Sơ Anna Tuyết',
        student_code: 'SM-2026-004',
        allergies: 'Sữa bò (Lactose)',
        avatar_initials: 'QC',
        attendance_status: 'PRESENT',
        checked_in_time: '08:05',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
];

import { supabase } from '@/lib/supabase/client';

export default function ParentPwaPage() {
  const { t, language } = useLanguage();

  // Test Mode Toggle for Parent P0 (0 child), P1 (1 child) vs P2 (2 children)
  const [activeParentIndex, setActiveParentIndex] = useState<number>(2); // Defaults to P2
  const [parentEmail, setParentEmail] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [wrongRoleNotice, setWrongRoleNotice] = useState<boolean>(false);

  // Read logged in parent email and relations
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('warning') === 'wrong_role') {
        setWrongRoleNotice(true);
      }

      let emailFound = '';
      const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (match) emailFound = decodeURIComponent(match[1]);
      if (!emailFound) {
        const saved = localStorage.getItem('suongmai_auth_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.email) emailFound = parsed.email;
          } catch (e) {}
        }
      }
      if (emailFound) {
        setParentEmail(emailFound);
        setIsAuthenticated(true);
        const rels = getStoredRelations().filter(
          (r) => (r.parent_email.toLowerCase().trim() === emailFound.toLowerCase().trim()) && r.is_verified
        );
        if (rels.length === 0) {
          setActiveParentIndex(0); // Show empty state if user has 0 linked kids
        } else if (rels.length === 1) {
          setActiveParentIndex(1);
        } else {
          setActiveParentIndex(2);
        }
      } else {
        setIsAuthenticated(false);
      }
    }
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
      await fetchLiveProfilesFromSupabase();
      if (typeof window !== 'undefined') {
        const email = parentEmail || 'parent@gmail.com';
        const rels = getStoredRelations().filter(
          (r) => (r.parent_email.toLowerCase().trim() === email.toLowerCase().trim()) && r.is_verified
        );
        if (rels.length > 0) {
          setActiveParentIndex(rels.length >= 2 ? 2 : 1);
        }
      }
    } catch (e) {
      console.warn('Error refreshing parent relations:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const currentParent = MOCK_PARENT_PROFILES[activeParentIndex] || MOCK_PARENT_PROFILES[0];
  const parentChildren = currentParent?.children || [];

  // Selected Child State
  const [selectedChildId, setSelectedChildId] = useState<string>(parentChildren[0]?.id || '');

  React.useEffect(() => {
    if (parentChildren.length > 0 && !parentChildren.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(parentChildren[0].id);
    }
  }, [parentChildren, selectedChildId]);

  const selectedChild = parentChildren.find((c) => c.id === selectedChildId) || parentChildren[0] || null;

  // Active Main View Tab
  const [activeNav, setActiveNav] = useState<'TIMELINE' | 'ABSENCE' | 'RECONCILIATION' | 'PICKUPS'>('TIMELINE');

  // Students list state (to manage pickups)
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);

  // Add Pickup Modal State
  const [showAddPickupModal, setShowAddPickupModal] = useState(false);
  const [newPickupName, setNewPickupName] = useState('');
  const [newPickupRel, setNewPickupRel] = useState('Ông Nội');
  const [newPickupPhone, setNewPickupPhone] = useState('');

  // Handle Parent Submitting New Authorized Pickup (Defaults to PENDING)
  const handleParentAddPickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPickupName || !newPickupPhone || !selectedChild) return;

    const newPickup: AuthorizedPickup = {
      id: `p-${Date.now()}`,
      name: newPickupName,
      relationship: newPickupRel,
      phone: newPickupPhone,
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      approval_status: 'PENDING',
    };

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === selectedChild.id || s.full_name === selectedChild.full_name) {
          const existing = s.authorized_pickups || [];
          return { ...s, authorized_pickups: [newPickup, ...existing] };
        }
        return s;
      })
    );

    setShowAddPickupModal(false);
    setNewPickupName('');
    setNewPickupPhone('');
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

  // 4-Week Rotating Menu Logic for Today
  const currentWeekNum = getCurrentMenuWeek();
  const currentDayOfWeek = getDayOfWeekEnum();
  const todayMeals = INITIAL_4WEEK_MENU.filter(
    (m) => m.week_number === currentWeekNum && m.day_of_week === currentDayOfWeek
  );

  // Latest Health Record for Selected Child
  const latestHealth = selectedChild
    ? INITIAL_HEALTH_RECORDS.filter(
        (h) => h.student_id === selectedChild.id || h.student_name === selectedChild.full_name
      ).slice(-1)[0] || INITIAL_HEALTH_RECORDS[0]
    : INITIAL_HEALTH_RECORDS[0];

  const healthDisplay = getGrowthStatusDisplay(latestHealth.growth_status);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-emerald-100/50 text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-200/50 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-slate-800 text-center ring-1 ring-emerald-900/5">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
            <Heart className="w-8 h-8 fill-emerald-100 text-white" />
          </div>
          
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sổ Liên Lạc Điện Tử</h1>
          <p className="text-emerald-700 font-semibold text-xs mt-1 mb-6">Trường Mầm Non Sương Mai</p>

          <button
            onClick={handleInPlaceGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold py-3.5 px-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm mb-4"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isLoggingIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
          </button>

          <p className="text-xs text-slate-400 leading-relaxed">Dành cho Phụ huynh học sinh trường Mầm Non Sương Mai.</p>
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

          <button
            onClick={handleRefreshParentRelations}
            disabled={refreshing}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-pill transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>[ 🔄 Kiểm tra lại ]</span>
          </button>

          {/* QC Mode Selector Bar */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-500">
            <span className="font-semibold block mb-1">Chế độ kiểm thử (QC Selector):</span>
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => setActiveParentIndex(0)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  activeParentIndex === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                P0 (Chưa gán bé)
              </button>
              <button
                onClick={() => setActiveParentIndex(1)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  activeParentIndex === 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                P1 (1 bé)
              </button>
              <button
                onClick={() => setActiveParentIndex(2)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  activeParentIndex === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                P2 (2 bé)
              </button>
            </div>
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
      {/* Test Scenario Switcher Bar (For QC Verification of TC-AUTH-01 vs TC-AUTH-02 vs P0) */}
      <div className="p-2 bg-slate-800 text-white text-[11px] flex items-center justify-between">
        <span className="font-semibold text-slate-300">QC Test Account Mode:</span>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveParentIndex(0)}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              activeParentIndex === 0 ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            P0 (0 bé)
          </button>
          <button
            onClick={() => {
              setActiveParentIndex(1);
              setSelectedChildId(MOCK_PARENT_PROFILES[1].children[0].id);
            }}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              activeParentIndex === 1 ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            P1 (1 bé)
          </button>
          <button
            onClick={() => {
              setActiveParentIndex(2);
              setSelectedChildId(MOCK_PARENT_PROFILES[2].children[0].id);
            }}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              activeParentIndex === 2 ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            P2 (2 bé)
          </button>
        </div>
      </div>

      {/* Mobile Top Header */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-sky-700 rounded-pill text-white hover:bg-sky-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">{t('parent.app_title')}</h1>
            <p className="text-xs text-sky-100 font-semibold">{t('common.school_name')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
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
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> {t('parent.checked_in_msg')} {selectedChild.checked_in_time}
          </p>
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
          {/* 1. KHỐI TRẠNG THÁI & DÒNG THỜI GIAN TRONG NGÀY (DAILY TIMELINE - ƯU TIÊN HÀNG ĐẦU) */}
          <div className="bg-white border border-slate-200 rounded-convent p-4 space-y-4 shadow-sm text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600" />
                <span>{t('parent.timeline_title')}</span>
              </h3>
            </div>

            <div className="space-y-4 relative pl-5 border-l-2 border-slate-200 text-xs">
              {/* Event 1: Điểm danh đến lớp */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center">
                  <Check className="w-2 h-2 text-white stroke-[3]" />
                </div>
                <span className="font-mono text-[10px] text-slate-400 font-bold block">{selectedChild.checked_in_time}</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{t('parent.checked_in_msg')} {selectedChild.checked_in_time}</h4>
                <p className="text-slate-600 mt-0.5">{selectedChild.teacher_name}</p>
              </div>

              {/* Event 2: Dặn thuốc / Chăm sóc */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-sky-600 border-2 border-white flex items-center justify-center">
                  <Heart className="w-2 h-2 text-white fill-white" />
                </div>
                <span className="font-mono text-[10px] text-sky-600 font-bold block">11:35</span>
                <h4 className="font-bold text-sky-900 text-sm mt-0.5">{t('teacher.administer_done')}</h4>
                <p className="text-slate-600 mt-0.5">{selectedChild.teacher_name} • Siro Astex (5ml).</p>
              </div>

              {/* Event 3: Bữa ăn trưa */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center" />
                <span className="font-mono text-[10px] text-amber-600 font-bold block">12:00</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">Bữa Ăn Trưa</h4>
                <p className="text-slate-600 mt-0.5">Ăn hết suất (100%)</p>
              </div>

              {/* Event 4: Giờ ngủ trưa */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-cyan-600 border-2 border-white flex items-center justify-center" />
                <span className="font-mono text-[10px] text-cyan-600 font-bold block">14:00</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">Giờ Ngủ Trưa</h4>
                <p className="text-slate-600 mt-0.5">Nghỉ trưa: 12:15 – 14:00</p>
              </div>
            </div>
          </div>

          {/* 1.5. KHỐI THƯ NGỎ DỰ ÁN HỌC TẬP STEAM (PBL ANNOUNCEMENT FOR PARENTS) */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-white to-teal-50 border border-emerald-300 rounded-convent shadow-sm space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
                🚀 Thư ngỏ dự án học tập STEAM tuần này
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-pill border border-emerald-300">
                Đồng hành cùng bé
              </span>
            </div>

            <p className="text-slate-700 text-[11px] leading-relaxed">
              <strong className="text-emerald-900 block font-bold mb-0.5">Dự án: Chế tạo Xe Ô tô Đồ chơi Tải nặng</strong>
              Kính nhờ Phụ huynh cùng bé mang 2-3 vỏ hộp sữa rỗng & nắp chai nhựa sạch đến lớp để cùng các bạn thực hành chế tạo nhé!
            </p>
          </div>

          {/* 2. KHỐI THỰC ĐƠN HÔM NAY (NẰM NGAY BÊN DƯỚI TIMELINE) */}
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

            <div className="space-y-2 text-xs">
              {todayMeals.slice(0, 4).map((meal) => {
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
          </div>

          {/* 3. KHỐI THEO DÕI SỨC KHỎE (GROWTH TRACKER - NẰM DƯỚI THỰC ĐƠN) */}
          <Link
            href="/parent/health"
            className="block p-3.5 bg-gradient-to-r from-emerald-50 via-white to-teal-50 border border-emerald-200 rounded-convent shadow-sm hover:shadow-md transition-all text-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Theo dõi sức khỏe (Quý 3)</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                Chi tiết <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-semibold text-slate-900 font-mono text-sm">
                {latestHealth.weight_kg} kg • {latestHealth.height_cm} cm
              </span>
              <span className={`px-2.5 py-0.5 rounded-pill text-[10px] font-bold border ${healthDisplay.bgClass} ${healthDisplay.textClass}`}>
                {healthDisplay.text}
              </span>
            </div>
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
      {activeNav === 'PICKUPS' && (() => {
        const currentStudentObj = students.find((s) => s.id === selectedChild.id || s.full_name === selectedChild.full_name);
        const pickups = currentStudentObj?.authorized_pickups || [
          {
            id: 'p-1',
            name: 'Nguyễn Thị Hoa',
            relationship: 'Bà Ngoại',
            phone: '0913221100',
            avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
            approval_status: 'APPROVED',
          },
        ];

        return (
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-convent p-4 space-y-4 shadow-sm text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Danh Sách Người Đón Được Ủy Quyền</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Xác thực ảnh chân dung người thân đón trẻ</p>
                </div>

                <button
                  onClick={() => setShowAddPickupModal(true)}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-2 rounded-pill shadow transition-all active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Đăng Ký Đón</span>
                </button>
              </div>

              {/* Pickups List */}
              <div className="space-y-3">
                {pickups.map((pickup) => (
                  <div key={pickup.id} className="p-3.5 border rounded-xl flex items-center justify-between gap-3 text-xs bg-emerald-50/30 border-emerald-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={pickup.avatar_url}
                        alt={pickup.name}
                        className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 bg-white text-slate-800 font-bold text-[10px] rounded-pill border border-slate-200">
                            {pickup.relationship}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-pill border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" /> Đã Xác Thực
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{pickup.name}</h4>
                        <span className="text-slate-500 font-mono text-[11px]">SĐT: {pickup.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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
    </div>
  );
}
