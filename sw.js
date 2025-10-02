self.addEventListener("install", (e) => {
  console.log("SW: install event");
  e.waitUntil(
    caches.open("eartrainer-v2").then((cache) => {
      return cache.addAll([
        "/ear-trainer/",
        "/ear-trainer/index.html",
        "/ear-trainer/app.js"
      ]);
    }).then(() => console.log("SW: cached files"))
      .catch(err => console.error("SW: cache.addAll failed", err))
  );
});

self.addEventListener("activate", () => {
  console.log("SW: activated");
});

self.addEventListener("fetch", (e) => {
  console.log("SW: fetching", e.request.url);
  e.respondWith(
    caches.match(e.request).then((resp) => {
      return resp || fetch(e.request);
    })
  );
});
