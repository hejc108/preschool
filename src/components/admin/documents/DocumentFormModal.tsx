'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileEdit,
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
  DocumentCreationMode,
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
import {
  DOCUMENT_TEMPLATES,
  getDocumentTemplate,
} from '@/lib/documents/templates';
import { formatVietnameseAdminDate } from '@/lib/documents/docxGeneratorService';
import { DocumentRichTextEditor } from '@/components/admin/documents/DocumentRichTextEditor';

export interface DocumentFormModalProps {
  categories: DocumentCategory[];
  isSuperAdmin: boolean;
  editingDocument?: SchoolDocument | null;
  initialCreationMode?: DocumentCreationMode;
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
  initialCreationMode = 'ONLINE_EDITOR',
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
  const [creationMode, setCreationMode] = useState<DocumentCreationMode>(
    editingDocument?.creation_mode || initialCreationMode
  );
  const [editorTemplateCode, setEditorTemplateCode] = useState<string>(
    editingDocument?.editor_template_code || 'CONG_VAN'
  );
  const [editorContentHtml, setEditorContentHtml] = useState<string>(
    editingDocument?.editor_content_html || getDocumentTemplate('CONG_VAN').initialHtml
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractingDocx, setExtractingDocx] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Đồng bộ lại toàn bộ dữ liệu khi editingDocument thay đổi (đảm bảo không bao giờ bị trắng trang)
  useEffect(() => {
    let isCancelled = false;

    if (editingDocument) {
      setTitle(editingDocument.title || '');
      setDocumentNumber(editingDocument.document_number || '');
      setCategoryId(editingDocument.category_id || defaultCategoryId);
      setIssuedDate(editingDocument.issued_date || getTodayVietnamClient());
      setEffectiveDate(editingDocument.effective_date || '');
      setExpirationDate(editingDocument.expiration_date || '');
      setVisibilityScope(editingDocument.visibility_scope || 'ALL_ADMINS');
      setDescription(editingDocument.description || '');
      setStorageType(editingDocument.storage_type || 'SUPABASE_STORAGE');
      setExternalUrl(editingDocument.external_url || '');

      const isDocx =
        editingDocument.creation_mode === 'ONLINE_EDITOR' ||
        (editingDocument.storage_type === 'SUPABASE_STORAGE' &&
          Boolean(
            editingDocument.file_name?.toLowerCase().endsWith('.docx') ||
            editingDocument.storage_path?.toLowerCase().endsWith('.docx')
          ));

      setCreationMode(isDocx ? 'ONLINE_EDITOR' : (editingDocument.creation_mode || 'FILE_UPLOAD'));
      const tmplCode = editingDocument.editor_template_code || 'CONG_VAN';
      setEditorTemplateCode(tmplCode);
      setEditorContentHtml(
        editingDocument.editor_content_html || getDocumentTemplate(tmplCode).initialHtml
      );

      // Nếu là tệp .docx nhưng chưa có editor_content_html -> tự động trích xuất
      if (
        isDocx &&
        (!editingDocument.editor_content_html || editingDocument.editor_content_html.trim() === '')
      ) {
        setExtractingDocx(true);
        setExtractError(null);
        fetch(`/api/admin/documents/${editingDocument.id}/extract-html`, { cache: 'no-store' })
          .then((res) => res.json().catch(() => ({})))
          .then((json) => {
            if (!isCancelled && json.success && json.html) {
              setEditorContentHtml(json.html);
              setCreationMode('ONLINE_EDITOR');
              setEditorTemplateCode('BLANK');
            } else if (!isCancelled && json.message && !json.unsupportedReason) {
              setExtractError(json.message);
            }
          })
          .catch((err) => {
            if (!isCancelled) {
              setExtractError('Không thể tự động đọc nội dung file Word: ' + (err?.message || 'Lỗi mạng'));
            }
          })
          .finally(() => {
            if (!isCancelled) setExtractingDocx(false);
          });
      }
    } else {
      setCreationMode(initialCreationMode);
      setEditorTemplateCode('CONG_VAN');
      setEditorContentHtml(getDocumentTemplate('CONG_VAN').initialHtml);
      setExtractingDocx(false);
      setExtractError(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [editingDocument, defaultCategoryId, initialCreationMode]);

  const handleSelectTemplate = (code: string) => {
    setEditorTemplateCode(code);
    const tmpl = getDocumentTemplate(code);
    setEditorContentHtml(tmpl.initialHtml);
    // Gợi ý danh mục phù hợp nếu đang ở danh mục mặc định
    const matchedCategory = categories.find((c) => c.code === tmpl.categoryCodeFallback);
    if (matchedCategory) {
      setCategoryId(matchedCategory.id);
    }
  };
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'save_draft' | 'submit_for_approval' | null>(null);
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!editingDocument) {
      return Boolean(
        title.trim() ||
        selectedFile ||
        externalUrl.trim() ||
        (editorContentHtml &&
          editorContentHtml !== getDocumentTemplate(editorTemplateCode).initialHtml)
      );
    }
    return (
      title !== (editingDocument.title || '') ||
      documentNumber !== (editingDocument.document_number || '') ||
      categoryId !== (editingDocument.category_id || defaultCategoryId) ||
      issuedDate !== (editingDocument.issued_date || '') ||
      effectiveDate !== (editingDocument.effective_date || '') ||
      expirationDate !== (editingDocument.expiration_date || '') ||
      description !== (editingDocument.description || '') ||
      (editingDocument.creation_mode === 'ONLINE_EDITOR' &&
        editorContentHtml !== (editingDocument.editor_content_html || ''))
    );
  }, [
    title,
    documentNumber,
    categoryId,
    issuedDate,
    effectiveDate,
    expirationDate,
    description,
    editorContentHtml,
    editingDocument,
    defaultCategoryId,
    selectedFile,
    externalUrl,
    editorTemplateCode,
  ]);

