/* Tornei Fragmarathon: traduzione della pagina.
   Due lingue:
   - lingua dell'interfaccia: la sceglie chi usa il programma (in alto, ricordata su questo PC);
   - lingua del torneo: nelle informazioni del torneo; vale per proiettore, diretta, immagini, PDF e bot.
   La pagina resta scritta in italiano: dopo ogni ridisegno un MutationObserver traduce testi e
   attributi (placeholder, title, aria-label, alt) con i dizionari di js/lang/, caricati solo quando servono.
   Le immagini disegnate su canvas (immagini dei tornei, PDF, filigrana) usano la lingua del torneo;
   i nomi scritti dall'utente vanno avvolti con I18N.keep(), così restano come sono. */
(function () {
  "use strict";
  var C = window.I18NCORE; if (!C) return;
  var D = (window.I18N_DICT = window.I18N_DICT || {});
  var KEY = "tornei-v2", LK = "tornei-lang";
  var OUT = /[?&]wall=1/.test(location.search) || /stream\.html$/.test(location.pathname);
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function evFromStore() { try { var p = JSON.parse(lsGet(KEY) || "{}"); return C.pick(p.ev && p.ev.lang) || "it"; } catch (e) { return "it"; } }
  /* app installata: italiano finché non si sceglie un'altra lingua; nel browser, la lingua del browser */
  var ui = C.pick(lsGet(LK)) || (window.desk ? "it" : (navigator.languages || [navigator.language]).map(C.pick).filter(Boolean)[0]) || "it";
  var ev = evFromStore();
  var loading = {}, waiters = [];
  function domLang() { return OUT ? ev : ui; }
  function dict(code) { return code === "it" ? null : D[code] || null; }
  function load(code) {
    if (code === "it" || D[code]) return Promise.resolve();
    if (loading[code]) return loading[code];
    return (loading[code] = new Promise(function (res) {
      var s = document.createElement("script"); s.src = "js/lang/" + code + ".js";
      s.onload = function () { res(); }; s.onerror = function () { res(); };
      document.head.appendChild(s);
    }));
  }

  /* ---------- testi della pagina ---------- */
  var orig = new WeakMap(), last = new WeakMap(), aOrig = new WeakMap();
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 }, ATTRS = ["placeholder", "title", "aria-label", "alt"];
  /* testi scritti da chi usa il programma: titolo, nomi di tornei, giocatori e squadre */
  var USER = ".brand h1,.brand .tag,.ev-t,.ev-sub,.ev-games b,button.rnm,.bt-name,.fn,.tn,.pname,.wn";
  function skipEl(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP[e.tagName] || e.isContentEditable || e.hasAttribute("data-noi18n")) return true;
    }
    return !!(el.closest && el.closest(USER));
  }
  function doText(n, d) {
    var cur = n.nodeValue, o = orig.get(n);
    if (o === undefined || cur !== last.get(n)) { o = cur; orig.set(n, o); }
    var t = d ? C.tr(o, d) : o;
    last.set(n, t);
    if (t !== cur) n.nodeValue = t;
  }
  function doAttrs(el, d) {
    var m = aOrig.get(el); if (!m) { m = {}; aOrig.set(el, m); }
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), rec = m[a];
      if (!rec || cur !== rec.t) rec = m[a] = { o: cur, t: cur };
      var t = d ? C.tr(rec.o, d) : rec.o; rec.t = t;
      if (t !== cur) el.setAttribute(a, t);
    });
  }
  function walk(root, d) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentElement && !skipEl(root.parentElement)) doText(root, d); return; }
    if (root.nodeType !== 1 || skipEl(root)) return;
    doAttrs(root, d);
    var it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { if (n.nodeType === 1) return SKIP[n.tagName] || n.isContentEditable || n.hasAttribute("data-noi18n") || n.matches(USER) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; return NodeFilter.FILTER_ACCEPT; }
    }), n;
    while ((n = it.nextNode())) { if (n.nodeType === 3) { if (/\S/.test(n.nodeValue)) doText(n, d); } else doAttrs(n, d); }
  }
  var titleO = null, titleT = null;
  function doTitle(d) { var cur = document.title; if (titleO === null || cur !== titleT) titleO = cur; titleT = d ? C.tr(titleO, d) : titleO; if (titleT !== cur) document.title = titleT; }
  function all() { var d = dict(domLang()); walk(document.body, d); doTitle(d); document.documentElement.lang = domLang() === "vec" ? "vec" : domLang(); helpLang(); }
  var mo = new MutationObserver(function (recs) {
    var d = dict(domLang());
    if (!d && domLang() !== "it") return;
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.type === "childList") for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j], d);
      else if (r.type === "characterData") { if (r.target.parentElement && !skipEl(r.target.parentElement)) doText(r.target, d); }
      else if (r.type === "attributes" && !skipEl(r.target)) doAttrs(r.target, d);
    }
    doTitle(d);
  });
  function start() { mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); all(); }

  /* ---------- guida: argomenti tradotti per intero ---------- */
  var helpIt = null;
  function helpLang() {
    var H = window.HELP; if (!H || !H.topics) return;
    if (!helpIt) helpIt = JSON.parse(JSON.stringify(H.topics));
    var d = dict(ui), L = d && d.help;
    Object.keys(helpIt).forEach(function (k) { H.topics[k] = L && L[k] ? L[k] : helpIt[k]; });
  }

  /* ---------- immagini e PDF disegnati su canvas: lingua del torneo ---------- */
  /* testo dell'utente (nomi, titoli) tra due U+2060 (word joiner, invisibile): si traduce solo quello fuori,
     e i segni si tolgono. Se fit() taglia il segno di chiusura, il resto della stringa resta com'è. */
  var WJ = "\u2060";
  function keep(s) { return s == null || s === "" ? s : WJ + s + WJ; }
  var P = CanvasRenderingContext2D.prototype;
  ["fillText", "strokeText", "measureText"].forEach(function (f) {
    var o = P[f];
    P[f] = function (t) {
      var d = dict(ev);
      if (typeof t === "string" && (d || t.indexOf(WJ) >= 0)) {
        var a = Array.prototype.slice.call(arguments);
        a[0] = t.indexOf(WJ) < 0 ? C.tr(t, d) : t.split(WJ).map(function (p, i) { return i % 2 ? p : C.tr(p, d); }).join("");
        return o.apply(this, a);
      }
      return o.apply(this, arguments);
    };
  });

  /* ---------- scelta delle lingue ---------- */
  function setUi(code) {
    code = C.pick(code) || "it"; ui = code;
    try { localStorage.setItem(LK, code); } catch (e) {}
    return load(code).then(function () { all(); fire(); });
  }
  function setEv(code) {
    code = C.pick(code) || "it"; if (code === ev) return Promise.resolve();
    ev = code; return load(code).then(function () { if (OUT) all(); fire(); });
  }
  function fire() { waiters.forEach(function (f) { try { f(); } catch (e) {} }); }
  window.addEventListener("storage", function (e) { if (OUT && e.key === KEY) setEv(evFromStore()); });
  window.I18N = {
    LANGS: C.LANGS, ui: function () { return ui; }, ev: function () { return ev; },
    setUi: setUi, setEv: setEv, load: load, refresh: all,
    tr: function (s, code) { return C.tr(s, dict(code || ui)); }, keep: keep,
    onChange: function (f) { waiters.push(f); }
  };
  Promise.all([load(ui), load(ev)]).then(function () {
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  });
})();
