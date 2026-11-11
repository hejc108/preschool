import { NextResponse } from 'next/server';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { executeWithContextFallback, requireActiveRole } from '@/lib/auth/sessionContext';
import {
  getVapidPublicKey,
  hasVapidConfig,
  savePushSubscription,
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

    const targetFilter =
      ctx.activeRole === 'TEACHER'
        ? ['ALL', 'TEACHER']
        : ctx.activeRole === 'PARENT'
        ? ['ALL', 'PARENT']
        : ['ALL', 'TEACHER', 'PARENT'];

    const { data: notices, error: noticesErr } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('announcements')
        .select('*')
        .in('target_role', targetFilter)
        .order('created_at', { ascending: false })
        .limit(30)
    );

    if (noticesErr && isAuthOrRlsError(noticesErr)) {
      return NextResponse.json(
        { success: false, error: noticesErr.message, notifications: [] },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const list = Array.isArray(notices) ? notices : [];
    const readSet = new Set<string>();
    if (list.length > 0 && !ctx.profileId.startsWith('bootstrap-')) {
      const { data: reads } = await executeWithContextFallback(ctx, async (sb) =>
        await sb
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', ctx.profileId)
          .eq('role_context', ctx.activeRole)
          .in(
            'announcement_id',
            list.map((n: any) => n.id)
          )
      );
      (reads || []).forEach((r: any) => readSet.add(r.announcement_id));
    }

    const mapped = list.map((n: any) => ({
      ...n,
      notification_channel: n.notification_channel || (n.target_role === 'TEACHER' ? 'TEACHER' : 'PARENT'),
      is_read: readSet.has(n.id),
    }));

    return NextResponse.json(
      {
        success: true,
        active_role: ctx.activeRole,
        vapid_enabled: hasVapidConfig(),
        vapid_public_key: getVapidPublicKey(),
        notifications: mapped,
        unread_count: mapped.filter((n) => !n.is_read).length,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/notifications] GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error', notifications: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
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
      return NextResponse.json(
        { success: false, error: 'Tài khoản hệ thống không hỗ trợ đăng ký push.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await request.json().catch(() => ({}));
    const endpoint = String(body.endpoint || '').trim();
    const p256dh = String(body.keys?.p256dh || body.p256dh || '').trim();
    const authKey = String(body.keys?.auth || body.auth || '').trim();

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin PushSubscription (endpoint, keys).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { data, error } = await savePushSubscription({
      userId: ctx.profileId,
      endpoint,
      p256dh,
      auth: authKey,
      activeRolePreference: ctx.activeRole,
      userAgent: request.headers.get('user-agent'),
      ctx,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        subscription: data,
        vapid_enabled: hasVapidConfig(),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error('[api/notifications] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
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
    const endpoint = searchParams.get('endpoint') || '';
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Thiếu endpoint cần hủy.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { error } = await executeWithContextFallback(ctx, async (sb) =>
      await sb
        .from('push_subscriptions')
        .delete()
        .eq('user_id', ctx.profileId)
        .eq('endpoint', endpoint)
    );

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isAuthOrRlsError(error) ? 403 : 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
