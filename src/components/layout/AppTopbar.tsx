import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Globe, Moon, Sun, LogOut, User as UserIcon, Menu, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AppSidebar } from './AppSidebar';
import { useAdminChat } from '@/contexts/AdminChatContext';

export function AppTopbar() {
  const { t, i18n } = useTranslation();
  const { user, roles, signOut } = useAuth();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vayase-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('vayase-theme', next ? 'dark' : 'light');
  };

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');

  const { openChat, unreadTotal } = useAdminChat();
  const initials = (user?.email ?? 'U')[0].toUpperCase();

  const primaryRole = roles[0];

  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur-xl sticky top-0 z-40 flex items-center px-4 md:px-6 gap-4">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px] bg-sidebar border-r-0">
            <AppSidebar onNavigate={() => setMobileOpen(false)} isMobile />
          </SheetContent>
        </Sheet>
        <BrandLogo size="sm" showText={false} />
      </div>

      <BrandLogo
        size="sm"
        className="hidden lg:flex"
        textClassName="text-foreground"
        subtitleClassName="text-muted-foreground"
      />
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('common.search')} className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-card" />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Globe className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase">{i18n.language}</span>
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => openChat()}
          className="relative text-muted-foreground hover:text-vayase-accent"
          title={t('nav.messages')}
        >
          <MessageSquare className="w-4 h-4" />
          {unreadTotal > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-vayase-accent text-vayase-night text-[9px] font-bold flex items-center justify-center">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </Button>

        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-lg hover:bg-secondary transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-gradient-accent text-vayase-night font-semibold text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-foreground leading-tight max-w-[140px] truncate">
                  {user?.email}
                </div>
                {primaryRole && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 mt-0.5 h-4 font-medium uppercase tracking-wider">
                    {t(`roles.${primaryRole}`)}
                  </Badge>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-display">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem><UserIcon className="w-4 h-4 mr-2" />{t('nav.settings')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />{t('auth.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
