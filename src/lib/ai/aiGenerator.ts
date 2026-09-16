import { AILessonPlan, AILessonSlide, GradeLevelCode, ThemeCode, LearningProject, TeachingType, PreschoolAISchemaResponse } from '../types/schema';
import { getFrameworkByGradeAndTheme, THEME_NAME_MAP, GRADE_LEVEL_MAP, SUBJECT_NAME_MAP } from '../utils/curriculumHelper';

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

[QUY TẮC DẠY HỌC THEO DỰ ÁN (PBL)]
Nếu teaching_type == 'PROJECT_BASED':
- Phân bổ hoạt động thành chuỗi 5 ngày trong tuần (Thứ 2 -> Thứ 6) xoay quanh việc hoàn thiện 01 sản phẩm thực tế của trẻ.
- Tích hợp tự nhiên các môn: Khoa học (S), Công nghệ (T), Kỹ thuật (E), Nghệ thuật (A), Toán học (M).
- Soạn 01 đoạn thông báo ngắn gửi phụ huynh (Parent Project Card) để cùng chuẩn bị học liệu tại nhà.`;

/**
 * Generates Pollinations.ai Flux.1 Cartoon Illustration Image URL (Free 0 VNĐ)
 */
export function getPollinationsImageUrl(prompt: string, width = 1024, height = 768, seedIndex = 1): string {
  const cleanPrompt = prompt.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'cute preschool children illustration';
  const encodedPrompt = encodeURIComponent(`cute preschool cartoon illustration, colorful, friendly, ${cleanPrompt}`);
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

  // Dynamic Injection: Query 1 record from curriculum_frameworks Seed Data
  const framework = getFrameworkByGradeAndTheme(normGrade, theme_code);

  // Simulate AI Processing Latency (1.2s fast response)
  await new Promise((res) => setTimeout(res, 1200));

  const safeTopic = topic.trim() || framework.standard_topic || 'Khám phá sự phát triển của cây xanh';
  const duration = 
    normGrade === 'NHA_TRE' ? 15 :
    normGrade === 'MAM' ? 20 :
    normGrade === 'CHOI' ? 25 : 30;

  // Mermaid.js Mindmap Diagram Code
  const mermaidCode = `graph TD
  Root["🌱 ${safeTopic}"] --> Step1["1. Khởi động (Bé quan sát)"]
  Root --> Step2["2. Khám phá (Trải nghiệm thực tế)"]
  Root --> Step3["3. Luyện tập (Trò chơi tương tác)"]
  Root --> Step4["4. Củng cố (Sơ đồ tư duy)"]
  
  Step1 --> S1_Detail["Thơ & Hát cùng cô: ${framework.pedagogical_guidelines.songs_or_poems?.[0] || 'Bài hát mầm non'}"]
  Step2 --> S2_Detail["Trải nghiệm trực quan: ${framework.pedagogical_guidelines.basic_materials.slice(0, 2).join(', ')}"]
  Step3 --> S3_Detail["Trò chơi: ${framework.pedagogical_guidelines.interactive_games?.[0] || 'Thi đội nào nhanh' }"]
  Step4 --> S4_Detail["Khen thưởng & Bé thu dọn đồ dùng"]`;

  // 5-Step Traditional / 5E Pedagogy Structure
  const isLaGroup = normGrade === 'LA';
  const fiveSteps = [
    {
      step_number: 1,
      step_title: isLaGroup ? '1. Gắn kết (Engage) - Ổn định & Đặt vấn đề' : '1. Gắn kết & Khởi động (Ổn định tổ chức)',
      description: 'Gây hứng thú cho trẻ qua bài hát vui nhộn và câu hỏi gợi mở.',
      teacher_action: `Cô cùng cả lớp hát bài "${framework.pedagogical_guidelines.songs_or_poems?.[0] || 'Mầm non vui vẻ'}" và gợi mở câu hỏi khám phá về đề tài "${safeTopic}".`,
      child_activity: 'Trẻ hào hứng nhún nhảy theo nhạc, lắng nghe và hăng hái trả lời câu hỏi của cô.'
    },
    {
      step_number: 2,
      step_title: isLaGroup ? '2. Khám phá (Explore) - Trải nghiệm thực tế' : '2. Khám phá & Trải nghiệm thực tế (Hoạt động trọng tâm)',
      description: 'Cho trẻ quan sát trực quan, sờ nắn và thực hành trải nghiệm trực tiếp.',
      teacher_action: `Cô giới thiệu học liệu chuẩn: ${materials_needed || framework.pedagogical_guidelines.basic_materials.join(', ')}. Hướng dẫn trẻ quan sát và vần thao tác.`,
      child_activity: `Trẻ chia nhóm 4-5 bé, tự tay sờ nắn, quan sát và trải nghiệm đồ dùng cùng các bạn.`
    },
    {
      step_number: 3,
      step_title: isLaGroup ? '3. Giải thích (Explain) - Thảo luận & Trò chơi' : '3. Giải thích & Thảo luận nhóm (Luyện tập trò chơi)',
      description: 'Giúp trẻ ghi nhớ kiến thức qua trò chơi đồng đội tương tác.',
      teacher_action: `Cô tổ chức trò chơi "${framework.pedagogical_guidelines.interactive_games?.[0] || 'Đội nào nhanh nhất'}" khắc sâu bài học. Từ vựng cốt lõi: ${framework.pedagogical_guidelines.key_vocabulary.join(', ')}.`,
      child_activity: 'Các nhóm phân công nhau cầm thẻ tranh nhanh chân lên dán vào bảng nhóm.'
    },
    {
      step_number: 4,
      step_title: isLaGroup ? '4. Áp dụng & Mở rộng (Elaborate)' : '4. Củng cố & Tổng kết kiến thức',
      description: isLaGroup ? 'Trẻ tự tay vận dụng kiến thức thực hành sáng tạo sản phẩm.' : 'Hệ thống lại nội dung qua Sơ đồ tư duy Mermaid visual.',
      teacher_action: isLaGroup 
        ? `Cô hướng dẫn trẻ ứng dụng kiến thức tự tay thực hành (gieo hạt, tạo hình hoặc làm thí nghiệm) về "${safeTopic}".`
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
    instruction: `Cô tập hợp trẻ vào buổi chiều, tổ chức trò chơi củng cố kiến thức về "${safeTopic}". Chuẩn bị: ${framework.pedagogical_guidelines.basic_materials.slice(0, 2).join(', ')}. Cách tiến hành: Cô phổ biến luật chơi, trẻ tham gia phản xạ nhanh và nhận phần thưởng dương tính.`
  };

  // PowerPoint Slide Deck Content
  const slides: AILessonSlide[] = [
    {
      slide_number: 1,
      title: `BÀI GIẢNG: ${safeTopic.toUpperCase()}`,
      content_points: [
        `Môn học: ${SUBJECT_NAME_MAP[subject] || subject} • Khối lớp: ${GRADE_LEVEL_MAP[normGrade].label}`,
        `Chủ đề: ${THEME_NAME_MAP[theme_code]}`,
        `Thời lượng chuẩn: ${duration} phút`
      ],
      image_prompt: `Cute preschool children learning about ${safeTopic}, colorful classroom`,
      image_url: getPollinationsImageUrl(`Cute preschool children learning about ${safeTopic}`, 1024, 768, 1)
    },
    {
      slide_number: 2,
      title: 'MỤC TIÊU BÀI HỌC & ĐỒ DÙNG',
      content_points: [
        `Mục tiêu: ${target_objectives || steamPillars.science}`,
        `Học liệu: ${materials_needed || framework.pedagogical_guidelines.basic_materials.join(', ')}`,
        `Từ vựng: ${framework.pedagogical_guidelines.key_vocabulary.join(', ')}`
      ],
      image_prompt: `Preschool science experiment materials, cartoon style`,
      image_url: getPollinationsImageUrl(`Preschool science experiment materials`, 1024, 768, 2)
    },
    {
      slide_number: 3,
      title: 'THỰC HÀNH & TRẢI NGHIỆM TRỰC QUAN',
      content_points: [
        'Bước 1: Quan sát mẫu trực quan của cô.',
        'Bước 2: Trẻ thao tác trải nghiệm theo nhóm.',
        'Bước 3: Trả lời câu hỏi gợi mở và thảo luận.'
      ],
      image_prompt: `Little happy Asian kindergarten child exploring ${safeTopic}, bright watercolor`,
      image_url: getPollinationsImageUrl(`Little happy Asian kindergarten child exploring ${safeTopic}`, 1024, 768, 3)
    },
    {
      slide_number: 4,
      title: 'SƠ ĐỒ TƯ DUY TỔNG KẾT BÀI HỌC',
      content_points: [
        `Tóm tắt chủ đề: ${safeTopic}`,
        'Bé nhớ bài học và tự giác thu dọn đồ dùng ngăn nắp nhé!'
      ],
      image_prompt: `sprout growing stages timeline infographic for kindergarten children`,
      image_url: getPollinationsImageUrl(`sprout growing stages timeline infographic for kindergarten children`, 1024, 768, 4)
    }
  ];

  return {
    id: `ai-lesson-${Date.now()}`,
    topic: safeTopic,
    subject: SUBJECT_NAME_MAP[subject] || subject,
    grade_level: normGrade,
    teaching_type: 'TRADITIONAL',
    target_objectives: target_objectives || `S: ${steamPillars.science} | T: ${steamPillars.technology} | E: ${steamPillars.engineering} | A: ${steamPillars.art} | M: ${steamPillars.math}`,
    duration_minutes: duration,
    materials_needed: (materials_needed || framework.pedagogical_guidelines.basic_materials.join(', ')).split(',').map((s) => s.trim()),
    five_steps: fiveSteps,
    mermaid_mindmap_code: mermaidCode,
    youtube_video_suggestions: [
      { title: `Bài hát "${framework.pedagogical_guidelines.songs_or_poems?.[0] || 'Mầm Chồi Lá'}"`, url: 'https://www.youtube.com/results?search_query=mam+choi+la' },
      { title: `Khám phá "${safeTopic}" (VTV7 Nhi Khoa)`, url: 'https://www.youtube.com/results?search_query=vtv7+nhi+khoa' }
    ],
    slides,
    preparations: {
      teacher: (materials_needed || framework.pedagogical_guidelines.basic_materials.join(', ')).split(',').map((s) => s.trim()),
      students: framework.pedagogical_guidelines.basic_materials.slice(0, 3)
    },
    afternoon_activity: afternoonActivity,
    steam_pillars: steamPillars,
    framework_id: framework.id,
    created_at: new Date().toISOString()
  };
}

/**
 * Helper: Convert URL sang Base64 tránh lỗi CORS và mất ảnh trên PowerPoint
 */
export async function toBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Chuyển đổi Base64 thất bại'));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Không thể fetch ảnh để chuyển sang Base64:', err);
    return '';
  }
}

/**
 * High quality preschool cartoon fallback images if AI image server is unreachable
 */
export const FALLBACK_PRESCHOOL_IMAGES = [
  'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&auto=format&fit=crop&q=80'
];

export function getFallbackPreschoolImage(index: number = 0): string {
  return FALLBACK_PRESCHOOL_IMAGES[index % FALLBACK_PRESCHOOL_IMAGES.length];
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

    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Mầm Non Sương Mai AI Pedagogy Engine';

    // Slide 1: Cover Slide
    const slide1 = pptx.addSlide();
    slide1.background = { color: 'F0F9FF' };
    slide1.addText(lesson.topic.toUpperCase(), {
      x: 0.8,
      y: 1.2,
      w: 8.5,
      h: 1.2,
      fontSize: 26,
      bold: true,
      color: '0369A1',
      align: 'left'
    });
    slide1.addText(`Loại bài dạy: ${lesson.teaching_type === 'PROJECT_BASED' ? 'DỰ ÁN HỌC TẬP STEAM (PBL)' : 'BÀI GIẢNG TRUYỀN THỐNG 5 BƯỚC'}`, {
      x: 0.8,
      y: 2.5,
      w: 8.5,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: '0D9488'
    });
    slide1.addText(`Môn: ${lesson.subject} | Khối: ${lesson.grade_level} | Thời lượng: ${lesson.duration_minutes} phút`, {
      x: 0.8,
      y: 3.1,
      w: 8.5,
      h: 0.5,
      fontSize: 14,
      color: '475569'
    });

    // Slide 2: Objectives & Materials
    const slide2 = pptx.addSlide();
    slide2.addText('MỤC TIÊU & CHUẨN BỊ HỌC LIỆU', { x: 0.8, y: 0.6, fontSize: 22, bold: true, color: '0369A1' });
    slide2.addText(`Mục tiêu bài dạy:\n${lesson.target_objectives}`, { x: 0.8, y: 1.4, w: 8.5, h: 1.5, fontSize: 13, color: '1E293B' });
    slide2.addText(`Học liệu đồ dùng:\n${lesson.materials_needed.join(', ')}`, { x: 0.8, y: 3.1, w: 8.5, h: 1.5, fontSize: 13, color: '047857' });

    // Loop through lesson.slides to create full visual slides with images
    if (lesson.slides && lesson.slides.length > 0) {
      for (const slideData of lesson.slides) {
        const slide = pptx.addSlide();
        
        // Slide Title Header
        slide.addText(slideData.title.toUpperCase(), {
          x: 0.5,
          y: 0.4,
          w: 9.0,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: '0369A1'
        });

        // Left Content Points
        const textContent = slideData.content_points.map((pt) => `• ${pt}`).join('\n\n');
        slide.addText(textContent, {
          x: 0.5,
          y: 1.2,
          w: 4.8,
          h: 3.8,
          fontSize: 13,
          color: '1E293B',
          valign: 'top'
        });

        // Right Slide Image
        const imgUrl = slideData.image_url || getFallbackPreschoolImage(slideData.slide_number);
        try {
          slide.addImage({
            path: imgUrl,
            x: 5.5,
            y: 1.2,
            w: 4.0,
            h: 3.2
          });
        } catch (imgErr) {
          console.warn('PPTX Image add fallback:', imgErr);
        }
      }
    }

    // Save File
    const filename = `GiaoAn_${lesson.topic.replace(/\s+/g, '_')}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: filename });
  } catch (err) {
    console.error('Lỗi xuất PowerPoint:', err);
    alert('Không thể xuất file PowerPoint: ' + (err as any)?.message);
  }
}
