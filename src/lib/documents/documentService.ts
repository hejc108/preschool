import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  executeWithContextFallback,
  getScopedDbClient,
  SessionContext,
} from '@/lib/auth/sessionContext';
import {
  getSupabaseAdminClient,
  getSupabaseCallerClient,
  getSupabaseConfig,
  getTodayVietnamDate,
} from '@/lib/supabase/server';
import {
  DocumentCategory,
  DocumentStatus,
  DocumentStorageType,
  DocumentVisibilityScope,
  SchoolDocument,
} from '@/lib/types/schema';
import { normalizeVietnameseSearch } from '@/lib/utils/textSearch';
import {
  buildCategoryCodeFromName,
  buildSafeStorageFileName,
  DOCUMENT_BUCKET_NAME,
  EXTENSION_TO_MIME,
  extractDocumentYear,
  MAX_DOCUMENT_FILE_SIZE,
  normalizeDocumentNumber,
  normalizeIssuedDate,
  SIGNED_URL_TTL_SECONDS,
  validateDocumentFileMeta,
  validateExternalDocumentUrl,
} from '@/lib/documents/validation';
import { syncDocumentToGoogleDrive } from '@/lib/documents/googleDriveService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

export type ServiceErrorResult = {
  ok: false;
  status: number;
  error: string;
  message: string;
};

function fail(status: number, error: string, message: string): ServiceErrorResult {
  return { ok: false, status, error, message };
}

function getSafeUploadedBy(ctx: SessionContext): string | null {
  return isValidUuid(ctx.profileId) ? ctx.profileId : null;
}

async function getPreferredStorageClient(ctx: SessionContext): Promise<SupabaseClient> {
  const cfg = getSupabaseConfig();
  if (cfg.isValidServiceRoleKey) {
    return getSupabaseAdminClient(false);
  }
  const scoped = await getScopedDbClient(ctx);
  if (scoped) return scoped;
  if (ctx.supabaseAccessToken) {
    const caller = getSupabaseCallerClient(ctx.supabaseAccessToken);
    if (caller) return caller;
  }
  return getSupabaseAdminClient(true);
}

async function ensurePrivateDocumentBucketIfPossible(sb: SupabaseClient): Promise<void> {
  const { isValidServiceRoleKey } = getSupabaseConfig();
  if (!isValidServiceRoleKey) return;
  try {
    const { data } = await sb.storage.getBucket(DOCUMENT_BUCKET_NAME);
    if (!data) {
      await sb.storage.createBucket(DOCUMENT_BUCKET_NAME, {
        public: false,
        fileSizeLimit: MAX_DOCUMENT_FILE_SIZE,
        allowedMimeTypes: Array.from(new Set(Object.values(EXTENSION_TO_MIME))),
      });
    }
  } catch {
    // Không chặn luồng nếu bucket đã tồn tại hoặc thiếu quyền tạo bucket qua API
  }
}

async function fetchCategoryById(
  ctx: SessionContext,
  categoryId: string
): Promise<DocumentCategory | null> {
  if (!isValidUuid(categoryId)) return null;
  const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('document_categories')
      .select('id, code, name, sort_order, created_at')
      .eq('id', categoryId)
      .maybeSingle()
  );
  if (error || !data) return null;
  return data as DocumentCategory;
}

async function checkDuplicateActiveDocumentNumber(
  ctx: SessionContext,
  documentNumber: string | null,
  excludeId?: string
): Promise<{ id: string; title: string; document_number: string } | null> {
  if (!documentNumber) return null;
  const targetLower = documentNumber.trim().toLowerCase();

  const { data } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('school_documents')
      .select('id, title, document_number')
      .eq('status', 'ACTIVE')
      .not('document_number', 'is', null)
  );

  if (!Array.isArray(data)) return null;
  const match = data.find((row: any) => {
    if (excludeId && row.id === excludeId) return false;
    return String(row.document_number || '').trim().toLowerCase() === targetLower;
  });
  return match || null;
}

