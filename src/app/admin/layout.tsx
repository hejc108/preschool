'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, UtensilsCrossed, HeartPulse, UserPlus, Users, Sparkles, 
  Clock, Bell, LogOut, Smartphone, ChefHat, Mail 
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [userRole, setUserRole] = useState<string>('SUPER_ADMIN');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.role) setUserRole(parsed.role);
        } catch (e) {}
      }
    }
  }, []);

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
  ];

  const aiNavItems: { label: string; href: string; icon: React.ElementType; badge?: string }[] = [
    { label: t('admin.sidebar.ai_lessons'), href: '/teacher/lesson-plans/new', icon: Sparkles, badge: 'AI 5.0' },
  ];

  const settingsNavItems: { label: string; href: string; icon: React.ElementType; badge?: string }[] = [
    { label: 'Cấu hình email', href: '/admin/settings/email', icon: Mail },
  ];

  const handleLogout = () => {
    document.cookie = "suongmai_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    if (typeof window !== 'undefined') {
      localStorage.removeItem('suongmai_auth_user');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Sidebar - Pastel Sky Blue (#F0F9FF) */}
      <aside className="w-full md:w-64 bg-sky-50 border-b md:border-b-0 md:border-r border-sky-100 text-slate-800 flex flex-col shrink-0 shadow-sm">
        {/* Brand Header */}
        <div className="p-5 border-b border-sky-100 flex items-center gap-3 bg-sky-100/40">
          <div className="w-10 h-10 bg-sky-500 border border-sky-400 rounded-convent flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sky-900 tracking-tight text-base leading-tight whitespace-nowrap">{t('common.school_name')}</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('admin.sidebar.group_operations')}</div>
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm font-semibold'
                    : 'text-slate-700 hover:text-sky-900 hover:bg-sky-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-700'
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
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:text-sky-900 hover:bg-sky-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-sky-600'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isActive ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700 animate-pulse'
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
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:text-sky-900 hover:bg-sky-100/70'
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

          <div className="pt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('admin.sidebar.group_mobile')}</div>
          <Link
            href="/teacher"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-700 hover:text-sky-900 hover:bg-sky-100/70 transition-all"
          >
            <Smartphone className="w-4 h-4 text-sky-600" />
            <span>{t('admin.sidebar.teacher_app')}</span>
          </Link>
          <Link
            href="/parent"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-700 hover:text-sky-900 hover:bg-sky-100/70 transition-all"
          >
            <Smartphone className="w-4 h-4 text-sky-600" />
            <span>{t('admin.sidebar.parent_app')}</span>
          </Link>
        </nav>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-sky-100 bg-sky-100/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-600 border border-sky-500 flex items-center justify-center text-xs font-bold text-white">
              SĐ
            </div>
            <div>
              <p className="text-xs font-bold text-sky-950">{t('admin.header.principal')}</p>
            </div>
          </div>
          <Link 
            href="/auth" 
            onClick={handleLogout}
            title={t('admin.sidebar.logout')} 
            className="text-slate-400 hover:text-sky-700 transition-colors p-1.5"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            <button className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
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
