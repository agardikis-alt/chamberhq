// Chamber HQ — Service Worker v3
// Strategy:
//   index.html  → network-first (always get latest, fall back to cache if offline)
//   static assets (icons, manifest) → cache-first (never change between updates)

const CACHE_NAME = 'chamberhq-v3';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

// Install: pre-cache static assets only (NOT index.html — that's always network-first)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // activate immediately, don't wait for old tabs to close
});

// Activate: delete ALL old caches so stale content is gone
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
        .then(() => caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
    )
  );
  self.clients.claim(); // take control of all open tabs immediately
});

// Fetch strategy
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/') || !url.pathname.includes('.');

  if (isHTML) {
    // NETWORK-FIRST for HTML: always try to get the latest version
    // Falls back to cache only if completely offline
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) =>
            cache.match(e.request) || cache.match('./index.html')
          )
        )
    );
  } else {
    // CACHE-FIRST for static assets (icons, manifest — these don't change)
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(e.request).then((cached) => {
          if (cached) return cached;
          return fetch(e.request).then((response) => {
            if (response.status === 200) cache.put(e.request, response.clone());
            return response;
          });
        })
      )
    );
  }
});
