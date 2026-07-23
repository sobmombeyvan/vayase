import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { AdminChatProvider } from '@/contexts/AdminChatContext';
import { AdminChatWidget } from '@/components/chat/AdminChatWidget';

export function AppLayout() {
  return (
    <AdminChatProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopbar />
          <main className="flex-1 p-6 lg:p-8 overflow-x-hidden animate-fade-in">
            <Outlet />
          </main>
        </div>
        <AdminChatWidget />
      </div>
    </AdminChatProvider>
  );
}
