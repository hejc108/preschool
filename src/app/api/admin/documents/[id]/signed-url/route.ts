import { requireActiveRole } from '@/lib/auth/sessionContext';
import { createDocumentSignedDownloadUrl } from '@/lib/documents/documentService';
import { fromServiceError, jsonError, jsonOk } from '@/lib/documents/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const downloadParam = searchParams.get('download');
    const isDownload = downloadParam === '1' || downloadParam === 'true';

    const result = await createDocumentSignedDownloadUrl(auth.ctx, context.params?.id || '', {
      download: isDownload,
    });

    if (!result.ok) return fromServiceError(result);

    return jsonOk({
      signed_url: result.signed_url,
      expires_in: result.expires_in,
      file_name: result.document.file_name,
      mime_type: result.document.mime_type,
    });
  } catch (err: any) {
    console.error('GET /api/admin/documents/[id]/signed-url error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi tạo liên kết xem trước tài liệu.'
    );
  }
}
