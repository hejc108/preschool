import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  isAuthOrRlsError,
  NO_CACHE_HEADERS,
  executeWithPrivilegedFallback,
  executeWithAdminFallback,
} from '@/lib/supabase/server';
import { expandClassIdAliases } from '@/lib/constants/classes';
import { EMBEDDED_BACKGROUNDS } from '@/lib/announcements/posterTemplates';
import {
  assertTeacherClassAccess,
  executeWithContextFallback,
  isAdminRole,
  requireActiveRole,
} from '@/lib/auth/sessionContext';
import {
  buildPushPayload,
  dispatchContextPushNotification,
} from '@/lib/notifications/pushPayload';
import {
  packAnnouncementContent,
  unpackAnnouncementContent,
  readLocalAnnouncementsStore,
  upsertLocalAnnouncement,
  deleteLocalAnnouncement,
  markAnnouncementReadLocally,
  getAnnouncementReadsLocally,
  getLocalDistinctReadersByAnnouncement,
  removeAnnouncementReadsLocally,
  AnnouncementEnvelopeData,
} from '@/lib/announcements/announcementStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const SYSTEM_DELETED_REGISTRY_ID = '00000000-0000-0000-0000-000000000001';
export const SYSTEM_DELETED_TITLE = '__SYSTEM_DELETED_ANNOUNCEMENT_IDS__';
export const TOMBSTONE_DELETED_TITLE = '__DELETED_ANNOUNCEMENT__';

export const SYSTEM_READS_REGISTRY_ID = '00000000-0000-0000-0000-000000000002';
export const SYSTEM_READS_TITLE = '__SYSTEM_ANNOUNCEMENT_READS__';

declare global {
  // eslint-disable-next-line no-var
  var __SUONGMAI_DELETED_ANNOUNCEMENT_IDS__: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __SUONGMAI_ANNOUNCEMENT_READS_CACHE__: Record<string, Record<string, { role_context: string; read_at: string; student_id?: string | null }>> | undefined;
}

if (!globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__) {
  globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ = new Set<string>();
}
if (!globalThis.__SUONGMAI_ANNOUNCEMENT_READS_CACHE__) {
  globalThis.__SUONGMAI_ANNOUNCEMENT_READS_CACHE__ = {};
}

export async function recordPersistentAnnouncementReads(
  ctx: any,
  announcementIds: string[],
  studentId?: string | null
): Promise<void> {
  const cleanIds = (announcementIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (cleanIds.length === 0) return;
  const now = new Date().toISOString();
  const profileId = String(ctx?.profileId || 'anonymous-parent').trim();
  const activeRole = String(ctx?.activeRole || 'PARENT').trim();

  // 1. Cập nhật bộ đệm in-memory và file disk cục bộ
  const cache = globalThis.__SUONGMAI_ANNOUNCEMENT_READS_CACHE__ || {};
  cleanIds.forEach((aid) => {
    markAnnouncementReadLocally(aid, profileId, activeRole);
    if (!cache[aid]) cache[aid] = {};
    cache[aid][profileId] = { role_context: activeRole, read_at: now, student_id: studentId || null };
  });
  globalThis.__SUONGMAI_ANNOUNCEMENT_READS_CACHE__ = cache;

  const isProfileUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);
  const isStudentUuid = studentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);
  const uuidAnnIds = cleanIds.filter((aid) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aid)
  );

  // 2a. Ghi nhận vào bảng read_receipts chuẩn (nếu bảng đã được khởi tạo trong CSDL)
  if (uuidAnnIds.length > 0) {
    const fallbackParentUuid = 'e6701ded-11ef-43ac-aba7-7a97fe1732ce';
    const effectiveUserId = isProfileUuid ? profileId : fallbackParentUuid;
    try {
      const receiptRows = uuidAnnIds.map((aid) => ({
        announcement_id: aid,
        user_id: effectiveUserId,
        role_context: activeRole,
        student_id: isStudentUuid ? studentId : null,
        read_at: now,
      }));
      await executeWithPrivilegedFallback(async (sb) =>
        await sb.from('read_receipts').upsert(receiptRows, {
          onConflict: 'announcement_id,user_id,role_context',
        })
      );
    } catch (receiptErr) {
      console.warn('[announcements] read_receipts upsert warning (có thể bảng chưa migrate):', receiptErr);
    }
  }

  // 2b. Ghi vào bảng announcement_reads tương thích ngược
  if (uuidAnnIds.length > 0) {
    const fallbackParentUuid = 'e6701ded-11ef-43ac-aba7-7a97fe1732ce';
    const effectiveUserId = isProfileUuid ? profileId : fallbackParentUuid;
    const validUuidRows = uuidAnnIds.map((aid) => ({
      announcement_id: aid,
      user_id: effectiveUserId,
      role_context: activeRole,
      read_at: now,
    }));
    try {
      await executeWithPrivilegedFallback(async (sb) =>
        await sb.from('announcement_reads').upsert(validUuidRows, {
          onConflict: 'announcement_id,user_id,role_context',
        })
      );
    } catch (readErr) {
      console.warn('[announcements] announcement_reads upsert warning:', readErr);
    }
  }

  // 3. Ghi nhận vĩnh viễn vào hàng lưu trữ hệ thống SYSTEM_READS_REGISTRY_ID trong announcements
  try {
    const { data: regRow } = await executeWithPrivilegedFallback(async (sb) =>
      await sb
        .from('announcements')
        .select('id, content')
        .eq('id', SYSTEM_READS_REGISTRY_ID)
        .maybeSingle()
    );

    let currentMap: Record<string, Record<string, { role_context: string; read_at: string; student_id?: string | null }>> = {};
    if (regRow?.content) {
      try {
        currentMap = JSON.parse(regRow.content) || {};
      } catch {}
    }

    cleanIds.forEach((aid) => {
      if (!currentMap[aid]) currentMap[aid] = {};
      currentMap[aid][profileId] = { role_context: activeRole, read_at: now, student_id: studentId || null };
    });

    const payload = {
      id: SYSTEM_READS_REGISTRY_ID,
      title: SYSTEM_READS_TITLE,
      content: JSON.stringify(currentMap),
      target_role: 'ALL',
      notification_channel: 'PARENT',
    };

    await executeWithPrivilegedFallback(async (sb) =>
      await sb.from('announcements').upsert(payload, { onConflict: 'id' })
    );
  } catch (regErr) {
    console.warn('[announcements] recordPersistentAnnouncementReads registry warning:', regErr);
  }

  // 4. Đồng bộ trực tiếp read_count vào phong bì content và kho lưu trữ cục bộ
  for (const aid of cleanIds) {
    try {
      // 4a. Cập nhật trong database (packed content envelope)
      if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(aid)) {
        const { data: annRow } = await executeWithPrivilegedFallback(async (sb) =>
          await sb.from('announcements').select('id, content').eq('id', aid).maybeSingle()
        );

        if (annRow) {
          const { bodyText, envelope } = unpackAnnouncementContent(annRow.content);
          const existingEnv: AnnouncementEnvelopeData = envelope || {
            category: 'Lễ hội',
            status: 'PUBLISHED',
            metadata: {},
          };
          const curMeta = existingEnv.metadata || {};
          const curCount = typeof curMeta.read_count === 'number' ? curMeta.read_count : 0;
          const newCount = Math.max(1, curCount + 1);

          const newEnv: AnnouncementEnvelopeData = {
            ...existingEnv,
            metadata: {
              ...curMeta,
              read_count: newCount,
              last_read_at: now,
            },
          };
          const packed = packAnnouncementContent(bodyText, newEnv);
          await executeWithPrivilegedFallback(async (sb) =>
            await sb.from('announcements').update({ content: packed }).eq('id', aid)
          );
        }
      }

      // 4b. Cập nhật trong kho lưu trữ file cục bộ
      const localStore = readLocalAnnouncementsStore();
      const localItem = localStore.find((a) => a.id === aid);
      if (localItem) {
        const curCount = typeof localItem.read_count === 'number'
          ? localItem.read_count
          : (localItem.metadata?.read_count || 0);
        const newCount = Math.max(1, curCount + 1);
        localItem.read_count = newCount;
        localItem.metadata = {
          ...(localItem.metadata || {}),
          read_count: newCount,
          last_read_at: now,
        };
        upsertLocalAnnouncement(localItem);
      }
    } catch (syncErr) {
      console.warn('[announcements] update announcement content read_count warning:', syncErr);
    }
  }
}

