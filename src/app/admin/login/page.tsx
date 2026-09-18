'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, Eye, EyeOff, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('sadmin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Vui lòng nhập tên đăng nhập và mật khẩu!');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Save local session info
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'suongmai_auth_user',
            JSON.stringify(data.user || { role: 'SUPER_ADMIN', email: 'sadmin@suongmai.edu.vn', username: 'sadmin' })
          );
        }

        // Set client cookies as well
        document.cookie = "suongmai_session=active; path=/; max-age=86400; SameSite=Lax";
        document.cookie = "suongmai_user_email=sadmin@suongmai.edu.vn; path=/; max-age=86400; SameSite=Lax";
        document.cookie = "suongmai_user_role=SUPER_ADMIN; path=/; max-age=86400; SameSite=Lax";
        document.cookie = "suongmai_username=sadmin; path=/; max-age=86400; SameSite=Lax";

        router.push('/admin/dashboard');
      } else {
        setErrorMsg(data.message || 'Tài khoản hoặc mật khẩu Quản trị không đúng!');
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối tới máy chủ xác thực Quản trị!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Top Bar */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Decorative Background Spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-md">
        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-2xl mb-4 text-white shadow-lg ring-4 ring-indigo-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Cổng Đăng Nhập Quản Trị 🔒
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dành riêng cho Ban Giám Hiệu & Super Admin Trường Mầm Non Sương Mai
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Tên đăng nhập Quản trị:
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="sadmin"
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Mật khẩu:
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-sky-500 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Default Credential Helper Badge */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Tài khoản khởi tạo: <strong className="text-sky-400 font-mono">sadmin</strong></span>
            <span>Mật khẩu: <strong className="text-amber-400 font-mono">abcd@1234</strong></span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Đang xác thực...</span>
            ) : (
              <>
                <span>Đăng nhập hệ thống Quản trị</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
          <a
            href="/auth"
            className="text-xs text-slate-400 hover:text-sky-400 transition-colors inline-flex items-center gap-1"
          >
            <span>Dành cho Phụ huynh / Giáo viên? Đăng nhập Google tại đây</span>
          </a>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        © 2026 Mầm Non Sương Mai • Cổng Quản Trị Nội Bộ (Super Admin)
      </footer>
    </div>
  );
}
