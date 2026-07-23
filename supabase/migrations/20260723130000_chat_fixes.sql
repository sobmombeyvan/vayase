-- Fix chat notifications + access for all staff roles

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

  IF _client IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = _client.auth_user_id THEN
    IF _client.agent_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        _client.agent_id,
        'Nouveau message de ' || _client.full_name,
        left(NEW.body, 120),
        'client',
        '/messages?client=' || NEW.client_id::text
      );
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT
      ur.user_id,
      'Nouveau message de ' || _client.full_name,
      left(NEW.body, 120),
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
      left(NEW.body, 120),
      'client',
      '/client/messages'
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
