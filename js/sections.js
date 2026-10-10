/* Tornei Fragmarathon: sezioni comprimibili e ricerca delle sezioni.
   - Ogni pannello con un titolo (h2) si comprime cliccando il titolo o la freccia; lo stesso per le
     sezioni delle Impostazioni (h3). Lo stato resta ricordato su questo PC.
   - Ctrl+K (o il pulsante Cerca) apre la ricerca: schede, sezioni, impostazioni, guida, comandi.
   Lavora solo sul DOM: le pagine si ridisegnano spesso, quindi un MutationObserver rimette
   frecce e stato dopo ogni ridisegno. */
(function () {
  "use strict";
  if (/[?&]wall=1/.test(location.search) || /stream\.html$/.test(location.pathname)) return;
  var CK = "tornei-collapse", C = {};
  try { C = JSON.parse(localStorage.getItem(CK) || "{}") || {}; } catch (e) {}
  function saveC() { try { localStorage.setItem(CK, JSON.stringify(C)); } catch (e) {} }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
  function headText(h) {
    var t = ""; h.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.textContent; else if (n.nodeType === 1 && !/^(BUTTON|IMG|SVG|INPUT|SELECT)$/i.test(n.tagName) && !n.classList.contains("colbtn")) t += n.textContent; });
    return t.replace(/\s+/g, " ").trim();
  }
  var ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l5 5-5 5"/></svg>';

  /* le sezioni delle Impostazioni: h3 e quello che segue, fino al prossimo h3 */
  function sectionize(box) {
    if (!box) return;
    var kids = Array.prototype.slice.call(box.children), cur = null;
    if (!kids.some(function (k) { return k.tagName === "H3"; })) return;
    kids.forEach(function (k) {
      if (k.tagName === "H3") { cur = document.createElement("div"); cur.className = "sect"; box.insertBefore(cur, k); }
      if (cur) cur.appendChild(k);
    });
  }
  function keyOf(box, h) { return (box.id ? "#" + box.id + ":" : "") + norm(headText(h)).replace(/\d+/g, "#").slice(0, 60); }
  function arm(box, h, key) {
    if (!key) return;
    var b = h.querySelector(":scope > .colbtn");
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "colbtn"; b.innerHTML = ARROW; h.insertBefore(b, h.firstChild); h.classList.add("colh"); }
    var col = !!C[key];
    if (box.dataset.ckey !== key) box.dataset.ckey = key;
    if (box.classList.contains("collapsed") !== col) box.classList.toggle("collapsed", col);
    var lab = (col ? "Espandi " : "Comprimi ") + headText(h);
    if (b.getAttribute("aria-expanded") !== String(!col)) b.setAttribute("aria-expanded", String(!col));
    if (b.getAttribute("aria-label") !== lab) { b.setAttribute("aria-label", lab); b.title = col ? "Espandi" : "Comprimi"; }
    /* la parte che resta visibile quando è chiusa */
    var head = h; while (head.parentElement && head.parentElement !== box) head = head.parentElement;
    if (head.parentElement === box && !head.classList.contains("phead")) head.classList.add("phead");
  }
  function process() {
    sectionize(document.getElementById("editform"));
    document.querySelectorAll("main .panel").forEach(function (p) {
      if (p.id === "editbox" || p.id === "addgame") return;
      var h = p.querySelector("h2"); if (!h || h.closest(".panel") !== p) return;
      arm(p, h, p.id && p.id !== "out" && p.id !== "setup" ? "#" + p.id : keyOf(p, h));
    });
    document.querySelectorAll("#editform > .sect").forEach(function (s) { var h = s.querySelector(":scope > h3"); if (h) arm(s, h, "imp:" + norm(headText(h))); });
  }
  var pend = 0;
  new MutationObserver(function () { if (!pend) pend = requestAnimationFrame(function () { pend = 0; process(); }); })
    .observe(document.body, { childList: true, subtree: true });
  process();

  function setCol(box, col) { var k = box.dataset.ckey; if (!k) return; if (col) C[k] = 1; else delete C[k]; saveC(); process(); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".colbtn"), h = b ? b.parentElement : e.target.closest(".colh");
    if (!h) return;
    if (!b && e.target.closest("button,a,input,select,textarea,label")) return;
    var box = h.closest(".panel.collapsed,.sect.collapsed,[data-ckey]"); if (!box) return;
    setCol(box, !box.classList.contains("collapsed"));
  });

  /* ---------- ricerca ---------- */
  var dlg = null, items = [], sel = 0;
  function visible(el) { return !!el && !el.closest("[hidden]"); }
  function openSettings(then) {
    var eb = document.getElementById("editbox");
    if (eb && eb.hidden) { var bt = document.getElementById("editbtn"); if (bt) bt.click(); }
    setTimeout(then, 250);
  }
  function reveal(el) {
    var box = el.closest("[data-ckey]"); if (box && box.classList.contains("collapsed")) setCol(box, false);
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.add("flash"); setTimeout(function () { el.classList.remove("flash"); }, 1600);
  }
  var SETTINGS = ["Titolo e nomi dei giochi", "Logo dell'evento", "Genera un logo con l'AI", "CSS personalizzato", "Bot Telegram", "Diretta su YouTube e Twitch"];
  function collect() {
    var out = [], seen = {};
    function add(o) { var k = o.g + "|" + norm(o.t); if (seen[k]) return; seen[k] = 1; out.push(o); }
    document.querySelectorAll("#tabs0 .tab, #tabs .tab").forEach(function (b) {
      var t = (b.textContent || b.getAttribute("aria-label") || "").trim(); if (!t || b.id === "undodel") return;
      if (b.id === "plus") t = "Aggiungi un gioco";
      add({ t: t, g: b.dataset.k && !/^(roster|squadre|results|hof)$/.test(b.dataset.k) ? "Gioco" : "Scheda", run: function () { b.click(); } });
    });
    document.querySelectorAll("main .panel h2, #editform > .sect > h3").forEach(function (h) {
      var t = headText(h); if (!t) return;
      var inSet = !!h.closest("#editbox");
      if (!inSet && !visible(h)) return;
      add({ t: t, g: inSet ? "Impostazioni" : "Sezione", run: function () { if (inSet) openSettings(function () { reveal(h); }); else reveal(h); } });
    });
    SETTINGS.forEach(function (t) {
      add({ t: t, g: "Impostazioni", run: function () { openSettings(function () {
        var hs = Array.prototype.slice.call(document.querySelectorAll("#editform h3")), h = hs.filter(function (x) { return norm(headText(x)).indexOf(norm(t).slice(0, 8)) === 0; })[0];
        if (h) reveal(h); else { var f = document.getElementById("editform"); if (f) reveal(f); }
      }); } });
    });
    if (window.HOME) add({ t: "Elenco dei tornei", g: "Comando", run: function () { window.HOME.open(); } }), add({ t: "Bot Telegram: elenco dei bot", g: "Comando", run: function () { window.HOME.open("bots"); } });
    if (window.VERSION) add({ t: "Novità e versione " + window.VERSION.v, g: "Comando", run: window.VERSION.open });
    add({ t: "Comprimi tutte le sezioni", g: "Comando", run: function () { document.querySelectorAll("[data-ckey]").forEach(function (b) { C[b.dataset.ckey] = 1; }); saveC(); process(); } });
    add({ t: "Espandi tutte le sezioni", g: "Comando", run: function () { document.querySelectorAll("[data-ckey]").forEach(function (b) { delete C[b.dataset.ckey]; }); saveC(); process(); } });
    if (window.HELP) window.HELP.order.forEach(function (k) {
      var tp = window.HELP.topics[k]; if (tp) add({ t: tp.t, g: "Guida", run: function () { var hb = document.getElementById("helpbtn"); if (window.openHelp) window.openHelp(k); else if (hb) hb.click(); } });
    });
    return out;
  }
  function score(it, q) {
    if (!q) return 1;
    var t = norm(it.t + " " + it.g), ws = q.split(" "), s = 0;
    for (var i = 0; i < ws.length; i++) { var p = t.indexOf(ws[i]); if (p < 0) return 0; s += p === 0 ? 3 : (t.charAt(p - 1) === " " ? 2 : 1); }
    return s + (norm(it.t).indexOf(q) === 0 ? 5 : 0);
  }
  function paint() {
    var q = norm(dlg.querySelector("input").value), L = dlg.querySelector(".sx-list"), all = collect();
    items = all.map(function (it) { return { it: it, s: score(it, q) }; }).filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 40).map(function (x) { return x.it; });
    sel = Math.min(sel, Math.max(0, items.length - 1));
    L.innerHTML = items.length ? items.map(function (it, i) {
      return '<li role="option" id="sx-' + i + '" aria-selected="' + (i === sel) + '" data-i="' + i + '"><span>' + it.t.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }) + '</span><small>' + it.g + '</small></li>';
    }).join("") : '<li class="sx-none">Nessuna sezione con queste parole.</li>';
    dlg.querySelector("input").setAttribute("aria-activedescendant", items.length ? "sx-" + sel : "");
    var on = L.querySelector('[aria-selected="true"]'); if (on) on.scrollIntoView({ block: "nearest" });
  }
  function run(i) { var it = items[i]; if (!it) return; dlg.close(); setTimeout(it.run, 30); }
  function openSearch() {
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "secsearch"; dlg.setAttribute("aria-label", "Cerca una sezione");
      dlg.innerHTML = '<div class="sx-box"><input type="search" placeholder="Cerca una sezione, un gioco, un\'impostazione…" aria-label="Cerca una sezione" role="combobox" aria-controls="sx-list" aria-expanded="true" autocomplete="off"><ul class="sx-list" id="sx-list" role="listbox"></ul><p class="sx-help">Frecce per scegliere, Invio per aprire, Esc per chiudere. Scorciatoia: Ctrl+K</p></div>';
      var inp = dlg.querySelector("input");
      inp.addEventListener("input", function () { sel = 0; paint(); });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
        else if (e.key === "Enter") { e.preventDefault(); run(sel); }
      });
      dlg.querySelector(".sx-list").addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li) run(+li.getAttribute("data-i")); });
      dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    if (window.HOME && window.HOME.isOpen()) window.HOME.close();
    var inp2 = dlg.querySelector("input"); inp2.value = ""; sel = 0; paint(); dlg.showModal(); inp2.focus();
  }
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
  });
  function apptools() { var t = document.getElementById("apptools"), br = document.querySelector(".brand"); if (!t && br) { t = document.createElement("div"); t.id = "apptools"; br.parentNode.insertBefore(t, br); } return t; }
  var brand = apptools();
  if (brand) {
    var b = document.createElement("button");
    b.type = "button"; b.id = "secbtn"; b.title = "Cerca una sezione (Ctrl+K)";
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg><span>Cerca</span><kbd>Ctrl K</kbd>';
    b.addEventListener("click", openSearch);
    brand.appendChild(b);
  }
  /* Impostazioni: ingranaggio nella barra in alto */
  var eb = document.getElementById("editbtn");
  if (brand && eb) {
    var row = eb.parentElement;
    eb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span class="vh">Impostazioni</span>';
    eb.title = "Impostazioni"; eb.setAttribute("aria-label", "Impostazioni");
    brand.appendChild(eb);
    if (row && !row.children.length) row.hidden = true;
  }
  window.SECTIONS = { search: openSearch, refresh: process };
})();
