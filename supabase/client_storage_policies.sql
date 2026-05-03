-- Policies for Client Documents (Storage)
-- Allow clients to upload, update and view their own documents.
-- The folder name (first part of the path) is the client's UUID.

DROP POLICY IF EXISTS "Clients can upload their docs" ON storage.objects;
CREATE POLICY "Clients can upload their docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-documents' AND 
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id::text = (storage.foldername(name))[1] 
    AND auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clients can view their docs" ON storage.objects;
CREATE POLICY "Clients can view their docs" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-documents' AND 
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id::text = (storage.foldername(name))[1] 
    AND auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clients can update their docs" ON storage.objects;
CREATE POLICY "Clients can update their docs" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-documents' AND 
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id::text = (storage.foldername(name))[1] 
    AND auth_user_id = auth.uid()
  )
);

-- Mettre à jour le cache du schéma Supabase
NOTIFY pgrst, 'reload schema';
