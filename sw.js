// MaranuiCam Service Worker — v6.3.2
const CACHE_NAME = 'maranui-v6_3_2';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=6.3.2',
  './script.js?v=6.3.2'
];

self.addEventListener('install', (event) => {
  // Clear all old caches immediately, then pre-cache shell
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first for navigation (HTML), cache-first for versioned assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Always try network for navigations to avoid stale HTML
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }

  // For static assets with version query, prefer cache
  if (req.url.includes('style.css') || req.url.includes('script.js')) {
    event.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  // Default: just fetch
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
