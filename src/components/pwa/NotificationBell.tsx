'use client';

// ==============================================================================
// src/components/pwa/NotificationBell.tsx
// Component Chuông Thông Báo (Notification Bell) & Quản lý Trạng Thái Đọc trên PWA
// Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronRight,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { MobilePortalRole, useActiveRole } from '@/components/auth/ActiveRoleContext';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';
import {
  playNotificationSound,
  setupAutoplayUnlock,
  unlockAudioContext,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  getChimedAnnouncementIds,
  recordChimedAnnouncementIds,
} from '@/lib/sound/notificationSound';

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  target_role: 'ALL' | 'TEACHER' | 'PARENT';
  notification_channel?: 'TEACHER' | 'PARENT';
  is_read?: boolean;
  is_urgent?: boolean;
  audio_url?: string | null;
  created_at: string;
  metadata?: {
    is_urgent?: boolean;
    has_audio?: boolean;
    has_poster?: boolean;
    template_id?: string;
    [key: string]: any;
  };
}

const DEFAULT_VAPID_PUBLIC_KEY =
  'BGqtFksDUgi_wUJpyr6T-9g-k_qePF26UFE9N5xqDH5XHKUBzVSDZKOoc2zTySiWPpzO9mkZrOHvMrTPFAv3kfg';

function arrayBuffersEqual(buf1: ArrayBuffer | null | undefined, buf2: Uint8Array): boolean {
  if (!buf1) return false;
  const u1 = new Uint8Array(buf1);
  if (u1.byteLength !== buf2.byteLength) return false;
  for (let i = 0; i < u1.byteLength; i++) {
    if (u1[i] !== buf2[i]) return false;
  }
  return true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface NotificationBellProps {
  portalRole: MobilePortalRole;
  className?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return { announcements: [], unread_count: 0 };
  return res.json();
};

const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return '';
  }
};

