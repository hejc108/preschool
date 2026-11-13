import { normalizeVietnameseSearch } from '@/lib/utils/textSearch';
import {
  DocumentAuditAction,
  DocumentStatus,
  DocumentWorkflowAction,
  SchoolDocument,
  UserRole,
} from '@/lib/types/schema';

export const DOCUMENT_BUCKET_NAME = 'school-documents';
export const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const SIGNED_URL_TTL_SECONDS = 3600; // 60 phút

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
] as const;

export const EXTENSION_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const COMPATIBLE_MIMES_BY_EXT: Record<string, string[]> = {
  '.pdf': ['application/pdf', 'application/x-pdf'],
  '.doc': ['application/msword', 'application/doc', 'application/vnd.ms-word'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  '.xls': ['application/vnd.ms-excel', 'application/msexcel', 'application/x-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
};

export const ALLOWED_GOOGLE_WORKSPACE_HOSTS = [
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'forms.google.com',
  'sites.google.com',
] as const;

export const SCHOOL_DOMAIN = 'mamnonsuongmai.edu.vn';

export function getFileExtension(fileName: string): string {
  const trimmed = (fileName || '').trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return '';
  return trimmed.slice(lastDot).toLowerCase();
}

export function validateDocumentFileMeta(params: {
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
}):
  | { ok: true; ext: string; normalizedMime: string }
  | { ok: false; code: string; error: string } {
  const fileName = (params.fileName || '').trim();
  if (!fileName) {
    return { ok: false, code: 'MISSING_FILE_NAME', error: 'Thiếu tên tệp tải lên.' };
  }

  const ext = getFileExtension(fileName);
  if (!(ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_FILE_TYPE',
      error:
        'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận: .pdf, .doc, .docx, .xls, .xlsx, .png, .jpg.',
    };
  }

  if (!Number.isFinite(params.fileSize) || params.fileSize <= 0) {
    return { ok: false, code: 'EMPTY_FILE', error: 'Tệp tải lên rỗng hoặc kích thước không hợp lệ.' };
  }

  if (params.fileSize > MAX_DOCUMENT_FILE_SIZE) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      error: 'Dung lượng tệp vượt quá giới hạn tối đa 25MB.',
    };
  }

  const rawMime = (params.mimeType || '').split(';')[0].trim().toLowerCase();
  if (rawMime && rawMime !== 'application/octet-stream') {
    const allowedMimes = COMPATIBLE_MIMES_BY_EXT[ext] || [];
    if (!allowedMimes.includes(rawMime)) {
      return {
        ok: false,
        code: 'MIME_MISMATCH',
        error: `Loại MIME (${rawMime}) không khớp với phần mở rộng ${ext}.`,
      };
    }
  }

  return {
    ok: true,
    ext,
    normalizedMime: EXTENSION_TO_MIME[ext] || 'application/octet-stream',
  };
}

export function validateExternalDocumentUrl(
  rawUrl: string
): { ok: true; url: string } | { ok: false; code: string; error: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { ok: false, code: 'MISSING_EXTERNAL_URL', error: 'Vui lòng nhập liên kết ngoài.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      code: 'INVALID_EXTERNAL_URL',
      error: 'Liên kết ngoài không đúng định dạng URL.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      code: 'INSECURE_EXTERNAL_URL',
      error: 'Liên kết ngoài bắt buộc sử dụng giao thức HTTPS.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isGoogleWorkspaceHost = (ALLOWED_GOOGLE_WORKSPACE_HOSTS as readonly string[]).includes(
    host
  );
  const isSchoolDomain = host === SCHOOL_DOMAIN || host.endsWith(`.${SCHOOL_DOMAIN}`);

  if (!isGoogleWorkspaceHost && !isSchoolDomain) {
    return {
      ok: false,
      code: 'DISALLOWED_EXTERNAL_DOMAIN',
      error: `Chỉ chấp nhận liên kết Google Workspace (Drive, Docs, Sheets, Slides, Forms, Sites) hoặc tên miền ${SCHOOL_DOMAIN}.`,
    };
  }

  return { ok: true, url: parsed.toString() };
}

export function normalizeDocumentNumber(raw: string | null | undefined): string | null {
  const cleaned = String(raw || '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeIssuedDate(raw: string | null | undefined, fallbackToday: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return fallbackToday;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '';
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return '';
  }
  return trimmed;
}

export function extractDocumentYear(issuedDate?: string | null): string {
  const match = String(issuedDate || '').match(/^(\d{4})-/);
  if (match) return match[1];
  return String(new Date().getFullYear());
}

