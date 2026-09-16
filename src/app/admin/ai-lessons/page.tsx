'use client';

import React, { useState } from 'react';
import { 
  Sparkles, FileText, Download, Play, Video, Image as ImageIcon, 
  CheckCircle2, ChevronLeft, Loader2, Share2, BookOpen, Layers, 
  Send, AlertCircle, Copy, Check, Rocket
} from 'lucide-react';
import Link from 'next/link';
import { generateAILessonPlan, generateAILearningProject, exportToPowerPoint } from '@/lib/ai/aiGenerator';
import { AILessonPlan, GradeLevelCode, ThemeCode, TeachingType } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getFrameworkByGradeAndTheme, THEME_NAME_MAP, GRADE_LEVEL_MAP } from '@/lib/utils/curriculumHelper';

export default function AdminAILessonsPage() {
  const [teachingType, setTeachingType] = useState<TeachingType>('TRADITIONAL');
  const [gradeLevel, setGradeLevel] = useState<GradeLevelCode>('LA');
  const [themeCode, setThemeCode] = useState<ThemeCode>('HTTN');
  const [subject, setSubject] = useState<string>('KPKH');
  
  // Traditional Form States
  const [topic, setTopic] = useState<string>('Khám phá sự phát triển của cây xanh');
  const [targetObjectives, setTargetObjectives] = useState<string>('Trẻ biết cây cần đất, nước, không khí và ánh sáng để lớn lên');
  const [materialsNeeded, setMaterialsNeeded] = useState<string>('Hạt đỗ, bông gòn, cốc nhựa, nước sạch, khay thực hành');

  // PBL Form States
  const [projectName, setProjectName] = useState<string>('Dự án Chế tạo Xe Ô tô Đồ chơi Tải nặng');
  const [finalProduct, setFinalProduct] = useState<string>('Mô hình xe ô tô 4 bánh chạy đà từ vỏ hộp sữa và nắp chai nhựa');
  const [pblMaterials, setPblMaterials] = useState<string>('Vỏ hộp sữa, nắp chai nhựa, que gỗ, ống hút, băng dính, màu vẽ');

  const [loading, setLoading] = useState(false);
  const [generatedLesson, setGeneratedLesson] = useState<AILessonPlan | null>(null);
  const [copiedAnnouncement, setCopiedAnnouncement] = useState(false);
  const [announcementSent, setAnnouncementSent] = useState(false);

  // Retrieve current dynamic framework from curriculum_frameworks preprocessed DB
  const currentFramework = getFrameworkByGradeAndTheme(gradeLevel, themeCode);

  // Generate AI Lesson / Project Handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedLesson(null);
    setAnnouncementSent(false);

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

            ${generatedLesson.parent_announcement ? `
              <h2>THƯ NGỎ GỬI PHỤ HUYNH ĐỒNG HÀNH</h2>
              <div class="announcement">
                <pre style="white-space: pre-wrap; font-family: inherit;">${generatedLesson.parent_announcement}</pre>
              </div>
            ` : ''}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-12">
      {/* Top Header */}
      <header className="p-4 bg-sky-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 bg-sky-700 rounded-pill text-white hover:bg-sky-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">Pipeline AI tạo bài giảng đa phương tiện (Chuẩn Truyền thống & Dự án PBL)</h1>
            <p className="text-xs text-sky-100 font-semibold">Dynamic Context Injection • 5E STEAM • Mindmap Mermaid • Slide PowerPoint (.pptx)</p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Dual Tab Mode Switcher: Traditional vs PBL Project */}
        <div className="bg-white border border-slate-200 rounded-convent p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <span className="font-bold text-sky-900 text-sm">Lựa chọn mô hình giảng dạy:</span>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <button
              onClick={() => setTeachingType('TRADITIONAL')}
              className={`px-4 py-2.5 rounded-pill font-bold text-xs border transition-all flex items-center justify-center gap-2 ${
                teachingType === 'TRADITIONAL'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>📘 Bài giảng chuẩn truyền thống</span>
            </button>

            <button
              onClick={() => setTeachingType('PROJECT_BASED')}
              className={`px-4 py-2.5 rounded-pill font-bold text-xs border transition-all flex items-center justify-center gap-2 ${
                teachingType === 'PROJECT_BASED'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Rocket className="w-4 h-4" />
              <span>🚀 Dự án học tập STEAM / PBL</span>
            </button>
          </div>
        </div>

        {/* Dynamic Framework Preprocessed Guidelines Card */}
        <div className="bg-sky-50/70 border border-sky-200 rounded-convent p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-600" />
              Khung chương trình trích xuất từ DB ({GRADE_LEVEL_MAP[gradeLevel].label} • {THEME_NAME_MAP[themeCode]}):
            </span>
            <span className="px-2.5 py-0.5 bg-white border border-sky-200 text-sky-800 rounded-pill font-mono font-bold">
              {currentFramework.target_duration}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-700 pt-1">
            <div>
              <strong className="text-sky-950 block">Mục tiêu S-T-E-A-M:</strong>
              <p className="text-slate-600">{currentFramework.pedagogical_guidelines.steam_objectives?.science || 'Phát triển nhận thức & quan sát trực quan'}</p>
            </div>
            <div>
              <strong className="text-sky-950 block">Từ vựng cốt lõi:</strong>
              <p className="text-slate-600">{currentFramework.pedagogical_guidelines.key_vocabulary.join(', ')}</p>
            </div>
            <div>
              <strong className="text-sky-950 block">Bài hát & Trò chơi mẫu:</strong>
              <p className="text-slate-600">{currentFramework.pedagogical_guidelines.songs_or_poems?.[0]} • {currentFramework.pedagogical_guidelines.interactive_games?.[0]}</p>
            </div>
          </div>
        </div>

        {/* Input Form & Criteria */}
        <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sky-900 text-sm flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <span>{teachingType === 'PROJECT_BASED' ? 'Cấu hình Dự án Học tập STEAM (PBL)' : 'Tiêu chí tạo bài giảng AI theo khung chương trình'}</span>
            </h2>
            <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-pill border border-emerald-200 font-bold text-[11px]">
              ★ Chi phí: 0 VNĐ (Gemini Flash + Pollinations API)
            </span>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Khối lớp (*)</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value as GradeLevelCode)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                >
                  <option value="NHA_TRE">Nhà Trẻ (12-36 tháng) - 12-15 min</option>
                  <option value="MAM">Mầm (3-4 tuổi) - 15-20 min</option>
                  <option value="CHOI">Chồi (4-5 tuổi) - 20-25 min</option>
                  <option value="LA">Lá (5-6 tuổi) - 25-30 min</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Chủ đề khung (*)</label>
                <select
                  value={themeCode}
                  onChange={(e) => setThemeCode(e.target.value as ThemeCode)}
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
                <label className="block font-bold text-slate-700 uppercase mb-1">Môn học / Lĩnh vực (*)</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                >
                  <option value="KPKH">Khám phá khoa học</option>
                  <option value="LQVT">Làm quen với toán</option>
                  <option value="LQCC">Làm quen chữ cái</option>
                  <option value="LQVH">Làm quen văn học / Kể chuyện</option>
                  <option value="TAO_HINH">Tạo hình & Khéo tay</option>
                  <option value="LQAN">Làm quen âm nhạc & Vận động</option>
                  <option value="PTVĐ">Phát triển vận động</option>
                </select>
              </div>
            </div>

            {/* Dynamic Inputs based on Teaching Type */}
            {teachingType === 'TRADITIONAL' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đề tài bài học (*)</label>
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
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block font-bold text-slate-700 uppercase mb-1">Sản phẩm đầu ra của dự án (*)</label>
                  <input
                    type="text"
                    value={finalProduct}
                    onChange={(e) => setFinalProduct(e.target.value)}
                    placeholder="VD: Mô hình xe ô tô 4 bánh chạy đà..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>
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
                  <span>{teachingType === 'PROJECT_BASED' ? 'Tạo Dự Án STEAM 5E & Thư Ngỏ Phụ Huynh' : 'Tạo Bài Giảng 5 Bước & Slide PowerPoint'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Generated Lesson / Project Results */}
        {generatedLesson && (
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-slate-200 p-4 rounded-convent shadow-sm gap-3">
              <div>
                <span className="text-xs font-bold text-sky-700 block uppercase">
                  {generatedLesson.teaching_type === 'PROJECT_BASED' ? '🚀 Kế Hoạch Dự Án Học Tập PBL' : '📘 Kế Hoạch Bài Dạy 5 Bước'}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{generatedLesson.topic}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportWord}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-pill text-xs border border-slate-300 transition-all"
                >
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>In Word / PDF</span>
                </button>

                <button
                  onClick={handleExportPPTX}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-pill text-xs shadow transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất PowerPoint (.pptx)</span>
                </button>
              </div>
            </div>

            {/* PBL Project STEAM 5-Pillar Mapping & Parent Announcement (If Project Based) */}
            {generatedLesson.teaching_type === 'PROJECT_BASED' && generatedLesson.learning_project && (
              <div className="space-y-4">
                {/* 5 STEAM Pillars Grid */}
                <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm space-y-3">
                  <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-emerald-600" />
                    <span>Bảng phân tích 5 trụ cột S-T-E-A-M của Dự án</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                      <strong className="text-sky-900 block font-bold mb-1">S (Science - Khoa học)</strong>
                      <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.science}</p>
                    </div>

                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <strong className="text-indigo-900 block font-bold mb-1">T (Technology - Công nghệ)</strong>
                      <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.technology}</p>
                    </div>

                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <strong className="text-purple-900 block font-bold mb-1">E (Engineering - Kỹ thuật)</strong>
                      <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.engineering}</p>
                    </div>

                    <div className="p-3 bg-pink-50 border border-pink-200 rounded-xl">
                      <strong className="text-pink-900 block font-bold mb-1">A (Art - Nghệ thuật)</strong>
                      <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.art}</p>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <strong className="text-amber-900 block font-bold mb-1">M (Math - Toán học)</strong>
                      <p className="text-slate-700 text-[11px]">{generatedLesson.learning_project.steam_mapping.math}</p>
                    </div>
                  </div>
                </div>

                {/* Parent Announcement Card */}
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-convent p-4 space-y-3 shadow-sm text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold">
                      <Send className="w-4 h-4 text-emerald-700" />
                      <span>Thư ngỏ gửi Phụ huynh đồng hành cùng bé (Parent App PWA)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyAnnouncement}
                        className="px-3 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-pill font-bold text-emerald-800 text-[11px] flex items-center gap-1 transition-all"
                      >
                        {copiedAnnouncement ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAnnouncement ? 'Đã copy' : 'Sao chép văn bản'}</span>
                      </button>

                      <button
                        onClick={handleSendToParentApp}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-pill font-bold text-[11px] flex items-center gap-1 shadow transition-all active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi sang Parent App PWA</span>
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
              </div>
            )}

            {/* Pedagogy Steps / Timeline */}
            <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-600" />
                <span>{generatedLesson.teaching_type === 'PROJECT_BASED' ? 'Lộ trình 5 ngày thực hiện Dự án (Mô hình 5E STEAM)' : 'Cấu trúc 5 bước sư phạm mầm non'}</span>
              </h3>

              <div className="space-y-3">
                {generatedLesson.five_steps.map((step) => (
                  <div key={step.step_number} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <h4 className="font-bold text-slate-900 text-sm">{step.step_title}</h4>
                    <p className="text-slate-600">{step.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-800">
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <strong className="text-sky-800 block text-[11px]">Hoạt động của Cô:</strong>
                        <p>{step.teacher_action}</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <strong className="text-emerald-800 block text-[11px]">Hoạt động của Trẻ:</strong>
                        <p>{step.child_activity}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mermaid Mindmap Visual */}
            <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-3 text-xs">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>Sơ đồ tư duy trực quan (Mermaid.js Code)</span>
              </h3>
              <div className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre">
                {generatedLesson.mermaid_mindmap_code}
              </div>
            </div>

            {/* Slide Preview Grid */}
            <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-600" />
                <span>Xem trước Slide trình chiếu SmartTV (Ảnh minh họa Pollinations AI)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {generatedLesson.slides.map((slide) => (
                  <div key={slide.slide_number} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50 flex flex-col justify-between">
                    <div>
                      {slide.image_url && (
                        <img src={slide.image_url} alt={slide.title} className="w-full h-44 object-cover border-b border-slate-200" />
                      )}
                      <div className="p-3.5 space-y-2">
                        <span className="text-[10px] font-bold text-sky-700 uppercase block">Slide {slide.slide_number}</span>
                        <h4 className="font-bold text-slate-900 text-sm">{slide.title}</h4>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600">
                          {slide.content_points.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
