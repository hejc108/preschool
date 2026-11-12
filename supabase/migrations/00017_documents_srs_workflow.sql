-- ==============================================================================
-- Migration 00017: Nâng cấp Module Tài liệu lên Quy trình 6 Trạng thái chuẩn SRS
-- Description:
--   1. Mở rộng trạng thái public.school_documents:
--      DRAFT, SUBMITTED, APPROVED, WITHDRAWN, SUPERSEDED, EXPIRED.
--   2. Bổ sung cột nghiệp vụ: effective_date, expiration_date, rejection_reason,
--      superseded_by_id, approved_by, approved_at.
--   3. Chuyển dữ liệu cũ: ACTIVE -> APPROVED, ARCHIVED -> EXPIRED.
--   4. Tạo bảng public.document_audit_logs lưu lịch sử luân chuyển bất biến.
--   5. Tạo bảng public.document_number_counters & RPC sinh số hiệu tuần tự theo
--      năm + ký hiệu (VD: 01/2026/CV-MNSM) an toàn đồng thời.
--   6. Siết chặt Layer-2 RLS theo ma trận quyền SRS (SUPER_ADMIN vs SCHOOL_ADMIN).
-- ==============================================================================

-- 1. Gỡ ràng buộc status CHECK và index số hiệu cũ từ 00016
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  FOR v_constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'school_documents'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.school_documents DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.idx_school_documents_active_number_unique;

-- 2. Bổ sung các cột vòng đời văn bản SRS
ALTER TABLE public.school_documents
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS expiration_date DATE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS superseded_by_id UUID REFERENCES public.school_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 3. Chuyển dữ liệu cũ từ 00016 sang mô hình 6 trạng thái SRS (an toàn idempotent)
UPDATE public.school_documents
SET
  status = 'APPROVED',
  effective_date = COALESCE(effective_date, issued_date),
  approved_at = COALESCE(approved_at, created_at),
  approved_by = COALESCE(approved_by, uploaded_by)
WHERE status = 'ACTIVE';

UPDATE public.school_documents
SET
  status = 'EXPIRED',
  effective_date = COALESCE(effective_date, issued_date),
  expiration_date = COALESCE(
    expiration_date,
    GREATEST(COALESCE(effective_date, issued_date), (updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE)
  )
WHERE status = 'ARCHIVED';

-- 4. Áp đặt ràng buộc trạng thái mới, ngày hiệu lực và chỉ mục duy nhất
ALTER TABLE public.school_documents
  ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE public.school_documents
  DROP CONSTRAINT IF EXISTS chk_school_documents_status;
ALTER TABLE public.school_documents
  ADD CONSTRAINT chk_school_documents_status
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'WITHDRAWN', 'SUPERSEDED', 'EXPIRED'));

ALTER TABLE public.school_documents
  DROP CONSTRAINT IF EXISTS chk_school_documents_dates;
ALTER TABLE public.school_documents
  ADD CONSTRAINT chk_school_documents_dates
  CHECK (
    expiration_date IS NULL
    OR effective_date IS NULL
    OR expiration_date >= effective_date
  );

ALTER TABLE public.school_documents
  DROP CONSTRAINT IF EXISTS chk_school_documents_not_self_superseded;
ALTER TABLE public.school_documents
  ADD CONSTRAINT chk_school_documents_not_self_superseded
  CHECK (superseded_by_id IS NULL OR superseded_by_id <> id);

-- Chặn trùng số hiệu văn bản (không phân biệt hoa/thường) giữa các văn bản đang APPROVED
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_documents_approved_number_unique
  ON public.school_documents (LOWER(TRIM(document_number)))
  WHERE document_number IS NOT NULL
    AND TRIM(document_number) <> ''
    AND status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_school_documents_approved_expiry
  ON public.school_documents (expiration_date)
  WHERE status = 'APPROVED' AND expiration_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_documents_superseded_by
  ON public.school_documents (superseded_by_id)
  WHERE superseded_by_id IS NOT NULL;

-- 5. Bảng đếm số hiệu văn bản tự động theo (Năm, Ký hiệu) & RPC nguyên tử
CREATE TABLE IF NOT EXISTS public.document_number_counters (
  year INT NOT NULL,
  symbol TEXT NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (year, symbol)
);

ALTER TABLE public.document_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access document_number_counters" ON public.document_number_counters;
CREATE POLICY "Service role full access document_number_counters"
  ON public.document_number_counters
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view document_number_counters" ON public.document_number_counters;
CREATE POLICY "Admins can view document_number_counters"
  ON public.document_number_counters
  FOR SELECT TO authenticated
  USING (public.current_active_role() IN ('SUPER_ADMIN', 'SCHOOL_ADMIN'));

