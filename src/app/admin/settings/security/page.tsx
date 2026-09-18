'use client';

import React, { useState } from 'react';
import { Shield, KeyRound, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function SecuritySettingsPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToastMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      showToastMsg('Vui lòng điền đầy đủ các thông tin mật khẩu!', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToastMsg('Mật khẩu mới và mật khẩu xác nhận không khớp nhau!', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToastMsg('Mật khẩu mới phải từ 6 ký tự trở lên!', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'sadmin', oldPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToastMsg('Đổi mật khẩu tài khoản Quản trị sadmin thành công!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToastMsg(data.message || 'Mật khẩu cũ không đúng!', 'error');
      }
    } catch (e: any) {
      showToastMsg('Lỗi kết nối tới máy chủ khi đổi mật khẩu!', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-bounce ${
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-pill text-indigo-700 text-xs font-bold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Super Admin Security Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cấu hình Đổi Mật Khẩu Quản Trị</h1>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý mật khẩu truy cập tài khoản tối cao <strong className="text-indigo-900 font-mono">sadmin</strong>
          </p>
        </div>
      </div>

      {/* Main Security Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleChangePassword} className="space-y-5 max-w-xl">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs leading-relaxed flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">Lưu ý bảo mật:</p>
              <p className="mt-0.5">
                Mật khẩu mặc định khởi tạo ban đầu là <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">abcd@1234</code>. Bạn nên đổi mật khẩu mới có độ phức tạp cao hơn để đảm bảo an toàn hệ thống.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mật khẩu sadmin hiện tại:
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-10 text-xs text-slate-800 focus:outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mật khẩu mới:
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 focus:outline-none transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Xác nhận mật khẩu mới:
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Đang cập nhật...' : 'Xác nhận Đổi Mật Khẩu'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
