'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileEdit,
  FileSpreadsheet,
  FileText,
  FolderCog,
  FolderOpen,
  GitBranch,
  Globe,
  HardDriveUpload,
  History,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DocumentAuditLog,
  DocumentCategory,
  DocumentCreationMode,
  DocumentStatus,
  DocumentWorkflowAction,
  SchoolDocument,
  UserRole,
} from '@/lib/types/schema';
import { normalizeVietnameseSearch } from '@/lib/utils/textSearch';
import {
  DOCUMENT_STATUS_META,
  DOCUMENT_STATUS_ORDER,
  extractDocumentYear,
  formatDocumentFileSize,
  getDocumentPreviewKind,
} from '@/lib/documents/validation';
import { DocumentFormModal } from '@/components/admin/documents/DocumentFormModal';
import { DocumentPreviewModal } from '@/components/admin/documents/DocumentPreviewModal';
import { CategoryManagerModal } from '@/components/admin/documents/CategoryManagerModal';
import { DocumentTransitionModal } from '@/components/admin/documents/DocumentTransitionModal';

type ToastState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type ViewerState = {
  profile_id: string;
  active_role: UserRole;
  is_super_admin: boolean;
  full_name: string;
};

type PreviewModalState = {
  document: SchoolDocument;
  initialTab?: 'preview' | 'details';
} | null;

type TransitionModalState = {
  document: SchoolDocument;
  action: DocumentWorkflowAction;
} | null;

function formatIssuedDateVi(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getExternalHost(url?: string | null): string {
  if (!url) return 'Liên kết ngoài';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Liên kết ngoài';
  }
}

