const CACHE_NAME = "eartrainer-debug";
const FILES_TO_CACHE = [
  "/ear-trainer/",
  "/ear-trainer/index.html",
  "/ear-trainer/app.js"
];

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

self.addEventListener("activate", () => {
  console.log("SW: activated");
});

self.addEventListener("fetch", (event) => {
  console.log("SW: fetching", event.request.url);
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
