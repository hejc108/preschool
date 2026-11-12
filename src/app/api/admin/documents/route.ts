import { requireActiveRole } from '@/lib/auth/sessionContext';
import { createDocumentRecord, listDocuments } from '@/lib/documents/documentService';
import { fromServiceError, jsonError, jsonOk } from '@/lib/documents/apiHelpers';
import { DocumentStorageType } from '@/lib/types/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const result = await listDocuments(auth.ctx, {
      q: searchParams.get('q') || '',
      categoryId: searchParams.get('category_id') || '',
      year: searchParams.get('year') || '',
      visibilityScope: searchParams.get('visibility_scope') || '',
      status: searchParams.get('status') || '',
    });

    if (!result.ok) return fromServiceError(result);

    return jsonOk({
      total: result.documents.length,
      documents: result.documents,
      categories: result.categories,
      years: result.years,
      viewer: result.viewer,
    });
  } catch (err: any) {
    console.error('GET /api/admin/documents error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi tải danh sách tài liệu.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
    if ('response' in auth) return auth.response;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawFile = formData.get('file');
      const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
      const storageTypeRaw = String(
        formData.get('storage_type') || (file ? 'SUPABASE_STORAGE' : 'EXTERNAL_LINK')
      )
        .trim()
        .toUpperCase();

      const storageType: DocumentStorageType =
        storageTypeRaw === 'EXTERNAL_LINK' ? 'EXTERNAL_LINK' : 'SUPABASE_STORAGE';

      const result = await createDocumentRecord(auth.ctx, {
        title: String(formData.get('title') || ''),
        document_number: formData.get('document_number')
          ? String(formData.get('document_number'))
          : null,
        category_id: String(formData.get('category_id') || ''),
        issued_date: formData.get('issued_date') ? String(formData.get('issued_date')) : null,
        description: formData.get('description') ? String(formData.get('description')) : null,
        visibility_scope: formData.get('visibility_scope')
          ? String(formData.get('visibility_scope'))
          : 'ALL_ADMINS',
        storage_type: storageType,
        external_url: formData.get('external_url') ? String(formData.get('external_url')) : null,
        storage_path: formData.get('storage_path') ? String(formData.get('storage_path')) : null,
        file_name: formData.get('file_name') ? String(formData.get('file_name')) : null,
        file_size: formData.get('file_size') ? Number(formData.get('file_size')) : null,
        mime_type: formData.get('mime_type') ? String(formData.get('mime_type')) : null,
        file,
      });

      if (!result.ok) return fromServiceError(result);
      return jsonOk({ document: result.document }, 201);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'INVALID_BODY', 'Dữ liệu gửi lên không hợp lệ.');
    }

    const storageTypeRaw = String(
      body.storage_type || (body.external_url ? 'EXTERNAL_LINK' : 'SUPABASE_STORAGE')
    )
      .trim()
      .toUpperCase();
    const storageType: DocumentStorageType =
      storageTypeRaw === 'EXTERNAL_LINK' ? 'EXTERNAL_LINK' : 'SUPABASE_STORAGE';

    const result = await createDocumentRecord(auth.ctx, {
      title: String(body.title || ''),
      document_number: body.document_number ?? null,
      category_id: String(body.category_id || ''),
      issued_date: body.issued_date ?? null,
      description: body.description ?? null,
      visibility_scope: body.visibility_scope ?? 'ALL_ADMINS',
      storage_type: storageType,
      external_url: body.external_url ?? null,
      storage_path: body.storage_path ?? null,
      file_name: body.file_name ?? null,
      file_size: body.file_size !== undefined ? Number(body.file_size) : null,
      mime_type: body.mime_type ?? null,
    });

    if (!result.ok) return fromServiceError(result);
    return jsonOk({ document: result.document }, 201);
  } catch (err: any) {
    console.error('POST /api/admin/documents error:', err);
    return jsonError(
      500,
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Lỗi máy chủ khi lưu tài liệu mới.'
    );
  }
}
