import { AILessonPlan, AILessonSlide } from '../types/schema';

/**
 * Generates Pollinations.ai Flux.1 Cartoon Illustration Image URL (Free 0 VNĐ)
 */
export function getPollinationsImageUrl(prompt: string, width = 1024, height = 768): string {
  const encodedPrompt = encodeURIComponent(`cute preschool cartoon illustration, colorful, friendly, ${prompt}`);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
}

/**
 * Generates 5-Step Preschool Lesson Plan + Mermaid Mindmap + Pollinations Images + PowerPoint Slides
 */
export async function generateAILessonPlan(params: {
  topic: string;
  subject: string;
  grade_level: 'MẦM' | 'CHỒI' | 'LÁ';
  target_objectives?: string;
  materials_needed?: string;
  expansion_ideas?: string;
}): Promise<AILessonPlan> {
  const { topic, subject, grade_level, target_objectives, materials_needed } = params;

  // Simulate AI Grounding Pipeline Response (Gemini 1.5 Flash API + Curriculum Framework Context)
  await new Promise((res) => setTimeout(res, 1200));

  const safeTopic = topic.trim() || 'Khám phá sự phát triển của cây xanh';
  const duration = grade_level === 'MẦM' ? 20 : grade_level === 'CHỒI' ? 25 : 30;

  // Mermaid.js Mindmap Diagram Code
  const mermaidCode = `graph TD
  Root["🌱 ${safeTopic}"] --> Step1["1. Khởi động (Bé quan sát)"]
  Root --> Step2["2. Khám phá (Trải nghiệm thực tế)"]
  Root --> Step3["3. Luyện tập (Trò chơi tương tác)"]
  Root --> Step4["4. Củng cố (Sơ đồ tư duy)"]
  
  Step1 --> S1_Detail["Thơ & Hát cùng cô"]
  Step2 --> S2_Detail["Gieo hạt với bông gòn & tưới nước"]
  Step3 --> S3_Detail["Ghép tranh quy trình nảy mầm"]
  Step4 --> S4_Detail["Khen thưởng & Bé thu dọn đồ dùng"]`;

  // 5-Step Pedagogy Structure
  const fiveSteps = [
    {
      step_number: 1,
      step_title: '1. Gắn kết & Khởi động (Ổn định tổ chức)',
      description: 'Gây hứng thú cho trẻ qua bài hát vui nhộn và câu hỏi gợi mở.',
      teacher_action: `Cô cùng cả lớp hát và vận động theo bài hát thiếu nhi liên quan đến "${safeTopic}".`,
      child_activity: 'Trẻ hào hứng nhún nhảy theo nhạc, lắng nghe và hăng hái trả lời câu hỏi của cô.'
    },
    {
      step_number: 2,
      step_title: '2. Khám phá & Trải nghiệm thực tế (Hoạt động trọng tâm)',
      description: 'Cho trẻ quan sát trực quan, sờ nắn và thực hành trải nghiệm trực tiếp.',
      teacher_action: `Cô giới thiệu đồ dùng trực quan: ${materials_needed || 'Bông gòn, hạt đỗ, nước sạch, khay nhựa'}. Hướng dẫn trẻ từng bước thao tác thực hành.`,
      child_activity: `Trẻ chia nhóm 4-5 bé, tự tay thực hành gieo hạt với bông gòn và tưới nước chăm sóc.`
    },
    {
      step_number: 3,
      step_title: '3. Giải thích & Thảo luận nhóm (Luyện tập trò chơi)',
      description: 'Giúp trẻ ghi nhớ kiến thức qua trò chơi đồng đội tương tác.',
      teacher_action: 'Cô tổ chức trò chơi "Đội nào nhanh nhất" sắp xếp quy trình phát triển theo thứ tự đúng.',
      child_activity: 'Các nhóm phân công nhau cầm thẻ tranh nhanh chân lên dán vào bảng nhóm.'
    },
    {
      step_number: 4,
      step_title: '4. Củng cố & Tổng kết kiến thức',
      description: 'Hệ thống lại nội dung qua Sơ đồ tư duy Mermaid visual.',
      teacher_action: 'Cô trình chiếu Sơ đồ tư duy trên SmartTV, mời đại diện bé lên chỉ và tóm tắt lại bài học.',
      child_activity: 'Bé đại diện tự tin lên bảng SmartTV giới thiệu quy trình bài học cho các bạn.'
    },
    {
      step_number: 5,
      step_title: '5. Đánh giá & Mở rộng (Kết thúc)',
      description: 'Khen ngợi nỗ lực của trẻ và hướng dẫn thu dọn đồ dùng gọn gàng.',
      teacher_action: 'Cô nhận xét dương tính từng nhóm, trao nhãn dán bé ngoan và dặn dò bé chăm sóc sản phẩm.',
      child_activity: 'Trẻ vui vẻ nhận phần thưởng và tự giác thu dọn khay đồ dùng về đúng nơi quy định.'
    }
  ];

  // PowerPoint Slide Deck Content
  const slides: AILessonSlide[] = [
    {
      slide_number: 1,
      title: `BÀI GIẢNG: ${safeTopic.toUpperCase()}`,
      content_points: [
        `Môn học: ${subject} • Khối lớp: ${grade_level}`,
        `Thời lượng: ${duration} phút`,
        `Giáo viên thực hiện: Sơ Maria Tươi / Cô Thu Hà`
      ],
      image_prompt: `Cute preschool children learning about ${safeTopic}, colorful classroom`,
      image_url: getPollinationsImageUrl(`Cute preschool children learning about ${safeTopic}`)
    },
    {
      slide_number: 2,
      title: 'MỤC TIÊU BÀI HỌC & ĐỒ DÙNG',
      content_points: [
        `Mục tiêu: ${target_objectives || 'Trẻ nhận biết và trình bày được các giai đoạn phát triển của hạt đỗ'}`,
        `Chuẩn bị: ${materials_needed || 'Bông gòn, hạt giống, cốc nhựa, nước sạch, khay thực hành'}`
      ],
      image_prompt: `Preschool science experiment materials, seeds and cotton balls, cartoon style`,
      image_url: getPollinationsImageUrl(`Preschool science experiment materials, seeds and cotton balls`)
    },
    {
      slide_number: 3,
      title: 'THỰC HÀNH GIEO HẠT VỚI BÔNG GÒN',
      content_points: [
        'Bước 1: Lót 1 lớp bông gòn vào đáy cốc nhựa.',
        'Bước 2: Rắc 3-4 hạt đỗ đã ngâm ấm lên bông.',
        'Bước 3: Tắm mát cho hạt bằng 2 thìa nước sạch.'
      ],
      image_prompt: `Little happy Asian kindergarten child watering seeds in cotton ball, bright watercolor`,
      image_url: getPollinationsImageUrl(`Little happy Asian kindergarten child watering seeds in cotton ball`)
    },
    {
      slide_number: 4,
      title: 'SƠ ĐỒ TƯ DUY TỔNG KẾT BÀI HỌC',
      content_points: [
        'Hạt mầm nhỏ $\\rightarrow$ Nảy mầm $\\rightarrow$ Mọc lá non $\\rightarrow$ Cây lớn xinh',
        'Bé nhớ tưới nước và để cây tắm nắng hàng ngày nhé!'
      ],
      image_prompt: `Green sprout growing stages timeline infographic for kindergarten children`,
      image_url: getPollinationsImageUrl(`Green sprout growing stages timeline infographic for kindergarten children`)
    }
  ];

  return {
    id: `ai-lesson-${Date.now()}`,
    topic: safeTopic,
    subject,
    grade_level,
    target_objectives: target_objectives || 'Trẻ tự tin trình bày kiến thức và thực hành khéo léo.',
    duration_minutes: duration,
    materials_needed: (materials_needed || 'Bông gòn, hạt giống, cốc nhựa, nước sạch').split(',').map((s) => s.trim()),
    five_steps: fiveSteps,
    mermaid_mindmap_code: mermaidCode,
    youtube_video_suggestions: [
      { title: 'Bài hát "Hạt mầm nhỏ" (Kênh Mầm Chồi Lá)', url: 'https://www.youtube.com/results?search_query=bai+hat+hat+mam+nho' },
      { title: 'Hoạt hình "Sự kỳ diệu của hạt đỗ" (VTV7)', url: 'https://www.youtube.com/results?search_query=su+ky+dieu+cua+hat+do+vtv7' }
    ],
    slides,
    created_at: new Date().toISOString()
  };
}

