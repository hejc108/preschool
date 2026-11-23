'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

export function AuthClient() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/admin/dashboard';
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tự động dọn dẹp các cache PWA cũ và kích hoạt kiểm tra cập nhật Service Worker tức thì
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key !== 'suongmai-pwa-v31' && key !== 'suongmai-data-v3') {
              caches.delete(key);
            }
          });
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.update().catch(() => {}));
        });
      }
    }
  }, []);

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
    <div className="min-h-dvh w-full max-w-full bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-100/50 via-slate-50 to-amber-50/40 text-slate-800 flex flex-col justify-between items-center py-4 px-4 sm:py-8 sm:px-6 relative overflow-x-hidden font-sans">
      {/* 1. Header Row: Anchored at top of mobile screen */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between px-1 pt-1 pb-2 z-20 shrink-0">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-slate-200/90 px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-600 animate-pulse" />
          <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">Cổng Trực Tuyến</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* 2. Main Content Area: Pure Single-Column Focus on ALL screen sizes */}
      <main className="w-full max-w-md mx-auto my-auto py-3 z-10 flex flex-col items-center justify-center">
        <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 text-slate-800 backdrop-blur-sm">
          {/* Header with School Logo & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-red-50 via-white to-amber-50 border-2 border-red-200/90 rounded-3xl mb-4 text-primary-700 shadow-md p-2.5 relative mx-auto">
              <img
                src="/images/logo.png"
                alt="Logo Mầm Non Sương Mai"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.auth-fallback-icon');
                  if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                }}
              />
              <Sparkles className="auth-fallback-icon w-12 h-12 text-primary-700 hidden" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {t('auth.title')}
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1.5 font-medium">
              {t('auth.subtitle')}
            </p>
          </div>

          {/* Error Notification Alert */}
          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">Đăng nhập không thành công</p>
                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* Prominent Google OAuth Button: min-h-[56px] text-base sm:text-lg font-bold */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300 hover:border-slate-400 text-slate-800 font-bold py-4 px-5 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer text-base sm:text-lg min-h-[56px]"
          >
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
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
            <span className="text-base sm:text-lg font-bold text-slate-800">
              {loading ? 'Đang xác thực...' : t('auth.google_login')}
            </span>
          </button>

          {/* Security Notice: Concise & Neutral */}
          <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-center">
            <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-medium">
              {t('auth.security_notice')}
            </p>
          </div>
        </div>
      </main>

      {/* 3. Footer: Anchored at bottom with self-heal cache refresh button */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-slate-400 py-3 z-10 shrink-0 flex flex-col items-center gap-2">
        <div>© 2026 Mầm Non Sương Mai. Tất cả quyền được bảo lưu.</div>
        <button
          type="button"
          onClick={async () => {
            if (typeof window !== 'undefined') {
              try {
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map((k) => caches.delete(k)));
                }
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map((r) => r.unregister()));
                }
              } catch (_) {}
              window.location.reload();
            }
          }}
          className="text-xs text-primary-700 hover:text-primary-800 bg-red-50/90 hover:bg-red-100 border border-red-200/90 font-semibold px-3.5 py-1.5 rounded-full shadow-xs cursor-pointer transition-all"
        >
          🔄 Tải lại giao diện mới nhất
        </button>
      </footer>
    </div>
  );
}
