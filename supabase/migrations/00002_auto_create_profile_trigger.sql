-- Migration 00002: Auto-create Profile Trigger on auth.users INSERT
-- Ensures public.profiles has approval_status & flexible role constraint,
-- and automatically inserts a GUEST/PENDING profile whenever a new user registers via Google/OAuth.

-- 1. Chuẩn hóa bảng public.profiles (thêm cột approval_status và bỏ CHECK constraint cũ nếu có)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN approval_status TEXT DEFAULT 'PENDING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'assigned_class_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_class_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'assigned_class_name'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN assigned_class_name TEXT;
    END IF;
END $$;

-- Bỏ CHECK constraint cũ trên role nếu có
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Hàm tự động chèn profile khi có user auth mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
      WHEN LOWER(TRIM(new.email)) = 'sadmin@suongmai.edu.vn' THEN 'SUPER_ADMIN' 
      ELSE 'GUEST' 
    END,
    CASE 
      WHEN LOWER(TRIM(new.email)) = 'sadmin@suongmai.edu.vn' THEN 'ACTIVE' 
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

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Gắn trigger vào bảng auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
