const CACHE_NAME = "eartrainer-v439"; // bump this when you change cached files
const FILES_TO_CACHE = [
  "/ear-trainer/",
  "/ear-trainer/index.html",
  "/ear-trainer/app.js",
  "/ear-trainer/icons/icon-192.png",
  "/ear-trainer/icons/icon-512.png"
];

// Install: precache app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// Activate: take control & clean old caches
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

// Fetch: ALWAYS return cached index.html for navigations (covers Firefox/iOS)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const isNavigation =
    req.mode === "navigate" ||
    (req.method === "GET" && req.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      caches.match("/ear-trainer/index.html").then(resp => resp || fetch(req))
    );
    return;
  }

  // Non-HTML: cache-first
  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req))
  );
});