function hydrateDocuments(
  rows: any[],
  categoriesMap: Map<string, DocumentCategory>,
  uploaderNameMap: Map<string, string>
): SchoolDocument[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    document_number: r.document_number ?? null,
    issued_date: r.issued_date,
    category_id: r.category_id,
    category: categoriesMap.get(r.category_id) || null,
    storage_type: r.storage_type as DocumentStorageType,
    storage_path: r.storage_path ?? null,
    external_url: r.external_url ?? null,
    file_name: r.file_name ?? null,
    file_size: r.file_size !== null && r.file_size !== undefined ? Number(r.file_size) : null,
    mime_type: r.mime_type ?? null,
    description: r.description ?? null,
    visibility_scope: r.visibility_scope as DocumentVisibilityScope,
    status: r.status as DocumentStatus,
    uploaded_by: r.uploaded_by ?? null,
    uploader_name: r.uploaded_by ? uploaderNameMap.get(r.uploaded_by) || null : null,
    drive_sync_status: (r.drive_sync_status || 'PENDING') as SchoolDocument['drive_sync_status'],
    drive_file_id: r.drive_file_id ?? null,
    drive_web_view_link: r.drive_web_view_link ?? null,
    drive_synced_at: r.drive_synced_at ?? null,
    drive_sync_error: r.drive_sync_error ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

async function fetchUploaderNamesMap(
  ctx: SessionContext,
  rows: Array<{ uploaded_by?: string | null }>
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(rows.map((r) => r.uploaded_by).filter((id): id is string => Boolean(id)))
  );
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  try {
    const { data } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('profiles').select('id, full_name, email').in('id', ids)
    );
    if (Array.isArray(data)) {
      data.forEach((p: any) => {
        map.set(p.id, p.full_name || p.email || 'Quản trị viên');
      });
    }
  } catch {
    // Non-fatal
  }
  return map;
}

export async function listCategories(
  ctx: SessionContext
): Promise<{ ok: true; categories: DocumentCategory[] } | ServiceErrorResult> {
  const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('document_categories')
      .select('id, code, name, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
  );

  if (error) {
    return fail(500, 'FETCH_CATEGORIES_FAILED', error.message || 'Không thể tải danh mục văn bản.');
  }
  return { ok: true, categories: (data || []) as DocumentCategory[] };
}

export async function createCategory(
  ctx: SessionContext,
  input: { name?: unknown; code?: unknown; sort_order?: unknown }
): Promise<{ ok: true; category: DocumentCategory } | ServiceErrorResult> {
  if (ctx.activeRole !== 'SUPER_ADMIN') {
    return fail(403, 'FORBIDDEN_ROLE', 'Chỉ Super Admin mới được thêm danh mục văn bản.');
  }

  const name = String(input.name || '').trim();
  if (!name) {
    return fail(400, 'MISSING_CATEGORY_NAME', 'Tên danh mục không được để trống.');
  }

  const rawCode = String(input.code || '').trim();
  const code = rawCode
    ? rawCode.toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
    : buildCategoryCodeFromName(name);

  if (!code) {
    return fail(400, 'INVALID_CATEGORY_CODE', 'Mã danh mục không hợp lệ.');
  }

  const sortOrderNum = Number(input.sort_order);
  let sortOrder = Number.isInteger(sortOrderNum) ? sortOrderNum : 0;
  if (!Number.isInteger(sortOrderNum) || input.sort_order === undefined) {
    const existingCats = await listCategories(ctx);
    if (existingCats.ok && existingCats.categories.length > 0) {
      sortOrder = Math.max(...existingCats.categories.map((c) => Number(c.sort_order) || 0)) + 1;
    } else {
      sortOrder = 1;
    }
  }

  const { data: existing } = await executeWithContextFallback(ctx, async (sb) =>
    await sb.from('document_categories').select('id').eq('code', code).maybeSingle()
  );
  if (existing?.id) {
    return fail(409, 'DUPLICATE_CATEGORY_CODE', `Mã danh mục "${code}" đã tồn tại.`);
  }

  const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('document_categories')
      .insert({ code, name, sort_order: sortOrder })
      .select('id, code, name, sort_order, created_at')
      .single()
  );

  if (error || !data) {
    return fail(500, 'CREATE_CATEGORY_FAILED', error?.message || 'Không thể tạo danh mục mới.');
  }
  return { ok: true, category: data as DocumentCategory };
}

export async function updateCategory(
  ctx: SessionContext,
  id: string,
  input: { name?: unknown; sort_order?: unknown }
): Promise<{ ok: true; category: DocumentCategory } | ServiceErrorResult> {
  if (ctx.activeRole !== 'SUPER_ADMIN') {
    return fail(403, 'FORBIDDEN_ROLE', 'Chỉ Super Admin mới được chỉnh sửa danh mục văn bản.');
  }
  if (!isValidUuid(id)) {
    return fail(400, 'INVALID_CATEGORY_ID', 'Mã định danh danh mục không hợp lệ.');
  }

  const name = String(input.name || '').trim();
  if (!name) {
    return fail(400, 'MISSING_CATEGORY_NAME', 'Tên danh mục không được để trống.');
  }

  const payload: Record<string, any> = { name };
  if (input.sort_order !== undefined && Number.isInteger(Number(input.sort_order))) {
    payload.sort_order = Number(input.sort_order);
  }

  const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('document_categories')
      .update(payload)
      .eq('id', id)
      .select('id, code, name, sort_order, created_at')
      .maybeSingle()
  );

  if (error) {
    return fail(500, 'UPDATE_CATEGORY_FAILED', error.message || 'Không thể cập nhật danh mục.');
  }
  if (!data) {
    return fail(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục cần cập nhật.');
  }
  return { ok: true, category: data as DocumentCategory };
}

