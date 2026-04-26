ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS procedure_template_id UUID REFERENCES public.procedure_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_procedure_template_id ON public.clients(procedure_template_id);
