import { NextResponse } from 'next/server';
import { executeWithAdminFallback, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { expandClassIdAliases } from '@/lib/constants/classes';
import {
  assertTeacherClassAccess,
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
    const requestedTarget = searchParams.get('target_role')?.toUpperCase().trim() || '';

    const { data: rows, error } = await executeWithAdminFallback(async (sb) =>
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
        { status: 500, headers: NO_CACHE_HEADERS }
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
      if (isAdminRole(ctx.activeRole)) {
        return requestedTarget ? item.target_role === requestedTarget : true;
      }
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
    if (filtered.length > 0 && !ctx.profileId.startsWith('bootstrap-')) {
      const { data: readRows } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('announcement_reads')
          .select('announcement_id, read_at')
          .eq('user_id', ctx.profileId)
          .eq('role_context', ctx.activeRole)
          .in(
            'announcement_id',
            filtered.map((a: any) => a.id)
          )
      );
      (readRows || []).forEach((r: any) => {
        readMap.set(r.announcement_id, r.read_at);
      });
    }

    const announcements = filtered.map((a: any) => {
      const readAt = readMap.get(a.id) || null;
      return {
        ...a,
        is_read: Boolean(readAt),
        read_at: readAt,
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
      // Teachers can only post announcements for parents in their assigned class
      targetRole = 'PARENT';
      const denied = assertTeacherClassAccess(ctx, classId);
      if (denied) return denied;
    }

    const notificationChannel = targetRole === 'TEACHER' ? 'TEACHER' : 'PARENT';
    const createdBy = ctx.profileId.startsWith('bootstrap-') ? null : ctx.profileId;

    const { data, error } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('announcements')
        .insert({
          title,
          content,
          target_role: targetRole,
          notification_channel: notificationChannel,
          class_id: classId,
          created_by: createdBy,
        })
        .select()
        .single()
    );

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Không thể tạo thông báo.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const notificationPayload = buildPushPayload({
      id: `announcement-${data.id}`,
      title: data.title,
      body: data.content,
      notification_channel: notificationChannel,
      class_id: classId || undefined,
      url: notificationChannel === 'TEACHER' ? '/teacher' : '/parent',
    });

    await dispatchContextPushNotification({ payload: notificationPayload });

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

    const { error } = await executeWithAdminFallback(async (sb) =>
      await sb
        .from('announcement_reads')
        .upsert(rows, { onConflict: 'announcement_id,user_id,role_context' })
    );

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_CACHE_HEADERS }
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
