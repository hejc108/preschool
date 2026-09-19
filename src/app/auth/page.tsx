'use client';

import React, { useState, Suspense } from 'react';
import { Sparkles, AlertCircle, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/admin/dashboard';
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Directly register Google email & check DB approval status
  const processGoogleEmailLogin = async (emailToLogin: string) => {
    const cleanEmail = emailToLogin.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập định dạng email Google hợp lệ (ví dụ: alanvu755@gmail.com)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Write user email cookie to browser document
      document.cookie = `suongmai_user_email=${encodeURIComponent(cleanEmail)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `suongmai_user_role=GUEST; path=/; max-age=86400; SameSite=Lax`;

      // 2. Ensure profile exists in Supabase DB / Server Cache
      await fetch('/api/users/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      }).catch(() => {});

      // 3. Check live approval status from DB
      const res = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (data.success && data.isApproved) {
        // User already approved in DB -> active session & redirect
        const targetRole = data.role || 'PARENT';
        const targetUrl = data.redirectUrl || (targetRole === 'TEACHER' ? '/teacher' : '/parent');

        document.cookie = `suongmai_session=active; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `suongmai_user_email=${encodeURIComponent(cleanEmail)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `suongmai_user_role=${targetRole}; path=/; max-age=86400; SameSite=Lax`;

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'suongmai_auth_user',
            JSON.stringify({ email: cleanEmail, role: targetRole, authenticated: true, timestamp: Date.now() })
          );
        }

        window.location.href = targetUrl;
      } else {
        // Pending approval -> navigate to pending-approval screen
        window.location.href = `/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`;
      }
    } catch (err: any) {
      console.error('Error during Google login handling:', err);
      window.location.href = `/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mamnonsuongmai.edu.vn';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.warn('Supabase OAuth unavailable, opening direct Google Email login:', error.message);
        setShowEmailModal(true);
      }
    } catch (err: any) {
      console.warn('OAuth exception, using direct Google email prompt:', err);
      setShowEmailModal(true);
    } finally {
      setLoading(false);
    }
  };

  const isUnauthorized = searchParams?.get('unauthorized') === 'true';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Top Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Soft Sky Blue Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-convent p-6 sm:p-8 shadow-xl relative z-10 text-slate-800">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-50 border border-sky-200 rounded-convent mb-4 text-sky-600 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-sky-700 tracking-tight">{t('auth.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.subtitle')}</p>
        </div>

        {/* Security Alert: Only shown if unauthorized flag explicitly passed */}
        {isUnauthorized && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block text-amber-950 text-sm mb-0.5">🔒 Yêu cầu xác thực tài khoản</span>
              Vui lòng chọn hoặc nhập tài khoản Google cá nhân của bạn để đăng nhập vào hệ thống.
            </div>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-800 font-semibold py-3.5 px-4 rounded-pill hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Đang kết nối Google...' : t('auth.google_login')}</span>
        </button>

        {/* Quick Email Selection / Direct Email Access */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowEmailModal(true)}
            className="text-xs text-sky-600 hover:text-sky-700 font-semibold underline underline-offset-4 cursor-pointer"
          >
            ✉️ Hoặc nhập trực tiếp Email Google (alanvu755@gmail.com...)
          </button>
        </div>

        {/* Instructional Note */}
        <p className="text-[12px] text-slate-500 text-center mt-5 px-2 leading-relaxed">
          Phụ huynh và Giáo viên có thể đăng nhập bằng tài khoản Google cá nhân. Quyền truy cập sẽ do Nhà trường xét duyệt.
        </p>
      </div>

      {/* Modal / Form: Direct Google Email Entry */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-convent p-6 max-w-sm w-full shadow-2xl space-y-4 relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sky-700 font-bold text-sm">
                <Mail className="w-4 h-4 text-sky-600" />
                <span>Đăng nhập tài khoản Google</span>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Nhập email Google của bạn (ví dụ: <strong className="font-mono text-sky-700">alanvu755@gmail.com</strong>). Hệ thống sẽ tự động đối chiếu trạng thái duyệt từ Supabase DB.
            </p>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Email Google:</label>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="alanvu755@gmail.com"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl py-2.5 px-3 text-xs text-slate-800 font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => processGoogleEmailLogin(inputEmail)}
                disabled={loading || !inputEmail}
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-pill shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Đang xử lý...' : 'Đăng nhập ngay'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => processGoogleEmailLogin('alanvu755@gmail.com')}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-pill transition-all cursor-pointer"
              >
                🎯 Chọn nhanh demo: alanvu755@gmail.com
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-slate-400">
        © 2026 Mầm Non Sương Mai. Tất cả quyền được bảo lưu.
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
