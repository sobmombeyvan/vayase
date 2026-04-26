ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS source_other TEXT;
