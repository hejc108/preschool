-- =========================================================================
-- Migration: 00020_document_clone_and_audit_actions.sql
-- Purpose: Bổ sung audit log action 'CLONE_DOCUMENT' và 'EDIT_WHILE_SUBMITTED'
--          phục vụ tính năng Nhân bản văn bản và cho phép sửa khi chờ duyệt.
-- Safe to run multiple times (idempotent).
-- =========================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- 1. Tìm và xóa TẤT CẢ các check constraint liên quan đến cột action trên bảng document_audit_logs
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

  -- 2. Tự động chuẩn hóa dữ liệu cũ nếu có giá trị ngoài danh mục hợp lệ
  UPDATE public.document_audit_logs
  SET action = 'UPDATE_METADATA'
  WHERE action NOT IN (
    'CREATE_DRAFT',
    'UPDATE_METADATA',
    'SUBMIT',
    'SUBMIT_FOR_APPROVAL',
    'APPROVE',
    'REJECT',
    'SUPERSEDE',
    'WITHDRAW',
    'EXPIRE',
    'AUTO_EXPIRE',
    'REOPEN_DRAFT',
    'REPLACE_FILE',
    'DRIVE_SYNC',
    'CLONE_DOCUMENT',
    'EDIT_WHILE_SUBMITTED'
  );

  -- 3. Cập nhật CHECK constraint bảng document_audit_logs để cho phép đầy đủ tất cả action
  ALTER TABLE public.document_audit_logs
    ADD CONSTRAINT chk_document_audit_logs_action
    CHECK (
      action IN (
        'CREATE_DRAFT',
        'UPDATE_METADATA',
        'SUBMIT',
        'SUBMIT_FOR_APPROVAL',
        'APPROVE',
        'REJECT',
        'SUPERSEDE',
        'WITHDRAW',
        'EXPIRE',
        'AUTO_EXPIRE',
        'REOPEN_DRAFT',
        'REPLACE_FILE',
        'DRIVE_SYNC',
        'CLONE_DOCUMENT',
        'EDIT_WHILE_SUBMITTED'
      )
    );
END $$;
