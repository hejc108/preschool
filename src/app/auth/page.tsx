'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

function AuthContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/admin/dashboard';
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  // Listen for auth state changes & handle Hash (#access_token=...) / Code (?code=...) URL parameters
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user?.email) {
        const userEmail = session.user.email;
        document.cookie = `suongmai_user_email=${encodeURIComponent(userEmail)}; path=/; max-age=86400; SameSite=Lax`;
        window.location.replace(`/auth/callback?email=${encodeURIComponent(userEmail)}`);
      }
    });

    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      if (hash.includes('access_token') || hash.includes('id_token') || search.includes('code=')) {
        setLoading(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.email) {
            const userEmail = session.user.email;
            document.cookie = `suongmai_user_email=${encodeURIComponent(userEmail)}; path=/; max-age=86400; SameSite=Lax`;
            window.location.replace(`/auth/callback?email=${encodeURIComponent(userEmail)}`);
          } else {
            const match = document.cookie.match(/suongmai_user_email=([^;]+)/);
            if (match) {
              const email = decodeURIComponent(match[1]);
              window.location.replace(`/auth/callback?email=${encodeURIComponent(email)}`);
            }
          }
        });
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const processGoogleLogin = async (emailToLogin: string = '') => {
    let cleanEmail = emailToLogin.toLowerCase().trim();
    if (!cleanEmail) {
      const input = typeof window !== 'undefined' ? prompt('Nhập email Google của bạn:') : null;
      if (!input) return;
      cleanEmail = input.toLowerCase().trim();
    }
    setLoading(true);

    try {
      document.cookie = `suongmai_user_email=${encodeURIComponent(cleanEmail)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `suongmai_user_role=GUEST; path=/; max-age=86400; SameSite=Lax`;

      await fetch('/api/users/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      }).catch(() => {});

      const res = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (data.success && data.isApproved) {
        const targetRole = data.role || 'PARENT';
        let targetUrl = data.redirectUrl || '/parent';
        if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(targetRole)) {
          targetUrl = '/admin/dashboard';
        } else if (targetRole === 'TEACHER') {
          targetUrl = '/teacher';
        } else if (targetRole === 'PARENT') {
          targetUrl = '/parent';
        }

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
        window.location.href = `/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`;
      }
    } catch (err: any) {
      window.location.href = `/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('OAuth error:', error.message);
        await processGoogleLogin();
      }
    } catch (err: any) {
      console.error('OAuth exception:', err);
      await processGoogleLogin();
    } finally {
      setLoading(false);
    }
  };

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

        {/* Standard Google OAuth Button */}
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
          <span>{loading ? 'Đang xác thực...' : t('auth.google_login')}</span>
        </button>

        {/* Instructional Note */}
        <p className="text-[12px] text-slate-500 text-center mt-5 px-2 leading-relaxed">
          Phụ huynh và Giáo viên có thể đăng nhập bằng tài khoản Google cá nhân. Quyền truy cập sẽ do Nhà trường xét duyệt.
        </p>
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
