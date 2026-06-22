// HomeHub Service Worker
// Cache-Strategie: Cache-First mit Netzwerk-Fallback

const CACHE_VERSION = 'hh-v4';  // ← erhöht: löscht alten Cache automatisch
const CACHE_NAME = `homehub-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './dragon-game.js',   // ← neu
  './dragon-game.css',  // ← neu
];

// Installation: Assets vorab cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(
        ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }))
      ).catch(err => {
        console.warn('[HomeHub SW] Einige Assets konnten nicht gecacht werden:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Aktivierung: alle alten Caches (vertragshub-* und homehub-*) entfernen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            (key.startsWith('vertragshub-') || key.startsWith('homehub-')) &&
            key !== CACHE_NAME
          )
          .map(key => {
            console.log('[HomeHub SW] Alter Cache entfernt:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First, dann Netzwerk
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline-Fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
