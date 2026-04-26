-- Procedure templates by country + procedure type, used to auto-generate client steps.

CREATE TABLE IF NOT EXISTS public.procedure_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  destination_country TEXT,
  visa_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.procedure_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.procedure_templates(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INT NOT NULL DEFAULT 0,
  default_due_days INT,
  notes TEXT,
  default_responsible_role public.app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_tpl_active ON public.procedure_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_proc_tpl_country ON public.procedure_templates(destination_country);
CREATE INDEX IF NOT EXISTS idx_proc_tpl_steps_tpl ON public.procedure_template_steps(template_id, step_order);

ALTER TABLE public.procedure_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_template_steps ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_procedure_templates_updated ON public.procedure_templates;
CREATE TRIGGER trg_procedure_templates_updated
BEFORE UPDATE ON public.procedure_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_procedure_template_steps_updated ON public.procedure_template_steps;
CREATE TRIGGER trg_procedure_template_steps_updated
BEFORE UPDATE ON public.procedure_template_steps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: staff can read, only admin/super_admin can manage
DROP POLICY IF EXISTS procedure_templates_select ON public.procedure_templates;
CREATE POLICY procedure_templates_select ON public.procedure_templates
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS procedure_templates_manage ON public.procedure_templates;
CREATE POLICY procedure_templates_manage ON public.procedure_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS procedure_template_steps_select ON public.procedure_template_steps;
CREATE POLICY procedure_template_steps_select ON public.procedure_template_steps
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS procedure_template_steps_manage ON public.procedure_template_steps;
CREATE POLICY procedure_template_steps_manage ON public.procedure_template_steps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

