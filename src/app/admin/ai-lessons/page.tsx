'use client';

import React, { useState } from 'react';
import { Sparkles, FileText, Download, Play, Video, Image as ImageIcon, CheckCircle2, ChevronLeft, Loader2, Share2, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { generateAILessonPlan, exportToPowerPoint } from '@/lib/ai/aiGenerator';
import { AILessonPlan } from '@/lib/types/schema';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function AdminAILessonsPage() {
  const [subject, setSubject] = useState<'TOÁN' | 'KHÁM_PHÁ' | 'ÂM_NHẠC' | 'TẠO_HÌNH' | 'VĂN_HỌC'>('KHÁM_PHÁ');
  const [gradeLevel, setGradeLevel] = useState<'MẦM' | 'CHỒI' | 'LÁ'>('LÁ');
  const [topic, setTopic] = useState<string>('Sự phát triển của hạt đỗ');
  const [targetObjectives, setTargetObjectives] = useState<string>('Trẻ biết sự phát triển của cây đỗ từ hạt mầm đến cây lớn');
  const [materialsNeeded, setMaterialsNeeded] = useState<string>('Thực hành gieo hạt với bông gòn, cốc nhựa, nước sạch');
  const [expansionIdeas, setExpansionIdeas] = useState<string>('Bé vẽ tranh quá trình nảy mầm');

  const [loading, setLoading] = useState(false);
  const [generatedLesson, setGeneratedLesson] = useState<AILessonPlan | null>(null);

  // Generate AI Lesson Handler (TC-AI-01, TC-AI-02, TC-AI-03)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const lesson = await generateAILessonPlan({
        topic,
        subject,
        grade_level: gradeLevel,
        target_objectives: targetObjectives,
        materials_needed: materialsNeeded,
        expansion_ideas: expansionIdeas,
      });

      setGeneratedLesson(lesson);
    } catch (err) {
      console.error('Lỗi khi sinh bài giảng AI:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export PPTX Handler (TC-AI-04)
  const handleExportPPTX = async () => {
    if (!generatedLesson) return;
    await exportToPowerPoint(generatedLesson);
  };

  // Printable Word / PDF Handler
  const handleExportWord = () => {
    if (!generatedLesson) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Kế Hoạch Bài Dạy - ${generatedLesson.topic}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.6; }
              h1 { color: #0369a1; text-align: center; }
              h2 { color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 20px; }
              .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
              .step { margin-bottom: 15px; padding: 10px; background: #fff; border-left: 4px solid #0284c7; }
            </style>
          </head>
          <body>
            <h1>KẾ HOẠCH BÀI DẠY MẦM NON</h1>
            <div class="box">
              <p><strong>Đề tài:</strong> ${generatedLesson.topic}</p>
              <p><strong>Môn học:</strong> ${generatedLesson.subject} | <strong>Khối lớp:</strong> ${generatedLesson.grade_level} (${generatedLesson.duration_minutes} phút)</p>
              <p><strong>Mục tiêu bài dạy:</strong> ${generatedLesson.target_objectives}</p>
              <p><strong>Đồ dùng chuẩn bị:</strong> ${generatedLesson.materials_needed.join(', ')}</p>
            </div>
            <h2>CẤU TRÚC 5 BƯỚC SƯ PHẠM MẦM NON</h2>
            ${generatedLesson.five_steps.map(s => `
              <div class="step">
                <h3>${s.step_title}</h3>
                <p><strong>Hoạt động của cô:</strong> ${s.teacher_action}</p>
                <p><strong>Hoạt động của trẻ:</strong> ${s.child_activity}</p>
              </div>
            `).join('')}
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
            <h1 className="font-bold text-white text-base leading-tight">Pipeline AI Tạo Bài Giảng Đa Phương Tiện (Cost: 0 VNĐ)</h1>
            <p className="text-xs text-sky-100 font-semibold">Gemini 1.5 Flash + Pollinations Flux.1 Cartoon + Slide PowerPoint (.pptx)</p>
          </div>
        </div>

        <LanguageSwitcher />
      </header>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Input Form & Criteria (TC-AI-01) */}
        <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sky-900 text-sm flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <span>Tiêu Chí Tạo Bài Giảng AI Theo Khung Chương Trình</span>
            </h2>
            <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-pill border border-emerald-200 font-bold text-[11px]">
              ★ Chi phí: 0 VNĐ (Gemini Flash + Pollinations API)
            </span>
          </div>

          <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Môn Học (*)</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
              >
                <option value="KHÁM_PHÁ">Khám phá khoa học</option>
                <option value="TOÁN">Toán mầm non</option>
                <option value="ÂM_NHẠC">Âm nhạc & Vận động</option>
                <option value="TẠO_HÌNH">Tạo hình & Khéo tay</option>
                <option value="VĂN_HỌC">Văn học & Kể chuyện</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Khối Lớp (*)</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
              >
                <option value="MẦM">Khối Mầm (3–4 tuổi)</option>
                <option value="CHỒI">Khối Chồi (4–5 tuổi)</option>
                <option value="LÁ">Khối Lá (5–6 tuổi)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Đề Tài Bài Học (*)</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Sự phát triển của hạt đỗ"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase mb-1">Mục Tiêu & Tiêu Chí Mong Muốn</label>
              <input
                type="text"
                value={targetObjectives}
                onChange={(e) => setTargetObjectives(e.target.value)}
                placeholder="e.g., Trẻ nhận biết quy trình gieo hạt"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Đồ Dùng Sẵn Có (Đặc thù)</label>
              <input
                type="text"
                value={materialsNeeded}
                onChange={(e) => setMaterialsNeeded(e.target.value)}
                placeholder="e.g., Bông gòn, khay nhựa, hạt giống"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm px-6 py-3 rounded-pill shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                <span>Tạo Bài Giảng AI Đa Phương Tiện</span>
              </button>
            </div>
          </form>
        </div>

        {/* AI GENERATED LESSON OUTPUT DISPLAY */}
        {generatedLesson && (
          <div className="space-y-6">
            {/* Header Actions (Dual Output: Word & PowerPoint PPTX - TC-AI-04) */}
            <div className="bg-white border border-slate-200 rounded-convent p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-emerald-600 font-bold uppercase block">Kế hoạch bài dạy đã hoàn thành</span>
                <h2 className="text-lg font-bold text-slate-900">{generatedLesson.topic}</h2>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleExportWord}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-pill text-xs shadow transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Xuất Word / In PDF</span>
                </button>

                <button
                  onClick={handleExportPPTX}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-pill text-xs shadow-lg transition-all active:scale-95 animate-pulse"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Slide PowerPoint (.pptx)</span>
                </button>
              </div>
            </div>

            {/* Grid 2 Columns: 5 Steps Pedagogy + Mermaid Mindmap Code (TC-AI-01, TC-AI-02) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: 5 Steps Pedagogy */}
              <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-4 text-xs">
                <h3 className="font-bold text-sky-900 text-sm border-b border-slate-100 pb-2.5 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  <span>Cấu Trúc 5 Bước Sư Phạm Mầm Non</span>
                </h3>

                <div className="space-y-3">
                  {generatedLesson.five_steps.map((step) => (
                    <div key={step.step_number} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <h4 className="font-bold text-sky-900 text-xs">{step.step_title}</h4>
                      <p className="text-slate-600">{step.description}</p>
                      <div className="pt-1.5 border-t border-slate-200/80 text-[11px] space-y-1">
                        <p><strong className="text-slate-900">Cô:</strong> {step.teacher_action}</p>
                        <p><strong className="text-emerald-800">Trẻ:</strong> {step.child_activity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Mermaid.js Mindmap Diagram & Video Suggestions */}
              <div className="space-y-6">
                {/* TC-AI-02: Visual Mindmap */}
                <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-3 text-xs">
                  <h3 className="font-bold text-sky-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>Sơ Đồ Tư Duy Bài Học (Cú Pháp Mermaid.js)</span>
                  </h3>

                  <div className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                    {generatedLesson.mermaid_mindmap_code}
                  </div>
                </div>

                {/* Video Suggestions */}
                <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-3 text-xs">
                  <h3 className="font-bold text-sky-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Video className="w-4 h-4 text-rose-600" />
                    <span>Gợi Ý Học Liệu Video YouTube</span>
                  </h3>

                  <div className="space-y-2">
                    {generatedLesson.youtube_video_suggestions.map((v, idx) => (
                      <a
                        key={idx}
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between hover:bg-sky-100 transition-colors"
                      >
                        <span className="font-bold text-sky-900">{v.title}</span>
                        <Play className="w-4 h-4 text-sky-600 fill-sky-600" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* TC-AI-03: Pollinations.ai Cartoon Image Slide Deck Preview */}
            <div className="bg-white border border-slate-200 rounded-convent p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sky-900 text-sm border-b border-slate-100 pb-2.5 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-600" />
                <span>Xem Trước Slide Trình Chiếu SmartTV (Ảnh Hoạt Hình Pollinations.ai)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {generatedLesson.slides.map((s) => (
                  <div key={s.slide_number} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-pill block w-max mb-1">
                        Slide {s.slide_number}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{s.title}</h4>
                      <ul className="text-[11px] text-slate-600 space-y-1 mt-1.5">
                        {s.content_points.map((p, pIdx) => (
                          <li key={pIdx}>• {p}</li>
                        ))}
                      </ul>
                    </div>

                    {s.image_url && (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-200 aspect-video">
                        <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" />
                      </div>
                    )}
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
