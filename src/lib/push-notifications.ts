import { supabase } from '@/integrations/supabase/client';

const SW_PATH = '/sw.js';
const ICON = '/vayase-icon.svg';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function notificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function pushSupported() {
  return notificationSupported() && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;

    if ('periodicSync' in reg) {
      try {
        await (reg as ServiceWorkerRegistration & { periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } })
          .periodicSync.register('check-messages', { minInterval: 15 * 60 * 1000 });
      } catch {
        /* iOS may not support periodicSync */
      }
    }

    if ('sync' in reg) {
      try {
        await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
          .sync.register('check-messages');
      } catch {
        /* optional */
      }
    }

    return reg;
  } catch (err) {
    console.warn('SW registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

async function saveSubscription(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) {
    console.warn('Save push subscription failed:', error.message);
    return false;
  }
  return true;
}

export async function subscribeToWebPush(userId: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
  }

  return saveSubscription(userId, sub);
}

/** Full setup: SW + permission + web push subscription */
export async function setupPushNotifications(userId: string): Promise<{
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}> {
  await registerServiceWorker();
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    return { permission, subscribed: false };
  }

  let subscribed = false;
  if (pushSupported()) {
    subscribed = await subscribeToWebPush(userId);
  }

  return { permission, subscribed };
}

export async function ensurePushSubscription(userId: string) {
  if (Notification.permission !== 'granted' || !pushSupported()) return;
  await registerServiceWorker();
  await subscribeToWebPush(userId);
}

export async function showAppNotification(
  title: string,
  body: string,
  url = '/client/messages',
  tag = 'vayase-chat'
) {
  if (!notificationSupported() || Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body: body.slice(0, 180),
    icon: ICON,
    badge: ICON,
    tag,
    data: { url },
    ...( { renotify: true } as NotificationOptions ),
  };

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, options);
  } catch {
    try {
      new Notification(title, options);
    } catch {
      return false;
    }
  }

  try {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> };
    if (nav.setAppBadge) await nav.setAppBadge(1);
  } catch {
    /* optional */
  }

  return true;
}

export async function clearAppBadge() {
  try {
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    if (nav.clearAppBadge) await nav.clearAppBadge();
  } catch {
    /* ignore */
  }
}

export function listenForServiceWorkerMessages(
  onCheckMessages: () => void,
  onResubscribe: () => void
) {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'CHECK_MESSAGES') onCheckMessages();
    if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') onResubscribe();
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