export async function listDocuments(
  ctx: SessionContext,
  filters: {
    q?: string;
    categoryId?: string;
    year?: string;
    visibilityScope?: string;
    status?: string;
  }
): Promise<
  | {
      ok: true;
      documents: SchoolDocument[];
      categories: DocumentCategory[];
      years: string[];
      viewer: {
        profile_id: string;
        active_role: SessionContext['activeRole'];
        is_super_admin: boolean;
        full_name: string;
      };
    }
  | ServiceErrorResult
> {
  const isSuperAdmin = ctx.activeRole === 'SUPER_ADMIN';

  const [catRes, docsRes] = await Promise.all([
    listCategories(ctx),
    executeWithContextFallback(ctx, async (sb) => {
      let query = sb
        .from('school_documents')
        .select('*')
        .order('issued_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq('visibility_scope', 'ALL_ADMINS');
      }
      return await query;
    }),
  ]);

  if (!catRes.ok) return catRes;
  if (docsRes.error) {
    return fail(
      500,
      'FETCH_DOCUMENTS_FAILED',
      docsRes.error.message || 'Không thể tải danh sách tài liệu.'
    );
  }

  // Defense-in-depth scope filter on server
  const scopedRows = ((docsRes.data || []) as any[]).filter((row) =>
    isSuperAdmin ? true : row.visibility_scope === 'ALL_ADMINS'
  );

  const categoriesMap = new Map<string, DocumentCategory>();
  const countMap = new Map<string, number>();
  scopedRows.forEach((r) => {
    if (r.status === 'ACTIVE') {
      countMap.set(r.category_id, (countMap.get(r.category_id) || 0) + 1);
    }
  });
  const categories = catRes.categories.map((c) => {
    const withCount = { ...c, document_count: countMap.get(c.id) || 0 };
    categoriesMap.set(c.id, withCount);
    return withCount;
  });

  const uploaderMap = await fetchUploaderNamesMap(ctx, scopedRows);
  const allHydrated = hydrateDocuments(scopedRows, categoriesMap, uploaderMap);

  const yearSet = new Set<string>([extractDocumentYear(getTodayVietnamDate())]);
  allHydrated.forEach((doc) => {
    yearSet.add(extractDocumentYear(doc.issued_date));
  });
  const years = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));

  const qNorm = normalizeVietnameseSearch(filters.q);
  const catFilter = (filters.categoryId || '').trim();
  const yearFilter = (filters.year || '').trim();
  const visFilter = (filters.visibilityScope || '').trim();
  const statusFilter = (filters.status || '').trim().toUpperCase();

  const filtered = allHydrated.filter((doc) => {
    if (catFilter && catFilter !== 'ALL' && doc.category_id !== catFilter) return false;
    if (yearFilter && yearFilter !== 'ALL' && extractDocumentYear(doc.issued_date) !== yearFilter) {
      return false;
    }
    if (visFilter && visFilter !== 'ALL' && doc.visibility_scope !== visFilter) return false;
    if (statusFilter && statusFilter !== 'ALL' && doc.status !== statusFilter) return false;

    if (qNorm) {
      const catName = doc.category?.name || '';
      const haystack = [
        doc.title,
        doc.document_number,
        doc.description,
        doc.file_name,
        catName,
      ]
        .map((v) => normalizeVietnameseSearch(v))
        .join(' ');
      if (!haystack.includes(qNorm)) return false;
    }
    return true;
  });

  return {
    ok: true,
    documents: filtered,
    categories,
    years,
    viewer: {
      profile_id: ctx.profileId,
      active_role: ctx.activeRole,
      is_super_admin: isSuperAdmin,
      full_name: ctx.fullName,
    },
  };
}

