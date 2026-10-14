-- ==============================================================================
-- Migration 00006: Add is_non_regular column to public.students
-- Author: QC Lead & Security Specialist
-- Date: 2026-10-14
-- Description:
--   Bổ sung cột is_non_regular để phân loại học sinh chính quy / ngoài chính quy
--   và tạo chỉ mục tối ưu hiệu năng lọc danh sách cho Ban Giám Hiệu.
-- ==============================================================================

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_non_regular BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_students_non_regular ON public.students(is_non_regular);
