-- ==============================================================================
-- Migration 00008: Unblock Profiles FK, Auto-link Google Auth & Global System Settings
-- Author: QC Lead & Chuyên Gia Bảo Mật Hệ Thống Sương Mai
-- Date: 2026-10-14
-- Description:
--   1. Gỡ bỏ Foreign Key ràng buộc profiles(id) -> auth.users(id) để cho phép
--      nạp trước hồ sơ nhân sự (id tự sinh gen_random_uuid()).
--   2. Bổ sung cột is_temporary trên profiles và đánh chỉ mục.
--   3. Cập nhật trigger handle_new_user() tự động ghép nối theo email khi nhân sự
--      đăng nhập Google lần đầu, bảo lưu toàn vẹn vai trò và phân công.
--   4. Khởi tạo bảng public.system_settings để lưu cấu hình tập trung toàn trường
--      do SUPER_ADMIN điều khiển (allow_school_admin_view_non_regular, allow_school_admin_view_temporary_staff).
-- ==============================================================================

-- 1. GỠ BỎ RÀNG BUỘC FOREIGN KEY TRÊN BẢNG PROFILES
DO $$
BEGIN
    -- Gỡ bỏ foreign key constraint profiles_id_fkey nếu đang tồn tại
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END $$;

-- Thiết lập id có giá trị mặc định tự sinh nếu chưa có
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Bổ sung cột is_temporary nếu chưa có
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_temporary'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_temporary BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_temporary ON public.profiles(is_temporary);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);


-- 2. CẬP NHẬT TRIGGER TỰ ĐỘNG GHÉP NỐI GOOGLE AUTH THEO EMAIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    existing_profile RECORD;
    incoming_email TEXT;
BEGIN
    incoming_email := LOWER(TRIM(new.email));

    -- Kiểm tra xem hồ sơ đã được nạp trước theo email chưa
    SELECT * INTO existing_profile 
    FROM public.profiles 
    WHERE LOWER(TRIM(email)) = incoming_email 
    LIMIT 1;

    IF existing_profile.id IS NOT NULL THEN
        -- Đã có hồ sơ tạo trước: cập nhật avatar và thời gian, bảo lưu nguyên vẹn role/approval_status
        UPDATE public.profiles
        SET
            avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', avatar_url),
            updated_at = NOW()
        WHERE id = existing_profile.id;
    ELSE
        -- Người dùng mới hoàn toàn: tạo hồ sơ mới
        INSERT INTO public.profiles (
            id,
            email,
            full_name,
            avatar_url,
            role,
            approval_status,
            created_at,
            updated_at
        )
        VALUES (
            new.id,
            new.email,
            COALESCE(
                new.raw_user_meta_data->>'full_name',
                new.raw_user_meta_data->>'name',
                split_part(new.email, '@', 1)
            ),
            COALESCE(
                new.raw_user_meta_data->>'avatar_url',
                new.raw_user_meta_data->>'picture',
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
            ),
            CASE 
                WHEN incoming_email = 'sadmin@suongmai.edu.vn' THEN 'SUPER_ADMIN'
                WHEN incoming_email = 'luciaxuan178@gmail.com' THEN 'SCHOOL_ADMIN'
                ELSE 'GUEST'
            END,
            CASE 
                WHEN incoming_email IN ('luciaxuan178@gmail.com', 'sadmin@suongmai.edu.vn') THEN 'ACTIVE'
                ELSE 'PENDING'
            END,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = NOW();
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. BẢNG CẤU HÌNH TẬP TRUNG TOÀN TRƯỜNG (SYSTEM_SETTINGS)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Bật RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Quyền đọc công khai cho authenticated và anon
DROP POLICY IF EXISTS "Allow select system_settings" ON public.system_settings;
CREATE POLICY "Allow select system_settings" ON public.system_settings 
FOR SELECT USING (true);

-- Quyền ghi chỉ dành cho Service Role (thông qua API bảo mật)
DROP POLICY IF EXISTS "Service role full access system_settings" ON public.system_settings;
CREATE POLICY "Service role full access system_settings" ON public.system_settings 
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Khởi tạo 2 giá trị cấu hình mặc định (false)
INSERT INTO public.system_settings (key, value, description)
VALUES 
    (
        'allow_school_admin_view_non_regular', 
        'false'::jsonb, 
        'Cho phép Quản trị trường xem 21 học sinh ngoài chính quy'
    ),
    (
        'allow_school_admin_view_temporary_staff', 
        'false'::jsonb, 
        'Cho phép Quản trị trường xem nhân sự / giáo viên thời vụ'
    )
ON CONFLICT (key) DO NOTHING;
