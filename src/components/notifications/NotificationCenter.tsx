import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminChat, parseClientIdFromChatLink } from '@/contexts/AdminChatContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, CheckCheck, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

const typeColors: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-500',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  error: 'bg-red-500/10 text-red-500',
  client: 'bg-purple-500/10 text-purple-500',
  payment: 'bg-vayase-accent/10 text-vayase-accent',
  document: 'bg-pink-500/10 text-pink-500',
  appointment: 'bg-indigo-500/10 text-indigo-500',
};

export function NotificationCenter() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const { openChat } = useAdminChat();
  const isAdminStaff = user && !hasRole('client');
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter((i) => !i.read).length;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setItems(data || []);
  };

  const handleNotificationOpen = (n: Notification) => {
    const clientId = parseClientIdFromChatLink(n.link);
    if (isAdminStaff && clientId && n.type === 'client') {
      openChat(clientId);
      return;
    }
    if (n.link) navigate(n.link);
  };

  useEffect(() => {
    load();
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => {
            if (prev.some((i) => i.id === n.id)) return prev;
            return [n, ...prev];
          });

          toast(n.title, {
            description: n.message || undefined,
            duration: 8000,
            icon: <MessageSquare className="w-4 h-4 text-vayase-accent" />,
            action: {
              label: 'Ouvrir',
              onClick: () => handleNotificationOpen(n),
            },
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate, isAdminStaff, openChat]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    if (!user) return;
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    handleNotificationOpen(n);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-vayase-accent text-vayase-night text-[9px] font-bold flex items-center justify-center animate-pulse">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 shadow-lg">
        <div className="flex items-center justify-between p-4 border-b bg-card/50">
          <div>
            <h4 className="font-display font-semibold">Notifications</h4>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
              <CheckCheck className="w-3.5 h-3.5 mr-1" />Tout lire
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {items.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Aucune notification
            </div>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleClick(n)}
                  onKeyDown={(e) => e.key === 'Enter' && handleClick(n)}
                  className={cn(
                    'p-3 hover:bg-secondary/50 transition-colors group cursor-pointer',
                    !n.read && 'bg-vayase-accent/5'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      typeColors[n.type] || typeColors.info
                    )}>
                      {n.type === 'client' ? (
                        <MessageSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-vayase-accent shrink-0" />}
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-vayase-accent mt-1 font-medium">Cliquer pour ouvrir →</p>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!n.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
