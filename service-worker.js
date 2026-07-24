/* ══════════════════════════════════════════════════════════════════════════
   HomeHub Service Worker

   Strategie
   ─────────
   • Network-First für Navigation und statische App-Dateien
     → online immer die neueste Version, Cache nur als Offline-Rückfall
   • Kritische App-Shell (Seite + Manifest) muss beim Installieren gelingen,
     sonst wird der neue Worker NICHT aktiviert (der alte bleibt in Betrieb)
   • Optionale Dateien (Ei-Spiel, Icons) dürfen fehlen — nur Warnung
   • Getrennte Caches: App-Shell und Laufzeitdaten
   • Keine Nutzerdaten, keine Cloud-Sync-Antworten im Cache
   • Alle Pfade relativ zum Scope → funktioniert auch im GitHub-Pages-Unterordner

   Versionen
   ─────────
   APP_VERSION muss mit den Query-Parametern in index.html übereinstimmen
   (dragon-game.js?v=…, dragon-game.css?v=…).
   ══════════════════════════════════════════════════════════════════════════ */

const APP_VERSION        = '22';
const APP_CACHE_NAME     = `homehub-app-v${APP_VERSION}`;
const RUNTIME_CACHE_NAME = `homehub-runtime-v${APP_VERSION}`;

const NET_TIMEOUT     = 4000;    // ms — lahmes Handynetz nicht ewig blockieren
const INSTALL_TIMEOUT = 15000;   // ms — Installation darf nicht endlos hängen
const RUNTIME_MAX = 40;     // max. Einträge im Laufzeit-Cache

/* ── Pfade immer aus dem Scope ableiten (Unterordner-sicher) ───────────── */
function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

const CRITICAL_PATHS = ['./', './index.html', './manifest.json'];
const OPTIONAL_PATHS = [
  `./dragon-game.js?v=${APP_VERSION}`,
  `./dragon-game.css?v=${APP_VERSION}`,
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

/* Dateiendungen, die als statische App-Ressourcen gelten */
const STATIC_EXT = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2'];

/* Endpunkte des Cloud-Sync — dürfen NIE in den Cache */
const PRIVATE_SEGMENTS = ['/load', '/save', '/snapshot', '/snapshots'];

/* Für Protokolle: Query entfernen, damit keine Tokens in der Konsole landen */
function safeUrl(u) {
  try { const x = new URL(u); return x.origin + x.pathname; } catch (e) { return String(u).split('?')[0]; }
}

/* ══════════════════ Installation ══════════════════ */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    console.info('[HomeHub SW] Installation gestartet (v' + APP_VERSION + ')');
    const cache = await caches.open(APP_CACHE_NAME);

    // 1) Kritische App-Shell — schlägt eine Datei fehl, scheitert die Installation
    for (const path of CRITICAL_PATHS) {
      const url = scopeUrl(path);
      let res;
      try {
        res = await fetchWithTimeout(new Request(url, { cache: 'reload' }), INSTALL_TIMEOUT);
      } catch (err) {
        throw new Error('Kritische Datei nicht erreichbar: ' + path + ' (' + (err && err.message) + ')');
      }
      if (!isCacheableResponse(url, res)) {
        throw new Error('Kritische Datei ungültig: ' + path + ' (Status ' + (res && res.status) + ')');
      }
      await cache.put(url, res.clone());
    }
    console.info('[HomeHub SW] Kritische App-Shell gespeichert');

    // 2) Optionale Dateien — einzeln, Fehler werden nur gemeldet
    const results = await Promise.allSettled(OPTIONAL_PATHS.map(async path => {
      const url = scopeUrl(path);
      const res = await fetchWithTimeout(new Request(url, { cache: 'reload' }), INSTALL_TIMEOUT);
      if (!isCacheableResponse(url, res)) throw new Error('Status ' + res.status);
      await cache.put(url, res.clone());
    }));
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[HomeHub SW] Optionale Ressource fehlt:', OPTIONAL_PATHS[i], r.reason && r.reason.message);
      }
    });

    // 3) Erst jetzt übernehmen — die App-Shell ist vollständig
    await self.skipWaiting();
    console.info('[HomeHub SW] Installation abgeschlossen');
  })());
});

/* ══════════════════ Aktivierung ══════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [APP_CACHE_NAME, RUNTIME_CACHE_NAME];
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(k => (k.startsWith('homehub-') || k.startsWith('vertragshub-')) && keep.indexOf(k) === -1)
        .map(async k => {
          await caches.delete(k);
          console.info('[HomeHub SW] Alter Cache entfernt:', k);
        }));
    } catch (err) {
      console.warn('[HomeHub SW] Cache-Bereinigung fehlgeschlagen:', err && err.message);
    }
    await self.clients.claim();
    console.info('[HomeHub SW] Aktiv (v' + APP_VERSION + ')');
    // Bewusst KEIN client.navigate() und keine Reload-Nachricht:
    // den kontrollierten Reload übernimmt der controllerchange-Schutz in index.html.
  })());
});

/* ══════════════════ Hilfsfunktionen ══════════════════ */

