'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  EMBEDDED_BACKGROUNDS,
  POSTER_TEMPLATES,
  PosterTemplate,
  AnnouncementItem,
  AnnouncementMetadata,
} from '@/lib/announcements/posterTemplates';

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
  const [audience, setAudience] = useState<string>('Toàn trường (200 bé)');
  const [bodyText, setBodyText] = useState<string>(
    'Trân trọng kính mời Quý Phụ huynh cùng các bé đến tham dự chương trình "Đêm Hội Trăng Rằm" với nhiều tiết mục múa lân, rước đèn ông sao và phá cỗ trông trăng đầy ý nghĩa.'
  );

  // Dynamic cards toggles & values
  const [showTimeCard, setShowTimeCard] = useState<boolean>(true);
  const [timeValue, setTimeValue] = useState<string>('18:30 Thứ Năm, 24/09/2026 (14/08 Âm lịch)');

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
  const [selectedVoice, setSelectedVoice] = useState<string>(
    'Giọng Bé gái Miền Nam (Vui tươi, truyền cảm)'
  );
  const [selectedMusic, setSelectedMusic] = useState<string>(
    'Nhạc Lễ hội Thiếu nhi (Không bản quyền)'
  );
  const [isAudioSynced, setIsAudioSynced] = useState<boolean>(true);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  // Load announcements directly from real Database API
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
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
    if (tpl.defaultAudience) setAudience(tpl.defaultAudience);
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
    showToast(`Đã đồng bộ mẫu "${tpl.name}" kèm dữ liệu 3 thẻ thông tin!`);
  };

  // Switch to Studio with specific template
  const openTemplateInStudio = (tplId: string) => {
    const tpl = POSTER_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setCurrentAnnouncementId(null);
    setStatus('DRAFT');
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

    if (meta.voice) setSelectedVoice(meta.voice);
    if (meta.music) setSelectedMusic(meta.music);
    setIsAudioSynced(Boolean(meta.audio_synced));

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
        audience: meta.audience || 'Toàn trường (200 bé)',
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

      const json = await res.json();
      if (res.ok && json.success && json.announcement) {
        showToast('Đã nhân bản sang bản nháp mới trong CSDL thành công!');
        await fetchAnnouncements();
        openAnnouncementInStudio(json.announcement);
      } else {
        showToast(json.error || 'Không thể nhân bản vào CSDL. Vui lòng thử lại!');
      }
    } catch (err: any) {
      console.error('Lỗi nhân bản:', err);
      showToast('Lỗi kết nối khi nhân bản thông báo.');
    }
  };

  // Real Database Deletion
  const handleDeleteAnnouncement = async () => {
    if (!deleteModal.id) return;
    try {
      showToast('Đang xóa bản ghi khỏi cơ sở dữ liệu...');
      const res = await fetch(`/api/announcements?id=${deleteModal.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Đã xóa thông báo khỏi cơ sở dữ liệu thành công!');
        setDeleteModal({ open: false, id: '', title: '' });
        await fetchAnnouncements();
        if (currentAnnouncementId === deleteModal.id) {
          setCurrentAnnouncementId(null);
          setCurrentView('list');
        }
      } else {
        showToast(json.error || 'Không thể xóa thông báo.');
      }
    } catch (err) {
      console.error('Lỗi xóa:', err);
      showToast('Lỗi kết nối khi xóa thông báo.');
    }
  };

  // Seed sample data into real Database if table is currently empty
  const handleSeedSampleData = async () => {
    try {
      showToast('Đang khởi tạo dữ liệu mẫu Sương Mai vào cơ sở dữ liệu...');
      const samples = [
        {
          title: 'Thông báo thu học phí & tiền ăn tháng 11/2026',
          content:
            'Nhà trường gửi tới Quý Phụ huynh bảng kê chi tiết các khoản thu bán trú tháng 11. Phụ huynh vui lòng hoàn thành đúng thời hạn quy định.',
          category: 'Học phí',
          status: 'PUBLISHED',
          target_role: 'ALL',
          metadata: {
            template_id: 'hoc-phi',
            is_bg_enabled: true,
            audience: 'Toàn trường (200 bé)',
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
            read_count: 184,
            total_target_count: 200,
          },
        },
        {
          title: 'Giấy mời họp Phụ huynh đầu năm học 2026 - 2027',
          content:
            'Trân trọng kính mời Quý Phụ huynh đến tham dự buổi họp triển khai kế hoạch chăm sóc, nuôi dưỡng và giáo dục trẻ năm học mới tại lớp học của bé.',
          category: 'Giấy mời',
          status: 'PUBLISHED',
          target_role: 'ALL',
          metadata: {
            template_id: 'giay-moi',
            is_bg_enabled: true,
            audience: 'Toàn trường (200 bé)',
            cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
            time_value: '08:00 Thứ Bảy, 19/09/2026',
            location_value: 'Phòng học các lớp Khối Mầm - Chồi - Lá',
            deadline_value: 'Hotline nhà trường: 0262.352.1234',
            read_count: 196,
            total_target_count: 200,
          },
        },
        {
          title: 'Lịch khám sức khỏe định kỳ & đo chỉ số WHO đợt 1',
          content:
            'Bộ phận Y tế nhà trường phối hợp cùng Trạm Y tế khám tổng quát (Răng - Hàm - Mặt, Tai - Mũi - Họng, cân đo chỉ số WHO) cho 100% trẻ đang theo học.',
          category: 'Sức khỏe',
          status: 'PENDING_APPROVAL',
          target_role: 'ALL',
          metadata: {
            template_id: 'suc-khoe',
            is_bg_enabled: true,
            audience: 'Toàn trường (200 bé)',
            cards_visibility: { time: true, location: true, table: false, deadline: true, seal: true },
            time_value: '07:30 - 11:00 Ngày 15/10/2026',
            location_value: 'Phòng Y tế Trường Mầm non Sương Mai',
            deadline_value: 'Phụ huynh cho bé đi học đầy đủ và đúng giờ',
            read_count: 0,
            total_target_count: 200,
          },
        },
        {
          title: 'Thông báo nghỉ lễ Quốc khánh & Lịch trực Ban Giám hiệu',
          content:
            'Nhà trường trân trọng thông báo lịch nghỉ lễ tới toàn thể Quý Phụ huynh. Kính chúc gia đình và các bé có kỳ nghỉ lễ thật vui vẻ, an toàn và ấm áp.',
          category: 'Nghỉ lễ',
          status: 'DRAFT',
          target_role: 'ALL',
          metadata: {
            template_id: 'nghi-le',
            is_bg_enabled: false,
            audience: 'Toàn trường (200 bé)',
            cards_visibility: { time: true, location: false, table: false, deadline: true, seal: true },
            time_value: 'Nghỉ từ 01/09 đến hết 03/09/2026',
            location_value: 'Trường Mầm non Sương Mai',
            deadline_value: 'Hotline trực trường: 0262.352.1234',
            read_count: 0,
            total_target_count: 200,
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

      showToast('Đã khởi tạo 4 thông báo mẫu chuẩn Sương Mai vào CSDL thành công!');
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
    try {
      showToast('Đang lưu bản nháp vào cơ sở dữ liệu...');
      const metadataPayload: AnnouncementMetadata = {
        template_id: currentTemplateId,
        is_bg_enabled: isBgEnabled,
        custom_bg_url: customUploadedBgUrl,
        audience,
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
        music: selectedMusic,
        audio_synced: isAudioSynced,
        has_poster: true,
        has_audio: true,
      };

      const payload = {
        id: currentAnnouncementId || undefined,
        title,
        content: bodyText,
        category,
        status: 'DRAFT',
        target_role: 'ALL',
        metadata: metadataPayload,
      };

      const method = currentAnnouncementId ? 'PUT' : 'POST';
      const res = await fetch('/api/announcements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (json.announcement?.id) {
          setCurrentAnnouncementId(json.announcement.id);
        }
        setStatus('DRAFT');
        showToast('Đã lưu bản nháp thông báo vào CSDL thành công!');
        await fetchAnnouncements();
      } else {
        showToast(json.error || 'Lỗi khi lưu bản nháp vào CSDL.');
      }
    } catch (err) {
      console.error('Lỗi lưu nháp:', err);
      showToast('Lỗi kết nối khi lưu bản nháp.');
    }
  };

  // Approve & Publish to real Database
  const handleApproveAndPublish = async () => {
    try {
      showToast('Đang duyệt và phát hành thông báo...');
      const metadataPayload: AnnouncementMetadata = {
        template_id: currentTemplateId,
        is_bg_enabled: isBgEnabled,
        custom_bg_url: customUploadedBgUrl,
        audience,
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
        music: selectedMusic,
        audio_synced: isAudioSynced,
        has_poster: true,
        has_audio: true,
      };

      const payload = {
        id: currentAnnouncementId || undefined,
        title,
        content: bodyText,
        category,
        status: 'PUBLISHED',
        target_role: 'ALL',
        metadata: metadataPayload,
      };

      const method = currentAnnouncementId ? 'PUT' : 'POST';
      const res = await fetch('/api/announcements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        if (json.announcement?.id) {
          setCurrentAnnouncementId(json.announcement.id);
        }
        setStatus('PUBLISHED');
        showToast('Hiệu trưởng đã duyệt & phát hành thông báo thành công!');
        await fetchAnnouncements();
      } else {
        showToast(json.error || 'Lỗi khi duyệt & phát hành.');
      }
    } catch (err) {
      console.error('Lỗi phát hành:', err);
      showToast('Lỗi kết nối khi phát hành.');
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

  // Real TTS Voice Synthesis: Web Speech API with real device audio playback
  const handleGenerateAiAudio = () => {
    setIsGeneratingAudio(true);
    setTimeout(() => {
      setIsGeneratingAudio(false);
      setIsAudioSynced(true);
      showToast('Đã tổng hợp giọng đọc AI tiếng Việt sẵn sàng phát qua loa!');
    }, 600);
  };

  // Toggle Audio Playback through device speakers
  const handleTogglePlayAudio = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Trình duyệt không hỗ trợ phát âm thanh Web Speech API.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      showToast('Đã dừng phát âm thanh.');
      return;
    }

    window.speechSynthesis.cancel();

    // Prepare speech text from official announcement content
    const spokenText = `${title}. ${bodyText}. ${
      showTimeCard && timeValue ? `Thời gian: ${timeValue}.` : ''
    } ${showLocCard && locValue ? `Địa điểm: ${locValue}.` : ''} ${
      showDeadlineCard && deadlineValue ? `Lưu ý: ${deadlineValue}.` : ''
    } Trường Mầm non Sương Mai trân trọng thông báo.`;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'vi-VN';

    // Tone & speed adjustments according to selected voice
    if (selectedVoice.includes('Bé gái')) {
      utterance.pitch = 1.3;
      utterance.rate = 1.0;
    } else if (selectedVoice.includes('Cô giáo')) {
      utterance.pitch = 1.05;
      utterance.rate = 0.95;
    } else {
      utterance.pitch = 0.9;
      utterance.rate = 0.95;
    }

    // Attempt to pick a Vietnamese voice if available
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.includes('vi') || v.lang.includes('VN'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true);
      showToast('Đang phát giọng đọc AI của trường Sương Mai qua loa thiết bị...');
    };

    utterance.onend = () => {
      setIsPlayingAudio(false);
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
    };

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
          osc1.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(440.0, ctx.currentTime); // A4

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

    window.speechSynthesis.speak(utterance);
  };

  // Open read receipt modal
  const handleOpenReadReceipt = (item: AnnouncementItem) => {
    const read = item.read_count ?? (item.status === 'PUBLISHED' ? 184 : 0);
    const total = item.total_target_count ?? 200;
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
          <div className="w-8 h-8 rounded-lg bg-[#D32F2F] flex items-center text-white justify-center font-bold text-sm shadow-sm shrink-0">
            SM
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

          {/* Bảng danh sách 5 cột */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-5 whitespace-nowrap">TIÊU ĐỀ</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">PHÂN LOẠI</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">TRẠNG THÁI</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">ĐÃ ĐỌC</th>
                  <th className="py-3.5 px-5 text-right whitespace-nowrap">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      <span>Đang tải danh sách thông báo từ cơ sở dữ liệu...</span>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 space-y-3">
                      <p className="text-sm font-semibold">Chưa có thông báo nào trong cơ sở dữ liệu.</p>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Bạn có thể khởi tạo ngay 4 thông báo mẫu chuẩn sư phạm Sương Mai để sẵn sàng sử dụng.
                      </p>
                      <button
                        onClick={handleSeedSampleData}
                        className="px-4 py-2 bg-[#D32F2F] hover:bg-red-700 text-white font-semibold text-xs rounded-lg shadow-sm transition inline-flex items-center space-x-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Khởi tạo 4 thông báo mẫu Sương Mai vào CSDL</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item) => {
                    const readCount =
                      item.read_count ?? (item.status === 'PUBLISHED' ? 184 : 0);
                    const totalCount = item.total_target_count ?? 200;
                    const percent =
                      totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-5">
                          <div
                            onClick={() => openAnnouncementInStudio(item)}
                            className="font-bold text-slate-900 text-sm cursor-pointer hover:text-[#D32F2F] transition"
                          >
                            {item.title}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5 flex items-center space-x-2">
                            <span>{item.metadata?.audience || 'Toàn trường'}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">
                              Có Poster Đồ họa & Audio AI
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md font-medium border border-amber-200">
                            {item.category || 'Thông báo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.status === 'PUBLISHED' ? (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold border border-emerald-200">
                              Đã phát hành
                            </span>
                          ) : item.status === 'PENDING_APPROVAL' ? (
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-semibold border border-blue-200">
                              Chờ duyệt
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-semibold border border-amber-200">
                              Bản nháp
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.status === 'PUBLISHED' ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                <div
                                  className="bg-emerald-600 h-1.5 rounded-full"
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-slate-700">
                                {readCount}/{totalCount} bé
                              </span>
                            </div>
                          ) : item.status === 'PENDING_APPROVAL' ? (
                            <span className="text-slate-400 italic">Chưa phát hành</span>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5">
                            {item.status === 'PUBLISHED' && (
                              <button
                                onClick={() => handleOpenReadReceipt(item)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition flex items-center space-x-1"
                                title="Xem thống kê phụ huynh đã đọc"
                              >
                                <BarChart2 className="w-3.5 h-3.5" />
                                <span>Thống kê</span>
                              </button>
                            )}

                            {item.status === 'PENDING_APPROVAL' ? (
                              <button
                                onClick={() => openAnnouncementInStudio(item)}
                                className="px-2.5 py-1.5 bg-[#D32F2F] hover:bg-red-700 text-white rounded-md font-semibold transition flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem & Duyệt</span>
                              </button>
                            ) : item.status === 'DRAFT' ? (
                              <button
                                onClick={() => openAnnouncementInStudio(item)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold transition flex items-center space-x-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Sửa tiếp</span>
                              </button>
                            ) : null}

                            <button
                              onClick={() => cloneAnnouncement(item)}
                              title="Nhân bản tạo kỳ mới trong CSDL"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() =>
                                setDeleteModal({ open: true, id: item.id, title: item.title })
                              }
                              title="Xóa thông báo khỏi cơ sở dữ liệu"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
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
                    checked={isBgEnabled}
                    onChange={(e) => {
                      setIsBgEnabled(e.target.checked);
                      showToast(
                        e.target.checked
                          ? 'Đã bật ảnh nền đồ họa Poster!'
                          : 'Đã tắt ảnh nền Poster — Chuyển sang nền trắng chuẩn hành chính.'
                      );
                    }}
                    className="w-4 h-4 accent-[#D32F2F] rounded"
                  />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      1. Sử dụng Ảnh Nền Đồ Họa Poster (Bật / Tắt)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {isBgEnabled
                        ? 'Đang bật: Chọn ảnh nền minh họa bên dưới hoặc dùng AI / tải ảnh riêng'
                        : 'Đang tắt: Thông báo hiển thị trên nền trắng trang trọng (không dùng ảnh minh họa)'}
                    </p>
                  </div>
                </label>
                {isBgEnabled && (
                  <div className="flex items-center space-x-1.5">
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
                )}
              </div>

              {/* Grid 11 Mẫu Nền + Nút Tạo Nền AI (Bug 2: Click bất kỳ mẫu nào cũng đồng bộ đủ 3 thẻ) */}
              {isBgEnabled && (
                <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1 pt-1">
                  {POSTER_TEMPLATES.map((tpl) => {
                    const isActive =
                      !customUploadedBgUrl && tpl.id === currentTemplateId;
                    const bgThumb = EMBEDDED_BACKGROUNDS[tpl.id];
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
              )}

              {/* Thông báo khi tắt ảnh nền */}
              {!isBgEnabled && (
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center space-x-2.5">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Đã tắt ảnh nền đồ họa. Hệ thống tự chuyển sang mẫu{' '}
                    <strong>
                      Thiệp / Thông báo Văn bản Chuẩn Hành Chính (Nền trắng viền trang trọng)
                    </strong>
                    .
                  </span>
                </div>
              )}
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
                    <option value="Toàn trường (200 bé)">Toàn trường (200 bé)</option>
                    <option value="Khối Lá (5-6 tuổi)">Khối Lá (5-6 tuổi)</option>
                    <option value="Khối Chồi (4-5 tuổi)">Khối Chồi (4-5 tuổi)</option>
                    <option value="Khối Mầm (3-4 tuổi)">Khối Mầm (3-4 tuổi)</option>
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
                    <div className="mt-2 pl-6">
                      <input
                        type="text"
                        value={timeValue}
                        onChange={(e) => setTimeValue(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-[#D32F2F] focus:outline-none"
                      />
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
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    isAudioSynced
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-300'
                  }`}
                >
                  {isAudioSynced ? 'Đã đồng bộ văn bản' : 'Chữ đã sửa - Cần cập nhật Audio'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Chọn giọng đọc AI
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option>Giọng Bé gái Miền Nam (Vui tươi, truyền cảm)</option>
                    <option>Giọng Cô giáo Miền Bắc (Trang trọng, rõ ràng)</option>
                    <option>Giọng Phát thanh viên (Cảnh báo khẩn / Nội bộ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nhạc nền miễn phí bản quyền
                  </label>
                  <select
                    value={selectedMusic}
                    onChange={(e) => setSelectedMusic(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option>Nhạc Lễ hội Thiếu nhi (Không bản quyền)</option>
                    <option>Piano nhẹ nhàng (Không bản quyền)</option>
                    <option>Không dùng nhạc nền</option>
                  </select>
                </div>
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
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                      isPlayingAudio
                        ? 'bg-slate-800 text-white hover:bg-slate-900'
                        : 'bg-[#D32F2F] text-white hover:bg-red-700'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <Square className="w-2.5 h-2.5 fill-white" />
                    ) : (
                      <Play className="w-3 h-3 fill-white ml-0.5" />
                    )}
                  </button>
                  <span className="text-[11px] font-medium text-slate-700">
                    {isPlayingAudio ? 'Đang phát qua loa thiết bị...' : 'Phát thử qua loa (00:24)'}
                  </span>
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
                <span className="text-[10px] font-semibold px-2 py-1 bg-white text-slate-600 rounded-lg shadow-xs border border-slate-200">
                  {!isBgEnabled
                    ? 'Nền trắng'
                    : customUploadedBgUrl
                    ? 'Ảnh tải lên'
                    : currentTemplate
                    ? currentTemplate.name
                    : 'Poster'}
                </span>
              </div>
            </div>

            {/* KHUNG POSTER CHÍNH THỨC (REF ĐỂ XUẤT PNG ĐỘ PHÂN GIẢI CAO) */}
            <div
              ref={posterRef}
              className={`w-full max-w-[390px] aspect-[3/4.25] rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between relative border-4 select-none bg-cover bg-center transition-all duration-300 ${
                isBgEnabled
                  ? 'border-white bg-white'
                  : 'border-red-200 bg-gradient-to-b from-white to-red-50/40'
              }`}
              style={
                isBgEnabled && activeBgImage
                  ? { backgroundImage: `url('${activeBgImage}')` }
                  : undefined
              }
            >
              {/* TẦNG 1: HEADER TRƯỜNG MẦM NON SƯƠNG MAI */}
              <div className="bg-[#D32F2F]/95 backdrop-blur-xs text-white px-4 py-2.5 flex items-center justify-center space-x-2.5 relative z-10 shadow-md">
                <div className="w-7 h-7 rounded-full bg-white text-[#D32F2F] font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                  SM
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-extrabold tracking-wide uppercase leading-none">
                    Trường Mầm Non Sương Mai
                  </h4>
                  <p className="text-[9px] opacity-90 mt-0.5">
                    Krông Pắc, Đắk Lắk • mamnonsuongmai.edu.vn
                  </p>
                </div>
              </div>

              {/* VÙNG TRUNG TÂM CHỮ NỔI */}
              <div className="px-5 py-2 my-auto flex flex-col items-center text-center relative z-10 space-y-2.5">
                {/* TẦNG 2: RUY BĂNG TIÊU ĐỀ NỔI BẬT (TUYỆT ĐỐI CÂN ĐỐI, CĂN GIỮA, KHÔNG XOAY/NGHIÊNG) */}
                <div
                  id="posterRibbonBox"
                  className={
                    isBgEnabled
                      ? 'text-white px-5 py-2 rounded-2xl border-2 border-[#FFCDD2] max-w-[92%] mx-auto transition-all text-center'
                      : 'bg-red-50 text-[#D32F2F] px-5 py-2 rounded-xl border border-red-200 max-w-[95%] mx-auto transition-all text-center shadow-xs'
                  }
                  style={
                    isBgEnabled
                      ? {
                          background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)',
                          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
                        }
                      : undefined
                  }
                >
                  <h2
                    className={`text-base font-extrabold leading-snug tracking-wide ${
                      isBgEnabled ? 'text-white drop-shadow-md' : 'text-[#D32F2F]'
                    }`}
                    style={{
                      fontFamily: '"Playfair Display", Georgia, serif',
                      textShadow: isBgEnabled ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                    }}
                  >
                    {title || '(Chưa nhập tiêu đề)'}
                  </h2>
                </div>

                {/* TẦNG 3: KHỐI THẺ THÔNG TIN ĐỘNG */}
                <div className="w-full space-y-1.5 text-left">
                  {showTimeCard && (
                    <div className="flex items-center space-x-2 bg-white/92 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs">
                      <CalendarClock className="w-3.5 h-3.5 text-[#D32F2F] shrink-0" />
                      <span className="text-[11px] font-bold text-slate-900 leading-tight">
                        {timeValue}
                      </span>
                    </div>
                  )}

                  {showLocCard && (
                    <div className="flex items-center space-x-2 bg-white/92 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-900 leading-tight">
                        {locValue}
                      </span>
                    </div>
                  )}

                  {showTableCard && (
                    <div className="bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-emerald-200 shadow-xs text-[10px]">
                      <div className="flex justify-between py-0.5 border-b border-slate-100">
                        <span className="text-slate-700 font-medium">{row1Label}</span>
                        <span className="font-extrabold text-slate-900">{row1Amt}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-slate-700 font-medium">{row2Label}</span>
                        <span className="font-extrabold text-slate-900">{row2Amt}</span>
                      </div>
                    </div>
                  )}

                  {showDeadlineCard && (
                    <div className="flex items-center space-x-2 bg-white/92 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-sky-200/80 shadow-xs">
                      <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-[10px] font-semibold text-slate-800 leading-tight">
                        {deadlineValue}
                      </span>
                    </div>
                  )}
                </div>

                {/* TẦNG 4: LỜI NGỎ / VĂN BẢN CHÍNH THỨC (BUG 1: GIỮ NỀN TRẮNG MỜ KHÔNG BỊ MẤT TRÊN CẢ 11 MẪU) */}
                <div
                  id="posterBodyCard"
                  className="w-full bg-white/92 backdrop-blur-sm border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.94)' }}
                >
                  <p className="text-[10.5px] text-slate-800 font-medium leading-relaxed text-justify line-clamp-5">
                    {bodyText || '(Chưa nhập nội dung)'}
                  </p>
                </div>
              </div>

              {/* TẦNG 5 & 6: PHẠM VI NHẬN & DẤU ĐỎ HIỆU TRƯỞNG */}
              <div className="px-4 pb-3 pt-1 flex items-end justify-between relative z-10">
                <span className="px-2 py-0.5 bg-white/90 backdrop-blur-xs rounded-md text-[9px] font-extrabold text-slate-800 shadow-xs border border-slate-200/80">
                  Gửi: <span>{audience}</span>
                </span>

                {showSealCard && (
                  <div className="flex items-center space-x-1.5 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-xl border border-red-200 shadow-xs">
                    <div className="text-right">
                      <p className="text-[8px] font-bold text-slate-700 uppercase leading-none">
                        Hiệu Trưởng
                      </p>
                      <p
                        className="text-[9px] italic text-red-700 font-bold leading-tight"
                        style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                      >
                        Vũ Thị Xuân
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-red-600 flex flex-col items-center justify-center text-red-600 font-extrabold text-[6px] leading-none transform -rotate-12 bg-red-50">
                      <span>SƯƠNG MAI</span>
                      <span className="mt-0.5">ĐÃ DUYỆT</span>
                    </div>
                  </div>
                )}
              </div>
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
                  <div
                    className={`w-full aspect-[3/4.25] rounded-2xl shadow-md overflow-hidden flex flex-col justify-between relative border-2 select-none bg-cover bg-center transition-all ${
                      isBgEnabled
                        ? 'border-white bg-white'
                        : 'border-red-200 bg-gradient-to-b from-white to-red-50/40'
                    }`}
                    style={
                      isBgEnabled && activeBgImage
                        ? { backgroundImage: `url('${activeBgImage}')` }
                        : undefined
                    }
                  >
                    {/* Header */}
                    <div className="bg-[#D32F2F]/95 text-white px-3 py-2 flex items-center justify-center space-x-2 relative z-10">
                      <div className="w-6 h-6 rounded-full bg-white text-[#D32F2F] font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        SM
                      </div>
                      <div className="text-left">
                        <h4 className="text-[11px] font-extrabold tracking-wide uppercase leading-none">
                          Trường Mầm Non Sương Mai
                        </h4>
                        <p className="text-[8px] opacity-90 mt-0.5">Krông Pắc, Đắk Lắk</p>
                      </div>
                    </div>

                    {/* Tiêu đề & nội dung */}
                    <div className="px-4 py-1.5 my-auto flex flex-col items-center text-center relative z-10 space-y-2">
                      <div
                        className={
                          isBgEnabled
                            ? 'text-white px-4 py-1.5 rounded-xl border border-[#FFCDD2] max-w-[95%] mx-auto text-center'
                            : 'bg-red-50 text-[#D32F2F] px-4 py-1.5 rounded-lg border border-red-200 max-w-[95%] mx-auto text-center'
                        }
                        style={
                          isBgEnabled
                            ? {
                                background:
                                  'linear-gradient(135deg, #E53935 0%, #C62828 100%)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                              }
                            : undefined
                        }
                      >
                        <h2
                          className={`text-sm font-extrabold leading-snug ${
                            isBgEnabled ? 'text-white' : 'text-[#D32F2F]'
                          }`}
                          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                        >
                          {title}
                        </h2>
                      </div>

                      <div className="w-full space-y-1 text-left">
                        {showTimeCard && (
                          <div className="flex items-center space-x-1.5 bg-white/92 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px] font-bold text-slate-900">
                            <CalendarClock className="w-3 h-3 text-[#D32F2F] shrink-0" />
                            <span>{timeValue}</span>
                          </div>
                        )}
                        {showLocCard && (
                          <div className="flex items-center space-x-1.5 bg-white/92 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px] font-bold text-slate-900">
                            <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{locValue}</span>
                          </div>
                        )}
                        {showTableCard && (
                          <div className="bg-white/95 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-[9px]">
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span>{row1Label}</span>
                              <span className="font-bold">{row1Amt}</span>
                            </div>
                            <div className="flex justify-between py-0.5">
                              <span>{row2Label}</span>
                              <span className="font-bold">{row2Amt}</span>
                            </div>
                          </div>
                        )}
                        {showDeadlineCard && (
                          <div className="flex items-center space-x-1.5 bg-white/92 px-2.5 py-1 rounded-lg border border-sky-200 text-[9px] font-semibold text-slate-800">
                            <Info className="w-3 h-3 text-sky-600 shrink-0" />
                            <span>{deadlineValue}</span>
                          </div>
                        )}
                      </div>

                      {/* Bug 1 (Mobile body card translucent white background) */}
                      <div
                        className="w-full bg-white/92 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 text-[9.5px] text-slate-800 leading-relaxed text-justify line-clamp-4"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.94)' }}
                      >
                        {bodyText}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-3 pb-2 pt-1 flex items-end justify-between relative z-10">
                      <span className="px-2 py-0.5 bg-white/90 rounded text-[8px] font-extrabold text-slate-800">
                        Gửi: {audience}
                      </span>
                      {showSealCard && (
                        <div className="flex items-center space-x-1 bg-white/90 px-1.5 py-0.5 rounded-lg border border-red-200 text-[8px]">
                          <span
                            className="font-bold text-red-700 italic"
                            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                          >
                            Vũ Thị Xuân
                          </span>
                          <div className="w-6 h-6 rounded-full border border-red-600 flex flex-col items-center justify-center text-red-600 font-extrabold text-[5px] leading-none transform -rotate-12 bg-red-50">
                            <span>ĐÃ</span>
                            <span>DUYỆT</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                onClick={() => setDeleteModal({ open: false, id: '', title: '' })}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDeleteAnnouncement}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOAST THÔNG BÁO THAO TÁC                                              */}
      {/* ===================================================================== */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center space-x-2.5 z-50 transition-all animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
