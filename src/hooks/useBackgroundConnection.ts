import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ensurePushSubscription,
  listenForServiceWorkerMessages,
  registerServiceWorker,
} from '@/lib/push-notifications';

/** Keep Supabase Realtime alive + reconnect when iOS resumes the PWA */
export function useBackgroundConnection(
  userId: string | undefined,
  clientId: string | undefined,
  onNewMessage?: (body: string, id: string) => void
) {
  const lastIdRef = useRef<string | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!userId) return;
    ensurePushSubscription(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId || !clientId) return;

    const checkUnread = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, body')
        .eq('client_id', clientId)
        .neq('sender_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const latest = data?.[0];
      if (latest && latest.id !== lastIdRef.current) {
        lastIdRef.current = latest.id;
        onNewMessageRef.current?.(latest.body, latest.id);
      }
    };

    const resubscribe = () => ensurePushSubscription(userId);
    const cleanupSw = listenForServiceWorkerMessages(checkUnread, resubscribe);

    const channel = supabase
      .channel(`bg-client-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          const msg = payload.new as { id: string; body: string; sender_id: string };
          if (msg.sender_id === userId || msg.id === lastIdRef.current) return;
          lastIdRef.current = msg.id;
          onNewMessageRef.current?.(msg.body, msg.id);
        }
      )
      .subscribe();

    const wake = () => {
      checkUnread();
      ensurePushSubscription(userId);
    };

    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake();
    });

    const poll = setInterval(() => {
      if (document.visibilityState === 'hidden') checkUnread();
    }, 20000);

    return () => {
      cleanupSw();
      clearInterval(poll);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      supabase.removeChannel(channel);
    };
  }, [userId, clientId]);
}