/* Echter Abbruch nach Zeitablauf statt weiterlaufendem Hintergrund-Fetch */
async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* Nur gültige, typgerechte Antworten dürfen in den Cache */
function isCacheableResponse(url, response) {
  if (!response || !response.ok) return false;
  if (response.type === 'opaque' || response.type === 'error') return false;

  let pathname = '';
  try { pathname = new URL(url).pathname; } catch (e) { pathname = String(url); }
  const ct = (response.headers && response.headers.get('content-type')) || '';

  // Eine HTML-404-Seite von GitHub Pages darf nie als Skript oder Stylesheet gelten
  if (ct.includes('text/html')) {
    // Eine HTML-Antwort ist nur für Seiten gültig, nie für Skript/Style/Bild/Schrift
    const istBinaerOderCode = ['.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2']
      .some(ext => pathname.endsWith(ext));
    if (istBinaerOderCode) return false;
  }
  return true;
}

/* Cloud-Sync, Backups und Anfragen mit Zugangsdaten bleiben unangetastet */
function isPrivateRequest(request, url) {
  try {
    if (request.headers && (request.headers.get('authorization') || request.headers.get('x-sync-token'))) return true;
  } catch (e) { /* Header nicht lesbar → weiter prüfen */ }
  const p = url.pathname;
  if (PRIVATE_SEGMENTS.some(seg => p === seg || p.endsWith(seg))) return true;
  if (url.search && /(^|[?&])(token|app)=/i.test(url.search)) return true;
  return false;
}

function isStaticAsset(url) {
  const p = url.pathname;
  if (p.endsWith('/manifest.json')) return true;
  return STATIC_EXT.some(ext => p.endsWith(ext));
}

/* Laufzeit-Cache klein halten */
async function trimCache(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    for (const k of keys.slice(0, keys.length - max)) await cache.delete(k);
  } catch (e) { /* nicht kritisch */ }
}

async function cacheLookup(request) {
  const inApp = await caches.match(request, { cacheName: APP_CACHE_NAME });
  if (inApp) return inApp;
  return caches.match(request, { cacheName: RUNTIME_CACHE_NAME });
}

function offlineDocument() {
  return new Response(
    '<!doctype html><html lang="de"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>HomeHub offline</title>' +
    '<body style="font-family:system-ui,sans-serif;padding:24px;background:#F7F6F3;color:#1a1a2e">' +
    '<h1>HomeHub ist offline</h1>' +
    '<p>Die App-Dateien konnten nicht geladen werden. Stelle kurz eine Internetverbindung her und öffne die App erneut.</p>' +
    '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* Menge der vorab gecachten URLs */
let PRECACHED_URLS = new Set();
function precachedUrls() {
  if (PRECACHED_URLS.size === 0) {
    try { PRECACHED_URLS = new Set(CRITICAL_PATHS.concat(OPTIONAL_PATHS).map(scopeUrl)); } catch (e) {}
  }
  return PRECACHED_URLS;
}

/* ══════════════════ Abrufstrategien ══════════════════ */

/* Seitenaufrufe: Netzwerk zuerst, dann Cache, zuletzt Offline-Seite */
async function handleNavigate(request) {
  const indexUrl = scopeUrl('./index.html');
  try {
    const res = await fetchWithTimeout(request, NET_TIMEOUT);
    if (isCacheableResponse(indexUrl, res)) {
      const copy = res.clone();
      caches.open(APP_CACHE_NAME).then(c => c.put(indexUrl, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    if (err && err.name === 'AbortError') console.warn('[HomeHub SW] Netzwerk-Timeout:', safeUrl(request.url));
    const cached = (await cacheLookup(request)) || (await caches.match(indexUrl));
    if (cached) return cached;
    console.warn('[HomeHub SW] Keine gecachte Seite vorhanden — Offline-Hinweis');
    return offlineDocument();
  }
}

/* Statische Dateien: Netzwerk zuerst, gültige Antwort cachen, sonst Cache */
async function handleStatic(request, url) {
  const precached = precachedUrls().has(url.href);
  try {
    const res = await fetchWithTimeout(request, NET_TIMEOUT);
    if (isCacheableResponse(url.href, res)) {
      const copy = res.clone();
      const target = precached ? APP_CACHE_NAME : RUNTIME_CACHE_NAME;
      caches.open(target)
        .then(c => c.put(request, copy))
        .then(() => { if (!precached) trimCache(RUNTIME_CACHE_NAME, RUNTIME_MAX); })
        .catch(() => {});
    } else {
      console.warn('[HomeHub SW] Antwort nicht cachefähig:', safeUrl(url.href), res && res.status);
    }
    return res;
  } catch (err) {
    if (err && err.name === 'AbortError') console.warn('[HomeHub SW] Netzwerk-Timeout:', safeUrl(url.href));
    const cached = await cacheLookup(request);
    if (cached) return cached;
    // Kein HTML-Ersatz für Skripte/Stylesheets — lieber ein sauberer Fehlerstatus
    const ct = url.pathname.endsWith('.css') ? 'text/css'
             : url.pathname.endsWith('.js')  ? 'application/javascript'
             : 'text/plain';
    return new Response('', { status: 504, statusText: 'Offline', headers: { 'Content-Type': ct } });
  }
}

/* ══════════════════ Fetch ══════════════════ */
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }

  // Fremde Domains (Cloudflare-Worker, Schriften, externe Importe) unangetastet lassen
  if (url.origin !== self.location.origin) return;

  // Cloud-Sync, Backups, Anfragen mit Zugangsdaten: nie cachen, nie abfangen
  if (isPrivateRequest(request, url)) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(handleNavigate(request).catch(() => offlineDocument()));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      handleStatic(request, url).catch(() =>
        new Response('', { status: 504, statusText: 'Offline' }))
    );
    return;
  }

  // Alles Übrige (dynamische Anfragen) läuft ungefiltert durchs Netz
});
