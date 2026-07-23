import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ChatInboxClient {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
}

export interface ChatInboxLastMessage {
  client_id: string;
  body: string;
  created_at: string;
  sender_id: string;
}

interface ChatInboxListProps {
  clients: ChatInboxClient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lastMessageMap: Record<string, ChatInboxLastMessage>;
  unreadByClient: Record<string, number>;
  search: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  dark?: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function ChatInboxList({
  clients,
  selectedId,
  onSelect,
  lastMessageMap,
  unreadByClient,
  search,
  onSearchChange,
  isLoading,
  compact,
  dark,
}: ChatInboxListProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;

  const filtered = clients
    .filter((c) => {
      const q = search.toLowerCase();
      return c.full_name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const au = unreadByClient[a.id] || 0;
      const bu = unreadByClient[b.id] || 0;
      if (au !== bu) return bu - au;
      return (lastMessageMap[b.id]?.created_at || '').localeCompare(lastMessageMap[a.id]?.created_at || '');
    });

  return (
    <div className={cn('flex flex-col min-h-0 h-full', dark ? 'bg-vayase-night' : 'bg-secondary/10')}>
      <div className={cn('p-3 border-b shrink-0', dark ? 'border-white/10' : 'border-border bg-card/50')}>
        <div className="relative">
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
            dark ? 'text-white/40' : 'text-muted-foreground'
          )} />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('chat.searchClients')}
            className={cn(
              'pl-9 rounded-xl',
              compact ? 'h-9 text-sm' : 'h-10',
              dark && 'bg-white/10 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-vayase-accent'
            )}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 p-2">
                <Skeleton className={cn('rounded-full', compact ? 'h-9 w-9' : 'h-11 w-11')} />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={cn('p-8 text-center', dark ? 'text-white/50' : 'text-muted-foreground')}>
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('chat.noClients')}</p>
          </div>
        ) : (
          <div className={compact ? 'p-1' : ''}>
            {filtered.map((client) => {
              const last = lastMessageMap[client.id];
              const unread = unreadByClient[client.id] || 0;
              const active = client.id === selectedId;
              const lastFromClient = last && client.auth_user_id && last.sender_id === client.auth_user_id;

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelect(client.id)}
                  className={cn(
                    'w-full text-left transition-all',
                    compact ? 'flex items-center gap-2.5 p-2.5 rounded-xl mb-0.5 mx-1' : 'px-4 py-3.5 border-b border-border/30',
                    dark
                      ? cn(
                          active && 'bg-white/10',
                          !active && 'hover:bg-white/5',
                          unread > 0 && !active && 'bg-vayase-accent/10'
                        )
                      : cn(
                          'hover:bg-secondary/50',
                          active && 'bg-secondary/70 border-l-2 border-l-vayase-accent',
                          unread > 0 && !active && 'bg-vayase-accent/5'
                        )
                  )}
                >
                  <div className={cn('flex items-center gap-3', compact && 'w-full')}>
                    <div className="relative shrink-0">
                      <Avatar className={compact ? 'h-9 w-9' : 'h-11 w-11'}>
                        <AvatarFallback className={cn(
                          'font-semibold text-xs',
                          dark ? 'bg-vayase-accent/25 text-vayase-accent' : 'bg-vayase-accent/15 text-vayase-accent'
                        )}>
                          {getInitials(client.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-vayase-accent text-vayase-night text-[10px] font-bold flex items-center justify-center ring-2 ring-vayase-night">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'font-medium truncate',
                          compact ? 'text-sm' : 'text-sm',
                          unread > 0 && 'font-semibold',
                          dark ? 'text-white' : 'text-foreground'
                        )}>
                          {client.full_name}
                        </span>
                        {last && (
                          <span className={cn(
                            'text-[10px] shrink-0',
                            dark ? 'text-white/40' : 'text-muted-foreground'
                          )}>
                            {formatDistanceToNow(new Date(last.created_at), { addSuffix: false, locale })}
                          </span>
                        )}
                      </div>
                      {last ? (
                        <p className={cn(
                          'text-xs truncate mt-0.5',
                          unread > 0
                            ? dark ? 'text-white/90 font-medium' : 'text-foreground font-medium'
                            : dark ? 'text-white/50' : 'text-muted-foreground',
                          lastFromClient && unread > 0 && 'text-vayase-accent'
                        )}>
                          {lastFromClient ? '● ' : ''}{last.body}
                        </p>
                      ) : (
                        <p className={cn('text-xs italic mt-0.5', dark ? 'text-white/30' : 'text-muted-foreground/50')}>
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
  );
}
