'use client';

import React, { useState } from 'react';
import { 
  Heart, Calendar, Clock, CheckCircle2, ChevronLeft, Plus, 
  Shield, Sparkles, FileText, Phone, Check, UserCheck, AlertCircle, X,
  Utensils, Activity, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { INITIAL_ABSENCE_REQUESTS, INITIAL_STUDENTS } from '@/lib/supabase/client';
import { AbsenceRequest, AuthorizedPickup, Student } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getCurrentMenuWeek, getDayOfWeekEnum, INITIAL_4WEEK_MENU, checkDishAllergen } from '@/lib/utils/menuHelper';
import { INITIAL_HEALTH_RECORDS, getGrowthStatusDisplay } from '@/lib/utils/healthHelper';

// Demo Parent Profiles for Testing Data Isolation & Selector Logic
const MOCK_PARENT_PROFILES = [
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

export default function ParentPwaPage() {
  const { t, language } = useLanguage();

  // Test Mode Toggle for Parent P1 (1 child) vs P2 (2 children)
  const [activeParentIndex, setActiveParentIndex] = useState<number>(1); // Defaults to P2 for testing multi-child
  const currentParent = MOCK_PARENT_PROFILES[activeParentIndex];
  const parentChildren = currentParent.children;

  // Selected Child State
  const [selectedChildId, setSelectedChildId] = useState<string>(parentChildren[0].id);
  const selectedChild = parentChildren.find((c) => c.id === selectedChildId) || parentChildren[0];

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
    if (!newPickupName || !newPickupPhone) return;

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
  const childAbsences = absences.filter((a) => a.student_id === selectedChild.id || a.student_name === selectedChild.full_name);

  // 4-Week Rotating Menu Logic for Today
  const currentWeekNum = getCurrentMenuWeek();
  const currentDayOfWeek = getDayOfWeekEnum();
  const todayMeals = INITIAL_4WEEK_MENU.filter(
    (m) => m.week_number === currentWeekNum && m.day_of_week === currentDayOfWeek
  );

  // Latest Health Record for Selected Child
  const latestHealth = INITIAL_HEALTH_RECORDS.filter(
    (h) => h.student_id === selectedChild.id || h.student_name === selectedChild.full_name
  ).slice(-1)[0] || INITIAL_HEALTH_RECORDS[0];

  const healthDisplay = getGrowthStatusDisplay(latestHealth.growth_status);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-24">
      {/* Test Scenario Switcher Bar (For QC Verification of TC-AUTH-01 vs TC-AUTH-02) */}
      <div className="p-2 bg-slate-800 text-white text-[11px] flex items-center justify-between">
        <span className="font-semibold text-slate-300">QC Test Account Mode:</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setActiveParentIndex(0);
              setSelectedChildId(MOCK_PARENT_PROFILES[0].children[0].id);
            }}
            className={`px-2 py-0.5 rounded font-bold transition-all ${
              activeParentIndex === 0 ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            P1 (1 bé)
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
