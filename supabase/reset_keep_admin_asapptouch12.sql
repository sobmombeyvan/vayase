-- ==========================================================
-- FULL RESET (PRODUCTION CLEAN START)
-- Keep ONLY: asapptouch12@gmail.com
-- ==========================================================
-- Run in Supabase SQL Editor as postgres/service role.

BEGIN;

TRUNCATE TABLE
  public.activity_log,
  public.notifications,
  public.tasks,
  public.appointments,
  public.documents,
  public.client_step_notes,
  public.client_steps,
  public.payments,
  public.contracts,
  public.leads,
  public.clients
RESTART IDENTITY CASCADE;

DELETE FROM auth.users
WHERE lower(email) IS DISTINCT FROM 'asapptouch12@gmail.com';

DO $$
DECLARE
  _admin_id UUID;
BEGIN
  SELECT id INTO _admin_id
  FROM auth.users
  WHERE lower(email) = 'asapptouch12@gmail.com'
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE NOTICE 'Admin account asapptouch12@gmail.com not found yet. Create it and it will auto-become super_admin.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_admin_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_admin_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = _admin_id
    AND role NOT IN ('super_admin', 'admin');
END $$;

COMMIT;
