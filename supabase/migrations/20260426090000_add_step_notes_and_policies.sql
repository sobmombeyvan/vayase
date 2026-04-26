CREATE TABLE public.client_step_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.client_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_step_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step_notes_select" ON public.client_step_notes
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "step_notes_insert" ON public.client_step_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_clients(auth.uid()) AND
    auth.uid() = user_id
  );

CREATE POLICY "step_notes_delete_admin" ON public.client_step_notes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_client_step_notes_step ON public.client_step_notes(step_id, created_at DESC);
CREATE INDEX idx_client_step_notes_user ON public.client_step_notes(user_id, created_at DESC);
CREATE TABLE public.client_step_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.client_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_step_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "step_notes_select" ON public.client_step_notes
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "step_notes_insert" ON public.client_step_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_clients(auth.uid()) AND
    auth.uid() = user_id
  );

CREATE POLICY "step_notes_delete_admin" ON public.client_step_notes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_client_step_notes_step ON public.client_step_notes(step_id, created_at DESC);
CREATE INDEX idx_client_step_notes_user ON public.client_step_notes(user_id, created_at DESC);
