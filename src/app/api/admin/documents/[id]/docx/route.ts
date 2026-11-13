import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import { generateDraftDocxForDocument } from '@/lib/documents/documentService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const id = context.params?.id || '';
    const result = await generateDraftDocxForDocument(ctx, id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status }
      );
    }

    const encodedFileName = encodeURIComponent(result.fileName);
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('GET /api/admin/documents/[id]/docx error:', err);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Lỗi khi xuất tệp Word (.docx).',
      },
      { status: 500 }
    );
  }
}