export function NotificationBell({ portalRole, className = '' }: NotificationBellProps) {
  const router = useRouter();
  const { activeRole, serverSyncedRole, profileId, email, waitForRoleSync, pushStatus, enableNotifications } = useActiveRole();
  const isAdmin = activeRole === 'SUPER_ADMIN' || activeRole === 'SCHOOL_ADMIN';
  const userIdentifier = profileId || email || 'default';
  const hasHydratedInitialListRef = useRef(false);
  const chimedIdsRef = useRef<Set<string>>(new Set());

  // Nạp danh sách ID đã từng phát chuông từ localStorage theo vai trò & tài khoản
  useEffect(() => {
    chimedIdsRef.current = getChimedAnnouncementIds(portalRole, userIdentifier);
  }, [portalRole, userIdentifier]);

  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isSoundActive, setIsSoundActive] = useState<boolean>(true);
  const [isTestingPush, setIsTestingPush] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [testPushMessage, setTestPushMessage] = useState<string>('');

  const handleTestPush = async (delaySeconds = 3) => {
    try {
      setIsTestingPush(true);
      setTestPushMessage(`Đang chuẩn bị chuông...`);
      unlockAudioContext();

      // 1. Kích hoạt và cấp quyền Web Push nếu chưa có
      await enableNotifications().catch(() => {});

      let directSub = null;
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          const metaRes = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null);
          const metaJson = metaRes && metaRes.ok ? await metaRes.json().catch(() => ({})) : {};
          const vapidKey =
            metaJson?.vapid_public_key ||
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
            DEFAULT_VAPID_PUBLIC_KEY;

          if (vapidKey) {
            const keyArray = urlBase64ToUint8Array(vapidKey);
            if (sub && sub.options?.applicationServerKey) {
              if (!arrayBuffersEqual(sub.options.applicationServerKey, keyArray)) {
                console.log('[PUSH_TRACE][1-SUBSCRIBE] [Bell] Key mismatch, đang hủy đăng ký cũ...');
                await sub.unsubscribe().catch(() => {});
                sub = null;
              }
            }
            if (!sub) {
              try {
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: keyArray as BufferSource,
                });
              } catch (subErr) {
                console.warn('[PUSH_TRACE][1-SUBSCRIBE] [Bell] subscribe retry sau khi reset:', subErr);
                const stale = await reg.pushManager.getSubscription().catch(() => null);
                if (stale) await stale.unsubscribe().catch(() => {});
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: keyArray as BufferSource,
                });
              }
            }
          }
          if (sub) {
            directSub = sub.toJSON();
          }
        } catch (subErr) {
          console.warn('[PUSH_TRACE][1-SUBSCRIBE] [Bell] getSubscription notice:', subErr);
        }
      }

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isIos = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);
      const platform = isIos ? 'ios' : isAndroid ? 'android' : 'desktop';

      setTestPushMessage(`Chuông sẽ reo sau ${delaySeconds}s. Hãy khóa màn hình ngay!`);

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          delay_ms: delaySeconds * 1000,
          subscription: directSub,
          platform,
        }),
      });

      const resJson = await res.json().catch(() => ({}));
      if (resJson?.success) {
        setTestPushMessage(`Đã gửi! Khóa màn hình để nghe chuông (${delaySeconds}s)...`);
      } else {
        setTestPushMessage(resJson?.error || 'Chưa gửi được chuông, thử lại');
      }
    } catch (_) {
      setTestPushMessage('Lỗi kết nối kiểm tra chuông');
    } finally {
      setTimeout(() => {
        setIsTestingPush(false);
        setTestPushMessage('');
      }, 7000);
    }
  };

  // Mở khóa chính sách Autoplay của trình duyệt khi tương tác & tải tùy chọn âm thanh
  useEffect(() => {
    setupAutoplayUnlock();
    setIsSoundActive(isNotificationSoundEnabled());
  }, []);

  // 1. Fetch danh sách thông báo và số lượng chưa đọc qua SWR
  const { data, mutate } = useSWR(
    ['notifications-bell', portalRole],
    () => fetcher('/api/announcements'),
    {
      revalidateOnMount: true,
      keepPreviousData: true,
      revalidateOnFocus: false,
      refreshInterval: 15000, // Tối ưu polling định kỳ mỗi 15s
    }
  );

  // Lắng nghe tín hiệu âm thanh thông báo đẩy từ Service Worker (Web Push)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        const soundUrl = event.data?.payload?.sound || '/sounds/SM1.wav';
        playNotificationSound(soundUrl);
        mutate();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [mutate]);

  const announcements: NotificationItem[] = useMemo(
    () => (Array.isArray(data?.announcements) ? data.announcements : []),
    [data]
  );

  const unreadCount: number = useMemo(() => {
    if (typeof data?.unread_count === 'number') {
      return data.unread_count;
    }
    return announcements.filter((a) => !a.is_read).length;
  }, [data, announcements]);

  // Kích hoạt tiếng Ting duy nhất cho thông báo THỰC SỰ MỚI
  // Tuyệt đối KHÔNG phát chuông khi vừa đăng nhập, vừa mở app hoặc khi revalidate dữ liệu cũ
  useEffect(() => {
    if (!data?.announcements || !Array.isArray(data.announcements)) return;
    const currentList = data.announcements as NotificationItem[];

    if (!hasHydratedInitialListRef.current) {
      // LẦN TẢI ĐẦU TIÊN (HOẶC VỪA ĐĂNG NHẬP / RE-FETCH BAN ĐẦU):
      // Ghi nhận toàn bộ thông báo hiện có vào chimedIdsRef và localStorage
      // KHÔNG phát chuông cho các thông báo cũ đã tồn tại trước đó!
      hasHydratedInitialListRef.current = true;
      const allCurrentIds = currentList.map((a) => a.id);
      allCurrentIds.forEach((id) => chimedIdsRef.current.add(id));
      recordChimedAnnouncementIds(allCurrentIds, portalRole, userIdentifier);
      return;
    }

    // CÁC LẦN CẬP NHẬT TIẾP THEO (POLLING HOẶC SWR REVALIDATE):
    // Chỉ phát chuông khi có thông báo THỰC SỰ MỚI:
    // 1. Chưa đọc (!item.is_read)
    // 2. Chưa từng phát chuông cho user/role này (!chimedIdsRef.current.has(item.id))
    const genuinelyNewUnread = currentList.filter(
      (item) => !item.is_read && !chimedIdsRef.current.has(item.id)
    );

    if (genuinelyNewUnread.length > 0) {
      const newIds = genuinelyNewUnread.map((a) => a.id);
      newIds.forEach((id) => chimedIdsRef.current.add(id));
      recordChimedAnnouncementIds(newIds, portalRole, userIdentifier);
      playNotificationSound('/sounds/SM1.wav');
    }
  }, [data, portalRole, userIdentifier]);

  // Sắp xếp: Tin chưa đọc lên trước, sau đó theo thời gian mới nhất
  const sortedNotifications = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.is_read !== b.is_read) {
        return a.is_read ? 1 : -1;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [announcements]);

  // 2. Đồng bộ thời gian thực (Real-time Sync) với Supabase WebSocket
  useRoleRealtimeSync({
    channelName: `notifications-bell-sync-${portalRole}`,
    enabled: true,
    debounceMs: 300,
    handlers: [
      {
        table: 'announcements',
        event: 'INSERT',
        onEvent: (payload: any) => {
          const record = payload?.new as NotificationItem | undefined;
          if (record?.id) {
            if (!chimedIdsRef.current.has(record.id)) {
              chimedIdsRef.current.add(record.id);
              recordChimedAnnouncementIds([record.id], portalRole, userIdentifier);
              playNotificationSound('/sounds/SM1.wav');
            }
          }
          mutate();
        },
      },
      {
        table: 'announcements',
        event: 'UPDATE',
        onEvent: () => {
          mutate();
        },
      },
      {
        table: 'announcements',
        event: 'DELETE',
        onEvent: () => {
          mutate();
        },
      },
      {
        table: 'announcement_reads',
        event: '*',
        onEvent: () => {
          mutate();
        },
      },
      {
        table: 'read_receipts',
        event: '*',
        onEvent: () => {
          mutate();
        },
      },
    ],
  });

  // 3. Đóng dropdown khi click bên ngoài hoặc bấm phím Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // 4. Xử lý khi bấm xem chi tiết thông báo
  const handleItemClick = (announcement: NotificationItem) => {
    // Đóng dropdown và chuyển hướng đến trang chi tiết thông báo.
    // Việc ghi nhận đã đọc sẽ do bộ đếm 3 giây xem thực tế (useAutoMarkReadTimer)
    // trên màn hình chi tiết thực thi khi người dùng xem liên tục >= 3s.
    setIsOpen(false);
    const detailUrl =
      portalRole === 'TEACHER'
        ? `/teacher/announcements?id=${encodeURIComponent(announcement.id)}`
        : `/parent/announcements?id=${encodeURIComponent(announcement.id)}`;
    router.push(detailUrl);
  };

  // 5. Xử lý Đánh dấu tất cả đã đọc
  const handleMarkAllRead = async () => {
    const unreadIds = announcements.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0 || isMarkingAll) return;

    try {
      setIsMarkingAll(true);
      // Cập nhật lạc quan
      await mutate(
        (prev: any) => {
          if (!prev?.announcements) return prev;
          const updated = prev.announcements.map((a: NotificationItem) => ({ ...a, is_read: true }));
          return {
            ...prev,
            announcements: updated,
            unread_count: 0,
          };
        },
        { revalidate: false }
      );

      await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement_ids: unreadIds }),
      });
    } catch (err) {
      console.warn('[NotificationBell] Mark all read warning:', err);
      mutate();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const portalAnnouncementsLink =
    portalRole === 'TEACHER' ? '/teacher/announcements' : '/parent/announcements';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* NÚT BIỂU TƯỢNG CHUÔNG (BELL ICON + UNREAD BADGE) */}
      <button
        type="button"
        onClick={() => {
          unlockAudioContext();
          setIsOpen((prev) => !prev);
        }}
        aria-label={`Thông báo ${unreadCount > 0 ? `(${unreadCount} chưa đọc)` : ''}`}
        aria-expanded={isOpen}
        className={`relative p-1.5 rounded-full transition-colors cursor-pointer select-none ${
          isOpen ? 'bg-white/30 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
        }`}
        title="Thông báo từ Nhà trường"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />

        {/* HUY HIỆU SỐ ĐỎ (UNREAD BADGE) */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[17px] h-[17px] flex items-center justify-center border-2 border-white/90 shadow-md animate-pulse leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* BACKDROP KHI MỞ TRÊN MÀN HÌNH DI ĐỘNG */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* KHUNG DANH SÁCH THU GỌN (NOTIFICATION DROPDOWN / DRAWER) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed top-12 right-2 sm:right-4 w-[calc(100vw-16px)] max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col max-h-[82vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
        >
          {/* HEADER KHUNG */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-red-100 text-[#D32F2F] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-tight">
                  Thông báo Nhà trường
                </h3>
                <p className="text-[10px] text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} tin chưa đọc` : 'Tất cả tin đã đọc'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Nút Bật/Tắt & Thử tiếng chuông thông báo (Ping) */}
              <button
                type="button"
                onClick={() => {
                  const nextState = !isSoundActive;
                  setIsSoundActive(nextState);
                  setNotificationSoundEnabled(nextState);
                  if (nextState) {
                    playNotificationSound();
                  }
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                  isSoundActive
                    ? 'text-emerald-700 hover:bg-emerald-50'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
                title={
                  isSoundActive
                    ? 'Đang bật âm thanh thông báo (Bấm để thử tiếng Ping / Tắt âm)'
                    : 'Đang tắt âm thanh thông báo (Bấm để bật)'
                }
                aria-label="Cài đặt âm thanh thông báo"
              >
                {isSoundActive ? (
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  className="px-2 py-1 text-[10px] font-bold text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Đánh dấu tất cả là đã đọc"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Đọc tất cả</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                aria-label="Đóng bảng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BANNER KÍCH HOẠT CHUÔNG BÁO MÀN HÌNH KHÓA */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Bell className="w-3.5 h-3.5 text-amber-700 shrink-0 animate-bounce" />
                <p className="text-[11px] font-medium text-amber-900 leading-tight truncate">
                  Bật chuông để nhận tin khi khóa màn hình
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  unlockAudioContext();
                  await enableNotifications();
                  playNotificationSound();
                }}
                className="px-2.5 py-1 bg-[#D32F2F] hover:bg-red-700 text-white text-[10px] font-bold rounded-md shrink-0 shadow-2xs transition cursor-pointer"
              >
                Bật ngay
              </button>
            </div>
          )}

          {/* DANH SÁCH THÔNG BÁO THU GỌN */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 overscroll-contain">
            {sortedNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600">Chưa có thông báo nào</p>
                <p className="text-[11px] text-slate-400">
                  Thông báo mới từ Ban Giám hiệu và giáo viên sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              sortedNotifications.slice(0, 15).map((ann) => {
                const isUnread = !ann.is_read;
                const isUrgent = Boolean(ann.is_urgent || ann.metadata?.is_urgent);
                const hasAudio = Boolean(ann.audio_url || ann.metadata?.audio_url || ann.metadata?.has_audio);

                return (
                  <div
                    key={ann.id}
                    onClick={() => handleItemClick(ann)}
                    className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 select-none ${
                      isUnread
                        ? 'bg-red-50/50 hover:bg-red-50/80 border-l-4 border-l-red-600'
                        : 'bg-white hover:bg-slate-50/90'
                    }`}
                  >
                    {/* Chấm tròn trạng thái */}
                    <div className="mt-1 shrink-0">
                      {isUnread ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 block shadow-xs ring-2 ring-red-200" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300 block" />
                      )}
                    </div>

                    {/* Nội dung thông báo */}
                    <div className="flex-1 min-w-0">
                      {/* Thẻ phụ trợ & Ngày tháng */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isUrgent && (
                            <span className="px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-extrabold rounded tracking-wide shadow-2xs">
                              KHẨN
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">
                            {ann.category || 'Thông báo'}
                          </span>
                          {hasAudio && (
                            <span className="px-1 py-0.2 bg-blue-100 text-blue-700 text-[9px] font-semibold rounded flex items-center gap-0.5">
                              <Volume2 className="w-2.5 h-2.5 text-blue-600" />
                              <span>Audio</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {formatTimeAgo(ann.created_at)}
                        </span>
                      </div>

                      {/* Tiêu đề */}
                      <h4
                        className={`text-xs leading-snug truncate line-clamp-1 mb-0.5 ${
                          isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                        }`}
                      >
                        {ann.title}
                      </h4>

                      {/* Trích dẫn nội dung */}
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {ann.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* FOOTER KHUNG */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-1.5 shrink-0">
            {isAdmin && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && (
              <button
                type="button"
                onClick={() => handleTestPush(3)}
                disabled={isTestingPush}
                className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 active:scale-[0.99] text-[#D32F2F] border border-red-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                title="Bấm nút này rồi khóa màn hình điện thoại trong 3 giây để kiểm tra chuông ting (Chỉ Quản trị viên)"
              >
                <BellRing className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="truncate">
                  {testPushMessage || (isTestingPush ? 'Đang gửi tín hiệu...' : 'Kiểm tra chuông khóa màn hình (sau 3s)')}
                </span>
              </button>
            )}
            <Link
              href={portalAnnouncementsLink}
              prefetch={false}
              onClick={() => setIsOpen(false)}
              className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Xem toàn bộ thông báo ({announcements.length})</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
