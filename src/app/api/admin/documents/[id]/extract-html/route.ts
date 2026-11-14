import { NextRequest, NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth/sessionContext';
import { getDocumentById } from '@/lib/documents/documentService';
import { extractHtmlForDocument } from '@/lib/documents/docxHtmlExtractorService';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { id } = params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ID tài liệu không hợp lệ.' },
        { status: 400 }
      );
    }

    const docRes = await getDocumentById(ctx, id);
    if (!docRes.ok) {
      return NextResponse.json(
        { success: false, message: docRes.message, error: docRes.error },
        { status: docRes.status }
      );
    }

    const extractRes = await extractHtmlForDocument(ctx, docRes.document);
    if (!extractRes.ok) {
      return NextResponse.json(
        {
          success: false,
          html: null,
          unsupportedReason: extractRes.unsupportedReason,
          message: extractRes.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      html: extractRes.html,
      source: extractRes.source,
      warnings: extractRes.warnings || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Lỗi xử lý trích xuất nội dung văn bản.',
      },
      { status: 500 }
    );
  }
}
