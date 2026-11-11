-- ==============================================================================
-- Migration 00013: CR-01 Multi-Role Accounts, Student-Parent Links, Announcements
--                  & 2-Layer RLS Enforcement (Custom Access Token Hook + RPC)
-- Date: 2026-11-11
-- Description:
--   1. Zero-downtime schema expansion: giu nguyen profiles.role, bo sung profiles.auth_user_id.
--   2. Khoi tao bang public.user_roles (CHECK gom SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, PARENT, STAFF)
--      va public.student_parents + View tuong thich public.class_teachers.
--   3. Backfill khong gian doan tu profiles, student_guardians, teacher_class_assignments,
--      parent_student_relations; chuyen ADMIN -> SCHOOL_ADMIN.
--   4. Trigger dong bo 2 chieu user_roles -> profiles.role & student_parents <-> student_guardians.
--   5. Khoi tao announcements, announcement_reads (co lap theo role_context) va push_subscriptions.
--   6. Hybrid Layer 2 RLS (custom_access_token_hook + rpc_set_active_role_context + strict policies).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES: GIU NGUYEN profiles.role & DONG BO DANH TINH auth_user_id
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS assigned_class_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_class_name TEXT,
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_auth_user_id_unique
  ON public.profiles(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'GUEST'));

-- Backfill auth_user_id cho tai khoan da tung dang nhap auth.users
UPDATE public.profiles p
SET auth_user_id = u.id,
    updated_at = NOW()
FROM auth.users u
WHERE p.auth_user_id IS NULL
  AND LOWER(TRIM(p.email)) = LOWER(TRIM(u.email));

-- Chuan hoa role legacy ADMIN -> SCHOOL_ADMIN tren profiles
UPDATE public.profiles
SET role = 'SCHOOL_ADMIN',
    updated_at = NOW()
WHERE role = 'ADMIN';

-- ------------------------------------------------------------------------------
-- 2. TAO BANG USER_ROLES, STUDENT_PARENTS & TEACHER_CLASS_ASSIGNMENTS + VIEW CLASS_TEACHERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (
    role_name IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STAFF')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_name ON public.user_roles(role_name, user_id);

CREATE TABLE IF NOT EXISTS public.student_parents (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'Parent',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, parent_user_id)
);

CREATE INDEX IF NOT EXISTS idx_student_parents_parent ON public.student_parents(parent_user_id, student_id);

