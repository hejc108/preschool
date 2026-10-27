'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, UtensilsCrossed, HeartPulse, UserPlus, Users, Sparkles, 
  Clock, Bell, LogOut, Smartphone, ChefHat, Mail, UserCheck, KeyRound, ShieldCheck, QrCode,
  Menu, X
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/lib/supabase/client';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [userFullName, setUserFullName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let role = '';
      let email = '';
      let uname = '';
      let fname = '';

      // 1. Read from signed cookies
      const matchRole = document.cookie.match(/suongmai_user_role=([^;]+)/);
      if (matchRole) role = parseSignedCookieClient(matchRole[1]);

      const matchEmail = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (matchEmail) email = parseSignedCookieClient(matchEmail[1]).toLowerCase().trim();

      const matchUser = document.cookie.match(/suongmai_username=([^;]+)/);
      if (matchUser) uname = parseSignedCookieClient(matchUser[1]);

      // 2. Read from localStorage session
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.role) role = parsed.role;
          if (parsed.email) email = parsed.email.toLowerCase().trim();
          if (parsed.username) uname = parsed.username;
          if (parsed.full_name) fname = parsed.full_name;
        } catch (e) {}
      }

      setUserRole(role);
      setUsername(uname);
      setUserEmail(email);
      setUserFullName(fname);
    }
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // If viewing the admin login page, bypass the Admin Sidebar & Header layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const isStaff = userRole === 'STAFF';

  const mainNavItems: { label: string; href: string; icon: React.ElementType; badge?: string }[] = isStaff ? [
    { label: t('admin.sidebar.menu_matrix'), href: '/admin/menu', icon: UtensilsCrossed, badge: '4 Tuần' },
    { label: t('admin.sidebar.health_tracker'), href: '/admin/health', icon: HeartPulse, badge: 'WHO' },
  ] : [
    { label: t('admin.sidebar.dashboard'), href: '/admin/dashboard', icon: LayoutDashboard },
    { label: t('admin.sidebar.menu_matrix'), href: '/admin/menu', icon: UtensilsCrossed, badge: '4 Tuần' },
    { label: t('admin.sidebar.health_tracker'), href: '/admin/health', icon: HeartPulse, badge: 'WHO' },
    { label: t('admin.sidebar.kitchen'), href: '/admin/kitchen', icon: ChefHat },
    { label: t('admin.sidebar.admissions'), href: '/admin/admissions', icon: UserPlus },
    { label: t('admin.sidebar.children_parents'), href: '/admin/students', icon: Users },
    { label: 'Mã QR', href: '/admin/qr-codes', icon: QrCode, badge: 'Standee' },
  ];

  const aiNavItems: { label: string; href: string; icon: React.ElementType; badge?: string }[] = [
    { label: t('admin.sidebar.ai_lessons'), href: '/teacher/lesson-plans/new', icon: Sparkles, badge: 'AI 5.0' },
  ];

  const cleanEmail = (userEmail || '').toLowerCase().trim();
  // CHỐT CHẶN 1 (STRICT EQUALITY): Chỉ SUPER_ADMIN hoặc tài khoản sadmin mới thấy menu nhạy cảm.
  // Khóa chặt: hejc108@gmail.com (Role: ADMIN / STAFF) tuyệt đối KHÔNG ĐƯỢC thấy menu này.
  const isSuperAdmin =
    cleanEmail !== 'hejc108@gmail.com' &&
    cleanEmail !== 'luciaxuan178@gmail.com' &&
    (userRole === 'SUPER_ADMIN' ||
      cleanEmail === 'sadmin@suongmai.edu.vn');

  const settingsNavItems: { label: string; href: string; icon: React.ElementType; badge?: string }[] = [
    { label: 'Duyệt phân quyền', href: '/admin/users/approvals', icon: UserCheck, badge: 'Mới' },
    { label: 'Quản lý tài khoản', href: '/admin/users', icon: Users },
    ...(isSuperAdmin
      ? [
          { label: 'Đổi mật khẩu', href: '/admin/settings/security', icon: KeyRound },
          { label: 'Cấu hình Email hệ thống', href: '/admin/settings/email', icon: Mail },
        ]
      : []),
  ];

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      if (supabase && supabase.auth) {
        await supabase.auth.signOut();
      }
    } catch (err) {}

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {}

    const cookiesToClear = [
      'suongmai_session',
      'suongmai_user_email',
      'suongmai_user_role',
      'suongmai_username',
      'suongmai_has_children',
    ];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });

    if (typeof window !== 'undefined') {
      localStorage.removeItem('suongmai_auth_user');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      // Điều hướng sau đăng xuất:
      // - Tài khoản sadmin nội bộ -> chuyển về /admin/login
      // - Toàn bộ tài khoản khác (Google login, Admin, Staff, GV, Phụ huynh) -> chuyển về /auth
      const isDedicatedSadmin = username === 'sadmin' && cleanEmail === 'sadmin@suongmai.edu.vn';
      window.location.href = isDedicatedSadmin ? '/admin/login' : '/auth';
    }
  };

  const isSuperAdminUser =
    cleanEmail !== 'hejc108@gmail.com' &&
    (userRole === 'SUPER_ADMIN' || cleanEmail === 'sadmin@suongmai.edu.vn');

  const displayName =
    userFullName ||
    (isSuperAdminUser
      ? 'Quản Trị Tối Cao (Super Admin)'
      : userEmail || t('admin.header.principal'));

  const displaySubtitle = isSuperAdminUser
    ? 'Hệ Thống Sương Mai'
    : (userRole === 'STAFF' ? 'Nhân Viên Sương Mai' : 'BGH Sương Mai');

  const getInitials = (name: string) => {
    if (isSuperAdminUser) return 'SA';
    if (!name) return 'SM';
    const clean = name.replace(/\(.*?\)/g, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase() || 'SM';
  };

  const renderNavContent = () => (
    <>
      {/* Official Brand Header */}
      <div className="p-4 border-b border-rose-100 flex items-center justify-between bg-gradient-to-r from-rose-50 to-amber-50/60">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-primary-700 via-secondary-500 to-primary-600 shadow-md shrink-0">
            <img 
              src="/images/logo.png" 
              alt="Mầm Non Sương Mai Logo" 
              className="w-full h-full object-cover rounded-full bg-white"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-primary-900 tracking-tight text-base leading-tight whitespace-nowrap">
              Mầm Non Sương Mai
            </h1>
            <p className="text-[11px] font-semibold text-secondary-600 truncate">Hệ Thống Quản Trị</p>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-rose-100 transition-colors"
          title="Đóng Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('admin.sidebar.group_operations')}</div>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-primary-700 to-primary-600 text-white shadow-md shadow-primary-900/10 font-semibold'
                  : 'text-slate-700 hover:text-primary-900 hover:bg-rose-50/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-secondary-500 text-white' : 'bg-rose-100 text-primary-800'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* AI Section (Only for Non-Staff) */}
        {!isStaff && (
          <>
            <div className="pt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('admin.sidebar.group_ai')}</div>
            {aiNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-700 via-primary-600 to-secondary-600 text-white shadow-md font-semibold'
                      : 'text-slate-700 hover:text-primary-900 hover:bg-rose-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-secondary-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-secondary-500 text-white' : 'bg-amber-100 text-secondary-700 animate-pulse'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Settings Section */}
            <div className="pt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Hệ thống</div>
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-700 to-primary-600 text-white shadow-md font-semibold'
                      : 'text-slate-700 hover:text-primary-900 hover:bg-rose-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-rose-100 bg-rose-50/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-700 to-secondary-500 p-0.5 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
            <div className="w-full h-full rounded-full bg-primary-700 flex items-center justify-center">
              {getInitials(displayName)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary-900 truncate" title={displayName}>
              {displayName}
            </p>
            <span className="text-[10px] text-slate-500 font-medium truncate block">
              {displaySubtitle}
            </span>
          </div>
        </div>
        <button 
          type="button"
          onClick={handleLogout}
          title={t('admin.sidebar.logout')} 
          className="text-slate-400 hover:text-primary-700 hover:bg-rose-100/60 rounded-lg transition-colors p-1.5 shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface-base text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-surface-sidebar border-r border-rose-100 text-slate-800 flex-col shrink-0 shadow-sm print:hidden">
        {renderNavContent()}
      </aside>

      {/* Mobile Slide-Over Drawer (Only visible on Mobile when open) */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[998] md:hidden animate-in fade-in duration-200"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-surface-sidebar z-[999] flex flex-col shadow-2xl transition-transform duration-300 border-r border-rose-100 md:hidden ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {renderNavContent()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-base">
        {/* Sticky Top Header (Fixed at top for both Mobile & Desktop) */}
        <header className="h-16 bg-white border-b border-rose-100 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile Drawer */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:text-primary-800 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Mở Menu"
            >
              <Menu className="w-6 h-6 text-primary-700" />
            </button>

            {/* Mobile Only: Brand Logo when Sidebar is hidden */}
            <div className="flex items-center gap-2.5 md:hidden">
              <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-primary-700 to-secondary-500 shadow-sm shrink-0">
                <img
                  src="/images/logo.png"
                  alt="Mầm Non Sương Mai"
                  className="w-full h-full object-cover rounded-full bg-white"
                />
              </div>
              <div className="flex items-center gap-2 text-primary-900 font-bold text-sm">
                <span className="truncate">Sương Mai Admin</span>
              </div>
            </div>

            {/* Desktop Only: Elegant Breadcrumb instead of duplicate Logo */}
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Hệ thống quản trị</span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-primary-900 text-sm">Quản lý vận hành Sương Mai</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            <button className="relative p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-600 border border-slate-200 transition-colors">
              <Bell className="w-4 h-4 text-primary-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary-500 rounded-full animate-pulse" />
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
