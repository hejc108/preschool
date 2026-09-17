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

/**
 * Auto-detect preschool theme code based on topic text keywords
 */
export function autoDetectThemeCode(topic: string, fallbackTheme: ThemeCode = 'THUC_VAT'): ThemeCode {
  if (!topic || typeof topic !== 'string') return fallbackTheme;
  const lower = topic.toLowerCase();

  if (/cảm xúc|bản thân|giác quan|bàn tay|khuôn mặt|mắt|mũi|tai|cơ thể|nụ cười|bé vui|tự tin|tình cảm/.test(lower)) {
    return 'BAN_THAN';
  }
  if (/cây|hạt|lá|hoa|quả|rau|củ|mầm|rừng|lúa|tảo|thực vật/.test(lower)) {
    return 'THUC_VAT';
  }
  if (/động vật|thỏ|gà|vịt|chó|mèo|cá|chim|thú|bướm|ong|voi|hổ|trâu|bò|lợn/.test(lower)) {
    return 'DONG_VAT';
  }
  if (/giao thông|xe|tàu|máy bay|bánh xe|đèn đỏ|biển báo|đường|vạch/.test(lower)) {
    return 'GIAO_THONG';
  }
  if (/gia đình|nhà|bố|mẹ|ông|bà|anh|chị|em|bữa cơm/.test(lower)) {
    return 'GIA_DINH';
  }
  if (/nghề nghiệp|bác sĩ|bộ đội|cảnh sát|kỹ sư|cô giáo|nông dân|thợ/.test(lower)) {
    return 'NGHE_NGHIEP';
  }
  if (/nước|mưa|nắng|gió|mây|thời tiết|cầu vồng|sông|suối|biển/.test(lower)) {
    return 'HTTN';
  }
  if (/quê hương|bác hồ|lá cờ|việt nam|hà nội|lăng bác|sen/.test(lower)) {
    return 'QUE_HUONG';
  }
  if (/trường|lớp|mầm non|sương mai|bạn bè|đồ chơi/.test(lower)) {
    return 'TRUONG_MN';
  }
  if (/lớp 1|ba lô|bút chì|thước|sách|vở|đồng hồ/.test(lower)) {
    return 'LOP_MOT';
  }

  return fallbackTheme;
}

/**
 * Dynamic Image Keywords Generator based on Subject Domain and Topic
 */
