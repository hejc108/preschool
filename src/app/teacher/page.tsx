'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, HeartPulse, Utensils, Lock, 
  ChevronLeft, Plus, Sparkles, Check, AlertCircle, LogOut, 
  UserCheck, ShieldAlert, Phone, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { 
  INITIAL_STUDENTS, 
  INITIAL_MEDICATIONS, 
  INITIAL_ABSENCE_REQUESTS, 
  INITIAL_MEAL_EXCEPTIONS 
} from '@/lib/supabase/client';
import { MedicationRequest, MealException, AbsenceRequest } from '@/lib/types/schema';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { fetchLiveProfilesFromSupabase, getStoredProfiles } from '@/lib/utils/approvalHelper';

export default function TeacherPwaPage() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'MEDICATION' | 'MEALS' | 'CHECKOUT'>('ATTENDANCE');

  // Teacher class assignment state (T1 = assigned, T0 = unassigned empty state)
  const [isClassAssigned, setIsClassAssigned] = useState<boolean>(true);
  const [assignedClassName, setAssignedClassName] = useState<string>('Mầm 1 (Rose)');
  const [refreshingClass, setRefreshingClass] = useState<boolean>(false);
  const [teacherEmail, setTeacherEmail] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
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
        setTeacherEmail(emailFound);
        const profiles = getStoredProfiles();
        const profile = profiles.find((p) => p.email.toLowerCase().trim() === emailFound.toLowerCase().trim());
        if (profile && profile.role === 'TEACHER') {
          if (!profile.assigned_class_id && !profile.assigned_class_name) {
            setIsClassAssigned(false);
          } else {
            setIsClassAssigned(true);
            setAssignedClassName(profile.assigned_class_name || 'Mầm 1 (Rose)');
          }
        }
      }
    }
  }, []);

  const handleRefreshClassAssignment = async () => {
    setRefreshingClass(true);
    try {
      const profiles = await fetchLiveProfilesFromSupabase();
      if (teacherEmail) {
        const profile = profiles.find((p) => p.email.toLowerCase().trim() === teacherEmail.toLowerCase().trim());
        if (profile) {
          if (profile.assigned_class_id || profile.assigned_class_name) {
            setIsClassAssigned(true);
            setAssignedClassName(profile.assigned_class_name || 'Mầm 1 (Rose)');
          }
        }
      }
    } catch (e) {
      console.warn('Error checking teacher class assignment:', e);
    } finally {
      setTimeout(() => setRefreshingClass(false), 500);
    }
  };

  // Attendance State
  const [students, setStudents] = useState(
    INITIAL_STUDENTS.map((s) => ({
      ...s,
      attendance: 'PRESENT' as 'PRESENT' | 'PRESENT_LATE' | 'ABSENT',
      checkedOut: false,
      checkoutReason: '',
    }))
  );
  const [isKitchenLocked, setIsKitchenLocked] = useState(false);
  const [absences, setAbsences] = useState<AbsenceRequest[]>(INITIAL_ABSENCE_REQUESTS);

  // Medication State
  const [medications, setMedications] = useState<MedicationRequest[]>(INITIAL_MEDICATIONS);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMedStudentId, setNewMedStudentId] = useState(INITIAL_STUDENTS[0].id);
  const [newMedSlot, setNewMedSlot] = useState<'SLOT_1130' | 'SLOT_1430'>('SLOT_1130');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedNotes, setNewMedNotes] = useState('');

  // Meal Exceptions State
  const [mealExceptions, setMealExceptions] = useState<MealException[]>(INITIAL_MEAL_EXCEPTIONS);
  const [selectedStudentForMeal, setSelectedStudentForMeal] = useState(INITIAL_STUDENTS[0].id);
  const [selectedIntakeLevel, setSelectedIntakeLevel] = useState<'HALF' | 'REFUSED'>('HALF');
  const [selectedTags, setSelectedTags] = useState<string[]>(['#Biếng_ăn']);

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

          {/* QC Mode Selector Bar */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-500">
            <span className="font-semibold block mb-1">Chế độ kiểm thử (QC Selector):</span>
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => setIsClassAssigned(false)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  !isClassAssigned ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                T0 (Chưa gán lớp)
              </button>
              <button
                onClick={() => setIsClassAssigned(true)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  isClassAssigned ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                T1 (Đã gán lớp Mầm 1)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ACTIONS & HANDLERS ---

  const handleSelectAllPresent = () => {
    if (isKitchenLocked) return;
    setStudents((prev) =>
      prev.map((s) => {
        const hasAbsence = absences.some((a) => a.student_id === s.id && a.status === 'SUBMITTED_VALID');
        return {
          ...s,
          attendance: hasAbsence ? 'ABSENT' : 'PRESENT',
        };
      })
    );
  };

  const handleToggleAttendance = (id: string, status: 'PRESENT' | 'PRESENT_LATE' | 'ABSENT') => {
    if (isKitchenLocked) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attendance: status } : s))
    );
  };

  const handleAcknowledgeAbsence = (absenceId: string) => {
    setAbsences((prev) =>
      prev.map((a) => (a.id === absenceId ? { ...a, acknowledged_by_teacher: true } : a))
    );
  };

  const handleDispatchToKitchen = () => {
    setIsKitchenLocked(true);
    const presentCount = students.filter((s) => s.attendance === 'PRESENT' || s.attendance === 'PRESENT_LATE').length;
    alert(`⚡ ${t('teacher.dispatched_done')}\n\n• ${t('common.child')}: ${presentCount}/${students.length}`);
  };

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    const student = INITIAL_STUDENTS.find((s) => s.id === newMedStudentId);
    const newMed: MedicationRequest = {
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
    setMedications([newMed, ...medications]);
    setShowAddMedModal(false);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedNotes('');
  };

  const handleAdministerMed = (medId: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, status: 'ADMINISTERED' } : m))
    );
  };

  const handleSaveMealException = (e: React.FormEvent) => {
    e.preventDefault();
    const student = INITIAL_STUDENTS.find((s) => s.id === selectedStudentForMeal);
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
    alert(`${t('teacher.btn_save_meal_exception')}: ${student?.full_name}`);
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleMassCheckout = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, checkedOut: true })));
    alert(`✅ ${t('teacher.checkout_done')}`);
  };

  const handleSaveLateCheckout = () => {
    if (!lateStudentId) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === lateStudentId ? { ...s, checkedOut: true, checkoutReason: lateReason } : s
      )
    );
    setShowLateCheckoutModal(false);
    setLateStudentId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans relative pb-20">
      {/* Mobile Top Header - Pastel Sky Blue */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-sky-700 rounded-pill text-white hover:bg-sky-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">{t('teacher.app_title')}</h1>
            <p className="text-xs text-sky-100 font-semibold">{t('teacher.class_info')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
        </div>
      </header>

      {/* 4 Main Mobile Navigation Tabs */}
      <div className="grid grid-cols-4 bg-white border-b border-slate-200 text-[11px] font-bold text-center">
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 ${
            activeTab === 'ATTENDANCE' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('teacher.tab_attendance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('MEDICATION')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 relative ${
            activeTab === 'MEDICATION' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>{t('teacher.tab_medication')}</span>
          {medications.filter((m) => m.status === 'PENDING').length > 0 && (
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('MEALS')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 ${
            activeTab === 'MEALS' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>{t('teacher.tab_meals')}</span>
        </button>

        <button
          onClick={() => setActiveTab('CHECKOUT')}
          className={`py-3 transition-all border-b-2 flex flex-col items-center gap-1 ${
            activeTab === 'CHECKOUT' ? 'border-sky-600 text-sky-600 bg-sky-50 font-extrabold' : 'border-transparent text-slate-400'
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span>{t('teacher.tab_checkout')}</span>
        </button>
      </div>

      {/* --- TAB 1: MORNING ATTENDANCE --- */}
      {activeTab === 'ATTENDANCE' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Quick Action Bar */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleSelectAllPresent}
              disabled={isKitchenLocked}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-pill text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('teacher.btn_select_all')}</span>
            </button>
          </div>

          {/* Approved Absence Notices Card */}
          {absences.map((abs) => (
            <div key={abs.id} className="p-3.5 bg-amber-50 border border-amber-200 rounded-convent text-xs space-y-2 text-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-800 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  {t('teacher.absence_notice')}
                </span>
                <span className="text-[10px] font-mono text-slate-400">&lt;08:30 AM</span>
              </div>
              <p className="text-slate-800">
                {t('common.parent_name')}: <strong className="text-slate-900">{abs.student_name}</strong>: <em>&quot;{abs.reason}&quot;</em>.
              </p>

              {abs.acknowledged_by_teacher ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                  <Check className="w-3.5 h-3.5" /> {t('teacher.ack_done')}
                </span>
              ) : (
                <button
                  onClick={() => handleAcknowledgeAbsence(abs.id)}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-pill text-xs transition-colors shadow-sm"
                >
                  {t('teacher.ack_btn')}
                </button>
              )}
            </div>
          ))}

          {/* Student Roll Call List */}
          <div className="space-y-2.5">
            {students.map((student) => (
              <div key={student.id} className="p-3.5 bg-white border border-slate-200 rounded-convent space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
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
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{student.full_name}</h4>
                      <span className="text-xs text-slate-400 font-mono">{student.student_code}</span>
                    </div>
                  </div>

                  {student.allergies !== 'Không' && (
                    <span className="text-[10px] px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-pill font-bold">
                      ⚠️ {student.allergies}
                    </span>
                  )}
                </div>

                {/* 3-State Thumb Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => handleToggleAttendance(student.id, 'PRESENT')}
                    disabled={isKitchenLocked}
                    className={`py-2 rounded-pill text-xs font-bold transition-all ${
                      student.attendance === 'PRESENT'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {t('teacher.btn_present')}
                  </button>

                  <button
                    onClick={() => handleToggleAttendance(student.id, 'PRESENT_LATE')}
                    disabled={isKitchenLocked}
                    className={`py-2 rounded-pill text-xs font-bold transition-all ${
                      student.attendance === 'PRESENT_LATE'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {t('teacher.btn_late')}
                  </button>

                  <button
                    onClick={() => handleToggleAttendance(student.id, 'ABSENT')}
                    disabled={isKitchenLocked}
                    className={`py-2 rounded-pill text-xs font-bold transition-all ${
                      student.attendance === 'ABSENT'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {t('teacher.btn_absent')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Fixed Bottom Dispatch Button */}
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white/95 border-t border-slate-200 backdrop-blur-md z-30">
            <button
              onClick={handleDispatchToKitchen}
              disabled={isKitchenLocked}
              className={`w-full py-3.5 rounded-pill font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 transition-all ${
                isKitchenLocked
                  ? 'bg-slate-100 text-slate-400 border border-slate-200'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/30 active:scale-98'
              }`}
            >
              <Sparkles className="w-5 h-5 text-white" />
              <span>{isKitchenLocked ? t('teacher.dispatched_done') : t('teacher.btn_dispatch_kitchen')}</span>
            </button>
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
                  <div><strong className="text-slate-700">Tên thuốc:</strong> <span className="text-sky-700 font-bold">{med.medication_name}</span></div>
                  <div><strong className="text-slate-700">Liều lượng:</strong> {med.dosage}</div>
                  {med.instructions && <div className="text-slate-500">Lưu ý: {med.instructions}</div>}
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
                      {INITIAL_STUDENTS.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.student_code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Khung Giờ (*)</label>
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
                    <label className="block text-slate-700 font-semibold mb-1">Tên Loại Thuốc (*)</label>
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
                    <label className="block text-slate-700 font-semibold mb-1">Liều Lượng (*)</label>
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
                    <label className="block text-slate-700 font-semibold mb-1">Ghi Chú</label>
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
              <label className="block text-slate-700 font-semibold mb-1">Mức Độ Khẩu Phần (*)</label>
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
                      {tag}
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
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Danh Sách Ngoại Lệ</h4>
            {mealExceptions.map((ex) => (
              <div key={ex.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-slate-900 text-sm">{ex.student_name}</h5>
                    <span className="font-mono text-[10px] px-2.5 py-0.5 bg-sky-50 text-sky-800 font-bold rounded-pill border border-sky-200">
                      {ex.intake_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {ex.reason_tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-pill font-mono text-[10px]">
                        {tag}
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

          <div className="space-y-2.5">
            {students.map((student) => (
              <div key={student.id} className="p-3.5 bg-white border border-slate-200 rounded-convent flex items-center justify-between text-xs shadow-sm">
                <div className="flex items-center gap-3">
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
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{student.full_name}</h4>
                    <span className="text-slate-400 font-mono text-[11px]">{student.student_code}</span>
                    {student.checkoutReason && (
                      <div className="text-[11px] text-amber-700 font-semibold mt-0.5">⚠️ {student.checkoutReason}</div>
                    )}
                  </div>
                </div>

                {student.checkedOut ? (
                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-pill font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {t('teacher.checkout_done')}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setLateStudentId(student.id);
                      setShowLateCheckoutModal(true);
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-pill font-bold transition-all shadow active:scale-95 flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{t('teacher.checkout_late')}</span>
                  </button>
                )}
              </div>
            ))}
          </div>

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
                      <span>Đối Chiếu Chân Dung Người Đăng Ký Đón Bé</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      {currentLateStudent?.parents?.map((parent, idx) => (
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
                        ?.filter((pickup) => pickup.approval_status === 'APPROVED')
                        .map((pickup) => (
                          <div key={pickup.id} className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 col-span-2">
                            <img src={pickup.avatar_url} alt={pickup.name} className="w-9 h-9 rounded-full border-2 border-emerald-500 object-cover shrink-0" />
                            <div className="min-w-0 text-[11px]">
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[9px] rounded-pill border border-emerald-300 inline-block">
                                ✓ Ủyl quyền: {pickup.relationship} (Đã duyệt)
                              </span>
                              <span className="font-bold block text-slate-800 truncate">{pickup.name}</span>
                              <span className="text-slate-500 text-[10px] font-mono">SĐT: {pickup.phone}</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Pending Safety Notice */}
                    {currentLateStudent?.authorized_pickups?.some((p) => p.approval_status !== 'APPROVED') && (
                      <p className="text-[10px] text-amber-700 font-semibold italic bg-amber-50 p-2 rounded-lg border border-amber-200">
                        🔒 Hệ thống tự động ẩn người đón đang ở trạng thái Chờ Duyệt / Từ Chối để bảo vệ an toàn cho bé.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Lý Do Trả Muộn / Bàn Giao (*)</label>
                      <select
                        value={lateReason}
                        onChange={(e) => setLateReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                      >
                        <option value="Phụ huynh bận công việc đột xuất">1. Phụ huynh bận công việc đột xuất</option>
                        <option value="Kẹt xe giờ cao điểm">2. Kẹt xe giờ cao điểm</option>
                        <option value="Đón bé muộn do thời tiết mưa to">3. Đón bé muộn do thời tiết mưa to</option>
                        <option value="Người thân đón thay (Đã xác minh khuôn mặt)">4. Người thân đón thay (Đã xác minh khuôn mặt)</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSaveLateCheckout}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-pill shadow transition-all mt-2 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Xác Nhận Khuôn Mặt & Bàn Giao Trẻ</span>
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