-- Dam bao bang teacher_class_assignments (migration 00007) luon ton tai truoc khi tao view/function/backfill
CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_email TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  class_name TEXT,
  academic_year TEXT DEFAULT '2026-2027',
  is_main_teacher BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_teacher_class_year UNIQUE(teacher_email, class_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_email ON public.teacher_class_assignments(teacher_email);
CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class ON public.teacher_class_assignments(class_id);
ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

-- View tuong thich quy uoc ten bang class_teachers -> teacher_class_assignments
CREATE OR REPLACE VIEW public.class_teachers AS
SELECT
  id,
  class_id,
  teacher_id,
  teacher_email,
  class_name,
  academic_year,
  is_main_teacher,
  created_at
FROM public.teacher_class_assignments;

-- ------------------------------------------------------------------------------
-- 3. HAM DO UU TIEN VAI TRO & TRIGGER DONG BO HAI CHIEU (DUAL-WRITE SYNC)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_role_priority(p_role TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'SUPER_ADMIN' THEN 5
    WHEN 'SCHOOL_ADMIN' THEN 4
    WHEN 'ADMIN' THEN 4
    WHEN 'TEACHER' THEN 3
    WHEN 'STAFF' THEN 2
    WHEN 'PARENT' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_normalize_guardian_relationship(p_rel TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE UPPER(TRIM(COALESCE(p_rel, '')))
    WHEN 'BỐ' THEN 'BỐ'
    WHEN 'BO' THEN 'BỐ'
    WHEN 'FATHER' THEN 'BỐ'
    WHEN 'CHA' THEN 'BỐ'
    WHEN 'MẸ' THEN 'MẸ'
    WHEN 'ME' THEN 'MẸ'
    WHEN 'MOTHER' THEN 'MẸ'
    WHEN 'ÔNG' THEN 'ÔNG'
    WHEN 'ONG' THEN 'ÔNG'
    WHEN 'BÀ' THEN 'BÀ'
    WHEN 'BA' THEN 'BÀ'
    ELSE 'NGƯỜI GIÁM HỘ'
  END;
$$;

-- Trigger 3a: user_roles -> profiles.role (luon chon role uu tien cao nhat)
CREATE OR REPLACE FUNCTION public.fn_sync_user_roles_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_highest_role TEXT;
BEGIN
  IF pg_trigger_depth() > 2 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT ur.role_name
  INTO v_highest_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
  ORDER BY public.fn_role_priority(ur.role_name) DESC, ur.created_at ASC
  LIMIT 1;

  IF v_highest_role IS NULL THEN
    v_highest_role := 'GUEST';
  END IF;

  UPDATE public.profiles
  SET role = v_highest_role,
      updated_at = NOW()
  WHERE id = v_user_id
    AND role IS DISTINCT FROM v_highest_role;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_roles_to_profile ON public.user_roles;
CREATE TRIGGER trg_sync_user_roles_to_profile
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_user_roles_to_profile();

-- Trigger 3b: student_parents -> student_guardians & tu dong cap role PARENT
CREATE OR REPLACE FUNCTION public.fn_sync_student_parents_to_guardians()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 2 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.student_guardians
    WHERE student_id = OLD.student_id
      AND guardian_id = OLD.parent_user_id;
    RETURN OLD;
  END IF;

  -- Tu dong dam bao parent_user_id co quyen PARENT trong user_roles
  INSERT INTO public.user_roles (user_id, role_name)
  VALUES (NEW.parent_user_id, 'PARENT')
  ON CONFLICT (user_id, role_name) DO NOTHING;

  INSERT INTO public.student_guardians (student_id, guardian_id, relationship, is_primary)
  VALUES (
    NEW.student_id,
    NEW.parent_user_id,
    public.fn_normalize_guardian_relationship(NEW.relationship),
    COALESCE(NEW.is_primary, TRUE)
  )
  ON CONFLICT (student_id, guardian_id) DO UPDATE
  SET relationship = EXCLUDED.relationship,
      is_primary = EXCLUDED.is_primary;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_parents_to_guardians ON public.student_parents;
CREATE TRIGGER trg_sync_student_parents_to_guardians
AFTER INSERT OR UPDATE OR DELETE ON public.student_parents
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_student_parents_to_guardians();

-- Trigger 3c: student_guardians -> student_parents & tu dong cap role PARENT
CREATE OR REPLACE FUNCTION public.fn_sync_student_guardians_to_parents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 2 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.student_parents
    WHERE student_id = OLD.student_id
      AND parent_user_id = OLD.guardian_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.user_roles (user_id, role_name)
  VALUES (NEW.guardian_id, 'PARENT')
  ON CONFLICT (user_id, role_name) DO NOTHING;

  INSERT INTO public.student_parents (student_id, parent_user_id, relationship, is_primary)
  VALUES (
    NEW.student_id,
    NEW.guardian_id,
    COALESCE(NEW.relationship, 'Parent'),
    COALESCE(NEW.is_primary, TRUE)
  )
  ON CONFLICT (student_id, parent_user_id) DO UPDATE
  SET relationship = EXCLUDED.relationship,
      is_primary = EXCLUDED.is_primary;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_guardians_to_parents ON public.student_guardians;
CREATE TRIGGER trg_sync_student_guardians_to_parents
AFTER INSERT OR UPDATE OR DELETE ON public.student_guardians
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_student_guardians_to_parents();

-- ------------------------------------------------------------------------------
-- 4. BACKFILL DU LIEU HIEN HANH (KHONG GIAN DOAN)
-- ------------------------------------------------------------------------------
-- 4.1 Nap tu profiles.role (ADMIN da chuan hoa -> SCHOOL_ADMIN)
INSERT INTO public.user_roles (user_id, role_name)
SELECT
  p.id,
  CASE WHEN p.role = 'ADMIN' THEN 'SCHOOL_ADMIN' ELSE p.role END
FROM public.profiles p
WHERE p.role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'PARENT', 'STAFF')
ON CONFLICT (user_id, role_name) DO NOTHING;

-- 4.2 Nap TEACHER cho tat ca ho so da phan cong dung lop trong teacher_class_assignments
INSERT INTO public.user_roles (user_id, role_name)
SELECT DISTINCT p.id, 'TEACHER'
FROM public.teacher_class_assignments tca
JOIN public.profiles p
  ON p.id = tca.teacher_id
  OR LOWER(TRIM(p.email)) = LOWER(TRIM(tca.teacher_email))
ON CONFLICT (user_id, role_name) DO NOTHING;

-- 4.3 Backfill student_parents tu student_guardians (kem cap role PARENT)
INSERT INTO public.student_parents (student_id, parent_user_id, relationship, is_primary)
SELECT sg.student_id, sg.guardian_id, COALESCE(sg.relationship, 'Parent'), COALESCE(sg.is_primary, TRUE)
FROM public.student_guardians sg
JOIN public.students s ON s.id = sg.student_id
JOIN public.profiles p ON p.id = sg.guardian_id
ON CONFLICT (student_id, parent_user_id) DO NOTHING;

-- 4.4 Backfill student_parents tu parent_student_relations (migration 00004 neu da ap dung)
DO $$
BEGIN
  IF to_regclass('public.parent_student_relations') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.student_parents (student_id, parent_user_id, relationship, is_primary)
      SELECT psr.student_id, p.id, COALESCE(psr.relationship, 'MẸ'), TRUE
      FROM public.parent_student_relations psr
      JOIN public.students s ON s.id = psr.student_id
      JOIN public.profiles p
        ON (psr.parent_id IS NOT NULL AND p.id = psr.parent_id)
        OR LOWER(TRIM(p.email)) = LOWER(TRIM(psr.parent_email))
      ON CONFLICT (student_id, parent_user_id) DO NOTHING;
    $sql$;
  END IF;
END $$;

INSERT INTO public.user_roles (user_id, role_name)
SELECT DISTINCT sp.parent_user_id, 'PARENT'
FROM public.student_parents sp
ON CONFLICT (user_id, role_name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. CAP NHAT TRIGGER handle_new_user() DE GHEP NOI auth_user_id & USER_ROLES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_profile RECORD;
  incoming_email TEXT;
  v_initial_role TEXT;
BEGIN
  incoming_email := LOWER(TRIM(new.email));

  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE auth_user_id = new.id
     OR id = new.id
     OR LOWER(TRIM(email)) = incoming_email
  ORDER BY CASE WHEN auth_user_id = new.id THEN 0 WHEN id = new.id THEN 1 ELSE 2 END
  LIMIT 1;

  IF existing_profile.id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      auth_user_id = COALESCE(auth_user_id, new.id),
      avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', avatar_url),
      updated_at = NOW()
    WHERE id = existing_profile.id;

    IF existing_profile.role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STAFF') THEN
      INSERT INTO public.user_roles (user_id, role_name)
      VALUES (existing_profile.id, existing_profile.role)
      ON CONFLICT (user_id, role_name) DO NOTHING;
    END IF;
  ELSE
    v_initial_role := CASE
      WHEN incoming_email = 'sadmin@suongmai.edu.vn' THEN 'SUPER_ADMIN'
      WHEN incoming_email = 'luciaxuan178@gmail.com' THEN 'SCHOOL_ADMIN'
      ELSE 'GUEST'
    END;

    INSERT INTO public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      avatar_url,
      role,
      approval_status,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      new.id,
      new.email,
      COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
      ),
      COALESCE(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture',
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      ),
      v_initial_role,
      CASE
        WHEN incoming_email IN ('luciaxuan178@gmail.com', 'sadmin@suongmai.edu.vn') THEN 'ACTIVE'
        ELSE 'PENDING'
      END,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      auth_user_id = COALESCE(public.profiles.auth_user_id, EXCLUDED.auth_user_id),
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW();

    IF v_initial_role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN') THEN
      INSERT INTO public.user_roles (user_id, role_name)
      VALUES (new.id, v_initial_role)
      ON CONFLICT (user_id, role_name) DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. BANG THONG BAO CO LAP VAI TRO & PUSH SUBSCRIPTIONS (Q4)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'ALL' CHECK (target_role IN ('ALL', 'TEACHER', 'PARENT')),
  notification_channel TEXT NOT NULL DEFAULT 'PARENT' CHECK (notification_channel IN ('TEACHER', 'PARENT')),
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_target_created ON public.announcements(target_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_class ON public.announcements(class_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_context TEXT NOT NULL CHECK (
    role_context IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STAFF')
  ),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id, role_context)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_ctx ON public.announcement_reads(user_id, role_context);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  active_role_preference TEXT CHECK (
    active_role_preference IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STAFF')
  ),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- ------------------------------------------------------------------------------
-- 7. HYBRID LAYER 2 RLS: HAM RESOLVE PROFILE, ACTIVE_ROLE, AUTH HOOK & RPC (Q5)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_profile_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    BEGIN
      v_uid := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;
  END IF;

  v_email := LOWER(TRIM(COALESCE(auth.jwt()->>'email', current_setting('request.jwt.claim.email', true), '')));

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE (v_uid IS NOT NULL AND (p.auth_user_id = v_uid OR p.id = v_uid))
     OR (v_email <> '' AND LOWER(TRIM(p.email)) = v_email)
  ORDER BY
    CASE
      WHEN v_uid IS NOT NULL AND p.auth_user_id = v_uid THEN 0
      WHEN v_uid IS NOT NULL AND p.id = v_uid THEN 1
      ELSE 2
    END
  LIMIT 1;

  RETURN v_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_active_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
  v_claimed_role TEXT;
  v_verified_role TEXT;
BEGIN
  v_pid := public.current_profile_id();
  IF v_pid IS NULL THEN
    RETURN NULL;
  END IF;

  v_claimed_role := NULLIF(
    TRIM(
      COALESCE(
        NULLIF(current_setting('request.jwt.claim.active_role', true), ''),
        NULLIF(auth.jwt()->>'active_role', ''),
        NULLIF((auth.jwt()->'app_metadata'->>'active_role'), '')
      )
    ),
    ''
  );

  IF v_claimed_role = 'ADMIN' THEN
    v_claimed_role := 'SCHOOL_ADMIN';
  END IF;

  -- Neu client gui claim active_role cu the, bat buoc phai co mat trong user_roles
  IF v_claimed_role IS NOT NULL THEN
    SELECT ur.role_name
    INTO v_verified_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_pid
      AND ur.role_name = v_claimed_role
    LIMIT 1;

    RETURN v_verified_role; -- Tra NULL neu gia mao vai tro
  END IF;

  -- Fallback an toan neu token chua co active_role: chon role uu tien cao nhat trong user_roles
  SELECT ur.role_name
  INTO v_verified_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_pid
  ORDER BY public.fn_role_priority(ur.role_name) DESC, ur.created_at ASC
  LIMIT 1;

  RETURN v_verified_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_verified_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = public.current_profile_id()
      AND ur.role_name = CASE WHEN p_role = 'ADMIN' THEN 'SCHOOL_ADMIN' ELSE p_role END
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_active_role() IN ('SUPER_ADMIN', 'SCHOOL_ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_for_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_active_role() = 'TEACHER'
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.profiles p ON p.id = public.current_profile_id()
      LEFT JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = p_student_id
        AND (
          c.main_teacher_id = p.id
          OR p.assigned_class_id = s.class_id::TEXT
          OR EXISTS (
            SELECT 1
            FROM public.teacher_class_assignments tca
            WHERE tca.class_id = s.class_id
              AND (
                tca.teacher_id = p.id
                OR LOWER(TRIM(tca.teacher_email)) = LOWER(TRIM(p.email))
              )
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_for_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_active_role() = 'TEACHER'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.classes c ON c.id = p_class_id
      WHERE p.id = public.current_profile_id()
        AND (
          c.main_teacher_id = p.id
          OR p.assigned_class_id = p_class_id::TEXT
          OR EXISTS (
            SELECT 1
            FROM public.teacher_class_assignments tca
            WHERE tca.class_id = p_class_id
              AND (
                tca.teacher_id = p.id
                OR LOWER(TRIM(tca.teacher_email)) = LOWER(TRIM(p.email))
              )
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_parent_for_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_active_role() = 'PARENT'
    AND EXISTS (
      SELECT 1
      FROM public.student_parents sp
      WHERE sp.student_id = p_student_id
        AND sp.parent_user_id = public.current_profile_id()
    );
$$;

-- Q5a: Supabase Custom Access Token Auth Hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID;
  v_email TEXT;
  v_profile_id UUID;
  v_claims jsonb;
  v_roles jsonb;
  v_requested_active_role TEXT;
  v_active_role TEXT;
BEGIN
  v_claims := COALESCE(event->'claims', '{}'::jsonb);

  BEGIN
    v_auth_uid := NULLIF(event->>'user_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_auth_uid := NULL;
  END;

  v_email := LOWER(TRIM(COALESCE(v_claims->>'email', '')));

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE (v_auth_uid IS NOT NULL AND (p.auth_user_id = v_auth_uid OR p.id = v_auth_uid))
     OR (v_email <> '' AND LOWER(TRIM(p.email)) = v_email)
  ORDER BY CASE WHEN p.auth_user_id = v_auth_uid THEN 0 WHEN p.id = v_auth_uid THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(ur.role_name ORDER BY public.fn_role_priority(ur.role_name) DESC), '[]'::jsonb)
    INTO v_roles
    FROM public.user_roles ur
    WHERE ur.user_id = v_profile_id;

    v_requested_active_role := NULLIF(
      TRIM(COALESCE(v_claims->'user_metadata'->>'active_role', v_claims->'app_metadata'->>'active_role', v_claims->>'active_role', '')),
      ''
    );

    IF v_requested_active_role IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_profile_id AND ur.role_name = v_requested_active_role
    ) THEN
      v_active_role := v_requested_active_role;
    ELSE
      SELECT ur.role_name
      INTO v_active_role
      FROM public.user_roles ur
      WHERE ur.user_id = v_profile_id
      ORDER BY public.fn_role_priority(ur.role_name) DESC, ur.created_at ASC
      LIMIT 1;
    END IF;

    v_claims := jsonb_set(v_claims, '{profile_id}', to_jsonb(v_profile_id::TEXT), true);
    v_claims := jsonb_set(v_claims, '{roles}', COALESCE(v_roles, '[]'::jsonb), true);
    IF v_active_role IS NOT NULL THEN
      v_claims := jsonb_set(v_claims, '{active_role}', to_jsonb(v_active_role), true);
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims, true);
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;

-- Q5b: Server Transaction Context RPC (chi service_role duoc goi de gia lap/ep ngu canh RLS trong transaction)
CREATE OR REPLACE FUNCTION public.rpc_set_active_role_context(
  p_profile_id UUID,
  p_active_role TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_has_role BOOLEAN;
BEGIN
  SELECT id, auth_user_id, email
  INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile % not found', p_profile_id USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_profile_id
      AND role_name = p_active_role
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'FORBIDDEN_ACTIVE_ROLE: User % does not hold role %', p_profile_id, p_active_role
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_profile.auth_user_id, v_profile.id)::TEXT, true);
  PERFORM set_config('request.jwt.claim.email', COALESCE(v_profile.email, ''), true);
  PERFORM set_config('request.jwt.claim.active_role', p_active_role, true);

  RETURN jsonb_build_object(
    'profile_id', v_profile.id,
    'active_role', p_active_role,
    'verified', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_active_role_context(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_active_role_context(UUID, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 8. THAY THE TOAN BO POLICY USING (true) BANG CHINH SACH RLS HAI LOP NGHIEM NGAT
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Go tat ca policy mo rong cu tren cac bang cot loi
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public select on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all for service role and auth" ON public.profiles;
DROP POLICY IF EXISTS "Public full access to profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow select classes" ON public.classes;
DROP POLICY IF EXISTS "Allow select students" ON public.students;
DROP POLICY IF EXISTS "Public full access to students" ON public.students;
DROP POLICY IF EXISTS "Allow select student_guardians" ON public.student_guardians;
DROP POLICY IF EXISTS "Allow select teacher_class_assignments" ON public.teacher_class_assignments;
DROP POLICY IF EXISTS "Allow select authorized_pickups" ON public.authorized_pickups;
DROP POLICY IF EXISTS "Allow all attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Allow all absence_requests" ON public.absence_requests;
DROP POLICY IF EXISTS "Allow all medication_requests" ON public.medication_requests;
DROP POLICY IF EXISTS "Allow all kitchen_meal_orders" ON public.kitchen_meal_orders;
DROP POLICY IF EXISTS "Allow all meal_exceptions" ON public.meal_exceptions;
DROP POLICY IF EXISTS "Allow all student_applications" ON public.student_applications;

-- 8.1 USER_ROLES
DROP POLICY IF EXISTS "Service role full access user_roles" ON public.user_roles;
CREATE POLICY "Service role full access user_roles" ON public.user_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users select own roles or admin select all" ON public.user_roles;
CREATE POLICY "Users select own roles or admin select all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id() OR public.is_admin_active());

DROP POLICY IF EXISTS "Admin manage user_roles" ON public.user_roles;
CREATE POLICY "Admin manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

-- 8.2 PROFILES
DROP POLICY IF EXISTS "Service role full access profiles" ON public.profiles;
CREATE POLICY "Service role full access profiles" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated select profiles by scope" ON public.profiles;
CREATE POLICY "Authenticated select profiles by scope" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = public.current_profile_id()
    OR public.is_admin_active()
    OR (
      public.current_active_role() = 'TEACHER'
      AND (
        EXISTS (
          SELECT 1
          FROM public.student_parents sp
          WHERE sp.parent_user_id = profiles.id
            AND public.is_teacher_for_student(sp.student_id)
        )
        OR profiles.role IN ('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
      )
    )
  );

DROP POLICY IF EXISTS "Users update own profile or admin manage profiles" ON public.profiles;
CREATE POLICY "Users update own profile or admin manage profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = public.current_profile_id() OR public.is_admin_active())
  WITH CHECK (id = public.current_profile_id() OR public.is_admin_active());

-- 8.3 CLASSES & TEACHER_CLASS_ASSIGNMENTS
DROP POLICY IF EXISTS "Service role full access classes" ON public.classes;
CREATE POLICY "Service role full access classes" ON public.classes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read classes" ON public.classes;
CREATE POLICY "Scoped read classes" ON public.classes
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.current_active_role() = 'STAFF'
    OR public.is_teacher_for_class(classes.id)
    OR (
      public.current_active_role() = 'PARENT'
      AND EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.student_parents sp ON sp.student_id = s.id
        WHERE s.class_id = classes.id
          AND sp.parent_user_id = public.current_profile_id()
      )
    )
  );

DROP POLICY IF EXISTS "Admin manage classes" ON public.classes;
CREATE POLICY "Admin manage classes" ON public.classes
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

DROP POLICY IF EXISTS "Service role full access teacher_class_assignments" ON public.teacher_class_assignments;
CREATE POLICY "Service role full access teacher_class_assignments" ON public.teacher_class_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read teacher_class_assignments" ON public.teacher_class_assignments;
CREATE POLICY "Scoped read teacher_class_assignments" ON public.teacher_class_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR (
      public.current_active_role() = 'TEACHER'
      AND (
        teacher_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = public.current_profile_id()
            AND LOWER(TRIM(p.email)) = LOWER(TRIM(teacher_class_assignments.teacher_email))
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admin manage teacher_class_assignments" ON public.teacher_class_assignments;
CREATE POLICY "Admin manage teacher_class_assignments" ON public.teacher_class_assignments
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

-- 8.4 STUDENTS
DROP POLICY IF EXISTS "Service role full access students" ON public.students;
CREATE POLICY "Service role full access students" ON public.students
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Role active scoped read students" ON public.students;
CREATE POLICY "Role active scoped read students" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.current_active_role() = 'STAFF'
    OR public.is_teacher_for_student(students.id)
    OR public.is_parent_for_student(students.id)
  );

DROP POLICY IF EXISTS "Admin manage students" ON public.students;
CREATE POLICY "Admin manage students" ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

-- 8.5 STUDENT_PARENTS, STUDENT_GUARDIANS & PARENT_STUDENT_RELATIONS
DROP POLICY IF EXISTS "Service role full access student_parents" ON public.student_parents;
CREATE POLICY "Service role full access student_parents" ON public.student_parents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read student_parents" ON public.student_parents;
CREATE POLICY "Scoped read student_parents" ON public.student_parents
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR (public.current_active_role() = 'PARENT' AND parent_user_id = public.current_profile_id())
    OR public.is_teacher_for_student(student_parents.student_id)
  );

DROP POLICY IF EXISTS "Admin manage student_parents" ON public.student_parents;
CREATE POLICY "Admin manage student_parents" ON public.student_parents
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

DROP POLICY IF EXISTS "Service role full access student_guardians" ON public.student_guardians;
CREATE POLICY "Service role full access student_guardians" ON public.student_guardians
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read student_guardians" ON public.student_guardians;
CREATE POLICY "Scoped read student_guardians" ON public.student_guardians
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR (public.current_active_role() = 'PARENT' AND guardian_id = public.current_profile_id())
    OR public.is_teacher_for_student(student_guardians.student_id)
  );

DROP POLICY IF EXISTS "Admin manage student_guardians" ON public.student_guardians;
CREATE POLICY "Admin manage student_guardians" ON public.student_guardians
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

DO $$
BEGIN
  IF to_regclass('public.parent_student_relations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.parent_student_relations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow select parent_student_relations" ON public.parent_student_relations';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access parent_student_relations" ON public.parent_student_relations';
    EXECUTE 'CREATE POLICY "Service role full access parent_student_relations" ON public.parent_student_relations FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Scoped read parent_student_relations" ON public.parent_student_relations';
    EXECUTE $pol$
      CREATE POLICY "Scoped read parent_student_relations" ON public.parent_student_relations
        FOR SELECT TO authenticated
        USING (
          public.is_admin_active()
          OR (public.current_active_role() = 'PARENT' AND parent_id = public.current_profile_id())
          OR public.is_teacher_for_student(parent_student_relations.student_id)
        )
    $pol$;
  END IF;
END $$;

-- 8.6 PICKUP_AUTHORIZATIONS & AUTHORIZED_PICKUPS
DO $$
BEGIN
  IF to_regclass('public.pickup_authorizations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.pickup_authorizations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow select pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE 'DROP POLICY IF EXISTS "Allow insert pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE 'DROP POLICY IF EXISTS "Allow delete pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE 'CREATE POLICY "Service role full access pickup_authorizations" ON public.pickup_authorizations FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Scoped read pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE $pol$
      CREATE POLICY "Scoped read pickup_authorizations" ON public.pickup_authorizations
        FOR SELECT TO authenticated
        USING (
          public.is_admin_active()
          OR public.is_teacher_for_student(student_id)
          OR public.is_parent_for_student(student_id)
        )
    $pol$;
    EXECUTE 'DROP POLICY IF EXISTS "Parent or admin manage pickup_authorizations" ON public.pickup_authorizations';
    EXECUTE $pol$
      CREATE POLICY "Parent or admin manage pickup_authorizations" ON public.pickup_authorizations
        FOR ALL TO authenticated
        USING (public.is_admin_active() OR public.is_parent_for_student(student_id))
        WITH CHECK (public.is_admin_active() OR public.is_parent_for_student(student_id))
    $pol$;
  END IF;
END $$;

DROP POLICY IF EXISTS "Service role full access authorized_pickups" ON public.authorized_pickups;
CREATE POLICY "Service role full access authorized_pickups" ON public.authorized_pickups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read authorized_pickups" ON public.authorized_pickups;
CREATE POLICY "Scoped read authorized_pickups" ON public.authorized_pickups
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.is_teacher_for_student(student_id)
    OR public.is_parent_for_student(student_id)
  );

DROP POLICY IF EXISTS "Parent or admin manage authorized_pickups" ON public.authorized_pickups;
CREATE POLICY "Parent or admin manage authorized_pickups" ON public.authorized_pickups
  FOR ALL TO authenticated
  USING (public.is_admin_active() OR public.is_parent_for_student(student_id))
  WITH CHECK (public.is_admin_active() OR public.is_parent_for_student(student_id));

-- 8.7 ATTENDANCE_RECORDS, MEDICATION_REQUESTS, MEAL_EXCEPTIONS, HEALTH_RECORDS
DROP POLICY IF EXISTS "Service role full access attendance_records" ON public.attendance_records;
CREATE POLICY "Service role full access attendance_records" ON public.attendance_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read attendance_records" ON public.attendance_records;
CREATE POLICY "Scoped read attendance_records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.is_teacher_for_student(student_id)
    OR public.is_parent_for_student(student_id)
  );

DROP POLICY IF EXISTS "Teacher or admin write attendance_records" ON public.attendance_records;
CREATE POLICY "Teacher or admin write attendance_records" ON public.attendance_records
  FOR ALL TO authenticated
  USING (public.is_admin_active() OR public.is_teacher_for_student(student_id))
  WITH CHECK (public.is_admin_active() OR public.is_teacher_for_student(student_id));

DROP POLICY IF EXISTS "Service role full access medication_requests" ON public.medication_requests;
CREATE POLICY "Service role full access medication_requests" ON public.medication_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read medication_requests" ON public.medication_requests;
CREATE POLICY "Scoped read medication_requests" ON public.medication_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.is_teacher_for_student(student_id)
    OR public.is_parent_for_student(student_id)
  );

DROP POLICY IF EXISTS "Parent insert medication_requests" ON public.medication_requests;
CREATE POLICY "Parent insert medication_requests" ON public.medication_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_active()
    OR public.is_parent_for_student(student_id)
    OR public.is_teacher_for_student(student_id)
  );

DROP POLICY IF EXISTS "Teacher or admin update medication_requests" ON public.medication_requests;
CREATE POLICY "Teacher or admin update medication_requests" ON public.medication_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin_active() OR public.is_teacher_for_student(student_id))
  WITH CHECK (public.is_admin_active() OR public.is_teacher_for_student(student_id));

DROP POLICY IF EXISTS "Service role full access meal_exceptions" ON public.meal_exceptions;
CREATE POLICY "Service role full access meal_exceptions" ON public.meal_exceptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read meal_exceptions" ON public.meal_exceptions;
CREATE POLICY "Scoped read meal_exceptions" ON public.meal_exceptions
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.is_teacher_for_student(student_id)
    OR public.is_parent_for_student(student_id)
  );

DROP POLICY IF EXISTS "Teacher or admin write meal_exceptions" ON public.meal_exceptions;
CREATE POLICY "Teacher or admin write meal_exceptions" ON public.meal_exceptions
  FOR ALL TO authenticated
  USING (public.is_admin_active() OR public.is_teacher_for_student(student_id))
  WITH CHECK (public.is_admin_active() OR public.is_teacher_for_student(student_id));

DO $$
BEGIN
  IF to_regclass('public.health_records') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow all access to health_records" ON public.health_records';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access health_records" ON public.health_records';
    EXECUTE 'CREATE POLICY "Service role full access health_records" ON public.health_records FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Scoped read health_records" ON public.health_records';
    EXECUTE $pol$
      CREATE POLICY "Scoped read health_records" ON public.health_records
        FOR SELECT TO authenticated
        USING (
          public.is_admin_active()
          OR public.current_active_role() = 'STAFF'
          OR public.is_teacher_for_student(student_id)
          OR public.is_parent_for_student(student_id)
        )
    $pol$;
    EXECUTE 'DROP POLICY IF EXISTS "Admin or staff write health_records" ON public.health_records';
    EXECUTE $pol$
      CREATE POLICY "Admin or staff write health_records" ON public.health_records
        FOR ALL TO authenticated
        USING (public.is_admin_active() OR public.current_active_role() = 'STAFF')
        WITH CHECK (public.is_admin_active() OR public.current_active_role() = 'STAFF')
    $pol$;
  END IF;
END $$;

-- 8.8 ABSENCE_REQUESTS (Giao vien duoc duyet don cua con minh trong lop minh day)
DROP POLICY IF EXISTS "Service role full access absence_requests" ON public.absence_requests;
CREATE POLICY "Service role full access absence_requests" ON public.absence_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scoped read absence_requests" ON public.absence_requests;
CREATE POLICY "Scoped read absence_requests" ON public.absence_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR public.is_teacher_for_student(student_id)
    OR public.is_parent_for_student(student_id)
  );

