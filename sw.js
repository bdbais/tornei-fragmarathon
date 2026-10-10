/* Service worker della PWA: tutto in cache per funzionare offline alla LAN party.
   Strategia: rete prima (così gli aggiornamenti arrivano subito), cache se offline.
   Cambia VERSION a ogni rilascio: la cache vecchia viene eliminata. */
const VERSION = "tornei-3.7.0";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./js/formats.js", "./js/help.js", "./js/ai.js", "./js/i18n-core.js", "./js/i18n.js", "./js/lang/en.js", "./js/lang/es.js", "./js/lang/fr.js", "./js/lang/de.js", "./js/lang/ro.js", "./js/lang/ru.js", "./js/lang/zh.js", "./js/lang/ja.js", "./js/lang/vec.js", "./js/app.js", "./js/sala.js", "./js/vendor/three.js", "./js/vendor/qrcode.js", "./js/tokens.js", "./js/changelog.js", "./js/crypt.js", "./js/sheets.js", "./js/home.js", "./js/sections.js", "./js/music.js", "./css/home.css", "./css/mobile.css", "./js/pwa.js", "./css/ui.css", "./css/themes.css",
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
