import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Search, X, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminChat } from '@/contexts/AdminChatContext';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ChatThread } from '@/components/chat/ChatThread';
import { useIsMobile } from '@/hooks/use-mobile';

interface ClientRow {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function ChatPanelContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const { selectedClientId, setSelectedClientId } = useAdminChat();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
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

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter((c) => c.full_name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .sort((a, b) => {
        const au = unreadByClient[a.id] || 0;
        const bu = unreadByClient[b.id] || 0;
        if (au !== bu) return bu - au;
        return (lastMessageMap[b.id]?.created_at || '').localeCompare(lastMessageMap[a.id]?.created_at || '');
      });
  }, [clients, search, lastMessageMap, unreadByClient]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (!selectedClientId && filteredClients.length > 0) {
      setSelectedClientId(filteredClients[0].id);
    }
  }, [filteredClients, selectedClientId, setSelectedClientId]);

  const refreshInbox = () => {
    queryClient.invalidateQueries({ queryKey: ['chat-last-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-unread-counts'] });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-vayase-night text-white">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-vayase-accent" />
          <h2 className="font-display font-semibold text-sm">{t('chat.title')}</h2>
        </div>
        <div className="flex items-center gap-1">
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

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="md:w-[280px] border-b md:border-b-0 md:border-r flex flex-col shrink-0 max-h-[40%] md:max-h-none">
          <div className="p-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('chat.searchClients')}
                className="pl-8 h-9 text-sm rounded-lg"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {filteredClients.map((client) => {
                const last = lastMessageMap[client.id];
                const unread = unreadByClient[client.id] || 0;
                const active = client.id === selectedClientId;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={cn(
                      'w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl transition-colors mb-0.5',
                      active ? 'bg-secondary' : 'hover:bg-secondary/60',
                      unread > 0 && !active && 'bg-vayase-accent/5'
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-[10px] bg-vayase-accent/15 text-vayase-accent font-semibold">
                        {getInitials(client.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn('text-sm truncate', unread > 0 && 'font-semibold')}>
                          {client.full_name}
                        </span>
                        {unread > 0 && (
                          <Badge className="h-4 min-w-4 px-1 text-[9px] bg-vayase-accent text-vayase-night shrink-0">
                            {unread}
                          </Badge>
                        )}
                      </div>
                      {last && (
                        <p className="text-[10px] text-muted-foreground truncate">{last.body}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          {selectedClient ? (
            <ChatThread
              key={selectedClient.id}
              clientId={selectedClient.id}
              clientAuthUserId={selectedClient.auth_user_id}
              clientName={selectedClient.full_name}
              showSenderLabels
              allowDelete={canDelete}
              onIncomingMessage={refreshInbox}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
              {t('chat.selectClient')}
            </div>
          )}
        </div>
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
      <SheetContent side="bottom" className="h-[92dvh] p-0 rounded-t-2xl border-t border-vayase-accent/20">
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
      <div className="fixed z-[60] right-4 bottom-4 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100dvh-6rem))] flex flex-col bg-background border border-vayase-accent/20 shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
        <ChatPanelContent onClose={closeChat} />
      </div>
    </>
  );
}
