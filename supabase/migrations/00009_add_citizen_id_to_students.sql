ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS citizen_id VARCHAR(12);

-- Unique index cho phép nhiều giá trị NULL nhưng nếu có nhập thì không được trùng
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_citizen_id_unique 
ON public.students(citizen_id) 
WHERE citizen_id IS NOT NULL;
