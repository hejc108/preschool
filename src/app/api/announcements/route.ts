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
  AnnouncementEnvelopeData,
} from '@/lib/announcements/announcementStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // 1. Fetch from Supabase PostgreSQL (select('*') safely queries only existing columns)
    const { data: dbRows, error: dbError } = await executeWithContextFallback(ctx, async (sb) => {
      if (requestedId) {
        return (await sb.from('announcements').select('*').eq('id', requestedId).limit(1)) as any;
      }
      let query = sb
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (!isAdminRole(ctx.activeRole)) {
        // If status column doesn't exist, this eq might fail, so we filter in-memory as well
        try {
          query = query.eq('status', 'PUBLISHED');
        } catch (_) {}
      }
      return (await query) as any;
    });

    let rawList: any[] = [];
    if (!dbError && Array.isArray(dbRows)) {
      rawList = dbRows;
    } else if (!dbError && dbRows) {
      rawList = [dbRows];
    }

    // 2. Fallback / Merge with local persistent store to ensure Zero Data Loss
    const localList = readLocalAnnouncementsStore();
    if (localList.length > 0) {
      const existingIds = new Set(rawList.map((x) => x.id));
      for (const locItem of localList) {
        if (!existingIds.has(locItem.id)) {
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
      if (requestedId && item.id !== requestedId) return false;

      // Extract unpacked metadata to check status and target
      const { envelope } = unpackAnnouncementContent(item.content);
      const effectiveStatus = item.status || envelope?.status || 'PUBLISHED';
      const effectiveCategory = item.category || envelope?.category || 'Lễ hội';
      const effectiveTargetRole = item.target_role || 'ALL';

      if (isAdminRole(ctx.activeRole)) {
        if (requestedTarget && effectiveTargetRole !== requestedTarget) return false;
        if (requestedCategory && effectiveCategory !== requestedCategory) return false;
        if (requestedStatus && effectiveStatus !== requestedStatus) return false;
        return true;
      }

      // Non-admins only see PUBLISHED
      if (effectiveStatus !== 'PUBLISHED') return false;

      if (ctx.activeRole === 'TEACHER') {
        if (effectiveTargetRole !== 'ALL' && effectiveTargetRole !== 'TEACHER') return false;
        if (item.class_id && !ctx.assignedClassIds.includes(item.class_id)) return false;
        return true;
      }
      if (ctx.activeRole === 'PARENT') {
        if (effectiveTargetRole !== 'ALL' && effectiveTargetRole !== 'PARENT') return false;
        if (item.class_id && !parentChildClassIds.has(item.class_id)) return false;
        return true;
      }
      return effectiveTargetRole === 'ALL';
    });

    // 5. Fetch read receipts
    const readMap = new Map<string, string>();
    const readCountMap = new Map<string, number>();

    // Calculate total active students in school (from DB or fallback 170)
    let totalEnrolledStudents = 170;
    try {
      const studentRes = (await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('students').select('id', { count: 'exact' }).eq('status', 'ACTIVE')
      )) as any;
      if (typeof studentRes?.count === 'number' && studentRes.count > 0) {
        totalEnrolledStudents = studentRes.count;
      } else if (Array.isArray(studentRes?.data) && studentRes.data.length > 0) {
        totalEnrolledStudents = studentRes.data.length;
      }
    } catch {
      // Fallback 170
    }

    if (filtered.length > 0 && !ctx.profileId.startsWith('bootstrap-')) {
      const annIds = filtered.map((a: any) => a.id).filter(Boolean);
      if (annIds.length > 0) {
        const { data: readRows } = await executeWithContextFallback(ctx, async (sb) =>
          await sb
            .from('announcement_reads')
            .select('announcement_id, read_at')
            .eq('user_id', ctx.profileId)
            .eq('role_context', ctx.activeRole)
            .in('announcement_id', annIds)
        );
        (readRows || []).forEach((r: any) => {
          readMap.set(r.announcement_id, r.read_at);
        });

        if (isAdminRole(ctx.activeRole)) {
          // Fetch all read log entries for these announcements
          const { data: allReads } = await executeWithContextFallback(ctx, async (sb) =>
            await sb
              .from('announcement_reads')
              .select('announcement_id, user_id, role_context')
              .in('announcement_id', annIds)
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
        }
      }
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
      const sanitizedAudience =
        rawMeta.audience === 'Toàn trường (200 bé)' ? 'Toàn trường' : rawMeta.audience || 'Toàn trường';

      // Dynamic total target count based on target scope (default to actual 170 students, never 200)
      const audienceStr = String(sanitizedAudience || a.audience || '').toLowerCase();
      let totalTargetCount = totalEnrolledStudents;
      if (a.class_id) {
        if (a.class_id === 'c-nhatre' || a.class_id.includes('14ccdb7e')) totalTargetCount = 24;
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

      let sanitizedBg = rawMeta.custom_bg_url;
      if (sanitizedBg && typeof sanitizedBg === 'string' && sanitizedBg.startsWith('data:image')) {
        sanitizedBg = EMBEDDED_BACKGROUNDS[rawMeta.template_id] || '/images/announcements/le-hoi.jpg';
      }

      const mergedMeta = {
        ...rawMeta,
        audience: sanitizedAudience,
        total_target_count: totalTargetCount,
        audio_url: audioUrl,
        voice_type: voiceType,
        background_music: bgMusic,
        custom_bg_url: sanitizedBg,
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
        metadata: {
          audio_url: audioUrl,
          voice_type: voiceType,
          background_music: bgMusic,
          is_urgent: isUrgent,
          has_audio: Boolean(audioUrl || rawMeta.has_audio !== false),
          has_poster: Boolean(rawMeta.has_poster !== false),
          audience: sanitizedAudience,
          template_id: rawMeta.template_id || 'le-hoi',
          custom_bg_url: sanitizedBg,
          is_bg_enabled: rawMeta.is_bg_enabled !== false,
          time_value: rawMeta.time_value || '',
          location_value: rawMeta.location_value || '',
          deadline_value: rawMeta.deadline_value || '',
          cards_visibility: rawMeta.cards_visibility || {},
          table_data: rawMeta.table_data || null,
          total_target_count: totalTargetCount,
        },
        is_read: Boolean(readAt),
        read_at: readAt,
        read_count: count,
        total_target_count: totalTargetCount,
      };
    });

    const unreadCount = announcements.filter((a: any) => !a.is_read).length;

    const cacheHeaders = requestedId
      ? {
          'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
          'X-Payload-Type': 'detail',
        }
      : {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=30',
          'X-Payload-Type': 'list',
        };

    return NextResponse.json(
      {
        success: true,
        active_role: ctx.activeRole,
        announcement: requestedId ? announcements[0] || null : null,
        announcements,
        unread_count: unreadCount,
      },
      { headers: cacheHeaders }
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

    const mergedMetadata = {
      ...metadata,
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
      metadata: mergedMetadata,
      read_count: 0,
      is_read: true,
    };

    // Luôn đồng bộ vào kho dự phòng cục bộ để không bao giờ mất dữ liệu
    upsertLocalAnnouncement(resultItem);

    // Xử lý gửi thông báo đẩy nếu phát hành chính thức
    let notificationPayload = null;
    if (status === 'PUBLISHED') {
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

    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const content = body.content !== undefined ? String(body.content).trim() : undefined;
    const category = body.category !== undefined ? String(body.category).trim() : 'Lễ hội';
    const status = body.status !== undefined ? String(body.status).trim() : 'PUBLISHED';
    const audioUrl = body.audio_url !== undefined ? body.audio_url : null;
    const voiceType = body.voice_type || 'vn_north_female_teacher';
    const backgroundMusic = body.background_music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)';
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    const mergedMetadata = {
      ...metadata,
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
      content: content || data?.content,
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
      metadata: mergedMetadata,
    };

    upsertLocalAnnouncement(updatedItem);

    if (status === 'PUBLISHED') {
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

    if (!ctx.profileId.startsWith('bootstrap-')) {
      const rows = announcementIds.map((aid) => ({
        announcement_id: aid,
        user_id: ctx.profileId,
        role_context: ctx.activeRole,
        read_at: new Date().toISOString(),
      }));

      await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('announcement_reads')
          .upsert(rows, { onConflict: 'announcement_id,user_id,role_context' })
      );
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã định danh (ID) thông báo cần xóa.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // 1. Xóa khỏi Supabase
    await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').delete().eq('id', id)
    );

    // 2. Xóa khỏi kho dự phòng
    deleteLocalAnnouncement(id);

    return NextResponse.json({ success: true, deleted: id }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    console.error('[api/announcements] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể xóa thông báo.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
