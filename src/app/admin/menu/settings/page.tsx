'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Utensils } from 'lucide-react';
import { MenuCycleSettingsPanel } from '@/components/admin/MenuCycleSettingsPanel';

export default function AdminMenuSettingsPage() {
  return (
    <div className="min-h-screen bg-surface-base text-slate-800 flex flex-col font-sans">
      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/menu"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shadow-sm shrink-0 transition-colors"
            title="Quay lại quản lý thực đơn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-800 text-lg sm:text-xl leading-tight">
              Cấu hình chu kỳ thực đơn theo tháng
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Điều chỉnh chế độ xoay vòng tự động hoặc chỉ định thủ công theo lịch đi học Thứ 2 – Thứ 6
            </p>
          </div>
        </div>

        <Link
          href="/admin/menu"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors self-end sm:self-auto"
        >
          <Utensils className="w-4 h-4 text-primary-700" />
          <span>Chỉnh sửa món ăn 4 tuần</span>
        </Link>
      </div>

      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        <MenuCycleSettingsPanel />
      </div>
    </div>
  );
}
