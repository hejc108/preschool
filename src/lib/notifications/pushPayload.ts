import * as webpush from 'web-push';
import { NotificationChannel, PushNotificationPayload } from '@/lib/types/schema';
import { executeWithAdminFallback } from '@/lib/supabase/server';
import { executeWithContextFallback, SessionContext } from '@/lib/auth/sessionContext';

// Default VAPID keypair for Mầm Non Sương Mai PWA (Web Push RFC 8291 / 8292)
const DEFAULT_VAPID_PUBLIC_KEY =
  'BGqtFksDUgi_wUJpyr6T-9g-k_qePF26UFE9N5xqDH5XHKUBzVSDZKOoc2zTySiWPpzO9mkZrOHvMrTPFAv3kfg';
const DEFAULT_VAPID_PRIVATE_KEY =
  'KV419C7K9T8Hwn5dMhV72oXixIJcHCjqDL_3O7qL8sU';
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@mamnonsuongmai.edu.vn';

export function buildPushPayload(input: {
  id?: string;
  title: string;
  body: string;
  notification_channel: NotificationChannel;
  student_id?: string;
  class_id?: string;
  url?: string;
}): PushNotificationPayload {
  return {
    id: input.id || `${input.notification_channel.toLowerCase()}-${Date.now()}`,
    title: input.title,
    body: input.body,
    notification_channel: input.notification_channel,
    student_id: input.student_id,
    class_id: input.class_id,
    url: input.url || (input.notification_channel === 'TEACHER' ? '/teacher' : '/parent'),
    created_at: new Date().toISOString(),
  };
}

export function mapNotificationTag(channel: NotificationChannel, id?: string): string {
  return `${channel}:${id || Date.now()}`;
}

export function getVapidPublicKey(): string {
  const raw = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
  return raw.trim() || DEFAULT_VAPID_PUBLIC_KEY;
}

export function getVapidPrivateKey(): string {
  const raw = process.env.VAPID_PRIVATE_KEY || '';
  return raw.trim() || DEFAULT_VAPID_PRIVATE_KEY;
}

export function getVapidSubject(): string {
  const raw = process.env.VAPID_SUBJECT || '';
  return raw.trim() || DEFAULT_VAPID_SUBJECT;
}

export function hasVapidConfig(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

export async function savePushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  activeRolePreference?: string | null;
  userAgent?: string | null;
  ctx?: SessionContext;
}) {
  const query = async (sb: any) =>
    await sb
      .from('push_subscriptions')
      .upsert(
        {
          user_id: params.userId,
          endpoint: params.endpoint,
          p256dh: params.p256dh,
          auth: params.auth,
          active_role_preference: params.activeRolePreference || null,
          user_agent: params.userAgent || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .maybeSingle();

  return params.ctx ? executeWithContextFallback(params.ctx, query) : executeWithAdminFallback(query);
}

/**
 * Điều phối thông báo đẩy chuẩn Web Push API (RFC 8291 / RFC 8292).
 * Đảm bảo kích hoạt hiển thị và phát âm thanh chuông "Ting" ngay cả khi
 * thiết bị ở chế độ màn hình khóa / tắt màn hình (Locked screen / Background).
 */
export async function dispatchContextPushNotification(params: {
  targetProfileIds?: string[];
  payload: PushNotificationPayload;
}): Promise<{
  mode: 'web_push' | 'realtime_fallback';
  subscriptionCount: number;
  successCount?: number;
  payload: PushNotificationPayload;
}> {
  let subscriptions: any[] = [];

  try {
    if (params.targetProfileIds && params.targetProfileIds.length > 0) {
      const { data } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth, active_role_preference')
          .in('user_id', params.targetProfileIds!)
      );
      subscriptions = Array.isArray(data) ? data : [];
    } else {
      // Gửi thông báo diện rộng theo kênh
      const channel = params.payload.notification_channel;
      const { data } = await executeWithAdminFallback(async (sb) => {
        let query = sb
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth, active_role_preference');
        if (channel === 'TEACHER') {
          query = query.in('active_role_preference', ['TEACHER', 'STAFF', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
        } else if (channel === 'PARENT') {
          query = query.or('active_role_preference.eq.PARENT,active_role_preference.is.null');
        } else {
          query = query.not('endpoint', 'is', null);
        }
        return await query;
      });
      subscriptions = Array.isArray(data) ? data : [];
    }
  } catch (fetchErr) {
    console.warn('[dispatchContextPushNotification] Lỗi truy vấn push_subscriptions:', fetchErr);
  }

  const subscriptionCount = subscriptions.length;
  if (!hasVapidConfig() || subscriptionCount === 0) {
    return {
      mode: 'realtime_fallback',
      subscriptionCount,
      payload: params.payload,
    };
  }

  // Cấu hình định danh VAPID cho máy chủ gửi Web Push
  try {
    webpush.setVapidDetails(
      getVapidSubject(),
      getVapidPublicKey(),
      getVapidPrivateKey()
    );
  } catch (vapidErr) {
    console.warn('[dispatchContextPushNotification] setVapidDetails warning:', vapidErr);
  }

  const payloadString = JSON.stringify({
    title: params.payload.title,
    body: params.payload.body,
    notification_channel: params.payload.notification_channel,
    target_url: params.payload.url,
    entity_id: params.payload.id,
    student_id: params.payload.student_id,
    class_id: params.payload.class_id,
    sound: '/sounds/notification-ting.mp3',
    silent: false,
    requireInteraction: true,
    timestamp: Date.now(),
  });

  let successCount = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) return;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadString,
          {
            TTL: 86400, // Duy trì 24 giờ cho đến khi thiết bị trực tuyến
            urgency: 'high', // Bắt buộc 'high' để đánh thức màn hình khóa thiết bị di động
            headers: {
              Urgency: 'high',
            },
          }
        );
        successCount++;
      } catch (pushErr: any) {
        // Gỡ bỏ subscription đã hết hạn hoặc bị người dùng thu hồi quyền (410 Gone / 404 Not Found)
        if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn('[dispatchContextPushNotification] send error:', pushErr?.message || pushErr);
        }
      }
    })
  );

  // Dọn dẹp các endpoint không còn hiệu lực
  if (expiredEndpoints.length > 0) {
    try {
      await executeWithAdminFallback(async (sb) =>
        await sb.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
      );
    } catch (cleanupErr) {
      console.warn('[dispatchContextPushNotification] cleanup expired subscriptions warning:', cleanupErr);
    }
  }

  return {
    mode: 'web_push',
    subscriptionCount,
    successCount,
    payload: params.payload,
  };
}
