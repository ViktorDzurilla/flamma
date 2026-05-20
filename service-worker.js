/* ══════════════════════════════════════
   FLAMMA — Service Worker v22.0
   Cache-first stratégia pre offline použitie
══════════════════════════════════════ */

const CACHE_NAME = 'flamma-v22';
const CACHE_URLS = [
  './FLAMMA_prototype.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
];

/* ── INSTALL — predcacheuj statické súbory ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE — vymaž staré cache ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH — cache-first, fallback na sieť ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts — network-first (ak offline, vráť z cache)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Všetko ostatné — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Uložíme do cache iba úspešné odpovede
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — vráť hlavný HTML
          if (event.request.destination === 'document') {
            return caches.match('./FLAMMA_prototype.html');
          }
        });
    })
  );
});

/* ── PUSH NOTIFIKÁCIE ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '🔥 FLAMMA', {
      body: data.body || 'Čas na tvoje návyky!',
      icon: './icon.svg',
      badge: './icon.svg',
      tag: 'flamma-reminder',
      renotify: true,
      data: { url: './FLAMMA_prototype.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('FLAMMA') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./FLAMMA_prototype.html');
      }
    })
  );
});
