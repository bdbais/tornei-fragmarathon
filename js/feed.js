/* Tornei Fragmarathon — le notizie di un torneo in un feed RSS 2.0, per MaiTv e per le altre app che leggono un feed.
   Logica pura, senza DOM: riceve i dati dello storico (il JSON in fondo al file .storico.md, schema
   tornei-fragmarathon/storico@1, scritto da js/cronaca.js) e restituisce le notizie o il feed.
   In node: module.exports (lo usa feedserver.js); nella pagina: window.FEED.

   Le notizie sono solo fatti già nello storico (risultati, orari, classifiche) più il commento della cronaca,
   sempre dichiarato come tale («Commento: …»). Password, account e server non ci sono: lo storico non li ha.

   Traduzioni: come in js/cronaca.js ogni frase è un modello italiano intero (TXT) con segnaposto di una lettera;
   si traduce il modello con opt.tr e poi si mettono i nomi, che non si traducono mai.
   tools/i18n-extract.mjs estrae le frasi di TXT. Fasi, stati e formati arrivano già tradotti dallo storico.

   items(data, opt) -> [{ cat, guid, title, desc, at (ms), link }]
     opt: { tr (frase italiana -> lingua del torneo; di base nessuna traduzione), base (URL del server, senza chiave),
            now (ms: orario di ripiego se lo storico non ha generated) }
     guid "<evento>:<gioco>:<partita>:<impronta>": l'impronta cambia con vincitore, punteggio o pareggio, così una
     correzione arriva come notizia nuova; evento, campione e classifica hanno l'impronta del loro contenuto.
     link = base + "/n/" + guid (unico per ogni notizia, senza la chiave). Nel feed RSS però le notizie non hanno <link>:
     MaiTv usa il link come id prima del guid, e il link cambia con l'indirizzo del server (rete, porta, localhost o IP);
     senza link MaiTv usa il guid, che resta lo stesso, e una notizia già andata in onda non torna come nuova.
   rss(data, opt) -> XML RSS 2.0 (UTF-8); opt in più: cat (una sola categoria), self (URL del feed),
     max (quante notizie al massimo, di base 200: le più recenti) */
