import { requireActiveRole } from '@/lib/auth/sessionContext';
import { transitionDocumentWorkflow } from '@/lib/documents/documentService';
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'INVALID_BODY', 'Dữ liệu chuyển trạng thái không hợp lệ.');
    }

    const result = await transitionDocumentWorkflow(auth.ctx, context.params?.id || '', body);
    if (!result.ok) return fromServiceError(result);

    return jsonOk({
      document: result.document,
      audit_logs: result.audit_logs,
    });
  } catch (err: any) {
    console.error('POST /api/admin/documents/[id]/transition error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi chuyển trạng thái vòng đời tài liệu.'
    );
  }
}
