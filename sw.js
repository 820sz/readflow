const CACHE = "readflow-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/utils.js",
  "/js/db.js",
  "/js/ai.js",
  "/js/camera.js",
  "/js/app.js",
  "/js/input.js",
  "/js/output.js",
  "/js/profile.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      })
    )
  );
});
