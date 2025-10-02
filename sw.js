const CACHE_NAME = 'eartrainer-vas1';

const FILES_TO_CACHE = [
  '/ear-trainer/',
  '/ear-trainer/index.html',
  '/ear-trainer/manifest.json',
  '/ear-trainer/app.js',
  '/ear-trainer/icons/icon-192.png',
  '/ear-trainer/icons/icon-512.png'
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

// Fetch: serve from network, fallback to cache
self.addEventListener('fetch', event => {
  const req = event.request;

  // Handle page navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch (err) {
          // offline fallback to cached index.html
          return caches.match('/ear-trainer/index.html');
        }
      })()
    );
    return;
  }

  // Handle other GET requests
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
  }
});
