-- Run manually before go-live to remove demo business data.
-- Keep user accounts/roles by default.

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

COMMIT;

-- Optional: remove demo profiles/roles for users that no longer exist in auth.users
-- DELETE FROM public.user_roles ur WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);
-- DELETE FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
