-- ==============================================================================
-- Migration 00014: Enable Supabase Realtime publication for operational tables
-- Safe & idempotent: checks publication + table existence before altering.
-- ==============================================================================

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'teacher_class_assignments',
    'user_roles',
    'student_parents',
    'student_guardians',
    'students',
    'attendance_records',
    'meal_exceptions',
    'medication_requests',
    'absence_requests',
    'kitchen_daily_reports',
    'kitchen_meal_orders',
    'pickup_authorizations',
    'authorized_pickups',
    'health_records',
    'weekly_menus',
    'announcements'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables LOOP
      IF to_regclass('public.' || v_table) IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = v_table
         )
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;
