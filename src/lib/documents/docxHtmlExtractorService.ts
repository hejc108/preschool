import mammoth from 'mammoth';
import { DOCUMENT_BUCKET_NAME } from './validation';
import { getPreferredStorageClient } from './documentService';
import { SessionContext } from '@/lib/auth/sessionContext';
import { SchoolDocument } from '@/lib/types/schema';

/**
 * Checks if a document record represents an editable Word (.docx) file or online editor doc.
 */
export function isDocxFileRecord(
  doc: Pick<SchoolDocument, 'creation_mode' | 'storage_type' | 'file_name' | 'storage_path' | 'mime_type'>
): boolean {
  if (doc.creation_mode === 'ONLINE_EDITOR') return true;
  if (doc.storage_type !== 'SUPABASE_STORAGE') return false;
  const name = (doc.file_name || doc.storage_path || '').toLowerCase();
  return (
    name.endsWith('.docx') ||
    doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

/**
 * Converts a raw .docx file Buffer into semantic HTML using mammoth.
 */
export async function convertDocxBufferToHtml(buffer: Buffer): Promise<{ html: string; warnings: string[] }> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "u => u",
        "strike => s",
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
      ],
    }
  );

  return {
    html: (result.value || '').trim() || '<p></p>',
    warnings: (result.messages || []).map((m) => m.message),
  };
}

/**
 * Extracts HTML for a given SchoolDocument:
 * - If editor_content_html is already populated, returns it immediately.
 * - If it is a .docx file on Supabase Storage, downloads the buffer and converts it using mammoth.
 * - Otherwise returns an unsupported notice.
 */
export async function extractHtmlForDocument(
  ctx: SessionContext,
  doc: SchoolDocument
): Promise<
  | { ok: true; html: string; source: 'SAVED_HTML' | 'DOCX_EXTRACTED'; warnings?: string[] }
  | { ok: false; error: string; unsupportedReason?: string }
> {
  // 1. Nếu văn bản đã có sẵn HTML soạn thảo và không rỗng
  if (doc.editor_content_html && doc.editor_content_html.trim().length > 0) {
    return { ok: true, html: doc.editor_content_html, source: 'SAVED_HTML' };
  }

  // 2. Kiểm tra nếu là file .docx trên Supabase Storage
  if (
    doc.storage_type === 'SUPABASE_STORAGE' &&
    doc.storage_path &&
    isDocxFileRecord(doc)
  ) {
    try {
      const sb = await getPreferredStorageClient(ctx);
      const { data, error } = await sb.storage
        .from(DOCUMENT_BUCKET_NAME)
        .download(doc.storage_path);

      if (error || !data) {
        return {
          ok: false,
          error: error?.message || 'Không thể tải tệp Word từ hệ thống lưu trữ.',
        };
      }

      const arrayBuf = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const { html, warnings } = await convertDocxBufferToHtml(buffer);

      return {
        ok: true,
        html: html || '<p></p>',
        source: 'DOCX_EXTRACTED',
        warnings,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || 'Lỗi khi giải nén tệp Word (.docx) sang HTML.',
      };
    }
  }

  return {
    ok: false,
    error: 'Chỉ hỗ trợ mở soạn thảo trực tiếp với tệp Word (.docx)',
    unsupportedReason: 'Chỉ hỗ trợ mở soạn thảo trực tiếp với tệp Word (.docx)',
  };
}
