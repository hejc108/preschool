'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Columns,
  Rows,
} from 'lucide-react';

interface DocumentRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  isReadOnly?: boolean;
  documentNumber?: string | null;
  dateLabel?: string | null;
}

export function DocumentRichTextEditor({
  content,
  onChange,
  editable = true,
  isReadOnly,
  documentNumber,
  dateLabel,
}: DocumentRichTextEditorProps) {
  const isEditable = isReadOnly !== undefined ? !isReadOnly : editable;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || '',
    editable: isEditable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'focus:outline-none min-h-[360px] p-4 text-[14px] leading-relaxed text-slate-800 font-serif',
      },
    },
  });

  // Đồng bộ content từ bên ngoài (khi người dùng chọn phôi mẫu)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable);
    }
  }, [isEditable, editor]);

  if (!editor) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs font-serif bg-slate-50 border border-slate-200 rounded-2xl">
        Đang khởi tạo trình soạn thảo văn bản...
      </div>
    );
  }

  const isTableActive = editor.isActive('table');

  return (
    <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
      {/* 1. THANH CÔNG CỤ (TOOLBAR) */}
      {editable && (
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1 text-slate-700 select-none">
          {/* Lịch sử */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-slate-300 mx-1" />

          {/* Định dạng chữ */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bold')
                ? 'bg-primary-100 text-primary-800 font-bold'
                : 'hover:bg-slate-200'
            }`}
            title="In đậm (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('italic')
                ? 'bg-primary-100 text-primary-800 font-bold'
                : 'hover:bg-slate-200'
            }`}
            title="In nghiêng (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('underline')
                ? 'bg-primary-100 text-primary-800 font-bold'
                : 'hover:bg-slate-200'
            }`}
            title="Gạch chân (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-slate-300 mx-1" />

          {/* Căn lề */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'left' })
                ? 'bg-primary-100 text-primary-800'
                : 'hover:bg-slate-200'
            }`}
            title="Căn trái"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'center' })
                ? 'bg-primary-100 text-primary-800'
                : 'hover:bg-slate-200'
            }`}
            title="Căn giữa"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'right' })
                ? 'bg-primary-100 text-primary-800'
                : 'hover:bg-slate-200'
            }`}
            title="Căn phải"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'justify' })
                ? 'bg-primary-100 text-primary-800'
                : 'hover:bg-slate-200'
            }`}
            title="Căn đều hai bên"
          >
            <AlignJustify className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-slate-300 mx-1" />

          {/* Danh sách */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-primary-100 text-primary-800 font-bold'
                : 'hover:bg-slate-200'
            }`}
            title="Danh sách dấu chấm"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('orderedList')
                ? 'bg-primary-100 text-primary-800 font-bold'
                : 'hover:bg-slate-200'
            }`}
            title="Danh sách số"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-slate-300 mx-1" />

          {/* Bảng biểu */}
          <button
            type="button"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            className="p-1.5 rounded hover:bg-slate-200 flex items-center gap-1 text-xs font-semibold"
            title="Chèn bảng biểu (3x3)"
          >
            <TableIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Chèn bảng</span>
          </button>

          {isTableActive && (
            <div className="flex items-center gap-1 ml-1 bg-white px-2 py-0.5 rounded border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="p-1 hover:bg-slate-100 rounded text-slate-700"
                title="Thêm cột sau"
              >
                <Columns className="w-3.5 h-3.5 text-emerald-700" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="p-1 hover:bg-slate-100 rounded text-rose-700"
                title="Xóa cột"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-3.5 bg-slate-200" />
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="p-1 hover:bg-slate-100 rounded text-slate-700"
                title="Thêm dòng sau"
              >
                <Rows className="w-3.5 h-3.5 text-emerald-700" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="p-1 hover:bg-slate-100 rounded text-rose-700"
                title="Xóa dòng"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-3.5 bg-slate-200" />
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-1.5 py-0.5 hover:bg-rose-50 text-rose-700 rounded font-semibold text-[11px]"
                title="Xóa toàn bộ bảng"
              >
                Xóa bảng
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. KHUNG HIỂN THỊ TRANG VĂN BẢN (A4 ADMINISTRATIVE PREVIEW) */}
      <div className="p-6 md:p-8 bg-slate-100/50 flex justify-center">
        <div className="w-full max-w-[760px] bg-white border border-slate-300 rounded-xl shadow-md p-8 md:p-12 space-y-6 font-serif">
          {/* Header Quốc hiệu - Tiêu ngữ & Đơn vị ban hành */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-dashed border-slate-300 text-xs text-slate-800 leading-normal">
            {/* Cột trái: Đơn vị */}
            <div className="text-center sm:text-center space-y-0.5">
              <p className="uppercase tracking-wide font-normal">PHÒNG GIÁO DỤC VÀ ĐÀO TẠO</p>
              <p className="uppercase font-bold tracking-wide">TRƯỜNG MẦM NON SƯƠNG MAI</p>
              <div className="w-16 h-0.5 bg-slate-700 mx-auto my-1" />
              <p className="font-sans font-semibold text-slate-700 text-[11px] pt-0.5">
                {documentNumber ? `Số: ${documentNumber}` : 'Số: .../2026/CV-MNSM'}
              </p>
            </div>

            {/* Cột phải: Quốc hiệu */}
            <div className="text-center sm:text-center space-y-0.5">
              <p className="uppercase font-bold tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-24 h-0.5 bg-slate-700 mx-auto my-1" />
              <p className="italic text-slate-600 text-[11px] pt-0.5">
                {dateLabel || 'Hà Nội, ngày ... tháng ... năm 2026'}
              </p>
            </div>
          </div>

          {/* Vùng soạn thảo chính của Tiptap */}
          <div className="prose prose-slate max-w-none prose-p:my-2 prose-headings:my-3">
            <EditorContent editor={editor} />
          </div>

          {/* Footer chữ ký Hiệu trưởng & Nơi nhận */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-dashed border-slate-300 text-xs text-slate-800">
            {/* Cột trái: Nơi nhận */}
            <div className="text-left space-y-1">
              <p className="font-bold italic">Nơi nhận:</p>
              <p className="text-[11px] leading-tight">- Như trên;</p>
              <p className="text-[11px] leading-tight">- Phòng GD&ĐT (để b/c);</p>
              <p className="text-[11px] leading-tight">- Lưu: VT, BGH.</p>
            </div>

            {/* Cột phải: Hiệu trưởng */}
            <div className="text-center space-y-1">
              <p className="uppercase font-bold tracking-wider">HIỆU TRƯỞNG</p>
              <div className="h-16 flex items-center justify-center text-slate-400 italic text-[11px]">
                (Khoảng trống ký tên & đóng dấu)
              </div>
              <p className="font-semibold text-slate-700 text-xs">TRƯỜNG MẦM NON SƯƠNG MAI</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .tiptap table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 12px 0;
          overflow: hidden;
        }
        .tiptap table td,
        .tiptap table th {
          min-width: 1em;
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .tiptap table th {
          font-weight: bold;
          text-align: center;
          background-color: #f8fafc;
        }
        .tiptap .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: '';
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .tiptap p {
          margin: 0.35rem 0;
        }
      `}</style>
    </div>
  );
}
