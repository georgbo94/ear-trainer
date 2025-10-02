const CACHE_NAME = "eartrainer-v4";
const FILES_TO_CACHE = [
  "/ear-trainer/index.html",
  "/ear-trainer/app.js",
  "/ear-trainer/icons/icon-192.png",
  "/ear-trainer/icons/icon-512.png"
  // add any other actual files you use, like CSS or other icons
];

// Install: cache files
self.addEventListener("install", (event) => {
  console.log("SW: install event fired");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("SW: opened cache");
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => console.log("SW: all files cached OK"))
      .catch(err => {
        console.error("SW: cache.addAll failed:", err);
        throw err;
      })
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  console.log("SW: activated");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
});

// Fetch: serve from cache, fallback to network
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
