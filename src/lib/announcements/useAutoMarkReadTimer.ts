// ==============================================================================
// src/lib/announcements/useAutoMarkReadTimer.ts
// Hook Tự động Ghi nhận Đã đọc sau 3 Giây Xem Thực tế (FR-02)
// Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';

export interface UseAutoMarkReadTimerOptions {
  announcementId?: string | null;
  isRead?: boolean;
  portalRole: 'PARENT' | 'TEACHER';
  onMarkRead?: (id: string) => void;
  /** Thời gian xem liên tục yêu cầu (mặc định 3000ms = 3 giây) */
  delayMs?: number;
}

/**
 * Tự động ghi nhận lượt đọc sau 3 giây xem thực tế trên màn hình (Active Viewing)
 * - Đếm 3 giây liên tục khi document.visibilityState === 'visible'
 * - Hủy đếm nếu người dùng thoát xem, chuyển tab hoặc khóa màn hình trước 3 giây
 * - Đảm bảo tính nhất quán giữa user_id và role_context
 * - Giảm số lượng chưa đọc mà không bắt buộc bấm nút xác nhận
 */
export function useAutoMarkReadTimer({
  announcementId,
  isRead = false,
  portalRole,
  onMarkRead,
  delayMs = 3000,
}: UseAutoMarkReadTimerOptions) {
  const { mutate } = useSWRConfig();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const markedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const cleanId = String(announcementId || '').trim();
    if (!cleanId) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Nếu đã đọc từ trước hoặc đã được hook đánh dấu đọc trong phiên này, không chạy timer
    if (isRead || markedIdsRef.current.has(cleanId)) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const clearActiveTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const triggerMarkRead = async () => {
      if (markedIdsRef.current.has(cleanId)) return;
      markedIdsRef.current.add(cleanId);

      try {
        // Cập nhật giao diện cục bộ ngay lập tức
        onMarkRead?.(cleanId);

        // Đồng bộ SWR cache để chuông thông báo giảm số chưa đọc ngay
        await mutate(
          ['notifications-bell', portalRole],
          (prev: any) => {
            if (!prev?.announcements) return prev;
            const updated = prev.announcements.map((a: any) =>
              a.id === cleanId ? { ...a, is_read: true, read_at: new Date().toISOString() } : a
            );
            return {
              ...prev,
              announcements: updated,
              unread_count: Math.max(0, (prev.unread_count ?? updated.filter((x: any) => !x.is_read).length) - 1),
            };
          },
          { revalidate: false }
        );

        // Ghi nhận bền vững vào backend (cả POST [id]/read và PATCH /api/announcements)
        await Promise.allSettled([
          fetch(`/api/announcements/${cleanId}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ announcement_id: cleanId }),
          }),
          fetch('/api/announcements', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ announcement_id: cleanId }),
          }),
        ]);
      } catch (err) {
        console.warn('[useAutoMarkReadTimer] Ghi nhận đã đọc tự động lỗi:', err);
      }
    };

    const startTimerIfVisible = () => {
      clearActiveTimer();
      if (typeof document === 'undefined') return;

      // Chỉ kích hoạt khi màn hình hiển thị trực tiếp trước mắt người dùng
      if (document.visibilityState === 'visible' && !markedIdsRef.current.has(cleanId)) {
        timerRef.current = setTimeout(() => {
          void triggerMarkRead();
        }, delayMs);
      }
    };

    // Bắt đầu hẹn giờ 3 giây xem liên tục
    startTimerIfVisible();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startTimerIfVisible();
      } else {
        clearActiveTimer();
      }
    };

    const handleWindowBlur = () => {
      clearActiveTimer();
    };

    const handleWindowFocus = () => {
      startTimerIfVisible();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
    }

    return () => {
      clearActiveTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      }
    };
  }, [announcementId, isRead, portalRole, delayMs, mutate, onMarkRead]);
}
