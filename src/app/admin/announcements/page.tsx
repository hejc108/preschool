'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  List,
  Lock,
  Mic,
  Palette,
  Play,
  Square,
  Plus,
  Save,
  Search,
  Smartphone,
  Sparkles,
  Upload,
  X,
  CalendarClock,
  MapPin,
  Info,
  BarChart2,
  CheckCircle2,
  Volume2,
  VolumeX,
  ChevronLeft,
  Trash2,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  User,
  Calendar,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  EMBEDDED_BACKGROUNDS,
  POSTER_TEMPLATES,
  PosterTemplate,
  AnnouncementItem,
  AnnouncementMetadata,
} from '@/lib/announcements/posterTemplates';
import { AnnouncementPosterCard } from '@/components/announcements/AnnouncementPosterCard';
import { AnnouncementAudioPlayer } from '@/components/announcements/AnnouncementAudioPlayer';
import {
  TtsRule,
  DEFAULT_TTS_RULES,
  normalizeVietnameseSpeech,
} from '@/lib/announcements/ttsDictionary';
import {
  TTS_VOICE_OPTIONS,
  TtsVoiceOption,
  BACKGROUND_MUSIC_OPTIONS,
  getVoiceOption,
} from '@/lib/announcements/ttsVoices';

const DEFAULT_AI_VOICE =
  TTS_VOICE_OPTIONS.find((v) => v.id === 'vn_male_announcer')?.label ||
  TTS_VOICE_OPTIONS[3]?.label ||
  'Giọng Nam Phát thanh viên / Thầy giáo (Trầm ấm, uy tín)';