export async function getDocumentById(
  ctx: SessionContext,
  id: string
): Promise<{ ok: true; document: SchoolDocument; category: DocumentCategory | null } | ServiceErrorResult> {
  if (!isValidUuid(id)) {
    return fail(400, 'INVALID_DOCUMENT_ID', 'Mã tài liệu không hợp lệ.');
  }

  // Always check existence cleanly so SCHOOL_ADMIN accessing SUPER_ADMIN_ONLY gets explicit 403 Forbidden
  const adminCfg = getSupabaseConfig();
  let rawDoc: any = null;
  let fetchErr: any = null;

  if (adminCfg.isValidServiceRoleKey) {
    const res = await getSupabaseAdminClient(false)
      .from('school_documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    rawDoc = res.data;
    fetchErr = res.error;
  } else {
    const res = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('school_documents').select('*').eq('id', id).maybeSingle()
    );
    rawDoc = res.data;
    fetchErr = res.error;

    // Nếu RLS chặn SELECT của SCHOOL_ADMIN trên tài liệu mật, kiểm tra qua scoped SUPER_ADMIN check hoặc trả 403
    if (!rawDoc && !fetchErr && ctx.activeRole !== 'SUPER_ADMIN') {
      return fail(
        403,
        'FORBIDDEN_DOCUMENT_SCOPE',
        'Bạn không có quyền truy cập tài liệu này hoặc tài liệu chỉ dành cho Super Admin.'
      );
    }
  }

  if (fetchErr) {
    return fail(500, 'FETCH_DOCUMENT_FAILED', fetchErr.message || 'Không thể tải thông tin tài liệu.');
  }
  if (!rawDoc) {
    return fail(404, 'DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu.');
  }

  if (ctx.activeRole !== 'SUPER_ADMIN' && rawDoc.visibility_scope === 'SUPER_ADMIN_ONLY') {
    return fail(
      403,
      'FORBIDDEN_DOCUMENT_SCOPE',
      'Tài liệu này thuộc phạm vi bảo mật chỉ dành cho Super Admin.'
    );
  }

  const category = await fetchCategoryById(ctx, rawDoc.category_id);
  const catMap = new Map<string, DocumentCategory>();
  if (category) catMap.set(category.id, category);
  const uploaderMap = await fetchUploaderNamesMap(ctx, [rawDoc]);
  const [hydrated] = hydrateDocuments([rawDoc], catMap, uploaderMap);

  return { ok: true, document: hydrated, category };
}

export async function createSignedUploadUrlForDocument(
  ctx: SessionContext,
  params: { fileName: string; fileSize: number; mimeType?: string | null }
): Promise<
  | {
      ok: true;
      storage_path: string;
      signed_url: string;
      token: string;
      mime_type: string;
    }
  | ServiceErrorResult
> {
  const meta = validateDocumentFileMeta(params);
  if (!meta.ok) {
    const status = meta.code === 'FILE_TOO_LARGE' ? 413 : 400;
    return fail(status, meta.code, meta.error);
  }

  const today = getTodayVietnamDate();
  const [year, month] = today.split('-');
  const safeName = buildSafeStorageFileName(params.fileName);
  const storagePath = `${year}/${month}/${crypto.randomUUID()}_${safeName}`;

  const sb = await getPreferredStorageClient(ctx);
  await ensurePrivateDocumentBucketIfPossible(sb);

  const { data, error } = await sb.storage
    .from(DOCUMENT_BUCKET_NAME)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl || !data?.token) {
    return fail(
      502,
      'SIGNED_UPLOAD_URL_FAILED',
      error?.message ||
        'Không thể khởi tạo phiên tải tệp trực tiếp lên Supabase Storage. Kiểm tra bucket private school-documents.'
    );
  }

  return {
    ok: true,
    storage_path: data.path || storagePath,
    signed_url: data.signedUrl,
    token: data.token,
    mime_type: meta.normalizedMime,
  };
}

async function persistDriveOutcome(
  ctx: SessionContext,
  documentId: string,
  outcome: Awaited<ReturnType<typeof syncDocumentToGoogleDrive>>
): Promise<any | null> {
  const { data } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('school_documents')
      .update({
        drive_sync_status: outcome.drive_sync_status,
        drive_file_id: outcome.drive_file_id,
        drive_web_view_link: outcome.drive_web_view_link,
        drive_synced_at: outcome.drive_synced_at,
        drive_sync_error: outcome.drive_sync_error,
      })
      .eq('id', documentId)
      .select('*')
      .maybeSingle()
  );
  return data || null;
}

