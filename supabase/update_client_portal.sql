-- ==========================================================
-- VAYASE NAVIGATOR - CLIENT PORTAL DB UPDATE
-- Run this file in your Supabase SQL Editor.
-- ==========================================================

-- 1. Add 'client' role if it doesn't exist
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE 'client';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add auth_user_id to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- 3. Update handle_new_user to handle role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assigned_role text;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  -- Read role from metadata if it exists
  assigned_role := NEW.raw_user_meta_data->>'role';

  IF lower(COALESCE(NEW.email, '')) = 'sobmombeyvan@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF assigned_role = 'client' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'agent')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- 4. Add RLS policies for clients to view their own data
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
CREATE POLICY "clients_select_own" ON public.clients FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "steps_select_own" ON public.client_steps;
CREATE POLICY "steps_select_own" ON public.client_steps FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "docs_select_own" ON public.documents;
CREATE POLICY "docs_select_own" ON public.documents FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "contracts_select_own" ON public.contracts;
CREATE POLICY "contracts_select_own" ON public.contracts FOR SELECT TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "docs_insert_own" ON public.documents;
CREATE POLICY "docs_insert_own" ON public.documents FOR INSERT TO authenticated WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Update storage policies for clients
DROP POLICY IF EXISTS "Clients can view own docs" ON storage.objects;
CREATE POLICY "Clients can view own docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Clients can upload own docs" ON storage.objects;
CREATE POLICY "Clients can upload own docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid())
  ));
