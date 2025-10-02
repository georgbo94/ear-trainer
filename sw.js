self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("eartrainer-v1").then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/app.js"
      ]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => {
      return resp || fetch(e.request);
    })
  );
});

self.addEventListener("install", () => console.log("SW: installed"));
self.addEventListener("activate", () => console.log("SW: activated"));
self.addEventListener("fetch", e => console.log("SW: fetching", e.request.url));

