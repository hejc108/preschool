'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Info,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  Volume2,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  AnnouncementItem,
  EMBEDDED_BACKGROUNDS,
} from '@/lib/announcements/posterTemplates';
import { AnnouncementPosterCard } from '@/components/announcements/AnnouncementPosterCard';
import { AnnouncementAudioPlayer } from '@/components/announcements/AnnouncementAudioPlayer';
import { NotificationBell } from '@/components/pwa/NotificationBell';

function ParentAnnouncementsSkeleton() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col p-4 animate-pulse space-y-4">
      <div className="h-10 bg-slate-200 rounded-xl w-3/4" />
      <div className="h-8 bg-slate-200 rounded-lg w-full" />
      <div className="h-28 bg-slate-200 rounded-2xl w-full" />
      <div className="h-28 bg-slate-200 rounded-2xl w-full" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 animate-pulse">
      <div className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="w-20 h-5 bg-slate-200 rounded" />
        <div className="w-32 h-5 bg-slate-200 rounded" />
        <div className="w-14 h-5 bg-slate-200 rounded" />
      </div>
      <div className="h-14 bg-red-100/50 p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-red-200" />
        <div className="space-y-1.5 flex-1">
          <div className="w-3/4 h-3.5 bg-red-200 rounded" />
          <div className="w-1/2 h-2.5 bg-red-200/80 rounded" />
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="w-full max-w-[360px] mx-auto aspect-[3/4.3] bg-slate-200 rounded-2xl" />
      </div>
    </div>
  );
}

function ParentAnnouncementsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id');

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [detailAnnouncement, setDetailAnnouncement] = useState<AnnouncementItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'poster' | 'text'>('poster');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bottom action acknowledgment state
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});

  // Poster DOM Ref for PNG export
  const posterRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Fetch lightweight list of announcements (Stale-While-Revalidate UI hydration)
  const fetchAnnouncements = async () => {
    try {
      // 1. Phục hồi ngay lập tức từ bộ nhớ đệm cục bộ (0ms loading)
      if (typeof window !== 'undefined') {
        try {
          const cached = sessionStorage.getItem('suongmai_parent_announcements');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAnnouncements(parsed);
              setLoadingList(false);
            }
          }
        } catch (_) {}
      }

      let res = await fetch('/api/pwa/announcements');
      if (!res.ok) {
        res = await fetch('/api/announcements');
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.announcements)) {
          setAnnouncements(json.announcements);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('suongmai_parent_announcements', JSON.stringify(json.announcements));
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi tải thông báo:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // On-demand detail fetch when user opens a specific announcement
  useEffect(() => {
    if (!requestedId) {
      setDetailAnnouncement(null);
      return;
    }

    // Luôn mở mặc định ở chế độ Xem Poster (chuẩn hóa trải nghiệm thị giác di động)
    setActiveTab('poster');

    // Hiển thị ngay bản nháp từ danh sách nếu có (Fast Initial Render)
    const existing = announcements.find((a) => a.id === requestedId);
    if (existing) {
      setDetailAnnouncement(existing);
    }

    let isCancelled = false;
    const fetchDetail = async () => {
      try {
        if (!existing) setLoadingDetail(true);
        let item: any = null;

        // Ưu tiên gọi API chuyên dụng PWA Chi tiết Thông báo (/api/pwa/announcements/[id])
        try {
          const resPwa = await fetch(`/api/pwa/announcements/${requestedId}`, {
            cache: 'no-store',
          });
          if (resPwa.ok) {
            const jsonPwa = await resPwa.json();
            item = jsonPwa.announcement || jsonPwa;
          }
        } catch (_) {}

        // Fallback gọi /api/announcements?id=... nếu route dynamic gặp sự cố
        if (!item || !item.id) {
          const res = await fetch(`/api/announcements?id=${requestedId}`, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            item = json.announcement || json.announcements?.[0];
          }
        }

        if (item && !isCancelled) {
          setDetailAnnouncement(item);
          // Đồng bộ lại vào danh sách thông báo cục bộ
          setAnnouncements((prev) =>
            prev.map((a) => (a.id === item.id ? { ...a, ...item } : a))
          );
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết thông báo:', err);
      } finally {
        if (!isCancelled) setLoadingDetail(false);
      }
    };

    fetchDetail();
    return () => {
      isCancelled = true;
    };
  }, [requestedId]);

  // Current active announcement for detail view
  const currentAnnouncement = detailAnnouncement || (requestedId ? announcements.find((a) => a.id === requestedId) || null : null);

  // Automatic Read-Receipt khi người dùng xem thông báo trên PWA
  const hasMarkedReadRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const targetId = requestedId || currentAnnouncement?.id;
    if (!targetId) return;

    if (hasMarkedReadRef.current.has(targetId)) return;
    hasMarkedReadRef.current.add(targetId);

    // Kích hoạt ngay lập tức API POST /api/announcements/[id]/read và PATCH /api/announcements
    const recordRead = async () => {
      try {
        await fetch(`/api/announcements/${targetId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcement_id: targetId }),
        }).catch(() => {});

        await fetch('/api/announcements', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcement_id: targetId }),
        }).catch(() => {});

        // Cập nhật trạng thái hiển thị cục bộ mượt mà
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === targetId ? { ...a, is_read: true } : a))
        );
        if (detailAnnouncement && detailAnnouncement.id === targetId) {
          setDetailAnnouncement((prev) => (prev ? { ...prev, is_read: true } : null));
        }
      } catch (err) {
        console.error('Lỗi tự động ghi nhận đã đọc:', err);
      }
    };

    recordRead();
  }, [requestedId, currentAnnouncement?.id]);

  // Download Poster as PNG (Header icon button)
  const handleDownloadPosterPng = async () => {
    if (!posterRef.current || !currentAnnouncement) return;
    try {
      showToast('Đang xuất ảnh Poster PNG...');
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      const cleanSlug = currentAnnouncement.title
        .toLowerCase()
        .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/gi, '')
        .trim()
        .replace(/\s+/g, '-');
      link.download = `thong-bao-suong-mai-${cleanSlug || 'poster'}.png`;
      link.href = dataUrl;
      link.click();
      showToast('Đã tải ảnh Poster về điện thoại thành công!');
    } catch (err) {
      console.error('Lỗi xuất PNG:', err);
      showToast('Không thể xuất ảnh PNG. Vui lòng thử lại!');
    }
  };

  // Copy Text to Clipboard
  const handleCopyText = async () => {
    if (!currentAnnouncement) return;
    const meta = currentAnnouncement.metadata || {};
    const textToCopy = `TRƯỜNG MẦM NON SƯƠNG MAI\nTHÔNG BÁO: ${currentAnnouncement.title}\n\n${currentAnnouncement.content}\n${
      meta.time_value ? `\n• Thời gian: ${meta.time_value}` : ''
    }${meta.location_value ? `\n• Địa điểm: ${meta.location_value}` : ''}${
      meta.deadline_value ? `\n• Lưu ý: ${meta.deadline_value}` : ''
    }\n\nTrân trọng cảm ơn Quý Phụ huynh!\nHotline Nhà trường: 0262.352.1234`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast('Đã sao chép nội dung thông báo vào bộ nhớ đệm!');
    } catch (err) {
      showToast('Không thể sao chép văn bản.');
    }
  };

  // Handle Bottom Action Acknowledgment
  const handleAcknowledge = async () => {
    if (!currentAnnouncement) return;
    try {
      setAcknowledgedMap((prev) => ({ ...prev, [currentAnnouncement.id]: true }));
      await fetch(`/api/announcements/${currentAnnouncement.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
      await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement_id: currentAnnouncement.id }),
      });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === currentAnnouncement.id ? { ...a, is_read: true } : a))
      );
      showToast('Nhà trường đã ghi nhận xác nhận tham gia của Quý Phụ huynh!');
    } catch (err) {
      showToast('Lỗi khi gửi phản hồi.');
    }
  };

  // 3-Tier Filter & Sorting for List View
  const sortedAndFilteredList = useMemo(() => {
    return announcements
      .filter((item) => {
        const matchesSearch =
          searchQuery.trim() === '' ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.content.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (selectedFilter === 'UNREAD') return !item.is_read;
        if (selectedFilter === 'READ') return item.is_read;
        return true;
      })
      .sort((a, b) => {
        const aUrgent = Boolean(a.is_urgent || a.metadata?.is_urgent);
        const bUrgent = Boolean(b.is_urgent || b.metadata?.is_urgent);

        // Tier 1: Urgent unread at top
        if (!a.is_read && aUrgent && (b.is_read || !bUrgent)) return -1;
        if (!b.is_read && bUrgent && (a.is_read || !aUrgent)) return 1;

        // Tier 2: Standard unread in middle
        if (!a.is_read && b.is_read) return -1;
        if (a.is_read && !b.is_read) return 1;

        // Same tier: Newest first
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      });
  }, [announcements, searchQuery, selectedFilter]);

  const unreadCount = announcements.filter((a) => !a.is_read).length;
  const readCount = announcements.filter((a) => a.is_read).length;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 shadow-xl relative pb-safe">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg backdrop-blur-xs flex items-center space-x-2 border border-slate-700 max-w-[90%] text-center">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: MÀN HÌNH CHI TIẾT THÔNG BÁO (PARENT DETAIL VIEW - 375px)       */}
      {/* ===================================================================== */}
      {requestedId ? (
        loadingDetail && !currentAnnouncement ? (
          <DetailSkeleton />
        ) : currentAnnouncement ? (
          (() => {
            const ann = currentAnnouncement;
            const meta = ann.metadata || {};
            const isUrgent = Boolean(ann.is_urgent || meta.is_urgent);
            const tplId = meta.template_id || (ann as any).template_id || 'le-hoi';
            const customBg =
              meta.custom_bg_url ||
              (ann as any).custom_bg_url ||
              meta.background_url ||
              (ann as any).background_url ||
              null;
            const bgImage = customBg || EMBEDDED_BACKGROUNDS[tplId] || '';
            const isBgEnabled =
              meta.is_bg_enabled !== false && (ann as any).is_bg_enabled !== false;

            const timeVal =
              meta.time_value ||
              (ann as any).time_value ||
              meta.event_time ||
              (ann as any).event_time ||
              '';
            const locVal =
              meta.location_value ||
              (ann as any).location_value ||
              meta.location ||
              (ann as any).location ||
              '';
            const deadlineVal =
              meta.deadline_value ||
              (ann as any).deadline_value ||
              meta.note ||
              (ann as any).note ||
              '';
            const tableVal =
              meta.table_data ||
              (ann as any).table_data ||
              meta.table_rows ||
              (ann as any).table_rows ||
              null;
            const audienceVal =
              meta.audience || (ann as any).audience || 'Toàn trường';

            const cards = meta.cards_visibility || (ann as any).cards_visibility || {};
            const showTime = cards.time !== false && Boolean(timeVal);
            const showLoc = cards.location !== false && Boolean(locVal);
            const showTable = Boolean(cards.table || tableVal) && Boolean(tableVal);
            const showDeadline = cards.deadline !== false && Boolean(deadlineVal);
            const showSeal =
              cards.seal !== false &&
              (ann as any).show_seal !== false &&
              meta.show_seal !== false;

            // Check if this notice needs RSVP confirmation button
            const categoryLower = (ann.category || '').toLowerCase();
            const needsAcknowledge =
              isUrgent ||
              categoryLower.includes('giấy mời') ||
              categoryLower.includes('dã ngoại') ||
              categoryLower.includes('ngoại khóa') ||
              categoryLower.includes('khẩn') ||
              categoryLower.includes('cảnh báo') ||
              Boolean(meta.requires_acknowledgement);

            const isConfirmed = Boolean(acknowledgedMap[ann.id]);

            return (
              <div className="flex-1 flex flex-col bg-slate-50">
                {/* Thanh điều hướng Header nhỏ gọn (Tích hợp icon Download PNG góc trên) */}
                <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
                  <button
                    type="button"
                    onClick={() => router.push('/parent/announcements')}
                    className="p-1 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 transition flex items-center gap-1 shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-700">Quay lại</span>
                  </button>

                  <div className="flex items-center gap-1.5 max-w-[46%] truncate">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {ann.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <NotificationBell portalRole="PARENT" />
                    {/* Nút icon nhỏ Tải ảnh Poster PNG ở góc trên */}
                    <button
                      type="button"
                      onClick={handleDownloadPosterPng}
                      className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg transition active:scale-95"
                      title="Tải ảnh Poster (PNG)"
                      aria-label="Tải ảnh Poster"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {isUrgent ? (
                      <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded shadow-xs">
                        KHẨN
                      </span>
                    ) : ann.is_read ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold rounded-full">
                        Đã đọc
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded-full">
                        Mới
                      </span>
                    )}
                  </div>
                </header>

                {/* Bộ 2 Tab chuyển đổi: Xem Poster / Văn bản gốc */}
                <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('poster')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        activeTab === 'poster'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Xem Poster</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('text')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        activeTab === 'text'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Văn bản gốc</span>
                    </button>
                  </div>

                  {activeTab === 'text' && (
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-700" />
                      <span>Sao chép</span>
                    </button>
                  )}
                </div>

                {/* Nội dung chi tiết theo Tab */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* ================= TAB 1: XEM POSTER 6 TẦNG (SINGLE SOURCE OF TRUTH) ================= */}
                  <div
                    className={
                      activeTab === 'poster'
                        ? 'flex flex-col items-center w-full space-y-3'
                        : 'hidden'
                    }
                  >
                    {/* Thanh phát Audio AI (Audio Player Bar) ngay phía trên khối Poster */}
                    <AnnouncementAudioPlayer
                      audioUrl={(ann as any).audio_url || meta.audio_url}
                      voiceType={(ann as any).voice_type || meta.voice_type || meta.voice}
                    />

                    <AnnouncementPosterCard
                      ref={posterRef}
                      title={ann.title}
                      bodyText={ann.content}
                      templateId={tplId}
                      customBgUrl={customBg}
                      backgroundUrl={customBg}
                      isBgEnabled={isBgEnabled}
                      audience={audienceVal}
                      showTimeCard={showTime}
                      timeValue={timeVal}
                      eventTime={timeVal}
                      showLocCard={showLoc}
                      locValue={locVal}
                      location={locVal}
                      showTableCard={showTable}
                      tableData={tableVal}
                      tableRows={tableVal}
                      showDeadlineCard={showDeadline}
                      deadlineValue={deadlineVal}
                      note={deadlineVal}
                      showSealCard={showSeal}
                      showSeal={showSeal}
                      className="w-full max-w-[390px] mx-auto aspect-[3/4.25]"
                    />
                  </div>

                  {/* ================= TAB 2: VĂN BẢN GỐC ================= */}
                  <div
                    className={
                      activeTab === 'text'
                        ? 'bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4'
                        : 'hidden'
                    }
                  >
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                          {ann.category || 'Thông báo'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ann.created_at || '').toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h1 className="text-base font-bold text-slate-900 leading-snug">
                        {ann.title}
                      </h1>
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed text-slate-700 text-justify">
                      <p className="whitespace-pre-line">{ann.content}</p>
                    </div>

                    {/* Khối thông tin chi tiết */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                      {timeVal && (
                        <div className="flex items-start gap-2">
                          <CalendarClock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-900">Thời gian: </span>
                            <span className="text-slate-700 whitespace-pre-line">{timeVal}</span>
                          </div>
                        </div>
                      )}
                      {locVal && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-900">Địa điểm: </span>
                            <span className="text-slate-700">{locVal}</span>
                          </div>
                        </div>
                      )}
                      {deadlineVal && (
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-900">Lưu ý: </span>
                            <span className="text-slate-700">{deadlineVal}</span>
                          </div>
                        </div>
                      )}
                      {tableVal && (
                        <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                          <span className="font-bold text-slate-900 block">Bảng chi tiết:</span>
                          {tableVal.row1_label && (
                            <div className="flex justify-between py-0.5">
                              <span className="text-slate-600">{tableVal.row1_label}</span>
                              <span className="font-bold text-slate-900">
                                {tableVal.row1_amt}
                              </span>
                            </div>
                          )}
                          {tableVal.row2_label && (
                            <div className="flex justify-between py-0.5">
                              <span className="text-slate-600">{tableVal.row2_label}</span>
                              <span className="font-bold text-slate-900">
                                {tableVal.row2_amt}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Phạm vi nhận: {audienceVal}</span>
                      <span className="font-semibold text-slate-700">Ban Giám Hiệu Sương Mai</span>
                    </div>
                  </div>
                </div>

                {/* Nút xác nhận hành động cuối trang (Chỉ hiển thị cho thông báo cần phản hồi) */}
                {needsAcknowledge && (
                  <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 shadow-lg z-20">
                    {isConfirmed ? (
                      <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Phụ huynh đã gửi phản hồi xác nhận thành công</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAcknowledge}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {categoryLower.includes('giấy mời') || categoryLower.includes('dã ngoại')
                            ? 'Xác nhận tham gia & Đồng ý'
                            : 'Tôi đã đọc & Xác nhận thông tin này'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-bold text-slate-700">Không tìm thấy thông báo này</p>
            <Link
              href="/parent/announcements"
              prefetch={false}
              className="inline-block px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl"
            >
              Quay lại danh sách
            </Link>
          </div>
        )
      ) : (
        /* ===================================================================== */
        /* VIEW 1: DANH SÁCH THÔNG BÁO TỔNG QUAN (PARENT LIST VIEW - 375px)       */
        /* ===================================================================== */
        <div className="flex-1 flex flex-col">
          {/* Header Bar */}
          <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <Link
                href="/parent"
                prefetch={false}
                className="p-1 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </Link>
              <h1 className="text-sm font-bold text-slate-900">Thông báo từ Nhà trường</h1>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-xs rounded-full">
                  {unreadCount} chưa đọc
                </span>
              )}
              <NotificationBell portalRole="PARENT" />
            </div>
          </header>

          <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
            {/* Bộ lọc 3 Tab */}
            <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedFilter('ALL')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center ${
                  selectedFilter === 'ALL'
                    ? 'bg-red-50 text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({announcements.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('UNREAD')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center ${
                  selectedFilter === 'UNREAD'
                    ? 'bg-red-50 text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa đọc ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('READ')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition text-center ${
                  selectedFilter === 'READ'
                    ? 'bg-red-50 text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã đọc ({readCount})
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm tiêu đề, nội dung thông báo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs"
              />
            </div>

            {/* Danh sách thông báo */}
            {loadingList ? (
              <div className="space-y-3 pt-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white rounded-xl border border-slate-200 p-3.5 animate-pulse space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : sortedAndFilteredList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 my-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Không có thông báo phù hợp</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {selectedFilter === 'UNREAD'
                    ? 'Quý Phụ huynh đã đọc hết tất cả thông báo mới từ Nhà trường.'
                    : 'Không tìm thấy thông báo nào theo từ khóa tìm kiếm.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedAndFilteredList.map((item) => {
                  const isUrgent = Boolean(item.is_urgent || item.metadata?.is_urgent);
                  const isRead = Boolean(item.is_read);

                  return (
                    <Link
                      key={item.id}
                      href={`/parent/announcements?id=${item.id}`}
                      prefetch={false}
                      className={`block rounded-xl border p-3.5 shadow-2xs transition active:scale-[0.99] ${
                        !isRead && isUrgent
                          ? 'bg-red-50/95 border-red-300 ring-1 ring-red-200'
                          : !isRead
                          ? 'bg-white border-slate-200 hover:border-slate-300'
                          : 'bg-slate-50 border-slate-200/80 opacity-80'
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

                          {!isRead && !isUrgent && (
                            <span className="px-1.5 py-0.2 bg-red-50 text-red-600 border border-red-200 text-[9px] font-bold rounded-full">
                              MỚI
                            </span>
                          )}

                          {isRead && (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 text-[9px] font-medium rounded">
                              Đã đọc
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          {Boolean(item.metadata?.has_audio !== false) && (
                            <Volume2 className="w-3 h-3 text-indigo-500" />
                          )}
                          <span>
                            {new Date(item.created_at || '').toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>

                      <h3
                        className={`text-xs leading-snug line-clamp-2 ${
                          !isRead && isUrgent
                            ? 'font-extrabold text-red-950'
                            : !isRead
                            ? 'font-bold text-slate-900'
                            : 'font-normal text-slate-600'
                        }`}
                      >
                        {item.title}
                      </h3>

                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {item.content}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentAnnouncementsPage() {
  return (
    <Suspense fallback={<ParentAnnouncementsSkeleton />}>
      <ParentAnnouncementsInner />
    </Suspense>
  );
}
