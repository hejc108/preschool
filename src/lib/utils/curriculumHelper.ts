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
  LOP_MOT: 'Bé Vui Đến Lớp Một (Khối Lá)',
};

export interface ThemeColorPalette {
  themeCode: ThemeCode | string;
  themeName: string;
  primaryColor: string; // Hex color e.g. '#0284c7'
  accentColor: string;  // Hex color e.g. '#facc15'
  backgroundColor: string; // Hex color e.g. '#f0f9ff'
  imageStyleKeywords: string; // Keywords for AI image generation
  defaultIcon: string;
  fallbackImages: string[];
}

export const THEME_MATRIX: Record<string, ThemeColorPalette> = {
  TRUONG_MN: {
    themeCode: 'TRUONG_MN',
    themeName: 'Trường Mầm Non',
    primaryColor: '#0284c7', // Xanh biển
    accentColor: '#facc15',  // Vàng tươi
    backgroundColor: '#f0f9ff',
    imageStyleKeywords: 'classroom, toys, friendly teacher, playing kindergarten children',
    defaultIcon: '🏫',
    fallbackImages: [
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80'
    ]
  },
  BAN_THAN: {
    themeCode: 'BAN_THAN',
    themeName: 'Bản Thân & Cảm Xúc',
    primaryColor: '#ea580c', // Cam đào
    accentColor: '#fb7185',  // Hồng phấn
    backgroundColor: '#fff7ed',
    imageStyleKeywords: 'body parts, 5 senses, smiling happy kids, heart love',
    defaultIcon: '❤️',
    fallbackImages: [
      'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=800&auto=format&fit=crop&q=80'
    ]
  },
  GIA_DINH: {
    themeCode: 'GIA_DINH',
    themeName: 'Gia Đình Yêu Thương',
    primaryColor: '#dc2626', // Đỏ ấm
    accentColor: '#fde047',  // Vàng kem
    backgroundColor: '#fef2f2',
    imageStyleKeywords: 'cozy home house, loving parents with kids, family meal',
    defaultIcon: '🏡',
    fallbackImages: [
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=800&auto=format&fit=crop&q=80'
    ]
  },
  NGHE_NGHIEP: {
    themeCode: 'NGHE_NGHIEP',
    themeName: 'Nghề Nghiệp Quanh Bé',
    primaryColor: '#2563eb', // Xanh công lý
    accentColor: '#f97316',  // Cam năng động
    backgroundColor: '#eff6ff',
    imageStyleKeywords: 'doctor, soldier, engineer, teacher, protective helmet',
    defaultIcon: '👮',
    fallbackImages: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80'
    ]
  },
  DONG_VAT: {
    themeCode: 'DONG_VAT',
    themeName: 'Thế Giới Động Vật',
    primaryColor: '#92400e', // Nâu đất
    accentColor: '#65a30d',  // Xanh rêu
    backgroundColor: '#fefce8',
    imageStyleKeywords: 'pets, forest wild animals, singing birds, animal footprints',
    defaultIcon: '🐶',
    fallbackImages: [
      'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  THUC_VAT: {
    themeCode: 'THUC_VAT',
    themeName: 'Thế Giới Thực Vật',
    primaryColor: '#166534', // Xanh lá đậm
    accentColor: '#4ade80',  // Xanh mầm non
    backgroundColor: '#f0fdf4',
    imageStyleKeywords: 'seed sprout, fresh fruits and vegetables, garden, tree canopy, water drop',
    defaultIcon: '🌱',
    fallbackImages: [
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop&q=80'
    ]
  },
  GIAO_THONG: {
    themeCode: 'GIAO_THONG',
    themeName: 'Phương Tiện Giao Thông',
    primaryColor: '#e11d48', // Đỏ tín hiệu
    accentColor: '#eab308',  // Vàng đèn xe
    backgroundColor: '#f8fafc',
    imageStyleKeywords: 'cars, trains, airplanes, sailboat, traffic signs',
    defaultIcon: '🚗',
    fallbackImages: [
      'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508974239320-0a029497e820?w=800&auto=format&fit=crop&q=80'
    ]
  },
  HTTN: {
    themeCode: 'HTTN',
    themeName: 'Nước & Hiện Tượng Tự Nhiên',
    primaryColor: '#0891b2', // Xanh ngọc
    accentColor: '#38bdf8',  // Xanh da trời
    backgroundColor: '#ecfeff',
    imageStyleKeywords: 'rainbow, rain clouds, stream water, warm sunny sky',
    defaultIcon: '🌈',
    fallbackImages: [
      'https://images.unsplash.com/photo-1516571748831-5d81767bfa88?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80'
    ]
  },
  QUE_HUONG: {
    themeCode: 'QUE_HUONG',
    themeName: 'Quê Hương - Bác Hồ',
    primaryColor: '#b91c1c', // Đỏ son cờ
    accentColor: '#eab308',  // Vàng kim
    backgroundColor: '#fffbeb',
    imageStyleKeywords: 'lotus flower, Vietnam red flag yellow star, Uncle Ho mausoleum, Vietnam map',
    defaultIcon: '🇻🇳',
    fallbackImages: [
      'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1531959870249-9f9b729efcf4?w=800&auto=format&fit=crop&q=80'
    ]
  },
  LOP_MOT: {
    themeCode: 'LOP_MOT',
    themeName: 'Bé Lên Lớp Một',
    primaryColor: '#7c3aed', // Tím học thức
    accentColor: '#a3e635',  // Xanh mạ
    backgroundColor: '#faf5ff',
    imageStyleKeywords: 'school backpack, books and notebooks, pencil, clock, blackboard',
    defaultIcon: '🎒',
    fallbackImages: [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80'
    ]
  }
};

