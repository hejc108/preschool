-- ==============================================================================
-- 00025_create_read_receipts_table.sql
-- Bảng ghi nhận lượt đọc thông báo (Read Receipts) cho PWA Phụ huynh & Giáo viên
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_context VARCHAR(20) DEFAULT 'PARENT',
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT read_receipts_announcement_user_unique UNIQUE (announcement_id, user_id, role_context)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_announcement_id 
  ON public.read_receipts(announcement_id);

CREATE INDEX IF NOT EXISTS idx_read_receipts_user_role 
  ON public.read_receipts(user_id, role_context);

-- Kích hoạt RLS
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role full access read_receipts" ON public.read_receipts;
CREATE POLICY "Service role full access read_receipts" ON public.read_receipts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users có thể đọc và ghi lượt đọc
DROP POLICY IF EXISTS "Authenticated users manage read_receipts" ON public.read_receipts;
CREATE POLICY "Authenticated users manage read_receipts" ON public.read_receipts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
