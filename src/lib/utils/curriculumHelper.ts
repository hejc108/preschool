// Curriculum Framework Helper & Preprocessed Seed Data for Mam Non Suong Mai Kindergarten
import { CurriculumFramework, GradeLevelCode, ThemeCode, SubjectCode } from '../types/schema';

export const THEME_NAME_MAP: Record<ThemeCode, string> = {
  TRUONG_MN: 'Trường Mầm Nông Sương Mai',
  BAN_THAN: 'Bản Thân Tôi & Các Bạn',
  GIA_DINH: 'Gia Đình Thân Yêu',
  NGHE_NGHIEP: 'Ước Mơ & Các Nghề Nghiệp',
  DONG_VAT: 'Thế Giới Động Vật Vui Nhộn',
  THUC_VAT: 'Thực Vật & Cây Xanh Quanh Bé',
  GIAO_THONG: 'Phương Tiện & Luật Giao Thông',
  HTTN: 'Hiện Tượng Tự Nhiên & Thời Tiết',
  QUE_HUONG: 'Quê Hương & Đất Nước Việt Nam',
};

export const GRADE_LEVEL_MAP: Record<GradeLevelCode, { label: string; duration: string }> = {
  NHA_TRE: { label: 'Nhà Trẻ (12-36 tháng)', duration: '12-15 phút' },
  MAM: { label: 'Mầm (3-4 tuổi)', duration: '15-20 phút' },
  CHOI: { label: 'Chồi (4-5 tuổi)', duration: '20-25 phút' },
  LA: { label: 'Lá (5-6 tuổi)', duration: '25-30 phút' },
};

export const SUBJECT_NAME_MAP: Record<string, string> = {
  NBTN: 'Nhận biết tập nói (Nhà Trẻ)',
  HDVDV: 'Hoạt động với đồ vật (Nhà Trẻ)',
  KPKH: 'Khám phá khoa học',
  LQVT: 'Làm quen với toán',
  LQCC: 'Làm quen chữ cái',
  LQVH: 'Làm quen văn học / Kể chuyện',
  TAO_HINH: 'Tạo hình & Khéo tay',
  LQAN: 'Làm quen âm nhạc & Vận động',
  PTVĐ: 'Phát triển vận động',
};

