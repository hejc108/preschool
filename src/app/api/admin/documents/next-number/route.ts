import { requireActiveRole } from '@/lib/auth/sessionContext';
import { peekNextDocumentNumber } from '@/lib/documents/documentService';
import { jsonError, jsonOk } from '@/lib/documents/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const yearRaw = searchParams.get('year');
    const yearParsed = yearRaw ? Number(yearRaw) : undefined;
    const symbol = searchParams.get('symbol');
    const categoryId = searchParams.get('category_id');

    const nextNumber = await peekNextDocumentNumber(auth.ctx, {
      year: yearParsed && Number.isInteger(yearParsed) ? yearParsed : undefined,
      symbol,
      categoryId,
    });

    return jsonOk({ next_number: nextNumber });
  } catch (err: any) {
    console.error('GET /api/admin/documents/next-number error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi dự xem số hiệu văn bản tiếp theo.'
    );
  }
}