export async function createDocumentRecord(
  ctx: SessionContext,
  input: {
    title: string;
    document_number?: string | null;
    category_id: string;
    issued_date?: string | null;
    description?: string | null;
    visibility_scope?: string | null;
    storage_type: DocumentStorageType;
    external_url?: string | null;
    storage_path?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    mime_type?: string | null;
    file?: File | null;
  }
): Promise<{ ok: true; document: SchoolDocument } | ServiceErrorResult> {
  const title = String(input.title || '').trim();
  if (!title) {
    return fail(400, 'MISSING_TITLE', 'Vui lòng nhập tên văn bản / trích yếu nội dung.');
  }

  if (!input.category_id || !isValidUuid(input.category_id)) {
    return fail(400, 'INVALID_CATEGORY', 'Vui lòng chọn danh mục văn bản hợp lệ.');
  }
  const category = await fetchCategoryById(ctx, input.category_id);
  if (!category) {
    return fail(404, 'CATEGORY_NOT_FOUND', 'Danh mục văn bản không tồn tại.');
  }

  const today = getTodayVietnamDate();
  const issuedDate = normalizeIssuedDate(input.issued_date, today);
  if (!issuedDate) {
    return fail(400, 'INVALID_ISSUED_DATE', 'Ngày ban hành không đúng định dạng YYYY-MM-DD.');
  }

  const requestedScope = (input.visibility_scope || 'ALL_ADMINS').trim().toUpperCase();
  if (requestedScope !== 'ALL_ADMINS' && requestedScope !== 'SUPER_ADMIN_ONLY') {
    return fail(400, 'INVALID_VISIBILITY_SCOPE', 'Phạm vi hiển thị không hợp lệ.');
  }
  if (requestedScope === 'SUPER_ADMIN_ONLY' && ctx.activeRole !== 'SUPER_ADMIN') {
    return fail(
      403,
      'FORBIDDEN_VISIBILITY_SCOPE',
      'Chỉ Super Admin mới được phép tạo tài liệu mật (SUPER_ADMIN_ONLY).'
    );
  }
  const visibilityScope = requestedScope as DocumentVisibilityScope;

  const docNumber = normalizeDocumentNumber(input.document_number);
  const dup = await checkDuplicateActiveDocumentNumber(ctx, docNumber);
  if (dup) {
    return fail(
      409,
      'DUPLICATE_DOCUMENT_NUMBER',
      `Số hiệu văn bản "${docNumber}" đã tồn tại ở tài liệu đang hiệu lực ("${dup.title}").`
    );
  }

  const description = String(input.description || '').trim() || null;

  let storagePath: string | null = null;
  let externalUrl: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;
  let fileBufferForDrive: Buffer | null = null;

  if (input.storage_type === 'EXTERNAL_LINK') {
    const urlCheck = validateExternalDocumentUrl(input.external_url || '');
    if (!urlCheck.ok) {
      return fail(400, urlCheck.code, urlCheck.error);
    }
    externalUrl = urlCheck.url;
  } else if (input.storage_type === 'SUPABASE_STORAGE') {
    if (input.file) {
      const meta = validateDocumentFileMeta({
        fileName: input.file.name,
        fileSize: input.file.size,
        mimeType: input.file.type,
      });
      if (!meta.ok) {
        return fail(meta.code === 'FILE_TOO_LARGE' ? 413 : 400, meta.code, meta.error);
      }

      const [year, month] = today.split('-');
      const safeFileName = buildSafeStorageFileName(input.file.name);
      const targetPath = `${year}/${month}/${crypto.randomUUID()}_${safeFileName}`;
      const ab = await input.file.arrayBuffer();
      const buffer = Buffer.from(ab);

      const sb = await getPreferredStorageClient(ctx);
      await ensurePrivateDocumentBucketIfPossible(sb);

      const { data: upData, error: upErr } = await sb.storage
        .from(DOCUMENT_BUCKET_NAME)
        .upload(targetPath, buffer, {
          contentType: meta.normalizedMime,
          upsert: false,
        });

      if (upErr || !upData?.path) {
        return fail(
          502,
          'STORAGE_UPLOAD_FAILED',
          upErr?.message ||
            'Không thể tải tệp lên bucket private school-documents. Vui lòng kiểm tra cấu hình Storage.'
        );
      }

      storagePath = upData.path;
      fileName = input.file.name.trim();
      fileSize = input.file.size;
      mimeType = meta.normalizedMime;
      fileBufferForDrive = buffer;
    } else if (input.storage_path) {
      const cleanPath = String(input.storage_path).trim().replace(/^\/+/, '');
      if (!cleanPath || cleanPath.includes('..')) {
        return fail(400, 'INVALID_STORAGE_PATH', 'Đường dẫn tệp Storage không hợp lệ.');
      }
      const declaredName = String(input.file_name || cleanPath.split('/').pop() || '').trim();
      const declaredSize = Number(input.file_size || 0);
      const meta = validateDocumentFileMeta({
        fileName: declaredName,
        fileSize: declaredSize,
        mimeType: input.mime_type,
      });
      if (!meta.ok) {
        return fail(meta.code === 'FILE_TOO_LARGE' ? 413 : 400, meta.code, meta.error);
      }

      storagePath = cleanPath;
      fileName = declaredName;
      fileSize = declaredSize;
      mimeType = meta.normalizedMime;
    } else {
      return fail(400, 'MISSING_FILE', 'Vui lòng chọn tệp tải lên hoặc gắn liên kết ngoài.');
    }
  } else {
    return fail(400, 'INVALID_STORAGE_TYPE', 'Loại lưu trữ tài liệu không hợp lệ.');
  }

  const insertPayload = {
    title,
    document_number: docNumber,
    issued_date: issuedDate,
    category_id: category.id,
    storage_type: input.storage_type,
    storage_path: storagePath,
    external_url: externalUrl,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    description,
    visibility_scope: visibilityScope,
    status: 'ACTIVE' as DocumentStatus,
    uploaded_by: getSafeUploadedBy(ctx),
    drive_sync_status: 'PENDING',
  };

  const { data: inserted, error: insertErr } = await executeWithContextFallback(ctx, async (sb) =>
    await sb.from('school_documents').insert(insertPayload).select('*').single()
  );

  if (insertErr || !inserted) {
    // Cleanup orphaned uploaded file if DB insert failed (e.g. race condition duplicate number)
    if (storagePath && input.file) {
      try {
        const sb = await getPreferredStorageClient(ctx);
        await sb.storage.from(DOCUMENT_BUCKET_NAME).remove([storagePath]);
      } catch {
        // Ignore cleanup failure
      }
    }
    if (insertErr?.code === '23505') {
      return fail(
        409,
        'DUPLICATE_DOCUMENT_NUMBER',
        `Số hiệu văn bản "${docNumber}" đã tồn tại trong hệ thống.`
      );
    }
    return fail(500, 'CREATE_DOCUMENT_FAILED', insertErr?.message || 'Không thể lưu tài liệu.');
  }

  const catMap = new Map<string, DocumentCategory>([[category.id, category]]);
  const uploaderMap = await fetchUploaderNamesMap(ctx, [inserted]);
  let [hydrated] = hydrateDocuments([inserted], catMap, uploaderMap);

  // Tự động xuất & sao lưu tài liệu ACTIVE sang Google Drive theo năm
  const storageClient =
    hydrated.storage_type === 'SUPABASE_STORAGE' && !fileBufferForDrive
      ? await getPreferredStorageClient(ctx)
      : null;

  const driveOutcome = await syncDocumentToGoogleDrive({
    document: hydrated,
    category,
    storageClient,
    fileBuffer: fileBufferForDrive,
  });

  const updatedAfterDrive = await persistDriveOutcome(ctx, hydrated.id, driveOutcome);
  if (updatedAfterDrive) {
    [hydrated] = hydrateDocuments([updatedAfterDrive], catMap, uploaderMap);
  } else {
    hydrated = { ...hydrated, ...driveOutcome };
  }

  return { ok: true, document: hydrated };
}