export function getDynamicImageKeywords(subject: string = '', topic: string = '', themeCode?: string): string {
  const normSub = (subject || '').toUpperCase();
  const lowerTopic = (topic || '').toLowerCase();

  if (normSub.includes('PTVD') || normSub.includes('PTVĐ') || normSub.includes('VẬN ĐỘNG') || lowerTopic.includes('vận động')) {
    return 'kindergarten physical sports exercise, happy children running jumping, colorful gym mats, sports field cartoon';
  }
  if (normSub.includes('LQVT') || normSub.includes('TOÁN') || lowerTopic.includes('đếm') || lowerTopic.includes('số')) {
    return 'preschool math counting blocks, colorful numbers 1-10, geometric shapes, cheerful classroom';
  }
  if (normSub.includes('LQCC') || normSub.includes('CHỮ CÁI') || lowerTopic.includes('chữ cái')) {
    return 'alphabet letters blocks for kids, reading storybook, bright preschool literacy classroom';
  }
  if (normSub.includes('TAO_HINH') || normSub.includes('TẠO HÌNH') || lowerTopic.includes('vẽ') || lowerTopic.includes('nặn') || lowerTopic.includes('xé dán')) {
    return 'kids art craft drawing, modeling clay, colorful paper cutout, art easel kindergarten';
  }
  if (normSub.includes('LQAN') || normSub.includes('ÂM NHẠC') || lowerTopic.includes('hát') || lowerTopic.includes('múa')) {
    return 'children singing music instruments, bamboo clapper, xylophone, kids dancing stage performance';
  }
  if (normSub.includes('DINH_DUONG') || normSub.includes('DINH DƯỠNG') || normSub.includes('SỨC KHỎE') || lowerTopic.includes('rửa tay') || lowerTopic.includes('thực phẩm')) {
    return 'healthy food for kids, washing hands 6 steps, healthy eating preschool, clean fruits vegetables';
  }
  if (normSub.includes('KNS') || normSub.includes('KỸ NĂNG SỐNG') || lowerTopic.includes('kỹ năng')) {
    return 'preschool life skills, polite kids interaction, safety rules, friendly classroom watercolor';
  }
  if (normSub.includes('KPXH') || normSub.includes('XÃ HỘI') || lowerTopic.includes('quê hương')) {
    return 'vietnam culture preschool, happy children community, friendly people, watercolor illustration';
  }

  // Fallback to Theme Matrix image style keywords
  const themeMatrix = getThemeMatrix(themeCode);
  return themeMatrix.imageStyleKeywords || 'preschool children learning, bright friendly classroom';
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

export function getThemeArchetype(themeCode?: string, topic: string = '', subject: string = ''): ThemeArchetypeInfo {
  const code = themeCode || 'THUC_VAT';
  const cleanTopic = (topic || '').trim().replace(/^(Khám phá|Tìm hiểu|Nhận biết|Trải nghiệm)\s+/i, '') || 'Bài Học Trực Quan';
  const normSub = (subject || '').toUpperCase();

  // 1. SUBJECT DOMAIN OVERRIDES (Take precedence over ThemeCode)
  if (normSub.includes('PTVD') || normSub.includes('PTVĐ') || normSub.includes('VẬN ĐỘNG')) {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Vận động thể chất & Thi đua đồng đội',
      storyTitle: `🏃 Thử Thách Vận Động Thể Chất: ${cleanTopic}`,
      openerType: 'MOVEMENT_GAME',
      openerHeadline: '🏃 Khởi Động Thể Lực & Mô Phỏng',
      openerDetail: `🗣️ Cô gợi mở: "Hôm nay các bạn nhỏ cùng rèn luyện sức khỏe dẻo dai và phản xạ nhanh nhẹn qua bài tập '${cleanTopic}' nhé!" Trẻ hăng hái xoay các khớp và chuẩn bị thể lực.`,
      localizedElements: ['Sân thể chất cỏ xanh Trường Sương Mai', 'Vạch xuất phát sắc màu', 'Cổng chui vận động đa năng', 'Khu thể thao mầm non Sương Mai'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các vận động viên nhí Sương Mai ơi! Đố bé biết bài tập '${cleanTopic}' giúp cơ thể chúng mình khỏe mạnh thế nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, giúp chúng con cao lớn, dẻo dai, phản xạ nhanh nhẹn và tràn đầy năng lượng mỗi ngày ạ!"`
      }
    };
  }

  if (normSub.includes('LQVT') || normSub.includes('TOÁN')) {
    return {
      archetypeType: 'QUIZ_TRUE_FALSE',
      archetypeName: 'Thách thức số học & Khái niệm toán',
      storyTitle: `🔢 Thách Thức Toán Học Vui: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Ngón Tay & Thẻ Số',
      openerDetail: `🗣️ Cô đố bé: "Bàn tay nhỏ nhắn của bé có bao nhiêu ngón tay xinh? Chúng mình cùng đếm to và tìm bí mật bài toán '${cleanTopic}' nhé!"`,
      localizedElements: ['Bảng nỉ toán học rực rỡ', 'Rổ thẻ số sắc màu', 'Bộ đồ dùng đếm mầm non', 'Góc toán học thông minh Sương Mai'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các nhà toán học tí hon ơi! Đố bé nhận biết và so sánh chính xác bài toán '${cleanTopic}' nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, chúng con đếm to, xếp tương ứng 1-1 chính xác và trả lời câu hỏi toán học ạ!"`
      }
    };
  }

  if (normSub.includes('LQCC') || normSub.includes('CHỮ CÁI')) {
    return {
      archetypeType: 'QUIZ_TRUE_FALSE',
      archetypeName: 'Nhận dạng chữ cái & Phát âm chuẩn',
      storyTitle: `🔤 Khám Phá Bảng Chữ Cái: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Chữ Cái Kỳ Diệu',
      openerDetail: `🗣️ Cô đố bé: "Chữ gì nét cong nét thẳng - Đứng rực rỡ trong bảng chữ cái vui cùng bé?" Trẻ cùng nghe phát âm và tìm chữ.`,
      localizedElements: ['Bảng từ khóa góc Tiếng Việt Sương Mai', 'Dây điện uốn chữ cái', 'Thẻ chữ cái rực rỡ', 'Góc đọc sách mầm non'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các bạn nhỏ ơi! Hãy phát âm to rõ ràng và chỉ ra cấu tạo nét chữ của bài học '${cleanTopic}' nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, chúng con phát âm chuẩn khẩu hình, nhận biết mặt chữ và tự tay uốn nét chữ ạ!"`
      }
    };
  }

  if (normSub.includes('TAO_HINH') || normSub.includes('TẠO HÌNH')) {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Sáng tạo nghệ thuật & Bàn tay khéo léo',
      storyTitle: `🎨 Xưởng Sáng Tạo Nghệ Thuật: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🖼️ Quan Sát Mẫu & Bàn Tay Khéo Léo',
      openerDetail: `🗣️ Cô đàm thoại mở đầu: "Chúng mình cùng ngắm nhìn màu sắc và đường nét tuyệt đẹp của sản phẩm mẫu bài học '${cleanTopic}' nhé!"`,
      localizedElements: ['Giá treo tranh triển lãm Sương Mai', 'Hộp sáp màu sắc rực rỡ', 'Đất nặn nhiều màu', 'Khay đồ dùng thủ công mầm non'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các họa sĩ nhí Sương Mai ơi! Bé sẽ sử dụng đôi bàn tay khéo léo để tạo nên sản phẩm '${cleanTopic}' thế nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con tự tay phối màu, thao tác khéo léo và tự tin mang sản phẩm lên giá triển lãm ạ!"`
      }
    };
  }

  if (normSub.includes('LQAN') || normSub.includes('ÂM NHẠC')) {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Sân khấu âm nhạc & Vận động theo nhạc',
      storyTitle: `🎶 Sân Khấu Âm Nhạc Rạng Rỡ: ${cleanTopic}`,
      openerType: 'SOUND_SIMULATION',
      openerHeadline: '🎵 Lắng Nghe Giai Điệu Rộn Ràng',
      openerDetail: `🎶 "Đồ rê mi!" Trẻ lắng nghe giai điệu vui tươi của bài hát và bắt nhịp hát hòa giọng cùng cô giáo.`,
      localizedElements: ['Sân khấu văn nghệ Trường Sương Mai', 'Phách tre & xắc xô', 'Hoa đeo tay biểu diễn', 'Đàn piano lớp học'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Đội ca sĩ nhí Sương Mai ơi! Hãy cùng cô cất cao lời ca bài hát '${cleanTopic}' và gõ đệm nhịp nhàng nào!"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, chúng con hát đúng lời, gõ đệm phách tre và tự tin biểu diễn trên sân khấu ạ!"`
      }
    };
  }

  if (normSub.includes('LQVH') || normSub.includes('VĂN HỌC') || normSub.includes('THƠ') || normSub.includes('KỂ CHUYỆN')) {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Thế giới văn học & Đóng kịch',
      storyTitle: `📖 Thế Giới Tác Phẩm Văn Học: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Văn Học Diễn Cảm',
      openerDetail: `🗣️ Cô kể chuyện / đọc thơ sa bàn diễn cảm đề tài "${cleanTopic}", thu hút trẻ tập trung lắng nghe.`,
      localizedElements: ['Sa bàn rối dẹt Trường Sương Mai', 'Mũ hóa trang nhân vật', 'Tranh minh họa tác phẩm', 'Góc văn học ấm cúng'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các bạn nhỏ lắng nghe tác phẩm '${cleanTopic}' và trích dẫn lời thoại nhân vật thế nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con nhớ tên tác phẩm, hiểu ý nghĩa bài học và tự tin đóng kịch nhập vai ạ!"`
      }
    };
  }

  if (normSub.includes('DINH_DUONG') || normSub.includes('DINH DƯỠNG') || normSub.includes('SỨC KHỎE')) {
    return {
      archetypeType: 'SCIENCE_EXPLORATION',
      archetypeName: 'Bé khỏe ngoan & Thói quen vệ sinh',
      storyTitle: `🥗 Bé Khỏe Ngoan & Dinh Dưỡng: ${cleanTopic}`,
      openerType: 'SOUND_SIMULATION',
      openerHeadline: '🧼 Quy Trình Vệ Sinh & Dinh Dưỡng',
      openerDetail: `🗣️ Cô đố bé: "Làm sao để đôi bàn tay luôn sạch sẽ và cơ thể cao lớn khỏe mạnh qua bài học '${cleanTopic}' nhỉ?"`,
      localizedElements: ['Bảng 4 nhóm thực phẩm Sương Mai', 'Bồn rửa tay 6 bước chuẩn', 'Khay ăn mầm non sạch đẹp', 'Xà phòng & khăn mặt riêng'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các bé ngoan Sương Mai ơi! Thói quen dinh dưỡng và vệ sinh bài học '${cleanTopic}' giúp gì cho chúng mình?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, giúp chúng con sạch sẽ, phòng chống vi khuẩn và cơ thể luôn khỏe mạnh ạ!"`
      }
    };
  }

  if (normSub.includes('KNS') || normSub.includes('KỸ NĂNG SỐNG')) {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Kỹ năng sống & Tình huống an toàn',
      storyTitle: `🚨 Hiệp Sĩ Kỹ Năng Sống: ${cleanTopic}`,
      openerType: 'MOVEMENT_GAME',
      openerHeadline: '🎭 Nhập Vai Xử Lý Tình Huống',
      openerDetail: `🗣️ Cô đưa ra kịch bản tình huống thực tế liên quan đến "${cleanTopic}", mời trẻ phân tích đúng - sai.`,
      localizedElements: ['Bảng quy tắc an toàn lớp học', 'Thẻ tình huống kỹ năng sống', 'Góc nhập vai ứng xử Sương Mai', 'Huy hiệu Bé Ngoan'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Đội hiệp sĩ kỹ năng sống ơi! Khi gặp tình huống '${cleanTopic}', bé sẽ xử lý an toàn thế nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con phân tích hành động đúng, nói lời lễ phép và luôn thực hành an toàn ạ!"`
      }
    };
  }

  if (normSub.includes('KPXH') || normSub.includes('XÃ HỘI')) {
    return {
      archetypeType: 'QUIZ_TRUE_FALSE',
      archetypeName: 'Khám phá xã hội & Quê hương đất nước',
      storyTitle: `🏛️ Hành Trình Khám Phá Xã Hội: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Văn Hóa Quê Hương',
      openerDetail: `🗣️ Trẻ quan sát hình ảnh đời sống xã hội, nét đẹp quê hương con người Việt Nam bài học "${cleanTopic}".`,
      localizedElements: ['Cờ đỏ sao vàng Việt Nam', 'Góc bản sắc quê hương Sương Mai', 'Bức ảnh Bác Hồ kính yêu', 'Sa bàn cộng đồng mầm non'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Bài học '${cleanTopic}' giúp các bạn nhỏ hiểu gì về công việc và tình yêu quê hương đất nước?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con tự hào về quê hương Việt Nam, biết ơn các cô chú và vâng lời Bác Hồ dặn ạ!"`
      }
    };
  }

  // 2. THEME-BASED FALLBACKS (If Subject is General Science / KPKH)
  if (code === 'THUC_VAT') {
    return {
      archetypeType: 'SCIENCE_EXPLORATION',
      archetypeName: 'Thí nghiệm & Khám phá bí ẩn',
      storyTitle: `🔬 Thí Nghiệm Bí Mật: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Vần Điệu Mở Đầu',
      openerDetail: `🗣️ Cô đố bé: "Cây gì, quả gì hay bí mật tự nhiên nào ẩn giấu trong bài học '${cleanTopic}' nhỉ?" Trẻ cùng nhau suy đoán và háo hức tìm hiểu.`,
      localizedElements: ['Hoa mai vàng Sương Mai', 'Vườn rau sạch sân trường', 'Cây lúa vàng chín rộ', 'Quả ngọt tươi mát', 'Bánh chưng lá dong'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các nhà khoa học tí hon ơi! Đố bé biết những điều kỳ diệu về đề tài '${cleanTopic}' nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, chúng con hào hứng muốn cùng cô khám phá bài học '${cleanTopic}' ạ!"`
      }
    };
  } else if (code === 'DONG_VAT') {
    return {
      archetypeType: 'SCIENCE_EXPLORATION',
      archetypeName: 'Thí nghiệm & Khám phá bí ẩn',
      storyTitle: `🔎 Hành Trình Thế Giới Động Vật: ${cleanTopic}`,
      openerType: 'MOVEMENT_GAME',
      openerHeadline: '🏃 Trò Chơi Vận Động Mô Phỏng',
      openerDetail: `🐾 Bé cùng nhún nhảy làm các chú vật nhỏ ngộ nghĩnh, mô phỏng dáng đi và hành động đáng yêu liên quan đến bài học "${cleanTopic}".`,
      localizedElements: ['Chú trâu vàng đồng quê', 'Con cò trắng bay la', 'Con mèo hen góc bếp', 'Đàn gà con lông vàng'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Đố các bạn nhỏ biết đặc điểm đáng yêu nhất của con vật trong bài học '${cleanTopic}' là gì nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, các bạn nhỏ rất yêu quý các loài vật và thích thú tìm hiểu ạ!"`
      }
    };
  } else if (code === 'HTTN' || code === 'NUOC_HTTN') {
    return {
      archetypeType: 'SCIENCE_EXPLORATION',
      archetypeName: 'Thí nghiệm & Khám phá bí ẩn',
      storyTitle: `🌈 Kỳ Diệu Tự Nhiên: ${cleanTopic}`,
      openerType: 'SOUND_SIMULATION',
      openerHeadline: '🎧 Âm Thanh Mô Phỏng Tự Nhiên',
      openerDetail: `☔ "Tí tách! Rào rào!" Trẻ lắng nghe âm thanh tự nhiên reo ca và cùng đoán bí mật bài học "${cleanTopic}".`,
      localizedElements: ['Giọt sương mai trên lá', 'Cầu vồng rực rỡ sau mưa', 'Ánh nắng ban mai ấm áp', 'Dòng suối mát lành'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các bé ơi, hiện tượng tự nhiên bài học '${cleanTopic}' mang lại điều tuyệt vời gì cho trái đất?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, giúp cây cối xanh tươi và bầu trời ngập tràn không khí mát lành ạ!"`
      }
    };
  } else if (code === 'GIAO_THONG') {
    return {
      archetypeType: 'QUIZ_TRUE_FALSE',
      archetypeName: 'Trò chơi Đố vui phản xạ Đúng - Sai',
      storyTitle: `🚨 Thử Thách Hiệp Sĩ Giao Thông: ${cleanTopic}`,
      openerType: 'SOUND_SIMULATION',
      openerHeadline: '🔊 Phản Xạ Âm Thanh Giao Thông',
      openerDetail: `🚗 "Bíp bíp! Xình xịch!" Bé tinh mắt nhận diện các phương tiện và quy tắc giao thông an toàn trong bài học "${cleanTopic}".`,
      localizedElements: ['Mũ bảo hiểm xe máy đạt chuẩn', 'Vạch sang đường cho người đi bộ', 'Chú cảnh sát giao thông còi hiệu', 'Xe bus trường Sương Mai'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Đội hiệp sĩ giao thông ơi! Đố bé biết làm sao để di chuyển an toàn khi tham gia '${cleanTopic}'?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, ĐÃ THAM GIA GIAO THÔNG LÀ PHẢI CHẤP HÀNH ĐÚNG LUẬT AN TOÀN Ạ!"`
      }
    };
  } else if (code === 'QUE_HUONG') {
    return {
      archetypeType: 'QUIZ_TRUE_FALSE',
      archetypeName: 'Trò chơi Đố vui phản xạ Đúng - Sai',
      storyTitle: `🇻🇳 Thử Thách Hiệp Sĩ Quê Hương: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Vần Điệu Yêu Nước',
      openerDetail: `🗣️ Trẻ cùng giải đố bài ca quê hương, cảm nhận nét đẹp đất nước và Bác Hồ kính yêu liên quan đến bài học "${cleanTopic}".`,
      localizedElements: ['Hoa sen hồng ngát hương', 'Lăng Bác Hồ kính yêu', 'Cờ đỏ sao vàng tung bay', 'Áo dài truyền thống Việt Nam'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Bài học '${cleanTopic}' nhắc nhở các bạn nhỏ Trường Sương Mai điều gì về tình yêu quê hương?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con luôn ngoan ngoãn, yêu thương quê hương và làm theo lời Bác Hồ dặn ạ!"`
      }
    };
  } else if (code === 'NGHE_NGHIEP') {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
      storyTitle: `👩‍⚕️ Biệt Đội Nhập Vai Nghề Nghiệp: ${cleanTopic}`,
      openerType: 'MOVEMENT_GAME',
      openerHeadline: '🎭 Nhập Vai Hành Quân & Trải Nghiệm',
      openerDetail: `🎖️ Bé sắm vai các ngành nghề xã hội, hăng hái thao tác và trải nghiệm công việc bài học "${cleanTopic}".`,
      localizedElements: ['Chú bộ đội Cụ Hồ mũ cờ sao vàng', 'Cô giáo mầm non Sương Mai', 'Bác sĩ áo blouse trắng', 'Kỹ sư công trình mũ bảo hộ'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Khi nhập vai làm việc, các bạn nhỏ mang lại ích lợi gì cho mọi người qua bài học '${cleanTopic}'?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, chúng con làm việc chăm chỉ, khéo léo và mang lại niềm vui cho mọi người ạ!"`
      }
    };
  } else if (code === 'GIA_DINH') {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
      storyTitle: `🏡 Nhập Vai Bữa Cơm Gia Đình: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Vần Điệu Ấm Cúng',
      openerDetail: `🗣️ Trẻ cùng nhau giải đố về tình cảm gia đình, sự chăm sóc và ý nghĩa bài học "${cleanTopic}".`,
      localizedElements: ['Bữa cơm gia đình Việt Nam sum vầy', 'Mâm ngũ quả ngày Tết', 'Ngôi nhà ấm cúng', 'Bánh chưng xanh gói lá dong'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Trong gia đình thân yêu, bé sẽ thể hiện sự yêu thương qua bài học '${cleanTopic}' như thế nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con khoanh tay lễ phép, ngoan ngoãn giúp đỡ Ông Bà Bố Mẹ ạ!"`
      }
    };
  } else if (code === 'BAN_THAN') {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
      storyTitle: `😃 Biệt Đội Cảm Xúc & 5 Giác Quan: ${cleanTopic}`,
      openerType: 'MOVEMENT_GAME',
      openerHeadline: '🏃 Vận Động Nụ Cười & Cảm Xúc Rạng Rỡ',
      openerDetail: `🖐️ Cô gợi mở: "Khi bé gặp niềm vui hoặc làm được việc tốt trong bài học '${cleanTopic}', nụ cười trên gương mặt bé sẽ như thế nào nhỉ?" Trẻ cùng thể hiện biểu cảm rạng rỡ.`,
      localizedElements: ['Nụ cười rạng rỡ của bé', 'Đôi bàn tay nhỏ ngoan', 'Trái tim yêu thương', '5 giác quan tinh mắt'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Các bạn nhỏ ơi! Đố bé biết làm thế nào để chúng mình luôn giữ được cảm xúc vui vẻ và tỏa sáng qua bài học '${cleanTopic}'?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, bé mỉm cười rạng rỡ, tự tin thể hiện bản thân và chia sẻ cùng các bạn ạ!"`
      }
    };
  } else if (code === 'LOP_MOT') {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
      storyTitle: `🎒 Nhập Vai Học Sinh Lớp 1 Tự Tin: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Bạn Nhỏ Đeo Ba Lô',
      openerDetail: `🗣️ Trẻ háo hức nhập vai làm anh chị Lớp 1, sẵn sàng đồ dùng và tâm thế khám phá bài học "${cleanTopic}".`,
      localizedElements: ['Ba lô siêu nhẹ', 'Bút chì & thước kẻ', 'Sách tô màu & bảng đen', 'Đồng hồ báo thức đúng giờ'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Để tự tin bước vào Lớp 1, các bạn nhỏ rèn luyện tâm thế gì qua bài học '${cleanTopic}'?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, con tự giác học tập, giữ vệ sinh ngăn nắp và luôn tự tin ạ!"`
      }
    };
  } else {
    return {
      archetypeType: 'ROLEPLAY_SITUATIONS',
      archetypeName: 'Nhân vật nhập vai & Xử lý tình huống',
      storyTitle: `🏫 Nhập Vai Bé Ngoan Sương Mai: ${cleanTopic}`,
      openerType: 'RHYMING_RIDDLE',
      openerHeadline: '🧩 Câu Đố Mái Trường Sương Mai',
      openerDetail: `🗣️ Trẻ cùng cô giáo hăng hái khám phá bí mật đề tài "${cleanTopic}" tại không gian lớp học Trường Mầm Non Sương Mai.`,
      localizedElements: ['Góc sân trường Sương Mai xanh mát', 'Đồ chơi dân gian', 'Góc thư viện mầm non', 'Cờ bé ngoan khen tặng'],
      calloutDialogue: {
        teacherAsk: `🗣️ Cô hỏi: "Tại mái trường Sương Mai thân yêu, bé hào hứng tham gia hoạt động bài học '${cleanTopic}' thế nào?"`,
        childAnswer: `👦 Trẻ đáp: "Thưa cô, chúng con hào hứng thực hành và tự giác giữ gìn đồ dùng ngăn nắp ạ!"`
      }
    };
  }
}