function isDocxDocument(doc: {
  creation_mode?: string | null;
  storage_type?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
}): boolean {
  if (doc.creation_mode === 'ONLINE_EDITOR') return true;
  if (doc.storage_type !== 'SUPABASE_STORAGE') return false;
  const name = (doc.file_name || doc.storage_path || '').toLowerCase();
  return (
    name.endsWith('.docx') ||
    doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function getDocumentKindVisual(doc: SchoolDocument) {
  if (doc.creation_mode === 'ONLINE_EDITOR') {
    return {
      icon: FileEdit,
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      label: 'Soạn trên Web',
    };
  }
  const kind = getDocumentPreviewKind(doc);
  if (kind === 'external') {
    return {
      icon: Globe,
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      label: 'Liên kết ngoài',
    };
  }
  if (kind === 'pdf') {
    return {
      icon: FileText,
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'PDF',
    };
  }
  if (kind === 'image') {
    return {
      icon: ImageIcon,
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Hình ảnh',
    };
  }
  const lowerName = (doc.file_name || '').toLowerCase();
  const isSheet = lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx');
  const isDocx = isDocxDocument(doc);
  return {
    icon: isSheet ? FileSpreadsheet : FileText,
    badgeBg: isSheet
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : isDocx
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-700 border-slate-200',
    label: isSheet ? 'Excel' : isDocx ? 'Word (.docx)' : 'Tệp đính kèm',
  };
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters — mặc định ALL để hiển thị cả tài liệu nháp / trình duyệt / đã duyệt
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL');

  // Modals & row actions
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingDocument, setEditingDocument] = useState<SchoolDocument | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);
  const [transitionModal, setTransitionModal] = useState<TransitionModalState>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolDocument | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [cloningDocId, setCloningDocId] = useState<string | null>(null);
  const [openActionDropdownId, setOpenActionDropdownId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastState['type'], text: string) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchDocuments = useCallback(async (isSilentRefresh = false) => {
    if (isSilentRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);
    setAccessDeniedMessage(null);

    try {
      const res = await fetch('/api/admin/documents', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        setAccessDeniedMessage(
          json.message ||
            json.error ||
            'Bạn không có quyền truy cập Kho tài liệu & hồ sơ trường.'
        );
        setDocuments([]);
        return;
      }

      if (!res.ok || !json.success) {
        setLoadError(json.message || json.error || 'Không thể tải dữ liệu tài liệu.');
        return;
      }

      setDocuments(Array.isArray(json.documents) ? json.documents : []);
      setCategories(Array.isArray(json.categories) ? json.categories : []);
      setYears(Array.isArray(json.years) ? json.years : []);
      if (json.viewer) {
        setViewer(json.viewer);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Lỗi kết nối máy chủ khi tải tài liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments(false);
  }, [fetchDocuments]);

  const isSuperAdmin = Boolean(viewer?.is_super_admin || viewer?.active_role === 'SUPER_ADMIN');

  // Stats across scoped documents
  const stats = useMemo(() => {
    const countsByStatus: Record<DocumentStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      WITHDRAWN: 0,
      SUPERSEDED: 0,
      EXPIRED: 0,
    };
    const categoryCounts = new Map<string, number>();
    let driveSyncedCount = 0;
    let approvedDriveIssueCount = 0;

    documents.forEach((doc) => {
      countsByStatus[doc.status] = (countsByStatus[doc.status] || 0) + 1;
      categoryCounts.set(doc.category_id, (categoryCounts.get(doc.category_id) || 0) + 1);

      if (doc.drive_sync_status === 'SYNCED') {
        driveSyncedCount += 1;
      } else if (
        doc.status === 'APPROVED' &&
        (doc.drive_sync_status === 'FAILED' || doc.drive_sync_status === 'PENDING')
      ) {
        approvedDriveIssueCount += 1;
      }
    });

    return {
      totalCount: documents.length,
      countsByStatus,
      categoryCounts,
      closedCount:
        countsByStatus.WITHDRAWN + countsByStatus.SUPERSEDED + countsByStatus.EXPIRED,
      driveSyncedCount,
      approvedDriveIssueCount,
    };
  }, [documents]);

  // Client-side filtered list with accent-insensitive Vietnamese search
  const filteredDocuments = useMemo(() => {
    const qNorm = normalizeVietnameseSearch(searchQuery);

    return documents.filter((doc) => {
      if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && doc.category_id !== categoryFilter) return false;
      if (yearFilter !== 'ALL' && extractDocumentYear(doc.issued_date) !== yearFilter) return false;
      if (isSuperAdmin && visibilityFilter !== 'ALL' && doc.visibility_scope !== visibilityFilter) {
        return false;
      }

      if (qNorm) {
        const haystack = [
          doc.title,
          doc.document_number,
          doc.description,
          doc.file_name,
          doc.category?.name,
          doc.uploader_name,
          doc.approver_name,
          doc.rejection_reason,
          doc.superseded_by_number,
          doc.superseded_by_title,
          getExternalHost(doc.external_url),
        ]
          .map((part) => normalizeVietnameseSearch(part))
          .join(' ');
        if (!haystack.includes(qNorm)) return false;
      }

      return true;
    });
  }, [
    documents,
    searchQuery,
    statusFilter,
    categoryFilter,
    yearFilter,
    visibilityFilter,
    isSuperAdmin,
  ]);

  const hasCustomFilters =
    Boolean(searchQuery.trim()) ||
    categoryFilter !== 'ALL' ||
    yearFilter !== 'ALL' ||
    visibilityFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setYearFilter('ALL');
    setVisibilityFilter('ALL');
    setStatusFilter('ALL');
  };

  const [formInitialMode, setFormInitialMode] = useState<DocumentCreationMode>('ONLINE_EDITOR');

  const handleOpenCreate = (mode: DocumentCreationMode = 'ONLINE_EDITOR') => {
    setEditingDocument(null);
    setFormInitialMode(mode);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (doc: SchoolDocument) => {
    setEditingDocument(doc);
    setFormInitialMode(doc.creation_mode || 'ONLINE_EDITOR');
    setFormModalOpen(true);
  };

  const handleCloneDocument = async (doc: SchoolDocument) => {
    setOpenActionDropdownId(null);
    setCloningDocId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/clone`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.document) {
        showToast('error', json.message || json.error || 'Nhân bản văn bản thất bại.');
        return;
      }
      showToast('success', 'Đã nhân bản thành công sang Bản nháp mới.');
      await fetchDocuments(false);
      // Tự động mở ngay Modal Sửa với bản nháp vừa tạo
      setEditingDocument(json.document as SchoolDocument);
      setFormInitialMode(json.document.creation_mode || 'ONLINE_EDITOR');
      setFormModalOpen(true);
      if (previewModal) setPreviewModal(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Lỗi kết nối khi nhân bản văn bản.');
    } finally {
      setCloningDocId(null);
    }
  };

  const handleFormSaved = async (savedDoc: SchoolDocument, message: string) => {
    setFormModalOpen(false);
    setEditingDocument(null);
    showToast(
      savedDoc.status === 'APPROVED' && savedDoc.drive_sync_status === 'FAILED' ? 'info' : 'success',
      savedDoc.status === 'APPROVED' && savedDoc.drive_sync_status === 'FAILED'
        ? `${message} Lưu ý: đồng bộ Google Drive gặp lỗi (${savedDoc.drive_sync_error || 'vui lòng thử đồng bộ lại'}).`
        : message
    );
    await fetchDocuments(true);
  };

  const handleTransitioned = async (
    updatedDoc: SchoolDocument,
    _auditLogs: DocumentAuditLog[],
    message: string
  ) => {
    setTransitionModal(null);
    if (updatedDoc.status === 'APPROVED' && updatedDoc.drive_sync_status === 'FAILED') {
      showToast(
        'info',
        `${message} Tuy nhiên sao lưu Google Drive bị lỗi (${updatedDoc.drive_sync_error || 'vui lòng bấm Đồng bộ lại'}).`
      );
    } else if (updatedDoc.status === 'APPROVED' && updatedDoc.drive_sync_status === 'SYNCED') {
      showToast('success', `${message} Đã tự động sao lưu lên Google Drive.`);
    } else {
      showToast('success', message);
    }
    await fetchDocuments(true);
  };

  const handleDownloadDocument = async (doc: SchoolDocument) => {
    if (doc.creation_mode === 'ONLINE_EDITOR') {
      window.open(`/api/admin/documents/${doc.id}/docx`, '_blank');
      return;
    }
    if (doc.storage_type === 'EXTERNAL_LINK') {
      if (doc.external_url) {
        window.open(doc.external_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setDownloadingDocId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/signed-url?download=1`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.signed_url) {
        showToast(
          'error',
          json.message || json.error || 'Không thể tạo liên kết tải tài liệu.'
        );
        return;
      }
      window.open(json.signed_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      showToast('error', err?.message || 'Lỗi kết nối khi tải xuống tài liệu.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleSyncDrive = async (doc: SchoolDocument) => {
    setSyncingDocId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/sync-drive`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        showToast(
          'error',
          json.message || json.error || 'Đồng bộ Google Drive thất bại.'
        );
        return;
      }

      if (json.drive_sync_status === 'SYNCED') {
        showToast('success', `Đã đồng bộ "${doc.title}" lên Google Drive.`);
      } else if (json.drive_sync_status === 'SKIPPED') {
        showToast(
          'info',
          json.drive_sync_error || 'Chưa bật cấu hình Google Drive trên máy chủ.'
        );
      } else {
        showToast(
          'error',
          json.drive_sync_error || 'Đồng bộ Google Drive chưa thành công.'
        );
      }
      await fetchDocuments(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Lỗi kết nối khi đồng bộ Google Drive.');
    } finally {
      setSyncingDocId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);

    try {
      const res = await fetch(`/api/admin/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        showToast('error', json.message || json.error || 'Không thể xóa tài liệu.');
        return;
      }
      showToast(
        'success',
        `Đã xóa vĩnh viễn "${deleteTarget.title}" khỏi hệ thống (bản sao Google Drive nếu có vẫn được giữ nguyên).`
      );
      setDeleteTarget(null);
      await fetchDocuments(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Lỗi kết nối khi xóa tài liệu.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCategoryChanged = async (message: string) => {
    showToast('success', message);
    await fetchDocuments(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 max-w-md rounded-2xl border px-4 py-3 shadow-lg flex items-start gap-2.5 text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-relaxed">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-primary-50 border border-rose-100 text-primary-700 flex items-center justify-center shrink-0">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-primary-900">
                Quản lý tài liệu & hồ sơ
              </h1>
              {viewer && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isSuperAdmin
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-rose-50 text-primary-700 border-rose-200'
                  }`}
                >
                  {isSuperAdmin ? (
                    <>
                      <Lock className="w-3 h-3" /> Super Admin
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3" /> Ban giám hiệu
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Kho lưu trữ văn bản điều hành, kế hoạch giáo dục, biểu mẫu hành chính và tự động sao lưu Google Drive theo năm học.
            </p>
          </div>
        </div>

        {!accessDeniedMessage && (
          <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
                title="Quản lý danh mục văn bản"
              >
                <FolderCog className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Danh mục</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenCreate('FILE_UPLOAD')}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100/80 text-red-700 text-sm font-semibold whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
              title="Tải tệp Word, Excel, PDF có sẵn từ máy hoặc gắn liên kết ngoài"
            >
              <Upload className="w-4 h-4 text-red-600 shrink-0" />
              <span>Tải tệp lên</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreate('ONLINE_EDITOR')}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold whitespace-nowrap shadow-sm hover:shadow transition-all cursor-pointer"
              title="Soạn thảo văn bản trực tiếp trên Web chuẩn Nghị định 30 (tự động xuất file Word .docx)"
            >
              <FileEdit className="w-4 h-4 shrink-0" />
              <span>Soạn thảo</span>
            </button>
          </div>
        )}
      </div>

      {/* Access Denied View */}
      {accessDeniedMessage && (
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
          <p className="text-sm text-slate-600 mt-1.5">{accessDeniedMessage}</p>
          <div className="mt-5">
            <Link
              href="/admin/menu"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-pill bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold transition-colors"
            >
              Quay về trang quản trị chính
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!accessDeniedMessage && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === 'SUBMITTED' ? 'ALL' : 'SUBMITTED'))
              }
              className={`bg-white rounded-2xl border p-4 shadow-sm text-left transition-colors cursor-pointer ${
                statusFilter === 'SUBMITTED'
                  ? 'border-sky-400 ring-2 ring-sky-100'
                  : 'border-slate-200 hover:border-sky-200'
              }`}
            >
              <p className="text-xs font-medium text-slate-500">Chờ phê duyệt</p>
              <p className="text-2xl font-bold text-sky-700 mt-1">
                {stats.countsByStatus.SUBMITTED}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Đang soạn thảo: {stats.countsByStatus.DRAFT}
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === 'APPROVED' ? 'ALL' : 'APPROVED'))
              }
              className={`bg-white rounded-2xl border p-4 shadow-sm text-left transition-colors cursor-pointer ${
                statusFilter === 'APPROVED'
                  ? 'border-emerald-400 ring-2 ring-emerald-100'
                  : 'border-slate-200 hover:border-emerald-200'
              }`}
            >
              <p className="text-xs font-medium text-slate-500">Đang có hiệu lực (APPROVED)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {stats.countsByStatus.APPROVED}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Văn bản chính thức đang lưu hành
              </p>
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Đã đóng / Kết thúc</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{stats.closedCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Thu hồi: {stats.countsByStatus.WITHDRAWN} · Thay thế:{' '}
                {stats.countsByStatus.SUPERSEDED} · Hết hạn: {stats.countsByStatus.EXPIRED}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Đã sao lưu Google Drive</p>
              <p className="text-2xl font-bold text-primary-900 mt-1">{stats.driveSyncedCount}</p>
              <p
                className={`text-[11px] mt-0.5 ${
                  stats.approvedDriveIssueCount > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'
                }`}
              >
                {stats.approvedDriveIssueCount > 0
                  ? `${stats.approvedDriveIssueCount} văn bản đã duyệt chờ/lỗi Drive`
                  : 'Tự động sao lưu khi Phê duyệt'}
              </p>
            </div>
          </div>

          {/* 6-State Lifecycle Quick Filter Chips */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-1">Trạng thái:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tất cả ({stats.totalCount})
              </button>
              {DOCUMENT_STATUS_ORDER.map((st) => {
                const meta = DOCUMENT_STATUS_META[st];
                const count = stats.countsByStatus[st] || 0;
                const isSelected = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(isSelected ? 'ALL' : st)}
                    title={meta.description}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {meta.shortLabel} ({count})
                  </button>
                );
              })}
            </div>

            {/* Category Quick Filter Chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1">Danh mục:</span>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tất cả danh mục ({stats.totalCount})
                </button>
                {categories.map((cat) => {
                  const isSelected = categoryFilter === cat.id;
                  const catCount = stats.categoryCounts.get(cat.id) ?? 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(isSelected ? 'ALL' : cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cat.name} ({catCount})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search input */}
              <div className={isSuperAdmin ? 'md:col-span-5' : 'md:col-span-6'}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Tìm kiếm tài liệu
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tiêu đề, số hiệu, tên tệp, người duyệt, lý do..."
                    className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Xóa từ khóa"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Year Filter */}
              <div className={isSuperAdmin ? 'md:col-span-2' : 'md:col-span-3'}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Năm ban hành
                </label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ALL">Tất cả các năm</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      Năm {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visibility Scope Filter (Super Admin only) */}
              {isSuperAdmin && (
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Phạm vi truy cập
                  </label>
                  <select
                    value={visibilityFilter}
                    onChange={(e) => setVisibilityFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="ALL">Tất cả phạm vi</option>
                    <option value="ALL_ADMINS">Ban giám hiệu (ALL_ADMINS)</option>
                    <option value="SUPER_ADMIN_ONLY">Chỉ Super Admin</option>
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <div className={isSuperAdmin ? 'md:col-span-2' : 'md:col-span-3'}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Trạng thái vòng đời
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | 'ALL')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  {DOCUMENT_STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {DOCUMENT_STATUS_META[st].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
              <span>
                Hiển thị <strong className="text-slate-800">{filteredDocuments.length}</strong> tài liệu
                {statusFilter !== 'ALL'
                  ? ` ở trạng thái "${DOCUMENT_STATUS_META[statusFilter].label}"`
                  : ''}
                .
              </span>
              {hasCustomFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-primary-700 hover:text-primary-800 font-semibold hover:underline"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Load Error Banner */}
          {loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => void fetchDocuments(false)}
                className="px-3 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Documents Table / Loading / Empty State */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
                <span className="text-sm font-medium">Đang tải danh sách tài liệu...</span>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">
                    {documents.length === 0
                      ? 'Chưa có tài liệu nào trong kho lưu trữ'
                      : 'Không tìm thấy tài liệu phù hợp'}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    {documents.length === 0
                      ? 'Nhấn "Thêm tài liệu mới" để tạo bản nháp, trình duyệt công văn hoặc gắn liên kết Google Workspace.'
                      : 'Hãy thử thay đổi từ khóa tìm kiếm, danh mục hoặc trạng thái lọc.'}
                  </p>
                </div>
                <div className="pt-1 flex items-center justify-center gap-2">
                  {hasCustomFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenCreate('ONLINE_EDITOR')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-sm cursor-pointer"
                  >
                    <FileEdit className="w-4 h-4" />
                    Soạn thảo trực tuyến
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCreate('FILE_UPLOAD')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Tải tệp lên
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto min-h-[360px] pb-12">
                <table className="w-full table-fixed text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-[32%] whitespace-nowrap">VĂN BẢN</th>
                      <th className="py-3.5 px-4 w-[22%] whitespace-nowrap">PHÂN LOẠI</th>
                      <th className="py-3.5 px-4 w-[16%] whitespace-nowrap">TRẠNG THÁI</th>
                      <th className="py-3.5 px-4 w-[15%] whitespace-nowrap">LƯU TRỮ</th>
                      <th className="py-3.5 px-4 w-[15%] whitespace-nowrap text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredDocuments.map((doc) => {
                      const visual = getDocumentKindVisual(doc);
                      const DocIcon = visual.icon;
                      const previewKind = getDocumentPreviewKind(doc);
                      const isSyncing = syncingDocId === doc.id;
                      const isDownloading = downloadingDocId === doc.id;
                      const statusMeta = DOCUMENT_STATUS_META[doc.status];
                      const isTerminal =
                        doc.status === 'WITHDRAWN' ||
                        doc.status === 'SUPERSEDED' ||
                        doc.status === 'EXPIRED';
                      const isDocx = isDocxDocument(doc);
                      const canDirectEdit =
                        (doc.creation_mode === 'ONLINE_EDITOR' || isDocx) &&
                        (doc.status === 'DRAFT' || doc.status === 'SUBMITTED');

                      return (
                        <tr
                          key={doc.id}
                          className={`hover:bg-rose-50/20 transition-colors ${
                            doc.status === 'SUBMITTED'
                              ? 'bg-sky-50/25'
                              : isTerminal
                              ? 'bg-slate-50/50'
                              : ''
                          }`}
                        >
                          {/* 1. VĂN BẢN (w-[32%]) */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (canDirectEdit) {
                                    handleOpenEdit(doc);
                                    return;
                                  }
                                  if (previewKind === 'external' && doc.external_url) {
                                    window.open(doc.external_url, '_blank', 'noopener,noreferrer');
                                  } else if (
                                    previewKind === 'pdf' ||
                                    previewKind === 'image' ||
                                    previewKind === 'editor'
                                  ) {
                                    setPreviewModal({ document: doc, initialTab: 'preview' });
                                  } else {
                                    void handleDownloadDocument(doc);
                                  }
                                }}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer hover:opacity-85 transition-opacity ${visual.badgeBg}`}
                                title={
                                  canDirectEdit
                                    ? 'Bấm để mở trình soạn thảo trực tuyến'
                                    : visual.label
                                }
                              >
                                <DocIcon className="w-4 h-4" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (canDirectEdit) {
                                      handleOpenEdit(doc);
                                      return;
                                    }
                                    if (previewKind === 'external' && doc.external_url) {
                                      window.open(
                                        doc.external_url,
                                        '_blank',
                                        'noopener,noreferrer'
                                      );
                                    } else if (
                                      previewKind === 'pdf' ||
                                      previewKind === 'image' ||
                                      previewKind === 'editor'
                                    ) {
                                      setPreviewModal({ document: doc, initialTab: 'preview' });
                                    } else {
                                      void handleDownloadDocument(doc);
                                    }
                                  }}
                                  className="text-left font-semibold text-slate-900 hover:text-primary-700 transition-colors line-clamp-2 cursor-pointer break-words"
                                  title={
                                    canDirectEdit
                                      ? 'Bấm để mở trình soạn thảo trực tuyến'
                                      : 'Bấm để xem trước văn bản'
                                  }
                                >
                                  {doc.title}
                                </button>

                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500">
                                  {/* Nhãn nhận diện loại tài liệu */}
                                  {doc.creation_mode === 'ONLINE_EDITOR' ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                                      <FileEdit className="w-3 h-3" />
                                      Soạn trực tuyến
                                    </span>
                                  ) : isDocx ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] bg-blue-50/70 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                                      <FileText className="w-3 h-3" />
                                      Tệp Word (.docx)
                                    </span>
                                  ) : doc.storage_type === 'EXTERNAL_LINK' ? (
                                    <span
                                      className="inline-flex items-center gap-1 font-medium text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 whitespace-nowrap"
                                      title={doc.external_url || ''}
                                    >
                                      <Globe className="w-3 h-3" />
                                      Liên kết ngoài
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                      <FileText className="w-3 h-3" />
                                      Tệp đính kèm
                                    </span>
                                  )}

                                  {doc.document_number ? (
                                    <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                      Số: {doc.document_number}
                                    </span>
                                  ) : (
                                    <span className="italic text-[11px] bg-slate-100/80 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200/80 whitespace-nowrap">
                                      Chưa cấp số
                                    </span>
                                  )}

                                  {doc.storage_type === 'SUPABASE_STORAGE' ? (
                                    <span className="truncate max-w-[160px]" title={doc.file_name || ''}>
                                      {doc.file_name || 'Tệp đính kèm'}
                                      {doc.file_size
                                        ? ` · ${formatDocumentFileSize(doc.file_size)}`
                                        : ''}
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 text-indigo-700 truncate max-w-[150px]"
                                      title={doc.external_url || ''}
                                    >
                                      <Globe className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{getExternalHost(doc.external_url)}</span>
                                    </span>
                                  )}
                                </div>

                                {doc.status === 'WITHDRAWN' && doc.rejection_reason && (
                                  <p
                                    className="text-[11px] text-rose-700 mt-1 line-clamp-1 font-medium"
                                    title={doc.rejection_reason}
                                  >
                                    Lý do: {doc.rejection_reason}
                                  </p>
                                )}

                                {doc.status === 'SUPERSEDED' && doc.superseded_by_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const target = documents.find(
                                        (d) => d.id === doc.superseded_by_id
                                      );
                                      if (target) {
                                        setPreviewModal({
                                          document: target,
                                          initialTab: 'details',
                                        });
                                      }
                                    }}
                                    className="text-[11px] text-purple-700 hover:underline mt-1 text-left line-clamp-1 font-medium cursor-pointer"
                                    title={doc.superseded_by_title || ''}
                                  >
                                    Thay thế bởi:{' '}
                                    {doc.superseded_by_number
                                      ? `[${doc.superseded_by_number}] `
                                      : ''}
                                    {doc.superseded_by_title || 'Văn bản mới'}
                                  </button>
                                )}

                                {doc.description &&
                                  !(doc.status === 'WITHDRAWN' && doc.rejection_reason) && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                      {doc.description}
                                    </p>
                                  )}
                              </div>
                            </div>
                          </td>

                          {/* 2. PHÂN LOẠI (w-[22%]) */}
                          <td className="py-3.5 px-4 align-top">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-primary-800 border border-rose-200 truncate max-w-full">
                              {doc.category?.name || 'Chưa phân loại'}
                            </span>
                            <div className="text-xs text-slate-600 mt-1.5 font-medium whitespace-nowrap">
                              Ban hành: {formatIssuedDateVi(doc.issued_date)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                              {doc.effective_date && (
                                <span>Hiệu lực: {formatIssuedDateVi(doc.effective_date)} · </span>
                              )}
                              <span>
                                Hết hạn:{' '}
                                {doc.expiration_date ? (
                                  formatIssuedDateVi(doc.expiration_date)
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                    Dài hạn
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {doc.uploader_name ? `Tạo: ${doc.uploader_name}` : ''}
                              {doc.uploader_name && doc.approver_name ? ' · ' : ''}
                              {doc.approver_name ? `Duyệt: ${doc.approver_name}` : ''}
                            </div>
                          </td>

                          {/* 3. TRẠNG THÁI (w-[16%]) */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-col items-start gap-1.5">
                              {doc.visibility_scope === 'SUPER_ADMIN_ONLY' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                                  <Lock className="w-3 h-3 shrink-0" />
                                  Chỉ Super Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                  <Shield className="w-3 h-3 shrink-0" />
                                  Ban giám hiệu
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${statusMeta.badgeClass}`}
                                title={statusMeta.description}
                              >
                                {statusMeta.label}
                              </span>
                            </div>
                          </td>

                          {/* 4. LƯU TRỮ (w-[15%]) */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-col items-start gap-1">
                              {doc.status === 'DRAFT' || doc.status === 'SUBMITTED' ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap"
                                  title="Chờ Hiệu trưởng phê duyệt mới tự động sao lưu Google Drive"
                                >
                                  <Clock className="w-3 h-3 shrink-0" />
                                  Chờ sao lưu
                                </span>
                              ) : doc.drive_sync_status === 'SYNCED' ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                    <Cloud className="w-3 h-3 shrink-0" />
                                    Đã sao lưu
                                  </span>
                                  {doc.drive_web_view_link && (
                                    <a
                                      href={doc.drive_web_view_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline whitespace-nowrap"
                                      title="Mở tệp lưu trữ trên Google Drive"
                                    >
                                      <span>Mở Drive</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                    </a>
                                  )}
                                </>
                              ) : doc.drive_sync_status === 'FAILED' ? (
                                <>
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-help whitespace-nowrap"
                                    title={doc.drive_sync_error || 'Lỗi kết nối sao lưu Google Drive'}
                                  >
                                    <CloudOff className="w-3 h-3 shrink-0" />
                                    Lỗi đồng bộ
                                  </span>
                                  {doc.status === 'APPROVED' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSyncDrive(doc)}
                                      disabled={isSyncing}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 hover:underline disabled:opacity-60 cursor-pointer whitespace-nowrap"
                                      title={doc.drive_sync_error || 'Thử đồng bộ lại lên Google Drive'}
                                    >
                                      {isSyncing ? (
                                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                      ) : (
                                        <HardDriveUpload className="w-3 h-3 shrink-0" />
                                      )}
                                      <span>Đồng bộ lại</span>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 cursor-help whitespace-nowrap"
                                    title={doc.drive_sync_error || undefined}
                                  >
                                    <CloudOff className="w-3 h-3 shrink-0" />
                                    {doc.drive_sync_status === 'SKIPPED'
                                      ? 'Chưa bật Drive'
                                      : 'Chưa đồng bộ'}
                                  </span>
                                  {doc.status === 'APPROVED' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSyncDrive(doc)}
                                      disabled={isSyncing}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 hover:underline disabled:opacity-60 cursor-pointer whitespace-nowrap"
                                    >
                                      {isSyncing ? (
                                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                      ) : (
                                        <HardDriveUpload className="w-3 h-3 shrink-0" />
                                      )}
                                      <span>Đồng bộ Drive</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          {/* 5. THAO TÁC (w-[15%]) - Đúng 1 nút chính + 1 menu ⋮ */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="relative inline-flex items-center justify-end gap-1.5">
                              {/* 1. DRAFT: 1 nút chính [Soạn thảo] (docx/online) hoặc [Cập nhật] */}
                              {doc.status === 'DRAFT' && (
                                <>
                                  {isDocx ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(doc)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                                      title="Soạn thảo trực tuyến trên Web chuẩn Nghị định 30"
                                    >
                                      <FileEdit className="w-3.5 h-3.5" />
                                      <span>Soạn thảo</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(doc)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                      title="Cập nhật tệp đính kèm & thông tin"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Cập nhật</span>
                                    </button>
                                  )}
                                </>
                              )}

                              {/* 2. SUBMITTED: 1 nút chính [Phê duyệt] (Super Admin) hoặc [Soạn thảo]/[Cập nhật] (User khác) */}
                              {doc.status === 'SUBMITTED' && (
                                <>
                                  {isSuperAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTransitionModal({ document: doc, action: 'approve' })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                                      title="Phê duyệt ban hành & tự động sao lưu Google Drive"
                                    >
                                      <FileCheck2 className="w-3.5 h-3.5" />
                                      <span>Phê duyệt</span>
                                    </button>
                                  ) : isDocx ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(doc)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                                      title="Soạn thảo / chỉnh sửa nội dung văn bản đang chờ duyệt"
                                    >
                                      <FileEdit className="w-3.5 h-3.5" />
                                      <span>Soạn thảo</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(doc)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                      title="Cập nhật văn bản đang chờ duyệt"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Cập nhật</span>
                                    </button>
                                  )}
                                </>
                              )}

                              {/* 3. APPROVED: 1 nút chính [.docx] / [Mở link] / [Tải về] (Tuyệt đối KHÔNG có Sửa/Xóa) */}
                              {doc.status === 'APPROVED' && (
                                <>
                                  {doc.creation_mode === 'ONLINE_EDITOR' ? (
                                    <a
                                      href={`/api/admin/documents/${doc.id}/docx`}
                                      download
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                                      title="Tải tệp Word (.docx) chuẩn Nghị định 30"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>.docx</span>
                                    </a>
                                  ) : isDocx ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleDownloadDocument(doc)}
                                      disabled={isDownloading}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                                      title="Tải tệp Word (.docx)"
                                    >
                                      {isDownloading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Download className="w-3.5 h-3.5" />
                                      )}
                                      <span>.docx</span>
                                    </button>
                                  ) : previewKind === 'external' && doc.external_url ? (
                                    <a
                                      href={doc.external_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors"
                                      title="Mở liên kết ngoài"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Mở link</span>
                                    </a>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => void handleDownloadDocument(doc)}
                                      disabled={isDownloading}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                                      title="Tải tệp đính kèm"
                                    >
                                      {isDownloading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Download className="w-3.5 h-3.5" />
                                      )}
                                      <span>Tải về</span>
                                    </button>
                                  )}
                                </>
                              )}

                              {/* 4. TERMINAL (WITHDRAWN / SUPERSEDED / EXPIRED): 1 nút chính [Xem] */}
                              {isTerminal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewModal({ document: doc, initialTab: 'preview' })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Xem trước tài liệu"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem</span>
                                </button>
                              )}

                              {/* Dropdown Menu ⋮ (Thao tác khác) */}
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenActionDropdownId(
                                      openActionDropdownId === doc.id ? null : doc.id
                                    )
                                  }
                                  className={`p-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer ${
                                    openActionDropdownId === doc.id
                                      ? 'bg-slate-100 text-slate-900 border-slate-300'
                                      : 'bg-white hover:bg-slate-50 text-slate-600'
                                  }`}
                                  title="Thao tác khác"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {openActionDropdownId === doc.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-20 cursor-default"
                                      onClick={() => setOpenActionDropdownId(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-30 text-left">
                                      {/* 1. Trình duyệt khi ở DRAFT */}
                                      {doc.status === 'DRAFT' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionDropdownId(null);
                                            setTransitionModal({
                                              document: doc,
                                              action: 'submit_for_approval',
                                            });
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Send className="w-3.5 h-3.5 text-sky-500" />
                                          <span>Trình duyệt văn bản</span>
                                        </button>
                                      )}

                                      {/* 2. Soạn thảo & Từ chối khi ở SUBMITTED (Super Admin) */}
                                      {doc.status === 'SUBMITTED' && isSuperAdmin && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionDropdownId(null);
                                              handleOpenEdit(doc);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            {isDocx ? (
                                              <>
                                                <FileEdit className="w-3.5 h-3.5 text-blue-500" />
                                                <span>Soạn thảo nội dung</span>
                                              </>
                                            ) : (
                                              <>
                                                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Cập nhật văn bản</span>
                                              </>
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionDropdownId(null);
                                              setTransitionModal({
                                                document: doc,
                                                action: 'reject',
                                              });
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Ban className="w-3.5 h-3.5 text-rose-500" />
                                            <span>Từ chối duyệt</span>
                                          </button>
                                        </>
                                      )}

                                      {/* 3. Thay thế khi ở APPROVED (Super Admin) */}
                                      {doc.status === 'APPROVED' && isSuperAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionDropdownId(null);
                                            setTransitionModal({
                                              document: doc,
                                              action: 'supersede',
                                            });
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                                          <span>Thay thế văn bản</span>
                                        </button>
                                      )}

                                      {/* 4. Xem trước nếu không phải là nút chính */}
                                      {!isTerminal && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionDropdownId(null);
                                            setPreviewModal({
                                              document: doc,
                                              initialTab: 'preview',
                                            });
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Xem trước</span>
                                        </button>
                                      )}

                                      {/* 5. Nhân bản (Clone) luôn sẵn sàng cho mọi trạng thái */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionDropdownId(null);
                                          void handleCloneDocument(doc);
                                        }}
                                        disabled={cloningDocId === doc.id}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                      >
                                        {cloningDocId === doc.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                                        )}
                                        <span>Nhân bản (Clone)</span>
                                      </button>

                                      {/* 6. Tải tệp / Mở link trong Dropdown khi chưa phải là nút chính */}
                                      {doc.creation_mode === 'ONLINE_EDITOR' && doc.status !== 'APPROVED' ? (
                                        <a
                                          href={`/api/admin/documents/${doc.id}/docx`}
                                          download
                                          onClick={() => setOpenActionDropdownId(null)}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50/60 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Download className="w-3.5 h-3.5 text-blue-500" />
                                          <span>Tải tệp .docx</span>
                                        </a>
                                      ) : doc.storage_type === 'EXTERNAL_LINK' && doc.external_url && doc.status !== 'APPROVED' ? (
                                        <a
                                          href={doc.external_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => setOpenActionDropdownId(null)}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50/60 flex items-center gap-2 cursor-pointer"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                                          <span>Mở liên kết ngoài</span>
                                        </a>
                                      ) : doc.storage_type === 'SUPABASE_STORAGE' && doc.status !== 'APPROVED' ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionDropdownId(null);
                                            void handleDownloadDocument(doc);
                                          }}
                                          disabled={isDownloading}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Download className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Tải tệp đính kèm</span>
                                        </button>
                                      ) : null}

                                      {/* 7. Lịch sử xử lý */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionDropdownId(null);
                                          setPreviewModal({
                                            document: doc,
                                            initialTab: 'details',
                                          });
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <History className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Lịch sử xử lý</span>
                                      </button>

                                      {/* 8. Workflow nâng cao cho APPROVED (Super Admin) */}
                                      {doc.status === 'APPROVED' && isSuperAdmin && (
                                        <>
                                          <div className="border-t border-slate-100 my-1" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionDropdownId(null);
                                              setTransitionModal({
                                                document: doc,
                                                action: 'withdraw',
                                              });
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Ban className="w-3.5 h-3.5 text-rose-500" />
                                            <span>Thu hồi khẩn cấp</span>
                                          </button>
                                          {doc.expiration_date && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setOpenActionDropdownId(null);
                                                setTransitionModal({
                                                  document: doc,
                                                  action: 'expire',
                                                });
                                              }}
                                              className="w-full text-left px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                                            >
                                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                                              <span>Chuyển hết hạn</span>
                                            </button>
                                          )}
                                        </>
                                      )}

                                      {/* 9. Xóa vĩnh viễn: CHỈ cho DRAFT và SUPER_ADMIN */}
                                      {doc.status === 'DRAFT' && isSuperAdmin && (
                                        <>
                                          <div className="border-t border-slate-100 my-1" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionDropdownId(null);
                                              setDeleteTarget(doc);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                            <span>Xóa vĩnh viễn</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {formModalOpen && (
        <DocumentFormModal
          categories={categories}
          isSuperAdmin={isSuperAdmin}
          editingDocument={editingDocument}
          initialCreationMode={formInitialMode}
          onClose={() => {
            setFormModalOpen(false);
            setEditingDocument(null);
          }}
          onSaved={(doc, msg) => void handleFormSaved(doc, msg)}
        />
      )}

      {/* Workflow Transition Modal */}
      {transitionModal && (
        <DocumentTransitionModal
          document={transitionModal.document}
          action={transitionModal.action}
          allDocuments={documents}
          onClose={() => setTransitionModal(null)}
          onTransitioned={(doc, logs, msg) => void handleTransitioned(doc, logs, msg)}
        />
      )}

      {/* Preview & Audit Details Modal */}
      {previewModal && (
        <DocumentPreviewModal
          document={previewModal.document}
          initialTab={previewModal.initialTab}
          onClose={() => setPreviewModal(null)}
          onSelectDocumentById={(docId) => {
            const target = documents.find((d) => d.id === docId);
            if (target) {
              setPreviewModal({ document: target, initialTab: 'details' });
            }
          }}
          onCloneDocument={(doc) => {
            setPreviewModal(null);
            void handleCloneDocument(doc);
          }}
        />
      )}

      {/* Category Manager Modal */}
      {categoryModalOpen && isSuperAdmin && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setCategoryModalOpen(false)}
          onChanged={handleCategoryChanged}
        />
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Xác nhận xóa vĩnh viễn tài liệu
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm text-slate-600">
              <p>
                Tài liệu:{' '}
                <strong className="text-slate-900">{deleteTarget.title}</strong>
                {deleteTarget.document_number ? ` (Số: ${deleteTarget.document_number})` : ''}
              </p>

              <div className="space-y-2">
                <p className="text-rose-700 font-medium">
                  Thao tác này sẽ xóa vĩnh viễn bản ghi tài liệu khỏi cơ sở dữ liệu và tệp đính kèm trên Supabase Storage (nếu có).
                </p>
                <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
                  Lưu ý bảo toàn dữ liệu: Bản sao lưu trên Google Drive (nếu đã đồng bộ) sẽ KHÔNG bị xóa để phục vụ đối chiếu hành chính.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleteSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận xóa vĩnh viễn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
