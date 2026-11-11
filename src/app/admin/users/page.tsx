'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Crown,
  Search,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Download,
  Filter,
  Settings2,
  Baby,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import { Profile, Student, UserRole } from '@/lib/types/schema';
import { parseSignedCookieClient } from '@/lib/utils/cookieSigner';
import { DEFAULT_CLASSES_LIST } from '@/lib/constants/classes';
import { RoleBadges, normalizeDisplayRoles } from '@/components/admin/RoleBadges';
import { MultiRoleEditorModal } from '@/components/admin/MultiRoleEditorModal';

export default function UsersManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>(DEFAULT_CLASSES_LIST);

  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [globalAllowTempStaff, setGlobalAllowTempStaff] = useState<boolean>(false);
  const [updatingSetting, setUpdatingSetting] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const [editingRolesUser, setEditingRolesUser] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadStudentsAndClasses = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch('/api/admin/students', { cache: 'no-store' }).catch(() => null),
        fetch('/api/admin/teacher-assignments', { cache: 'no-store' }).catch(() => null),
      ]);
      if (sRes && sRes.ok) {
        const sJson = await sRes.json().catch(() => ({}));
        const list = Array.isArray(sJson) ? sJson : sJson.students || sJson.data || [];
        if (Array.isArray(list)) setStudents(list);
      }
      if (aRes && aRes.ok) {
        const aJson = await aRes.json().catch(() => ({}));
        if (Array.isArray(aJson.classes) && aJson.classes.length > 0) {
          setClasses(aJson.classes);
        }
      }
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.users) {
          setProfiles(json.users as Profile[]);
        }
        if (json.settings) {
          setGlobalAllowTempStaff(Boolean(json.settings.allow_school_admin_view_temporary_staff));
        }
      }

      const resSettings = await fetch('/api/admin/system-settings', { cache: 'no-store' });
      if (resSettings.ok) {
        const jsonSettings = await resSettings.json();
        if (jsonSettings.settings) {
          setGlobalAllowTempStaff(
            Boolean(jsonSettings.settings.allow_school_admin_view_temporary_staff)
          );
        }
      }
    } catch (err) {
      console.error('Error fetching users or system settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStudentsAndClasses();

    if (typeof window !== 'undefined') {
      let role = '';
      let email = '';
      const savedUser = localStorage.getItem('suongmai_auth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          role = parsed.role || '';
          email = (parsed.email || '').toLowerCase().trim();
        } catch {}
      }
      const matchRole = document.cookie.match(/suongmai_user_role=([^;]+)/);
      if (matchRole) role = parseSignedCookieClient(matchRole[1]);
      const matchEmail = document.cookie.match(/suongmai_user_email=([^;]+)/);
      if (matchEmail) email = parseSignedCookieClient(matchEmail[1]).toLowerCase().trim();

      const cleanEmail = email.toLowerCase().trim();
      const isSuper =
        cleanEmail !== 'hejc108@gmail.com' &&
        cleanEmail !== 'luciaxuan178@gmail.com' &&
        (role === 'SUPER_ADMIN' || cleanEmail === 'sadmin@suongmai.edu.vn');
      setIsSuperAdmin(isSuper);
    }
  }, [loadData, loadStudentsAndClasses]);

  // Super Admin: Bật/Tắt cờ cấu hình toàn trường lưu vào CSDL
  const handleToggleGlobalTempStaff = async (newValue: boolean) => {
    if (updatingSetting) return;
    setUpdatingSetting(true);
    setGlobalAllowTempStaff(newValue);

    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'allow_school_admin_view_temporary_staff',
          value: newValue,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.settings) {
          setGlobalAllowTempStaff(Boolean(json.settings.allow_school_admin_view_temporary_staff));
        }
      }
    } catch (e) {
      console.error('Lỗi khi cập nhật cấu hình hệ thống:', e);
    } finally {
      setUpdatingSetting(false);
    }
  };

  const filtered = profiles.filter((p) => {
    if (!isSuperAdmin && !globalAllowTempStaff) {
      if (p.is_temporary) return false;
    }

    const userRoles = normalizeDisplayRoles(p.roles, p.role);

    if (roleFilter !== 'ALL') {
      if (roleFilter === 'STAFF_TEACHER') {
        const personnelRoles: UserRole[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'STAFF'];
        if (!userRoles.some((r) => personnelRoles.includes(r))) return false;
      } else if (roleFilter === 'PARENT') {
        if (!userRoles.includes('PARENT')) return false;
      } else if (roleFilter === 'DUAL') {
        if (!(userRoles.includes('TEACHER') && userRoles.includes('PARENT'))) return false;
      }
    }

    const q = search.toLowerCase().trim();
    if (!q) return true;
    const roleMatch = userRoles.some((r) => r.toLowerCase().includes(q));
    const childMatch = (p.linked_students || []).some((ls) =>
      ls.full_name.toLowerCase().includes(q)
    );
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      roleMatch ||
      childMatch
    );
  });

  const handleExportStaffReport = () => {
    const staffProfiles = filtered.filter((p) => {
      const userRoles = normalizeDisplayRoles(p.roles, p.role);
      return userRoles.some((r) =>
        ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'STAFF'].includes(r)
      );
    });

    const headers = [
      'STT',
      'Họ Và Tên',
      'Email',
      'Các Vai Trò',
      'Tính Chất Hợp Đồng',
      'Lớp Phân Công',
      'Con Đang Học',
      'Trạng Thái Duyệt',
    ];
    const rows = staffProfiles.map((p, idx) => {
      const userRoles = normalizeDisplayRoles(p.roles, p.role);
      const childText =
        (p.linked_students || [])
          .map((c) => `${c.full_name}${c.class_name ? ` (${c.class_name})` : ''}`)
          .join('; ') || '—';
      return [
        idx + 1,
        `"${p.full_name}"`,
        `"${p.email}"`,
        `"${userRoles.join(' + ')}"`,
        `"${p.is_temporary ? 'Thời vụ' : 'Chính thức'}"`,
        `"${p.assigned_class_name || '—'}"`,
        `"${childText}"`,
        `"${p.approval_status === 'ACTIVE' ? 'Đã duyệt' : 'Chờ duyệt'}"`,
      ];
    });

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
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200 rounded-pill text-primary-800 text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5 text-primary-700" />
            <span>Quản lý tài khoản & Đa vai trò</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Danh sách người dùng trong hệ thống
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng quan tài khoản Super Admin, Quản trị trường, Giáo viên, Cán bộ Bếp/Y tế & Phụ huynh ({filtered.length} tài khoản).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportStaffReport}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-pill shadow-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            title="Xuất danh sách cán bộ, giáo viên và nhân viên ra file Excel (.csv)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất danh sách</span>
          </button>

          <Link
            href="/admin/users/approvals"
            className="px-4.5 py-2.5 bg-[#FB8C00] hover:bg-[#F57C00] text-white font-bold text-xs rounded-pill shadow-sm transition-all flex items-center gap-2 active:scale-95"
          >
            <UserCheck className="w-4 h-4" />
            <span>Duyệt phân quyền</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Search & Centralized System Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email, vai trò hoặc tên bé..."
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
              <option value="DUAL">Đa vai trò (Giáo viên + Phụ huynh)</option>
            </select>
          </div>
        </div>

        {/* CẤU HÌNH TẬP TRUNG TOÀN TRƯỜNG DO SUPER_ADMIN ĐIỀU KHIỂN ĐỘC QUYỀN */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2.5 bg-amber-50/90 border border-amber-300 rounded-pill px-4 py-2 text-xs text-amber-900 font-bold shadow-2xs select-none">
            <Settings2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-[11px] uppercase tracking-wider text-amber-800 hidden sm:inline">
              Cấu hình toàn trường:
            </span>
            <span>Cho phép Quản trị trường xem GV thời vụ</span>
            <button
              type="button"
              disabled={updatingSetting}
              onClick={() => handleToggleGlobalTempStaff(!globalAllowTempStaff)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                globalAllowTempStaff ? 'bg-amber-600' : 'bg-slate-300'
              } ${updatingSetting ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Bật/Tắt quyền xem giáo viên thời vụ của Quản trị trường (School Admin)"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  globalAllowTempStaff ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-[11px] font-semibold text-amber-700">
              ({globalAllowTempStaff ? 'Đang BẬT' : 'Đang TẮT'})
            </span>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Đang tải danh sách nhân sự từ hệ thống...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Họ tên & Email</th>
                  <th className="py-3.5 px-4">Số điện thoại</th>
                  <th className="py-3.5 px-4">Vai trò (Multi-Role)</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Lớp phụ trách / Con đang học</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filtered.map((p) => {
                  const linkedStudents = p.linked_students || [];
                  const isSadminRow =
                    p.role === 'SUPER_ADMIN' || p.email.toLowerCase().trim() === 'sadmin@suongmai.edu.vn';

                  return (
                    <tr key={p.id || p.email} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{p.full_name}</span>
                          {isSadminRow && (
                            <span title="Super Admin">
                              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            </span>
                          )}
                          {p.is_temporary && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Thời vụ
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 font-normal">{p.email}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {p.phone || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="py-3.5 px-4">
                        <RoleBadges roles={p.roles} fallbackRole={p.role} compact />
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

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          {p.assigned_class_name && (
                            <div className="flex flex-wrap gap-1">
                              {p.assigned_class_name.split(',').map((cName, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-[10px] font-bold"
                                >
                                  GV lớp {cName.trim()}
                                </span>
                              ))}
                            </div>
                          )}

                          {linkedStudents.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {linkedStudents.map((ls) => (
                                <Link
                                  key={ls.student_id}
                                  href={`/admin/students/${ls.student_id}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-md text-[10px] font-bold transition-colors"
                                >
                                  <Baby className="w-3 h-3 text-emerald-600" />
                                  <span>
                                    {ls.full_name}
                                    {ls.class_name ? ` (${ls.class_name})` : ''}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          )}

                          {!p.assigned_class_name && linkedStudents.length === 0 && (
                            <span className="font-mono text-[11px] text-slate-400">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString('vi-VN') : '—'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isSadminRow ? (
                          <span className="text-[11px] text-slate-400 italic">Cố định</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingRolesUser(p)}
                            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Phân quyền</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Phân quyền Đa vai trò */}
      {editingRolesUser && (
        <MultiRoleEditorModal
          user={editingRolesUser}
          isSuperAdmin={isSuperAdmin}
          students={students}
          loadingStudents={loadingStudents}
          availableClasses={classes}
          onClose={() => setEditingRolesUser(null)}
          onSaved={async (msg) => {
            await loadData();
            showToast(msg, 'success');
          }}
          onError={(errMsg) => showToast(errMsg, 'error')}
        />
      )}
    </div>
  );
}
