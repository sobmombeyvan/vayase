-- Fix search_path on trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Replace overly permissive policies with role-scoped ones
DROP POLICY IF EXISTS "leads_all" ON public.leads;
DROP POLICY IF EXISTS "clients_all" ON public.clients;
DROP POLICY IF EXISTS "steps_all" ON public.client_steps;
DROP POLICY IF EXISTS "contracts_all" ON public.contracts;
DROP POLICY IF EXISTS "payments_all" ON public.payments;

-- Helper: any authenticated user with an internal role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_clients(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role IN ('super_admin','admin','agent','manager'))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role IN ('super_admin','admin','comptable'))
$$;

-- LEADS
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- CLIENTS
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- STEPS
CREATE POLICY "steps_select" ON public.client_steps FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "steps_insert" ON public.client_steps FOR INSERT TO authenticated WITH CHECK (public.can_manage_clients(auth.uid()));
CREATE POLICY "steps_update" ON public.client_steps FOR UPDATE TO authenticated USING (public.can_manage_clients(auth.uid()));
CREATE POLICY "steps_delete" ON public.client_steps FOR DELETE TO authenticated USING (public.can_manage_clients(auth.uid()));

-- CONTRACTS
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- PAYMENTS
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY "payments_delete" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));