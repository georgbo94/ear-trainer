const CACHE_NAME = "eartrainer-v3";
const FILES_TO_CACHE = [
  "/ear-trainer/",            // the app entry point
  "/ear-trainer/index.html",  // your main page
  "/ear-trainer/app.js"       // your script
  // add more files if you want, e.g. "/ear-trainer/styles.css"
];

// Install: cache files
self.addEventListener("install", (event) => {
  console.log("SW: install event");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("SW: caching files");
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch(err => console.error("SW: cache.addAll failed:", err))
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
