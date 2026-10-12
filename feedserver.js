/* Tornei Fragmarathon: feed per MaiTv e per le altre app. Un piccolo server HTTP, spento di base, che serve le notizie
   dei tornei in RSS 2.0 (js/feed.js) e lo storico completo (il file .storico.md e il suo JSON, schema storico@1).
   Senza Electron, così si prova in node. Legge solo i file .storico.md della cartella degli storici, che non hanno
   password, account né server (js/cronaca.js li lascia fuori), e lo storico del torneo aperto che gli passa main.js.

   createFeedServer({ dir, current, tr, log }) -> { start({ port, lan, key }), stop(), status() }
     dir()        cartella degli storici
     current()    { id, md } dell'ultimo storico del torneo aperto, o null: allora vale il file più recente
     tr(s, lang)  frase italiana -> lingua del torneo
     log(dove, errore)
   start -> Promise<{ ok, err, code, port, urls }>: err è una frase italiana intera (si traduce come le altre),
     urls gli indirizzi base (http://ip:porta). stop -> Promise. status -> { on, port, lan, err, code, urls, hits, last }.
   Sicurezza: ascolta su 127.0.0.1, o su tutte le schede di rete solo con lan true; solo GET e HEAD; la chiave (?k=)
   serve su ogni rotta tranne /n/… (il link di una notizia, che non dice niente) ed è confrontata a tempo costante;
   uno storico si cerca fra i file della cartella, mai componendo un percorso con quello che arriva dalla rete. */
"use strict";
const http = require("http");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");
const FEED = require("./js/feed.js");

const MAX_URL = 2048;
const MAX_FILE = 8 * 1024 * 1024;
/* connessioni: in tutto, per indirizzo (un PC della rete non le prende tutte) e da questo PC (browser e MaiTv insieme) */
const MAX_CONN = 64, MAX_PER_IP = 8, MAX_PER_LOCAL = 32;
/* storici: il contenuto dei 100 più usati; l'indice (id, titolo, data) di tutti, per eventi.json e per gli id */
const MAX_CACHE = 100, MAX_META = 5000;
const BLOCK = /```json\s*\n([\s\S]*?)\n```/g;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const PLAIN = "text/plain; charset=utf-8";
/* Frasi visibili (pagina, errori): intere, le estrae tools/i18n-extract.mjs. Chiavi senza virgolette. */
const TXT = {
  busy: "Porta occupata da un altro programma: scegline un'altra.",
  denied: "Windows non permette di usare questa porta: scegline un'altra.",
  badPort: "La porta deve essere un numero da 1024 a 65535.",
  noKey: "Manca la chiave del feed: rigenerala.",
  failed: "Il feed non è partito.",
  forbidden: "Chiave mancante o sbagliata: copia di nuovo il link dalle impostazioni del programma.",
  notFound: "Non trovato.",
  method: "Solo lettura: sono ammesse soltanto le richieste GET e HEAD.",
  tooLong: "Indirizzo troppo lungo.",
  badCat: "Categoria sconosciuta: usa evento, risultati, prossime-partite o tabellone.",
  noHist: "Nessuno storico ancora: nasce quando comincia il primo torneo.",
  error: "Errore interno del feed.",
  news: "Notizia di un torneo: il testo completo è nel feed RSS da cui arriva questo link.",
  title: "Feed per MaiTv e altre app",
  open: "Torneo aperto: {t}",
  none: "Nessun torneo ancora archiviato.",
  all: "RSS di tutte le notizie",
  evento: "RSS dell'evento",
  risultati: "RSS dei risultati",
  prossime: "RSS delle prossime partite",
  tabellone: "RSS del tabellone",
  md: "Storico del torneo aperto (Markdown)",
  json: "Storico del torneo aperto (JSON)",
  events: "Elenco dei tornei archiviati (JSON)",
  note: "Questi link contengono la chiave: chi li ha legge notizie e storici, mai password o account."
};
const CAT_PAGE = { evento: "evento", risultati: "risultati", "prossime-partite": "prossime", tabellone: "tabellone" };

