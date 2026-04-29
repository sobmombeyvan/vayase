ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_referred_by_user_id ON public.clients(referred_by_user_id);
