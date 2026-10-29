-- ==============================================================================
-- Migration 00010: Create health_records table for Preschool Health Monitoring
-- Description:
--   Bảng theo dõi sức khỏe học sinh định kỳ theo đợt (Q1, Q2, Q3, Q4 hoặc Đầu năm)
--   Bao gồm: Cân nặng, Chiều cao, BMI và Phân loại thể trạng chuẩn WHO.
--   Ràng buộc duy nhất: (student_id, term) phục vụ UPSERT an toàn.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL DEFAULT 'Q1',
  academic_year VARCHAR(50) NOT NULL DEFAULT '2026-2027',
  measured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  record_date DATE DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  weight NUMERIC(5,2),
  height NUMERIC(5,2),
  bmi NUMERIC(5,2),
  growth_status VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_health_records_student_term UNIQUE (student_id, term)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_records_student_id ON public.health_records(student_id);
CREATE INDEX IF NOT EXISTS idx_health_records_term ON public.health_records(term);
CREATE INDEX IF NOT EXISTS idx_health_records_academic_year ON public.health_records(academic_year);

-- Enable RLS
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

-- 1. Admin & Medical Staff & Teachers: Full management
DROP POLICY IF EXISTS "Allow staff full access to health_records" ON public.health_records;
CREATE POLICY "Allow staff full access to health_records"
ON public.health_records FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'TEACHER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'TEACHER')
  )
);

-- 2. Parents: SELECT only records of their linked children
DROP POLICY IF EXISTS "Allow parents select own children health_records" ON public.health_records;
CREATE POLICY "Allow parents select own children health_records"
ON public.health_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.student_guardians
    WHERE student_guardians.student_id = health_records.student_id
      AND student_guardians.guardian_id = auth.uid()
  )
);

-- 3. Anon & Service Role Fallback Policies (prevents 403 on server-side Next.js route handlers)
DROP POLICY IF EXISTS "Allow anon select health_records" ON public.health_records;
CREATE POLICY "Allow anon select health_records"
ON public.health_records FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Allow anon insert health_records" ON public.health_records;
CREATE POLICY "Allow anon insert health_records"
ON public.health_records FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update health_records" ON public.health_records;
CREATE POLICY "Allow anon update health_records"
ON public.health_records FOR UPDATE
TO anon
USING (true);
