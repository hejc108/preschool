// ==============================================================================
// src/components/announcements/AnnouncementAudioPlayer.tsx
// Component Thanh phát Audio AI (Audio Player Bar) trên PWA Phụ huynh & Giáo viên
// Phát trực tiếp file âm thanh tổng hợp từ Database / Cloud Storage
// Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, AlertCircle } from 'lucide-react';
import { getVoiceOption } from '@/lib/announcements/ttsVoices';

export interface AnnouncementAudioPlayerProps {
  audioUrl?: string | null;
  voiceType?: string;
  className?: string;
}

export function AnnouncementAudioPlayer({
  audioUrl,
  voiceType,
  className = '',
}: AnnouncementAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isError, setIsError] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Chuẩn hóa tên giọng đọc theo danh mục AI đã cấu hình
  const voiceOption = getVoiceOption(voiceType || 'vn_north_female_teacher');
  const voiceName = voiceOption.label.split('(')[0].trim();

  // Khởi tạo và đồng bộ đối tượng Audio khi audioUrl thay đổi
  useEffect(() => {
    // Nếu không có URL hợp lệ, dọn dẹp và reset
    if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsError(false);
      return;
    }

    const audio = new Audio(audioUrl.trim());
    audioRef.current = audio;
    setIsError(false);
    setCurrentTime(0);
    setDuration(0);

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      if (!isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onError = () => {
      console.warn('[AnnouncementAudioPlayer] Lỗi tải file audio:', audioUrl);
      setIsError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Quy tắc: Nếu thông báo chưa có file audio trong Storage/Database thì ẩn hoàn toàn thanh này
  if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
    return null;
  }

  // Định dạng thời gian hiển thị phút:giây
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0 || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Xử lý Bật / Tạm dừng
  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isError) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Lỗi phát âm thanh:', err);
        setIsPlaying(false);
      });
    }
  };

  // Phát lại từ đầu
  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    audioRef.current.play().catch(() => setIsPlaying(false));
  };

  // Tua nhanh đến vị trí chạm trên thanh tiến trình
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = clickPercent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div
      className={`w-full max-w-[390px] mx-auto bg-gradient-to-r from-[#D32F2F] via-[#C62828] to-[#B71C1C] text-white rounded-2xl p-3 shadow-lg border border-red-300/30 flex flex-col space-y-2 select-none transition-all duration-200 ${className}`}
    >
      {/* HÀNG TRÊN: NÚT PLAY/PAUSE LỚN, TÊN GIỌNG ĐỌC & NÚT PHÁT LẠI */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Nút Play/Pause Lớn */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={isError}
            className={`w-11 h-11 rounded-full bg-white text-[#D32F2F] flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0 ${
              isError
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:bg-rose-50 hover:shadow-lg cursor-pointer'
            }`}
            aria-label={isPlaying ? 'Tạm dừng giọng đọc' : 'Phát giọng đọc thông báo'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-[#D32F2F] text-[#D32F2F]" />
            ) : (
              <Play className="w-5 h-5 fill-[#D32F2F] text-[#D32F2F] ml-0.5" />
            )}
          </button>

          {/* Tiêu đề giọng đọc AI */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-white/90 shrink-0" />
              <span className="text-xs font-extrabold truncate tracking-wide">
                {voiceName}
              </span>
            </div>
            <p className="text-[10px] text-red-100/90 truncate mt-0.5">
              {isError
                ? 'Không thể tải file âm thanh'
                : isPlaying
                ? 'Đang phát qua loa máy...'
                : 'Bấm Play để nghe giọng đọc AI & Nhạc nền'}
            </p>
          </div>
        </div>

        {/* Nút tua lại từ đầu */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleReplay}
            disabled={isError}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer active:scale-95"
            title="Phát lại từ đầu"
            aria-label="Phát lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* HÀNG DƯỚI: THANH THỜI GIAN CHẠY (PROGRESS BAR) */}
      <div className="space-y-1 pt-0.5">
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="relative w-full bg-black/25 hover:bg-black/35 rounded-full h-1.5 cursor-pointer overflow-hidden flex items-center transition"
          role="progressbar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-white h-full rounded-full transition-all duration-100 ease-linear shadow-xs"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-red-100/90 font-mono leading-none">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-1 text-[10px] text-amber-200 bg-black/20 px-2 py-0.5 rounded">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>Tệp âm thanh trên máy chủ chưa khả dụng.</span>
        </div>
      )}
    </div>
  );
}
