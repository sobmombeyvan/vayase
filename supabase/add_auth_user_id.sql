-- 1. Ajouter la colonne manquante si elle n'existe pas
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Forcer Supabase à mettre à jour son système
ALTER ROLE authenticator SET statement_timeout = '10s';
NOTIFY pgrst, 'reload schema';
