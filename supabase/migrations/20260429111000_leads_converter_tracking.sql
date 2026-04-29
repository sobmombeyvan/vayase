ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS converted_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_converted_by_user_id ON public.leads(converted_by_user_id);
