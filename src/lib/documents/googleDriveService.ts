import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { cleanEnv } from '@/lib/supabase/server';
import { DocumentCategory, DocumentDriveSyncStatus, SchoolDocument } from '@/lib/types/schema';
import { DOCUMENT_BUCKET_NAME, extractDocumentYear } from '@/lib/documents/validation';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_REQUEST_TIMEOUT_MS = 15000;

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface DriveTokenCacheEntry {
  token: string;
  expiresAt: number;
}

declare global {
  var __SUONGMAI_DRIVE_TOKEN_CACHE__: Map<string, DriveTokenCacheEntry> | undefined;
}

if (!globalThis.__SUONGMAI_DRIVE_TOKEN_CACHE__) {
  globalThis.__SUONGMAI_DRIVE_TOKEN_CACHE__ = new Map();
}

export interface DriveSyncOutcome {
  drive_sync_status: DocumentDriveSyncStatus;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  drive_synced_at: string | null;
  drive_sync_error: string | null;
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function parseServiceAccountCredentials(rawKey: string | undefined): ServiceAccountCredentials | null {
  const cleaned = cleanEnv(rawKey);
  if (!cleaned) return null;

  const tryParseJson = (jsonText: string): ServiceAccountCredentials | null => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') return null;
      const clientEmail = String(parsed.client_email || '').trim();
      const privateKey = String(parsed.private_key || '').replace(/\\n/g, '\n').trim();
      if (!clientEmail || !privateKey.includes('-----BEGIN')) return null;
      return { client_email: clientEmail, private_key: privateKey };
    } catch {
      return null;
    }
  };

  if (cleaned.startsWith('{')) {
    return tryParseJson(cleaned);
  }

  // Hỗ trợ cấu hình GOOGLE_SERVICE_ACCOUNT_KEY dạng Base64 JSON
  try {
    const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
    return tryParseJson(decoded);
  } catch {
    return null;
  }
}

export function getGoogleDriveArchiveConfig(): {
  configured: boolean;
  rootFolderId: string;
  credentials: ServiceAccountCredentials | null;
  missingReason?: string;
} {
  const rootFolderId = cleanEnv(process.env.GOOGLE_DRIVE_ARCHIVE_ROOT_FOLDER_ID);
  const credentials = parseServiceAccountCredentials(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  if (!rootFolderId && !credentials) {
    return {
      configured: false,
      rootFolderId: '',
      credentials: null,
      missingReason:
        'Chưa cấu hình GOOGLE_DRIVE_ARCHIVE_ROOT_FOLDER_ID và GOOGLE_SERVICE_ACCOUNT_KEY.',
    };
  }
  if (!rootFolderId) {
    return {
      configured: false,
      rootFolderId: '',
      credentials,
      missingReason: 'Chưa cấu hình GOOGLE_DRIVE_ARCHIVE_ROOT_FOLDER_ID.',
    };
  }
  if (!credentials) {
    return {
      configured: false,
      rootFolderId,
      credentials: null,
      missingReason: 'GOOGLE_SERVICE_ACCOUNT_KEY chưa cấu hình hoặc không đúng định dạng JSON/Base64.',
    };
  }

  return {
    configured: true,
    rootFolderId,
    credentials,
  };
}

async function getGoogleDriveAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const cache = globalThis.__SUONGMAI_DRIVE_TOKEN_CACHE__!;
  const cached = cache.get(credentials.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: GOOGLE_DRIVE_SCOPE,
      aud: GOOGLE_TOKEN_ENDPOINT,
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(credentials.private_key);
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
    signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `OAuth2 token error (${res.status})`);
  }

  const expiresInMs = Number(json.expires_in || 3600) * 1000;
  cache.set(credentials.client_email, {
    token: json.access_token,
    expiresAt: Date.now() + expiresInMs,
  });
  return json.access_token;
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function extractDriveError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.message || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

