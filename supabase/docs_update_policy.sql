-- ==========================================================
-- UPDATE DOCUMENTS TABLE RLS FOR CLIENTS
-- ==========================================================

-- Allow clients to UPDATE their own documents (needed when they upload a requested/pending document)
DROP POLICY IF EXISTS "docs_update_own" ON public.documents;
CREATE POLICY "docs_update_own" ON public.documents FOR UPDATE TO authenticated USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Mettre à jour le cache du schéma Supabase
NOTIFY pgrst, 'reload schema';
