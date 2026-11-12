'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  History,
  Loader2,
  Lock,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';
import { DocumentAuditLog, SchoolDocument } from '@/lib/types/schema';
import {
  DOCUMENT_AUDIT_ACTION_LABELS,
  DOCUMENT_STATUS_META,
  formatDocumentFileSize,
  getDocumentPreviewKind,
} from '@/lib/documents/validation';

export interface DocumentPreviewModalProps {
  document: SchoolDocument;
  initialTab?: 'preview' | 'details';
  onClose: () => void;
  onSelectDocumentById?: (docId: string) => void;
}

function formatDateVi(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateTimeVi(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
}

export function DocumentPreviewModal({
  document: initialDoc,
  initialTab,
  onClose,
  onSelectDocumentById,
}: DocumentPreviewModalProps) {
  const [detailDoc, setDetailDoc] = useState<SchoolDocument>(initialDoc);
  const previewKind = getDocumentPreviewKind(detailDoc);
  const canInlinePreview = previewKind === 'pdf' || previewKind === 'image';

  const [activeTab, setActiveTab] = useState<'preview' | 'details'>(
    initialTab === 'details' || !canInlinePreview ? 'details' : 'preview'
  );

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(canInlinePreview);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<DocumentAuditLog[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Sync tab when initialDoc changes
  useEffect(() => {
    setDetailDoc(initialDoc);
    const kind = getDocumentPreviewKind(initialDoc);
    const supportsInline = kind === 'pdf' || kind === 'image';
    setActiveTab(initialTab === 'details' || !supportsInline ? 'details' : 'preview');
  }, [initialDoc, initialTab]);

  // Load document details & audit logs
  useEffect(() => {
    let active = true;
    const loadDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await fetch(`/api/admin/documents/${initialDoc.id}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.success && json.document) {
          setDetailDoc(json.document as SchoolDocument);
          setAuditLogs(Array.isArray(json.audit_logs) ? (json.audit_logs as DocumentAuditLog[]) : []);
        }
      } catch {
        // Keep initialDoc fallback
      } finally {
        if (active) setLoadingDetails(false);
      }
    };

    void loadDetails();
    return () => {
      active = false;
    };
  }, [initialDoc.id]);

  // Load signed URL only when PDF or Image inline preview is applicable
  useEffect(() => {
    const kind = getDocumentPreviewKind(initialDoc);
    if (initialDoc.storage_type !== 'SUPABASE_STORAGE' || (kind !== 'pdf' && kind !== 'image')) {
      setSignedUrl(null);
      setLoadingPreview(false);
      setPreviewError(null);
      return;
    }

    let active = true;
    const loadSignedUrl = async () => {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await fetch(`/api/admin/documents/${initialDoc.id}/signed-url`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !json.success || !json.signed_url) {
          setPreviewError(
            json.message || json.error || `Không thể mở xem trước (${res.status}).`
          );
          return;
        }
        setSignedUrl(json.signed_url);
      } catch (err: any) {
        if (active) {
          setPreviewError(err?.message || 'Lỗi kết nối khi lấy liên kết xem trước.');
        }
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    void loadSignedUrl();
    return () => {
      active = false;
    };
  }, [initialDoc]);

  const handleDownload = async () => {
    if (detailDoc.storage_type === 'EXTERNAL_LINK') {
      if (detailDoc.external_url) {
        window.open(detailDoc.external_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/documents/${detailDoc.id}/signed-url?download=1`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.signed_url) {
        window.open(json.signed_url, '_blank', 'noopener,noreferrer');
      } else {
        setPreviewError(json.message || json.error || 'Không thể tải xuống tệp.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const statusMeta = DOCUMENT_STATUS_META[detailDoc.status];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-primary-700 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-[480px]" title={detailDoc.title}>
                  {detailDoc.title}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.badgeClass}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {detailDoc.document_number ? `Số hiệu: ${detailDoc.document_number} • ` : ''}
                {detailDoc.storage_type === 'EXTERNAL_LINK'
                  ? 'Liên kết Google Workspace / Ngoài'
                  : `${detailDoc.file_name || 'Tài liệu'} (${formatDocumentFileSize(detailDoc.file_size)}) • Liên kết bảo mật 60 phút`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {detailDoc.storage_type === 'EXTERNAL_LINK' && detailDoc.external_url ? (
              <a
                href={detailDoc.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-pill bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở liên kết</span>
              </a>
            ) : (
              <>
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-pill border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở tab mới</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-3.5 py-1.5 rounded-pill bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {downloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Tải về máy</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
              aria-label="Đóng hộp thoại"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subheader Tabs */}
        <div className="px-5 py-2 bg-white border-b border-slate-200 flex items-center gap-2">
          {canInlinePreview && (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-primary-50 text-primary-800 border border-rose-200'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trước tài liệu</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'bg-primary-50 text-primary-800 border border-rose-200'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>
              Chi tiết hiệu lực & Lịch sử duyệt
              {!loadingDetails ? ` (${auditLogs.length})` : ''}
            </span>
          </button>
        </div>

        {/* Body */}
        {activeTab === 'preview' && canInlinePreview ? (
          <div className="p-4 bg-slate-100/70 flex-1 overflow-auto flex items-center justify-center min-h-[55vh]">
            {loadingPreview ? (
              <div className="text-center space-y-2.5 py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary-700 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  Đang tạo liên kết bảo mật để xem trước tài liệu...
                </p>
              </div>
            ) : previewError ? (
              <div className="max-w-md bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">Không thể hiển thị tài liệu</h4>
                <p className="text-xs text-rose-700">{previewError}</p>
              </div>
            ) : signedUrl && previewKind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrl}
                alt={detailDoc.title}
                className="max-h-[72vh] max-w-full object-contain rounded-xl border border-slate-200 bg-white shadow-sm"
              />
            ) : signedUrl ? (
              <iframe
                src={signedUrl}
                title={detailDoc.title}
                className="w-full h-[72vh] rounded-xl border border-slate-200 bg-white shadow-sm"
              />
            ) : null}
          </div>
        ) : (
          <div className="p-5 md:p-6 bg-slate-50/70 flex-1 overflow-y-auto space-y-5 min-h-[50vh]">
            {/* Alerts for Rejection / Withdrawal / Supersede */}
            {detailDoc.rejection_reason && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Lý do từ chối / thu hồi văn bản:</span>
                </p>
                <p className="leading-relaxed whitespace-pre-line">{detailDoc.rejection_reason}</p>
              </div>
            )}

            {detailDoc.superseded_by_id && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-950 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-bold flex items-center gap-1.5 text-purple-800">
                    <GitBranch className="w-4 h-4 text-purple-700" />
                    <span>Văn bản này đã bị thay thế bởi:</span>
                  </p>
                  <p className="font-medium">
                    {detailDoc.superseded_by_number ? `[${detailDoc.superseded_by_number}] ` : ''}
                    {detailDoc.superseded_by_title || detailDoc.superseded_by_id}
                  </p>
                </div>
                {onSelectDocumentById && (
                  <button
                    type="button"
                    onClick={() => onSelectDocumentById(detailDoc.superseded_by_id!)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-purple-800 hover:bg-purple-100 font-semibold transition-colors cursor-pointer"
                  >
                    Xem văn bản thay thế
                  </button>
                )}
              </div>
            )}

            {/* Metadata Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Thông tin hành chính & hiệu lực
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Trạng thái SRS</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Phạm vi bảo mật</span>
                  {detailDoc.visibility_scope === 'SUPER_ADMIN_ONLY' ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                      <Lock className="w-3.5 h-3.5" /> Chỉ Super Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <Shield className="w-3.5 h-3.5" /> Ban giám hiệu
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Danh mục</span>
                  <span className="font-semibold text-slate-800">
                    {detailDoc.category?.name || 'Chưa phân loại'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Số hiệu văn bản</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {detailDoc.document_number || 'Chưa cấp số'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Ngày ban hành</span>
                  <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDateVi(detailDoc.issued_date)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Ngày có hiệu lực</span>
                  <span className="font-semibold text-slate-800">
                    {detailDoc.effective_date ? formatDateVi(detailDoc.effective_date) : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Ngày hết hạn</span>
                  {detailDoc.expiration_date ? (
                    <span className="font-semibold text-slate-800">
                      {formatDateVi(detailDoc.expiration_date)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Dài hạn
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Người tạo / tải lên</span>
                  <span className="font-semibold text-slate-800">
                    {detailDoc.uploader_name || 'Quản trị viên'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Phê duyệt bởi</span>
                  <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                    {detailDoc.approver_name ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {detailDoc.approver_name}
                          {detailDoc.approved_at ? ` (${formatDateTimeVi(detailDoc.approved_at)})` : ''}
                        </span>
                      </>
                    ) : (
                      'Chưa phê duyệt'
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Sao lưu Google Drive</span>
                  {detailDoc.drive_sync_status === 'SYNCED' && detailDoc.drive_web_view_link ? (
                    <a
                      href={detailDoc.drive_web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Đã sao lưu (Mở Drive)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-slate-600 font-medium">
                      {detailDoc.drive_sync_status === 'FAILED'
                        ? `Lỗi: ${detailDoc.drive_sync_error || 'Không xác định'}`
                        : detailDoc.status === 'DRAFT' || detailDoc.status === 'SUBMITTED'
                        ? 'Chờ phê duyệt mới sao lưu'
                        : 'Chưa đồng bộ'}
                    </span>
                  )}
                </div>
              </div>

              {detailDoc.description && (
                <div className="pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 block mb-1">Ghi chú tóm tắt</span>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                    {detailDoc.description}
                  </p>
                </div>
              )}
            </div>

            {/* Immutable Audit Log Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-primary-700" />
                  <span>Nhật ký kiểm định vòng đời tài liệu (Audit Trail)</span>
                </h4>
                {loadingDetails && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-700" />
                )}
              </div>

              {loadingDetails && auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Đang tải lịch sử thay đổi...
                </p>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Chưa ghi nhận sự kiện kiểm định nào cho tài liệu này.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log) => {
                    const actionLabel =
                      DOCUMENT_AUDIT_ACTION_LABELS[log.action] || log.action;
                    const toMeta = DOCUMENT_STATUS_META[log.to_status];
                    const fromMeta = log.from_status
                      ? DOCUMENT_STATUS_META[log.from_status]
                      : null;

                    return (
                      <div key={log.id} className="py-3 first:pt-1 last:pb-1 space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900">{actionLabel}</span>
                            <div className="inline-flex items-center gap-1 text-[11px]">
                              {fromMeta && (
                                <>
                                  <span
                                    className={`px-2 py-0.2 rounded-full border font-medium ${fromMeta.badgeClass}`}
                                  >
                                    {fromMeta.shortLabel}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                </>
                              )}
                              {toMeta && (
                                <span
                                  className={`px-2 py-0.2 rounded-full border font-semibold ${toMeta.badgeClass}`}
                                >
                                  {toMeta.shortLabel}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {formatDateTimeVi(log.created_at)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                          <span>
                            Thực hiện bởi: <strong className="text-slate-800">{log.actor_name || 'Hệ thống'}</strong>
                          </span>
                          {log.metadata?.document_number && (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                              Số: {String(log.metadata.document_number)}
                            </span>
                          )}
                          {log.metadata?.superseded_by_number && (
                            <span className="font-mono bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 text-purple-800">
                              Văn bản mới: {String(log.metadata.superseded_by_number)}
                            </span>
                          )}
                        </div>

                        {log.reason && (
                          <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 mt-1">
                            {log.reason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
