-- ==============================================================================
-- 00024_announcement_audio_storage.sql
-- Nâng cấp Lưu trữ File Âm thanh Audio AI (TTS) & Đa dạng Giọng đọc (FR-02)
-- Trường Mầm non Sương Mai (mamnonsuongmai.edu.vn)
-- ==============================================================================

-- Bổ sung các cột lưu trữ audio trực tiếp vào bảng public.announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_type TEXT DEFAULT 'vn_north_female_teacher',
  ADD COLUMN IF NOT EXISTS background_music TEXT DEFAULT 'Nhạc Lễ hội Thiếu nhi (Không bản quyền)';

CREATE INDEX IF NOT EXISTS idx_announcements_audio_url ON public.announcements(audio_url) WHERE audio_url IS NOT NULL;

-- Khởi tạo Supabase Storage Bucket cho File Âm thanh (Audio AI TTS)
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    -- Bucket chuyên dụng cho âm thanh thông báo
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'announcement-audios',
      'announcement-audios',
      true,
      20971520, -- 20MB
      ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 20971520;

    -- Cho phép tải tệp âm thanh vào announcement-posters nếu tái sử dụng bucket
    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'
    ]
    WHERE id = 'announcement-posters';
  END IF;
END $$;

-- RLS Policies cho storage.objects của bucket announcement-audios (nếu có schema storage)
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    -- Cho phép mọi người (authenticated & anon) đọc/nghe file audio
    DROP POLICY IF EXISTS "Anyone can listen to announcement audios" ON storage.objects;
    CREATE POLICY "Anyone can listen to announcement audios" ON storage.objects
      FOR SELECT TO authenticated, anon
      USING (bucket_id = 'announcement-audios');

    -- Chỉ Admin mới được upload audio vào bucket announcement-audios
    DROP POLICY IF EXISTS "Admin can upload announcement audios" ON storage.objects;
    CREATE POLICY "Admin can upload announcement audios" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'announcement-audios' AND public.is_admin_active());

    DROP POLICY IF EXISTS "Admin can update announcement audios" ON storage.objects;
    CREATE POLICY "Admin can update announcement audios" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'announcement-audios' AND public.is_admin_active())
      WITH CHECK (bucket_id = 'announcement-audios' AND public.is_admin_active());

    DROP POLICY IF EXISTS "Admin can delete announcement audios" ON storage.objects;
    CREATE POLICY "Admin can delete announcement audios" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'announcement-audios' AND public.is_admin_active());
  END IF;
END $$;