export function buildSafeStorageFileName(fileName: string): string {
  const ext = getFileExtension(fileName);
  const baseRaw = ext ? fileName.slice(0, -ext.length) : fileName;
  const asciiBase = normalizeVietnameseSearch(baseRaw)
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  const safeBase = asciiBase || 'document';
  return `${safeBase}${ext}`;
}

export function buildCategoryCodeFromName(name: string): string {
  const ascii = normalizeVietnameseSearch(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 40);
  return ascii || `CAT_${Date.now().toString(36).toUpperCase()}`;
}

export function getDocumentPreviewKind(
  doc: Pick<SchoolDocument, 'storage_type' | 'file_name' | 'mime_type'> & {
    creation_mode?: string | null;
  }
): 'pdf' | 'image' | 'download' | 'external' | 'editor' {
  if (doc.creation_mode === 'ONLINE_EDITOR') return 'editor';
  if (doc.storage_type === 'EXTERNAL_LINK') return 'external';
  const ext = getFileExtension(doc.file_name || '');
  const mime = (doc.mime_type || '').toLowerCase();
  if (ext === '.pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || mime.startsWith('image/')) {
    return 'image';
  }
  return 'download';
}

export function formatDocumentFileSize(bytes?: number | null): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

// --- PHẦN SRS WORKFLOW 6 TRẠNG THÁI & SỐ HIỆU TỰ ĐỘNG ---

export const DOCUMENT_STATUS_ORDER: readonly DocumentStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'WITHDRAWN',
  'SUPERSEDED',
  'EXPIRED',
] as const;

