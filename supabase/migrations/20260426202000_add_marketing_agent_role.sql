ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing_agent';

CREATE OR REPLACE FUNCTION public.can_manage_clients(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('super_admin', 'admin', 'agent', 'marketing_agent', 'manager')
  );
$$;
