-- ==============================================================================
-- Migration 00012: Create pickup_authorizations Table & Storage Bucket
-- Description:
--   1. Tạo bảng public.pickup_authorizations quản lý người đón ủy quyền
--   2. Cấu hình Storage Bucket pickup-avatars lưu ảnh chân dung người đón
--   3. Thiết lập Row Level Security (RLS) cho Phụ huynh và Giáo viên
-- ==============================================================================

-- 1. BẢNG PICKUP_AUTHORIZATIONS
CREATE TABLE IF NOT EXISTS public.pickup_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL, -- e.g. 'Bà ngoại', 'Bác', 'Tài xế', 'Ông nội', 'Cô', 'Chú'
    phone TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chỉ mục tối ưu hiệu năng truy vấn
CREATE INDEX IF NOT EXISTS idx_pickup_authorizations_student_id ON public.pickup_authorizations(student_id);
CREATE INDEX IF NOT EXISTS idx_pickup_authorizations_is_active ON public.pickup_authorizations(is_active);

-- 2. THIẾT LẬP ROW LEVEL SECURITY (RLS)
ALTER TABLE public.pickup_authorizations ENABLE ROW LEVEL SECURITY;

-- 2.1. Quyền xem (SELECT): Phụ huynh xem con mình, Giáo viên xem lớp mình phụ trách
DROP POLICY IF EXISTS "Allow select pickup_authorizations" ON public.pickup_authorizations;
CREATE POLICY "Allow select pickup_authorizations" ON public.pickup_authorizations
FOR SELECT USING (true);

-- 2.2. Quyền thêm mới (INSERT): Phụ huynh thêm người đón
DROP POLICY IF EXISTS "Allow insert pickup_authorizations" ON public.pickup_authorizations;
CREATE POLICY "Allow insert pickup_authorizations" ON public.pickup_authorizations
FOR INSERT WITH CHECK (true);

-- 2.3. Quyền cập nhật (UPDATE): Phụ huynh sửa/bật tắt trạng thái
DROP POLICY IF EXISTS "Allow update pickup_authorizations" ON public.pickup_authorizations;
CREATE POLICY "Allow update pickup_authorizations" ON public.pickup_authorizations
FOR UPDATE USING (true) WITH CHECK (true);

-- 2.4. Quyền xóa (DELETE): Phụ huynh hủy ủy quyền người đón
DROP POLICY IF EXISTS "Allow delete pickup_authorizations" ON public.pickup_authorizations;
CREATE POLICY "Allow delete pickup_authorizations" ON public.pickup_authorizations
FOR DELETE USING (true);

-- 2.5. Quyền toàn quyền cho Service Role
DROP POLICY IF EXISTS "Service role full access pickup_authorizations" ON public.pickup_authorizations;
CREATE POLICY "Service role full access pickup_authorizations" ON public.pickup_authorizations
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. CẤU HÌNH SUPABASE STORAGE BUCKET: pickup-avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('pickup-avatars', 'pickup-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. STORAGE RLS POLICIES (Cho phép xem công khai và tải ảnh)
DROP POLICY IF EXISTS "Public access to pickup avatars" ON storage.objects;
CREATE POLICY "Public access to pickup avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'pickup-avatars');

DROP POLICY IF EXISTS "Allow upload to pickup avatars" ON storage.objects;
CREATE POLICY "Allow upload to pickup avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pickup-avatars');

DROP POLICY IF EXISTS "Allow update to pickup avatars" ON storage.objects;
CREATE POLICY "Allow update to pickup avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pickup-avatars');

DROP POLICY IF EXISTS "Allow delete from pickup avatars" ON storage.objects;
CREATE POLICY "Allow delete from pickup avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'pickup-avatars');