export function getThemeMatrix(themeCode?: string): ThemeColorPalette {
  if (!themeCode) return THEME_MATRIX.THUC_VAT;
  return THEME_MATRIX[themeCode] || THEME_MATRIX.THUC_VAT;
}

export interface ThemeArchetypeInfo {
  archetypeType: 'SCIENCE_EXPLORATION' | 'ROLEPLAY_SITUATIONS' | 'QUIZ_TRUE_FALSE';
  archetypeName: string;
  storyTitle: string;
  openerType: 'RHYMING_RIDDLE' | 'SOUND_SIMULATION' | 'MOVEMENT_GAME';
  openerHeadline: string;
  openerDetail: string;
  localizedElements: string[];
  calloutDialogue: {
    teacherAsk: string;
    childAnswer: string;
  };
}

export function getThemeArchetype(themeCode?: string): ThemeArchetypeInfo {
  const code = themeCode || 'THUC_VAT';

  if (code === 'THUC_VAT' || code === 'DONG_VAT' || code === 'NUOC_HTTN') {
    if (code === 'THUC_VAT') {
      return {
        archetypeType: 'SCIENCE_EXPLORATION',
        archetypeName: 'Thí nghiệm & Khám phá bí ẩn',
        storyTitle: '🔬 Thí Nghiệm Bí Mật Của Hạt Mầm Xanh',
        openerType: 'RHYMING_RIDDLE',
        openerHeadline: '🧩 Câu Đố Vần Điệu Mở Đầu',
        openerDetail: '🗣️ Cô đố bé: "Cây gì lá nhỏ cành xanh - Cho hoa dâng quả ngọt lành cho bé?" Trẻ cùng nhau suy đoán bí mật của hạt mầm.',
        localizedElements: ['Hoa mai vàng', 'Hoa đào hồng', 'Vườn rau sạch sân trường Sương Mai', 'Cây lúa vàng chín rộ', 'Bánh chưng lá dong'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Các nhà khoa học tí hon ơi! Đố bé biết vì sao cây lại xanh lá nhỉ?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, vì cây được uống nước mát và đón ánh nắng mặt trời ạ!"'
        }
      };
    } else if (code === 'DONG_VAT') {
      return {
        archetypeType: 'SCIENCE_EXPLORATION',
        archetypeName: 'Thí nghiệm & Khám phá bí ẩn',
        storyTitle: '🔎 Hành Trình Khám Phá Thế Giới Động Vật',
        openerType: 'MOVEMENT_GAME',
        openerHeadline: '🏃 Trò Chơi Vận Động Mô Phỏng',
        openerDetail: '🐾 Bé cùng nhún nhảy làm chú thỏ con tai dài vẫy vẫy, bắt chước dáng đi của chú trâu vàng đồng quê.',
        localizedElements: ['Chú trâu vàng đồng quê', 'Con cò trắng bay la', 'Con mèo hen góc bếp', 'Đàn gà con lông vàng'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Đố các bạn nhỏ biết chú thỏ thích ăn củ gì nhất nào?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, chú thỏ thích ăn củ cà rốt cam giòn ngon ạ!"'
        }
      };
    } else {
      return {
        archetypeType: 'SCIENCE_EXPLORATION',
        archetypeName: 'Thí nghiệm & Khám phá bí ẩn',
        storyTitle: '🌈 Kỳ Diệu Nước & Các Hiện Tượng Tự Nhiên',
        openerType: 'SOUND_SIMULATION',
        openerHeadline: '🎧 Âm Thanh Mô Phỏng Tự Nhiên',
        openerDetail: '☔ "Tí tách! Tí tách! Tiếng giọt mưa rơi xuống tán lá reo ca!" Trẻ lắng nghe âm thanh và đoán hiện tượng thời tiết.',
        localizedElements: ['Giọt sương mai trên lá', 'Cầu vồng rực rỡ sau mưa', 'Ánh nắng ban mai ấm áp', 'Dòng suối mát lành'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Sau cơn mưa rào, trên bầu trời xuất hiện dải cầu vồng mấy màu các bé nhỉ?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, cầu vồng có 7 màu rực rỡ lấp lánh ạ!"'
        }
      };
    }
  } else if (code === 'GIAO_THONG' || code === 'QUE_HUONG') {
    if (code === 'GIAO_THONG') {
      return {
        archetypeType: 'QUIZ_TRUE_FALSE',
        archetypeName: 'Trò chơi Đố vui phản xạ Đúng - Sai',
        storyTitle: '🚨 Thử Thách Hiệp Sĩ Giao Thông An Toàn',
        openerType: 'SOUND_SIMULATION',
        openerHeadline: '🔊 Phản Xạ Âm Thanh Giao Thông',
        openerDetail: '🚗 "Bíp bíp! Xình xịch! Tiếng còi xe ô tô và tàu hỏa reo vang!" Bé tinh mắt nhận diện phương tiện và biển báo.',
        localizedElements: ['Mũ bảo hiểm xe máy đạt chuẩn', 'Vạch sang đường cho người đi bộ', 'Chú cảnh sát giao thông còi hiệu', 'Xe bus trường Sương Mai'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Đèn đỏ bật sáng trên đường, đội hiệp sĩ giao thông sẽ làm gì?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, ĐÃ ĐÈN ĐỎ LÀ BẮT BUỘC PHẢI DỪNG LẠI NGAY Ạ!"'
        }
      };
    } else {
      return {
        archetypeType: 'QUIZ_TRUE_FALSE',
        archetypeName: 'Trò chơi Đố vui phản xạ Đúng - Sai',
        storyTitle: '🇻🇳 Thử Thách Hiệp Sĩ Quê Hương - Bác Hồ Kính Yêu',
        openerType: 'RHYMING_RIDDLE',
        openerHeadline: '🧩 Câu Đố Vần Điệu Yêu Nước',
        openerDetail: '🗣️ "Bông hoa nào nở trong hồ - Tỏa hương thơm ngát Bác Hồ yêu thương?" Trẻ cùng giải đố bài ca quê hương.',
        localizedElements: ['Hoa sen hồng ngát hương', 'Lăng Bác Hồ kính yêu', 'Cờ đỏ sao vàng tung bay', 'Áo dài truyền thống Việt Nam'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Bác Hồ yêu thương ai nhất trong cả nước chúng mình?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, Bác Hồ yêu thương các cháu thiếu niên mầm non nhất ạ!"'
        }
      };
    }
  } else {
    if (code === 'NGHE_NGHIEP') {
      return {
        archetypeType: 'ROLEPLAY_SITUATIONS',
        archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
        storyTitle: '👩‍⚕️ Biệt Đội Nhập Vai Khám Phá Nghề Nghiệp',
        openerType: 'MOVEMENT_GAME',
        openerHeadline: '🎭 Nhập Vai Hành Quân & Khám Bệnh',
        openerDetail: '🎖️ Bé khoác áo chú bộ đội hành quân nghiêm trang hoặc đeo ống nghe làm bác sĩ tí hon chữa bệnh.',
        localizedElements: ['Chú bộ đội Cụ Hồ mũ cờ sao vàng', 'Cô giáo mầm non Sương Mai', 'Bác sĩ áo blouse trắng', 'Kỹ sư công trình mũ bảo hộ'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Khi có người cần giúp đỡ, chú bộ đội Cụ Hồ và bác sĩ sẽ làm gì?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, chú bộ đội và bác sĩ sẵn sàng giúp đỡ và chăm sóc mọi người ạ!"'
        }
      };
    } else if (code === 'GIA_DINH') {
      return {
        archetypeType: 'ROLEPLAY_SITUATIONS',
        archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
        storyTitle: '🏡 Nhập Vai Bữa Cơm Gia Đình Yêu Thương',
        openerType: 'RHYMING_RIDDLE',
        openerHeadline: '🧩 Câu Đố Vần Điệu Ấm Cúng',
        openerDetail: '🗣️ "Ai nấu cơm ngon, chăm bé ngoan - Yêu thương che chở suốt bao ngày?" Trẻ đoán câu đố về Bố Mẹ.',
        localizedElements: ['Bữa cơm gia đình Việt Nam sum vầy', 'Mâm ngũ quả ngày Tết', 'Ngôi nhà ấm cúng', 'Bánh chưng xanh gói lá dong'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Khi đi học về, bé nhập vai ngoan ngoãn sẽ chào ai đầu tiên?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, con khoanh tay lễ phép chào Ông Bà và Bố Mẹ ạ!"'
        }
      };
    } else if (code === 'BAN_THAN') {
      return {
        archetypeType: 'ROLEPLAY_SITUATIONS',
        archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
        storyTitle: '😃 Biệt Đội Cảm Xúc & 5 Giác Quan',
        openerType: 'MOVEMENT_GAME',
        openerHeadline: '🏃 Vận Động Cơ Thể & Nụ Cười',
        openerDetail: '🖐️ Bé lắc lư cái đầu, xòe 10 ngón tay nhỏ xinh và cười thật tươi thể hiện các cảm xúc vui buồn.',
        localizedElements: ['Nụ cười rạng rỡ của bé', 'Đôi bàn tay nhỏ ngoan', 'Trái tim yêu thương', '5 giác quan tinh mắt'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Khi gặp niềm vui hoặc được cô khen, gương mặt bé thể hiện thế nào?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, bé mỉm cười rạng rỡ và mắt sáng long lanh ạ!"'
        }
      };
    } else if (code === 'LOP_MOT') {
      return {
        archetypeType: 'ROLEPLAY_SITUATIONS',
        archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
        storyTitle: '🎒 Nhập Vai Học Sinh Lớp 1 Tự Tin',
        openerType: 'RHYMING_RIDDLE',
        openerHeadline: '🧩 Câu Đố Bạn Nhỏ Đeo Ba Lô',
        openerDetail: '🗣️ "Cây bút chì nhỏ, cuốn sách tô màu - Đeo chiếc ba lô bước vào trường mới?" Trẻ háo hức nhập vai làm anh chị Lớp 1.',
        localizedElements: ['Ba lô siêu nhẹ', 'Bút chì & thước kẻ', 'Sách tô màu & bảng đen', 'Đồng hồ báo thức đúng giờ'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Để làm học sinh Lớp 1 ngoan, tối đến bé cần chuẩn bị đồ dùng gì?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, bé tự soạn sách vở, hộp bút vào ba lô gọn gàng ạ!"'
        }
      };
    } else {
      return {
        archetypeType: 'ROLEPLAY_SITUATIONS',
        archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
        storyTitle: '🏫 Nhập Vai Bé Ngoan Trường Sương Mai',
        openerType: 'RHYMING_RIDDLE',
        openerHeadline: '🧩 Câu Đố Mái Trường Thân Yêu',
        openerDetail: '🗣️ "Trường gì rợp mát hoa tươi - Cô yêu bạn quý nụ cười hân hoan?" Trẻ tự hào kể về Trường Mầm Non Sương Mai.',
        localizedElements: ['Góc sân trường Sương Mai xanh mát', 'Đồ chơi dân gian', 'Góc thư viện mầm non', 'Cờ bé ngoan khen tặng'],
        calloutDialogue: {
          teacherAsk: '🗣️ Cô hỏi: "Đến lớp Sương Mai, khi chơi xong đồ chơi bé phải làm gì?"',
          childAnswer: '👦 Trẻ đáp: "Thưa cô, bé tự giác xếp đồ chơi ngăn nắp vào giá kệ ạ!"'
        }
      };
    }
  }
}

