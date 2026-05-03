-- Ce script ajoute le rôle 'client' à la liste des rôles autorisés (enum app_role)
-- si celui-ci n'a pas encore été ajouté à votre base de données.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Recharge le cache pour que Supabase prenne en compte la modification
ALTER ROLE authenticator SET statement_timeout = '10s';
NOTIFY pgrst, 'reload schema';