DROP POLICY IF EXISTS "Parent or admin create absence_requests" ON public.absence_requests;
CREATE POLICY "Parent or admin create absence_requests" ON public.absence_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_active()
    OR public.is_parent_for_student(student_id)
  );

DROP POLICY IF EXISTS "Teacher or admin update absence_requests" ON public.absence_requests;
CREATE POLICY "Teacher or admin update absence_requests" ON public.absence_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin_active() OR public.is_teacher_for_student(student_id))
  WITH CHECK (public.is_admin_active() OR public.is_teacher_for_student(student_id));

-- 8.9 KITCHEN, MENUS, SYSTEM_SETTINGS, APPLICATIONS
DROP POLICY IF EXISTS "Service role full access kitchen_meal_orders" ON public.kitchen_meal_orders;
CREATE POLICY "Service role full access kitchen_meal_orders" ON public.kitchen_meal_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Teacher staff admin access kitchen_meal_orders" ON public.kitchen_meal_orders;
CREATE POLICY "Teacher staff admin access kitchen_meal_orders" ON public.kitchen_meal_orders
  FOR ALL TO authenticated
  USING (
    public.is_admin_active()
    OR public.current_active_role() = 'STAFF'
    OR public.is_teacher_for_class(class_id)
  )
  WITH CHECK (
    public.is_admin_active()
    OR public.current_active_role() = 'STAFF'
    OR public.is_teacher_for_class(class_id)
  );

