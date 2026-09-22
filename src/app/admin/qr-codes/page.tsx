'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, Download, Printer, Smartphone, Sparkles, 
  School, GraduationCap, Heart, CheckCircle2, ArrowLeft, RefreshCw 
} from 'lucide-react';
import Link from 'next/link';

export default function AdminQrCodesPage() {
  const [baseUrl, setBaseUrl] = useState<string>('https://mamnonsuongmai.edu.vn');
  const [printingTarget, setPrintingTarget] = useState<'TEACHER' | 'PARENT' | 'BOTH' | null>(null);

  const teacherQrRef = useRef<SVGSVGElement>(null);
  const parentQrRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const teacherUrl = `${baseUrl}/teacher`;
  const parentUrl = `${baseUrl}/parent`;

  const downloadSvgAsPng = (svgElement: SVGSVGElement | null, fileName: string) => {
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // High resolution for crisp vector printing
    canvas.width = 1200;
    canvas.height = 1200;

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      if (ctx) {
        // Draw white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw SVG image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
      }
    };

    img.src = url;
  };

  const handlePrint = (target: 'TEACHER' | 'PARENT' | 'BOTH') => {
    setPrintingTarget(target);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-convent border border-rose-100 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 text-primary-700 font-bold text-xs uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            <span>Hệ Thống Quản Lý Mã QR</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quản Lý & In Ấn Mã QR (A4 / Standee)</h1>
          <p className="text-slate-500 text-sm mt-1">
            Sinh mã QR Vector sắc nét nhúng Logo chính thức Trường Mầm Non Sương Mai phục vụ in ấn A4 & Standee.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint('BOTH')}
            className="inline-flex items-center gap-2 bg-primary-700 text-white font-bold px-4 py-2.5 rounded-pill hover:bg-primary-800 transition-all shadow-sm active:scale-95 text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>In Bộ Mã A4 Đôi</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 2 Independent QR Code Cards (Hidden when printing) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Card 1: Mã QR Cổng Giáo Viên */}
        <div className="bg-white rounded-convent border border-rose-100 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary-300 transition-all">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary-700 to-primary-600" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-primary-800 font-bold text-xs border border-rose-200">
                <GraduationCap className="w-3.5 h-3.5 text-primary-700" />
                <span>Phân Hệ Giáo Viên</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{teacherUrl}</span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-1">1. Mã QR Cổng Tác Nghiệp Giáo Viên</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Dành cho Giáo viên và Ban giám hiệu quét mã để mở ứng dụng PWA Điểm danh, Báo ăn, Dặn thuốc và Theo dõi sức khỏe.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-rose-50/30 rounded-2xl border border-rose-100 mb-6">
              <div className="p-4 bg-white rounded-xl shadow-md border border-slate-100">
                <QRCodeSVG
                  ref={teacherQrRef}
                  value={teacherUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/images/logo.png',
                    x: undefined,
                    y: undefined,
                    height: 48,
                    width: 48,
                    excavate: true,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-3 break-all text-center max-w-xs">{teacherUrl}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => downloadSvgAsPng(teacherQrRef.current, 'Ma_QR_Cong_Giao_Vien_SuongMai.png')}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition-all text-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Tải Ảnh PNG</span>
            </button>
            <button
              onClick={() => handlePrint('TEACHER')}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-700 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-primary-800 transition-all text-xs shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>In Mẫu A4 Standee</span>
            </button>
          </div>
        </div>

        {/* Card 2: Mã QR Sổ Liên Lạc Phụ Huynh */}
        <div className="bg-white rounded-convent border border-amber-100 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:border-secondary-300 transition-all">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-secondary-500 to-secondary-600" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-secondary-800 font-bold text-xs border border-amber-200">
                <Heart className="w-3.5 h-3.5 text-secondary-600 fill-amber-100" />
                <span>Phân Hệ Phụ Huynh</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{parentUrl}</span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-1">2. Mã QR Sổ Liên Lạc Phụ Huynh</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Đặt tại cổng trường hoặc bảng tin để Phụ huynh quét mã tra cứu điểm danh, thực đơn bán trú, gửi đơn dặn thuốc và dặn nghỉ học.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-amber-50/30 rounded-2xl border border-amber-100 mb-6">
              <div className="p-4 bg-white rounded-xl shadow-md border border-slate-100">
                <QRCodeSVG
                  ref={parentQrRef}
                  value={parentUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/images/logo.png',
                    x: undefined,
                    y: undefined,
                    height: 48,
                    width: 48,
                    excavate: true,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-3 break-all text-center max-w-xs">{parentUrl}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => downloadSvgAsPng(parentQrRef.current, 'Ma_QR_So_Lien_Lac_Phu_Huynh_SuongMai.png')}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition-all text-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Tải Ảnh PNG</span>
            </button>
            <button
              onClick={() => handlePrint('PARENT')}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-secondary-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-secondary-700 transition-all text-xs shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>In Mẫu A4 Standee</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRINTABLE A4 STANDEE TEMPLATES (Visible only when printing or in preview mode) */}
      <div className="hidden print:block space-y-12">
        {/* Template 1: Standee Mã QR Giáo Viên */}
        {(printingTarget === 'TEACHER' || printingTarget === 'BOTH') && (
          <div className="bg-white p-8 border-4 border-primary-700 rounded-3xl min-h-[95vh] flex flex-col justify-between items-center text-center page-break-after-always relative overflow-hidden">
            {/* Outer Decorative Border Header */}
            <div className="w-full flex items-center justify-between border-b-2 border-rose-100 pb-6 mb-6">
              <div className="flex items-center gap-4 text-left">
                <img 
                  src="/images/logo.png" 
                  alt="Mầm Non Sương Mai Logo" 
                  className="w-16 h-16 rounded-full border-2 border-primary-600 shadow-md object-cover bg-white"
                />
                <div>
                  <h1 className="text-2xl font-extrabold text-primary-900 uppercase tracking-tight">TRƯỜNG MẦM NON SƯƠNG MAI</h1>
                  <p className="text-xs font-bold text-secondary-600 uppercase tracking-wider">Khởi Sáng Trí Tâm - Gieo Mầm Ước Mơ</p>
                </div>
              </div>
              <div className="text-right text-xs font-bold text-primary-800 bg-rose-50 px-4 py-2 rounded-xl border border-rose-200">
                MÃ QR CHÍNH THỨC 2026
              </div>
            </div>

            {/* Standee Content Body */}
            <div className="my-auto flex flex-col items-center max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100 text-primary-900 font-extrabold text-sm mb-4 border border-rose-200">
                <GraduationCap className="w-5 h-5 text-primary-700" />
                <span>CỔNG TÁC NGHIỆP GIÁO VIÊN</span>
              </div>

              <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
                ĐIỂM DÀNH & BÁO ĂN BÁN TRÚ
              </h2>
              <p className="text-sm text-slate-600 mb-8 max-w-md leading-relaxed">
                Giáo viên sử dụng camera điện thoại hoặc Zalo để quét mã QR và đăng nhập vào ứng dụng PWA Tác nghiệp.
              </p>

              {/* Large Crisp QR Code with Official Logo */}
              <div className="p-6 bg-white border-4 border-primary-700 rounded-3xl shadow-xl mb-6 inline-block">
                <QRCodeSVG
                  value={teacherUrl}
                  size={320}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/images/logo.png',
                    x: undefined,
                    y: undefined,
                    height: 64,
                    width: 64,
                    excavate: true,
                  }}
                />
              </div>

              <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 w-full text-left font-medium text-slate-700 text-xs space-y-2 mb-4">
                <div className="flex items-center gap-2 text-primary-900 font-bold text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary-700" />
                  <span>Hướng dẫn dành cho Giáo viên:</span>
                </div>
                <p>1. Mở ứng dụng Camera, Zalo hoặc Google Lens trên điện thoại.</p>
                <p>2. Đưa ống kính hướng vào mã QR trên bảng Standee.</p>
                <p>3. Nhấp vào liên kết hiện lên để truy cập ngay Cổng Tác Nghiệp.</p>
              </div>

              <p className="text-xs font-mono font-bold text-primary-800 tracking-wider uppercase">{teacherUrl}</p>
            </div>

            {/* Standee Footer */}
            <div className="w-full pt-6 border-t-2 border-rose-100 flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>📍 Trường Mầm Non Sương Mai • ĐT: 0911.784.875</span>
              <span>☎️ Hotline IT BGH: 0911.784.875</span>
            </div>
          </div>
        )}

        {/* Template 2: Standee Mã QR Phụ Huynh */}
        {(printingTarget === 'PARENT' || printingTarget === 'BOTH') && (
          <div className="bg-white p-8 border-4 border-secondary-600 rounded-3xl min-h-[95vh] flex flex-col justify-between items-center text-center page-break-after-always relative overflow-hidden">
            {/* Outer Decorative Border Header */}
            <div className="w-full flex items-center justify-between border-b-2 border-amber-100 pb-6 mb-6">
              <div className="flex items-center gap-4 text-left">
                <img 
                  src="/images/logo.png" 
                  alt="Mầm Non Sương Mai Logo" 
                  className="w-16 h-16 rounded-full border-2 border-secondary-600 shadow-md object-cover bg-white"
                />
                <div>
                  <h1 className="text-2xl font-extrabold text-primary-900 uppercase tracking-tight">TRƯỜNG MẦM NON SƯƠNG MAI</h1>
                  <p className="text-xs font-bold text-secondary-600 uppercase tracking-wider">Sổ Liên Lạc Điện Tử Phụ Huynh Học Sinh</p>
                </div>
              </div>
              <div className="text-right text-xs font-bold text-secondary-800 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
                MÃ QR CHÍNH THỨC 2026
              </div>
            </div>

            {/* Standee Content Body */}
            <div className="my-auto flex flex-col items-center max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-secondary-900 font-extrabold text-sm mb-4 border border-amber-200">
                <Heart className="w-5 h-5 text-secondary-600 fill-amber-200" />
                <span>SỔ LIÊN LẠC ĐIỆN TỬ PHỤ HUYNH</span>
              </div>

              <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
                TRA CỨU ĐIỂM DÀNH & THỰC ĐƠN
              </h2>
              <p className="text-sm text-slate-600 mb-8 max-w-md leading-relaxed">
                Quý Phụ huynh quét mã QR để nhận thông báo đón bé, dặn thuốc, gửi đơn xin nghỉ học và theo dõi thực đơn bán trú.
              </p>

              {/* Large Crisp QR Code with Official Logo */}
              <div className="p-6 bg-white border-4 border-secondary-600 rounded-3xl shadow-xl mb-6 inline-block">
                <QRCodeSVG
                  value={parentUrl}
                  size={320}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/images/logo.png',
                    x: undefined,
                    y: undefined,
                    height: 64,
                    width: 64,
                    excavate: true,
                  }}
                />
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 w-full text-left font-medium text-slate-700 text-xs space-y-2 mb-4">
                <div className="flex items-center gap-2 text-secondary-900 font-bold text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-secondary-600" />
                  <span>Hướng dẫn dành cho Phụ huynh:</span>
                </div>
                <p>1. Sử dụng Camera điện thoại hoặc ứng dụng Zalo quét mã QR.</p>
                <p>2. Đăng nhập bằng Google hoặc xem thông tin liên lạc của bé.</p>
                <p>3. Lưu ứng dụng vào Màn hình chính (PWA) để dùng hàng ngày.</p>
              </div>

              <p className="text-xs font-mono font-bold text-secondary-800 tracking-wider uppercase">{parentUrl}</p>
            </div>

            {/* Standee Footer */}
            <div className="w-full pt-6 border-t-2 border-amber-100 flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>📍 Trường Mầm Non Sương Mai • ĐT: 0911.784.875</span>
              <span>☎️ Hotline Văn phòng trường: 0911.784.875</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
