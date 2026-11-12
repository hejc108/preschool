-- ==============================================================================
-- Migration 00015: Flexible Monthly Menu Cycle Config & Calendar Assignments
-- Description:
--   1. Tạo bảng public.menu_cycle_configs lưu chế độ chu kỳ đang kích hoạt
--      (AUTO_ROTATE_4 | MANUAL_CALENDAR) và fallback cho Tuần 5 (1 hoặc 4).
--   2. Tạo bảng public.menu_calendar_assignments lưu ánh xạ tuần học trong tháng
--      (Thứ 2 - Thứ 6) sang bộ thực đơn Tuần 1..4 khi bật chế độ Thủ công.
--   3. Bật RLS đồng bộ chuẩn Layer-2 và đưa vào publication supabase_realtime.
-- ==============================================================================

-- 1. Bảng cấu hình chế độ chu kỳ thực đơn (active config)
CREATE TABLE IF NOT EXISTS public.menu_cycle_configs (
  id TEXT PRIMARY KEY DEFAULT 'default',
  cycle_mode TEXT NOT NULL DEFAULT 'AUTO_ROTATE_4'
    CHECK (cycle_mode IN ('AUTO_ROTATE_4', 'MANUAL_CALENDAR')),
  week_5_fallback INT NOT NULL DEFAULT 1
    CHECK (week_5_fallback BETWEEN 1 AND 4),
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nâng cấp idempotent nếu migration trước đó đã tạo cột week5_fallback
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'menu_cycle_configs'
      AND column_name = 'week5_fallback'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'menu_cycle_configs'
      AND column_name = 'week_5_fallback'
  ) THEN
    ALTER TABLE public.menu_cycle_configs RENAME COLUMN week5_fallback TO week_5_fallback;
  END IF;

  IF to_regclass('public.menu_cycle_configs') IS NOT NULL THEN
    FOR v_constraint IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.menu_cycle_configs'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%week%fallback%'
    LOOP
      EXECUTE format('ALTER TABLE public.menu_cycle_configs DROP CONSTRAINT %I', v_constraint);
    END LOOP;

    ALTER TABLE public.menu_cycle_configs
      ADD CONSTRAINT chk_menu_cycle_week_5_fallback CHECK (week_5_fallback BETWEEN 1 AND 4);
  END IF;
END $$;

-- Seed cấu hình mặc định (idempotent)
INSERT INTO public.menu_cycle_configs (id, cycle_mode, week_5_fallback)
VALUES ('default', 'AUTO_ROTATE_4', 1)
ON CONFLICT (id) DO NOTHING;

-- 2. Bảng ánh xạ tuần học theo tháng -> bộ thực đơn Tuần 1..4
CREATE TABLE IF NOT EXISTS public.menu_calendar_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  week_of_month INT NOT NULL CHECK (week_of_month BETWEEN 1 AND 5),
  assigned_menu_week INT NOT NULL CHECK (assigned_menu_week BETWEEN 1 AND 4),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  notes TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_menu_calendar_month_week UNIQUE (year, month, week_of_month)
);

CREATE INDEX IF NOT EXISTS idx_menu_calendar_assignments_year_month
  ON public.menu_calendar_assignments(year, month);

-- 3. Bật RLS & Policy chuẩn CR-01
ALTER TABLE public.menu_cycle_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_calendar_assignments ENABLE ROW LEVEL SECURITY;

-- menu_cycle_configs policies
DROP POLICY IF EXISTS "Service role full access menu_cycle_configs" ON public.menu_cycle_configs;
CREATE POLICY "Service role full access menu_cycle_configs"
  ON public.menu_cycle_configs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read menu_cycle_configs" ON public.menu_cycle_configs;
CREATE POLICY "Authenticated read menu_cycle_configs"
  ON public.menu_cycle_configs
  FOR SELECT TO authenticated
  USING (public.current_profile_id() IS NOT NULL);

DROP POLICY IF EXISTS "Admin or staff modify menu_cycle_configs" ON public.menu_cycle_configs;
CREATE POLICY "Admin or staff modify menu_cycle_configs"
  ON public.menu_cycle_configs
  FOR ALL TO authenticated
  USING (public.is_admin_active() OR public.current_active_role() = 'STAFF')
  WITH CHECK (public.is_admin_active() OR public.current_active_role() = 'STAFF');

-- menu_calendar_assignments policies
DROP POLICY IF EXISTS "Service role full access menu_calendar_assignments" ON public.menu_calendar_assignments;
CREATE POLICY "Service role full access menu_calendar_assignments"
  ON public.menu_calendar_assignments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read menu_calendar_assignments" ON public.menu_calendar_assignments;
CREATE POLICY "Authenticated read menu_calendar_assignments"
  ON public.menu_calendar_assignments
  FOR SELECT TO authenticated
  USING (public.current_profile_id() IS NOT NULL);

DROP POLICY IF EXISTS "Admin or staff modify menu_calendar_assignments" ON public.menu_calendar_assignments;
CREATE POLICY "Admin or staff modify menu_calendar_assignments"
  ON public.menu_calendar_assignments
  FOR ALL TO authenticated
  USING (public.is_admin_active() OR public.current_active_role() = 'STAFF')
  WITH CHECK (public.is_admin_active() OR public.current_active_role() = 'STAFF');

-- 4. Đưa vào Supabase Realtime publication (an toàn & idempotent)
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'menu_cycle_configs',
    'menu_calendar_assignments'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables LOOP
      IF to_regclass('public.' || v_table) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = v_table
         )
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;
