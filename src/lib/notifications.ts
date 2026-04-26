import { supabase } from '@/integrations/supabase/client';

type NotifType = 'info' | 'success' | 'warning' | 'error' | 'client' | 'payment' | 'document' | 'appointment';

export async function notify(userId: string, title: string, message: string, type: NotifType = 'info', link?: string) {
  return supabase.from('notifications').insert({
    user_id: userId, title, message, type, link,
  });
}

export async function logActivity(action: string, entityType?: string, entityId?: string, details?: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  return supabase.from('activity_log').insert({
    user_id: user.id, action, entity_type: entityType, entity_id: entityId, details,
  });
}