DO $$
BEGIN
  IF to_regclass('public.kitchen_daily_reports') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.kitchen_daily_reports ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow select kitchen_daily_reports" ON public.kitchen_daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "Allow insert kitchen_daily_reports" ON public.kitchen_daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update kitchen_daily_reports" ON public.kitchen_daily_reports';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access kitchen_daily_reports" ON public.kitchen_daily_reports';
    EXECUTE 'CREATE POLICY "Service role full access kitchen_daily_reports" ON public.kitchen_daily_reports FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Teacher staff admin access kitchen_daily_reports" ON public.kitchen_daily_reports';
    EXECUTE $pol$
      CREATE POLICY "Teacher staff admin access kitchen_daily_reports" ON public.kitchen_daily_reports
        FOR ALL TO authenticated
        USING (
          public.is_admin_active()
          OR public.current_active_role() = 'STAFF'
          OR public.is_teacher_for_class(class_id)
        )
        WITH CHECK (
          public.is_admin_active()
          OR public.current_active_role() = 'STAFF'
          OR public.is_teacher_for_class(class_id)
        )
    $pol$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.weekly_menus') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.weekly_menus ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow select weekly_menus" ON public.weekly_menus';
    EXECUTE 'DROP POLICY IF EXISTS "Allow modify weekly_menus" ON public.weekly_menus';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access weekly_menus" ON public.weekly_menus';
    EXECUTE 'CREATE POLICY "Service role full access weekly_menus" ON public.weekly_menus FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated read weekly_menus" ON public.weekly_menus';
    EXECUTE $pol$
      CREATE POLICY "Authenticated read weekly_menus" ON public.weekly_menus
        FOR SELECT TO authenticated
        USING (public.current_profile_id() IS NOT NULL)
    $pol$;
    EXECUTE 'DROP POLICY IF EXISTS "Admin or staff modify weekly_menus" ON public.weekly_menus';
    EXECUTE $pol$
      CREATE POLICY "Admin or staff modify weekly_menus" ON public.weekly_menus
        FOR ALL TO authenticated
        USING (public.is_admin_active() OR public.current_active_role() = 'STAFF')
        WITH CHECK (public.is_admin_active() OR public.current_active_role() = 'STAFF')
    $pol$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow select system_settings" ON public.system_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access system_settings" ON public.system_settings';
    EXECUTE 'CREATE POLICY "Service role full access system_settings" ON public.system_settings FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated read system_settings" ON public.system_settings';
    EXECUTE $pol$
      CREATE POLICY "Authenticated read system_settings" ON public.system_settings
        FOR SELECT TO authenticated
        USING (public.current_profile_id() IS NOT NULL)
    $pol$;
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage system_settings" ON public.system_settings';
    EXECUTE $pol$
      CREATE POLICY "Admin manage system_settings" ON public.system_settings
        FOR ALL TO authenticated
        USING (public.is_admin_active())
        WITH CHECK (public.is_admin_active())
    $pol$;
  END IF;
