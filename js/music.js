/* Tornei Fragmarathon: musica sul proiettore.
   La musica suona nella finestra del proiettore (schermo intero); la playlist si gestisce da lì o
   dall'app principale (pulsante ♪ in alto). I brani stanno in IndexedDB ("tornei-musica"), comune
   alle due finestre; i comandi passano da localStorage. Ci sono anche le radio via internet (link).
   Nella copia nascosta del proiettore usata per la diretta non suona nulla. */
(function () {
  "use strict";
  var Q = location.search;
  if (/[?&]stream=1/.test(Q) || /stream\.html$/.test(location.pathname)) return;
  var WALL = /[?&]wall=1/.test(Q), SK = "tornei-music", CK = "tornei-music-cmd", STK = "tornei-music-state", RK = "tornei-music-rev";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function T(s) { return window.I18N ? window.I18N.tr(s) : s; }
  function toast(t) { if (window.__app && window.__app.toast) window.__app.toast(t); }

  /* ---------- archivio dei brani ---------- */
  var dbp = null;
  function db() {
    return dbp || (dbp = new Promise(function (res, rej) {
      var r = indexedDB.open("tornei-musica", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("tracks", { keyPath: "id" }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    }));
  }
  function store(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction("tracks", mode), q = fn(t.objectStore("tracks"));
        t.oncomplete = function () { res(q && "result" in q ? q.result : undefined); }; t.onerror = function () { rej(t.error); };
      });
    });
  }
  function settings() { var s = {}; try { s = JSON.parse(lsGet(SK) || "{}") || {}; } catch (e) {} return Object.assign({ order: [], vol: 0.6, shuffle: false, repeat: true, show: true }, s); }
  function saveSettings(s) { lsSet(SK, JSON.stringify(s)); }
  function bump() { lsSet(RK, String(Date.now())); }
  /* elenco senza i dati audio, nell'ordine scelto */
  function list() {
    return store("readonly", function (s) { return s.getAll(); }).then(function (all) {
      var st = settings(), by = {}; (all || []).forEach(function (t) { by[t.id] = t; });
      var ids = st.order.filter(function (id) { return by[id]; }).concat((all || []).map(function (t) { return t.id; }).filter(function (id) { return st.order.indexOf(id) < 0; }));
      return ids.map(function (id) { return { id: id, name: by[id].name, url: by[id].url || "", size: by[id].blob ? by[id].blob.size : 0 }; });
    });
  }
  function addFiles(files) {
    files = Array.prototype.filter.call(files || [], function (f) { return /^audio\//.test(f.type) || /\.(mp3|ogg|oga|opus|wav|flac|m4a|aac|webm)$/i.test(f.name); });
    if (!files.length) return Promise.resolve(0);
    return store("readwrite", function (s) {
      files.forEach(function (f, i) { s.put({ id: "m" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5), name: f.name.replace(/\.[^.]+$/, ""), blob: f, added: Date.now() }); });
    }).then(function () { bump(); return files.length; });
  }
  function addRadio(url, name) {
    url = String(url || "").trim();
    if (!/^https:\/\/[^\s]+$/i.test(url)) return Promise.reject(new Error(T("Il link della radio deve iniziare con https://")));
    return store("readwrite", function (s) { s.put({ id: "r" + Date.now().toString(36), name: name || url.replace(/^https:\/\//, "").slice(0, 60), url: url, added: Date.now() }); }).then(bump);
  }
  function remove(id) { return store("readwrite", function (s) { s.delete(id); }).then(bump); }
  function move(id, d) {
    return list().then(function (L) {
      var ids = L.map(function (t) { return t.id; }), i = ids.indexOf(id), j = i + d;
      if (i < 0 || j < 0 || j >= ids.length) return;
      ids.splice(j, 0, ids.splice(i, 1)[0]); var st = settings(); st.order = ids; saveSettings(st); bump();
    });
  }

  /* ---------- comandi: nel proiettore si eseguono, nell'app principale si mandano ---------- */
  function cmd(c, v) { if (WALL) exec(c, v); else lsSet(CK, JSON.stringify({ c: c, v: v, t: Date.now() + Math.random() })); }

  /* ---------- lettore (solo proiettore) ---------- */
  var audio = null, tracks = [], cur = -1, url = null, playing = false, fadeT = null, hist = [];
  function publish() {
    var t = tracks[cur], st = settings();
    lsSet(STK, JSON.stringify({ alive: Date.now(), playing: playing, title: t ? t.name : "", idx: cur, total: tracks.length, vol: st.vol, shuffle: st.shuffle, repeat: st.repeat }));
    var n = document.getElementById("wnow");
    if (n) { n.hidden = !(playing && t && st.show); if (t) n.querySelector("span").textContent = t.name; }
    if (panelEl) paintPanel();
  }
  function fade(to, ms, done) {
    clearInterval(fadeT); var from = audio.volume, steps = Math.max(1, Math.round(ms / 40)), k = 0;
    fadeT = setInterval(function () { k++; audio.volume = Math.max(0, Math.min(1, from + (to - from) * k / steps)); if (k >= steps) { clearInterval(fadeT); if (done) done(); } }, 40);
  }
  function load(i, autoplay) {
    if (!tracks.length) { cur = -1; playing = false; publish(); return; }
    cur = (i + tracks.length) % tracks.length;
    var t = tracks[cur], st = settings();
    var go = function (src) {
      if (url) { URL.revokeObjectURL(url); url = null; }
      if (src.blob) url = src = URL.createObjectURL(src.blob);
      audio.src = src; audio.volume = 0;
      if (autoplay) audio.play().then(function () { playing = true; fade(st.vol, 900); publish(); }).catch(function () { playing = false; publish(); toast(T("Clicca una volta sul proiettore per far partire la musica.")); });
      else publish();
    };
    if (t.url) go(t.url);
    else store("readonly", function (s) { return s.get(t.id); }).then(function (r) { if (r && r.blob) go({ blob: r.blob }); else exec("next"); });
  }
  function pickNext(d) {
    var st = settings();
    if (st.shuffle && tracks.length > 1 && d > 0) { var j; do { j = Math.floor(Math.random() * tracks.length); } while (j === cur); return j; }
    if (d < 0 && hist.length) return hist.pop();
    var n = cur + d;
    if (n >= tracks.length && !st.repeat) return -1;
    return n;
  }
  function exec(c, v) {
    var st = settings();
    if (c === "toggle") {
      if (!tracks.length) return;
      if (playing) { fade(0, 500, function () { audio.pause(); }); playing = false; publish(); }
      else if (cur < 0 || !audio.src) load(Math.max(0, cur), true);
      else audio.play().then(function () { playing = true; fade(st.vol, 600); publish(); }).catch(function () {});
    } else if (c === "next" || c === "prev") {
      if (!tracks.length) return;
      var n = pickNext(c === "next" ? 1 : -1);
      if (c === "next" && cur >= 0) hist.push(cur);
      if (n < 0) { playing = false; audio.pause(); publish(); return; }
      if (playing) fade(0, 600, function () { load(n, true); }); else load(n, false);
    } else if (c === "play") {
      var i = tracks.findIndex(function (t) { return t.id === v; }); if (i < 0) return;
      if (cur >= 0) hist.push(cur);
      if (playing) fade(0, 400, function () { load(i, true); }); else load(i, true);
    } else if (c === "vol") { st.vol = Math.max(0, Math.min(1, +v)); saveSettings(st); if (playing) audio.volume = st.vol; publish(); }
    else if (c === "stop") { fade(0, 500, function () { audio.pause(); audio.currentTime = 0; }); playing = false; publish(); }
  }
  function reload() {
    return list().then(function (L) {
      var id = tracks[cur] && tracks[cur].id; tracks = L;
      cur = id ? tracks.findIndex(function (t) { return t.id === id; }) : cur;
      if (cur >= tracks.length) cur = -1;
      publish();
    });
  }
  function startWall() {
    audio = new Audio(); audio.preload = "auto";
    audio.addEventListener("ended", function () { exec("next"); });
    audio.addEventListener("error", function () { if (playing) { toast(T("Brano non leggibile: passo al successivo.")); setTimeout(function () { exec("next"); }, 800); } });
    window.addEventListener("storage", function (e) {
      if (e.key === CK && e.newValue) { try { var m = JSON.parse(e.newValue); exec(m.c, m.v); } catch (x) {} }
      else if (e.key === RK || e.key === SK) reload();
    });
    document.addEventListener("keydown", function (e) {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if (k === "m") { e.preventDefault(); exec("toggle"); }
      else if (k === "n") { e.preventDefault(); exec("next"); }
      else if (k === "b") { e.preventDefault(); exec("prev"); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); exec("vol", settings().vol + 0.1); }
      else if (e.key === "-") { e.preventDefault(); exec("vol", settings().vol - 0.1); }
    });
    setInterval(publish, 2000);
    /* titolo del brano sullo schermo e pulsante nei comandi */
    var n = document.createElement("div"); n.id = "wnow"; n.hidden = true; n.innerHTML = '<i aria-hidden="true">♪</i><span></span>';
    (document.getElementById("wall") || document.body).appendChild(n);
    var ctl = document.getElementById("wctl");
    if (ctl) {
      var b = document.createElement("button"); b.type = "button"; b.id = "wmus"; b.textContent = "♪ " + "Musica"; b.title = "Musica (M avvia o ferma, N successivo, B precedente, + e - volume)";
      b.addEventListener("click", function () { togglePanel(ctl.parentNode); });
      ctl.insertBefore(b, ctl.querySelector(".wkeys"));
      var k = ctl.querySelector(".wkeys"); if (k) k.insertAdjacentHTML("beforeend", ' <kbd>M</kbd> musica');
    }
    reload();
  }

  /* ---------- pannello della playlist (proiettore e app principale) ---------- */
  var panelEl = null, remote = {}, listCache = [];
  function state() { if (WALL) { var t = tracks[cur], st = settings(); return { alive: Date.now(), playing: playing, title: t ? t.name : "", total: tracks.length, vol: st.vol, shuffle: st.shuffle, repeat: st.repeat }; } try { return JSON.parse(lsGet(STK) || "{}"); } catch (e) { return {}; } }
  function paintPanel() {
    if (!panelEl) return;
    var s = state(), st = settings(), alive = WALL || (s.alive && Date.now() - s.alive < 6000), curId = WALL && tracks[cur] ? tracks[cur].id : null;
    var h = '<div class="mu-head"><h3>Musica del proiettore</h3><button type="button" data-mu="close" aria-label="Chiudi">✕</button></div>';
    if (!alive) h += '<p class="mu-warn">Il proiettore è chiuso: la musica suona lì. <button type="button" data-mu="wall">Apri il proiettore</button></p>';
    h += '<p class="mu-now">' + (s.title ? (s.playing ? "In riproduzione: " : "In pausa: ") + '<b>' + esc(s.title) + '</b>' : "Nessun brano in riproduzione.") + '</p>' +
      '<div class="mu-ctl"><button type="button" data-mu="prev" title="Precedente (B)" aria-label="Precedente">⏮</button><button type="button" class="p" data-mu="toggle" title="Avvia o ferma (M)">' + (s.playing ? "⏸ Pausa" : "▶ Avvia") + '</button><button type="button" data-mu="next" title="Successivo (N)" aria-label="Successivo">⏭</button>' +
      '<label class="mu-vol">Volume <input type="range" min="0" max="1" step="0.05" data-mu="vol" value="' + (st.vol) + '"></label></div>' +
      '<div class="mu-opt"><label><input type="checkbox" data-mu="shuffle"' + (st.shuffle ? " checked" : "") + '> Casuale</label><label><input type="checkbox" data-mu="repeat"' + (st.repeat ? " checked" : "") + '> Ricomincia alla fine</label><label><input type="checkbox" data-mu="show"' + (st.show ? " checked" : "") + '> Titolo sullo schermo</label></div>' +
      '<ol class="mu-list">' + (listCache.length ? listCache.map(function (t, i) {
        return '<li' + (t.id === curId || (!WALL && s.title === t.name) ? ' class="on"' : "") + '><button type="button" class="mu-t" data-mu="play" data-id="' + esc(t.id) + '" title="Suona questo brano">' + (t.url ? "📻 " : "") + esc(t.name) + '</button>' +
          '<span class="mu-act"><button type="button" data-mu="up" data-id="' + esc(t.id) + '" aria-label="Su"' + (i ? "" : " disabled") + '>▲</button><button type="button" data-mu="down" data-id="' + esc(t.id) + '" aria-label="Giù"' + (i < listCache.length - 1 ? "" : " disabled") + '>▼</button><button type="button" data-mu="del" data-id="' + esc(t.id) + '" aria-label="Togli dalla playlist">✕</button></span></li>';
      }).join("") : '<li class="mu-empty">La playlist è vuota: aggiungi file musicali o una radio.</li>') + '</ol>' +
      '<div class="mu-add"><label class="mu-file">Aggiungi file musicali…<input type="file" accept="audio/*,.mp3,.ogg,.opus,.wav,.flac,.m4a" multiple hidden data-mu="files"></label>' +
      '<input type="text" inputmode="url" data-mu="radiourl" placeholder="Link di una radio in streaming (https://…)" aria-label="Link della radio"><button type="button" data-mu="radio">Aggiungi radio</button></div>' +
      '<p class="mu-hint">MP3, OGG, WAV, FLAC, M4A. I brani restano salvati su questo PC. Proiettore: M avvia o ferma, N successivo, B precedente, + e - volume.</p>';
    var fo = document.activeElement && document.activeElement.getAttribute("data-mu"), rv = panelEl.querySelector("[data-mu=radiourl]"), rvv = rv ? rv.value : "";
    panelEl.innerHTML = h;
    var r2 = panelEl.querySelector("[data-mu=radiourl]"); if (r2) r2.value = rvv;
    if (fo === "radiourl" && r2) r2.focus();
  }
  function refreshList() { return list().then(function (L) { listCache = L; paintPanel(); }); }
  function togglePanel(parent) {
    if (panelEl) { panelEl.remove(); panelEl = null; return; }
    panelEl = document.createElement("section"); panelEl.className = "mu-panel" + (WALL ? " inwall" : ""); panelEl.setAttribute("aria-label", "Musica del proiettore");
    (parent || document.body).appendChild(panelEl);
    panelEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mu]"); if (!b || b.tagName === "INPUT" && b.type !== "button") return;
      var a = b.getAttribute("data-mu"), id = b.getAttribute("data-id");
      if (a === "close") return togglePanel();
      if (a === "wall") { if (window.desk && window.desk.openWall) window.desk.openWall(); else window.open(location.pathname + "?wall=1", "tfwall", "popup=yes,width=1280,height=720"); return; }
      if (a === "toggle" || a === "next" || a === "prev") { cmd(a); return setTimeout(paintPanel, 300); }
      if (a === "play") { cmd("play", id); return setTimeout(paintPanel, 300); }
      if (a === "up" || a === "down") return move(id, a === "up" ? -1 : 1).then(refreshList);
      if (a === "del") return remove(id).then(refreshList);
      if (a === "radio") { var u = panelEl.querySelector("[data-mu=radiourl]"); return addRadio(u.value).then(function () { u.value = ""; toast(T("Radio aggiunta alla playlist.")); return refreshList(); }).catch(function (x) { toast(x.message); }); }
    });
    panelEl.addEventListener("change", function (e) {
      var t = e.target, a = t.getAttribute("data-mu"), st = settings();
      if (a === "files") { addFiles(t.files).then(function (n) { toast(n ? T("Brani aggiunti: ") + n + "." : T("Nessun file musicale tra quelli scelti.")); t.value = ""; refreshList(); }); return; }
      if (a === "shuffle" || a === "repeat" || a === "show") { st[a] = t.checked; saveSettings(st); if (WALL) publish(); return; }
    });
    panelEl.addEventListener("input", function (e) { if (e.target.getAttribute("data-mu") === "vol") cmd("vol", e.target.value); });
    refreshList();
  }
  window.MUSIC = { panel: togglePanel };

  if (WALL) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWall); else setTimeout(startWall, 0); return; }
  /* app principale: pulsante ♪ nella barra in alto; lo stato arriva dal proiettore */
  window.addEventListener("storage", function (e) { if (e.key === STK) { paintBtn(); if (panelEl) paintPanel(); } else if (e.key === RK && panelEl) refreshList(); });
  var btn = null;
  function paintBtn() { if (!btn) return; var s = state(), on = s.playing && s.alive && Date.now() - s.alive < 6000; btn.classList.toggle("on", !!on); btn.title = on ? "Musica: " + s.title : "Musica del proiettore"; }
  function addBtn() {
    var tb = document.getElementById("apptools"); if (!tb) return;
    btn = document.createElement("button"); btn.type = "button"; btn.id = "musbtn"; btn.innerHTML = '<span aria-hidden="true">♪</span><span class="vh">Musica del proiettore</span>';
    btn.addEventListener("click", function () { togglePanel(document.body); });
    tb.appendChild(btn); paintBtn(); setInterval(paintBtn, 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBtn); else setTimeout(addBtn, 0);
})();
