const fs = require('fs');
const catalog = require('../src/lib/data/health_catalog.json');

let sql = `-- ==============================================================================
-- Migration 00010: Create health_records table & Seed 170 Student Health Records
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

CREATE INDEX IF NOT EXISTS idx_health_records_student_id ON public.health_records(student_id);
CREATE INDEX IF NOT EXISTS idx_health_records_term ON public.health_records(term);
CREATE INDEX IF NOT EXISTS idx_health_records_academic_year ON public.health_records(academic_year);

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to health_records" ON public.health_records;
CREATE POLICY "Allow all access to health_records"
ON public.health_records FOR ALL
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- Nạp sẵn 170 chỉ số sức khỏe đầu năm học 2026-2027 (Khám Q1)
-- ==============================================================================
INSERT INTO public.health_records (
  student_id, term, academic_year, measured_date, record_date,
  weight_kg, height_cm, weight, height, bmi, growth_status, notes
) VALUES
`;

const valueRows = catalog.map(c => {
  const sId = c.student_id;
  const term = (c.term || 'Q1').replace(/'/g, "''");
  const year = (c.academic_year || '2026-2027').replace(/'/g, "''");
  const date = c.measured_date || '2026-09-05';
  const w = c.weight_kg ?? 0;
  const h = c.height_cm ?? 0;
  const bmi = c.bmi ?? 0;
  const status = (c.growth_status || 'NORMAL').replace(/'/g, "''");
  const notes = (c.notes || '').replace(/'/g, "''");
  return `  ('${sId}', '${term}', '${year}', '${date}', '${date}', ${w}, ${h}, ${w}, ${h}, ${bmi}, '${status}', '${notes}')`;
});

sql += valueRows.join(',\n');
sql += `\nON CONFLICT (student_id, term) DO UPDATE SET
  academic_year = EXCLUDED.academic_year,
  measured_date = EXCLUDED.measured_date,
  record_date = EXCLUDED.record_date,
  weight_kg = EXCLUDED.weight_kg,
  height_cm = EXCLUDED.height_cm,
  weight = EXCLUDED.weight,
  height = EXCLUDED.height,
  bmi = EXCLUDED.bmi,
  growth_status = EXCLUDED.growth_status,
  notes = EXCLUDED.notes,
  updated_at = NOW();
`;

fs.writeFileSync('supabase/migrations/00010_create_health_records.sql', sql, 'utf-8');
console.log('Successfully written migration 00010. Total length:', sql.length, 'bytes');
