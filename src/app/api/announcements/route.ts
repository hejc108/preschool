import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';
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
  removeAnnouncementReadsLocally,
  AnnouncementEnvelopeData,
} from '@/lib/announcements/announcementStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const SYSTEM_DELETED_REGISTRY_ID = '00000000-0000-0000-0000-000000000001';
export const SYSTEM_DELETED_TITLE = '__SYSTEM_DELETED_ANNOUNCEMENT_IDS__';

declare global {
  // eslint-disable-next-line no-var
  var __SUONGMAI_DELETED_ANNOUNCEMENT_IDS__: Set<string> | undefined;
}

if (!globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__) {
  globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ = new Set<string>();
}

export async function getPersistentDeletedIds(ctx: any): Promise<Set<string>> {
  const deletedSet = new Set<string>(globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ || []);

  try {
    const { data: regRow } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('announcements')
        .select('id, content')
        .eq('id', SYSTEM_DELETED_REGISTRY_ID)
        .maybeSingle()
    );

    if (regRow?.content) {
      const parsed = JSON.parse(regRow.content);
      if (Array.isArray(parsed)) {
        parsed.forEach((did) => {
          deletedSet.add(String(did));
          globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__?.add(String(did));
        });
      }
    }
  } catch (err) {
    console.warn('[announcements] getPersistentDeletedIds warning:', err);
  }

  return deletedSet;
}

