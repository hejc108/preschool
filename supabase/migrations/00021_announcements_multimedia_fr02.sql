-- ==============================================================================
-- 00021_announcements_multimedia_fr02.sql
-- Nâng cấp tính năng Quản lý & Tạo Thông báo Đa phương tiện (FR-02)
-- Bổ sung trường category, status, metadata và chính sách RLS UPDATE/DELETE
-- ==============================================================================

ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Lễ hội',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED')),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cập nhật chỉ mục tìm kiếm và phân loại
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON public.announcements(category);

-- Bổ sung RLS Policies cho UPDATE & DELETE
DROP POLICY IF EXISTS "Admin update announcements" ON public.announcements;
CREATE POLICY "Admin update announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

DROP POLICY IF EXISTS "Admin delete announcements" ON public.announcements;
CREATE POLICY "Admin delete announcements" ON public.announcements
  FOR DELETE TO authenticated
  USING (public.is_admin_active());