function sha(s) { return crypto.createHash("sha256").update(String(s)).digest(); }
function htmlEsc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
/* il JSON in fondo allo storico: l'ultimo blocco ```json, con lo schema giusto (la stessa regola di MaiTv) */
function parseMd(md) {
  let m, last = null;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(md))) last = m[1];
  if (last == null) return null;
  let data;
  try { data = JSON.parse(last); } catch { return null; }
  return FEED.valid(data) ? { data, json: last.replace(/\s+$/, "") + "\n" } : null;
}
/* id del torneo dal nome del file (<titolo>_<id>.storico.md, come in main.js) */
function fileId(name) { const m = /_([A-Za-z0-9-]{4,})\.storico\.md$/.exec(name); return m ? m[1] : ""; }
/* indirizzi IPv4 delle schede di rete: prima le reti private di casa, poi le altre, in fondo le schede virtuali
   (WSL, Hyper-V, VirtualBox, VMware, Docker: l'altro PC della LAN non le vede); mai 169.254, che è «nessuna rete» */
const VIRTUAL = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|VMnet|docker|Loopback/i;
function lanAddrs() {
  const out = [];
  let ifs = {};
  try { ifs = os.networkInterfaces() || {}; } catch { ifs = {}; }
  Object.keys(ifs).forEach((k) => (ifs[k] || []).forEach((a) => {
    if (a && !a.internal && (a.family === "IPv4" || a.family === 4) && !/^169\.254\./.test(a.address) && !out.some((x) => x.ip === a.address)) out.push({ ip: a.address, v: VIRTUAL.test(k) ? 2 : 0 });
  }));
  const rank = (x) => x.v + (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.ip) ? 0 : 1);
  return out.map((x, i) => ({ ip: x.ip, r: rank(x), i })).sort((x, y) => x.r - y.r || x.i - y.i).map((x) => x.ip);
}