export async function updateDocumentRecord(
  ctx: SessionContext,
  id: string,
  input: {
    title?: unknown;
    document_number?: unknown;
    category_id?: unknown;
    issued_date?: unknown;
    description?: unknown;
    visibility_scope?: unknown;
    status?: unknown;
    external_url?: unknown;
  }
): Promise<{ ok: true; document: SchoolDocument } | ServiceErrorResult> {
  const existingRes = await getDocumentById(ctx, id);
  if (!existingRes.ok) return existingRes;
  const existing = existingRes.document;

  const updates: Record<string, any> = {};

  if (input.title !== undefined) {
    const t = String(input.title || '').trim();
    if (!t) return fail(400, 'MISSING_TITLE', 'Tên văn bản không được để trống.');
    updates.title = t;
  }

  let targetCategory = existingRes.category;
  if (input.category_id !== undefined) {
    const cid = String(input.category_id || '').trim();
    const cat = await fetchCategoryById(ctx, cid);
    if (!cat) return fail(404, 'CATEGORY_NOT_FOUND', 'Danh mục văn bản không tồn tại.');
    updates.category_id = cat.id;
    targetCategory = cat;
  }

  if (input.issued_date !== undefined) {
    const parsedDate = normalizeIssuedDate(
      String(input.issued_date || ''),
      existing.issued_date
    );
    if (!parsedDate) {
      return fail(400, 'INVALID_ISSUED_DATE', 'Ngày ban hành không đúng định dạng YYYY-MM-DD.');
    }
    updates.issued_date = parsedDate;
  }

  if (input.description !== undefined) {
    updates.description = String(input.description || '').trim() || null;
  }

  if (input.visibility_scope !== undefined) {
    const scope = String(input.visibility_scope || '').trim().toUpperCase();
    if (scope !== 'ALL_ADMINS' && scope !== 'SUPER_ADMIN_ONLY') {
      return fail(400, 'INVALID_VISIBILITY_SCOPE', 'Phạm vi hiển thị không hợp lệ.');
    }
    if (scope === 'SUPER_ADMIN_ONLY' && ctx.activeRole !== 'SUPER_ADMIN') {
      return fail(
        403,
        'FORBIDDEN_VISIBILITY_SCOPE',
        'Chỉ Super Admin mới được phép đặt phạm vi bảo mật SUPER_ADMIN_ONLY.'
      );
    }
    updates.visibility_scope = scope;
  }

  let nextStatus: DocumentStatus = existing.status;
  if (input.status !== undefined) {
    const st = String(input.status || '').trim().toUpperCase();
    if (st !== 'ACTIVE' && st !== 'ARCHIVED') {
      return fail(400, 'INVALID_STATUS', 'Trạng thái tài liệu chỉ nhận ACTIVE hoặc ARCHIVED.');
    }
    updates.status = st;
    nextStatus = st as DocumentStatus;
  }

  const nextDocNumber =
    input.document_number !== undefined
      ? normalizeDocumentNumber(String(input.document_number || ''))
      : existing.document_number ?? null;

  if (input.document_number !== undefined) {
    updates.document_number = nextDocNumber;
  }

  if (nextStatus === 'ACTIVE' && nextDocNumber) {
    const dup = await checkDuplicateActiveDocumentNumber(ctx, nextDocNumber, existing.id);
    if (dup) {
      return fail(
        409,
        'DUPLICATE_DOCUMENT_NUMBER',
        `Số hiệu văn bản "${nextDocNumber}" đã tồn tại ở tài liệu đang hiệu lực ("${dup.title}").`
      );
    }
  }

  if (input.external_url !== undefined) {
    if (existing.storage_type !== 'EXTERNAL_LINK') {
      return fail(400, 'INVALID_FIELD_FOR_STORAGE', 'Tài liệu tải file trực tiếp không thể gắn URL ngoài.');
    }
    const urlCheck = validateExternalDocumentUrl(String(input.external_url || ''));
    if (!urlCheck.ok) {
      return fail(400, urlCheck.code, urlCheck.error);
    }
    updates.external_url = urlCheck.url;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, document: existing };
  }

  const { data: updatedRow, error: updErr } = await executeWithContextFallback(ctx, async (sb) =>
    await sb.from('school_documents').update(updates).eq('id', id).select('*').single()
  );

  if (updErr || !updatedRow) {
    if (updErr?.code === '23505') {
      return fail(
        409,
        'DUPLICATE_DOCUMENT_NUMBER',
        `Số hiệu văn bản "${nextDocNumber}" đã tồn tại ở tài liệu đang hiệu lực.`
      );
    }
    return fail(500, 'UPDATE_DOCUMENT_FAILED', updErr?.message || 'Không thể cập nhật tài liệu.');
  }

  const catMap = new Map<string, DocumentCategory>();
  if (targetCategory) catMap.set(targetCategory.id, targetCategory);
  const uploaderMap = await fetchUploaderNamesMap(ctx, [updatedRow]);
  let [hydrated] = hydrateDocuments([updatedRow], catMap, uploaderMap);

  // Chỉ đồng bộ Drive khi tài liệu ở trạng thái ACTIVE; khi ARCHIVED tuyệt đối giữ nguyên bản trên Drive
  if (hydrated.status === 'ACTIVE' && targetCategory) {
    const metadataChangedForDrive =
      input.title !== undefined ||
      input.document_number !== undefined ||
      input.category_id !== undefined ||
      input.issued_date !== undefined ||
      input.description !== undefined ||
      input.external_url !== undefined ||
      input.visibility_scope !== undefined ||
      (existing.status === 'ARCHIVED' && hydrated.status === 'ACTIVE') ||
      hydrated.drive_sync_status !== 'SYNCED';

    if (metadataChangedForDrive) {
      const storageClient =
        hydrated.storage_type === 'SUPABASE_STORAGE'
          ? await getPreferredStorageClient(ctx)
          : null;
      const driveOutcome = await syncDocumentToGoogleDrive({
        document: hydrated,
        category: targetCategory,
        storageClient,
      });
      const updatedAfterDrive = await persistDriveOutcome(ctx, hydrated.id, driveOutcome);
      if (updatedAfterDrive) {
        [hydrated] = hydrateDocuments([updatedAfterDrive], catMap, uploaderMap);
      } else {
        hydrated = { ...hydrated, ...driveOutcome };
      }
    }
  }

  return { ok: true, document: hydrated };
}

