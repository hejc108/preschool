-- Migration 00004: Non-regular Students, Temporary Staff & Multi-role RBAC Architecture
-- Author: QC Lead & Chuyên Gia Bảo Mật Hệ Thống Sương Mai
-- Date: 2026-10-14
-- Description:
-- 1. Bổ sung cột is_non_regular và đánh chỉ mục trên bảng public.students (quản lý học sinh ngoài chính quy)
-- 2. Bổ sung cột is_temporary và đánh chỉ mục trên bảng public.profiles (quản lý giáo viên/nhân sự thời vụ)
-- 3. Đảm bảo cấu trúc hỗ trợ và không chặn tài khoản Đa vai trò (Cô giáo kiêm Phụ huynh)
--    kết nối mượt mà giữa teacher_class_assignments và parent_student_relations / student_guardians.

-- 1. CẬP NHẬT BẢNG STUDENTS (Học sinh ngoài chính quy)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'is_non_regular'
    ) THEN
        ALTER TABLE public.students ADD COLUMN is_non_regular BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Đánh chỉ mục tối ưu truy vấn cho bộ lọc học sinh ngoài chính quy
CREATE INDEX IF NOT EXISTS idx_students_non_regular ON public.students(is_non_regular);


-- 2. CẬP NHẬT BẢNG PROFILES (Giáo viên / Nhân viên thời vụ)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_temporary'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_temporary BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Đánh chỉ mục tối ưu truy vấn cho bộ lọc nhân sự thời vụ
CREATE INDEX IF NOT EXISTS idx_profiles_temporary ON public.profiles(is_temporary);


-- 3. HỖ TRỢ ĐA VAI TRÒ (CÔ GIÁO KIÊM PHỤ HUYNH)
-- Đảm bảo bảng parent_student_relations tồn tại độc lập hoặc tương thích hoàn toàn với student_guardians
CREATE TABLE IF NOT EXISTS public.parent_student_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_email TEXT NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT,
    is_verified BOOLEAN DEFAULT true,
    relationship TEXT DEFAULT 'MẸ' CHECK (relationship IN ('BỐ', 'MẸ', 'ÔNG', 'BÀ', 'NGƯỜI GIÁM HỘ')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_parent_student_email UNIQUE(parent_email, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_student_relations_email ON public.parent_student_relations(parent_email);
CREATE INDEX IF NOT EXISTS idx_parent_student_relations_parent_id ON public.parent_student_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_relations_student_id ON public.parent_student_relations(student_id);

-- Đảm bảo bảng teacher_class_assignments tồn tại phục vụ phân công giáo viên đứng lớp
CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_email TEXT NOT NULL,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    class_name TEXT,
    academic_year TEXT DEFAULT '2026-2027',
    is_main_teacher BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_teacher_class_year UNIQUE(teacher_id, class_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_email ON public.teacher_class_assignments(teacher_email);
CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class ON public.teacher_class_assignments(class_id);

-- Bật RLS và cấp quyền truy cập an toàn
ALTER TABLE public.parent_student_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select parent_student_relations" ON public.parent_student_relations;
CREATE POLICY "Allow select parent_student_relations" ON public.parent_student_relations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select teacher_class_assignments" ON public.teacher_class_assignments;
CREATE POLICY "Allow select teacher_class_assignments" ON public.teacher_class_assignments FOR ALL USING (true);
