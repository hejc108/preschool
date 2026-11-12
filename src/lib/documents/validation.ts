import { normalizeVietnameseSearch } from '@/lib/utils/textSearch';
import { SchoolDocument } from '@/lib/types/schema';

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
  doc: Pick<SchoolDocument, 'storage_type' | 'file_name' | 'mime_type'>
): 'pdf' | 'image' | 'download' | 'external' {
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
