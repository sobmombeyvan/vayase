-- ============================================================
-- VAYASE - Web Push (coller dans Supabase SQL Editor)
-- Projet: ayfvmmqwxcxrpstcqtqh
-- Executer APRES: npx supabase functions deploy send-web-push
-- ============================================================

-- pg_net (requiert pour appeler l edge function)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table abonnements push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Config webhook (remplace ALTER DATABASE qui n est pas autorise sur Supabase cloud)
CREATE TABLE IF NOT EXISTS public.push_webhook_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  functions_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL
);

ALTER TABLE public.push_webhook_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_webhook_config FROM PUBLIC;
REVOKE ALL ON public.push_webhook_config FROM anon;
REVOKE ALL ON public.push_webhook_config FROM authenticated;
GRANT ALL ON public.push_webhook_config TO service_role;

INSERT INTO public.push_webhook_config (id, functions_url, webhook_secret)
VALUES (
  1,
  'https://ayfvmmqwxcxrpstcqtqh.supabase.co/functions/v1',
  'REMPLACEZ_PAR_PUSH_WEBHOOK_SECRET'
)
ON CONFLICT (id) DO UPDATE SET
  functions_url = EXCLUDED.functions_url,
  webhook_secret = EXCLUDED.webhook_secret;

-- Trigger: envoie push quand une notification in-app est creee
CREATE OR REPLACE FUNCTION public.dispatch_web_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url TEXT;
  _secret TEXT;
BEGIN
  SELECT functions_url, webhook_secret
  INTO _url, _secret
  FROM public.push_webhook_config
  WHERE id = 1;

  IF _url IS NULL OR _url = '' OR _secret IS NULL OR _secret = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _url || '/send-web-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', _secret
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.message,
        'url', COALESCE(NEW.link, '/client/messages'),
        'tag', 'vayase-' || NEW.id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_web_push_notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_web_push ON public.notifications;
CREATE TRIGGER on_notification_web_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_web_push_notification();

NOTIFY pgrst, 'reload schema';
