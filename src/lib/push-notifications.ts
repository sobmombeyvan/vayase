const SW_PATH = '/sw.js';
const SW_SCOPE = '/client/';
const ICON = '/vayase-icon.svg';

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

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
    await navigator.serviceWorker.ready;
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
    /* badge optional */
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

export async function subscribeToPush(vapidPublicKey?: string) {
  if (!vapidPublicKey || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
  const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
}
