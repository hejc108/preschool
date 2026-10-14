'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, UserCheck, Shield, Crown, Search, CheckCircle2, XCircle, ArrowRight, Download, Filter } from 'lucide-react';
import { Profile } from '@/lib/types/schema';
import { fetchLiveProfilesFromSupabase } from '@/lib/utils/approvalHelper';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';

export default function UsersManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [showTemporary, setShowTemporary] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    (async () => {
      const list = await fetchLiveProfilesFromSupabase();
      setProfiles(list);
    })();

    if (typeof window !== 'undefined') {
      let role = '';
      let email = '';
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          role = parsed.role || '';
          email = (parsed.email || '').toLowerCase().trim();
        } catch (e) {}
      }
      const matchRole = document.cookie.match(/suongmai_user_role=([^;]+)/);
      if (matchRole) role = parseSignedCookieClient(matchRole[1]);
      const matchEmail = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (matchEmail) email = parseSignedCookieClient(matchEmail[1]).toLowerCase().trim();

      const cleanEmail = email.toLowerCase().trim();
      const isSuper =
        cleanEmail !== 'hejc108@gmail.com' &&
        (role === 'SUPER_ADMIN' ||
          cleanEmail === 'luciaxuan178@gmail.com' ||
          cleanEmail === 'sadmin@suongmai.edu.vn');
      setIsSuperAdmin(isSuper);
    }
  }, []);

  const filtered = profiles.filter((p) => {
    // Super Admin Toggle: Ẩn giáo viên thời vụ nếu không phải Super Admin hoặc Toggle đang tắt
    if (p.is_temporary && (!isSuperAdmin || !showTemporary)) {
      return false;
    }

    if (roleFilter !== 'ALL') {
      if (roleFilter === 'STAFF_TEACHER') {
        const isPersonnel = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'STAFF', 'KITCHEN_STAFF', 'NURSE_STAFF'].includes(p.role);
        if (!isPersonnel) return false;
      } else if (roleFilter === 'PARENT') {
        if (p.role !== 'PARENT') return false;
      }
    }

    return (
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.role && p.role.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const handleExportStaffReport = () => {
    const staffProfiles = filtered.filter((p) =>
      ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'STAFF', 'KITCHEN_STAFF', 'NURSE_STAFF'].includes(p.role)
    );

    const headers = ['STT', 'Họ Và Tên', 'Email', 'Vai Trò', 'Tính Chất Hợp Đồng', 'Lớp Phân Công', 'Trạng Thái Duyệt'];
    const rows = staffProfiles.map((p, idx) => [
      idx + 1,
      `"${p.full_name}"`,
      `"${p.email}"`,
      `"${p.role}"`,
      `"${p.is_temporary ? 'Thời vụ' : 'Chính thức'}"`,
      `"${p.assigned_class_name || '—'}"`,
      `"${p.approval_status === 'ACTIVE' ? 'Đã duyệt' : 'Chờ duyệt'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_Nhan_Su_GVNV_Suong_Mai_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200 rounded-pill text-primary-800 text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5 text-primary-700" />
            <span>Quản lý tài khoản</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Danh sách tất cả người dùng trong hệ thống</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng quan tài khoản Super Admin, Quản trị trường, Giáo viên, Cán bộ Bếp/Y tế & Phụ huynh.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStaffReport}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-pill shadow-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            title="Xuất danh sách cán bộ, giáo viên và nhân viên ra file Excel (.csv)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất báo cáo GVNV</span>
          </button>

          <Link
            href="/admin/users/approvals"
            className="px-4.5 py-2.5 bg-[#FB8C00] hover:bg-[#F57C00] text-white font-bold text-xs rounded-pill shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto active:scale-95"
          >
            <UserCheck className="w-4 h-4" />
            <span>Màn hình Duyệt phân quyền</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email, vai trò..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-pill px-3 py-1.5 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả đối tượng</option>
              <option value="STAFF_TEACHER">Cán bộ & Giáo viên (GVNV)</option>
              <option value="PARENT">Phụ huynh</option>
            </select>
          </div>
        </div>

        {/* SUPER_ADMIN Toggle: Hiển thị giáo viên thời vụ */}
        {isSuperAdmin && (
          <label className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100/80 border border-amber-300 rounded-pill px-3.5 py-2 text-xs text-amber-900 font-bold cursor-pointer select-none transition-colors shadow-2xs">
            <input
              type="checkbox"
              checked={showTemporary}
              onChange={(e) => setShowTemporary(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer accent-amber-600"
            />
            <span>Hiển thị giáo viên thời vụ</span>
          </label>
        )}
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
                      {p.is_temporary && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Thời vụ
                        </span>
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
                  <td className="py-3.5 px-4 text-right">
                    {p.assigned_class_name ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {p.assigned_class_name.split(',').map((cName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-[10px] font-bold"
                          >
                            {cName.trim()}
                          </span>
                        ))}
                      </div>
                    ) : p.created_at ? (
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(p.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
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
