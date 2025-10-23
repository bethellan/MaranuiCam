// Simple service worker: cache the app shell for offline launch.
const CACHE = 'maranui-shell-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/logos/maranui-script.png',
  './assets/logos/maranui-cap.png',
  './assets/logos/maranui-wings.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const { request } = e;
  const url = new URL(request.url);
  // Network for YouTube; cache-first for our own assets
  if(url.origin === location.origin){
    e.respondWith(caches.match(request).then(res=>res || fetch(request)));
  }else{
    e.respondWith(fetch(request).catch(()=>new Response('You need an internet connection to view the live stream.', {status: 503, headers:{'Content-Type':'text/plain'}})));
  }
});
