import { AILessonPlan, AILessonSlide, GradeLevelCode, ThemeCode, LearningProject, TeachingType, PreschoolAISchemaResponse } from '../types/schema';
import { 
  getFrameworkByGradeAndTheme, THEME_NAME_MAP, GRADE_LEVEL_MAP, 
  SUBJECT_NAME_MAP, getDynamicMaterialSuggestions, getThemeMatrix, THEME_MATRIX,
  getThemeArchetype, autoDetectThemeCode, getDynamicImageKeywords, detectTopicSubCategory
} from '../utils/curriculumHelper';

/**
 * System Instruction Prompt for Gemini / AI Engine
 */
export const PRESCHOOL_SYSTEM_INSTRUCTION = `[SYSTEM INSTRUCTION]
Bạn là Chuyên gia Phương pháp Giáo dục Mầm non tại Trường Mầm Non Sương Mai.
Nhiệm vụ của bạn là lập kế hoạch bài dạy chi tiết, hấp dẫn, chuẩn mực sư phạm và an toàn tuyệt đối cho trẻ.

[QUY TẮC ĐIỀU HƯỚNG THEO ĐỘ TUỔI]
1. KHỐI NHÀ TRẺ (24-36 tháng): Thời lượng 12-15 phút. Tiến trình 3 bước (Gắn kết -> Nhận biết tập nói/hoạt động với đồ vật -> Trò chơi phản xạ). Ngôn ngữ cực kỳ đơn giản, từ ngữ lặp lại, hình ảnh trực quan lớn.
2. KHỐI MẦM (3-4 tuổi): Thời lượng 15-20 phút. Tiến trình 3 bước truyền thống. Nhận biết trong phạm vi 5, so sánh kích thước, hình khối cơ bản. Không dạy viết chữ cái.
3. KHỐI CHỒI (4-5 tuổi): Thời lượng 20-25 phút. Tiến trình 5E rút gọn. Phạm vi 10, phân tích nguyên nhân - kết quả, kể chuyện đóng vai kịch ngắn.
4. KHỐI LÁ (5-6 tuổi): Thời lượng 25-30 phút. Bắt buộc áp dụng 5E chuẩn (Engage, Explore, Explain, Elaborate, Evaluate) kết hợp mục tiêu STEAM bóc tách rõ S-T-E-A-M. Bắt buộc có từ mới giải thích và 1 trò chơi hoạt động chiều.

[QUY TẮC BẮT BUỘC VỀ HỌC LIỆU & ĐỒ DÙNG DẠY HỌC DỘNG]
1. TUYỆT ĐỐI KHÔNG sử dụng các đồ dùng mặc định cố định (như "hạt đỗ, bông gòn, sỏi, cát, chai nhựa") trừ khi đề tài bài học trực tiếp yêu cầu thí nghiệm đó.
2. Học liệu trong phần "preparations" PHẢI bám sát 100% vào Đề tài ({topic}) và Phân môn ({subject}):
   - Nếu môn Âm nhạc: bắt buộc có nhạc cụ (phách tre, xắc xô, đàn, micro, nơ tay).
   - Nếu môn Toán: bắt buộc có rổ đồ dùng số lượng tương ứng, thẻ chữ số, que tính, que đo.
   - Nếu môn Chữ cái: bắt buộc có thẻ chữ, các nét rời, hột hạt/dây uốn chữ, bảng con.
   - Nếu môn Vận động: bắt buộc có dụng cụ thể dục (bóng, thang, túi cát, ghế, vạch kẻ).
   - Nếu môn Tạo hình: bắt buộc có giấy A4, sáp màu, hồ dán, đất nặn, vật liệu mở tự nhiên.
3. Phân định rõ ràng:
   - "teacher": Đồ dùng trực quan của cô (kích thước lớn, video máy tính, tranh mẫu, vật thật).
   - "students": Đồ dùng thực hành của trẻ (đủ số lượng cho từng trẻ hoặc từng nhóm).

[QUY TẮC DẠY HỌC THEO DỰ ÁN (PBL)]
Nếu teaching_type == 'PROJECT_BASED':
- Phân bổ hoạt động thành chuỗi 5 ngày trong tuần (Thứ 2 -> Thứ 6) xoay quanh việc hoàn thiện 01 sản phẩm thực tế của trẻ.
- Tích hợp tự nhiên các môn: Khoa học (S), Công nghệ (T), Kỹ thuật (E), Nghệ thuật (A), Toán học (M).
- Soạn 01 đoạn thông báo ngắn gửi phụ huynh (Parent Project Card) để cùng chuẩn bị học liệu tại nhà.

[CƠ CHẾ SINH NỘI DUNG BIẾN THIÊN (DYNAMIC CONTENT ENGINE)]
1. Archetype Bài Học Linh Hoạt:
   - Tự nhiên / Khoa học (THUC_VAT, DONG_VAT, NUOC_HTTN): Áp dụng cốt truyện "Thí nghiệm & Khám phá bí ẩn".
   - Xã hội / Cảm xúc / Nghề nghiệp / Bản thân / Gia đình / Trường MN / Lớp 1 (BAN_THAN, GIA_DINH, NGHE_NGHIEP, TRUONG_MN, LOP_MOT): Áp dụng cốt truyện "Nhân vật nhập vai & Xử lý tình huống".
   - Kỹ năng sống / Quy tắc / Giao thông / Quê hương (GIAO_THONG, QUE_HUONG): Áp dụng kịch bản "Trò chơi Đố vui phản xạ Đúng - Sai".
2. Ngôn ngữ & Thẻ Tương tác Cô - Trẻ (Callout Box):
   - Hoạt động mở đầu luân phiên: Sử dụng câu đố có vần điệu, âm thanh mô phỏng hoặc trò chơi vận động tại chỗ (không chỉ dùng bài hát).
   - Bắt buộc lồng ghép kịch bản lời thoại gợi mở dạng thẻ tương tác: "🗣️ Cô hỏi: ... | 👦 Trẻ đáp: ..."
3. Bản địa hóa Việt Nam (Localization):
   - Tự động lồng ghép hình ảnh Việt Nam gần gũi (hoa mai, hoa đào, bánh chưng, chú bộ đội Cụ Hồ, mũ bảo hiểm xe máy, hoa sen, lăng Bác, góc sân trường Sương Mai...).`;

/**
 * Helper to remove Vietnamese diacritics for clean URL prompts
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates Pollinations.ai 3D Cartoon Illustration Image URL (Free 0 VNĐ)
 * Enforces strict Rule 4: No text, no letters, 16:9 ratio, parametric colors
 */
export function getPollinationsImageUrl(
  prompt: string, 
  width = 1024, 
  height = 768, 
  seedIndex = 1,
  themeStyleKeywords = 'colorful cheerful'
): string {
  const cleanPrompt = removeVietnameseTones(prompt).slice(0, 100) || 'cheerful kindergarten kids learning';
  const cleanKeywords = removeVietnameseTones(themeStyleKeywords).slice(0, 80) || 'vibrant cartoon';
  const fullPrompt = `cute preschool 3D cartoon style, soft clay or papercraft look, vibrant ${cleanKeywords}, cheerful kindergarten kids, no text, no letters, high contrast, clean background, 16:9 ratio, ${cleanPrompt}`;
  const encodedPrompt = encodeURIComponent(fullPrompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${100 + seedIndex}`;
}

/**
 * Helper to map raw JSON PreschoolAISchemaResponse to AILessonPlan UI model
 */
export function mapSchemaResponseToLessonPlan(
  schema: PreschoolAISchemaResponse,
  subject: string = 'KPKH',
  theme_code: ThemeCode = 'THUC_VAT'
): AILessonPlan {
  const normGrade: GradeLevelCode = 
    schema.grade_level.includes('NHÀ TRẺ') || schema.grade_level.includes('NHA_TRE') ? 'NHA_TRE' :
    schema.grade_level.includes('MẦM') || schema.grade_level.includes('MAM') ? 'MAM' :
    schema.grade_level.includes('CHỒI') || schema.grade_level.includes('CHOI') ? 'CHOI' : 'LA';

  const fiveSteps = schema.procedure_steps.map((step, idx) => ({
    step_number: idx + 1,
    step_title: step.step_name,
    description: `Thời lượng: ${step.duration}`,
    teacher_action: step.content.split('Trẻ:')[0]?.replace('Cô:', '').trim() || step.content,
    child_activity: step.content.includes('Trẻ:') ? step.content.split('Trẻ:')[1]?.trim() || 'Trẻ tích cực tham gia.' : 'Trẻ quan sát và thực hành theo hướng dẫn.'
  }));

  const slides: AILessonSlide[] = (schema.image_prompts || []).map((prompt, idx) => ({
    slide_number: idx + 1,
    title: `SLIDE ${idx + 1}: ${schema.title}`,
    content_points: [
      `Khối: ${schema.grade_level} • Thời lượng: ${schema.duration}`,
      `Mục tiêu: ${schema.objectives.science || schema.objectives.attitude}`,
      `Chuẩn bị: ${schema.preparations.students.join(', ')}`
    ],
    image_prompt: prompt,
    image_url: getPollinationsImageUrl(prompt)
  }));

  return {
    id: `ai-lesson-${Date.now()}`,
    topic: schema.title,
    subject,
    grade_level: normGrade,
    teaching_type: schema.teaching_type,
    target_objectives: `S: ${schema.objectives.science} | T: ${schema.objectives.technology} | E: ${schema.objectives.engineering} | A: ${schema.objectives.art} | M: ${schema.objectives.math}`,
    duration_minutes: parseInt(schema.duration) || 25,
    materials_needed: [...schema.preparations.teacher, ...schema.preparations.students],
    five_steps: fiveSteps,
    mermaid_mindmap_code: schema.mindmap_mermaid || `graph TD\n  Root["🌱 ${schema.title}"] --> S1["1. Hoạt động"]`,
    youtube_video_suggestions: [
      { title: `Tìm kiếm "${schema.youtube_keyword || schema.title}" trên YouTube`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(schema.youtube_keyword || schema.title)}` }
    ],
    slides,
    preparations: schema.preparations,
    afternoon_activity: schema.afternoon_activity,
    parent_announcement: schema.parent_collaboration_note,
    schema_response: schema,
    created_at: new Date().toISOString()
  };
}



/**
 * Generates full 13-slide Rules.pdf compliant presentation deck (100% Dynamic & Parametric)
 */
