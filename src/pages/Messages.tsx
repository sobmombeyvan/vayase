import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageSquare, ChevronLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatInboxList } from '@/components/chat/ChatInboxList';
import { ChatMessage } from '@/hooks/useChatMessages';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface ClientRow {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
}

interface LastMessage {
  client_id: string;
  body: string;
  created_at: string;
  sender_id: string;
}

export default function Messages() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const canDeleteMessages = hasAnyRole(['super_admin', 'admin']);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();
  const selectedId = searchParams.get('client');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const refreshInbox = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-last-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
  }, [queryClient]);

  const selectClient = useCallback((id: string) => {
    setSearchParams({ client: id });
    if (isMobile) setMobileShowChat(true);
  }, [setSearchParams, isMobile]);

  const { data: clients = [], isLoading } = useQuery({
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
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      const seen = new Set<string>();
      return (data as LastMessage[]).filter((m) => {
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
      if (error) {
        if (error.code === '42P01') return {};
        throw error;
      }
      const counts: Record<string, number> = {};
      data?.forEach((m) => {
        counts[m.client_id] = (counts[m.client_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-inbox-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          refreshInbox();
          const msg = payload.new as ChatMessage;
          if (msg.sender_id !== user.id) {
            const client = clients.find((c) => c.id === msg.client_id);
            toast.info(client?.full_name || 'Client', {
              description: msg.body.slice(0, 80),
              action: client
                ? { label: 'Voir', onClick: () => selectClient(client.id) }
                : undefined,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        () => refreshInbox()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, clients, refreshInbox, selectClient]);

  const lastMessageMap = useMemo(() => {
    const map: Record<string, LastMessage> = {};
    lastMessages.forEach((m) => { map[m.client_id] = m; });
    return map;
  }, [lastMessages]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const aUnread = unreadByClient[a.id] || 0;
      const bUnread = unreadByClient[b.id] || 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return (lastMessageMap[b.id]?.created_at || '').localeCompare(lastMessageMap[a.id]?.created_at || '');
    });
  }, [clients, lastMessageMap, unreadByClient]);

  const selectedClient = clients.find((c) => c.id === selectedId);
  const totalUnread = Object.values(unreadByClient).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (isMobile) {
      setMobileShowChat(!!selectedId);
    }
  }, [selectedId, isMobile]);

  useEffect(() => {
    if (!selectedId && sortedClients.length > 0 && !isMobile) {
      setSearchParams({ client: sortedClients[0].id }, { replace: true });
    }
  }, [sortedClients, selectedId, setSearchParams, isMobile]);

  const handleIncoming = useCallback(() => {
    refreshInbox();
  }, [refreshInbox]);

  const goBackToList = () => {
    setMobileShowChat(false);
    setSearchParams({}, { replace: true });
  };

  const showList = !isMobile || !mobileShowChat;
  const showChat = !isMobile || mobileShowChat;

  return (
    <div className={cn(
      'flex flex-col min-h-0',
      isMobile ? 'h-[calc(100dvh-4rem)]' : 'h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-9rem)]'
    )}>
      {/* Desktop / mobile list header */}
      {showList && (
        <div className={cn(
          'shrink-0 flex items-center justify-between gap-3',
          isMobile ? 'px-4 py-3 bg-vayase-night text-white' : 'mb-4'
        )}>
          <div>
            <h1 className={cn(
              'font-display font-bold flex items-center gap-2',
              isMobile ? 'text-lg' : 'text-2xl lg:text-3xl'
            )}>
              {!isMobile && (
                <span className="w-9 h-9 rounded-xl bg-vayase-accent/15 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-vayase-accent" />
                </span>
              )}
              {isMobile && <MessageSquare className="w-5 h-5 text-vayase-accent" />}
              {t('chat.title')}
              {totalUnread > 0 && (
                <Badge className={cn(
                  'text-xs px-2',
                  isMobile ? 'bg-vayase-accent text-vayase-night' : 'bg-vayase-accent text-vayase-night'
                )}>
                  {totalUnread}
                </Badge>
              )}
            </h1>
            {!isMobile && (
              <p className="text-sm text-muted-foreground mt-1 ml-11">{t('chat.subtitle')}</p>
            )}
          </div>
          {!isMobile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-2 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-vayase-accent" />
              {sortedClients.length} clients
            </div>
          )}
        </div>
      )}

      <div className={cn(
        'flex-1 min-h-0 flex overflow-hidden bg-background',
        !isMobile && 'rounded-2xl border border-border/60 shadow-xl'
      )}>
        {showList && (
          <div className={cn(
            'flex flex-col min-h-0',
            isMobile ? 'w-full h-full' : 'w-[min(100%,340px)] shrink-0 border-r border-border/40'
          )}>
            <ChatInboxList
              clients={sortedClients}
              selectedId={selectedId}
              onSelect={selectClient}
              lastMessageMap={lastMessageMap}
              unreadByClient={unreadByClient}
              search={search}
              onSearchChange={setSearch}
              isLoading={isLoading}
              dark
            />
          </div>
        )}

        {showChat && (
          <div className="flex-1 min-w-0 flex flex-col min-h-0 h-full">
            {isMobile && selectedClient && (
              <div className="shrink-0 flex items-center gap-2 px-2 py-2.5 bg-vayase-night text-white safe-top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white hover:bg-white/10 shrink-0"
                  onClick={goBackToList}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedClient.full_name}</p>
                  <p className="text-[11px] text-white/50 truncate">{selectedClient.email || t('chat.liveChat')}</p>
                </div>
              </div>
            )}

            {selectedClient ? (
              <ChatThread
                key={selectedClient.id}
                clientId={selectedClient.id}
                clientAuthUserId={selectedClient.auth_user_id}
                clientName={selectedClient.full_name}
                showSenderLabels
                allowDelete={canDeleteMessages}
                onIncomingMessage={handleIncoming}
                adminMode
              />
            ) : !isMobile ? (
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-secondary/20 to-background">
                <div className="text-center p-8 max-w-sm">
                  <div className="w-20 h-20 rounded-2xl bg-vayase-accent/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-vayase-accent/20">
                    <MessageSquare className="w-10 h-10 text-vayase-accent" />
                  </div>
                  <p className="font-display font-semibold text-foreground">{t('chat.selectClient')}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t('chat.subtitle')}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
