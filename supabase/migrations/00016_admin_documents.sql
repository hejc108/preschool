-- ==============================================================================
-- Migration 00016: Admin Documents Module & Google Drive Auto-Archive Tracking
-- Description:
--   1. Tạo bảng public.document_categories & seed 6 danh mục văn bản chuẩn mầm non.
--   2. Tạo bảng public.school_documents lưu metadata tài liệu (Supabase Storage
--      private bucket 'school-documents' hoặc External Link Google Workspace),
--      cùng các cột theo dõi đồng bộ Google Drive theo năm.
--   3. Bật Layer-2 RLS chuẩn CR-01 dùng public.current_active_role() & service_role.
--   4. Cấu hình an toàn private bucket 'school-documents' (25MB) & storage.objects RLS.
-- ==============================================================================

-- 1. Bảng danh mục văn bản
CREATE TABLE IF NOT EXISTS public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 6 danh mục chuẩn mầm non (idempotent)
INSERT INTO public.document_categories (code, name, sort_order) VALUES
  ('CV_DEN_DI', 'Công văn đến / đi', 1),
  ('KE_HOACH', 'Kế hoạch năm học & Chuyên môn', 2),
  ('KIEM_DINH', 'Hồ sơ kiểm định chất lượng', 3),
  ('QUY_CHE', 'Quy chế & Nội quy nhà trường', 4),
  ('Y_TE_BEP', 'Hồ sơ Y tế & Bếp ăn bán trú', 5),
  ('BIEU_MAU', 'Biểu mẫu hành chính nội bộ', 6)
ON CONFLICT (code) DO NOTHING;

-- 2. Bảng tài liệu nhà trường
CREATE TABLE IF NOT EXISTS public.school_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  document_number TEXT,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE RESTRICT,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('SUPABASE_STORAGE', 'EXTERNAL_LINK')),
  storage_path TEXT,
  external_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  description TEXT,
  visibility_scope TEXT NOT NULL DEFAULT 'ALL_ADMINS'
    CHECK (visibility_scope IN ('ALL_ADMINS', 'SUPER_ADMIN_ONLY')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Theo dõi tự động sao lưu Google Drive theo năm
  drive_sync_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (drive_sync_status IN ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED')),
  drive_file_id TEXT,
  drive_web_view_link TEXT,
  drive_synced_at TIMESTAMPTZ,
  drive_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes phục vụ tra cứu, lọc theo danh mục/năm/trạng thái/phạm vi
CREATE INDEX IF NOT EXISTS idx_school_documents_category
  ON public.school_documents(category_id);

CREATE INDEX IF NOT EXISTS idx_school_documents_status_issued
  ON public.school_documents(status, issued_date DESC);

CREATE INDEX IF NOT EXISTS idx_school_documents_visibility
  ON public.school_documents(visibility_scope);

-- Chặn trùng số hiệu văn bản (không phân biệt hoa/thường) giữa các văn bản ACTIVE
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_documents_active_number_unique
  ON public.school_documents (LOWER(TRIM(document_number)))
  WHERE document_number IS NOT NULL
    AND TRIM(document_number) <> ''
    AND status = 'ACTIVE';

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION public.fn_touch_school_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_school_documents_updated_at ON public.school_documents;
CREATE TRIGGER trg_touch_school_documents_updated_at
BEFORE UPDATE ON public.school_documents
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_school_documents_updated_at();

-- 3. Bật RLS & Phân quyền Layer-2 (đồng bộ public.current_active_role())
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_documents ENABLE ROW LEVEL SECURITY;

-- 3a. Policies cho document_categories
DROP POLICY IF EXISTS "Service role full access document_categories" ON public.document_categories;
CREATE POLICY "Service role full access document_categories"
  ON public.document_categories
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view categories" ON public.document_categories;
CREATE POLICY "Admins can view categories"
  ON public.document_categories
  FOR SELECT TO authenticated
  USING (public.current_active_role() IN ('SUPER_ADMIN', 'SCHOOL_ADMIN'));

DROP POLICY IF EXISTS "Super admin manage categories" ON public.document_categories;
CREATE POLICY "Super admin manage categories"
  ON public.document_categories
  FOR ALL TO authenticated
  USING (public.current_active_role() = 'SUPER_ADMIN')
  WITH CHECK (public.current_active_role() = 'SUPER_ADMIN');

-- 3b. Policies cho school_documents
DROP POLICY IF EXISTS "Service role full access school_documents" ON public.school_documents;
CREATE POLICY "Service role full access school_documents"
  ON public.school_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view allowed documents" ON public.school_documents;
CREATE POLICY "Admins can view allowed documents"
  ON public.school_documents
  FOR SELECT TO authenticated
  USING (
    public.current_active_role() = 'SUPER_ADMIN'
    OR (
      public.current_active_role() = 'SCHOOL_ADMIN'
      AND visibility_scope = 'ALL_ADMINS'
    )
  );

DROP POLICY IF EXISTS "Admins can insert allowed documents" ON public.school_documents;
CREATE POLICY "Admins can insert allowed documents"
  ON public.school_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_active_role() = 'SUPER_ADMIN'
    OR (
      public.current_active_role() = 'SCHOOL_ADMIN'
      AND visibility_scope = 'ALL_ADMINS'
    )
  );

DROP POLICY IF EXISTS "Admins can update allowed documents" ON public.school_documents;
CREATE POLICY "Admins can update allowed documents"
  ON public.school_documents
  FOR UPDATE TO authenticated
  USING (
    public.current_active_role() = 'SUPER_ADMIN'
    OR (
      public.current_active_role() = 'SCHOOL_ADMIN'
      AND visibility_scope = 'ALL_ADMINS'
    )
  )
  WITH CHECK (
    public.current_active_role() = 'SUPER_ADMIN'
    OR (
      public.current_active_role() = 'SCHOOL_ADMIN'
      AND visibility_scope = 'ALL_ADMINS'
    )
  );

DROP POLICY IF EXISTS "Super admin can delete documents" ON public.school_documents;
CREATE POLICY "Super admin can delete documents"
  ON public.school_documents
  FOR DELETE TO authenticated
  USING (public.current_active_role() = 'SUPER_ADMIN');

-- 4. Khởi tạo an toàn Private Storage Bucket 'school-documents' & Storage RLS
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'school-documents',
      'school-documents',
      false,
      26214400, -- 25MB
      ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
        'image/jpeg'
      ]
    )
    ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin upload school-documents" ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY "Admin upload school-documents"
        ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'school-documents'
          AND public.current_active_role() IN ('SUPER_ADMIN', 'SCHOOL_ADMIN')
        )
    $pol$;

    EXECUTE 'DROP POLICY IF EXISTS "Admin read allowed school-documents" ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY "Admin read allowed school-documents"
        ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'school-documents'
          AND (
            public.current_active_role() = 'SUPER_ADMIN'
            OR (
              public.current_active_role() = 'SCHOOL_ADMIN'
              AND EXISTS (
                SELECT 1
                FROM public.school_documents d
                WHERE d.storage_path = storage.objects.name
                  AND d.visibility_scope = 'ALL_ADMINS'
              )
            )
          )
        )
    $pol$;

    EXECUTE 'DROP POLICY IF EXISTS "Super admin delete school-documents" ON storage.objects';
    EXECUTE $pol$
      CREATE POLICY "Super admin delete school-documents"
        ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = 'school-documents'
          AND public.current_active_role() = 'SUPER_ADMIN'
        )
    $pol$;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;