async function findOrCreateDriveFolder(
  token: string,
  parentId: string,
  folderName: string
): Promise<string> {
  const safeName = folderName.trim() || 'Khác';
  const query = [
    `name = '${escapeDriveQueryLiteral(safeName)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'${escapeDriveQueryLiteral(parentId)}' in parents`,
    'trashed = false',
  ].join(' and ');

  const searchUrl = `${GOOGLE_DRIVE_API_BASE}?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
  });

  if (!searchRes.ok) {
    throw new Error(`Không thể tìm thư mục Drive "${safeName}": ${await extractDriveError(searchRes)}`);
  }

  const searchJson = await searchRes.json().catch(() => ({}));
  const existing = Array.isArray(searchJson.files) ? searchJson.files[0] : null;
  if (existing?.id) {
    return existing.id as string;
  }

  const createRes = await fetch(`${GOOGLE_DRIVE_API_BASE}?supportsAllDrives=true&fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
    signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
  });

  if (!createRes.ok) {
    throw new Error(`Không thể tạo thư mục Drive "${safeName}": ${await extractDriveError(createRes)}`);
  }

  const created = await createRes.json();
  if (!created?.id) {
    throw new Error(`Google Drive không trả về ID thư mục "${safeName}".`);
  }
  return created.id as string;
}

function buildDriveDocumentName(doc: SchoolDocument): string {
  const cleanNumber = (doc.document_number || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-');

  const rawBase =
    doc.storage_type === 'SUPABASE_STORAGE'
      ? (doc.file_name || doc.title || 'Tai_lieu').trim()
      : `${(doc.title || 'Tai_lieu').trim()} (Liên kết tham chiếu)`;

  if (!cleanNumber) return rawBase.slice(0, 160);
  const prefix = `[${cleanNumber}] `;
  if (rawBase.startsWith(prefix)) return rawBase.slice(0, 160);
  return `${prefix}${rawBase}`.slice(0, 160);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExternalReferenceHtml(doc: SchoolDocument, categoryName: string): string {
  const docNumber = doc.document_number ? escapeHtml(doc.document_number) : 'Không có';
  const description = doc.description ? escapeHtml(doc.description) : 'Không có ghi chú';
  const safeUrl = escapeHtml(doc.external_url || '');
  const scopeLabel =
    doc.visibility_scope === 'SUPER_ADMIN_ONLY'
      ? 'Chỉ Super Admin (Nội bộ mật)'
      : 'Toàn Ban Giám hiệu (ALL_ADMINS)';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
  <h2>HỒ SƠ LƯU TRỮ LIÊN KẾT VĂN BẢN — MẦM NON SƯƠNG MAI</h2>
  <hr />
  <p><strong>Tên văn bản:</strong> ${escapeHtml(doc.title)}</p>
  <p><strong>Số hiệu văn bản:</strong> ${docNumber}</p>
  <p><strong>Danh mục:</strong> ${escapeHtml(categoryName)}</p>
  <p><strong>Ngày ban hành:</strong> ${escapeHtml(doc.issued_date)}</p>
  <p><strong>Phạm vi bảo mật:</strong> ${escapeHtml(scopeLabel)}</p>
  <p><strong>Ghi chú tóm tắt:</strong> ${description}</p>
  <p><strong>Liên kết gốc:</strong> <a href="${safeUrl}">${safeUrl}</a></p>
  <hr />
  <p style="font-size: 12px; color: #64748b;">Tệp tham chiếu được tạo tự động từ hệ thống Quản lý Tài liệu Admin Web.</p>
</body>
</html>`;
}

async function getExistingDriveFile(
  token: string,
  fileId: string
): Promise<{ id: string; parents?: string[]; trashed?: boolean; webViewLink?: string } | null> {
  const res = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/${encodeURIComponent(
      fileId
    )}?fields=id,name,parents,trashed,webViewLink&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.id || json.trashed) return null;
  return json;
}

async function uploadBinaryResumable(params: {
  token: string;
  existingFileId?: string | null;
  parentId?: string;
  removeParents?: string[];
  fileName: string;
  mimeType: string;
  description: string;
  buffer: Buffer;
}): Promise<{ id: string; webViewLink: string }> {
  const isUpdate = Boolean(params.existingFileId);
  const query = new URLSearchParams({
    uploadType: 'resumable',
    supportsAllDrives: 'true',
    fields: 'id,name,webViewLink',
  });
  if (isUpdate && params.parentId) {
    query.set('addParents', params.parentId);
    if (params.removeParents && params.removeParents.length > 0) {
      query.set('removeParents', params.removeParents.join(','));
    }
  }

  const endpoint = isUpdate
    ? `${GOOGLE_DRIVE_UPLOAD_BASE}/${encodeURIComponent(params.existingFileId!)}?${query.toString()}`
    : `${GOOGLE_DRIVE_UPLOAD_BASE}?${query.toString()}`;

  const metadata: Record<string, any> = {
    name: params.fileName,
    description: params.description,
  };
  if (!isUpdate && params.parentId) {
    metadata.parents = [params.parentId];
  }

  const initRes = await fetch(endpoint, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': params.mimeType,
      'X-Upload-Content-Length': String(params.buffer.byteLength),
    },
    body: JSON.stringify(metadata),
    signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
  });

  if (!initRes.ok) {
    throw new Error(`Không thể khởi tạo upload Drive: ${await extractDriveError(initRes)}`);
  }

  const sessionUri = initRes.headers.get('location');
  if (!sessionUri) {
    throw new Error('Google Drive không trả về Location URI cho phiên upload.');
  }

  const putRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      'Content-Type': params.mimeType,
      'Content-Length': String(params.buffer.byteLength),
    },
    body: new Uint8Array(params.buffer),
    signal: AbortSignal.timeout(60_000),
  });

  if (!putRes.ok) {
    throw new Error(`Upload tệp lên Google Drive thất bại: ${await extractDriveError(putRes)}`);
  }

  const uploaded = await putRes.json();
  return {
    id: uploaded.id,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
  };
}

async function uploadGoogleDocMultipart(params: {
  token: string;
  parentId: string;
  name: string;
  description: string;
  htmlContent: string;
}): Promise<{ id: string; webViewLink: string }> {
  const boundary = `suongmai_drive_${Date.now().toString(36)}`;
  const metadataPart = JSON.stringify({
    name: params.name,
    mimeType: 'application/vnd.google-apps.document',
    parents: [params.parentId],
    description: params.description,
  });

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadataPart,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    params.htmlContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_BASE}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
      signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
    }
  );

  if (!res.ok) {
    throw new Error(`Tạo tệp tham chiếu Google Doc thất bại: ${await extractDriveError(res)}`);
  }

  const created = await res.json();
  return {
    id: created.id,
    webViewLink: created.webViewLink || `https://docs.google.com/document/d/${created.id}/edit`,
  };
}

async function updateExistingDriveFileMetadata(params: {
  token: string;
  fileId: string;
  name: string;
  description: string;
  targetParentId: string;
  currentParents?: string[];
}): Promise<{ id: string; webViewLink: string }> {
  const query = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name,webViewLink',
  });
  const needsMove = !params.currentParents?.includes(params.targetParentId);
  if (needsMove) {
    query.set('addParents', params.targetParentId);
    if (params.currentParents && params.currentParents.length > 0) {
      query.set('removeParents', params.currentParents.join(','));
    }
  }

  const res = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/${encodeURIComponent(params.fileId)}?${query.toString()}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        description: params.description,
      }),
      signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
    }
  );

  if (!res.ok) {
    throw new Error(`Không thể cập nhật metadata Drive: ${await extractDriveError(res)}`);
  }

  const updated = await res.json();
  return {
    id: updated.id,
    webViewLink: updated.webViewLink || `https://drive.google.com/file/d/${updated.id}/view`,
  };
}

