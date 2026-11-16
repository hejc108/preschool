-- ==============================================================================
-- 00023_tts_pronunciation_dictionary.sql
-- Bảng Từ điển Phát âm Tùy chỉnh (TTS Pronunciation Dictionary)
-- Dùng để chuẩn hóa từ viết tắt, ngày tháng, hotline trước khi đọc qua AI Audio
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tts_pronunciations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  spoken_text TEXT NOT NULL,
  category TEXT DEFAULT 'COMMON', -- 'ACRONYM', 'DATE_TIME', 'CONTACT', 'COMMON'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tts_pronunciations_keyword ON public.tts_pronunciations(keyword);
CREATE INDEX IF NOT EXISTS idx_tts_pronunciations_active ON public.tts_pronunciations(is_active);

-- Enable RLS
ALTER TABLE public.tts_pronunciations ENABLE ROW LEVEL SECURITY;

-- Ai cũng có thể đọc từ điển phát âm
DROP POLICY IF EXISTS "Anyone can read tts pronunciations" ON public.tts_pronunciations;
CREATE POLICY "Anyone can read tts pronunciations" ON public.tts_pronunciations
  FOR SELECT TO authenticated
  USING (true);

-- Cho phép cả anon đọc nếu cần trên mobile PWA
DROP POLICY IF EXISTS "Anon can read tts pronunciations" ON public.tts_pronunciations;
CREATE POLICY "Anon can read tts pronunciations" ON public.tts_pronunciations
  FOR SELECT TO anon
  USING (true);

-- Chỉ Admin mới được thêm/sửa/xóa từ điển
DROP POLICY IF EXISTS "Admin insert tts pronunciations" ON public.tts_pronunciations;
CREATE POLICY "Admin insert tts pronunciations" ON public.tts_pronunciations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_active());

DROP POLICY IF EXISTS "Admin update tts pronunciations" ON public.tts_pronunciations;
CREATE POLICY "Admin update tts pronunciations" ON public.tts_pronunciations
  FOR UPDATE TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

DROP POLICY IF EXISTS "Admin delete tts pronunciations" ON public.tts_pronunciations;
CREATE POLICY "Admin delete tts pronunciations" ON public.tts_pronunciations
  FOR DELETE TO authenticated
  USING (public.is_admin_active());

-- Khởi tạo sẵn các từ viết tắt sư phạm cốt lõi của Trường Mầm non Sương Mai
INSERT INTO public.tts_pronunciations (keyword, spoken_text, category)
VALUES
  ('BGH', 'Ban Giám Hiệu', 'ACRONYM'),
  ('CBQL', 'Cán bộ quản lý', 'ACRONYM'),
  ('GVMN', 'Giáo viên mầm non', 'ACRONYM'),
  ('20-11', 'ngày 20 tháng 11', 'DATE_TIME'),
  ('mamnonsuongmai.edu.vn', 'mầm non sương mai chấm e đu chấm vê en', 'CONTACT'),
  ('UBND', 'Ủy ban nhân dân', 'ACRONYM'),
  ('PHHS', 'Phụ huynh học sinh', 'ACRONYM'),
  ('STK', 'Số tài khoản', 'COMMON'),
  ('VN', 'Việt Nam', 'COMMON'),
  ('TP', 'Thành phố', 'COMMON'),
  ('SĐT', 'Số điện thoại', 'CONTACT'),
  ('0262.352.1234', 'không hai sáu hai, ba năm hai, một hai ba bốn', 'CONTACT')
ON CONFLICT (keyword) DO UPDATE SET
  spoken_text = EXCLUDED.spoken_text,
  category = EXCLUDED.category,
  updated_at = NOW();
