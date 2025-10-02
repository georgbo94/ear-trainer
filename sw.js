const CACHE_NAME = "eartrainer-final-v2";
const FILES_TO_CACHE = [
  "/ear-trainer/index.html",
  "/ear-trainer/app.js",
  "/ear-trainer/icons/icon-192.png",
  "/ear-trainer/icons/icon-512.png"
];

// Install: cache files
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// Activate: clean old caches
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

// Fetch: serve cached index.html for navigations, cache-first for others
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.mode === "navigate" ||
      (req.method === "GET" && req.headers.get("accept")?.includes("text/html"))) {
    event.respondWith(
      caches.match("/ear-trainer/index.html").then(resp => resp || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req))
  );
});
