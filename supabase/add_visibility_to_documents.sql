ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN NOT NULL DEFAULT true;

-- Mettre à jour le cache du schéma Supabase
NOTIFY pgrst, 'reload schema';
