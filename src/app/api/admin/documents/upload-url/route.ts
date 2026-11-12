import { requireActiveRole } from '@/lib/auth/sessionContext';
import { createSignedUploadUrlForDocument } from '@/lib/documents/documentService';
import { fromServiceError, jsonError, jsonOk } from '@/lib/documents/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'INVALID_BODY', 'Thiếu thông tin tệp cần tải lên.');
    }

    const result = await createSignedUploadUrlForDocument(auth.ctx, {
      fileName: String(body.file_name || body.fileName || ''),
      fileSize: Number(body.file_size ?? body.fileSize ?? 0),
      mimeType: body.mime_type ?? body.mimeType ?? null,
    });

    if (!result.ok) return fromServiceError(result);

    return jsonOk({
      storage_path: result.storage_path,
      signed_url: result.signed_url,
      token: result.token,
      mime_type: result.mime_type,
    });
  } catch (err: any) {
    console.error('POST /api/admin/documents/upload-url error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi khởi tạo liên kết tải tệp.'
    );
  }
}
