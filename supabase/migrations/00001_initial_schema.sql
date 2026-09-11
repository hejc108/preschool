-- DATABASE_SCHEMA_SUPABASE_v2.0.sql
-- Canonical Supabase Schema for Mầm Non Sương Mai
-- Enforces zero-typing, kitchen cut-off, and multi-child parent mapping.

-- 0. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'PARENT')),
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., "Mầm 1 (Rose)", "Chồi 2 (Lily)", "Lá 3 (Sunflower)"
    grade_level TEXT NOT NULL, -- e.g., "MẦM", "CHỒI", "LÁ"
    room_number TEXT,
    main_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS (Học sinh)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_code TEXT UNIQUE NOT NULL, -- e.g., "SM-2026-001"
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('NAM', 'NỮ')),
    dob DATE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    allergies TEXT DEFAULT 'Không có',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRADUATED', 'WITHDRAWN')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STUDENT_GUARDIANS (Bảng quan hệ phụ huynh - học sinh)
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK (relationship IN ('BỐ', 'MẸ', 'ÔNG', 'BÀ', 'NGƯỜI GIÁM HỘ')),
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_guardian UNIQUE(student_id, guardian_id)
);

-- 5. AUTHORIZED_PICKUPS (Người được ủy quyền đón bé)
CREATE TABLE IF NOT EXISTS public.authorized_pickups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    approval_status TEXT DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ATTENDANCE_RECORDS (Bảng điểm danh)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'PRESENT_LATE', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED')),
    recorded_by UUID REFERENCES public.profiles(id),
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    checkout_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_date UNIQUE(student_id, date)
);

-- 7. ABSENCE_REQUESTS (Bảng xin nghỉ học)
CREATE TABLE IF NOT EXISTS public.absence_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'SUBMITTED_VALID' CHECK (status IN ('SUBMITTED_VALID', 'SUBMITTED_LATE', 'APPROVED', 'REJECTED')),
    is_fee_credited BOOLEAN DEFAULT true,
    acknowledged_by_teacher BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MEDICATION_REQUESTS (Bảng dặn thuốc)
CREATE TABLE IF NOT EXISTS public.medication_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_slot TEXT NOT NULL CHECK (time_slot IN ('SLOT_1130', 'SLOT_1430')),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    instructions TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ADMINISTERED', 'SKIPPED')),
    administered_by UUID REFERENCES public.profiles(id),
    administered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. KITCHEN_MEAL_ORDERS (Bảng đặt suất ăn Bếp)
CREATE TABLE IF NOT EXISTS public.kitchen_meal_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    base_enrollment INT DEFAULT 0,
    valid_absences INT DEFAULT 0,
    late_absences INT DEFAULT 0,
    late_arrivals INT DEFAULT 0,
    final_meals_count INT DEFAULT 0,
    cutoff_locked_at TIMESTAMPTZ,
    is_finalized BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_date_class UNIQUE(date, class_id)
);

-- 10. MEAL_EXCEPTIONS (Ngoại lệ bữa ăn)
CREATE TABLE IF NOT EXISTS public.meal_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT DEFAULT 'LUNCH' CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'SNACK')),
    intake_level TEXT NOT NULL CHECK (intake_level IN ('HALF', 'REFUSED')),
    reason_tags TEXT[],
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. STUDENT_APPLICATIONS (Tuyển sinh)
CREATE TABLE IF NOT EXISTS public.student_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_code TEXT UNIQUE NOT NULL,
    parent_name TEXT NOT NULL,
    child_name TEXT NOT NULL,
    child_dob DATE NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    pdf_url TEXT,
    status TEXT DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'WALKIN_REGISTERED')),
    walkin_qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRIGGER FUNCTION FOR LATE ARRIVALS ADJUSTMENT (+1 MEAL TO KITCHEN)
DROP TRIGGER IF EXISTS trg_late_arrival_adjustment ON public.attendance_records;
DROP FUNCTION IF EXISTS public.fn_late_arrival_kitchen_adjustment() CASCADE;

CREATE OR REPLACE FUNCTION public.fn_late_arrival_kitchen_adjustment()
RETURNS TRIGGER AS $$
DECLARE
    v_class_id UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'PRESENT_LATE') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'PRESENT_LATE' AND OLD.status <> 'PRESENT_LATE') THEN
        
        SELECT class_id INTO v_class_id FROM public.students WHERE id = NEW.student_id;
        
        IF v_class_id IS NOT NULL THEN
            INSERT INTO public.kitchen_meal_orders AS k (date, class_id, late_arrivals, final_meals_count, updated_at)
            VALUES (
                NEW.date, 
                v_class_id, 
                1, 
                1, 
                NOW()
            )
            ON CONFLICT (date, class_id) 
            DO UPDATE SET 
                late_arrivals = k.late_arrivals + 1,
                final_meals_count = k.final_meals_count + 1,
                updated_at = EXCLUDED.updated_at;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE TRIGGER
CREATE TRIGGER trg_late_arrival_adjustment
AFTER INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.fn_late_arrival_kitchen_adjustment();

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_applications ENABLE ROW LEVEL SECURITY;

-- Allow select for authenticated & public users in dev/prod
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
CREATE POLICY "Allow select profiles" ON public.profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select classes" ON public.classes;
CREATE POLICY "Allow select classes" ON public.classes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select students" ON public.students;
CREATE POLICY "Allow select students" ON public.students FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select student_guardians" ON public.student_guardians;
CREATE POLICY "Allow select student_guardians" ON public.student_guardians FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow select authorized_pickups" ON public.authorized_pickups;
CREATE POLICY "Allow select authorized_pickups" ON public.authorized_pickups FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all attendance_records" ON public.attendance_records;
CREATE POLICY "Allow all attendance_records" ON public.attendance_records FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all absence_requests" ON public.absence_requests;
CREATE POLICY "Allow all absence_requests" ON public.absence_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all medication_requests" ON public.medication_requests;
CREATE POLICY "Allow all medication_requests" ON public.medication_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all kitchen_meal_orders" ON public.kitchen_meal_orders;
CREATE POLICY "Allow all kitchen_meal_orders" ON public.kitchen_meal_orders FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all meal_exceptions" ON public.meal_exceptions;
CREATE POLICY "Allow all meal_exceptions" ON public.meal_exceptions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all student_applications" ON public.student_applications;
CREATE POLICY "Allow all student_applications" ON public.student_applications FOR ALL USING (true);
