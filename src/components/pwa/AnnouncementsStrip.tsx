'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import { MobilePortalRole, useActiveRole } from '@/components/auth/ActiveRoleContext';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';
import { playNotificationSound } from '@/lib/sound/notificationSound';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  target_role: 'ALL' | 'TEACHER' | 'PARENT';
  notification_channel?: 'TEACHER' | 'PARENT';
  is_read?: boolean;
  is_urgent?: boolean;
  metadata?: {
    is_urgent?: boolean;
    has_audio?: boolean;
    has_poster?: boolean;
    template_id?: string;
    [key: string]: any;
  };
  created_at: string;
}

const announcementsFetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return { announcements: [], unread_count: 0 };
  return res.json();
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) {
      return `Hôm nay ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return '';
  }
};

/**
 * Role-scoped Announcements & Realtime Notification fallback strip.
 * Queries /api/announcements with SWR keyed by ['role', portalRole, 'announcements']
 * so Teacher and Parent reads/feeds stay completely isolated.
 */
export function AnnouncementsStrip({ portalRole }: { portalRole: MobilePortalRole }) {
  const { activeRole, serverSyncedRole, waitForRoleSync, pushStatus, enableNotifications } =
    useActiveRole();
  const [expanded, setExpanded] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const { data, mutate } = useSWR(
    activeRole === portalRole ? ['role', portalRole, 'announcements'] : null,
    async () => {
      const aligned = await waitForRoleSync(portalRole);
      if (!aligned) return { announcements: [], unread_count: 0 };
      return announcementsFetcher('/api/announcements');
    },
    { revalidateOnMount: true, keepPreviousData: true, revalidateOnFocus: true, refreshInterval: 15000 }
  );

  const announcements: AnnouncementItem[] = useMemo(
    () => (Array.isArray(data?.announcements) ? data.announcements : []),
    [data]
  );
  const unreadCount: number =
    typeof data?.unread_count === 'number'
      ? data.unread_count
      : announcements.filter((a) => !a.is_read).length;

  // Realtime + Browser Notification API fallback when VAPID is absent
  useEffect(() => {
    announcements.forEach((a) => seenIdsRef.current.add(a.id));
  }, [announcements]);

  useRoleRealtimeSync({
    channelName: `announcements-${portalRole}`,
    enabled: activeRole === portalRole && serverSyncedRole === portalRole,
    debounceMs: 0,
    handlers: [
      {
        table: 'announcements',
        event: 'INSERT',
        match: (payload) => {
          const record = payload?.new as AnnouncementItem | undefined;
          return Boolean(record && (record.target_role === 'ALL' || record.target_role === portalRole));
        },
        onEvent: (payload) => {
          const record = payload?.new as AnnouncementItem | undefined;
          if (!record) return;
          mutate();

          new Audio('/sounds/notification-ting.mp3')
            .play()
            .catch((e) => console.log('Audio autoplay blocked', e));
          playNotificationSound('/sounds/notification-ting.mp3');

          if (
            !seenIdsRef.current.has(record.id) &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            seenIdsRef.current.add(record.id);
            try {
              new Notification(record.title || 'Thông báo mới', {
                body: record.content || '',
                icon: '/icons/icon-192x192.png',
                tag: `suongmai-${portalRole.toLowerCase()}-${record.id}`,
              });
            } catch {
              // Ignore restricted notification contexts (e.g., iOS Safari non-PWA tab)
            }
          }
        },
      },
      {
        table: 'announcements',
        event: 'UPDATE',
        onEvent: () => {
          mutate();
        },
      },
    ],
  });

  const handleMarkRead = async (announcementId: string) => {
    try {
      await mutate(
        (prev: any) => {
          if (!prev?.announcements) return prev;
          const updated = prev.announcements.map((a: AnnouncementItem) =>
            a.id === announcementId ? { ...a, is_read: true } : a
          );
          return {
            ...prev,
            announcements: updated,
            unread_count: updated.filter((a: AnnouncementItem) => !a.is_read).length,
          };
        },
        { revalidate: false }
      );

      await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement_id: announcementId }),
      });
    } catch {
      mutate();
    }
  };

  // =========================================================================
  // PARENT PORTAL VIEW (FR-02: 375px PWA WIDGET)
  // =========================================================================
  const unreadUrgent = useMemo(
    () =>
      announcements.filter((a) => !a.is_read && Boolean(a.is_urgent || a.metadata?.is_urgent)),
    [announcements]
  );
  const unreadStandard = useMemo(
    () =>
      announcements.filter((a) => !a.is_read && !Boolean(a.is_urgent || a.metadata?.is_urgent)),
    [announcements]
  );
  const homeUnreadList = useMemo(() => {
    return [...unreadUrgent, ...unreadStandard];
  }, [unreadUrgent, unreadStandard]);

  if (portalRole === 'PARENT') {
    if (announcements.length === 0) {
      return null;
    }

    return (
      <section className="text-xs space-y-2">
        {/* Tiêu đề khối + Xem tất cả */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Thông báo từ Nhà trường
            </h2>
            {homeUnreadList.length > 0 && (
              <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                {homeUnreadList.length} mới
              </span>
            )}
          </div>
          <Link
            href="/parent/announcements"
            className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-0.5 transition"
          >
            <span>Xem tất cả ({announcements.length})</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Trạng thái 0 thông báo chưa đọc: Co thành 1 thanh thông thái tinh giản */}
        {homeUnreadList.length === 0 ? (
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-medium text-emerald-900 truncate">
                Đã xem hết thông báo mới từ Nhà trường
              </span>
            </div>
            <Link
              href="/parent/announcements"
              className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0 ml-2"
            >
              Xem lại ({announcements.length})
            </Link>
          </div>
        ) : homeUnreadList.length === 1 ? (
          /* Trạng thái 1 thông báo chưa đọc: Hiện 1 thẻ duy nhất */
          (() => {
            const item = homeUnreadList[0];
            const isUrgent = Boolean(item.is_urgent || item.metadata?.is_urgent);
            const hasAudio = Boolean(item.metadata?.has_audio !== false);

            return (
              <Link
                href={`/parent/announcements?id=${item.id}`}
                className={`block rounded-xl border p-3 shadow-2xs transition active:scale-[0.99] ${
                  isUrgent
                    ? 'bg-red-50/90 border-red-300 ring-1 ring-red-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isUrgent ? (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded shadow-2xs">
                        KHẨN
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold rounded">
                        {item.category || 'Thông báo'}
                      </span>
                    )}
                    {!isUrgent && (
                      <span className="px-1.5 py-0.2 bg-red-50 text-red-600 border border-red-200 text-[9px] font-bold rounded-full">
                        MỚI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    {hasAudio && (
                      <span className="inline-flex items-center gap-0.5 text-indigo-600 font-medium">
                        <Volume2 className="w-3 h-3 text-indigo-500 animate-pulse" />
                        <span>Audio</span>
                      </span>
                    )}
                    <span>•</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
                <p
                  className={`text-xs font-bold leading-snug line-clamp-2 ${
                    isUrgent ? 'text-red-950 font-extrabold' : 'text-slate-900'
                  }`}
                >
                  {item.title}
                </p>
              </Link>
            );
          })()
        ) : (
          /* Trạng thái 2+ thông báo chưa đọc: Vuốt ngang (Horizontal Swipe Carousel) */
          <div className="overflow-x-auto snap-x flex gap-2.5 pb-1 -mx-4 px-4 scrollbar-none">
            {homeUnreadList.map((item) => {
              const isUrgent = Boolean(item.is_urgent || item.metadata?.is_urgent);
              const hasAudio = Boolean(item.metadata?.has_audio !== false);

              return (
                <Link
                  key={item.id}
                  href={`/parent/announcements?id=${item.id}`}
                  className={`w-[86%] shrink-0 snap-start block rounded-xl border p-3 shadow-2xs transition active:scale-[0.99] ${
                    isUrgent
                      ? 'bg-red-50/90 border-red-300 ring-1 ring-red-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isUrgent ? (
                        <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded shadow-2xs">
                          KHẨN
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold rounded">
                          {item.category || 'Thông báo'}
                        </span>
                      )}
                      {!isUrgent && (
                        <span className="px-1.5 py-0.2 bg-red-50 text-red-600 border border-red-200 text-[9px] font-bold rounded-full">
                          MỚI
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      {hasAudio && (
                        <span className="inline-flex items-center gap-0.5 text-indigo-600 font-medium">
                          <Volume2 className="w-3 h-3 text-indigo-500 animate-pulse" />
                          <span>Audio</span>
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <p
                    className={`text-xs font-bold leading-snug line-clamp-2 ${
                      isUrgent ? 'text-red-950 font-extrabold' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // =========================================================================
  // TEACHER / DEFAULT STRIP VIEW
  // =========================================================================
  if (announcements.length === 0 && pushStatus !== 'default') {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden text-xs">
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1"
        >
          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 relative">
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#86EFAC] ring-2 ring-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800">Thông báo Ban Giám Hiệu</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {announcements[0]?.title || 'Chưa có thông báo mới từ nhà trường'}
            </p>
          </div>
          {announcements.length > 0 &&
            (expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            ))}
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/teacher/announcements"
            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-0.5 transition px-2 py-1 rounded-lg hover:bg-rose-50"
          >
            <span>Tất cả ({announcements.length})</span>
            <ChevronRight className="w-3 h-3" />
          </Link>

          {pushStatus === 'default' && (
            <button
              type="button"
              onClick={enableNotifications}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Bật thông báo
            </button>
          )}
        </div>
      </div>

      {expanded && announcements.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {announcements.map((item) => (
            <Link
              key={item.id}
              href={`/teacher/announcements?id=${item.id}`}
              className={`px-3.5 py-2.5 flex items-start justify-between gap-2.5 transition active:scale-[0.99] cursor-pointer ${
                item.is_read ? 'bg-white hover:bg-slate-50' : 'bg-red-50/50 hover:bg-red-50/80'
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  {!item.is_read ? (
                    <span className="px-1.5 py-0.2 bg-red-100 text-red-700 border border-red-200 text-[9px] font-bold rounded-full">
                      MỚI
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 text-[9px] font-medium rounded">
                      Đã đọc
                    </span>
                  )}
                  {item.category && (
                    <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold rounded">
                      {item.category}
                    </span>
                  )}
                  <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                  {item.content}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  {Boolean(item.metadata?.has_audio !== false) && (
                    <span className="inline-flex items-center gap-0.5 text-indigo-600 font-medium">
                      <Volume2 className="w-3 h-3 text-indigo-500" />
                      <span>Audio AI</span>
                    </span>
                  )}
                  <span>•</span>
                  <span>{new Date(item.created_at).toLocaleString('vi-VN')}</span>
                </div>
              </div>

              {!item.is_read && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMarkRead(item.id);
                  }}
                  className="px-2 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                  title="Đánh dấu đã xem"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Đã xem</span>
                </button>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