-- Xem trước số hiệu dự kiến mà KHÔNG tăng bộ đếm
CREATE OR REPLACE FUNCTION public.peek_next_document_number(
  p_year INT DEFAULT NULL,
  p_symbol TEXT DEFAULT 'CV-MNSM'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::INT);
  v_symbol TEXT := UPPER(NULLIF(TRIM(COALESCE(p_symbol, '')), ''));
  v_counter_seq INT := 0;
  v_existing_max INT := 0;
  v_next_seq INT;
  v_seq_str TEXT;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND COALESCE(public.current_active_role(), '') NOT IN ('SUPER_ADMIN', 'SCHOOL_ADMIN') THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Không có quyền xem số hiệu văn bản.' USING ERRCODE = '42501';
  END IF;

  IF v_symbol IS NULL THEN
    v_symbol := 'CV-MNSM';
  END IF;

  SELECT COALESCE(last_seq, 0)
  INTO v_counter_seq
  FROM public.document_number_counters
  WHERE year = v_year AND symbol = v_symbol;

  SELECT COALESCE(MAX(
    CASE
      WHEN SPLIT_PART(TRIM(document_number), '/', 1) ~ '^[0-9]+$'
        AND SPLIT_PART(TRIM(document_number), '/', 2) = v_year::TEXT
        AND UPPER(SPLIT_PART(TRIM(document_number), '/', 3)) = v_symbol
      THEN SPLIT_PART(TRIM(document_number), '/', 1)::INT
      ELSE 0
    END
  ), 0)
  INTO v_existing_max
  FROM public.school_documents
  WHERE document_number IS NOT NULL;

  v_next_seq := GREATEST(COALESCE(v_counter_seq, 0), COALESCE(v_existing_max, 0)) + 1;
  v_seq_str := CASE WHEN v_next_seq < 10 THEN '0' || v_next_seq::TEXT ELSE v_next_seq::TEXT END;

  RETURN v_seq_str || '/' || v_year::TEXT || '/' || v_symbol;
END;
$$;

REVOKE ALL ON FUNCTION public.peek_next_document_number(INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peek_next_document_number(INT, TEXT) TO authenticated, service_role;

-- Cấp phát nguyên tử số hiệu văn bản chính thức (chỉ chạy khi SUPER_ADMIN phê duyệt)
CREATE OR REPLACE FUNCTION public.generate_next_document_number(
  p_year INT DEFAULT NULL,
  p_symbol TEXT DEFAULT 'CV-MNSM'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::INT);
  v_symbol TEXT := UPPER(NULLIF(TRIM(COALESCE(p_symbol, '')), ''));
  v_counter_seq INT := 0;
  v_existing_max INT := 0;
  v_next_seq INT;
  v_seq_str TEXT;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND COALESCE(public.current_active_role(), '') <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Chỉ Hiệu trưởng (SUPER_ADMIN) mới được cấp số hiệu văn bản phê duyệt.' USING ERRCODE = '42501';
  END IF;

  IF v_symbol IS NULL THEN
    v_symbol := 'CV-MNSM';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('doc_seq:' || v_year::TEXT || ':' || v_symbol));

  SELECT COALESCE(last_seq, 0)
  INTO v_counter_seq
  FROM public.document_number_counters
  WHERE year = v_year AND symbol = v_symbol;

  SELECT COALESCE(MAX(
    CASE
      WHEN SPLIT_PART(TRIM(document_number), '/', 1) ~ '^[0-9]+$'
        AND SPLIT_PART(TRIM(document_number), '/', 2) = v_year::TEXT
        AND UPPER(SPLIT_PART(TRIM(document_number), '/', 3)) = v_symbol
      THEN SPLIT_PART(TRIM(document_number), '/', 1)::INT
      ELSE 0
    END
  ), 0)
  INTO v_existing_max
  FROM public.school_documents
  WHERE document_number IS NOT NULL;

  v_next_seq := GREATEST(COALESCE(v_counter_seq, 0), COALESCE(v_existing_max, 0)) + 1;

  INSERT INTO public.document_number_counters (year, symbol, last_seq, updated_at)
  VALUES (v_year, v_symbol, v_next_seq, NOW())
  ON CONFLICT (year, symbol) DO UPDATE
  SET last_seq = GREATEST(public.document_number_counters.last_seq, EXCLUDED.last_seq),
      updated_at = NOW();

  v_seq_str := CASE WHEN v_next_seq < 10 THEN '0' || v_next_seq::TEXT ELSE v_next_seq::TEXT END;
  RETURN v_seq_str || '/' || v_year::TEXT || '/' || v_symbol;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_document_number(INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_next_document_number(INT, TEXT) TO authenticated, service_role;

-- 6. Bảng Nhật ký luân chuyển văn bản (Audit Logs - bất biến)
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.school_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN (
      'CREATE_DRAFT',
      'UPDATE_METADATA',
      'SUBMIT',
      'APPROVE',
      'REJECT',
      'SUPERSEDE',
      'WITHDRAW',
      'EXPIRE',
      'DRIVE_SYNC'
    )
  ),
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_audit_logs_doc_created
  ON public.document_audit_logs (document_id, created_at DESC);

