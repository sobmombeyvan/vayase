import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { playMessageAlert } from '@/lib/notification-sound';

interface AdminChatContextValue {
  isOpen: boolean;
  selectedClientId: string | null;
  unreadTotal: number;
  openChat: (clientId?: string) => void;
  closeChat: () => void;
  setSelectedClientId: (id: string | null) => void;
}

const AdminChatContext = createContext<AdminChatContextValue | null>(null);

export function AdminChatProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const isStaff = hasRole('client') === false && !!user;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!user || !isStaff) return;
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', user.id)
      .is('read_at', null);
    if (!error) setUnreadTotal(count || 0);
  }, [user, isStaff]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    if (!user || !isStaff) return;

    const channel = supabase
      .channel(`admin-chat-alerts-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { sender_id: string; client_id: string; body: string };
          if (msg.sender_id === user.id) return;
          loadUnread();
          playMessageAlert();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        () => loadUnread()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        () => loadUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isStaff, loadUnread]);

  const openChat = useCallback((clientId?: string) => {
    if (clientId) setSelectedClientId(clientId);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!isStaff) {
    return <>{children}</>;
  }

  return (
    <AdminChatContext.Provider
      value={{
        isOpen,
        selectedClientId,
        unreadTotal,
        openChat,
        closeChat,
        setSelectedClientId,
      }}
    >
      {children}
    </AdminChatContext.Provider>
  );
}

export function useAdminChat() {
  const ctx = useContext(AdminChatContext);
  if (!ctx) {
    return {
      isOpen: false,
      selectedClientId: null,
      unreadTotal: 0,
      openChat: () => {},
      closeChat: () => {},
      setSelectedClientId: () => {},
    };
  }
  return ctx;
}

export function parseClientIdFromChatLink(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/[?&]client=([^&]+)/);
  return match ? match[1] : null;
}
