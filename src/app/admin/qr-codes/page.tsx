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

    // High resolution for crisp printing
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-convent border border-slate-200/80 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 text-sky-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            <span>Hệ Thống Quản Lý Mã QR</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Quản Lý & In Ấn Mã QR (A4 / Standee)</h1>
          <p className="text-slate-500 text-sm mt-1">
            Sinh mã QR Vector sắc nét phục vụ in bản A4 hoặc Standee đón tiếp tại Cổng Trường Mầm Non Sương Mai.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint('BOTH')}
            className="inline-flex items-center gap-2 bg-sky-600 text-white font-semibold px-4 py-2.5 rounded-pill hover:bg-sky-700 transition-all shadow-sm active:scale-95 text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>In Bộ Mã A4 Đôi</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 2 Independent QR Code Cards (Hidden when printing) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Card 1: Mã QR Cổng Giáo Viên */}
        <div className="bg-white rounded-convent border border-sky-100 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:border-sky-300 transition-all">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-sky-400 to-sky-600" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold text-xs border border-sky-200">
                <GraduationCap className="w-3.5 h-3.5 text-sky-600" />
                <span>Phân Hệ Giáo Viên</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{teacherUrl}</span>
            </div>

            <h2 className="text-lg font-bold text-slate-800 mb-1">1. Mã QR Cổng Tác Nghiệp Giáo Viên</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Dành cho Giáo viên và Ban giám hiệu quét mã để mở ứng dụng PWA Điểm danh, Báo ăn, Dặn thuốc và Theo dõi sức khỏe.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200/80 mb-6">
              <div className="p-4 bg-white rounded-xl shadow-md border border-slate-100">
                <QRCodeSVG
                  ref={teacherQrRef}
                  value={teacherUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=60&auto=format&fit=crop&q=80',
                    x: undefined,
                    y: undefined,
                    height: 36,
                    width: 36,
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
              className="flex-1 inline-flex items-center justify-center gap-2 bg-sky-600 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-sky-700 transition-all text-xs shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>In Mẫu A4 Standee</span>
            </button>
          </div>
        </div>

        {/* Card 2: Mã QR Sổ Liên Lạc Phụ Huynh */}
        <div className="bg-white rounded-convent border border-emerald-100 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-teal-600" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200">
                <Heart className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                <span>Phân Hệ Phụ Huynh</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{parentUrl}</span>
            </div>

            <h2 className="text-lg font-bold text-slate-800 mb-1">2. Mã QR Sổ Liên Lạc Phụ Huynh</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Đặt tại cổng trường hoặc bảng tin để Phụ huynh quét mã tra cứu điểm danh, thực đơn bán trú, gửi đơn dặn thuốc và dặn nghỉ học.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200/80 mb-6">
              <div className="p-4 bg-white rounded-xl shadow-md border border-slate-100">
                <QRCodeSVG
                  ref={parentQrRef}
                  value={parentUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&auto=format&fit=crop&q=80',
                    x: undefined,
                    y: undefined,
                    height: 36,
                    width: 36,
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
              className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-emerald-700 transition-all text-xs shadow-sm cursor-pointer active:scale-95"
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
          <div className="bg-white p-8 border-4 border-sky-600 rounded-3xl min-h-[95vh] flex flex-col justify-between items-center text-center page-break-after-always relative overflow-hidden">
            {/* Outer Decorative Border Header */}
            <div className="w-full flex items-center justify-between border-b-2 border-sky-100 pb-6 mb-6">
              <div className="flex items-center gap-4 text-left">
                <div className="w-16 h-16 bg-sky-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
                  SM
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-sky-950 uppercase tracking-tight">TRƯỜNG MẦM NON SƯƠNG MAI</h1>
                  <p className="text-xs font-medium text-sky-700 uppercase tracking-wider">Hệ Thống Quản Lý Giáo Dục Mầm Non Chuẩn Quốc Gia</p>
                </div>
              </div>
              <div className="text-right text-xs font-semibold text-sky-800 bg-sky-50 px-4 py-2 rounded-xl border border-sky-200">
                MÃ QR CHÍNH THỨC 2026
              </div>
            </div>

            {/* Standee Content Body */}
            <div className="my-auto flex flex-col items-center max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-100 text-sky-800 font-bold text-sm mb-4">
                <GraduationCap className="w-5 h-5 text-sky-600" />
                <span>CỔNG TÁC NGHIỆP GIÁO VIÊN</span>
              </div>

              <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
                ĐIỂM DÀNH & BÁO ĂN BÁN TRÚ
              </h2>
              <p className="text-sm text-slate-600 mb-8 max-w-md leading-relaxed">
                Giáo viên sử dụng camera điện thoại hoặc Zalo để quét mã QR và đăng nhập vào ứng dụng PWA Tác nghiệp.
              </p>

              {/* Large Crisp QR Code */}
              <div className="p-6 bg-white border-4 border-sky-500 rounded-3xl shadow-xl mb-6 inline-block">
                <QRCodeSVG
                  value={teacherUrl}
                  size={320}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 w-full text-left font-medium text-slate-700 text-xs space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-sky-600" />
                  <span>Hướng dẫn dành cho Giáo viên:</span>
                </div>
                <p>1. Mở ứng dụng Camera, Zalo hoặc Google Lens trên điện thoại.</p>
                <p>2. Đưa ống kính hướng vào mã QR trên bảng Standee.</p>
                <p>3. Nhấp vào liên kết hiện lên để truy cập ngay Cổng Tác Nghiệp.</p>
              </div>

              <p className="text-xs font-mono font-semibold text-slate-400 tracking-wider uppercase">{teacherUrl}</p>
            </div>

            {/* Standee Footer */}
            <div className="w-full pt-6 border-t-2 border-sky-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>📍 Địa chỉ: 123 Đường Sương Mai, Phường 4, Quận Tân Bình, TP.HCM</span>
              <span>☎️ Hotline IT: 0903.112.233</span>
            </div>
          </div>
        )}

        {/* Template 2: Standee Mã QR Phụ Huynh */}
        {(printingTarget === 'PARENT' || printingTarget === 'BOTH') && (
          <div className="bg-white p-8 border-4 border-emerald-600 rounded-3xl min-h-[95vh] flex flex-col justify-between items-center text-center page-break-after-always relative overflow-hidden">
            {/* Outer Decorative Border Header */}
            <div className="w-full flex items-center justify-between border-b-2 border-emerald-100 pb-6 mb-6">
              <div className="flex items-center gap-4 text-left">
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
                  SM
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-emerald-950 uppercase tracking-tight">TRƯỜNG MẦM NON SƯƠNG MAI</h1>
                  <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Hệ Thống Sổ Liên Lạc Điện Tử Phụ Huynh</p>
                </div>
              </div>
              <div className="text-right text-xs font-semibold text-emerald-800 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                MÃ QR CHÍNH THỨC 2026
              </div>
            </div>

            {/* Standee Content Body */}
            <div className="my-auto flex flex-col items-center max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm mb-4">
                <Heart className="w-5 h-5 text-emerald-600 fill-emerald-200" />
                <span>SỔ LIÊN LẠC ĐIỆN TỬ PHỤ HUYNH</span>
              </div>

              <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
                TRA CỨU ĐIỂM DÀNH & THỰC ĐƠN
              </h2>
              <p className="text-sm text-slate-600 mb-8 max-w-md leading-relaxed">
                Quý Phụ huynh quét mã QR để nhận thông báo đón bé, dặn thuốc, gửi đơn xin nghỉ học và theo dõi thực đơn bán trú.
              </p>

              {/* Large Crisp QR Code */}
              <div className="p-6 bg-white border-4 border-emerald-500 rounded-3xl shadow-xl mb-6 inline-block">
                <QRCodeSVG
                  value={parentUrl}
                  size={320}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 w-full text-left font-medium text-slate-700 text-xs space-y-2 mb-4">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Hướng dẫn dành cho Phụ huynh:</span>
                </div>
                <p>1. Sử dụng Camera điện thoại hoặc ứng dụng Zalo quét mã QR.</p>
                <p>2. Đăng nhập bằng Google hoặc xem thông tin liên lạc của bé.</p>
                <p>3. Lưu ứng dụng vào Màn hình chính (PWA) để dùng hàng ngày.</p>
              </div>

              <p className="text-xs font-mono font-semibold text-slate-400 tracking-wider uppercase">{parentUrl}</p>
            </div>

            {/* Standee Footer */}
            <div className="w-full pt-6 border-t-2 border-emerald-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>📍 Địa chỉ: 123 Đường Sương Mai, Phường 4, Quận Tân Bình, TP.HCM</span>
              <span>☎️ Văn phòng trường: (028) 38.123.456</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
