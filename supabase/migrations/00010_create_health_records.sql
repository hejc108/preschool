-- ==============================================================================
-- Migration 00010: Create health_records table for Preschool Health Monitoring
-- Description:
--   Bảng theo dõi sức khỏe học sinh định kỳ theo quý (Q1, Q2, Q3, Q4)
--   Bao gồm: Cân nặng, Chiều cao, BMI và Phân loại thể trạng chuẩn WHO.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term VARCHAR(10) NOT NULL DEFAULT 'Q1',
  academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
  measured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) NOT NULL,
  height_cm NUMERIC(5,2) NOT NULL,
  bmi NUMERIC(5,2) NOT NULL,
  growth_status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_student_term_year UNIQUE (student_id, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_health_records_student_id ON public.health_records(student_id);
CREATE INDEX IF NOT EXISTS idx_health_records_academic_year ON public.health_records(academic_year);

-- Enable RLS
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated and anon select health_records"
ON public.health_records FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow authenticated and anon insert health_records"
ON public.health_records FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated and anon update health_records"
ON public.health_records FOR UPDATE
TO anon, authenticated
USING (true);