/**
 * Triggers PowerPoint (.pptx) file generation using dynamic client-side PptxGenJS library
 */
export async function exportToPowerPoint(lesson: AILessonPlan): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    // Load PptxGenJS script dynamically if not loaded yet
    if (!(window as any).PptxGenJS) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load PptxGenJS script'));
        document.head.appendChild(script);
      });
    }

    const PptxGenJS = (window as any).PptxGenJS;
    const pptx = new PptxGenJS();

    pptx.layout = 'LAYOUT_16x9';
    pptx.title = lesson.topic;

    // Slide 1: Title Slide
    const slide1 = pptx.addSlide();
    slide1.background = { color: 'F0F9FF' }; // Light Sky Blue
    slide1.addText(lesson.topic.toUpperCase(), {
      x: 0.8,
      y: 1.5,
      w: 8.4,
      h: 1.2,
      fontSize: 28,
      bold: true,
      color: '0369A1',
      align: 'center',
    });
    slide1.addText(`Môn: ${lesson.subject} | Khối: ${lesson.grade_level} (${lesson.duration_minutes} phút)`, {
      x: 0.8,
      y: 2.8,
      w: 8.4,
      h: 0.6,
      fontSize: 18,
      color: '0C4A6E',
      align: 'center',
    });
    slide1.addText('Hệ Sinh Thái Mầm Non Sương Mai', {
      x: 0.8,
      y: 4.2,
      w: 8.4,
      h: 0.4,
      fontSize: 14,
      italic: true,
      color: '64748B',
      align: 'center',
    });

    // Content Slides
    lesson.slides.forEach((slideData) => {
      const s = pptx.addSlide();
      s.background = { color: 'FFFFFF' };

      // Header Banner
      s.addText(slideData.title, {
        x: 0.5,
        y: 0.4,
        w: 9.0,
        h: 0.8,
        fontSize: 22,
        bold: true,
        color: '0284C7',
      });

      // Bullet points
      const bulletsText = slideData.content_points.map((p) => `• ${p}`).join('\n\n');
      s.addText(bulletsText, {
        x: 0.5,
        y: 1.5,
        w: 5.2,
        h: 3.5,
        fontSize: 16,
        color: '334155',
        lineSpacing: 24,
      });

      // Cartoon Illustration Image from Pollinations
      if (slideData.image_url) {
        s.addImage({
          path: slideData.image_url,
          x: 5.9,
          y: 1.4,
          w: 3.6,
          h: 3.4,
        });
      }
    });

    // Save File
    await pptx.writeFile({ fileName: `Giao_An_${lesson.topic.replace(/\s+/g, '_')}.pptx` });
  } catch (err) {
    console.warn('Fallback PPTX exporter:', err);
    // Fallback: Trigger text file download if browser environment blocks dynamic binary export
    const content = `BÀI GIẢNG: ${lesson.topic}\nMôn: ${lesson.subject} | Khối: ${lesson.grade_level}\n\n` +
      lesson.slides.map(s => `SLIDE ${s.slide_number}: ${s.title}\n${s.content_points.join('\n')}\n[Ảnh: ${s.image_url}]\n`).join('\n---\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bai_Giang_${lesson.topic.replace(/\s+/g, '_')}.txt`;
    a.click();
  }
}