  const handleBack = () => {
    if (isDirty) {
      if (
        !window.confirm(
          'Bạn có thay đổi chưa lưu trong văn bản. Bạn có chắc chắn muốn thoát về danh sách không?'
        )
      ) {
        return;
      }
    }
    onClose();
  };

  const isLongTerm = !expirationDate;
  const toggleLongTerm = (checked: boolean) => {
    if (checked) {
      setExpirationDate('');
    } else {
      const parts = issuedDate.split('-');
      if (parts.length === 3) {
        const nextYear = parseInt(parts[0], 10) + 1;
        setExpirationDate(`${nextYear}-${parts[1]}-${parts[2]}`);
      } else {
        setExpirationDate(getTodayVietnamClient());
      }
    }
  };

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

    if (creationMode === 'ONLINE_EDITOR') {
      if (!editorContentHtml.trim()) {
        setErrorMsg('Vui lòng nhập nội dung văn bản trước khi lưu.');
        return;
      }
    } else if (storageType === 'EXTERNAL_LINK') {
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
          ...(storageType === 'EXTERNAL_LINK'
            ? { external_url: externalUrl.trim() }
            : {}),
          ...(creationMode === 'ONLINE_EDITOR'
            ? {
                creation_mode: 'ONLINE_EDITOR',
                editor_content_html: editorContentHtml,
                editor_template_code: editorTemplateCode,
              }
            : {
                creation_mode: 'FILE_UPLOAD',
              }),
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

      // Create mode: ONLINE_EDITOR
      if (creationMode === 'ONLINE_EDITOR') {
        setUploadProgressLabel('Đang lưu văn bản soạn thảo...');
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
            storage_type: 'SUPABASE_STORAGE',
            creation_mode: 'ONLINE_EDITOR',
            editor_content_html: editorContentHtml,
            editor_template_code: editorTemplateCode,
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

      // Create mode: EXTERNAL_LINK
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

  if (creationMode === 'ONLINE_EDITOR') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden text-slate-800">
        {/* 1. Top Header Bar (h-14 bg-white border-b px-4 flex items-center justify-between gap-4 shrink-0 shadow-2xs z-20) */}
        <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0 shadow-2xs z-20">
          {/* Bên trái: Nút ← Quay lại + Input chỉnh sửa Tiêu đề + Badge trạng thái */}
          <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[62%]">
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold cursor-pointer shrink-0"
              title="Quay lại danh sách văn bản"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>

            <div className="h-5 w-px bg-slate-200 shrink-0" />

            <div className="min-w-0 flex-1 flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên văn bản / trích yếu nội dung..."
                className="w-full font-bold text-sm text-slate-900 placeholder-slate-400 bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-lg px-2.5 py-1.5 transition-all"
                required
              />
            </div>

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 whitespace-nowrap ${
                editingDocument
                  ? DOCUMENT_STATUS_META[editingDocument.status].badgeClass
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {editingDocument
                ? DOCUMENT_STATUS_META[editingDocument.status].label
                : 'Đang soạn thảo'}
            </span>
          </div>

          {/* Bên phải: Dropdown chọn Phôi mẫu (nếu tạo mới), Tải nháp .docx, Lưu nháp và Nút chính */}
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing && (
              <div className="flex items-center gap-1.5 text-xs mr-1">
                <span className="text-slate-500 font-medium hidden lg:inline">Phôi mẫu:</span>
                <select
                  value={editorTemplateCode}
                  onChange={(e) => {
                    const nextCode = e.target.value;
                    if (
                      editorContentHtml &&
                      editorContentHtml !== getDocumentTemplate(editorTemplateCode).initialHtml
                    ) {
                      if (
                        !window.confirm(
                          'Đổi mẫu sẽ thay thế nội dung đang soạn thảo bằng phôi mẫu mới. Bạn có chắc chắn muốn đổi?'
                        )
                      ) {
                        return;
                      }
                    }
                    handleSelectTemplate(nextCode);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-600 cursor-pointer"
                >
                  {DOCUMENT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.code} value={tmpl.code}>
                      {tmpl.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editingDocument?.id && (
              <a
                href={`/api/admin/documents/${editingDocument.id}/docx`}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                title="Tải tệp Word (.docx) bản thảo"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Tải nháp .docx</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => void submitDocument('save_draft')}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {submitting && submittingAction === 'save_draft' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>
                {submitting && submittingAction === 'save_draft'
                  ? uploadProgressLabel || 'Đang lưu...'
                  : isEditing
                  ? 'Lưu thay đổi'
                  : 'Lưu bản nháp'}
              </span>
            </button>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => void submitDocument('submit_for_approval')}
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && submittingAction === 'submit_for_approval' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {submitting && submittingAction === 'submit_for_approval'
                    ? uploadProgressLabel || 'Đang xử lý...'
                    : 'Trình duyệt'}
                </span>
              </button>
            ) : editingDocument?.status === 'DRAFT' ? (
              <button
                type="button"
                onClick={() => void submitDocument('submit_for_approval')}
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && submittingAction === 'submit_for_approval' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {submitting && submittingAction === 'submit_for_approval'
                    ? uploadProgressLabel || 'Đang trình...'
                    : 'Lưu & Trình duyệt'}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {/* 2. Main Workspace chia 2 cột (flex-1 overflow-hidden flex) */}
        <div className="flex-1 overflow-hidden flex">
          {/* Cột trái (70% - flex-1): Vùng soạn thảo trang A4 */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
            {extractingDocx && (
              <div className="p-2.5 bg-blue-50 border-b border-blue-200 text-blue-800 flex items-center justify-center gap-2 text-xs font-semibold animate-pulse shrink-0">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <span>Đang tự động đọc và trích xuất nội dung từ tệp Word (.docx) vào trình soạn thảo...</span>
              </div>
            )}
            {extractError && (
              <div className="p-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 flex items-center justify-center gap-2 text-xs shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{extractError}</span>
              </div>
            )}
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 flex items-center justify-center gap-2 text-xs font-semibold shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <DocumentRichTextEditor
                content={editorContentHtml}
                onChange={setEditorContentHtml}
                documentNumber={documentNumber || '.../2026/CV-MNSM'}
                dateLabel={formatVietnameseAdminDate(issuedDate)}
                isReadOnly={isEditing && editingDocument?.status === 'APPROVED'}
                layoutMode="fullscreen"
              />
            </div>
          </div>

          {/* Cột phải (30% - w-[360px]): Cài đặt & Thuộc tính văn bản */}
          <div className="w-[360px] bg-white border-l border-slate-200 overflow-y-auto p-5 shrink-0 flex flex-col space-y-4 text-xs shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Thuộc tính văn bản</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Thiết lập danh mục, số hiệu, ngày ban hành & hiệu lực
              </p>
            </div>

            {/* Danh mục */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Danh mục (*)</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none cursor-pointer"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Số hiệu văn bản */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Số hiệu văn bản <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Để trống nếu cấp số tự động khi duyệt"
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Hiệu trưởng phê duyệt sẽ tự động cấp số theo format XX/YYYY/KÝ_HIỆU nếu để trống.
              </p>
            </div>

            {/* Ngày ban hành */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Ngày ban hành</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            {/* Ngày có hiệu lực */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Ngày có hiệu lực <span className="font-normal text-slate-400">(tùy chọn)</span>
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
              />
            </div>

            {/* Ngày hết hiệu lực & Dài hạn */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">Ngày hết hiệu lực</label>
                <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-emerald-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={isLongTerm}
                    onChange={(e) => toggleLongTerm(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Dài hạn</span>
                </label>
              </div>
              {!isLongTerm ? (
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              ) : (
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Văn bản có hiệu lực dài hạn (không bị tự động hết hạn)</span>
                </div>
              )}
            </div>

            {/* Phạm vi bảo mật */}
            {isSuperAdmin && (
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Phạm vi bảo mật
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibilityScope('ALL_ADMINS')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      visibilityScope === 'ALL_ADMINS'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 mb-1 text-emerald-700" />
                    <div className="text-[11px] leading-tight">Ban Giám hiệu</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityScope('SUPER_ADMIN_ONLY')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      visibilityScope === 'SUPER_ADMIN_ONLY'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 mb-1 text-amber-700" />
                    <div className="text-[11px] leading-tight">Chỉ Super Admin</div>
                  </button>
                </div>
              </div>
            )}

            {/* Trích yếu / Ghi chú */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Ghi chú tóm tắt</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú nội dung chính hoặc đối tượng áp dụng..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none"
              />
            </div>

            {/* Thông tin tệp gốc (nếu có) */}
            {editingDocument?.file_name && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                <div className="font-semibold text-slate-700">Tệp gốc liên kết:</div>
                <div className="truncate mt-0.5">{editingDocument.file_name}</div>
              </div>
            )}

            {/* Chuyển sang tải file (nếu ở DRAFT hoặc tạo mới) */}
            {(!isEditing || editingDocument?.status === 'DRAFT') && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreationMode('FILE_UPLOAD')}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Chuyển sang chế độ tải tệp đính kèm</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chế độ FILE_UPLOAD: Modal dialog tiêu chuẩn gọn gàng
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-primary-700 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Cập nhật tệp văn bản đính kèm' : 'Tải tệp văn bản / Liên kết ngoài'}
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
                  ? 'Cập nhật tệp đính kèm, danh mục, thời hạn hoặc phạm vi bảo mật'
                  : 'Hỗ trợ tệp PDF, Word, Excel hoặc liên kết Google Workspace'}
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

          {/* Nút chuyển đổi sang Soạn thảo trực tuyến */}
          {(!isEditing || editingDocument?.status === 'DRAFT') && (
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-3 text-blue-950">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="font-semibold text-xs">
                  Bạn muốn soạn thảo trực tiếp trên Web chuẩn Nghị định 30?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCreationMode('ONLINE_EDITOR')}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                Mở Trình soạn thảo toàn màn hình
              </button>
            </div>
          )}

          {/* Segmented Control cho Cấp 2: Tải tệp vs Liên kết ngoài */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            {!isEditing ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                    Hình thức nguồn tệp
                  </span>
                  <span className="text-[11px] text-slate-400">Chọn nguồn tài liệu đính kèm</span>
                </div>
                <div className="p-1 rounded-xl bg-slate-200/80 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStorageType('SUPABASE_STORAGE');
                      setErrorMsg(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      storageType === 'SUPABASE_STORAGE'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải tệp từ máy (PDF, Word, Excel...)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStorageType('EXTERNAL_LINK');
                      setErrorMsg(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      storageType === 'EXTERNAL_LINK'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Gắn liên kết Google Workspace</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3">
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
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-xl bg-white hover:bg-rose-50/30 transition-colors cursor-pointer text-center">
                  <Upload className="w-5 h-5 text-primary-700 mb-1" />
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
                <label className="block font-bold text-slate-700 mb-1">
                  Đường dẫn liên kết ngoài (*)
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... hoặc https://docs.google.com/..."
                  className="w-full bg-white border border-slate-200 focus:border-primary-600 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Chỉ chấp nhận HTTPS thuộc Google Workspace (Drive, Docs, Sheets, Slides, Forms, Sites) hoặc mamnonsuongmai.edu.vn.
                </p>
              </div>
            )}
          </div>

          {/* Tên văn bản */}
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
                className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700">Ngày hết hiệu lực</label>
                <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] text-emerald-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={isLongTerm}
                    onChange={(e) => toggleLongTerm(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Dài hạn</span>
                </label>
              </div>
              {!isLongTerm ? (
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none"
                />
              ) : (
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Dài hạn</span>
                </div>
              )}
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