export function generateRulesCompliantSlideDeck(params: {
  topic: string;
  subject: string;
  grade_level: GradeLevelCode;
  theme_code: ThemeCode;
  materialsNeededStr: string;
  studentMaterials: string[];
  teacherMaterials: string[];
  framework: any;
  targetObjectives?: string;
}): AILessonSlide[] {
  const { topic, subject, grade_level, theme_code, materialsNeededStr, studentMaterials, teacherMaterials, framework, targetObjectives } = params;
  const safeTopic = topic.trim() || 'Khám Phá Bài Học Trực Quan';
  
  // Auto-detect theme code matching the topic keywords to avoid theme mismatches
  const effectiveThemeCode = autoDetectThemeCode(safeTopic, theme_code);
  const gradeInfo = GRADE_LEVEL_MAP[grade_level] || GRADE_LEVEL_MAP['LA'];
  const themeMatrix = getThemeMatrix(effectiveThemeCode);
  const archetype = getThemeArchetype(effectiveThemeCode, safeTopic, subject);
  const themeName = THEME_NAME_MAP[effectiveThemeCode] || themeMatrix.themeName;
  const subjectName = SUBJECT_NAME_MAP[subject] || subject;
  const keywords = getDynamicImageKeywords(subject, safeTopic, effectiveThemeCode);

  // Clean topic for titles to avoid double phrasing like "Khám phá sự phát triển của Khám phá..."
  const cleanTopic = safeTopic.replace(/^(Khám phá|Tìm hiểu|Nhận biết|Trải nghiệm)\s+/i, '');

  // Slide 1: COVER
  const s1: AILessonSlide = {
    slide_number: 1,
    layout_type: 'COVER',
    header_tag: '🎓 TRƯỜNG MẦM NON SƯƠNG MAI',
    title: safeTopic,
    subtitle: `Giáo án ${subjectName} • ${archetype.archetypeName}`,
    pill_badges: [`🎓 Khối ${gradeInfo.label}`, `⏱ Thời lượng: ${gradeInfo.duration}`, `${themeMatrix.defaultIcon} Chủ đề: ${themeName}`],
    content_points: [`Khối: ${gradeInfo.label}`, `Thời lượng: ${gradeInfo.duration}`, `Chủ đề: ${themeName}`],
    image_prompt: `Preschool children learning about ${safeTopic}, bright classroom`,
    image_url: getPollinationsImageUrl(`Preschool children learning about ${safeTopic}`, 1024, 768, 1, keywords)
  };

  // Slide 2: DARK_HERO (5E - Engage)
  const s2: AILessonSlide = {
    slide_number: 2,
    layout_type: 'DARK_HERO',
    pill_badges: [`🧭 BƯỚC 1: GẮN KẾT & KHÁM PHÁ (${archetype.archetypeName.toUpperCase()})`],
    title: `Bí Mật Khám Phá: ${cleanTopic}`,
    subtitle: `${archetype.openerHeadline}\n${archetype.openerDetail}`,
    content_points: [`Gắn kết và gây hứng thú khám phá đề tài "${safeTopic}" qua trải nghiệm mở đầu`],
    image_prompt: `Magic glowing educational illustration about ${safeTopic}`,
    image_url: getPollinationsImageUrl(`Magic glowing ${safeTopic} illustration`, 1024, 768, 2, keywords)
  };

  // Slide 3 & Slide 4: Subject Domain Branching for Grid Cards, Timeline, Objectives & Practical Steps
  const normSub = (subject || '').toUpperCase();

  let gridCards = [
    { icon: themeMatrix.defaultIcon, title: `🌱 Đặc Điểm Cốt Lõi`, desc: `Trẻ quan sát trực quan hình dáng, màu sắc và cấu tạo chính của ${cleanTopic}.` },
    { icon: '⭐', title: `🔍 Yếu Tố Tự Nhiên`, desc: `Phân tích môi trường sống, đặc tính và sự phát triển thực tế của ${cleanTopic}.` },
    { icon: '👐', title: `Thao Tác Trải Nghiệm`, desc: `Trẻ tự tay sờ nắn và thực hành với học liệu: ${studentMaterials.slice(0, 2).join(', ') || 'đồ dùng nhóm'}.` },
    { icon: '💡', title: `Bài Học Chăm Sóc`, desc: `Trẻ thảo luận nhóm, rút ra bài học tự giác bảo vệ và giữ gìn môi trường.` }
  ];

  let timelineSteps = [
    { step_num: 1, title: '1. Khởi Động Quan Sát', desc: `Trẻ tập trung quan sát mẫu trực quan bài học "${cleanTopic}" và lắng nghe gợi mở của cô.` },
    { step_num: 2, title: '2. Thao Tác Trực Tiếp', desc: `Các nhóm 4-5 trẻ sử dụng ${studentMaterials[0] || 'đồ dùng học tập'} thực hành trải nghiệm.` },
    { step_num: 3, title: '3. Thảo Luận Đồng Đội', desc: `Tham gia trò chơi tương tác đồng đội khắc sâu kiến thức trọng tâm.` },
    { step_num: 4, title: '4. Tự Tin Trình Bày', desc: 'Trẻ tự tin giới thiệu sản phẩm trải nghiệm trước cô giáo và các bạn.' }
  ];

  let listPoints = [
    `Phát triển nhận thức: Trẻ bóc tách và phân biệt rõ các đặc trưng của ${cleanTopic}.`,
    `Hình thành kỹ năng: Trẻ tự tay thực hành khéo léo với ${studentMaterials.slice(0, 2).join(', ') || 'đồ dùng nhóm'}.`,
    `Giao tiếp tự tin: Luyện phản xạ lời thoại "🗣️ Cô hỏi - 👦 Trẻ đáp" rạng rỡ tại lớp.`,
    `Giáo dục tình cảm: Hình thành thói quen tốt và niềm vui khám phá bài học.`
  ];

  let numSteps = [
    { step_num: 1, title: 'Bước 1 - Tiếp nhận khay học liệu', desc: `Trẻ nhận đồ dùng trải nghiệm: ${studentMaterials.join(', ') || 'đồ dùng học tập'}.` },
    { step_num: 2, title: 'Bước 2 - Phối hợp nhóm thực hành', desc: `Các nhóm phân công nhau quan sát, thao tác và trao đổi rôm rả.` },
    { step_num: 3, title: 'Bước 3 - Hoàn thiện & Thu dọn', desc: 'Trẻ hoàn thành sản phẩm trải nghiệm và tự giác cất đồ dùng về đúng nơi.' }
  ];

  if (normSub.includes('LQVT') || normSub.includes('TOÁN')) {
    gridCards = [
      { icon: '🔢', title: 'Nhận Biết Số Lượng', desc: `Trẻ đếm, nhận biết và so sánh số lượng liên quan đến đề tài ${cleanTopic}.` },
      { icon: '📐', title: 'Hình Dáng & Kích Thước', desc: `Phân biệt hình khối, kích thước to - nhỏ, cao - thấp hoặc vị trí trong không gian.` },
      { icon: '🧮', title: 'Thao Tác Đếm Tương Ứng', desc: `Trẻ tự tay thực hành xếp tương ứng 1-1 bằng học liệu: ${studentMaterials.slice(0, 2).join(', ') || 'que tính, thẻ số'}.` },
      { icon: '🧩', title: 'Thách Thức Toán Học', desc: `Tham gia trò chơi tìm số, xếp chuỗi quy tắc và giải đố toán học rạng rỡ.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Quan Sát Đồ Dùng Mẫu', desc: `Trẻ quan sát số lượng/hình khối mẫu bài học "${cleanTopic}" và lắng nghe gợi mở của cô.` },
      { step_num: 2, title: '2. Thao Tác Đếm & Phân Loại', desc: `Các nhóm 4-5 trẻ sử dụng ${studentMaterials[0] || 'que tính, thẻ số'} đếm và xếp tương ứng 1-1.` },
      { step_num: 3, title: '3. So Sánh & Thảo Luận', desc: `So sánh nhóm nhiều hơn - ít hơn, thảo luận kết quả cùng đồng đội.` },
      { step_num: 4, title: '4. Phản Xạ Toán Học', desc: `Trẻ tự tin lên bảng tham gia trò chơi nối số, xếp hình và nhận thưởng.` }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ nắm vững khái niệm số lượng, hình khối và kích thước bài toán ${cleanTopic}.`,
      `Hình thành kỹ năng: Thao tác đếm thành thạo, xếp tương ứng 1-1 chính xác với ${studentMaterials.slice(0, 2).join(', ') || 'thẻ số, que tính'}.`,
      `Giao tiếp tự tin: Trả lời rành mạch các câu hỏi đếm số và so sánh trước lớp.`,
      `Hứng thú toán học: Yêu thích môn toán qua các trò chơi tương tác vui nhộn.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Lấy khay đồ dùng toán', desc: `Trẻ nhận khay thẻ số và học liệu đếm: ${studentMaterials.join(', ') || 'thẻ số, hạt bắp'}.` },
      { step_num: 2, title: 'Bước 2 - Đếm & Xếp tương ứng', desc: 'Trẻ xếp học liệu từ trái sang phải, đếm to và dán thẻ số tương ứng.' },
      { step_num: 3, title: 'Bước 3 - Kiểm tra & Thu dọn', desc: 'Cô kiểm tra kết quả từng nhóm, trẻ tự giác cất đồ dùng toán gọn gàng.' }
    ];
  } else if (normSub.includes('LQCC') || normSub.includes('CHỮ CÁI')) {
    gridCards = [
      { icon: '🔤', title: 'Nhận Biết Mặt Chữ', desc: `Trẻ quan sát chữ cái in hoa, in thường và viết thường bài học ${cleanTopic}.` },
      { icon: '🗣️', title: 'Phát Âm Chuẩn', desc: `Luyện phát âm chuẩn khẩu hình, nghe và nhận biết âm đầu trong từ.` },
      { icon: '✍️', title: 'Tạo Hình Nét Chữ', desc: `Trẻ tự tay xếp nét chữ từ học liệu: ${studentMaterials.slice(0, 2).join(', ') || 'đất nặn, dây điện, hạt bắp'}.` },
      { icon: '🎮', title: 'Trò Chơi Chữ Cái', desc: `Tìm chữ cái còn thiếu trong từ ghép, chơi đố vui phản xạ chữ cái.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Quan Sát Mặt Chữ Mẫu', desc: `Trẻ quan sát tranh từ khóa chứa chữ cái bài học "${cleanTopic}" và nghe cô phát âm.` },
      { step_num: 2, title: '2. Phân Tích Nét Chữ', desc: 'Trẻ phân tích nét thẳng, nét cong, nét xiên cấu tạo nên chữ cái.' },
      { step_num: 3, title: '3. Thực Hành Xếp Nét', desc: `Sử dụng ${studentMaterials[0] || 'đất nặn, hạt bắp'} uốn nét và xếp thành chữ cái hoàn chỉnh.` },
      { step_num: 4, title: '4. Tìm Chữ Trong Từ', desc: 'Trẻ tự tin tìm và gạch chân chữ cái vừa học trong bảng từ xung quanh lớp.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ nhận biết đúng mặt chữ, phát âm chuẩn khẩu hình chữ cái ${cleanTopic}.`,
      `Hình thành kỹ năng: Nhận biết cấu tạo nét chữ và tự tay uốn nét với ${studentMaterials.slice(0, 2).join(', ') || 'đất nặn, dây mềm'}.`,
      `Giao tiếp tự tin: Phát âm to, rõ ràng và nói trọn câu khi tìm từ chứa chữ cái.`,
      `Thói quen đọc viết: Hình thành tâm thế yêu thích học chữ cái sẵn sàng vào Lớp 1.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Quan sát & Phát âm', desc: 'Trẻ nhìn khẩu hình mẫu của cô, phát âm to rõ ràng chữ cái bài học.' },
      { step_num: 2, title: 'Bước 2 - Rèn kỹ năng xếp nét', desc: `Trẻ dùng ${studentMaterials.join(', ') || 'đất nặn'} uốn từng nét chữ trên bảng con.` },
      { step_num: 3, title: 'Bước 3 - Thi tài tìm chữ', desc: 'Các nhóm lên bảng tìm và dán thẻ chữ vào đúng ô từ khóa.' }
    ];
  } else if (normSub.includes('LQVH') || normSub.includes('VĂN HỌC') || normSub.includes('THƠ') || normSub.includes('KỂ CHUYỆN')) {
    gridCards = [
      { icon: '📖', title: 'Cảm Nhận Nhịp Thơ/Truyện', desc: `Lắng nghe cô đọc thơ / kể chuyện diễn cảm về đề tài ${cleanTopic}.` },
      { icon: '🎭', title: 'Nhân Vật & Tính Cách', desc: `Tìm hiểu hình ảnh, tính cách và cảm xúc của từng nhân vật trong tác phẩm.` },
      { icon: '💬', title: 'Luyện Nói & Lời Thoại', desc: `Trẻ nói trọn câu, luyện trích dẫn thơ hoặc nhập vai thể hiện lời thoại.` },
      { icon: '🌟', title: 'Bài Học Nhân Văn', desc: `Rút ra bài học đạo đức, tình yêu thương và sự hiếu thảo từ câu chuyện.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Nghe Kể Chuyện / Đọc Thơ', desc: `Trẻ lắng nghe cô đọc thơ / kể chuyện sa bàn diễn cảm đề tài "${cleanTopic}".` },
      { step_num: 2, title: '2. Đàm Thoại Trích Dẫn', desc: 'Thảo luận nội dung, trích dẫn từng đoạn thơ / lời thoại nhân vật sinh động.' },
      { step_num: 3, title: '3. Thể Hiện Lời Thoại', desc: 'Trẻ luyện đọc thơ / kể lại đoạn truyện theo nhóm rạng rỡ.' },
      { step_num: 4, title: '4. Đóng Kịch Minh Họa', desc: 'Đeo mũ hóa trang, tự tin nhập vai thể hiện tiểu phẩm câu chuyện trên sân khấu.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ hiểu nội dung bài thơ / câu chuyện và nhớ tên các nhân vật ${cleanTopic}.`,
      `Hình thành kỹ năng: Trích dẫn thơ diễn cảm, thể hiện giọng điệu nhân vật với ${studentMaterials.slice(0, 2).join(', ') || 'mũ hóa trang, rối ngón tay'}.`,
      `Giao tiếp tự tin: Diễn đạt cảm xúc mạch lạc, tự tin đóng kịch trước lớp.`,
      `Giáo dục nhân văn: Thấm nhuần bài học đạo đức và thói quen yêu thương gia đình, bạn bè.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Lắng nghe tác phẩm', desc: 'Trẻ tập trung quan sát sa bàn rối và nghe cô đọc/kể tác phẩm văn học.' },
      { step_num: 2, title: 'Bước 2 - Đàm thoại trích dẫn', desc: 'Trẻ trả lời các câu hỏi đàm thoại và tập trích dẫn lời thoại nhân vật.' },
      { step_num: 3, title: 'Bước 3 - Nhập vai thể hiện', desc: `Đeo ${studentMaterials[0] || 'mũ hóa trang'} cùng bạn thể hiện trọn vẹn tiểu phẩm.` }
    ];
  } else if (normSub.includes('TAO_HINH') || normSub.includes('TẠO HÌNH')) {
    gridCards = [
      { icon: '🎨', title: 'Quan Sát Mẫu Vẻ Đẹp', desc: `Trẻ đàm thoại về màu sắc, đường nét và bố cục sản phẩm mẫu ${cleanTopic}.` },
      { icon: '🛠️', title: 'Kỹ Thuật Tạo Hình', desc: `Khám phá kỹ năng vẽ, nặn, xé dán hoặc cắt dán tạo nên sản phẩm.` },
      { icon: '👐', title: 'Bàn Tay Khéo Léo', desc: `Trẻ tự tay thực hành sáng tạo sản phẩm bằng học liệu: ${studentMaterials.slice(0, 2).join(', ') || 'giấy màu, đất nặn'}.` },
      { icon: '🖼️', title: 'Triển Lãm Sản Phẩm', desc: `Tự tin trưng bày và chia sẻ ý tưởng sáng tạo độc đáo cùng cô bạn.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Quan Sát Đàm Thoại Mẫu', desc: `Trẻ đàm thoại vẻ đẹp, màu sắc và đường nét sản phẩm mẫu bài học "${cleanTopic}".` },
      { step_num: 2, title: '2. Cô Hướng Dẫn Thao Tác', desc: 'Cô thao tác mẫu kỹ năng tạo hình và gợi mở các ý tưởng sáng tạo.' },
      { step_num: 3, title: '3. Trẻ Thực Hành Sáng Tạo', desc: `Các nhóm sử dụng ${studentMaterials[0] || 'giấy màu, đất nặn, sáp màu'} tự tay hoàn thiện sản phẩm.` },
      { step_num: 4, title: '4. Triển Lãm & Nhận Xét', desc: 'Trẻ trưng bày sản phẩm trên giá triển lãm, chia sẻ cảm xúc sáng tạo.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ cảm nhận vẻ đẹp màu sắc, đường nét và bố cục tạo hình ${cleanTopic}.`,
      `Hình thành kỹ năng: Sử dụng khéo léo kỹ năng vẽ/nặn/xé dán với ${studentMaterials.slice(0, 2).join(', ') || 'sáp màu, đất nặn, kéo đầu tròn'}.`,
      `Giao tiếp tự tin: Giới thiệu ý tưởng tác phẩm nghệ thuật trước cô giáo và các bạn.`,
      `Phát triển thẩm mỹ: Yêu thích cái đẹp, biết giữ gìn và trân trọng sản phẩm của mình và bạn.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Chuẩn bị học liệu tạo hình', desc: `Trẻ nhận khay đồ dùng: ${studentMaterials.join(', ') || 'giấy màu, sáp màu'}.` },
      { step_num: 2, title: 'Bước 2 - Thực hành sáng tạo', desc: 'Trẻ tập trung thao tác khéo léo tạo nên sản phẩm theo ý tưởng cá nhân.' },
      { step_num: 3, title: 'Bước 3 - Triển lãm & Trưng bày', desc: 'Trẻ tự tay mang sản phẩm lên giá triển lãm của lớp và thu dọn đồ dùng.' }
    ];
  } else if (normSub.includes('LQAN') || normSub.includes('ÂM NHẠC')) {
    gridCards = [
      { icon: '🎶', title: 'Giai Điệu & Lời Ca', desc: `Cảm nhận giai điệu vui tươi, nhịp điệu rộn ràng của bài hát ${cleanTopic}.` },
      { icon: '🎤', title: 'Hát Đúng Nhịp Điệu', desc: `Luyện hát đúng lời, đúng giai điệu và hòa giọng nhịp nhàng cùng các bạn.` },
      { icon: '🥁', title: 'Gõ Đệm Dụng Cụ', desc: `Thực hành gõ đệm theo tiết tấu bằng học liệu: ${studentMaterials.slice(0, 2).join(', ') || 'phách tre, xắc xô'}.` },
      { icon: '💃', title: 'Vận Động Minh Họa', desc: `Sáng tạo các động tác múa, nhún nhảy sinh động theo giai điệu bài hát.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Cảm Nhận Giai Điệu', desc: `Trẻ lắng nghe cô hát / phát nhạc bài hát "${cleanTopic}", cảm nhận giai điệu.` },
      { step_num: 2, title: '2. Luyện Hát Hòa Giọng', desc: 'Trẻ tập hát đúng lời, đúng nhịp điệu rộn ràng cùng cô và các bạn.' },
      { step_num: 3, title: '3. Gõ Đệm Dụng Cụ', desc: `Sử dụng ${studentMaterials[0] || 'phách tre, xắc xô'} gõ đệm theo tiết tấu bài hát.` },
      { step_num: 4, title: '4. Biểu Diễn Văn Nghệ', desc: 'Trẻ đeo hoa tay múa, tự tin biểu diễn sân khấu âm nhạc rạng rỡ.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ cảm nhận giai điệu, tên bài hát và tác giả đề tài ${cleanTopic}.`,
      `Hình thành kỹ năng: Hát đúng nhịp, vận động minh họa khéo léo với ${studentMaterials.slice(0, 2).join(', ') || 'phách tre, xắc xô, hoa đeo tay'}.`,
      `Giao tiếp tự tin: Biểu diễn văn nghệ rạng rỡ, phối hợp đồng đội nhịp nhàng.`,
      `Phát triển âm nhạc: Yêu thích âm nhạc, tự tin thể hiện cảm xúc hồn nhiên.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Lắng nghe giai điệu', desc: 'Trẻ tập trung lắng nghe giai điệu bài hát và hát nhẩm theo cô.' },
      { step_num: 2, title: 'Bước 2 - Luyện hát & Gõ đệm', desc: `Trẻ sử dụng ${studentMaterials[0] || 'phách tre'} gõ đệm theo nhịp bài hát.` },
      { step_num: 3, title: 'Bước 3 - Biểu diễn sân khấu', desc: 'Từng nhóm trẻ lên sân khấu đeo hoa múa biểu diễn văn nghệ rạng rỡ.' }
    ];
  } else if (normSub.includes('PTVD') || normSub.includes('PTVĐ') || normSub.includes('VẬN ĐỘNG')) {
    gridCards = [
      { icon: '🧘', title: 'Khởi Động Cơ Thể', desc: `Trẻ thực hành các động tác khởi động xoay khớp, làm nóng toàn thân.` },
      { icon: '🏃', title: 'Vận Động Cơ Bản', desc: `Luyện kỹ năng vận động (bật, bò, trườn, ném, chạy) đúng kỹ thuật chuẩn.` },
      { icon: '🎯', title: 'Thi Đua Đồng Đội', desc: `Phối hợp nhóm tham gia trò chơi vận động rèn sức bền và sự khéo léo.` },
      { icon: '🌿', title: 'Hồi Tĩnh Thư Giãn', desc: `Đi lại nhẹ nhàng, hít thở sâu và điều hòa cơ thể sau khi vận động.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Khởi Động Xoay Khớp', desc: 'Trẻ đi các kiểu đi và xoay khớp cổ tay, cổ chân làm nóng cơ thể.' },
      { step_num: 2, title: '2. Cô Làm Mẫu Kỹ Thuật', desc: `Cô tập mẫu vận động cơ bản "${cleanTopic}", hướng dẫn tư thế chuẩn.` },
      { step_num: 3, title: '3. Trẻ Thực Hành Vận Động', desc: `Các nhóm dùng ${studentMaterials[0] || 'vạch chuẩn, bóng nhựa'} thực hành vận động nhiều lần.` },
      { step_num: 4, title: '4. Thi Đua & Hồi Tĩnh', desc: 'Tham gia trò chơi vận động thi đua và đi lại nhẹ nhàng hồi tĩnh.' }
    ];
    listPoints = [
      `Phát triển thể chất: Trẻ tăng cường sức khỏe, sự dẻo dai và phản xạ nhanh nhẹn với bài tập ${cleanTopic}.`,
      `Hình thành kỹ năng: Thực hiện đúng kỹ thuật vận động cơ bản phối hợp với ${studentMaterials.slice(0, 2).join(', ') || 'túi cát, bóng nhựa'}.`,
      `Tinh thần đồng đội: Biết hợp tác, tuân thủ luật chơi trong trò chơi vận động nhóm.`,
      `Thói quen rèn luyện: Yêu thích vận động thể thao nâng cao sức khỏe mỗi ngày.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Khởi động sinh động', desc: 'Trẻ khởi động các khớp theo nhịp còi hiệu của cô giáo.' },
      { step_num: 2, title: 'Bước 2 - Thực hành kỹ năng', desc: 'Trẻ nối đuôi nhau thực hiện bài tập vận động cơ bản đúng kỹ thuật.' },
      { step_num: 3, title: 'Bước 3 - Trò chơi thi đua', desc: 'Các đội thi đua tiếp sức vận động và thả lỏng hồi tĩnh thư giãn.' }
    ];
  } else if (normSub.includes('DINH_DUONG') || normSub.includes('DINH DƯỠNG') || normSub.includes('SỨC KHỎE')) {
    gridCards = [
      { icon: '🥗', title: '4 Nhóm Thực Phẩm', desc: `Nhận biết 4 nhóm chất dinh dưỡng cần thiết qua bài học ${cleanTopic}.` },
      { icon: '🧼', title: 'Vệ Sinh 6 Bước', desc: `Thực hành quy trình rửa tay 6 bước, giữ gìn vệ sinh cá nhân sạch sẽ.` },
      { icon: '🍎', title: 'Thói Quên Ăn Uống', desc: `Rèn thói quen ăn chín uống sôi, ăn hết suất và uống đủ nước mỗi ngày.` },
      { icon: '🛡️', title: 'Bảo Vệ Cơ Thể', desc: `Hình thành ý thức tự chăm sóc sức khỏe để cơ thể cao lớn khỏe mạnh.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Khám Phá Thực Phẩm / Vệ Sinh', desc: `Quan sát thực tế thực phẩm / quy trình vệ sinh bài học "${cleanTopic}".` },
      { step_num: 2, title: '2. Thao Tác Trải Nghiệm', desc: `Thực hành phân loại món ăn / rửa tay với ${studentMaterials[0] || 'xà phòng, khăn sạch'}.` },
      { step_num: 3, title: '3. Thảo Luận Lợi Ích', desc: 'Đàm thoại về tác dụng của món ăn bổ dưỡng và thói quen vệ sinh.' },
      { step_num: 4, title: '4. Cam Kết Thực Hành', desc: 'Trẻ hứa ăn đủ chất, rửa tay sạch sẽ và giữ gìn sức khỏe mỗi ngày.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ phân biệt 4 nhóm chất thực phẩm và các quy tắc vệ sinh cá nhân ${cleanTopic}.`,
      `Hình thành kỹ năng: Thực hành thuần thục rửa tay 6 bước và sắp xếp khay ăn với ${studentMaterials.slice(0, 2).join(', ') || 'khăn mặt, xà phòng'}.`,
      `Giao tiếp tự tin: Trả lời tự tin về ích lợi của thực phẩm sạch đối với sức khỏe.`,
      `Thói quen văn minh: Hình thành thói quen ăn uống lành mạnh và giữ gìn vệ sinh lớp học.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Quan sát thực phẩm/vệ sinh', desc: 'Trẻ xem mô hình thực phẩm và tranh 6 bước rửa tay chuẩn.' },
      { step_num: 2, title: 'Bước 2 - Thực hành trải nghiệm', desc: `Trẻ thực hành phân loại món ăn / rửa tay bằng ${studentMaterials[0] || 'xà phòng'}.` },
      { step_num: 3, title: 'Bước 3 - Tổng kết thói quen ngoan', desc: 'Trẻ cùng cô đúc kết thông điệp dinh dưỡng và nhận sticker Bé Khỏe Ngoan.' }
    ];
  } else if (normSub.includes('KNS') || normSub.includes('KỸ NĂNG SỐNG')) {
    gridCards = [
      { icon: '🚨', title: 'Nhận Diện Tình Huống', desc: `Trẻ quan sát tình huống thực tế nguy hiểm / ứng xử liên quan đến ${cleanTopic}.` },
      { icon: '💡', title: 'Giải Pháp An Toàn', desc: `Phân tích quy tắc an toàn, cách xử lý nguy cơ và bảo vệ bản thân.` },
      { icon: '🤝', title: 'Ứng Xử Văn Minh', desc: `Luyện thói quen chào hỏi lễ phép, nói lời cảm ơn, xin lỗi và chia sẻ.` },
      { icon: '🎭', title: 'Sắm Vai Thực Hành', desc: `Trẻ thực hành nhập vai xử lý tình huống thực tế cùng các bạn.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Quan Sát Tình Huống', desc: `Xem tình huống giả định thực tế bài học kỹ năng sống "${cleanTopic}".` },
      { step_num: 2, title: '2. Phân Tích Đúng - Sai', desc: 'Thảo luận nhóm chỉ ra hành động an toàn / chưa an toàn trong tình huống.' },
      { step_num: 3, title: '3. Sắm Vai Xử Lý', desc: 'Trẻ thực hành sắm vai xử lý tình huống đúng cách cùng đồng đội.' },
      { step_num: 4, title: '4. Ghi Nhớ Quy Tắc', desc: 'Đúc kết quy tắc an toàn kỹ năng sống và tự tin cam kết thực hiện.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ phân biệt hành động an toàn - nguy hiểm liên quan đến đề tài ${cleanTopic}.`,
      `Hình thành kỹ năng: Thực hành xử lý tình huống thực tế khéo léo với ${studentMaterials.slice(0, 2).join(', ') || 'thẻ tình huống, mũ nhập vai'}.`,
      `Giao tiếp văn minh: Biết nói lời chào hỏi, cảm ơn, xin lỗi và kêu gọi sự hỗ trợ khi cần.`,
      `Ý thức bản thân: Hình thành bản lĩnh tự vệ và kỹ năng sống an toàn mọi lúc mọi nơi.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Xem kịch bản tình huống', desc: 'Trẻ tập trung xem cô minh họa tình huống kỹ năng sống thực tế.' },
      { step_num: 2, title: 'Bước 2 - Thảo luận & Sắm vai', desc: 'Các nhóm phân công nhau sắm vai xử lý tình huống đúng quy tắc an toàn.' },
      { step_num: 3, title: 'Bước 3 - Tuyên dương phản xạ tốt', desc: 'Cô nhận xét dương tính và trao huy hiệu Hiệp Sĩ An Toàn cho các bé.' }
    ];
  } else if (normSub.includes('KPXH') || normSub.includes('XÃ HỘI')) {
    gridCards = [
      { icon: '🏛️', title: 'Đời Sống & Con Người', desc: `Tìm hiểu vai trò, ý nghĩa các hoạt động xã hội xung quanh đề tài ${cleanTopic}.` },
      { icon: '🇻🇳', title: 'Văn Hóa Quê Hương', desc: `Cảm nhận nét đẹp truyền thống, danh lam thắng cảnh và bản sắc Việt Nam.` },
      { icon: '🤝', title: 'Giao Tiếp Cộng Đồng', desc: `Luyện kỹ năng hợp tác nhóm, giao tiếp văn minh và chia sẻ tập thể.` },
      { icon: '🛡️', title: 'Trách Nhiệm Xã Hội', desc: `Hình thành thói quen tuân thủ quy định chung và giữ gìn môi trường.` }
    ];
    timelineSteps = [
      { step_num: 1, title: '1. Xem Tư Liệu Thực Tế', desc: `Quan sát hình ảnh/video đời sống xã hội về đề tài "${cleanTopic}".` },
      { step_num: 2, title: '2. Khám Phá Vai Trò Ý Nghĩa', desc: 'Trẻ tìm hiểu công việc, nét đẹp văn hóa và tình cảm cộng đồng.' },
      { step_num: 3, title: '3. Trải Nghiệm Mô Phỏng', desc: `Thực hành sử dụng ${studentMaterials[0] || 'học liệu mô phỏng'} nhập vai công việc.` },
      { step_num: 4, title: '4. Chia Sẻ Cảm Xúc', desc: 'Trẻ tự tin bày tỏ ước mơ, tình cảm yêu quý quê hương con người.' }
    ];
    listPoints = [
      `Phát triển nhận thức: Trẻ hiểu biết sâu sắc về đời sống xã hội, công việc và nét đẹp quê hương ${cleanTopic}.`,
      `Hình thành kỹ năng: Thực hành phối hợp nhóm, đóng vai trải nghiệm với ${studentMaterials.slice(0, 2).join(', ') || 'trang phục mô phỏng, lô tô'}.`,
      `Giao tiếp cộng đồng: Tự tin trò chuyện, thể hiện sự tôn trọng và hòa đồng với mọi người.`,
      `Tình yêu quê hương: Yêu kính Bác Hồ, tự hào về quê hương đất nước Việt Nam.`
    ];
    numSteps = [
      { step_num: 1, title: 'Bước 1 - Quan sát sa bàn xã hội', desc: 'Trẻ quan sát sa bàn/hình ảnh trực quan về chủ đề xã hội.' },
      { step_num: 2, title: 'Bước 2 - Trải nghiệm công việc', desc: 'Trẻ nhập vai tham gia hoạt động mô phỏng ngành nghề/lễ hội.' },
      { step_num: 3, title: 'Bước 3 - Chia sẻ ước mơ', desc: 'Trẻ tự tin chia sẻ cảm nghĩ và thu dọn góc trải nghiệm sạch đẹp.' }
    ];
  } else {
    // KPKH / Default Science Exploration (Fall back to theme-based gridCards if set)
    if (effectiveThemeCode === 'DONG_VAT') {
      const subCat = detectTopicSubCategory(safeTopic, effectiveThemeCode);
      if (subCat === 'DONG_VAT_AQUATIC') {
        gridCards = [
          { icon: '🐟', title: 'Cấu Tạo Vây & Đuôi', desc: `Trẻ nhận biết ngoại hình, vây bơi, đuôi và cách sinh tồn dưới nước của ${cleanTopic}.` },
          { icon: '🌊', title: 'Môi Trường Thủy Sinh', desc: `Phân tích nguồn nước, thức ăn và môi trường đại dương/sông hồ của loài cá.` },
          { icon: '🎭', title: 'Mô Phỏng Cá Bơi', desc: `Trẻ nhún nhảy mô phỏng động tác cá bơi uốn lượn rộn ràng cùng bạn.` },
          { icon: '🪸', title: 'Bảo Vệ Nguồn Nước', desc: `Rèn luyện ý thức giữ gìn nguồn nước sạch và bảo vệ sinh vật biển.` }
        ];
      } else if (subCat === 'DONG_VAT_WILD') {
        gridCards = [
          { icon: '🦁', title: 'Dáng Đi & Tiếng Gầm', desc: `Trẻ nhận biết vóc dáng, dấu chân, tiếng kêu và sự di chuyển của ${cleanTopic}.` },
          { icon: '🌳', title: 'Môi Trường Rừng Xanh', desc: `Khám phá nơi sinh sống hoang dã và nguồn thức ăn tự nhiên trong rừng.` },
          { icon: '🎭', title: 'Nhập Vai Rừng Đại Ngàn', desc: `Trẻ đeo mũ hóa trang mô phỏng dáng đi của động vật hoang dã.` },
          { icon: '💚', title: 'Bảo Vệ Rừng Xanh', desc: `Hình thành thói quen yêu quý động vật hoang dã và thiên nhiên.` }
        ];
      } else {
        gridCards = [
          { icon: '🐾', title: 'Dáng Đi & Tiếng Kêu', desc: `Trẻ nhận biết ngoại hình, tiếng kêu và đặc điểm vận động của ${cleanTopic}.` },
          { icon: '🌾', title: 'Thức Ăn & Môi Trường', desc: `Tìm hiểu món ăn yêu thích và môi trường sống tự nhiên của con vật.` },
          { icon: '🎭', title: 'Nhập Vai Mô Phỏng', desc: `Trẻ đóng vai mô phỏng động tác khéo léo và tương tác cùng các bạn.` },
          { icon: '❤️', title: 'Yêu Thương Động Vật', desc: `Hình thành tình cảm quý mến và thói quen bảo vệ các loài động vật.` }
        ];
      }
    } else if (effectiveThemeCode === 'GIAO_THONG') {
      const subCat = detectTopicSubCategory(safeTopic, effectiveThemeCode);
      if (subCat === 'GIAO_THONG_WATERWAY') {
        gridCards = [
          { icon: '⛵', title: 'Đặc Điểm Tàu Thuyền', desc: `Trẻ phân biệt cấu tạo thân thuyền, cánh buồm, bánh lái và môi trường sông nước của ${cleanTopic}.` },
          { icon: '🛟', title: 'Thiết Bị An Toàn', desc: `Nhận biết áo phao cứu sinh, phao tròn và vạch neo đậu tại bến tàu an toàn.` },
          { icon: '🛠️', title: 'Thực Hành Mô Hình', desc: `Trẻ tự tay thao tác lắp ráp: ${studentMaterials.slice(0, 2).join(', ') || 'mô hình thuyền buồm, phao tròn'}.` },
          { icon: '⚓', title: 'Văn Hóa An Toàn', desc: `Rèn luyện ý thức mặc áo phao, ngồi yên trên tàu thuyền và chấp hành quy định.` }
        ];
      } else if (subCat === 'GIAO_THONG_AIRWAY') {
        gridCards = [
          { icon: '✈️', title: 'Đặc Điểm Máy Bay', desc: `Trẻ phân biệt cấu tạo cánh máy bay, động cơ, phi công và bầu trời của ${cleanTopic}.` },
          { icon: '🛬', title: 'Tín Hiệu Sân Bay', desc: `Nhận biết dây an toàn, đèn hiệu đường băng và hướng dẫn của tiếp viên.` },
          { icon: '🛠️', title: 'Thực Hành Mô Hình', desc: `Trẻ tự tay thao tác lắp ráp: ${studentMaterials.slice(0, 2).join(', ') || 'mô hình máy bay'}.` },
          { icon: '🛡️', title: 'Văn Hóa An Toàn', desc: `Rèn luyện ý thức thắt dây an toàn và tuân thủ quy định bay.` }
        ];
      } else if (subCat === 'GIAO_THONG_RAILWAY') {
        gridCards = [
          { icon: '🚂', title: 'Đặc Điểm Tàu Hỏa', desc: `Trẻ phân biệt cấu tạo toa tàu, đầu máy, đường ray và ga tàu của ${cleanTopic}.` },
          { icon: '🛤️', title: 'Tín Hiệu Đường Sắt', desc: `Nhận biết rào chắn tự động, còi hiệu và đèn cảnh báo ga tàu.` },
          { icon: '🛠️', title: 'Thực Hành Mô Hình', desc: `Trẻ tự tay thao tác lắp ráp: ${studentMaterials.slice(0, 2).join(', ') || 'mô hình tàu hỏa'}.` },
          { icon: '🛡️', title: 'Văn Hóa An Toàn', desc: `Rèn luyện ý thức không chơi gần đường ray và chấp hành luật an toàn.` }
        ];
      } else {
        gridCards = [
          { icon: '🚗', title: 'Đặc Điểm Phương Tiện', desc: `Trẻ phân biệt cấu tạo bánh xe, còi xe và môi trường đường bộ của ${cleanTopic}.` },
          { icon: '🚦', title: 'Biển Báo & Tín Hiệu', desc: `Nhận biết tín hiệu đèn giao thông, mũ bảo hiểm và vạch đi bộ sang đường.` },
          { icon: '🛠️', title: 'Thực Hành Mô Hình', desc: `Trẻ tự tay thao tác lắp ráp: ${studentMaterials.slice(0, 2).join(', ') || 'mô hình xe'}.` },
          { icon: '🛡️', title: 'Văn Hóa An Toàn', desc: `Rèn luyện ý thức đội mũ bảo hiểm và chấp hành luật giao thông.` }
        ];
      }
    } else if (effectiveThemeCode === 'BAN_THAN') {
      gridCards = [
        { icon: '🖐️', title: 'Khám Phá Giác Quan', desc: `Trẻ nhận biết các giác quan và bộ phận cơ thể liên quan đến ${cleanTopic}.` },
        { icon: '😃', title: 'Cảm Xúc Rạng Rỡ', desc: `Thể hiện nụ cười, niềm vui và sự tự tin khi tham gia hoạt động lớp.` },
        { icon: '🤝', title: 'Tương Tác Bạn Bè', desc: `Trẻ thực hành phối hợp học liệu: ${studentMaterials.slice(0, 2).join(', ') || 'khay đồ dùng'}.` },
        { icon: '🌟', title: 'Bài Học Tự Lập', desc: `Rèn thói quen tự chăm sóc bản thân và vệ sinh cá nhân sạch sẽ.` }
      ];
    }
  }

  const s3: AILessonSlide = {
    slide_number: 3,
    layout_type: 'GRID_4_CARDS',
    title: `⚙️ 4 Yếu Tố Khám Phá: ${cleanTopic}`,
    cards_data: gridCards,
    content_points: gridCards.map(c => `${c.title}: ${c.desc}`),
    image_prompt: `Educational 4 icons set layout for kindergarten learning about ${safeTopic}`,
    image_url: getPollinationsImageUrl(`Educational 4 icons set layout for kindergarten learning about ${safeTopic}`, 1024, 768, 3, keywords)
  };

  const s4: AILessonSlide = {
    slide_number: 4,
    layout_type: 'TIMELINE_4_STEPS',
    title: `🔄 Tiến Trình Vòng Đời & Các Bước Học`,
    steps_data: timelineSteps,
    content_points: timelineSteps.map(s => `${s.title}: ${s.desc}`),
    image_prompt: `Growth timeline infographic cartoon for ${safeTopic}`,
    image_url: getPollinationsImageUrl(`Growth timeline infographic cartoon for ${safeTopic}`, 1024, 768, 4, keywords)
  };

  // Slide 5: IMAGE_CARDS_3 (Interactive Dialogue & Callout Box) - Dynamic Dialogue
  const imageCards = [
    { 
      title: 'Cô Gợi Mở', 
      desc: archetype.calloutDialogue.teacherAsk, 
      image_url: getPollinationsImageUrl(`${safeTopic} teacher presentation`, 600, 400, 5, keywords) 
    },
    { 
      title: 'Trẻ Phản Xạ', 
      desc: archetype.calloutDialogue.childAnswer, 
      image_url: getPollinationsImageUrl(`${safeTopic} happy kids responding`, 600, 400, 6, keywords) 
    },
    { 
      title: 'Hình Ảnh Trực Quan', 
      desc: `Hình ảnh thực tế gần gũi sân trường Sương Mai: ${archetype.localizedElements.slice(0, 2).join(', ')}.`, 
      image_url: getPollinationsImageUrl(`${safeTopic} vietnamese preschool visual`, 600, 400, 7, keywords) 
    }
  ];

  const s5: AILessonSlide = {
    slide_number: 5,
    layout_type: 'IMAGE_CARDS_3',
    title: `🖼 Kịch Bản Lời Thoại Tương Tác Cô & Trẻ`,
    cards_data: imageCards,
    content_points: imageCards.map(c => `${c.title}: ${c.desc}`),
    image_prompt: `3 stage illustrations of ${safeTopic}`,
    image_url: imageCards[0].image_url
  };

  // Slide 6: TWO_COLUMN_CARDS - Dynamic Columns
  const twoColCards = [
    { 
      icon: themeMatrix.defaultIcon, 
      title: `Trọng Tâm Bài Học: ${cleanTopic}`, 
      desc: `Cô giới thiệu đồ dùng trực quan (${teacherMaterials.join(', ') || 'học liệu cô'}). Hướng dẫn trẻ quan sát và nắm vững quy trình bài học.` 
    },
    { 
      icon: '✨', 
      title: 'Hình Ảnh Bản Địa Hóa Gần Gũi', 
      desc: `Bài học tích hợp các hình ảnh Việt Nam quen thuộc: ${archetype.localizedElements.slice(0, 3).join(', ')}. Giúp trẻ yêu quê hương đất nước.` 
    }
  ];

  const s6: AILessonSlide = {
    slide_number: 6,
    layout_type: 'TWO_COLUMN_CARDS',
    title: `🧩 Phân Tích Nội Dung & Hình Ảnh Thực Tế`,
    cards_data: twoColCards,
    content_points: twoColCards.map(c => `${c.title}: ${c.desc}`),
    image_prompt: `Detailed structural breakdown diagram for kids about ${safeTopic}`,
    image_url: getPollinationsImageUrl(`Detailed structural breakdown diagram for kids about ${safeTopic}`, 1024, 768, 8, keywords)
  };

  const s7: AILessonSlide = {
    slide_number: 7,
    layout_type: 'LIST_ACCENT_IMAGE',
    title: `🍃 Giá Trị & Mục Tiêu Bài Học`,
    content_points: listPoints,
    image_prompt: `Preschool learning concept illustration about ${safeTopic}`,
    image_url: getPollinationsImageUrl(`Preschool learning concept illustration about ${safeTopic}`, 800, 800, 9, keywords)
  };

  const s8: AILessonSlide = {
    slide_number: 8,
    layout_type: 'NUMBERED_STEPS',
    title: `🧪 3 Bước Trẻ Thực Hành Tại Lớp`,
    steps_data: numSteps,
    subtitle: `💚 Hướng dẫn cô giáo: Khích lệ trẻ tự tin sáng tạo và hỗ trợ kịp thời các bé còn bỡ ngỡ!`,
    content_points: numSteps.map(s => `${s.title}: ${s.desc}`),
    image_prompt: `Preschool children practicing step by step cartoon for ${safeTopic}`,
    image_url: getPollinationsImageUrl(`Preschool children practicing step by step cartoon for ${safeTopic}`, 1024, 768, 10, keywords)
  };

  // Slide 9: SPLIT_STORY_IMAGE - Dynamic Narrative
  const s9: AILessonSlide = {
    slide_number: 9,
    layout_type: 'SPLIT_STORY_IMAGE',
    title: `🏫 Góc Trải Nghiệm Trường Sương Mai`,
    subtitle: `Tại không gian học tập Trường Mầm Non Sương Mai, mỗi ngày đến trường là một ngày vui hội ngập tràn nụ cười.\n\nBé cùng các bạn hăng hái khám phá đề tài "${safeTopic}" qua các hình ảnh thân thuộc: ${archetype.localizedElements.slice(0, 3).join(', ')}.`,
    content_points: ['Trẻ hăng hái trải nghiệm tại góc học tập Trường Mầm Non Sương Mai'],
    image_prompt: `Happy Asian kindergarten children learning about ${safeTopic} in Suong Mai school watercolor cartoon`,
    image_url: getPollinationsImageUrl(`Happy Asian kindergarten children learning about ${safeTopic} in Suong Mai school watercolor cartoon`, 1024, 768, 11, keywords)
  };

  // Slide 10: STAT_CALLOUT - Dynamic Stat Highlight
  const s10: AILessonSlide = {
    slide_number: 10,
    layout_type: 'STAT_CALLOUT',
    title: `⭐ Thông Điệp Lớp ${gradeInfo.label.split(' ')[0]}`,
    stat_highlight: {
      number: '100%',
      label: 'Bé Tự Tin Học Ngoan',
      hero_title: `Khám Phá Rạng Rỡ: ${cleanTopic}`,
      hero_desc: `Tất cả các bạn nhỏ Khối ${gradeInfo.label} của Trường Mầm Non Sương Mai đều tích cực tham gia, tự tay thực hành và hào hứng ghi nhớ kiến thức bài học "${safeTopic}".`
    },
    content_points: ['100% Bé tích cực tham gia và ghi nhớ bài học'],
    image_prompt: `Excellence badge emblem shield vector for kindergarten achievement`,
    image_url: getPollinationsImageUrl(`Excellence badge emblem shield vector for kindergarten achievement`, 1024, 768, 12, keywords)
  };

  // Slide 11: HERO_OVERLAY
  const s11: AILessonSlide = {
    slide_number: 11,
    layout_type: 'HERO_OVERLAY',
    title: `Hành Động Đẹp - Bé Ngoan Sương Mai`,
    subtitle: `Bé ghi nhớ hành động đẹp liên quan đến ${cleanTopic}, giữ gìn vệ sinh lớp học, yêu thương bạn bè và chăm sóc môi trường xung quanh!`,
    content_points: ['Hành động đẹp và bài học đạo đức tích cực'],
    image_prompt: `Beautiful preschool environment landscape with cheerful children cartoon`,
    image_url: getPollinationsImageUrl(`Beautiful preschool environment landscape with cheerful children cartoon`, 1024, 768, 13, keywords)
  };

  // Slide 12: OUTRO_PRAISE
  const s12: AILessonSlide = {
    slide_number: 12,
    layout_type: 'OUTRO_PRAISE',
    title: 'Bé Đố Cô - Cô Đố Bé!',
    subtitle: `Cả lớp mình hôm nay học rất ngoan và xuất sắc vượt qua các câu hỏi khám phá bài học "${safeTopic}".`,
    pill_badges: [`🏅 HOAN HÔ CÁC BÉ LỚP ${gradeInfo.label.split(' ')[0].toUpperCase()} TRƯỜNG SƯƠNG MAI!`],
    content_points: ['Khen ngợi nỗ lực và trao danh hiệu bé ngoan'],
    image_prompt: `Kindergarten children cheering celebrating medal award winner cartoon`,
    image_url: getPollinationsImageUrl(`Kindergarten children cheering celebrating medal award winner cartoon`, 1024, 768, 14, keywords)
  };

  // Slide 13: IMAGE_SOURCES
  const s13: AILessonSlide = {
    slide_number: 13,
    layout_type: 'IMAGE_SOURCES',
    title: 'Image Sources',
    image_sources: [
      { url: s1.image_url || '', source: 'www.pollinations.ai' },
      { url: s5.image_url || '', source: 'www.pollinations.ai' },
      { url: s9.image_url || '', source: 'www.pollinations.ai' },
      { url: s11.image_url || '', source: 'www.pollinations.ai' }
    ],
    content_points: ['Danh sách nguồn hình ảnh minh họa cho slide'],
    image_prompt: 'Source credits illustration list'
  };

  return [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];
}

/**
 * Generates Traditional 5-Step Preschool Lesson Plan + Dynamic Framework Injection + Mermaid Mindmap + Pollinations Images
 */
export async function generateAILessonPlan(params: {
  topic: string;
  subject: string;
  grade_level: GradeLevelCode | 'MẦM' | 'CHỒI' | 'LÁ' | 'NHÀ TRẺ';
  theme_code?: ThemeCode;
  target_objectives?: string;
  materials_needed?: string;
  expansion_ideas?: string;
}): Promise<AILessonPlan> {
  const { topic, subject, grade_level, theme_code = 'THUC_VAT', target_objectives, materials_needed } = params;

  // Map grade code
  const normGrade: GradeLevelCode = 
    grade_level === 'NHÀ TRẺ' || grade_level === 'NHA_TRE' ? 'NHA_TRE' :
    grade_level === 'MẦM' || grade_level === 'MAM' ? 'MAM' :
    grade_level === 'CHỒI' || grade_level === 'CHOI' ? 'CHOI' : 'LA';

  // Auto-detect effective theme code from topic to harmonize framework and content
  const effectiveTheme = autoDetectThemeCode(topic, theme_code);

  // Dynamic Injection: Query 1 record from curriculum_frameworks Seed Data
  const framework = getFrameworkByGradeAndTheme(normGrade, effectiveTheme);

  // Simulate AI Processing Latency (1.2s fast response)
  await new Promise((res) => setTimeout(res, 1200));

  const safeTopic = topic.trim() || framework.standard_topic || 'Khám phá sự phát triển của cây xanh';
  const duration = 
    normGrade === 'NHA_TRE' ? 15 :
    normGrade === 'MAM' ? 20 :
    normGrade === 'CHOI' ? 25 : 30;

  // Dynamic Material Engine: Resolve subject & topic dynamic materials
  const dynamicMats = getDynamicMaterialSuggestions(subject, safeTopic, normGrade);
  const resolvedMaterialsStr = materials_needed && materials_needed.trim().length > 0 
    ? materials_needed.trim()
    : dynamicMats.allTags.join(', ');

  const teacherMaterials = materials_needed && materials_needed.trim().length > 0
    ? materials_needed.split(',').map((s) => s.trim()).filter(Boolean)
    : dynamicMats.teacher;

  const studentMaterials = materials_needed && materials_needed.trim().length > 0
    ? materials_needed.split(',').map((s) => s.trim()).filter(Boolean)
    : dynamicMats.students;

  // Mermaid.js Mindmap Diagram Code
  const mermaidCode = `graph TD
  Root["🌱 ${safeTopic}"] --> Step1["1. Khởi động (Bé quan sát)"]
  Root --> Step2["2. Khám phá (Trải nghiệm thực tế)"]
  Root --> Step3["3. Luyện tập (Trò chơi tương tác)"]
  Root --> Step4["4. Củng cố (Sơ đồ tư duy)"]
  
  Step1 --> S1_Detail["Thơ & Hát cùng cô: ${framework.pedagogical_guidelines.songs_or_poems?.[0] || 'Bài hát mầm non'}"]
  Step2 --> S2_Detail["Trải nghiệm trực quan: ${studentMaterials.slice(0, 3).join(', ')}"]
  Step3 --> S3_Detail["Trò chơi: ${framework.pedagogical_guidelines.interactive_games?.[0] || 'Thi đội nào nhanh' }"]
  Step4 --> S4_Detail["Khen thưởng & Bé thu dọn đồ dùng"]`;

  // 5-Step Traditional / 5E Pedagogy Structure
  const archetype = getThemeArchetype(effectiveTheme, safeTopic, subject);
  const isLaGroup = normGrade === 'LA';
  const fiveSteps = [
    {
      step_number: 1,
      step_title: isLaGroup ? `1. Gắn kết (Engage) - ${archetype.archetypeName}` : '1. Gắn kết & Khởi động (Ổn định tổ chức)',
      description: `Khởi động sinh động theo phương thức ${archetype.openerHeadline}`,
      teacher_action: `Cô áp dụng ${archetype.openerHeadline}: ${archetype.openerDetail}. Kịch bản tương tác: "${archetype.calloutDialogue.teacherAsk}"`,
      child_activity: `Trẻ hào hứng tương tác linh hoạt: "${archetype.calloutDialogue.childAnswer}"`
    },
    {
      step_number: 2,
      step_title: isLaGroup ? '2. Khám phá (Explore) - Trải nghiệm thực tế' : '2. Khám phá & Trải nghiệm thực tế (Hoạt động trọng tâm)',
      description: 'Cho trẻ quan sát trực quan, sờ nắn và thực hành trải nghiệm trực tiếp.',
      teacher_action: `Cô giới thiệu học liệu chuẩn: ${resolvedMaterialsStr}. Hình ảnh bản địa hóa gần gũi: ${archetype.localizedElements.slice(0, 2).join(', ')}.`,
      child_activity: `Trẻ chia nhóm 4-5 bé, tự tay sờ nắn, quan sát và trải nghiệm đồ dùng cùng các bạn.`
    },
    {
      step_number: 3,
      step_title: isLaGroup ? '3. Giải thích (Explain) - Thảo luận & Trò chơi' : '3. Giải thích & Thảo luận nhóm (Luyện tập trò chơi)',
      description: 'Giúp trẻ ghi nhớ kiến thức qua trò chơi đồng đội tương tác.',
      teacher_action: `Cô tổ chức trò chơi "${framework.pedagogical_guidelines.interactive_games?.[0] || 'Đội nào nhanh nhất'}" bám sát cốt truyện ${archetype.archetypeName}. Từ vựng cốt lõi: ${framework.pedagogical_guidelines.key_vocabulary.join(', ')}.`,
      child_activity: 'Các nhóm phân công nhau cầm thẻ tranh nhanh chân lên dán vào bảng nhóm.'
    },
    {
      step_number: 4,
      step_title: isLaGroup ? '4. Áp dụng & Mở rộng (Elaborate)' : '4. Củng cố & Tổng kết kiến thức',
      description: isLaGroup ? 'Trẻ tự tay vận dụng kiến thức thực hành sáng tạo sản phẩm.' : 'Hệ thống lại nội dung qua Sơ đồ tư duy Mermaid visual.',
      teacher_action: isLaGroup 
        ? `Cô hướng dẫn trẻ ứng dụng kiến thức tự tay thực hành sáng tạo sản phẩm về đề tài "${safeTopic}".`
        : 'Cô trình chiếu Sơ đồ tư duy trên SmartTV, mời đại diện bé lên chỉ và tóm tắt lại bài học.',
      child_activity: isLaGroup
        ? 'Trẻ hào hứng tự tay thực hành cá nhân / theo nhóm để hoàn thành sản phẩm trải nghiệm của mình.'
        : 'Bé đại diện tự tin lên bảng SmartTV giới thiệu quy trình bài học cho các bạn.'
    },
    {
      step_number: 5,
      step_title: isLaGroup ? '5. Đánh giá (Evaluate) - Nhận xét & Kết thúc' : '5. Đánh giá & Mở rộng (Kết thúc)',
      description: 'Khen ngợi nỗ lực của trẻ và hướng dẫn thu dọn đồ dùng gọn gàng.',
      teacher_action: 'Cô nhận xét dương tính từng nhóm, trao nhãn dán bé ngoan và dặn dò bé chăm sóc sản phẩm.',
      child_activity: 'Trẻ vui vẻ nhận phần thưởng và tự giác thu dọn khay đồ dùng về đúng nơi quy định.'
    }
  ];

  const steamPillars = {
    science: framework.pedagogical_guidelines.steam_objectives?.science || `Trẻ nhận biết các đặc điểm cơ bản và quy luật của đề tài "${safeTopic}".`,
    technology: framework.pedagogical_guidelines.steam_objectives?.technology || 'Trẻ sử dụng khéo léo các dụng cụ, đồ dùng học liệu đơn giản.',
    engineering: framework.pedagogical_guidelines.steam_objectives?.engineering || 'Trẻ biết sắp xếp các bước thực hiện theo trình tự hợp lý.',
    art: framework.pedagogical_guidelines.steam_objectives?.art || 'Trẻ trang trí sản phẩm đẹp mắt, hài hòa về màu sắc.',
    math: framework.pedagogical_guidelines.steam_objectives?.math || 'Trẻ đếm số lượng, so sánh kích thước và phân biệt hình khối.'
  };

  const afternoonActivity = {
    name: `Trò chơi hoạt động chiều (HĐC): "${framework.pedagogical_guidelines.interactive_games?.[0] || 'Cùng ôn bài học'}"`,
    instruction: `Cô tập hợp trẻ vào buổi chiều, tổ chức trò chơi củng cố kiến thức về "${safeTopic}". Chuẩn bị: ${studentMaterials.slice(0, 2).join(', ')}. Cách tiến hành: Cô phổ biến luật chơi, trẻ tham gia phản xạ nhanh và nhận phần thưởng dương tính.`
  };

  // PowerPoint Slide Deck Content complying with Rules.pdf Design System
  const slides = generateRulesCompliantSlideDeck({
    topic: safeTopic,
    subject,
    grade_level: normGrade,
    theme_code: effectiveTheme,
    materialsNeededStr: resolvedMaterialsStr,
    studentMaterials,
    teacherMaterials,
    framework,
    targetObjectives: target_objectives
  });

  return {
    id: `ai-lesson-${Date.now()}`,
    topic: safeTopic,
    subject: SUBJECT_NAME_MAP[subject] || subject,
    grade_level: normGrade,
    teaching_type: 'TRADITIONAL',
    target_objectives: target_objectives || `S: ${steamPillars.science} | T: ${steamPillars.technology} | E: ${steamPillars.engineering} | A: ${steamPillars.art} | M: ${steamPillars.math}`,
    duration_minutes: duration,
    materials_needed: resolvedMaterialsStr.split(',').map((s) => s.trim()).filter(Boolean),
    five_steps: fiveSteps,
    mermaid_mindmap_code: mermaidCode,
    youtube_video_suggestions: [
      { title: `Bài hát "${framework.pedagogical_guidelines.songs_or_poems?.[0] || 'Mầm Chồi Lá'}"`, url: 'https://www.youtube.com/results?search_query=mam+choi+la' },
      { title: `Khám phá "${safeTopic}" (VTV7 Nhi Khoa)`, url: 'https://www.youtube.com/results?search_query=vtv7+nhi+khoa' }
    ],
    slides,
    preparations: {
      teacher: teacherMaterials,
      students: studentMaterials
    },
    afternoon_activity: afternoonActivity,
    steam_pillars: steamPillars,
    framework_id: framework.id,
    created_at: new Date().toISOString()
  };
}

/**
 * Helper: Convert URL sang Base64 tránh lỗi CORS và mất ảnh trên PowerPoint với timeout 2.5s
 */
export async function toBase64(url: string, timeoutMs = 2500): Promise<string> {
  if (!url) return '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return '';
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return '';
  }
}

/**
 * Parametric theme-aware preschool fallback images if AI image server is unreachable
 */
export function getFallbackPreschoolImage(index: number = 0, themeCode?: string): string {
  const themeMatrix = getThemeMatrix(themeCode);
  const fallbacks = themeMatrix.fallbackImages && themeMatrix.fallbackImages.length > 0
    ? themeMatrix.fallbackImages
    : THEME_MATRIX.THUC_VAT.fallbackImages;
  return fallbacks[index % fallbacks.length];
}



/**
 * Generates Project-Based Learning (PBL) 5E STEAM Project + Timeline + Parent Announcement
 */
export async function generateAILearningProject(params: {
  projectName: string;
  gradeLevel: GradeLevelCode;
  themeCode: ThemeCode;
  durationWeeks?: number;
  finalProduct?: string;
  materialsNeeded?: string;
}): Promise<AILessonPlan> {
  const { projectName, gradeLevel, themeCode, durationWeeks = 1, finalProduct, materialsNeeded } = params;

  await new Promise((res) => setTimeout(res, 1500));

  const safeProjectName = projectName.trim() || 'Dự án Chế tạo Xe Ô tô Đồ chơi Tải nặng';
  const safeProduct = finalProduct || 'Mô hình xe ô tô 4 bánh chạy đà từ vỏ hộp sữa và nắp chai nhựa';

  // STEAM 5-Pillar Mapping
  const steamMapping = {
    science: 'Khám phá sự chuyển động của bánh xe tròn giúp giảm ma sát và chịu được lực tải trọng.',
    technology: 'Sử dụng khuôn cắt nhựa an toàn, kéo bo tròn đầu, súng bắn keo nến (cô hỗ trợ) và ống hút nhựa.',
    engineering: 'Thiết kế khung xe thăng bằng, lắp ráp 2 trục bánh xe song song không bị cọ xát vào thân xe.',
    art: 'Trang trí ô tô bằng mảng màu sắc rực rỡ, dán nhãn decal phản quang và tạo hình tài xế nhỏ.',
    math: 'Đo độ dài khung xe (15 cm), đếm số bánh xe (4 bánh) và đo khoảng cách xe chạy đà trên mặt phẳng (20-50 cm).'
  };

  // 5-Day 5E STEAM Project Timeline
  const timelineDays = [
    {
      day_number: 1,
      title: 'Ngày 1: ENGAGE (Gắn kết & Đặt vấn đề)',
      phase_5e: 'Engage' as const,
      teacher_action: 'Cô chiếu video về các loại ô tô tải và đặt câu hỏi: "Làm sao để làm một chiếc xe tự chạy chở đồ chơi?"',
      child_activity: 'Trẻ hào hứng thảo luận, sờ nắn bánh xe nhựa và nêu ý tưởng ban đầu.'
    },
    {
      day_number: 2,
      title: 'Ngày 2: EXPLORE (Khám phá & Thí nghiệm bánh xe)',
      phase_5e: 'Explore' as const,
      teacher_action: 'Cô chuẩn bị nắp chai tròn và khối vuông, hướng dẫn trẻ lăn thử 2 vật liệu trên dốc nghiêng.',
      child_activity: 'Trẻ nhận ra hình tròn lăn nhanh hơn và quyết định chọn nắp chai làm bánh xe.'
    },
    {
      day_number: 3,
      title: 'Ngày 3: EXPLAIN & DESIGN (Vẽ bản thiết kế)',
      phase_5e: 'Explain' as const,
      teacher_action: 'Cô phát giấy và bút màu, hướng dẫn trẻ vẽ bản thiết kế ô tô mơ ước của nhóm mình.',
      child_activity: 'Các nhóm phân công bé vẽ khung xe, bé đếm bánh xe và chọn màu trang trí.'
    },
    {
      day_number: 4,
      title: 'Ngày 4: ELABORATE (Chế tạo & Lắp ráp sản phẩm)',
      phase_5e: 'Elaborate' as const,
      teacher_action: 'Cô cung cấp vỏ hộp sữa, que gỗ, ống hút. Hỗ trợ trẻ đục lỗ xuyên trục và cố định nắp chai.',
      child_activity: 'Trẻ tập trung xỏ que gỗ qua ống hút, gắn bánh chai nhựa và dán decal trang trí.'
    },
    {
      day_number: 5,
      title: 'Ngày 5: EVALUATE (Thử nghiệm & Triển lãm dự án)',
      phase_5e: 'Evaluate' as const,
      teacher_action: 'Cô tổ chức đường đua ô tô mini và mời Ban Giám Hiệu/Giáo viên đến thưởng thức.',
      child_activity: 'Trẻ tự tin thuyết trình về sản phẩm của nhóm, cho xe chạy đà và nhận Huy hiệu Kỹ sư nhí.'
    }
  ];

  // Official Parent Announcement Text for Parent PWA App
  const parentAnnouncement = `📢 THÔNG BÁO DỰ ÁN HỌC TẬP STEAM: "${safeProjectName.toUpperCase()}"
Kính gửi Quý Phụ Huynh lớp ${GRADE_LEVEL_MAP[gradeLevel].label},
Tuần này, các bé sẽ cùng cô tham gia Dự án STEAM độc đáo "${safeProjectName}".
🎯 Mục tiêu dự án: Kích thích tư duy sáng tạo, rèn luyện kỹ năng khéo léo và khám phá nguyên lý khoa học qua việc tự tay chế tạo: ${safeProduct}.

🤝 KÍNH MỜI PHỤ HUYNH ĐỒNG HÀNH CÙNG BÉ:
1. Nhờ Phụ huynh cùng bé thu gom 2-3 vỏ hộp sữa giấy rỗng & 4 nắp chai nhựa sạch mang đến lớp vào Thứ Hai.
2. Trò chuyện cùng con ở nhà về các loại xe ô tô bé nhìn thấy trên đường.

Trân trọng cảm ơn sự đồng hành quý báu của Quý Phụ Huynh!
— Trường Mầm Non Sương Mai`;

  const mermaidCode = `graph TD
  Project["🚀 DỰ ÁN STEAM: ${safeProjectName}"] --> D1["1. ENGAGE (Gắn kết)"]
  Project --> D2["2. EXPLORE (Khám phá bánh xe)"]
  Project --> D3["3. EXPLAIN (Vẽ bản thiết kế)"]
  Project --> D4["4. ELABORATE (Chế tạo xe)"]
  Project --> D5["5. EVALUATE (Đường đua xe)"]
  
  D4 --> Product["🏆 Sản phẩm: ${safeProduct.slice(0, 30)}..."]
  D5 --> Announce["📲 Gửi Thư ngỏ cho Phụ huynh qua App"]`;

  const learningProject: LearningProject = {
    id: `project-${Date.now()}`,
    grade_level: gradeLevel,
    theme_code: themeCode,
    project_name: safeProjectName,
    duration_weeks: durationWeeks,
    final_product: safeProduct,
    steam_mapping: steamMapping,
    timeline_days: timelineDays,
    materials_needed: (materialsNeeded || 'Vỏ hộp sữa, nắp chai nhựa, que gỗ, ống hút, băng dính, màu vẽ').split(',').map((s) => s.trim()),
    parent_announcement: parentAnnouncement,
    created_at: new Date().toISOString()
  };

  const slides: AILessonSlide[] = [
    {
      slide_number: 1,
      title: `DỰ ÁN PBL STEAM: ${safeProjectName.toUpperCase()}`,
      content_points: [
        `Khối lớp: ${GRADE_LEVEL_MAP[gradeLevel].label} • Thời lượng: ${durationWeeks} Tuần`,
        `Chủ đề: ${THEME_NAME_MAP[themeCode]}`,
        `Sản phẩm đầu ra: ${safeProduct}`
      ],
      image_prompt: `Preschool STEM project classroom, happy children building toy cars, cartoon watercolor`,
      image_url: getPollinationsImageUrl(`Preschool STEM project classroom, happy children building toy cars`)
    },
    {
      slide_number: 2,
      title: '5 TRỤ CỘT S-T-E-A-M CỦA DỰ ÁN',
      content_points: [
        `S (Science): ${steamMapping.science}`,
        `T (Technology): ${steamMapping.technology}`,
        `E (Engineering): ${steamMapping.engineering}`,
        `A (Art): ${steamMapping.art}`,
        `M (Math): ${steamMapping.math}`
      ],
      image_prompt: `STEM colorful icon set for kindergarten education, cartoon style`,
      image_url: getPollinationsImageUrl(`STEM colorful icon set for kindergarten education`)
    },
    {
      slide_number: 3,
      title: 'LỘ TRÌNH 5 NGÀY THỰC HIỆN DỰ ÁN (MÔ HÌNH 5E)',
      content_points: timelineDays.map((d) => `${d.title}: ${d.child_activity}`),
      image_prompt: `Children engineering timeline infographic, cute kindergarten style`,
      image_url: getPollinationsImageUrl(`Children engineering timeline infographic, cute kindergarten style`)
    },
    {
      slide_number: 4,
      title: 'TRIỂN LÃM SẢN PHẨM & THƯ NGỎ PHỤ HUYNH',
      content_points: [
        `Sản phẩm hoàn thiện: ${safeProduct}`,
        'Đã phát Thư ngỏ thông báo Phụ huynh đồng hành nguyên vật liệu qua Parent PWA App!'
      ],
      image_prompt: `Preschool science fair exhibition table with kids handmade toys`,
      image_url: getPollinationsImageUrl(`Preschool science fair exhibition table with kids handmade toys`)
    }
  ];

  return {
    id: `ai-pbl-${Date.now()}`,
    topic: safeProjectName,
    subject: 'DỰ ÁN STEAM / PBL',
    grade_level: gradeLevel,
    teaching_type: 'PROJECT_BASED',
    target_objectives: steamMapping.science,
    duration_minutes: 30,
    materials_needed: learningProject.materials_needed,
    five_steps: timelineDays.map((td) => ({
      step_number: td.day_number,
      step_title: td.title,
      description: `PBL Phase: ${td.phase_5e}`,
      teacher_action: td.teacher_action,
      child_activity: td.child_activity
    })),
    mermaid_mindmap_code: mermaidCode,
    youtube_video_suggestions: [
      { title: 'Hướng dẫn chế tạo ô tô đồ chơi từ phế liệu (Khéo tay mầm non)', url: 'https://www.youtube.com/results?search_query=che+tao+o+to+tu+nap+chai+mam+non' },
      { title: 'Dự án STEAM mầm non hay nhất (VTV7)', url: 'https://www.youtube.com/results?search_query=du+an+steam+mam+non+vtv7' }
    ],
    slides,
    project_id: learningProject.id,
    learning_project: learningProject,
    parent_announcement: parentAnnouncement,
    created_at: new Date().toISOString()
  };
}

/**
 * Triggers PowerPoint (.pptx) file generation using dynamic client-side PptxGenJS library
 */
/**
 * Triggers PowerPoint (.pptx) file generation using dynamic client-side PptxGenJS library
 * Follows Preschool SmartTV Design System (Pastel background, 16:9 HD, 60-70% image area, 36-42pt bold font)
 */
export async function exportToPowerPoint(lesson: AILessonPlan): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    // Dynamically load pptxgenjs client script
    if (!(window as any).PptxGenJS) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không thể nạp thư viện pptxgenjs'));
        document.head.appendChild(script);
      });
    }

    const PptxGenJS = (window as any).PptxGenJS;
    const pptx = new PptxGenJS();

    pptx.layout = 'LAYOUT_16x9'; // 16:9 SmartTV layout
    pptx.author = 'Trường Mầm Non Sương Mai AI Pedagogy Engine';

    const rawThemeCode = lesson.schema_response?.theme_code || (lesson as any).theme_code || 'THUC_VAT';
    const themeCode = autoDetectThemeCode(lesson.topic, rawThemeCode as any);
    const themeMatrix = getThemeMatrix(themeCode);

    const FONT_TITLE = 'Arial Rounded MT Bold';
    const FONT_BODY = 'Arial';
    const COLOR_PRIMARY = themeMatrix.primaryColor.replace('#', '');
    const COLOR_LIGHT_BG = themeMatrix.backgroundColor.replace('#', '');
    const COLOR_ACCENT = themeMatrix.accentColor.replace('#', '');

    const slidesData = lesson.slides || [];
    const base64Images: string[] = await Promise.all(
      slidesData.map(async (s, i) => {
        const rawUrl = s.image_url || getFallbackPreschoolImage(i, themeCode);
        let b64 = await toBase64(rawUrl, 2500);
        if (!b64 || !b64.startsWith('data:image')) {
          b64 = await toBase64(getFallbackPreschoolImage(i, themeCode), 2000);
        }
        return b64.startsWith('data:image') ? b64 : getFallbackPreschoolImage(i, themeCode);
      })
    );

    for (let i = 0; i < slidesData.length; i++) {
      const slideItem = slidesData[i];
      const slide = pptx.addSlide();
      const img = base64Images[i] || getFallbackPreschoolImage(i, themeCode);
      const isB64 = img.startsWith('data:image');
      const imgObj = { [isB64 ? 'data' : 'path']: img };

      const layoutType = slideItem.layout_type || 'COVER';

      if (layoutType === 'COVER') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.4, w: 12.33, h: 6.7, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 2 } });
        slide.addText(slideItem.header_tag || '🎓 TRƯỜNG MẦM NON SƯƠNG MAI', { x: 4.2, y: 0.8, w: 4.9, h: 0.5, fontSize: 16, fontFace: FONT_TITLE, color: COLOR_PRIMARY, fill: { color: 'DCFCE7' }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
        slide.addText(slideItem.title, { x: 1.0, y: 1.6, w: 11.33, h: 1.4, fontSize: 36, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 1.5, y: 3.2, w: 10.33, h: 0.8, fontSize: 20, fontFace: FONT_BODY, color: '475569', align: 'center' });
        if (slideItem.pill_badges) {
          const badges = slideItem.pill_badges;
          badges.forEach((b, idx) => {
            slide.addText(b, { x: 1.5 + idx * 3.6, y: 4.8, w: 3.3, h: 0.6, fontSize: 16, fontFace: FONT_TITLE, color: COLOR_PRIMARY, fill: { color: 'FFFFFF' }, line: { color: 'A7F3D0', width: 1.5 }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
          });
        }
      } else if (layoutType === 'DARK_HERO') {
        slide.background = { color: COLOR_PRIMARY };
        slide.addText(slideItem.pill_badges?.[0] || '🧭 BƯỚC 1: GẮN KẾT & KHÁM PHÁ', { x: 4.2, y: 1.2, w: 4.9, h: 0.6, fontSize: 16, fontFace: FONT_TITLE, color: 'FFFFFF', fill: { color: COLOR_PRIMARY }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
        slide.addText(slideItem.title, { x: 1.0, y: 2.2, w: 11.33, h: 1.5, fontSize: 42, fontFace: FONT_TITLE, color: COLOR_ACCENT, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 1.5, y: 4.2, w: 10.33, h: 1.5, fontSize: 22, fontFace: FONT_BODY, color: 'FEF3C7', align: 'center', lineSpacing: 32 });
      } else if (layoutType === 'GRID_4_CARDS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const cards = slideItem.cards_data || [];
        cards.forEach((c, idx) => {
          const xPos = 0.8 + idx * 3.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.8, w: 2.7, h: 4.8, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(c.icon || '🌱', { x: xPos + 0.85, y: 2.2, w: 1.0, h: 1.0, fontSize: 28, align: 'center', fill: { color: 'F0FDF4' }, shape: pptx.ShapeType.roundRect });
          slide.addText(c.title, { x: xPos + 0.2, y: 3.4, w: 2.3, h: 0.6, fontSize: 20, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
          slide.addText(c.desc, { x: xPos + 0.2, y: 4.1, w: 2.3, h: 2.2, fontSize: 13, fontFace: FONT_BODY, color: '334155', align: 'center' });
        });
      } else if (layoutType === 'TIMELINE_4_STEPS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        slide.addShape(pptx.ShapeType.line, { x: 1.5, y: 4.0, w: 10.3, h: 0, line: { color: '86EFAC', width: 4 } });
        const steps = slideItem.steps_data || [];
        steps.forEach((s, idx) => {
          const xPos = 0.8 + idx * 3.0;
          const isTop = idx % 2 === 1;
          const yPos = isTop ? 1.6 : 4.4;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: yPos, w: 2.7, h: 2.2, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(s.title, { x: xPos + 0.1, y: yPos + 0.2, w: 2.5, h: 0.5, fontSize: 16, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
          slide.addText(s.desc, { x: xPos + 0.1, y: yPos + 0.7, w: 2.5, h: 1.3, fontSize: 12, fontFace: FONT_BODY, color: '334155', align: 'center' });
        });
      } else if (layoutType === 'IMAGE_CARDS_3') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const cards = slideItem.cards_data || [];
        const cardImages = await Promise.all(
          cards.map(async (c, cIdx) => {
            const raw = c.image_url || getFallbackPreschoolImage(cIdx, themeCode);
            let b64 = await toBase64(raw, 2500);
            if (!b64 || !b64.startsWith('data:image')) {
              b64 = await toBase64(getFallbackPreschoolImage(cIdx, themeCode), 2000);
            }
            return b64.startsWith('data:image') ? b64 : getFallbackPreschoolImage(cIdx, themeCode);
          })
        );
        for (let idx = 0; idx < cards.length; idx++) {
          const c = cards[idx];
          const xPos = 0.8 + idx * 4.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.6, w: 3.7, h: 5.0, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          const cardImg = cardImages[idx] || img;
          const isB64Card = cardImg.startsWith('data:image');
          const cardImgObj = { [isB64Card ? 'data' : 'path']: cardImg };
          slide.addImage({ ...cardImgObj, x: xPos + 0.15, y: 1.75, w: 3.4, h: 2.4 });
          slide.addText(c.title, { x: xPos + 0.2, y: 4.3, w: 3.3, h: 0.5, fontSize: 18, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
          slide.addText(c.desc, { x: xPos + 0.2, y: 4.8, w: 3.3, h: 1.6, fontSize: 13, fontFace: FONT_BODY, color: '334155', align: 'center' });
        }
      } else if (layoutType === 'TWO_COLUMN_CARDS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const cards = slideItem.cards_data || [];
        cards.forEach((c, idx) => {
          const xPos = 0.8 + idx * 6.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.6, w: 5.7, h: 5.0, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(`${c.icon || '🌲'} ${c.title}`, { x: xPos + 0.3, y: 1.9, w: 5.1, h: 0.6, fontSize: 22, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
          slide.addText(c.desc, { x: xPos + 0.3, y: 2.6, w: 5.1, h: 3.7, fontSize: 15, fontFace: FONT_BODY, color: '334155', lineSpacing: 24 });
        });
      } else if (layoutType === 'LIST_ACCENT_IMAGE') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const points = slideItem.content_points || [];
        points.forEach((pt, idx) => {
          const yPos = 1.6 + idx * 1.25;
          slide.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: yPos, w: 6.2, h: 1.1, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: 'F1F5F9', width: 1 } });
          slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: yPos, w: 0.15, h: 1.1, fill: { color: COLOR_PRIMARY } });
          slide.addText(pt, { x: 1.1, y: yPos + 0.1, w: 5.7, h: 0.9, fontSize: 13, fontFace: FONT_BODY, color: '334155' });
        });
        slide.addImage({ ...imgObj, x: 7.3, y: 1.6, w: 5.0, h: 5.0, rounding: true });
      } else if (layoutType === 'NUMBERED_STEPS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const steps = slideItem.steps_data || [];
        steps.forEach((s, idx) => {
          const yPos = 1.6 + idx * 1.35;
          slide.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: yPos, w: 10.3, h: 1.2, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(`${s.step_num || idx + 1}`, { x: 1.8, y: yPos + 0.25, w: 0.7, h: 0.7, fontSize: 24, fontFace: FONT_TITLE, color: COLOR_PRIMARY, align: 'center', bold: true });
          slide.addText(`${s.title}: ${s.desc}`, { x: 2.7, y: yPos + 0.15, w: 8.8, h: 0.9, fontSize: 15, fontFace: FONT_BODY, color: '334155' });
        });
        if (slideItem.subtitle) {
          slide.addText(slideItem.subtitle, { x: 1.5, y: 5.8, w: 10.3, h: 0.8, fontSize: 16, fontFace: FONT_TITLE, color: COLOR_PRIMARY, fill: { color: 'FFFFFF' }, line: { color: '86EFAC', width: 1.5 }, align: 'center', shape: pptx.ShapeType.roundRect });
        }
      } else if (layoutType === 'SPLIT_STORY_IMAGE') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 1.2, w: 5.5, h: 0.8, fontSize: 34, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        slide.addText(slideItem.subtitle || '', { x: 0.8, y: 2.2, w: 5.5, h: 4.2, fontSize: 18, fontFace: FONT_BODY, color: '334155', lineSpacing: 28 });
        slide.addImage({ ...imgObj, x: 6.6, y: 0.5, w: 6.2, h: 6.5 });
      } else if (layoutType === 'STAT_CALLOUT') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const stat = slideItem.stat_highlight;
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.6, w: 11.7, h: 5.0, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 2 } });
        if (stat) {
          slide.addShape(pptx.ShapeType.roundRect, { x: 1.2, y: 2.0, w: 4.0, h: 4.2, rectRadius: 0.1, fill: { color: 'BBF7D0' } });
          slide.addText(stat.number, { x: 1.2, y: 2.8, w: 4.0, h: 1.2, fontSize: 54, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
          slide.addText(stat.label, { x: 1.2, y: 4.2, w: 4.0, h: 0.6, fontSize: 20, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
          slide.addText(stat.hero_title, { x: 5.6, y: 2.2, w: 6.5, h: 0.8, fontSize: 26, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
          slide.addText(stat.hero_desc, { x: 5.6, y: 3.1, w: 6.5, h: 3.0, fontSize: 18, fontFace: FONT_BODY, color: '334155', lineSpacing: 28 });
        }
      } else if (layoutType === 'HERO_OVERLAY') {
        slide.addImage({ ...imgObj, x: 0, y: 0, w: 13.33, h: 7.5 });
        slide.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: 1.5, w: 10.33, h: 4.5, rectRadius: 0.15, fill: { color: 'FFFFFF' } });
        slide.addText(slideItem.title, { x: 1.8, y: 2.0, w: 9.7, h: 1.0, fontSize: 36, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 2.0, y: 3.2, w: 9.3, h: 2.2, fontSize: 20, fontFace: FONT_BODY, color: '334155', align: 'center', lineSpacing: 30 });
      } else if (layoutType === 'OUTRO_PRAISE') {
        slide.background = { color: 'FEF9C3' };
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.4, w: 12.33, h: 6.7, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'FEF08A', width: 2 } });
        slide.addText(slideItem.title, { x: 1.0, y: 1.8, w: 11.33, h: 1.2, fontSize: 44, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 1.5, y: 3.2, w: 10.33, h: 1.0, fontSize: 22, fontFace: FONT_BODY, color: '475569', align: 'center' });
        if (slideItem.pill_badges?.[0]) {
          slide.addText(slideItem.pill_badges[0], { x: 2.2, y: 4.8, w: 8.9, h: 0.9, fontSize: 22, fontFace: FONT_TITLE, color: 'CA8A04', fill: { color: 'FEF9C3' }, line: { color: 'FDE047', width: 2 }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
        }
      } else if (layoutType === 'IMAGE_SOURCES') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_PRIMARY, bold: true });
        const sources = slideItem.image_sources || [];
        sources.forEach((srcItem, idx) => {
          const yPos = 1.6 + idx * 1.3;
          slide.addShape(pptx.ShapeType.line, { x: 0.8, y: yPos + 1.2, w: 11.7, h: 0, line: { color: 'CBD5E1', width: 1 } });
          const srcImg = srcItem.url ? base64Images[idx] || img : img;
          const srcImgObj = { [srcImg.startsWith('data:image') ? 'data' : 'path']: srcImg };
          slide.addImage({ ...srcImgObj, x: 0.8, y: yPos, w: 1.6, h: 1.0 });
          slide.addText(srcItem.url, { x: 2.6, y: yPos + 0.1, w: 9.5, h: 0.4, fontSize: 13, fontFace: FONT_BODY, color: '334155' });
          slide.addText(`Source: ${srcItem.source}`, { x: 2.6, y: yPos + 0.5, w: 9.5, h: 0.4, fontSize: 13, fontFace: FONT_BODY, color: '4F46E5' });
        });
      }
    }

    const filename = `GiaoAn_${lesson.topic.replace(/\s+/g, '_')}_SmartTV.pptx`;
    await pptx.writeFile({ fileName: filename });
  } catch (err) {
    console.error('Lỗi khi xuất file PowerPoint:', err);
    alert('Không thể xuất file PowerPoint: ' + (err as any)?.message);
  }
}
