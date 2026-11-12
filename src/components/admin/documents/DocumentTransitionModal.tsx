'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightCircle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck2,
  GitBranch,
  Hash,
  Loader2,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DocumentAuditLog,
  DocumentWorkflowAction,
  SchoolDocument,
} from '@/lib/types/schema';
import {
  COMMON_DOCUMENT_SYMBOLS,
  DOCUMENT_STATUS_META,
  extractDocumentYear,
  getDefaultDocumentSymbolForCategory,
  validateEffectiveAndExpirationDates,
} from '@/lib/documents/validation';

export interface DocumentTransitionModalProps {
  document: SchoolDocument;
  action: DocumentWorkflowAction;
  allDocuments: SchoolDocument[];
  onClose: () => void;
  onTransitioned: (
    doc: SchoolDocument,
    auditLogs: DocumentAuditLog[],
    message: string
  ) => void;
}

function getTodayVietnamClient(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

const ACTION_CONFIG: Record<
  DocumentWorkflowAction,
  {
    title: string;
    subtitle: string;
    submitLabel: string;
    buttonClass: string;
    headerIconBg: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  submit_for_approval: {
    title: 'Trình duyệt văn bản',
    subtitle: 'Chuyển bản nháp sang chờ Hiệu trưởng (Super Admin) xem xét phê duyệt',
    submitLabel: 'Xác nhận trình duyệt',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
    headerIconBg: 'bg-sky-50 border-sky-200 text-sky-700',
    Icon: Send,
  },
  approve: {
    title: 'Phê duyệt & Ban hành văn bản',
    subtitle: 'Cấp số hiệu chính thức, ấn định hiệu lực và tự động sao lưu Google Drive',
    submitLabel: 'Phê duyệt & Sao lưu Drive',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    headerIconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    Icon: FileCheck2,
  },
  reject: {
    title: 'Từ chối phê duyệt văn bản',
    subtitle: 'Trả văn bản về trạng thái Từ chối / Thu hồi (WITHDRAWN) kèm lý do',
    submitLabel: 'Xác nhận từ chối',
    buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    headerIconBg: 'bg-rose-50 border-rose-200 text-rose-700',
    Icon: Ban,
  },
  withdraw: {
    title: 'Thu hồi khẩn cấp văn bản',
    subtitle: 'Chấm dứt hiệu lực lưu hành khẩn cấp đối với văn bản đã ban hành',
    submitLabel: 'Xác nhận thu hồi',
    buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    headerIconBg: 'bg-rose-50 border-rose-200 text-rose-700',
    Icon: AlertTriangle,
  },
  supersede: {
    title: 'Đánh dấu văn bản bị thay thế',
    subtitle: 'Liên kết sang văn bản Đã phê duyệt mới hơn thay thế cho văn bản này',
    submitLabel: 'Xác nhận thay thế',
    buttonClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    headerIconBg: 'bg-purple-50 border-purple-200 text-purple-700',
    Icon: GitBranch,
  },
  expire: {
    title: 'Đánh dấu văn bản hết hiệu lực',
    subtitle: 'Chuyển văn bản sang trạng thái Hết hiệu lực (EXPIRED) và giữ nguyên lưu trữ',
    submitLabel: 'Chuyển hết hiệu lực',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    headerIconBg: 'bg-amber-50 border-amber-200 text-amber-700',
    Icon: Clock,
  },
};

export function DocumentTransitionModal({
  document: doc,
  action,
  allDocuments,
  onClose,
  onTransitioned,
}: DocumentTransitionModalProps) {
  const cfg = ACTION_CONFIG[action];
  const HeaderIcon = cfg.Icon;
  const defaultSymbol = useMemo(
    () => getDefaultDocumentSymbolForCategory(doc.category?.code),
    [doc.category?.code]
  );

  // Approve states
  const [numberMode, setNumberMode] = useState<'auto' | 'manual'>(
    doc.document_number ? 'manual' : 'auto'
  );
  const [numberSymbol, setNumberSymbol] = useState<string>(defaultSymbol);
  const [customSymbolMode, setCustomSymbolMode] = useState<boolean>(false);
  const [manualNumber, setManualNumber] = useState<string>(doc.document_number || '');
  const [previewAutoNumber, setPreviewAutoNumber] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  const [effectiveDate, setEffectiveDate] = useState<string>(
    doc.effective_date || doc.issued_date || getTodayVietnamClient()
  );
  const [expirationDate, setExpirationDate] = useState<string>(doc.expiration_date || '');

  // Reject / Withdraw / General reason states
  const [reason, setReason] = useState<string>('');

  // Supersede states
  const [replacementSearch, setReplacementSearch] = useState<string>('');
  const [supersededById, setSupersededById] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const symbolChoices = useMemo(() => {
    const list: string[] = [...COMMON_DOCUMENT_SYMBOLS];
    if (defaultSymbol && !list.includes(defaultSymbol)) {
      list.unshift(defaultSymbol);
    }
    return list;
  }, [defaultSymbol]);

  const approvedCandidates = useMemo(() => {
    const q = replacementSearch.trim().toLowerCase();
    return allDocuments.filter((candidate) => {
      if (candidate.status !== 'APPROVED' || candidate.id === doc.id) return false;
      if (!q) return true;
      const hay = `${candidate.document_number || ''} ${candidate.title} ${candidate.category?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allDocuments, doc.id, replacementSearch]);

  // Fetch live sequential preview when in approve + auto mode
  useEffect(() => {
    if (action !== 'approve' || numberMode !== 'auto') return;
    const cleanSymbol = numberSymbol.trim().toUpperCase() || defaultSymbol || 'CV-MNSM';
    const year = extractDocumentYear(effectiveDate || doc.issued_date || getTodayVietnamClient());

    let active = true;
    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams({
          year,
          symbol: cleanSymbol,
        });
        if (doc.category_id) params.set('category_id', doc.category_id);

        const res = await fetch(`/api/admin/documents/next-number?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (active && res.ok && json.success && json.next_number) {
          setPreviewAutoNumber(json.next_number);
        }
      } catch {
        // Non-fatal preview error
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    const timer = window.setTimeout(() => {
      void loadPreview();
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [action, numberMode, numberSymbol, effectiveDate, doc.issued_date, doc.category_id, defaultSymbol]);

  const handleSwitchToManualWithPreview = () => {
    if (!manualNumber.trim() && previewAutoNumber) {
      setManualNumber(previewAutoNumber);
    }
    setNumberMode('manual');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payload: Record<string, any> = { action };

    if (action === 'approve') {
      if (!effectiveDate.trim()) {
        setErrorMsg('Vui lòng chọn ngày có hiệu lực của văn bản.');
        return;
      }
      const dateCheck = validateEffectiveAndExpirationDates(
        effectiveDate.trim(),
        expirationDate.trim() || null
      );
      if (!dateCheck.ok) {
        setErrorMsg(dateCheck.error);
        return;
      }

      payload.effective_date = effectiveDate.trim();
      payload.expiration_date = expirationDate.trim() || null;

      if (numberMode === 'auto') {
        const sym = numberSymbol.trim().toUpperCase() || defaultSymbol || 'CV-MNSM';
        payload.auto_generate_number = true;
        payload.number_symbol = sym;
        payload.document_number = null;
      } else {
        payload.auto_generate_number = false;
        payload.document_number = manualNumber.trim() || null;
      }
    }

    if (action === 'reject' || action === 'withdraw') {
      if (!reason.trim()) {
        setErrorMsg(
          action === 'reject'
            ? 'Vui lòng nhập lý do từ chối phê duyệt văn bản.'
            : 'Vui lòng nhập lý do thu hồi khẩn cấp văn bản.'
        );
        return;
      }
      payload.reason = reason.trim();
    }

    if (action === 'supersede') {
      if (!supersededById) {
        setErrorMsg('Vui lòng chọn một văn bản Đã phê duyệt mới hơn để thay thế.');
        return;
      }
      payload.superseded_by_id = supersededById;
      if (reason.trim()) payload.reason = reason.trim();
    }

    if (action === 'expire' && reason.trim()) {
      payload.reason = reason.trim();
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success || !json.document) {
        setErrorMsg(
          json.message || json.error || `Không thể chuyển trạng thái (${res.status}).`
        );
        return;
      }

      const updatedDoc = json.document as SchoolDocument;
      const auditLogs = Array.isArray(json.audit_logs)
        ? (json.audit_logs as DocumentAuditLog[])
        : [];

      const successMessages: Record<DocumentWorkflowAction, string> = {
        submit_for_approval: `Đã trình duyệt "${updatedDoc.title}". Văn bản đang chờ Hiệu trưởng phê duyệt.`,
        approve: updatedDoc.document_number
          ? `Đã phê duyệt "${updatedDoc.title}" với số hiệu ${updatedDoc.document_number}.`
          : `Đã phê duyệt "${updatedDoc.title}".`,
        reject: `Đã từ chối phê duyệt "${updatedDoc.title}".`,
        withdraw: `Đã thu hồi khẩn cấp "${updatedDoc.title}".`,
        supersede: `Đã chuyển "${updatedDoc.title}" sang trạng thái Bị thay thế.`,
        expire: `Đã chuyển "${updatedDoc.title}" sang trạng thái Hết hiệu lực.`,
      };

      onTransitioned(updatedDoc, auditLogs, successMessages[action]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi kết nối khi thực hiện chuyển trạng thái.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatusMeta = DOCUMENT_STATUS_META[doc.status];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${cfg.headerIconBg}`}
            >
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">{cfg.title}</h2>
              <p className="text-xs text-slate-500 truncate">{cfg.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Document summary banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Văn bản đang xử lý
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${currentStatusMeta.badgeClass}`}
              >
                {currentStatusMeta.label}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 leading-snug">{doc.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span>{doc.category?.name || 'Chưa phân loại'}</span>
              <span>•</span>
              <span>Ban hành: {doc.issued_date}</span>
              {doc.document_number && (
                <>
                  <span>•</span>
                  <span className="font-mono font-semibold text-slate-800">
                    Số hiện tại: {doc.document_number}
                  </span>
                </>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Action-specific body */}
          {action === 'submit_for_approval' && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5">
                <ArrowRightCircle className="w-4 h-4 text-sky-700" />
                <span>Xác nhận gửi trình Hiệu trưởng duyệt</span>
              </div>
              <p>
                Sau khi chuyển sang <strong>Đã trình duyệt (SUBMITTED)</strong>, Quản trị trường sẽ không tự ý sửa thông tin văn bản được nữa để đảm bảo tính toàn vẹn trước khi Hiệu trưởng phê duyệt ban hành.
              </p>
            </div>
          )}

          {action === 'approve' && (
            <>
              {/* Document Number Section */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-primary-700" />
                    <span>Số hiệu văn bản khi phê duyệt</span>
                  </label>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setNumberMode('auto');
                        setErrorMsg(null);
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        numberMode === 'auto'
                          ? 'bg-white text-primary-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cấp số tự động
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchToManualWithPreview}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        numberMode === 'manual'
                          ? 'bg-white text-primary-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nhập / Sửa tay
                    </button>
                  </div>
                </div>

                {numberMode === 'auto' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Ký hiệu loại văn bản
                        </label>
                        {!customSymbolMode ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={symbolChoices.includes(numberSymbol) ? numberSymbol : '__CUSTOM__'}
                              onChange={(e) => {
                                if (e.target.value === '__CUSTOM__') {
                                  setCustomSymbolMode(true);
                                } else {
                                  setNumberSymbol(e.target.value);
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                            >
                              {symbolChoices.map((sym) => (
                                <option key={sym} value={sym}>
                                  {sym}
                                </option>
                              ))}
                              <option value="__CUSTOM__">+ Nhập ký hiệu khác...</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={numberSymbol}
                              onChange={(e) => setNumberSymbol(e.target.value.toUpperCase())}
                              placeholder="VD: QĐ-MNSM"
                              className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setCustomSymbolMode(false);
                                setNumberSymbol(defaultSymbol);
                              }}
                              className="px-2 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-semibold shrink-0"
                            >
                              Mặc định
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Số hiệu dự kiến cấp phát
                        </label>
                        <div className="flex items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2">
                          <span className="font-mono font-bold text-emerald-900 truncate">
                            {loadingPreview ? 'Đang tính số...' : previewAutoNumber || '...'}
                          </span>
                          <button
                            type="button"
                            onClick={handleSwitchToManualWithPreview}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:underline shrink-0 cursor-pointer"
                            title="Chuyển sang sửa tay số hiệu (dành cho Quyết định hoặc Công văn đến từ bên ngoài)"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa tay</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Hệ thống tự động cấp số tăng dần theo năm ({extractDocumentYear(effectiveDate || doc.issued_date)}). Với Công văn đến từ cơ quan ngoài hoặc Quyết định cần số riêng, nhấn <strong>Sửa tay</strong> để nhập trực tiếp.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Số hiệu văn bản tùy chỉnh / Công văn đến
                    </label>
                    <input
                      type="text"
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value)}
                      placeholder={`VD: ${previewAutoNumber || `01/${extractDocumentYear(effectiveDate || doc.issued_date)}/${defaultSymbol}`} hoặc 125/CV-PGDĐT`}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500">
                      Hệ thống tự động kiểm tra không trùng số hiệu với các văn bản đang Đã phê duyệt khác (có thể bỏ trống nếu là biểu mẫu nội bộ).
                    </p>
                  </div>
                )}
              </div>

              {/* Effective & Expiration Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary-700" />
                    <span>Ngày có hiệu lực (*)</span>
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Ngày hết hiệu lực (tùy chọn)
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 leading-relaxed">
                <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Khi xác nhận, văn bản sẽ chính thức có hiệu lực (<strong>APPROVED</strong>) và được hệ thống <strong>tự động sao lưu lên Google Drive</strong> theo cấu trúc Năm / Danh mục.
                </span>
              </div>
            </>
          )}

          {(action === 'reject' || action === 'withdraw') && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  {action === 'reject'
                    ? 'Lý do từ chối phê duyệt (*)'
                    : 'Lý do thu hồi khẩn cấp (*)'}
                </label>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    action === 'reject'
                      ? 'Nêu rõ điểm cần chỉnh sửa về thể thức, số hiệu hoặc nội dung để người soạn thảo nắm được...'
                      : 'Nêu rõ lý do thu hồi văn bản (VD: ban hành văn bản đính chính, thay đổi chủ trương...)'
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                {action === 'withdraw'
                  ? 'Lưu ý bảo toàn đối chiếu: Văn bản sẽ chuyển sang Từ chối / Thu hồi (WITHDRAWN) và bị khóa chỉnh sửa; bản sao lưu Google Drive (nếu có) vẫn được giữ nguyên.'
                  : 'Văn bản sẽ được ghi nhận vào nhật ký kiểm định cùng lý do từ chối để phục vụ rà soát.'}
              </div>
            </div>
          )}

          {action === 'supersede' && (
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Chọn văn bản mới thay thế (phải ở trạng thái Đã phê duyệt) (*)
                </label>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={replacementSearch}
                    onChange={(e) => setReplacementSearch(e.target.value)}
                    placeholder="Tìm nhanh theo số hiệu hoặc tiêu đề văn bản mới..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                {approvedCandidates.length === 0 ? (
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-center space-y-1">
                    <p className="font-semibold">
                      Không tìm thấy văn bản Đã phê duyệt nào khác phù hợp
                    </p>
                    <p className="text-[11px]">
                      Vui lòng phê duyệt văn bản thay thế mới trước khi thực hiện thao tác Thay thế.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {approvedCandidates.map((cand) => {
                      const selected = supersededById === cand.id;
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => setSupersededById(cand.id)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-purple-50 text-purple-950'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-xs leading-snug line-clamp-2">
                              {cand.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                              {cand.document_number && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                                  {cand.document_number}
                                </span>
                              )}
                              <span>{cand.category?.name}</span>
                              <span>• Hiệu lực: {cand.effective_date || cand.issued_date}</span>
                            </div>
                          </div>
                          {selected && (
                            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Ghi chú bổ sung (tùy chọn)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Ban hành quy chế mới cập nhật theo thông tư..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {action === 'expire' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
                <p>
                  Văn bản sẽ được chuyển sang trạng thái <strong>Hết hiệu lực (EXPIRED)</strong>.
                  Số hiệu cũ (nếu có) không còn chiếm ràng buộc duy nhất, và tệp lưu trữ trên Google Drive vẫn được bảo toàn nguyên vẹn.
                </p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Ghi chú hết hiệu lực (tùy chọn)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Đã kết thúc năm học / hết thời hạn áp dụng"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-pill border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || (action === 'supersede' && approvedCandidates.length === 0)}
              className={`px-5 py-2 rounded-pill font-bold shadow-sm transition-all inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer ${cfg.buttonClass}`}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Đang xử lý...' : cfg.submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
