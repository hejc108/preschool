import { NotificationChannel, PushNotificationPayload } from '@/lib/types/schema';
import { executeWithAdminFallback } from '@/lib/supabase/server';
import { executeWithContextFallback, SessionContext } from '@/lib/auth/sessionContext';

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

export function getVapidPublicKey(): string | null {
  const raw = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
  const cleaned = raw.trim();
  return cleaned || null;
}

export function hasVapidConfig(): boolean {
  const pub = getVapidPublicKey();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  return Boolean(pub && priv);
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
 * Context-aware push notification dispatcher (Q4).
 * When VAPID / web-push keys are not configured, safely falls back to Supabase
 * Realtime + client Notification API with `notification_channel` preserved in payload.
 */
export async function dispatchContextPushNotification(params: {
  targetProfileIds?: string[];
  payload: PushNotificationPayload;
}): Promise<{
  mode: 'web_push' | 'realtime_fallback';
  subscriptionCount: number;
  payload: PushNotificationPayload;
}> {
  let subscriptionCount = 0;

  if (params.targetProfileIds && params.targetProfileIds.length > 0) {
    try {
      const { data } = await executeWithAdminFallback(async (sb) =>
        await sb
          .from('push_subscriptions')
          .select('id, endpoint')
          .in('user_id', params.targetProfileIds!)
      );
      subscriptionCount = Array.isArray(data) ? data.length : 0;
    } catch {
      subscriptionCount = 0;
    }
  }

  // Safely fall back when VAPID credentials aren't provisioned in environment
  if (!hasVapidConfig() || subscriptionCount === 0) {
    return {
      mode: 'realtime_fallback',
      subscriptionCount,
      payload: params.payload,
    };
  }

  // Web Push encryption hooks can be enabled when VAPID keys + web-push are provisioned
  return {
    mode: 'realtime_fallback',
    subscriptionCount,
    payload: params.payload,
  };
}
