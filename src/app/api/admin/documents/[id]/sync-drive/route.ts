import { requireActiveRole } from '@/lib/auth/sessionContext';
import { syncDocumentDriveManually } from '@/lib/documents/documentService';
import { fromServiceError, jsonError, jsonOk } from '@/lib/documents/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const result = await syncDocumentDriveManually(auth.ctx, context.params?.id || '');
    if (!result.ok) return fromServiceError(result);

    return jsonOk({
      document: result.document,
      drive_sync_status: result.document.drive_sync_status,
      drive_web_view_link: result.document.drive_web_view_link,
      drive_sync_error: result.document.drive_sync_error,
    });
  } catch (err: any) {
    console.error('POST /api/admin/documents/[id]/sync-drive error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi đồng bộ tài liệu sang Google Drive.'
    );
  }
}
