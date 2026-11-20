'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, ShieldAlert } from 'lucide-react';
import { MobilePortalRole, useActiveRole } from '@/components/auth/ActiveRoleContext';
import { TeacherPortalView } from '@/components/pwa/TeacherPortalView';
import { ParentPortalView } from '@/components/pwa/ParentPortalView';
import { getBrowserSupabaseClient } from '@/lib/supabase/client';

/**
 * DualRoleShell hosts both Teacher and Parent mobile PWA portals in a single
 * layout wrapper so dual-role users switch between /teacher and /parent
 * cleanly via Optimistic React state + history.replaceState without blocking screens.
 * Mobile PWA stays completely decoupled from Admin Web (no Admin toggle, no /admin links).
 */
export function DualRoleShell({ initialPortal }: { initialPortal: MobilePortalRole }) {
  const {
    isLoading,
    isAuthenticated,
    isApproved,
    email,
    roles,
    activeRole,
    switchRole,
    logout,
  } = useActiveRole();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const didAlignInitialPortalRef = useRef(false);

  // Align active_role silently in background on direct entry without blocking render
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isApproved || didAlignInitialPortalRef.current) return;
    didAlignInitialPortalRef.current = true;

    const targetRole: MobilePortalRole | null =
      roles.includes(initialPortal) && activeRole !== initialPortal
        ? initialPortal
        : activeRole !== 'TEACHER' && activeRole !== 'PARENT'
        ? roles.includes('TEACHER')
          ? 'TEACHER'
          : roles.includes('PARENT')
          ? 'PARENT'
          : null
        : null;

    if (targetRole) {
      void switchRole(targetRole, { syncUrl: targetRole !== initialPortal });
    }
  }, [
    isLoading,
    isAuthenticated,
    isApproved,
    roles,
    activeRole,
    initialPortal,
    switchRole,
  ]);

  // Redirect unapproved logged-in users cleanly to pending approval
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isApproved && email) {
      const pendingType = initialPortal === 'TEACHER' ? 'teacher' : 'parent';
      window.location.href = `/auth/pending-approval?type=${pendingType}&email=${encodeURIComponent(
        email
      )}`;
    }
  }, [isLoading, isAuthenticated, isApproved, email, initialPortal]);

  const handleInPlaceGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const activeSupabase = await getBrowserSupabaseClient();
      const nextPath = initialPortal === 'TEACHER' ? '/teacher' : '/parent';
      await activeSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${nextPath}`,
        },
      });
    } catch (err) {
      console.error('In-place Google login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-dvh bg-slate-50 max-w-md mx-auto border-x border-slate-200 shadow-2xl font-sans w-full" />
    );
  }

  if (!isAuthenticated) {
    const isTeacherLogin = initialPortal === 'TEACHER';
    return (
      <div className="min-h-dvh w-full max-w-full bg-gradient-to-b from-slate-50 via-surface-base to-slate-100 text-slate-800 flex flex-col justify-center items-center p-4 font-sans overflow-x-hidden">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl text-center">
          <div className="w-24 h-24 rounded-3xl p-1.5 bg-gradient-to-tr from-primary-700 via-secondary-500 to-primary-600 mx-auto mb-5 shadow-md flex items-center justify-center">
            <img
              src="/images/logo.png"
              alt="Mầm Non Sương Mai Logo"
              className="w-full h-full object-contain rounded-2xl bg-white p-1"
            />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {isTeacherLogin ? 'Cổng Tác Nghiệp Giáo Viên' : 'Sổ Liên Lạc Điện Tử'}
          </h1>
          <p className="text-primary-700 font-bold text-sm sm:text-base mt-1.5 mb-6">
            Trường Mầm Non Sương Mai
          </p>

          <button
            onClick={handleInPlaceGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3.5 bg-white border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-bold py-4 px-5 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-base sm:text-lg min-h-[56px] mb-5"
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
              {isLoggingIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}
            </span>
          </button>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            {isTeacherLogin
              ? 'Dành cho Giáo viên trường Mầm Non Sương Mai.'
              : 'Dành cho Phụ huynh học sinh trường Mầm Non Sương Mai.'}
          </p>
        </div>
      </div>
    );
  }

  // Decide active mobile portal without granting cross-portal access when role is missing
  const effectivePortal: MobilePortalRole =
    activeRole === 'PARENT' || (!roles.includes('TEACHER') && roles.includes('PARENT'))
      ? 'PARENT'
      : 'TEACHER';

  if (
    effectivePortal === 'TEACHER' &&
    !roles.includes('TEACHER') &&
    !roles.includes('SCHOOL_ADMIN') &&
    !roles.includes('SUPER_ADMIN')
  ) {
    if (roles.includes('PARENT')) {
      return <ParentPortalView />;
    }
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-100 rounded-2xl text-slate-600 mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
          <p className="text-xs text-slate-600">
            Tài khoản <span className="font-semibold">{email}</span> chưa được cấp vai trò hợp lệ trên cổng di động.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/auth"
              className="w-full py-2.5 bg-slate-800 text-white text-xs font-bold rounded-full"
            >
              Về trang đăng nhập
            </Link>
            <button
              onClick={logout}
              className="w-full py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return effectivePortal === 'PARENT' ? <ParentPortalView /> : <TeacherPortalView />;
}
