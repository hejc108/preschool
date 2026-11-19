import * as webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { NotificationChannel, PushNotificationPayload } from '@/lib/types/schema';
import { executeWithAdminFallback, getSupabaseConfig } from '@/lib/supabase/server';
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
  sound?: string;
}): PushNotificationPayload {
  return {
    id: input.id || `${input.notification_channel.toLowerCase()}-${Date.now()}`,
    title: input.title,
    body: input.body,
    notification_channel: input.notification_channel,
    student_id: input.student_id,
    class_id: input.class_id,
    url: input.url || (input.notification_channel === 'TEACHER' ? '/teacher' : '/parent'),
    sound: input.sound || '/sounds/SM1.wav',
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

export interface PushSubRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  active_role_preference?: string | null;
  user_agent?: string | null;
  platform?: 'ios' | 'android' | 'desktop' | string | null;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Kho Lưu Trữ Đa Tầng Bền Vững (Cloud Supabase Store + Local Disk Fallback)
// Bảo toàn 100% các thiết bị iPhone & Android đã đăng ký Web Push
// hoạt động đồng bộ xuyên suốt tất cả các Serverless Container / Lambdas / VPS.
// -----------------------------------------------------------------------------
export const SUPABASE_STORE_EMAIL = 'push-sub-store@suongmai.local';

export async function fetchCloudPushSubscriptionsStore(): Promise<PushSubRecord[]> {
  try {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) return [];
    const res = await fetch(
      `${url}/rest/v1/profiles?email=eq.${SUPABASE_STORE_EMAIL}&select=assigned_class_name`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.assigned_class_name) {
      const parsed = JSON.parse(data[0].assigned_class_name);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[pushPayload] fetchCloudPushSubscriptionsStore warning:', err);
  }
  return [];
}

export async function persistCloudPushSubscriptionsStore(items: PushSubRecord[]): Promise<void> {
  try {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) return;
    await fetch(`${url}/rest/v1/profiles?email=eq.${SUPABASE_STORE_EMAIL}`, {
      method: 'PATCH',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assigned_class_name: JSON.stringify(items),
        is_temporary: true,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('[pushPayload] persistCloudPushSubscriptionsStore warning:', err);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __SUONGMAI_PUSH_SUBS_STORE__: PushSubRecord[] | undefined;
}

const LOCAL_PUSH_SUBSCRIPTIONS = new Map<string, PushSubRecord>();

function getPushSubStoreFilePaths(): string[] {
  return [
    path.resolve(process.cwd(), 'src/lib/data/push_subscriptions_store.json'),
    path.resolve('/tmp', 'suongmai_push_subscriptions_store.json'),
  ];
}

export function readLocalPushSubscriptionsStore(): PushSubRecord[] {
  if (globalThis.__SUONGMAI_PUSH_SUBS_STORE__ && globalThis.__SUONGMAI_PUSH_SUBS_STORE__.length > 0) {
    return globalThis.__SUONGMAI_PUSH_SUBS_STORE__;
  }

  const map = new Map<string, PushSubRecord>();

  for (const filePath of getPushSubStoreFilePaths()) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && item.endpoint) {
              map.set(item.endpoint, item);
            }
          });
        }
      }
    } catch (_) {}
  }

  const result = Array.from(map.values());
  globalThis.__SUONGMAI_PUSH_SUBS_STORE__ = result;
  return result;
}

export function writeLocalPushSubscriptionsStore(items: PushSubRecord[]): void {
  globalThis.__SUONGMAI_PUSH_SUBS_STORE__ = items;
  for (const filePath of getPushSubStoreFilePaths()) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
    } catch (_) {}
  }
}