export const GRADE_LEVEL_MAP: Record<GradeLevelCode, { label: string; duration: string }> = {
  NHA_TRE: { label: 'Nhà Trẻ (12-36 tháng)', duration: '12-15 phút' },
  MAM: { label: 'Mầm (3-4 tuổi)', duration: '15-20 phút' },
  CHOI: { label: 'Chồi (4-5 tuổi)', duration: '20-25 phút' },
  LA: { label: 'Lá (5-6 tuổi)', duration: '25-30 phút' },
};

export const SUBJECT_NAME_MAP: Record<string, string> = {
  KPKH: 'Khám phá khoa học (KPKH)',
  KPXH: 'Khám phá xã hội (KPXH)',
  LQVT: 'Làm quen với toán (LQVT)',
  LQCC: 'Làm quen chữ cái (LQCC)',
  LQVH: 'Làm quen văn học / Kể chuyện - Thơ (LQVH)',
  TAO_HINH: 'Tạo hình & Khéo tay (Vẽ, Xé dán, Nặn)',
  LQAN: 'Giáo dục âm nhạc (LQÂN - Hát, Vận động múa, Nghe hát)',
  PTVD: 'Phát triển vận động (PTVĐ - Vận động cơ bản & Trò chơi vận động)',
  DINH_DUONG: 'Giáo dục dinh dưỡng & Sức khỏe',
  KNS: 'Kỹ năng sống & Xử lý tình huống',
  // Legacy aliases
  PTVĐ: 'Phát triển vận động (PTVĐ - Vận động cơ bản & Trò chơi vận động)',
  NBTN: 'Nhận biết tập nói (NBTN)',
  HDVDV: 'Hoạt động với đồ vật (HĐVĐV)',
};

