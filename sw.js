/* Service worker della PWA: tutto in cache per funzionare offline alla LAN party.
   Strategia: rete prima (così gli aggiornamenti arrivano subito), cache se offline o se la rete
   non risponde entro 3 secondi (LAN senza uscita verso internet o uplink saturo).
   Cambia VERSION a ogni rilascio: la cache vecchia viene eliminata.
   "./index.html" non sta in cache: sul sito risponde con un redirect a "./", e una risposta
   rediretta non si può usare per aprire la pagina (offline l'app non partirebbe). */
const VERSION = "tornei-3.10.0";
const FILES = [
  "./", "./manifest.webmanifest",
  "./js/formats.js", "./js/help.js", "./js/ai.js", "./js/i18n-core.js", "./js/i18n.js", "./js/lang/en.js", "./js/lang/es.js", "./js/lang/fr.js", "./js/lang/de.js", "./js/lang/ro.js", "./js/lang/ru.js", "./js/lang/zh.js", "./js/lang/ja.js", "./js/lang/vec.js", "./js/cronaca.js", "./js/ladder.js", "./js/app.js", "./js/sala.js", "./js/vendor/three.js", "./js/vendor/qrcode.js", "./js/tokens.js", "./js/changelog.js", "./js/crypt.js", "./js/sheets.js", "./js/home.js", "./js/sections.js", "./js/music.js", "./css/home.css", "./css/mobile.css", "./js/pwa.js", "./css/ui.css", "./css/themes.css",
  "./icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"
];
const WAIT = 3000;

self.addEventListener("install", (e) => {
  /* toglie anche la vecchia copia rediretta di index.html, se la cache ha ancora lo stesso nome */
  e.waitUntil(caches.open(VERSION).then((c) => c.delete("./index.html").then(() => c.addAll(FILES))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* copia in cache, scartando le risposte redirette (non si possono usare per aprire una pagina) */
function cached(req) { return caches.match(req, { ignoreSearch: true }).then((r) => (r && !r.redirected ? r : null)); }

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  let save = null;
  const net = fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); save = caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(net.then(() => save).catch(() => {})); // la cache si aggiorna anche se ha risposto prima la copia locale
  const late = new Promise((ok) => setTimeout(ok, WAIT)).then(() => cached(req)).then((r) => r || net);
  e.respondWith(Promise.race([net, late]).catch(() => cached(req).then((r) => r || caches.match("./"))));
});
