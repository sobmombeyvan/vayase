import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { AdminChatProvider } from '@/contexts/AdminChatContext';
import { AdminChatWidget } from '@/components/chat/AdminChatWidget';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { pathname } = useLocation();
  const isMessagesPage = pathname.startsWith('/messages');

  return (
    <AdminChatProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <AppTopbar />
          <main
            className={cn(
              'flex-1 min-h-0 overflow-x-hidden animate-fade-in',
              isMessagesPage ? 'p-0 lg:p-8 overflow-hidden' : 'p-4 md:p-6 lg:p-8'
            )}
          >
            <Outlet />
          </main>
        </div>
        <AdminChatWidget />
      </div>
    </AdminChatProvider>
  );
}
