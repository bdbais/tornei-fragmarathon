/* Tornei Fragmarathon: schermata dei tornei.
   Ogni torneo (la serata, la LAN) è un file a sé con giochi, giocatori, tema, logo, formule
   e il bot Telegram scelto. All'avvio si vede l'elenco e si sceglie quale amministrare.
   App installata: un file per torneo in Documenti\Tornei Fragmarathon\eventi (eliminare sposta in "cestino").
   Browser (PWA): stessi dati nel localStorage. Il torneo aperto resta in "tornei-v2" come prima,
   così proiettore e diretta continuano a funzionare senza cambiare nulla. */
(function () {
  "use strict";
  var A = window.__app;
  if (!A || A.WALL) return;
  var LANGS = (window.I18NCORE && window.I18NCORE.LANGS) || [["it", "Italiano"]];
  var D = A.DESK, esc = A.esc, IDXK = "tornei-evidx", EVK = "tornei-ev:", PREFK = "tornei-home";
  var root = null, list = [], bots = null, armed = {}, editing = null, creating = false, saveT = null, q = "", dupAsk = null, shareAsk = null, lastDel = null, delT = null, vmCache = {}, curVM = null, curVMId = null, othT = null, qq = {};

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  var pref = (function () { try { return JSON.parse(lsGet(PREFK) || "{}"); } catch (e) { return {}; } })();
  function savePref() { lsSet(PREFK, JSON.stringify(pref)); }
  function trUi(s) { return window.I18N && I18N.tr ? I18N.tr(s) : s; }

  /* ---------- dove stanno i tornei ---------- */
  var store = D && D.evList ? {
    list: function () { return D.evList(); },
    read: function (id) { return D.evRead(id); },
    write: function (id, txt) { return D.evWrite(id, txt); },
    trash: function (id) { return D.evTrash(id); },
    untrash: function (id) { return D.evUntrash(id); }
  } : {
    bin: {},
    idx: function () { try { return JSON.parse(lsGet(IDXK) || "{}") || {}; } catch (e) { return {}; } },
    list: function () {
      var x = this.idx();
      return Promise.resolve(Object.keys(x).map(function (id) { return { id: id, mtime: x[id].mtime, meta: x[id].meta || {} }; }));
    },
    read: function (id) { var t = lsGet(EVK + id); return t ? Promise.resolve(t) : Promise.reject(new Error("torneo non trovato")); },
    write: function (id, txt) {
      if (!lsSet(EVK + id, txt)) return Promise.reject(new Error("spazio del browser esaurito: togli qualche logo o torneo vecchio"));
      var x = this.idx(); x[id] = { mtime: Date.now(), meta: JSON.parse(txt).meta };
      if (!lsSet(IDXK, JSON.stringify(x))) return Promise.reject(new Error("spazio del browser esaurito: togli qualche logo o torneo vecchio"));
      return Promise.resolve(true);
    },
    trash: function (id) {
      this.bin[id] = lsGet(EVK + id);
      try { localStorage.removeItem(EVK + id); } catch (e) {}
      var x = this.idx(); delete x[id]; lsSet(IDXK, JSON.stringify(x)); return Promise.resolve(true);
    },
    untrash: function (id) { var t = this.bin[id]; delete this.bin[id]; return t ? this.write(id, t) : Promise.resolve(false); }
  };

  function newId() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  /* solo questi nomi di file si possono aprire, scrivere ed eliminare: stessa regola di main.js evFile
     (anche i tornei recuperati a mano dal cestino o di versioni vecchie) */
  function okId(id) { return /^[A-Za-z0-9_-]{4,80}$/.test(String(id)); }
  function okState(st) { return !!st && !!st.games && typeof st.games === "object" && !Array.isArray(st.games); }
  /* una copia del torneo non deve salvare sopra i file in Archivio dell'originale */
  function unbind(st) { Object.keys(st.games || {}).forEach(function (k) { var g = st.games[k]; if (g && typeof g === "object") delete g.file; }); return st; }
  /* letture e modifiche del file di un altro torneo, una alla volta per torneo */
  function serial(id, fn) { var p = (qq[id] || Promise.resolve()).then(function () { return fn(); }); qq[id] = p.catch(function () {}); return p; }
  function cur() { return A.S(); }
  function curId() { var S = cur(); return S.ev && S.ev.id; }
  function ensureEv() {
    var S = cur();
    if (!S.ev || !S.ev.id) { S.ev = Object.assign({ created: Date.now() }, S.ev || {}, { id: newId() }); A.touch(); }
  }

  /* ---------- riassunto per le schede (sta nel file, così l'elenco non ricalcola tutto) ---------- */
  var thumbC = ["", ""];
  function thumb(src) {
    if (!src) return Promise.resolve("");
    if (thumbC[0] === src) return Promise.resolve(thumbC[1]);
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () {
        var c = document.createElement("canvas"), k = Math.min(1, 160 / Math.max(i.width, i.height, 1)), u = "";
        c.width = Math.max(1, Math.round(i.width * k)); c.height = Math.max(1, Math.round(i.height * k));
        try { c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); u = c.toDataURL("image/png"); } catch (e) {}
        thumbC = [src, u]; res(u);
      };
      i.onerror = function () { res(""); };
      i.src = src;
    });
  }
  function metaOf(S) {
    return thumb(S.ui && S.ui.logo).then(function (lg) {
      var acc = getComputedStyle(document.documentElement).getPropertyValue("--acc").trim(), ev = S.ev || {};
      return {
        title: (S.ui && S.ui.title) || A.ui0.title, sub: (S.ui && S.ui.sub) || "", date: ev.date || "", time: ev.time || "", wa: ev.wa || "", tg: ev.tg || "", discord: ev.discord || "", ts: ev.ts || "", tspass: ev.tspass || "", mode: ev.mode || "lan", addr: ev.addr || "", maps: ev.maps || "", lang: ev.lang || "it", place: ev.place || "",
        color: ev.color || "", accent: acc, logo: lg, games: A.games(JSON.parse(JSON.stringify(S))),
        players: (S.roster || []).length, bot: ev.bot || "", pinned: !!ev.pinned, draft: !!ev.draft, ladder: ev.ladder !== false, orig: ev.orig || "", created: ev.created || Date.now(), updated: Date.now()
      };
    });
  }
  function wrap(S, meta) { return JSON.stringify({ app: "tornei-fragmarathon", kind: "evento", v: 1, meta: meta, state: S }); }
  /* strict: l'errore passa a chi chiama, che non deve sostituire il torneo aperto (le modifiche non salvate andrebbero perse) */
  function flush(strict) {
    /* mentre app.js lavora per un attimo su un altro torneo (immagini del bot) cur() è quello:
       si aspetta che torni il torneo aperto, altrimenti si salverebbe il torneo sbagliato e si perderebbe il salvataggio di questo */
    if (A.swapping && A.swapping()) return new Promise(function (res) { setTimeout(res, 300); }).then(function () { return flush(strict); });
    ensureEv();
    var S = cur();
    return metaOf(S).then(function (m) { return store.write(S.ev.id, wrap(S, m)); })
      .catch(function (e) { A.toast("Salvataggio del torneo non riuscito: " + ((e && e.message) || e)); if (strict === true) throw e; });
  }
  A.onSave = function () { clearTimeout(saveT); saveT = setTimeout(flush, 1500); };
  window.addEventListener("beforeunload", function () { if (saveT) { clearTimeout(saveT); flush(); } });

  /* Il bot risponde per tutti i tornei, non solo quello aperto: la pagina gli manda la vista di ognuno. */
  function sendAll() {
    if (!D || !D.botState) return;
    var S = cur(), id = S.ev && S.ev.id, ev = [];
    /* la vista del torneo aperto solo se è stata calcolata su questo torneo: subito dopo un cambio è ancora quella del precedente */
    if (curVM && id && curVMId === id) ev.push({ id: id, bot: S.ev.bot || "", vm: curVM });
    Object.keys(vmCache).forEach(function (k) { if (k !== id) ev.push({ id: k, bot: vmCache[k].bot, vm: vmCache[k].vm }); });
    D.botState({ events: ev }).catch(function () {});
  }
  A.pushVM = function (vm) { curVM = vm; curVMId = curId(); sendAll(); };
  function refreshOthers() {
    if (!D || !D.botState) return Promise.resolve();
    clearTimeout(othT);
    return store.list().then(function (L) {
      var id = curId(), keep = {};
      return Promise.all(L.filter(function (e) { return e.id !== id && okId(e.id); }).map(function (e) {
        keep[e.id] = 1;
        /* si rilegge e ricalcola solo un file cambiato */
        var ver = e.mtime + ":" + (e.size || 0);
        if (vmCache[e.id] && vmCache[e.id].ver === ver) return;
        return (qq[e.id] || Promise.resolve()).then(function () { return store.read(e.id); }).then(function (t) { var j = JSON.parse(t), st = j.state || j; vmCache[e.id] = { ver: ver, bot: (st.ev && st.ev.bot) || "", vm: A.vmOf(st) }; }).catch(function () {});
      })).then(function () { Object.keys(vmCache).forEach(function (k) { if (!keep[k]) delete vmCache[k]; }); sendAll(); });
    });
  }
  /* modifica di un torneo che non è quello aperto: fn(stato) restituisce true se ha cambiato qualcosa.
     Non fallisce mai: true se ha salvato, false se il file non si legge o non si scrive, undefined se non c'era niente da cambiare */
  function editOther(id, fn) {
    return serial(id, function () {
      return store.read(id).then(function (t) {
        var j = JSON.parse(t), st = j.state || j;
        if (!fn(st)) return;
        return store.write(id, wrap(st, j.meta || {})).then(function () { laterOthers(); return true; }, function (e) {
          A.toast("Modifica non salvata: " + ((e && e.message) || e)); return false;
        });
      });
    }).catch(function () { return false; });
  }
  function laterOthers() { clearTimeout(othT); othT = setTimeout(refreshOthers, 300); }
  /* iscrizione dal bot a un torneo che non è quello aperto: si scrive nel suo file */
  function joinOther(id, k, name, dc) {
    return serial(id, function () {
      return store.read(id).then(function (t) {
        var j = JSON.parse(t), st = j.state || j;
        A.applyJoin(st, k, name, dc);
        /* scheda dell'elenco: totale e conteggi per gioco */
        var m = j.meta || {}; m.players = (st.roster || []).length; m.updated = Date.now();
        try { m.games = A.games(JSON.parse(JSON.stringify(st))); } catch (e) {}
        return store.write(id, wrap(st, m)).then(function () { return m; });
      });
    }).then(function (m) { A.toast("Iscritto dal bot Telegram: " + name + " (" + (m.title || "altro torneo") + ")."); laterOthers(); if (root && !root.hidden) render(); })
      .catch(function (e) { A.toast("Iscrizione dal bot non salvata: " + ((e && e.message) || e)); });
  }
  function useBot(S) { if (D && D.botsUse) return D.botsUse((S.ev && S.ev.bot) || "").catch(function () {}); return Promise.resolve(); }

  /* ---------- azioni ---------- */
  function template(g, keep) {
    /* senza risultati: solo chi era ancora in gara (chi si è ritirato non passa nel torneo nuovo) */
    var wd = Array.isArray(g.wd) ? g.wd : [], pl = keep ? (g.players || []).filter(function (n) { return wd.indexOf(n) < 0; }) : [], mb = {};
    if (keep && wd.length) pl.forEach(function (n) { if (g.members && g.members[n]) mb[n] = g.members[n]; });
    else if (keep) mb = g.members || {};
    var t = { name: g.name || "", mode: g.mode, ng: g.ng || 2, players: pl, members: mb, phase: "setup", groups: null, rounds: null };
    ["team", "plat", "logo", "calc", "nq", "tsize", "ffaGs", "ffaAdv", "swR", "swTop", "deReset", "hidden", "cam", "draft", "cfg", "ladder"].forEach(function (k) { if (g[k] !== undefined) t[k] = g[k]; });
    /* teste di serie: solo con gli stessi giocatori, e solo chi passa nel torneo nuovo */
    if (keep && Array.isArray(g.tds)) { var td = g.tds.filter(function (n) { return pl.indexOf(n) >= 0; }); if (td.length) t.tds = td; }
    return t;
  }
  function readState(id) {
    if (id === curId()) return Promise.resolve(JSON.parse(JSON.stringify(cur())));
    /* aspetta le modifiche in corso su quel file (iscrizioni dal bot, preferiti) */
    return (qq[id] || Promise.resolve()).then(function () { return store.read(id); }).then(function (t) { var j = JSON.parse(t); return j.state || j; });
  }
  function openEv(id) {
    if (id === curId()) { close(); return; }
    clearTimeout(saveT);
    flush(true).then(function () { return readState(id); }).then(function (st) {
      if (!okState(st)) throw new Error("file non valido");
      st.ev = st.ev || {}; st.ev.id = id;
      A.load(st); useBot(st); close(); laterOthers();
      A.toast("Torneo aperto: " + ((st.ui && st.ui.title) || A.ui0.title) + ".");
    }).catch(function (e) { A.toast("Non riesco ad aprire il torneo: " + ((e && e.message) || e)); });
  }
  function create(f) {
    var from = f.from.split(":"), base = from[1] ? readState(from[1]) : Promise.resolve(null);
    clearTimeout(saveT);
    flush(true).then(function () { return base; }).then(function (src) {
      var keep = from[0] === "tutto", st;
      if (src && !okState(src)) throw new Error("file non valido");
      if (src && from[0] === "copia") st = unbind(src);
      else if (src) {
        st = src; Object.keys(st.games || {}).forEach(function (k) { st.games[k] = template(st.games[k], keep); });
        if (!keep) { st.roster = []; st.teams = []; }
      } else st = { cur: "quake", roster: [], games: {}, ui: {} };
      st.ui = st.ui || {}; st.ui.title = f.title; st.ui.sub = f.sub;
      st.ev = { id: newId(), created: Date.now(), date: f.date, time: f.time || "", wa: linkOk(f.wa, "wa"), tg: linkOk(f.tg, "tg"), discord: linkOk(f.discord, "discord"), ts: tsOk(f.ts), tspass: String(f.tspass || "").trim().slice(0, 60), mode: f.mode || "lan", addr: f.addr || "", maps: linkOk(f.maps, "maps"), lang: f.lang || (window.I18N ? I18N.ui() : "it"), place: f.place, color: f.color, draft: !!f.draft, bot: f.bot || (src && src.ev && src.ev.bot) || "" };
      /* ladder: senza il campo il torneo conta (anche i tornei di prima) */
      if (f.ladder === false) st.ev.ladder = false;
      A.load(st); useBot(st); creating = false; laterOthers();
      return flush().then(function () { close(); A.toast("Torneo creato: " + f.title + ". Aggiungi giochi e giocatori."); });
    }).catch(function (e) { A.toast("Non riesco a creare il torneo: " + ((e && e.message) || e)); });
  }
  function editEv(id, f) {
    function apply(st) {
      st.ui = st.ui || {}; st.ev = st.ev || {};
      if (f.title !== undefined) { st.ui.title = f.title; st.ui.sub = f.sub; st.ev.date = f.date; st.ev.time = f.time || ""; st.ev.place = f.place; st.ev.color = f.color; st.ev.draft = !!f.draft; st.ev.wa = linkOk(f.wa, "wa"); st.ev.tg = linkOk(f.tg, "tg"); st.ev.discord = linkOk(f.discord, "discord"); st.ev.ts = tsOk(f.ts); st.ev.tspass = String(f.tspass || "").trim().slice(0, 60); st.ev.mode = f.mode || "lan"; st.ev.addr = f.addr || ""; st.ev.maps = linkOk(f.maps, "maps"); st.ev.lang = f.lang || "it"; }
      if (f.bot !== undefined) st.ev.bot = f.bot;
      if (f.pinned !== undefined) st.ev.pinned = f.pinned;
      /* «Conta per la ladder»: dal modulo o dalla schermata della ladder; senza il campo il torneo conta */
      if (f.ladder !== undefined) { if (f.ladder === false) st.ev.ladder = false; else delete st.ev.ladder; }
    }
    /* esito: true se la modifica è salvata, false se no (l'errore l'ha già detto un avviso) */
    var ok = false;
    if (id === curId()) {
      /* titolo, lingua e il resto vanno ridisegnati; la stella e il bot no, e così resta la cronologia di Ctrl+Z */
      var S = cur(); apply(S); if (f.title !== undefined) A.load(S); else A.touch(); if (f.bot !== undefined) useBot(S);
      clearTimeout(saveT);
      return flush(true).then(function () { ok = true; return render(); }).catch(function (e) { if (ok) logL((e && e.stack) || e); }).then(function () { if (!ok) paint(); return ok; });
    }
    return serial(id, function () {
      return store.read(id).then(function (t) {
        var j = JSON.parse(t), st = j.state || j, m = j.meta || {};
        apply(st);
        m.title = st.ui.title || m.title; m.sub = st.ui.sub || ""; m.date = st.ev.date || ""; m.time = st.ev.time || ""; m.wa = st.ev.wa || ""; m.tg = st.ev.tg || ""; m.discord = st.ev.discord || ""; m.ts = st.ev.ts || ""; m.tspass = st.ev.tspass || ""; m.mode = st.ev.mode || "lan"; m.addr = st.ev.addr || ""; m.maps = st.ev.maps || ""; m.lang = st.ev.lang || "it"; m.place = st.ev.place || ""; m.color = st.ev.color || "";
        m.bot = st.ev.bot || ""; m.pinned = !!st.ev.pinned; m.draft = !!st.ev.draft; m.ladder = st.ev.ladder !== false;
        return store.write(id, wrap(st, m));
      });
    }).then(function () { ok = true; return render(); }).catch(function (e) { if (ok) logL((e && e.stack) || e); else A.toast("Modifica non salvata: " + ((e && e.message) || e)); }).then(function () { return ok; });
  }
  function exportEv(id) {
    var p = (id === curId() ? flush(true) : qq[id] || Promise.resolve()).then(function () { return store.read(id); });
    p.then(function (t) {
      var m = JSON.parse(t).meta || {}, name = String(m.title || "torneo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "");
      A.dl(new Blob([t], { type: "application/json" }), (name || "torneo") + ".torneo.json");
      A.toast("Torneo esportato: lo trovi nella cartella Download.");
    }).catch(function (e) { A.toast("Esportazione non riuscita: " + ((e && e.message) || e)); });
  }
  /* storico (cronaca delle partite) di un torneo, anche non aperto: lo stato si legge come in exportEv;
     per quello aperto prima si salva, poi vale quello in memoria */
  function histEv(id) {
    if (!A.history) return;
    var p = id === curId() ? flush(true).then(function () { return null; }) : readState(id);
    p.then(function (st) {
      if (st && !okState(st)) throw new Error("file non valido");
      var lang = ((st || cur()).ev || {}).lang || "it";
      return (window.I18N && I18N.load ? I18N.load(lang) : Promise.resolve()).then(function () { return A.history(st || undefined); });
    }).then(function (h) {
      if (!h) { A.toast("Lo storico non è disponibile in questa versione."); return; }
      if (!h.games) { A.toast("Questo torneo non ha ancora giochi avviati: lo storico comincia con la prima partita."); return; }
      A.dl(new Blob([h.md], { type: "text/markdown;charset=utf-8" }), h.name);
      A.toast("Storico scaricato: lo trovi nella cartella Download.");
    }).catch(function (e) { A.toast("Storico non riuscito: " + ((e && e.message) || e)); });
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var j; try { j = JSON.parse(r.result); } catch (e) { A.toast("Il file non è un torneo."); return; }
      if (j && j.kind === "torneo") { A.toast("Questo file contiene un solo gioco: apri un torneo e riprendilo da Archivio."); return; }
      var st = j && j.kind === "evento" ? j.state : j;
      if (!okState(st)) { A.toast("Il file non è un torneo salvato da questo programma."); return; }
      /* la scheda si ricalcola dallo stato (come nel ripristino): la meta di un file condiviso non è affidabile */
      Object.keys(st.games).forEach(function (k) { var g = st.games[k]; if (!g || typeof g !== "object" || Array.isArray(g)) delete st.games[k]; });
      try { A.migrateState(st); } catch (e) {}
      if (!st.ui || typeof st.ui !== "object") st.ui = {};
      if (!st.ui.title) st.ui.title = String((j.meta && j.meta.title) || "Torneo importato").slice(0, 80);
      /* id nuovo (lo stesso file si può importare più volte), ma il torneo ricorda da quale viene (orig: il primo della
         catena) e quando è nato (created: l'ordine dei tornei senza data nella ladder) */
      var e0 = st.ev && typeof st.ev === "object" ? st.ev : {}, idOk = function (x) { return typeof x === "string" && okId(x); }, orig = idOk(e0.orig) ? e0.orig : idOk(e0.id) ? e0.id : "", cr = +e0.created;
      st.ev = Object.assign({}, e0, { id: newId(), created: cr > 0 && cr <= Date.now() ? cr : Date.now(), pinned: false });
      if (orig) st.ev.orig = orig; else delete st.ev.orig;
      ["wa", "tg", "discord", "maps"].forEach(function (k) { st.ev[k] = linkOk(st.ev[k], k); });
      unbind(st);
      var acc = j.meta && j.meta.accent, title = st.ui.title, dup = false;
      /* lo stesso torneo c'è già (l'originale o un'altra sua copia importata): la copia non conta per la ladder,
         altrimenti le sue partite si conterebbero due volte */
      store.list().then(function (L) {
        var c = cur().ev || {};
        dup = !!orig && st.ev.ladder !== false && (c.id === orig || c.orig === orig || (L || []).some(function (e) { return e && (e.id === orig || ((e.meta || {}).orig || "") === orig); }));
        if (dup) st.ev.ladder = false;
        return metaOf(st);
      }).then(function (m) {
        if (typeof acc === "string" && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(acc)) m.accent = acc;
        return store.write(st.ev.id, wrap(st, m));
      }).then(function () {
        A.toast(dup ? tpl("Torneo importato: {t}. Lo stesso torneo c'è già, quindi questa copia non conta per la ladder (le partite si conterebbero due volte): puoi cambiarlo nella schermata Ladder.", { t: title }) : "Torneo importato: " + title + ".");
        render();
      }).catch(function (e) { A.toast("Importazione non riuscita: " + ((e && e.message) || e)); });
    };
    r.readAsText(file);
  }
  /* un torneo eliminato che non si può più rimettere con Annulla: via anche i suoi canali Discord
     (se lo si recupera a mano dal cestino, la sincronizzazione li ricrea) */
  function dcGone(d) { if (d && d.type === "ev" && d.dc && D && D.discordClear) D.discordClear(d.id).catch(function () {}); }
  function remember(d) {
    if (lastDel && lastDel !== d) dcGone(lastDel);
    lastDel = d; clearTimeout(delT); delT = setTimeout(function () { dcGone(lastDel); lastDel = null; paint(); }, 60000);
  }
  function undoDel() {
    var d = lastDel; if (!d) return Promise.resolve();
    lastDel = null; clearTimeout(delT);
    var p = d.type === "bot" ? D.botsUndoRemove() : store.untrash(d.id);
    return p.then(render).then(function () { A.toast("Rimesso: " + d.label + "."); })
      .catch(function (e) { A.toast("Ripristino non riuscito: " + ((e && e.message) || e)); });
  }
  function trashEv(id, btn) {
    if (!armed[id]) {
      armed[id] = 1; btn.textContent = "Conferma"; btn.classList.add("danger");
      setTimeout(function () { delete armed[id]; if (btn.isConnected) { btn.textContent = "Elimina"; btn.classList.remove("danger"); } }, 4000);
      return;
    }
    delete armed[id];
    var gone = (list.filter(function (e) { return e.id === id; })[0] || { meta: {} }).meta.title || "torneo";
    /* dc: aveva un server Discord, quindi forse dei canali da togliere quando non si può più annullare */
    function del(st) { return { type: "ev", id: id, label: gone, dc: !!(st && st.ev && st.ev.dguild) }; }
    function fail(e) { A.toast("Eliminazione non riuscita: " + ((e && e.message) || e)); }
    if (id === curId()) {
      var other = list.filter(function (e) { return e.id !== id && !e.broken && okId(e.id); }).sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); })[0];
      if (!other) { A.toast("È l'unico torneo: creane un altro prima di eliminarlo."); return; }
      var d0 = del(cur());
      clearTimeout(saveT);
      /* prima si salva: Annulla deve rimettere l'ultima versione */
      return flush(true).then(function () { return readState(other.id); }).then(function (st) {
        if (!okState(st)) throw new Error("il torneo da aprire al suo posto non è valido");
        st.ev = st.ev || {}; st.ev.id = other.id; A.load(st); useBot(st);
        return serial(id, function () { return store.trash(id); });
      }).then(function () { remember(d0); A.toast("Torneo eliminato. Ora è aperto: " + (other.meta.title || "Torneo") + "."); render(); }, fail);
    }
    var st0 = null;
    return serial(id, function () {
      return store.read(id).then(function (t) { var j = JSON.parse(t); st0 = j.state || j; }).catch(function () {}).then(function () { return store.trash(id); });
    }).then(function () {
      remember(del(st0));
      A.toast("Torneo eliminato: " + gone + ".");
      render();
    }, fail);
  }

  /* ---------- disegno ---------- */
  var MESI = { day: "numeric", month: "long", year: "numeric" };
  function fmtDate(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return ""; var x = new Date(d + "T12:00:00"); return x.toLocaleDateString("it-IT", MESI); }
  function fmtAgo(ms) {
    if (!ms) return ""; var d = new Date(ms), now = new Date(), t = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return "oggi alle " + t;
    var y = new Date(now); y.setDate(now.getDate() - 1); if (d.toDateString() === y.toDateString()) return "ieri alle " + t;
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }
  function stOf(s) { return s === "Concluso" ? "done" : s === "Non ancora avviato" ? "wait" : "live"; }
  function initials(t) { return String(t || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  function evColor(m) { return /^#[0-9a-f]{6}$/i.test(m.color || "") ? m.color : (/^#[0-9a-f]{3,8}$|^rgb/i.test(m.accent || "") ? m.accent : "#FF5A1F"); }
  function botName(id) {
    if (!bots) return "";
    var b = bots.filter(function (x) { return x.id === id; })[0] || bots[0];
    return b ? (b.username ? "@" + b.username : b.label) : "";
  }
  /* giochi della scheda: la meta di un file vecchio o rovinato può avere voci non valide */
  function gamesOf(m) { return Array.isArray(m.games) ? m.games.filter(function (x) { return x && typeof x === "object"; }) : []; }
  function progress(m) {
    var g = gamesOf(m), n = g.length; if (!n) return 0;
    return Math.round(g.reduce(function (a, x) { return a + (stOf(x.st) === "done" ? 1 : stOf(x.st) === "live" ? 0.5 : 0); }, 0) / n * 100);
  }
  function gamesHtml(m, big) {
    var g = gamesOf(m);
    if (!g.length) return '<p class="ev-empty">Nessun gioco con giocatori, per ora.</p>';
    return '<ul class="ev-games' + (big ? " big" : "") + '">' + g.map(function (x) {
      var s = stOf(x.st), n = +x.n || 0;
      return '<li class="st-' + s + '"><span class="dot" aria-hidden="true"></span><b>' + esc(x.name || x.l || "") + '</b><small>' +
        (s === "done" && x.top ? "vince " + esc(x.top) : esc(x.st || "")) + (n ? ", " + n + (n === 1 ? " iscritto" : " iscritti") : "") + '</small></li>';
    }).join("") + '</ul>';
  }
  /* solo link veri di WhatsApp, Telegram, Discord e Google Maps: si controllano dominio e percorso,
     la parte dopo ? o # resta (WhatsApp copia gli inviti con ?mode=…, wa.me usa ?text=…) */
  function linkOk(u, kind) {
    u = String(u || "").trim(); if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    var x; try { x = new URL(u.replace(/^http:/i, "https:")); } catch (e) { return ""; }
    if (x.protocol !== "https:" || x.username || x.password || x.port) return "";
    var h = x.hostname.toLowerCase().replace(/^www\./, ""), p = x.pathname, ok;
    if (kind === "maps") ok = (/^google\.[a-z.]+$/.test(h) && /^\/maps(\/|$)/.test(p)) || /^maps\.google\.[a-z.]+$/.test(h) || h === "maps.app.goo.gl" || (h === "goo.gl" && /^\/maps(\/|$)/.test(p));
    else if (kind === "wa") ok = ((h === "chat.whatsapp.com" || h === "wa.me") && /^\/[\w\/-]+$/.test(p)) || (h === "whatsapp.com" && /^\/channel\/[\w-]+\/?$/.test(p));
    else if (kind === "discord") ok = (h === "discord.gg" && /^\/[\w-]+\/?$/.test(p)) || ((h === "discord.com" || h === "discordapp.com") && /^\/invite\/[\w-]+\/?$/.test(p));
    else ok = (h === "t.me" || h === "telegram.me") && /^\/[\w+\/-]+$/.test(p);
    return ok ? x.href : "";
  }
  /* TeamSpeak: link di invito https (tmspk.gg o teamspeak.com) oppure indirizzo host[:porta], anche incollato come ts3server:// */
  function tsOk(u) {
    u = String(u || "").trim(); if (!u) return "";
    if (/^https?:\/\//i.test(u)) { var x; try { x = new URL(u.replace(/^http:/i, "https:")); } catch (e) { return ""; } var h = x.hostname.toLowerCase().replace(/^www\./, ""); return (h === "tmspk.gg" || h === "teamspeak.com") && !x.username && !x.password ? x.href : ""; }
    var m = /^(?:ts3server:\/\/)?([a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?|\[[0-9a-f:]+\])(?::(\d{1,5}))?(?:[\/?].*)?$/i.exec(u), pq = /[?&]port=(\d{1,5})/i.exec(u);
    if (!m) return ""; var port = m[2] || (pq && pq[1]) || ""; if (port && (+port < 1 || +port > 65535)) return "";
    return m[1].toLowerCase() + (port && port !== "9987" ? ":" + port : "");
  }
  /* link che apre TeamSpeak: l'invito https così com'è, oppure ts3server:// con porta e password */
  function tsHref(ts, pass) {
    if (/^https:/i.test(ts)) return ts;
    var m = /^(.*?)(?::(\d+))?$/.exec(ts), q = [];
    if (m[2]) q.push("port=" + m[2]); if (pass) q.push("password=" + encodeURIComponent(pass));
    return "ts3server://" + m[1] + (q.length ? "?" + q.join("&") : "");
  }
  /* testo da condividere su WhatsApp o Telegram: tutto quello che serve per partecipare, nella lingua del torneo */
  function shareText(m) {
    var L = function (s) { return window.I18N ? I18N.tr(s, m.lang || "it") : s; }, a = [], bu = bots ? (bots.filter(function (x) { return x.id === (m.bot || bots[0].id); })[0] || {}).username : "";
    a.push("🎮 " + (m.title || A.ui0.title)); if (m.sub) a.push(m.sub);
    if (fmtDate(m.date)) a.push("📅 " + fmtDate(m.date) + (m.time ? ", " + L("ore") + " " + m.time : ""));
    if (m.place) a.push("📌 " + m.place);
    if (m.mode === "online") a.push("🌐 " + L("Online") + (m.addr ? ": " + m.addr : ""));
    else { if (m.addr) a.push("📍 " + m.addr); var mp = mapsUrl(m); if (mp) a.push("🗺 " + mp); }
    if (bu) a.push("🤖 " + L("Bot Telegram (iscrizioni e avvisi)") + ": https://t.me/" + bu);
    var tg = linkOk(m.tg, "tg"), wa = linkOk(m.wa, "wa"), dc = linkOk(m.discord, "discord"), ts = tsOk(m.ts);
    if (tg) a.push("📣 " + L("Canale Telegram") + ": " + tg);
    if (wa) a.push("💬 " + L("Gruppo WhatsApp") + ": " + wa);
    if (dc) a.push("🎧 Discord: " + dc);
    if (ts) a.push("🎙 TeamSpeak: " + ts + (m.tspass ? " (" + L("password") + ": " + m.tspass + ")" : ""));
    return a.join("\n");
  }
  function shareHtml(m) {
    var t = shareText(m), first = (shareText(m).match(/https:\/\/\S+/) || ["https://tornei.bais.info"])[0];
    return '<div class="ev-share"><textarea readonly rows="7" aria-label="Messaggio da condividere" data-noi18n>' + esc(t) + '</textarea><div class="row">' +
      '<a class="btn" href="https://wa.me/?text=' + esc(encodeURIComponent(t)) + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a class="btn" href="https://t.me/share/url?url=' + esc(encodeURIComponent(first)) + '&amp;text=' + esc(encodeURIComponent(t)) + '" target="_blank" rel="noopener">Telegram</a>' +
      '<button data-a="sharecopy">Copia</button><button data-a="shareclose">Chiudi</button></div></div>';
  }
  /* link della mappa: quello incollato, oppure una ricerca di Google Maps con l'indirizzo */
  function mapsUrl(m) { return linkOk(m.maps, "maps") || (m.addr && m.mode !== "online" ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(m.addr) : ""); }
  function linksHtml(m) {
    var a = [], bu = bots ? (bots.filter(function (x) { return x.id === (m.bot || bots[0].id); })[0] || {}).username : "";
    if (bu) a.push('<a class="ev-link tg" href="https://t.me/' + esc(bu) + '" target="_blank" rel="noopener">Bot @' + esc(bu) + '</a>');
    /* i link passano di nuovo dal controllo: la scheda può venire da un file importato con una versione vecchia */
    var tg = linkOk(m.tg, "tg"), wa = linkOk(m.wa, "wa"), dc = linkOk(m.discord, "discord");
    if (tg) a.push('<a class="ev-link tg" href="' + esc(tg) + '" target="_blank" rel="noopener">Canale Telegram</a>');
    var mp = mapsUrl(m);
    /* indirizzo, luogo e titoli sono testo dell'utente: non si traducono (data-noi18n) */
    if (m.mode === "online") a.push('<span class="ev-link loc">Online' + (m.addr ? ': <span data-noi18n>' + esc(m.addr) + '</span>' : "") + '</span>');
    else if (mp) a.push('<a class="ev-link loc" href="' + esc(mp) + '" target="_blank" rel="noopener" title="Apri in Google Maps">' + (m.mode === "ibrido" ? "In presenza e online: " : "") + (m.addr ? '<span data-noi18n>' + esc(m.addr) + '</span>' : "Mappa") + '</a>');
    if (wa) a.push('<a class="ev-link wa" href="' + esc(wa) + '" target="_blank" rel="noopener">Gruppo WhatsApp</a>');
    if (dc) a.push('<a class="ev-link dc" href="' + esc(dc) + '" target="_blank" rel="noopener">Server Discord</a>');
    var ts = tsOk(m.ts);
    if (ts) a.push('<a class="ev-link ts" href="' + esc(tsHref(ts, m.tspass)) + '" title="' + esc(ts) + '">TeamSpeak</a>');
    return a.length ? '<p class="ev-links">' + a.join("") + '</p>' : "";
  }
  function whenHtml(m) {
    var a = []; if (fmtDate(m.date)) a.push('<span>' + esc(fmtDate(m.date)) + (m.time ? ", ore " + esc(m.time) : "") + '</span>'); if (m.place) a.push('<span data-noi18n>' + esc(m.place) + '</span>');
    return a.length ? '<p class="ev-when">' + a.join("") + '</p>' : "";
  }
  function badge(m) {
    return m.logo ? '<img src="' + esc(m.logo) + '" alt="">' : '<span class="ev-ini">' + esc(initials(m.title)) + '</span>';
  }
  function statsHtml(m, e) {
    var b = botName(m.bot), p = progress(m);
    return '<div class="ev-bar" role="img" aria-label="Avanzamento ' + p + ' per cento"><i style="width:' + p + '%"></i></div>' +
      '<p class="ev-stats"><span>' + (+m.players || 0) + ' giocatori</span><span>' + gamesOf(m).length + ' giochi</span>' + (b ? '<span>bot ' + esc(b) + '</span>' : "") + '<span>modificato ' + esc(fmtAgo(e.mtime || m.updated)) + '</span></p>';
  }
  function editForm(m, id) {
    var bo = bots ? '<label>Bot Telegram<select name="bot">' + bots.map(function (b) { return '<option value="' + esc(b.id) + '"' + ((m.bot || bots[0].id) === b.id ? " selected" : "") + '>' + esc(b.label) + (b.username ? " (@" + esc(b.username) + ")" : "") + '</option>'; }).join("") + '</select></label>' : "";
    return '<form class="ev-form" data-id="' + esc(id || "") + '">' +
      '<label class="wide">Nome<input name="title" required maxlength="80" value="' + esc(m.title || "") + '" placeholder="Es. Fragmarathon 28"></label>' +
      '<label class="wide">Sottotitolo<input name="sub" maxlength="120" value="' + esc(m.sub || "") + '" placeholder="Es. 28° Lanparty, sala polivalente"></label>' +
      '<label>Data<input type="date" name="date" value="' + esc(m.date || "") + '"></label>' +
      '<label>Ora<input type="time" name="time" value="' + esc(m.time || "") + '"></label>' +
      '<label>Luogo<input name="place" maxlength="80" value="' + esc(m.place || "") + '" placeholder="Città o sala"></label>' +
      '<label class="col">Colore<input type="color" name="color" value="' + esc(evColor(m)) + '"></label>' + bo +
      '<label>Lingua del torneo<select name="lang" data-noi18n>' + LANGS.map(function (l) { return '<option value="' + l[0] + '"' + ((m.lang || "it") === l[0] ? " selected" : "") + '>' + esc(l[1]) + '</option>'; }).join("") + '</select><small>Per proiettore, diretta, immagini, PDF e bot.</small></label>' +
      '<label>Si gioca<select name="mode"><option value="lan"' + (m.mode !== "online" && m.mode !== "ibrido" ? " selected" : "") + '>In presenza (LAN party)</option><option value="online"' + (m.mode === "online" ? " selected" : "") + '>Online</option><option value="ibrido"' + (m.mode === "ibrido" ? " selected" : "") + '>In presenza e online</option></select></label>' +
      '<label class="wide">Indirizzo della location<input name="addr" maxlength="160" value="' + esc(m.addr || "") + '" placeholder="Via, numero, città (per l\'online: piattaforma o server, es. Discord)"></label>' +
      '<label class="wide">Link Google Maps<input type="text" inputmode="url" name="maps" value="' + esc(m.maps || "") + '" placeholder="https://maps.app.goo.gl/… (vuoto: lo creo dall\'indirizzo)"><small>In Google Maps cerca il posto, tocca <b>Condividi</b> e poi <b>Copia link</b>, e incollalo qui.</small></label>' +
      '<label class="wide">Gruppo WhatsApp (link di invito)<input type="text" inputmode="url" name="wa" value="' + esc(m.wa || "") + '" placeholder="https://chat.whatsapp.com/…"></label>' +
      '<label class="wide">Canale o gruppo Telegram (facoltativo)<input type="text" inputmode="url" name="tg" value="' + esc(m.tg || "") + '" placeholder="https://t.me/…"></label>' +
      '<label class="wide">Server Discord (link di invito, facoltativo)<input type="text" inputmode="url" name="discord" value="' + esc(m.discord || "") + '" placeholder="https://discord.gg/…"><small>In Discord: tasto destro sul server, Invita persone, imposta che non scada e copia il link. I canali per partita si attivano in Impostazioni, Discord.</small></label>' +
      '<label class="wide">Server TeamSpeak (facoltativo)<input type="text" name="ts" value="' + esc(m.ts || "") + '" placeholder="ts.esempio.it:9987 oppure https://tmspk.gg/…" spellcheck="false" autocomplete="off"><small>Indirizzo del server (con la porta se non è 9987) o link di invito di TeamSpeak.</small></label>' +
      '<label class="wide">Password di TeamSpeak (facoltativa)<input type="text" name="tspass" value="' + esc(m.tspass || "") + '" maxlength="60" spellcheck="false" autocomplete="off"><small>La vedono i partecipanti nelle informazioni del torneo e con /teamspeak nel bot.</small></label>' +
      '<label class="wide chk"><span><input type="checkbox" name="draft"' + (m.draft ? " checked" : "") + '> In lavorazione</span><small>Nel bot lo vedono solo amministratori e organizzatori; nessun avviso ai partecipanti finché non lo togli.</small></label>' +
      '<label class="wide chk"><span><input type="checkbox" name="ladder"' + (m.ladder === false ? "" : " checked") + '> Conta per la ladder</span><small>Le partite di questo torneo spostano i punti della ladder fra tutti i tornei (Tornei, Ladder). Finché è in lavorazione non conta.</small></label>' +
      (id ? "" : '<label class="wide">Parti da<select name="from"><option value="vuoto">Un torneo vuoto</option>' +
        /* il titolo non si traduce: si traducono solo le parti fisse (un <option> non può contenere uno <span data-noi18n>) */
        list.map(function (e) { var t = esc((e.meta || {}).title || trUi("Torneo")); return '<option value="modello:' + esc(e.id) + '" data-noi18n>' + esc(trUi("Impostazioni di ")) + t + esc(trUi(" (giochi, formule, tema, logo)")) + '</option><option value="tutto:' + esc(e.id) + '" data-noi18n>' + t + esc(trUi(" con gli stessi giocatori, senza risultati")) + '</option>'; }).join("") + '</select></label>') +
      '<div class="ev-formact"><button class="p" type="submit">' + (id ? "Salva" : "Crea torneo") + '</button><button type="button" data-a="cancel">Chiudi</button></div></form>';
  }
  function card(e, hero) {
    var m = e.meta || {}, id = e.id, isCur = id === curId();
    var acts = '<div class="ev-act">' +
      (hero ? '<button class="p ev-go" data-a="open">' + (isCur ? "Continua" : "Apri") + '</button>' : '<button class="p" data-a="open">' + (isCur ? "Continua" : "Apri") + '</button>') +
      '<button data-a="edit">Modifica</button>' + (dupAsk === id ? '<button data-a="dup0">Duplica senza risultati</button><button data-a="dup1">Duplica con i risultati</button>' : '<button data-a="dup" title="Copia di questo torneo, con o senza risultati">Duplica</button>') +
      '<button data-a="share" aria-expanded="' + (shareAsk === id ? "true" : "false") + '">Condividi</button><button data-a="export">Esporta</button>' + (A.history && window.CRONACA ? '<button data-a="hist" title="Cronaca delle partite con orari, risultati e classifiche (Markdown)">Storico</button>' : '') + '<button data-a="trash">Elimina</button></div>' + (shareAsk === id ? shareHtml(m) : "");
    var pin = '<button class="ev-pin" data-a="pin" aria-pressed="' + (m.pinned ? "true" : "false") + '" title="' + (m.pinned ? "Togli dai preferiti" : "Tieni in cima") + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg></button>';
    var body = editing === id ? editForm(m, id) :
      (hero && isCur ? '<p class="ev-kicker">Aperto adesso</p>' : "") +
      '<h3 class="ev-t">' + (m.title ? '<span data-noi18n>' + esc(m.title) + '</span>' : "Torneo senza nome") + (m.lang && m.lang !== "it" ? '<span class="ev-lang" data-noi18n title="' + esc((LANGS.filter(function (l) { return l[0] === m.lang; })[0] || [0, m.lang])[1]) + '">' + esc(String(m.lang).toUpperCase()) + '</span>' : "") + (m.draft ? '<span class="ev-draft">in lavorazione</span>' : "") + '</h3>' + (m.sub ? '<p class="ev-sub">' + esc(m.sub) + '</p>' : "") + whenHtml(m) +
      linksHtml(m) + gamesHtml(m, hero) + statsHtml(m, e) + acts;
    return '<article class="ev' + (hero ? " hero" : "") + (isCur ? " cur" : "") + (e.broken ? " broken" : "") + '" data-id="' + esc(id) + '" style="--ev:' + esc(evColor(m)) + '">' +
      '<div class="ev-band">' + badge(m) + '</div><div class="ev-body">' + body + '</div>' + (editing === id ? "" : pin) + '</article>';
  }
  function botsHtml() {
    if (!bots) return "";
    var use = {}; list.forEach(function (e) { var m = e.meta || {}, b = m.bot || bots[0].id; (use[b] = use[b] || []).push(m.title ? '<span data-noi18n>' + esc(m.title) + '</span>' : "Torneo"); });
    return '<section class="hm-bots" id="hm-bots" aria-labelledby="hm-bots-h"><div class="hm-sechead"><h2 id="hm-bots-h">Bot Telegram</h2>' +
      '<p class="hm-note">Ogni bot ha token, ruoli, iscritti e messaggi suoi. Ogni torneo usa il bot che scegli; gira quello del torneo aperto.</p>' +
      '<button data-a="botadd">Nuovo bot</button></div><div class="hm-botlist">' + bots.map(function (b) {
        return '<div class="bt' + (b.active ? " on" : "") + '" data-bot="' + esc(b.id) + '" style="--bt:' + esc(b.color || "#2AABEE") + '">' +
          '<input type="color" class="bt-col" value="' + esc(b.color || "#2AABEE") + '" aria-label="Colore di ' + esc(b.label) + '">' +
          '<div class="bt-main"><input class="bt-name" value="' + esc(b.label) + '" maxlength="60" aria-label="Nome del bot">' +
          '<p>' + (b.username ? "@" + esc(b.username) : (b.hasToken ? "Token salvato" : "Token da impostare")) + ', ' + b.people + (b.people === 1 ? " persona" : " persone") + (b.active ? ", è il bot del torneo aperto" : "") + '</p>' +
          (b.pending ? '<p class="bt-pend"><button class="linkbtn" data-a="botset">' + b.pending + (b.pending === 1 ? " iscrizione da confermare" : " iscrizioni da confermare") + '</button></p>' : "") +
          (b.enabled && b.hasToken && !b.running && b.err ? '<p class="bt-err">' + esc(b.err) + '</p>' : "") +
          '<p class="bt-use">' + (use[b.id] ? "Usato da: " + use[b.id].join(", ") : "Nessun torneo lo usa") + '</p></div>' +
          '<div class="bt-act"><button class="swt" role="switch" data-a="bottog" aria-checked="' + (b.enabled && b.hasToken ? "true" : "false") + '"' + (b.hasToken ? "" : ' disabled title="Prima imposta il token (Impostazioni)"') + '><i aria-hidden="true"></i>' + (b.running ? "Acceso" : b.enabled && b.hasToken ? "Acceso, non collegato" : "Spento") + '</button>' + (b.active ? "" : '<button data-a="botuse">Usa nel torneo aperto</button>') + '<button data-a="botset">Impostazioni</button>' +
          (bots.length > 1 ? '<button data-a="botdel">Rimuovi</button>' : "") + '</div></div>';
      }).join("") + '</div></section>';
  }
  function sorted() {
    var s = pref.sort || "recenti", f = q.trim().toLowerCase();
    return list.filter(function (e) {
      if (!f) return true; var m = e.meta || {};
      return [m.title, m.sub, m.place, fmtDate(m.date)].concat(gamesOf(m).map(function (g) { return g.name || g.l; })).join(" ").toLowerCase().indexOf(f) >= 0;
    }).sort(function (a, b) {
      var ma = a.meta || {}, mb = b.meta || {};
      if (!!mb.pinned !== !!ma.pinned) return mb.pinned ? 1 : -1;
      if (s === "nome") return String(ma.title || "").localeCompare(String(mb.title || ""), "it");
      if (s === "data") return String(mb.date || "").localeCompare(String(ma.date || "")) || (b.mtime || 0) - (a.mtime || 0);
      return (b.mtime || 0) - (a.mtime || 0);
    });
  }
  function paint() {
    if (!root) return;
    if (ladOn) return paintLadder();
    var id = curId(), all = sorted(), heroE = list.filter(function (e) { return e.id === id; })[0], rest = all.filter(function (e) { return e.id !== id; });
    var h = '<div class="hm-wrap">' +
      '<header class="hm-top"><div class="hm-title"><h1 id="hm-h">Tornei</h1><span class="hm-n">' + list.length + '</span>' + (window.VERSION ? '<button type="button" class="verbtn" data-a="ver" title="Versione del programma: clicca per le novità">v' + esc(window.VERSION.v) + '</button>' : "") + '</div>' +
      '<div class="hm-tools"><input type="search" id="hm-q" placeholder="Cerca per nome, luogo o gioco" value="' + esc(q) + '" aria-label="Cerca un torneo">' +
      '<select id="hm-sort" aria-label="Ordina"><option value="recenti"' + (pref.sort === "recenti" || !pref.sort ? " selected" : "") + '>Modificati di recente</option><option value="data"' + (pref.sort === "data" ? " selected" : "") + '>Data del torneo</option><option value="nome"' + (pref.sort === "nome" ? " selected" : "") + '>Nome</option></select>' +
      '<button id="hm-view" aria-pressed="' + (pref.view === "list" ? "true" : "false") + '" title="Schede o elenco compatto">' + (pref.view === "list" ? "Schede" : "Elenco") + '</button>' +
      '<label class="hm-imp"><input type="file" id="hm-file" accept=".json,application/json" hidden>Importa</label>' +
      (lastDel ? '<button class="undodel" data-a="undodel" title="Rimetti: ' + esc(lastDel.label) + ' (Ctrl+Z)">Annulla cancellazione</button>' : "") + '<button data-a="ladder" title="Classifica a punti fra tutti i tornei">Ladder</button><button class="p" data-a="new">Nuovo torneo</button>' + (id ? '<button id="hm-close" title="Torna al torneo aperto (Esc)">Chiudi</button>' : "") + '</div></header>';
    /* nuovo torneo: oggi secondo l'ora locale (toISOString è UTC: dopo mezzanotte darebbe ieri) e la lingua dell'interfaccia */
    var d0 = new Date(), p2 = function (n) { return String(n).padStart(2, "0"); };
    if (creating) h += '<section class="ev new" style="--ev:' + esc(evColor({})) + '"><div class="ev-band"><span class="ev-ini">+</span></div><div class="ev-body"><h3 class="ev-t">Nuovo torneo</h3>' + editForm({ date: d0.getFullYear() + "-" + p2(d0.getMonth() + 1) + "-" + p2(d0.getDate()), lang: window.I18N ? I18N.ui() : "it" }, "") + '</div></section>';
    if (heroE && !q) h += safeCard(heroE, true);
    var others = q ? all : rest;
    h += others.length ? '<div class="hm-grid' + (pref.view === "list" ? " list" : "") + '">' + others.map(function (e) { return safeCard(e, false); }).join("") + '</div>'
      : (q ? '<p class="hm-none">Nessun torneo corrisponde a “' + esc(q) + '”.</p>' : (list.length < 2 ? '<p class="hm-none">Qui compariranno gli altri tornei. Premi <b>Nuovo torneo</b> per prepararne uno: puoi partire dalle impostazioni di questo.</p>' : ""));
    h += botsHtml() + '</div>';
    var y = root.scrollTop, ae = document.activeElement, fo = ae && ae.id;
    /* il modulo aperto (nuovo torneo o modifica) tiene quello che si è scritto anche quando l'elenco si ridisegna */
    var fm = root.querySelector(".ev-form"), keep = null;
    if (fm) {
      keep = { id: fm.getAttribute("data-id") || "", v: {}, fo: fm.contains(ae) ? ae.name : "" };
      Array.prototype.forEach.call(fm.elements, function (x) { if (x.name) keep.v[x.name] = x.type === "checkbox" ? x.checked : x.value; });
    }
    root.innerHTML = h; root.scrollTop = y;
    if (keep) {
      var nf = Array.prototype.filter.call(root.querySelectorAll(".ev-form"), function (x) { return (x.getAttribute("data-id") || "") === keep.id; })[0];
      if (nf) {
        Object.keys(keep.v).forEach(function (n) {
          var x = nf.elements[n]; if (!x || !x.tagName) return;
          if (x.type === "checkbox") x.checked = keep.v[n];
          else if (x.tagName !== "SELECT" || Array.prototype.some.call(x.options, function (o) { return o.value === keep.v[n]; })) x.value = keep.v[n];
        });
        if (keep.fo && nf.elements[keep.fo] && nf.elements[keep.fo].focus) nf.elements[keep.fo].focus();
      }
    }
    if (fo === "hm-q") { var qi = root.querySelector("#hm-q"); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }
  /* una scheda che non si riesce a disegnare (file rovinato) non deve lasciare la schermata vuota */
  function safeCard(e, hero) {
    try { return card(e, hero); } catch (x) {
      return '<article class="ev broken" data-id="' + esc(e.id) + '"><div class="ev-band"><span class="ev-ini">!</span></div><div class="ev-body"><h3 class="ev-t">Torneo non leggibile</h3><div class="ev-act"><button data-a="trash">Elimina</button></div></div></article>';
    }
  }
  function render() {
    return Promise.all([store.list(), D && D.botsList ? D.botsList().catch(function () { return null; }) : Promise.resolve(null)]).then(function (r) {
      /* un file con un nome che non è un codice di torneo (es. "t… - Copia.json") non si può né aprire né eliminare */
      list = (r[0] || []).filter(function (e) { return e && okId(e.id) && (!e.broken || e.meta); }); bots = r[1] && r[1].length ? r[1] : null; window.__bots = bots || []; paint(); laterOthers();
      if (bots) { var mine = bots.filter(function (b) { return b.id === ((cur().ev && cur().ev.bot) || bots[0].id); })[0] || bots[0]; window.__botUser = mine.username || ""; }
    });
  }

  /* ---------- ladder fra tutti i tornei ----------
     Un archivio solo, fuori dai tornei: app → ladder.json nella cartella dei tornei (main.js), browser → localStorage.
     { v:1, cfg:{start,k}, aliases:{nome normalizzato: "Nome canonico"}, snap: fotografia calcolata con Ricalcola
     (js/ladder.js, LADDER.compute), prev: quella di prima, sigs: firma dei risultati di ogni torneo contato
     (per «ci sono risultati nuovi»), cfgAt: ultima modifica di impostazioni o giocatori uniti }.
     La classifica non si aggiorna da sola: è la fotografia dell'ultimo Ricalcola. */
  var LADK = "tornei-v2-ladder", lad = null, ladOn = false, ladBusy = false, ladStale = null, ladW = Promise.resolve(), ladChk = 0;
  function LD() { return window.LADDER || null; }
  function ladStart() { return (LD() && +LD().START) || 2000; }
  function ladKdef() { return (LD() && +LD().K) || 32; }
  function ladNorm(n) { try { if (LD() && LD().norm) return LD().norm(n); } catch (e) {} return String(n == null ? "" : n).normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase(); }
  /* frase intera con segnaposto ({n}): tradotta intera, poi i valori */
  function tpl(s, o) { var t = window.I18N && I18N.exact ? I18N.exact(s) : s; return String(t).replace(/\{([a-z])\}/g, function (x, k) { return o && o[k] != null ? o[k] : x; }); }
  function logL(m) { if (D && D.logError) D.logError("ladder", String(m).slice(0, 2000)); }
  /* un archivio letto (file, browser, backup) nel formato attuale; D = valori mancanti messi al predefinito (per il ripristino) */
  function ladFix(o) {
    var Df = [];
    if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
    var c = o.cfg && typeof o.cfg === "object" ? o.cfg : {}, s = +c.start, k = +c.k;
    if (!(isFinite(s) && s >= 100 && s <= 10000)) { s = ladStart(); Df.push(["Punteggio iniziale della ladder", String(s)]); }
    if (!(isFinite(k) && k >= 1 && k <= 200)) { k = ladKdef(); Df.push(["Peso delle partite nella ladder (K)", String(k)]); }
    var al = {};
    if (o.aliases && typeof o.aliases === "object" && !Array.isArray(o.aliases)) Object.keys(o.aliases).forEach(function (x) { var v = o.aliases[x]; if (typeof v === "string" && v.trim() && ladNorm(x) && ladNorm(v) !== ladNorm(x)) al[ladNorm(x)] = v.trim().slice(0, 80); });
    else Df.push(["Giocatori uniti nella ladder", "nessuno"]);
    var ok = function (x) { return x && typeof x === "object" && !Array.isArray(x) && x.boards && typeof x.boards === "object" ? x : null; };
    var snap = ok(o.snap), prev = ok(o.prev);
    if (!snap) Df.push(["Classifica della ladder", "da calcolare con Ricalcola"]);
    var sg = {}; if (o.sigs && typeof o.sigs === "object") Object.keys(o.sigs).forEach(function (x) { if (okId(x) && typeof o.sigs[x] === "string") sg[x] = o.sigs[x]; });
    return { lad: { v: 1, cfg: { start: Math.round(s), k: Math.round(k) }, aliases: al, snap: snap, prev: snap ? prev : null, sigs: snap ? sg : {}, cfgAt: +o.cfgAt || 0 }, D: Df };
  }
  /* ladErr: l'archivio c'è ma non si è potuto leggere (file bloccato, permessi…): finché non si rilegge niente si salva,
     così una ladder vuota non finisce sopra quella vera. ladBroken: l'archivio era rovinato ed è stato messo da parte
     (app: ladder.json.rovinato-<data>, nella cartella dei tornei; browser: chiave tornei-v2-ladder-rovinato) */
  var ladErr = null, ladBroken = null;
  function ladLoad() {
    var p = D && D.ladderRead ? D.ladderRead() : Promise.resolve(lsGet(LADK) || "");
    return p.then(function (t) {
      var o = null;
      /* main.js l'ha già scritto in errori.log */
      if (t && typeof t === "object" && t.broken) ladBroken = String(t.broken);
      else if (t) {
        try { o = JSON.parse(t); } catch (e) {
          logL("archivio illeggibile: " + e.message);
          /* browser: la copia rovinata resta da parte, poi si riparte (nell'app lo fa main.js) */
          if (!(D && D.ladderRead)) { lsSet(LADK + "-rovinato", t); try { localStorage.removeItem(LADK); } catch (x) {} ladBroken = LADK + "-rovinato"; }
          else throw e;
        }
      }
      lad = ladFix(o).lad; ladErr = null; return lad;
    }).catch(function (e) { ladErr = String((e && e.message) || e).slice(0, 200); logL((e && e.stack) || e); if (!lad) lad = ladFix(null).lad; return lad; });
  }
  /* niente da salvare né da cambiare finché l'archivio non si legge */
  function ladLocked() {
    if (!ladErr) return false;
    A.toast(tpl("La ladder non si può modificare: il suo archivio non si legge ({e}). Riapri la schermata Ladder per riprovare.", { e: ladErr }));
    return true;
  }
  /* una scrittura alla volta; true se salvata */
  function ladSave() {
    if (ladErr) { ladLocked(); return Promise.resolve(false); }
    var txt = JSON.stringify(lad);
    ladW = ladW.then(function () {
      if (D && D.ladderWrite) return D.ladderWrite(txt).then(function () { return true; });
      if (!lsSet(LADK, txt)) throw new Error("spazio del browser esaurito: togli qualche logo o torneo vecchio");
      return true;
    }).catch(function (e) { A.toast("Ladder non salvata: " + ((e && e.message) || e)); logL((e && e.stack) || e); return false; });
    return ladW;
  }
  var ladReady = ladLoad();
  function fmtR(v) { return (Math.round((+v || 0) * 10) / 10).toLocaleString("it-IT", { maximumFractionDigits: 1 }); }
  function fmtAt(ms) { if (!ms) return ""; var d = new Date(ms); return isNaN(d) ? "" : d.toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function boardOf(snap, id) { var b = snap && snap.boards && snap.boards[id]; return Array.isArray(b) ? b : []; }
  /* firma dei risultati che contano di un torneo ("0" senza partite giocate): cambia se cambia una partita, un orario,
     chi gioca o il torneo (titolo, data). Niente punti della ladder né teste di serie: non cambiano i risultati */
  function hashS(s) { var h = 5381, i; for (i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + s.length.toString(36); }
  function sigOf(ev) {
    var n = 0, x = ((ev.facts && ev.facts.games) || []).map(function (g) {
      return [g.key, g.game, g.team ? 1 : 0, g.started || 0, (g.participants || []).map(function (p) { return [p.name, p.members || []]; }),
        (g.matches || []).filter(function (m) { return m.state === "done"; }).map(function (m) { n++; return [m.id, m.order, m.at || 0, m.sides, m.score, m.winner, m.draw ? 1 : 0, m.forfeit ? 1 : 0, m.bye ? 1 : 0, m.heat ? m.heat.map(function (h) { return [h.name, h.rank != null ? h.rank : h.pos]; }) : null]; })];
    });
    return n ? hashS(JSON.stringify([ev.title, ev.date, ev.time, ev.created, x])) : "0";
  }
  /* il torneo per LADDER.compute (solo se conta): fatti dei soli giochi che contano. Un torneo «In lavorazione» non
     conta (come un gioco in lavorazione): di solito è in preparazione o di prova */
  function ladEvOf(id, st, meta) {
    var ev = st.ev || {}; if (ev.ladder === false || ev.draft) return null;
    return { id: id, title: (st.ui && st.ui.title) || (meta && meta.title) || A.ui0.title, date: /^\d{4}-\d\d-\d\d$/.test(ev.date || "") ? ev.date : "", time: /^\d\d:\d\d$/.test(ev.time || "") ? ev.time : "",
      created: +ev.created || +(meta && meta.created) || 0, facts: A.facts(st, { ladder: true }) };
  }
  function ladList() { return store.list().then(function (L) { return (L || []).filter(function (e) { return e && okId(e.id) && !e.broken; }); }); }
  /* la casella «Conta per la ladder» del torneo (ladFlag) e se conta davvero (ladCounts: non in lavorazione) */
  function ladEvm(e) { return e.id === curId() ? cur().ev || {} : e.meta || {}; }
  function ladFlag(e) { return ladEvm(e).ladder !== false; }
  function ladCounts(e) { return ladFlag(e) && !ladEvm(e).draft; }
  /* Ricalcola: tutti i tornei salvati che contano, da zero; la fotografia di prima resta per le frecce */
  /* stesse classifiche (stessi giocatori, punti e partite, stesse impostazioni): Ricalcola senza niente di nuovo */
  function ladSame(a, b) {
    if (!a || !b || +a.start !== +b.start || +a.k !== +b.k) return false;
    var ka = Object.keys(a.boards || {}), kb = Object.keys(b.boards || {});
    return ka.length === kb.length && kb.every(function (id) {
      var x = boardOf(a, id), y = boardOf(b, id);
      return x.length === y.length && y.every(function (r, i) { var o = x[i]; return !!o && o.key === r.key && o.rating === r.rating && o.matches === r.matches && o.w === r.w && o.d === r.d && o.l === r.l && o.events === r.events; });
    });
  }
  /* niente di nuovo: le frecce e le variazioni restano quelle del calcolo vero di prima (e la fotografia di prima resta) */
  function ladCarry(a, b) { Object.keys(b.boards || {}).forEach(function (id) { var x = boardOf(a, id); boardOf(b, id).forEach(function (r, i) { if (x[i]) { r.delta = x[i].delta; r.move = x[i].move; } }); }); }
  /* Ricalcola: tutti i tornei salvati che contano, da zero; la fotografia di prima resta per le frecce */
  function ladRecalc() {
    if (ladBusy) return;
    if (!LD() || !LD().compute || !A.facts) { A.toast("La ladder non è disponibile in questa versione."); return; }
    if (ladLocked()) return;
    ladBusy = true; paint(); clearTimeout(saveT);
    var evs = [], bad = [];
    return ladReady.then(function () { return flush(true); }).then(ladList).then(function (L) {
      return L.reduce(function (p, e) {
        return p.then(function () { return readState(e.id); }).then(function (st) {
          if (!okState(st)) throw new Error("file non valido");
          var x = ladEvOf(e.id, st, e.meta); if (x) evs.push(x);
        }).catch(function (err) {
          logL(e.id + ": " + ((err && err.message) || err));
          /* un torneo che conta e non si legge non sparisce in silenzio: lo dicono l'avviso e «Tornei che contano» */
          if (ladCounts(e)) bad.push(e.id);
        });
      }, Promise.resolve());
    }).then(function () {
      var old = { prev: lad.prev, snap: lad.snap, sigs: lad.sigs };
      var snap = LD().compute(evs, { start: lad.cfg.start, k: lad.cfg.k, aliases: lad.aliases, prev: lad.snap || null, now: Date.now() }), sg = {};
      evs.forEach(function (e) { sg[e.id] = sigOf(e); });
      snap.skipped = bad;
      var same = ladSame(lad.snap, snap);
      if (same) ladCarry(lad.snap, snap); else lad.prev = lad.snap || null;
      lad.snap = snap; lad.sigs = sg; ladStale = false;
      return ladSave().then(function (ok) {
        /* non salvata: resta quella di prima, come nel file */
        if (!ok) { lad.prev = old.prev; lad.snap = old.snap; lad.sigs = old.sigs; return; }
        /* tornei contati = quelli con almeno una partita che sposta i punti (un torneo vuoto che conta non si conta) */
        var nm = (snap.events || []).reduce(function (a, e) { return a + (+e.matches || 0); }, 0), nt = (snap.events || []).filter(function (e) { return +e.matches > 0; }).length;
        var msg = same ? tpl("Ladder ricalcolata: nessun cambiamento dall'ultimo calcolo ({n} partite da {t} tornei).", { n: nm, t: nt }) : tpl("Ladder ricalcolata: {n} partite da {t} tornei.", { n: nm, t: nt });
        if (bad.length) msg += " " + tpl(D && D.logError ? "Tornei non letti: {s} (il motivo è in errori.log)." : "Tornei non letti: {s}.", { s: bad.length });
        A.toast(msg);
        if (A.rerender) A.rerender();
      });
    }).catch(function (e) { A.toast("Ricalcolo non riuscito: " + ((e && e.message) || e)); logL((e && e.stack) || e); })
      .then(function () {
        ladBusy = false; paint();
        /* durante il calcolo il pulsante era disattivato: il fuoco torna lì */
        var ae = document.activeElement, cb = ladOn && root.querySelector('[data-a="ldcalc"]');
        if (cb && (!ae || ae === document.body)) cb.focus();
        /* un torneo cambiato mentre si calcolava resta segnalato come «risultati nuovi» */
        if (lad && lad.snap) ladCheck();
      });
  }
  /* risultati nuovi dopo la fotografia: un torneo che conta è cambiato (firma diversa), ne è entrato o uscito uno con partite.
     Si rileggono solo i tornei modificati dopo il calcolo (e quello aperto, che si salva sempre) */
  function ladCheck() {
    var my = ++ladChk;
    return ladReady.then(function () {
      if (!lad || !lad.snap) return null;
      var at = +lad.snap.at || 0, sg = lad.sigs || {}, seen = {}, todo = [], st0 = false;
      return ladList().then(function (L) {
        L.forEach(function (e) {
          seen[e.id] = 1;
          if (!ladCounts(e)) { if (sg[e.id] && sg[e.id] !== "0") st0 = true; return; }
          if (!(e.id in sg) || (e.mtime || 0) > at || e.id === curId()) todo.push(e);
        });
        Object.keys(sg).forEach(function (id) { if (!seen[id] && sg[id] !== "0") st0 = true; });
        if (st0) return true;
        return todo.reduce(function (p, e) {
          return p.then(function (s) {
            if (s) return s;
            return readState(e.id).then(function (st) { var x = okState(st) ? ladEvOf(e.id, st, e.meta) : null; return x ? sigOf(x) !== (sg[e.id] || "0") : false; }).catch(function () { return false; });
          });
        }, Promise.resolve(false));
      });
    }).then(function (s) { if (my !== ladChk) return; ladStale = s; if (ladOn) paint(); }).catch(function (e) { logL((e && e.stack) || e); });
  }
  function ladCfgStale() { var s = lad && lad.snap; return !!s && (+s.start !== lad.cfg.start || +s.k !== lad.cfg.k || (lad.cfgAt || 0) > (+s.at || 0)); }
  /* unisci: a diventa b (o il nome a cui b è già unito); chi era unito ad a segue */
  /* una modifica della ladder (alias, impostazioni) salvata; se il salvataggio non riesce si torna a com'era, così lo
     schermo dice quello che c'è nel file (l'avviso d'errore l'ha già dato ladSave) */
  function ladCommit(back, done) {
    return ladSave().then(function (ok) { if (!ok) back(); paint(); if (ok) done(); });
  }
  function ladMerge(a, b) {
    if (ladBusy || ladLocked()) return;
    var ka = ladNorm(a), kb = ladNorm(b), al0 = JSON.parse(JSON.stringify(lad.aliases)), at0 = lad.cfgAt, al = lad.aliases, was = JSON.stringify(al);
    if (!ka || !kb || ka === kb) { A.toast("Scegli due giocatori diversi."); return; }
    if (LD() && LD().alias) lad.aliases = al = LD().alias(al, a, b);
    else {
      var T0 = al[kb] && ladNorm(al[kb]) !== ka ? al[kb] : b, kT = ladNorm(T0), kA = ladNorm(al[ka] || a);
      if (kA !== kT) {
        delete al[kT];
        Object.keys(al).forEach(function (x) { if (ladNorm(al[x]) === kA) al[x] = T0; });
        al[kA] = T0; if (ka !== kA) al[ka] = T0;
        Object.keys(al).forEach(function (x) { if (ladNorm(al[x]) === x) delete al[x]; });
      }
    }
    if (JSON.stringify(al) === was) { lad.aliases = al0; A.toast("Questi due giocatori sono già uniti."); return; }
    var T = al[ka] || b;
    lad.cfgAt = Date.now();
    return ladCommit(function () { lad.aliases = al0; lad.cfgAt = at0; }, function () { A.toast("Giocatori uniti: " + a + " → " + T + "."); });
  }
  function ladUnalias(k) {
    if (ladBusy || ladLocked() || !lad.aliases[k]) return;
    var v = lad.aliases[k], at0 = lad.cfgAt;
    delete lad.aliases[k]; lad.cfgAt = Date.now();
    return ladCommit(function () { lad.aliases[k] = v; lad.cfgAt = at0; }, function () { A.toast("Giocatori separati: " + k + "."); });
  }
  function ladCfg(which, v) {
    if (ladBusy || ladLocked()) { paint(); return; }
    var n = Math.round(+v), lo = which === "start" ? 100 : 1, hi = which === "start" ? 10000 : 200;
    if (!(n >= lo && n <= hi)) { A.toast(which === "start" ? "Il punteggio iniziale va da 100 a 10000." : "Il peso K va da 1 a 200."); paint(); return; }
    if (lad.cfg[which] === n) return;
    var v0 = lad.cfg[which], at0 = lad.cfgAt;
    lad.cfg[which] = n; lad.cfgAt = Date.now();
    return ladCommit(function () { lad.cfg[which] = v0; lad.cfgAt = at0; }, function () { A.toast("Impostazioni della ladder salvate: premi Ricalcola per applicarle."); });
  }
  function ladLabel(id) { if (id === "*") return trUi("Tutti i giochi"); var g = ((lad.snap && lad.snap.games) || []).filter(function (x) { return x && x.id === id; })[0]; return g ? g.label : id; }
  function ladCsv(id) {
    if (!lad || !lad.snap || !LD() || !LD().csv) return;
    var d = new Date(), p2 = function (n) { return String(n).padStart(2, "0"); };
    var nm = "ladder-" + (String(id === "*" ? "tutti-i-giochi" : ladLabel(id)).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "gioco") + "-" + d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + ".csv";
    var t = LD().csv(lad.snap, id, trUi);
    A.dl(new Blob([(t.charAt(0) === "\ufeff" ? "" : "\ufeff") + t], { type: "text/csv;charset=utf-8" }), nm);
    A.toast("Classifica scaricata: la trovi nella cartella Download.");
  }
  function mvHtml(r, hasPrev) {
    if (!hasPrev) return "";
    /* i lettori di schermo leggono la frase intera (vh); freccia e numero sono solo per chi guarda */
    var vh = function (s) { return '<span class="vh">' + esc(s) + '</span>'; };
    if (r.move == null) return '<span class="ld-new" title="Non era nel calcolo precedente"><span aria-hidden="true">nuovo</span>' + vh(trUi("Nuovo nella classifica")) + '</span>';
    if (r.move > 0) return '<span class="ld-up" title="Posizioni guadagnate dal calcolo precedente"><span aria-hidden="true">▲ ' + r.move + '</span>' + vh(r.move === 1 ? trUi("Salito di una posizione") : tpl("Salito di {n} posizioni", { n: r.move })) + '</span>';
    if (r.move < 0) return '<span class="ld-dn" title="Posizioni perse dal calcolo precedente"><span aria-hidden="true">▼ ' + (-r.move) + '</span>' + vh(r.move === -1 ? trUi("Sceso di una posizione") : tpl("Sceso di {n} posizioni", { n: -r.move })) + '</span>';
    return '<span class="ld-eq" title="Stessa posizione del calcolo precedente"><span aria-hidden="true">=</span>' + vh(trUi("Stessa posizione")) + '</span>';
  }
  function paintLadder() {
    var snap = lad && lad.snap, ok = !!(LD() && LD().compute), bid = pref.lb && boardOf(snap, pref.lb).length ? pref.lb : "*", B = boardOf(snap, bid), hasPrev = !!(lad && lad.prev);
    var h = '<div class="hm-wrap ld">' +
      '<header class="hm-top"><div class="hm-title"><h1 id="hm-h">Ladder</h1><button class="hb" data-help="ladder" title="Guida" aria-label="Apri la guida">?</button></div>' +
      '<div class="hm-tools"><button class="p" data-a="ldcalc"' + (ladBusy || !ok ? " disabled" : "") + '>' + (ladBusy ? "Calcolo in corso…" : "Ricalcola") + '</button>' +
      (snap && B.length && LD().csv ? '<button data-a="ldcsv">Scarica (CSV)</button>' : "") + '<button data-a="ldback" title="Torna all\'elenco dei tornei (Esc)">Tornei</button></div></header>';
    /* durante il calcolo niente si cambia (caselle, impostazioni, giocatori uniti): la fotografia legge i tornei adesso */
    var dis = ladBusy ? " disabled" : "";
    if (ladErr) h += '<p class="ld-stale" role="alert">' + esc(tpl("L'archivio della ladder non si legge ({e}): finché non torna leggibile la ladder non si salva e non si cambia. Chiudi il programma che lo tiene aperto, poi riapri la schermata Ladder.", { e: ladErr })) + '</p>';
    if (ladBroken) h += '<p class="ld-stale" role="status">' + esc(tpl(D && D.ladderRead ? "L'archivio della ladder era rovinato: è stato messo da parte nella cartella dei tornei come {f} e la ladder riparte da capo. Premi Ricalcola per rifare la classifica; giocatori uniti e impostazioni vanno rifatti." : "L'archivio della ladder era rovinato: è stato messo da parte nel browser ({f}) e la ladder riparte da capo. Premi Ricalcola per rifare la classifica; giocatori uniti e impostazioni vanno rifatti.", { f: ladBroken })) + '</p>';
    if (!ok) h += '<p class="hm-none">La ladder non è disponibile in questa versione.</p>';
    else if (!snap) h += '<section class="ld-empty"><p class="ld-lead">' + esc(tpl("Una classifica a punti fra tutti i tornei: tutti partono da {s} punti e ogni partita giocata li sposta.", { s: lad ? lad.cfg.start : ladStart() })) + '</p><p>Premi <b>Ricalcola</b>: legge tutti i tornei che contano e calcola la classifica da zero. La classifica resta quella dell\'ultimo calcolo finché non premi di nuovo Ricalcola.</p></section>';
    else {
      var ne = (snap.events || []).filter(function (e) { return +e.matches > 0; }).length, nm =(snap.events || []).reduce(function (a, e) { return a + (+e.matches || 0); }, 0);
      h += '<p class="ld-when"><span>Ultimo calcolo: <b data-noi18n>' + esc(fmtAt(snap.at)) + '</b></span><span>Tornei contati: <b>' + ne + '</b></span><span>Partite contate: <b>' + nm + '</b></span><span>Giocatori: <b>' + boardOf(snap, "*").length + '</b></span></p>';
      if (ladStale) h += '<p class="ld-stale" role="status">Ci sono risultati nuovi dall\'ultimo calcolo: premi Ricalcola per aggiornare la classifica.</p>';
      if (ladCfgStale()) h += '<p class="ld-stale" role="status">Impostazioni o giocatori uniti cambiati dall\'ultimo calcolo: premi Ricalcola per applicarli.</p>';
      var G = [["*", trUi("Tutti i giochi")]].concat((snap.games || []).filter(function (g) { return g && g.id && boardOf(snap, g.id).length; }).map(function (g) { return [g.id, g.label || g.id]; }));
      if (G.length > 2) h += '<div class="ld-boards" role="group" aria-label="Classifica da mostrare">' + G.map(function (g) { return '<button data-a="ldb" data-v="' + esc(g[0]) + '" aria-pressed="' + (g[0] === bid ? "true" : "false") + '"' + (g[0] === "*" ? "" : " data-noi18n") + '>' + esc(g[1]) + '</button>'; }).join("") + '</div>';
      if (!B.length) h += '<p class="hm-none">Nessuna partita giocata nei tornei che contano. Gioca qualche partita, poi premi Ricalcola.</p>';
      else h += '<div class="ld-tw"><table class="ld-tab"><thead><tr><th class="ld-pos" title="Posizione">#</th><th class="ld-mv"><span class="vh">Variazione</span></th><th class="ld-nm">Giocatore</th><th class="ld-pt">Punti</th><th title="Partite giocate">Partite</th><th class="ld-x" title="Vinte">V</th><th class="ld-x" title="Pareggiate">N</th><th class="ld-x" title="Perse">P</th><th class="ld-x" title="Tornei in cui ha giocato">Tornei</th></tr></thead><tbody>' +
        B.map(function (r) {
          var d = r.delta == null || !hasPrev ? "" : Math.round(r.delta * 10) / 10;
          return '<tr' + (r.pos <= 3 ? ' class="ld-top"' : "") + '><td class="ld-pos"><span>' + esc(r.pos) + '</span></td><td class="ld-mv">' + mvHtml(r, hasPrev) + '</td><td class="ld-nm" data-noi18n>' + esc(r.name) + '</td>' +
            '<td class="ld-pt"><b>' + esc(fmtR(r.rating)) + '</b>' + (d ? '<small class="' + (d > 0 ? "ld-up" : "ld-dn") + '" title="Punti rispetto al calcolo precedente">' + (d > 0 ? "+" : "−") + esc(fmtR(Math.abs(d))) + '</small>' : "") + '</td>' +
            '<td>' + (+r.matches || 0) + '</td><td class="ld-x">' + (+r.w || 0) + '</td><td class="ld-x">' + (+r.d || 0) + '</td><td class="ld-x">' + (+r.l || 0) + '</td><td class="ld-x">' + (+r.events || 0) + '</td></tr>';
        }).join("") + '</tbody></table></div>';
    }
    if (ok) {
      /* tornei che contano: la casella scrive «Conta per la ladder» nel torneo */
      var cnt = {}, skip = {}; ((snap && snap.events) || []).forEach(function (e) { cnt[e.id] = +e.matches || 0; });
      ((snap && Array.isArray(snap.skipped) && snap.skipped) || []).forEach(function (id) { skip[id] = 1; });
      var evl = list.filter(function (e) { return okId(e.id) && !e.broken; }).sort(function (a, b) { return String((b.meta || {}).date || "").localeCompare(String((a.meta || {}).date || "")) || (b.mtime || 0) - (a.mtime || 0); });
      h += '<details class="ld-sec" open><summary>Tornei che contano</summary><p class="hm-note">Le partite dei tornei spuntati spostano i punti. Dentro un torneo puoi escludere un gioco con «Conta per la ladder» nella scheda del gioco; i tornei e i giochi in lavorazione non contano. Dopo un cambio premi Ricalcola.</p>' +
        (evl.length ? '<ul class="ld-evs">' + evl.map(function (e) {
          var m = e.meta || {}, fl = ladFlag(e), dr = !!ladEvm(e).draft;
          /* in lavorazione: la casella resta com'è (vale quando lo togli), ma non si cambia da qui e non conta */
          var note = dr ? '<small class="ld-bad">In lavorazione: non conta finché non lo togli.</small>' : skip[e.id] ? '<small class="ld-bad">' + (D && D.logError ? "Non letto nell'ultimo calcolo: il motivo è in errori.log." : "Non letto nell'ultimo calcolo.") + '</small>' : e.id in cnt ? '<small>Partite contate: ' + cnt[e.id] + '</small>' : "";
          return '<li><label><input type="checkbox" class="ld-evc" data-ev="' + esc(e.id) + '"' + (fl ? " checked" : "") + (dr ? " disabled" : dis) + '><span class="ld-evt" data-noi18n>' + esc(m.title || A.ui0.title) + '</span>' + (fmtDate(m.date) ? '<small>' + esc(fmtDate(m.date)) + '</small>' : "") + note + '</label></li>';
        }).join("") + '</ul>' : '<p class="hm-none">Nessun torneo salvato.</p>') + '</details>';
      /* giocatori uniti */
      var names = boardOf(snap, "*").map(function (r) { return r.name; }).sort(function (a, b) { return String(a).localeCompare(String(b), "it"); }), al = (lad && lad.aliases) || {}, ak = Object.keys(al).sort();
      var opt = function (sel) { return names.map(function (n, i) { return '<option value="' + esc(n) + '"' + (i === sel ? " selected" : "") + '>' + esc(n) + '</option>'; }).join(""); };
      h += '<details class="ld-sec"' + (ak.length ? " open" : "") + '><summary>Unisci giocatori</summary><p class="hm-note">Se la stessa persona compare con nomi scritti in modo diverso (per esempio «Mario» e «mario88»), uniscili: nella ladder conta come un giocatore solo, con il secondo nome. Maiuscole e spazi in più non contano già da soli.</p>' +
        (names.length > 1 ? '<div class="ld-merge"><label>Giocatore<select id="ld-a" data-noi18n>' + opt(0) + '</select></label><label>diventa<select id="ld-b" data-noi18n>' + opt(1) + '</select></label><button data-a="ldmerge"' + dis + '>Unisci</button></div>' : '<p class="hm-none">' + (snap ? "Servono almeno due giocatori nella classifica per unirli." : "Calcola la ladder per scegliere i giocatori da unire.") + '</p>') +
        (ak.length ? '<ul class="ld-al">' + ak.map(function (k) { return '<li><span data-noi18n>' + esc(k) + '</span><span aria-hidden="true">→</span><b data-noi18n>' + esc(al[k]) + '</b><button data-a="ldunal" data-v="' + esc(k) + '"' + dis + '>Separa</button></li>'; }).join("") + '</ul>' : "") + '</details>';
      /* impostazioni e spiegazione */
      var c = lad ? lad.cfg : { start: ladStart(), k: ladKdef() };
      h += '<details class="ld-sec"><summary>Impostazioni e come si muovono i punti</summary><div class="ld-cfg"><label>Punteggio iniziale<input type="number" id="ld-start" min="100" max="10000" step="1" inputmode="numeric" value="' + c.start + '"' + dis + '></label><label>Peso delle partite (K)<input type="number" id="ld-k" min="1" max="200" step="1" inputmode="numeric" value="' + c.k + '"' + dis + '></label></div>' +
        '<ul class="ld-how"><li>' + esc(tpl("Tutti partono da {s} punti. In ogni partita chi vince prende punti da chi perde: quanti dipende dalla differenza di punti prima della partita.", { s: c.start })) + '</li>' +
        '<li>' + esc(tpl("Esempio: due giocatori con {s} punti ciascuno. Chi vince guadagna {d} punti e chi perde ne perde {d}; con un pareggio restano dove sono.", { s: c.start, d: fmtR(c.k / 2) })) + '</li>' +
        '<li>Battere chi ha più punti vale di più, battere chi ne ha meno vale meno; perdere contro chi ne ha meno costa di più.</li>' +
        '<li>A squadre conta la media dei componenti e ognuno riceve la stessa variazione. Free for all: ognuno si confronta con tutti gli altri della stessa manche, secondo la posizione.</li>' +
        '<li>Non contano le vittorie a tavolino, i turni di riposo e le partite senza risultato.</li>' +
        '<li>Il peso K decide quanto si muove la classifica a ogni partita: più è alto, più si muove.</li></ul></details>';
    }
    h += '</div>';
    var y = root.scrollTop, ae = document.activeElement, fk = ae && root.contains(ae) ? (ae.id ? "#" + ae.id : ae.getAttribute("data-a") ? '[data-a="' + ae.getAttribute("data-a") + '"]' + (ae.getAttribute("data-v") != null ? "|" + ae.getAttribute("data-v") : "") : ae.getAttribute("data-ev") ? "ev|" + ae.getAttribute("data-ev") : "") : "";
    var op = {}; Array.prototype.forEach.call(root.querySelectorAll("details.ld-sec"), function (d, i) { op[i] = d.open; });
    var had = !!root.querySelector(".ld"), sv = {};
    /* i giocatori scelti in «Unisci giocatori» restano scelti quando la schermata si ridisegna */
    ["ld-a", "ld-b"].forEach(function (x) { var e = root.querySelector("#" + x); if (e) sv[x] = e.value; });
    root.innerHTML = h; root.scrollTop = y;
    if (had) Array.prototype.forEach.call(root.querySelectorAll("details.ld-sec"), function (d, i) { if (op[i] !== undefined) d.open = op[i]; });
    Object.keys(sv).forEach(function (x) { var e = root.querySelector("#" + x); if (e && Array.prototype.some.call(e.options, function (o) { return o.value === sv[x]; })) e.value = sv[x]; });
    if (fk) {
      var el = null, pv = fk.split("|");
      if (pv[0] === "ev") el = Array.prototype.filter.call(root.querySelectorAll(".ld-evc"), function (x) { return x.getAttribute("data-ev") === pv[1]; })[0];
      else el = Array.prototype.filter.call(root.querySelectorAll(pv[0]), function (x) { return pv.length < 2 || x.getAttribute("data-v") === pv[1]; })[0];
      if (el && !el.disabled) el.focus(); else if (pv[0] === '[data-a="ldcalc"]') { var cb = root.querySelector('[data-a="ldcalc"]'); if (cb) cb.focus(); }
    }
  }
  /* un archivio che non si leggeva si riprova a leggere a ogni apertura della schermata */
  function ladRetry() { if (ladErr) ladReady = ladLoad(); return ladReady; }
  function ladOpen() {
    return ladRetry().then(function () {
      ladOn = true; editing = null; creating = false; paint(); var b = root.querySelector('[data-a="ldcalc"]'); if (b && !b.disabled) b.focus(); ladCheck();
    });
  }
  /* ripristino del backup completo: la ladder del backup al posto di quella di prima, con valori predefiniti e differenze */
  function ladDiff(a, b) {
    var R = [], q = function (l, x, y, u) { x = x == null ? "" : String(x); y = y == null ? "" : String(y); if (x !== y) R.push([l, x || "—", y || "—", u ? 1 : 0]); };
    q("Punteggio iniziale della ladder", a.cfg.start, b.cfg.start); q("Peso delle partite nella ladder (K)", a.cfg.k, b.cfg.k);
    q("Giocatori uniti nella ladder", Object.keys(a.aliases).length, Object.keys(b.aliases).length);
    q("Ultimo calcolo della ladder", a.snap ? fmtAt(a.snap.at) : "", b.snap ? fmtAt(b.snap.at) : "", 1);
    q("Giocatori nella ladder", boardOf(a.snap, "*").length, boardOf(b.snap, "*").length);
    return R;
  }
  /* una ladder mai usata: niente classifica, nessun giocatore unito, impostazioni di base mai toccate */
  function ladUsed(l) { return !!l && (!!l.snap || Object.keys(l.aliases || {}).length > 0 || +l.cfgAt > 0 || l.cfg.start !== ladStart() || l.cfg.k !== ladKdef()); }
  /* prima di sostituirla, la ladder di adesso va da parte: app → cestino/<data>_ladder.json (main.js), browser → chiave
     tornei-v2-ladder-prima. Restituisce dove sta ("" se non c'era un file), errore se non si è potuta copiare */
  function ladKeep(before) {
    if (D && D.ladderBackup) return D.ladderBackup();
    if (!lsSet(LADK + "-prima", JSON.stringify(before))) return Promise.reject(new Error("spazio del browser esaurito"));
    return Promise.resolve(LADK + "-prima");
  }
  /* null: niente da dire (il backup e questa ladder sono tutte e due vuote) */
  function ladImport(o) {
    return ladRetry().then(function () {
      var r = ladFix(o), before = lad || ladFix(null).lad, had = ladUsed(before), F = ladDiff(before, r.lad);
      /* una ladder vuota nel backup non cancella quella che c'è (giocatori uniti e impostazioni non si rifanno con Ricalcola) */
      if (!ladUsed(r.lad)) return had ? { kind: "Ladder", name: "", status: "saltato", why: "La ladder del backup è vuota: resta quella di prima." } : null;
      /* niente copia di quella di prima (o archivio che non si legge e non si copia): non si sostituisce */
      var l0 = lad, e0 = ladErr;
      return (had || ladErr ? ladKeep(before) : Promise.resolve("")).then(function (where) {
        lad = r.lad; ladStale = null; ladErr = null;
        return ladSave().then(function (ok) {
          if (!ok) { lad = l0; ladErr = e0; }
          if (A.rerender) A.rerender();
          if (!ok) return { kind: "Ladder", name: "", status: "saltato", why: "La ladder del backup non si è potuta salvare." };
          return { kind: "Ladder", name: "", status: had ? "sostituito" : "nuovo", defaults: r.D, diffs: F,
            why: where ? tpl(D && D.ladderBackup ? "La ladder di prima è stata messa da parte nella cartella dei tornei: {f}." : "La ladder di prima è stata messa da parte nel browser ({f}).", { f: where }) : "" };
        });
      }, function (e) {
        logL((e && e.stack) || e);
        return { kind: "Ladder", name: "", status: "saltato", why: tpl("La ladder di prima non si è potuta mettere da parte ({e}): resta com'è.", { e: (e && e.message) || e }) };
      });
    });
  }

  /* ---------- apri / chiudi ---------- */
  function open(section) {
    if (!root) build();
    clearTimeout(saveT);
    /* le Impostazioni stanno sopra la home (z-index): si chiudono, come con "Chiudi" */
    var sb = document.getElementById("editbox"); if (sb && !sb.hidden) sb.hidden = true;
    document.documentElement.classList.add("home-on");
    root.hidden = false; ladOn = section === "ladder";
    /* useBot: le Impostazioni di un altro bot (botset) non devono restare il bot "attivo" dell'elenco */
    return flush().then(function () { return useBot(cur()); }).then(function () { if (ladOn) return ladRetry(); }).then(render).then(function () {
      if (ladOn) { var lb = root.querySelector('[data-a="ldcalc"]'); if (lb && !lb.disabled) lb.focus(); ladCheck(); return; }
      var t = section === "bots" ? root.querySelector("#hm-bots") : null;
      if (t) t.scrollIntoView({ block: "start" }); else { var b = root.querySelector(".ev.hero .ev-go") || root.querySelector("[data-a=new]"); if (b) b.focus(); }
    }).catch(function (e) {
      /* l'elenco non si disegna: la home non deve restare uno strato vuoto che copre tutto */
      A.toast("Non riesco a mostrare l'elenco dei tornei: " + ((e && e.message) || e));
      if (!root.querySelector("#hm-close")) close();
    });
  }
  function close() {
    if (!root || root.hidden || !curId()) return;
    editing = null; creating = false; ladOn = false; root.hidden = true; document.documentElement.classList.remove("home-on");
  }
  function formData(f) {
    var o = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) o[x.name] = x.type === "checkbox" ? x.checked : String(x.value || "").trim(); }); return o;
  }
  function build() {
    root = document.createElement("div");
    root.id = "home"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "hm-h"); root.hidden = true;
    document.body.appendChild(root);
    root.addEventListener("click", function (ev) {
      var b = ev.target.closest("button,[data-a]"); if (!b || b.tagName === "FORM") return;
      var a = b.getAttribute("data-a"), c = b.closest("[data-id]"), id = c && c.getAttribute("data-id"), bt = b.closest("[data-bot]"), bid = bt && bt.getAttribute("data-bot");
      if (b.id === "hm-close") return close();
      if (a === "ver") return window.VERSION.open();
      /* ladder */
      if (a === "ladder") return ladOpen();
      if (a === "ldback") { ladOn = false; paint(); var lbk = root.querySelector('[data-a="ladder"]'); if (lbk) lbk.focus(); return; }
      if (a === "ldcalc") return ladRecalc();
      if (a === "ldcsv") { var lb0 = pref.lb && lad && boardOf(lad.snap, pref.lb).length ? pref.lb : "*"; return ladCsv(lb0); }
      if (a === "ldb") { pref.lb = b.getAttribute("data-v") || "*"; savePref(); return paint(); }
      if (a === "ldmerge") { var sa = root.querySelector("#ld-a"), sb = root.querySelector("#ld-b"); if (sa && sb) return ladMerge(sa.value, sb.value); return; }      if (a === "ldunal") return ladUnalias(b.getAttribute("data-v"));
      if (b.id === "hm-view") { pref.view = pref.view === "list" ? "cards" : "list"; savePref(); return paint(); }
      if (a === "new") { creating = true; editing = null; paint(); var t = root.querySelector(".ev.new input[name=title]"); if (t) t.focus(); return; }
      if (a === "cancel") { creating = false; editing = null; return paint(); }
      if (a === "open") return openEv(id);
      if (a === "edit") { editing = id; creating = false; paint(); var i = root.querySelector('.ev[data-id="' + id + '"] input[name=title]'); if (i) i.focus(); return; }
      if (a === "pin") { var e0 = list.filter(function (e) { return e.id === id; })[0]; return editEv(id, { pinned: !(e0 && e0.meta && e0.meta.pinned) }); }
      if (a === "undodel") return undoDel();
      if (a === "dup") { dupAsk = id; return paint(); }
      if (a === "share") { shareAsk = shareAsk === id ? null : id; return paint(); }
      if (a === "shareclose") { shareAsk = null; return paint(); }
      if (a === "sharecopy") { var ta = b.closest(".ev").querySelector(".ev-share textarea"); if (ta && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(function () { A.toast("Messaggio copiato: incollalo dove vuoi."); }, function () { ta.select(); A.toast("Seleziona il testo e copialo con Ctrl+C."); }); return; }
      if (a === "dup0" || a === "dup1") { dupAsk = null; var e1 = list.filter(function (e) { return e.id === id; })[0], m1 = (e1 && e1.meta) || {};
        /* la copia tiene lingua, modalità, indirizzo, ora e link; i canali Discord no (create riparte da un ev nuovo) */
        /* la copia con i risultati non conta per la ladder: le sue partite sono già contate nell'originale */
        return create(Object.assign({}, m1, { title: (m1.title || "Torneo") + " (copia)", sub: m1.sub || "", date: a === "dup1" ? m1.date || "" : "", place: m1.place || "", color: m1.color || "", bot: m1.bot || "", draft: m1.draft, ladder: a === "dup1" ? false : m1.ladder, from: (a === "dup1" ? "copia:" : "tutto:") + id })); }
      if (a === "export") return exportEv(id);
      if (a === "hist") return histEv(id);
      if (a === "trash") return trashEv(id, b);
      if (a === "botadd") return D.botsAdd("Bot " + ((bots || []).length + 1)).then(render).then(function () { var n = root.querySelectorAll(".bt-name"); if (n.length) { n[n.length - 1].focus(); n[n.length - 1].select(); } });
      if (a === "bottog") { var on = b.getAttribute("aria-checked") !== "true"; b.disabled = true; return D.botsEnable(bid, on).then(function (L) { bots = L; paint(); A.toast(on ? "Bot acceso: risponde per tutti i tornei che lo usano." : "Bot spento."); }); }
      if (a === "botuse") { var S = cur(); S.ev = S.ev || {}; S.ev.bot = bid; A.touch(); return D.botsUse(bid).then(function () { clearTimeout(saveT); return flush(); }).then(render).then(function () { A.toast("Il torneo aperto ora usa questo bot."); }); }
      /* Impostazioni di un bot (e iscrizioni da confermare): main mostra quel bot, ma il torneo aperto resta sul suo (per cambiarlo c'è "Usa nel torneo aperto") */
      if (a === "botset") { return (D.botsUse ? D.botsUse(bid) : Promise.resolve()).then(function () { close(); var eb = document.getElementById("editbtn"), box = document.getElementById("editbox"); if (eb && (!box || box.hidden)) eb.click(); else if (A.botRefresh) A.botRefresh(); setTimeout(function () { var x = document.getElementById("botbox"); if (x) x.scrollIntoView({ block: "start" }); }, 300); }); }
      if (a === "botdel") {
        if (!armed["b" + bid]) { armed["b" + bid] = 1; b.textContent = "Conferma"; b.classList.add("danger"); setTimeout(function () { delete armed["b" + bid]; if (b.isConnected) { b.textContent = "Rimuovi"; b.classList.remove("danger"); } }, 4000); return; }
        delete armed["b" + bid];
        var bl = (bots.filter(function (x) { return x.id === bid; })[0] || {}).label || "bot";
        return D.botsRemove(bid).then(function () { remember({ type: "bot", label: bl }); return render(); }).then(function () { A.toast("Bot rimosso: " + bl + "."); });
      }
    });
    root.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target, o = formData(f), id = f.getAttribute("data-id");
      if (!o.title) { A.toast("Dai un nome al torneo."); return; }
      /* un link non riconosciuto non sparisce in silenzio: si avvisa e il modulo resta aperto */
      var bad = [["wa", "Il link del gruppo WhatsApp non è valido."], ["tg", "Il link di Telegram non è valido."], ["discord", "Il link di invito di Discord non è valido."], ["maps", "Il link di Google Maps non è valido."]].filter(function (k) { return o[k[0]] && !linkOk(o[k[0]], k[0]); })[0];
      if (bad) { A.toast(bad[1]); if (f.elements[bad[0]]) f.elements[bad[0]].focus(); return; }
      if (id) { editing = null; editEv(id, o); } else create(o);
    });
    root.addEventListener("input", function (ev) { if (ev.target.id === "hm-q") { q = ev.target.value; paint(); } });
    root.addEventListener("change", function (ev) {
      var t = ev.target, bt = t.closest("[data-bot]"), bid = bt && bt.getAttribute("data-bot");
      if (t.id === "hm-sort") { pref.sort = t.value; savePref(); return paint(); }
      if (t.classList.contains("ld-evc")) {
        var eid = t.getAttribute("data-ev"), on = t.checked;
        if (ladBusy) { t.checked = !on; return; }
        /* non salvata: la casella torna com'era (l'avviso d'errore l'ha dato editEv) */
        return editEv(eid, { ladder: on }).then(function (ok) { if (!ok) { paint(); return; } A.toast(on ? "Il torneo conta per la ladder: premi Ricalcola." : "Il torneo non conta più per la ladder: premi Ricalcola."); ladCheck(); });
      }
      if (t.id === "ld-start") return ladCfg("start", t.value);
      if (t.id === "ld-k") return ladCfg("k", t.value);
      if (t.id === "hm-file") { if (t.files[0]) importFile(t.files[0]); t.value = ""; return; }
      if (t.classList.contains("bt-name") && bid) return D.botsEdit(bid, { label: t.value }).then(function (L) { bots = L; A.toast("Nome del bot salvato."); });
      if (t.classList.contains("bt-col") && bid) return D.botsEdit(bid, { color: t.value }).then(function (L) { bots = L; paint(); });
    });
    root.addEventListener("keydown", function (ev) {
      /* tastiere IME (giapponese, cinese…): Invio ed Esc in composizione appartengono all'IME */
      if (ev.isComposing || ev.keyCode === 229) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) { ev.preventDefault(); ev.stopPropagation(); undoDel(); return; }
      /* la guida aperta sopra la home si chiude per prima (lo fa app.js) */
      if (ev.key === "Escape" && document.getElementById("help") && !document.getElementById("help").hidden) return;
      if (ev.key === "Escape" && ladOn) { ladOn = false; paint(); var lbk = root.querySelector('[data-a="ladder"]'); if (lbk) lbk.focus(); ev.stopPropagation(); return; }
      if (ev.key === "Escape") { if (editing || creating) { editing = null; creating = false; paint(); } else close(); ev.stopPropagation(); }
      if (ev.key === "Enter" && ladOn && /^ld-(start|k)$/.test(ev.target.id || "")) { ev.preventDefault(); ev.target.blur(); }
      if (ev.key === "Enter" && ev.target.classList && ev.target.classList.contains("bt-name")) ev.target.blur();
    });
  }

  /* pulsante nell'intestazione */
  function apptools() { var t = document.getElementById("apptools"), br = document.querySelector(".brand"); if (!t && br) { t = document.createElement("div"); t.id = "apptools"; br.parentNode.insertBefore(t, br); } return t; }
  var brand = apptools();
  if (brand) {
    var hb = document.createElement("button");
    hb.id = "homebtn"; hb.type = "button"; hb.title = "Tutti i tornei: scegli quale amministrare";
    hb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg><span>Tornei</span>';
    hb.addEventListener("click", function () { open(); });
    brand.appendChild(hb);
  }
  /* backup completo: tutti i tornei; ripristino: quelli con lo stesso codice vanno prima nel cestino */
  function exportAll() {
    clearTimeout(saveT);
    /* flush(true): se il torneo aperto non si salva, il backup non deve contenerne in silenzio una copia vecchia */
    return flush(true).then(function () { return store.list(); }).then(function (L) {
      return Promise.all(L.map(function (e) { return (qq[e.id] || Promise.resolve()).then(function () { return store.read(e.id); }).then(function (t) { var j = JSON.parse(t); return { id: e.id, meta: j.meta || e.meta || {}, state: j.state || j }; }).catch(function () { return null; }); }));
    }).then(function (a) { return a.filter(Boolean); });
  }
  /* ripristino: ogni torneo viene migrato al formato attuale; rep dice per ognuno se è nuovo o sostituito,
     quali valori predefiniti sono stati messi e cosa cambia rispetto a quello di prima */
  /* ladIn: la ladder del backup completo (assente nei backup di prima: quella che c'è resta com'è) */
  function importAll(evs, ladIn) {
    var id0 = curId(), n = 0, rep = [];
    return flush().then(function () { return store.list(); }).then(function (L) {
      var have = {}; L.forEach(function (e) { have[e.id] = 1; });
      return evs.reduce(function (p, e) {
        return p.then(function () {
          var name = (e && e.state && e.state.ui && e.state.ui.title) || (e && e.meta && e.meta.title) || String((e && e.id) || "?");
          if (!e || !okId(e.id) || !okState(e.state)) { rep.push({ kind: "Torneo", name: name, status: "saltato", why: "Dati del torneo non validi nel backup." }); return; }
          var old = have[e.id] ? (e.id === id0 ? Promise.resolve(JSON.parse(JSON.stringify(cur()))) : store.read(e.id).then(function (t) { var j = JSON.parse(t); return j.state || j; }).catch(function () { return null; })) : Promise.resolve(null);
          return old.then(function (prev) {
            var D = [], F = [];
            try { D = A.migrateState(e.state); } catch (err) { D = []; }
            e.state.ev = e.state.ev || {}; e.state.ev.id = e.id;
            try { if (prev) F = A.diffState(prev, e.state); } catch (err) { F = []; }
            rep.push({ kind: "Torneo", name: (e.state.ui && e.state.ui.title) || name, status: have[e.id] ? "sostituito" : "nuovo", defaults: D, diffs: F });
            /* scheda dell'elenco ricalcolata dallo stato migrato; il colore resta quello del backup */
            return metaOf(e.state).catch(function () { return {}; }).then(function (m) {
              if (e.meta && e.meta.accent) m.accent = e.meta.accent;
              /* quello di prima va nel cestino solo nell'app (cartella cestino). Nel browser si sovrascrive al suo posto:
                 se lo spazio non basta la scrittura fallisce e il vecchio resta. Se la scrittura fallisce dopo il cestino, si rimette. */
              var bin = have[e.id] && !store.bin;
              return serial(e.id, function () {
                return (bin ? store.trash(e.id) : Promise.resolve()).then(function () { return store.write(e.id, wrap(e.state, Object.assign({}, e.meta || {}, m))); })
                  .then(function () { n++; }, function (err) { return (bin ? store.untrash(e.id) : Promise.resolve()).then(function () { throw err; }, function () { throw err; }); });
              });
            });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (ladIn && typeof ladIn === "object") return ladImport(ladIn).then(function (b) { if (b) rep.push(b); }, function (e) { rep.push({ kind: "Ladder", name: "", status: "saltato", why: "La ladder del backup non si è potuta leggere." }); logL((e && e.stack) || e); });
    }).then(function () {
      var mine = evs.filter(function (e) { return e && e.id === id0 && okState(e.state); })[0];
      if (mine) { A.load(mine.state); useBot(mine.state); }
      laterOthers(); if (root && !root.hidden) render();
      return { n: n, rep: rep };
    });
  }
  /* cambio di lingua: le parti tradotte qui (opzioni di "Parti da") si ridisegnano */
  if (window.I18N && I18N.onChange) I18N.onChange(function () { if (root && !root.hidden) paint(); });
  window.HOME = { open: open, close: close, flush: flush, undo: undoDel, readState: readState, joinOther: joinOther, editOther: editOther, exportAll: exportAll, importAll: importAll, isOpen: function () { return !!root && !root.hidden; },
    /* ladder: l'archivio in memoria (app.js legge la fotografia per teste di serie e storico), copia per il backup completo */
    /* nel backup solo una ladder usata e letta: una vuota, nel ripristino, non deve sostituire quella che c'è */
    ladder: function () { return lad; }, ladderExport: function () { return lad && !ladErr && ladUsed(lad) ? JSON.parse(JSON.stringify(lad)) : null; },
    ladderOn: function () { return ladOn && !!root && !root.hidden; }, recalc: function () { return ladRecalc(); } };

  /* avvio: il torneo aperto si salva nel suo file (anche per chi arriva da una versione senza elenco), poi l'elenco */
  ensureEv();
  useBot(cur());
  open();
})();
