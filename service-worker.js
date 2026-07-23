// HomeHub Service Worker
// Strategie: Network-First (immer neueste Version von GitHub Pages),
// Cache nur als Offline-Fallback. Das verhindert veraltete oder
// gemischte (index.html neu + dragon-game.js alt) Dateien, die zu
// einem fast leeren Bildschirm führen konnten.

const CACHE_VERSION = 'hh-v19';   // ← erhöht: löscht alten Cache automatisch
const CACHE_NAME = `homehub-${CACHE_VERSION}`;
const NET_TIMEOUT = 4000;        // ms – bei lahmem Handynetz nicht ewig warten

const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './dragon-game.js?v=19',
  './dragon-game.css?v=19',
];

// Installation: Assets für den Offline-Fall vorab cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(
        ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }))
      ).catch(err => {
        console.warn('[HomeHub SW] Einige Assets konnten nicht gecacht werden:', err);
      })
    ).then(() => self.skipWaiting())
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

// Netzwerk-Anfrage mit Timeout (mobiles Netz hängt sonst gern)
function fromNetwork(request, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    fetch(request).then(
      response => { clearTimeout(timer); resolve(response); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

// Fetch: Network-First, dann Cache als Fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fromNetwork(event.request, NET_TIMEOUT).then(response => {
      // Frische, gültige Antwort für den Offline-Fall mitcachen
      if (response && response.status === 200 && response.type !== 'opaque') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() =>
      // Netzwerk weg/zu langsam → letzte bekannte Version aus dem Cache
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
    )
  );
});
