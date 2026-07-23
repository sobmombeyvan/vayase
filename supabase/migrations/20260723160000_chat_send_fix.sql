-- Fix chat message send failures (safe trigger + schema ensure)

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_client(_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND (
        public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'manager')
        OR public.has_role(auth.uid(), 'support')
        OR public.has_role(auth.uid(), 'marketing_agent')
        OR (public.has_role(auth.uid(), 'agent') AND c.agent_id = auth.uid())
        OR c.auth_user_id = auth.uid()
      )
  );
$$;

DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS "chat_messages_update" ON public.chat_messages;
CREATE POLICY "chat_messages_update" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));

DROP POLICY IF EXISTS "chat_messages_delete" ON public.chat_messages;
CREATE POLICY "chat_messages_delete" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    AND public.can_access_client(client_id)
  );

-- Safe notification trigger — NEVER block message insert
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client RECORD;
BEGIN
  SELECT c.full_name, c.auth_user_id, c.agent_id
  INTO _client
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NEW.sender_id = _client.auth_user_id THEN
      IF _client.agent_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          _client.agent_id,
          'Nouveau message de ' || COALESCE(_client.full_name, 'Client'),
          left(COALESCE(NEW.body, ''), 120),
          'client',
          '/messages?client=' || NEW.client_id::text
        );
      END IF;

      INSERT INTO public.notifications (user_id, title, message, type, link)
      SELECT
        ur.user_id,
        'Nouveau message de ' || COALESCE(_client.full_name, 'Client'),
        left(COALESCE(NEW.body, ''), 120),
        'client',
        '/messages?client=' || NEW.client_id::text
      FROM public.user_roles ur
      WHERE ur.role IN ('super_admin', 'admin', 'manager')
        AND ur.user_id <> NEW.sender_id
        AND (_client.agent_id IS NULL OR ur.user_id <> _client.agent_id);
    ELSIF _client.auth_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        _client.auth_user_id,
        'Message de votre conseiller',
        left(COALESCE(NEW.body, ''), 120),
        'client',
        '/client/messages'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_chat_message failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_insert ON public.chat_messages;
CREATE TRIGGER on_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- Storage for attachments
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
