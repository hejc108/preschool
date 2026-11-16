// ==============================================================================
// src/lib/announcements/ttsDictionary.ts
// Bộ chuẩn hóa phát âm tiếng Việt cho Giọng đọc AI (TTS Pronunciation Engine)
// Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

export interface TtsRule {
  id?: string;
  keyword: string;
  spoken_text: string;
  category?: 'ACRONYM' | 'DATE_TIME' | 'CONTACT' | 'COMMON' | string;
  is_active?: boolean;
}

/**
 * Danh mục quy tắc từ điển phát âm mặc định của trường
 */
export const DEFAULT_TTS_RULES: TtsRule[] = [
  { keyword: 'BGH', spoken_text: 'Ban Giám Hiệu', category: 'ACRONYM', is_active: true },
  { keyword: 'CBQL', spoken_text: 'Cán bộ quản lý', category: 'ACRONYM', is_active: true },
  { keyword: 'GVMN', spoken_text: 'Giáo viên mầm non', category: 'ACRONYM', is_active: true },
  { keyword: 'UBND', spoken_text: 'Ủy ban nhân dân', category: 'ACRONYM', is_active: true },
  { keyword: 'PHHS', spoken_text: 'Phụ huynh học sinh', category: 'ACRONYM', is_active: true },
  { keyword: 'STK', spoken_text: 'Số tài khoản', category: 'COMMON', is_active: true },
  { keyword: 'SĐT', spoken_text: 'Số điện thoại', category: 'CONTACT', is_active: true },
  { keyword: 'TP', spoken_text: 'Thành phố', category: 'COMMON', is_active: true },
  { keyword: 'VN', spoken_text: 'Việt Nam', category: 'COMMON', is_active: true },
  { keyword: '20-11', spoken_text: 'ngày 20 tháng 11', category: 'DATE_TIME', is_active: true },
  { keyword: '20/11', spoken_text: 'ngày 20 tháng 11', category: 'DATE_TIME', is_active: true },
  { keyword: '8-3', spoken_text: 'ngày 8 tháng 3', category: 'DATE_TIME', is_active: true },
  { keyword: '8/3', spoken_text: 'ngày 8 tháng 3', category: 'DATE_TIME', is_active: true },
  {
    keyword: 'mamnonsuongmai.edu.vn',
    spoken_text: 'mầm non sương mai chấm e đu chấm vê en',
    category: 'CONTACT',
    is_active: true,
  },
  {
    keyword: '0262.352.1234',
    spoken_text: 'không hai sáu hai, ba năm hai, một hai ba bốn',
    category: 'CONTACT',
    is_active: true,
  },
  {
    keyword: '0262 352 1234',
    spoken_text: 'không hai sáu hai, ba năm hai, một hai ba bốn',
    category: 'CONTACT',
    is_active: true,
  },
];

const VIETNAMESE_DIGITS: Record<string, string> = {
  '0': 'không',
  '1': 'một',
  '2': 'hai',
  '3': 'ba',
  '4': 'bốn',
  '5': 'năm',
  '6': 'sáu',
  '7': 'bảy',
  '8': 'tám',
  '9': 'chín',
};

/**
 * Đọc từng chữ số tiếng Việt theo nhịp điệu tự nhiên cho số điện thoại
 */
export function spellOutDigitsGroup(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return '';
  return clean
    .split('')
    .map((d) => VIETNAMESE_DIGITS[d] || d)
    .join(' ');
}

/**
 * Chuẩn hóa số điện thoại Việt Nam thành chuỗi phát âm ngắt nhịp
 * Ví dụ: "0262.352.1234" hoặc "0912345678" -> "không chín một hai, ba bốn năm, sáu bảy tám"
 */
export function normalizePhoneNumbers(text: string): string {
  // Regex bắt các dạng số điện thoại 10-11 số có thể có dấu chấm, cách, gạch ngang
  const phoneRegex = /(?:\+?84|0)(?:[235789])\d{1,2}[.\s-]?\d{3}[.\s-]?\d{3,4}\b/g;

  return text.replace(phoneRegex, (match) => {
    // Lấy chuỗi chỉ gồm số
    const raw = match.replace(/\D/g, '');
    if (raw.length === 10) {
      // Dạng 4 - 3 - 3 hoặc 3 - 3 - 4
      const p1 = spellOutDigitsGroup(raw.slice(0, 4));
      const p2 = spellOutDigitsGroup(raw.slice(4, 7));
      const p3 = spellOutDigitsGroup(raw.slice(7));
      return `${p1}, ${p2}, ${p3}`;
    } else if (raw.length === 11) {
      // Số bàn tỉnh (vd: 0262 352 1234)
      const p1 = spellOutDigitsGroup(raw.slice(0, 4));
      const p2 = spellOutDigitsGroup(raw.slice(4, 7));
      const p3 = spellOutDigitsGroup(raw.slice(7));
      return `${p1}, ${p2}, ${p3}`;
    }
    return spellOutDigitsGroup(raw);
  });
}

