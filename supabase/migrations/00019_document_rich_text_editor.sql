-- =========================================================================
-- Migration: 00019_document_rich_text_editor.sql
-- Purpose: Bổ sung tính năng Soạn thảo văn bản trực tiếp trên Web (ONLINE_EDITOR)
--          và tự động kết xuất tệp Word (.docx) chuẩn Nghị định 30/2020/NĐ-CP.
-- Safe to run multiple times (idempotent).
-- =========================================================================

-- 1. Bổ sung các cột phục vụ trình soạn thảo trực tiếp trên Web
ALTER TABLE public.school_documents
  ADD COLUMN IF NOT EXISTS creation_mode TEXT NOT NULL DEFAULT 'FILE_UPLOAD',
  ADD COLUMN IF NOT EXISTS editor_content_html TEXT,
  ADD COLUMN IF NOT EXISTS editor_template_code TEXT,
  ADD COLUMN IF NOT EXISTS generated_docx_path TEXT;

-- 2. Ràng buộc creation_mode chỉ chấp nhận FILE_UPLOAD hoặc ONLINE_EDITOR
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_school_documents_creation_mode'
  ) THEN
    ALTER TABLE public.school_documents
      ADD CONSTRAINT chk_school_documents_creation_mode
      CHECK (creation_mode IN ('FILE_UPLOAD', 'ONLINE_EDITOR'));
  END IF;
END $$;

-- 3. Đánh index hỗ trợ truy vấn các văn bản tạo qua trình soạn thảo trực tuyến
CREATE INDEX IF NOT EXISTS idx_school_documents_creation_mode
  ON public.school_documents (creation_mode);