export const DOCUMENT_STATUS_META: Record<
  DocumentStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  DRAFT: {
    label: 'Đang soạn thảo',
    shortLabel: 'Soạn thảo',
    description: 'Văn bản nháp, chưa trình duyệt và chưa sao lưu Drive',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  SUBMITTED: {
    label: 'Đã trình duyệt',
    shortLabel: 'Chờ duyệt',
    description: 'Đang chờ Hiệu trưởng (Super Admin) kiểm tra & phê duyệt',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  APPROVED: {
    label: 'Đã phê duyệt',
    shortLabel: 'Đã duyệt',
    description: 'Có hiệu lực lưu hành chính thức & tự động sao lưu Google Drive',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  WITHDRAWN: {
    label: 'Từ chối / Thu hồi',
    shortLabel: 'Thu hồi',
    description: 'Văn bản bị từ chối khi duyệt hoặc thu hồi khẩn cấp',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  SUPERSEDED: {
    label: 'Đã bị thay thế',
    shortLabel: 'Thay thế',
    description: 'Đã được thay thế bởi một văn bản phê duyệt mới hơn',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  EXPIRED: {
    label: 'Hết hiệu lực',
    shortLabel: 'Hết hạn',
    description: 'Đã quá ngày hết hiệu lực (expiration_date < ngày hiện tại)',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

export const DOCUMENT_AUDIT_ACTION_LABELS: Record<DocumentAuditAction, string> = {
  CREATE_DRAFT: 'Tạo văn bản nháp',
  UPDATE_METADATA: 'Cập nhật thông tin',
  SUBMIT: 'Trình duyệt văn bản',
  APPROVE: 'Phê duyệt ban hành',
  REJECT: 'Từ chối phê duyệt',
  SUPERSEDE: 'Thay thế bởi văn bản mới',
  WITHDRAW: 'Thu hồi khẩn cấp',
  EXPIRE: 'Chuyển hết hiệu lực',
  AUTO_EXPIRE: 'Tự động hết hiệu lực theo hạn',
  DRIVE_SYNC: 'Đồng bộ Google Drive',
};

const CATEGORY_SYMBOL_MAP: Record<string, string> = {
  CV_DEN_DI: 'CV-MNSM',
  KE_HOACH: 'KH-MNSM',
  KIEM_DINH: 'KD-MNSM',
  QUY_CHE: 'QC-MNSM',
  Y_TE_BEP: 'YT-MNSM',
  BIEU_MAU: 'BM-MNSM',
};

export const COMMON_DOCUMENT_SYMBOLS = [
  'CV-MNSM',
  'QĐ-MNSM',
  'KH-MNSM',
  'KD-MNSM',
  'QC-MNSM',
  'YT-MNSM',
  'BM-MNSM',
  'TB-MNSM',
  'BC-MNSM',
] as const;

export function getDefaultDocumentSymbolForCategory(categoryCode?: string | null): string {
  const code = String(categoryCode || '').trim().toUpperCase();
  if (code && CATEGORY_SYMBOL_MAP[code]) {
    return CATEGORY_SYMBOL_MAP[code];
  }
  if (code) {
    const letters = code.replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (letters) return `${letters}-MNSM`;
  }
  return 'CV-MNSM';
}

export function formatSequentialDocumentNumber(
  seq: number,
  year: string | number,
  symbol: string
): string {
  const cleanSeq = Math.max(1, Math.floor(seq));
  const padded = cleanSeq < 10 ? `0${cleanSeq}` : String(cleanSeq);
  const cleanSymbol = (symbol || 'CV-MNSM').trim().toUpperCase() || 'CV-MNSM';
  return `${padded}/${year}/${cleanSymbol}`;
}

export function normalizeOptionalDate(
  raw: string | null | undefined
): { ok: true; date: string | null } | { ok: false; error: string } {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: true, date: null };
  const parsed = normalizeIssuedDate(trimmed, '');
  if (!parsed) {
    return { ok: false, error: 'Ngày tháng phải đúng định dạng YYYY-MM-DD.' };
  }
  return { ok: true, date: parsed };
}

export function validateEffectiveAndExpirationDates(
  effectiveDate: string | null | undefined,
  expirationDate: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (effectiveDate && expirationDate && expirationDate < effectiveDate) {
    return {
      ok: false,
      error: 'Ngày hết hiệu lực (expiration_date) phải lớn hơn hoặc bằng ngày có hiệu lực.',
    };
  }
  return { ok: true };
}

export type WorkflowTransitionRule = {
  action: DocumentWorkflowAction;
  auditAction: DocumentAuditAction;
  allowedFrom: readonly DocumentStatus[];
  toStatus: DocumentStatus;
  allowedRoles: readonly UserRole[];
  requiresReason?: boolean;
  requiresSupersededBy?: boolean;
};

export const WORKFLOW_TRANSITION_RULES: Record<DocumentWorkflowAction, WorkflowTransitionRule> = {
  submit_for_approval: {
    action: 'submit_for_approval',
    auditAction: 'SUBMIT',
    allowedFrom: ['DRAFT'],
    toStatus: 'SUBMITTED',
    allowedRoles: ['SCHOOL_ADMIN', 'SUPER_ADMIN'],
  },
  approve: {
    action: 'approve',
    auditAction: 'APPROVE',
    allowedFrom: ['SUBMITTED'],
    toStatus: 'APPROVED',
    allowedRoles: ['SUPER_ADMIN'],
  },
  reject: {
    action: 'reject',
    auditAction: 'REJECT',
    allowedFrom: ['SUBMITTED'],
    toStatus: 'WITHDRAWN',
    allowedRoles: ['SUPER_ADMIN'],
    requiresReason: true,
  },
  supersede: {
    action: 'supersede',
    auditAction: 'SUPERSEDE',
    allowedFrom: ['APPROVED'],
    toStatus: 'SUPERSEDED',
    allowedRoles: ['SUPER_ADMIN'],
    requiresSupersededBy: true,
  },
  withdraw: {
    action: 'withdraw',
    auditAction: 'WITHDRAW',
    allowedFrom: ['APPROVED'],
    toStatus: 'WITHDRAWN',
    allowedRoles: ['SUPER_ADMIN'],
    requiresReason: true,
  },
  expire: {
    action: 'expire',
    auditAction: 'EXPIRE',
    allowedFrom: ['APPROVED'],
    toStatus: 'EXPIRED',
    allowedRoles: ['SUPER_ADMIN'],
  },
};

export function validateWorkflowTransition(params: {
  fromStatus: DocumentStatus;
  action: string;
  activeRole: UserRole;
}):
  | { ok: true; rule: WorkflowTransitionRule }
  | { ok: false; status: number; code: string; error: string } {
  const actionKey = String(params.action || '').trim() as DocumentWorkflowAction;
  const rule = (WORKFLOW_TRANSITION_RULES as Record<string, WorkflowTransitionRule | undefined>)[
    actionKey
  ];

  if (!rule) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_WORKFLOW_ACTION',
      error: 'Thao tác chuyển trạng thái văn bản không hợp lệ.',
    };
  }

  if (!rule.allowedRoles.includes(params.activeRole)) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_WORKFLOW_ROLE',
      error: 'Chỉ Hiệu trưởng (Super Admin) mới có quyền thực hiện thao tác phê duyệt/thu hồi/thay thế văn bản.',
    };
  }

  if (!rule.allowedFrom.includes(params.fromStatus)) {
    const currentLabel = DOCUMENT_STATUS_META[params.fromStatus]?.label || params.fromStatus;
    return {
      ok: false,
      status: 409,
      code: 'INVALID_STATUS_TRANSITION',
      error: `Không thể thực hiện thao tác "${actionKey}" khi tài liệu đang ở trạng thái "${currentLabel}" (${params.fromStatus}).`,
    };
  }

  return { ok: true, rule };
}

