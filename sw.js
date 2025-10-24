// MaranuiCam Service Worker — v6.4.3
const CACHE_NAME = 'maranui-v6_4_3';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=6.4.3',
  './script.js?v=6.4.3'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Clear ALL old caches to avoid stale HTML/CSS/JS
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

// Network-first for navigations (HTML), cache-first for versioned assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

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

  if (req.url.includes('style.css') || req.url.includes('script.js')) {
    event.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
