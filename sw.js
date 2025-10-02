const CACHE_NAME = "eartrainer-v500";
const FILES_TO_CACHE = [
  "/ear-trainer/",
  "/ear-trainer/index.html",
  "/ear-trainer/app.js",
  "/ear-trainer/icons/icon-192.png",
  "/ear-trainer/icons/icon-512.png"
];

// Install: cache the app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// Activate: take control and clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
    ])
  );
});

// Fetch: serve index.html for navigations, cache-first for others
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("/ear-trainer/index.html").then(resp => {
        return resp || fetch(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
