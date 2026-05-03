-- ==========================================================
-- CORRECTED POLICIES FOR CLIENT DOCUMENTS (STORAGE)
-- ==========================================================

DROP POLICY IF EXISTS "Clients can upload their docs" ON storage.objects;
CREATE POLICY "Clients can upload their docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-documents' AND 
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE name LIKE (id::text || '/%')
    AND auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clients can view their docs" ON storage.objects;
CREATE POLICY "Clients can view their docs" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-documents' AND 
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE name LIKE (id::text || '/%')
    AND auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clients can update their docs" ON storage.objects;
CREATE POLICY "Clients can update their docs" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-documents' AND 
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE name LIKE (id::text || '/%')
    AND auth_user_id = auth.uid()
  )
);

-- Fix the update policy on public.documents just to be safe
DROP POLICY IF EXISTS "docs_update_own" ON public.documents;
CREATE POLICY "docs_update_own" ON public.documents FOR UPDATE TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
) WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Mettre à jour le cache du schéma Supabase
NOTIFY pgrst, 'reload schema';
