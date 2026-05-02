import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, UserPlus, ListChecks, Wallet,
  Calendar, FileText, BarChart3, ChevronLeft, ChevronRight, Shield, BookOpen, CheckSquare, DatabaseBackup,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/branding/BrandLogo';

export function AppSidebar({ onNavigate, isMobile }: { onNavigate?: () => void, isMobile?: boolean }) {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const canFinance = hasAnyRole(['super_admin', 'admin', 'comptable']);
  const isAdmin = hasAnyRole(['super_admin', 'admin']);

  const items = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), exact: true },
    { to: '/leads', icon: UserPlus, label: t('nav.leads') },
    { to: '/clients', icon: Users, label: t('nav.clients') },
    { to: '/procedures', icon: ListChecks, label: t('nav.procedures') },
    { to: '/tasks', icon: CheckSquare, label: t('nav.tasks') },
    ...(canFinance ? [{ to: '/finance', icon: Wallet, label: t('nav.finance') }] : []),
  ];

  const secondary = [
    { to: '/calendar', icon: Calendar, label: t('nav.calendar') },
    { to: '/documents', icon: FileText, label: t('nav.documents') },
    { to: '/reports', icon: BarChart3, label: t('nav.reports') },
    { to: '/guide', icon: BookOpen, label: t('nav.guide') },
    ...(isAdmin ? [{ to: '/employees', icon: Shield, label: t('nav.employees') }] : []),
    ...(isAdmin ? [{ to: '/admin-ops', icon: DatabaseBackup, label: t('nav.adminOps') }] : []),
  ];

  const sidebarContent = (
    <aside className={cn(
      'flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-out',
      !isMobile && (collapsed ? 'w-[72px]' : 'w-[260px]'),
      isMobile && 'w-full h-full border-r-0',
      'shrink-0 h-screen sticky top-0 z-30',
      !isMobile && 'hidden lg:flex'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center h-16 border-b border-sidebar-border px-4', (collapsed && !isMobile) && 'justify-center px-0')}>
        <BrandLogo
          size="sm"
          showText={isMobile || !collapsed}
          textClassName="text-white"
          subtitleClassName="text-white/40"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-6">
        <div className="space-y-1">
          {(isMobile || !collapsed) && <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Principal</div>}
          {items.map(item => {
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  'hover:bg-sidebar-accent hover:text-white',
                  isActive && 'bg-sidebar-accent text-white shadow-sm',
                  (collapsed && !isMobile) && 'justify-center px-2'
                )}
              >
                <item.icon className={cn('w-[18px] h-[18px] shrink-0', isActive && 'text-vayase-accent')} />
                {(isMobile || !collapsed) && <span className="truncate">{item.label}</span>}
                {(isMobile || !collapsed) && isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-vayase-accent" />}
              </NavLink>
            );
          })}
        </div>

        <div className="space-y-1">
          {(isMobile || !collapsed) && <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Outils</div>}
          {secondary.map(item => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  'hover:bg-sidebar-accent hover:text-white',
                  isActive ? 'bg-sidebar-accent text-white shadow-sm' : 'text-white/60',
                  (collapsed && !isMobile) && 'justify-center px-2'
                )}
              >
                <item.icon className={cn('w-[18px] h-[18px] shrink-0', isActive && 'text-vayase-accent')} />
                {(isMobile || !collapsed) && <span className="truncate">{item.label}</span>}
                {(isMobile || !collapsed) && isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-vayase-accent" />}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Collapse toggle */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className={cn(
            'flex items-center gap-2 mx-3 mb-4 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-sidebar-accent transition-colors',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Réduire</span></>}
        </button>
      )}
    </aside>
  );

  return sidebarContent;
}
