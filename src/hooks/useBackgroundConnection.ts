import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ensurePushSubscription,
  listenForServiceWorkerMessages,
  registerBackgroundSync,
  registerServiceWorker,
  reconnectRealtime,
} from '@/lib/push-notifications';

/** Keep Supabase Realtime alive + reconnect when iOS resumes the PWA */
export function useBackgroundConnection(
  userId: string | undefined,
  clientId: string | undefined,
  onNewMessage?: (body: string, id: string) => void
) {
  const lastIdRef = useRef<string | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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

    const subscribeRealtime = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`bg-client-${userId}`)
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

      channelRef.current = channel;
    };

    const wake = () => {
      reconnectRealtime();
      subscribeRealtime();
      checkUnread();
      ensurePushSubscription(userId);
    };

    const sleep = () => {
      registerBackgroundSync();
      checkUnread();
    };

    const resubscribe = () => ensurePushSubscription(userId);
    const cleanupSw = listenForServiceWorkerMessages(checkUnread, resubscribe);

    subscribeRealtime();
    checkUnread();

    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('pagehide', sleep);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake();
      else sleep();
    });

    const poll = setInterval(() => {
      if (document.visibilityState === 'hidden') checkUnread();
    }, 10000);

    return () => {
      cleanupSw();
      clearInterval(poll);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('pagehide', sleep);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, clientId]);
}