/**
 * Chuẩn hóa giờ giấc tự nhiên
 * Ví dụ:
 *  - "07:30" -> "7 giờ 30 phút"
 *  - "18:00" -> "18 giờ"
 *  - "7h45" hoặc "7h 45" -> "7 giờ 45 phút"
 *  - "19h" -> "19 giờ"
 */
export function normalizeTimeFormat(text: string): string {
  let res = text;

  // Dạng 07:30 hoặc 14:05
  res = res.replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, h, m) => {
    const hourNum = parseInt(h, 10);
    const minNum = parseInt(m, 10);
    if (hourNum >= 0 && hourNum <= 24 && minNum >= 0 && minNum < 60) {
      if (minNum === 0) return `${hourNum} giờ`;
      return `${hourNum} giờ ${minNum} phút`;
    }
    return _match;
  });

  // Dạng 7h45, 7h 45, 8h
  res = res.replace(/\b(\d{1,2})h\s*(\d{1,2})?\b/gi, (_match, h, m) => {
    const hourNum = parseInt(h, 10);
    if (hourNum >= 0 && hourNum <= 24) {
      if (!m || parseInt(m, 10) === 0) {
        return `${hourNum} giờ`;
      }
      return `${hourNum} giờ ${parseInt(m, 10)} phút`;
    }
    return _match;
  });

  return res;
}

/**
 * Chuẩn hóa ngày tháng tự nhiên
 * Ví dụ:
 *  - "20/11/2026" hoặc "20-11-2026" -> "ngày 20 tháng 11 năm 2026"
 *  - "20/11" (nếu chưa match) -> "ngày 20 tháng 11"
 */
export function normalizeDateFormat(text: string): string {
  let res = text;

  // Dạng ngày/tháng/năm: 20/11/2026 hoặc 20-11-2026
  res = res.replace(/\b([0-3]?\d)[-/]([0-1]?\d)[-/](\d{4})\b/g, (_match, d, m, y) => {
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `ngày ${day} tháng ${month} năm ${y}`;
    }
    return _match;
  });

  // Dạng ngày/tháng không có năm: 20/11 hoặc 20-11 (tránh trường hợp số chia hoặc phép trừ)
  res = res.replace(/(?:\b|thứ\s+[^\s]+,\s*)([0-3]?\d)[-/]([0-1]?\d)\b/gi, (match, d, m) => {
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      // Kiểm tra nếu trước đó đã có chữ "ngày" thì không thêm "ngày" nữa
      if (match.toLowerCase().includes('ngày')) {
        return `${day} tháng ${month}`;
      }
      return `ngày ${day} tháng ${month}`;
    }
    return match;
  });

  return res;
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Hàm chuẩn hóa tổng thể: Chuyển đổi văn bản thông báo thành lời đọc AI trôi chảy
 * Áp dụng theo thứ tự ưu tiên:
 * 1. Từ điển tùy chỉnh từ Database / danh sách cấu hình
 * 2. Số điện thoại & Hotline
 * 3. Giờ giấc (7h 45, 07:30)
 * 4. Ngày tháng (20/11/2026)
 */
export function normalizeVietnameseSpeech(
  rawText: string,
  customRules: TtsRule[] = []
): string {
  if (!rawText) return '';

  let text = rawText;

  // Hợp nhất từ điển (ưu tiên customRules lên trước, sau đó là default)
  const allRulesMap = new Map<string, TtsRule>();
  DEFAULT_TTS_RULES.forEach((r) => {
    if (r.is_active !== false) allRulesMap.set(r.keyword.toLowerCase(), r);
  });
  customRules.forEach((r) => {
    if (r.is_active !== false) {
      allRulesMap.set(r.keyword.toLowerCase(), r);
    } else {
      allRulesMap.delete(r.keyword.toLowerCase());
    }
  });

  // Sắp xếp các từ khóa theo độ dài giảm dần để match từ dài trước
  const sortedRules = Array.from(allRulesMap.values()).sort(
    (a, b) => b.keyword.length - a.keyword.length
  );

  // 1. Áp dụng quy tắc từ điển
  sortedRules.forEach((rule) => {
    const escaped = escapeRegex(rule.keyword);
    // Nếu keyword chứa ký tự đặc biệt như dấu chấm, gạch ngang thì không dùng \b ở 2 đầu
    const hasWordBoundary = /^[a-zA-Z0-9À-ỹ]+$/.test(rule.keyword);
    const regexPattern = hasWordBoundary ? `\\b${escaped}\\b` : escaped;
    const regex = new RegExp(regexPattern, 'gi');
    text = text.replace(regex, rule.spoken_text);
  });

  // 2. Chuẩn hóa số điện thoại
  text = normalizePhoneNumbers(text);

  // 3. Chuẩn hóa ngày tháng
  text = normalizeDateFormat(text);

  // 4. Chuẩn hóa giờ giấc
  text = normalizeTimeFormat(text);

  // 5. Dọn dẹp khoảng trắng thừa & dấu câu lặp
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?:])/g, '$1')
    .trim();

  return text;
}
