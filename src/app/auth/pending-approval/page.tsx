'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, ShieldAlert, Phone, LogOut, RefreshCw, UserX, CheckCircle2 } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';

function PendingApprovalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams?.get('type') || 'parent';
  const emailParam = searchParams?.get('email') || '';

  const [email, setEmail] = useState<string>(emailParam);
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null);
  const isRedirectingRef = useRef(false);

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

  // Check live approval status from DB & update session cookies
  const handleCheckApproval = useCallback(async () => {
    if (!email || isRedirectingRef.current) return;
    setChecking(true);

    try {
      const res = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success && data.isApproved && !isRedirectingRef.current) {
        isRedirectingRef.current = true;
        setStatusMsg('🎉 Đã phê duyệt! Đang chuyển hướng vào hệ thống...');
        
        if (typeof window !== 'undefined') {
          const targetRole = data.role || 'PARENT';
          let targetUrl = data.redirectUrl || '/parent';
          if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(targetRole)) {
            targetUrl = '/admin/dashboard';
          } else if (targetRole === 'TEACHER') {
            targetUrl = '/teacher';
          } else if (targetRole === 'PARENT') {
            targetUrl = '/parent';
          }

          // Write session cookies to document synchronously before navigating
          document.cookie = `suongmai_session=active; path=/; max-age=86400; SameSite=Lax`;
          document.cookie = `suongmai_user_email=${encodeURIComponent(email)}; path=/; max-age=86400; SameSite=Lax`;
          document.cookie = `suongmai_user_role=${targetRole}; path=/; max-age=86400; SameSite=Lax`;

          localStorage.setItem(
            'suongmai_auth_user',
            JSON.stringify({ email, role: targetRole, authenticated: true, timestamp: Date.now() })
          );

          setTimeout(() => {
            window.location.href = targetUrl;
          }, 300);
        }
      } else if (data.status === 'REJECTED') {
        setRejectedMsg('Yêu cầu truy cập của bạn đã bị Từ chối bởi Ban Giám Hiệu.');
      }
    } catch (err) {
      console.error('Error refreshing session:', err);
    } finally {
      setChecking(false);
    }
  }, [email]);

  // Real-time Supabase Subscription + Fast Polling (2.5s)
  useEffect(() => {
    if (!email || isRedirectingRef.current) return;

    // Initial check
    handleCheckApproval();

    // 1. Supabase Realtime Listener on profiles table
    let channel: any = null;
    try {
      const channelName = `profile-approval-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `email=eq.${email}`,
          },
          (payload) => {
            if (payload?.new?.approval_status === 'ACTIVE' && !isRedirectingRef.current) {
              handleCheckApproval();
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime channel subscription error:', err);
    }

    // 2. High-frequency Polling fallback (every 2.5 seconds)
    const interval = setInterval(() => {
      if (!isRedirectingRef.current) {
        handleCheckApproval();
      }
    }, 2500);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, [email, handleCheckApproval]);

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

      {/* Decorative Pastel Background Spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full bg-white border border-slate-200/90 rounded-convent p-6 sm:p-8 shadow-xl relative z-10">
        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 border border-amber-200 rounded-convent mb-4 text-amber-600 shadow-sm animate-pulse">
            {rejectedMsg ? (
              <UserX className="w-8 h-8 text-rose-500" />
            ) : type === 'teacher' ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-amber-900 tracking-tight flex items-center justify-center gap-2">
            {rejectedMsg ? 'Yêu cầu truy cập bị từ chối ❌' : 'Tài khoản đang chờ duyệt ⏳'}
          </h1>
        </div>

        {/* Dynamic Context Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-sm leading-relaxed text-slate-700 shadow-inner space-y-3">
          <p>
            Email Google <span className="font-semibold font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">{email || 'cá nhân'}</span> đã đăng nhập thành công.
          </p>
          {rejectedMsg ? (
            <p className="font-semibold text-rose-900 bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs leading-normal shadow-sm">
              {rejectedMsg}
            </p>
          ) : (
            <p className="font-medium text-amber-900 bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs leading-normal shadow-sm">
              Tài khoản của bạn đang chờ Ban Giám Hiệu phê duyệt. Ngay khi được duyệt, hệ thống sẽ tự động chuyển hướng vào trang ứng dụng.
            </p>
          )}

          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Refresh / Check Approval Button */}
          <button
            onClick={handleCheckApproval}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-4 rounded-pill transition-all shadow-md shadow-sky-600/20 active:scale-[0.98] text-sm cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái phê duyệt'}</span>
          </button>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 shadow-sm">
            <Phone className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Hotline Văn phòng: <strong>028.3896.1234</strong></span>
          </div>

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
