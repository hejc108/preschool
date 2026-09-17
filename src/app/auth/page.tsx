'use client';

import React, { useState, Suspense } from 'react';
import { Mail, ShieldCheck, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

import { checkUserApprovalStatus } from '@/lib/utils/approvalHelper';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/admin/dashboard';
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [loading, setLoading] = useState(false);

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
        console.error('Supabase OAuth error:', error);
        alert('Lỗi đăng nhập Google: ' + error.message);
      }
    } catch (err: any) {
      console.error('Supabase OAuth exception:', err?.message || err);
      alert('Lỗi đăng nhập Google: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const identifier = email.trim();
    const formattedEmail = identifier.includes('@') ? identifier : `${identifier}@suongmai.edu.vn`;
    setEmail(formattedEmail);
    setTimeout(() => {
      setLoading(false);
      setStep('OTP');
    }, 800);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const checkStatus = checkUserApprovalStatus(email);

    // Save session cookie & localStorage user state for security middleware
    document.cookie = "suongmai_session=active; path=/; max-age=86400; SameSite=Lax";
    const authData = { 
      email, 
      role: checkStatus.profile?.role || (email.includes('teacher') ? 'TEACHER' : email.includes('parent') ? 'PARENT' : 'SUPER_ADMIN'),
      authenticated: true, 
      timestamp: Date.now() 
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('suongmai_auth_user', JSON.stringify(authData));
    }

    setTimeout(() => {
      setLoading(false);
      router.push(checkStatus.redirectUrl);
    }, 800);
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

        {/* Security Alert: Unauthorized Access Attempt Blocked */}
        {isUnauthorized && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-start gap-2.5 shadow-sm animate-pulse">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block text-rose-950 text-sm mb-0.5">🔒 Yêu cầu xác thực đăng nhập</span>
              Trình duyệt của bạn chưa có phiên đăng nhập hợp lệ. Vui lòng đăng nhập tài khoản trước khi truy cập trang hệ thống.
            </div>
          </div>
        )}

        {/* Local Inbucket Testing Banner (Hiển thị cho môi trường Dev cục bộ) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mb-6 p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-sky-900">Local Dev Inbucket OTP:</span> {t('auth.inbucket_notice')}{' '}
              <a href="http://localhost:54324" target="_blank" rel="noreferrer" className="underline font-mono text-sky-700 hover:text-sky-800">
                http://localhost:54324
              </a>.
            </div>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-800 font-semibold py-3 px-4 rounded-pill hover:bg-slate-50 transition-all shadow-sm mb-6 active:scale-[0.98] disabled:opacity-50"
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
          {t('auth.google_login')}
        </button>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative bg-white px-3 text-xs text-slate-400 font-medium">{t('auth.or_otp')}</span>
        </div>

        {/* Username / Email Form */}
        {step === 'EMAIL' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                {t('auth.email_label')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin (hoặc admin@suongmai.edu.vn)"
                  required
                  className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl py-3 pl-11 pr-4 text-slate-800 placeholder-slate-400 text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Quick Account Selection Chips */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400 font-medium">Tài khoản mẫu:</span>
                <button
                  type="button"
                  onClick={() => setEmail('admin')}
                  className="px-2 py-0.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-md font-mono font-bold transition-all"
                >
                  admin
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('so.maria')}
                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md font-mono font-bold transition-all"
                >
                  so.maria
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('teacher')}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-md font-mono font-bold transition-all"
                >
                  teacher
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('teacher.pending@suongmai.edu.vn')}
                  className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-md font-mono font-bold transition-all"
                  title="Giáo viên chờ duyệt"
                >
                  teacher.pending
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('parent.pending@gmail.com')}
                  className="px-2 py-0.5 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-md font-mono font-bold transition-all"
                  title="Phụ huynh chờ duyệt"
                >
                  parent.pending
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 px-4 rounded-pill transition-all shadow-md shadow-sky-600/20 active:scale-[0.98]"
            >
              {loading ? (
                <span className="text-sm">{t('auth.sending_otp')}</span>
              ) : (
                <>
                  <span>{t('auth.send_otp')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đã gửi mã OTP 6 chữ số đến {email}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                {t('auth.enter_otp')}
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl py-3 pl-11 pr-4 text-slate-800 placeholder-slate-400 text-base tracking-widest font-mono focus:outline-none transition-colors text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-pill transition-all shadow-md active:scale-[0.98]"
            >
              {loading ? t('auth.verifying') : t('auth.verify_login')}
            </button>

            <button
              type="button"
              onClick={() => setStep('EMAIL')}
              className="w-full text-xs text-slate-400 hover:text-slate-800 transition-colors pt-2"
            >
              {t('auth.change_email')}
            </button>
          </form>
        )}
      </div>

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
