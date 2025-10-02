// /ear-trainer/sw.js
const CACHE_NAME = "eartrainer-final-v1";
const FILES_TO_CACHE = [
  "/ear-trainer/index.html",
  "/ear-trainer/app.js",
  "/ear-trainer/icons/icon-192.png",
  "/ear-trainer/icons/icon-512.png"
  // add other real files here if present
];

// Install: cache files (log per-file), require index.html to succeed
self.addEventListener("install", (event) => {
  console.log("SW: install event fired");
  self.skipWaiting(); // activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("SW: opened cache");
      // attempt to cache each file and collect success/failure
      const results = await Promise.all(FILES_TO_CACHE.map(async (url) => {
        try {
          await cache.add(url);
          console.log("SW: cached", url);
          return { url, ok: true };
        } catch (err) {
          console.error("SW: failed to cache", url, err);
          return { url, ok: false, err };
        }
      }));
      // ensure index.html is cached (required for navigation offline)
      const indexEntry = results.find(r => r.url.endsWith("/index.html"));
      if (!indexEntry || !indexEntry.ok) {
        throw new Error("SW: critical file index.html failed to cache; aborting install");
      }
      console.log("SW: all cache attempts finished");
    })
  );
});

// Activate: claim clients and remove old caches
self.addEventListener("activate", (event) => {
  console.log("SW: activated");
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
    ])
  );
});

// Fetch: navigation requests -> return cached index.html; other requests -> cache-first
self.addEventListener("fetch", (event) => {
  // handle navigations by returning the cached app shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("/ear-trainer/index.html").then(resp => {
        if (resp) return resp;
        // if not in cache, try network, otherwise fall back to cached index if possible
        return fetch(event.request).catch(() => caches.match("/ear-trainer/index.html"));
      })
    );
    return;
  }

  // For other requests: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