module.exports = function createFeedServer(opts) {
  opts = opts || {};
  const dirOf = typeof opts.dir === "function" ? opts.dir : () => opts.dir;
  const currentOf = typeof opts.current === "function" ? opts.current : () => null;
  const tr0 = typeof opts.tr === "function" ? opts.tr : (s) => s;
  const log = (where, e) => { try { if (typeof opts.log === "function") opts.log(where, e); } catch {} };
  let srv = null, socks = new Set(), cfg = null, chain = Promise.resolve();
  let st = { on: false, port: 0, lan: false, err: "", code: "", urls: [] }, hits = 0, last = 0;
  const cache = new Map(), meta = new Map(), perIp = new Map();
  let curCache = { md: null, p: null };

  function tr(s, lang) {
    let r;
    try { r = tr0(s, lang || "it"); } catch { r = null; }
    return typeof r === "string" && r.trim() ? r : s;
  }

  /* ---------------- Gli storici ---------------- */
  function dir() {
    let d;
    try { d = dirOf(); } catch { d = null; }
    return typeof d === "string" && d ? path.resolve(d) : "";
  }
  /* l'indice di un file: poche righe che restano anche quando il contenuto esce dalla cache */
  function setMeta(file, s, p) {
    const ev = p ? p.data.event || {} : {};
    meta.delete(file);
    meta.set(file, {
      mtimeMs: s.mtimeMs, size: s.size, ok: !!p, eid: p ? String(ev.id || "") : "", title: p ? String(ev.title || "") : "",
      date: p ? String(ev.date || "") : "", generated: p && typeof p.data.generated === "string" ? p.data.generated : ""
    });
    if (meta.size > MAX_META) meta.delete(meta.keys().next().value);
  }
  /* un file della cartella, letto di nuovo solo se cambiano data o dimensione. forIndex: letto solo per l'indice
     (eventi.json, un id da cercare): entra nella cache solo se c'è posto, così non scaccia gli storici in uso */
  function readFile(file, forIndex) {
    let s;
    try { s = fs.statSync(file); } catch { return null; }
    if (!s.isFile()) return null;
    if (s.size > MAX_FILE) { setMeta(file, s, null); return null; }
    const c = cache.get(file);
    if (c && c.mtimeMs === s.mtimeMs && c.size === s.size) { cache.delete(file); cache.set(file, c); return c; }
    let md;
    try { md = fs.readFileSync(file, "utf8"); } catch (e) { log("feed (lettura storico)", e); return null; }
    if (md.charCodeAt(0) === 0xfeff) md = md.slice(1);
    const e = { mtimeMs: s.mtimeMs, size: s.size, md, p: parseMd(md) };
    cache.delete(file);
    if (!forIndex || cache.size < MAX_CACHE) {
      cache.set(file, e);
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    }
    setMeta(file, s, e.p);
    return e;
  }
  /* l'indice di un file della cartella: si legge il file solo se è nuovo o è cambiato */
  function metaOf(f) {
    const m = meta.get(f.file);
    if (m && m.mtimeMs === f.mtimeMs && m.size === f.size) return m;
    readFile(f.file, true);
    return meta.get(f.file) || null;
  }
  /* i .storico.md della cartella, dal più recente */
  function files() {
    const d = dir();
    if (!d) return [];
    let names;
    try { names = fs.readdirSync(d); } catch { return []; }
    const out = names.filter((n) => /\.storico\.md$/.test(n)).map((n) => {
      const file = path.join(d, n);
      if (path.relative(d, file) !== n) return null;
      let s;
      try { s = fs.statSync(file); } catch { return null; }
      return s.isFile() ? { name: n, file, mtimeMs: s.mtimeMs, size: s.size, id: fileId(n) } : null;
    }).filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs || (a.name < b.name ? -1 : 1));
    /* l'indice tiene solo i file che ci sono ancora */
    if (meta.size > out.length) { const have = new Set(out.map((f) => f.file)); meta.forEach((v, k) => { if (!have.has(k)) meta.delete(k); }); }
    return out;
  }
  function newest() {
    for (const f of files()) {
      const m = metaOf(f);
      if (!m || !m.ok) continue;
      const e = readFile(f.file);
      if (e && e.p) return { id: f.id || String(e.p.data.event && e.p.data.event.id || ""), md: e.md, p: e.p, mtimeMs: f.mtimeMs };
    }
    return null;
  }
  /* il torneo aperto (dalla pagina), o il file più recente */
  function current() {
    let c = null;
    try { c = currentOf(); } catch (e) { log("feed (torneo aperto)", e); }
    if (c && typeof c.md === "string" && c.md) {
      if (curCache.md !== c.md) curCache = { md: c.md, p: parseMd(c.md) };
      if (curCache.p) return { id: String(c.id || ""), md: c.md, p: curCache.p, mtimeMs: 0 };
    }
    return newest();
  }
  /* uno storico archiviato per id: prima dal nome del file, poi dall'id dell'evento scritto dentro */
  function byId(id) {
    if (!ID.test(id)) return null;
    const all = files(), end = "_" + id + ".storico.md";
    for (const f of all) if (f.name.endsWith(end)) { const e = readFile(f.file); if (e && e.p) return { id, md: e.md, p: e.p, mtimeMs: f.mtimeMs }; }
    /* poi dall'indice: un id che non c'è non fa rileggere tutta la cartella */
    for (const f of all) {
      const m = metaOf(f);
      if (!m || !m.ok || m.eid !== id) continue;
      const e = readFile(f.file);
      if (e && e.p) return { id, md: e.md, p: e.p, mtimeMs: f.mtimeMs };
    }
    return null;
  }
  function langOf(h) { return h && h.p && typeof h.p.data.lang === "string" ? h.p.data.lang : "it"; }

  /* ---------------- Le risposte ---------------- */
  function send(req, res, code, type, body, extra) {
    const buf = Buffer.from(String(body == null ? "" : body), "utf8");
    const h = Object.assign({
      "Content-Type": type, "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"
    }, extra || {});
    if (code === 200) {
      const tag = '"' + crypto.createHash("sha1").update(buf).digest("base64").replace(/=+$/, "") + '"';
      h.ETag = tag;
      const inm = String(req.headers["if-none-match"] || "");
      if (inm && (inm.trim() === "*" || inm.split(",").some((t) => t.trim().replace(/^W\//, "") === tag))) {
        delete h["Content-Type"];
        res.writeHead(304, h);
        return res.end();
      }
    }
    h["Content-Length"] = buf.length;
    res.writeHead(code, h);
    res.end(req.method === "HEAD" ? undefined : buf);
  }
  /* indirizzo base per i link (quello che ha usato chi chiede), solo se è un nome o un IP con la porta */
  function baseOf(req) {
    const host = String(req.headers.host || "");
    if (/^([A-Za-z0-9.-]{1,253}|\[[0-9A-Fa-f:.]{2,45}\])(:\d{1,5})?$/.test(host)) return "http://" + host;
    return (st.urls && st.urls[0]) || "http://127.0.0.1:" + st.port;
  }
  function keyOk(k) {
    if (!cfg || typeof k !== "string" || !k || k.length > 256) return false;
    return crypto.timingSafeEqual(sha(k), cfg.keyHash);
  }
  function page(req, res, base, lang, cur) {
    const T = (k, v) => { let s = tr(TXT[k], lang); if (v) s = s.replace(/\{([a-z])\}/g, (m, x) => (v[x] == null ? "" : v[x])); return s; };
    const k = "k=" + encodeURIComponent(cfg.key);
    const links = [[T("all"), base + "/feed.rss?" + k]]
      .concat(FEED.CATS.map((c) => [T(CAT_PAGE[c]), base + "/feed.rss?cat=" + c + "&" + k]))
      .concat([[T("md"), base + "/storico.md?" + k], [T("json"), base + "/storico.json?" + k], [T("events"), base + "/eventi.json?" + k]]);
    const t = cur ? String((cur.p.data.event || {}).title || "") : "";
    const html = ["<!doctype html>", '<html lang="' + htmlEsc(lang) + '"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">',
      "<title>" + htmlEsc(T("title")) + "</title>",
      "<style>body{font:16px/1.5 system-ui,sans-serif;margin:0 auto;max-width:46rem;padding:16px;color:#1d2330;background:#f6f7f9}" +
      "a{color:#0b5cad;word-break:break-all}li{margin:.5em 0}p{color:#4a5262}" +
      "@media (prefers-color-scheme:dark){body{color:#e4e7ee;background:#14171d}a{color:#7cb7ff}p{color:#a3abba}}</style>",
      "</head><body>", "<h1>" + htmlEsc(T("title")) + "</h1>",
      "<p>" + htmlEsc(t ? T("open", { t }) : T("none")) + "</p>",
      "<ul>" + links.map((l) => "<li>" + htmlEsc(l[0]) + '<br><a href="' + htmlEsc(l[1]) + '">' + htmlEsc(l[1]) + "</a></li>").join("") + "</ul>",
      "<p>" + htmlEsc(T("note")) + "</p>", "</body></html>", ""].join("\n");
    send(req, res, 200, "text/html; charset=utf-8", html);
  }
  function events(req, res, base) {
    const k = "k=" + encodeURIComponent(cfg.key), seen = new Set(), out = [];
    let curId = "";
    try { const c = currentOf(); curId = c && c.id ? String(c.id) : ""; } catch {}
    /* dall'indice: i file si rileggono solo se sono nuovi o cambiati */
    files().forEach((f) => {
      const m = metaOf(f);
      if (!m || !m.ok) return;
      const id = f.id || (ID.test(m.eid) ? m.eid : "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      const q = encodeURIComponent(id);
      out.push({
        id, title: m.title, date: m.date, updated: m.generated || new Date(f.mtimeMs).toISOString(),
        current: !!curId && id === curId,
        md: base + "/storico/" + q + ".md?" + k, json: base + "/storico/" + q + ".json?" + k, rss: base + "/feed.rss?ev=" + q + "&" + k
      });
    });
    send(req, res, 200, "application/json; charset=utf-8", JSON.stringify(out, null, 1) + "\n");
  }
  function feed(req, res, u, base, lang0, cur) {
    const cat = u.searchParams.get("cat"), ev = u.searchParams.get("ev");
    if (cat != null && FEED.CATS.indexOf(cat) < 0) return send(req, res, 400, PLAIN, tr(TXT.badCat, lang0));
    let h = null;
    if (ev != null) {
      h = byId(ev);
      if (!h) return send(req, res, 404, PLAIN, tr(TXT.notFound, lang0));
    } else h = cur;
    const data = h ? h.p.data : null, lang = langOf(h);
    /* il link del feed stesso, senza la chiave: non finisce mai nel testo che altri possono salvare o mostrare */
    const self = base + "/feed.rss" + (cat || ev ? "?" + [cat ? "cat=" + encodeURIComponent(cat) : "", ev ? "ev=" + encodeURIComponent(ev) : ""].filter(Boolean).join("&") : "");
    const xml = FEED.rss(data, { tr: (s) => tr(s, lang), base, cat: cat || "", self, now: Date.now() });
    send(req, res, 200, "application/rss+xml; charset=utf-8", xml);
  }
  function route(req, res) {
    const raw = String(req.url || "/");
    if (raw.length > MAX_URL) return send(req, res, 414, PLAIN, TXT.tooLong);
    if (req.method !== "GET" && req.method !== "HEAD") return send(req, res, 405, PLAIN, TXT.method, { Allow: "GET, HEAD" });
    let u;
    try { u = new URL(raw.charAt(0) === "/" ? raw : "/" + raw, "http://feed.invalid"); } catch { return send(req, res, 404, PLAIN, TXT.notFound); }
    const p = u.pathname;
    /* il link di una notizia: unico per ogni notizia, senza chiave e senza dati */
    if (p.indexOf("/n/") === 0) return send(req, res, 200, PLAIN, TXT.news + "\n");
    if (!keyOk(u.searchParams.get("k"))) return send(req, res, 403, PLAIN, TXT.forbidden);
    hits++;
    last = Date.now();
    const base = baseOf(req), cur = current(), lang = langOf(cur);
    if (p === "/") return page(req, res, base, lang, cur);
    if (p === "/eventi.json") return events(req, res, base);
    if (p === "/feed.rss") return feed(req, res, u, base, lang, cur);
    let h = null, kind = "";
    if (p === "/storico.md" || p === "/storico.json") {
      h = cur;
      kind = p.slice(9);
      if (!h) return send(req, res, 404, PLAIN, tr(TXT.noHist, lang));
    } else {
      /* /storico/<id>.md|json: l'id si confronta con i nomi dei file, non diventa mai un percorso */
      const m = /^\/storico\/([^/]{1,240})\.(md|json)$/.exec(p);
      if (!m) return send(req, res, 404, PLAIN, tr(TXT.notFound, lang));
      let id;
      try { id = decodeURIComponent(m[1]); } catch { id = ""; }
      h = ID.test(id) ? byId(id) : null;
      if (!h) return send(req, res, 404, PLAIN, tr(TXT.notFound, lang));
      kind = m[2];
    }
    if (kind === "md") return send(req, res, 200, "text/markdown; charset=utf-8", h.md);
    return send(req, res, 200, "application/json; charset=utf-8", h.p.json);
  }
  function handle(req, res) {
    try { route(req, res); }
    catch (e) {
      log("feed (richiesta)", e);
      try { if (!res.headersSent) send(req, res, 500, PLAIN, TXT.error); else res.destroy(); } catch {}
    }
  }

  /* ---------------- Avvio e arresto ---------------- */
  function fail(k, code) {
    st = { on: false, port: 0, lan: false, err: TXT[k], code: code || "", urls: [] };
    return { ok: false, err: TXT[k], code: code || "", port: 0, urls: [] };
  }
  function doStart(o) {
    const port = typeof o.port === "number" ? o.port : NaN, lan = o.lan === true, key = typeof o.key === "string" ? o.key : "";
    if (!Number.isInteger(port) || port < 0 || port > 65535) return Promise.resolve(fail("badPort", "EINVAL"));
    if (key.length < 8) return Promise.resolve(fail("noKey", "ENOKEY"));
    cfg = { key, keyHash: sha(key) };
    /* tempi brevi: un client lento o fermo non tiene occupato il server. Node controlla headersTimeout e
       requestTimeout ogni connectionsCheckingInterval (di base 30 s): lo si porta a 1 s, così valgono davvero */
    const s = http.createServer({ connectionsCheckingInterval: 1000, headersTimeout: 5000, requestTimeout: 10000, keepAliveTimeout: 5000 }, handle);
    s.setTimeout(5000, (c) => c.destroy());
    s.maxHeadersCount = 50;
    s.maxConnections = MAX_CONN;
    /* al massimo MAX_PER_IP connessioni per indirizzo: chi apre connessioni a vuoto (anche senza chiave) non toglie il
       feed agli altri; da questo PC di più, perché browser e MaiTv possono stare sullo stesso PC */
    s.on("connection", (c) => {
      const ip = String(c.remoteAddress || "");
      const lim = /^(127\.|::1$|::ffff:127\.)/.test(ip) ? MAX_PER_LOCAL : MAX_PER_IP, n = (perIp.get(ip) || 0) + 1;
      if (n > lim) { try { c.destroy(); } catch {} return; }
      perIp.set(ip, n);
      socks.add(c);
      c.on("close", () => {
        socks.delete(c);
        const k = (perIp.get(ip) || 1) - 1;
        if (k > 0) perIp.set(ip, k); else perIp.delete(ip);
      });
    });
    s.on("clientError", (e, c) => { try { c.destroy(); } catch {} });
    return new Promise((resolve) => {
      const onErr = (e) => {
        s.removeListener("listening", onOk);
        const code = (e && e.code) || "";
        if (code !== "EADDRINUSE" && code !== "EACCES") log("feed (avvio)", e);
        try { s.close(); } catch {}
        resolve(fail(code === "EADDRINUSE" ? "busy" : code === "EACCES" ? "denied" : "failed", code));
      };
      const onOk = () => {
        s.removeListener("error", onErr);
        s.on("error", (e) => log("feed", e));
        srv = s;
        const p = s.address().port, ips = lan ? lanAddrs() : [];
        const urls = (ips.length ? ips : ["127.0.0.1"]).map((ip) => "http://" + ip + ":" + p);
        st = { on: true, port: p, lan, err: "", code: "", urls };
        resolve({ ok: true, err: "", code: "", port: p, urls: urls.slice() });
      };
      s.once("error", onErr);
      s.once("listening", onOk);
      try { s.listen({ port, host: lan ? "0.0.0.0" : "127.0.0.1" }); } catch (e) { s.removeListener("error", onErr); onErr(e); }
    });
  }
  function doStop() {
    const s = srv;
    srv = null;
    st = { on: false, port: 0, lan: false, err: "", code: "", urls: [] };
    if (!s) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const end = () => { if (!done) { done = true; resolve(); } };
      try { s.close(end); } catch { end(); }
      /* le connessioni tenute aperte (keep-alive) si chiudono subito: la porta si libera adesso */
      try { if (typeof s.closeAllConnections === "function") s.closeAllConnections(); } catch {}
      socks.forEach((c) => { try { c.destroy(); } catch {} });
      socks.clear();
      setTimeout(end, 3000).unref();
    });
  }
  /* uno dopo l'altro: un avvio e un arresto chiesti insieme non si incrociano */
  function queue(fn) {
    const p = chain.then(fn, fn);
    chain = p.then(() => {}, () => {});
    return p;
  }
  return {
    start: (o) => queue(() => doStop().then(() => doStart(o || {}))),
    stop: () => queue(doStop),
    status: () => ({ on: st.on, port: st.port, lan: st.lan, err: st.err, code: st.code, urls: st.urls.slice(), hits, last })
  };
};
module.exports.createFeedServer = module.exports;
module.exports.TXT = TXT;
