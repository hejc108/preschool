-- ==============================================================================
-- Migration 00011: Create kitchen_daily_reports table for Daily Meal Finalization
-- Description:
--   Quản lý vòng đời chốt sĩ số báo ăn bán trú của từng lớp học trong ngày.
--   Khóa duy nhất: (class_id, report_date)
--   Bao gồm: Sĩ số chốt lần đầu, sĩ số chốt cuối cùng, số lần cập nhật phát sinh (tối đa 1 lần).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.kitchen_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  initial_count INT NOT NULL DEFAULT 0,
  final_count INT NOT NULL DEFAULT 0,
  update_count INT NOT NULL DEFAULT 0,
  first_submitted_at TIMESTAMPTZ DEFAULT NOW(),
  last_submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_kitchen_report_class_date UNIQUE (class_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_daily_reports_date ON public.kitchen_daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_daily_reports_class_date ON public.kitchen_daily_reports(class_id, report_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.kitchen_daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select kitchen_daily_reports"
ON public.kitchen_daily_reports FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow insert kitchen_daily_reports"
ON public.kitchen_daily_reports FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow update kitchen_daily_reports"
ON public.kitchen_daily_reports FOR UPDATE
TO anon, authenticated
USING (true);
