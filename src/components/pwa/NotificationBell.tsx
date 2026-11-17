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
  Check,
  CheckCheck,
  ChevronRight,
  Sparkles,
  X,
  Volume2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { MobilePortalRole, useActiveRole } from '@/components/auth/ActiveRoleContext';
import { useRoleRealtimeSync } from '@/lib/hooks/useRoleRealtimeSync';

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
  const { activeRole, serverSyncedRole, waitForRoleSync } = useActiveRole();
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch danh sách thông báo và số lượng chưa đọc qua SWR
  const { data, mutate } = useSWR(
    ['notifications-bell', portalRole],
    () => fetcher('/api/announcements'),
    {
      revalidateOnMount: true,
      keepPreviousData: true,
      revalidateOnFocus: true,
      refreshInterval: 15000, // Tối ưu polling định kỳ mỗi 15s
    }
  );

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

  // Sắp xếp: Tin chưa đọc lên trước, sau đó theo thời gian mới nhất
  const sortedNotifications = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.is_read !== b.is_read) {
        return a.is_read ? 1 : -1;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [announcements]);

  // 2. Đồng bộ thời gian thực (Real-time Sync) với Supabase
  useRoleRealtimeSync({
    channelName: `notifications-bell-sync-${portalRole}`,
    enabled: true,
    debounceMs: 300,
    handlers: [
      {
        table: 'announcements',
        event: 'INSERT',
        onEvent: () => {
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
  const handleItemClick = async (announcement: NotificationItem) => {
    // Nếu chưa đọc, cập nhật lạc quan (Optimistic UI) và gọi API PATCH
    if (!announcement.is_read) {
      await mutate(
        (prev: any) => {
          if (!prev?.announcements) return prev;
          const updated = prev.announcements.map((a: NotificationItem) =>
            a.id === announcement.id ? { ...a, is_read: true } : a
          );
          return {
            ...prev,
            announcements: updated,
            unread_count: Math.max(0, (prev.unread_count ?? updated.filter((x: any) => !x.is_read).length) - 1),
          };
        },
        { revalidate: false }
      );

      try {
        await fetch('/api/announcements', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcement_id: announcement.id }),
        });
      } catch (err) {
        console.warn('[NotificationBell] Mark read warning:', err);
      }
    }

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
        onClick={() => setIsOpen((prev) => !prev)}
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
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <Link
              href={portalAnnouncementsLink}
              onClick={() => setIsOpen(false)}
              className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
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
