'use client';

import React, { useState } from 'react';
import { 
  Sparkles, FileText, Download, Play, Video, Image as ImageIcon, 
  CheckCircle2, ChevronLeft, Loader2, Share2, BookOpen, Layers, 
  Send, AlertCircle, Copy, Check, Rocket, Tv, Printer
} from 'lucide-react';
import Link from 'next/link';
import { generateAILessonPlan, generateAILearningProject, exportToPowerPoint, getFallbackPreschoolImage } from '@/lib/ai/aiGenerator';
import { AILessonPlan, GradeLevelCode, ThemeCode, TeachingType } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { 
  getFrameworkByGradeAndTheme, THEME_NAME_MAP, GRADE_LEVEL_MAP, 
  SUB_THEME_MAP, SUBJECT_NAME_MAP, getDynamicMaterialSuggestions,
  getThemeMatrix, autoDetectThemeCode
} from '@/lib/utils/curriculumHelper';

export default function TeacherAILessonPlanNewPage() {
  const [teachingType, setTeachingType] = useState<TeachingType>('TRADITIONAL');
  const [gradeLevel, setGradeLevel] = useState<GradeLevelCode>('LA');
  const [themeCode, setThemeCode] = useState<ThemeCode>('THUC_VAT');
  const [subTheme, setSubTheme] = useState<string>(SUB_THEME_MAP.THUC_VAT[0]);
  const [subject, setSubject] = useState<string>('KPKH');
  
  // Traditional Form States
  const [topic, setTopic] = useState<string>('Khám phá sự phát triển của cây xanh');
  const [targetObjectives, setTargetObjectives] = useState<string>('Trẻ biết cây cần đất, nước, không khí và ánh sáng để lớn lên');
  const [materialsNeeded, setMaterialsNeeded] = useState<string>(
    getDynamicMaterialSuggestions('KPKH', 'Khám phá sự phát triển của cây xanh', 'LA').allTags.join(', ')
  );

  // PBL Form States
  const [projectName, setProjectName] = useState<string>('Dự án Chế tạo Xe Ô tô Đồ chơi Tải nặng');
  const [finalProduct, setFinalProduct] = useState<string>('Mô hình xe ô tô 4 bánh chạy đà từ vỏ hộp sữa và nắp chai nhựa');
  const [pblMaterials, setPblMaterials] = useState<string>('Vỏ hộp sữa, nắp chai nhựa, que gỗ, ống hút, băng dính, màu vẽ');

  const [loading, setLoading] = useState(false);
  const [generatedLesson, setGeneratedLesson] = useState<AILessonPlan | null>(null);
  const [canvasTab, setCanvasTab] = useState<'PLAN' | 'SLIDES'>('PLAN');

  const [copiedAnnouncement, setCopiedAnnouncement] = useState(false);
  const [announcementSent, setAnnouncementSent] = useState(false);

  // Retrieve current dynamic framework from curriculum_frameworks preprocessed DB
  const currentFramework = getFrameworkByGradeAndTheme(gradeLevel, themeCode);
  const currentSubThemes = SUB_THEME_MAP[themeCode] || [];

  // Update sub-theme when theme changes
  const handleThemeChange = (newTheme: ThemeCode) => {
    setThemeCode(newTheme);
    const subList = SUB_THEME_MAP[newTheme] || [];
    setSubTheme(subList[0] || '');
  };

  // Generate AI Lesson / Project Handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (teachingType === 'TRADITIONAL') {
        const lesson = await generateAILessonPlan({
          topic,
          subject,
          grade_level: gradeLevel,
          theme_code: themeCode,
          target_objectives: targetObjectives,
          materials_needed: materialsNeeded,
        });
        setGeneratedLesson(lesson);
      } else {
        const projectLesson = await generateAILearningProject({
          projectName,
          gradeLevel,
          themeCode,
          durationWeeks: 1,
          finalProduct,
          materialsNeeded: pblMaterials,
        });
        setGeneratedLesson(projectLesson);
      }
    } catch (err) {
      console.error('Lỗi khi sinh bài giảng AI:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export PPTX Handler
  const handleExportPPTX = async () => {
    if (!generatedLesson) return;
    await exportToPowerPoint(generatedLesson);
  };

  // Copy Parent Announcement Handler
  const handleCopyAnnouncement = () => {
    if (!generatedLesson?.parent_announcement) return;
    navigator.clipboard.writeText(generatedLesson.parent_announcement);
    setCopiedAnnouncement(true);
    setTimeout(() => setCopiedAnnouncement(false), 2000);
  };

  // Send Parent Announcement to Parent PWA App
  const handleSendToParentApp = () => {
    setAnnouncementSent(true);
    setTimeout(() => setAnnouncementSent(false), 3000);
  };

  // Printable Word / PDF Handler
  const handleExportWord = () => {
    if (!generatedLesson) return;
    const activeTheme = (generatedLesson as any)?.theme_code || generatedLesson.schema_response?.theme_code || themeCode || 'THUC_VAT';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${generatedLesson.teaching_type === 'PROJECT_BASED' ? 'DỰ ÁN HỌC TẬP PBL' : 'KẾ HOẠCH BÀI DẠY'} - ${generatedLesson.topic}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.6; }
              h1 { color: #0369a1; text-align: center; }
              h2 { color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 20px; }
              .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
              .step { margin-bottom: 15px; padding: 10px; background: #fff; border-left: 4px solid #0284c7; }
              .announcement { background: #f0fdf4; border: 1px solid #86efac; padding: 15px; border-radius: 8px; }
              .slides-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
              .slide-card { border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; background: #fff; page-break-inside: avoid; }
              .slide-img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-top: 8px; }
            </style>
          </head>
          <body>
            <h1>${generatedLesson.teaching_type === 'PROJECT_BASED' ? 'KẾ HOẠCH DỰ ÁN HỌC TẬP STEAM (PBL)' : 'KẾ HOẠCH BÀI DẠY MẦM NON'}</h1>
            <div class="box">
              <p><strong>Tên chủ đề / Dự án:</strong> ${generatedLesson.topic}</p>
              <p><strong>Khối lớp:</strong> ${GRADE_LEVEL_MAP[gradeLevel].label} | <strong>Thời lượng:</strong> ${generatedLesson.duration_minutes} phút</p>
              <p><strong>Mục tiêu:</strong> ${generatedLesson.target_objectives}</p>
              <p><strong>Đồ dùng học liệu:</strong> ${generatedLesson.materials_needed.join(', ')}</p>
            </div>
            <h2>CẤU TRÚC BÀI GIẢNG</h2>
            ${generatedLesson.five_steps.map(s => `
              <div class="step">
                <h3>${s.step_title}</h3>
                <p><strong>Hoạt động của cô:</strong> ${s.teacher_action}</p>
                <p><strong>Hoạt động của trẻ:</strong> ${s.child_activity}</p>
              </div>
            `).join('')}

            ${generatedLesson.slides && generatedLesson.slides.length > 0 ? `
              <h2>HÌNH ẢNH MINH HỌA & SLIDE TRÌNH CHIẾU SMARTTV</h2>
              <div class="slides-grid">
                ${generatedLesson.slides.map(s => `
                  <div class="slide-card">
                    <h3 style="margin: 0; color: #0369a1; font-size: 14px;">SLIDE ${s.slide_number}: ${s.title}</h3>
                    <img 
                      src="${s.image_url || getFallbackPreschoolImage(s.slide_number, activeTheme)}" 
                      class="slide-img"
                      onerror="this.onerror=null; this.src='${getFallbackPreschoolImage(s.slide_number, activeTheme)}';"
                    />
                    <ul style="font-size: 12px; margin-top: 8px; padding-left: 18px; color: #334155;">
                      ${s.content_points.map(pt => `<li>${pt}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${generatedLesson.parent_announcement ? `
              <h2>THƯ NGỎ GỬI PHỤ HUYNH ĐỒNG HÀNH</h2>
              <div class="announcement">
                <pre style="white-space: pre-wrap; font-family: inherit;">${generatedLesson.parent_announcement}</pre>
              </div>
            ` : ''}

            <script>
              window.onload = function() {
                var imgs = Array.from(document.images);
                if (imgs.length === 0) {
                  window.print();
                  return;
                }
                var promises = imgs.map(function(img) {
                  if (img.complete) return Promise.resolve();
                  return new Promise(function(resolve) {
                    img.onload = resolve;
                    img.onerror = resolve;
                  });
                });
                Promise.all(promises).then(function() {
                  setTimeout(function() {
                    window.print();
                  }, 300);
                });
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Download Word (.doc) File Handler
  const handleDownloadWordDoc = () => {
    if (!generatedLesson) return;
    const activeTheme = (generatedLesson as any)?.theme_code || generatedLesson.schema_response?.theme_code || themeCode || 'THUC_VAT';
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>${generatedLesson.teaching_type === 'PROJECT_BASED' ? 'DỰ ÁN HỌC TẬP PBL' : 'KẾ HOẠCH BÀI DẠY'} - ${generatedLesson.topic}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.6; }
            h1 { color: #0369a1; text-align: center; font-size: 20pt; }
            h2 { color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 20px; font-size: 14pt; }
            .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
            .step { margin-bottom: 15px; padding: 10px; background: #fff; border-left: 4px solid #0284c7; }
            .announcement { background: #f0fdf4; border: 1px solid #86efac; padding: 15px; border-radius: 8px; }
            .slides-grid { margin-top: 15px; }
            .slide-card { border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; background: #fff; margin-bottom: 15px; }
            .slide-img { width: 100%; max-width: 400px; height: auto; border-radius: 6px; margin-top: 8px; }
          </style>
        </head>
        <body>
          <h1>${generatedLesson.teaching_type === 'PROJECT_BASED' ? 'KẾ HOẠCH DỰ ÁN HỌC TẬP STEAM (PBL)' : 'KẾ HOẠCH BÀI DẠY MẦM NON'}</h1>
          <div class="box">
            <p><strong>Tên chủ đề / Dự án:</strong> ${generatedLesson.topic}</p>
            <p><strong>Khối lớp:</strong> ${GRADE_LEVEL_MAP[gradeLevel].label} | <strong>Thời lượng:</strong> ${generatedLesson.duration_minutes} phút</p>
            <p><strong>Mục tiêu:</strong> ${generatedLesson.target_objectives}</p>
            <p><strong>Đồ dùng học liệu:</strong> ${generatedLesson.materials_needed.join(', ')}</p>
          </div>
          <h2>CẤU TRÚC BÀI GIẢNG</h2>
          ${generatedLesson.five_steps.map(s => `
            <div class="step">
              <h3>${s.step_title}</h3>
              <p><strong>Hoạt động của cô:</strong> ${s.teacher_action}</p>
              <p><strong>Hoạt động của trẻ:</strong> ${s.child_activity}</p>
            </div>
          `).join('')}

          ${generatedLesson.slides && generatedLesson.slides.length > 0 ? `
            <h2>HÌNH ẢNH MINH HỌA & SLIDE TRÌNH CHIẾU SMARTTV</h2>
            <div class="slides-grid">
              ${generatedLesson.slides.map(s => `
                <div class="slide-card">
                  <h3 style="margin: 0; color: #0369a1; font-size: 14px;">SLIDE ${s.slide_number}: ${s.title}</h3>
                  <img src="${s.image_url || getFallbackPreschoolImage(s.slide_number, activeTheme)}" class="slide-img" />
                  <ul style="font-size: 12px; margin-top: 8px; padding-left: 18px; color: #334155;">
                    ${s.content_points.map(pt => `<li>${pt}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${generatedLesson.parent_announcement ? `
            <h2>THƯ NGỎ GỬI PHỤ HUYNH ĐỒNG HÀNH</h2>
            <div class="announcement">
              <pre style="white-space: pre-wrap; font-family: inherit;">${generatedLesson.parent_announcement}</pre>
            </div>
          ` : ''}
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + content], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ke_hoach_bai_day_${generatedLesson.topic.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header: Clean & Standard Compliant Title */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-sky-700 rounded-pill text-white hover:bg-sky-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Soạn bài giảng tương tác AI</h1>
            <p className="text-xs text-sky-100 font-semibold">Tự động ghép khung chương trình, vẽ tranh minh họa & xuất slide trình chiếu</p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      {/* Main Workspace Split-Screen Container (Left 35%, Right 65%) */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: 35% Width (Form Controls) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 1. Teaching Mode Switcher (Bài học chuẩn vs Dự án PBL) */}
          <div className="bg-white border border-slate-200 rounded-convent p-3.5 shadow-sm space-y-2">
            <label className="block font-bold text-sky-900 text-xs uppercase tracking-wider">Hình thức giảng dạy (*)</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setTeachingType('TRADITIONAL')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  teachingType === 'TRADITIONAL'
                    ? 'bg-sky-50 border-sky-500 text-sky-950 font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${teachingType === 'TRADITIONAL' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Bài học chuẩn (Truyền thống)</h4>
                  <span className="text-[10px] text-slate-500 font-normal">Soạn 1 tiết học theo lịch báo giảng</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTeachingType('PROJECT_BASED')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  teachingType === 'PROJECT_BASED'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${teachingType === 'PROJECT_BASED' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Rocket className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Dạy học theo dự án (PBL)</h4>
                  <span className="text-[10px] text-slate-500 font-normal">Chuỗi hoạt động STEAM tạo sản phẩm</span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Form Controls */}
          <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Khối lớp (*)</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevelCode)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
              >
                <option value="NHA_TRE">Nhà Trẻ (12-36 tháng) • 12-15 phút</option>
                <option value="MAM">Mầm (3-4 tuổi) • 15-20 phút</option>
                <option value="CHOI">Chồi (4-5 tuổi) • 20-25 phút</option>
                <option value="LA">Lá (5-6 tuổi) • 25-30 phút</option>
              </select>
            </div>

            {/* Dropdown Chủ đề lớn & Chủ đề nhánh theo Lịch báo giảng */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Chủ đề lớn (*)</label>
              <select
                value={themeCode}
                onChange={(e) => handleThemeChange(e.target.value as ThemeCode)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
              >
                {Object.entries(THEME_NAME_MAP).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Chủ đề nhánh (*)</label>
              <select
                value={subTheme}
                onChange={(e) => setSubTheme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
              >
                {currentSubThemes.map((st, idx) => (
                  <option key={idx} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Môn học / Lĩnh vực (*)</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
              >
                <option value="KPKH">Khám phá khoa học (KPKH)</option>
                <option value="LQVT">Làm quen với toán (LQVT)</option>
                <option value="LQCC">Làm quen chữ cái (LQCC)</option>
                <option value="LQVH">Làm quen văn học / Kể chuyện (LQVH)</option>
                <option value="TAO_HINH">Tạo hình & Khéo tay (TẠO HÌNH)</option>
                <option value="LQAN">Giáo dục âm nhạc (LQÂN)</option>
                <option value="PTVĐ">Phát triển vận động (PTVĐ)</option>
                <option value="NBTN">Nhận biết tập nói (NBTN)</option>
                <option value="HDVDV">Hoạt động với đồ vật (HĐVĐV)</option>
              </select>
            </div>

            {/* Dynamic Inputs based on Teaching Type */}
            {teachingType === 'TRADITIONAL' ? (
              <>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đề tài bài dạy (*)</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="VD: Khám phá sự phát triển của cây xanh..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Học liệu & Đồ dùng chuẩn bị</label>
                  <input
                    type="text"
                    value={materialsNeeded}
                    onChange={(e) => setMaterialsNeeded(e.target.value)}
                    placeholder="VD: Bông gòn, hạt giống, cốc nhựa, nước sạch..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />

                  {/* Smart Material Suggestion Tags from Dynamic Material Engine */}
                  {(() => {
                    const dynamicSuggestion = getDynamicMaterialSuggestions(subject, topic, gradeLevel);
                    const tags = dynamicSuggestion.allTags;
                    if (tags.length === 0) return null;

                    return (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-sky-900 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Gợi ý học liệu chuẩn theo môn & đề tài (bấm chọn nhanh):
                          </span>
                          <button
                            type="button"
                            onClick={() => setMaterialsNeeded(tags.join(', '))}
                            className="text-[10px] font-bold text-sky-600 hover:text-sky-800 underline"
                          >
                            Áp dụng tất cả
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((mat, idx) => {
                            const isSelected = materialsNeeded.toLowerCase().includes(mat.toLowerCase());
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    const updated = materialsNeeded
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter((s) => s.toLowerCase() !== mat.toLowerCase() && s.length > 0)
                                      .join(', ');
                                    setMaterialsNeeded(updated);
                                  } else {
                                    const trimmed = materialsNeeded.trim();
                                    const updated = trimmed ? `${trimmed}, ${mat}` : mat;
                                    setMaterialsNeeded(updated);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-pill text-[11px] font-medium border transition-all ${
                                  isSelected
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                                }`}
                              >
                                {isSelected ? `✓ ${mat}` : `+ ${mat}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tên Dự án Học tập STEAM (*)</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="VD: Dự án Chế tạo Xe Ô tô Đồ chơi Tải nặng..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Sản phẩm đầu ra dự án (*)</label>
                  <input
                    type="text"
                    value={finalProduct}
                    onChange={(e) => setFinalProduct(e.target.value)}
                    placeholder="VD: Mô hình xe ô tô 4 bánh chạy đà..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-pill shadow-md transition-all active:scale-95 ${
                teachingType === 'PROJECT_BASED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI đang phân tích Khung DB & Soạn bài...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Tạo bài giảng AI đa phương tiện</span>
                </>
              )}
            </button>
          </form>

          {/* Preprocessed Guidelines Card */}
          {currentFramework && (
            <div className="bg-sky-50/80 border border-sky-200 rounded-convent p-3.5 text-xs space-y-1.5">
              <span className="font-bold text-sky-950 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                Mục tiêu S-T-E-A-M bóc tách từ DB:
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {currentFramework.pedagogical_guidelines?.steam_objectives?.science}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 65% Width (Preview Canvas Workspace with 2 Tabs) */}
        <div className="lg:col-span-8 space-y-5">
          {generatedLesson ? (
            <div className="space-y-4">
              
              {/* Top Action Bar & Canvas Tab Switcher */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-convent shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                
                {/* 2 Preview Tabs */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setCanvasTab('PLAN')}
                    className={`px-4 py-2 rounded-pill font-bold text-xs border transition-all flex items-center gap-2 ${
                      canvasTab === 'PLAN'
                        ? 'bg-sky-600 text-white border-sky-600 shadow'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Tab 1: Kế hoạch bài dạy</span>
                  </button>

                  <button
                    onClick={() => setCanvasTab('SLIDES')}
                    className={`px-4 py-2 rounded-pill font-bold text-xs border transition-all flex items-center gap-2 ${
                      canvasTab === 'SLIDES'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    <span>Tab 2: Slide trình chiếu TV</span>
                  </button>
                </div>

                {/* Triple Export Buttons */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleDownloadWordDoc}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-3 py-2 rounded-pill text-xs border border-blue-200 transition-all active:scale-95 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Tải file Word (.doc)</span>
                  </button>

                  <button
                    onClick={handleExportWord}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-pill text-xs border border-slate-300 transition-all active:scale-95 shadow-sm"
                  >
                    <Printer className="w-4 h-4 text-sky-600" />
                    <span>In / PDF</span>
                  </button>

                  <button
                    onClick={handleExportPPTX}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-pill text-xs shadow transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải PowerPoint (.pptx)</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: KẾ HOẠCH BÀI DẠY (FULL TEXT + MINDMAP MERMAID) */}
              {canvasTab === 'PLAN' && (
                <div className="space-y-4">
                  {/* PBL Project STEAM Grid (If Project Based) */}
                  {generatedLesson.teaching_type === 'PROJECT_BASED' && generatedLesson.learning_project && (
                    <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-3 text-xs">
                      <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-emerald-600" />
                        <span>Bảng phân tích 5 trụ cột S-T-E-A-M của Dự án</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                        <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl">
                          <strong className="text-sky-900 block font-bold mb-1">S (Science)</strong>
                          <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.science}</p>
                        </div>
                        <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                          <strong className="text-indigo-900 block font-bold mb-1">T (Technology)</strong>
                          <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.technology}</p>
                        </div>
                        <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                          <strong className="text-purple-900 block font-bold mb-1">E (Engineering)</strong>
                          <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.engineering}</p>
                        </div>
                        <div className="p-2.5 bg-pink-50 border border-pink-200 rounded-xl">
                          <strong className="text-pink-900 block font-bold mb-1">A (Art)</strong>
                          <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.art}</p>
                        </div>
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <strong className="text-amber-900 block font-bold mb-1">M (Math)</strong>
                          <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.math}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5-Step / 5-Day Pedagogy Content */}
                  <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-4 text-xs">
                    <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <BookOpen className="w-4 h-4 text-sky-600" />
                      <span>{generatedLesson.teaching_type === 'PROJECT_BASED' ? 'Lộ trình 5 ngày thực hiện Dự án (Mô hình 5E STEAM)' : 'Cấu trúc tiến trình dạy học'}</span>
                    </h3>

                    <div className="space-y-3">
                      {generatedLesson.five_steps.map((step) => (
                        <div key={step.step_number} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <h4 className="font-bold text-slate-900 text-sm">{step.step_title}</h4>
                          <p className="text-slate-600">{step.description}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-800">
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                              <strong className="text-sky-800 block text-[11px]">Hoạt động của Cô:</strong>
                              <p>{step.teacher_action}</p>
                            </div>
                            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                              <strong className="text-emerald-800 block text-[11px]">Hoạt động của Trẻ:</strong>
                              <p>{step.child_activity}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mermaid Mindmap Code */}
                  <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-3 text-xs">
                    <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>Sơ đồ tư duy trực quan (Mermaid.js Mindmap)</span>
                    </h3>
                    <div className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre">
                      {generatedLesson.mermaid_mindmap_code}
                    </div>
                  </div>

                  {/* Afternoon Activity Section (HĐC) */}
                  {generatedLesson.afternoon_activity && (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-convent p-4 space-y-2 shadow-sm text-xs">
                      <span className="font-bold text-amber-950 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        IV. Hoạt động chiều (HĐC)
                      </span>
                      <h4 className="font-bold text-amber-900 text-sm">{generatedLesson.afternoon_activity.name}</h4>
                      <p className="text-amber-950 leading-relaxed">{generatedLesson.afternoon_activity.instruction}</p>
                    </div>
                  )}

                  {/* Parent Announcement Card (If PBL) */}
                  {generatedLesson.parent_announcement && (
                    <div className="bg-emerald-50/90 border border-emerald-300 rounded-convent p-4 space-y-3 shadow-sm text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                        <span className="font-bold text-emerald-950 flex items-center gap-2">
                          <Send className="w-4 h-4 text-emerald-700" />
                          Thư ngỏ gửi Phụ huynh đồng hành (Parent App PWA)
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyAnnouncement}
                            className="px-3 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-pill font-bold text-emerald-800 text-[11px] flex items-center gap-1 transition-all"
                          >
                            {copiedAnnouncement ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedAnnouncement ? 'Đã copy' : 'Sao chép'}</span>
                          </button>

                          <button
                            onClick={handleSendToParentApp}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-pill font-bold text-[11px] flex items-center gap-1 shadow transition-all active:scale-95"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Gửi sang Parent App</span>
                          </button>
                        </div>
                      </div>

                      {announcementSent && (
                        <div className="p-2.5 bg-emerald-100 border border-emerald-400 rounded-xl text-emerald-900 font-bold text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>Đã gửi Thư ngỏ thông báo dự án thành công sang Ứng dụng Phụ huynh PWA!</span>
                        </div>
                      )}

                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-slate-800 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                        {generatedLesson.parent_announcement}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SLIDE TRÌNH CHIẾU TV (RULES.PDF PRESCHOOL SMARTTV DESIGN SYSTEM) */}
              {canvasTab === 'SLIDES' && (
                <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-6 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                      <Tv className="w-5 h-5 text-emerald-600" />
                      <span>Xem trước Slide trình chiếu TV SmartTV mầm non (Chuẩn Rules.pdf: 16:9 HD, Pastel Dịu Mắt, Card Bo Tròn, Layout Linh Hoạt)</span>
                    </h3>
                  </div>

                  <div className="space-y-8">
                    {generatedLesson.slides.map((slide) => {
                      const layout = slide.layout_type || 'COVER';
                      const rawTheme = generatedLesson.schema_response?.theme_code || (generatedLesson as any).theme_code || themeCode || 'THUC_VAT';
                      const activeTheme = autoDetectThemeCode(generatedLesson.topic, rawTheme as any);
                      const tm = getThemeMatrix(activeTheme as any);

                      return (
                          <div key={slide.slide_number} className="border-2 border-slate-300 rounded-3xl overflow-hidden shadow-xl bg-slate-50 font-sans">
                            {/* Slide Indicator Bar */}
                            <div className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between font-bold text-xs">
                              <span className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                SLIDE {slide.slide_number} • {layout} LAYOUT • [{tm.defaultIcon} {tm.themeName}]
                              </span>
                              <span className="font-mono text-[11px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                                Rules.pdf Compliant
                              </span>
                            </div>

                            {/* SLIDE CONTENT AREA (Tỷ lệ 16:9 Presentation View) */}
                            <div className="p-6 sm:p-8 min-h-[420px] flex flex-col justify-center">

                              {/* 1. COVER LAYOUT */}
                              {layout === 'COVER' && (
                                <div style={{ backgroundColor: tm.backgroundColor }} className="border-2 border-slate-200 rounded-2xl p-8 text-center space-y-6 flex flex-col items-center justify-center">
                                  <span style={{ color: tm.primaryColor }} className="inline-block bg-white font-bold px-4 py-1.5 rounded-full text-xs sm:text-sm border border-slate-200 shadow-sm">
                                    {slide.header_tag || '🎓 TRƯỜNG MẦM NON SƯƠNG MAI'}
                                  </span>
                                  <h2 style={{ color: tm.primaryColor }} className="text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-3xl">
                                    {slide.title}
                                  </h2>
                                  <p className="text-slate-600 font-medium text-sm sm:text-base max-w-xl">
                                    {slide.subtitle}
                                  </p>
                                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                    {(slide.pill_badges || []).map((badge, bIdx) => (
                                      <span key={bIdx} style={{ color: tm.primaryColor }} className="bg-white border border-slate-300 font-bold px-4 py-2 rounded-full text-xs sm:text-sm shadow-sm">
                                        {badge}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 2. DARK HERO LAYOUT */}
                              {layout === 'DARK_HERO' && (
                                <div style={{ backgroundColor: tm.primaryColor }} className="rounded-2xl p-10 text-center space-y-6 flex flex-col items-center justify-center text-white">
                                  <span className="inline-block bg-white/20 text-white font-bold px-4 py-1.5 rounded-full text-xs sm:text-sm border border-white/30">
                                    {slide.pill_badges?.[0] || '🧭 BƯỚC 1: GẮN KẾT & KHÁM PHÁ'}
                                  </span>
                                  <h2 style={{ color: tm.accentColor }} className="text-3xl sm:text-5xl font-black tracking-wide leading-tight max-w-3xl">
                                    {slide.title}
                                  </h2>
                                  <p className="text-slate-100 font-medium text-base sm:text-lg max-w-2xl leading-relaxed">
                                    {slide.subtitle}
                                  </p>
                                </div>
                              )}

                            {/* 3. GRID 4 CARDS LAYOUT */}
                            {layout === 'GRID_4_CARDS' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-6">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E] flex items-center gap-2">
                                  {slide.title}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {(slide.cards_data || []).map((card, cIdx) => (
                                    <div key={cIdx} className="bg-white border border-emerald-200 rounded-2xl p-5 text-center space-y-3 shadow-sm flex flex-col items-center justify-between">
                                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl">
                                        {card.icon || '🌱'}
                                      </div>
                                      <h4 className="font-bold text-[#13542E] text-base sm:text-lg">{card.title}</h4>
                                      <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{card.desc}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 4. TIMELINE 4 STEPS LAYOUT */}
                            {layout === 'TIMELINE_4_STEPS' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-6">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E] flex items-center gap-2">
                                  {slide.title}
                                </h3>
                                <div className="relative pt-4">
                                  {/* Connector Line */}
                                  <div className="hidden sm:block absolute top-1/2 left-0 w-full h-1.5 bg-emerald-300 -translate-y-1/2 z-0" />
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative z-10">
                                    {(slide.steps_data || []).map((step, sIdx) => (
                                      <div key={sIdx} className="bg-white border border-emerald-200 rounded-2xl p-4 text-center space-y-2 shadow-md">
                                        <div className="w-8 h-8 bg-emerald-600 text-white font-bold rounded-full flex items-center justify-center mx-auto text-xs">
                                          {step.step_num || sIdx + 1}
                                        </div>
                                        <h4 className="font-bold text-[#13542E] text-sm sm:text-base">{step.title}</h4>
                                        <p className="text-slate-600 text-xs leading-relaxed">{step.desc}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 5. IMAGE CARDS 3 LAYOUT */}
                            {layout === 'IMAGE_CARDS_3' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-6">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E] flex items-center gap-2">
                                  {slide.title}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  {(slide.cards_data || []).map((card, cIdx) => (
                                    <div key={cIdx} className="bg-white border border-emerald-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                                      <img 
                                        src={card.image_url || getFallbackPreschoolImage(cIdx, activeTheme)} 
                                        alt={card.title} 
                                        className="w-full h-40 object-cover"
                                        onError={(e) => { e.currentTarget.src = getFallbackPreschoolImage(cIdx, activeTheme); }}
                                      />
                                      <div className="p-4 text-center space-y-2 flex-1 flex flex-col justify-between">
                                        <h4 className="font-bold text-[#13542E] text-base">{card.title}</h4>
                                        <p className="text-slate-600 text-xs leading-relaxed">{card.desc}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 6. TWO COLUMN CARDS LAYOUT */}
                            {layout === 'TWO_COLUMN_CARDS' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-6">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E] flex items-center gap-2">
                                  {slide.title}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {(slide.cards_data || []).map((card, cIdx) => (
                                    <div key={cIdx} className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-3 shadow-sm">
                                      <h4 className="font-bold text-[#13542E] text-lg flex items-center gap-2 border-b border-emerald-100 pb-2">
                                        <span>{card.icon || '🌲'}</span>
                                        <span>{card.title}</span>
                                      </h4>
                                      <p className="text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                                        {card.desc}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 7. LIST ACCENT IMAGE LAYOUT */}
                            {layout === 'LIST_ACCENT_IMAGE' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-6">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E] flex items-center gap-2">
                                  {slide.title}
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                  <div className="lg:col-span-7 space-y-3">
                                    {(slide.content_points || []).map((pt, pIdx) => (
                                      <div key={pIdx} className="bg-white border-l-4 border-l-emerald-600 border border-slate-200 rounded-r-xl p-3.5 text-slate-800 font-medium text-xs sm:text-sm shadow-sm">
                                        {pt}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="lg:col-span-5 flex justify-center">
                                    <img 
                                      src={slide.image_url || getFallbackPreschoolImage(7, activeTheme)} 
                                      alt={slide.title}
                                      className="rounded-2xl border-4 border-white shadow-lg w-full max-w-xs h-64 object-cover"
                                      onError={(e) => { e.currentTarget.src = getFallbackPreschoolImage(7, activeTheme); }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 8. NUMBERED STEPS LAYOUT */}
                            {layout === 'NUMBERED_STEPS' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-5">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E]">
                                  {slide.title}
                                </h3>
                                <div className="space-y-3">
                                  {(slide.steps_data || []).map((step, sIdx) => (
                                    <div key={sIdx} className="bg-white border border-emerald-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                                      <span className="w-10 h-10 bg-emerald-600 text-white font-black text-lg rounded-xl flex items-center justify-center shrink-0">
                                        {step.step_num || sIdx + 1}
                                      </span>
                                      <div>
                                        <h4 className="font-bold text-[#13542E] text-sm sm:text-base">{step.title}</h4>
                                        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {slide.subtitle && (
                                  <div className="bg-white border border-emerald-300 rounded-2xl p-3.5 text-center font-bold text-emerald-800 text-xs sm:text-sm shadow-sm">
                                    {slide.subtitle}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 9. SPLIT STORY IMAGE LAYOUT */}
                            {layout === 'SPLIT_STORY_IMAGE' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                <div className="lg:col-span-6 space-y-4">
                                  <h3 className="text-2xl sm:text-3xl font-black text-[#13542E]">
                                    {slide.title}
                                  </h3>
                                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                                    {slide.subtitle}
                                  </p>
                                </div>
                                <div className="lg:col-span-6 flex justify-center">
                                  <img 
                                    src={slide.image_url || getFallbackPreschoolImage(9, activeTheme)} 
                                    alt={slide.title}
                                    className="rounded-2xl border-4 border-white shadow-xl w-full h-72 object-cover"
                                    onError={(e) => { e.currentTarget.src = getFallbackPreschoolImage(9, activeTheme); }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* 10. STAT CALLOUT LAYOUT */}
                            {layout === 'STAT_CALLOUT' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-6">
                                <h3 className="text-xl sm:text-2xl font-black text-[#13542E]">
                                  {slide.title}
                                </h3>
                                <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center shadow-md">
                                  <div className="sm:col-span-4 bg-emerald-100 rounded-2xl p-6 text-center space-y-2">
                                    <span className="block text-4xl sm:text-6xl font-black text-[#13542E]">
                                      {slide.stat_highlight?.number || '100%'}
                                    </span>
                                    <span className="font-bold text-emerald-800 text-sm">
                                      {slide.stat_highlight?.label || 'Bé Yêu Cây Xanh'}
                                    </span>
                                  </div>
                                  <div className="sm:col-span-8 space-y-3">
                                    <h4 className="text-xl font-bold text-[#13542E]">
                                      {slide.stat_highlight?.hero_title || 'Bé Là Hiệp Sĩ Bảo Vệ Mầm Xanh'}
                                    </h4>
                                    <p className="text-slate-700 text-xs sm:text-sm leading-relaxed">
                                      {slide.stat_highlight?.hero_desc}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 11. HERO OVERLAY LAYOUT */}
                            {layout === 'HERO_OVERLAY' && (
                              <div className="relative rounded-2xl overflow-hidden min-h-[320px] flex items-center justify-center p-6 bg-slate-800">
                                <img 
                                  src={slide.image_url || getFallbackPreschoolImage(11, activeTheme)} 
                                  alt={slide.title} 
                                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                                  onError={(e) => { e.currentTarget.src = getFallbackPreschoolImage(11, activeTheme); }}
                                />
                                <div className="relative z-10 bg-white/95 backdrop-blur border border-white rounded-2xl p-8 text-center max-w-2xl space-y-4 shadow-2xl">
                                  <h3 className="text-2xl sm:text-3xl font-black text-[#13542E]">
                                    {slide.title}
                                  </h3>
                                  <p className="text-slate-800 font-medium text-sm sm:text-base leading-relaxed">
                                    {slide.subtitle}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* 12. OUTRO PRAISE LAYOUT */}
                            {layout === 'OUTRO_PRAISE' && (
                              <div className="bg-[#FEF9C3] border-2 border-amber-300 rounded-2xl p-8 text-center space-y-6 flex flex-col items-center justify-center">
                                <h2 className="text-3xl sm:text-5xl font-black text-[#13542E]">
                                  {slide.title}
                                </h2>
                                <p className="text-slate-700 font-medium text-base sm:text-lg max-w-xl">
                                  {slide.subtitle}
                                </p>
                                {slide.pill_badges?.[0] && (
                                  <div className="bg-white border-2 border-amber-400 text-amber-900 font-black px-6 py-3 rounded-full text-sm sm:text-lg shadow-md">
                                    {slide.pill_badges[0]}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 13. IMAGE SOURCES LAYOUT */}
                            {layout === 'IMAGE_SOURCES' && (
                              <div className="bg-[#F4FBF7] border border-emerald-100 rounded-2xl p-6 space-y-4">
                                <h3 className="text-xl font-bold text-[#13542E]">
                                  {slide.title}
                                </h3>
                                <div className="space-y-3">
                                  {(slide.image_sources || []).map((src, sIdx) => (
                                    <div key={sIdx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                                      <span className="truncate text-slate-700 font-mono text-[11px] max-w-md">{src.url}</span>
                                      <span className="text-indigo-600 font-bold shrink-0">{src.source}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-convent p-12 text-center text-slate-400 space-y-3 shadow-sm min-h-[400px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-convent flex items-center justify-center border border-sky-200">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Canvas Xem Trước Bài Giảng AI</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Vui lòng chọn Khối lớp, Chủ đề và bấm nút <strong className="text-sky-700">&quot;Tạo bài giảng AI đa phương tiện&quot;</strong> ở cột bên trái để xem kết quả trực quan tại đây.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
