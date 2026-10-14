-- ==============================================================================
-- Migration 00007: Teacher Class Assignments (Multi-Class Support)
-- Author: QC Lead & System Security Specialist
-- Date: 2026-10-14
-- Description:
--   Bảng quản trị phân công giáo viên đứng lớp (quan hệ nhiều - nhiều).
--   Cho phép 1 giáo viên phụ trách từ 2 lớp trở lên trong năm học.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_email TEXT NOT NULL,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    class_name TEXT,
    academic_year TEXT DEFAULT '2026-2027',
    is_main_teacher BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_teacher_class_year UNIQUE(teacher_email, class_id, academic_year)
);

-- Chỉ mục truy vấn tối ưu hiệu năng
CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_email ON public.teacher_class_assignments(teacher_email);
CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class ON public.teacher_class_assignments(class_id);

-- Thiết lập Row Level Security (RLS)
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Quyền đọc: Cho phép authenticated và anon đọc danh sách phân công
DROP POLICY IF EXISTS "Allow select teacher_class_assignments" ON public.teacher_class_assignments;
CREATE POLICY "Allow select teacher_class_assignments" ON public.teacher_class_assignments 
FOR SELECT USING (true);

-- 2. Quyền ghi: Chỉ máy chủ (Service Role) mới được phép INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Service role full access teacher_class_assignments" ON public.teacher_class_assignments;
CREATE POLICY "Service role full access teacher_class_assignments" ON public.teacher_class_assignments 
FOR ALL TO service_role USING (true) WITH CHECK (true);
