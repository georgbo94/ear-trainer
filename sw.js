// sw.js for https://georgbo94.github.io/ear-trainer/
var CACHE_NAME = 'eartrainer-vsddddddddddd11';

var FILES_TO_CACHE = [
  '/ear-trainer/',
  '/ear-trainer/index.html',
  '/ear-trainer/manifest.json',
  '/ear-trainer/app.js',
  '/ear-trainer/icons/icon-192.png',
  '/ear-trainer/icons/icon-512.png'
];

// INSTALL: precache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(FILES_TO_CACHE.map(function (url) {
        return cache.add(url).catch(function (err) {
          // Keep going even if one file fails
          console.warn('SW: failed to cache', url, err);
        });
      }));
    })
  );
  self.skipWaiting();
});

// ACTIVATE: remove old caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// FETCH: network for navigations, fallback to cached app shell when offline.
// Cache-first for other GETs.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var isNav = (req.mode === 'navigate') || (req.destination === 'document');

  if (isNav) {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match('/ear-trainer/') ||
               caches.match('/ear-trainer/index.html') ||
               new Response(
                 '<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1>',
                 { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
               );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req);
    })
  );
});
