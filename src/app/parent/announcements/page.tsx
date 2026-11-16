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

  // Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch lightweight list of announcements from real Database
  const fetchAnnouncements = async () => {
    try {
      setLoadingList(true);
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.announcements)) {
          setAnnouncements(json.announcements);
        } else {
          setAnnouncements([]);
        }
      } else {
        setAnnouncements([]);
      }
    } catch (e) {
      console.error('Lỗi khi tải thông báo:', e);
      setAnnouncements([]);
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

    // Check if current list item already has full detail fields (e.g. time_value)
    const existing = announcements.find((a) => a.id === requestedId);
    if (existing && existing.metadata?.time_value !== undefined) {
      setDetailAnnouncement(existing);
      return;
    }

    let isCancelled = false;
    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await fetch(`/api/announcements?id=${requestedId}`);
        if (res.ok) {
          const json = await res.json();
          const item = json.announcement || json.announcements?.[0];
          if (item && !isCancelled) {
            setDetailAnnouncement(item);
            // Merge into local list state
            setAnnouncements((prev) =>
              prev.map((a) => (a.id === item.id ? { ...a, ...item } : a))
            );
          }
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

  // Clean Speech synthesis on unmount or announcement switch
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win?.speechSynthesis) {
      win.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setAudioProgress(0);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    }
    return () => {
      const w = typeof window !== 'undefined' ? (window as any) : null;
      if (w?.speechSynthesis) {
        w.speechSynthesis.cancel();
      }
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (_) {}
      }
    };
  }, [currentAnnouncement?.id]);

  // Automatic 2-second Read-Receipt
  useEffect(() => {
    if (!currentAnnouncement || currentAnnouncement.is_read) return;

    const timer = setTimeout(async () => {
      try {
        await fetch('/api/announcements', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcement_id: currentAnnouncement.id }),
        });

        // Update local state smoothly
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === currentAnnouncement.id ? { ...a, is_read: true } : a))
        );
        if (detailAnnouncement && detailAnnouncement.id === currentAnnouncement.id) {
          setDetailAnnouncement((prev) => (prev ? { ...prev, is_read: true } : null));
        }
      } catch (err) {
        console.error('Lỗi tự động ghi nhận đã đọc:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentAnnouncement?.id, currentAnnouncement?.is_read]);

  // Handle Web Speech Audio Playback
  const handleTogglePlayAudio = () => {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (!win || !win.speechSynthesis) {
      showToast('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    if (isPlayingAudio) {
      win.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      return;
    }

    if (!currentAnnouncement) return;

    win.speechSynthesis.cancel();

    const meta = currentAnnouncement.metadata || {};
    const spokenText = `${currentAnnouncement.title}. ${currentAnnouncement.content}. ${
      meta.time_value ? `Thời gian: ${meta.time_value}.` : ''
    } ${meta.location_value ? `Địa điểm: ${meta.location_value}.` : ''} ${
      meta.deadline_value ? `Lưu ý: ${meta.deadline_value}.` : ''
    } Trường Mầm non Sương Mai trân trọng thông báo đến Quý Phụ huynh.`;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'vi-VN';
    utterance.pitch = 1.25;
    utterance.rate = 1.0;

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      setAudioProgress(0);
      audioIntervalRef.current = setInterval(() => {
        setAudioProgress((prev) => (prev >= 100 ? 100 : prev + 4));
      }, 500);
    };

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setAudioProgress(100);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };

    win.speechSynthesis.speak(utterance);
  };

  // Replay Audio
  const handleReplayAudio = () => {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win?.speechSynthesis) {
      win.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setAudioProgress(0);
      setTimeout(() => {
        handleTogglePlayAudio();
      }, 150);
    }
  };

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
            const tplId = meta.template_id || 'le-hoi';
            const bgImage = meta.custom_bg_url || EMBEDDED_BACKGROUNDS[tplId] || '';
            const isBgEnabled = meta.is_bg_enabled !== false;

            const cards = meta.cards_visibility || {};
            const showTime = cards.time !== false && Boolean(meta.time_value);
            const showLoc = cards.location !== false && Boolean(meta.location_value);
            const showTable = Boolean(cards.table) && Boolean(meta.table_data);
            const showDeadline = cards.deadline !== false && Boolean(meta.deadline_value);
            const showSeal = cards.seal !== false;

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

                {/* Trình phát Audio AI trên cùng */}
                <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={handleTogglePlayAudio}
                        className="w-9 h-9 rounded-full bg-white text-red-600 flex items-center justify-center shadow-md active:scale-95 transition shrink-0"
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-4 h-4 fill-red-600" />
                        ) : (
                          <Play className="w-4 h-4 fill-red-600 ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-white/90" />
                          <span className="text-xs font-bold truncate">
                            {isPlayingAudio ? 'Đang phát qua loa máy...' : 'Nghe thông báo qua Audio AI'}
                          </span>
                        </div>
                        <p className="text-[10px] text-red-100 truncate mt-0.5">
                          Giọng đọc AI Sương Mai • Dành cho phụ huynh khi bận rộn
                        </p>
                      </div>
                    </div>

                    {isPlayingAudio && (
                      <button
                        type="button"
                        onClick={handleReplayAudio}
                        className="p-1.5 rounded-full hover:bg-white/20 text-white/90 transition shrink-0"
                        title="Phát lại từ đầu"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Thanh tiến trình Audio nhỏ */}
                  {isPlayingAudio && (
                    <div className="w-full bg-white/30 rounded-full h-1 mt-2.5 overflow-hidden">
                      <div
                        className="bg-white h-1 rounded-full transition-all duration-300"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                  )}
                </div>

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
                  {activeTab === 'poster' ? (
                    /* ================= TAB 1: XEM POSTER 6 TẦNG ================= */
                    <div className="flex flex-col items-center">
                      <div
                        ref={posterRef}
                        className={`w-full max-w-[360px] aspect-[3/4.3] rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between relative border-4 select-none bg-cover bg-center transition-all ${
                          isBgEnabled
                            ? 'border-white bg-white'
                            : 'border-red-200 bg-gradient-to-b from-white to-red-50/40'
                        }`}
                        style={
                          isBgEnabled && bgImage
                            ? { backgroundImage: `url('${bgImage}')` }
                            : undefined
                        }
                      >
                        {/* TẦNG 1: HEADER TRƯỜNG */}
                        <div className="bg-[#D32F2F]/95 backdrop-blur-xs text-white px-4 py-2 flex items-center justify-center space-x-2 relative z-10 shadow-md">
                          <div className="w-6 h-6 rounded-full bg-white text-[#D32F2F] font-extrabold text-[10px] flex items-center justify-center shadow-xs shrink-0">
                            SM
                          </div>
                          <div className="text-left">
                            <h4 className="text-[11px] font-extrabold tracking-wide uppercase leading-none">
                              Trường Mầm Non Sương Mai
                            </h4>
                            <p className="text-[8px] opacity-90 mt-0.5">
                              Krông Pắc, Đắk Lắk • 0262.352.1234
                            </p>
                          </div>
                        </div>

                        {/* VÙNG TRUNG TÂM POSTER */}
                        <div className="px-4 py-2 my-auto flex flex-col items-center text-center relative z-10 space-y-2">
                          {/* TẦNG 2: RUY BĂNG TIÊU ĐỀ NỔI BẬT CĂN GIỮA */}
                          <div
                            id="posterRibbonBox"
                            className={
                              isBgEnabled
                                ? 'text-white px-4 py-2 rounded-2xl border-2 border-[#FFCDD2] max-w-[94%] mx-auto transition-all text-center'
                                : 'bg-red-50 text-[#D32F2F] px-4 py-2 rounded-xl border border-red-200 max-w-[95%] mx-auto transition-all text-center shadow-xs'
                            }
                            style={
                              isBgEnabled
                                ? {
                                    background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.25)',
                                  }
                                : undefined
                            }
                          >
                            <h2
                              className={`text-sm font-extrabold leading-snug tracking-wide ${
                                isBgEnabled ? 'text-white drop-shadow-md' : 'text-[#D32F2F]'
                              }`}
                              style={{
                                fontFamily: '"Playfair Display", Georgia, serif',
                              }}
                            >
                              {ann.title}
                            </h2>
                          </div>

                          {/* TẦNG 3: KHỐI THẺ THÔNG TIN ĐỘNG */}
                          <div className="w-full space-y-1.5 text-left">
                            {showTime && (
                              <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs">
                                <CalendarClock className="w-3.5 h-3.5 text-[#D32F2F] shrink-0" />
                                <span className="text-[10.5px] font-bold text-slate-900 leading-tight">
                                  {meta.time_value}
                                </span>
                              </div>
                            )}

                            {showLoc && (
                              <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs">
                                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="text-[10.5px] font-bold text-slate-900 leading-tight">
                                  {meta.location_value}
                                </span>
                              </div>
                            )}

                            {showTable && meta.table_data && (
                              <div className="bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-emerald-200 shadow-xs text-[9.5px]">
                                {meta.table_data.row1_label && (
                                  <div className="flex justify-between py-0.5 border-b border-slate-100">
                                    <span className="text-slate-700 font-medium">
                                      {meta.table_data.row1_label}
                                    </span>
                                    <span className="font-extrabold text-slate-900">
                                      {meta.table_data.row1_amt}
                                    </span>
                                  </div>
                                )}
                                {meta.table_data.row2_label && (
                                  <div className="flex justify-between py-0.5">
                                    <span className="text-slate-700 font-medium">
                                      {meta.table_data.row2_label}
                                    </span>
                                    <span className="font-extrabold text-slate-900">
                                      {meta.table_data.row2_amt}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {showDeadline && (
                              <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-sky-200/80 shadow-xs">
                                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span className="text-[9.5px] font-semibold text-slate-800 leading-tight">
                                  {meta.deadline_value}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* TẦNG 4: LỜI NGỎ / VĂN BẢN (NỀN TRẮNG MỜ #posterBodyCard HIỂN THỊ RÕ CHỮ) */}
                          <div
                            id="posterBodyCard"
                            className="w-full bg-white/94 backdrop-blur-sm border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                          >
                            <p className="text-[10px] text-slate-800 font-medium leading-relaxed text-justify line-clamp-5">
                              {ann.content}
                            </p>
                          </div>
                        </div>

                        {/* TẦNG 5 & 6: PHẠM VI NHẬN & DẤU ĐỎ HIỆU TRƯỞNG */}
                        <div className="px-3.5 pb-2.5 pt-1 flex items-end justify-between relative z-10">
                          <span className="px-2 py-0.5 bg-white/90 backdrop-blur-xs rounded-md text-[8.5px] font-extrabold text-slate-800 shadow-xs border border-slate-200/80">
                            Gửi: <span>{meta.audience || 'Toàn trường'}</span>
                          </span>

                          {showSeal && (
                            <div className="flex items-center space-x-1.5 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-xl border border-red-200 shadow-xs">
                              <div className="text-right">
                                <p className="text-[7.5px] font-bold text-slate-700 uppercase leading-none">
                                  Hiệu Trưởng
                                </p>
                                <p
                                  className="text-[8.5px] italic text-red-700 font-bold leading-tight"
                                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                                >
                                  Vũ Thị Xuân
                                </p>
                              </div>
                              <div className="w-7 h-7 rounded-full border border-red-600 flex flex-col items-center justify-center text-red-600 font-extrabold text-[5px] leading-none transform -rotate-12 bg-red-50">
                                <span>SƯƠNG MAI</span>
                                <span className="mt-0.5">ĐÃ DUYỆT</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ================= TAB 2: VĂN BẢN GỐC ================= */
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
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
                        <p>{ann.content}</p>
                      </div>

                      {/* Khối thông tin chi tiết */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                        {meta.time_value && (
                          <div className="flex items-start gap-2">
                            <CalendarClock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Thời gian: </span>
                              <span className="text-slate-700">{meta.time_value}</span>
                            </div>
                          </div>
                        )}
                        {meta.location_value && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Địa điểm: </span>
                              <span className="text-slate-700">{meta.location_value}</span>
                            </div>
                          </div>
                        )}
                        {meta.deadline_value && (
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Lưu ý: </span>
                              <span className="text-slate-700">{meta.deadline_value}</span>
                            </div>
                          </div>
                        )}
                        {meta.table_data && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                            <span className="font-bold text-slate-900 block">Bảng chi tiết:</span>
                            {meta.table_data.row1_label && (
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-600">{meta.table_data.row1_label}</span>
                                <span className="font-bold text-slate-900">
                                  {meta.table_data.row1_amt}
                                </span>
                              </div>
                            )}
                            {meta.table_data.row2_label && (
                              <div className="flex justify-between py-0.5">
                                <span className="text-slate-600">{meta.table_data.row2_label}</span>
                                <span className="font-bold text-slate-900">
                                  {meta.table_data.row2_amt}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Phạm vi nhận: {meta.audience || 'Toàn trường'}</span>
                        <span className="font-semibold text-slate-700">Ban Giám Hiệu Sương Mai</span>
                      </div>
                    </div>
                  )}
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
                className="p-1 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </Link>
              <h1 className="text-sm font-bold text-slate-900">Thông báo từ Nhà trường</h1>
            </div>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-xs rounded-full">
                {unreadCount} chưa đọc
              </span>
            )}
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
