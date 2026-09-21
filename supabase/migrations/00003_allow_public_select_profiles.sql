-- Migration 00003: Allow SELECT on public.profiles for all roles (anon & authenticated)
-- Ensures that queries to public.profiles never return empty results due to RLS blocks.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public select on profiles" ON public.profiles;

CREATE POLICY "Allow public select on profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Allow service_role & authenticated to insert/update profiles
DROP POLICY IF EXISTS "Allow all for service role and auth" ON public.profiles;
CREATE POLICY "Allow all for service role and auth" 
ON public.profiles 
FOR ALL 
USING (true) 
WITH CHECK (true);
