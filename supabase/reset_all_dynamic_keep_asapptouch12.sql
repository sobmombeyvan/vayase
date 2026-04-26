-- ==========================================================
-- HARD RESET ALL APP DATA (DYNAMIC)
-- Keeps only auth user: asapptouch12@gmail.com
-- ==========================================================
-- Run in Supabase SQL Editor for project jxvjoxqplbdhmlwcltyz

BEGIN;

-- 1) Truncate every table in public schema except migration metadata
DO $$
DECLARE
  stmt TEXT;
BEGIN
  SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE;'
  INTO stmt
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN ('schema_migrations');

  IF stmt IS NOT NULL THEN
    EXECUTE stmt;
  END IF;
END $$;

-- 2) Delete all auth users except the main admin email
DELETE FROM auth.users
WHERE lower(email) IS DISTINCT FROM 'asapptouch12@gmail.com';

-- 3) If admin exists, force roles now (else it will be auto-assigned on signup)
DO $$
DECLARE
  _admin_id UUID;
BEGIN
  SELECT id INTO _admin_id
  FROM auth.users
  WHERE lower(email) = 'asapptouch12@gmail.com'
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE NOTICE 'Admin account asapptouch12@gmail.com not found yet. Create it and trigger will assign super_admin.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_admin_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_admin_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

COMMIT;

-- 4) Verification queries (run after commit)
-- select count(*) as clients from public.clients;
-- select count(*) as leads from public.leads;
-- select count(*) as contracts from public.contracts;
-- select count(*) as payments from public.payments;
-- select email from auth.users order by created_at;
