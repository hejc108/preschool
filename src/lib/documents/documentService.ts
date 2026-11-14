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
  DocumentAuditAction,
  DocumentAuditLog,
  DocumentCategory,
  DocumentCreationMode,
  DocumentDriveSyncStatus,
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
  formatSequentialDocumentNumber,
  getDefaultDocumentSymbolForCategory,
  MAX_DOCUMENT_FILE_SIZE,
  normalizeDocumentNumber,
  normalizeIssuedDate,
  normalizeOptionalDate,
  SIGNED_URL_TTL_SECONDS,
  validateDocumentFileMeta,
  validateEffectiveAndExpirationDates,
  validateExternalDocumentUrl,
  validateWorkflowTransition,
} from '@/lib/documents/validation';
import { syncDocumentToGoogleDrive } from '@/lib/documents/googleDriveService';
import { generateDocumentDocxBuffer } from '@/lib/documents/docxGeneratorService';
import { extractHtmlForDocument, isDocxFileRecord } from '@/lib/documents/docxHtmlExtractorService';

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

function getSafeProfileUuid(ctx: SessionContext): string | null {
  return isValidUuid(ctx.profileId) ? ctx.profileId : null;
}

function getActorDisplayName(ctx: SessionContext): string {
  return (ctx.fullName || ctx.email || 'Quản trị viên').trim();
}

export async function getPreferredStorageClient(ctx: SessionContext): Promise<SupabaseClient> {
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

async function checkDuplicateApprovedDocumentNumber(
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
      .eq('status', 'APPROVED')
      .not('document_number', 'is', null)
  );

  if (!Array.isArray(data)) return null;
  const match = data.find((row: any) => {
    if (excludeId && row.id === excludeId) return false;
    return String(row.document_number || '').trim().toLowerCase() === targetLower;
  });
  return match || null;
}

async function fetchProfileNamesMap(
  ctx: SessionContext,
  rawIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(rawIds.filter((id): id is string => Boolean(id) && isValidUuid(id)))
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

async function fetchSupersededSummaryMap(
  ctx: SessionContext,
  rows: any[]
): Promise<Map<string, { title: string; document_number: string | null }>> {
  const map = new Map<string, { title: string; document_number: string | null }>();
  rows.forEach((r) => {
    if (r?.id) {
      map.set(r.id, { title: r.title, document_number: r.document_number ?? null });
    }
  });

  const missingIds = Array.from(
    new Set(
      rows
        .map((r) => r.superseded_by_id)
        .filter((id): id is string => Boolean(id) && isValidUuid(id) && !map.has(id))
    )
  );

  if (missingIds.length === 0) return map;

  try {
    const { data } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('school_documents')
        .select('id, title, document_number')
        .in('id', missingIds)
    );
    if (Array.isArray(data)) {
      data.forEach((row: any) => {
        map.set(row.id, { title: row.title, document_number: row.document_number ?? null });
      });
    }
  } catch {
    // Non-fatal
  }
  return map;
}

