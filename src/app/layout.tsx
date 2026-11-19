import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { ActiveRoleProvider } from '@/components/auth/ActiveRoleContext';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Mầm Non Sương Mai - Hệ Thống Sổ Liên Lạc & Tác Nghiệp',
  description: 'Hệ thống Quản lý, Sổ liên lạc điện tử & Tác nghiệp Sương Mai Kindergarten',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sương Mai',
  },
};

export const viewport: Viewport = {
  themeColor: '#D32F2F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sương Mai" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap&subset=vietnamese,latin"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-surface-base text-slate-800 min-h-dvh w-full max-w-full overflow-x-hidden font-sans">
        <LanguageProvider>
          <ActiveRoleProvider>
            {children}
            <PwaInstallPrompt />
          </ActiveRoleProvider>
        </LanguageProvider>

        {/* Register Service Worker (Root Scope: /) & Autoplay Audio Unlocker */}
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', function() {
                  if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                  }
                });

                function registerAndAutoUpdate() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
                    function(registration) {
                      // Ép Service Worker kiểm tra phiên bản mới ngay lập tức
                      registration.update().catch(function() {});

                      // Phát hiện worker mới và tự động gửi lệnh SKIP_WAITING
                      registration.addEventListener('updatefound', function() {
                        var installingWorker = registration.installing;
                        if (installingWorker) {
                          installingWorker.addEventListener('statechange', function() {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                              installingWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                          });
                        }
                      });

                      // Tự động kiểm tra cập nhật mỗi khi người dùng mở lại tab/app
                      document.addEventListener('visibilitychange', function() {
                        if (document.visibilityState === 'visible') {
                          registration.update().catch(function() {});
                        }
                      });
                      window.addEventListener('focus', function() {
                        registration.update().catch(function() {});
                      });

                      // Định kỳ kiểm tra cập nhật mỗi 15 phút
                      setInterval(function() {
                        registration.update().catch(function() {});
                      }, 15 * 60 * 1000);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                }

                if (document.readyState === 'complete') {
                  registerAndAutoUpdate();
                } else {
                  window.addEventListener('load', registerAndAutoUpdate);
                }
              }

              // Mở khóa sớm chính sách Autoplay của trình duyệt ngay khi người dùng có tương tác đầu tiên
              (function() {
                var unlockEvents = ['click', 'touchstart', 'keydown'];
                function unlockAudioOnFirstGesture() {
                  try {
                    var AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtx) {
                      var ctx = new AudioCtx();
                      if (ctx.state === 'suspended') {
                        ctx.resume();
                      }
                    }
                  } catch(e) {}
                  unlockEvents.forEach(function(ev) {
                    window.removeEventListener(ev, unlockAudioOnFirstGesture);
                  });
                }
                unlockEvents.forEach(function(ev) {
                  window.addEventListener(ev, unlockAudioOnFirstGesture, { once: true, passive: true });
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
