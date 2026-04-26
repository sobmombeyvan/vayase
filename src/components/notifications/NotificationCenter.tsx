import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter(i => !i.read).length;

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

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  };

  const remove = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-vayase-accent text-vayase-night text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h4 className="font-display font-semibold">Notifications</h4>
            <p className="text-xs text-muted-foreground">{unread} non lue{unread > 1 ? 's' : ''}</p>
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
              {items.map(n => (
                <div key={n.id} className={cn('p-3 hover:bg-secondary/50 transition-colors group', !n.read && 'bg-vayase-accent/5')}>
                  <div className="flex items-start gap-3">
                    <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', !n.read ? 'bg-vayase-accent' : 'bg-transparent')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold', typeColors[n.type] || typeColors.info)}>
                          {n.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-foreground p-1">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive p-1">
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
