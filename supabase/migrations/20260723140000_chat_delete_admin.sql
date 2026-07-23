-- Allow admins to delete chat messages

DROP POLICY IF EXISTS "chat_messages_delete" ON public.chat_messages;
CREATE POLICY "chat_messages_delete" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
    AND public.can_access_client(client_id)
  );