export const GRADE_LEVEL_MAP: Record<GradeLevelCode, { label: string; duration: string }> = {
  NHA_TRE: { label: 'Nhà Trẻ (12-36 tháng)', duration: '12-15 phút' },
  MAM: { label: 'Mầm (3-4 tuổi)', duration: '15-20 phút' },
  CHOI: { label: 'Chồi (4-5 tuổi)', duration: '20-25 phút' },
  LA: { label: 'Lá (5-6 tuổi)', duration: '25-30 phút' },
};

export const SUBJECT_NAME_MAP: Record<string, string> = {
  NBTN: 'Nhận biết tập nói (NBTN)',
  HDVDV: 'Hoạt động với đồ vật (HĐVĐV)',
  KPKH: 'Khám phá khoa học (KPKH)',
  LQVT: 'Làm quen với toán (LQVT)',
  LQCC: 'Làm quen chữ cái (LQCC)',
  LQVH: 'Làm quen văn học / Kể chuyện (LQVH)',
  TAO_HINH: 'Tạo hình & Khéo tay (TẠO HÌNH)',
  LQAN: 'Giáo dục âm nhạc (LQÂN)',
  PTVĐ: 'Phát triển vận động (PTVĐ)',
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

export const SUB_THEME_MAP: Record<ThemeCode, string[]> = {
  TRUONG_MN: ['Lớp học mầm non của bé', 'Đồ chơi & Thiết bị ngoài trời', 'Cô giáo & Các bạn thân yêu'],
  BAN_THAN: ['Cơ thể tôi khéo léo', 'Tôi cần gì để lớn lên', 'Cảm xúc của bé'],
  GIA_DINH: ['Ngôi nhà thân yêu', 'Đồ dùng trong gia đình', 'Nhu cầu của gia đình'],
  NGHE_NGHIEP: ['Nghề sản xuất (Nông dân, Thợ xây)', 'Nghề dịch vụ (Bác sĩ, Giáo viên, Công an)', 'Ước mơ tương lai'],
  DONG_VAT: ['Vật nuôi gia đình (Mèo, Chó, Gà)', 'Động vật sống dưới nước', 'Động vật hoang dã trong rừng'],
  THUC_VAT: ['Rau củ vitamin', 'Các loài hoa rực rỡ', 'Cây xanh & Quả ngọt'],
  GIAO_THONG: ['Phương tiện giao thông đường bộ', 'Phương tiện đường thủy & hàng không', 'Luật giao thông đường phố'],
  HTTN: ['Nước & Các hiện tượng thời tiết', 'Mặt trời, Mặt trăng & Các mùa', 'Không khí & Năng lượng sạch'],
  QUE_HUONG: ['Quê hương Sương Mai', 'Thủ đô Hà Nội & Bác Hồ', 'Bản sắc văn hóa Việt Nam'],
  LOP_MOT: ['Đồ dùng học tập của học sinh lớp 1', 'Trường tiểu học thân yêu', 'Tâm thế tự tin vào lớp 1'],
};

export function getFrameworkByGradeAndTheme(grade: GradeLevelCode, theme: ThemeCode): CurriculumFramework {
  const found = INITIAL_CURRICULUM_FRAMEWORKS.find(
    (cf) => cf.grade_level === grade && cf.theme_code === theme
  ) || INITIAL_CURRICULUM_FRAMEWORKS.find((cf) => cf.grade_level === grade) || INITIAL_CURRICULUM_FRAMEWORKS[0];
  return found;
}

/**
 * Dynamic Material Engine: Generates subject-specific and topic-relevant material suggestions
 */
export function getDynamicMaterialSuggestions(
  subject: string,
  topic: string = '',
  grade: GradeLevelCode = 'LA'
): { teacher: string[]; students: string[]; allTags: string[] } {
  const normSubject = subject.toUpperCase();
  const lowerTopic = topic.toLowerCase();

  let teacherMats: string[] = [];
  let studentMats: string[] = [];

  if (normSubject.includes('KPKH') || normSubject.includes('KHÁM PHÁ')) {
    teacherMats = ['Máy tính SmartTV', 'Mô hình trực quan sa bàn', 'Video clip thực tế', 'Tranh lô tô phóng to'];
    if (lowerTopic.includes('cây') || lowerTopic.includes('thực vật') || lowerTopic.includes('nảy mầm')) {
      studentMats = ['Hạt đỗ xanh', 'Cốc nhựa trong', 'Bông gòn y tế', 'Nước sạch', 'Khay nhựa thực hành'];
    } else if (lowerTopic.includes('giao thông') || lowerTopic.includes('xe') || lowerTopic.includes('ô tô')) {
      studentMats = ['Rổ lô tô phương tiện giao thông', 'Mô hình xe đồ chơi', 'Tranh bóc dán', 'Vô lăng nhựa', 'Mũ bảo hiểm trẻ em'];
    } else if (lowerTopic.includes('động vật') || lowerTopic.includes('con vật')) {
      studentMats = ['Rổ lô tô các con vật', 'Mô hình động vật nhựa', 'Tranh lật ghép hình', 'Thức ăn mô hình cho vật nuôi'];
    } else if (lowerTopic.includes('nước') || lowerTopic.includes('thí nghiệm') || lowerTopic.includes('lọc')) {
      studentMats = ['Chai nhựa 500ml cắt đôi', 'Sỏi to', 'Sỏi nhỏ', 'Cát sạch', 'Than hoạt tính', 'Bông y tế'];
    } else {
      studentMats = ['Rổ lô tô học liệu khám phá', 'Kính lúp nhựa', 'Tranh bóc dán trải nghiệm', 'Khay nhóm thực hành'];
    }
  } else if (normSubject.includes('LQVT') || normSubject.includes('TOÁN')) {
    teacherMats = ['Mô hình trực quan số lượng lớn', 'Thẻ chữ số 1-10 phóng to', 'Bảng nỉ tương tác của cô', 'Video bài tập toán'];
    studentMats = ['Rổ đồ dùng con vật/quả nhựa', 'Bộ thẻ chữ số tương ứng', 'Que tính', 'Hạt bắp/sỏi sạch', 'Bảng con & phấn'];
  } else if (normSubject.includes('LQCC') || normSubject.includes('CHỮ CÁI')) {
    teacherMats = ['Bộ thẻ chữ in hoa/in thường/viết thường phóng to', 'Rổ nét chữ rời của cô', 'Tranh từ khóa gạch chân chữ cái'];
    studentMats = ['Thẻ chữ cái của trẻ', 'Dây điện mềm uốn chữ', 'Hạt bắp/sỏi để xếp chữ', 'Bảng con', 'Đất nặn uốn nét chữ'];
  } else if (normSubject.includes('TAO_HINH') || normSubject.includes('TẠO HÌNH')) {
    teacherMats = ['Tranh mẫu hoàn thiện của cô (3 mẫu)', 'Giá treo tranh triển lãm', 'Vật thật mẫu trực quan', 'Nhạc không lời thư giãn'];
    if (lowerTopic.includes('vẽ') || lowerTopic.includes('tô')) {
      studentMats = ['Giấy vẽ A4', 'Hộp sáp màu', 'Bút chì', 'Gọt tẩy', 'Khăn lau tay'];
    } else if (lowerTopic.includes('nặn') || lowerTopic.includes('bánh')) {
      studentMats = ['Đất nặn nhiều màu', 'Bảng con nặn', 'Dao nhựa bo tròn', 'Đĩa nhựa đựng sản phẩm', 'Khăn lau tay ẩm'];
    } else if (lowerTopic.includes('xé') || lowerTopic.includes('dán') || lowerTopic.includes('cắt')) {
      studentMats = ['Giấy màu các loại', 'Hồ dán thủ công', 'Kéo đầu tròn an toàn', 'Giấy nền A4', 'Khăn lau tay'];
    } else {
      studentMats = ['Giấy màu A4', 'Hồ dán', 'Sáp màu', 'Kéo đầu tròn', 'Đất nặn nhiều màu', 'Bảng con'];
    }
  } else if (normSubject.includes('LQAN') || normSubject.includes('ÂM NHẠC')) {
    teacherMats = ['Đàn piano/organ', 'Nhạc beat chất lượng cao', 'SmartTV clip bài hát', 'Trang phục múa mẫu'];
    studentMats = ['Phách tre', 'Xắc xô', 'Trống lắc mini', 'Hoa đeo tay biểu diễn', 'Nơ tay múa', 'Mũ múa hóa trang'];
  } else if (normSubject.includes('PTVĐ') || normSubject.includes('VẬN ĐỘNG')) {
    teacherMats = ['Ghế thể dục mầm non', 'Vạch chuẩn xuất phát', 'Nhạc khởi động/hồi tĩnh', 'Còi thể thao'];
    studentMats = ['Trang phục thể thao gọn gàng', 'Bóng nhựa nhiều màu', 'Túi cát thể dục', 'Cờ dây nhiều màu'];
  } else if (normSubject.includes('NBTN') || normSubject.includes('NHẬN BIẾT TẬP NÓI')) {
    teacherMats = ['Hộp quà kỳ diệu', 'Đồ chơi phát tiếng nhạc/chuyển động', 'Vật thật to màu sắc nổi bật'];
    studentMats = ['Bóng nhựa to màu đỏ/vàng', 'Khối gỗ xếp hình', 'Búp bê vải', 'Tranh lô tô nhận biết'];
  } else if (normSubject.includes('HDVDV') || normSubject.includes('HOẠT ĐỘNG VỚI ĐỒ VẬT')) {
    teacherMats = ['Tháp xếp chồng mẫu', 'Hộp thả hình khối', 'Bảng lồng khay hạt'];
    studentMats = ['Vòng nhựa nhiều màu', 'Khối gỗ hình vuông/tròn', 'Khay hạt xỏ dây', 'Tháp nhựa 5 tầng'];
  } else if (normSubject.includes('LQVH') || normSubject.includes('VĂN HỌC') || normSubject.includes('KỂ CHUYỆN')) {
    teacherMats = ['Rối tay nhân vật truyện', 'Sa bàn rối dẹt/rối que', 'Tranh minh họa truyện phóng to', 'Video hoạt hình câu chuyện'];
    studentMats = ['Mũ hóa trang nhân vật', 'Tranh lô tô trình tự câu chuyện', 'Trang phục đóng kịch', 'Rối ngón tay'];
  } else {
    teacherMats = ['Máy tính SmartTV', 'Tranh ảnh trực quan bài học', 'Mô hình minh họa'];
    studentMats = ['Học liệu trải nghiệm nhóm', 'Tranh bóc dán', 'Giấy màu & sáp màu'];
  }

  const allTags = Array.from(new Set([...teacherMats, ...studentMats]));
  return { teacher: teacherMats, students: studentMats, allTags };
}
