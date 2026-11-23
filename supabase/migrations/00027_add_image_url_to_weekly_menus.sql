-- ==============================================================================
-- Migration 00027: Add image_url to weekly_menus
-- Author: Senior Mobile UI/UX & Frontend Engineer
-- Description:
--   Bổ sung trường `image_url` vào bảng `weekly_menus` để nhà trường có thể upload
--   và hiển thị ảnh thực tế món ăn cho học sinh trên cả Web Admin và PWA.
-- ==============================================================================

ALTER TABLE public.weekly_menus 
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.weekly_menus.image_url IS 'Đường dẫn ảnh thực tế món ăn (Supabase Storage hoặc URL)';

-- Tự động làm mới bộ nhớ đệm lược đồ (Schema Cache) của PostgREST
NOTIFY pgrst, 'reload schema';
