-- =========================================================================
-- Migration: 00020_document_clone_and_audit_actions.sql
-- Purpose: Bổ sung audit log action 'CLONE_DOCUMENT' và 'EDIT_WHILE_SUBMITTED'
--          phục vụ tính năng Nhân bản văn bản và cho phép sửa khi chờ duyệt.
-- Safe to run multiple times (idempotent).
-- =========================================================================

DO $$
BEGIN
  -- 1. Cập nhật CHECK constraint bảng document_audit_logs để cho phép CLONE_DOCUMENT và EDIT_WHILE_SUBMITTED
  ALTER TABLE public.document_audit_logs
    DROP CONSTRAINT IF EXISTS document_audit_logs_action_check;

  ALTER TABLE public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_action_check
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
        'DRIVE_SYNC',
        'CLONE_DOCUMENT',
        'EDIT_WHILE_SUBMITTED'
      )
    );
END $$;
