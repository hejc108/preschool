'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function PendingApprovalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get('email') || '';

  const [email, setEmail] = useState<string>(emailParam);

  // Sync cookie email if parameter missing or save email to cookie if present
  useEffect(() => {
    if (email && typeof window !== 'undefined') {
      document.cookie = `suongmai_user_email=${encodeURIComponent(email)}; path=/; max-age=86400; SameSite=Lax`;
    } else if (!email && typeof window !== 'undefined') {
      const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (match) {
        const clean = decodeURIComponent(match[1]);
        setEmail(clean);
      } else {
        const saved = localStorage.getItem('suongmai_auth_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.email) setEmail(parsed.email);
          } catch (e) {}
        }
      }
    }
  }, [email]);

  // Ensure registration record in DB
  useEffect(() => {
    if (email && email !== 'example@gmail.com' && typeof window !== 'undefined') {
      fetch('/api/users/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }
  }, [email]);

  const handleReLogin = () => {
    router.push('/auth');
  };

  const handleLogout = () => {
    document.cookie = 'suongmai_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'suongmai_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('suongmai_auth_user');
    }
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Top Bar */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Soft Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-convent p-6 sm:p-8 shadow-xl relative z-10 text-center">
        {/* Header Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 border border-amber-200 rounded-convent mb-4 text-amber-600 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* User Directive Exact Required Notification */}
        <h1 className="text-xl sm:text-2xl font-bold text-amber-900 tracking-tight mb-3">
          Tài khoản đang chờ kích hoạt ⏳
        </h1>
        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 px-2">
          Tài khoản của bạn đã được ghi nhận và đang chờ Nhà trường xác nhận quyền truy cập. Vui lòng liên hệ Ban Giám Hiệu để được kích hoạt.
        </p>

        {email && (
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 inline-block">
            Tài khoản: <span className="font-bold text-sky-700">{email}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleReLogin}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-4 rounded-pill transition-all shadow-sm active:scale-[0.98] text-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Đăng nhập lại bằng Google</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-pill transition-all active:scale-[0.98] border border-slate-200 text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        © 2026 Mầm Non Sương Mai. Tất cả quyền được bảo lưu.
      </footer>
    </div>
  );
}

export default function PendingApprovalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Đang tải...</div>}>
      <PendingApprovalContent />
    </Suspense>
  );
}

