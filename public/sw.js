/* OBedTech IGDownloader — Service Worker v5 */
const CACHE = 'obedtech-ig-v5';
const STATIC = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Pre-cache app shell on install — makes repeat visits instant
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())  // take control of all open tabs right away
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Network-only for API calls (always need live data)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'You are offline. Connect to internet to fetch media.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Stale-while-revalidate: return cache instantly, update in background
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => null);

      return cached || networkFetch || caches.match('/index.html');
    })
  );
});
