'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { SchoolDocument } from '@/lib/types/schema';
import { formatDocumentFileSize, getDocumentPreviewKind } from '@/lib/documents/validation';

export interface DocumentPreviewModalProps {
  document: SchoolDocument;
  onClose: () => void;
}

export function DocumentPreviewModal({
  document: doc,
  onClose,
}: DocumentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewKind = getDocumentPreviewKind(doc);

  useEffect(() => {
    let active = true;
    const loadSignedUrl = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/admin/documents/${doc.id}/signed-url`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !json.success || !json.signed_url) {
          setErrorMsg(json.message || json.error || `Không thể mở xem trước (${res.status}).`);
          return;
        }
        setSignedUrl(json.signed_url);
      } catch (err: any) {
        if (active) {
          setErrorMsg(err?.message || 'Lỗi kết nối khi lấy liên kết xem trước.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSignedUrl();
    return () => {
      active = false;
    };
  }, [doc.id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/signed-url?download=1`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.signed_url) {
        window.open(json.signed_url, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMsg(json.message || json.error || 'Không thể tải xuống tệp.');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-primary-700 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate" title={doc.title}>
                {doc.title}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {doc.document_number ? `Số hiệu: ${doc.document_number} • ` : ''}
                {doc.file_name || 'Tài liệu'} ({formatDocumentFileSize(doc.file_size)}) • Liên kết bảo mật 60 phút
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-pill border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở tab mới</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3.5 py-1.5 rounded-pill bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Tải về máy</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
              aria-label="Đóng xem trước"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="p-4 bg-slate-100/70 flex-1 overflow-auto flex items-center justify-center min-h-[55vh]">
          {loading ? (
            <div className="text-center space-y-2.5 py-12">
              <Loader2 className="w-7 h-7 animate-spin text-primary-700 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Đang tạo liên kết bảo mật để xem trước tài liệu...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="max-w-md bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">Không thể hiển thị tài liệu</h4>
              <p className="text-xs text-rose-700">{errorMsg}</p>
            </div>
          ) : signedUrl && previewKind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={doc.title}
              className="max-h-[74vh] max-w-full object-contain rounded-xl border border-slate-200 bg-white shadow-sm"
            />
          ) : signedUrl ? (
            <iframe
              src={signedUrl}
              title={doc.title}
              className="w-full h-[74vh] rounded-xl border border-slate-200 bg-white shadow-sm"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
