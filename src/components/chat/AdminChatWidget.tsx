import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageSquare, X, Maximize2, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminChat } from '@/contexts/AdminChatContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatInboxList } from '@/components/chat/ChatInboxList';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ClientRow {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
}

function ChatPanelContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const { selectedClientId, setSelectedClientId } = useAdminChat();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const canDelete = hasAnyRole(['super_admin', 'admin']);

  const { data: clients = [] } = useQuery({
    queryKey: ['chat-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, email, auth_user_id')
        .order('full_name');
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const { data: lastMessages = [] } = useQuery({
    queryKey: ['chat-last-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('client_id, body, created_at, sender_id')
        .order('created_at', { ascending: false });
      if (error) return [];
      const seen = new Set<string>();
      return data.filter((m) => {
        if (seen.has(m.client_id)) return false;
        seen.add(m.client_id);
        return true;
      });
    },
  });

  const { data: unreadByClient = {} } = useQuery({
    queryKey: ['chat-unread-counts'],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from('chat_messages')
        .select('client_id')
        .is('read_at', null)
        .neq('sender_id', user.id);
      if (error) return {};
      const counts: Record<string, number> = {};
      data?.forEach((m) => { counts[m.client_id] = (counts[m.client_id] || 0) + 1; });
      return counts;
    },
    enabled: !!user,
  });

  const lastMessageMap = useMemo(() => {
    const map: Record<string, (typeof lastMessages)[0]> = {};
    lastMessages.forEach((m) => { map[m.client_id] = m; });
    return map;
  }, [lastMessages]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const au = unreadByClient[a.id] || 0;
      const bu = unreadByClient[b.id] || 0;
      if (au !== bu) return bu - au;
      return (lastMessageMap[b.id]?.created_at || '').localeCompare(lastMessageMap[a.id]?.created_at || '');
    });
  }, [clients, lastMessageMap, unreadByClient]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (!isMobile && !selectedClientId && sortedClients.length > 0) {
      setSelectedClientId(sortedClients[0].id);
    }
  }, [sortedClients, selectedClientId, setSelectedClientId, isMobile]);

  const refreshInbox = () => {
    queryClient.invalidateQueries({ queryKey: ['chat-last-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
  };

  const pickClient = (id: string) => {
    setSelectedClientId(id);
    if (isMobile) setMobileShowChat(true);
  };

  const showList = !isMobile || !mobileShowChat;
  const showChat = !isMobile || mobileShowChat;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0 bg-vayase-night text-white">
        {isMobile && mobileShowChat && selectedClient ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/10"
              onClick={() => setMobileShowChat(false)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0 px-1">
              <p className="font-semibold text-sm truncate">{selectedClient.full_name}</p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-vayase-accent" />
            <h2 className="font-display font-semibold text-sm">{t('chat.title')}</h2>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" asChild>
            <Link to={selectedClientId ? `/messages?client=${selectedClientId}` : '/messages'} onClick={onClose}>
              <Maximize2 className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {showList && (
          <div className={cn(
            'flex flex-col min-h-0 border-r border-border/40',
            isMobile ? 'w-full' : 'w-[260px] shrink-0'
          )}>
            <ChatInboxList
              clients={sortedClients}
              selectedId={selectedClientId}
              onSelect={pickClient}
              lastMessageMap={lastMessageMap}
              unreadByClient={unreadByClient}
              search={search}
              onSearchChange={setSearch}
              compact
              dark
            />
          </div>
        )}

        {showChat && (
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {selectedClient ? (
              <ChatThread
                key={selectedClient.id}
                clientId={selectedClient.id}
                clientAuthUserId={selectedClient.auth_user_id}
                clientName={selectedClient.full_name}
                showSenderLabels
                allowDelete={canDelete}
                onIncomingMessage={refreshInbox}
                adminMode
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                {t('chat.selectClient')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminChatWidget() {
  const { isOpen, closeChat } = useAdminChat();
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  return isMobile ? (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeChat()}>
      <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] p-0 rounded-none border-0">
        <ChatPanelContent onClose={closeChat} />
      </SheetContent>
    </Sheet>
  ) : (
    <>
      <div
        className="fixed inset-0 z-[55] bg-vayase-night/40 backdrop-blur-[2px]"
        onClick={closeChat}
        aria-hidden
      />
      <div className="fixed z-[60] right-4 bottom-4 w-[min(440px,calc(100vw-2rem))] h-[min(640px,calc(100dvh-6rem))] flex flex-col bg-background border border-vayase-accent/20 shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
        <ChatPanelContent onClose={closeChat} />
      </div>
    </>
  );
}
