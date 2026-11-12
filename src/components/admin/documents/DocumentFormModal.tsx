'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Globe,
  Info,
  Link2,
  Loader2,
  Lock,
  Save,
  Send,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import {
  DocumentCategory,
  DocumentStorageType,
  DocumentVisibilityScope,
  SchoolDocument,
} from '@/lib/types/schema';
import { getBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  DOCUMENT_BUCKET_NAME,
  DOCUMENT_STATUS_META,
  formatDocumentFileSize,
  validateDocumentFileMeta,
  validateEffectiveAndExpirationDates,
  validateExternalDocumentUrl,
} from '@/lib/documents/validation';

export interface DocumentFormModalProps {
  categories: DocumentCategory[];
  isSuperAdmin: boolean;
  editingDocument?: SchoolDocument | null;
  onClose: () => void;
  onSaved: (doc: SchoolDocument, message: string) => void;
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

export function DocumentFormModal({
  categories,
  isSuperAdmin,
  editingDocument,
  onClose,
  onSaved,
}: DocumentFormModalProps) {
  const isEditing = Boolean(editingDocument);
  const defaultCategoryId = useMemo(
    () => editingDocument?.category_id || categories[0]?.id || '',
    [editingDocument, categories]
  );

  const [title, setTitle] = useState(editingDocument?.title || '');
  const [documentNumber, setDocumentNumber] = useState(editingDocument?.document_number || '');
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [issuedDate, setIssuedDate] = useState(
    editingDocument?.issued_date || getTodayVietnamClient()
  );
  const [effectiveDate, setEffectiveDate] = useState(editingDocument?.effective_date || '');
  const [expirationDate, setExpirationDate] = useState(editingDocument?.expiration_date || '');
  const [visibilityScope, setVisibilityScope] = useState<DocumentVisibilityScope>(
    editingDocument?.visibility_scope || 'ALL_ADMINS'
  );
  const [description, setDescription] = useState(editingDocument?.description || '');
  const [storageType, setStorageType] = useState<DocumentStorageType>(
    editingDocument?.storage_type || 'SUPABASE_STORAGE'
  );
  const [externalUrl, setExternalUrl] = useState(editingDocument?.external_url || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'save_draft' | 'submit_for_approval' | null>(null);
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validation = validateDocumentFileMeta({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (!validation.ok) {
      setErrorMsg(validation.error);
      setSelectedFile(null);
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      const stripped = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (stripped) setTitle(stripped);
    }
  };

  const submitDocument = async (initialAction: 'save_draft' | 'submit_for_approval') => {
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Vui lòng nhập tên văn bản / trích yếu nội dung.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Vui lòng chọn danh mục văn bản.');
      return;
    }

    const cleanEffectiveDate = effectiveDate.trim() || null;
    const cleanExpirationDate = expirationDate.trim() || null;
    const dateRangeCheck = validateEffectiveAndExpirationDates(
      cleanEffectiveDate || issuedDate,
      cleanExpirationDate
    );
    if (!dateRangeCheck.ok) {
      setErrorMsg(dateRangeCheck.error);
      return;
    }

    if (storageType === 'EXTERNAL_LINK') {
      const urlCheck = validateExternalDocumentUrl(externalUrl);
      if (!urlCheck.ok) {
        setErrorMsg(urlCheck.error);
        return;
      }
    } else if (!isEditing) {
      if (!selectedFile) {
        setErrorMsg('Vui lòng chọn tệp tài liệu để tải lên.');
        return;
      }
      const fileCheck = validateDocumentFileMeta({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
      });
      if (!fileCheck.ok) {
        setErrorMsg(fileCheck.error);
        return;
      }
    }

    setSubmitting(true);
    setSubmittingAction(initialAction);
    try {
      if (isEditing && editingDocument) {
        setUploadProgressLabel('Đang cập nhật thông tin tài liệu...');
        const payload: Record<string, any> = {
          title: cleanTitle,
          document_number: documentNumber.trim() || null,
          category_id: categoryId,
          issued_date: issuedDate,
          effective_date: cleanEffectiveDate,
          expiration_date: cleanExpirationDate,
          description: description.trim() || null,
          ...(isSuperAdmin ? { visibility_scope: visibilityScope } : {}),
          ...(editingDocument.storage_type === 'EXTERNAL_LINK'
            ? { external_url: externalUrl.trim() }
            : {}),
        };

        const res = await fetch(`/api/admin/documents/${editingDocument.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setErrorMsg(json.message || json.error || `Không thể cập nhật tài liệu (${res.status}).`);
          return;
        }
        onSaved(json.document as SchoolDocument, 'Đã cập nhật thông tin tài liệu thành công.');
        return;
      }

      const successMsg =
        initialAction === 'submit_for_approval'
          ? 'Đã tạo tài liệu và gửi trình Hiệu trưởng phê duyệt.'
          : 'Đã lưu tài liệu dưới dạng Bản nháp (DRAFT).';

      // Create mode
      if (storageType === 'EXTERNAL_LINK') {
        setUploadProgressLabel('Đang lưu liên kết tài liệu...');
        const res = await fetch('/api/admin/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cleanTitle,
            document_number: documentNumber.trim() || null,
            category_id: categoryId,
            issued_date: issuedDate,
            effective_date: cleanEffectiveDate,
            expiration_date: cleanExpirationDate,
            description: description.trim() || null,
            visibility_scope: isSuperAdmin ? visibilityScope : 'ALL_ADMINS',
            storage_type: 'EXTERNAL_LINK',
            external_url: externalUrl.trim(),
            initial_action: initialAction,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setErrorMsg(json.message || json.error || `Không thể tạo tài liệu (${res.status}).`);
          return;
        }
        onSaved(json.document as SchoolDocument, successMsg);
        return;
      }

      // SUPABASE_STORAGE upload: ưu tiên Signed Upload URL (hỗ trợ tối đa 25MB), fallback multipart nếu <= 4MB
      if (!selectedFile) return;

      let uploadedPath: string | null = null;
      let normalizedMime = selectedFile.type;

      setUploadProgressLabel('Đang khởi tạo phiên tải tệp bảo mật...');
      const tokenRes = await fetch('/api/admin/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
        }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));

      if (tokenRes.ok && tokenJson.success && tokenJson.storage_path && tokenJson.token) {
        setUploadProgressLabel('Đang tải tệp lên kho lưu trữ...');
        const sb = await getBrowserSupabaseClient();
        const { error: uploadErr } = await sb.storage
          .from(DOCUMENT_BUCKET_NAME)
          .uploadToSignedUrl(tokenJson.storage_path, tokenJson.token, selectedFile, {
            contentType: tokenJson.mime_type || selectedFile.type || 'application/octet-stream',
          });

        if (!uploadErr) {
          uploadedPath = tokenJson.storage_path;
          normalizedMime = tokenJson.mime_type || selectedFile.type;
        } else if (selectedFile.size > 4 * 1024 * 1024) {
          setErrorMsg(
            `Không thể tải tệp lên Supabase Storage: ${uploadErr.message}. Vui lòng kiểm tra bucket private school-documents.`
          );
          return;
        }
      } else if (selectedFile.size > 4 * 1024 * 1024) {
        setErrorMsg(
          tokenJson.message ||
            tokenJson.error ||
            'Không thể tải tệp lớn (>4MB) do chưa khởi tạo được Signed Upload URL.'
        );
        return;
      }

      setUploadProgressLabel('Đang lưu hồ sơ tài liệu...');
      let createRes: Response;
      if (uploadedPath) {
        createRes = await fetch('/api/admin/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cleanTitle,
            document_number: documentNumber.trim() || null,
            category_id: categoryId,
            issued_date: issuedDate,
            effective_date: cleanEffectiveDate,
            expiration_date: cleanExpirationDate,
            description: description.trim() || null,
            visibility_scope: isSuperAdmin ? visibilityScope : 'ALL_ADMINS',
            storage_type: 'SUPABASE_STORAGE',
            storage_path: uploadedPath,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            mime_type: normalizedMime,
            initial_action: initialAction,
          }),
        });
      } else {
        const fd = new FormData();
        fd.append('title', cleanTitle);
        if (documentNumber.trim()) fd.append('document_number', documentNumber.trim());
        fd.append('category_id', categoryId);
        fd.append('issued_date', issuedDate);
        if (cleanEffectiveDate) fd.append('effective_date', cleanEffectiveDate);
        if (cleanExpirationDate) fd.append('expiration_date', cleanExpirationDate);
        if (description.trim()) fd.append('description', description.trim());
        fd.append('visibility_scope', isSuperAdmin ? visibilityScope : 'ALL_ADMINS');
        fd.append('storage_type', 'SUPABASE_STORAGE');
        fd.append('initial_action', initialAction);
        fd.append('file', selectedFile);
        createRes = await fetch('/api/admin/documents', {
          method: 'POST',
          body: fd,
        });
      }

      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createJson.success) {
        setErrorMsg(
          createJson.message || createJson.error || `Không thể lưu tài liệu (${createRes.status}).`
        );
        return;
      }

      onSaved(createJson.document as SchoolDocument, successMsg);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi kết nối khi lưu tài liệu.');
    } finally {
      setSubmitting(false);
      setSubmittingAction(null);
      setUploadProgressLabel('');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitDocument(isEditing ? 'save_draft' : 'submit_for_approval');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-primary-700 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Chỉnh sửa thông tin tài liệu' : 'Thêm tài liệu / văn bản mới'}
                </h2>
                {isEditing && editingDocument && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      DOCUMENT_STATUS_META[editingDocument.status].badgeClass
                    }`}
                  >
                    {DOCUMENT_STATUS_META[editingDocument.status].label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Cập nhật trích yếu, số hiệu, hiệu lực, danh mục hoặc phạm vi hiển thị'
                  : 'Tài liệu mới được tạo ở Bản nháp (DRAFT) hoặc Trình duyệt (SUBMITTED)'}
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {!isEditing && (
            <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-900 flex items-start gap-2 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <span>
                Theo quy trình phê duyệt, tài liệu nháp chưa đồng bộ lên Google Drive. Sau khi Hiệu trưởng <strong>Phê duyệt (APPROVED)</strong>, hệ thống mới cấp số hiệu chính thức (nếu để trống) và tự động sao lưu Drive.
              </span>
            </div>
          )}

          {/* Storage Type Selector (Create only) */}
          {!isEditing ? (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Hình thức lưu trữ (*)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStorageType('SUPABASE_STORAGE');
                    setErrorMsg(null);
                  }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    storageType === 'SUPABASE_STORAGE'
                      ? 'bg-rose-50 border-primary-600 text-primary-900 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">Tải tệp lên hệ thống</div>
                    <div className="text-[11px] opacity-80">PDF, Word, Excel, Ảnh (≤ 25MB)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStorageType('EXTERNAL_LINK');
                    setErrorMsg(null);
                  }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    storageType === 'EXTERNAL_LINK'
                      ? 'bg-rose-50 border-primary-600 text-primary-900 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">Gắn liên kết ngoài</div>
                    <div className="text-[11px] opacity-80">Google Drive / Docs / mamnonsuongmai.edu.vn</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-700">
                {editingDocument?.storage_type === 'EXTERNAL_LINK' ? (
                  <>
                    <Link2 className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="font-semibold">Nguồn: Liên kết Google Workspace / Ngoài</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-primary-700 shrink-0" />
                    <div>
                      <span className="font-semibold">{editingDocument?.file_name || 'Tệp đính kèm'}</span>
                      <span className="text-slate-400 ml-2">
                        ({formatDocumentFileSize(editingDocument?.file_size)})
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* File Picker or External URL */}
          {!isEditing && storageType === 'SUPABASE_STORAGE' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Chọn tệp đính kèm (*)
              </label>
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-xl bg-slate-50/70 hover:bg-rose-50/30 transition-colors cursor-pointer text-center">
                <Upload className="w-6 h-6 text-primary-700 mb-1.5" />
                {selectedFile ? (
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-800">{selectedFile.name}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      {formatDocumentFileSize(selectedFile.size)} • Sẵn sàng tải lên
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-700">Nhấn để chọn tệp từ máy tính</p>
                    <p className="text-[11px] text-slate-400">
                      Chấp nhận: .pdf, .doc, .docx, .xls, .xlsx, .png, .jpg (Tối đa 25MB)
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {storageType === 'EXTERNAL_LINK' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Đường dẫn liên kết ngoài (*)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... hoặc https://docs.google.com/..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Chỉ chấp nhận HTTPS thuộc Google Workspace (Drive, Docs, Sheets, Slides, Forms, Sites) hoặc mamnonsuongmai.edu.vn.
              </p>
            </div>
          )}

          {/* Metadata Fields */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Tên văn bản / Trích yếu nội dung (*)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kế hoạch chăm sóc giáo dục năm học 2026 - 2027"
              className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Danh mục (*)</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Số hiệu văn bản <span className="font-normal text-slate-400">(tùy chọn khi tạo)</span>
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Để trống nếu cấp số tự động khi duyệt"
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Ngày ban hành</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Ngày có hiệu lực <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Ngày hết hiệu lực <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Để trống nếu văn bản có hiệu lực dài hạn
              </p>
            </div>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Phạm vi hiển thị & bảo mật
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVisibilityScope('ALL_ADMINS')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    visibilityScope === 'ALL_ADMINS'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">Toàn Ban Giám hiệu</div>
                    <div className="text-[11px] opacity-80">Super Admin & School Admin đều xem được</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibilityScope('SUPER_ADMIN_ONLY')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    visibilityScope === 'SUPER_ADMIN_ONLY'
                      ? 'bg-amber-50 border-amber-500 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">Chỉ Super Admin</div>
                    <div className="text-[11px] opacity-80">Tài liệu mật, ẩn hoàn toàn với School Admin</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {!isSuperAdmin && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
              <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Tài liệu do Quản trị trường tạo mặc định hiển thị cho toàn Ban Giám hiệu.</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Ghi chú tóm tắt</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nội dung chính, đối tượng áp dụng hoặc ghi chú lưu trữ..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-pill border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            {isEditing ? (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-pill bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white font-bold shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>
                  {submitting ? uploadProgressLabel || 'Đang xử lý...' : 'Lưu thay đổi'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void submitDocument('save_draft')}
                  disabled={submitting}
                  className="px-4 py-2 rounded-pill border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting && submittingAction === 'save_draft' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {submitting && submittingAction === 'save_draft'
                      ? uploadProgressLabel || 'Đang lưu...'
                      : 'Lưu bản nháp'}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-pill bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white font-bold shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  {submitting && submittingAction === 'submit_for_approval' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {submitting && submittingAction === 'submit_for_approval'
                      ? uploadProgressLabel || 'Đang xử lý...'
                      : 'Lưu & Trình duyệt'}
                  </span>
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
