-- Add missing business field for client onboarding
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS total_fees_due NUMERIC(12,2);

-- Only admins can reassign a client owner once created
CREATE OR REPLACE FUNCTION public.prevent_non_admin_agent_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.agent_id IS DISTINCT FROM NEW.agent_id
     AND NOT (
       public.has_role(auth.uid(), 'super_admin')
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Only admin/super_admin can change the assigned owner.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_guard_agent_assignment ON public.clients;
CREATE TRIGGER trg_clients_guard_agent_assignment
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_agent_reassignment();
