import { requireActiveRole } from '@/lib/auth/sessionContext';
import { createCategory, listCategories } from '@/lib/documents/documentService';
import { fromServiceError, jsonError, jsonOk } from '@/lib/documents/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const result = await listCategories(auth.ctx);
    if (!result.ok) return fromServiceError(result);

    return jsonOk({ categories: result.categories });
  } catch (err: any) {
    console.error('GET /api/admin/documents/categories error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi tải danh mục văn bản.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN']);
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'INVALID_BODY', 'Dữ liệu danh mục không hợp lệ.');
    }

    const result = await createCategory(auth.ctx, body);
    if (!result.ok) return fromServiceError(result);

    return jsonOk({ category: result.category }, 201);
  } catch (err: any) {
    console.error('POST /api/admin/documents/categories error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi tạo danh mục văn bản.'
    );
  }
}
