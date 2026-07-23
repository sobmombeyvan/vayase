-- ============================================================
-- FIX ENVOI + TÉLÉCHARGEMENT FICHIERS CHAT — Supabase SQL Editor
-- ============================================================

-- Colonnes pièces jointes (obligatoire pour lier fichier ↔ message)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size BIGINT;

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_body_check CHECK (
    attachment_path IS NOT NULL OR char_length(trim(body)) > 0
  );

CREATE OR REPLACE FUNCTION public.can_access_chat_storage(_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(_object_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.can_access_client((storage.foldername(_object_name))[1]::uuid)
    ELSE false
  END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', false, 10485760, NULL)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
CREATE POLICY "chat_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_storage(name)
  );

DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_storage(name)
  );

DROP POLICY IF EXISTS "chat_attachments_update" ON storage.objects;
CREATE POLICY "chat_attachments_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_storage(name)
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_storage(name)
  );

DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
CREATE POLICY "chat_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'admin')
    )
    AND public.can_access_chat_storage(name)
  );

DROP POLICY IF EXISTS "chat_docs_in_client_documents_select" ON storage.objects;
CREATE POLICY "chat_docs_in_client_documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[2] = 'chat'
    AND public.can_access_client((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "chat_docs_in_client_documents_insert" ON storage.objects;
CREATE POLICY "chat_docs_in_client_documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[2] = 'chat'
    AND public.can_access_client((storage.foldername(name))[1]::uuid)
  );

NOTIFY pgrst, 'reload schema';
