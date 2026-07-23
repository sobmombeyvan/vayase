import { useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { LayoutDashboard, MessageSquare, LogOut } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationEnableBanner } from '@/components/notifications/NotificationEnableBanner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { playMessageAlert } from '@/lib/notification-sound';
import {
  registerServiceWorker,
  showAppNotification,
  clearAppBadge,
} from '@/lib/push-notifications';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { to: '/client/dashboard', icon: LayoutDashboard, label: 'Dossier' },
  { to: '/client/messages', icon: MessageSquare, label: 'Messages' },
];

export function ClientLayout() {
  const { user, hasRole, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMessages = location.pathname.startsWith('/client/messages');
  const lastSeenMsgRef = useRef<string | null>(null);

  const { data: clientInfo } = useQuery({
    queryKey: ['client-info', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ['client-unread-messages', user?.id],
    queryFn: async () => {
      if (!clientInfo) return 0;
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientInfo.id)
        .neq('sender_id', user!.id)
        .is('read_at', null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id && !!clientInfo,
    refetchInterval: 15000,
  });

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (isMessages) clearAppBadge();
  }, [isMessages]);

  const alertNewMessage = (body: string, msgId?: string) => {
    if (msgId && lastSeenMsgRef.current === msgId) return;
    if (msgId) lastSeenMsgRef.current = msgId;

    playMessageAlert();
    queryClient.invalidateQueries({ queryKey: ['client-unread-messages'] });

    const hidden = document.visibilityState === 'hidden';
    if (hidden || !isMessages) {
      showAppNotification('Message de votre conseiller', body, '/client/messages');
    }

    if (!hidden) {
      toast('Message de votre conseiller', {
        description: body.slice(0, 80),
        duration: 8000,
        action: {
          label: 'Ouvrir',
          onClick: () => navigate('/client/messages'),
        },
      });
    }
  };

  useEffect(() => {
    if (!user || !clientInfo) return;

    const channel = supabase
      .channel(`client-chat-alerts-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { id: string; sender_id: string; body: string; client_id: string };
          if (msg.sender_id === user.id || msg.client_id !== clientInfo.id) return;
          alertNewMessage(msg.body, msg.id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, clientInfo, isMessages, navigate, queryClient]);

  useEffect(() => {
    if (!user || !clientInfo) return;

    const poll = async () => {
      if (document.visibilityState === 'visible') return;

      const { data } = await supabase
        .from('chat_messages')
        .select('id, body, sender_id')
        .eq('client_id', clientInfo.id)
        .neq('sender_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const latest = data?.[0];
      if (latest && latest.id !== lastSeenMsgRef.current) {
        alertNewMessage(latest.body, latest.id);
      }
    };

    const interval = setInterval(poll, 20000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [user, clientInfo, isMessages, navigate, queryClient]);

  if (loading) {
    return (
      <div className="client-app h-[100dvh] flex items-center justify-center bg-vayase-night">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-vayase-accent border-t-transparent animate-spin" />
          <p className="text-sm text-white/50">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/client/login" replace />;
  if (!hasRole('client')) return <Navigate to="/" replace />;

  const handleSignOut = async () => {
    await signOut();
    navigate('/client/login');
  };

  const initials = user.email?.[0]?.toUpperCase() || 'C';

  return (
    <div className={cn(
      'client-app h-[100dvh] flex flex-col overflow-hidden',
      isMessages ? 'bg-secondary/30' : 'bg-background'
    )}>
      <header className={cn(
        'shrink-0 z-50 border-b bg-card/95 backdrop-blur-lg safe-top',
        isMessages && 'hidden lg:block'
      )}>
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto lg:max-w-7xl">
          <BrandLogo size="sm" showText={false} className="lg:hidden" />
          <BrandLogo size="sm" className="hidden lg:flex" />
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center p-1 rounded-full hover:bg-secondary transition-colors">
                  <Avatar className="h-8 w-8 ring-2 ring-vayase-accent/20">
                    <AvatarFallback className="bg-vayase-accent/15 text-vayase-accent text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b">
                  <p className="text-xs text-muted-foreground">Connecté en tant que</p>
                  <p className="text-sm font-medium truncate">{user.email}</p>
                </div>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav className="hidden lg:block border-t bg-background/60">
          <div className="max-w-7xl mx-auto px-6 flex gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    active ? 'border-vayase-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      {!isMessages && (
        <div className="shrink-0 pt-3 max-w-lg mx-auto w-full lg:max-w-7xl">
          <NotificationEnableBanner />
        </div>
      )}

      <main
        className={cn(
          'flex-1 min-h-0 w-full',
          isMessages
            ? 'flex flex-col overflow-hidden max-w-none'
            : 'overflow-y-auto overscroll-contain px-4 pt-2 client-main-pad pb-4 max-w-lg mx-auto lg:max-w-7xl lg:px-6 lg:py-8'
        )}
      >
        <Outlet context={{ unreadMessages }} />
      </main>

      {!isMessages && (
        <nav className="lg:hidden shrink-0 z-50 border-t bg-card/95 backdrop-blur-xl safe-bottom client-bottom-nav">
          <div className="flex items-stretch max-w-lg mx-auto">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              const isMsg = item.to.includes('messages');
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] touch-manipulation',
                    active ? 'text-vayase-accent' : 'text-muted-foreground'
                  )}
                >
                  <div className="relative">
                    <item.icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
                    {isMsg && unreadMessages > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-vayase-accent text-vayase-night text-[9px] font-bold flex items-center justify-center">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