export interface SubjectGroup {
  groupName: string;
  subjects: { code: string; label: string }[];
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  {
    groupName: 'NHÓM 1: PHÁT TRIỂN NHẬN THỨC',
    subjects: [
      { code: 'KPKH', label: 'Khám phá khoa học (KPKH)' },
      { code: 'KPXH', label: 'Khám phá xã hội (KPXH)' },
      { code: 'LQVT', label: 'Làm quen với toán (LQVT)' },
    ]
  },
  {
    groupName: 'NHÓM 2: PHÁT TRIỂN NGÔN NGỮ',
    subjects: [
      { code: 'LQCC', label: 'Làm quen chữ cái (LQCC)' },
      { code: 'LQVH', label: 'Làm quen văn học / Kể chuyện - Thơ (LQVH)' },
    ]
  },
  {
    groupName: 'NHÓM 3: PHÁT TRIỂN THẨM MỸ',
    subjects: [
      { code: 'TAO_HINH', label: 'Tạo hình & Khéo tay (Vẽ, Xé dán, Nặn)' },
      { code: 'LQAN', label: 'Giáo dục âm nhạc (LQÂN - Hát, Vận động múa, Nghe hát)' },
    ]
  },
  {
    groupName: 'NHÓM 4: PHÁT TRIỂN THỂ CHẤT',
    subjects: [
      { code: 'PTVD', label: 'Phát triển vận động (PTVĐ - Vận động cơ bản & Trò chơi vận động)' },
      { code: 'DINH_DUONG', label: 'Giáo dục dinh dưỡng & Sức khỏe' },
    ]
  },
  {
    groupName: 'NHÓM 5: TÌNH CẢM & KỸ NĂNG XÃ HỘI',
    subjects: [
      { code: 'KNS', label: 'Kỹ năng sống & Xử lý tình huống' },
    ]
  }
];

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
