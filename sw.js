const CACHE_NAME = "eartrainer-v6";
const FILES_TO_CACHE = [
  "/ear-trainer/index.html",
  "/ear-trainer/app.js",
  "/ear-trainer/icons/icon-192.png",
  "/ear-trainer/icons/icon-512.png"
  // add more if they really exist
];

// Install: try to cache each file individually
self.addEventListener("install", (event) => {
  console.log("SW: install event fired");
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("SW: opened cache");
        return Promise.all(
          FILES_TO_CACHE.map(url =>
            cache.add(url)
              .then(() => console.log("SW: cached", url))
              .catch(err => console.error("SW: failed to cache", url, err))
          )
        );
      })
      .then(() => console.log("SW: all cache attempts finished"))
  );
});

// Activate: claim control + clear old caches
self.addEventListener("activate", (event) => {
  console.log("SW: activated");
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )
      )
    ])
  );
});

// Fetch: serve from cache first, then network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      if (resp) {
        console.log("SW: serving from cache", event.request.url);
        return resp;
      }
      return fetch(event.request);
    })
  );
});