(function (root) {
  "use strict";

  var CATS = ["evento", "risultati", "prossime-partite", "tabellone"];
  var APP = "Tornei Fragmarathon";
  var SCHEMA = "tornei-fragmarathon/storico@";
  var MAX_TITLE = 120, MAX_DESC = 600, MAX_NEXT = 6, MAX_TABLE = 8, MAX_ITEMS = 200;

  /* Le frasi. Segnaposto: {g} gioco, {f} fase, {w} vincitore, {l} perdente, {a} {b} i due lati, {s} punteggio,
     {e} chi esce, {c} campione o commento, {p} elenco, {t} titolo dell'evento, {n} {k} numeri, {v} nome del programma.
     Le chiavi senza virgolette: l'estrattore prende solo le frasi. */
  var TXT = {
    /* nomi delle categorie, nel titolo del canale */
    catEvento: "Evento",
    catRisultati: "Risultati",
    catProssime: "Prossime partite",
    catTabellone: "Tabellone",
    /* fasi, solo se la partita non ha la sua etichetta */
    final: "Finale",
    semi: "Semifinale",
    third: "Finale per il 3º posto",
    grand: "Finalissima",
    bella: "Bella",
    winners: "Tabellone vincenti",
    losers: "Tabellone perdenti",
    group: "Girone",
    swiss: "Turno svizzero",
    heat: "Manche",
    round: "Turno",
    /* risultati: titolo (dopo «gioco · fase:») */
    join: "{a} e {b}",
    beats: "{w} batte {l}",
    drawPlain: "{a} e {b} pareggiano",
    drawTag: "(pareggio)",
    wins: "vince {w}",
    ffTitle: "{w} vince a tavolino contro {l}",
    heatTie: "primo posto a pari merito: {p}",
    heatNone: "classifica della manche",
    /* risultati: descrizione */
    beatsScore: "{w} batte {l} {s}.",
    beatsOdd: "{w} batte {l}. Punteggio: {s}.",
    beatsNoScore: "{w} batte {l}.",
    ffDesc: "Vittoria a tavolino per {w} contro {l}: la partita non è stata giocata.",
    drawScore: "Pareggio {s} tra {a} e {b}.",
    drawNoScore: "Pareggio tra {a} e {b}.",
    played: "Partita giocata: {p}.",
    out: "Per {e} il torneo finisce qui.",
    podium: "Podio della manche: {p}.",
    heatRank: "Classifica della manche: {p}.",
    adv1: "Passa il turno: {p}.",
    advN: "Passano il turno: {p}.",
    comment: "Commento: {c}",
    /* il nome del torneo, in fondo ai fatti: MaiTv lo legge solo da qui (come «Torneo: …» quando legge il file) */
    tour: "Torneo: {t}.",
    /* campione */
    champTitle: "Il campione di {g} è {c}",
    champDesc: "{c} vince {g}.",
    champPodium: "Podio: {p}.",
    champTeam: "In squadra: {p}.",
    /* prossime partite */
    vs: "{a} contro {b}",
    onField: "in campo {p}",
    nextDuel: "Prossima partita di {g} ({f}): {a} contro {b}.",
    nextHeat: "Prossima manche di {g} ({f}): in campo {p}.",
    /* classifiche */
    tableLive: "{g}: classifica provvisoria",
    tableFinal: "{g}: classifica finale",
    tablePoint: "{g}: il punto sul torneo",
    tableState: "Stato: {s}.",
    tablePlayed: "Partite giocate: {n} su {k}.",
    tableRank: "Classifica: {p}.",
    tableFormat: "Formato: {f}.",
    /* evento */
    evWhere: "Dove: {p}.",
    evWhen: "Quando: {p}.",
    evGames: "In programma: {p}.",
    /* canale */
    chTitle: "{t}: notizie",
    chTitleCat: "{t}: {c}",
    chDesc: "Risultati, prossime partite e classifiche di {t}, dal programma {v}."
  };
  var KIND_TXT = { final: 1, semi: 1, third: 1, grand: 1, bella: 1, winners: 1, losers: 1, group: 1, swiss: 1, heat: 1, round: 1 };
  var CAT_TXT = { evento: "catEvento", risultati: "catRisultati", "prossime-partite": "catProssime", tabellone: "catTabellone" };
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var OWN = Object.prototype.hasOwnProperty;

  /* ---------------- Utilità ---------------- */
  function str(v) { return v == null || typeof v === "object" || typeof v === "function" ? "" : String(v).replace(/\s+/g, " ").trim(); }
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") { var n = Number(v); return isFinite(n) ? n : null; }
    return null;
  }
  function list(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function names(v) { return list(v).map(str).filter(Boolean); }
  /* orario ISO dello storico -> millisecondi, o null */
  function ms(v) {
    if (typeof v !== "string" || !v) return null;
    var t = Date.parse(v);
    return isFinite(t) && t > 0 ? t : null;
  }
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return ("0000000" + (h >>> 0).toString(16)).slice(-8);
  }
  /* impronta di un insieme di valori: due elenchi diversi non danno mai lo stesso testo */
  function mark() { return hash(JSON.stringify(Array.prototype.slice.call(arguments))); }
  /* un solo passaggio: i nomi inseriti non vengono riletti (un nome "{w}" resta "{w}"); un segnaposto sconosciuto
     sparisce. it: modello ancora italiano, quindi "a"/"e" davanti a un nome con la stessa vocale diventano "ad"/"ed" */
  function fill(tpl, vars, it) {
    return String(tpl).replace(/(\b[ae] )?\{([a-zA-Z])\}/g, function (m, p, k) {
      var v = vars[k.toLowerCase()];
      if (v == null) return p || "";
      v = String(v);
      if (p && it && v.charAt(0).toLowerCase() === p.charAt(0)) p = p.charAt(0) + "d ";
      return (p || "") + v;
    });
  }
  /* numeri nel testo: al massimo due decimali, con il separatore della lingua del torneo (come js/cronaca.js) */
  function numFmt(lang) {
    var f = null;
    try { f = new Intl.NumberFormat(lang === "vec" ? "it" : lang || "it", { maximumFractionDigits: 2, useGrouping: false }); } catch (e) { f = null; }
    return function (x) {
      x = Math.round(x * 100) / 100;
      if (x === 0) x = 0;
      var s = f ? f.format(x) : "";
      return s && !/NaN|∞/.test(s) ? s : String(x);
    };
  }
  /* taglio pulito: al massimo n caratteri (punti di codice, come li conta Python), sul confine di una parola se
     possibile, con «…» in fondo */
  function cut(s, n) {
    s = String(s).replace(/\s+/g, " ").trim();
    var a = Array.from(s);
    if (a.length <= n) return s;
    var t = a.slice(0, n - 1).join(""), sp = t.lastIndexOf(" ");
    if (sp >= t.length * 0.6) t = t.slice(0, sp);
    return t.replace(/[\s,;:·–—-]+$/, "") + "…";
  }
  /* fine di una frase: un sottotitolo o un commento senza punto ne prende uno */
  function stop(s) { return s && !/[.!?…]$/.test(s) ? s + "." : s; }
  /* XML: niente caratteri di controllo, surrogati spaiati o non caratteri; poi l'escape dei cinque speciali */
  var XBAD = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(8, 11, 12, 14) + "-" + String.fromCharCode(31, 127, 0xfffe, 0xffff, 0xd800) + "-" + String.fromCharCode(0xdfff) + "]", "gu");
  function xml(s) {
    return String(s == null ? "" : s).replace(XBAD, "").replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&apos;";
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  /* RFC 822 in inglese, in UTC: Sat, 10 Oct 2026 13:00:00 GMT */
  function rfc822(t) {
    var d = new Date(t);
    if (!isFinite(d.getTime())) d = new Date(0);
    return DAYS[d.getUTCDay()] + ", " + pad(d.getUTCDate()) + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() + " " +
      pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + " GMT";
  }
  /* lo storico vale solo con lo schema giusto; altrimenti niente notizie */
  function valid(data) { return !!data && typeof data === "object" && String(data.schema || "").indexOf(SCHEMA) === 0; }

  /* chi vince, chi perde e il punteggio dal lato del vincitore (come js/cronaca.js: nei gironi vince il punteggio) */
  function duel(m) {
    var a = m.sides[0] || "", b = m.sides[1] || "", w = m.winner, draw = m.draw, l = "", W = null, L = null;
    if (!w && !draw && m.score && a && b) {
      if (m.score[0] > m.score[1]) w = a;
      else if (m.score[1] > m.score[0]) w = b;
      else draw = true;
    }
    if (w) l = w === a ? b : w === b ? a : (m.sides.filter(function (x) { return x !== w; })[0] || "");
    if (m.score && w && (w === a || w === b)) { W = w === a ? m.score[0] : m.score[1]; L = w === a ? m.score[1] : m.score[0]; }
    return { a: a, b: b, w: w, l: l, draw: draw, W: W, L: L };
  }

  /* una partita dello storico, ripulita: solo i campi che servono, con i tipi giusti */
  function match(m, i) {
    m = obj(m);
    var sc = Array.isArray(m.score) && m.score.length === 2 ? [num(m.score[0]), num(m.score[1])] : null;
    if (!sc || sc[0] == null || sc[1] == null) sc = null;
    var heat = list(m.heat).map(function (h) {
      h = obj(h);
      var p = num(h.pos);
      return { name: str(h.name), score: num(h.score), pos: p != null && p >= 1 ? Math.floor(p) : null };
    }).filter(function (h) { return h.name; });
    return {
      id: str(m.id) || "m" + (i + 1), i: i, order: num(m.order) != null ? num(m.order) : i, at: ms(m.at), stage: str(m.stage),
      kind: OWN.call(KIND_TXT, m.kind) ? m.kind : (heat.length ? "heat" : "round"), state: str(m.state), sides: names(m.sides),
      score: sc, winner: str(m.winner) || null, draw: m.draw === true, forfeit: m.forfeit === true, eliminated: str(m.eliminated) || null,
      heat: heat.length ? heat : null, advanced: Array.isArray(m.advanced) ? names(m.advanced) : null, bye: m.bye === true, comment: str(m.comment)
    };
  }

  /* ---------------- Le notizie ---------------- */
  function items(data, opt) {
    opt = opt || {};
    if (!valid(data)) return [];
    var trf = typeof opt.tr === "function" ? opt.tr : null;
    function T(s) {
      if (!trf) return s;
      var r;
      try { r = trf(s); } catch (e) { r = null; }
      return typeof r === "string" && r.trim() ? r : s;
    }
    function text(k, v) { var t = TXT[k], x = T(t); return fill(x, v || {}, x === t); }
    function join(a) {
      a = a.filter(Boolean);
      if (a.length < 2) return a[0] || "";
      return text("join", { a: a.slice(0, -1).join(", "), b: a[a.length - 1] });
    }
    function sentences(a) { return a.filter(Boolean).join(" "); }

    var now = num(opt.now);
    if (now == null || now <= 0) now = Date.now();
    var base = String(opt.base || "").replace(/\/+$/, "");
    var gen = ms(data.generated) || now, fmtNum = numFmt(str(data.lang));
    var ev = obj(data.event), title = str(ev.title) || APP;
    var tour = text("tour", { t: title });
    var eid = str(ev.id) || "t" + hash(title);
    function score(x, y) { return fmtNum(x) + "–" + fmtNum(y); }
    function rank(rows, n) {
      return rows.slice(0, n).map(function (s) { return s.pos + "º " + s.name + (s.score != null ? " (" + fmtNum(s.score) + ")" : ""); }).join(", ");
    }

    var out = [], seen = {};
    function add(cat, guid, t, d, at) {
      if (OWN.call(seen, guid)) return;
      seen[guid] = 1;
      out.push({ cat: cat, guid: guid, title: cut(t, MAX_TITLE), desc: cut(d, MAX_DESC), at: at || gen, link: base ? base + "/n/" + encodeURIComponent(guid) : "" });
    }

    var games = list(data.games).map(function (g, gi) {
      g = obj(g);
      var key = str(g.key) || "g" + (gi + 1);
      return {
        i: gi, key: key, name: str(g.name) || str(g.game) || key, done: g.done === true, status: str(g.status),
        formatLabel: str(g.formatLabel) || str(g.format), team: g.team === true, finished: ms(g.finished),
        matches: list(g.matches).map(match),
        standings: list(g.standings).map(function (s, i) {
          s = obj(s);
          var p = num(s.pos);
          return { pos: p != null && p >= 1 ? Math.floor(p) : i + 1, name: str(s.name) };
        }).filter(function (s) { return s.name; }),
        participants: list(g.participants).map(function (p) { p = obj(p); return { name: str(p.name), members: names(p.members) }; }),
        champion: str(g.champion) || null, outro: str(g.outro)
      };
    });
    function stageOf(m) { return m.stage || T(TXT[m.kind]); }

    /* ---- evento ---- */
    var intro = str(ev.intro), where = str(ev.place), when = [str(ev.date), str(ev.time)].filter(Boolean).join(", ");
    var ed = sentences([
      stop(str(ev.subtitle)), intro,
      where ? text("evWhere", { p: where }) : "",
      when ? text("evWhen", { p: when }) : "",
      games.length ? text("evGames", { p: join(games.map(function (g) { return g.name; })) }) : ""
    ]);
    /* l'impronta solo sui dati che non cambiano durante l'evento: l'introduzione della cronaca conta i giochi avviati
       e cambierebbe a ogni gioco che parte (la stessa presentazione andrebbe in onda più volte); il testo si aggiorna
       comunque, con lo stesso guid */
    if (ed) add("evento", eid + ":evento:" + mark(title, where, str(ev.date), str(ev.time)), title, ed, gen);

    /* ---- risultati ---- */
    games.forEach(function (g) {
      var done = g.matches.filter(function (m) { return m.state === "done" && !m.bye; });
      done.forEach(function (m) {
        var head = g.name + " · " + stageOf(m) + ": ", t, D = [], imp;
        /* un fatto che il commento della cronaca dice già con le stesse parole (chi passa, chi esce) non si ripete */
        function fact(s) { if (s && m.comment.indexOf(s) < 0) D.push(s); }
        if (m.heat) {
          var H = m.heat.slice().sort(function (x, y) { return (x.pos == null ? 1e9 : x.pos) - (y.pos == null ? 1e9 : y.pos); });
          var tops = H.filter(function (h) { return h.pos === 1; });
          var w = tops.length === 1 ? tops[0].name : (tops.length ? null : m.winner);
          if (tops.length > 1) t = text("heatTie", { p: join(tops.map(function (h) { return h.name; })) });
          else if (w) t = text("wins", { w: w });
          else t = T(TXT.heatNone);
          var pod = H.filter(function (h) { return h.pos != null && h.pos <= 3; });
          if (pod.length) D.push(text("podium", { p: rank(pod, pod.length) }));
          else D.push(text("heatRank", { p: H.slice(0, MAX_TABLE).map(function (h) { return h.name + (h.score != null ? " (" + fmtNum(h.score) + ")" : ""); }).join(", ") }));
          if (m.advanced && m.advanced.length && m.kind !== "final") fact(text(m.advanced.length === 1 ? "adv1" : "advN", { p: join(m.advanced) }));
          /* l'impronta della manche: chi vince, chi è a pari merito e i punteggi */
          imp = mark(w, tops.length > 1, H.map(function (h) { return [h.name, h.pos, h.score]; }));
        } else {
          var d = duel(m), v = { w: d.w, l: d.l, a: d.a, b: d.b, e: m.eliminated };
          if (d.W != null) v.s = score(d.W, d.L);
          if (m.forfeit && d.w && d.l) { t = text("ffTitle", v); D.push(text("ffDesc", v)); }
          else if (m.score && d.a && d.b) {
            var line = d.a + " " + score(m.score[0], m.score[1]) + " " + d.b;
            t = line;
            if (d.draw) { t += " " + T(TXT.drawTag); D.push(text("drawScore", { a: d.a, b: d.b, s: score(m.score[0], m.score[1]) })); }
            else if (d.w && d.W != null && d.W > d.L) D.push(text("beatsScore", v));
            /* vince chi ha fatto meno punti (o il programma ha deciso a parità): il punteggio si dice com'è */
            else if (d.w) { t += " · " + text("wins", v); D.push(text("beatsOdd", { w: d.w, l: d.l, s: line })); }
            else D.push(text("played", { p: m.sides.join(" – ") }));
          } else if (d.draw && d.a && d.b) { t = text("drawPlain", v); D.push(text("drawNoScore", v)); }
          else if (d.w && d.l) { t = text("beats", v); D.push(text("beatsNoScore", v)); }
          else { t = m.sides.join(" – "); D.push(text("played", { p: m.sides.join(" – ") })); }
          if (m.eliminated) fact(text("out", v));
          imp = mark(d.w || null, m.score, !!d.draw);
        }
        /* il torneo prima del commento: un commento lungo si taglia, il nome del torneo resta */
        D.push(tour);
        if (m.comment) D.push(text("comment", { c: m.comment }));
        add("risultati", eid + ":" + g.key + ":" + m.id + ":" + imp, head + t, sentences(D), m.at || gen);
      });

      /* campione: appena c'è (può arrivare prima della fine, se resta la finale per il 3º posto) */
      if (g.champion) {
        var c = g.champion, cd = [text("champDesc", { c: c, g: g.name })];
        if (g.done && g.standings.length) cd.push(text("champPodium", { p: rank(g.standings.filter(function (s) { return s.pos <= 3; }), 8) }));
        var mb = g.participants.filter(function (p) { return p.name === c; })[0];
        if (g.team && mb && mb.members.length) cd.push(text("champTeam", { p: join(mb.members) }));
        cd.push(tour);
        if (g.outro) cd.push(text("comment", { c: g.outro }));
        var last = done.reduce(function (x, m) { return m.at && m.at > x ? m.at : x; }, 0);
        add("risultati", eid + ":" + g.key + ":campione:" + mark(c), text("champTitle", { g: g.name, c: c }), sentences(cd), g.finished || last || gen);
      }
    });

    /* ---- prossime partite: 6 pronte da giocare, divise fra i giochi a turno (la prima di ogni gioco, poi la seconda…),
       così un girone con molte partite pronte non nasconde gli altri giochi; poi per gioco e ordine del tabellone ---- */
    var byGame = games.map(function (g) {
      return g.matches.filter(function (m) { return m.state === "ready" && m.sides.length >= 2; })
        .sort(function (x, y) { return x.order - y.order || x.i - y.i; }).map(function (m) { return { g: g, m: m }; });
    });
    var next = [];
    for (var r = 0; next.length < MAX_NEXT; r++) {
      var any = false;
      for (var q = 0; q < byGame.length && next.length < MAX_NEXT; q++) if (byGame[q][r]) { next.push(byGame[q][r]); any = true; }
      if (!any) break;
    }
    next.sort(function (x, y) { return x.g.i - y.g.i || x.m.order - y.m.order || x.m.i - y.m.i; });
    next.forEach(function (x) {
      var g = x.g, m = x.m, f = stageOf(m), many = m.sides.length > 2 || m.kind === "heat", t, d;
      if (many) {
        t = text("onField", { p: join(m.sides) });
        d = text("nextHeat", { g: g.name, f: f, p: join(m.sides) });
      } else {
        t = text("vs", { a: m.sides[0], b: m.sides[1] });
        d = text("nextDuel", { g: g.name, f: f, a: m.sides[0], b: m.sides[1] });
      }
      d = sentences([d, tour]);
      add("prossime-partite", eid + ":" + g.key + ":" + m.id + ":" + mark("pronta", m.sides), g.name + " · " + f + ": " + t, d, gen);
    });

    /* ---- classifiche: stato e prime 8 posizioni di ogni gioco che ne ha una; senza classifica (manche in corso)
       solo lo stato e le partite giocate, come fa MaiTv quando legge lo storico dal file ---- */
    games.forEach(function (g) {
      var real = g.matches.filter(function (m) { return !m.bye; });
      if (!g.standings.length && !(g.status && real.length)) return;
      var played = real.filter(function (m) { return m.state === "done"; }).length;
      var t = text(!g.standings.length ? "tablePoint" : g.done ? "tableFinal" : "tableLive", { g: g.name });
      var d = sentences([
        g.status ? text("tableState", { s: g.status }) : "",
        real.length ? text("tablePlayed", { n: played, k: real.length }) : "",
        g.standings.length ? text("tableRank", { p: rank(g.standings, MAX_TABLE) }) : "",
        g.formatLabel ? text("tableFormat", { f: g.formatLabel }) : "",
        tour
      ]);
      add("tabellone", eid + ":" + g.key + ":tabellone:" + mark(t, d), t, d, gen);
    });
    return out;
  }

  /* ---------------- Il feed RSS 2.0 ---------------- */
  function rss(data, opt) {
    opt = opt || {};
    var ok = valid(data), d = ok ? data : {}, ev = obj(d.event);
    var trf = typeof opt.tr === "function" ? opt.tr : null;
    function T(s) {
      if (!trf) return s;
      var r;
      try { r = trf(s); } catch (e) { r = null; }
      return typeof r === "string" && r.trim() ? r : s;
    }
    function text(k, v) { var t = TXT[k], x = T(t); return fill(x, v || {}, x === t); }
    var cat = OWN.call(CAT_TXT, opt.cat) ? opt.cat : "";
    var now = num(opt.now);
    if (now == null || now <= 0) now = Date.now();
    var base = String(opt.base || "").replace(/\/+$/, "");
    var title = str(ev.title) || APP, lang = str(d.lang) || "it";
    var all = items(data, opt).map(function (it, i) { return { it: it, i: i }; }).filter(function (x) { return !cat || x.it.cat === cat; });
    /* le più recenti prima; a parità d'orario l'ordine delle notizie (sempre lo stesso: il feed non cambia se non
       cambia lo storico, e l'ETag del server regge) */
    all.sort(function (x, y) { return y.it.at - x.it.at || x.i - y.i; });
    var max = num(opt.max);
    all = all.slice(0, max != null && max >= 1 ? Math.floor(max) : MAX_ITEMS);
    var chTitle = cat ? text("chTitleCat", { t: title, c: T(TXT[CAT_TXT[cat]]) }) : text("chTitle", { t: title });
    var o = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "<channel>",
      "<title>" + xml(cut(chTitle, 200)) + "</title>",
      "<link>" + xml(base ? base + "/" : "https://github.com/bdbais/tornei-fragmarathon") + "</link>",
      "<description>" + xml(cut(text("chDesc", { t: title, v: APP }), MAX_DESC)) + "</description>",
      "<language>" + xml(lang) + "</language>",
      "<lastBuildDate>" + rfc822(ms(d.generated) || now) + "</lastBuildDate>",
      "<ttl>1</ttl>",
      "<generator>" + APP + "</generator>"];
    if (opt.self) o.push('<atom:link href="' + xml(opt.self) + '" rel="self" type="application/rss+xml"/>');
    all.forEach(function (x) {
      var it = x.it;
      o.push("<item>",
        "<title>" + xml(it.title) + "</title>",
        /* niente <link>: vedi in cima (MaiTv lo userebbe come id, e cambia con l'indirizzo del server) */
        "<description>" + xml(it.desc) + "</description>",
        "<pubDate>" + rfc822(it.at) + "</pubDate>",
        '<guid isPermaLink="false">' + xml(it.guid) + "</guid>",
        "<category>" + xml(it.cat) + "</category>",
        "</item>");
    });
    o.push("</channel>", "</rss>", "");
    return o.filter(function (l) { return l !== ""; }).join("\n") + "\n";
  }

  var API = { CATS: CATS.slice(), SCHEMA: SCHEMA, items: items, rss: rss, rfc822: rfc822, cut: cut, valid: valid };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.FEED = API;
})(this);
