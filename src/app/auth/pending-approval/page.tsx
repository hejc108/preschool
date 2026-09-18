'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, ShieldAlert, Phone, LogOut, Sparkles, UserX } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function PendingApprovalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams?.get('type') || 'parent';
  const email = searchParams?.get('email') || '';

  React.useEffect(() => {
    if (email && email !== 'example@gmail.com' && typeof window !== 'undefined') {
      fetch('/api/users/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }
  }, [email]);

  const handleLogout = () => {
    document.cookie = "suongmai_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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

      {/* Decorative Pastel Background Spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full bg-white border border-slate-200/90 rounded-convent p-6 sm:p-8 shadow-xl relative z-10">
        {/* Header Icon & Title depending on User Type */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 border border-amber-200 rounded-convent mb-4 text-amber-600 shadow-sm animate-pulse">
            {type === 'teacher' ? (
              <ShieldAlert className="w-8 h-8" />
            ) : type === 'unknown' ? (
              <UserX className="w-8 h-8 text-rose-500" />
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </div>

          {type === 'teacher' ? (
            <h1 className="text-xl sm:text-2xl font-bold text-amber-900 tracking-tight flex items-center justify-center gap-2">
              Tài khoản giáo viên đang chờ kích hoạt ⏳
            </h1>
          ) : type === 'unknown' ? (
            <h1 className="text-xl sm:text-2xl font-bold text-rose-900 tracking-tight flex items-center justify-center gap-2">
              Email chưa được ghi nhận ⏳
            </h1>
          ) : (
            <h1 className="text-xl sm:text-2xl font-bold text-amber-900 tracking-tight flex items-center justify-center gap-2">
              Chờ xác nhận hồ sơ học sinh ⏳
            </h1>
          )}
        </div>

        {/* Dynamic Context Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-sm leading-relaxed text-slate-700 shadow-inner space-y-3">
          <p>
            Email Google <span className="font-semibold font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">{email}</span> đã đăng nhập thành công.
          </p>
          <p className="font-medium text-amber-900 bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs leading-normal shadow-sm">
            Tài khoản của bạn đang chờ Nhà trường xác nhận thông tin học sinh/giáo viên. Vui lòng liên hệ Văn phòng trường để được kích hoạt.
          </p>
        </div>

        {/* Contact Info & Action Buttons */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 bg-sky-50 border border-sky-200/80 rounded-xl py-3 px-4 shadow-sm">
            <Phone className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Hotline Văn phòng: <strong>028.3896.1234</strong></span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-pill transition-all active:scale-[0.98] border border-slate-200 text-sm"
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
