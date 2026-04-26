ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_converted_client ON public.leads(converted_client_id);
