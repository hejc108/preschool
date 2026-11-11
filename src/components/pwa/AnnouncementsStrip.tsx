'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Bell, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { MobilePortalRole, useActiveRole } from '@/components/auth/ActiveRoleContext';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  target_role: 'ALL' | 'TEACHER' | 'PARENT';
  notification_channel?: 'TEACHER' | 'PARENT';
  is_read?: boolean;
  created_at: string;
}

const announcementsFetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return { announcements: [], unread_count: 0 };
  return res.json();
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
    { revalidateOnMount: true, keepPreviousData: true, refreshInterval: 45000 }
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
              <span className="font-bold text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-bold">
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

      {expanded && announcements.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {announcements.map((item) => (
            <div
              key={item.id}
              className={`px-3.5 py-2.5 flex items-start justify-between gap-2 ${
                item.is_read ? 'bg-white' : 'bg-slate-50'
              }`}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  {!item.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86EFAC] shrink-0" />
                  )}
                  <p className="font-bold text-slate-800">{item.title}</p>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{item.content}</p>
                <span className="text-[10px] text-slate-400 font-mono block">
                  {new Date(item.created_at).toLocaleString('vi-VN')}
                </span>
              </div>

              {!item.is_read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(item.id)}
                  className="px-2 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Đã xem</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