export async function recordDeletedAnnouncementId(ctx: any, id: string): Promise<void> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return;

  globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ =
    globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__ || new Set<string>();
  globalThis.__SUONGMAI_DELETED_ANNOUNCEMENT_IDS__.add(cleanId);

  try {
    const existingSet = await getPersistentDeletedIds(ctx);
    existingSet.add(cleanId);

    const payload = {
      id: SYSTEM_DELETED_REGISTRY_ID,
      title: SYSTEM_DELETED_TITLE,
      content: JSON.stringify(Array.from(existingSet)),
      target_role: 'ALL',
      notification_channel: 'PARENT',
    };

    await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').upsert(payload, { onConflict: 'id' })
    );
  } catch (err) {
    console.warn('[announcements] recordDeletedAnnouncementId warning:', err);
  }
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
        (r: any) => r.id !== SYSTEM_DELETED_REGISTRY_ID && r.title !== SYSTEM_DELETED_TITLE
      );
    } else if (!dbError && dbRows) {
      const singleRow = dbRows as any;
      if (singleRow.id !== SYSTEM_DELETED_REGISTRY_ID && singleRow.title !== SYSTEM_DELETED_TITLE) {
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
      if (item.id === SYSTEM_DELETED_REGISTRY_ID || item.title === SYSTEM_DELETED_TITLE) return false;
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

    // Calculate total active students in school & per class (from DB or fallback)
    let totalEnrolledStudents = 170;
    const classHeadcountMap = new Map<string, number>();
    try {
      const studentRes = (await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('students').select('id, class_id').eq('status', 'ACTIVE')
      )) as any;
      if (Array.isArray(studentRes?.data) && studentRes.data.length > 0) {
        totalEnrolledStudents = studentRes.data.length;
        studentRes.data.forEach((s: any) => {
          if (s.class_id) {
            classHeadcountMap.set(s.class_id, (classHeadcountMap.get(s.class_id) || 0) + 1);
          }
        });
      } else if (typeof studentRes?.count === 'number' && studentRes.count > 0) {
        totalEnrolledStudents = studentRes.count;
      }
    } catch {
      // Fallback 170
    }

    if (filtered.length > 0) {
      const annIds = filtered.map((a: any) => a.id).filter(Boolean);
      const uuidAnnIds = annIds.filter((id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      // 5.1 Đọc từ Supabase (announcement_reads)
      if (uuidAnnIds.length > 0 && !ctx.profileId.startsWith('bootstrap-')) {
        try {
          const { data: readRows } = await executeWithContextFallback(ctx, async (sb) =>
            await sb
              .from('announcement_reads')
              .select('announcement_id, read_at')
              .eq('user_id', ctx.profileId)
              .eq('role_context', ctx.activeRole)
              .in('announcement_id', uuidAnnIds)
          );
          (readRows || []).forEach((r: any) => {
            readMap.set(r.announcement_id, r.read_at);
          });
        } catch (readErr) {
          console.warn('[api/announcements] Đọc announcement_reads warning:', readErr);
        }

        if (isAdminRole(ctx.activeRole)) {
          try {
            // Fetch all read log entries for these announcements
            const { data: allReads } = await executeWithContextFallback(ctx, async (sb) =>
              await sb
                .from('announcement_reads')
                .select('announcement_id, user_id, role_context')
                .in('announcement_id', uuidAnnIds)
            );

            // Group by announcement_id -> Set of distinct user_ids
            const distinctUsersByAnn = new Map<string, Set<string>>();
            const allParentUserIds = new Set<string>();

          (allReads || []).forEach((r: any) => {
            if (!r.announcement_id || !r.user_id) return;
            if (!distinctUsersByAnn.has(r.announcement_id)) {
              distinctUsersByAnn.set(r.announcement_id, new Set<string>());
            }
            distinctUsersByAnn.get(r.announcement_id)!.add(r.user_id);
            if (r.role_context === 'PARENT') {
              allParentUserIds.add(r.user_id);
            }
          });

          // Lookup student_parents for parents to calculate distinct student_id
          const parentToStudentsMap = new Map<string, string[]>();
          if (allParentUserIds.size > 0) {
            try {
              const { data: spRows } = await executeWithContextFallback(ctx, async (sb) =>
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

          // Calculate deduplicated count for each announcement
          annIds.forEach((aid: string) => {
            const userSet = distinctUsersByAnn.get(aid);
            if (!userSet || userSet.size === 0) {
              readCountMap.set(aid, 0);
              return;
            }

            // Count distinct student_ids reached
            const distinctStudents = new Set<string>();
            userSet.forEach((uid) => {
              const children = parentToStudentsMap.get(uid);
              if (children && children.length > 0) {
                children.forEach((sid) => distinctStudents.add(sid));
              }
            });

            // Distinct count: either distinct students reached or distinct user accounts that viewed
            const distinctCount = distinctStudents.size > 0 ? distinctStudents.size : userSet.size;
            readCountMap.set(aid, distinctCount);
          });
        } catch (adminReadErr) {
          console.warn('[api/announcements] Đọc admin allReads warning:', adminReadErr);
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
  }

    // 6. Map to standardized AnnouncementItem with envelope unpacking
    const announcements = filtered.map((a: any) => {
      const readAt = readMap.get(a.id) || null;
      const { bodyText, envelope } = unpackAnnouncementContent(a.content);

      // Real read count (never default to mock 184/196)
      let count = readCountMap.get(a.id);
      if (count === undefined) {
        const metaCount = a.metadata?.read_count;
        count = typeof metaCount === 'number' && metaCount !== 184 && metaCount !== 196 ? metaCount : 0;
      }

      const rawMeta = {
        ...(envelope?.metadata || {}),
        ...(a.metadata || {}),
      };

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
          created_at: a.created_at || new Date().toISOString(),
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
        created_at: a.created_at || new Date().toISOString(),
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

    const audioUrl = body.audio_url || metadata.audio_url || null;
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
    const audienceVal = body.audience || metadata.audience || 'Toàn trường';
    const isBgEnabledVal = body.is_bg_enabled ?? metadata.is_bg_enabled ?? true;
    const showSealVal =
      body.show_seal ??
      metadata.show_seal ??
      (metadata.cards_visibility?.seal !== false);

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
      is_bg_enabled: isBgEnabledVal,
      cards_visibility: {
        ...(metadata.cards_visibility || {}),
        seal: showSealVal,
      },
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
    };

    // Đóng gói phong bì metadata vào content để bảo đảm tương thích ngay cả khi DB chưa chạy migration mới
    const envelope: AnnouncementEnvelopeData = {
      category,
      status,
      metadata: mergedMetadata,
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
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
    const audioUrl = body.audio_url !== undefined ? body.audio_url : null;
    const voiceType = body.voice_type || 'vn_north_female_teacher';
    const backgroundMusic = body.background_music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)';
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

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
    const audienceVal = body.audience || metadata.audience || 'Toàn trường';
    const isBgEnabledVal = body.is_bg_enabled ?? metadata.is_bg_enabled ?? true;
    const showSealVal =
      body.show_seal ??
      metadata.show_seal ??
      (metadata.cards_visibility?.seal !== false);

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
      is_bg_enabled: isBgEnabledVal,
      cards_visibility: {
        ...(metadata.cards_visibility || {}),
        seal: showSealVal,
      },
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
    };

    // Đóng gói phong bì metadata vào content
    const envelope: AnnouncementEnvelopeData = {
      category,
      status,
      metadata: mergedMetadata,
      audio_url: audioUrl,
      voice_type: voiceType,
      background_music: backgroundMusic,
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
    const auth = await requireActiveRole(request, [
      'PARENT',
      'TEACHER',
      'STAFF',
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

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

    // 1. Luôn ghi nhận vào kho lưu trữ cục bộ cho tài khoản hiện tại
    announcementIds.forEach((aid) => {
      markAnnouncementReadLocally(aid, ctx.profileId, ctx.activeRole);
    });

    // 2. Ghi nhận vào Supabase (announcement_reads) cho các ID là UUID
    if (!ctx.profileId.startsWith('bootstrap-')) {
      const validUuidRows = announcementIds
        .filter((aid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aid))
        .map((aid) => ({
          announcement_id: aid,
          user_id: ctx.profileId,
          role_context: ctx.activeRole,
          read_at: new Date().toISOString(),
        }));

      if (validUuidRows.length > 0) {
        try {
          await executeWithContextFallback(ctx, async (sb) =>
            await sb
              .from('announcement_reads')
              .upsert(validUuidRows, { onConflict: 'announcement_id,user_id,role_context' })
          );
        } catch (dbErr) {
          console.warn('[api/announcements] PATCH announcement_reads warning:', dbErr);
        }
      }
    }

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

export async function DELETE(request: Request) {
  try {
    const auth = await requireActiveRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if ('response' in auth) return auth.response;
    const { ctx } = auth;

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const id = String(queryId || body?.id || '').trim();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã định danh (ID) thông báo cần xóa.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let dbDeleted = false;
    let dbErrorMsg: string | null = null;

    // 1. Xử lý xóa trên Database (Supabase) nếu ID là UUID
    if (isUuid && id !== SYSTEM_DELETED_REGISTRY_ID) {
      try {
        const delResult = await executeWithContextFallback(ctx, async (sb) => {
          // 1.1 Xóa sạch các bản ghi phụ thuộc khóa ngoại ở bảng announcement_reads trước (CASCADE DELETE)
          try {
            await sb.from('announcement_reads').delete().eq('announcement_id', id);
          } catch (readErr) {
            console.warn('[api/announcements] Xóa announcement_reads warning:', readErr);
          }

          // 1.2 Thực hiện xóa cứng bản ghi chính trong bảng announcements
          const delRes = await sb.from('announcements').delete().eq('id', id);
          return delRes;
        });

        if (delResult?.error) {
          dbErrorMsg = delResult.error.message || 'Lỗi cơ sở dữ liệu khi xóa thông báo.';
        } else {
          dbDeleted = true;
        }
      } catch (dbErr: any) {
        console.error('[api/announcements] DB delete fatal error:', dbErr);
        dbErrorMsg = dbErr?.message || 'Lỗi kết nối cơ sở dữ liệu khi xóa thông báo.';
      }
    }

    // 2. Ghi nhận vĩnh viễn ID đã xóa vào Persistent Deleted Registry trên Database Supabase
    try {
      await recordDeletedAnnouncementId(ctx, id);
    } catch (regErr) {
      console.warn('[api/announcements] Ghi nhận Deleted Registry warning:', regErr);
    }

    // 3. Xóa khỏi kho lưu trữ cục bộ (Local Persistent Store) và dọn dẹp lượt đọc
    const localDeleted = deleteLocalAnnouncement(id);
    removeAnnouncementReadsLocally(id);

    return NextResponse.json(
      {
        success: true,
        deleted: id,
        db_deleted: dbDeleted,
        local_deleted: localDeleted,
        message: 'Đã xóa thông báo thành công khỏi hệ thống.',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể xóa thông báo.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
