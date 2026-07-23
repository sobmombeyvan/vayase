import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { MessageSquare, Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatMessage } from '@/hooks/useChatMessages';
import { toast } from 'sonner';

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

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Messages() {
  const { t, i18n } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const canDeleteMessages = hasAnyRole(['super_admin', 'admin']);
  const locale = i18n.language === 'fr' ? fr : enUS;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const selectedId = searchParams.get('client');

  const refreshInbox = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-last-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
  }, [queryClient]);

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
                ? {
                    label: 'Voir',
                    onClick: () => setSearchParams({ client: client.id }),
                  }
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
  }, [user, clients, refreshInbox, setSearchParams]);

  const lastMessageMap = useMemo(() => {
    const map: Record<string, LastMessage> = {};
    lastMessages.forEach((m) => { map[m.client_id] = m; });
    return map;
  }, [lastMessages]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    const list = clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
    return list.sort((a, b) => {
      const aUnread = unreadByClient[a.id] || 0;
      const bUnread = unreadByClient[b.id] || 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const aTime = lastMessageMap[a.id]?.created_at || '';
      const bTime = lastMessageMap[b.id]?.created_at || '';
      return bTime.localeCompare(aTime);
    });
  }, [clients, search, lastMessageMap, unreadByClient]);

  const selectedClient = clients.find((c) => c.id === selectedId);
  const totalUnread = Object.values(unreadByClient).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!selectedId && filteredClients.length > 0) {
      setSearchParams({ client: filteredClients[0].id }, { replace: true });
    }
  }, [filteredClients, selectedId, setSearchParams]);

  const handleIncoming = useCallback(() => {
    refreshInbox();
  }, [refreshInbox]);

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            {t('chat.title')}
            {totalUnread > 0 && (
              <Badge className="bg-vayase-accent text-vayase-night">{totalUnread}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{t('chat.subtitle')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border shadow-md flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] h-full">
          <div className="border-r flex flex-col bg-secondary/10 min-h-0">
            <div className="p-3 border-b bg-card/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('chat.searchClients')}
                  className="pl-9 h-10 rounded-xl bg-background"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-3 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 p-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('chat.noClients')}</p>
                </div>
              ) : (
                <div>
                  {filteredClients.map((client) => {
                    const last = lastMessageMap[client.id];
                    const unread = unreadByClient[client.id] || 0;
                    const active = client.id === selectedId;
                    const lastFromClient = last && client.auth_user_id && last.sender_id === client.auth_user_id;

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setSearchParams({ client: client.id })}
                        className={cn(
                          'w-full text-left px-4 py-3.5 transition-all border-b border-border/40',
                          'hover:bg-secondary/50',
                          active && 'bg-secondary/70 border-l-2 border-l-vayase-accent',
                          unread > 0 && !active && 'bg-vayase-accent/5'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar className="h-11 w-11">
                              <AvatarFallback className="bg-vayase-accent/15 text-vayase-accent font-semibold text-xs">
                                {getInitials(client.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            {unread > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-vayase-accent text-vayase-night text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn('font-medium text-sm truncate', unread > 0 && 'font-semibold')}>
                                {client.full_name}
                              </span>
                              {last && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(last.created_at), { addSuffix: false, locale })}
                                </span>
                              )}
                            </div>
                            {last ? (
                              <p className={cn(
                                'text-xs truncate mt-0.5',
                                unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
                                lastFromClient && unread > 0 && 'text-vayase-accent'
                              )}>
                                {lastFromClient ? '● ' : ''}{last.body}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                                {t('chat.noMessages')}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex flex-col min-h-[400px] lg:min-h-0 bg-background">
            {selectedClient ? (
              <ChatThread
                key={selectedClient.id}
                clientId={selectedClient.id}
                clientAuthUserId={selectedClient.auth_user_id}
                clientName={selectedClient.full_name}
                showSenderLabels
                allowDelete={canDeleteMessages}
                onIncomingMessage={handleIncoming}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground bg-secondary/5">
                <div className="text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-vayase-accent/10 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-10 h-10 text-vayase-accent/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t('chat.selectClient')}</p>
                  <p className="text-xs mt-1">{t('chat.subtitle')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
