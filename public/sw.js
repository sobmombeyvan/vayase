/* VAYASE PWA — background notifications + iOS reconnect */
const DEFAULT_URL = '/client/messages';
const CHECK_MESSAGES = 'check-messages';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      self.registration.periodicSync?.register(CHECK_MESSAGES).catch(() => {}),
    ])
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'VAYASE', body: 'Nouveau message', url: DEFAULT_URL, tag: 'vayase-chat' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data?.text() || payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/vayase-icon.svg',
      badge: '/vayase-icon.svg',
      tag: payload.tag || 'vayase-chat',
      renotify: true,
      data: { url: payload.url || DEFAULT_URL },
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || DEFAULT_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/client') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === CHECK_MESSAGES) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'CHECK_MESSAGES' }));
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === CHECK_MESSAGES) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'CHECK_MESSAGES' }));
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
