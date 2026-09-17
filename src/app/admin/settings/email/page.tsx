'use client';

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Shield, AlertTriangle, Key, Server, Save, Sparkles, Lock, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface EmailProviderConfig {
  active_provider: 'MOCK' | 'GOOGLE_WORKSPACE' | 'RESEND';
  mock_otp_code: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from_name: string;
  };
  resend: {
    api_key: string;
  };
}

const DEFAULT_CONFIG: EmailProviderConfig = {
  active_provider: 'MOCK',
  mock_otp_code: '123456',
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    user: 'noreply@suongmai.edu.vn',
    pass: '',
    from_name: 'Trường Mầm Non Sương Mai',
  },
  resend: {
    api_key: '',
  },
};

export default function AdminEmailSettingsPage() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<EmailProviderConfig>(DEFAULT_CONFIG);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('suongmai_email_config');
      if (saved) {
        try {
          setConfig(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('suongmai_email_config', JSON.stringify(config));
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-convent p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-sky-600 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Mail className="w-4 h-4 text-sky-600" />
            Hệ thống & Dịch vụ Email
          </span>
          <h1 className="text-2xl font-black text-sky-950 tracking-tight">Cấu hình Email & Chế độ Mock OTP</h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý dịch vụ gửi mail thông báo, báo suất ăn và xác thực mã OTP đăng nhập cho Phụ huynh & Giáo viên.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-pill text-xs font-bold border flex items-center gap-1.5 ${
            config.active_provider === 'MOCK'
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${config.active_provider === 'MOCK' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            Provider: {config.active_provider}
          </span>
        </div>
      </div>

      {/* Provider Selector */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-convent p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-600" />
            1. Chọn nhà cung cấp dịch vụ Email (Active Provider)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MOCK MODE */}
            <div
              onClick={() => setConfig({ ...config, active_provider: 'MOCK' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                config.active_provider === 'MOCK'
                  ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-600" />
                  MOCK AUTH (Khuyên dùng khi Dev/Test)
                </span>
                <input
                  type="radio"
                  name="provider"
                  checked={config.active_provider === 'MOCK'}
                  onChange={() => setConfig({ ...config, active_provider: 'MOCK' })}
                  className="accent-amber-600"
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Không gửi mail thật. Tự động chấp nhận mã OTP cố định <strong>123456</strong> cho mọi tài khoản để kiểm thử ngay lập tức.
              </p>
            </div>

            {/* GOOGLE WORKSPACE SMTP */}
            <div
              onClick={() => setConfig({ ...config, active_provider: 'GOOGLE_WORKSPACE' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                config.active_provider === 'GOOGLE_WORKSPACE'
                  ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-400/20 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sky-950 text-sm flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-sky-600" />
                  Google Workspace (.edu.vn)
                </span>
                <input
                  type="radio"
                  name="provider"
                  checked={config.active_provider === 'GOOGLE_WORKSPACE'}
                  onChange={() => setConfig({ ...config, active_provider: 'GOOGLE_WORKSPACE' })}
                  className="accent-sky-600"
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gửi mail chính thức qua máy chủ SMTP Gmail của trường (`noreply@suongmai.edu.vn`).
              </p>
            </div>

            {/* RESEND API */}
            <div
              onClick={() => setConfig({ ...config, active_provider: 'RESEND' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                config.active_provider === 'RESEND'
                  ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/20 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Resend Email API
                </span>
                <input
                  type="radio"
                  name="provider"
                  checked={config.active_provider === 'RESEND'}
                  onChange={() => setConfig({ ...config, active_provider: 'RESEND' })}
                  className="accent-indigo-600"
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gửi mail tốc độ cao qua API Resend (Cần có Resend API Key chính thức).
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Provider Details Form */}
        {config.active_provider === 'MOCK' && (
          <div className="bg-amber-50 border border-amber-200 rounded-convent p-6 space-y-4 shadow-sm text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Shield className="w-5 h-5 text-amber-600" />
              <span>Cấu hình Mã OTP Kiểm thử (Mock Mode Active)</span>
            </div>
            <p className="text-slate-700">
              Đội tester và Ban Giám Hiệu có thể nhập mã OTP cố định bên dưới để đăng nhập ngay mà không cần chờ mail:
            </p>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Mã OTP cố định (*)</label>
              <input
                type="text"
                value={config.mock_otp_code}
                onChange={(e) => setConfig({ ...config, mock_otp_code: e.target.value })}
                className="w-48 bg-white border border-amber-300 rounded-xl p-2.5 font-mono text-sm font-bold text-amber-950 tracking-widest text-center shadow-inner"
              />
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-slate-600 font-mono text-[11px]">
              Console Log: <code>[MOCK AUTH] OTP is {config.mock_otp_code}</code>
            </div>
          </div>
        )}

        {config.active_provider === 'GOOGLE_WORKSPACE' && (
          <div className="bg-white border border-slate-200 rounded-convent p-6 space-y-4 shadow-sm text-xs">
            <h3 className="font-bold text-sky-900 text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-600" />
              Thông tin cấu hình máy chủ SMTP Google Workspace
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">SMTP Host (*)</label>
                <input
                  type="text"
                  value={config.smtp.host}
                  onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, host: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">SMTP Port (*)</label>
                <input
                  type="number"
                  value={config.smtp.port}
                  onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, port: parseInt(e.target.value) || 587 } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tài khoản Email gửi (*)</label>
                <input
                  type="email"
                  value={config.smtp.user}
                  onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, user: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu ứng dụng (App Password) (*)</label>
                <input
                  type="password"
                  value={config.smtp.pass}
                  onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, pass: e.target.value } })}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Tên hiển thị người gửi (From Name)</label>
                <input
                  type="text"
                  value={config.smtp.from_name}
                  onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, from_name: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {config.active_provider === 'RESEND' && (
          <div className="bg-white border border-slate-200 rounded-convent p-6 space-y-4 shadow-sm text-xs">
            <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              Cấu hình Resend API Key
            </h3>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Resend API Key (*)</label>
              <input
                type="password"
                value={config.resend.api_key}
                onChange={(e) => setConfig({ ...config, resend: { ...config.resend, api_key: e.target.value } })}
                placeholder="re_123456789..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
              />
            </div>
          </div>
        )}

        {/* Submit & Status Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-convent p-4 shadow-sm">
          {savedSuccess ? (
            <span className="text-emerald-700 font-bold text-xs flex items-center gap-1.5 animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Đã lưu cấu hình dịch vụ email thành công!
            </span>
          ) : (
            <span className="text-slate-500 text-xs">Bấm lưu để áp dụng ngay chế độ gửi email.</span>
          )}

          <button
            type="submit"
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-6 rounded-pill shadow-md transition-all active:scale-95 text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Lưu cấu hình hệ thống</span>
          </button>
        </div>
      </form>
    </div>
  );
}
