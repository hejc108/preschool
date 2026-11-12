'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  FolderPlus,
  Loader2,
  Tags,
  X,
} from 'lucide-react';
import { DocumentCategory } from '@/lib/types/schema';

export interface CategoryManagerModalProps {
  categories: DocumentCategory[];
  onClose: () => void;
  onChanged: (message: string) => Promise<void> | void;
}

export function CategoryManagerModal({
  categories,
  onClose,
  onChanged,
}: CategoryManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập tên danh mục mới.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/documents/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          code: newCode.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErrorMsg(json.message || json.error || 'Không thể tạo danh mục mới.');
        return;
      }
      setNewName('');
      setNewCode('');
      await onChanged(`Đã thêm danh mục "${json.category?.name || trimmed}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi kết nối khi thêm danh mục.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    setErrorMsg(null);
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMsg('Tên danh mục không được để trống.');
      return;
    }

    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/documents/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setErrorMsg(json.message || json.error || 'Không thể đổi tên danh mục.');
        return;
      }
      setEditingId(null);
      setEditingName('');
      await onChanged(`Đã cập nhật tên danh mục "${trimmed}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi kết nối khi cập nhật danh mục.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Quản lý danh mục văn bản</h2>
              <p className="text-xs text-slate-500">
                Chỉ Super Admin được phép thêm mới hoặc sửa tên danh mục
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Đóng quản lý danh mục"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Add New Category Form */}
          <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-primary-700" />
              <span>Thêm danh mục mới</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tên danh mục (VD: Tài chính & Học phí)"
                className="sm:col-span-7 bg-white border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
              />
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Mã (tự sinh nếu bỏ trống)"
                className="sm:col-span-5 bg-white border border-slate-200 focus:border-primary-600 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-pill bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Thêm danh mục</span>
              </button>
            </div>
          </form>

          {/* Category List */}
          <div className="space-y-2">
            <div className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
              Danh sách danh mục hiện có ({categories.length})
            </div>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;
                const isSaving = savingId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full bg-white border border-primary-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div className="font-bold text-slate-800 truncate">{cat.name}</div>
                      )}
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {cat.code} • {cat.document_count || 0} tài liệu hiệu lực
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveEdit(cat.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Lưu</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditingName(cat.name);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa tên</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
