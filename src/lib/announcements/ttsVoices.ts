// ==============================================================================
// src/lib/announcements/ttsVoices.ts
// Cấu hình danh mục Giọng đọc AI Tiếng Việt (TTS Voice Profiles)
// Hệ thống Quản lý Vận hành Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

export interface TtsVoiceOption {
  id: string;
  label: string;
  region: 'Bắc' | 'Nam' | 'Toàn quốc';
  gender: 'Nữ' | 'Nam';
  pitch: number;
  rate: number;
  description: string;
  recommendedFor: string;
}

/**
 * 5 Sắc thái Giọng đọc AI chuẩn mực cho công tác sư phạm mầm non
 */
export const TTS_VOICE_OPTIONS: TtsVoiceOption[] = [
  {
    id: 'vn_north_female_teacher',
    label: 'Giọng Cô giáo Miền Bắc (Trang trọng, rõ ràng)',
    region: 'Bắc',
    gender: 'Nữ',
    pitch: 1.05,
    rate: 0.95,
    description: 'Trang trọng, chuẩn mực, phát âm rõ từng âm tiết, phù hợp thông báo quy chế, hội nghị',
    recommendedFor: 'Giấy mời, Họp phụ huynh, Văn bản hành chính',
  },
  {
    id: 'vn_south_female_teacher',
    label: 'Giọng Cô giáo Miền Nam (Ấm áp, thân thiện, gần gũi)',
    region: 'Nam',
    gender: 'Nữ',
    pitch: 1.1,
    rate: 0.98,
    description: 'Ngọt ngào, ân cần, gần gũi như cô giáo chủ nhiệm tâm sự chăm sóc bé',
    recommendedFor: 'Bán trú, Thực đơn, Dinh dưỡng, Chăm sóc sức khỏe',
  },
  {
    id: 'vn_south_female_child',
    label: 'Giọng Bé gái Miền Nam (Vui tươi, truyền cảm)',
    region: 'Nam',
    gender: 'Nữ',
    pitch: 1.35,
    rate: 1.02,
    description: 'Hồn nhiên, trong trẻo, vui tươi, gợi không khí rộn ràng ngày hội của bé',
    recommendedFor: 'Lễ hội Trung thu, Ngày hội Thiếu nhi, Dã ngoại, Bé vui khám phá',
  },
  {
    id: 'vn_male_announcer',
    label: 'Giọng Nam Phát thanh viên / Thầy giáo (Trầm ấm, uy tín)',
    region: 'Toàn quốc',
    gender: 'Nam',
    pitch: 0.85,
    rate: 0.92,
    description: 'Trầm ấm, đĩnh đạc, uy tín cao, truyền tải thông tin vững chãi và đáng tin cậy',
    recommendedFor: 'Kế hoạch năm học, Thông cáo Ban Giám Hiệu, Hội đồng Sư phạm',
  },
  {
    id: 'vn_urgent_alert',
    label: 'Giọng Thông báo Khẩn cấp / Cảnh báo (Nhanh, rõ, nghiêm túc)',
    region: 'Toàn quốc',
    gender: 'Nữ',
    pitch: 1.0,
    rate: 1.15,
    description: 'Nhanh, dứt khoát, âm lượng đều, giúp phụ huynh nắm bắt thông tin quan trọng tức thì',
    recommendedFor: 'Nghỉ tránh bão, Dịch bệnh, Điều chỉnh lịch học đột xuất',
  },
];

/**
 * Tra cứu cấu hình giọng đọc theo ID hoặc Label
 */
export function getVoiceOption(idOrLabel: string): TtsVoiceOption {
  if (!idOrLabel) return TTS_VOICE_OPTIONS[0];

  const found = TTS_VOICE_OPTIONS.find(
    (v) =>
      v.id === idOrLabel ||
      v.label === idOrLabel ||
      idOrLabel.toLowerCase().includes(v.id.toLowerCase()) ||
      idOrLabel.toLowerCase().includes(v.gender.toLowerCase()) && idOrLabel.toLowerCase().includes(v.region.toLowerCase())
  );

  return found || TTS_VOICE_OPTIONS[0];
}

/**
 * Danh mục nhạc nền bản quyền sư phạm
 */
export const BACKGROUND_MUSIC_OPTIONS = [
  'Nhạc Lễ hội Thiếu nhi (Không bản quyền)',
  'Piano nhẹ nhàng (Không bản quyền)',
  'Không dùng nhạc nền',
] as const;

export type BackgroundMusicOption = (typeof BACKGROUND_MUSIC_OPTIONS)[number];
