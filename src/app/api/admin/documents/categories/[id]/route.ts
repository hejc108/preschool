import { requireActiveRole } from '@/lib/auth/sessionContext';
import { updateCategory } from '@/lib/documents/documentService';
import { fromServiceError, jsonError, jsonOk } from '@/lib/documents/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'INVALID_BODY', 'Dữ liệu cập nhật danh mục không hợp lệ.');
    }

    const result = await updateCategory(auth.ctx, context.params?.id || '', body);
    if (!result.ok) return fromServiceError(result);

    return jsonOk({ category: result.category });
  } catch (err: any) {
    console.error('PATCH /api/admin/documents/categories/[id] error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi cập nhật danh mục.'
    );
  }
}
