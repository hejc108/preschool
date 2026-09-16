import { AILessonPlan, AILessonSlide, GradeLevelCode, ThemeCode, LearningProject, TeachingType, PreschoolAISchemaResponse } from '../types/schema';
import { getFrameworkByGradeAndTheme, THEME_NAME_MAP, GRADE_LEVEL_MAP, SUBJECT_NAME_MAP, getDynamicMaterialSuggestions } from '../utils/curriculumHelper';

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
 * Generates full 13-slide Rules.pdf compliant presentation deck
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
  const safeTopic = topic.trim() || 'Khám Phá Sự Phát Triển Của Cây Xanh';
  const gradeInfo = GRADE_LEVEL_MAP[grade_level] || GRADE_LEVEL_MAP['LA'];
  const themeName = THEME_NAME_MAP[theme_code] || 'Thế Giới Thực Vật';
  const subjectName = SUBJECT_NAME_MAP[subject] || subject;
  const normSub = subject.toUpperCase();

  const lowerTopic = safeTopic.toLowerCase();
  const isPlantTopic = lowerTopic.includes('cây') || lowerTopic.includes('thực vật') || lowerTopic.includes('hạt mầm') || lowerTopic.includes('hoa') || lowerTopic.includes('quả');

  // Slide 1: COVER
  const s1: AILessonSlide = {
    slide_number: 1,
    layout_type: 'COVER',
    header_tag: '🎓 TRƯỜNG MẦM NON SƯƠNG MAI',
    title: safeTopic,
    subtitle: `Giáo án ${subjectName} trực quan dành cho các bé yêu thiên nhiên`,
    pill_badges: [`🎓 Khối ${gradeInfo.label}`, `⏱ Thời lượng: ${gradeInfo.duration}`, `🌱 Chủ đề: ${themeName}`],
    content_points: [`Khối: ${gradeInfo.label}`, `Thời lượng: ${gradeInfo.duration}`, `Chủ đề: ${themeName}`],
    image_prompt: `Cute preschool children learning about ${safeTopic}, bright classroom, watercolor illustration`,
    image_url: getPollinationsImageUrl(`Cute preschool children learning about ${safeTopic}`, 1024, 768, 1)
  };

  // Slide 2: DARK_HERO
  const s2: AILessonSlide = {
    slide_number: 2,
    layout_type: 'DARK_HERO',
    pill_badges: ['🧭 BƯỚC 1: GẮN KẾT & KHÁM PHÁ'],
    title: isPlantTopic ? 'Điều Kỳ Diệu Của Hạt Mầm' : `Điều Kỳ Diệu Về ${safeTopic}`,
    subtitle: framework.pedagogical_guidelines.songs_or_poems?.[0] 
      ? `Cùng hát vang bài ca "${framework.pedagogical_guidelines.songs_or_poems[0]}" và lắng nghe câu chuyện về những hạt mầm thức giấc đón chào ánh mặt trời.`
      : `Cùng hát vang bài ca vui nhộn và lắng nghe câu chuyện sinh động chào đón bài học mới!`,
    content_points: ['Gắn kết và đặt vấn đề gây hứng thú cho trẻ'],
    image_prompt: `Magic glowing nature seed sprouting, dark green background vector style`,
    image_url: getPollinationsImageUrl(`Magic glowing seed sprouting dark green background`, 1024, 768, 2)
  };

  // Slide 3: GRID_4_CARDS
  let gridCards = [
    { icon: '☀️', title: 'Ánh Nắng', desc: 'Mặt trời ấm áp sưởi ấm mầm xanh và giúp lá cây quang hợp để tạo chất dinh dưỡng mỗi ngày.' },
    { icon: '💧', title: 'Nước Mát', desc: 'Nước tưới làm mềm hạt giống, giúp rễ cây hút dinh dưỡng từ đất để nuôi thân và lá luôn tươi tốt.' },
    { icon: '⛰️', title: 'Đất Mùn', desc: 'Đất tơi xốp giữ chặt rễ cây đứng vững và chứa nguồn khoáng chất quý giá nuôi cây mau lớn.' },
    { icon: '💨', title: 'Không Khí', desc: 'Cây xanh hít thở không khí trong lành để trao đổi chất, phát triển cành lá vươn cao.' }
  ];

  if (normSub.includes('LQVT') || normSub.includes('TOÁN')) {
    gridCards = [
      { icon: '🔢', title: 'Số Lượng', desc: 'Trẻ đếm chính xác nhóm đồ dùng theo số lượng quy định và nhận biết nhóm tương ứng.' },
      { icon: '🔺', title: 'Hình Khối', desc: 'Nhận biết phân biệt hình tròn, hình vuông, hình tam giác, hình chữ nhật quanh bé.' },
      { icon: '⚖️', title: 'So Sánh', desc: 'So sánh kích thước to - nhỏ, cao - thấp, dài - ngắn của các đối tượng trực quan.' },
      { icon: '📦', title: 'Phân Loại', desc: 'Gộp và phân loại đối tượng theo 1-2 dấu hiệu đặc trưng rõ ràng.' }
    ];
  } else if (normSub.includes('LQCC') || normSub.includes('CHỮ CÁI')) {
    gridCards = [
      { icon: '⭕', title: 'Nét Cong', desc: 'Nhận biết nét cong tròn khép kín, nét cong hở trái, cong hở phải.' },
      { icon: '📏', title: 'Nét Thẳng', desc: 'Phân biệt nét móc ngược, nét xiên trái, xiên phải và nét ngang.' },
      { icon: '🔤', title: 'Ghép Chữ', desc: 'Thực hành ghép các nét rời để tạo thành chữ cái hoàn chỉnh.' },
      { icon: '🔊', title: 'Phát Âm', desc: 'Luyện phát âm chuẩn khẩu hình chữ cái, không nói ngọng, nói lắp.' }
    ];
  } else if (normSub.includes('TAO_HINH') || normSub.includes('TẠO HÌNH')) {
    gridCards = [
      { icon: '🎨', title: 'Màu Sắc', desc: 'Phối kết hợp các mảng màu rực rỡ, hài hòa để tạo nên sản phẩm tươi sáng.' },
      { icon: '✏️', title: 'Đường Nét', desc: 'Sử dụng nét vẽ uốn lượn, nét xiên, nét xoắn ốc khéo léo của đôi bàn tay.' },
      { icon: '🖼️', title: 'Bố Cục', desc: 'Sắp xếp bố cục hình ảnh cân đối ở chính giữa trang giấy A4.' },
      { icon: '✨', title: 'Sáng Tạo', desc: 'Vận dụng vật liệu mở tự nhiên trang trí thêm cho bức tranh sinh động.' }
    ];
  }

  const s3: AILessonSlide = {
    slide_number: 3,
    layout_type: 'GRID_4_CARDS',
    title: isPlantTopic ? '⚙ Cây Xanh Cần Gì Để Lớn Lên?' : `⚙ Yếu Tố Cốt Lõi Của ${safeTopic}`,
    cards_data: gridCards,
    content_points: gridCards.map(c => `${c.title}: ${c.desc}`),
    image_prompt: `Educational 4 icons set layout for kindergarten learning`,
    image_url: getPollinationsImageUrl(`Educational 4 icons set layout for kindergarten learning`, 1024, 768, 3)
  };

  // Slide 4: TIMELINE_4_STEPS
  const timelineSteps = isPlantTopic ? [
    { step_num: 1, title: '1. Hạt Giống', desc: 'Bé gieo hạt nhỏ xuống đất tơi xốp, hạt uống no nước rồi dần phình to.' },
    { step_num: 2, title: '2. Nảy Mầm', desc: 'Chiếc mầm nhỏ nhú lên khỏi mặt đất, cắm chiếc rễ đầu tiên xuống lòng đất.' },
    { step_num: 3, title: '3. Cây Con', desc: 'Cây bung hai lá mầm xanh non, thân cây vươn cao đón ánh nắng rực rỡ.' },
    { step_num: 4, title: '4. Cây Trưởng Thành', desc: 'Cây sum suê cành lá, trổ ngàn hoa thơm và kết thành những quả ngọt ngào.' }
  ] : [
    { step_num: 1, title: '1. Quan Sát', desc: 'Trẻ cùng cô quan sát mẫu trực quan và đàm thoại tìm hiểu đặc điểm.' },
    { step_num: 2, title: '2. Trải Nghiệm', desc: 'Trẻ tự tay thao tác với học liệu chuẩn bị theo nhóm 4-5 bạn.' },
    { step_num: 3, title: '3. Luyện Tập', desc: 'Tham gia trò chơi tương tác đồng đội khắc sâu kiến thức bài học.' },
    { step_num: 4, title: '4. Sản Phẩm', desc: 'Hoàn thiện sản phẩm trải nghiệm và tự tin giới thiệu với các bạn.' }
  ];

  const s4: AILessonSlide = {
    slide_number: 4,
    layout_type: 'TIMELINE_4_STEPS',
    title: isPlantTopic ? '🔄 Vòng Đời Kỳ Diệu Của Cây' : `🔄 Tiến Trình Vòng Đời & Các Bước Học`,
    steps_data: timelineSteps,
    content_points: timelineSteps.map(s => `${s.title}: ${s.desc}`),
    image_prompt: `Plant growth lifecycle horizontal timeline infographic cartoon`,
    image_url: getPollinationsImageUrl(`Plant growth lifecycle horizontal timeline infographic cartoon`, 1024, 768, 4)
  };

  // Slide 5: IMAGE_CARDS_3
  const imageCards = [
    { title: 'Hạt Nảy Mầm', desc: 'Hạt đỗ tách vỏ, mầm nhỏ hé nụ trắng vươn về phía có ánh sáng.', image_url: getPollinationsImageUrl('sprout germination stage cartoon', 600, 400, 5) },
    { title: 'Cây Non Lớn Lên', desc: 'Cây mọc thêm nhiều lá xanh thẫm, thân cứng cáp đung đưa theo gió.', image_url: getPollinationsImageUrl('happy green sprout growing cute cartoon', 600, 400, 6) },
    { title: 'Đơm Hoa Kết Trái', desc: 'Cây trĩu quả thơm ngon, lại tạo ra hạt giống cho mùa sau.', image_url: getPollinationsImageUrl('fruit tree with red apples watercolor cartoon', 600, 400, 7) }
  ];

  const s5: AILessonSlide = {
    slide_number: 5,
    layout_type: 'IMAGE_CARDS_3',
    title: `🖼 Các Giai Đoạn Của Cây Xanh`,
    cards_data: imageCards,
    content_points: imageCards.map(c => `${c.title}: ${c.desc}`),
    image_prompt: `3 stage illustrations of ${safeTopic}`,
    image_url: imageCards[1].image_url
  };

  // Slide 6: TWO_COLUMN_CARDS
  const twoColCards = [
    { icon: '↓↓', title: 'Rễ Cây & Thân Cây', desc: 'Rễ cây: Nằm sâu dưới lòng đất, giống như những bàn tay nhỏ bám thật chắc để giữ cây không bị đổ khi gió bão và hút nước mát nuôi cây.\n\nThân cây: Là chiếc cột vững chãi vận chuyển nhựa và dinh dưỡng từ rễ tỏa đi khắp các cành lá trên cao.' },
    { icon: '🍃', title: 'Cành, Lá, Hoa & Quả', desc: 'Cành & Lá: Xòe rộng như chiếc ô xanh hứng nắng mặt trời, hít thở và thanh lọc không khí trong lành.\n\nHoa & Quả: Hoa tỏa hương khoe sắc mời các bạn ong bướm đến thụ phấn, sau đó biến thành những quả ngọt mọng cho bé thưởng thức.' }
  ];

  const s6: AILessonSlide = {
    slide_number: 6,
    layout_type: 'TWO_COLUMN_CARDS',
    title: `🌲 Cấu Tạo Cơ Bản Của Cây Xanh`,
    cards_data: twoColCards,
    content_points: twoColCards.map(c => `${c.title}: ${c.desc}`),
    image_prompt: `Detailed plant anatomy structural breakdown diagram for kids`,
    image_url: getPollinationsImageUrl('Detailed plant anatomy structural breakdown diagram for kids', 1024, 768, 8)
  };

  // Slide 7: LIST_ACCENT_IMAGE
  const listPoints = [
    'Tạo khí oxy trong lành: Cây xanh là "nhà máy lọc không khí" khổng lồ giúp bé và muôn loài hít thở khỏe mạnh.',
    'Tỏa bóng râm mát rượi: Dưới tán lá xanh, sân trường Sương Mai luôn râm mát cho các bé vui chơi thỏa thích.',
    'Cho quả ngọt, hoa thơm: Những trái táo, chuối, cam thơm ngon mang nhiều vitamin bổ dưỡng cho cơ thể.',
    'Ngôi nhà của muông thú: Chim làm tổ trên cành, sóc nô đùa và côn trùng ríu rít ca hát.'
  ];

  const s7: AILessonSlide = {
    slide_number: 7,
    layout_type: 'LIST_ACCENT_IMAGE',
    title: `🍃 Lợi Ích Tuyệt Vời Của Cây`,
    content_points: listPoints,
    image_prompt: `Cute plant sprout growing in fertile soil doodle cartoon illustration`,
    image_url: getPollinationsImageUrl('Cute plant sprout growing in fertile soil doodle cartoon illustration', 800, 800, 9)
  };

  // Slide 8: NUMBERED_STEPS
  const numSteps = [
    { step_num: 1, title: 'Bước 1 - Chuẩn bị tổ ấm cho hạt', desc: 'Bé lấy chiếc cốc sạch và nhẹ nhàng lót một lớp bông gòn mềm mại vào đáy cốc làm đệm êm.' },
    { step_num: 2, title: 'Bước 2 - Tưới giọt nước yêu thương', desc: 'Thấm một chút nước sạch vừa đủ ẩm vào bông gòn, không để nước ngập làm hạt bị úng nhé.' },
    { step_num: 3, title: 'Bước 3 - Đặt hạt đỗ ngủ ngon', desc: 'Đặt hạt đậu xanh khỏe khoắn vào giữa lớp bông, chúc hạt ngủ ngon và mau thức dậy nảy mầm.' }
  ];

  const s8: AILessonSlide = {
    slide_number: 8,
    layout_type: 'NUMBERED_STEPS',
    title: `🧪 3 Bước Bé Thực Hành Gieo Hạt`,
    steps_data: numSteps,
    subtitle: '💚 Chăm sóc mỗi ngày: Đặt cốc ở nơi có ánh sáng chan hòa và theo dõi hạt lớn lên từng ngày cùng cô giáo!',
    content_points: numSteps.map(s => `${s.title}: ${s.desc}`),
    image_prompt: `Preschool children planting seeds step by step cartoon`,
    image_url: getPollinationsImageUrl('Preschool children planting seeds step by step cartoon', 1024, 768, 10)
  };

  // Slide 9: SPLIT_STORY_IMAGE
  const s9: AILessonSlide = {
    slide_number: 9,
    layout_type: 'SPLIT_STORY_IMAGE',
    title: '🌱 Vườn Rau Của Bé',
    subtitle: 'Tại sân vườn Trường Mầm Non Sương Mai, mỗi ngày đến trường là một ngày hội khám phá thiên nhiên tươi đẹp.\n\nBé cùng các bạn tự tay tưới nước, bắt sâu và ngắm nhìn những mầm cây lớn lên xanh mướt dưới ánh nắng ấm áp.',
    content_points: ['Trẻ tự tay tưới nước và chăm sóc vườn rau sân trường Sương Mai'],
    image_prompt: `Happy Asian kindergarten children gardening in vegetable garden under sunflower sunny watercolor cartoon`,
    image_url: getPollinationsImageUrl('Happy Asian kindergarten children gardening in vegetable garden under sunflower sunny watercolor cartoon', 1024, 768, 11)
  };

  // Slide 10: STAT_CALLOUT
  const s10: AILessonSlide = {
    slide_number: 10,
    layout_type: 'STAT_CALLOUT',
    title: `⭐ Thông Điệp Xanh Của Lớp ${gradeInfo.label.split(' ')[0]}`,
    stat_highlight: {
      number: '100%',
      label: 'Bé Yêu Cây Xanh',
      hero_title: 'Bé Là Hiệp Sĩ Bảo Vệ Mầm Xanh',
      hero_desc: `Tất cả các bạn nhỏ Khối ${gradeInfo.label} của Trường Mầm Non Sương Mai đều hiểu rằng: Yêu thiên nhiên là bảo vệ cuộc sống của chính mình. Mỗi hạt giống nhỏ bé hôm nay được chăm sóc bằng tình yêu thương sẽ trở thành những bóng cây râm mát cho tương lai.`
    },
    content_points: ['100% Bé yêu thiên nhiên và bảo vệ mầm xanh'],
    image_prompt: `Green leaf emblem shield vector badge for environment protection`,
    image_url: getPollinationsImageUrl('Green leaf emblem shield vector badge for environment protection', 1024, 768, 12)
  };

  // Slide 11: HERO_OVERLAY
  const s11: AILessonSlide = {
    slide_number: 11,
    layout_type: 'HERO_OVERLAY',
    title: `Cùng Chung Tay Bảo Vệ Cây Xanh`,
    subtitle: 'Bé nhớ: Không bẻ cành bứt lá, không giẫm lên cỏ xanh. Hằng ngày nhớ tưới nước đều đặn và rủ bạn bè cùng chăm sóc vườn cây thêm xanh mát ngập tràn tiếng chim ca!',
    content_points: ['Hành động thiết thực bảo vệ môi trường xung quanh'],
    image_prompt: `Beautiful forest nature landscape with stream background cartoon`,
    image_url: getPollinationsImageUrl('Beautiful forest nature landscape with stream background cartoon', 1024, 768, 13)
  };

  // Slide 12: OUTRO_PRAISE
  const s12: AILessonSlide = {
    slide_number: 12,
    layout_type: 'OUTRO_PRAISE',
    title: 'Bé Đố Cô - Cô Đố Bé!',
    subtitle: `Cả lớp mình hôm nay học rất ngoan và xuất sắc vượt qua các câu hỏi khám phá khoa học về cây xanh.`,
    pill_badges: [`🏅 HOAN HÔ CÁC BÉ LỚP ${gradeInfo.label.split(' ')[0].toUpperCase()} TRƯỜNG SƯƠNG MAI!`],
    content_points: ['Khen ngợi nỗ lực và trao danh hiệu bé ngoan'],
    image_prompt: `Kindergarten children cheering celebrating medal award winner cartoon`,
    image_url: getPollinationsImageUrl('Kindergarten children cheering celebrating medal award winner cartoon', 1024, 768, 14)
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

  // Dynamic Injection: Query 1 record from curriculum_frameworks Seed Data
  const framework = getFrameworkByGradeAndTheme(normGrade, theme_code);

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
      teacher_action: `Cô giới thiệu học liệu chuẩn: ${resolvedMaterialsStr}. Hướng dẫn trẻ quan sát và thao tác.`,
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
    instruction: `Cô tập hợp trẻ vào buổi chiều, tổ chức trò chơi củng cố kiến thức về "${safeTopic}". Chuẩn bị: ${studentMaterials.slice(0, 2).join(', ')}. Cách tiến hành: Cô phổ biến luật chơi, trẻ tham gia phản xạ nhanh và nhận phần thưởng dương tính.`
  };

  // PowerPoint Slide Deck Content complying with Rules.pdf Design System
  const slides = generateRulesCompliantSlideDeck({
    topic: safeTopic,
    subject,
    grade_level: normGrade,
    theme_code,
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

    const FONT_TITLE = 'Arial Rounded MT Bold';
    const FONT_BODY = 'Arial';
    const COLOR_DARK_GREEN = '13542E';
    const COLOR_LIGHT_BG = 'F4FBF7';
    const COLOR_GOLD = 'FCD34D';

    const slidesData = lesson.slides || [];
    const base64Images: string[] = [];
    for (let i = 0; i < slidesData.length; i++) {
      const rawUrl = slidesData[i].image_url || getFallbackPreschoolImage(i);
      const b64 = await toBase64(rawUrl);
      base64Images.push(b64.startsWith('data:image') ? b64 : getFallbackPreschoolImage(i));
    }

    for (let i = 0; i < slidesData.length; i++) {
      const slideItem = slidesData[i];
      const slide = pptx.addSlide();
      const img = base64Images[i] || getFallbackPreschoolImage(i);
      const isB64 = img.startsWith('data:image');
      const imgObj = { [isB64 ? 'data' : 'path']: img };

      const layoutType = slideItem.layout_type || 'COVER';

      if (layoutType === 'COVER') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.4, w: 12.33, h: 6.7, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 2 } });
        slide.addText(slideItem.header_tag || '🎓 TRƯỜNG MẦM NON SƯƠNG MAI', { x: 4.2, y: 0.8, w: 4.9, h: 0.5, fontSize: 16, fontFace: FONT_TITLE, color: '15803D', fill: { color: 'DCFCE7' }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
        slide.addText(slideItem.title, { x: 1.0, y: 1.6, w: 11.33, h: 1.4, fontSize: 36, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 1.5, y: 3.2, w: 10.33, h: 0.8, fontSize: 20, fontFace: FONT_BODY, color: '475569', align: 'center' });
        if (slideItem.pill_badges) {
          const badges = slideItem.pill_badges;
          badges.forEach((b, idx) => {
            slide.addText(b, { x: 1.5 + idx * 3.6, y: 4.8, w: 3.3, h: 0.6, fontSize: 16, fontFace: FONT_TITLE, color: '15803D', fill: { color: 'FFFFFF' }, line: { color: 'A7F3D0', width: 1.5 }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
          });
        }
      } else if (layoutType === 'DARK_HERO') {
        slide.background = { color: COLOR_DARK_GREEN };
        slide.addText(slideItem.pill_badges?.[0] || '🧭 BƯỚC 1: GẮN KẾT & KHÁM PHÁ', { x: 4.2, y: 1.2, w: 4.9, h: 0.6, fontSize: 16, fontFace: FONT_TITLE, color: 'FFFFFF', fill: { color: '166534' }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
        slide.addText(slideItem.title, { x: 1.0, y: 2.2, w: 11.33, h: 1.5, fontSize: 42, fontFace: FONT_TITLE, color: COLOR_GOLD, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 1.5, y: 4.2, w: 10.33, h: 1.5, fontSize: 22, fontFace: FONT_BODY, color: 'FEF3C7', align: 'center', lineSpacing: 32 });
      } else if (layoutType === 'GRID_4_CARDS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        const cards = slideItem.cards_data || [];
        cards.forEach((c, idx) => {
          const xPos = 0.8 + idx * 3.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.8, w: 2.7, h: 4.8, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(c.icon || '🌱', { x: xPos + 0.85, y: 2.2, w: 1.0, h: 1.0, fontSize: 28, align: 'center', fill: { color: 'F0FDF4' }, shape: pptx.ShapeType.roundRect });
          slide.addText(c.title, { x: xPos + 0.2, y: 3.4, w: 2.3, h: 0.6, fontSize: 20, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
          slide.addText(c.desc, { x: xPos + 0.2, y: 4.1, w: 2.3, h: 2.2, fontSize: 13, fontFace: FONT_BODY, color: '334155', align: 'center' });
        });
      } else if (layoutType === 'TIMELINE_4_STEPS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        slide.addShape(pptx.ShapeType.line, { x: 1.5, y: 4.0, w: 10.3, h: 0, line: { color: '86EFAC', width: 4 } });
        const steps = slideItem.steps_data || [];
        steps.forEach((s, idx) => {
          const xPos = 0.8 + idx * 3.0;
          const isTop = idx % 2 === 1;
          const yPos = isTop ? 1.6 : 4.4;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: yPos, w: 2.7, h: 2.2, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(s.title, { x: xPos + 0.1, y: yPos + 0.2, w: 2.5, h: 0.5, fontSize: 16, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
          slide.addText(s.desc, { x: xPos + 0.1, y: yPos + 0.7, w: 2.5, h: 1.3, fontSize: 12, fontFace: FONT_BODY, color: '334155', align: 'center' });
        });
      } else if (layoutType === 'IMAGE_CARDS_3') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        const cards = slideItem.cards_data || [];
        for (let idx = 0; idx < cards.length; idx++) {
          const c = cards[idx];
          const xPos = 0.8 + idx * 4.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.6, w: 3.7, h: 5.0, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          const cardImg = c.image_url ? await toBase64(c.image_url) : img;
          const cardImgObj = { [cardImg.startsWith('data:image') ? 'data' : 'path']: cardImg.startsWith('data:image') ? cardImg : img };
          slide.addImage({ ...cardImgObj, x: xPos + 0.15, y: 1.75, w: 3.4, h: 2.4 });
          slide.addText(c.title, { x: xPos + 0.2, y: 4.3, w: 3.3, h: 0.5, fontSize: 18, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
          slide.addText(c.desc, { x: xPos + 0.2, y: 4.8, w: 3.3, h: 1.6, fontSize: 13, fontFace: FONT_BODY, color: '334155', align: 'center' });
        }
      } else if (layoutType === 'TWO_COLUMN_CARDS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        const cards = slideItem.cards_data || [];
        cards.forEach((c, idx) => {
          const xPos = 0.8 + idx * 6.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.6, w: 5.7, h: 5.0, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(`${c.icon || '🌲'} ${c.title}`, { x: xPos + 0.3, y: 1.9, w: 5.1, h: 0.6, fontSize: 22, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
          slide.addText(c.desc, { x: xPos + 0.3, y: 2.6, w: 5.1, h: 3.7, fontSize: 15, fontFace: FONT_BODY, color: '334155', lineSpacing: 24 });
        });
      } else if (layoutType === 'LIST_ACCENT_IMAGE') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        const points = slideItem.content_points || [];
        points.forEach((pt, idx) => {
          const yPos = 1.6 + idx * 1.25;
          slide.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: yPos, w: 6.2, h: 1.1, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: 'F1F5F9', width: 1 } });
          slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: yPos, w: 0.15, h: 1.1, fill: { color: '16A34A' } });
          slide.addText(pt, { x: 1.1, y: yPos + 0.1, w: 5.7, h: 0.9, fontSize: 13, fontFace: FONT_BODY, color: '334155' });
        });
        slide.addImage({ ...imgObj, x: 7.3, y: 1.6, w: 5.0, h: 5.0, rounding: true });
      } else if (layoutType === 'NUMBERED_STEPS') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        const steps = slideItem.steps_data || [];
        steps.forEach((s, idx) => {
          const yPos = 1.6 + idx * 1.35;
          slide.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: yPos, w: 10.3, h: 1.2, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 1.5 } });
          slide.addText(`${s.step_num || idx + 1}`, { x: 1.8, y: yPos + 0.25, w: 0.7, h: 0.7, fontSize: 24, fontFace: FONT_TITLE, color: '16A34A', align: 'center', bold: true });
          slide.addText(`${s.title}: ${s.desc}`, { x: 2.7, y: yPos + 0.15, w: 8.8, h: 0.9, fontSize: 15, fontFace: FONT_BODY, color: '334155' });
        });
        if (slideItem.subtitle) {
          slide.addText(slideItem.subtitle, { x: 1.5, y: 5.8, w: 10.3, h: 0.8, fontSize: 16, fontFace: FONT_TITLE, color: '15803D', fill: { color: 'FFFFFF' }, line: { color: '86EFAC', width: 1.5 }, align: 'center', shape: pptx.ShapeType.roundRect });
        }
      } else if (layoutType === 'SPLIT_STORY_IMAGE') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 1.2, w: 5.5, h: 0.8, fontSize: 34, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        slide.addText(slideItem.subtitle || '', { x: 0.8, y: 2.2, w: 5.5, h: 4.2, fontSize: 18, fontFace: FONT_BODY, color: '334155', lineSpacing: 28 });
        slide.addImage({ ...imgObj, x: 6.6, y: 0.5, w: 6.2, h: 6.5 });
      } else if (layoutType === 'STAT_CALLOUT') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
        const stat = slideItem.stat_highlight;
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.6, w: 11.7, h: 5.0, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'DCFCE7', width: 2 } });
        if (stat) {
          slide.addShape(pptx.ShapeType.roundRect, { x: 1.2, y: 2.0, w: 4.0, h: 4.2, rectRadius: 0.1, fill: { color: 'BBF7D0' } });
          slide.addText(stat.number, { x: 1.2, y: 2.8, w: 4.0, h: 1.2, fontSize: 54, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
          slide.addText(stat.label, { x: 1.2, y: 4.2, w: 4.0, h: 0.6, fontSize: 20, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
          slide.addText(stat.hero_title, { x: 5.6, y: 2.2, w: 6.5, h: 0.8, fontSize: 26, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
          slide.addText(stat.hero_desc, { x: 5.6, y: 3.1, w: 6.5, h: 3.0, fontSize: 18, fontFace: FONT_BODY, color: '334155', lineSpacing: 28 });
        }
      } else if (layoutType === 'HERO_OVERLAY') {
        slide.addImage({ ...imgObj, x: 0, y: 0, w: 13.33, h: 7.5 });
        slide.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: 1.5, w: 10.33, h: 4.5, rectRadius: 0.15, fill: { color: 'FFFFFF' } });
        slide.addText(slideItem.title, { x: 1.8, y: 2.0, w: 9.7, h: 1.0, fontSize: 36, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 2.0, y: 3.2, w: 9.3, h: 2.2, fontSize: 20, fontFace: FONT_BODY, color: '334155', align: 'center', lineSpacing: 30 });
      } else if (layoutType === 'OUTRO_PRAISE') {
        slide.background = { color: 'FEF9C3' };
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.4, w: 12.33, h: 6.7, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'FEF08A', width: 2 } });
        slide.addText(slideItem.title, { x: 1.0, y: 1.8, w: 11.33, h: 1.2, fontSize: 44, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true, align: 'center' });
        slide.addText(slideItem.subtitle || '', { x: 1.5, y: 3.2, w: 10.33, h: 1.0, fontSize: 22, fontFace: FONT_BODY, color: '475569', align: 'center' });
        if (slideItem.pill_badges?.[0]) {
          slide.addText(slideItem.pill_badges[0], { x: 2.2, y: 4.8, w: 8.9, h: 0.9, fontSize: 22, fontFace: FONT_TITLE, color: 'CA8A04', fill: { color: 'FEF9C3' }, line: { color: 'FDE047', width: 2 }, align: 'center', bold: true, shape: pptx.ShapeType.roundRect });
        }
      } else if (layoutType === 'IMAGE_SOURCES') {
        slide.background = { color: COLOR_LIGHT_BG };
        slide.addText(slideItem.title, { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 32, fontFace: FONT_TITLE, color: COLOR_DARK_GREEN, bold: true });
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
