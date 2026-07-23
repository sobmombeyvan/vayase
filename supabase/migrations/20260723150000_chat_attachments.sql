-- Chat file attachments (WhatsApp-style document sharing)

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

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
CREATE POLICY "chat_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_access_client(split_part(name, '/', 1)::uuid)
  );

DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.can_access_client(split_part(name, '/', 1)::uuid)
  );

DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
CREATE POLICY "chat_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'admin')
    )
  );
