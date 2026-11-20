// Service Worker - Mầm Non Sương Mai PWA (Root Scope: /)
// Tối ưu hóa toàn diện hiệu năng tải trang với chiến lược Stale-While-Revalidate
const CACHE_NAME = 'suongmai-pwa-v19';
const DATA_CACHE_NAME = 'suongmai-data-v1';
const CURRENT_CACHES = [CACHE_NAME, DATA_CACHE_NAME];

const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/images/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/badge.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/sounds/SM1.wav',
  '/sounds/SM2.wav',
  '/sounds/SM3.wav',
  '/sounds/notification-ting.mp3',
  '/sounds/acb-zalo-ting.mp3',
  '/sounds/notification.mp3'
];

// Helper: Stale-While-Revalidate (SWR) Caching Strategy
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) => {
    return cache.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      // Trả về bản cache ngay lập tức nếu có (0ms), fetch ngầm để làm mới
      return cachedResponse || fetchPromise;
    });
  });
}

// Helper: Cache-First Strategy cho tài nguyên tĩnh bất biến
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) => {
    return cache.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      });
    });
  });
}

// Install Event - Precache audio assets & core shell immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Đảm bảo cache các file âm thanh và asset cốt lõi, không để 1 asset lỗi làm hỏng toàn bộ SW install
      await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW Install] Precache item failed:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (!CURRENT_CACHES.includes(cache)) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Lắng nghe tín hiệu cập nhật tức thì từ Client
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// Fetch Event - Tối ưu hóa Stale-While-Revalidate, Strict Auth & Next.js RSC Bypass
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Tuyệt đối không can thiệp các luồng xác thực, PKCE và Supabase Auth
  if (
    url.pathname === '/' ||
    url.pathname === '/login' ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api/auth') ||
    url.origin.includes('supabase.co') ||
    url.searchParams.has('code') ||
    url.searchParams.has('state')
  ) {
    return;
  }

  // 1b. CỰC KỲ QUAN TRỌNG: Bỏ qua 100% các request Next.js App Router RSC prefetch / subrequests
  // Khi người dùng di chuyển chuột (hover) qua các thẻ Link, Next.js gửi prefetch request.
  // Tuyệt đối không can thiệp để tránh Next.js nhận nhầm HTML dẫn đến hard reload toàn trang (window.location.reload)!
  if (
    event.request.headers.get('rsc') ||
    event.request.headers.get('next-router-prefetch') ||
    event.request.headers.get('next-router-state-tree') ||
    event.request.headers.get('next-url') ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // 2. Tài nguyên tĩnh bất biến (_next/static, sounds, images, icons): Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // 3. Danh sách thông báo & dữ liệu PWA an toàn: Stale-While-Revalidate
  // Hiển thị ngay lập tức từ bộ nhớ đệm (0ms), đồng thời cập nhật dữ liệu mới ngầm
  if (
    url.pathname === '/api/announcements' ||
    url.pathname === '/api/pwa/announcements' ||
    url.pathname === '/api/notifications' ||
    url.pathname === '/api/teacher/classes'
  ) {
    event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE_NAME));
    return;
  }

  // 4. Các API Admin hoặc mutation khác: Network direct
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 5. Giao diện trang HTML PWA: Chỉ can thiệp khi là điều hướng cấp trình duyệt (Top-level Document Navigation)
  // Tuyệt đối không can thiệp các subresource request hoặc hover prefetch
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }
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
  const soundPath = payload.sound || '/sounds/SM1.wav';
  const soundUrl = new URL(soundPath, origin).href;
  const iconUrl = '/icon-192.png';
  const badgeUrl = '/badge.png';

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
              body: payload.body || 'Thông báo mới từ Mầm non Sương Mai',
              notification_channel: channel,
              target_url: targetUrl,
              entity_id: payload.entity_id || null,
              sound: soundUrl,
            },
          });
        } catch (_) {}
      }
    });

  // Hiển thị thông báo Native với sound property, rung haptic và silent: false
  // để đánh thức điện thoại và phát âm thanh chuông Ting chuẩn trên màn hình khóa (Android / Samsung One UI)
  const notificationTag = payload.tag || `suongmai-notification-v2-${payload.entity_id || Date.now()}`;

  console.log('[PUSH_TRACE][5-SW] Nhận Push Event:', {
    title,
    tag: notificationTag,
    sound: soundUrl,
    target_url: targetUrl,
  });

  const notificationOptions = {
    body: payload.body || 'Thông báo mới từ Mầm non Sương Mai',
    icon: iconUrl,
    badge: badgeUrl,
    sound: soundUrl,
    vibrate: [300, 100, 400, 100, 400],
    tag: notificationTag,
    renotify: true,
    silent: false,
    requireInteraction: true,
    timestamp: Date.now(),
    dir: 'auto',
    lang: 'vi',
    data: {
      notification_channel: channel,
      target_url: targetUrl,
      student_id: payload.student_id || null,
      class_id: payload.class_id || null,
      entity_type: payload.entity_type || 'announcement',
      entity_id: payload.entity_id || null,
      sound: soundUrl,
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
  };

  const showNotificationPromise = self.registration
    .showNotification(title, notificationOptions)
    .then(() => {
      console.log('[PUSH_TRACE][5-SW] Hiển thị Native Notification thành công:', notificationTag);
    })
    .catch((firstErr) => {
      console.warn('[PUSH_TRACE][5-SW] Primary showNotification failed, trying simplified options:', firstErr);
      return self.registration.showNotification(title, {
        body: payload.body || 'Thông báo mới từ Mầm non Sương Mai',
        icon: iconUrl,
        badge: badgeUrl,
        sound: soundPath,
        vibrate: [300, 100, 400, 100, 400],
        tag: notificationTag,
        renotify: true,
        silent: false,
        requireInteraction: true,
        data: {
          target_url: targetUrl,
          sound: soundUrl,
        },
      }).then(() => {
        console.log('[PUSH_TRACE][5-SW] Hiển thị Native Notification dự phòng thành công:', notificationTag);
      }).catch((fallbackErr) => {
        console.error('[PUSH_TRACE][5-SW] Hiển thị Native Notification dự phòng thất bại:', fallbackErr);
      });
    });

  event.waitUntil(Promise.allSettled([showNotificationPromise, notifyOpenClients]));
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