async function updateExternalGoogleDocContent(params: {
  token: string;
  fileId: string;
  htmlContent: string;
}): Promise<void> {
  const res = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_BASE}/${encodeURIComponent(
      params.fileId
    )}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'text/html; charset=UTF-8',
      },
      body: params.htmlContent,
      signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
    }
  );
  if (!res.ok) {
    throw new Error(`Không thể cập nhật nội dung Google Doc: ${await extractDriveError(res)}`);
  }
}

/**
 * Tự động sao lưu tài liệu ACTIVE lên Google Drive theo cấu trúc:
 * <Root Folder> / Năm <YYYY> / <Tên danh mục>
 *
 * Luôn xử lý lỗi an toàn (graceful degradation): không ném exception làm sập luồng lưu DB.
 * Không bao giờ xóa bản sao lưu trên Drive khi văn bản ARCHIVED hoặc bị xóa trên web.
 */
export async function syncDocumentToGoogleDrive(params: {
  document: SchoolDocument;
  category: DocumentCategory;
  storageClient?: SupabaseClient | null;
  fileBuffer?: Buffer | null;
}): Promise<DriveSyncOutcome> {
  const { document: doc, category } = params;
  const config = getGoogleDriveArchiveConfig();

  if (!config.configured || !config.credentials) {
    console.warn(`[GoogleDriveArchive] ${config.missingReason}`);
    return {
      drive_sync_status: 'SKIPPED',
      drive_file_id: doc.drive_file_id || null,
      drive_web_view_link: doc.drive_web_view_link || null,
      drive_synced_at: doc.drive_synced_at || null,
      drive_sync_error: config.missingReason || 'Chưa cấu hình Google Drive Archive.',
    };
  }

  try {
    const token = await getGoogleDriveAccessToken(config.credentials);
    const yearFolderName = `Năm ${extractDocumentYear(doc.issued_date)}`;
    const yearFolderId = await findOrCreateDriveFolder(token, config.rootFolderId, yearFolderName);
    const categoryFolderId = await findOrCreateDriveFolder(
      token,
      yearFolderId,
      category.name || category.code || 'Tài liệu chung'
    );

    const driveName = buildDriveDocumentName(doc);
    const driveDescription = [
      doc.document_number ? `Số hiệu: ${doc.document_number}` : '',
      `Ngày ban hành: ${doc.issued_date}`,
      `Danh mục: ${category.name}`,
      doc.description || '',
    ]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 1000);

    const existing = doc.drive_file_id
      ? await getExistingDriveFile(token, doc.drive_file_id)
      : null;

    let synced: { id: string; webViewLink: string };

    if (doc.storage_type === 'EXTERNAL_LINK') {
      const htmlContent = buildExternalReferenceHtml(doc, category.name);
      if (existing) {
        synced = await updateExistingDriveFileMetadata({
          token,
          fileId: existing.id,
          name: driveName,
          description: driveDescription,
          targetParentId: categoryFolderId,
          currentParents: existing.parents,
        });
        await updateExternalGoogleDocContent({
          token,
          fileId: existing.id,
          htmlContent,
        });
      } else {
        synced = await uploadGoogleDocMultipart({
          token,
          parentId: categoryFolderId,
          name: driveName,
          description: driveDescription,
          htmlContent,
        });
      }
    } else {
      // SUPABASE_STORAGE
      if (existing && !params.fileBuffer) {
        synced = await updateExistingDriveFileMetadata({
          token,
          fileId: existing.id,
          name: driveName,
          description: driveDescription,
          targetParentId: categoryFolderId,
          currentParents: existing.parents,
        });
      } else {
        let buffer = params.fileBuffer || null;
        if (!buffer) {
          if (!doc.storage_path || !params.storageClient) {
            throw new Error('Không tìm thấy tệp trong Supabase Storage để đồng bộ lên Drive.');
          }
          const { data: blob, error: dlErr } = await params.storageClient.storage
            .from(DOCUMENT_BUCKET_NAME)
            .download(doc.storage_path);
          if (dlErr || !blob) {
            throw new Error(
              `Không thể tải tệp từ Supabase Storage: ${dlErr?.message || 'Unknown error'}`
            );
          }
          const ab = await blob.arrayBuffer();
          buffer = Buffer.from(ab);
        }

        synced = await uploadBinaryResumable({
          token,
          existingFileId: existing?.id || null,
          parentId: categoryFolderId,
          removeParents: existing?.parents,
          fileName: driveName,
          mimeType: doc.mime_type || 'application/octet-stream',
          description: driveDescription,
          buffer,
        });
      }
    }

    return {
      drive_sync_status: 'SYNCED',
      drive_file_id: synced.id,
      drive_web_view_link: synced.webViewLink,
      drive_synced_at: new Date().toISOString(),
      drive_sync_error: null,
    };
  } catch (err: any) {
    const message = err?.message || 'Lỗi đồng bộ Google Drive không xác định.';
    console.warn('[GoogleDriveArchive] Sync warning:', message);
    return {
      drive_sync_status: 'FAILED',
      drive_file_id: doc.drive_file_id || null,
      drive_web_view_link: doc.drive_web_view_link || null,
      drive_synced_at: doc.drive_synced_at || null,
      drive_sync_error: String(message).slice(0, 500),
    };
  }
}
