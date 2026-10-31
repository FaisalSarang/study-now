importScripts('reminders.js');

// Bump this when app files change so phones pick up the new version.
const CACHE = 'studynow-v2';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './reminders.js',
  './icons/badge-96.png',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // Only old app-file caches; the reminder data store must survive updates.
      .then(keys => Promise.all(keys.filter(k => k.startsWith('studynow-v') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'deadline-check') event.waitUntil(checkReminders(self.registration, { quietHours: true }));
});

// Tapping a reminder opens the app on that goal.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try {
        await client.navigate(url);
        return client.focus();
      } catch (_) { /* try the next window */ }
    }
    return self.clients.openWindow(url);
  })());
});

// Stale-while-revalidate: open instantly from cache (works offline), refresh in the background.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const key = req.mode === 'navigate' ? './index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      const network = fetch(req)
        .then(res => {
          if (res.ok || res.type === 'opaque') cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
