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
