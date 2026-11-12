'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  HardDriveUpload,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import {
  DocumentCategory,
  DocumentStatus,
  SchoolDocument,
  UserRole,
} from '@/lib/types/schema';
import { normalizeVietnameseSearch } from '@/lib/utils/textSearch';
import {
  extractDocumentYear,
  formatDocumentFileSize,
  getDocumentPreviewKind,
} from '@/lib/documents/validation';
import { DocumentFormModal } from '@/components/admin/documents/DocumentFormModal';
import { DocumentPreviewModal } from '@/components/admin/documents/DocumentPreviewModal';
import { CategoryManagerModal } from '@/components/admin/documents/CategoryManagerModal';

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

type ConfirmModalState =
  | {
      kind: 'archive' | 'restore' | 'delete';
      document: SchoolDocument;
    }
  | null;

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

function getDocumentKindVisual(doc: SchoolDocument) {
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
  return {
    icon: isSheet ? FileSpreadsheet : FileText,
    badgeBg: isSheet
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-blue-50 text-blue-700 border-blue-200',
    label: isSheet ? 'Excel' : 'Word',
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

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');

  // Modals & row actions
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingDocument, setEditingDocument] = useState<SchoolDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<SchoolDocument | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState<boolean>(false);
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastState['type'], text: string) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
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
    let activeCount = 0;
    let archivedCount = 0;
    let driveSyncedCount = 0;
    let driveFailedCount = 0;

    documents.forEach((doc) => {
      if (doc.status === 'ACTIVE') {
        activeCount += 1;
        if (doc.drive_sync_status === 'SYNCED') driveSyncedCount += 1;
        if (doc.drive_sync_status === 'FAILED') driveFailedCount += 1;
      } else {
        archivedCount += 1;
      }
    });

    return {
      activeCount,
      archivedCount,
      driveSyncedCount,
      driveFailedCount,
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
    statusFilter !== 'ACTIVE';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setYearFilter('ALL');
    setVisibilityFilter('ALL');
    setStatusFilter('ACTIVE');
  };

  const handleOpenCreate = () => {
    setEditingDocument(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (doc: SchoolDocument) => {
    setEditingDocument(doc);
    setFormModalOpen(true);
  };

  const handleFormSaved = async (savedDoc: SchoolDocument, message: string) => {
    setFormModalOpen(false);
    setEditingDocument(null);
    showToast(
      savedDoc.drive_sync_status === 'FAILED' ? 'info' : 'success',
      savedDoc.drive_sync_status === 'FAILED'
        ? `${message} Lưu ý: đồng bộ Google Drive gặp lỗi (${savedDoc.drive_sync_error || 'vui lòng thử đồng bộ lại'}).`
        : message
    );
    await fetchDocuments(true);
  };

  const handleDownloadDocument = async (doc: SchoolDocument) => {
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

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { kind, document: targetDoc } = confirmModal;
    setConfirmSubmitting(true);

    try {
      if (kind === 'delete') {
        const res = await fetch(`/api/admin/documents/${targetDoc.id}`, {
          method: 'DELETE',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          showToast('error', json.message || json.error || 'Không thể xóa tài liệu.');
          return;
        }
        showToast(
          'success',
          `Đã xóa vĩnh viễn "${targetDoc.title}" khỏi hệ thống (bản sao Google Drive nếu có vẫn được giữ nguyên).`
        );
      } else {
        const nextStatus: DocumentStatus = kind === 'archive' ? 'ARCHIVED' : 'ACTIVE';
        const res = await fetch(`/api/admin/documents/${targetDoc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          showToast(
            'error',
            json.message || json.error || 'Không thể cập nhật trạng thái tài liệu.'
          );
          return;
        }
        showToast(
          'success',
          nextStatus === 'ARCHIVED'
            ? `Đã chuyển "${targetDoc.title}" sang trạng thái lưu trữ.`
            : `Đã khôi phục "${targetDoc.title}" về trạng thái đang lưu hành.`
        );
      }

      setConfirmModal(null);
      await fetchDocuments(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Lỗi kết nối khi thực hiện thao tác.');
    } finally {
      setConfirmSubmitting(false);
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
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void fetchDocuments(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-primary-800 text-sm font-semibold transition-colors"
              >
                <Tags className="w-4 h-4" />
                <span>Quản lý danh mục</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tài liệu mới</span>
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
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Đang lưu hành</p>
              <p className="text-2xl font-bold text-primary-900 mt-1">{stats.activeCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Đã lưu trữ</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{stats.archivedCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Đã sao lưu Google Drive</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.driveSyncedCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Chờ / Lỗi đồng bộ Drive</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  stats.driveFailedCount > 0 ? 'text-rose-600' : 'text-slate-700'
                }`}
              >
                {stats.driveFailedCount}
              </p>
            </div>
          </div>

          {/* Category Quick Filter Chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tất cả danh mục ({stats.activeCount})
              </button>
              {categories.map((cat) => {
                const isSelected = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(isSelected ? 'ALL' : cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      isSelected
                        ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name}
                    {typeof cat.document_count === 'number' ? ` (${cat.document_count})` : ''}
                  </button>
                );
              })}
            </div>
          )}

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
                    placeholder="Tìm theo tiêu đề, số hiệu, tên tệp, mô tả..."
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
                  Trạng thái
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'ACTIVE' | 'ARCHIVED' | 'ALL')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ACTIVE">Đang lưu hành</option>
                  <option value="ARCHIVED">Đã lưu trữ</option>
                  <option value="ALL">Tất cả trạng thái</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
              <span>
                Hiển thị <strong className="text-slate-800">{filteredDocuments.length}</strong> tài liệu
                {statusFilter === 'ACTIVE'
                  ? ' đang lưu hành'
                  : statusFilter === 'ARCHIVED'
                  ? ' đã lưu trữ'
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
                      ? 'Nhấn "Thêm tài liệu mới" để tải lên công văn, kế hoạch hoặc gắn liên kết Google Workspace.'
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
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm tài liệu mới
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      <th className="py-3.5 px-4">Tài liệu & Tệp / Liên kết</th>
                      <th className="py-3.5 px-4">Danh mục & Ban hành</th>
                      <th className="py-3.5 px-4">Phạm vi & Trạng thái</th>
                      <th className="py-3.5 px-4">Sao lưu Google Drive</th>
                      <th className="py-3.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredDocuments.map((doc) => {
                      const visual = getDocumentKindVisual(doc);
                      const DocIcon = visual.icon;
                      const previewKind = getDocumentPreviewKind(doc);
                      const isSyncing = syncingDocId === doc.id;
                      const isDownloading = downloadingDocId === doc.id;

                      return (
                        <tr
                          key={doc.id}
                          className={`hover:bg-rose-50/20 transition-colors ${
                            doc.status === 'ARCHIVED' ? 'bg-slate-50/40' : ''
                          }`}
                        >
                          {/* Title & Source */}
                          <td className="py-3.5 px-4 align-top max-w-[360px]">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${visual.badgeBg}`}
                                title={visual.label}
                              >
                                <DocIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (previewKind === 'external' && doc.external_url) {
                                      window.open(
                                        doc.external_url,
                                        '_blank',
                                        'noopener,noreferrer'
                                      );
                                    } else if (previewKind === 'pdf' || previewKind === 'image') {
                                      setPreviewDocument(doc);
                                    } else {
                                      void handleDownloadDocument(doc);
                                    }
                                  }}
                                  className="text-left font-semibold text-slate-900 hover:text-primary-700 transition-colors line-clamp-2"
                                >
                                  {doc.title}
                                </button>

                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500">
                                  {doc.document_number && (
                                    <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                      Số: {doc.document_number}
                                    </span>
                                  )}
                                  {doc.storage_type === 'SUPABASE_STORAGE' ? (
                                    <span className="truncate max-w-[230px]" title={doc.file_name || ''}>
                                      {doc.file_name || 'Tệp đính kèm'}
                                      {doc.file_size
                                        ? ` · ${formatDocumentFileSize(doc.file_size)}`
                                        : ''}
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 text-indigo-700"
                                      title={doc.external_url || ''}
                                    >
                                      <Globe className="w-3 h-3" />
                                      {getExternalHost(doc.external_url)}
                                    </span>
                                  )}
                                </div>

                                {doc.description && (
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                    {doc.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category & Issued Date */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-primary-800 border border-rose-200">
                              {doc.category?.name || 'Chưa phân loại'}
                            </span>
                            <div className="text-xs text-slate-600 mt-1.5 font-medium">
                              Ban hành: {formatIssuedDateVi(doc.issued_date)}
                            </div>
                            {doc.uploader_name && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Đăng bởi: {doc.uploader_name}
                              </div>
                            )}
                          </td>

                          {/* Visibility & Status */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1.5">
                              {doc.visibility_scope === 'SUPER_ADMIN_ONLY' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <Lock className="w-3 h-3" />
                                  Chỉ Super Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  <Shield className="w-3 h-3" />
                                  Ban giám hiệu
                                </span>
                              )}

                              {doc.status === 'ACTIVE' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Đang lưu hành
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Đã lưu trữ
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Google Drive Backup Status */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1.5">
                              {doc.drive_sync_status === 'SYNCED' ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Cloud className="w-3 h-3" />
                                    Đã lưu Drive
                                  </span>
                                  {doc.drive_web_view_link && (
                                    <a
                                      href={doc.drive_web_view_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                                    >
                                      <span>Mở trên Drive</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </>
                              ) : doc.drive_sync_status === 'FAILED' ? (
                                <>
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                                    title={doc.drive_sync_error || 'Lỗi đồng bộ Google Drive'}
                                  >
                                    <CloudOff className="w-3 h-3" />
                                    Lỗi đồng bộ
                                  </span>
                                  {doc.status === 'ACTIVE' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSyncDrive(doc)}
                                      disabled={isSyncing}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 hover:underline disabled:opacity-60"
                                    >
                                      {isSyncing ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <HardDriveUpload className="w-3 h-3" />
                                      )}
                                      <span>Đồng bộ lại</span>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                                    title={doc.drive_sync_error || undefined}
                                  >
                                    <CloudOff className="w-3 h-3" />
                                    {doc.drive_sync_status === 'SKIPPED'
                                      ? 'Chưa bật Drive'
                                      : 'Chưa đồng bộ'}
                                  </span>
                                  {doc.status === 'ACTIVE' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSyncDrive(doc)}
                                      disabled={isSyncing}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 hover:underline disabled:opacity-60"
                                    >
                                      {isSyncing ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <HardDriveUpload className="w-3 h-3" />
                                      )}
                                      <span>Đồng bộ Drive</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          {/* Row Actions */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {previewKind === 'external' && doc.external_url ? (
                                <a
                                  href={doc.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors"
                                  title="Mở liên kết ngoài"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Mở liên kết</span>
                                </a>
                              ) : (
                                <>
                                  {(previewKind === 'pdf' || previewKind === 'image') && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDocument(doc)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                                      title="Xem trước tài liệu"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Xem trước</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadDocument(doc)}
                                    disabled={isDownloading}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-60"
                                    title="Tải tệp xuống"
                                  >
                                    {isDownloading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span>Tải về</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                                title="Chỉnh sửa thông tin tài liệu"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Sửa</span>
                              </button>

                              {doc.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({ kind: 'archive', document: doc })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors"
                                  title="Chuyển vào kho lưu trữ"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>Lưu trữ</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({ kind: 'restore', document: doc })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors"
                                  title="Khôi phục về đang lưu hành"
                                >
                                  <ArchiveRestore className="w-3.5 h-3.5" />
                                  <span>Khôi phục</span>
                                </button>
                              )}

                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({ kind: 'delete', document: doc })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                                  title="Xóa vĩnh viễn tài liệu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa</span>
                                </button>
                              )}
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
          onClose={() => {
            setFormModalOpen(false);
            setEditingDocument(null);
          }}
          onSaved={(doc, msg) => void handleFormSaved(doc, msg)}
        />
      )}

      {/* Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
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

      {/* Confirmation Modal (Archive / Restore / Permanent Delete) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {confirmModal.kind === 'delete'
                  ? 'Xác nhận xóa vĩnh viễn tài liệu'
                  : confirmModal.kind === 'archive'
                  ? 'Chuyển tài liệu vào lưu trữ'
                  : 'Khôi phục tài liệu đang lưu hành'}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={confirmSubmitting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm text-slate-600">
              <p>
                Tài liệu:{' '}
                <strong className="text-slate-900">
                  {confirmModal.document.title}
                </strong>
                {confirmModal.document.document_number
                  ? ` (Số: ${confirmModal.document.document_number})`
                  : ''}
              </p>

              {confirmModal.kind === 'delete' ? (
                <div className="space-y-2">
                  <p className="text-rose-700 font-medium">
                    Thao tác này sẽ xóa vĩnh viễn bản ghi tài liệu khỏi cơ sở dữ liệu và tệp đính kèm trên Supabase Storage (nếu có).
                  </p>
                  <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
                    Lưu ý bảo toàn dữ liệu: Bản sao lưu trên Google Drive (nếu đã đồng bộ) sẽ KHÔNG bị xóa để phục vụ đối chiếu hành chính.
                  </p>
                </div>
              ) : confirmModal.kind === 'archive' ? (
                <p>
                  Tài liệu sẽ được chuyển sang trạng thái <strong>Đã lưu trữ</strong>. Số hiệu văn bản cũ (nếu có) có thể được tái sử dụng cho văn bản ban hành mới, và bản sao Google Drive vẫn được giữ nguyên.
                </p>
              ) : (
                <p>
                  Tài liệu sẽ được khôi phục về trạng thái <strong>Đang lưu hành</strong>. Nếu số hiệu văn bản đang bị trùng với một tài liệu khác đang lưu hành, hệ thống sẽ từ chối khôi phục.
                </p>
              )}
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={confirmSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-sm font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAction()}
                disabled={confirmSubmitting}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-pill text-white text-sm font-semibold transition-colors disabled:opacity-60 ${
                  confirmModal.kind === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmModal.kind === 'archive'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {confirmModal.kind === 'delete'
                    ? 'Xác nhận xóa vĩnh viễn'
                    : confirmModal.kind === 'archive'
                    ? 'Chuyển lưu trữ'
                    : 'Khôi phục tài liệu'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
