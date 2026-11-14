import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import { cloneDocumentRecord } from '@/lib/documents/documentService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const id = context.params?.id || '';
    const result = await cloneDocumentRecord(ctx, id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      document: result.document,
      message: `Đã nhân bản thành công sang Bản nháp mới "${result.document.title}".`,
    });
  } catch (err: any) {
    console.error('POST /api/admin/documents/[id]/clone error:', err);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Lỗi hệ thống khi nhân bản văn bản.',
      },
      { status: 500 }
    );
  }
}
