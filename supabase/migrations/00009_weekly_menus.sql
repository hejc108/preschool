-- ==============================================================================
-- Migration 00009: Weekly Menus (4-Week Rotating Matrix Persistence)
-- Author: QC Lead & Full-Stack System Architect
-- Date: 2026-10-17
-- Description:
--   Bảng quản lý ma trận thực đơn xoay vòng 4 tuần (Mầm Non Sương Mai).
--   Lưu trữ các món ăn theo từng tuần, từng thứ trong tuần và từng bữa ăn.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_menus (
    id TEXT PRIMARY KEY,
    week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY')),
    meal_type TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH_MAIN', 'LUNCH_SOUP', 'DESSERT', 'AFTERNOON_SNACK')),
    dish_name TEXT NOT NULL,
    allergens TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_week_day_meal UNIQUE(week_number, day_of_week, meal_type)
);

-- Đánh chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_weekly_menus_week_day ON public.weekly_menus(week_number, day_of_week);

-- Bật Row Level Security (RLS)
ALTER TABLE public.weekly_menus ENABLE ROW LEVEL SECURITY;

-- 1. Quyền đọc: Mọi người dùng (Phụ huynh, Giáo viên, Khách) đều được phép đọc thực đơn
DROP POLICY IF EXISTS "Allow select weekly_menus" ON public.weekly_menus;
CREATE POLICY "Allow select weekly_menus" ON public.weekly_menus 
FOR SELECT USING (true);

-- 2. Quyền ghi: Chỉ Service Role mới được quyền cập nhật (thực hiện qua API Route bảo mật)
DROP POLICY IF EXISTS "Service role full access weekly_menus" ON public.weekly_menus;
CREATE POLICY "Service role full access weekly_menus" ON public.weekly_menus 
FOR ALL TO service_role USING (true) WITH CHECK (true);
