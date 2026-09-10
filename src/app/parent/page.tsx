'use client';

import React, { useState } from 'react';
import { 
  Heart, Calendar, Clock, CheckCircle2, ChevronLeft, Plus, 
  Shield, Sparkles, FileText, Phone, Check, UserCheck, AlertCircle, X
} from 'lucide-react';
import Link from 'next/link';
import { INITIAL_ABSENCE_REQUESTS, INITIAL_STUDENTS } from '@/lib/supabase/client';
import { AbsenceRequest, AuthorizedPickup, Student } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// Mock Children Profiles for Multi-Child Switcher
const MOCK_CHILDREN = [
  {
    id: 's1',
    full_name: 'Trần Gia Bảo',
    class_name: 'Mầm 1 (Rose)',
    teacher_name: 'Sơ Maria Tươi',
    student_code: 'SM-2026-001',
    allergies: 'Không có',
    avatar_initials: 'GB',
    attendance_status: 'PRESENT',
    checked_in_time: '07:45',
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
  },
];

export default function ParentPwaPage() {
  const { t, language } = useLanguage();

  // Multi-Child Switcher State
  const [selectedChildId, setSelectedChildId] = useState<string>(MOCK_CHILDREN[0].id);
  const selectedChild = MOCK_CHILDREN.find((c) => c.id === selectedChildId) || MOCK_CHILDREN[0];

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
        if (s.id === selectedChild.id) {
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
  const [simulateLateSubmission, setSimulateLateSubmission] = useState(false); // Test toggle for cutoff

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-24">
      {/* Mobile Top Header - Pastel Sky Blue */}
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

      {/* 1. MULTI-CHILD PROFILE SWITCHER */}
      <div className="p-3 bg-white border-b border-slate-200">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 px-1">{t('parent.select_child')}</div>
        <div className="grid grid-cols-2 gap-2">
          {MOCK_CHILDREN.map((child) => {
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isSelected ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
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

      {/* Child Banner Summary */}
      <div className="p-4 bg-gradient-to-r from-sky-50 via-white to-cyan-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <span className="text-xs text-sky-700 font-bold block">{t('parent.today_status')}</span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">{selectedChild.full_name}</h2>
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

      {/* 4 Main Parent Navigation Tabs */}
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
          <span>Người Đón</span>
        </button>
      </div>

      {/* --- SECTION 2: CARE TIMELINE FEED --- */}
      {activeNav === 'TIMELINE' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-convent p-4 space-y-4 shadow-sm text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600" />
                <span>{t('parent.timeline_title')}</span>
              </h3>
            </div>

            <div className="space-y-4 relative pl-5 border-l-2 border-slate-200 text-xs">
              {/* Event 1 */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center">
                  <Check className="w-2 h-2 text-white stroke-[3]" />
                </div>
                <span className="font-mono text-[10px] text-slate-400 font-bold block">{selectedChild.checked_in_time}</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{t('parent.checked_in_msg')} {selectedChild.checked_in_time}</h4>
                <p className="text-slate-600 mt-0.5">
                  {selectedChild.teacher_name}
                </p>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-sky-600 border-2 border-white flex items-center justify-center">
                  <Heart className="w-2 h-2 text-white fill-white" />
                </div>
                <span className="font-mono text-[10px] text-sky-600 font-bold block">11:35</span>
                <h4 className="font-bold text-sky-900 text-sm mt-0.5">{t('teacher.administer_done')}</h4>
                <p className="text-slate-600 mt-0.5">
                  {selectedChild.teacher_name} • Siro Astex (5ml).
                </p>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center" />
                <span className="font-mono text-[10px] text-amber-600 font-bold block">12:00</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{language === 'vi' ? 'Bữa Ăn Trưa' : 'Lunch'}</h4>
                <p className="text-slate-600 mt-0.5">
                  {language === 'vi' ? 'Ăn hết suất (100%)' : 'Finished meal (100%)'}
                </p>
              </div>

              {/* Event 4 */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0 w-3.5 h-3.5 rounded-full bg-cyan-600 border-2 border-white flex items-center justify-center" />
                <span className="font-mono text-[10px] text-cyan-600 font-bold block">14:00</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{language === 'vi' ? 'Giờ Ngủ Trưa' : 'Nap Time'}</h4>
                <p className="text-slate-600 mt-0.5">
                  {language === 'vi' ? 'Nghỉ trưa: 12:15 – 14:00' : 'Nap time: 12:15 – 14:00'}
                </p>
              </div>
            </div>
          </div>
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
                ...
              </div>
            ) : (
              childAbsences.map((req) => (
                <div key={req.id} className="p-4 bg-white border border-slate-200 rounded-convent space-y-2.5 shadow-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      📅 {req.start_date} {req.start_date !== req.end_date && `➔ ${req.end_date}`}
                    </span>

                    {/* Auto-Labeling Badges */}
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

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                    <span><code className="font-mono text-slate-700">{req.id}</code></span>
                    <span>{new Date(req.submitted_at).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- SECTION 4: TRANSPARENT MEAL STATEMENT (ZERO-FINANCE) --- */}
      {activeNav === 'RECONCILIATION' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Strict Non-Monetary Disclaimer */}
          <div className="p-4 bg-white border border-slate-200 rounded-convent space-y-3 shadow-sm text-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-sky-900 text-base">{t('parent.recon_title')}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('parent.recon_disclaimer')}
            </p>
          </div>

          {/* Attendance & Absence Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-convent text-center shadow-sm">
              <span className="text-xs text-slate-400 font-medium block">{t('parent.actual_days')}</span>
              <span className="text-3xl font-extrabold text-emerald-600 font-mono mt-1 block">18</span>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-convent text-center shadow-sm">
              <span className="text-xs text-slate-400 font-medium block">{t('parent.credited_days')}</span>
              <span className="text-3xl font-extrabold text-sky-600 font-mono mt-1 block">2</span>
            </div>
          </div>

          {/* Credited Dates List */}
          <div className="p-4 bg-white border border-slate-200 rounded-convent space-y-3 shadow-sm text-slate-800">
            <h4 className="font-bold text-sky-900 text-xs uppercase tracking-wider">{t('parent.credited_list_title')}</h4>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">02/09/2026</span>
                  <span className="text-[11px] text-slate-600">Trước 08:30 AM (Nghỉ phép hợp lệ)</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-pill font-bold">{t('parent.refund_badge')}</span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">03/09/2026</span>
                  <span className="text-[11px] text-slate-600">Trước 08:30 AM (Nghỉ phép hợp lệ)</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-pill font-bold">{t('parent.refund_badge')}</span>
              </div>
            </div>
          </div>

          {/* Solemn Confirmation Note from Mother Superior */}
          <div className="p-5 bg-sky-50 border border-sky-200 rounded-convent text-center space-y-2 shadow-sm text-slate-800">
            <Sparkles className="w-6 h-6 text-sky-600 mx-auto" />
            <h4 className="font-bold text-sky-900 text-sm">{t('parent.board_confirmation_title')}</h4>
            <p className="text-xs text-slate-700 italic leading-relaxed px-2">
              {t('parent.board_confirmation_text')}
            </p>
            <span className="text-[11px] text-sky-800 font-semibold block pt-1">{t('parent.mother_superior_signature')}</span>
          </div>
        </div>
      )}

      {/* --- 5. FIXED EMERGENCY HOTLINE BUTTON --- */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white/95 border-t border-slate-200 backdrop-blur-md z-30">
        <a
          href="tel:0909123456"
          className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-pill shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <Phone className="w-4 h-4 fill-white" />
          <span>{t('parent.btn_hotline')}</span>
        </a>
      </div>

      {/* Modal Smart Absence Request Form */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent max-w-sm w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>{t('parent.modal_absence_title')}</span>
              </h3>
              <button onClick={() => setShowAbsenceModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <form onSubmit={handleSubmitAbsence} className="space-y-3.5">
              {/* Date Range Picker */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">From (*)</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">To (*)</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              {/* Reason Quick Chips */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">{t('parent.reason_quick_chips')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {['🌡️ Nghỉ ốm / Sốt', '🏡 Việc gia đình', '✈️ Về quê thăm bà', '🩺 Khám sức khỏe'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedReasonTag(tag)}
                      className={`px-3 py-1.5 rounded-pill text-xs font-semibold transition-all ${
                        selectedReasonTag === tag
                          ? 'bg-sky-600 text-white border border-sky-500 shadow'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow-md transition-all mt-2"
              >
                {t('parent.btn_submit_absence')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SECTION 5: AUTHORIZED PICKUPS SYSTEM --- */}
      {activeNav === 'PICKUPS' && (() => {
        const currentStudentObj = students.find((s) => s.id === selectedChild.id || s.student_code === selectedChild.student_code);
        const pickups = currentStudentObj?.authorized_pickups || [];

        return (
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-convent p-4 space-y-4 shadow-sm text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Danh Sách Người Đưa Đón Được Ủy Quyền</span>
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

              {/* Notice Banner */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs flex items-start gap-2 text-sky-900">
                <Shield className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Vì lý do an toàn cho bé, ảnh chân dung người đón vừa đăng ký sẽ ở trạng thái <strong className="text-amber-700 font-bold">Chờ Duyệt</strong> và chỉ có hiệu lực bàn giao khi Ban Giám Hiệu xác thực.
                </p>
              </div>

              {/* Pickups List */}
              <div className="space-y-3">
                {pickups.map((pickup) => {
                  const isApproved = pickup.approval_status === 'APPROVED';
                  const isPending = pickup.approval_status === 'PENDING';
                  const isRejected = pickup.approval_status === 'REJECTED';

                  return (
                    <div
                      key={pickup.id}
                      className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm ${
                        isPending
                          ? 'bg-amber-50/50 border-amber-300'
                          : isApproved
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-rose-50/30 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={pickup.avatar_url}
                          alt={pickup.name}
                          className={`w-12 h-12 rounded-full border-2 object-cover shrink-0 ${
                            isPending ? 'border-amber-400' : isApproved ? 'border-emerald-500' : 'border-rose-400'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-2 py-0.5 bg-white text-slate-800 font-bold text-[10px] rounded-pill border border-slate-200">
                              {pickup.relationship}
                            </span>
                            {isApproved && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-pill border border-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" /> Đã Xác Thực
                              </span>
                            )}
                            {isPending && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-pill border border-amber-300 animate-pulse">
                                ⏳ Chờ Duyệt
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-pill border border-rose-300">
                                ✕ Từ Chối
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{pickup.name}</h4>
                          <span className="text-slate-500 font-mono text-[11px]">SĐT: {pickup.phone}</span>

                          {isPending && (
                            <p className="text-[10px] text-amber-700 italic mt-1">
                              * Đang chờ nhà trường xác nhận trước khi có hiệu lực đón trẻ
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* PARENT REGISTER NEW AUTHORIZED PICKUP MODAL */}
      {showAddPickupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent max-w-sm w-full p-5 space-y-4 text-xs shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-sky-600" />
                Đăng Ký Người Đón Mới Cho Bé
              </h3>
              <button onClick={() => setShowAddPickupModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <form onSubmit={handleParentAddPickup} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Họ và Tên Người Đón (*)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Bà Ngoại Nguyễn Thị Hoa"
                  value={newPickupName}
                  onChange={(e) => setNewPickupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Quan Hệ Nhân Thân (*)</label>
                <select
                  value={newPickupRel}
                  onChange={(e) => setNewPickupRel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                >
                  <option value="Ông Nội">Ông Nội</option>
                  <option value="Ông Ngoại">Ông Ngoại</option>
                  <option value="Bà Nội">Bà Nội</option>
                  <option value="Bà Ngoại">Bà Ngoại</option>
                  <option value="Chú Ruột">Chú Ruột</option>
                  <option value="Cậu Ruột">Cậu Ruột</option>
                  <option value="Cô Ruột">Cô Ruột</option>
                  <option value="Dì Ruột">Dì Ruột</option>
                  <option value="Giúp Việc Gia Đình">Giúp Việc Gia Đình</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Số Điện Thoại (*)</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g., 0913221100"
                  value={newPickupPhone}
                  onChange={(e) => setNewPickupPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>Sau khi gửi, ảnh chân dung sẽ mang trạng thái <strong>Chờ Duyệt</strong> cho đến khi Sơ/Admin kiểm tra và phê duyệt.</p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-pill shadow-md transition-all mt-1"
              >
                Gửi Đăng Ký Chờ Phê Duyệt
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

