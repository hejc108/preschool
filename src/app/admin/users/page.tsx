'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, UserCheck, Shield, Crown, Search, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Profile } from '@/lib/types/schema';
import { fetchLiveProfilesFromSupabase } from '@/lib/utils/approvalHelper';

export default function UsersManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const list = await fetchLiveProfilesFromSupabase();
      setProfiles(list);
    })();
  }, []);

  const filtered = profiles.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.role && p.role.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200 rounded-pill text-primary-800 text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5 text-primary-700" />
            <span>Quản Lý Người Dùng & Phân Quyền Vẫn Hợp (RBAC)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Danh sách tất cả người dùng trong hệ thống</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng quan tài khoản Super Admin, Quản trị trường, Giáo viên, Cán bộ Bếp/Y tế & Phụ huynh.
          </p>
        </div>

        <Link
          href="/admin/users/approvals"
          className="px-4.5 py-2.5 bg-[#FB8C00] hover:bg-[#F57C00] text-white font-bold text-xs rounded-pill shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto active:scale-95"
        >
          <UserCheck className="w-4 h-4" />
          <span>Màn hình Duyệt Tài Khoản Chờ</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, vai trò..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Họ tên & Email</th>
                <th className="py-3.5 px-4">Vai trò (Role)</th>
                <th className="py-3.5 px-4">Trạng thái duyệt</th>
                <th className="py-3.5 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{p.full_name}</span>
                      {p.role === 'SUPER_ADMIN' && (
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 font-normal">{p.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-bold">
                      {p.role || 'GUEST'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {p.approval_status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã duyệt</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <XCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{p.approval_status || 'PENDING'}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-400">
                    {p.assigned_class_name || p.created_at ? p.assigned_class_name || new Date(p.created_at || '').toLocaleDateString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
