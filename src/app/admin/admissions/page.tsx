'use client';

import React, { useState } from 'react';
import { UserPlus, FileText, QrCode, CheckCircle2, XCircle, Sparkles, Printer, Eye } from 'lucide-react';
import { INITIAL_ADMISSIONS, INITIAL_STUDENTS, INITIAL_CLASSES, INITIAL_KITCHEN_ORDERS } from '@/lib/supabase/client';
import { StudentApplication } from '@/lib/types/schema';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function AdmissionsPage() {
  const { t, language } = useLanguage();
  const [applications, setApplications] = useState<StudentApplication[]>(INITIAL_ADMISSIONS);
  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(applications[0]);
  const [showWalkinModal, setShowWalkinModal] = useState(false);

  // Form state for walk-in QR generator
  const [walkinParent, setWalkinParent] = useState('');
  const [walkinChild, setWalkinChild] = useState('');
  const [walkinDob, setWalkinDob] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [targetAppId, setTargetAppId] = useState<string | null>(null);
  const [assignedClass, setAssignedClass] = useState<string>('Mầm 1 (Rose)');

  const handleUpdateStatus = (id: string, newStatus: 'ACCEPTED' | 'REJECTED') => {
    if (newStatus === 'ACCEPTED') {
      setTargetAppId(id);
      setShowApproveModal(true);
      return;
    }

    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );
    if (selectedApp && selectedApp.id === id) {
      setSelectedApp({ ...selectedApp, status: newStatus });
    }
  };

  const handleConfirmAccept = () => {
    if (!targetAppId) return;

    // Update status in applications list
    setApplications((prev) =>
      prev.map((app) => (app.id === targetAppId ? { ...app, status: 'ACCEPTED' } : app))
    );
    if (selectedApp && selectedApp.id === targetAppId) {
      setSelectedApp({ ...selectedApp, status: 'ACCEPTED' });
    }

    const appToAccept = applications.find((a) => a.id === targetAppId) || selectedApp;
    if (appToAccept) {
      const classIdMap: Record<string, string> = {
        'Mầm 1 (Rose)': 'c1',
        'Chồi 2 (Lily)': 'c2',
        'Lá 3 (Sunflower)': 'c3',
      };
      const classId = classIdMap[assignedClass] || 'c1';

      // Insert new student record into INITIAL_STUDENTS singleton
      const newStudent = {
        id: `s-${Date.now()}`,
        student_code: `SM-2026-${Math.floor(100 + Math.random() * 900)}`,
        full_name: appToAccept.child_name,
        gender: 'NAM' as const,
        dob: appToAccept.child_dob || '2023-01-01',
        class_id: classId,
        class_name: assignedClass,
        allergies: 'Không',
        status: 'ACTIVE' as const,
        avatar_url: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150&auto=format&fit=crop&q=80',
        parents: [
          {
            name: appToAccept.parent_name,
            relationship: 'BỐ' as const,
            phone: appToAccept.phone,
            avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
          },
        ],
        authorized_pickups: [],
      };
      INITIAL_STUDENTS.unshift(newStudent);

      // Realtime headcount sync for INITIAL_CLASSES and INITIAL_KITCHEN_ORDERS
      const targetClass = INITIAL_CLASSES.find((c) => c.name === assignedClass);
      if (targetClass) {
        targetClass.total_students = (targetClass.total_students || 0) + 1;
      }
      const targetOrder = INITIAL_KITCHEN_ORDERS.find((k) => k.class_name === assignedClass);
      if (targetOrder) {
        targetOrder.base_enrollment += 1;
        targetOrder.final_meals_count += 1;
      }
    }

    setShowApproveModal(false);
    setTargetAppId(null);
  };

  const handleCreateWalkinSlip = (e: React.FormEvent) => {
    e.preventDefault();
    const newCode = `WALKIN-SM-${Math.floor(100 + Math.random() * 900)}`;
    const newApp: StudentApplication = {
      id: `adm-${Date.now()}`,
      application_code: newCode,
      parent_name: `${walkinParent} (Walk-in)`,
      child_name: walkinChild,
      child_dob: walkinDob,
      phone: walkinPhone,
      status: 'WALKIN_REGISTERED',
      walkin_qr_code: newCode,
      created_at: new Date().toISOString(),
    };
    setApplications([newApp, ...applications]);
    setSelectedApp(newApp);
    setShowWalkinModal(false);

    // Reset form
    setWalkinParent('');
    setWalkinChild('');
    setWalkinDob('');
    setWalkinPhone('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-convent flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-slate-800">
        <div>
          <h2 className="text-xl font-bold text-sky-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-sky-600" />
            <span>{t('admin.admissions.title')}</span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('admin.admissions.subtitle')}
          </p>
        </div>

        <button
          onClick={() => setShowWalkinModal(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2.5 rounded-pill transition-all shadow-sm text-sm active:scale-95"
        >
          <QrCode className="w-4 h-4" />
          <span>{t('admin.admissions.btn_onsite')}</span>
        </button>
      </div>

      {/* Main Grid: Application List + Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Application List (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-convent p-4 flex flex-col shadow-sm text-slate-800">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-sky-900 text-sm">{t('admin.admissions.list_title')}</h3>
            <span className="text-xs text-slate-400 font-mono font-bold">{applications.length}</span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
            {applications.map((app) => {
              const isSelected = selectedApp?.id === app.id;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-50 border-sky-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-sky-700">{app.application_code}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-pill font-bold ${
                        app.status === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : app.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : app.status === 'WALKIN_REGISTERED'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {app.status === 'ACCEPTED'
                        ? t('admin.admissions.status_approved')
                        : app.status === 'REJECTED'
                        ? t('admin.admissions.status_rejected')
                        : app.status === 'WALKIN_REGISTERED'
                        ? t('admin.admissions.status_walkin')
                        : t('admin.admissions.status_pending')}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{app.child_name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t('common.parent_name')}: {app.parent_name} • {t('common.phone')}: {app.phone}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Selected Application Detail & QR Slip Card (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-convent p-6 flex flex-col justify-between shadow-sm text-slate-800">
          {selectedApp ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                      {selectedApp.application_code}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(selectedApp.created_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">{selectedApp.child_name}</h3>
                  <p className="text-sm text-slate-500">
                    {t('common.dob')}: <strong className="text-slate-800">{selectedApp.child_dob}</strong>
                  </p>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'ACCEPTED')}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-pill text-xs transition-all shadow-sm active:scale-95"
                    title="Duyệt nhập học"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('admin.admissions.btn_accept')}</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedApp.id, 'REJECTED')}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-pill text-xs transition-all active:scale-95"
                    title="Từ chối đơn"
                  >
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span>{t('admin.admissions.btn_reject')}</span>
                  </button>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block font-medium">{t('common.parent_name')}</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">{selectedApp.parent_name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block font-medium">{t('common.phone')}</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">{selectedApp.phone}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block font-medium">Email</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">{selectedApp.email || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block font-medium">{t('common.status')}</span>
                  <span className="text-sm font-semibold text-sky-600 mt-0.5 block">
                    {selectedApp.pdf_url ? t('admin.admissions.pdf_attachment') : t('admin.admissions.status_walkin')}
                  </span>
                </div>
              </div>

              {/* PDF Preview / Printable Welcome QR Slip Card */}
              {selectedApp.walkin_qr_code || selectedApp.status === 'WALKIN_REGISTERED' ? (
                <div className="p-6 bg-sky-50 border-2 border-sky-300 rounded-convent text-center space-y-4 shadow-sm">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100 border border-sky-300 rounded-pill text-xs font-bold text-sky-900 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> {t('admin.admissions.title')}
                  </div>

                  <div className="flex justify-center my-2">
                    <div className="p-3 bg-white rounded-xl shadow-md border border-slate-200">
                      <QRCodeSVG value={selectedApp.walkin_qr_code || selectedApp.application_code} size={140} />
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-base font-bold text-sky-800 block">
                      {t('admin.admissions.code_label')} {selectedApp.walkin_qr_code || selectedApp.application_code}
                    </span>
                  </div>

                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-pill text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t('admin.admissions.btn_welcome_slip')}</span>
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-sky-600" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{t('admin.admissions.pdf_attachment')}</h4>
                      <p className="text-xs text-slate-500">don_xin_nhap_hoc_{selectedApp.application_code}.pdf</p>
                    </div>
                  </div>
                  <a
                    href={selectedApp.pdf_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3.5 py-2 rounded-pill text-xs transition-colors shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{t('admin.admissions.view_pdf')}</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-center py-12">...</div>
          )}
        </div>
      </div>

      {/* Modal Walk-in QR Welcome Slip Generator */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-base flex items-center gap-2">
                <QrCode className="w-5 h-5 text-sky-600" />
                <span>{t('admin.admissions.modal_title')}</span>
              </h3>
              <button onClick={() => setShowWalkinModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <form onSubmit={handleCreateWalkinSlip} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">{t('admin.admissions.child_name_label')}</label>
                <input
                  type="text"
                  required
                  value={walkinChild}
                  onChange={(e) => setWalkinChild(e.target.value)}
                  placeholder="e.g., Nguyễn Phúc An"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">{t('admin.admissions.dob_label')}</label>
                <input
                  type="date"
                  required
                  value={walkinDob}
                  onChange={(e) => setWalkinDob(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">{t('admin.admissions.parent_label')}</label>
                <input
                  type="text"
                  required
                  value={walkinParent}
                  onChange={(e) => setWalkinParent(e.target.value)}
                  placeholder="e.g., Nguyễn Thị Mai"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">{t('admin.admissions.phone_label')}</label>
                <input
                  type="tel"
                  required
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="e.g., 0988776655"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkinModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-pill font-medium border border-slate-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-pill font-semibold shadow-sm"
                >
                  {t('admin.admissions.issue_qr')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admission Approval & Class Assignment */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sky-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{t('admin.admissions.modal_approve_title')}</span>
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-800">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                Bé <strong>{applications.find((a) => a.id === targetAppId)?.child_name || selectedApp?.child_name}</strong> sẽ được tiếp nhận chính thức vào trường. Vui lòng phân lớp học:
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">{t('admin.admissions.prompt_assign_class')}</label>
                <select
                  value={assignedClass}
                  onChange={(e) => setAssignedClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
                >
                  <option value="Mầm 1 (Rose)">Mầm 1 (Rose)</option>
                  <option value="Chồi 2 (Lily)">Chồi 2 (Lily)</option>
                  <option value="Lá 3 (Sunflower)">Lá 3 (Sunflower)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-pill font-medium border border-slate-200 text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAccept}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-pill font-semibold shadow-sm text-xs"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

