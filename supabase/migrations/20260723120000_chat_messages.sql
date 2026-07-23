-- Live chat between staff and clients (one thread per client)

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_client_created
  ON public.chat_messages(client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON public.chat_messages(client_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Staff or linked client can access a client's thread
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

-- Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Notify recipient on new message
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client RECORD;
  _recipient_id UUID;
  _sender_name TEXT;
BEGIN
  SELECT c.full_name, c.auth_user_id, c.agent_id
  INTO _client
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  SELECT COALESCE(p.full_name, 'Utilisateur')
  INTO _sender_name
  FROM public.profiles p
  WHERE p.id = NEW.sender_id;

  IF NEW.sender_id = _client.auth_user_id THEN
    _recipient_id := COALESCE(_client.agent_id, (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('super_admin', 'admin')
      LIMIT 1
    ));
  ELSE
    _recipient_id := _client.auth_user_id;
  END IF;

  IF _recipient_id IS NOT NULL AND _recipient_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      _recipient_id,
      CASE WHEN NEW.sender_id = _client.auth_user_id
        THEN 'Nouveau message de ' || _client.full_name
        ELSE 'Message de votre conseiller'
      END,
      left(NEW.body, 120),
      'client',
      CASE WHEN NEW.sender_id = _client.auth_user_id
        THEN '/messages?client=' || NEW.client_id::text
        ELSE '/client/messages'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_insert ON public.chat_messages;
CREATE TRIGGER on_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();
