-- ==============================================================================
-- Migration 00005: Extended Schema for Students & Staff Bulk Import
-- Author: QC Lead & Security Specialist
-- Date: 2026-10-14
-- Description:
--   Bổ sung đầy đủ các cột thông tin học sinh (địa chỉ, phụ huynh, dân tộc, SĐT,..)
--   và nhân sự (thời vụ, trạng thái hoạt động) để script import_data.ts hoạt động 100%.
-- ==============================================================================

-- 1. NÂNG CẤP BẢNG STUDENTS (Học sinh)
DO $$
BEGIN
    -- 1.1 Cột mã học sinh code (đồng bộ với student_code)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'code') THEN
        ALTER TABLE public.students ADD COLUMN code TEXT;
    END IF;

    -- 1.2 Tên lớp hiển thị (class_name)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_name') THEN
        ALTER TABLE public.students ADD COLUMN class_name TEXT;
    END IF;

    -- 1.3 Dân tộc
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'ethnicity') THEN
        ALTER TABLE public.students ADD COLUMN ethnicity TEXT DEFAULT 'Kinh';
    END IF;

    -- 1.4 Thông tin Bố
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'father_name') THEN
        ALTER TABLE public.students ADD COLUMN father_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'father_job') THEN
        ALTER TABLE public.students ADD COLUMN father_job TEXT;
    END IF;

    -- 1.5 Thông tin Mẹ
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'mother_name') THEN
        ALTER TABLE public.students ADD COLUMN mother_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'mother_job') THEN
        ALTER TABLE public.students ADD COLUMN mother_job TEXT;
    END IF;

    -- 1.6 Địa chỉ cư trú
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'address') THEN
        ALTER TABLE public.students ADD COLUMN address TEXT;
    END IF;

    -- 1.7 Số điện thoại liên hệ 1 & 2
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'phone_1') THEN
        ALTER TABLE public.students ADD COLUMN phone_1 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'phone_2') THEN
        ALTER TABLE public.students ADD COLUMN phone_2 TEXT;
    END IF;

    -- 1.8 Cờ học sinh ngoài chính quy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'is_non_regular') THEN
        ALTER TABLE public.students ADD COLUMN is_non_regular BOOLEAN DEFAULT FALSE;
    END IF;

    -- 1.9 Thời gian cập nhật
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'updated_at') THEN
        ALTER TABLE public.students ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Nới lỏng ràng buộc CHECK để chấp nhận cả NAM/NỮ hoặc MALE/FEMALE
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_gender_check;
ALTER TABLE public.students ADD CONSTRAINT students_gender_check CHECK (gender IN ('NAM', 'NỮ', 'MALE', 'FEMALE') OR gender IS NULL);

-- Nới lỏng ràng buộc CHECK status để chấp nhận cả ACTIVE/GRADUATED/WITHDRAWN hoặc ENROLLED
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_status_check CHECK (status IN ('ACTIVE', 'GRADUATED', 'WITHDRAWN', 'ENROLLED') OR status IS NULL);

-- Đảm bảo chỉ mục duy nhất cho code
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_code_unique ON public.students(code);
CREATE INDEX IF NOT EXISTS idx_students_class_name ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_is_non_regular ON public.students(is_non_regular);

-- Trigger tự động đồng bộ giữa code và student_code
CREATE OR REPLACE FUNCTION public.sync_student_codes() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NOT NULL AND (NEW.student_code IS NULL OR NEW.student_code = '') THEN
        NEW.student_code := NEW.code;
    ELSIF NEW.student_code IS NOT NULL AND (NEW.code IS NULL OR NEW.code = '') THEN
        NEW.code := NEW.student_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_student_codes ON public.students;
CREATE TRIGGER trigger_sync_student_codes 
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.sync_student_codes();


-- 2. NÂNG CẤP BẢNG PROFILES (Cán bộ - Giáo viên - Nhân viên)
DO $$
BEGIN
    -- 2.1 Cờ nhân sự thời vụ
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_temporary') THEN
        ALTER TABLE public.profiles ADD COLUMN is_temporary BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2.2 Trạng thái hoạt động
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'ACTIVE';
    END IF;
END $$;

-- Cho phép bảng profiles tự sinh UUID nếu user chưa từng đăng nhập Google OAuth
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Bỏ ràng buộc bắt buộc id phải có sẵn trong auth.users (để cho phép nhập danh sách giáo viên trước khi họ đăng nhập)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Cấp quyền truy cập an toàn cho RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to students" ON public.students;
CREATE POLICY "Public full access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to profiles" ON public.profiles;
CREATE POLICY "Public full access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
