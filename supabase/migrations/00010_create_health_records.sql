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

-- Allow full access for all operations (consistent with other tables like attendance_records & weekly_menus)
DROP POLICY IF EXISTS "Allow all access to health_records" ON public.health_records;
CREATE POLICY "Allow all access to health_records"
ON public.health_records FOR ALL
USING (true)
WITH CHECK (true);
