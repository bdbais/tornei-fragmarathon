/* Service worker della PWA: tutto in cache per funzionare offline alla LAN party.
   Strategia: rete prima (così gli aggiornamenti arrivano subito), cache se offline.
   Cambia VERSION a ogni rilascio: la cache vecchia viene eliminata. */
const VERSION = "tornei-3.4.2";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./js/formats.js", "./js/help.js", "./js/ai.js", "./js/app.js", "./js/pwa.js", "./css/ui.css", "./css/themes.css",
  "./icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
