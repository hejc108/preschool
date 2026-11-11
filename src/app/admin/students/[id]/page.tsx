'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  Baby,
  Check,
  CheckCircle2,
  ChevronLeft,
  Heart,
  Link2,
  Phone,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AuthorizedPickup, Student, UserRole } from '@/lib/types/schema';
import { RoleBadges } from '@/components/admin/RoleBadges';
import { normalizeVietnameseSearch } from '@/components/admin/MultiRoleEditorModal';
import { hasRealAllergy } from '@/lib/utils/studentClassification';

interface LinkedParentItem {
  parent_user_id: string;
  relationship: string;
  is_primary: boolean;
  created_at?: string;
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    role: UserRole;
    roles: UserRole[];
    approval_status: string;
    assigned_class_name?: string;
  } | null;
}

interface CandidateAccount {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  roles: UserRole[];
  approval_status: string;
  assigned_class_name?: string;
}

export default function AdminStudentDetailPage() {
  const params = useParams();
  const studentId = String(params?.id || '');

  const [student, setStudent] = useState<(Student & { class_name?: string }) | null>(null);
  const [linkedParents, setLinkedParents] = useState<LinkedParentItem[]>([]);
  const [pickups, setPickups] = useState<AuthorizedPickup[]>([]);
  const [candidates, setCandidates] = useState<CandidateAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [searchCandidate, setSearchCandidate] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TEACHER_STAFF' | 'PARENT'>('ALL');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('Mẹ');
  const [isPrimaryLink, setIsPrimaryLink] = useState<boolean>(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadDetail = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/parents`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || 'Không tải được hồ sơ học sinh.');
        return;
      }
      setStudent(json.student || null);
      setLinkedParents(Array.isArray(json.linked_parents) ? json.linked_parents : []);
      setPickups(Array.isArray(json.authorized_pickups) ? json.authorized_pickups : []);
      setCandidates(Array.isArray(json.candidate_accounts) ? json.candidate_accounts : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const linkedIds = useMemo(
    () => new Set(linkedParents.map((lp) => lp.parent_user_id)),
    [linkedParents]
  );

  const availableCandidates = useMemo(() => {
    const q = normalizeVietnameseSearch(searchCandidate);
    return candidates.filter((acc) => {
      if (linkedIds.has(acc.id)) return false;
      if (acc.approval_status === 'REJECTED') return false;

      if (roleFilter === 'TEACHER_STAFF') {
        const isStaff = acc.roles.some((r) => ['TEACHER', 'STAFF', 'SCHOOL_ADMIN'].includes(r));
        if (!isStaff) return false;
      } else if (roleFilter === 'PARENT') {
        if (!acc.roles.includes('PARENT')) return false;
      }

      if (!q) return true;
      return (
        normalizeVietnameseSearch(acc.full_name).includes(q) ||
        normalizeVietnameseSearch(acc.email).includes(q) ||
        normalizeVietnameseSearch(acc.assigned_class_name || '').includes(q)
      );
    });
  }, [candidates, linkedIds, roleFilter, searchCandidate]);

  const handleLinkParent = async (account: CandidateAccount) => {
    if (!studentId || submittingId) return;
    setSubmittingId(account.id);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_user_id: account.id,
          relationship: selectedRelationship,
          is_primary: isPrimaryLink,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        showToast(json.error || 'Liên kết phụ huynh thất bại.', 'error');
        return;
      }
      showToast(
        json.message ||
          `Đã liên kết ${account.full_name} (${selectedRelationship}) và tự động cấp quyền Phụ huynh.`
      );
      await loadDetail();
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi lưu liên kết phụ huynh.', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleUnlinkParent = async (lp: LinkedParentItem) => {
    if (!studentId || submittingId) return;
    const displayName = lp.profile?.full_name || lp.parent_user_id;
    if (!confirm(`Gỡ liên kết phụ huynh ${displayName} khỏi hồ sơ bé ${student?.full_name || ''}?`)) {
      return;
    }
    setSubmittingId(lp.parent_user_id);
    try {
      const res = await fetch(
        `/api/admin/students/${studentId}/parents?parent_user_id=${encodeURIComponent(
          lp.parent_user_id
        )}`,
        { method: 'DELETE' }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        showToast(json.error || 'Gỡ liên kết thất bại.', 'error');
        return;
      }
      showToast(json.message || 'Đã gỡ liên kết phụ huynh.');
      await loadDetail();
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi gỡ liên kết phụ huynh.', 'error');
    } finally {
      setSubmittingId(null);
    }
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

      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại Danh sách Học sinh</span>
        </Link>

        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-bold text-sky-700 transition-colors"
        >
          <Users className="w-4 h-4" />
          <span>Quản lý Tài khoản Hệ thống</span>
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-3">
          <div className="w-8 h-8 border-3 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Đang tải hồ sơ chi tiết học sinh...</p>
        </div>
      ) : errorMsg || !student ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-6 rounded-2xl text-sm font-semibold">
          {errorMsg || 'Không tìm thấy dữ liệu học sinh.'}
        </div>
      ) : (
        <>
          {/* Student Overview Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {student.avatar_url ? (
                <img
                  src={student.avatar_url}
                  alt={student.full_name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-sky-500 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-sky-100 border border-sky-200 text-sky-800 font-bold text-2xl flex items-center justify-center shrink-0">
                  {student.full_name.charAt(0)}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{student.full_name}</h1>
                  <span className="px-2.5 py-0.5 rounded-pill text-xs font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200">
                    {student.student_code}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-pill text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Lớp {student.class_name || 'Chưa phân lớp'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Giới tính: <strong>{student.gender}</strong> • Ngày sinh:{' '}
                  <strong className="font-mono">{student.dob}</strong>
                </p>
                <p className="text-xs text-slate-600">
                  Sức khỏe / Dị ứng:{' '}
                  <strong className={hasRealAllergy(student.allergies) ? 'text-rose-700' : 'text-emerald-700'}>
                    {hasRealAllergy(student.allergies) ? student.allergies : 'Bình thường (Không dị ứng)'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-xs space-y-0.5 shrink-0">
              <p className="font-bold text-sky-900 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-sky-600" />
                <span>Đã liên kết {linkedParents.length} tài khoản phụ huynh</span>
              </p>
              <p className="text-[11px] text-sky-700">
                Hỗ trợ liên kết Giáo viên / Nhân sự làm Phụ huynh
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: Linked Parents in student_parents */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Tài khoản Phụ huynh đang liên kết ({linkedParents.length})</span>
                </h2>

                {linkedParents.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 space-y-1">
                    <Baby className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">Chưa có tài khoản Google nào được gán</p>
                    <p>Hãy chọn tài khoản ở khung bên phải để liên kết phụ huynh cho bé.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {linkedParents.map((lp) => {
                      const prof = lp.profile;
                      const isDualTeacher = prof?.roles?.includes('TEACHER');
                      return (
                        <div
                          key={lp.parent_user_id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">
                                  {prof?.full_name || 'Tài khoản phụ huynh'}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                  {lp.relationship}
                                </span>
                                {lp.is_primary && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                    Liên hệ chính
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                                {prof?.email || lp.parent_user_id}
                              </p>
                              {prof?.phone && (
                                <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5 font-mono">
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  <span>{prof.phone}</span>
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={submittingId === lp.parent_user_id}
                              onClick={() => handleUnlinkParent(lp)}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                              title="Gỡ liên kết khỏi bé"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Gỡ</span>
                            </button>
                          </div>

                          {prof && (
                            <div className="pt-1 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                              <RoleBadges roles={prof.roles} fallbackRole={prof.role} compact />
                              {isDualTeacher && prof.assigned_class_name && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                  Phụ trách lớp {prof.assigned_class_name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Read-only Authorized Pickups summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Người được ủy quyền đón bé ({pickups.length})</span>
                </h2>
                {pickups.length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có hồ sơ người đón hộ.</p>
                ) : (
                  <div className="space-y-2">
                    {pickups.map((pk) => (
                      <div
                        key={pk.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{pk.name}</span>
                          <span className="text-slate-500"> ({pk.relationship})</span>
                        </div>
                        <span className="font-mono text-slate-600">{pk.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Search & Link Existing System User (Teacher / Staff / Parent) */}
            <div className="lg:col-span-7">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-sky-600" />
                    <span>Liên kết tài khoản hệ thống làm Phụ huynh (Tự động bật quyền Đa vai trò)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Chọn bất kỳ tài khoản Giáo viên, Nhân sự hoặc Phụ huynh đang có trong hệ thống để gán làm cha/mẹ của bé{' '}
                    <strong>{student.full_name}</strong>. Quyền <code className="bg-slate-100 px-1 rounded">PARENT</code> sẽ được tự động bổ sung vào <code className="bg-slate-100 px-1 rounded">user_roles</code> mà không làm mất quyền hiện có.
                  </p>
                </div>

                {/* Relationship + Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Quan hệ với bé</label>
                    <select
                      value={selectedRelationship}
                      onChange={(e) => setSelectedRelationship(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value="Mẹ">Mẹ</option>
                      <option value="Bố">Bố</option>
                      <option value="Ông">Ông</option>
                      <option value="Bà">Bà</option>
                      <option value="Người giám hộ">Người giám hộ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Lọc đối tượng</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value="ALL">Tất cả tài khoản</option>
                      <option value="TEACHER_STAFF">Giáo viên & Nhân sự có con</option>
                      <option value="PARENT">Tài khoản Phụ huynh</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={isPrimaryLink}
                        onChange={(e) => setIsPrimaryLink(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600"
                      />
                      <span>Đặt làm liên hệ chính</span>
                    </label>
                  </div>
                </div>

                {/* Search box */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchCandidate}
                    onChange={(e) => setSearchCandidate(e.target.value)}
                    placeholder="Tìm tên giáo viên, phụ huynh, email Google hoặc tên lớp phụ trách..."
                    className="w-full bg-white border border-slate-300 focus:border-sky-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Candidate List */}
                <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                  {availableCandidates.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Không tìm thấy tài khoản khả dụng phù hợp.
                    </div>
                  ) : (
                    availableCandidates.map((acc) => {
                      const isSubmitting = submittingId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          className="p-3 rounded-xl border border-slate-200 hover:border-sky-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{acc.full_name}</span>
                              {acc.assigned_class_name && (
                                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                                  GV lớp {acc.assigned_class_name}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 truncate">{acc.email}</p>
                            <RoleBadges roles={acc.roles} fallbackRole={acc.role} compact />
                          </div>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleLinkParent(acc)}
                            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white text-xs font-bold rounded-xl shadow-2xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? 'Đang gán...' : `Liên kết (${selectedRelationship})`}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
