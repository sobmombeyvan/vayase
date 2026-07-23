import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatThread } from '@/components/chat/ChatThread';

export default function ClientMessages() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: clientInfo, isLoading } = useQuery({
    queryKey: ['client-info', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, auth_user_id')
        .eq('auth_user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[100dvh] bg-secondary/30">
        <Loader2 className="w-8 h-8 animate-spin text-vayase-accent" />
      </div>
    );
  }

  if (!clientInfo) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50dvh] text-[#667781] px-6 text-center">
        <p>{t('chat.clientNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 flex-1">
      <ChatThread
        clientId={clientInfo.id}
        clientAuthUserId={clientInfo.auth_user_id}
        emptyTitle={t('chat.clientEmpty')}
        clientMode
      />
    </div>
  );
}
