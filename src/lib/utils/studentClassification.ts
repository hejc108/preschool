/**
 * Helper phân loại Học sinh Chính quy (170 bé) & Học sinh ngoài danh sách (21 bé)
 * Căn cứ theo danh bạ gốc: DANH BẠ HỌC SINH 2026-2027.xlsx
 */

export const OFFICIAL_CLASS_QUOTAS: Record<string, number> = {
  'Nhà trẻ': 24,
  'Mầm': 38,
  'Chồi': 38,
  'Lá 1': 40,
  'Lá 2': 30,
};

// 21 mã học sinh thuộc sheet "HS ngoài danh sách"
export const NON_REGULAR_STUDENT_CODES = new Set([
  'SM-2026-171',
  'SM-2026-172',
  'SM-2026-173',
  'SM-2026-174',
  'SM-2026-175',
  'SM-2026-176',
  'SM-2026-177',
  'SM-2026-178',
  'SM-2026-179',
  'SM-2026-180',
  'SM-2026-181',
  'SM-2026-182',
  'SM-2026-183',
  'SM-2026-184',
  'SM-2026-185',
  'SM-2026-186',
  'SM-2026-187',
  'SM-2026-188',
  'SM-2026-189',
  'SM-2026-190',
  'SM-2026-191',
]);

// 20 tên không trùng với danh sách chính thức
const NON_REGULAR_UNIQUE_NAMES = new Set([
  'nguyễn nhã an',
  'nguyễn hoàng tuệ nhi',
  'nguyễn minh nhật',
  'trần công thuận phát',
  'đoàn phạm minh khôi',
  'nguyễn trường an',
  'nguyễn ngọc quỳnh chi',
  'lê khánh uyên',
  'lê ngọc gia tuệ',
  'võ gia phúc',
  'văn trà my',
  'lê phương minh tuệ',
  'nguyễn hoàng thiên ân',
  'phạm thanh hà',
  'huỳnh hồ bảo hoàng',
  'ai khang',
  'nguyễn ngọc an nhiên',
  'nguyễn thành anh sang',
  'nguyễn thục quyên',
  'trần ngọc như quỳnh',
]);

/**
 * Kiểm tra xem học sinh có thuộc diện "Ngoài quy chế / bổ sung" (21 bé) hay không.
 * Lưu ý đặc biệt: "Nguyễn Minh Khôi" có 2 bé:
 * - Bé chính thức ở lớp Nhà trẻ (SM-2026-011)
 * - Bé ngoài danh sách ở lớp Lá 2 (SM-2026-180)
 */
export function isNonRegularStudent(student: any, className?: string): boolean {
  if (!student) return false;
  if (student.is_non_regular === true || student.is_official === false) return true;

  const code = (student.student_code || student.code || '').trim().toUpperCase();
  if (code) {
    if (NON_REGULAR_STUDENT_CODES.has(code)) return true;
    const match = code.match(/SM-2026-(\d+)/);
    if (match && parseInt(match[1], 10) >= 171) return true;
  }

  const name = (student.full_name || '').trim().toLowerCase();
  const cName = (className || student.class_name || '').trim().toLowerCase();

  if (name === 'nguyễn minh khôi') {
    // Bé Nguyễn Minh Khôi ở Lá 2 là ngoài danh sách, ở Nhà trẻ là chính quy
    return cName.includes('lá 2') || cName.includes('la 2') || code === 'SM-2026-180';
  }

  return NON_REGULAR_UNIQUE_NAMES.has(name);
}

/**
 * Kiểm tra tiền sử dị ứng thực sự (loại bỏ chuỗi rỗng, "Không", "Không có", v.v.)
 */
export function hasRealAllergy(allergy: string | undefined | null): boolean {
  if (!allergy) return false;
  const clean = allergy.trim().toLowerCase();
  return !['không', 'none', 'không có', 'khong co', 'khong', 'bình thường', 'binh thuong', 'k co', 'ko'].includes(clean);
}

/**
 * Dịch / hiển thị tiền sử dị ứng
 */
export function translateAllergy(allergy: string | undefined | null, language: string = 'vi'): string {
  if (!hasRealAllergy(allergy)) {
    return language === 'en' ? 'Normal (No allergies)' : 'Bình thường (Không dị ứng)';
  }
  const str = allergy!.trim();
  if (language === 'en') {
    if (str.includes('Hải sản')) return 'Seafood (Shrimp, Crab)';
    if (str.includes('Sữa bò')) return "Cow's milk (Lactose)";
    if (str.includes('Đậu phụng') || str.includes('Đậu phộng')) return 'Peanuts';
  }
  return str;
}