export async function savePushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  activeRolePreference?: string | null;
  userAgent?: string | null;
  platform?: 'ios' | 'android' | 'desktop' | string | null;
  ctx?: SessionContext;
}) {
  // 1. Hợp nhất danh sách hiện tại từ Cloud Store và Local Disk
  const cloudSubs = await fetchCloudPushSubscriptionsStore();
  const diskSubs = readLocalPushSubscriptionsStore();

  const map = new Map<string, PushSubRecord>();
  diskSubs.forEach((s) => { if (s?.endpoint) map.set(s.endpoint, s); });
  cloudSubs.forEach((s) => { if (s?.endpoint) map.set(s.endpoint, s); });

  const current = Array.from(map.values());
  const existingIdx = current.findIndex((x) => x.endpoint === params.endpoint);
  const now = new Date().toISOString();

  let detectedPlatform = params.platform || 'unknown';
  if (detectedPlatform === 'unknown' && params.userAgent) {
    const ua = params.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) detectedPlatform = 'ios';
    else if (ua.includes('android')) detectedPlatform = 'android';
    else detectedPlatform = 'desktop';
  }

  const record: PushSubRecord = {
    id: existingIdx >= 0 ? current[existingIdx].id : `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.userId || 'anonymous-device',
    endpoint: params.endpoint,
    p256dh: params.p256dh,
    auth: params.auth,
    active_role_preference: params.activeRolePreference || null,
    user_agent: params.userAgent || null,
    platform: detectedPlatform,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...record };
  } else {
    current.push(record);
  }

  // 2. Ghi song song: Cloud Store (cho mọi serverless container) + Local Disk + In-Memory
  writeLocalPushSubscriptionsStore(current);
  LOCAL_PUSH_SUBSCRIPTIONS.set(params.endpoint, record);
  await persistCloudPushSubscriptionsStore(current);

  console.log(`[pushPayload] Đã lưu thiết bị ${record.user_id} (${record.platform}). Tổng số thiết bị đăng ký: ${current.length}`);

  // 3. Thử đồng bộ xuống Supabase Postgres nếu có quyền
  try {
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
            updated_at: now,
          },
          { onConflict: 'endpoint' }
        )
        .select()
        .maybeSingle();

    const res = params.ctx ? await executeWithContextFallback(params.ctx, query) : await executeWithAdminFallback(query);
    return res.data ? res : { data: record, error: null };
  } catch {
    return { data: record, error: null };
  }
}

/**
 * Gửi trực tiếp Web Push tới một đối tượng PushSubscription cụ thể (Dùng cho kiểm thử chuông màn hình khóa)
 */
export async function dispatchDirectWebPush(params: {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  payload: PushNotificationPayload;
}): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  if (!hasVapidConfig() || !params.subscription?.endpoint) {
    return { success: false, error: 'Thiếu cấu hình VAPID hoặc endpoint' };
  }

  try {
    webpush.setVapidDetails(
      getVapidSubject(),
      getVapidPublicKey(),
      getVapidPrivateKey()
    );
  } catch (_) {}

  const soundChoice = params.payload.sound || '/sounds/SM1.wav';
  const uniqueTag = `suongmai-alert-${params.payload.id || Date.now()}`;
  const targetUrl = params.payload.url || (params.payload.notification_channel === 'TEACHER' ? '/teacher' : '/parent');

  const payloadString = JSON.stringify({
    title: params.payload.title,
    body: params.payload.body,
    notification_channel: params.payload.notification_channel,
    target_url: targetUrl,
    url: targetUrl,
    entity_id: params.payload.id,
    id: params.payload.id,
    student_id: params.payload.student_id,
    class_id: params.payload.class_id,
    sound: soundChoice,
    tag: uniqueTag,
    silent: false,
    requireInteraction: true,
    timestamp: Date.now(),
  });

  try {
    const res = await webpush.sendNotification(
      {
        endpoint: params.subscription.endpoint,
        keys: {
          p256dh: params.subscription.keys.p256dh,
          auth: params.subscription.keys.auth,
        },
      },
      payloadString,
      {
        TTL: 86400,
        urgency: 'high',
        headers: {
          Urgency: 'high',
        },
      }
    );
    console.log(`[dispatchDirectWebPush] Direct Web Push sent (${res.statusCode}) to ${params.subscription.endpoint.substring(0, 45)}...`);
    return { success: true, statusCode: res.statusCode };
  } catch (err: any) {
    console.error('[dispatchDirectWebPush] error:', err?.message || err);
    return { success: false, error: err?.message || 'Lỗi gửi Web Push trực tiếp', statusCode: err?.statusCode };
  }
}

/**
 * Gửi thông báo đẩy diện rộng qua Web Push chuẩn RFC 8291 / 8292
 * Thiết lập Urgency: 'high' và cấu hình chuông báo / rung haptic để
 * đánh thức thiết bị ở chế độ màn hình khóa / tắt màn hình (iOS PWA & Android One UI).
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
  // 1. Nạp từ Cloud Store Supabase bền vững (Hoạt động 100% xuyên suốt các Serverless Lambdas / Vercel)
  const endpointMap = new Map<string, PushSubRecord>();
  try {
    const cloudSubs = await fetchCloudPushSubscriptionsStore();
    cloudSubs.forEach((s) => {
      if (s && s.endpoint) endpointMap.set(s.endpoint, s);
    });
  } catch (cloudErr) {
    console.warn('[dispatchContextPushNotification] fetchCloudPushSubscriptionsStore notice:', cloudErr);
  }

  // 2. Nạp thêm từ kho lưu trữ đĩa cục bộ bền vững (Persistent Disk Store)
  const diskSubs = readLocalPushSubscriptionsStore();
  diskSubs.forEach((s) => {
    if (s && s.endpoint && !endpointMap.has(s.endpoint)) endpointMap.set(s.endpoint, s);
  });

  // 3. Nạp thêm từ Supabase bảng push_subscriptions nếu có dữ liệu
  try {
    const { data } = await executeWithAdminFallback(async (sb) =>
      await sb.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, active_role_preference')
    );
    if (Array.isArray(data)) {
      data.forEach((s) => {
        if (s && s.endpoint && !endpointMap.has(s.endpoint)) {
          endpointMap.set(s.endpoint, s as PushSubRecord);
        }
      });
    }
  } catch (fetchErr) {
    console.warn('[dispatchContextPushNotification] Lưu ý truy vấn Supabase push_subscriptions (sử dụng kho cục bộ):', fetchErr);
  }

  // 4. Hợp nhất với LOCAL_PUSH_SUBSCRIPTIONS in-memory
  LOCAL_PUSH_SUBSCRIPTIONS.forEach((record, ep) => {
    if (!endpointMap.has(ep) && record.endpoint && record.p256dh && record.auth) {
      endpointMap.set(ep, record);
    }
  });

  let subscriptions = Array.from(endpointMap.values());

  // 4. Nếu có targetProfileIds cụ thể (e.g. thông báo riêng cho phụ huynh của 1 bé),
  // lọc theo targetProfileIds HOẶC giữ lại thiết bị BGH/Admin để giám sát.
  // Ngược lại nếu là thông báo chung / diện rộng (Toàn trường, Khối, Lớp) -> GỬI TỚI 100% CÁC THIẾT BỊ ĐÃ ĐĂNG KÝ!
  if (params.targetProfileIds && params.targetProfileIds.length > 0) {
    subscriptions = subscriptions.filter((s) =>
      params.targetProfileIds!.includes(s.user_id) ||
      s.active_role_preference === 'SCHOOL_ADMIN' ||
      s.active_role_preference === 'SUPER_ADMIN'
    );
  }

  const subscriptionCount = subscriptions.length;
  console.log(`[dispatchContextPushNotification] Tìm thấy ${subscriptionCount} thiết bị đăng ký. Bắt đầu phát sóng Web Push khẩn cấp...`);

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

  const soundChoice = params.payload.sound || '/sounds/SM1.wav';
  const uniqueTag = `suongmai-alert-${params.payload.id || Date.now()}`;
  const targetUrl = params.payload.url || (params.payload.notification_channel === 'TEACHER' ? '/teacher' : '/parent');

  const payloadString = JSON.stringify({
    title: params.payload.title,
    body: params.payload.body,
    notification_channel: params.payload.notification_channel,
    target_url: targetUrl,
    url: targetUrl,
    entity_id: params.payload.id,
    id: params.payload.id,
    student_id: params.payload.student_id,
    class_id: params.payload.class_id,
    sound: soundChoice,
    tag: uniqueTag,
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
        const res = await webpush.sendNotification(
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
        console.log(`[dispatchContextPushNotification] Đã gửi thông báo tới ${sub.endpoint.substring(0, 45)}... [Platform: ${sub.platform || 'device'}, HTTP ${res.statusCode}]`);
      } catch (pushErr: any) {
        // Gỡ bỏ subscription đã hết hạn hoặc bị người dùng thu hồi quyền (410 Gone / 404 Not Found)
        if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn('[dispatchContextPushNotification] Gửi thông báo đẩy thất bại:', pushErr?.message || pushErr);
        }
      }
    })
  );

  // Dọn dẹp các endpoint không còn hiệu lực khỏi đĩa và database
  if (expiredEndpoints.length > 0) {
    const updated = subscriptions.filter((s) => !expiredEndpoints.includes(s.endpoint));
    writeLocalPushSubscriptionsStore(updated);
    await persistCloudPushSubscriptionsStore(updated);
    try {
      await executeWithAdminFallback(async (sb) =>
        await sb.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
      );
    } catch (cleanupErr) {
      console.warn('[dispatchContextPushNotification] cleanup expired subscriptions warning:', cleanupErr);
    }
  }

  console.log(`[dispatchContextPushNotification] Hoàn tất: ${successCount}/${subscriptionCount} thiết bị nhận thành công.`);

  return {
    mode: 'web_push',
    subscriptionCount,
    successCount,
    payload: params.payload,
  };
}
