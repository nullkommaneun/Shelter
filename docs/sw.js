const CACHE = "shelter-v6-core";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./preflight.js",
  "./main.js",
  "./config.js",
  "./engine.js",
  "./systems.js",
  "./state.js",
  "./rng.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});