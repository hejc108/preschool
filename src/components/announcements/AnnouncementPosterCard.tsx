// ==============================================================================
// src/components/announcements/AnnouncementPosterCard.tsx
// Component hiển thị Poster Thông báo 6 tầng chuẩn hóa dùng chung
// (Admin Live Preview, PNG High-Res Export, PWA Mobile View)
// Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
// ==============================================================================

import React, { forwardRef } from 'react';
import { CalendarClock, MapPin, Info } from 'lucide-react';
import { EMBEDDED_BACKGROUNDS } from '@/lib/announcements/posterTemplates';

export interface AnnouncementPosterCardProps {
  title: string;
  bodyText: string;
  templateId?: string;
  customBgUrl?: string | null;
  isBgEnabled?: boolean;
  audience?: string;
  showTimeCard?: boolean;
  timeValue?: string;
  showLocCard?: boolean;
  locValue?: string;
  showTableCard?: boolean;
  tableData?: {
    row1_label?: string;
    row1_amt?: string;
    row2_label?: string;
    row2_amt?: string;
  } | null;
  showDeadlineCard?: boolean;
  deadlineValue?: string;
  showSealCard?: boolean;
  className?: string;
}

export const AnnouncementPosterCard = forwardRef<HTMLDivElement, AnnouncementPosterCardProps>(
  (
    {
      title,
      bodyText,
      templateId = 'le-hoi',
      customBgUrl,
      isBgEnabled = true,
      audience = 'Toàn trường',
      showTimeCard = true,
      timeValue = '07:30 - Thứ Sáu, 20/11/2026\n(Tức ngày 12 tháng 10 năm Bính Ngọ âm lịch)',
      showLocCard = true,
      locValue = 'Hội trường Lớn - Trường Mầm non Sương Mai',
      showTableCard = false,
      tableData,
      showDeadlineCard = true,
      deadlineValue = 'Quý PH vui lòng đưa bé đến trường trước 07:15 • Hotline: 0262.352.1234',
      showSealCard = true,
      className = '',
    },
    ref
  ) => {
    // Resolve background image with safe fallback
    const resolvedTemplateId =
      templateId && EMBEDDED_BACKGROUNDS[templateId] ? templateId : 'le-hoi';
    const bgUrl =
      customBgUrl ||
      EMBEDDED_BACKGROUNDS[resolvedTemplateId] ||
      '/images/announcements/le-hoi.jpg';

    // Normalize table data fallback
    const r1Label = tableData?.row1_label || 'Học phí & Bán trú';
    const r1Amt = tableData?.row1_amt || '1.850.000 đ';
    const r2Label = tableData?.row2_label || 'Quỹ Hội Phụ huynh';
    const r2Amt = tableData?.row2_amt || '200.000 đ';

    return (
      <div
        ref={ref}
        id="posterCanvas"
        className={`w-full max-w-[390px] aspect-[3/4.25] rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between relative border-4 select-none bg-cover bg-center transition-all duration-300 ${
          isBgEnabled
            ? 'border-white bg-white'
            : 'border-red-200 bg-gradient-to-b from-white to-red-50/40'
        } ${className}`}
        style={
          isBgEnabled && bgUrl
            ? { backgroundImage: `url('${bgUrl}')` }
            : { backgroundImage: 'none' }
        }
      >
        {/* TẦNG 1: HEADER TRƯỜNG MẦM NON SƯƠNG MAI (ĐỒNG BỘ 100% TOÀN HỆ THỐNG) */}
        <div className="bg-[#D32F2F]/95 backdrop-blur-xs text-white px-4 py-2.5 flex items-center justify-center space-x-2.5 relative z-10 shadow-md">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white p-0.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden border border-white/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="Logo Trường Mầm Non Sương Mai"
              crossOrigin="anonymous"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-extrabold tracking-wide uppercase leading-none">
              Trường Mầm Non Sương Mai
            </h4>
            <p className="text-[9px] opacity-90 mt-0.5">
              Krông Pắc, Đắk Lắk • 0262.352.1234
            </p>
          </div>
        </div>

        {/* VÙNG TRUNG TÂM NỘI DUNG NỔI (CÂN ĐỐI TRỤC DỌC) */}
        <div className="px-4 py-2 my-auto flex flex-col items-center text-center relative z-10 space-y-2">
          {/* TẦNG 2: RUY BĂNG TIÊU ĐỀ NỔI BẬT (CĂN GIỮA TUYỆT ĐỐI, CÂN ĐỐI) */}
          <div
            id="posterRibbonBox"
            className={
              isBgEnabled
                ? 'text-white px-5 py-2 rounded-2xl border-2 border-[#FFCDD2] w-full max-w-[94%] mx-auto transition-all text-center'
                : 'bg-red-50 text-[#D32F2F] px-5 py-2 rounded-xl border border-red-200 w-full max-w-[94%] mx-auto transition-all text-center shadow-xs'
            }
            style={
              isBgEnabled
                ? {
                    background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
                  }
                : undefined
            }
          >
            <h2
              className={`text-sm sm:text-base font-extrabold leading-snug tracking-wide ${
                isBgEnabled ? 'text-white drop-shadow-md' : 'text-[#D32F2F]'
              }`}
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                textShadow: isBgEnabled ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {title || '(Chưa nhập tiêu đề)'}
            </h2>
          </div>

          {/* TẦNG 3: KHỐI THẺ THÔNG TIN ĐỘNG */}
          <div className="w-full max-w-[94%] mx-auto space-y-1.5">
            {/* THẺ 1: THỜI GIAN DIỄN RA (HỖ TRỢ 2 DÒNG DƯƠNG & ÂM LỊCH, CĂN GIỮA TUYỆT ĐỐI) */}
            {showTimeCard && timeValue && (
              <div className="flex items-center justify-center space-x-2 bg-white/94 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs text-center">
                <CalendarClock className="w-3.5 h-3.5 text-[#D32F2F] shrink-0" />
                <span className="text-[10.5px] font-bold text-slate-900 leading-tight whitespace-pre-line text-center">
                  {timeValue}
                </span>
              </div>
            )}

            {/* THẺ 2: ĐỊA ĐIỂM TỔ CHỨC (CĂN GIỮA) */}
            {showLocCard && locValue && (
              <div className="flex items-center justify-center space-x-2 bg-white/94 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs text-center">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[10.5px] font-bold text-slate-900 leading-tight text-center">
                  {locValue}
                </span>
              </div>
            )}

            {/* THẺ TÙY CHỌN: BẢNG CHI TIẾT (KHOẢN THU / THỰC ĐƠN) */}
            {showTableCard && (
              <div className="bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-emerald-200 shadow-xs text-[10px] text-left">
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-700 font-medium">{r1Label}</span>
                  <span className="font-extrabold text-slate-900">{r1Amt}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-700 font-medium">{r2Label}</span>
                  <span className="font-extrabold text-slate-900">{r2Amt}</span>
                </div>
              </div>
            )}

            {/* THẺ 3: LƯU Ý / HẠN CHÓT / HOTLINE LIÊN HỆ */}
            {showDeadlineCard && deadlineValue && (
              <div className="flex items-center justify-center space-x-2 bg-white/94 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-sky-200/80 shadow-xs text-center">
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="text-[10px] font-semibold text-slate-800 leading-tight text-center">
                  {deadlineValue}
                </span>
              </div>
            )}
          </div>

          {/* TẦNG 4: LỜI NGỎ / VĂN BẢN CHÍNH THỨC (#posterBodyCard NỀN TRẮNG MỜ CỐ ĐỊNH) */}
          <div
            id="posterBodyCard"
            className="w-full max-w-[94%] mx-auto bg-white/94 backdrop-blur-sm border border-slate-200/80 rounded-xl px-3.5 py-2 shadow-xs"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.94)' }}
          >
            <p className="text-[10.5px] text-slate-800 font-medium leading-relaxed text-justify line-clamp-5">
              {bodyText || '(Chưa nhập nội dung)'}
            </p>
          </div>
        </div>

        {/* TẦNG 5 & 6: PHẠM VI NHẬN & CON DẤU ĐỎ HIỆU TRƯỞNG */}
        <div className="px-4 pb-3 pt-1 flex items-end justify-between relative z-10">
          <span className="px-2 py-0.5 bg-white/90 backdrop-blur-xs rounded-md text-[9px] font-extrabold text-slate-800 shadow-xs border border-slate-200/80">
            Gửi: <span>{audience}</span>
          </span>

          {showSealCard && (
            <div className="flex items-center space-x-1.5 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-xl border border-red-200 shadow-xs">
              <div className="text-right">
                <p className="text-[8px] font-bold text-slate-700 uppercase leading-none">
                  Hiệu Trưởng
                </p>
                <p
                  className="text-[9px] italic text-red-700 font-bold leading-tight"
                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                >
                  Vũ Thị Xuân
                </p>
              </div>
              <div className="w-8 h-8 rounded-full border border-red-600 flex flex-col items-center justify-center text-red-600 font-extrabold text-[6px] leading-none transform -rotate-12 bg-red-50 shrink-0">
                <span>SƯƠNG MAI</span>
                <span className="mt-0.5">ĐÃ DUYỆT</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

AnnouncementPosterCard.displayName = 'AnnouncementPosterCard';
