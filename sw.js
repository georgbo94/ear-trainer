// sw.js — for https://georgbo94.github.io/ear-trainer/
const CACHE_NAME = 'eartrainer-vwewe10';

const FILES_TO_CACHE = [
  '/ear-trainer/',
  '/ear-trainer/index.html',
  '/ear-trainer/manifest.json',
  '/ear-trainer/app.js',
  '/ear-trainer/icons/icon-192.png',
  '/ear-trainer/icons/icon-512.png'
];

// --- INSTALL: precache ---
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of FILES_TO_CACHE) {
      try {
        // cache: 'reload' avoids stale HTTP cache during install
        await cache.add(new Request(url, { cache: 'reload' }));
        // console.log('SW cached:', url);
      } catch (err) {
        console.warn('SW: failed to cache', url, err);
      }
    }
  })());
  self.skipWaiting();
});

// --- ACTIVATE: cleanup old versions ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- FETCH: network first for navigations; fallback to cached app shell ---
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        // Online path
        return await fetch(req);
      } catch (e) {
        // OFFLINE FALLBACKS — try multiple keys that may exist in cache
        let res =
          await caches.match('/ear-trainer/') ||
          await caches.match('/ear-trainer/index.html') ||
          await caches.match(new URL('./', self.registration.scope).href) ||
          await caches.match(new URL('./index.html', self.registration.scope).href);

        if (res) return res;

        // Last resort: return a tiny offline page so Firefox/iOS don't show their own
        return new Response(
          '<!doctype html><meta charset="utf-8"><t
