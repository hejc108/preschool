// Service Worker - Mầm Non Sương Mai PWA (Root Scope: /)
const CACHE_NAME = 'suongmai-pwa-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/images/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/sounds/notification-ting.mp3',
  '/sounds/acb-zalo-ting.mp3',
  '/sounds/notification.mp3'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Strict PKCE Cookie & Auth Bypass
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api') ||
    url.origin.includes('supabase.co') ||
    url.searchParams.has('code') ||
    url.searchParams.has('state')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});

// Web Push Handler (Q4): Preserve & display channel tag ('TEACHER' | 'PARENT')
// Kích hoạt hiển thị thông báo native kèm âm thanh chuông Ting (/sounds/notification-ting.mp3)
// đánh thức thiết bị ngay cả khi ở chế độ màn hình khóa / tắt màn hình (Locked screen / Background).
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Mầm Non Sương Mai',
    body: 'Bạn có thông báo mới.',
    notification_channel: 'PARENT',
    target_url: '/parent',
    student_id: null,
    class_id: null,
    entity_type: 'announcement',
    entity_id: null,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const channel = payload.notification_channel === 'TEACHER' ? 'TEACHER' : 'PARENT';
  const defaultUrl = channel === 'TEACHER' ? '/teacher' : '/parent';
  const channelBadgeLabel = channel === 'TEACHER' ? 'Giáo viên' : 'Phụ huynh';
  const title = payload.title || `Mầm Non Sương Mai (${channelBadgeLabel})`;
  const targetUrl = payload.target_url || defaultUrl;

  // Chuẩn hóa đường dẫn tài nguyên sang URL tuyệt đối (Absolute URLs)
  // đảm bảo tương thích 100% với Web Push API và WebAPK trên thiết bị di động
  const origin = self.location.origin;
  const soundUrl = new URL(payload.sound || '/sounds/notification-ting.mp3', origin).href;
  const iconUrl = new URL('/icons/icon-192x192.png', origin).href;
  const badgeUrl = new URL('/icons/icon-192x192.png', origin).href;

  // Thông báo tới tất cả các cửa sổ PWA đang mở để phát tiếng Ting tương tác (Foreground)
  const notifyOpenClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        try {
          client.postMessage({
            type: 'PLAY_NOTIFICATION_SOUND',
            payload: {
              title,
              body: payload.body,
              notification_channel: channel,
              target_url: targetUrl,
              entity_id: payload.entity_id || null,
            },
          });
        } catch (_) {}
      }
    });

  // Hiển thị thông báo Native với sound property, rung haptic và silent: false
  // để đánh thức điện thoại và phát âm thanh chuông Ting chuẩn
  const notificationTag = `suongmai-${channel.toLowerCase()}-${payload.entity_id || Date.now()}`;

  const showNotificationPromise = self.registration.showNotification(title, {
    body: payload.body,
    icon: iconUrl,
    badge: badgeUrl,
    tag: notificationTag,
    vibrate: [200, 100, 200, 100, 300],
    silent: false,
    sound: soundUrl,
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    data: {
      notification_channel: channel,
      target_url: targetUrl,
      student_id: payload.student_id || null,
      class_id: payload.class_id || null,
      entity_type: payload.entity_type || 'announcement',
      entity_id: payload.entity_id || null,
    },
    actions: [
      {
        action: 'open',
        title: 'Xem ngay',
      },
      {
        action: 'dismiss',
        title: 'Đóng',
      },
    ],
  });

  event.waitUntil(Promise.all([showNotificationPromise, notifyOpenClients]));
});

// Notification Click Handler (Q4): Auto-switch active PWA context and navigate to target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data || {};
  const channel = data.notification_channel === 'TEACHER' ? 'TEACHER' : 'PARENT';
  const targetUrl = data.target_url || (channel === 'TEACHER' ? '/teacher' : '/parent');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          client.postMessage({
            type: 'SWITCH_ROLE_AND_FOCUS',
            notification_channel: channel,
            target_url: targetUrl,
            student_id: data.student_id || null,
            class_id: data.class_id || null,
          });
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl).catch(() => {});
          }
          if ('focus' in client) {
            return client.focus();
          }
        } catch (_) {
          // Continue looking for usable window client
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

