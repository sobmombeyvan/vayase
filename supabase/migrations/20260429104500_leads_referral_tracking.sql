ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_referred_by_user_id ON public.leads(referred_by_user_id);