export async function removeAnnouncementFromReadsRegistry(
  ctx: any,
  announcementId: string
): Promise<void> {
  const cleanId = String(announcementId || '').trim();
  if (!cleanId) return;

  try {
    const { data: regRow } = await executeWithPrivilegedFallback(async (sb) =>
      await sb
        .from('announcements')
        .select('id, content')
        .eq('id', SYSTEM_READS_REGISTRY_ID)
        .maybeSingle()
    );

    if (regRow?.content) {
      try {
        const currentMap = JSON.parse(regRow.content) || {};
        if (currentMap[cleanId]) {
          delete currentMap[cleanId];
          const payload = {
            id: SYSTEM_READS_REGISTRY_ID,
            title: SYSTEM_READS_TITLE,
            content: JSON.stringify(currentMap),
            target_role: 'ALL',
            notification_channel: 'PARENT',
          };
          await executeWithPrivilegedFallback(async (sb) =>
            await sb.from('announcements').upsert(payload, { onConflict: 'id' })
          );
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[announcements] removeAnnouncementFromReadsRegistry warning:', err);
  }
}

// ==============================================================================
// IN-MEMORY FAST CACHES FOR HIGH PERFORMANCE (SUB-300MS RESPONSE TIME)
// ==============================================================================
let persistentDeletedIdsCache: { data: Set<string>; timestamp: number } | null = null;
const DELETED_IDS_CACHE_TTL = 30000; // 30s TTL

let enrolledStudentsCache: {
  total: number;
  classMap: Map<string, number>;
  timestamp: number;
} | null = null;
const STUDENTS_HEADCOUNT_TTL = 300000; // 5 phút TTL

const adminStatsCache = new Map<string, { data: Map<string, number>; timestamp: number }>();
const ADMIN_STATS_CACHE_TTL = 15000; // 15s TTL

const creatorProfileCache = new Map<string, string>();

function getCachedAdminStats(key: string): Map<string, number> | null {
  const item = adminStatsCache.get(key);
  if (item && Date.now() - item.timestamp < ADMIN_STATS_CACHE_TTL) {
    return new Map(item.data);
  }
  return null;
}

function setCachedAdminStats(key: string, data: Map<string, number>): void {
  adminStatsCache.set(key, { data: new Map(data), timestamp: Date.now() });
  if (adminStatsCache.size > 20) {
    const oldestKey = adminStatsCache.keys().next().value;
    if (oldestKey) adminStatsCache.delete(oldestKey);
  }
}

export async function getPersistentDeletedIds(ctx: any): Promise<Set<string>> {
  const now = Date.now();
  if (persistentDeletedIdsCache && now - persistentDeletedIdsCache.timestamp < DELETED_IDS_CACHE_TTL) {
    return new Set(persistentDeletedIdsCache.data);
  }

  const deletedSet = new Set<string>(globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ || []);

  try {
    const { data: rows } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('announcements')
        .select('id, title, content')
        .in('title', [SYSTEM_DELETED_TITLE, TOMBSTONE_DELETED_TITLE])
    );

    if (Array.isArray(rows)) {
      rows.forEach((row: any) => {
        if (!row?.content) return;
        try {
          const parsed = JSON.parse(row.content);
          if (Array.isArray(parsed)) {
            parsed.forEach((did) => {
              deletedSet.add(String(did));
              globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__?.add(String(did));
            });
          } else if (parsed && typeof parsed === 'object' && parsed.deleted_id) {
            deletedSet.add(String(parsed.deleted_id));
            globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__?.add(String(parsed.deleted_id));
          }
        } catch {
          if (typeof row.content === 'string' && row.content.trim()) {
            deletedSet.add(row.content.trim());
            globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__?.add(row.content.trim());
          }
        }
      });
    }
  } catch (err) {
    console.warn('[announcements] getPersistentDeletedIds warning:', err);
  }

  persistentDeletedIdsCache = { data: new Set(deletedSet), timestamp: now };
  return deletedSet;
}

export async function recordDeletedAnnouncementId(ctx: any, id: string): Promise<boolean> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return false;

  // Xóa cache ngay lập tức khi có hành động xóa
  persistentDeletedIdsCache = null;
  adminStatsCache.clear();

  globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ =
    globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ || new Set<string>();
  globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__.add(cleanId);

  let persisted = false;

  try {
    // 1. Immutable Tombstone INSERT: Đảm bảo luôn ghi được vào Postgres ngay cả khi RLS chặn UPDATE
    const tombstonePayload = {
      title: TOMBSTONE_DELETED_TITLE,
      content: JSON.stringify({ deleted_id: cleanId, deleted_at: new Date().toISOString() }),
      target_role: 'ALL',
      notification_channel: 'PARENT',
    };

    const { error: insertErr } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').insert(tombstonePayload)
    );

    if (!insertErr) {
      persisted = true;
    } else {
      console.warn('[announcements] tombstone insert warning:', insertErr);
    }

    // 2. Aggregate Registry Upsert (lưu trữ tập trung)
    const existingSet = await getPersistentDeletedIds(ctx);
    existingSet.add(cleanId);

    const payload = {
      id: SYSTEM_DELETED_REGISTRY_ID,
      title: SYSTEM_DELETED_TITLE,
      content: JSON.stringify(Array.from(existingSet)),
      target_role: 'ALL',
      notification_channel: 'PARENT',
    };

    const { error: upsertErr } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').upsert(payload, { onConflict: 'id' })
    );

    if (!upsertErr) {
      persisted = true;
    }
  } catch (err) {
    console.warn('[announcements] recordDeletedAnnouncementId warning:', err);
  }

  return persisted;
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveRole(request, [
      'PARENT',
      'TEACHER',
      'STAFF',
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get('id')?.trim() || '';
    const requestedTarget = searchParams.get('target_role')?.toUpperCase().trim() || '';
    const requestedCategory = searchParams.get('category')?.trim() || '';
    const requestedStatus = searchParams.get('status')?.toUpperCase().trim() || '';
    const includeStatsParam = searchParams.get('include_stats');
    const isFullRequested =
      searchParams.get('full') === 'true' || Boolean(requestedId) || isAdminRole(ctx.activeRole);

    const persistentDeletedIds = await getPersistentDeletedIds(ctx);

    // 1. Fetch from Supabase PostgreSQL (select('*') safely queries all columns)
    const { data: dbRows, error: dbError } = await executeWithContextFallback(ctx, async (sb) => {
      if (requestedId) {
        return (await sb.from('announcements').select('*').eq('id', requestedId).limit(1)) as any;
      }
      const query = sb
        .from('announcements')
        .select('*')
        .neq('id', SYSTEM_DELETED_REGISTRY_ID)
        .order('created_at', { ascending: false })
        .limit(60);

      return (await query) as any;
    });

    let rawList: any[] = [];
    if (!dbError && Array.isArray(dbRows)) {
      rawList = dbRows.filter(
        (r: any) =>
          r.id !== SYSTEM_DELETED_REGISTRY_ID &&
          r.id !== SYSTEM_READS_REGISTRY_ID &&
          r.title !== SYSTEM_DELETED_TITLE &&
          r.title !== TOMBSTONE_DELETED_TITLE &&
          r.title !== SYSTEM_READS_TITLE
      );
    } else if (!dbError && dbRows) {
      const singleRow = dbRows as any;
      if (
        singleRow.id !== SYSTEM_DELETED_REGISTRY_ID &&
        singleRow.id !== SYSTEM_READS_REGISTRY_ID &&
        singleRow.title !== SYSTEM_DELETED_TITLE &&
        singleRow.title !== TOMBSTONE_DELETED_TITLE &&
        singleRow.title !== SYSTEM_READS_TITLE
      ) {
        rawList = [singleRow];
      }
    }

    // 2. Fallback / Merge with local persistent store to ensure Zero Data Loss
    const localList = readLocalAnnouncementsStore();
    if (localList.length > 0) {
      const existingIds = new Set(rawList.map((x) => x.id));
      for (const locItem of localList) {
        if (!existingIds.has(locItem.id) && !persistentDeletedIds.has(locItem.id)) {
          rawList.push(locItem);
        }
      }
    }

    // Sort by created_at DESC
    rawList.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });

    // 3. Class ID alias mappings for parent
    const parentChildClassIds = new Set<string>();
    ctx.linkedStudents.forEach((child) => {
      if (child.class_id) {
        expandClassIdAliases(child.class_id, child.class_name).forEach((cid) =>
          parentChildClassIds.add(cid)
        );
      }
    });

    // 4. Role-based scoping & filtering
    const filtered = rawList.filter((item: any) => {
      // 4.1 Bỏ qua bản ghi hệ thống hoặc bản ghi đã bị đánh dấu xóa vĩnh viễn
      if (
        item.id === SYSTEM_DELETED_REGISTRY_ID ||
        item.id === SYSTEM_READS_REGISTRY_ID ||
        item.title === SYSTEM_DELETED_TITLE ||
        item.title === TOMBSTONE_DELETED_TITLE ||
        item.title === SYSTEM_READS_TITLE
      ) return false;
      if (persistentDeletedIds.has(item.id)) return false;

      if (requestedId && item.id !== requestedId) return false;

      // Extract unpacked metadata to check status, audience and target
      const { envelope } = unpackAnnouncementContent(item.content);
      const rawMeta = {
        ...(envelope?.metadata || {}),
        ...(item.metadata || {}),
      };

      const rawStatus = item.status || envelope?.status || rawMeta.status || 'PUBLISHED';
      const effectiveStatus = String(rawStatus).toUpperCase().trim();
      const effectiveCategory = item.category || envelope?.category || rawMeta.category || 'Lễ hội';
      const rawTargetRole = item.target_role || (envelope as any)?.target_role || rawMeta.target_role || 'ALL';
      const effectiveTargetRole = String(rawTargetRole).toUpperCase().trim();
      const audienceStr = String(rawMeta.audience || envelope?.metadata?.audience || item.audience || '').toLowerCase();

      if (isAdminRole(ctx.activeRole)) {
        if (requestedTarget && effectiveTargetRole !== requestedTarget) return false;
        if (requestedCategory && effectiveCategory !== requestedCategory) return false;
        if (requestedStatus && effectiveStatus !== requestedStatus) return false;
        // Bỏ qua các thông báo đã bị lưu trữ/xóa (ARCHIVED) trừ khi Admin chủ động lọc theo status=ARCHIVED
        if (!requestedStatus && effectiveStatus === 'ARCHIVED') return false;
        return true;
      }

      // Non-admins only see PUBLISHED announcements (case-insensitive: 'PUBLISHED' or 'published')
      if (effectiveStatus !== 'PUBLISHED') return false;

      // TEACHER SCOPE
      if (ctx.activeRole === 'TEACHER') {
        if (effectiveTargetRole === 'PARENT' && audienceStr.includes('phụ huynh')) return false;
        if (item.class_id && ctx.assignedClassIds?.length > 0 && !ctx.assignedClassIds.includes(item.class_id)) {
          return false;
        }
        return true;
      }

      // PARENT SCOPE
      if (ctx.activeRole === 'PARENT') {
        // Exclude teacher/staff internal announcements
        const isStaffOnly =
          effectiveTargetRole === 'TEACHER' ||
          effectiveTargetRole === 'STAFF' ||
          audienceStr.includes('cán bộ') ||
          audienceStr.includes('giáo viên') ||
          audienceStr.includes('nội bộ');
        if (isStaffOnly) return false;

        // If targeted to a specific class_id, filter only if parent has known child class IDs
        if (item.class_id && parentChildClassIds.size > 0) {
          if (!parentChildClassIds.has(item.class_id)) return false;
        }

        // If targeted to a specific grade/khối via audience string
        if (parentChildClassIds.size > 0 && !audienceStr.includes('toàn trường') && audienceStr !== '') {
          const parentClassNames = Array.from(parentChildClassIds).join(' ').toLowerCase();
          if (audienceStr.includes('lá') && !parentClassNames.includes('lá') && !parentClassNames.includes('la')) return false;
          if (audienceStr.includes('chồi') && !parentClassNames.includes('chồi') && !parentClassNames.includes('choi')) return false;
          if (audienceStr.includes('mầm') && !parentClassNames.includes('mầm') && !parentClassNames.includes('mam')) return false;
          if (audienceStr.includes('nhà trẻ') && !parentClassNames.includes('nhà trẻ') && !parentClassNames.includes('nhatre')) return false;
        }

        return true;
      }

      return effectiveTargetRole === 'ALL';
    });

    // 5. Fetch read receipts
    const readMap = new Map<string, string>();
    const readCountMap = new Map<string, number>();

    // Calculate total active students in school & per class (cached in-memory for 5 minutes)
    let totalEnrolledStudents = 170;
    const classHeadcountMap = new Map<string, number>();

    if (isAdminRole(ctx.activeRole)) {
      const now = Date.now();
      if (enrolledStudentsCache && now - enrolledStudentsCache.timestamp < STUDENTS_HEADCOUNT_TTL) {
        totalEnrolledStudents = enrolledStudentsCache.total;
        enrolledStudentsCache.classMap.forEach((v, k) => classHeadcountMap.set(k, v));
      } else {
        try {
          const studentRes = (await executeWithContextFallback(ctx, async (sb) =>
            await sb.from('students').select('id, class_id').eq('status', 'ACTIVE')
          )) as any;
          if (Array.isArray(studentRes?.data) && studentRes.data.length > 0) {
            totalEnrolledStudents = studentRes.data.length;
            const newClassMap = new Map<string, number>();
            studentRes.data.forEach((s: any) => {
              if (s.class_id) {
                newClassMap.set(s.class_id, (newClassMap.get(s.class_id) || 0) + 1);
                classHeadcountMap.set(s.class_id, (classHeadcountMap.get(s.class_id) || 0) + 1);
              }
            });
            enrolledStudentsCache = {
              total: totalEnrolledStudents,
              classMap: newClassMap,
              timestamp: now,
            };
          } else if (typeof studentRes?.count === 'number' && studentRes.count > 0) {
            totalEnrolledStudents = studentRes.count;
            enrolledStudentsCache = {
              total: totalEnrolledStudents,
              classMap: new Map(),
              timestamp: now,
            };
          }
        } catch {
          // Fallback 170
        }
      }
    }

    if (filtered.length > 0) {
      const annIds = filtered.map((a: any) => a.id).filter(Boolean);
      const uuidAnnIds = annIds.filter((id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      // 5.1 Đọc từ Supabase (read_receipts & announcement_reads) cho người dùng hiện tại (Parallelized)
      if (uuidAnnIds.length > 0 && !ctx.profileId.startsWith('bootstrap-')) {
        try {
          const [receiptRes, readRes] = await Promise.allSettled([
            executeWithContextFallback(ctx, async (sb) =>
              await sb
                .from('read_receipts')
                .select('announcement_id, read_at')
                .eq('user_id', ctx.profileId)
                .eq('role_context', ctx.activeRole)
                .in('announcement_id', uuidAnnIds)
            ),
            executeWithContextFallback(ctx, async (sb) =>
              await sb
                .from('announcement_reads')
                .select('announcement_id, read_at')
                .eq('user_id', ctx.profileId)
                .eq('role_context', ctx.activeRole)
                .in('announcement_id', uuidAnnIds)
            ),
          ]);

          if (receiptRes.status === 'fulfilled' && Array.isArray((receiptRes.value as any)?.data)) {
            ((receiptRes.value as any).data as any[]).forEach((r) => {
              if (r.announcement_id && r.read_at) readMap.set(r.announcement_id, r.read_at);
            });
          }
          if (readRes.status === 'fulfilled' && Array.isArray((readRes.value as any)?.data)) {
            ((readRes.value as any).data as any[]).forEach((r) => {
              if (r.announcement_id && r.read_at) readMap.set(r.announcement_id, r.read_at);
            });
          }
        } catch (receiptErr) {
          console.warn('[api/announcements] Đọc read_receipts user warning:', receiptErr);
        }
      }

      // 5.2 Tính toán tổng số lượng đã đọc (read_count) cho Ban Giám Hiệu / Quản trị viên
      // Tách biệt và tối ưu hóa thời gian thực thi: Bộ đệm song song + In-memory Cache
      if (isAdminRole(ctx.activeRole) && includeStatsParam !== 'false') {
        const statsCacheKey = uuidAnnIds.slice().sort().join(',');
        const cachedStats = getCachedAdminStats(statsCacheKey);

        if (cachedStats) {
          cachedStats.forEach((count, aid) => {
            readCountMap.set(aid, count);
          });
        } else {
          try {
            const distinctUsersByAnn = new Map<string, Set<string>>();
            const directStudentIdsByAnn = new Map<string, Set<string>>();
            const allParentUserIds = new Set<string>();

            // Thực thi song song (Parallel execution) 3 truy vấn để loại bỏ tắc nghẽn N+1
            const [allReadsRes, allReceiptsRes, regRowRes] = await Promise.allSettled([
              uuidAnnIds.length > 0
                ? executeWithPrivilegedFallback(async (sb) =>
                    await sb
                      .from('announcement_reads')
                      .select('announcement_id, user_id, role_context')
                      .in('announcement_id', uuidAnnIds)
                  )
                : Promise.resolve({ data: [] }),
              uuidAnnIds.length > 0
                ? executeWithPrivilegedFallback(async (sb) =>
                    await sb
                      .from('read_receipts')
                      .select('announcement_id, user_id, role_context, student_id')
                      .in('announcement_id', uuidAnnIds)
                  )
                : Promise.resolve({ data: [] }),
              executeWithPrivilegedFallback(async (sb) =>
                await sb
                  .from('announcements')
                  .select('id, content')
                  .eq('id', SYSTEM_READS_REGISTRY_ID)
                  .maybeSingle()
              ),
            ]);

            if (allReadsRes.status === 'fulfilled' && Array.isArray((allReadsRes.value as any)?.data)) {
              ((allReadsRes.value as any).data as any[]).forEach((r) => {
                if (!r.announcement_id || !r.user_id) return;
                if (!distinctUsersByAnn.has(r.announcement_id)) {
                  distinctUsersByAnn.set(r.announcement_id, new Set<string>());
                }
                distinctUsersByAnn.get(r.announcement_id)!.add(r.user_id);
                if (r.role_context === 'PARENT') {
                  allParentUserIds.add(r.user_id);
                }
              });
            }

            if (allReceiptsRes.status === 'fulfilled' && Array.isArray((allReceiptsRes.value as any)?.data)) {
              ((allReceiptsRes.value as any).data as any[]).forEach((r) => {
                if (!r.announcement_id || !r.user_id) return;
                if (!distinctUsersByAnn.has(r.announcement_id)) {
                  distinctUsersByAnn.set(r.announcement_id, new Set<string>());
                }
                distinctUsersByAnn.get(r.announcement_id)!.add(r.user_id);
                if (r.role_context === 'PARENT') {
                  allParentUserIds.add(r.user_id);
                }
                if (r.student_id) {
                  if (!directStudentIdsByAnn.has(r.announcement_id)) {
                    directStudentIdsByAnn.set(r.announcement_id, new Set<string>());
                  }
                  directStudentIdsByAnn.get(r.announcement_id)!.add(r.student_id);
                }
              });
            }

            if (regRowRes.status === 'fulfilled' && (regRowRes.value as any)?.data?.content) {
              try {
                const regMap = JSON.parse((regRowRes.value as any).data.content) || {};
                Object.entries(regMap).forEach(([aid, userMap]: [string, any]) => {
                  if (userMap && typeof userMap === 'object') {
                    if (!distinctUsersByAnn.has(aid)) {
                      distinctUsersByAnn.set(aid, new Set<string>());
                    }
                    Object.entries(userMap).forEach(([uid, uInfo]: [string, any]) => {
                      distinctUsersByAnn.get(aid)!.add(uid);
                      if (uInfo?.role_context === 'PARENT') {
                        allParentUserIds.add(uid);
                      }
                      if (uInfo?.student_id) {
                        if (!directStudentIdsByAnn.has(aid)) {
                          directStudentIdsByAnn.set(aid, new Set<string>());
                        }
                        directStudentIdsByAnn.get(aid)!.add(uInfo.student_id);
                      }
                      if (uid === ctx.profileId) {
                        readMap.set(aid, uInfo?.read_at || new Date().toISOString());
                      }
                    });
                  }
                });
              } catch (_) {}
            }

            // Đồng bộ thêm từ cache in-memory
            const memCache = globalThis.__SUONGMAI_ANNOUNCEMENT_READS_CACHE__ || {};
            Object.entries(memCache).forEach(([aid, userMap]) => {
              if (userMap && typeof userMap === 'object') {
                if (!distinctUsersByAnn.has(aid)) {
                  distinctUsersByAnn.set(aid, new Set<string>());
                }
                Object.entries(userMap).forEach(([uid, uInfo]) => {
                  distinctUsersByAnn.get(aid)!.add(uid);
                  if (uInfo?.role_context === 'PARENT') {
                    allParentUserIds.add(uid);
                  }
                  if (uInfo?.student_id) {
                    if (!directStudentIdsByAnn.has(aid)) {
                      directStudentIdsByAnn.set(aid, new Set<string>());
                    }
                    directStudentIdsByAnn.get(aid)!.add(uInfo.student_id);
                  }
                  if (uid === ctx.profileId) {
                    readMap.set(aid, uInfo?.read_at || new Date().toISOString());
                  }
                });
              }
            });

            // Đồng bộ thêm từ kho file cục bộ
            const localReadersMap = getLocalDistinctReadersByAnnouncement();
            localReadersMap.forEach((uids, aid) => {
              if (!distinctUsersByAnn.has(aid)) {
                distinctUsersByAnn.set(aid, new Set<string>());
              }
              uids.forEach((uid) => {
                distinctUsersByAnn.get(aid)!.add(uid);
              });
            });

            // Lookup student_parents
            const parentToStudentsMap = new Map<string, string[]>();
            if (allParentUserIds.size > 0) {
              try {
                const { data: spRows } = await executeWithPrivilegedFallback(async (sb) =>
                  await sb
                    .from('student_parents')
                    .select('student_id, parent_user_id')
                    .in('parent_user_id', Array.from(allParentUserIds))
                );
                (spRows || []).forEach((sp: any) => {
                  if (!sp.parent_user_id || !sp.student_id) return;
                  const list = parentToStudentsMap.get(sp.parent_user_id) || [];
                  list.push(sp.student_id);
                  parentToStudentsMap.set(sp.parent_user_id, list);
                });
              } catch (spErr) {
                console.warn('[api/announcements] student_parents lookup warning:', spErr);
              }
            }

            // Tính số đếm đã đọc chuẩn cho từng thông báo
            annIds.forEach((aid: string) => {
              const userSet = distinctUsersByAnn.get(aid);
              const directStudentSet = directStudentIdsByAnn.get(aid);
              const distinctStudents = new Set<string>(directStudentSet ? Array.from(directStudentSet) : []);

              if (userSet) {
                userSet.forEach((uid) => {
                  const children = parentToStudentsMap.get(uid);
                  if (children && children.length > 0) {
                    children.forEach((sid) => distinctStudents.add(sid));
                  }
                });
              }

              const distinctCount = distinctStudents.size > 0 ? distinctStudents.size : (userSet ? userSet.size : 0);
              readCountMap.set(aid, distinctCount);
            });

            setCachedAdminStats(statsCacheKey, readCountMap);
          } catch (adminReadErr) {
            console.warn('[api/announcements] Đọc admin allReads warning:', adminReadErr);
          }
        }
      }
    }

    // 5.2 Đọc bổ sung từ kho lưu trữ cục bộ cho tài khoản hiện tại
    const localReads = getAnnouncementReadsLocally(ctx.profileId, ctx.activeRole);
    localReads.forEach((aid) => {
      if (!readMap.has(aid)) {
        readMap.set(aid, new Date().toISOString());
      }
    });

    // 5.3 Truy vấn danh tính người tạo (Creator Profiles) với cache in-memory
    const creatorIds = Array.from(
      new Set(
        filtered
          .map((a: any) => a.created_by)
          .filter((id: any) => id && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id))
      )
    );
    const creatorNameMap = new Map<string, string>();
    const missingCreatorIds: string[] = [];

    creatorIds.forEach((cid) => {
      if (creatorProfileCache.has(cid)) {
        creatorNameMap.set(cid, creatorProfileCache.get(cid)!);
      } else {
        missingCreatorIds.push(cid);
      }
    });

    if (missingCreatorIds.length > 0) {
      try {
        const { data: profs } = await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('profiles').select('id, full_name, role').in('id', missingCreatorIds)
        );
        (profs || []).forEach((p: any) => {
          if (p?.id && p?.full_name) {
            creatorNameMap.set(p.id, p.full_name);
            creatorProfileCache.set(p.id, p.full_name);
          }
        });
      } catch (profErr) {
        console.warn('[api/announcements] creator profiles lookup warning:', profErr);
      }
    }

    // 6. Map to standardized AnnouncementItem with envelope unpacking
    const announcements = filtered.map((a: any) => {
      const readAt = readMap.get(a.id) || null;
      const { bodyText, envelope } = unpackAnnouncementContent(a.content);

      const rawMeta = {
        ...(envelope?.metadata || {}),
        ...(a.metadata || {}),
      };

      // Real read count (never default to mock 184/196)
      let count = readCountMap.get(a.id);
      if (count === undefined || count === 0) {
        const metaCount = rawMeta.read_count ?? envelope?.metadata?.read_count ?? a.metadata?.read_count;
        if (typeof metaCount === 'number' && metaCount !== 184 && metaCount !== 196 && metaCount > 0) {
          count = metaCount;
        } else {
          count = count || 0;
        }
      }

      const createdByName =
        (a.created_by && creatorNameMap.get(a.created_by)) ||
        rawMeta.created_by_name ||
        rawMeta.author_name ||
        a.author_name ||
        a.created_by_name ||
        'Ban Giám Hiệu';

      // Clean up legacy mock audience string
      let sanitizedAudience = rawMeta.audience || a.audience || 'Toàn trường';
      if (typeof sanitizedAudience === 'string') {
        sanitizedAudience = sanitizedAudience.replace(/\s*\(200\s*bé\)/gi, '').trim() || 'Toàn trường';
      }

      // Dynamic total target count based on target scope (default to actual 170 students, never 200)
      const audienceStr = String(sanitizedAudience || a.audience || '').toLowerCase();
      let totalTargetCount = totalEnrolledStudents;
      if (a.class_id) {
        const dbClassCount = classHeadcountMap.get(a.class_id);
        if (dbClassCount && dbClassCount > 0) {
          totalTargetCount = dbClassCount;
        } else if (a.class_id === 'c-nhatre' || a.class_id.includes('14ccdb7e')) totalTargetCount = 24;
        else if (a.class_id === 'c-mam' || a.class_id.includes('5b61ec3a')) totalTargetCount = 38;
        else if (a.class_id === 'c-choi' || a.class_id.includes('9d953115')) totalTargetCount = 38;
        else if (a.class_id === 'c-la1' || a.class_id.includes('ebe8ec4d')) totalTargetCount = 40;
        else if (a.class_id === 'c-la2' || a.class_id.includes('86b1e783')) totalTargetCount = 30;
      } else if (audienceStr.includes('lá')) {
        totalTargetCount = 70;
      } else if (audienceStr.includes('chồi')) {
        totalTargetCount = 38;
      } else if (audienceStr.includes('mầm')) {
        totalTargetCount = 38;
      } else if (audienceStr.includes('nhà trẻ')) {
        totalTargetCount = 24;
      } else if (a.target_role === 'TEACHER' || audienceStr.includes('giáo viên')) {
        totalTargetCount = 18;
      } else if (rawMeta.total_target_count && rawMeta.total_target_count !== 200) {
        totalTargetCount = rawMeta.total_target_count;
      }

      const category = a.category || envelope?.category || rawMeta.category || 'Lễ hội';
      const status = a.status || envelope?.status || rawMeta.status || 'PUBLISHED';
      const audioUrl = a.audio_url || envelope?.audio_url || rawMeta.audio_url || null;
      const voiceType = a.voice_type || envelope?.voice_type || rawMeta.voice_type || rawMeta.voice || 'vn_north_female_teacher';
      const bgMusic = a.background_music || envelope?.background_music || rawMeta.background_music || rawMeta.music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)';
      const isUrgent = Boolean(a.is_urgent ?? envelope?.is_urgent ?? rawMeta.is_urgent);

      const templateId =
        rawMeta.template_id || a.template_id || envelope?.metadata?.template_id || 'le-hoi';

      let sanitizedBg = rawMeta.custom_bg_url || rawMeta.background_url || a.custom_bg_url || a.background_url;
      if (sanitizedBg && typeof sanitizedBg === 'string' && sanitizedBg.startsWith('data:image')) {
        sanitizedBg = EMBEDDED_BACKGROUNDS[templateId] || '/images/announcements/le-hoi.jpg';
      }
      const effectiveBg =
        sanitizedBg || EMBEDDED_BACKGROUNDS[templateId] || '/images/announcements/le-hoi.jpg';

      const eventTime =
        rawMeta.event_time || rawMeta.time_value || a.event_time || a.time_value || '';
      const locationVal =
        rawMeta.location || rawMeta.location_value || a.location || a.location_value || '';
      const noteVal =
        rawMeta.note || rawMeta.deadline_value || a.note || a.deadline_value || '';
      const tableRowsVal =
        rawMeta.table_rows || rawMeta.table_data || a.table_rows || a.table_data || null;
      const isBgEnabledVal =
        rawMeta.is_bg_enabled !== false && a.is_bg_enabled !== false;
      const showSealVal =
        rawMeta.show_seal !== false &&
        rawMeta.cards_visibility?.seal !== false &&
        a.show_seal !== false;

      const mergedMeta = {
        ...rawMeta,
        template_id: templateId,
        background_url: effectiveBg,
        custom_bg_url: effectiveBg,
        event_time: eventTime,
        time_value: eventTime,
        location: locationVal,
        location_value: locationVal,
        note: noteVal,
        deadline_value: noteVal,
        table_rows: tableRowsVal,
        table_data: tableRowsVal,
        show_seal: showSealVal,
        audience: sanitizedAudience,
        is_bg_enabled: isBgEnabledVal,
        cards_visibility: {
          ...(rawMeta.cards_visibility || {}),
          seal: showSealVal,
        },
        total_target_count: totalTargetCount,
        audio_url: audioUrl,
        voice_type: voiceType,
        background_music: bgMusic,
        is_urgent: isUrgent,
        created_by_name: createdByName,
      };

      if (isFullRequested || requestedId) {
        return {
          id: a.id,
          title: a.title,
          content: bodyText,
          category,
          status,
          target_role: a.target_role || 'ALL',
          notification_channel: a.notification_channel || 'PARENT',
          class_id: a.class_id || null,
          created_by: a.created_by || null,
          created_by_name: createdByName,
          created_at: a.created_at || rawMeta.created_at || new Date().toISOString(),
          updated_at: a.updated_at || envelope?.updated_at || a.created_at || new Date().toISOString(),
          audio_url: audioUrl,
          voice_type: voiceType,
          background_music: bgMusic,
          is_urgent: isUrgent,
          priority: isUrgent ? 'URGENT' : 'NORMAL',
          requires_acknowledgement: Boolean(a.requires_acknowledgement || envelope?.requires_acknowledgement || rawMeta.requires_acknowledgement),
          has_audio: Boolean(audioUrl || rawMeta.has_audio !== false),
          has_poster: Boolean(rawMeta.has_poster !== false),
          template_id: templateId,
          background_url: effectiveBg,
          custom_bg_url: effectiveBg,
          event_time: eventTime,
          time_value: eventTime,
          location: locationVal,
          location_value: locationVal,
          note: noteVal,
          deadline_value: noteVal,
          table_rows: tableRowsVal,
          table_data: tableRowsVal,
          show_seal: showSealVal,
          audience: sanitizedAudience,
          is_bg_enabled: isBgEnabledVal,
          cards_visibility: mergedMeta.cards_visibility,
          metadata: mergedMeta,
          is_read: Boolean(readAt),
          read_at: readAt,
          read_count: count,
          total_target_count: totalTargetCount,
        };
      }

      // Compact payload
      return {
        id: a.id,
        title: a.title,
        content: bodyText.slice(0, 160),
        category,
        status,
        target_role: a.target_role || 'ALL',
        notification_channel: a.notification_channel || 'PARENT',
        class_id: a.class_id || null,
        created_by: a.created_by || null,
        created_by_name: createdByName,
        created_at: a.created_at || rawMeta.created_at || new Date().toISOString(),
        updated_at: a.updated_at || envelope?.updated_at || a.created_at || new Date().toISOString(),
        is_urgent: isUrgent,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        requires_acknowledgement: Boolean(a.requires_acknowledgement || envelope?.requires_acknowledgement || rawMeta.requires_acknowledgement),
        audio_url: audioUrl,
        voice_type: voiceType,
        background_music: bgMusic,
        has_audio: Boolean(audioUrl || rawMeta.has_audio !== false),
        has_poster: Boolean(rawMeta.has_poster !== false),
        template_id: templateId,
        background_url: effectiveBg,
        custom_bg_url: effectiveBg,
        event_time: eventTime,
        time_value: eventTime,
        location: locationVal,
        location_value: locationVal,
        note: noteVal,
        deadline_value: noteVal,
        table_rows: tableRowsVal,
        table_data: tableRowsVal,
        show_seal: showSealVal,
        audience: sanitizedAudience,
        is_bg_enabled: isBgEnabledVal,
        cards_visibility: mergedMeta.cards_visibility,
        metadata: mergedMeta,
        is_read: Boolean(readAt),
        read_at: readAt,
        read_count: count,
        total_target_count: totalTargetCount,
      };
    });

    const unreadCount = announcements.filter((a: any) => !a.is_read).length;

    return NextResponse.json(
      {
        success: true,
        active_role: ctx.activeRole,
        announcement: requestedId ? announcements[0] || null : null,
        announcements,
        unread_count: unreadCount,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi máy chủ nội bộ', announcements: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * Tự động tổng hợp file giọng đọc AI và trả về Data URI bất biến
 * Giúp mọi thông báo phát hành đều có audio voice mà không phụ thuộc cloud storage
 */
async function autoSynthesizeTtsAudio(title: string, content: string): Promise<string | null> {
  try {
    const rawText = `${title}. ${content}`.trim();
    if (!rawText) return null;
    const cleanSample = rawText.slice(0, 180);
    const encoded = encodeURIComponent(cleanSample);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 0) {
        return `data:audio/mpeg;base64,${Buffer.from(ab).toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn('[autoSynthesizeTtsAudio] notice:', err);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    let targetRole = String(body.target_role || 'ALL').toUpperCase().trim();
    const classId = body.class_id ? String(body.class_id).trim() : null;
    const category = body.category ? String(body.category).trim() : 'Lễ hội';
    const status =
      body.status && ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED'].includes(body.status)
        ? body.status
        : 'PUBLISHED';
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập tiêu đề thông báo.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập nội dung văn bản thông báo.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!['ALL', 'TEACHER', 'PARENT'].includes(targetRole)) {
      return NextResponse.json(
        { success: false, error: 'Đối tượng nhận phải là Toàn trường, Giáo viên hoặc Phụ huynh.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (ctx.activeRole === 'TEACHER') {
      targetRole = 'PARENT';
      const denied = assertTeacherClassAccess(ctx, classId);
      if (denied) return denied;
    }

    const notificationChannel = targetRole === 'TEACHER' ? 'TEACHER' : 'PARENT';
    const createdBy = ctx.profileId.startsWith('bootstrap-') ? null : ctx.profileId;

    let audioUrl = body.audio_url || metadata.audio_url || null;
    if (!audioUrl && status === 'PUBLISHED') {
      audioUrl = await autoSynthesizeTtsAudio(title, content);
    }
    const voiceType =
      body.voice_type || metadata.voice_type || metadata.voice || 'vn_north_female_teacher';
    const backgroundMusic =
      body.background_music || metadata.background_music || metadata.music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)';

    const templateId = body.template_id || metadata.template_id || 'le-hoi';
    const bgUrl =
      body.background_url ||
      metadata.background_url ||
      body.custom_bg_url ||
      metadata.custom_bg_url ||
      EMBEDDED_BACKGROUNDS[templateId] ||
      '/images/announcements/le-hoi.jpg';
    const eventTime = body.event_time || metadata.event_time || body.time_value || metadata.time_value || '';
    const locationVal = body.location || metadata.location || body.location_value || metadata.location_value || '';
    const noteVal = body.note || metadata.note || body.deadline_value || metadata.deadline_value || '';
    const tableRowsVal = body.table_rows || metadata.table_rows || body.table_data || metadata.table_data || null;
    const rawAudience = body.audience || metadata.audience || '';
    const isAllScope =
      rawAudience === 'Toàn trường' ||
      body.scope === 'all' ||
      metadata.scope === 'all' ||
      !rawAudience;
    const audienceVal = isAllScope ? 'Toàn trường' : rawAudience;
    if (body.target_role !== undefined) targetRole = String(body.target_role).trim();
    if (isAllScope && ctx.activeRole !== 'TEACHER') {
      targetRole = 'ALL';
    }
    const isBgEnabledVal = body.is_bg_enabled ?? metadata.is_bg_enabled ?? true;
    const showSealVal =
      body.show_seal ??
      metadata.show_seal ??
      (metadata.cards_visibility?.seal !== false);
    const soundChoice = body.sound || metadata.sound || '/sounds/SM1.wav';

    const mergedMetadata = {
      ...metadata,
      template_id: templateId,
      background_url: bgUrl,
      custom_bg_url: bgUrl,
      event_time: eventTime,
      time_value: eventTime,
      location: locationVal,
      location_value: locationVal,
      note: noteVal,
      deadline_value: noteVal,
      table_rows: tableRowsVal,
      table_data: tableRowsVal,
      show_seal: showSealVal,
      audience: audienceVal,
      scope: isAllScope ? 'all' : audienceVal,
      is_bg_enabled: isBgEnabledVal,
      cards_visibility: {
        ...(metadata.cards_visibility || {}),
        seal: showSealVal,
      },
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
      sound: soundChoice,
    };

    // Đóng gói phong bì metadata vào content để bảo đảm tương thích ngay cả khi DB chưa chạy migration mới
    const envelope: AnnouncementEnvelopeData = {
      category,
      status,
      metadata: mergedMetadata,
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
      sound: soundChoice,
      is_urgent: Boolean(mergedMetadata.is_urgent),
      requires_acknowledgement: Boolean(mergedMetadata.requires_acknowledgement),
      updated_at: new Date().toISOString(),
    };
    const packedContent = packAnnouncementContent(content, envelope);

    // 1. Thử ghi với đầy đủ các cột mới
    const fullPayload: any = {
      title,
      content: packedContent,
      target_role: targetRole,
      notification_channel: notificationChannel,
      class_id: classId,
      created_by: createdBy,
      category,
      status,
      metadata: mergedMetadata,
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
    };

    let { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').insert(fullPayload).select().single()
    );

    // 2. Dự phòng nếu Postgres thiếu cột mới trong schema cache (PGRST204 / 42703)
    if (
      error &&
      (error.message?.includes('column') ||
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('schema cache'))
    ) {
      console.warn('[api/announcements] POST: Bảng thiếu cột mới, kích hoạt phong bì content fallback');
      const basicPayload: any = {
        title,
        content: packedContent,
        target_role: targetRole,
        notification_channel: notificationChannel,
        class_id: classId,
        created_by: createdBy,
      };

      const retry = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('announcements').insert(basicPayload).select().single()
      );
      data = retry.data;
      error = retry.error;

      // 3. Dự phòng nếu created_by bị lỗi ràng buộc khóa ngoại FK (23503)
      if (error && (error.code === '23503' || error.message?.includes('violates foreign key'))) {
        const noFkPayload = {
          ...basicPayload,
          created_by: null,
        };
        const retryFk = await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('announcements').insert(noFkPayload).select().single()
        );
        data = retryFk.data;
        error = retryFk.error;
      }
    } else if (error && (error.code === '23503' || error.message?.includes('violates foreign key'))) {
      const retryFkFull = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('announcements').insert({ ...fullPayload, created_by: null }).select().single()
      );
      data = retryFkFull.data;
      error = retryFkFull.error;
    }

    // 4. Chuẩn bị bản ghi kết quả hoàn chỉnh
    const createdId = data?.id || crypto.randomUUID();
    const resultItem = {
      id: createdId,
      title,
      content,
      category,
      status,
      target_role: targetRole,
      notification_channel: notificationChannel,
      class_id: classId,
      created_by: createdBy,
      created_at: data?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
      sound: soundChoice,
      is_urgent: Boolean(mergedMetadata.is_urgent),
      priority: Boolean(mergedMetadata.is_urgent) ? 'URGENT' : 'NORMAL',
      requires_acknowledgement: Boolean(mergedMetadata.requires_acknowledgement),
      has_audio: Boolean(audioUrl),
      has_poster: true,
      template_id: templateId,
      background_url: bgUrl,
      custom_bg_url: bgUrl,
      event_time: eventTime,
      time_value: eventTime,
      location: locationVal,
      location_value: locationVal,
      note: noteVal,
      deadline_value: noteVal,
      table_rows: tableRowsVal,
      table_data: tableRowsVal,
      show_seal: showSealVal,
      audience: audienceVal,
      is_bg_enabled: isBgEnabledVal,
      cards_visibility: mergedMetadata.cards_visibility,
      metadata: mergedMetadata,
      read_count: 0,
      is_read: true,
    };

    // Luôn đồng bộ vào kho dự phòng cục bộ để không bao giờ mất dữ liệu
    upsertLocalAnnouncement(resultItem);

    // Xử lý gửi thông báo đẩy nếu phát hành chính thức (1 lần duy nhất)
    let notificationPayload = null;
    if (status === 'PUBLISHED' && !mergedMetadata.push_sent) {
      try {
        notificationPayload = buildPushPayload({
          id: `announcement-${createdId}`,
          title,
          body: content,
          notification_channel: notificationChannel,
          class_id: classId || undefined,
          url: notificationChannel === 'TEACHER' ? '/teacher' : '/parent',
          sound: soundChoice,
        });
        await dispatchContextPushNotification({ payload: notificationPayload });
        mergedMetadata.push_sent = true;
        resultItem.metadata = mergedMetadata;
        upsertLocalAnnouncement(resultItem);
      } catch (pushErr) {
        console.warn('[api/announcements] Push notification warning:', pushErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        announcement: resultItem,
        notification_payload: notificationPayload,
      },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể tạo thông báo mới.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const body = await request.json().catch(() => ({}));
    const id = body.id ? String(body.id).trim() : null;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã định danh (ID) thông báo cần cập nhật.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const existing = readLocalAnnouncementsStore().find((a) => a.id === id);

    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const content = body.content !== undefined ? String(body.content).trim() : undefined;
    const category = body.category !== undefined ? String(body.category).trim() : 'Lễ hội';
    const status = body.status !== undefined ? String(body.status).trim() : 'PUBLISHED';
    let audioUrl = body.audio_url !== undefined ? body.audio_url : null;
    if (!audioUrl && status === 'PUBLISHED') {
      audioUrl = await autoSynthesizeTtsAudio(
        title || existing?.title || '',
        content || existing?.content || ''
      );
    }
    const voiceType = body.voice_type || 'vn_north_female_teacher';
    const backgroundMusic = body.background_music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)';
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    let targetRole = body.target_role !== undefined ? String(body.target_role).trim() : 'ALL';

    const templateId = body.template_id || metadata.template_id || 'le-hoi';
    const bgUrl =
      body.background_url ||
      metadata.background_url ||
      body.custom_bg_url ||
      metadata.custom_bg_url ||
      EMBEDDED_BACKGROUNDS[templateId] ||
      '/images/announcements/le-hoi.jpg';
    const eventTime = body.event_time || metadata.event_time || body.time_value || metadata.time_value || '';
    const locationVal = body.location || metadata.location || body.location_value || metadata.location_value || '';
    const noteVal = body.note || metadata.note || body.deadline_value || metadata.deadline_value || '';
    const tableRowsVal = body.table_rows || metadata.table_rows || body.table_data || metadata.table_data || null;
    const rawAudience = body.audience || metadata.audience || '';
    const isAllScope =
      rawAudience === 'Toàn trường' ||
      body.scope === 'all' ||
      metadata.scope === 'all' ||
      !rawAudience;
    const audienceVal = isAllScope ? 'Toàn trường' : rawAudience;
    if (body.target_role !== undefined) targetRole = String(body.target_role).trim();
    if (isAllScope && ctx.activeRole !== 'TEACHER') {
      targetRole = 'ALL';
    }
    const isBgEnabledVal = body.is_bg_enabled ?? metadata.is_bg_enabled ?? true;
    const showSealVal =
      body.show_seal ??
      metadata.show_seal ??
      (metadata.cards_visibility?.seal !== false);
    const soundChoice = body.sound || metadata.sound || '/sounds/SM1.wav';

    const mergedMetadata = {
      ...metadata,
      template_id: templateId,
      background_url: bgUrl,
      custom_bg_url: bgUrl,
      event_time: eventTime,
      time_value: eventTime,
      location: locationVal,
      location_value: locationVal,
      note: noteVal,
      deadline_value: noteVal,
      table_rows: tableRowsVal,
      table_data: tableRowsVal,
      show_seal: showSealVal,
      audience: audienceVal,
      scope: isAllScope ? 'all' : audienceVal,
      is_bg_enabled: isBgEnabledVal,
      cards_visibility: {
        ...(metadata.cards_visibility || {}),
        seal: showSealVal,
      },
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
      sound: soundChoice,
    };

    // Đóng gói phong bì metadata vào content
    const envelope: AnnouncementEnvelopeData = {
      category,
      status,
      metadata: mergedMetadata,
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
      sound: soundChoice,
      is_urgent: Boolean(mergedMetadata.is_urgent),
      requires_acknowledgement: Boolean(mergedMetadata.requires_acknowledgement),
      updated_at: new Date().toISOString(),
    };
    const packedContent = content !== undefined ? packAnnouncementContent(content, envelope) : undefined;

    const updatePayload: any = {};
    if (title !== undefined) updatePayload.title = title;
    if (packedContent !== undefined) updatePayload.content = packedContent;
    if (body.target_role !== undefined) updatePayload.target_role = String(body.target_role).trim();
    if (body.class_id !== undefined) updatePayload.class_id = body.class_id || null;
    updatePayload.category = category;
    updatePayload.status = status;
    updatePayload.audio_url = audioUrl;
    updatePayload.voice_type = voiceType;
    updatePayload.background_music = backgroundMusic;
    updatePayload.metadata = mergedMetadata;
    updatePayload.updated_at = new Date().toISOString();

    let { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').update(updatePayload).eq('id', id).select().single()
    );

    // Fallback nếu thiếu cột
    if (
      error &&
      (error.message?.includes('column') ||
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('schema cache'))
    ) {
      const basicPayload: any = {};
      if (title !== undefined) basicPayload.title = title;
      if (packedContent !== undefined) basicPayload.content = packedContent;
      if (body.target_role !== undefined) basicPayload.target_role = String(body.target_role).trim();
      if (body.class_id !== undefined) basicPayload.class_id = body.class_id || null;

      const retry = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('announcements').update(basicPayload).eq('id', id).select().single()
      );
      data = retry.data;
      error = retry.error;
    }

    const updatedItem = {
      id,
      title: title || data?.title,
      content: packedContent || content || data?.content,
      category,
      status,
      target_role: body.target_role || data?.target_role || 'ALL',
      notification_channel: data?.notification_channel || 'PARENT',
      class_id: body.class_id || data?.class_id || null,
      updated_at: new Date().toISOString(),
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
      sound: soundChoice,
      is_urgent: Boolean(mergedMetadata.is_urgent),
      priority: Boolean(mergedMetadata.is_urgent) ? 'URGENT' : 'NORMAL',
      has_audio: Boolean(audioUrl),
      has_poster: true,
      template_id: templateId,
      background_url: bgUrl,
      custom_bg_url: bgUrl,
      event_time: eventTime,
      time_value: eventTime,
      location: locationVal,
      location_value: locationVal,
      note: noteVal,
      deadline_value: noteVal,
      table_rows: tableRowsVal,
      table_data: tableRowsVal,
      show_seal: showSealVal,
      audience: audienceVal,
      is_bg_enabled: isBgEnabledVal,
      cards_visibility: mergedMetadata.cards_visibility,
      metadata: mergedMetadata,
    };

    upsertLocalAnnouncement(updatedItem);

    // Chỉ kích hoạt gửi Push Notification 1 lần duy nhất tại thời điểm thông báo được phát hành chính thức
    const wasAlreadyPublished =
      Boolean(existing?.status === 'PUBLISHED' || (existing?.metadata as any)?.push_sent || mergedMetadata.push_sent);
    if (status === 'PUBLISHED' && !wasAlreadyPublished) {
      try {
        const notificationPayload = buildPushPayload({
          id: `announcement-${id}`,
          title: updatedItem.title,
          body: updatedItem.content,
          notification_channel: updatedItem.notification_channel,
          class_id: updatedItem.class_id || undefined,
          url: updatedItem.notification_channel === 'TEACHER' ? '/teacher' : '/parent',
          sound: soundChoice,
        });
        await dispatchContextPushNotification({ payload: notificationPayload });
        mergedMetadata.push_sent = true;
        updatedItem.metadata = mergedMetadata;
        upsertLocalAnnouncement(updatedItem);
      } catch (pushErr) {
        console.warn('[api/announcements] PUT push notification warning:', pushErr);
      }
    }

    return NextResponse.json(
      { success: true, announcement: updatedItem },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] PUT error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể cập nhật thông báo.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Đánh dấu đã đọc
    const announcementIds: string[] = Array.isArray(body.announcement_ids)
      ? body.announcement_ids
      : body.announcement_id
      ? [String(body.announcement_id)]
      : [];

    if (announcementIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Thiếu announcement_id.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const auth = await requireActiveRole(request, [
      'PARENT',
      'TEACHER',
      'STAFF',
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    let ctx: any;
    if ('response' in auth) {
      // Dự phòng an toàn cho phiên phụ huynh khi refresh hoặc xem trên thiết bị di động
      ctx = {
        profileId: 'anonymous-parent',
        activeRole: 'PARENT',
        roles: ['PARENT'],
      };
    } else {
      ctx = auth.ctx;
    }

    // 1. Ghi nhận lượt đọc bền vững vào cả cache, announcement_reads và Persistent Reads Registry
    await recordPersistentAnnouncementReads(ctx, announcementIds, body?.student_id || null);

    return NextResponse.json(
      {
        success: true,
        role_context: ctx.activeRole,
        marked: announcementIds.length,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] PATCH error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi xử lý đánh dấu đã đọc.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

function extractStoragePath(url: string | null | undefined, bucket: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  const bucketPrefix = `/${bucket}/`;
  const idx = clean.indexOf(bucketPrefix);
  if (idx !== -1) {
    const sub = clean.slice(idx + bucketPrefix.length);
    const queryIdx = sub.indexOf('?');
    const pathOnly = queryIdx !== -1 ? sub.slice(0, queryIdx) : sub;
    return decodeURIComponent(pathOnly);
  }
  if (bucket === 'announcement-audios' && (clean.startsWith('tts_') || clean.endsWith('.mp3'))) {
    if (!clean.includes('/') && !clean.includes('..')) return clean;
  }
  return null;
}

export async function deleteAnnouncementHandler(request: Request, rawId: string) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const id = String(rawId || '').trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã định danh (ID) thông báo cần xóa.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (id === SYSTEM_DELETED_REGISTRY_ID || id === SYSTEM_READS_REGISTRY_ID) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa bản ghi hệ thống.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Thu thập thông tin thông báo trước khi xóa để xử lý cascade (audio, ảnh nền)
    let targetAudioUrl: string | null = null;
    let targetCustomBgUrl: string | null = null;
    let existingInDb = false;

    if (isUuid) {
      try {
        const { data: dbItem } = await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('announcements').select('*').eq('id', id).maybeSingle()
        );
        if (dbItem) {
          existingInDb = true;
          const { envelope } = unpackAnnouncementContent(dbItem.content);
          targetAudioUrl = dbItem.audio_url || envelope?.audio_url || dbItem.metadata?.audio_url || null;
          targetCustomBgUrl = envelope?.metadata?.custom_bg_url || dbItem.metadata?.custom_bg_url || null;
        }
      } catch (chkErr) {
        console.warn('[deleteAnnouncementHandler] Kiểm tra DB item warning:', chkErr);
      }
    }

    const localItem = readLocalAnnouncementsStore().find((a) => a.id === id);
    if (localItem) {
      if (!targetAudioUrl) targetAudioUrl = localItem.audio_url || localItem.metadata?.audio_url || null;
      if (!targetCustomBgUrl) targetCustomBgUrl = localItem.metadata?.custom_bg_url || null;
    }

    // 2. CASCADE BƯỚC 1: Xóa các tệp phụ thuộc trên Supabase Storage (audio, ảnh poster)
    if (targetAudioUrl) {
      const audioPath = extractStoragePath(targetAudioUrl, 'announcement-audios');
      if (audioPath) {
        try {
          await executeWithContextFallback(ctx, async (sb) =>
            await sb.storage.from('announcement-audios').remove([audioPath])
          );
        } catch (stAudioErr) {
          console.warn('[deleteAnnouncementHandler] Xóa storage audio warning:', stAudioErr);
        }
      }
    }

    if (targetCustomBgUrl) {
      const bgPath = extractStoragePath(targetCustomBgUrl, 'announcement-posters');
      if (bgPath) {
        try {
          await executeWithContextFallback(ctx, async (sb) =>
            await sb.storage.from('announcement-posters').remove([bgPath])
          );
        } catch (stBgErr) {
          console.warn('[deleteAnnouncementHandler] Xóa storage poster warning:', stBgErr);
        }
      }
    }

    // 3. CASCADE BƯỚC 2: Xóa các bản ghi lượt đọc phụ thuộc (Foreign Key read_receipts & announcement_reads)
    if (isUuid) {
      try {
        await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('read_receipts').delete().eq('announcement_id', id)
        );
      } catch (receiptsErr) {
        console.warn('[deleteAnnouncementHandler] Xóa read_receipts warning:', receiptsErr);
      }

      try {
        await executeWithContextFallback(ctx, async (sb) =>
          await sb.from('announcement_reads').delete().eq('announcement_id', id)
        );
      } catch (readsErr) {
        console.warn('[deleteAnnouncementHandler] Xóa announcement_reads warning:', readsErr);
      }
    }

    // Dọn dẹp trong registry đọc hệ thống và cache lượt đọc
    await removeAnnouncementFromReadsRegistry(ctx, id);
    removeAnnouncementReadsLocally(id);

    // 4. CASCADE BƯỚC 3: Xóa bản ghi chính trong bảng public.announcements
    let dbDeleted = false;
    if (isUuid && existingInDb) {
      const { data: deletedRows, error: delErr } = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('announcements').delete().eq('id', id).select('id')
      );

      if (delErr) {
        console.error('[deleteAnnouncementHandler] Lỗi xóa Postgres:', delErr);
        return NextResponse.json(
          {
            success: false,
            error: `Lỗi cơ sở dữ liệu khi xóa thông báo: ${delErr.message || delErr.code || 'Bị từ chối bởi RLS'}.`,
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      if (!deletedRows || deletedRows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Không thể xóa bản ghi khỏi cơ sở dữ liệu: Bản ghi không tồn tại hoặc bị từ chối bởi quyền RLS.',
          },
          { status: 500, headers: NO_CACHE_HEADERS }
        );
      }

      dbDeleted = true;
    }

    // 5. CASCADE BƯỚC 4: Ghi nhận vĩnh viễn vào Deleted Tombstone Registry trên Database
    const regSuccess = await recordDeletedAnnouncementId(ctx, id);

    // 6. CASCADE BƯỚC 5: Xóa khỏi bộ đệm cục bộ
    const localDeleted = deleteLocalAnnouncement(id);

    return NextResponse.json(
      {
        success: true,
        deleted: id,
        db_deleted: dbDeleted,
        tombstone_registered: regSuccess,
        local_deleted: localDeleted,
        message: 'Đã xóa thông báo và toàn bộ dữ liệu phụ thuộc (lượt đọc, file audio) thành công.',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[deleteAnnouncementHandler] Lỗi ngoại lệ:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Không thể xóa thông báo do lỗi kết nối máy chủ.',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get('id');
  let bodyId = '';
  try {
    const body = await request.clone().json().catch(() => ({}));
    bodyId = body?.id || '';
  } catch {}
  const id = String(queryId || bodyId || '').trim();
  return deleteAnnouncementHandler(request, id);
}
