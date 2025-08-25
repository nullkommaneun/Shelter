// Cache-Version bump: Power-HUD (CSS/JS)
const CACHE = "shelter-v13-powerhud";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./preflight.js",
  "./bootcheck.js",
  "./debug.js",
  "./settings.js",
  "./main.js",
  "./config.js",
  "./engine.js",
  "./systems.js",
  "./state.js",
  "./rng.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});