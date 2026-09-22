'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, Share, X, Download, Info } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showPrompt, setShowPrompt] = useState<boolean>(true);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [inAppBrowserName, setInAppBrowserName] = useState<string>('Zalo');

  useEffect(() => {
    // 1. Check if running in Standalone mode (App launched from Home Screen)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // 2. Check if Mobile device (Hide completely on Desktop)
    const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth <= 768;
    setIsMobile(isMobileDevice);

    if (!isMobileDevice) {
      return; // Do NOT render banner on Desktop PCs/Laptops
    }

    // 3. In-App browser detection (Zalo, Facebook, Messenger, Instagram, Line, etc.)
    const isZalo = /Zalo/i.test(ua);
    const isFb = /FBAN|FBAV|Instagram/i.test(ua);
    const isLine = /Line/i.test(ua);
    const isInApp = isZalo || isFb || isLine;

    if (isInApp) {
      setIsInAppBrowser(true);
      if (isZalo) setInAppBrowserName('Zalo');
      else if (isFb) setInAppBrowserName('Facebook');
      else setInAppBrowserName('Ứng dụng');
    }

    // 4. iOS detection
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream;
    setIsIos(isIosDevice);

    // 5. Android Chrome beforeinstallprompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  // Hide if Desktop PC or launched in Standalone App mode or explicitly dismissed
  if (!isMobile || isStandalone || !showPrompt) return null;

  return (
    <>
      {/* Floating Bottom App Installation Banner (Mobile Only) */}
      <div className="fixed bottom-4 left-4 right-4 z-[9990] max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-rose-100 ring-1 ring-primary-900/10 relative overflow-hidden">
          {/* Top Decorative Stripe */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-700 via-secondary-500 to-primary-600" />

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            {/* Official School Logo */}
            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-primary-700 via-secondary-500 to-primary-600 shadow-md flex-shrink-0">
              <img
                src="/images/logo.png"
                alt="Mầm Non Sương Mai"
                className="w-full h-full object-cover rounded-full bg-white"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Cài đặt App
              </h4>

              {/* Conditional Instructions based on environment */}
              {isInAppBrowser ? (
                <div className="mt-1.5 text-xs text-secondary-900 bg-secondary-50 p-2.5 rounded-xl border border-secondary-200 leading-relaxed">
                  <p className="font-bold flex items-center gap-1 text-[11px] mb-1 text-secondary-800">
                    <Info className="w-3.5 h-3.5 text-secondary-600 flex-shrink-0" />
                    Đang mở trong {inAppBrowserName}
                  </p>
                  👉 Bấm dấu <span className="font-extrabold text-primary-700">[⋮]</span> (hoặc <span className="font-extrabold text-primary-700">[...]</span>) góc trên bên phải ➔ Chọn <span className="font-extrabold text-primary-700">&quot;Mở bằng trình duyệt&quot;</span> để cài App ra màn hình chính.
                </div>
              ) : isIos ? (
                <p className="mt-1 text-xs text-slate-700 leading-relaxed font-medium">
                  👉 Bấm nút <span className="font-bold text-primary-700">Chia sẻ [↑]</span> ở đáy màn hình ➔ Chọn <span className="font-bold text-primary-700">&quot;Thêm vào MH chính&quot;</span>.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Cài đặt ứng dụng ra màn hình chính để mở nhanh hàng ngày không cần tìm liên kết.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons for Standard Browsers */}
          {!isInAppBrowser && (
            <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Để sau
              </button>
              
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 text-xs font-extrabold text-white bg-primary-700 hover:bg-primary-800 active:bg-primary-900 rounded-xl shadow-md shadow-primary-700/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isIos ? (
                  <>
                    <Share className="w-3.5 h-3.5" />
                    Hướng dẫn Cài đặt
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    📲 Cài đặt App ra màn hình chính
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Hướng Dẫn Cài Đặt Chi Tiết Cho iOS */}
      {showIosModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-primary-700 to-secondary-500 mx-auto mb-3 shadow-md">
                <img
                  src="/images/logo.png"
                  alt="Mầm Non Sương Mai"
                  className="w-full h-full object-cover rounded-full bg-white"
                />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Thêm App ra Màn hình chính
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Thực hiện 2 bước đơn giản trên thiết bị iPhone/iPad
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                <span className="w-6 h-6 rounded-full bg-primary-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                  1
                </span>
                <div className="text-xs text-slate-700">
                  Nhấn vào nút <span className="font-bold text-slate-900 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm"><Share className="w-3 h-3 text-primary-700" /> Chia sẻ</span> ở thanh công cụ dưới cùng.
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                <span className="w-6 h-6 rounded-full bg-primary-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                  2
                </span>
                <div className="text-xs text-slate-700">
                  Cuộn danh sách xuống và chọn <span className="font-bold text-slate-900 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm"><Smartphone className="w-3 h-3 text-primary-700" /> Thêm vào MH chính</span>.
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowIosModal(false)}
                className="w-full py-2.5 text-xs font-bold text-white bg-primary-700 hover:bg-primary-800 active:bg-primary-900 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
