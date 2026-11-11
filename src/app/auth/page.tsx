'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

function AuthContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/admin/dashboard';
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Listen for auth state changes & handle Hash (#access_token=...) / Code (?code=...) URL parameters
  useEffect(() => {
    const queryError = searchParams?.get('error') || searchParams?.get('error_description');
    if (queryError) {
      setAuthError(queryError);
    }

    const parseJwt = (token: string) => {
      try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (err) {
        console.error('Lỗi bóc tách JWT token:', err);
        return null;
      }
    };

    const processUserRouting = async (
      userEmail: string,
      fullName: string = '',
      avatarUrl: string = '',
      accessToken: string = ''
    ) => {
      const cleanEmail = userEmail.toLowerCase().trim();

      try {
        await fetch('/api/users/approvals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            email: cleanEmail,
            full_name: fullName || cleanEmail.split('@')[0],
            avatar_url: avatarUrl,
          }),
        });
      } catch (err) {
        console.error('Lỗi tự động đồng bộ profile:', err);
      }

      try {
        const res = await fetch('/api/auth/refresh-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ email: cleanEmail, access_token: accessToken }),
        });
        const refreshData = await res.json();

        if (refreshData.success && refreshData.isApproved) {
          const targetRole = refreshData.activeRole || refreshData.role || 'PARENT';
          let targetUrl = refreshData.redirectUrl || '/parent';
          if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(targetRole)) {
            targetUrl = '/admin/dashboard';
          } else if (targetRole === 'TEACHER') {
            targetUrl = '/teacher';
          } else if (targetRole === 'PARENT') {
            targetUrl = '/parent';
          } else if (targetRole === 'STAFF') {
            targetUrl = '/admin/menu';
          }

          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'suongmai_auth_user',
              JSON.stringify({
                email: cleanEmail,
                role: targetRole,
                roles: refreshData.roles || [targetRole],
                authenticated: true,
                timestamp: Date.now(),
              })
            );
          }

          window.location.replace(targetUrl);
          return;
        } else {
          window.location.replace(`/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`);
          return;
        }
      } catch {
        window.location.replace(`/auth/pending-approval?email=${encodeURIComponent(cleanEmail)}`);
      }
    };

    const handleHashOrCodeAuth = async () => {
      if (typeof window === 'undefined') return;

      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const params = new URLSearchParams(search);
      const code = params.get('code');

      if (code) {
        setLoading(true);
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setAuthError(error.message);
            window.history.replaceState({}, '', `/auth?error=${encodeURIComponent(error.message)}`);
            setLoading(false);
            return;
          }

          let userEmail = data?.session?.user?.email || data?.user?.email;
          let fullName =
            data?.session?.user?.user_metadata?.full_name ||
            data?.session?.user?.user_metadata?.name ||
            data?.user?.user_metadata?.full_name ||
            '';
          let avatarUrl =
            data?.session?.user?.user_metadata?.avatar_url ||
            data?.session?.user?.user_metadata?.picture ||
            data?.user?.user_metadata?.avatar_url ||
            '';
          let accessToken = data?.session?.access_token || '';

          if (!userEmail || !accessToken) {
            const sessionRes = await supabase.auth.getSession();
            userEmail = userEmail || sessionRes.data?.session?.user?.email;
            fullName =
              fullName ||
              sessionRes.data?.session?.user?.user_metadata?.full_name ||
              sessionRes.data?.session?.user?.user_metadata?.name ||
              userEmail?.split('@')[0] ||
              '';
            avatarUrl =
              avatarUrl ||
              sessionRes.data?.session?.user?.user_metadata?.avatar_url ||
              sessionRes.data?.session?.user?.user_metadata?.picture ||
              '';
            accessToken = accessToken || sessionRes.data?.session?.access_token || '';
          }

          if (userEmail) {
            await processUserRouting(userEmail, fullName, avatarUrl, accessToken);
            return;
          } else {
            setAuthError('Không xác định được email từ mã đăng nhập');
            window.history.replaceState({}, '', '/auth');
            setLoading(false);
            return;
          }
        } catch (err: any) {
          setAuthError(err?.message || 'Lỗi runtime khi xử lý xác thực');
          window.history.replaceState({}, '', '/auth');
          setLoading(false);
          return;
        } finally {
          setLoading(false);
        }
      }

      if (hash.includes('access_token=') || hash.includes('id_token=')) {
        setLoading(true);
        let token = '';
        if (hash.includes('access_token=')) {
          token = hash.split('access_token=')[1]?.split('&')[0] || '';
        } else if (hash.includes('id_token=')) {
          token = hash.split('id_token=')[1]?.split('&')[0] || '';
        }

        if (token) {
          const payload = parseJwt(token);
          const userEmail = payload?.email;
          if (userEmail) {
            const fullName =
              payload.user_metadata?.full_name ||
              payload.user_metadata?.name ||
              payload.name ||
              userEmail.split('@')[0];
            const avatarUrl =
              payload.user_metadata?.avatar_url || payload.user_metadata?.picture || '';

            await processUserRouting(userEmail, fullName, avatarUrl, token);
            return;
          }
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user?.email) {
        const userEmail = session.user.email;
        const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail.split('@')[0];
        const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';

        await processUserRouting(userEmail, fullName, avatarUrl, session.access_token || '');
      }
    });

    handleHashOrCodeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      let activeSupabase = supabase;

      try {
        const keyRes = await fetch('/api/auth/public-key');
        const keyData = await keyRes.json();
        if (keyData.url && keyData.anonKey && !keyData.anonKey.includes('mock-key')) {
          const { createBrowserClient } = await import('@supabase/ssr');
          activeSupabase = createBrowserClient(keyData.url, keyData.anonKey);
        }
      } catch (keyErr) {
        console.warn('Could not fetch server public key:', keyErr);
      }

      const { error } = await activeSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('OAuth error:', error.message);
        let errMsg = error.message;
        if (errMsg.includes('Invalid API key')) {
          errMsg = 'Khóa API Supabase không hợp lệ. Vui lòng kiểm tra giá trị SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY trên Vercel.';
        }
        setAuthError(errMsg);
      }
    } catch (err: any) {
      console.error('OAuth exception:', err);
      setAuthError(err.message || 'Lỗi khởi tạo đăng nhập Google');
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

        {/* Error Notification Alert */}
        {authError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-convent text-red-700 text-sm flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">Đăng nhập không thành công</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{authError}</p>
            </div>
          </div>
        )}

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
