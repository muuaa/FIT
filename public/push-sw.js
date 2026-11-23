/* Better Together push notifications (loaded into the service worker). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Better Together', body: event.data ? event.data.text() : '' };
  }
  const scope = self.registration.scope;
  // Android already shows the installed app's icon next to its name, so a big picture would just repeat it.
  const android = /Android/i.test(self.navigator.userAgent);
  const options = {
    body: data.body || '',
    tag: data.tag || 'better-together',
    renotify: true,
    // Status-bar icon: must be white on transparent, or Android draws a white square.
    badge: scope + 'badge-96.png',
    data: { url: data.url || scope },
  };
  if (!android) options.icon = scope + 'pwa-192.png';
  event.waitUntil(self.registration.showNotification(data.title || 'Better Together', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : self.registration.scope, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.registration.scope) && 'focus' in w) {
          w.focus();
          if ('navigate' in w) return w.navigate(target).catch(() => undefined);
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
