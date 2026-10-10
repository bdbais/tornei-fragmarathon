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
  var D = A.DESK, esc = A.esc, IDXK = "tornei-evidx", EVK = "tornei-ev:", PREFK = "tornei-home";
  var root = null, list = [], bots = null, armed = {}, editing = null, creating = false, saveT = null, q = "", dupAsk = null, lastDel = null, delT = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  var pref = (function () { try { return JSON.parse(lsGet(PREFK) || "{}"); } catch (e) { return {}; } })();
  function savePref() { lsSet(PREFK, JSON.stringify(pref)); }

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
      var x = this.idx(); x[id] = { mtime: Date.now(), meta: JSON.parse(txt).meta }; lsSet(IDXK, JSON.stringify(x));
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
        title: (S.ui && S.ui.title) || A.ui0.title, sub: (S.ui && S.ui.sub) || "", date: ev.date || "", place: ev.place || "",
        color: ev.color || "", accent: acc, logo: lg, games: A.games(JSON.parse(JSON.stringify(S))),
        players: (S.roster || []).length, bot: ev.bot || "", pinned: !!ev.pinned, draft: !!ev.draft, created: ev.created || Date.now(), updated: Date.now()
      };
    });
  }
  function wrap(S, meta) { return JSON.stringify({ app: "tornei-fragmarathon", kind: "evento", v: 1, meta: meta, state: S }); }
  function flush() {
    ensureEv();
    var S = cur();
    return metaOf(S).then(function (m) { return store.write(S.ev.id, wrap(S, m)); })
      .catch(function (e) { A.toast("Salvataggio del torneo non riuscito: " + ((e && e.message) || e)); });
  }
  A.onSave = function () { clearTimeout(saveT); saveT = setTimeout(flush, 1500); };
  window.addEventListener("beforeunload", function () { if (saveT) { clearTimeout(saveT); flush(); } });

  function useBot(S) { if (D && D.botsUse) return D.botsUse((S.ev && S.ev.bot) || "").catch(function () {}); return Promise.resolve(); }

  /* ---------- azioni ---------- */
  function template(g, keep) {
    var t = { name: g.name || "", mode: g.mode, ng: g.ng || 2, players: keep ? (g.players || []).slice() : [], members: keep ? (g.members || {}) : {}, phase: "setup", groups: null, rounds: null };
    ["team", "plat", "logo", "calc", "nq", "tsize", "ffaGs", "ffaAdv", "swR", "swTop", "hidden", "cam"].forEach(function (k) { if (g[k] !== undefined) t[k] = g[k]; });
    return t;
  }
  function readState(id) {
    if (id === curId()) return Promise.resolve(JSON.parse(JSON.stringify(cur())));
    return store.read(id).then(function (t) { var j = JSON.parse(t); return j.state || j; });
  }
  function openEv(id) {
    if (id === curId()) { close(); return; }
    clearTimeout(saveT);
    flush().then(function () { return readState(id); }).then(function (st) {
      if (!st || typeof st.games !== "object") throw new Error("file non valido");
      st.ev = st.ev || {}; st.ev.id = id;
      A.load(st); useBot(st); close();
      A.toast("Torneo aperto: " + ((st.ui && st.ui.title) || A.ui0.title) + ".");
    }).catch(function (e) { A.toast("Non riesco ad aprire il torneo: " + ((e && e.message) || e)); });
  }
  function create(f) {
    var from = f.from.split(":"), base = from[1] ? readState(from[1]) : Promise.resolve(null);
    clearTimeout(saveT);
    flush().then(function () { return base; }).then(function (src) {
      var keep = from[0] === "tutto", st;
      if (src && from[0] === "copia") st = src;
      else if (src) {
        st = src; Object.keys(st.games || {}).forEach(function (k) { st.games[k] = template(st.games[k], keep); });
        if (!keep) { st.roster = []; st.teams = []; }
      } else st = { cur: "quake", roster: [], games: {}, ui: {} };
      st.ui = st.ui || {}; st.ui.title = f.title; st.ui.sub = f.sub;
      st.ev = { id: newId(), created: Date.now(), date: f.date, place: f.place, color: f.color, draft: !!f.draft, bot: f.bot || (src && src.ev && src.ev.bot) || "" };
      A.load(st); useBot(st); creating = false;
      return flush().then(function () { close(); A.toast("Torneo creato: " + f.title + ". Aggiungi giochi e giocatori."); });
    }).catch(function (e) { A.toast("Non riesco a creare il torneo: " + ((e && e.message) || e)); });
  }
  function editEv(id, f) {
    function apply(st) {
      st.ui = st.ui || {}; st.ev = st.ev || {};
      if (f.title !== undefined) { st.ui.title = f.title; st.ui.sub = f.sub; st.ev.date = f.date; st.ev.place = f.place; st.ev.color = f.color; st.ev.draft = !!f.draft; }
      if (f.bot !== undefined) st.ev.bot = f.bot;
      if (f.pinned !== undefined) st.ev.pinned = f.pinned;
    }
    if (id === curId()) {
      var S = cur(); apply(S); A.load(S); if (f.bot !== undefined) useBot(S);
      clearTimeout(saveT); return flush().then(render);
    }
    return store.read(id).then(function (t) {
      var j = JSON.parse(t), st = j.state || j, m = j.meta || {};
      apply(st);
      m.title = st.ui.title || m.title; m.sub = st.ui.sub || ""; m.date = st.ev.date || ""; m.place = st.ev.place || ""; m.color = st.ev.color || "";
      m.bot = st.ev.bot || ""; m.pinned = !!st.ev.pinned; m.draft = !!st.ev.draft;
      return store.write(id, wrap(st, m));
    }).then(render).catch(function (e) { A.toast("Modifica non salvata: " + ((e && e.message) || e)); });
  }
  function exportEv(id) {
    var p = id === curId() ? flush().then(function () { return store.read(id); }) : store.read(id);
    p.then(function (t) {
      var m = JSON.parse(t).meta || {}, name = String(m.title || "torneo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "");
      A.dl(new Blob([t], { type: "application/json" }), (name || "torneo") + ".torneo.json");
      A.toast("Torneo esportato: lo trovi nella cartella Download.");
    }).catch(function (e) { A.toast("Esportazione non riuscita: " + ((e && e.message) || e)); });
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var j; try { j = JSON.parse(r.result); } catch (e) { A.toast("Il file non è un torneo."); return; }
      if (j && j.kind === "torneo") { A.toast("Questo file contiene un solo gioco: apri un torneo e riprendilo da Archivio."); return; }
      var st = j && j.kind === "evento" ? j.state : j;
      if (!st || typeof st.games !== "object" || Array.isArray(st.games)) { A.toast("Il file non è un torneo salvato da questo programma."); return; }
      st.ev = Object.assign({}, st.ev || {}, { id: newId(), created: Date.now() });
      var m = Object.assign({}, j.meta || {}, { title: (st.ui && st.ui.title) || (j.meta && j.meta.title) || "Torneo importato", updated: Date.now(), pinned: false });
      if (!m.games) m.games = A.games(JSON.parse(JSON.stringify(st)));
      store.write(st.ev.id, wrap(st, m)).then(function () { A.toast("Torneo importato: " + m.title + "."); render(); })
        .catch(function (e) { A.toast("Importazione non riuscita: " + ((e && e.message) || e)); });
    };
    r.readAsText(file);
  }
  function remember(d) {
    lastDel = d; clearTimeout(delT); delT = setTimeout(function () { lastDel = null; paint(); }, 60000);
  }
  function undoDel() {
    var d = lastDel; if (!d) return Promise.resolve();
    lastDel = null; clearTimeout(delT);
    var p = d.type === "bot" ? D.botsUndoRemove() : store.untrash(d.id);
    return p.then(render).then(function () { A.toast("Rimesso: " + d.label + "."); });
  }
  function trashEv(id, btn) {
    if (!armed[id]) {
      armed[id] = 1; btn.textContent = "Conferma"; btn.classList.add("danger");
      setTimeout(function () { delete armed[id]; if (btn.isConnected) { btn.textContent = "Elimina"; btn.classList.remove("danger"); } }, 4000);
      return;
    }
    delete armed[id];
    if (id === curId()) {
      var other = list.filter(function (e) { return e.id !== id; }).sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); })[0];
      if (!other) { A.toast("È l'unico torneo: creane un altro prima di eliminarlo."); return; }
      clearTimeout(saveT);
      return readState(other.id).then(function (st) {
        st.ev = st.ev || {}; st.ev.id = other.id; A.load(st); useBot(st);
        return store.trash(id);
      }).then(function () { remember({ type: "ev", id: id, label: (list.filter(function (e) { return e.id === id; })[0] || { meta: {} }).meta.title || "torneo" }); A.toast("Torneo eliminato. Ora è aperto: " + (other.meta.title || "Torneo") + "."); render(); });
    }
    var gone = (list.filter(function (e) { return e.id === id; })[0] || { meta: {} }).meta.title || "torneo";
    store.trash(id).then(function () {
      remember({ type: "ev", id: id, label: gone });
      A.toast("Torneo eliminato: " + gone + ".");
      render();
    });
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
  function progress(m) {
    var g = m.games || [], n = g.length; if (!n) return 0;
    return Math.round(g.reduce(function (a, x) { return a + (stOf(x.st) === "done" ? 1 : stOf(x.st) === "live" ? 0.5 : 0); }, 0) / n * 100);
  }
  function gamesHtml(m, big) {
    var g = m.games || [];
    if (!g.length) return '<p class="ev-empty">Nessun gioco con giocatori, per ora.</p>';
    return '<ul class="ev-games' + (big ? " big" : "") + '">' + g.map(function (x) {
      var s = stOf(x.st);
      return '<li class="st-' + s + '"><span class="dot" aria-hidden="true"></span><b>' + esc(x.name || x.l) + '</b><small>' +
        (s === "done" && x.top ? "vince " + esc(x.top) : esc(x.st)) + (x.n ? ", " + x.n + (x.n === 1 ? " iscritto" : " iscritti") : "") + '</small></li>';
    }).join("") + '</ul>';
  }
  function whenHtml(m) {
    var a = []; if (fmtDate(m.date)) a.push('<span>' + esc(fmtDate(m.date)) + '</span>'); if (m.place) a.push('<span>' + esc(m.place) + '</span>');
    return a.length ? '<p class="ev-when">' + a.join("") + '</p>' : "";
  }
  function badge(m) {
    return m.logo ? '<img src="' + esc(m.logo) + '" alt="">' : '<span class="ev-ini">' + esc(initials(m.title)) + '</span>';
  }
  function statsHtml(m, e) {
    var b = botName(m.bot), p = progress(m);
    return '<div class="ev-bar" role="img" aria-label="Avanzamento ' + p + ' per cento"><i style="width:' + p + '%"></i></div>' +
      '<p class="ev-stats"><span>' + (m.players || 0) + ' giocatori</span><span>' + ((m.games || []).length) + ' giochi</span>' + (b ? '<span>bot ' + esc(b) + '</span>' : "") + '<span>modificato ' + esc(fmtAgo(e.mtime || m.updated)) + '</span></p>';
  }
  function editForm(m, id) {
    var bo = bots ? '<label>Bot Telegram<select name="bot">' + bots.map(function (b) { return '<option value="' + esc(b.id) + '"' + ((m.bot || bots[0].id) === b.id ? " selected" : "") + '>' + esc(b.label) + (b.username ? " (@" + esc(b.username) + ")" : "") + '</option>'; }).join("") + '</select></label>' : "";
    return '<form class="ev-form" data-id="' + esc(id || "") + '">' +
      '<label class="wide">Nome<input name="title" required maxlength="80" value="' + esc(m.title || "") + '" placeholder="Es. Fragmarathon 28"></label>' +
      '<label class="wide">Sottotitolo<input name="sub" maxlength="120" value="' + esc(m.sub || "") + '" placeholder="Es. 28° Lanparty, sala polivalente"></label>' +
      '<label>Data<input type="date" name="date" value="' + esc(m.date || "") + '"></label>' +
      '<label>Luogo<input name="place" maxlength="80" value="' + esc(m.place || "") + '" placeholder="Città o sala"></label>' +
      '<label class="col">Colore<input type="color" name="color" value="' + esc(evColor(m)) + '"></label>' + bo +
      '<label class="wide chk"><span><input type="checkbox" name="draft"' + (m.draft ? " checked" : "") + '> In lavorazione</span><small>Nel bot lo vedono solo amministratori e organizzatori; nessun avviso ai partecipanti finché non lo togli.</small></label>' +
      (id ? "" : '<label class="wide">Parti da<select name="from"><option value="vuoto">Un torneo vuoto</option>' +
        list.map(function (e) { var t = esc(e.meta.title || "Torneo"); return '<option value="modello:' + esc(e.id) + '">Impostazioni di ' + t + ' (giochi, formule, tema, logo)</option><option value="tutto:' + esc(e.id) + '">' + t + ' con gli stessi giocatori, senza risultati</option>'; }).join("") + '</select></label>') +
      '<div class="ev-formact"><button class="p" type="submit">' + (id ? "Salva" : "Crea torneo") + '</button><button type="button" data-a="cancel">Chiudi</button></div></form>';
  }
  function card(e, hero) {
    var m = e.meta || {}, id = e.id, isCur = id === curId();
    var acts = '<div class="ev-act">' +
      (hero ? '<button class="p ev-go" data-a="open">' + (isCur ? "Continua" : "Apri") + '</button>' : '<button class="p" data-a="open">' + (isCur ? "Continua" : "Apri") + '</button>') +
      '<button data-a="edit">Modifica</button>' + (dupAsk === id ? '<button data-a="dup0">Duplica senza risultati</button><button data-a="dup1">Duplica con i risultati</button>' : '<button data-a="dup" title="Copia di questo torneo, con o senza risultati">Duplica</button>') +
      '<button data-a="export">Esporta</button><button data-a="trash">Elimina</button></div>';
    var pin = '<button class="ev-pin" data-a="pin" aria-pressed="' + (m.pinned ? "true" : "false") + '" title="' + (m.pinned ? "Togli dai preferiti" : "Tieni in cima") + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg></button>';
    var body = editing === id ? editForm(m, id) :
      (hero && isCur ? '<p class="ev-kicker">Aperto adesso</p>' : "") +
      '<h3 class="ev-t">' + esc(m.title || "Torneo senza nome") + (m.draft ? '<span class="ev-draft">in lavorazione</span>' : "") + '</h3>' + (m.sub ? '<p class="ev-sub">' + esc(m.sub) + '</p>' : "") + whenHtml(m) +
      gamesHtml(m, hero) + statsHtml(m, e) + acts;
    return '<article class="ev' + (hero ? " hero" : "") + (isCur ? " cur" : "") + (e.broken ? " broken" : "") + '" data-id="' + esc(id) + '" style="--ev:' + esc(evColor(m)) + '">' +
      '<div class="ev-band">' + badge(m) + '</div><div class="ev-body">' + body + '</div>' + (editing === id ? "" : pin) + '</article>';
  }
  function botsHtml() {
    if (!bots) return "";
    var use = {}; list.forEach(function (e) { var b = (e.meta && e.meta.bot) || bots[0].id; (use[b] = use[b] || []).push(e.meta.title || "Torneo"); });
    return '<section class="hm-bots" id="hm-bots" aria-labelledby="hm-bots-h"><div class="hm-sechead"><h2 id="hm-bots-h">Bot Telegram</h2>' +
      '<p class="hm-note">Ogni bot ha token, ruoli, iscritti e messaggi suoi. Ogni torneo usa il bot che scegli; gira quello del torneo aperto.</p>' +
      '<button data-a="botadd">Nuovo bot</button></div><div class="hm-botlist">' + bots.map(function (b) {
        return '<div class="bt' + (b.active ? " on" : "") + '" data-bot="' + esc(b.id) + '" style="--bt:' + esc(b.color || "#2AABEE") + '">' +
          '<input type="color" class="bt-col" value="' + esc(b.color || "#2AABEE") + '" aria-label="Colore di ' + esc(b.label) + '">' +
          '<div class="bt-main"><input class="bt-name" value="' + esc(b.label) + '" maxlength="60" aria-label="Nome del bot">' +
          '<p>' + (b.username ? "@" + esc(b.username) : (b.hasToken ? "Token salvato, non collegato" : "Token da impostare")) + (b.active ? (b.running ? ", attivo adesso" : ", scelto ma spento") : "") + ', ' + b.people + (b.people === 1 ? " persona" : " persone") + '</p>' +
          '<p class="bt-use">' + (use[b.id] ? "Usato da: " + use[b.id].map(esc).join(", ") : "Nessun torneo lo usa") + '</p></div>' +
          '<div class="bt-act">' + (b.active ? "" : '<button data-a="botuse">Usa nel torneo aperto</button>') + '<button data-a="botset">Impostazioni</button>' +
          (bots.length > 1 ? '<button data-a="botdel">Rimuovi</button>' : "") + '</div></div>';
      }).join("") + '</div></section>';
  }
  function sorted() {
    var s = pref.sort || "recenti", f = q.trim().toLowerCase();
    return list.filter(function (e) {
      if (!f) return true; var m = e.meta || {};
      return [m.title, m.sub, m.place, fmtDate(m.date)].concat((m.games || []).map(function (g) { return g.name || g.l; })).join(" ").toLowerCase().indexOf(f) >= 0;
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
    var id = curId(), all = sorted(), heroE = list.filter(function (e) { return e.id === id; })[0], rest = all.filter(function (e) { return e.id !== id; });
    var h = '<div class="hm-wrap">' +
      '<header class="hm-top"><div class="hm-title"><h1 id="hm-h">Tornei</h1><span class="hm-n">' + list.length + '</span>' + (window.VERSION ? '<button type="button" class="verbtn" data-a="ver" title="Versione del programma: clicca per le novità">v' + esc(window.VERSION.v) + '</button>' : "") + '</div>' +
      '<div class="hm-tools"><input type="search" id="hm-q" placeholder="Cerca per nome, luogo o gioco" value="' + esc(q) + '" aria-label="Cerca un torneo">' +
      '<select id="hm-sort" aria-label="Ordina"><option value="recenti"' + (pref.sort === "recenti" || !pref.sort ? " selected" : "") + '>Modificati di recente</option><option value="data"' + (pref.sort === "data" ? " selected" : "") + '>Data del torneo</option><option value="nome"' + (pref.sort === "nome" ? " selected" : "") + '>Nome</option></select>' +
      '<button id="hm-view" aria-pressed="' + (pref.view === "list" ? "true" : "false") + '" title="Schede o elenco compatto">' + (pref.view === "list" ? "Schede" : "Elenco") + '</button>' +
      '<label class="hm-imp"><input type="file" id="hm-file" accept=".json,application/json" hidden>Importa</label>' +
      (lastDel ? '<button class="undodel" data-a="undodel" title="Rimetti: ' + esc(lastDel.label) + ' (Ctrl+Z)">Annulla cancellazione</button>' : "") + '<button class="p" data-a="new">Nuovo torneo</button>' + (id ? '<button id="hm-close" title="Torna al torneo aperto (Esc)">Chiudi</button>' : "") + '</div></header>';
    if (creating) h += '<section class="ev new" style="--ev:' + esc(evColor({})) + '"><div class="ev-band"><span class="ev-ini">+</span></div><div class="ev-body"><h3 class="ev-t">Nuovo torneo</h3>' + editForm({ date: new Date().toISOString().slice(0, 10) }, "") + '</div></section>';
    if (heroE && !q) h += card(heroE, true);
    var others = q ? all : rest;
    h += others.length ? '<div class="hm-grid' + (pref.view === "list" ? " list" : "") + '">' + others.map(function (e) { return card(e, false); }).join("") + '</div>'
      : (q ? '<p class="hm-none">Nessun torneo corrisponde a “' + esc(q) + '”.</p>' : (list.length < 2 ? '<p class="hm-none">Qui compariranno gli altri tornei. Premi <b>Nuovo torneo</b> per prepararne uno: puoi partire dalle impostazioni di questo.</p>' : ""));
    h += botsHtml() + '</div>';
    var y = root.scrollTop, fo = document.activeElement && document.activeElement.id;
    root.innerHTML = h; root.scrollTop = y;
    if (fo === "hm-q") { var qi = root.querySelector("#hm-q"); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }
  function render() {
    return Promise.all([store.list(), D && D.botsList ? D.botsList().catch(function () { return null; }) : Promise.resolve(null)]).then(function (r) {
      list = (r[0] || []).filter(function (e) { return !e.broken || e.meta; }); bots = r[1] && r[1].length ? r[1] : null; paint();
    });
  }

  /* ---------- apri / chiudi ---------- */
  function open(section) {
    if (!root) build();
    clearTimeout(saveT);
    document.documentElement.classList.add("home-on");
    root.hidden = false;
    return flush().then(render).then(function () {
      var t = section === "bots" ? root.querySelector("#hm-bots") : null;
      if (t) t.scrollIntoView({ block: "start" }); else { var b = root.querySelector(".ev.hero .ev-go") || root.querySelector("[data-a=new]"); if (b) b.focus(); }
    });
  }
  function close() {
    if (!root || root.hidden || !curId()) return;
    editing = null; creating = false; root.hidden = true; document.documentElement.classList.remove("home-on");
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
      if (b.id === "hm-view") { pref.view = pref.view === "list" ? "cards" : "list"; savePref(); return paint(); }
      if (a === "new") { creating = true; editing = null; paint(); var t = root.querySelector(".ev.new input[name=title]"); if (t) t.focus(); return; }
      if (a === "cancel") { creating = false; editing = null; return paint(); }
      if (a === "open") return openEv(id);
      if (a === "edit") { editing = id; creating = false; paint(); var i = root.querySelector('.ev[data-id="' + id + '"] input[name=title]'); if (i) i.focus(); return; }
      if (a === "pin") { var e0 = list.filter(function (e) { return e.id === id; })[0]; return editEv(id, { pinned: !(e0 && e0.meta && e0.meta.pinned) }); }
      if (a === "undodel") return undoDel();
      if (a === "dup") { dupAsk = id; return paint(); }
      if (a === "dup0" || a === "dup1") { dupAsk = null; var e1 = list.filter(function (e) { return e.id === id; })[0], m1 = (e1 && e1.meta) || {}; return create({ title: (m1.title || "Torneo") + " (copia)", sub: m1.sub || "", date: a === "dup1" ? m1.date || "" : "", place: m1.place || "", color: m1.color || "", bot: m1.bot || "", draft: m1.draft, from: (a === "dup1" ? "copia:" : "tutto:") + id }); }
      if (a === "export") return exportEv(id);
      if (a === "trash") return trashEv(id, b);
      if (a === "botadd") return D.botsAdd("Bot " + ((bots || []).length + 1)).then(render).then(function () { var n = root.querySelectorAll(".bt-name"); if (n.length) { n[n.length - 1].focus(); n[n.length - 1].select(); } });
      if (a === "botuse") { var S = cur(); S.ev = S.ev || {}; S.ev.bot = bid; A.touch(); return D.botsUse(bid).then(function () { clearTimeout(saveT); return flush(); }).then(render).then(function () { A.toast("Il torneo aperto ora usa questo bot."); }); }
      if (a === "botset") { var S2 = cur(); var go = S2.ev && S2.ev.bot === bid ? Promise.resolve() : (S2.ev = S2.ev || {}, S2.ev.bot = bid, A.touch(), D.botsUse(bid)); return go.then(function () { close(); var eb = document.getElementById("editbtn"); if (eb) eb.click(); setTimeout(function () { var x = document.getElementById("botbox"); if (x) x.scrollIntoView({ block: "start" }); }, 300); }); }
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
      if (id) { editing = null; editEv(id, o); } else create(o);
    });
    root.addEventListener("input", function (ev) { if (ev.target.id === "hm-q") { q = ev.target.value; paint(); } });
    root.addEventListener("change", function (ev) {
      var t = ev.target, bt = t.closest("[data-bot]"), bid = bt && bt.getAttribute("data-bot");
      if (t.id === "hm-sort") { pref.sort = t.value; savePref(); return paint(); }
      if (t.id === "hm-file") { if (t.files[0]) importFile(t.files[0]); t.value = ""; return; }
      if (t.classList.contains("bt-name") && bid) return D.botsEdit(bid, { label: t.value }).then(function (L) { bots = L; A.toast("Nome del bot salvato."); });
      if (t.classList.contains("bt-col") && bid) return D.botsEdit(bid, { color: t.value }).then(function (L) { bots = L; paint(); });
    });
    root.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) { ev.preventDefault(); ev.stopPropagation(); undoDel(); return; }
      if (ev.key === "Escape") { if (editing || creating) { editing = null; creating = false; paint(); } else close(); ev.stopPropagation(); }
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
  window.HOME = { open: open, close: close, flush: flush, undo: undoDel, isOpen: function () { return !!root && !root.hidden; } };

  /* avvio: il torneo aperto si salva nel suo file (anche per chi arriva da una versione senza elenco), poi l'elenco */
  ensureEv();
  useBot(cur());
  open();
})();