export async function createDocumentSignedDownloadUrl(
  ctx: SessionContext,
  id: string,
  options?: { download?: boolean }
): Promise<
  | {
      ok: true;
      signed_url: string;
      expires_in: number;
      document: SchoolDocument;
    }
  | ServiceErrorResult
> {
  const docRes = await getDocumentById(ctx, id);
  if (!docRes.ok) return docRes;
  const doc = docRes.document;

  if (doc.storage_type !== 'SUPABASE_STORAGE' || !doc.storage_path) {
    return fail(
      400,
      'NOT_A_STORAGE_FILE',
      'Tài liệu này là liên kết ngoài, không sử dụng tệp trên Supabase Storage.'
    );
  }

  const sb = await getPreferredStorageClient(ctx);
  const signedOptions = options?.download ? { download: doc.file_name || true } : undefined;
  const { data, error } = await sb.storage
    .from(DOCUMENT_BUCKET_NAME)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, signedOptions);

  if (error || !data?.signedUrl) {
    return fail(
      502,
      'SIGNED_URL_FAILED',
      error?.message || 'Không thể tạo liên kết xem trước/tải tệp từ Supabase Storage.'
    );
  }

  return {
    ok: true,
    signed_url: data.signedUrl,
    expires_in: SIGNED_URL_TTL_SECONDS,
    document: doc,
  };
}

