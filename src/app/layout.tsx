import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata: Metadata = {
  title: 'Mầm Non Sương Mai - Preschool Ecosystem',
  description: 'Unified Human-Centered Preschool Management Ecosystem for Mam Non Suong Mai Kindergarten',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0EA5E9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased bg-surface-base text-slate-800 min-h-screen font-sans">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
