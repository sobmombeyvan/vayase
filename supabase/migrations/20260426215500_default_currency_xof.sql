-- Set FCFA (XOF) as default currency for new finance records.
ALTER TABLE public.contracts ALTER COLUMN currency SET DEFAULT 'XOF';
ALTER TABLE public.payments ALTER COLUMN currency SET DEFAULT 'XOF';