export async function syncDocumentDriveManually(
  ctx: SessionContext,
  id: string
): Promise<{ ok: true; document: SchoolDocument } | ServiceErrorResult> {
  const docRes = await getDocumentById(ctx, id);
  if (!docRes.ok) return docRes;
  const doc = docRes.document;

  if (doc.status !== 'ACTIVE') {
    return fail(
      400,
      'DOCUMENT_ARCHIVED',
      'Chỉ hỗ trợ đồng bộ Google Drive cho tài liệu đang ở trạng thái hiệu lực (ACTIVE).'
    );
  }

  const category =
    docRes.category ||
    (await fetchCategoryById(ctx, doc.category_id)) || {
      id: doc.category_id,
      code: 'CHUNG',
      name: 'Tài liệu chung',
      sort_order: 0,
    };

  const storageClient =
    doc.storage_type === 'SUPABASE_STORAGE' ? await getPreferredStorageClient(ctx) : null;

  const driveOutcome = await syncDocumentToGoogleDrive({
    document: doc,
    category,
    storageClient,
  });

  const updatedRow = await persistDriveOutcome(ctx, doc.id, driveOutcome);
  const catMap = new Map<string, DocumentCategory>([[category.id, category]]);
  const uploaderMap = await fetchUploaderNamesMap(ctx, [doc]);
  const hydrated = updatedRow
    ? hydrateDocuments([updatedRow], catMap, uploaderMap)[0]
    : { ...doc, ...driveOutcome };

  return { ok: true, document: hydrated };
}

export async function deleteDocumentPermanently(
  ctx: SessionContext,
  id: string
): Promise<{ ok: true; deleted_id: string } | ServiceErrorResult> {
  if (ctx.activeRole !== 'SUPER_ADMIN') {
    return fail(403, 'FORBIDDEN_DELETE', 'Chỉ Super Admin mới được phép xóa vĩnh viễn tài liệu.');
  }

  const docRes = await getDocumentById(ctx, id);
  if (!docRes.ok) return docRes;
  const doc = docRes.document;

  // Xóa file vật lý trên Supabase Storage (tuyệt đối KHÔNG xóa bản sao lưu trên Google Drive)
  if (doc.storage_type === 'SUPABASE_STORAGE' && doc.storage_path) {
    try {
      const sb = await getPreferredStorageClient(ctx);
      const { error: rmErr } = await sb.storage
        .from(DOCUMENT_BUCKET_NAME)
        .remove([doc.storage_path]);
      if (rmErr && !/not found|no such/i.test(rmErr.message || '')) {
        return fail(
          502,
          'STORAGE_DELETE_FAILED',
          `Không thể xóa tệp vật lý trên Storage: ${rmErr.message}`
        );
      }
    } catch (err: any) {
      return fail(
        502,
        'STORAGE_DELETE_FAILED',
        err?.message || 'Lỗi khi xóa tệp vật lý trên Supabase Storage.'
      );
    }
  }

  const { error: delErr } = await executeWithContextFallback(ctx, async (sb) =>
    await sb.from('school_documents').delete().eq('id', id)
  );

  if (delErr) {
    return fail(500, 'DELETE_DOCUMENT_FAILED', delErr.message || 'Không thể xóa bản ghi tài liệu.');
  }

  return { ok: true, deleted_id: id };
}