function hydrateDocuments(
  rows: any[],
  categoriesMap: Map<string, DocumentCategory>,
  profileNameMap: Map<string, string>,
  supersededMap: Map<string, { title: string; document_number: string | null }>
): SchoolDocument[] {
  return rows.map((r) => {
    const supInfo = r.superseded_by_id ? supersededMap.get(r.superseded_by_id) : undefined;
    return {
      id: r.id,
      title: r.title,
      document_number: r.document_number ?? null,
      issued_date: r.issued_date,
      effective_date: r.effective_date ?? null,
      expiration_date: r.expiration_date ?? null,
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
      creation_mode: (r.creation_mode || 'FILE_UPLOAD') as DocumentCreationMode,
      editor_content_html: r.editor_content_html ?? null,
      editor_template_code: r.editor_template_code ?? null,
      generated_docx_path: r.generated_docx_path ?? null,
      rejection_reason: r.rejection_reason ?? null,
      superseded_by_id: r.superseded_by_id ?? null,
      superseded_by_title: supInfo?.title ?? null,
      superseded_by_number: supInfo?.document_number ?? null,
      approved_by: r.approved_by ?? null,
      approver_name: r.approved_by ? profileNameMap.get(r.approved_by) || null : null,
      approved_at: r.approved_at ?? null,
      uploaded_by: r.uploaded_by ?? null,
      uploader_name: r.uploaded_by ? profileNameMap.get(r.uploaded_by) || null : null,
      drive_sync_status: (r.drive_sync_status || 'PENDING') as SchoolDocument['drive_sync_status'],
      drive_file_id: r.drive_file_id ?? null,
      drive_web_view_link: r.drive_web_view_link ?? null,
      drive_synced_at: r.drive_synced_at ?? null,
      drive_sync_error: r.drive_sync_error ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

async function hydrateSingleDocument(
  ctx: SessionContext,
  row: any,
  category?: DocumentCategory | null
): Promise<SchoolDocument> {
  const cat = category || (await fetchCategoryById(ctx, row.category_id));
  const catMap = new Map<string, DocumentCategory>();
  if (cat) catMap.set(cat.id, cat);

  const [profileMap, supMap] = await Promise.all([
    fetchProfileNamesMap(ctx, [row.uploaded_by, row.approved_by]),
    fetchSupersededSummaryMap(ctx, [row]),
  ]);

  return hydrateDocuments([row], catMap, profileMap, supMap)[0];
}

async function insertAuditRowWithFallback(
  sb: SupabaseClient,
  payload: Record<string, any>
): Promise<{ data: any; error: any }> {
  const res = await sb.from('document_audit_logs').insert(payload);
  if (res.error && res.error.code === '23514') {
    if (payload.action === 'AUTO_EXPIRE') {
      return await sb.from('document_audit_logs').insert({
        ...payload,
        action: 'EXPIRE',
        metadata: {
          ...(payload.metadata || {}),
          intended_action: 'AUTO_EXPIRE',
        },
      });
    }
    if (payload.action === 'CLONE_DOCUMENT') {
      return await sb.from('document_audit_logs').insert({
        ...payload,
        action: 'CREATE_DRAFT',
        metadata: {
          ...(payload.metadata || {}),
          intended_action: 'CLONE_DOCUMENT',
        },
      });
    }
    if (payload.action === 'EDIT_WHILE_SUBMITTED') {
      return await sb.from('document_audit_logs').insert({
        ...payload,
        action: 'UPDATE_METADATA',
        metadata: {
          ...(payload.metadata || {}),
          intended_action: 'EDIT_WHILE_SUBMITTED',
        },
      });
    }
  }
  return res;
}

async function appendDocumentAuditLog(
  ctx: SessionContext,
  params: {
    documentId: string;
    action: DocumentAuditAction;
    fromStatus: DocumentStatus | null;
    toStatus: DocumentStatus;
    reason?: string | null;
    metadata?: Record<string, any>;
    systemActorName?: string;
  }
): Promise<void> {
  try {
    const payload = {
      document_id: params.documentId,
      action: params.action,
      from_status: params.fromStatus,
      to_status: params.toStatus,
      reason: params.reason ? String(params.reason).trim() : null,
      actor_id: params.systemActorName ? null : getSafeProfileUuid(ctx),
      actor_name: params.systemActorName || getActorDisplayName(ctx),
      metadata: params.metadata || {},
    };

    const cfg = getSupabaseConfig();
    if (params.systemActorName && cfg.isValidServiceRoleKey) {
      await insertAuditRowWithFallback(getSupabaseAdminClient(false), payload);
      return;
    }

    await executeWithContextFallback(ctx, async (sb) =>
      await insertAuditRowWithFallback(sb, payload)
    );
  } catch (err) {
    console.warn('[DocumentAuditLog] Non-fatal insert error:', err);
  }
}

export async function listDocumentAuditLogs(
  ctx: SessionContext,
  documentId: string
): Promise<DocumentAuditLog[]> {
  if (!isValidUuid(documentId)) return [];
  const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('document_audit_logs')
      .select('id, document_id, action, from_status, to_status, reason, actor_id, actor_name, metadata, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
  );

  if (error || !Array.isArray(data)) return [];
  const profileMap = await fetchProfileNamesMap(
    ctx,
    data.map((row: any) => row.actor_id)
  );

  return data.map((row: any) => ({
    id: row.id,
    document_id: row.document_id,
    action: row.action as DocumentAuditAction,
    from_status: (row.from_status || null) as DocumentStatus | null,
    to_status: row.to_status as DocumentStatus,
    reason: row.reason ?? null,
    actor_id: row.actor_id ?? null,
    actor_name:
      row.actor_name || (row.actor_id ? profileMap.get(row.actor_id) || null : null) || 'Hệ thống',
    metadata: (row.metadata || {}) as Record<string, any>,
    created_at: row.created_at,
  }));
}

async function computeSequentialNumberFallback(
  ctx: SessionContext,
  year: number,
  symbol: string
): Promise<string> {
  const cleanSymbol = symbol.trim().toUpperCase() || 'CV-MNSM';
  const suffix = `/${year}/${cleanSymbol}`;
  const { data } = await executeWithContextFallback(ctx, async (sb) =>
    await sb
      .from('school_documents')
      .select('document_number')
      .not('document_number', 'is', null)
  );

  let maxSeq = 0;
  if (Array.isArray(data)) {
    data.forEach((row: any) => {
      const raw = String(row.document_number || '').trim();
      if (!raw.toUpperCase().endsWith(suffix)) return;
      const prefix = raw.slice(0, raw.length - suffix.length);
      if (/^\d+$/.test(prefix)) {
        const parsed = Number(prefix);
        if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
      }
    });
  }

  return formatSequentialDocumentNumber(maxSeq + 1, year, cleanSymbol);
}

export async function peekNextDocumentNumber(
  ctx: SessionContext,
  params: { year?: number; symbol?: string | null; categoryId?: string | null }
): Promise<string> {
  const todayYear = Number(extractDocumentYear(getTodayVietnamDate()));
  const year =
    params.year && Number.isInteger(params.year) && params.year >= 2000 && params.year <= 2100
      ? params.year
      : todayYear;

  let symbol = String(params.symbol || '').trim().toUpperCase();
  if (!symbol && params.categoryId && isValidUuid(params.categoryId)) {
    const cat = await fetchCategoryById(ctx, params.categoryId);
    symbol = getDefaultDocumentSymbolForCategory(cat?.code);
  }
  if (!symbol) symbol = 'CV-MNSM';

  try {
    const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.rpc('peek_next_document_number', {
        p_year: year,
        p_symbol: symbol,
      })
    );
    if (!error && typeof data === 'string' && data.trim()) {
      return data.trim();
    }
  } catch {
    // Fallback below
  }

  return computeSequentialNumberFallback(ctx, year, symbol);
}

async function generateNextDocumentNumber(
  ctx: SessionContext,
  params: { year: number; symbol: string }
): Promise<string> {
  const cleanSymbol = params.symbol.trim().toUpperCase() || 'CV-MNSM';
  try {
    const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.rpc('generate_next_document_number', {
        p_year: params.year,
        p_symbol: cleanSymbol,
      })
    );
    if (!error && typeof data === 'string' && data.trim()) {
      return data.trim();
    }
  } catch {
    // Fallback below
  }

  return computeSequentialNumberFallback(ctx, params.year, cleanSymbol);
}

export interface AutoExpireSweepResult {
  ok: true;
  today: string;
  scannedCount: number;
  expiredCount: number;
  expiredDocuments: Array<{
    id: string;
    title: string;
    document_number: string | null;
    expiration_date: string;
  }>;
}

/**
 * Quét các văn bản APPROVED có expiration_date < hôm nay (GMT+7),
 * chuyển sang EXPIRED và ghi audit log ('AUTO_EXPIRE').
 * Tuyệt đối KHÔNG xóa hoặc chỉnh sửa bản sao lưu trên Google Drive.
 */
export async function runAutoExpireDocumentsSweep(options?: {
  specificDocumentId?: string;
  systemActorName?: string;
  reason?: string;
  client?: SupabaseClient;
}): Promise<AutoExpireSweepResult | ServiceErrorResult> {
  const today = getTodayVietnamDate();
  let sb = options?.client;

  if (!sb) {
    const cfg = getSupabaseConfig();
    if (!cfg.isValidServiceRoleKey) {
      return fail(
        500,
        'MISSING_SERVICE_ROLE_KEY',
        'Thiếu SUPABASE_SERVICE_ROLE_KEY để chạy tác vụ tự động chuyển văn bản hết hiệu lực.'
      );
    }
    sb = getSupabaseAdminClient(false);
  }

  let query = sb
    .from('school_documents')
    .select('id, title, document_number, expiration_date')
    .eq('status', 'APPROVED')
    .not('expiration_date', 'is', null)
    .lt('expiration_date', today);

  if (options?.specificDocumentId) {
    query = query.eq('id', options.specificDocumentId);
  }

  const { data: candidates, error: scanErr } = await query;
  if (scanErr) {
    return fail(
      500,
      'AUTO_EXPIRE_SCAN_FAILED',
      scanErr.message || 'Không thể quét danh sách văn bản hết hiệu lực.'
    );
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      ok: true,
      today,
      scannedCount: 0,
      expiredCount: 0,
      expiredDocuments: [],
    };
  }

  const expiredIds = candidates.map((c: any) => c.id);
  const { data: transitioned, error: updErr } = await sb
    .from('school_documents')
    .update({ status: 'EXPIRED' })
    .in('id', expiredIds)
    .eq('status', 'APPROVED')
    .select('id, title, document_number, expiration_date');

  if (updErr || !Array.isArray(transitioned)) {
    return fail(
      500,
      'AUTO_EXPIRE_UPDATE_FAILED',
      updErr?.message || 'Không thể cập nhật trạng thái EXPIRED cho văn bản quá hạn.'
    );
  }

  const auditReason =
    options?.reason?.trim() || 'Tự động hết hiệu lực theo ngày kết thúc';
  const actorName = options?.systemActorName?.trim() || 'Vercel Cron Auto-Expire';

  for (const row of transitioned) {
    try {
      await insertAuditRowWithFallback(sb, {
        document_id: row.id,
        action: 'AUTO_EXPIRE',
        from_status: 'APPROVED',
        to_status: 'EXPIRED',
        reason: auditReason,
        actor_id: null,
        actor_name: actorName,
        metadata: {
          auto_expired: true,
          evaluated_date: today,
          expiration_date: row.expiration_date,
          drive_preserved: true,
        },
      });
    } catch (logErr) {
      console.warn('[AutoExpireAuditLog] Non-fatal insert error:', logErr);
    }
  }

  return {
    ok: true,
    today,
    scannedCount: candidates.length,
    expiredCount: transitioned.length,
    expiredDocuments: transitioned.map((row: any) => ({
      id: row.id,
      title: row.title,
      document_number: row.document_number ?? null,
      expiration_date: row.expiration_date,
    })),
  };
}

/**
 * Tự động chuyển các văn bản APPROVED có expiration_date < hôm nay (GMT+7) sang EXPIRED khi truy vấn đọc.
 */
async function autoExpireElapsedDocuments(
  ctx: SessionContext,
  specificDocumentId?: string
): Promise<void> {
  const cfg = getSupabaseConfig();
  const canMutateApproved =
    cfg.isValidServiceRoleKey || ctx.activeRole === 'SUPER_ADMIN';

  if (!canMutateApproved) return;

  try {
    if (cfg.isValidServiceRoleKey) {
      await runAutoExpireDocumentsSweep({
        specificDocumentId,
        systemActorName: 'Hệ thống tự động',
      });
    } else {
      await executeWithContextFallback(ctx, async (sb) => {
        await runAutoExpireDocumentsSweep({
          specificDocumentId,
          systemActorName: 'Hệ thống tự động',
          client: sb,
        });
        return { data: null, error: null };
      });
    }
  } catch {
    // Non-fatal auto-expiry guard
  }
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

  await autoExpireElapsedDocuments(ctx);

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

  const scopedRows = ((docsRes.data || []) as any[]).filter((row) =>
    isSuperAdmin ? true : row.visibility_scope === 'ALL_ADMINS'
  );

  const categoriesMap = new Map<string, DocumentCategory>();
  const countMap = new Map<string, number>();
  scopedRows.forEach((r) => {
    if (r.status === 'APPROVED') {
      countMap.set(r.category_id, (countMap.get(r.category_id) || 0) + 1);
    }
  });
  const categories = catRes.categories.map((c) => {
    const withCount = { ...c, document_count: countMap.get(c.id) || 0 };
    categoriesMap.set(c.id, withCount);
    return withCount;
  });

  const [profileMap, supMap] = await Promise.all([
    fetchProfileNamesMap(
      ctx,
      scopedRows.flatMap((r) => [r.uploaded_by, r.approved_by])
    ),
    fetchSupersededSummaryMap(ctx, scopedRows),
  ]);

  const allHydrated = hydrateDocuments(scopedRows, categoriesMap, profileMap, supMap);

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

  await autoExpireElapsedDocuments(ctx, id);

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
  const hydrated = await hydrateSingleDocument(ctx, rawDoc, category);

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
    effective_date?: string | null;
    expiration_date?: string | null;
    description?: string | null;
    visibility_scope?: string | null;
    storage_type: DocumentStorageType;
    external_url?: string | null;
    storage_path?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    mime_type?: string | null;
    file?: File | null;
    initial_action?: 'save_draft' | 'submit_for_approval' | string | null;
    creation_mode?: DocumentCreationMode | string | null;
    editor_content_html?: string | null;
    editor_template_code?: string | null;
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

  const effRes = normalizeOptionalDate(input.effective_date);
  if (!effRes.ok) return fail(400, 'INVALID_EFFECTIVE_DATE', `Ngày có hiệu lực: ${effRes.error}`);
  const expRes = normalizeOptionalDate(input.expiration_date);
  if (!expRes.ok) return fail(400, 'INVALID_EXPIRATION_DATE', `Ngày hết hiệu lực: ${expRes.error}`);

  const datePairCheck = validateEffectiveAndExpirationDates(
    effRes.date || issuedDate,
    expRes.date
  );
  if (!datePairCheck.ok) {
    return fail(400, 'INVALID_DATE_RANGE', datePairCheck.error);
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
  const dup = await checkDuplicateApprovedDocumentNumber(ctx, docNumber);
  if (dup) {
    return fail(
      409,
      'DUPLICATE_DOCUMENT_NUMBER',
      `Số hiệu văn bản "${docNumber}" đã tồn tại ở tài liệu đã phê duyệt ("${dup.title}").`
    );
  }

  const submitImmediately =
    String(input.initial_action || '').trim().toLowerCase() === 'submit_for_approval';
  const targetStatus: DocumentStatus = submitImmediately ? 'SUBMITTED' : 'DRAFT';

  const description = String(input.description || '').trim() || null;

  const rawCreationMode = String(input.creation_mode || '').trim().toUpperCase();
  const creationMode: DocumentCreationMode =
    rawCreationMode === 'ONLINE_EDITOR' ? 'ONLINE_EDITOR' : 'FILE_UPLOAD';

  const editorContentHtml =
    input.editor_content_html !== undefined && input.editor_content_html !== null
      ? String(input.editor_content_html).trim()
      : null;
  const editorTemplateCode =
    input.editor_template_code !== undefined && input.editor_template_code !== null
      ? String(input.editor_template_code).trim()
      : null;

  let storagePath: string | null = null;
  let externalUrl: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;

  if (creationMode === 'ONLINE_EDITOR') {
    if (!editorContentHtml) {
      return fail(400, 'MISSING_EDITOR_CONTENT', 'Vui lòng nhập nội dung văn bản trước khi lưu.');
    }
    const safeBase = buildSafeStorageFileName(title).replace(/\.[^.]+$/, '');
    fileName = `${safeBase || 'van_ban'}.docx`;
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (input.storage_type === 'EXTERNAL_LINK') {
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
    effective_date: effRes.date,
    expiration_date: expRes.date,
    category_id: category.id,
    storage_type: creationMode === 'ONLINE_EDITOR' ? 'SUPABASE_STORAGE' : input.storage_type,
    storage_path: storagePath,
    external_url: externalUrl,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    description,
    visibility_scope: visibilityScope,
    status: targetStatus,
    uploaded_by: getSafeProfileUuid(ctx),
    drive_sync_status: 'PENDING',
    creation_mode: creationMode,
    editor_content_html: editorContentHtml,
    editor_template_code: editorTemplateCode,
    generated_docx_path: null,
  };

  const { data: inserted, error: insertErr } = await executeWithContextFallback(ctx, async (sb) =>
    await sb.from('school_documents').insert(insertPayload).select('*').single()
  );

  if (insertErr || !inserted) {
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

  await appendDocumentAuditLog(ctx, {
    documentId: inserted.id,
    action: 'CREATE_DRAFT',
    fromStatus: null,
    toStatus: 'DRAFT',
    metadata: { title: inserted.title },
  });

  if (submitImmediately) {
    await appendDocumentAuditLog(ctx, {
      documentId: inserted.id,
      action: 'SUBMIT',
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      metadata: { submitted_on_create: true },
    });
  }

  const hydrated = await hydrateSingleDocument(ctx, inserted, category);
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
    effective_date?: unknown;
    expiration_date?: unknown;
    description?: unknown;
    visibility_scope?: unknown;
    status?: unknown;
    external_url?: unknown;
    creation_mode?: unknown;
    editor_content_html?: unknown;
    editor_template_code?: unknown;
  }
): Promise<{ ok: true; document: SchoolDocument } | ServiceErrorResult> {
  if (input.status !== undefined) {
    return fail(
      400,
      'USE_WORKFLOW_TRANSITION_ENDPOINT',
      'Không được thay đổi trạng thái trực tiếp qua PATCH. Vui lòng sử dụng quy trình chuyển trạng thái SRS (/transition).'
    );
  }

  const existingRes = await getDocumentById(ctx, id);
  if (!existingRes.ok) return existingRes;
  const existing = existingRes.document;

  // Quyền sửa: Cho phép sửa ở cả DRAFT và SUBMITTED; khóa cứng sau APPROVED và các trạng thái kết thúc
  if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED') {
    return fail(
      409,
      'DOCUMENT_LOCKED_NON_EDITABLE',
      existing.status === 'APPROVED'
        ? 'Văn bản đã phê duyệt không thể chỉnh sửa trực tiếp để bảo toàn tính pháp lý. Vui lòng sử dụng tính năng Thay thế hoặc Thu hồi.'
        : 'Văn bản đã thu hồi, bị thay thế hoặc hết hiệu lực không thể chỉnh sửa nội dung.'
    );
  }

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

  let nextIssuedDate = existing.issued_date;
  if (input.issued_date !== undefined) {
    const parsedDate = normalizeIssuedDate(
      String(input.issued_date || ''),
      existing.issued_date
    );
    if (!parsedDate) {
      return fail(400, 'INVALID_ISSUED_DATE', 'Ngày ban hành không đúng định dạng YYYY-MM-DD.');
    }
    updates.issued_date = parsedDate;
    nextIssuedDate = parsedDate;
  }

  let nextEffectiveDate = existing.effective_date ?? null;
  if (input.effective_date !== undefined) {
    const effRes = normalizeOptionalDate(String(input.effective_date || ''));
    if (!effRes.ok) return fail(400, 'INVALID_EFFECTIVE_DATE', `Ngày có hiệu lực: ${effRes.error}`);
    updates.effective_date = effRes.date;
    nextEffectiveDate = effRes.date;
  }

  let nextExpirationDate = existing.expiration_date ?? null;
  if (input.expiration_date !== undefined) {
    const expRes = normalizeOptionalDate(String(input.expiration_date || ''));
    if (!expRes.ok) {
      return fail(400, 'INVALID_EXPIRATION_DATE', `Ngày hết hiệu lực: ${expRes.error}`);
    }
    updates.expiration_date = expRes.date;
    nextExpirationDate = expRes.date;
  }

  const datePairCheck = validateEffectiveAndExpirationDates(
    nextEffectiveDate || nextIssuedDate,
    nextExpirationDate
  );
  if (!datePairCheck.ok) {
    return fail(400, 'INVALID_DATE_RANGE', datePairCheck.error);
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

  const nextDocNumber =
    input.document_number !== undefined
      ? normalizeDocumentNumber(String(input.document_number || ''))
      : existing.document_number ?? null;

  if (input.document_number !== undefined) {
    updates.document_number = nextDocNumber;
  }

  if (nextDocNumber && input.document_number !== undefined) {
    const dup = await checkDuplicateApprovedDocumentNumber(ctx, nextDocNumber, existing.id);
    if (dup) {
      return fail(
        409,
        'DUPLICATE_DOCUMENT_NUMBER',
        `Số hiệu văn bản "${nextDocNumber}" đã tồn tại ở tài liệu đã phê duyệt ("${dup.title}").`
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

  if (input.creation_mode !== undefined) {
    const mode = String(input.creation_mode || '').trim();
    if (mode === 'ONLINE_EDITOR' || mode === 'FILE_UPLOAD') {
      updates.creation_mode = mode;
    }
  }

  if (input.editor_content_html !== undefined) {
    const rawHtml = String(input.editor_content_html || '').trim();
    const targetMode = updates.creation_mode || existing.creation_mode;
    if (!rawHtml && targetMode === 'ONLINE_EDITOR') {
      return fail(400, 'MISSING_EDITOR_CONTENT', 'Nội dung văn bản không được để trống.');
    }
    updates.editor_content_html = rawHtml || null;
  }

  if (input.editor_template_code !== undefined) {
    updates.editor_template_code = String(input.editor_template_code || '').trim() || null;
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
        `Số hiệu văn bản "${nextDocNumber}" đã tồn tại ở tài liệu đã phê duyệt.`
      );
    }
    return fail(500, 'UPDATE_DOCUMENT_FAILED', updErr?.message || 'Không thể cập nhật tài liệu.');
  }

  const isEditingSubmitted = existing.status === 'SUBMITTED';
  const auditAction: DocumentAuditAction = isEditingSubmitted
    ? 'EDIT_WHILE_SUBMITTED'
    : 'UPDATE_METADATA';

  await appendDocumentAuditLog(ctx, {
    documentId: id,
    action: auditAction,
    fromStatus: existing.status,
    toStatus: existing.status,
    reason: isEditingSubmitted
      ? 'Chỉnh sửa và cập nhật nội dung văn bản khi đang trong hàng đợi chờ duyệt'
      : null,
    metadata: {
      updated_fields: Object.keys(updates),
      edited_while_submitted: isEditingSubmitted,
    },
  });

  let hydrated = await hydrateSingleDocument(ctx, updatedRow, targetCategory);

  // Chỉ đồng bộ Google Drive khi tài liệu ở trạng thái APPROVED
  if (hydrated.status === 'APPROVED' && targetCategory) {
    const metadataChangedForDrive =
      input.title !== undefined ||
      input.document_number !== undefined ||
      input.category_id !== undefined ||
      input.issued_date !== undefined ||
      input.description !== undefined ||
      input.external_url !== undefined ||
      input.visibility_scope !== undefined ||
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
        hydrated = await hydrateSingleDocument(ctx, updatedAfterDrive, targetCategory);
      } else {
        hydrated = { ...hydrated, ...driveOutcome };
      }
    }
  }

  return { ok: true, document: hydrated };
}

export async function transitionDocumentWorkflow(
  ctx: SessionContext,
  id: string,
  input: {
    action?: unknown;
    reason?: unknown;
    document_number?: unknown;
    number_symbol?: unknown;
    auto_generate_number?: unknown;
    effective_date?: unknown;
    expiration_date?: unknown;
    superseded_by_id?: unknown;
  }
): Promise<{ ok: true; document: SchoolDocument; audit_logs: DocumentAuditLog[] } | ServiceErrorResult> {
  const existingRes = await getDocumentById(ctx, id);
  if (!existingRes.ok) return existingRes;
  const existing = existingRes.document;

  const actionStr = String(input.action || '').trim();
  const transitionCheck = validateWorkflowTransition({
    fromStatus: existing.status,
    action: actionStr,
    activeRole: ctx.activeRole,
  });
  if (!transitionCheck.ok) {
    return fail(transitionCheck.status, transitionCheck.code, transitionCheck.error);
  }

  const { rule } = transitionCheck;
  const reason = String(input.reason || '').trim() || null;

  if (rule.requiresReason && !reason) {
    return fail(
      400,
      'MISSING_REJECTION_REASON',
      rule.action === 'reject'
        ? 'Vui lòng nhập lý do từ chối phê duyệt văn bản.'
        : 'Vui lòng nhập lý do thu hồi khẩn cấp văn bản.'
    );
  }

  const today = getTodayVietnamDate();
  const updates: Record<string, any> = {
    status: rule.toStatus,
  };
  const auditMetadata: Record<string, any> = {};

  if (rule.action === 'submit_for_approval') {
    const hasSource =
      existing.creation_mode === 'ONLINE_EDITOR'
        ? Boolean(existing.editor_content_html && existing.editor_content_html.trim())
        : existing.storage_type === 'EXTERNAL_LINK'
          ? Boolean(existing.external_url)
          : Boolean(existing.storage_path);
    if (!existing.title?.trim() || !existing.category_id || !hasSource) {
      return fail(
        400,
        'INCOMPLETE_DRAFT_FOR_SUBMISSION',
        existing.creation_mode === 'ONLINE_EDITOR'
          ? 'Vui lòng nhập nội dung văn bản trước khi trình duyệt.'
          : 'Tài liệu cần có đủ tiêu đề, danh mục và tệp/liên kết đính kèm trước khi trình duyệt.'
      );
    }
  }

  if (rule.action === 'approve') {
    let effDate = existing.effective_date || existing.issued_date || today;
    if (input.effective_date !== undefined && String(input.effective_date || '').trim()) {
      const effRes = normalizeOptionalDate(String(input.effective_date || ''));
      if (!effRes.ok || !effRes.date) {
        return fail(400, 'INVALID_EFFECTIVE_DATE', 'Ngày có hiệu lực không đúng định dạng YYYY-MM-DD.');
      }
      effDate = effRes.date;
    }

    let expDate: string | null = existing.expiration_date ?? null;
    if (input.expiration_date !== undefined) {
      const expRes = normalizeOptionalDate(String(input.expiration_date || ''));
      if (!expRes.ok) {
        return fail(400, 'INVALID_EXPIRATION_DATE', `Ngày hết hiệu lực: ${expRes.error}`);
      }
      expDate = expRes.date;
    }

    const pairCheck = validateEffectiveAndExpirationDates(effDate, expDate);
    if (!pairCheck.ok) {
      return fail(400, 'INVALID_DATE_RANGE', pairCheck.error);
    }

    const category =
      existingRes.category || (await fetchCategoryById(ctx, existing.category_id));
    const requestedNumber = normalizeDocumentNumber(
      input.document_number !== undefined
        ? String(input.document_number || '')
        : existing.document_number
    );

    const shouldAutoGenerate =
      input.auto_generate_number === true || !requestedNumber;

    let finalDocNumber = requestedNumber;
    if (shouldAutoGenerate && !requestedNumber) {
      const targetYear = Number(extractDocumentYear(effDate));
      const requestedSymbol = String(input.number_symbol || '').trim().toUpperCase();
      const symbol = requestedSymbol || getDefaultDocumentSymbolForCategory(category?.code);
      finalDocNumber = await generateNextDocumentNumber(ctx, { year: targetYear, symbol });
      auditMetadata.auto_numbered = true;
    }

    if (finalDocNumber) {
      const dup = await checkDuplicateApprovedDocumentNumber(ctx, finalDocNumber, existing.id);
      if (dup) {
        return fail(
          409,
          'DUPLICATE_DOCUMENT_NUMBER',
          `Số hiệu văn bản "${finalDocNumber}" đã tồn tại ở tài liệu đã phê duyệt ("${dup.title}").`
        );
      }
    }

    updates.document_number = finalDocNumber;
    updates.effective_date = effDate;
    updates.expiration_date = expDate;
    updates.approved_by = getSafeProfileUuid(ctx);
    updates.approved_at = new Date().toISOString();
    updates.rejection_reason = null;

    auditMetadata.document_number = finalDocNumber;
    auditMetadata.effective_date = effDate;
    auditMetadata.expiration_date = expDate;

    if (existing.creation_mode === 'ONLINE_EDITOR') {
      try {
        const docxBuffer = await generateDocumentDocxBuffer({
          title: existing.title,
          documentNumber: finalDocNumber,
          issuedDate: existing.issued_date,
          effectiveDate: effDate,
          categoryName: category?.name,
          editorContentHtml: existing.editor_content_html,
          status: 'APPROVED',
          approverName: getActorDisplayName(ctx),
          approvedAt: updates.approved_at,
          isDraft: false,
        });

        const [year, month] = (effDate || today).split('-');
        const safeBase = buildSafeStorageFileName(existing.title).replace(/\.[^.]+$/, '');
        const targetPath = `${year}/${month}/${crypto.randomUUID()}_${safeBase || 'van_ban'}.docx`;
        const fileName = `${safeBase || 'van_ban'}.docx`;
        const mimeType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const sb = await getPreferredStorageClient(ctx);
        await ensurePrivateDocumentBucketIfPossible(sb);

        const { data: upData, error: upErr } = await sb.storage
          .from(DOCUMENT_BUCKET_NAME)
          .upload(targetPath, docxBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!upErr && upData?.path) {
          updates.generated_docx_path = upData.path;
          updates.storage_path = upData.path;
          updates.storage_type = 'SUPABASE_STORAGE';
          updates.file_name = fileName;
          updates.file_size = docxBuffer.length;
          updates.mime_type = mimeType;
          auditMetadata.docx_generated = true;
        } else {
          console.warn('[DocxGeneration] Storage upload failed:', upErr);
        }
      } catch (docxErr) {
        console.warn('[DocxGeneration] Error generating docx during approve:', docxErr);
      }
    }
  }

  if (rule.action === 'reject' || rule.action === 'withdraw') {
    updates.rejection_reason = reason;
  }

  if (rule.action === 'supersede') {
    const targetId = String(input.superseded_by_id || '').trim();
    if (!isValidUuid(targetId)) {
      return fail(
        400,
        'MISSING_SUPERSEDED_BY_ID',
        'Vui lòng chọn văn bản mới thay thế (superseded_by_id).'
      );
    }
    if (targetId === existing.id) {
      return fail(
        400,
        'SELF_SUPERSEDE_NOT_ALLOWED',
        'Không thể chọn chính văn bản hiện tại làm văn bản thay thế.'
      );
    }

    const replacementRes = await getDocumentById(ctx, targetId);
    if (!replacementRes.ok) {
      return fail(
        replacementRes.status === 403 ? 403 : 404,
        'INVALID_REPLACEMENT_DOCUMENT',
        'Không tìm thấy hoặc không có quyền truy cập văn bản thay thế được chọn.'
      );
    }
    if (replacementRes.document.status !== 'APPROVED') {
      return fail(
        409,
        'REPLACEMENT_MUST_BE_APPROVED',
        'Văn bản thay thế bắt buộc phải đang ở trạng thái Đã phê duyệt (APPROVED).'
      );
    }

    updates.superseded_by_id = targetId;
    auditMetadata.superseded_by_id = targetId;
    auditMetadata.superseded_by_number = replacementRes.document.document_number ?? null;
    auditMetadata.superseded_by_title = replacementRes.document.title;
  }

  if (rule.action === 'expire') {
    updates.expiration_date = existing.expiration_date || today;
    auditMetadata.expiration_date = updates.expiration_date;
  }

  const { data: updatedRow, error: updErr } = await executeWithContextFallback(ctx, async (sb) =>
    await sb.from('school_documents').update(updates).eq('id', id).select('*').single()
  );

  if (updErr || !updatedRow) {
    if (updErr?.code === '23505') {
      return fail(
        409,
        'DUPLICATE_DOCUMENT_NUMBER',
        'Số hiệu văn bản đã trùng với một tài liệu đang phê duyệt khác.'
      );
    }
    return fail(
      500,
      'WORKFLOW_TRANSITION_FAILED',
      updErr?.message || 'Không thể chuyển trạng thái tài liệu.'
    );
  }

  await appendDocumentAuditLog(ctx, {
    documentId: id,
    action: rule.auditAction,
    fromStatus: existing.status,
    toStatus: rule.toStatus,
    reason,
    metadata: auditMetadata,
  });

  const targetCategory =
    existingRes.category ||
    (await fetchCategoryById(ctx, updatedRow.category_id)) || {
      id: updatedRow.category_id,
      code: 'CHUNG',
      name: 'Tài liệu chung',
      sort_order: 0,
    };

  let hydrated = await hydrateSingleDocument(ctx, updatedRow, targetCategory);

  // Kích hoạt tự động sao lưu Google Drive ngay tại bước APPROVED
  if (rule.action === 'approve') {
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
      hydrated = await hydrateSingleDocument(ctx, updatedAfterDrive, targetCategory);
    } else {
      hydrated = { ...hydrated, ...driveOutcome };
    }

    if (driveOutcome.drive_sync_status === 'SYNCED' || driveOutcome.drive_sync_status === 'FAILED') {
      await appendDocumentAuditLog(ctx, {
        documentId: id,
        action: 'DRIVE_SYNC',
        fromStatus: 'APPROVED',
        toStatus: 'APPROVED',
        reason:
          driveOutcome.drive_sync_status === 'SYNCED'
            ? 'Tự động sao lưu Google Drive sau phê duyệt thành công.'
            : driveOutcome.drive_sync_error || 'Lỗi sao lưu Google Drive sau phê duyệt.',
        metadata: {
          drive_sync_status: driveOutcome.drive_sync_status,
          drive_file_id: driveOutcome.drive_file_id,
          drive_web_view_link: driveOutcome.drive_web_view_link,
        },
      });
    }
  }

  const auditLogs = await listDocumentAuditLogs(ctx, id);
  return { ok: true, document: hydrated, audit_logs: auditLogs };
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

  if (doc.status !== 'APPROVED') {
    return fail(
      400,
      'DOCUMENT_NOT_APPROVED',
      'Chỉ hỗ trợ đồng bộ Google Drive cho tài liệu đã được phê duyệt (APPROVED).'
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
  const hydrated = updatedRow
    ? await hydrateSingleDocument(ctx, updatedRow, category)
    : { ...doc, ...driveOutcome };

  await appendDocumentAuditLog(ctx, {
    documentId: doc.id,
    action: 'DRIVE_SYNC',
    fromStatus: doc.status,
    toStatus: doc.status,
    reason:
      driveOutcome.drive_sync_status === 'SYNCED'
        ? 'Đồng bộ thủ công lên Google Drive thành công.'
        : driveOutcome.drive_sync_error || 'Đồng bộ Google Drive không thành công.',
    metadata: {
      drive_sync_status: driveOutcome.drive_sync_status,
      drive_file_id: driveOutcome.drive_file_id,
    },
  });

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

  if (doc.status !== 'DRAFT') {
    return fail(
      409,
      'CANNOT_DELETE_NON_DRAFT',
      'Chỉ được phép xóa tài liệu ở trạng thái Bản nháp (DRAFT). Văn bản đã trình duyệt hoặc đã phê duyệt không thể xóa để bảo toàn tính pháp lý và lịch sử kiểm định.'
    );
  }

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

export async function generateDraftDocxForDocument(
  ctx: SessionContext,
  id: string
): Promise<
  | { ok: true; buffer: Buffer; fileName: string; isApproved: boolean }
  | ServiceErrorResult
> {
  const docRes = await getDocumentById(ctx, id);
  if (!docRes.ok) return docRes;
  const doc = docRes.document;

  if (doc.creation_mode !== 'ONLINE_EDITOR') {
    return fail(
      400,
      'NOT_AN_ONLINE_EDITOR_DOCUMENT',
      'Tài liệu này không được tạo từ trình soạn thảo trực tuyến.'
    );
  }

  const isApproved = doc.status === 'APPROVED';

  // Nếu đã phê duyệt và có tệp trên Storage, tải tệp từ Storage để bảo đảm tính chuẩn xác
  if (isApproved && doc.storage_path) {
    try {
      const sb = await getPreferredStorageClient(ctx);
      const { data, error } = await sb.storage
        .from(DOCUMENT_BUCKET_NAME)
        .download(doc.storage_path);
      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const safeBase = buildSafeStorageFileName(doc.title).replace(/\.[^.]+$/, '');
        return {
          ok: true,
          buffer,
          fileName: `${safeBase || 'van_ban'}.docx`,
          isApproved: true,
        };
      }
    } catch {
      // Fallback sang tự sinh lại bên dưới nếu storage download tạm thời lỗi
    }
  }

  const buffer = await generateDocumentDocxBuffer({
    title: doc.title,
    documentNumber: doc.document_number,
    issuedDate: doc.issued_date,
    effectiveDate: doc.effective_date,
    categoryName: doc.category?.name,
    editorContentHtml: doc.editor_content_html,
    status: doc.status,
    approverName: doc.approver_name,
    approvedAt: doc.approved_at,
    isDraft: !isApproved,
  });

  const safeBase = buildSafeStorageFileName(doc.title).replace(/\.[^.]+$/, '');
  const prefix = isApproved ? '' : '[Bản nháp] ';
  const fileName = `${prefix}${safeBase || 'van_ban'}.docx`;

  return { ok: true, buffer, fileName, isApproved };
}

export async function cloneDocumentRecord(
  ctx: SessionContext,
  id: string
): Promise<{ ok: true; document: SchoolDocument } | ServiceErrorResult> {
  const existingRes = await getDocumentById(ctx, id);
  if (!existingRes.ok) return existingRes;
  const source = existingRes.document;

  const profileId = getSafeProfileUuid(ctx);
  const clonedTitle = `${source.title} (Bản sao)`;
  const today = getTodayVietnamDate();

  let targetCreationMode = source.creation_mode || 'FILE_UPLOAD';
  let targetEditorHtml = source.editor_content_html || null;
  let targetTemplateCode = source.editor_template_code || null;

  // Nếu bản gốc là tệp .docx trong Storage nhưng chưa có editor_content_html:
  // Tự động chuyển đổi nội dung .docx sang HTML và bật ONLINE_EDITOR cho bản sao
  if (!targetEditorHtml && isDocxFileRecord(source) && source.storage_path) {
    try {
      const extRes = await extractHtmlForDocument(ctx, source);
      if (extRes.ok && extRes.html) {
        targetEditorHtml = extRes.html;
        targetCreationMode = 'ONLINE_EDITOR';
        targetTemplateCode = targetTemplateCode || 'BLANK';
      }
    } catch {
      // Giữ nguyên file copy fallback
    }
  }

  const insertPayload = {
    title: clonedTitle,
    document_number: null,
    category_id: source.category_id,
    issued_date: today,
    effective_date: null,
    expiration_date: null,
    visibility_scope: source.visibility_scope,
    description: source.description || null,
    status: 'DRAFT' as DocumentStatus,
    storage_type: source.storage_type,
    storage_path: source.storage_type === 'SUPABASE_STORAGE' ? source.storage_path : null,
    file_name: source.storage_type === 'SUPABASE_STORAGE' ? source.file_name : null,
    file_size: source.storage_type === 'SUPABASE_STORAGE' ? source.file_size : null,
    mime_type: source.storage_type === 'SUPABASE_STORAGE' ? source.mime_type : null,
    external_url: source.storage_type === 'EXTERNAL_LINK' ? source.external_url : null,
    drive_sync_status: 'PENDING' as DocumentDriveSyncStatus,
    drive_file_id: null,
    drive_web_view_link: null,
    creation_mode: targetCreationMode,
    editor_content_html: targetEditorHtml,
    editor_template_code: targetTemplateCode,
    generated_docx_path: null,
    uploaded_by: profileId,
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    superseded_by_id: null,
  };

  const { data: inserted, error: insertErr } = await executeWithContextFallback(
    ctx,
    async (sb) =>
      await sb.from('school_documents').insert(insertPayload).select('*').single()
  );

  if (insertErr || !inserted) {
    return fail(
      500,
      'CLONE_DOCUMENT_FAILED',
      insertErr?.message || 'Không thể nhân bản văn bản.'
    );
  }

  await appendDocumentAuditLog(ctx, {
    documentId: inserted.id,
    action: 'CLONE_DOCUMENT',
    fromStatus: null,
    toStatus: 'DRAFT',
    reason: `Nhân bản từ văn bản "${source.title}" (${source.id})`,
    metadata: {
      cloned_from_id: source.id,
      cloned_from_title: source.title,
      cloned_from_status: source.status,
    },
  });

  const hydrated = await hydrateSingleDocument(ctx, inserted, existingRes.category);
  return { ok: true, document: hydrated };
}
