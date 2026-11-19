import { NextResponse } from 'next/server';
import { isAuthOrRlsError, NO_CACHE_HEADERS } from '@/lib/supabase/server';
import { executeWithContextFallback, requireActiveRole, SessionContext } from '@/lib/auth/sessionContext';
import { UserRole } from '@/lib/types/schema';
import {
  buildPushPayload,
  dispatchContextPushNotification,
  dispatchDirectWebPush,
  getVapidPublicKey,
  hasVapidConfig,
  savePushSubscription,
  readLocalPushSubscriptionsStore,
  fetchCloudPushSubscriptionsStore,
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

    const cloudSubs = await fetchCloudPushSubscriptionsStore().catch(() => []);
    const localSubs = readLocalPushSubscriptionsStore();
    const totalCount = Math.max(cloudSubs.length, localSubs.length);

    return NextResponse.json(
      {
        success: true,
        active_role: ctx.activeRole,
        vapid_enabled: hasVapidConfig(),
        vapid_public_key: getVapidPublicKey(),
        notifications: mapped,
        unread_count: mapped.filter((n) => !n.is_read).length,
        subscription_count: totalCount,
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
    // 1. Nhận diện phiên người dùng nếu có (Không chặn thiết bị PWA chưa đăng nhập hoặc đang chờ duyệt)
    let profileId = 'device-pwa';
    let activeRole: UserRole = 'PARENT';
    let authCtx: SessionContext | undefined = undefined;

    try {
      const auth = await requireActiveRole(request, [
        'PARENT',
        'TEACHER',
        'STAFF',
        'SCHOOL_ADMIN',
        'SUPER_ADMIN',
      ]);
      if (!('response' in auth)) {
        authCtx = auth.ctx;
        profileId = auth.ctx.profileId;
        activeRole = auth.ctx.activeRole;
      }
    } catch {
      // Cho phép thiết bị PWA đăng ký nhận chuông trước khi đăng nhập
    }

    const body = await request.json().catch(() => ({}));

    // Hỗ trợ kiểm thử chuông báo Web Push trực tiếp tới thiết bị của người dùng
    if (body.action === 'test' || body.send_test === true) {
      const delayMs = typeof body.delay_ms === 'number' && body.delay_ms >= 0 && body.delay_ms <= 10000 ? body.delay_ms : 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const soundChoice = body.sound || '/sounds/SM1.wav';
      const testPayload = buildPushPayload({
        title: body.title || '🔔 Chuông báo Mầm Non Sương Mai',
        body: body.body || 'Âm thanh thông báo chuẩn Sương Mai đã sẵn sàng trên màn hình khóa!',
        notification_channel: activeRole === 'TEACHER' ? 'TEACHER' : 'PARENT',
        url: activeRole === 'TEACHER' ? '/teacher' : '/parent',
        sound: soundChoice,
      });

      // Nếu client gửi kèm PushSubscription cụ thể của máy hiện tại, lưu ngay và gửi trực tiếp tới máy đó!
      const directSub = body.subscription;
      if (directSub?.endpoint && directSub?.keys?.p256dh && directSub?.keys?.auth) {
        await savePushSubscription({
          userId: profileId,
          endpoint: directSub.endpoint,
          p256dh: directSub.keys.p256dh,
          auth: directSub.keys.auth,
          activeRolePreference: activeRole,
          userAgent: request.headers.get('user-agent'),
          platform: body.platform,
          ctx: authCtx,
        });

        const directRes = await dispatchDirectWebPush({
          subscription: directSub,
          payload: testPayload,
        });

        return NextResponse.json(
          {
            success: directRes.success,
            mode: 'direct_web_push',
            total_registered: readLocalPushSubscriptionsStore().length,
            test_result: directRes,
            message: directRes.success
              ? 'Đã phát tín hiệu chuông trực tiếp tới thiết bị qua Web Push!'
              : `Lỗi phát tín hiệu: ${directRes.error}`,
          },
          { headers: NO_CACHE_HEADERS }
        );
      }

      const pushRes = await dispatchContextPushNotification({
        targetProfileIds: profileId !== 'device-pwa' ? [profileId] : undefined,
        payload: testPayload,
      });
      return NextResponse.json(
        {
          success: pushRes.subscriptionCount > 0,
          total_registered: readLocalPushSubscriptionsStore().length,
          test_result: pushRes,
          message: pushRes.subscriptionCount > 0
            ? 'Đã phát tín hiệu chuông thử nghiệm tới thiết bị.'
            : 'Chưa có thiết bị nào đăng ký nhận chuông. Vui lòng bấm "Bật ngay" trên chuông thông báo của điện thoại để đăng ký thiết bị.',
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const endpoint = String(body.endpoint || '').trim();
    const p256dh = String(body.keys?.p256dh || body.p256dh || '').trim();
    const authKey = String(body.keys?.auth || body.auth || '').trim();

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin PushSubscription (endpoint, keys).' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const platform = body.platform || (request.headers.get('user-agent')?.includes('iPhone') ? 'ios' : 'android');

    const { data, error } = await savePushSubscription({
      userId: profileId,
      endpoint,
      p256dh,
      auth: authKey,
      activeRolePreference: activeRole,
      userAgent: request.headers.get('user-agent'),
      platform,
      ctx: authCtx,
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
        total_registered: readLocalPushSubscriptionsStore().length,
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
