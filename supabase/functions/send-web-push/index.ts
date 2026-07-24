import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret',
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    const incomingSecret = req.headers.get('x-push-secret');

    if (!webhookSecret || incomingSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@vayase.com';

    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload: PushPayload = await req.json();
    if (!payload.user_id || !payload.title) {
      return new Response(JSON.stringify({ error: 'Missing user_id or title' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', payload.user_id);

    if (error) throw error;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pushBody = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/client/messages',
      tag: payload.tag || 'vayase-chat',
    });

    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth_key },
            },
            pushBody,
            { TTL: 86400 }
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            stale.push(sub.id);
          }
          console.error('Push failed:', sub.endpoint, err);
        }
      })
    );

    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('id', stale);
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
