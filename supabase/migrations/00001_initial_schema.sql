-- DATABASE_SCHEMA_SUPABASE_v2.0.sql
-- Canonical Supabase Schema for Dominican Kindergarten (Mầm Non Đa Minh)
-- Enforces zero-typing, kitchen cut-off, and multi-child parent mapping.

-- Enable UUID extension
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
    name TEXT NOT NULL, -- e.g., "Mầm 1", "Chồi 2", "Lá 3"
    grade_level TEXT NOT NULL, -- e.g., "MẦM", "CHỒI", "LÁ"
    room_number TEXT,
    main_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS (Học sinh)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_code TEXT UNIQUE NOT NULL, -- e.g., "DM-2026-001"
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
    UNIQUE(student_id, guardian_id)
);

-- 5. ATTENDANCE_RECORDS (Bảng điểm danh)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'PRESENT_LATE', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED')),
    recorded_by UUID REFERENCES public.profiles(id),
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    checkout_reason TEXT, -- Sprint 2: Reason for late checkout after 17:00
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

-- 6. ABSENCE_REQUESTS (Bảng xin nghỉ học)
CREATE TABLE IF NOT EXISTS public.absence_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'SUBMITTED_VALID' CHECK (status IN ('SUBMITTED_VALID', 'SUBMITTED_LATE', 'APPROVED', 'REJECTED')),
    is_fee_credited BOOLEAN DEFAULT true, -- True if submitted before 08:30 cutoff
    acknowledged_by_teacher BOOLEAN DEFAULT false, -- Sprint 2: Teacher acknowledge flag
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MEDICATION_REQUESTS (Bảng dặn thuốc)
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

-- 8. KITCHEN_MEAL_ORDERS (Bảng đặt suất ăn Bếp)
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
    UNIQUE(date, class_id)
);

-- 9. MEAL_EXCEPTIONS (Sprint 2: Bảng ngoại lệ bữa ăn - Matching Section 2.4 DDL)
CREATE TABLE IF NOT EXISTS public.meal_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT DEFAULT 'LUNCH' CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'SNACK')),
    intake_level TEXT NOT NULL CHECK (intake_level IN ('HALF', 'REFUSED')),
    reason_tags TEXT[], -- e.g., ARRAY['#Biếng_ăn', '#Chỉ_uống_canh']
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. STUDENT_APPLICATIONS (Tuyển sinh)
CREATE TABLE IF NOT EXISTS public.student_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_code TEXT UNIQUE NOT NULL, -- e.g., "ADM-2026-089"
    parent_name TEXT NOT NULL,
    child_name TEXT NOT NULL,
    child_dob DATE NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    pdf_url TEXT, -- Cloudflare R2 uploaded application form
    status TEXT DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'WALKIN_REGISTERED')),
    walkin_qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRIGGER FUNCTION FOR LATE ARRIVALS ADJUSTMENT (+1 MEAL TO KITCHEN)
CREATE OR REPLACE FUNCTION public.fn_late_arrival_kitchen_adjustment()
RETURNS TRIGGER AS $$
DECLARE
    v_class_id UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'PRESENT_LATE') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'PRESENT_LATE' AND OLD.status <> 'PRESENT_LATE') THEN
        
        SELECT class_id INTO v_class_id FROM public.students WHERE id = NEW.student_id;
        
        IF v_class_id IS NOT NULL THEN
            INSERT INTO public.kitchen_meal_orders (date, class_id, late_arrivals, final_meals_count, updated_at)
            VALUES (
                NEW.date, 
                v_class_id, 
                1, 
                1, 
                NOW()
            )
            ON CONFLICT (date, class_id) 
            DO UPDATE SET 
                late_arrivals = kitchen_meal_orders.late_arrivals + 1,
                final_meals_count = kitchen_meal_orders.final_meals_count + 1,
                updated_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE TRIGGER
DROP TRIGGER IF EXISTS trg_late_arrival_adjustment ON public.attendance_records;
CREATE TRIGGER trg_late_arrival_adjustment
AFTER INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.fn_late_arrival_kitchen_adjustment();

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_applications ENABLE ROW LEVEL SECURITY;

-- Allow select for authenticated users in dev environment
CREATE POLICY "Allow select for authenticated users" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.student_guardians FOR SELECT USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.attendance_records FOR ALL USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.absence_requests FOR ALL USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.medication_requests FOR ALL USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.kitchen_meal_orders FOR ALL USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.meal_exceptions FOR ALL USING (true);
CREATE POLICY "Allow select for authenticated users" ON public.student_applications FOR ALL USING (true);