export const INITIAL_CURRICULUM_FRAMEWORKS: CurriculumFramework[] = [
  // 1. NHÀ TRẺ (12-36 Tháng) - NBTN / HDVDV
  {
    id: 'cf-nt-1',
    grade_level: 'NHA_TRE',
    theme_code: 'TRUONG_MN',
    theme_name: 'Trường Mầm Nông Sương Mai',
    sub_theme: 'Lớp học của bé',
    subject: 'NBTN',
    target_duration: '12-15 phút',
    pedagogical_model: '3_STEPS_TRADITIONAL',
    standard_topic: 'Nhận biết Đồ chơi mầm non',
    pedagogical_guidelines: {
      steam_objectives: {
        science: 'Trẻ gọi đúng tên 2-3 đồ chơi mầm non quen thuộc (bóng, búp bê, ô tô).',
        technology: 'Quan sát đồ chơi phát tiếng nhạc hoặc chuyển động.',
        engineering: 'Xếp chồng 3-4 khối gỗ thành tháp cao.',
        art: 'Tô màu hoặc nhận biết màu đỏ, màu vàng của quả bóng.',
        math: 'Phân biệt to - nhỏ của đồ chơi.',
      },
      basic_materials: ['Bóng nhựa màu đỏ/vàng', 'Khối gỗ xếp hình', 'Búp bê vải', 'Hộp quà kỳ diệu'],
      key_vocabulary: ['Quả bóng', 'Màu đỏ', 'Màu vàng', 'Xếp tháp', 'Búp bê'],
      songs_or_poems: ['Bài hát "Đi học về"', 'Bài thơ "Bàn tay cô giáo"'],
      interactive_games: ['Trò chơi "Cái túi kỳ diệu"', 'Trò chơi "Bắt bóng lăn"'],
    },
  },
  {
    id: 'cf-nt-2',
    grade_level: 'NHA_TRE',
    theme_code: 'DONG_VAT',
    theme_name: 'Thế Giới Động Vật Vui Nhộn',
    sub_theme: 'Vật nuôi gia đình',
    subject: 'NBTN',
    target_duration: '12-15 phút',
    pedagogical_model: '3_STEPS_TRADITIONAL',
    standard_topic: 'Con Mèo & Con Chó nhỏ',
    pedagogical_guidelines: {
      steam_objectives: {
        science: 'Nhận biết tiếng kêu "meo meo", "gâu gâu" và điểm nổi bật (tai, đuôi).',
        technology: 'Nghe băng tiếng kêu động vật.',
        engineering: 'Vuốt ve gấu bông hình mèo, chó.',
        art: 'Bắt chước dáng đi của con mèo.',
        math: 'Nhận biết 1 con chó - nhiều con mèo.',
      },
      basic_materials: ['Mô hình gấu bông mèo/chó', 'File âm thanh tiếng kêu động vật'],
      key_vocabulary: ['Con mèo', 'Con chó', 'Meo meo', 'Gâu gâu', 'Lông mịn'],
      songs_or_poems: ['Bài hát "Meo meo rửa mặt như mèo"', 'Bài thơ "Con gà con"'],
      interactive_games: ['Trò chơi "Bắt chước tiếng kêu"', 'Trò chơi "Tìm nhà cho bé mèo"'],
    },
  },

  // 2. MẦM (3-4 Tuổi) - KPKH / TAO_HINH / LQAN
  {
    id: 'cf-mam-1',
    grade_level: 'MAM',
    theme_code: 'THUC_VAT',
    theme_name: 'Thực Vật & Cây Xanh Quanh Bé',
    sub_theme: 'Rau củ vitamin',
    subject: 'KPKH',
    target_duration: '15-20 phút',
    pedagogical_model: '3_STEPS_TRADITIONAL',
    standard_topic: 'Khám phá Củ Cà Rốt & Củ Khoai Tây',
    pedagogical_guidelines: {
      steam_objectives: {
        science: 'Trẻ gọi tên, nhận biết màu cam của củ cà rốt, màu vàng của củ khoai tây và lột vỏ.',
        technology: 'Sử dụng khuôn cắt inox an toàn cắt hình củ quả.',
        engineering: 'Xếp sọt đựng củ quả theo phân loại.',
        art: 'In hình củ cà rốt bằng màu nước từ vắt cắt củ.',
        math: 'Đếm từ 1 đến 3 củ cà rốt.',
      },
      basic_materials: ['Củ cà rốt thật', 'Củ khoai tây thật', 'Dao nhựa an toàn', 'Màu nước vắt in'],
      key_vocabulary: ['Củ cà rốt', 'Màu cam', 'Vitamin A', 'Củ khoai tây', 'Tròn mịn'],
      songs_or_poems: ['Bài thơ "Bắp cải xanh"', 'Bài hát "Quả gì"'],
      interactive_games: ['Trò chơi "Thỏ đi tìm cà rốt"', 'Trò chơi "Nếm thử vị củ quả"'],
    },
  },

  // 3. CHỒI (4-5 Tuổi) - LQVT / LQVH / 5E STEAM
  {
    id: 'cf-choi-1',
    grade_level: 'CHOI',
    theme_code: 'GIAO_THONG',
    theme_name: 'Phương Tiện & Luật Giao Thông',
    sub_theme: 'Phương tiện đường bộ',
    subject: 'KPKH',
    target_duration: '20-25 phút',
    pedagogical_model: '5E_STEAM',
    standard_topic: 'Chế tạo Xe Ô Tô Đồ Chơi Tải Nặng',
    pedagogical_guidelines: {
      steam_objectives: {
        science: 'Trẻ hiểu nguyên lý di chuyển của bánh xe tròn giúp giảm ma sát kéo tải.',
        technology: 'Sử dụng ống hút, nắp chai nhựa, nắp chai và băng dính.',
        engineering: 'Lắp ráp bánh xe vào trục sao cho 4 bánh thăng bằng không chạm gầm.',
        art: 'Trang trí ô tô bằng giấy màu rực rỡ.',
        math: 'Đo khoảng cách xe chạy bằng thước đo vạch (10-30 cm).',
      },
      basic_materials: ['Vỏ hộp sữa giấy', 'Nắp chai nhựa', 'Que xiên gỗ', 'Ống hút giấy', 'Thước đo'],
      key_vocabulary: ['Bánh xe tròn', 'Trục bánh xe', 'Thăng bằng', 'Chuyển động', 'Khoảng cách'],
      songs_or_poems: ['Bài hát "Em tập lái ô tô"', 'Bài thơ "Đèn giao thông"'],
      interactive_games: ['Trò chơi "Thử nghiệm tải trọng"', 'Trò chơi "Đua xe trên dốc"'],
    },
  },

  // 4. LÁ (5-6 Tuổi) - 5E STEAM / PBL DỰ ÁN HỌC TẬP
  {
    id: 'cf-la-1',
    grade_level: 'LA',
    theme_code: 'HTTN',
    theme_name: 'Hiện Tượng Tự Nhiên & Thời Tiết',
    sub_theme: 'Nước & Năng lượng sạch',
    subject: 'KPKH',
    target_duration: '25-30 phút',
    pedagogical_model: '5E_STEAM',
    standard_topic: 'Dự án chế tạo Máy Lọc Nước Mini Cho Lớp Học',
    pedagogical_guidelines: {
      steam_objectives: {
        science: 'Trẻ quan sát nước đục và hiểu nguyên lý lọc nước qua các tầng vật liệu (sỏi, cát, bông).',
        technology: 'Sử dụng chai nhựa cắt đôi, giấy lọc màng cotton.',
        engineering: 'Thiết kế dải 4 tầng vật liệu lọc theo kích thước hạt từ to đến nhỏ.',
        art: 'Vẽ sơ đồ quy trình lọc nước 4 tầng và dán nhãn cho chai.',
        math: 'Đo thể tích nước trước và sau khi lọc (100ml vs 80ml).',
      },
      basic_materials: ['Chai nhựa 500ml cắt đôi', 'Sỏi to', 'Sỏi nhỏ', 'Cát sạch', 'Than hoạt tính', 'Bông y tế'],
      key_vocabulary: ['Lọc nước', 'Tầng vật liệu', 'Sỏi cát', 'Nước trong', 'Thể tích ml'],
      songs_or_poems: ['Bài hát "Cho tôi đi làm mưa với"', 'Bài thơ "Giọt nước tí xíu"'],
      interactive_games: ['Trò chơi "Thí nghiệm nước trong - nước đục"', 'Trò chơi "Rót nước không tràn"'],
    },
  },
];

export function getFrameworkByGradeAndTheme(grade: GradeLevelCode, theme: ThemeCode): CurriculumFramework | undefined {
  return INITIAL_CURRICULUM_FRAMEWORKS.find(
    (cf) => cf.grade_level === grade && cf.theme_code === theme
  ) || INITIAL_CURRICULUM_FRAMEWORKS.find((cf) => cf.grade_level === grade) || INITIAL_CURRICULUM_FRAMEWORKS[0];
}
