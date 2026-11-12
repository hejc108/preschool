-- =========================================================================
-- Migration: 00018_document_audit_auto_expire.sql
-- Purpose: Bổ sung hành động 'AUTO_EXPIRE' vào CHECK constraint của bảng
--          public.document_audit_logs để phục vụ Vercel Cron Job tự động
--          chuyển văn bản APPROVED quá hạn expiration_date sang EXPIRED.
-- Safe to run multiple times (idempotent).
-- =========================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  FOR v_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'document_audit_logs'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%action%'
  LOOP
    EXECUTE format('ALTER TABLE public.document_audit_logs DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;

  ALTER TABLE public.document_audit_logs
    ADD CONSTRAINT chk_document_audit_logs_action
    CHECK (
      action IN (
        'CREATE_DRAFT',
        'UPDATE_METADATA',
        'SUBMIT',
        'APPROVE',
        'REJECT',
        'SUPERSEDE',
        'WITHDRAW',
        'EXPIRE',
        'AUTO_EXPIRE',
        'DRIVE_SYNC'
      )
    );
END $$;

-- Index hỗ trợ Cron Job quét nhanh các văn bản APPROVED có expiration_date
CREATE INDEX IF NOT EXISTS idx_school_documents_approved_expiration
  ON public.school_documents (expiration_date)
  WHERE status = 'APPROVED' AND expiration_date IS NOT NULL;