END $$;

DROP POLICY IF EXISTS "Service role full access student_applications" ON public.student_applications;
CREATE POLICY "Service role full access student_applications" ON public.student_applications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert student_applications" ON public.student_applications;
CREATE POLICY "Public insert student_applications" ON public.student_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin manage student_applications" ON public.student_applications;
CREATE POLICY "Admin manage student_applications" ON public.student_applications
  FOR ALL TO authenticated
  USING (public.is_admin_active())
  WITH CHECK (public.is_admin_active());

-- 8.10 ANNOUNCEMENTS, ANNOUNCEMENT_READS & PUSH_SUBSCRIPTIONS (CO LAP VAI TRO)
DROP POLICY IF EXISTS "Service role full access announcements" ON public.announcements;
CREATE POLICY "Service role full access announcements" ON public.announcements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Role isolated read announcements" ON public.announcements;
CREATE POLICY "Role isolated read announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    public.is_admin_active()
    OR (
      (target_role = 'ALL' OR target_role = public.current_active_role())
      AND (
        class_id IS NULL
        OR public.is_teacher_for_class(class_id)
        OR (
          public.current_active_role() = 'PARENT'
          AND EXISTS (
            SELECT 1
            FROM public.students s
            JOIN public.student_parents sp ON sp.student_id = s.id
            WHERE s.class_id = announcements.class_id
              AND sp.parent_user_id = public.current_profile_id()
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Teacher or admin create announcements" ON public.announcements;
CREATE POLICY "Teacher or admin create announcements" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_active()
    OR (
      public.current_active_role() = 'TEACHER'
      AND target_role IN ('ALL', 'PARENT')
      AND (class_id IS NULL OR public.is_teacher_for_class(class_id))
    )
  );

DROP POLICY IF EXISTS "Service role full access announcement_reads" ON public.announcement_reads;
CREATE POLICY "Service role full access announcement_reads" ON public.announcement_reads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Role context isolated announcement_reads" ON public.announcement_reads;
CREATE POLICY "Role context isolated announcement_reads" ON public.announcement_reads
  FOR ALL TO authenticated
  USING (
    user_id = public.current_profile_id()
    AND role_context = public.current_active_role()
  )
  WITH CHECK (
    user_id = public.current_profile_id()
    AND role_context = public.current_active_role()
  );

DROP POLICY IF EXISTS "Service role full access push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Service role full access push_subscriptions" ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());