export default function AnnouncementsStudioPage() {
  // View states: 'list' | 'studio' | 'pwa'
  const [currentView, setCurrentView] = useState<'list' | 'studio' | 'pwa'>('list');

  // Announcement list data
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  // Studio form states
  const [currentAnnouncementId, setCurrentAnnouncementId] = useState<string | null>(null);
  const [status, setStatus] = useState<'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED'>('DRAFT');
  const [category, setCategory] = useState<string>('Lễ hội');
  const [isBgEnabled, setIsBgEnabled] = useState<boolean>(true);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('le-hoi');
  const [customUploadedBgUrl, setCustomUploadedBgUrl] = useState<string | null>(null);

  // Content fields
  const [title, setTitle] = useState<string>('Lễ Hội Trăng Rằm & Vui Tết Trung Thu');
  const [audience, setAudience] = useState<string>('Toàn trường');
  const [bodyText, setBodyText] = useState<string>(
    'Trân trọng kính mời Quý Phụ huynh cùng các bé đến tham dự chương trình "Đêm Hội Trăng Rằm" với nhiều tiết mục múa lân, rước đèn ông sao và phá cỗ trông trăng đầy ý nghĩa.'
  );

  // Dynamic cards toggles & values
  const [showTimeCard, setShowTimeCard] = useState<boolean>(true);
  const [timeValue, setTimeValue] = useState<string>(
    '07:30 - Thứ Sáu, 20/11/2026\n(Tức ngày 12 tháng 10 năm Bính Ngọ âm lịch)'
  );
  const [isUrgent, setIsUrgent] = useState<boolean>(false);

  const [showLocCard, setShowLocCard] = useState<boolean>(true);
  const [locValue, setLocValue] = useState<string>('Sân khấu chính - Trường Mầm non Sương Mai');

  const [showTableCard, setShowTableCard] = useState<boolean>(false);
  const [row1Label, setRow1Label] = useState<string>('Học phí bán trú tháng 11');
  const [row1Amt, setRow1Amt] = useState<string>('1.250.000 đ');
  const [row2Label, setRow2Label] = useState<string>('Tiền ăn (22 ngày x 35.000đ)');
  const [row2Amt, setRow2Amt] = useState<string>('770.000 đ');

  const [showDeadlineCard, setShowDeadlineCard] = useState<boolean>(true);
  const [deadlineValue, setDeadlineValue] = useState<string>(
    'Trang phục lễ hội • Hỗ trợ BGH: 0262.352.1234'
  );

  const [showSealCard, setShowSealCard] = useState<boolean>(true);

  // Audio AI states
  const [selectedVoice, setSelectedVoice] = useState<string>(DEFAULT_AI_VOICE);
  const [selectedMusic, setSelectedMusic] = useState<string>(
    'Nhạc Lễ hội Thiếu nhi (Không bản quyền)'
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioSynced, setIsAudioSynced] = useState<boolean>(true);
  const router = useRouter();
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playingRowId, setPlayingRowId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const rowAudioRef = useRef<HTMLAudioElement | null>(null);

  // TTS Dictionary & Preview states
  const [ttsRules, setTtsRules] = useState<TtsRule[]>(DEFAULT_TTS_RULES);
  const [isTtsDictOpen, setIsTtsDictOpen] = useState<boolean>(false);
  const [isTtsPreviewOpen, setIsTtsPreviewOpen] = useState<boolean>(false);
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [newSpokenText, setNewSpokenText] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('ACRONYM');
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);

  // Mobile PWA view state: 'poster' | 'text'
  const [mobileMode, setMobileMode] = useState<'poster' | 'text'>('poster');

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>(
    'Khung nền thiệp mầm non phong cách hoạt hình 3D tươi sáng, ở giữa chừa khoảng trống màu kem nhạt để viết chữ, xung quanh có các bé mầm non vui đùa dưới ánh nắng mai và hoa lá.'
  );
  const [readReceiptModal, setReadReceiptModal] = useState<{
    open: boolean;
    title: string;
    readCount: string;
    unreadCount: string;
  }>({
    open: false,
    title: '',
    readCount: '',
    unreadCount: '',
  });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    title: string;
  }>({
    open: false,
    id: '',
    title: '',
  });
  const [isDeletingAnnouncement, setIsDeletingAnnouncement] = useState<boolean>(false);

  // Mobile Frame Preview modal state (Xem trước giao diện di động 375px)
  const [previewModalAnnouncement, setPreviewModalAnnouncement] = useState<AnnouncementItem | null>(null);
  const [previewActiveTab, setPreviewActiveTab] = useState<'poster' | 'text'>('poster');
  const [synthesizingRowId, setSynthesizingRowId] = useState<string | null>(null);

  const formatVietnameseDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadingBg, setIsUploadingBg] = useState<boolean>(false);

  // Poster DOM Ref for html-to-image
  const posterRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load announcements directly from real Database API (Stale-While-Revalidate UI hydration)
  const fetchAnnouncements = async () => {
    try {
      // 1. Phục hồi ngay lập tức từ bộ nhớ đệm (0ms loading cho BGH/Admin)
      if (typeof window !== 'undefined') {
        try {
          const cached = sessionStorage.getItem('suongmai_admin_announcements');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAnnouncements(parsed);
              setLoading(false);
            }
          }
        } catch (_) {}
      }

      const res = await fetch('/api/announcements?full=true');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.announcements)) {
          setAnnouncements(json.announcements);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('suongmai_admin_announcements', JSON.stringify(json.announcements));
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi tải thông báo:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch danh sách từ điển phát âm AI
  const fetchTtsRules = async () => {
    try {
      const res = await fetch('/api/announcements/tts-dictionary');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.rules)) {
          setTtsRules(json.rules);
        }
      }
    } catch (e) {
      console.warn('Không thể tải từ điển phát âm:', e);
    }
  };

  // Thêm quy tắc từ điển mới
  const handleAddRule = async () => {
    const kw = newKeyword.trim();
    const spk = newSpokenText.trim();
    if (!kw || !spk) {
      showToast('Vui lòng điền đủ từ/số trên thông báo và cách đọc thành tiếng.');
      return;
    }
    try {
      setIsSavingRule(true);
      const res = await fetch('/api/announcements/tts-dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          spoken_text: spk,
          category: newCategory,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã thêm quy tắc "${kw}" vào từ điển AI!`);
        setNewKeyword('');
        setNewSpokenText('');
        fetchTtsRules();
      } else {
        showToast(json.error || 'Lỗi khi lưu quy tắc.');
      }
    } catch (err: any) {
      showToast('Lỗi kết nối khi thêm quy tắc.');
    } finally {
      setIsSavingRule(false);
    }
  };

  // Xóa quy tắc khỏi từ điển
  const handleDeleteRule = async (rule: TtsRule) => {
    try {
      const param = rule.id ? `id=${rule.id}` : `keyword=${encodeURIComponent(rule.keyword)}`;
      const res = await fetch(`/api/announcements/tts-dictionary?${param}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã xóa "${rule.keyword}" khỏi từ điển.`);
        fetchTtsRules();
      } else {
        showToast(json.error || 'Lỗi khi xóa quy tắc.');
      }
    } catch (_) {
      showToast('Lỗi kết nối khi xóa quy tắc.');
    }
  };

  // Lấy văn bản lời đọc AI trước và sau khi chuẩn hóa
  const getCurrentSpokenSpeech = () => {
    const raw = `${title}. ${bodyText}. ${
      showTimeCard && timeValue ? `Thời gian: ${timeValue}.` : ''
    } ${showLocCard && locValue ? `Địa điểm: ${locValue}.` : ''} ${
      showDeadlineCard && deadlineValue ? `Lưu ý: ${deadlineValue}.` : ''
    } Trường Mầm non Sương Mai trân trọng thông báo.`;

    const normalized = normalizeVietnameseSpeech(raw, ttsRules);
    return { raw, normalized };
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchTtsRules();

    // Tự động làm mới danh sách và số lượng phụ huynh đã đọc định kỳ 15 giây khi tab đang mở
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchAnnouncements();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (_) {}
      }
    };
  }, []);

  // Filter announcements
  const filteredList = announcements.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'PUBLISHED') return item.status === 'PUBLISHED';
    if (selectedFilter === 'PENDING_APPROVAL') return item.status === 'PENDING_APPROVAL';
    if (selectedFilter === 'DRAFT') return item.status === 'DRAFT';
    return true;
  });

  // Bug 2: Apply all template presets (Title, Body, Audience, Time, Location, Deadline, Table)
  const applyTemplate = (tpl: PosterTemplate) => {
    setCurrentTemplateId(tpl.id);
    setCustomUploadedBgUrl(null);
    setIsBgEnabled(true);
    setCategory(tpl.name);
    setTitle(tpl.defaultTitle);
    setBodyText(tpl.defaultBody);
    // Bảo vệ phạm vi gửi: Giữ "Toàn trường" khi người dùng đã chọn hoặc mặc định là Toàn trường
    if (audience === 'Toàn trường' || !tpl.defaultAudience) {
      setAudience('Toàn trường');
    } else {
      setAudience(tpl.defaultAudience);
    }
    if (tpl.defaultTime) setTimeValue(tpl.defaultTime);
    if (tpl.defaultLocation) setLocValue(tpl.defaultLocation);
    if (tpl.defaultDeadline) setDeadlineValue(tpl.defaultDeadline);
    setShowTableCard(Boolean(tpl.showTable));
    if (tpl.defaultTable) {
      if (tpl.defaultTable.row1Label) setRow1Label(tpl.defaultTable.row1Label);
      if (tpl.defaultTable.row1Amt) setRow1Amt(tpl.defaultTable.row1Amt);
      if (tpl.defaultTable.row2Label) setRow2Label(tpl.defaultTable.row2Label);
      if (tpl.defaultTable.row2Amt) setRow2Amt(tpl.defaultTable.row2Amt);
    }
    setIsAudioSynced(false);
    setAudioUrl(null);
    const isUrgentTemplate =
      tpl.id === 'khan-cap' ||
      tpl.id === 'nghi-le' ||
      tpl.name.toLowerCase().includes('khẩn') ||
      tpl.name.toLowerCase().includes('lịch học') ||
      tpl.defaultTitle.toLowerCase().includes('khẩn');
    setIsUrgent(isUrgentTemplate);
    showToast(`Đã đồng bộ mẫu "${tpl.name}" kèm dữ liệu 3 thẻ thông tin!`);
  };

  // Hàm xử lý Bật / Tắt ảnh nền Poster (Hotfix: bảo toàn trạng thái ảnh nền hiện tại)
  const togglePosterBackground = (isChecked: boolean) => {
    setIsBgEnabled(isChecked);
    if (isChecked) {
      // Khi bật lại: Khôi phục ảnh nền từ mẫu đang chọn hoặc ảnh tải lên gần nhất
      // Tuyệt đối không xóa hoặc gán rỗng customUploadedBgUrl hoặc currentTemplateId
      if (!currentTemplateId) {
        setCurrentTemplateId('le-hoi');
      }
      showToast('Đã bật ảnh nền đồ họa Poster!');
    } else {
      // Khi tắt: Chuyển sang nền trắng chuẩn hành chính, giữ nguyên biến lưu trạng thái ảnh nền
      showToast('Đã tắt ảnh nền Poster — Chuyển sang nền trắng chuẩn hành chính.');
    }
  };

  // Switch to Studio with specific template
  const openTemplateInStudio = (tplId: string) => {
    const tpl = POSTER_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setCurrentAnnouncementId(null);
    setStatus('DRAFT');
    setSelectedVoice(DEFAULT_AI_VOICE);
    applyTemplate(tpl);
    setCurrentView('studio');
  };

  // Open existing announcement in Studio
  const openAnnouncementInStudio = (ann: AnnouncementItem) => {
    setCurrentAnnouncementId(ann.id);
    setStatus((ann.status as any) || 'PUBLISHED');
    setCategory(ann.category || 'Lễ hội');
    setTitle(ann.title);
    setBodyText(ann.content);

    const meta = ann.metadata || {};
    setIsUrgent(Boolean(ann.is_urgent || meta.is_urgent));
    setIsBgEnabled(meta.is_bg_enabled !== false);
    setCurrentTemplateId(meta.template_id || 'le-hoi');
    setCustomUploadedBgUrl(meta.custom_bg_url || null);
    if (meta.audience) setAudience(meta.audience);

    const cards = meta.cards_visibility || {};
    setShowTimeCard(cards.time !== false);
    setShowLocCard(cards.location !== false);
    setShowTableCard(Boolean(cards.table));
    setShowDeadlineCard(cards.deadline !== false);
    setShowSealCard(cards.seal !== false);

    if (meta.time_value) setTimeValue(meta.time_value);
    if (meta.location_value) setLocValue(meta.location_value);
    if (meta.deadline_value) setDeadlineValue(meta.deadline_value);

    if (meta.table_data) {
      if (meta.table_data.row1_label) setRow1Label(meta.table_data.row1_label);
      if (meta.table_data.row1_amt) setRow1Amt(meta.table_data.row1_amt);
      if (meta.table_data.row2_label) setRow2Label(meta.table_data.row2_label);
      if (meta.table_data.row2_amt) setRow2Amt(meta.table_data.row2_amt);
    }

    const voiceVal = (ann as any).voice_type || meta.voice_type || meta.voice;
    if (voiceVal) setSelectedVoice(getVoiceOption(voiceVal).label);
    else setSelectedVoice(DEFAULT_AI_VOICE);
    const musicVal = (ann as any).background_music || meta.background_music || meta.music;
    if (musicVal) setSelectedMusic(musicVal);
    const audUrl = (ann as any).audio_url || meta.audio_url || null;
    setAudioUrl(audUrl);
    setIsAudioSynced(Boolean(audUrl));

    setCurrentView('studio');
  };

  // Real Database Cloning: immediately creates a new record in Database in DRAFT status
  const cloneAnnouncement = async (ann: AnnouncementItem) => {
    try {
      showToast('Đang nhân bản thông báo sang bản ghi mới trong CSDL...');
      const clonedTitle = `${ann.title} (Bản sao mới)`;
      const meta = ann.metadata || {};

      const metadataPayload: AnnouncementMetadata = {
        template_id: meta.template_id || 'le-hoi',
        is_bg_enabled: meta.is_bg_enabled !== false,
        custom_bg_url: meta.custom_bg_url || null,
        audience: meta.audience === 'Toàn trường (200 bé)' ? 'Toàn trường' : (meta.audience || 'Toàn trường'),
        cards_visibility: meta.cards_visibility || {
          time: true,
          location: true,
          table: false,
          deadline: true,
          seal: true,
        },
        time_value: meta.time_value || '',
        location_value: meta.location_value || '',
        deadline_value: meta.deadline_value || '',
        table_data: meta.table_data,
        voice: meta.voice || selectedVoice,
        music: meta.music || selectedMusic,
        audio_synced: false,
        has_poster: true,
        has_audio: true,
        is_urgent: Boolean(ann.is_urgent || meta.is_urgent),
      };

      const payload = {
        title: clonedTitle,
        content: ann.content,
        category: ann.category || 'Lễ hội',
        status: 'DRAFT',
        target_role: ann.target_role || 'ALL',
        metadata: metadataPayload,
      };

      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.announcement) {
        showToast('Đã nhân bản sang bản nháp mới trong CSDL thành công!');
        await fetchAnnouncements();
        openAnnouncementInStudio(json.announcement);
      } else {
        showToast(json.error || json.message || 'Không thể nhân bản vào CSDL. Vui lòng thử lại!');
      }
    } catch (err: any) {
      console.error('Lỗi nhân bản:', err);
      showToast('Lỗi kết nối khi nhân bản thông báo.');
    }
  };

  // Real Database Deletion (xóa cascade triệt để cả DB, khóa ngoại, file storage và local persistent store)
  const handleDeleteAnnouncement = async () => {
    const targetId = deleteModal.id;
    if (!targetId || isDeletingAnnouncement) return;
    try {
      setIsDeletingAnnouncement(true);
      showToast('Đang tiến hành xóa thông báo và dữ liệu liên quan khỏi cơ sở dữ liệu...');

      let res = await fetch(`/api/admin/announcements/${targetId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 404) {
        res = await fetch(`/api/announcements?id=${targetId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        // Chỉ khi máy chủ xác nhận xóa thành công 200/204 mới cập nhật lại giao diện
        setAnnouncements((prev) => prev.filter((a) => a.id !== targetId));
        setDeleteModal({ open: false, id: '', title: '' });
        showToast('Đã xóa thông báo khỏi cơ sở dữ liệu thành công!');
        if (currentAnnouncementId === targetId) {
          setCurrentAnnouncementId(null);
          setCurrentView('list');
        }
        await fetchAnnouncements();
        router.refresh();
      } else {
        const errorMsg =
          json.error || json.message || `Lỗi khi xóa thông báo khỏi cơ sở dữ liệu (Mã lỗi ${res.status}).`;
        showToast(errorMsg);
      }
    } catch (err: any) {
      console.error('Lỗi xóa:', err);
      showToast(err?.message ? `Lỗi kết nối: ${err.message}` : 'Lỗi kết nối máy chủ khi xóa thông báo.');
    } finally {
      setIsDeletingAnnouncement(false);
    }
  };

  // Seed sample data into real Database if table is currently empty
  const handleSeedSampleData = async () => {
    try {
      showToast('Đang khởi tạo dữ liệu mẫu Sương Mai vào cơ sở dữ liệu...');
      const samples = [
        {
          title: 'Giấy Mời Tham dự Lễ hội "Mừng Ngày Nhà Giáo Việt Nam"',
          content:
            'Trân trọng kính mời Quý Phụ huynh cùng các bé đến tham dự Lễ hội "Mừng Ngày Nhà Giáo Việt Nam 20/11" với nhiều tiết mục văn nghệ đặc sắc và hoạt động tri ân các thầy cô giáo đầy ý nghĩa.',
          category: 'Lễ hội',
          status: 'PUBLISHED',
          target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
          is_urgent: true,
          audio_url: '/audio/audio_20_11_suongmai.mp3',
          voice_type: 'vn_north_female_teacher',
          background_music: 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)',
          metadata: {
            template_id: 'le-hoi',
            is_bg_enabled: true,
            audience: 'Toàn trường',
            cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
            time_value: '08:00 Thứ Sáu, 20/11/2026',
            location_value: 'Sân khấu chính - Trường Mầm non Sương Mai',
            deadline_value: 'Trang phục lễ hội truyền thống • Hotline BGH: 0262.352.1234',
            read_count: 0,
            total_target_count: 170,
            is_urgent: true,
            voice_type: 'vn_north_female_teacher',
            audio_url: '/audio/audio_20_11_suongmai.mp3',
          },
        },
        {
          title: 'Thông báo thu học phí & tiền ăn tháng 11/2026',
          content:
            'Nhà trường gửi tới Quý Phụ huynh bảng kê chi tiết các khoản thu bán trú tháng 11. Phụ huynh vui lòng hoàn thành đúng thời hạn quy định.',
          category: 'Học phí',
          status: 'PUBLISHED',
          target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
          metadata: {
            template_id: 'hoc-phi',
            is_bg_enabled: true,
            audience: 'Toàn trường',
            cards_visibility: { time: true, location: false, table: true, deadline: true, seal: true },
            time_value: 'Hạn nộp: 10/11/2026',
            location_value: 'Văn phòng Kế toán Sương Mai',
            deadline_value: 'STK Vietcombank: 0231.000.1234 - Mầm non Sương Mai',
            table_data: {
              row1_label: 'Học phí bán trú tháng 11',
              row1_amt: '1.250.000 đ',
              row2_label: 'Tiền ăn (22 ngày x 35.000đ)',
              row2_amt: '770.000 đ',
            },
            read_count: 0,
            total_target_count: 170,
          },
        },
        {
          title: 'Giấy mời họp Phụ huynh đầu năm học 2026 - 2027',
          content:
            'Trân trọng kính mời Quý Phụ huynh đến tham dự buổi họp triển khai kế hoạch chăm sóc, nuôi dưỡng và giáo dục trẻ năm học mới tại lớp học của bé.',
          category: 'Giấy mời',
          status: 'PUBLISHED',
          target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
          metadata: {
            template_id: 'giay-moi',
            is_bg_enabled: true,
            audience: 'Toàn trường',
            cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
            time_value: '08:00 Thứ Bảy, 19/09/2026',
            location_value: 'Phòng học các lớp Khối Mầm - Chồi - Lá',
            deadline_value: 'Hotline nhà trường: 0262.352.1234',
            read_count: 0,
            total_target_count: 170,
          },
        },
        {
          title: 'Lịch khám sức khỏe định kỳ & đo chỉ số WHO đợt 1',
          content:
            'Bộ phận Y tế nhà trường phối hợp cùng Trạm Y tế khám tổng quát (Răng - Hàm - Mặt, Tai - Mũi - Họng, cân đo chỉ số WHO) cho 100% trẻ đang theo học.',
          category: 'Sức khỏe',
          status: 'PENDING_APPROVAL',
          target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
          metadata: {
            template_id: 'suc-khoe',
            is_bg_enabled: true,
            audience: 'Toàn trường',
            cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
            time_value: '07:30 - 11:00 Ngày 15/10/2026',
            location_value: 'Phòng Y tế Trường Mầm non Sương Mai',
            deadline_value: 'Phụ huynh cho bé đi học đầy đủ và đúng giờ',
            read_count: 0,
            total_target_count: 170,
          },
        },
        {
          title: 'Thông báo nghỉ lễ Quốc khánh & Lịch trực Ban Giám hiệu',
          content:
            'Nhà trường trân trọng thông báo lịch nghỉ lễ tới toàn thể Quý Phụ huynh. Kính chúc gia đình và các bé có kỳ nghỉ lễ thật vui vẻ, an toàn và ấm áp.',
          category: 'Nghỉ lễ',
          status: 'DRAFT',
          target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
          metadata: {
            template_id: 'nghi-le',
            is_bg_enabled: false,
            audience: 'Toàn trường',
            cards_visibility: { time: true, location: false, table: false, deadline: true, seal: true },
            time_value: 'Nghỉ từ 01/09 đến hết 03/09/2026',
            location_value: 'Trường Mầm non Sương Mai',
            deadline_value: 'Hotline trực trường: 0262.352.1234',
            read_count: 0,
            total_target_count: 170,
          },
        },
      ];

      for (const item of samples) {
        await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }

      showToast('Đã khởi tạo 5 thông báo mẫu chuẩn Sương Mai vào CSDL thành công!');
      await fetchAnnouncements();
    } catch (e) {
      console.error('Lỗi seed data:', e);
      showToast('Lỗi khi nạp dữ liệu mẫu vào CSDL.');
    }
  };

  // Real Storage Upload: uploads file to Supabase Storage and gets back a public URL
  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Chỉ chấp nhận các tệp định dạng hình ảnh (JPEG, PNG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Dung lượng ảnh vượt quá giới hạn 10MB.');
      return;
    }

    try {
      setIsUploadingBg(true);
      showToast('Đang tải ảnh lên kho lưu trữ Supabase Storage...');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/announcements/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setCustomUploadedBgUrl(data.url);
        setIsBgEnabled(true);
        showToast('Đã tải ảnh lên Supabase Storage và áp dụng vào Poster!');
      } else {
        showToast(data.error || 'Không thể lưu ảnh vào Storage. Vui lòng thử lại!');
      }
    } catch (err: any) {
      console.error('Lỗi upload ảnh:', err);
      showToast('Lỗi kết nối khi tải ảnh lên Storage.');
    } finally {
      setIsUploadingBg(false);
      e.target.value = '';
    }
  };

  // Gemini AI generation mock
  const runAiBgGeneration = () => {
    setIsAiModalOpen(false);
    showToast('AI Gemini đang tạo ảnh nền... Đã áp dụng mẫu minh họa tươi sáng!');
    const altId = currentTemplateId === 'giay-moi' ? 'hoat-dong' : 'giay-moi';
    const tpl = POSTER_TEMPLATES.find((t) => t.id === altId);
    if (tpl) {
      applyTemplate(tpl);
    }
  };

  // Save draft to real Database
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      showToast('Vui lòng nhập tiêu đề thông báo trước khi lưu.');
      return;
    }
    if (!bodyText.trim()) {
      showToast('Vui lòng nhập nội dung văn bản thông báo trước khi lưu.');
      return;
    }

    try {
      showToast('Đang lưu bản nháp vào cơ sở dữ liệu...');
      const metadataPayload: AnnouncementMetadata = {
        template_id: currentTemplateId,
        is_bg_enabled: isBgEnabled,
        custom_bg_url: customUploadedBgUrl,
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
        cards_visibility: {
          time: showTimeCard,
          location: showLocCard,
          table: showTableCard,
          deadline: showDeadlineCard,
          seal: showSealCard,
        },
        time_value: timeValue,
        location_value: locValue,
        deadline_value: deadlineValue,
        table_data: {
          row1_label: row1Label,
          row1_amt: row1Amt,
          row2_label: row2Label,
          row2_amt: row2Amt,
        },
        voice: selectedVoice,
        voice_type: getVoiceOption(selectedVoice).id,
        music: audioUrl ? selectedMusic : undefined,
        background_music: audioUrl ? selectedMusic : undefined,
        audio_url: audioUrl || null,
        audio_synced: isAudioSynced,
        has_poster: true,
        has_audio: Boolean(audioUrl),
        is_urgent: isUrgent,
      };

      const payload = {
        id: currentAnnouncementId || undefined,
        title: title.trim(),
        content: bodyText.trim(),
        category,
        status: 'DRAFT',
        target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
        audio_url: audioUrl || null,
        voice_type: getVoiceOption(selectedVoice).id,
        background_music: audioUrl ? selectedMusic : null,
        metadata: metadataPayload,
      };

      const method = currentAnnouncementId ? 'PUT' : 'POST';
      const res = await fetch('/api/announcements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        if (json.announcement?.id) {
          setCurrentAnnouncementId(json.announcement.id);
        }
        setStatus('DRAFT');
        showToast('Đã lưu bản nháp thông báo vào CSDL thành công!');
        await fetchAnnouncements();
      } else {
        const errorMsg = json.error || json.message || `Lỗi khi lưu bản nháp (Mã lỗi ${res.status})`;
        showToast(errorMsg);
      }
    } catch (err: any) {
      console.error('Lỗi lưu nháp:', err);
      showToast(err?.message ? `Lỗi kết nối: ${err.message}` : 'Lỗi kết nối khi lưu bản nháp.');
    }
  };

  // Approve & Publish to real Database
  const handleApproveAndPublish = async () => {
    if (!title.trim()) {
      showToast('Vui lòng nhập tiêu đề thông báo trước khi phát hành.');
      return;
    }
    if (!bodyText.trim()) {
      showToast('Vui lòng nhập nội dung văn bản thông báo trước khi phát hành.');
      return;
    }

    try {
      showToast('Đang chuẩn bị duyệt và phát hành thông báo...');
      let effectiveAudioUrl = audioUrl;

      // TỰ ĐỘNG TỔNG HỢP GIỌNG ĐỌC AI NẾU CHƯA CÓ TRƯỚC KHI PHÁT HÀNH
      if (!effectiveAudioUrl) {
        try {
          showToast('Đang tự động tạo giọng đọc AI cho thông báo trước khi phát hành...');
          const { normalized } = getCurrentSpokenSpeech();
          const voiceOption = getVoiceOption(selectedVoice);
          const ttsRes = await fetch('/api/announcements/tts-synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              announcement_id: currentAnnouncementId || undefined,
              text: normalized,
              voice_type: voiceOption.id,
              background_music: selectedMusic,
            }),
          });
          const ttsJson = await ttsRes.json().catch(() => ({}));
          if (ttsJson.success && ttsJson.audio_url) {
            effectiveAudioUrl = ttsJson.audio_url;
            setAudioUrl(effectiveAudioUrl);
            setIsAudioSynced(true);
          }
        } catch (ttsErr) {
          console.warn('[handleApproveAndPublish] Auto TTS notice:', ttsErr);
        }
      }

      const metadataPayload: AnnouncementMetadata = {
        template_id: currentTemplateId,
        is_bg_enabled: isBgEnabled,
        custom_bg_url: customUploadedBgUrl,
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
        cards_visibility: {
          time: showTimeCard,
          location: showLocCard,
          table: showTableCard,
          deadline: showDeadlineCard,
          seal: showSealCard,
        },
        time_value: timeValue,
        location_value: locValue,
        deadline_value: deadlineValue,
        table_data: {
          row1_label: row1Label,
          row1_amt: row1Amt,
          row2_label: row2Label,
          row2_amt: row2Amt,
        },
        voice: selectedVoice,
        voice_type: getVoiceOption(selectedVoice).id,
        music: effectiveAudioUrl ? selectedMusic : undefined,
        background_music: effectiveAudioUrl ? selectedMusic : undefined,
        audio_url: effectiveAudioUrl || null,
        audio_synced: Boolean(effectiveAudioUrl),
        has_poster: true,
        has_audio: Boolean(effectiveAudioUrl),
        is_urgent: isUrgent,
      };

      const payload = {
        id: currentAnnouncementId || undefined,
        title: title.trim(),
        content: bodyText.trim(),
        category,
        status: 'PUBLISHED',
        target_role: 'ALL',
        audience: audience || 'Toàn trường',
        scope: audience === 'Toàn trường' ? 'all' : audience,
        audio_url: effectiveAudioUrl || null,
        voice_type: getVoiceOption(selectedVoice).id,
        background_music: effectiveAudioUrl ? selectedMusic : null,
        metadata: metadataPayload,
      };

      const method = currentAnnouncementId ? 'PUT' : 'POST';
      const res = await fetch('/api/announcements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        if (json.announcement?.id) {
          setCurrentAnnouncementId(json.announcement.id);
        }
        setStatus('PUBLISHED');
        showToast('Hiệu trưởng đã duyệt & phát hành thông báo thành công!');
        await fetchAnnouncements();
        // Tự động chuyển về danh sách sau 1.2s để xem ngay thông báo vừa tạo
        setTimeout(() => {
          setCurrentView('list');
        }, 1200);
      } else {
        const errorMsg = json.error || json.message || `Lỗi khi duyệt & phát hành (Mã lỗi ${res.status})`;
        showToast(errorMsg);
      }
    } catch (err: any) {
      console.error('Lỗi phát hành:', err);
      showToast(err?.message ? `Lỗi kết nối: ${err.message}` : 'Lỗi kết nối khi phát hành.');
    }
  };

  // Export Poster to PNG using html-to-image
  const downloadPosterPng = async () => {
    if (!posterRef.current) return;
    try {
      showToast('Đang xuất ảnh Poster PNG độ phân giải cao...');
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2, // 2x high resolution for sharp prints / social sharing
      });
      const link = document.createElement('a');
      const cleanSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/gi, '')
        .trim()
        .replace(/\s+/g, '-');
      link.download = `thong-bao-suong-mai-${cleanSlug || 'poster'}.png`;
      link.href = dataUrl;
      link.click();
      showToast('Đã tải ảnh Poster PNG về máy thành công!');
    } catch (err) {
      console.error('Lỗi xuất ảnh PNG:', err);
      showToast('Có lỗi khi tạo ảnh PNG. Vui lòng thử lại!');
    }
  };

  const playSpeechSynthesisPreview = () => {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (!win?.speechSynthesis) {
      showToast('Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    win.speechSynthesis.cancel();
    const { normalized } = getCurrentSpokenSpeech();
    const utterance = new SpeechSynthesisUtterance(normalized);
    utterance.lang = 'vi-VN';

    const voiceOption = getVoiceOption(selectedVoice);
    utterance.pitch = voiceOption.pitch;
    utterance.rate = voiceOption.rate;

    const voices = win.speechSynthesis.getVoices();
    const viVoice = voices.find((v: any) => v.lang.includes('vi') || v.lang.includes('VN'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      showToast(`Đang phát thử giọng (${voiceOption.label.split('(')[0].trim()}) qua loa...`);
    };

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    // Play subtle ambient harmony if music is selected
    if (selectedMusic !== 'Không dùng nhạc nền') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(329.63, ctx.currentTime);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(440.0, ctx.currentTime);

          gain.gain.setValueAtTime(0.02, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 8);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 8);
          osc2.stop(ctx.currentTime + 8);
        }
      } catch (_) {}
    }

    win.speechSynthesis.speak(utterance);
  };

  // Real TTS Voice Synthesis: Web Speech API with real device audio playback
  const handleGenerateAiAudio = async (): Promise<string | null> => {
    try {
      setIsGeneratingAudio(true);
      showToast('Đang gọi API tổng hợp giọng đọc AI và tải lên lưu trữ nhà trường...');

      const { normalized } = getCurrentSpokenSpeech();
      const voiceOption = getVoiceOption(selectedVoice);

      const res = await fetch('/api/announcements/tts-synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_id: currentAnnouncementId || undefined,
          text: normalized,
          voice_type: voiceOption.id,
          background_music: selectedMusic,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.audio_url) {
        setAudioUrl(json.audio_url);
        setIsAudioSynced(true);
        showToast(`Đã tạo file âm thanh AI thành công (${voiceOption.label.split('(')[0].trim()})!`);
        return json.audio_url;
      } else {
        const errorMsg = json.error || 'Không thể lưu file âm thanh.';
        showToast(`Không thể tạo file âm thanh AI: ${errorMsg}`);
        return null;
      }
    } catch (e: any) {
      showToast(`Lỗi kết nối khi tạo âm thanh AI: ${e?.message || 'Vui lòng thử lại.'}`);
      return null;
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Tạo nhanh tệp giọng đọc AI trực tiếp từ dòng thông báo trên danh sách
  const handleQuickSynthesizeRowAudio = async (item: AnnouncementItem) => {
    try {
      setSynthesizingRowId(item.id);
      showToast(`Đang tổng hợp giọng đọc AI cho thông báo: "${item.title.slice(0, 30)}..."`);

      const res = await fetch('/api/announcements/tts-synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_id: item.id,
          text: `${item.title}. ${item.content || ''}`,
          voice_type: item.voice_type || item.metadata?.voice_type || 'vn_north_female_teacher',
          background_music: item.background_music || item.metadata?.background_music || 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)',
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.audio_url) {
        showToast('Đã tạo và đính kèm giọng đọc AI thành công!');
        await fetchAnnouncements();
      } else {
        showToast(`Không thể tạo âm thanh AI: ${json.error || 'Lỗi xử lý'}`);
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối: ${err?.message || 'Vui lòng thử lại'}`);
    } finally {
      setSynthesizingRowId(null);
    }
  };

  // Toggle Audio Playback through device speakers
  const handleTogglePlayAudio = () => {
    if (isPlayingAudio) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }
      const win = typeof window !== 'undefined' ? (window as any) : null;
      if (win?.speechSynthesis) win.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      showToast('Đã dừng phát âm thanh.');
      return;
    }

    // Nếu đã có file âm thanh từ Storage, phát file thật qua HTML5 Audio
    if (audioUrl) {
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio(audioUrl);
      } else {
        audioElementRef.current.src = audioUrl;
      }

      audioElementRef.current.onended = () => {
        setIsPlayingAudio(false);
      };
      audioElementRef.current.onerror = () => {
        setIsPlayingAudio(false);
        playSpeechSynthesisPreview();
      };

      audioElementRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
          showToast(`Đang phát file âm thanh AI (${selectedVoice.split('(')[0].trim()}) qua loa...`);
        })
        .catch(() => {
          playSpeechSynthesisPreview();
        });
      return;
    }

    // Nếu chưa tạo file Audio URL thì phát thử trực tiếp qua Web Speech API
    playSpeechSynthesisPreview();
  };

  // Nghe thử file âm thanh AI trực tiếp ngay trên danh sách thông báo
  const handlePreviewRowAudio = (item: AnnouncementItem) => {
    const url = item.audio_url || item.metadata?.audio_url;
    if (!url) {
      showToast('Thông báo này chưa có tệp âm thanh AI.');
      return;
    }

    if (playingRowId === item.id) {
      if (rowAudioRef.current) {
        rowAudioRef.current.pause();
        rowAudioRef.current.currentTime = 0;
      }
      setPlayingRowId(null);
      showToast('Đã dừng phát âm thanh.');
      return;
    }

    if (rowAudioRef.current) {
      rowAudioRef.current.pause();
    }

    const audio = new Audio(url);
    rowAudioRef.current = audio;
    setPlayingRowId(item.id);
    showToast(`Đang nghe thử Audio AI: "${item.title.slice(0, 32)}..."`);

    audio.onended = () => {
      setPlayingRowId(null);
    };
    audio.onerror = () => {
      setPlayingRowId(null);
      showToast('Không thể phát tệp âm thanh này.');
    };
    audio.play().catch(() => {
      setPlayingRowId(null);
      showToast('Trình duyệt chặn tự động phát. Vui lòng bấm lại.');
    });
  };

  // Open read receipt modal
  const handleOpenReadReceipt = (item: AnnouncementItem) => {
    const read = item.read_count ?? 0;
    const total = item.total_target_count ?? 170;
    const unread = Math.max(0, total - read);
    setReadReceiptModal({
      open: true,
      title: item.title,
      readCount: `${read} / ${total} bé`,
      unreadCount: `${unread} bé`,
    });
  };

  // Active Background URL
  const activeBgImage = customUploadedBgUrl || EMBEDDED_BACKGROUNDS[currentTemplateId] || '';
  const currentTemplate = POSTER_TEMPLATES.find((t) => t.id === currentTemplateId);

  return (
    <div className="bg-slate-100 text-slate-800 h-screen flex flex-col overflow-hidden font-sans">
      {/* ===================================================================== */}
      {/* TOP HEADER BAR (BUG 3: GỌN GÀNG 1 HÀNG, KHÔNG WRAP, ZERO REDUNDANCY)     */}
      {/* ===================================================================== */}
      <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center justify-between shrink-0 z-20 whitespace-nowrap">
        {/* Left: Logo & Title & Status */}
        <div className="flex items-center space-x-3 shrink-0">
          {currentView !== 'list' && (
            <button
              onClick={() => setCurrentView('list')}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition shrink-0"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-white p-0.5 border border-slate-200 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Logo Sương Mai"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-slate-900 text-sm leading-tight whitespace-nowrap">
                Quản lý Thông báo
              </h1>
              {currentView === 'studio' && (
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 ${
                    status === 'PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : status === 'PENDING_APPROVAL'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {status === 'PUBLISHED'
                    ? 'Đã phát hành'
                    : status === 'PENDING_APPROVAL'
                    ? 'Chờ duyệt'
                    : 'Bản nháp'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 whitespace-nowrap">
              Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Bug 3: Keep only 2 tabs in header, 375px moved to right column) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
          <button
            onClick={() => setCurrentView('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentView === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Danh sách thông báo</span>
          </button>
          <button
            onClick={() => setCurrentView('studio')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentView === 'studio'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Studio Thiết kế</span>
          </button>
        </div>

        {/* Header Action Buttons (1 Hàng gọn gàng, không tràn màn hình 1280px) */}
        <div className="flex items-center space-x-2 shrink-0">
          {currentView === 'list' && (
            <>
              <button
                onClick={fetchAnnouncements}
                title="Tải lại danh sách từ cơ sở dữ liệu"
                className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setCurrentAnnouncementId(null);
                  setStatus('DRAFT');
                  setSelectedVoice(DEFAULT_AI_VOICE);
                  const tpl = POSTER_TEMPLATES.find((t) => t.id === 'le-hoi') || POSTER_TEMPLATES[0];
                  applyTemplate(tpl);
                  setCurrentView('studio');
                }}
                className="px-3.5 py-1.5 bg-[#D32F2F] text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition shadow-sm flex items-center space-x-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo thông báo mới</span>
              </button>
            </>
          )}

          {currentView !== 'list' && (
            <>
              <button
                onClick={handleSaveDraft}
                className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition flex items-center space-x-1.5 whitespace-nowrap shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu nháp</span>
              </button>
              <button
                onClick={handleApproveAndPublish}
                disabled={status === 'PUBLISHED'}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm flex items-center space-x-1.5 whitespace-nowrap ${
                  status === 'PUBLISHED'
                    ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                    : 'bg-[#D32F2F] text-white hover:bg-red-700'
                }`}
              >
                {status === 'PUBLISHED' ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Đã phát hành (Khóa)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Duyệt & Phát hành</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* VIEW 1: DANH SÁCH THÔNG BÁO (1280px CLEAN TABLE - 5 CỘT)              */}
      {/* ===================================================================== */}
      {currentView === 'list' && (
        <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-5">
          {/* Bộ lọc và Tìm kiếm */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedFilter('ALL')}
                className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition ${
                  selectedFilter === 'ALL'
                    ? 'bg-red-50 text-[#D32F2F] border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả ({announcements.length})
              </button>
              <button
                onClick={() => setSelectedFilter('PUBLISHED')}
                className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition ${
                  selectedFilter === 'PUBLISHED'
                    ? 'bg-red-50 text-[#D32F2F] border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Đã phát hành ({announcements.filter((a) => a.status === 'PUBLISHED').length})
              </button>
              <button
                onClick={() => setSelectedFilter('PENDING_APPROVAL')}
                className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition ${
                  selectedFilter === 'PENDING_APPROVAL'
                    ? 'bg-red-50 text-[#D32F2F] border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Chờ duyệt ({announcements.filter((a) => a.status === 'PENDING_APPROVAL').length})
              </button>
              <button
                onClick={() => setSelectedFilter('DRAFT')}
                className={`px-3 py-1.5 font-semibold text-xs rounded-lg transition ${
                  selectedFilter === 'DRAFT'
                    ? 'bg-red-50 text-[#D32F2F] border border-red-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Bản nháp ({announcements.filter((a) => a.status === 'DRAFT').length})
              </button>
            </div>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm tiêu đề thông báo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#D32F2F]"
              />
            </div>
          </div>

          {/* Bảng danh sách thông báo chuẩn UI/UX 1280px (table-layout: fixed) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left border-collapse min-w-[1020px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 w-[35%] text-left whitespace-nowrap">TIÊU ĐỀ</th>
                    <th className="py-3 px-4 w-[10%] text-center whitespace-nowrap">PHÂN LOẠI</th>
                    <th className="py-3 px-4 w-[12%] text-left whitespace-nowrap">NGƯỜI TẠO</th>
                    <th className="py-3 px-4 w-[9%] text-center whitespace-nowrap">NGÀY TẠO</th>
                    <th className="py-3 px-4 w-[11%] text-center whitespace-nowrap">TRẠNG THÁI</th>
                    <th className="py-3 px-4 w-[10%] text-center whitespace-nowrap">ĐÃ ĐỌC</th>
                    <th className="py-3 px-4 w-[13%] text-right whitespace-nowrap">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                        <span>Đang tải danh sách thông báo từ cơ sở dữ liệu...</span>
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 space-y-3">
                        <p className="text-sm font-semibold">Chưa có thông báo nào trong cơ sở dữ liệu.</p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Bạn có thể khởi tạo ngay 5 thông báo mẫu chuẩn sư phạm Sương Mai (kèm thông báo Lễ hội 20/11) để sẵn sàng sử dụng.
                        </p>
                        <button
                          onClick={handleSeedSampleData}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg shadow-sm transition inline-flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Khởi tạo 5 thông báo mẫu Sương Mai vào CSDL</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => {
                      const readCount = item.read_count ?? 0;
                      const totalCount = item.total_target_count ?? 170;
                      const percent =
                        totalCount > 0 ? Math.min(100, Math.round((readCount / totalCount) * 100)) : 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          {/* Cột 1: Tiêu đề (35%, line-clamp-2, mượt mà) */}
                          <td className="py-3 px-4 align-middle">
                            <div className="flex flex-col gap-1">
                              <div
                                onClick={() => openAnnouncementInStudio(item)}
                                className="font-bold text-slate-900 text-xs sm:text-sm cursor-pointer hover:text-red-600 transition flex items-center gap-1.5"
                                title={item.title}
                              >
                                {Boolean(item.is_urgent || item.metadata?.is_urgent) && (
                                  <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded shadow-xs shrink-0 animate-pulse">
                                    KHẨN
                                  </span>
                                )}
                                <span className="line-clamp-2 leading-snug break-words">
                                  {item.title}
                                </span>
                              </div>
                              <div className="text-slate-500 text-[11px] flex items-center space-x-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="truncate max-w-[130px]">
                                  {(item.metadata?.audience || item.audience || 'Toàn trường')
                                    .replace(/\s*\(200\s*bé\)/gi, '')
                                    .trim() || 'Toàn trường'}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-700 font-medium shrink-0">Poster Đồ họa</span>
                                {item.audio_url || item.metadata?.audio_url ? (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePreviewRowAudio(item);
                                      }}
                                      className={`text-[10px] font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full transition cursor-pointer shrink-0 ${
                                        playingRowId === item.id
                                          ? 'bg-red-600 text-white animate-pulse'
                                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                                      }`}
                                      title={
                                        playingRowId === item.id
                                          ? 'Bấm để dừng phát'
                                          : 'Nghe thử trực tiếp tệp giọng đọc AI của thông báo này'
                                      }
                                    >
                                      <Volume2 className="w-3 h-3 text-current" />
                                      <span>{playingRowId === item.id ? 'Đang phát...' : 'Audio AI'}</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleQuickSynthesizeRowAudio(item);
                                      }}
                                      disabled={synthesizingRowId === item.id}
                                      className="text-[10px] font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer shrink-0 disabled:opacity-50"
                                      title="Bấm để tạo và gắn ngay tệp giọng đọc AI cho thông báo này"
                                    >
                                      <Mic className="w-3 h-3 text-amber-700" />
                                      <span>{synthesizingRowId === item.id ? 'Đang tạo Audio...' : '+ Tạo Audio AI'}</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Cột 2: Phân loại (10%, centered, nowrap) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                            <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-semibold rounded-md border border-amber-200">
                              {item.category || 'Thông báo'}
                            </span>
                          </td>

                          {/* Cột 3: Người tạo (12%, nowrap, truncated) */}
                          <td className="py-3 px-4 text-left whitespace-nowrap align-middle">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                <User className="w-3 h-3 text-slate-500" />
                              </div>
                              <span
                                className="font-medium text-slate-800 text-xs truncate"
                                title={item.created_by_name || 'Ban Giám Hiệu'}
                              >
                                {item.created_by_name || 'Ban Giám Hiệu'}
                              </span>
                            </div>
                          </td>

                          {/* Cột 4: Ngày tạo (9%, centered, font-mono, nowrap) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap text-slate-600 text-xs font-mono align-middle">
                            {formatVietnameseDate(item.created_at)}
                          </td>

                          {/* Cột 5: Trạng thái (11%, centered, nowrap) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                            {item.status === 'PUBLISHED' ? (
                              <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] rounded-full font-semibold border border-emerald-200">
                                Đã phát hành
                              </span>
                            ) : item.status === 'PENDING_APPROVAL' ? (
                              <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[11px] rounded-full font-semibold border border-blue-200">
                                Chờ duyệt
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[11px] rounded-full font-semibold border border-amber-200">
                                Bản nháp
                              </span>
                            )}
                          </td>

                          {/* Cột 6: Đã đọc (10%, centered, nowrap) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap align-middle">
                            {item.status === 'PUBLISHED' ? (
                              <div className="inline-flex flex-col items-center space-y-1">
                                <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700">
                                  {readCount}/{totalCount} bé
                                </span>
                              </div>
                            ) : item.status === 'PENDING_APPROVAL' ? (
                              <span className="text-slate-400 text-[11px] italic">Chưa phát hành</span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">—</span>
                            )}
                          </td>

                          {/* Cột 7: Thao tác (13%, right-aligned, nowrap, không tràn) */}
                          <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                            <div className="inline-flex items-center justify-end space-x-1">
                              {item.status === 'PUBLISHED' && (
                                <button
                                  onClick={() => handleOpenReadReceipt(item)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs transition inline-flex items-center space-x-1 cursor-pointer shrink-0"
                                  title="Xem thống kê phụ huynh đã đọc"
                                >
                                  <BarChart2 className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">Thống kê</span>
                                </button>
                              )}

                              {item.status === 'PENDING_APPROVAL' ? (
                                <button
                                  onClick={() => openAnnouncementInStudio(item)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-xs transition inline-flex items-center space-x-1 cursor-pointer shrink-0"
                                  title="Xem và phê duyệt thông báo"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Duyệt</span>
                                </button>
                              ) : item.status === 'DRAFT' ? (
                                <button
                                  onClick={() => openAnnouncementInStudio(item)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold text-xs transition inline-flex items-center space-x-1 cursor-pointer shrink-0"
                                  title="Chỉnh sửa tiếp bản nháp"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Sửa</span>
                                </button>
                              ) : null}

                              <button
                                onClick={() => {
                                  setPreviewModalAnnouncement(item);
                                  setPreviewActiveTab('poster');
                                }}
                                title="Xem trước trên khung di động (PWA 375px)"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer shrink-0"
                              >
                                <Smartphone className="w-4 h-4" />
                              </button>

                              {!(item.audio_url || item.metadata?.audio_url) && (
                                <button
                                  onClick={() => handleQuickSynthesizeRowAudio(item)}
                                  disabled={synthesizingRowId === item.id}
                                  title="Tạo và đính kèm ngay giọng đọc AI cho thông báo này"
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  <Mic className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => cloneAnnouncement(item)}
                                title="Nhân bản thông báo này"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer shrink-0"
                              >
                                <Copy className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() =>
                                  setDeleteModal({ open: true, id: item.id, title: item.title })
                                }
                                title="Xóa thông báo khỏi cơ sở dữ liệu"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: FULL-SCREEN 2-COLUMN STUDIO (60% TRÁI / 40% PHẢI)             */}
      {/* ===================================================================== */}
      {currentView === 'studio' && (
        <main className="flex-1 flex overflow-hidden">
          {/* CỘT TRÁI: 60% FORM CẤU HÌNH & KHO 11 MẪU NỀN */}
          <section className="w-7/12 border-r border-slate-200 bg-white flex flex-col overflow-y-auto p-6 space-y-6">
            {/* KHỐI 1: CƠ CHẾ BẬT/TẮT ẢNH NỀN POSTER & KHO 11 CHỦ ĐỀ */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="chkPosterBg"
                    checked={isBgEnabled}
                    onChange={(e) => togglePosterBackground(e.target.checked)}
                    className="w-4 h-4 accent-[#D32F2F] rounded cursor-pointer"
                  />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      1. Sử dụng Ảnh Nền Đồ Họa Poster (Bật / Tắt)
                    </h2>
                    <p id="bgToggleHint" className="text-[11px] text-slate-500">
                      {isBgEnabled
                        ? 'Đang bật: Chọn ảnh nền minh họa bên dưới hoặc dùng AI / tải ảnh riêng'
                        : 'Đang tắt: Thông báo hiển thị trên nền trắng trang trọng (không dùng ảnh minh họa)'}
                    </p>
                  </div>
                </label>
                <div
                  id="customUploadBox"
                  className={isBgEnabled ? 'flex items-center space-x-1.5' : 'hidden'}
                >
                  <label className="cursor-pointer px-2.5 py-1.5 bg-white border border-slate-300 text-[11px] font-semibold rounded-lg text-slate-700 hover:bg-slate-100 flex items-center space-x-1 shadow-xs">
                    {isUploadingBg ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span>{isUploadingBg ? 'Đang tải lên...' : 'Tải ảnh riêng'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingBg}
                      onChange={handleCustomImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Grid 11 Mẫu Nền + Nút Tạo Nền AI (templateGalleryWrapper luôn giữ DOM, ẩn/hiện bằng hidden để không mất ảnh & tránh chớp giật) */}
              <div
                id="templateGalleryWrapper"
                className={isBgEnabled ? 'block' : 'hidden'}
              >
                <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1 pt-1">
                  {POSTER_TEMPLATES.map((tpl) => {
                    const isActive =
                      !customUploadedBgUrl && tpl.id === currentTemplateId;
                    const bgThumb =
                      EMBEDDED_BACKGROUNDS[tpl.id] || EMBEDDED_BACKGROUNDS['le-hoi'];
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className={`group flex flex-col items-center p-1.5 rounded-xl border-2 transition bg-white ${
                          isActive
                            ? 'border-[#1565C0] ring-2 ring-blue-100 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 relative shadow-inner">
                          <img
                            src={bgThumb}
                            alt={tpl.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {isActive && (
                            <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1565C0] text-white flex items-center justify-center shadow">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-bold mt-1.5 text-center leading-tight line-clamp-1 ${
                            isActive ? 'text-[#1565C0]' : 'text-slate-700'
                          }`}
                        >
                          {tpl.name}
                        </span>
                      </button>
                    );
                  })}

                  {/* Nút Tạo Nền AI */}
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(true)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 hover:bg-indigo-50/50 hover:border-indigo-400 transition group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-600 group-hover:text-indigo-600 mb-2">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-700 text-center">
                      Tạo nền AI
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5 text-center">
                      Gemini miễn phí
                    </span>
                  </button>
                </div>
              </div>

              {/* Thông báo khi tắt ảnh nền */}
              <div
                id="noBgNoticeBox"
                className={
                  !isBgEnabled
                    ? 'bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center space-x-2.5'
                    : 'hidden'
                }
              >
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Đã tắt ảnh nền đồ họa. Hệ thống tự chuyển sang mẫu{' '}
                  <strong>
                    Thiệp / Thông báo Văn bản Chuẩn Hành Chính (Nền trắng viền trang trọng)
                  </strong>
                  .
                </span>
              </div>
            </div>

            {/* KHỐI 2: NỘI DUNG CỐT LÕI */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                2. Nội dung Văn bản Chính thức (Bắt buộc)
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiêu đề hiển thị trên thông báo <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setIsAudioSynced(false);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phạm vi nhận <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none bg-white"
                  >
                    <option value="Toàn trường">Toàn trường</option>
                    <option value="Khối Lá (5-6 tuổi)">Khối Lá (5-6 tuổi)</option>
                    <option value="Khối Chồi (4-5 tuổi)">Khối Chồi (4-5 tuổi)</option>
                    <option value="Khối Mầm (3-4 tuổi)">Khối Mầm (3-4 tuổi)</option>
                    <option value="Nhà trẻ (18-36 tháng)">Nhà trẻ (18-36 tháng)</option>
                    <option value="Cán bộ & Giáo viên">Cán bộ & Giáo viên</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung lời ngỏ / Chi tiết văn bản <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={bodyText}
                  onChange={(e) => {
                    setBodyText(e.target.value);
                    setIsAudioSynced(false);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] focus:outline-none"
                />
              </div>

              {/* Nút gạt Đánh dấu Quan trọng / Khẩn */}
              <div className="bg-red-50/70 p-3 rounded-lg border border-red-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-red-900">
                      Đánh dấu Thông báo Quan trọng / Khẩn
                    </span>
                    <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">
                      ƯU TIÊN
                    </span>
                  </div>
                  <p className="text-[11px] text-red-700">
                    Tự động ghim vị trí đầu tiên trên cổng Phụ huynh và làm nổi bật màu cảnh báo đỏ.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
            </div>

            {/* KHỐI 3: TÙY BIẾN TRƯỜNG DỮ LIỆU ĐỘNG (THỜI GIAN, ĐỊA ĐIỂM, BẢNG, HẠN CHÓT, CON DẤU) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  3. Tùy biến Trường dữ liệu trên Thông báo (Bật / Tắt linh hoạt)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Bật trường nào hệ thống hiển thị thẻ thông tin đó, tắt đi bố cục tự co gọn chuyên nghiệp
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Toggle 1: Thời gian */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 transition hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTimeCard}
                        onChange={(e) => setShowTimeCard(e.target.checked)}
                        className="w-4 h-4 accent-[#D32F2F] rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Thời gian diễn ra (Dương & Âm lịch)
                      </span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                      Khối Thẻ 1
                    </span>
                  </div>
                  {showTimeCard && (
                    <div className="mt-2 pl-6 space-y-1">
                      <textarea
                        rows={2}
                        value={timeValue}
                        onChange={(e) => setTimeValue(e.target.value)}
                        placeholder={'Dòng 1: Giờ, thứ, ngày dương lịch\nDòng 2: (Tức ngày... âm lịch)'}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-[#D32F2F] focus:outline-none resize-none leading-relaxed"
                      />
                      <p className="text-[10px] text-slate-500">
                        Hỗ trợ tối đa 2 dòng: ghi rõ ngày Dương & ngày Âm lịch (căn giữa trên Poster).
                      </p>
                    </div>
                  )}
                </div>

                {/* Toggle 2: Địa điểm */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 transition hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLocCard}
                        onChange={(e) => setShowLocCard(e.target.checked)}
                        className="w-4 h-4 accent-[#D32F2F] rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">Địa điểm tổ chức</span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                      Khối Thẻ 2
                    </span>
                  </div>
                  {showLocCard && (
                    <div className="mt-2 pl-6">
                      <input
                        type="text"
                        value={locValue}
                        onChange={(e) => setLocValue(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-[#D32F2F] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Toggle 3: Bảng Khoản thu / Thực đơn */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 transition hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTableCard}
                        onChange={(e) => setShowTableCard(e.target.checked)}
                        className="w-4 h-4 accent-[#D32F2F] rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Bảng chi tiết (Khoản thu / Thực đơn)
                      </span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                      Tùy chọn
                    </span>
                  </div>
                  {showTableCard && (
                    <div className="mt-2 pl-6 space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={row1Label}
                          onChange={(e) => setRow1Label(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                        <input
                          type="text"
                          value={row1Amt}
                          onChange={(e) => setRow1Amt(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-right"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={row2Label}
                          onChange={(e) => setRow2Label(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                        <input
                          type="text"
                          value={row2Amt}
                          onChange={(e) => setRow2Amt(e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-right"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle 4: Hạn chót & Liên hệ (Đã loại bỏ xxxx, dùng hotline thật 0262.352.1234) */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 transition hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeadlineCard}
                        onChange={(e) => setShowDeadlineCard(e.target.checked)}
                        className="w-4 h-4 accent-[#D32F2F] rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Lưu ý / Hạn chót / SĐT Liên hệ
                      </span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                      Khối Thẻ 3
                    </span>
                  </div>
                  {showDeadlineCard && (
                    <div className="mt-2 pl-6">
                      <input
                        type="text"
                        value={deadlineValue}
                        onChange={(e) => setDeadlineValue(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-[#D32F2F] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Toggle 5: Dấu đỏ & Chữ ký Hiệu trưởng */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSealCard}
                      onChange={(e) => setShowSealCard(e.target.checked)}
                      className="w-4 h-4 accent-[#D32F2F] rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Hiển thị Con dấu đỏ Hiệu trưởng (khi duyệt)
                    </span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Chuẩn hành chính
                  </span>
                </div>
              </div>
            </div>

            {/* KHỐI 4: TẠO GIỌNG ĐỌC AI & NHẠC NỀN BẢN QUYỀN */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  4. Giọng đọc AI Tiếng Việt & Nhạc nền Bản quyền
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Chọn giọng đọc AI (5 Sắc thái Sư phạm)
                    </label>
                    <select
                      value={selectedVoice}
                      onChange={(e) => {
                        setSelectedVoice(e.target.value);
                        setIsAudioSynced(false);
                        setAudioUrl(null);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#D32F2F]"
                    >
                      {TTS_VOICE_OPTIONS.map((v) => (
                        <option key={v.id} value={v.label}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nhạc nền miễn phí bản quyền
                    </label>
                    <select
                      value={selectedMusic}
                      onChange={(e) => {
                        setSelectedMusic(e.target.value);
                        setIsAudioSynced(false);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#D32F2F]"
                    >
                      {BACKGROUND_MUSIC_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {audioUrl && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold truncate max-w-full">
                          <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Đã lưu file âm thanh trên Cloud Storage</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* TỪ ĐIỂN PHÁT ÂM AI & XEM TRƯỚC LỜI ĐỌC */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsTtsDictOpen(true)}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-2xs"
                    title="Cấu hình quy tắc đọc viết tắt, ngày tháng, hotline"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#D32F2F]" />
                    <span>Từ điển cách đọc AI ({ttsRules.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTtsPreviewOpen(true)}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-2xs"
                    title="Kiểm tra văn bản được AI chuẩn hóa trước khi đọc"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xem trước lời AI đọc</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateAiAudio}
                    disabled={isGeneratingAudio}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>
                      {isGeneratingAudio ? 'Đang tạo giọng đọc AI...' : 'Tạo / Cập nhật Audio AI'}
                    </span>
                  </button>
                  <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                    <button
                      type="button"
                      onClick={handleTogglePlayAudio}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer shadow-2xs ${
                        isPlayingAudio
                          ? 'bg-slate-800 text-white hover:bg-slate-900 animate-pulse'
                          : 'bg-[#D32F2F] text-white hover:bg-red-700'
                      }`}
                      title={isPlayingAudio ? 'Tạm dừng phát' : 'Nghe thử lời đọc thông báo qua loa'}
                    >
                      {isPlayingAudio ? (
                        <Square className="w-2.5 h-2.5 fill-white" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-800">
                        {isPlayingAudio
                          ? 'Đang phát qua loa...'
                          : audioUrl
                          ? 'Nghe thử Audio của thông báo'
                          : 'Nghe thử giọng AI (Web Speech)'}
                      </span>
                      {audioUrl && (
                        <span className="text-[9px] text-emerald-700 font-mono truncate max-w-[140px]" title={audioUrl}>
                          ✓ {audioUrl.split('/').pop()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
          </section>

          {/* CỘT PHẢI: 40% LIVE PREVIEW POSTER */}
          <section className="w-5/12 bg-slate-200/80 flex flex-col items-center justify-between p-5 overflow-y-auto relative">
            <div className="w-full max-w-[390px] flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Xem trước Thông báo
                </span>
              </div>

              {/* Bug 3: Nút xem giao diện Phụ huynh 375px đặt ngay cạnh tiêu đề xem trước */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentView('pwa')}
                  title="Mở giao diện Phụ huynh trên điện thoại (375px)"
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold shadow-xs flex items-center space-x-1 transition"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#D32F2F]" />
                  <span>Góc nhìn 375px</span>
                </button>
                <span
                  id="previewTemplateName"
                  className="text-[10px] font-semibold px-2 py-1 bg-white text-slate-600 rounded-lg shadow-xs border border-slate-200"
                >
                  {!isBgEnabled
                    ? 'Chế độ: Không ảnh nền (Nền trắng)'
                    : customUploadedBgUrl
                    ? 'Ảnh nền tải lên riêng'
                    : currentTemplate
                    ? `Mẫu ${currentTemplate.code}: ${currentTemplate.name}`
                    : 'Poster đồ họa'}
                </span>
              </div>
            </div>

            {/* KHUNG POSTER CHÍNH THỨC (REF ĐỂ XUẤT PNG ĐỘ PHÂN GIẢI CAO) */}
            <div className="w-full flex justify-center">
              <AnnouncementPosterCard
                ref={posterRef}
                title={title}
                bodyText={bodyText}
                templateId={currentTemplateId}
                customBgUrl={customUploadedBgUrl}
                isBgEnabled={isBgEnabled}
                audience={audience}
                showTimeCard={showTimeCard}
                timeValue={timeValue}
                showLocCard={showLocCard}
                locValue={locValue}
                showTableCard={showTableCard}
                tableData={{
                  row1_label: row1Label,
                  row1_amt: row1Amt,
                  row2_label: row2Label,
                  row2_amt: row2Amt,
                }}
                showDeadlineCard={showDeadlineCard}
                deadlineValue={deadlineValue}
                showSealCard={showSealCard}
              />
            </div>

            {/* THANH NÚT XUẤT FILE DƯỚI CÙNG */}
            <div className="w-full max-w-[390px] mt-3 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={downloadPosterPng}
                className="flex-1 py-2.5 px-4 bg-[#1565C0] hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Tải ảnh Thông báo (PNG)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('pwa')}
                className="py-2.5 px-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5"
              >
                <Smartphone className="w-4 h-4 text-[#D32F2F]" />
                <span>Xem Mobile</span>
              </button>
            </div>
          </section>
        </main>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: GÓC NHÌN PHỤ HUYNH MOBILE PWA (375px)                         */}
      {/* ===================================================================== */}
      {currentView === 'pwa' && (
        <div className="flex-1 bg-slate-800 overflow-y-auto py-5 flex flex-col items-center justify-start">
          <div className="text-xs text-slate-300 mb-3 flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>
              Giao diện Phụ huynh trên điện thoại (<strong>375px</strong> - Full Đồ Họa & Văn Bản)
            </span>
          </div>

          <div className="w-[375px] bg-white rounded-[38px] border-[8px] border-slate-950 shadow-2xl overflow-hidden flex flex-col shrink-0">
            {/* Top Bar điện thoại */}
            <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2.5 shrink-0">
              <div className="flex justify-between text-[10px] font-bold text-slate-800 mb-2">
                <span>9:41</span>
                <span>5G • 100%</span>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentView('studio')}
                  className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg"
                  title="Quay lại Studio thiết kế"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs font-bold text-slate-900">Thông báo Nhà trường</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-bold">
                  Đã đọc
                </span>
              </div>
            </div>

            {/* Tabs Poster / Văn bản gốc */}
            <div className="bg-white px-4 border-b border-slate-200 flex items-center space-x-6 shrink-0">
              <button
                onClick={() => setMobileMode('poster')}
                className={`py-2.5 text-xs font-bold transition ${
                  mobileMode === 'poster'
                    ? 'text-[#1565C0] border-b-2 border-[#1565C0]'
                    : 'text-slate-500 border-b-2 border-transparent hover:text-slate-800'
                }`}
              >
                Xem Poster
              </button>
              <button
                onClick={() => setMobileMode('text')}
                className={`py-2.5 text-xs font-semibold transition ${
                  mobileMode === 'text'
                    ? 'text-[#1565C0] border-b-2 border-[#1565C0]'
                    : 'text-slate-500 border-b-2 border-transparent hover:text-slate-800'
                }`}
              >
                Văn bản gốc
              </button>
            </div>

            {/* Nội dung Mobile */}
            <div className="p-3.5 space-y-3 overflow-y-auto max-h-[620px] bg-slate-50">
              {/* Thanh Audio AI trên Mobile phát loa thật */}
              <div className="bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTogglePlayAudio}
                  className="flex items-center space-x-2 text-slate-800 hover:text-red-700"
                >
                  {isPlayingAudio ? (
                    <Square className="w-4 h-4 fill-red-600 text-red-600" />
                  ) : (
                    <Play className="w-4 h-4 fill-slate-800 text-slate-800" />
                  )}
                  <span className="text-xs font-bold">
                    {isPlayingAudio ? 'Đang phát qua loa...' : 'Audio AI của nhà trường'}
                  </span>
                </button>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-[#1565C0] ${
                        isPlayingAudio ? 'w-full animate-pulse' : 'w-1/3'
                      }`}
                    ></div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">00:24</span>
                </div>
              </div>

              {/* CHẾ ĐỘ 1: XEM POSTER TRÊN MOBILE */}
              {mobileMode === 'poster' && (
                <div className="space-y-2.5">
                  <AnnouncementPosterCard
                    title={title}
                    bodyText={bodyText}
                    templateId={currentTemplateId}
                    customBgUrl={customUploadedBgUrl}
                    isBgEnabled={isBgEnabled}
                    audience={audience}
                    showTimeCard={showTimeCard}
                    timeValue={timeValue}
                    showLocCard={showLocCard}
                    locValue={locValue}
                    showTableCard={showTableCard}
                    tableData={{
                      row1_label: row1Label,
                      row1_amt: row1Amt,
                      row2_label: row2Label,
                      row2_amt: row2Amt,
                    }}
                    showDeadlineCard={showDeadlineCard}
                    deadlineValue={deadlineValue}
                    showSealCard={showSealCard}
                  />

                  <button
                    onClick={downloadPosterPng}
                    className="w-full py-2.5 bg-[#1565C0] hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải ảnh Poster (PNG)</span>
                  </button>
                </div>
              )}

              {/* CHẾ ĐỘ 2: VĂN BẢN GỐC TRÊN MOBILE */}
              {mobileMode === 'text' && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-red-50 text-[#D32F2F] text-[10px] font-bold rounded">
                      Văn bản chính thức
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(`${title}\n\n${bodyText}`);
                        showToast('Đã sao chép nội dung thông báo!');
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Sao chép</span>
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {bodyText}
                  </p>
                  {showTimeCard && (
                    <div className="text-xs text-slate-700 pt-2 border-t border-slate-100 flex items-center space-x-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-[#D32F2F]" />
                      <span>Thời gian: {timeValue}</span>
                    </div>
                  )}
                  {showLocCard && (
                    <div className="text-xs text-slate-700 flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>Địa điểm: {locValue}</span>
                    </div>
                  )}
                  {showDeadlineCard && (
                    <div className="text-xs text-slate-700 flex items-center space-x-1.5">
                      <Info className="w-3.5 h-3.5 text-sky-600" />
                      <span>Ghi chú: {deadlineValue}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL TẠO NỀN AI GEMINI                                               */}
      {/* ===================================================================== */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tạo Ảnh Nền Mới Bằng AI (Gemini Miễn Phí)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tùy chọn bổ sung ngoài kho 11 mẫu thiết kế sẵn
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mô tả khung cảnh mong muốn cho bé
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Đóng
              </button>
              <button
                onClick={runAiBgGeneration}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tạo ảnh nền ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL THỐNG KÊ READ-RECEIPT                                           */}
      {/* ===================================================================== */}
      {readReceiptModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Thống kê Read-Receipt theo Gia đình
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{readReceiptModal.title}</p>
              </div>
              <button
                onClick={() =>
                  setReadReceiptModal({
                    open: false,
                    title: '',
                    readCount: '',
                    unreadCount: '',
                  })
                }
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Đã đọc thông báo
                  </span>
                  <p className="text-xl font-extrabold text-emerald-900 mt-0.5">
                    {readReceiptModal.readCount}
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[11px] font-semibold text-amber-700">
                    Chưa xem (Cần nhắc)
                  </span>
                  <p className="text-xl font-extrabold text-amber-900 mt-0.5">
                    {readReceiptModal.unreadCount}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">
                * Tỷ lệ đọc thực tế được ghi nhận chính xác theo từng tài khoản phụ huynh đã đăng nhập
                và mở xem thông báo trên Mobile PWA.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL TỪ ĐIỂN PHÁT ÂM AI (TTS PRONUNCIATION DICTIONARY)               */}
      {/* ===================================================================== */}
      {isTtsDictOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#D32F2F] text-white flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Từ điển Phát âm AI Tiếng Việt
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chuẩn hóa từ viết tắt, ngày tháng, hotline sang lời đọc sư phạm tự nhiên
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTtsDictOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nội dung Modal */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Form thêm quy tắc mới */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800">
                  Thêm từ ngữ / chữ số cần chuẩn hóa cách đọc
                </span>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Từ / Số trên thông báo
                    </label>
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="VD: BGH, 20-11, STK"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#D32F2F]"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Cách AI đọc thành tiếng
                    </label>
                    <input
                      type="text"
                      value={newSpokenText}
                      onChange={(e) => setNewSpokenText(e.target.value)}
                      placeholder="VD: Ban Giám Hiệu"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#D32F2F]"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Phân loại
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="ACRONYM">Viết tắt</option>
                      <option value="DATE_TIME">Ngày giờ</option>
                      <option value="CONTACT">Hotline</option>
                      <option value="COMMON">Thông dụng</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddRule}
                    disabled={isSavingRule}
                    className="px-3.5 py-1.5 bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1 transition shadow-xs disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSavingRule ? 'Đang lưu...' : 'Thêm vào từ điển'}</span>
                  </button>
                </div>
              </div>

              {/* Danh sách quy tắc hiện có */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1">
                  <span>Danh mục quy tắc đang áp dụng ({ttsRules.length})</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Tự động áp dụng khi đọc Audio AI
                  </span>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white">
                  {ttsRules.map((rule, idx) => (
                    <div
                      key={rule.id || `${rule.keyword}-${idx}`}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs"
                    >
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase shrink-0 ${
                            rule.category === 'ACRONYM'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : rule.category === 'DATE_TIME'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : rule.category === 'CONTACT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {rule.category === 'ACRONYM'
                            ? 'Viết tắt'
                            : rule.category === 'DATE_TIME'
                            ? 'Ngày giờ'
                            : rule.category === 'CONTACT'
                            ? 'Liên hệ'
                            : 'Chung'}
                        </span>
                        <span className="font-bold text-slate-900 shrink-0 font-mono">
                          {rule.keyword}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-800 font-medium truncate">
                          {rule.spoken_text}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition shrink-0"
                        title="Xóa quy tắc này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTtsDictOpen(false)}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XEM TRƯỚC LỜI AI SẼ ĐỌC (TTS PREVIEW DIALOG)                    */}
      {/* ===================================================================== */}
      {isTtsPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Xem trước Lời AI sẽ đọc thành tiếng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    So sánh văn bản hiển thị trên poster và chuỗi phát âm thực tế qua loa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTtsPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <span className="block font-bold text-slate-700 mb-1">
                  1. Văn bản gốc trên Poster:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed max-h-36 overflow-y-auto">
                  {getCurrentSpokenSpeech().raw}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    2. Lời phát âm AI (Đã qua Từ điển & Bộ chuẩn hóa):
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                    Sẵn sàng đọc
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-300 text-emerald-950 font-medium leading-relaxed max-h-48 overflow-y-auto">
                  {getCurrentSpokenSpeech().normalized}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTogglePlayAudio}
                className="px-3.5 py-1.5 bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition shadow-xs"
              >
                {isPlayingAudio ? (
                  <>
                    <Square className="w-3 h-3 fill-white" />
                    <span>Dừng phát</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-white" />
                    <span>Phát thử qua loa thiết bị</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsTtsPreviewOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XÁC NHẬN XÓA THÔNG BÁO KHỎI CƠ SỞ DỮ LIỆU                      */}
      {/* ===================================================================== */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa thông báo</h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{deleteModal.title}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa bản ghi này khỏi cơ sở dữ liệu không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, id: '', title: '' })}
                disabled={isDeletingAnnouncement}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteAnnouncement}
                disabled={isDeletingAnnouncement}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {isDeletingAnnouncement ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xác nhận xóa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XEM TRƯỚC DẠNG KHUNG DI ĐỘNG (PWA 375PX MOBILE FRAME PREVIEW)   */}
      {/* ===================================================================== */}
      {previewModalAnnouncement && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-[395px] h-[86vh] max-h-[820px] bg-slate-950 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700/80 flex flex-col">
            {/* Dynamic Island / Tai thỏ camera */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-full z-30 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
            </div>

            {/* Nút đóng modal góc ngoài */}
            <button
              type="button"
              onClick={() => setPreviewModalAnnouncement(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white hover:bg-slate-100 text-slate-700 rounded-full shadow-lg border border-slate-200 flex items-center justify-center cursor-pointer z-40 transition"
              title="Đóng xem trước"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Màn hình điện thoại PWA */}
            <div className="w-full h-full bg-slate-100 rounded-[34px] overflow-hidden flex flex-col relative">
              {/* Header PWA điện thoại */}
              <div className="bg-red-700 text-white px-4 pt-7 pb-2.5 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs tracking-wide">PWA Sương Mai</span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white font-medium">
                    Xem trước
                  </span>
                </div>
                <span className="text-[10px] text-red-100 font-mono">375 x 812 px</span>
              </div>

              {/* 2 Tab chuyển đổi: Xem Poster / Văn bản gốc */}
              <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewActiveTab('poster')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    previewActiveTab === 'poster'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Xem Poster</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewActiveTab('text')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    previewActiveTab === 'text'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Văn bản gốc</span>
                </button>
              </div>

              {/* Vùng nội dung cuộn được */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* TAB 1: XEM POSTER */}
                {previewActiveTab === 'poster' ? (
                  <div className="flex flex-col items-center w-full space-y-3">
                    {/* Thanh phát Audio Voice */}
                    <AnnouncementAudioPlayer
                      audioUrl={
                        previewModalAnnouncement.audio_url ||
                        previewModalAnnouncement.metadata?.audio_url
                      }
                      voiceType={
                        previewModalAnnouncement.voice_type ||
                        previewModalAnnouncement.metadata?.voice_type ||
                        previewModalAnnouncement.metadata?.voice
                      }
                    />

                    {/* Card Poster trực quan */}
                    <AnnouncementPosterCard
                      title={previewModalAnnouncement.title}
                      bodyText={previewModalAnnouncement.content}
                      templateId={
                        previewModalAnnouncement.metadata?.template_id || 'hoat-dong'
                      }
                      customBgUrl={
                        previewModalAnnouncement.metadata?.custom_bg_url || ''
                      }
                      backgroundUrl={
                        previewModalAnnouncement.metadata?.custom_bg_url || ''
                      }
                      isBgEnabled={
                        previewModalAnnouncement.metadata?.is_bg_enabled ?? false
                      }
                      audience={
                        previewModalAnnouncement.audience ||
                        previewModalAnnouncement.metadata?.audience ||
                        'Toàn trường'
                      }
                      showTimeCard={
                        previewModalAnnouncement.metadata?.show_time ?? true
                      }
                      timeValue={
                        previewModalAnnouncement.metadata?.time_value || ''
                      }
                      eventTime={
                        previewModalAnnouncement.metadata?.time_value || ''
                      }
                      showLocCard={
                        previewModalAnnouncement.metadata?.show_loc ?? true
                      }
                      locValue={
                        previewModalAnnouncement.metadata?.loc_value || ''
                      }
                      location={
                        previewModalAnnouncement.metadata?.loc_value || ''
                      }
                      showTableCard={
                        previewModalAnnouncement.metadata?.show_table ?? false
                      }
                      tableData={
                        previewModalAnnouncement.metadata?.table_data || null
                      }
                      tableRows={
                        previewModalAnnouncement.metadata?.table_data || null
                      }
                      showDeadlineCard={
                        previewModalAnnouncement.metadata?.show_deadline ?? false
                      }
                      deadlineValue={
                        previewModalAnnouncement.metadata?.deadline_value || ''
                      }
                      note={
                        previewModalAnnouncement.metadata?.deadline_value || ''
                      }
                      showSealCard={
                        previewModalAnnouncement.metadata?.show_seal ?? true
                      }
                      showSeal={
                        previewModalAnnouncement.metadata?.show_seal ?? true
                      }
                      className="w-full max-w-[360px] mx-auto aspect-[3/4.25]"
                    />
                  </div>
                ) : (
                  /* TAB 2: VĂN BẢN GỐC */
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5 text-xs">
                    <div className="border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                          {previewModalAnnouncement.category || 'Thông báo'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatVietnameseDate(
                            previewModalAnnouncement.created_at ||
                              previewModalAnnouncement.published_at
                          )}
                        </span>
                      </div>
                      <h1 className="text-sm font-bold text-slate-900 leading-snug">
                        {previewModalAnnouncement.title}
                      </h1>
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed text-slate-700 text-justify">
                      <p className="whitespace-pre-line">
                        {previewModalAnnouncement.content}
                      </p>
                    </div>

                    {/* Chi tiết đính kèm */}
                    {(previewModalAnnouncement.metadata?.time_value ||
                      previewModalAnnouncement.metadata?.loc_value ||
                      previewModalAnnouncement.metadata?.deadline_value) && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                        {previewModalAnnouncement.metadata?.time_value && (
                          <div className="flex items-start gap-2">
                            <CalendarClock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Thời gian: </span>
                              <span className="text-slate-700 whitespace-pre-line">
                                {previewModalAnnouncement.metadata.time_value}
                              </span>
                            </div>
                          </div>
                        )}
                        {previewModalAnnouncement.metadata?.loc_value && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Địa điểm: </span>
                              <span className="text-slate-700">
                                {previewModalAnnouncement.metadata.loc_value}
                              </span>
                            </div>
                          </div>
                        )}
                        {previewModalAnnouncement.metadata?.deadline_value && (
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900">Lưu ý / Hạn chót: </span>
                              <span className="text-slate-700">
                                {previewModalAnnouncement.metadata.deadline_value}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thanh điều hướng dưới đáy (Home Bar) */}
              <div className="bg-white border-t border-slate-200 py-2 flex justify-center items-center shrink-0">
                <div className="w-32 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOAST THÔNG BÁO THAO TÁC (TỰ ĐỘNG PHÂN BIỆT THÀNH CÔNG HOẶC LỖI ĐỎ)   */}
      {/* ===================================================================== */}
      {toastMessage && (() => {
        const isErrorToast =
          toastMessage.toLowerCase().includes('lỗi') ||
          toastMessage.toLowerCase().includes('không thể') ||
          toastMessage.toLowerCase().includes('thất bại');

        return (
          <div
            className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2.5 z-50 transition-all ${
              isErrorToast
                ? 'bg-red-700 text-white border-2 border-red-500 shadow-red-900/30'
                : 'bg-slate-900 text-white border border-slate-700'
            }`}
          >
            {isErrorToast ? (
              <AlertTriangle className="w-4.5 h-4.5 text-white shrink-0 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            )}
            <span className="leading-relaxed">{toastMessage}</span>
          </div>
        );
      })()}
    </div>
  );
}
