import { requireActiveRole } from '@/lib/auth/sessionContext';
import {
  deleteDocumentPermanently,
  getDocumentById,
  listDocumentAuditLogs,
  updateDocumentRecord,
} from '@/lib/documents/documentService';
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

    const id = context.params?.id || '';
    const result = await getDocumentById(auth.ctx, id);
    if (!result.ok) return fromServiceError(result);

    const auditLogs = await listDocumentAuditLogs(auth.ctx, result.document.id);
    return jsonOk({ document: result.document, audit_logs: auditLogs });
  } catch (err: any) {
    console.error('GET /api/admin/documents/[id] error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi tải chi tiết tài liệu.'
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'INVALID_BODY', 'Dữ liệu cập nhật không hợp lệ.');
    }

    const result = await updateDocumentRecord(auth.ctx, context.params?.id || '', body);
    if (!result.ok) return fromServiceError(result);

    return jsonOk({ document: result.document });
  } catch (err: any) {
    console.error('PATCH /api/admin/documents/[id] error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi cập nhật tài liệu.'
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const result = await deleteDocumentPermanently(auth.ctx, context.params?.id || '');
    if (!result.ok) return fromServiceError(result);

    return jsonOk({ deleted_id: result.deleted_id });
  } catch (err: any) {
    console.error('DELETE /api/admin/documents/[id] error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi xóa vĩnh viễn tài liệu.'
    );
  }
}
