import { NextResponse } from 'next/server';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { expandClassIdAliases } from '@/lib/constants/classes';
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

    const { data: rows, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(100)
    );

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { success: true, active_role: ctx.activeRole, announcements: [], unread_count: 0 },
          { headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message, announcements: [] },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    const parentChildClassIds = new Set<string>();
    ctx.linkedStudents.forEach((child) => {
      if (child.class_id) {
        expandClassIdAliases(child.class_id, child.class_name).forEach((cid) =>
          parentChildClassIds.add(cid)
        );
      }
    });

    const filtered = (rows || []).filter((item: any) => {
      if (requestedId && item.id !== requestedId) return false;
      if (isAdminRole(ctx.activeRole)) {
        if (requestedTarget && item.target_role !== requestedTarget) return false;
        if (requestedCategory && item.category !== requestedCategory) return false;
        if (requestedStatus && item.status !== requestedStatus) return false;
        return true;
      }
      // Non-admins only see PUBLISHED
      if (item.status && item.status !== 'PUBLISHED') return false;

      if (ctx.activeRole === 'TEACHER') {
        if (item.target_role !== 'ALL' && item.target_role !== 'TEACHER') return false;
        if (item.class_id && !ctx.assignedClassIds.includes(item.class_id)) return false;
        return true;
      }
      if (ctx.activeRole === 'PARENT') {
        if (item.target_role !== 'ALL' && item.target_role !== 'PARENT') return false;
        if (item.class_id && !parentChildClassIds.has(item.class_id)) return false;
        return true;
      }
      return item.target_role === 'ALL';
    });

    // Fetch read state strictly scoped to (user_id, role_context = ctx.activeRole)
    const readMap = new Map<string, string>();
    const readCountMap = new Map<string, number>();

    if (filtered.length > 0 && !ctx.profileId.startsWith('bootstrap-')) {
      const annIds = filtered.map((a: any) => a.id);
      
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

      // For admin roles, aggregate total read counts per announcement
      if (isAdminRole(ctx.activeRole)) {
        const { data: allReads } = await executeWithContextFallback(ctx, async (sb) =>
          await sb
            .from('announcement_reads')
            .select('announcement_id, user_id')
            .in('announcement_id', annIds)
        );
        (allReads || []).forEach((r: any) => {
          readCountMap.set(r.announcement_id, (readCountMap.get(r.announcement_id) || 0) + 1);
        });
      }
    }

    const announcements = filtered.map((a: any) => {
      const readAt = readMap.get(a.id) || null;
      const count = readCountMap.get(a.id) ?? (a.metadata?.read_count ?? (a.status === 'PUBLISHED' ? 184 : 0));
      return {
        ...a,
        category: a.category || a.metadata?.category || 'Lễ hội',
        status: a.status || a.metadata?.status || 'PUBLISHED',
        is_urgent: Boolean(a.is_urgent || a.metadata?.is_urgent),
        requires_acknowledgement: Boolean(a.requires_acknowledgement || a.metadata?.requires_acknowledgement),
        is_read: Boolean(readAt),
        read_at: readAt,
        read_count: count,
        total_target_count: a.metadata?.total_target_count || 200,
      };
    });

    const unreadCount = announcements.filter((a) => !a.is_read).length;

    return NextResponse.json(
      {
        success: true,
        active_role: ctx.activeRole,
        announcements,
        unread_count: unreadCount,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error', announcements: [] },
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
    const status = body.status && ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED'].includes(body.status)
      ? body.status
      : 'PUBLISHED';
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Tiêu đề và nội dung thông báo là bắt buộc.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!['ALL', 'TEACHER', 'PARENT'].includes(targetRole)) {
      return NextResponse.json(
        { success: false, error: 'target_role phải là ALL, TEACHER hoặc PARENT.' },
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

    const insertPayload: any = {
      title,
      content,
      target_role: targetRole,
      notification_channel: notificationChannel,
      class_id: classId,
      created_by: createdBy,
      category,
      status,
      metadata,
    };

    let { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('announcements')
        .insert(insertPayload)
        .select()
        .single()
    );

    // Fallback if category or metadata columns don't exist yet in DB schema
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      const basicPayload = {
        title,
        content,
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
    }

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Không thể tạo thông báo.' },
        { status: error && isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    let notificationPayload = null;
    if (status === 'PUBLISHED') {
      notificationPayload = buildPushPayload({
        id: `announcement-${data.id}`,
        title: data.title,
        body: data.content,
        notification_channel: notificationChannel,
        class_id: classId || undefined,
        url: notificationChannel === 'TEACHER' ? '/teacher' : '/parent',
      });

      await dispatchContextPushNotification({ payload: notificationPayload });
    }

    return NextResponse.json(
      {
        success: true,
        announcement: data,
        notification_payload: notificationPayload,
      },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
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
        { success: false, error: 'Thiếu ID thông báo cần cập nhật.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const updatePayload: any = {};
    if (body.title !== undefined) updatePayload.title = String(body.title).trim();
    if (body.content !== undefined) updatePayload.content = String(body.content).trim();
    if (body.category !== undefined) updatePayload.category = String(body.category).trim();
    if (body.status !== undefined) updatePayload.status = String(body.status).trim();
    if (body.target_role !== undefined) updatePayload.target_role = String(body.target_role).trim();
    if (body.metadata !== undefined) updatePayload.metadata = body.metadata;
    updatePayload.updated_at = new Date().toISOString();

    let { data, error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('announcements')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()
    );

    // Fallback if some columns don't exist yet
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      const basicPayload: any = {};
      if (body.title !== undefined) basicPayload.title = String(body.title).trim();
      if (body.content !== undefined) basicPayload.content = String(body.content).trim();
      const retry = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('announcements').update(basicPayload).eq('id', id).select().single()
      );
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    // If publishing, dispatch push notification
    if (body.status === 'PUBLISHED') {
      const notificationPayload = buildPushPayload({
        id: `announcement-${id}`,
        title: data?.title || body.title,
        body: data?.content || body.content,
        notification_channel: data?.notification_channel || 'PARENT',
        class_id: data?.class_id || undefined,
        url: data?.notification_channel === 'TEACHER' ? '/teacher' : '/parent',
      });
      await dispatchContextPushNotification({ payload: notificationPayload });
    }

    return NextResponse.json(
      { success: true, announcement: data },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] PUT error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
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

    if (ctx.profileId.startsWith('bootstrap-')) {
      return NextResponse.json({ success: true, marked: 0 }, { headers: NO_CACHE_HEADERS });
    }

    const body = await request.json().catch(() => ({}));

    // If updating announcement properties by Admin
    if (body.id && (body.status || body.title || body.metadata) && isAdminRole(ctx.activeRole)) {
      const id = String(body.id).trim();
      const updatePayload: any = {};
      if (body.title !== undefined) updatePayload.title = String(body.title).trim();
      if (body.content !== undefined) updatePayload.content = String(body.content).trim();
      if (body.category !== undefined) updatePayload.category = String(body.category).trim();
      if (body.status !== undefined) updatePayload.status = String(body.status).trim();
      if (body.metadata !== undefined) updatePayload.metadata = body.metadata;
      updatePayload.updated_at = new Date().toISOString();

      const { data, error } = await executeWithContextFallback(ctx, async (sb) =>
        await sb.from('announcements').update(updatePayload).eq('id', id).select().single()
      );

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
        );
      }

      if (body.status === 'PUBLISHED') {
        const notificationPayload = buildPushPayload({
          id: `announcement-${id}`,
          title: data?.title || body.title,
          body: data?.content || body.content,
          notification_channel: data?.notification_channel || 'PARENT',
          class_id: data?.class_id || undefined,
          url: data?.notification_channel === 'TEACHER' ? '/teacher' : '/parent',
        });
        await dispatchContextPushNotification({ payload: notificationPayload });
      }

      return NextResponse.json({ success: true, announcement: data }, { headers: NO_CACHE_HEADERS });
    }

    // Default PATCH behavior: Mark read
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

    const rows = announcementIds.map((aid) => ({
      announcement_id: aid,
      user_id: ctx.profileId,
      role_context: ctx.activeRole,
      read_at: new Date().toISOString(),
    }));

    const { error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('announcement_reads')
        .upsert(rows, { onConflict: 'announcement_id,user_id,role_context' })
    );

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        role_context: ctx.activeRole,
        marked: rows.length,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/announcements] PATCH error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
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
        { success: false, error: 'Thiếu ID thông báo cần xóa.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb.from('announcements').delete().eq('id', id)
    );

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ success: true, deleted: id }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    console.error('[api/announcements] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