-- Khởi tạo log lịch sử cho các bản ghi đã di chuyển từ 00016 (nếu chưa có log)
INSERT INTO public.document_audit_logs (
  document_id,
  action,
  from_status,
  to_status,
  reason,
  actor_id,
  actor_name,
  metadata,
  created_at
)
SELECT
  d.id,
  CASE WHEN d.status = 'APPROVED' THEN 'APPROVE' ELSE 'EXPIRE' END,
  NULL,
  d.status,
  CASE
    WHEN d.status = 'APPROVED' THEN 'Chuyển tiếp từ phiên bản lưu hành (Migration 00017)'
    ELSE 'Chuyển tiếp từ trạng thái lưu trữ cũ (Migration 00017)'
  END,
  COALESCE(d.approved_by, d.uploaded_by),
  NULL,
  jsonb_build_object('migrated_from_v1', true, 'document_number', d.document_number),
  COALESCE(d.approved_at, d.created_at, NOW())
FROM public.school_documents d
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_audit_logs l WHERE l.document_id = d.id
);

ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access document_audit_logs" ON public.document_audit_logs;
CREATE POLICY "Service role full access document_audit_logs"
  ON public.document_audit_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view allowed document audit logs" ON public.document_audit_logs;
CREATE POLICY "Admins can view allowed document audit logs"
  ON public.document_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_documents d
      WHERE d.id = document_audit_logs.document_id
        AND (
          public.current_active_role() = 'SUPER_ADMIN'
          OR (
            public.current_active_role() = 'SCHOOL_ADMIN'
            AND d.visibility_scope = 'ALL_ADMINS'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Admins can insert allowed document audit logs" ON public.document_audit_logs;
CREATE POLICY "Admins can insert allowed document audit logs"
  ON public.document_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.school_documents d
      WHERE d.id = document_audit_logs.document_id
        AND (
          public.current_active_role() = 'SUPER_ADMIN'
          OR (
            public.current_active_role() = 'SCHOOL_ADMIN'
            AND d.visibility_scope = 'ALL_ADMINS'
          )
        )
    )
  );

-- 7. Siết chặt Layer-2 RLS trên school_documents theo ma trận quyền SRS
DROP POLICY IF EXISTS "Admins can insert allowed documents" ON public.school_documents;
CREATE POLICY "Admins can insert allowed documents"
  ON public.school_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_active_role() = 'SUPER_ADMIN'
    OR (
      public.current_active_role() = 'SCHOOL_ADMIN'
      AND visibility_scope = 'ALL_ADMINS'
      AND status IN ('DRAFT', 'SUBMITTED')
    )
  );

DROP POLICY IF EXISTS "Admins can update allowed documents" ON public.school_documents;
DROP POLICY IF EXISTS "Super admin can update any document" ON public.school_documents;
DROP POLICY IF EXISTS "School admin can edit or submit draft documents" ON public.school_documents;

CREATE POLICY "Super admin can update any document"
  ON public.school_documents
  FOR UPDATE TO authenticated
  USING (public.current_active_role() = 'SUPER_ADMIN')
  WITH CHECK (public.current_active_role() = 'SUPER_ADMIN');

CREATE POLICY "School admin can edit or submit draft documents"
  ON public.school_documents
  FOR UPDATE TO authenticated
  USING (
    public.current_active_role() = 'SCHOOL_ADMIN'
    AND visibility_scope = 'ALL_ADMINS'
    AND status = 'DRAFT'
  )
  WITH CHECK (
    public.current_active_role() = 'SCHOOL_ADMIN'
    AND visibility_scope = 'ALL_ADMINS'
    AND status IN ('DRAFT', 'SUBMITTED')
  );
