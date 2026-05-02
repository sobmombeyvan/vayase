-- Ce script va ajouter de manière sécurisée les colonnes manquantes
-- sans toucher ni supprimer vos données existantes !

DO $$ 
BEGIN
  -- 1. Ajout de user_id si manquant dans les tables qui en ont besoin
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log') THEN
    ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS user_id UUID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_step_notes') THEN
    ALTER TABLE public.client_step_notes ADD COLUMN IF NOT EXISTS user_id UUID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_country_permissions') THEN
    ALTER TABLE public.agent_country_permissions ADD COLUMN IF NOT EXISTS user_id UUID;
  END IF;

  -- 2. Ajout des colonnes pour le portail client
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_steps') THEN
    ALTER TABLE public.client_steps ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN DEFAULT true;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN DEFAULT true;
  END IF;

END $$;
