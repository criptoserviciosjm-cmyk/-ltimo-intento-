/* Simple Service Worker:
   - Cachea el "app shell" para offline
   - Para rates.json usa estrategia Network-first (si hay red, trae lo último)
*/

const CACHE_NAME = 'monitor-tasas-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/rates.json',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET
  if (req.method !== 'GET') return;

  // Network-first para rates.json (con fallback al cache)
  if (url.pathname.endsWith('/rates.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Cache-first para el resto del app shell
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req){
  const cache = await caches.open(CACHE_NAME);
  try{
    const fresh = await fetch(req, { cache: 'no-store' });
    cache.put(req, fresh.clone());
    return fresh;
  }catch{
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error('No network and no cache');
  }
}
