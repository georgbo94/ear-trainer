const CACHE_NAME = 'eartrainer-v1000000';

// List only files that actually exist in your deployed site
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './app.js',
  './style.css',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: cache all the important files
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of FILES_TO_CACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('SW: Failed to cache', url, err);
        }
      }
    })()
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for non-navigation, fallback to cache;
// For navigations (HTML pages), fallback to cached index.html
self.addEventListener('fetch', event => {
  const req = event.request;

  // Handle navigation requests (page loads, links)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For other GET requests, try cache first, then network
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(response => {
          // Optionally: cache new requests dynamically
          return response;
        })
      )
    );
  }
});
