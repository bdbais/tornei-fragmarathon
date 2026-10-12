/* Tornei Fragmarathon — ladder fra tutti i tornei: un punteggio stile Elo, uguale per tutti all'inizio (2000).
   Logica pura, senza DOM: riceve i fatti dei tornei che contano (gli stessi dello storico, js/cronaca.js) e restituisce
   la fotografia della classifica. In node: module.exports; nella pagina: window.LADDER.

   compute(events, opt) -> snapshot. Rifà tutto da zero, partita per partita in ordine di tempo: con gli stessi dati
   dà sempre la stessa fotografia (niente caso, niente orologio se opt.now c'è).
     events: [{ id, title, date "YYYY-MM-DD"|"", time "HH:MM"|"", created ms|0, facts }]: solo i tornei che contano;
       facts = i fatti dello storico ({ games: [...] }, oppure direttamente l'elenco dei giochi), già senza i giochi
       esclusi o in bozza. Un gioco può avere base = chiave di un gioco del programma (la sua copia fatta con Duplica):
       allora conta nella classifica di quel gioco.
     opt: { start (2000), k (32), aliases { nome normalizzato: "Nome canonico" }, prev (fotografia precedente), now }
     snapshot: { v:1, at, start, k, events:[{id,title,date,matches}], games:[{id,label}], boards, aliases }
       boards["*"] = tutti i giochi insieme (una sola valutazione su tutte le partite); boards[gameId] = un gioco solo
       (valutazione separata). Riga: { pos, key, name, rating (1 decimale), matches, w, d, l, events, last (ms|0),
       delta (rispetto a prev, null se nuovo), move (posizione in prev − posizione, null se nuovo) }.
       Pari punteggio = stessa posizione.
       aliases: la copia degli alias usati, così ratingOf funziona anche senza riceverli.

   Regole: E_a = 1/(1+10^((R_b−R_a)/400)), S = 1 vittoria, 0.5 pareggio, 0 sconfitta, Δ = K·(S−E); tutti i Δ di una
   partita si calcolano sui punteggi di prima (aggiornamento simultaneo).
   Squadre: R = media dei componenti, ogni componente riceve lo stesso Δ (squadra senza componenti = il suo nome).
   Manche a più partecipanti: confronto a coppie per posizione (heat[].pos, oppure heat[].rank quando c'è: posizione
   per punteggio che comprende chi si è ritirato dopo aver giocato) (pari posizione = 0.5) con K/(n−1), i Δ si sommano;
   nelle statistiche è una vittoria il primo posto da soli, un pareggio il primo posto condiviso, altrimenti una sconfitta.
   Non contano: tavolini, riposi, partite non giocate, senza vincitore né pareggio, con la stessa persona dai due lati
   (in una manche si salta solo quella coppia).
   Ordine: tornei per data e ora (senza data vale created), poi created, poi id; nel torneo le partite per orario
   (senza orario vale l'inizio del gioco, poi 0), poi ordine dei giochi, poi ordine della partita. */
(function (root) {
  "use strict";

  var START = 2000, K = 32;
  /* giochi predefiniti del programma: la loro chiave è già l'identità fra tornei. I personalizzati hanno una chiave
     nuova in ogni torneo ("c" + base36): li unisce l'etichetta, senza il « (2)» dei duplicati */
  var BUILTIN = ["quake", "tf2", "wreck", "cs2", "fifa"];
  /* intestazioni del CSV: frasi intere, tradotte da chi chiama (tools/i18n-extract.mjs le prende da qui) */
  var HEAD = ["Posizione", "Nome", "Punteggio", "Variazione", "Partite", "Vinte", "Pareggiate", "Perse", "Tornei", "Ultima partita"];
  var OWN = Object.prototype.hasOwnProperty;

  function str(v) { return v == null || typeof v === "object" || typeof v === "function" ? "" : String(v).trim(); }
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") { var n = Number(v); return isFinite(n) ? n : null; }
    return null;
  }
  function list(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === "object" ? v : {}; }
  function r1(x) { var v = Math.round(x * 10) / 10; return v === 0 ? 0 : v; }
  /* un orario in millisecondi (anche una data ISO), altrimenti 0 */
  function time(v) {
    var n = typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : num(v);
    return n != null && n > 0 && isFinite(n) ? n : 0;
  }
  function spell(s) { return str(s).replace(/\s+/g, " "); }
  /* chiave sicura per un oggetto normale (un nome "__proto__" non tocca il prototipo) */
  function put(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); }

  /* identità di un nome: Unicode NFC, spazi uniti, minuscole */
  function norm(name) {
    var s = str(name);
    if (s.normalize) s = s.normalize("NFC");
    return s.replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  /* alias puliti: chiavi normalizzate, niente alias verso sé stessi */
  function cleanAliases(a) {
    var out = {};
    a = obj(a);
    Object.keys(a).sort().forEach(function (k) {
      var n = norm(k), v = spell(a[k]);
      if (n && v && norm(v) !== n && !OWN.call(out, n)) put(out, n, v);
    });
    return out;
  }
  /* nome -> { key (identità, dopo gli alias anche a catena, senza giri infiniti), name (canonico o null) } */
  function resolver(aliases) {
    var A = cleanAliases(aliases), memo = Object.create(null);
    function who(name) {
      var k0 = norm(name);
      if (!k0) return null;
      if (memo[k0]) return memo[k0];
      var key = k0, nm = null, seen = Object.create(null);
      while (OWN.call(A, key) && !seen[key]) {
        seen[key] = 1;
        nm = A[key];
        key = norm(nm);
      }
      return (memo[k0] = { key: key, name: nm });
    }
    /* il nome canonico di ogni identità che è la meta di un alias */
    var canon = Object.create(null);
    Object.keys(A).forEach(function (k) { var r = who(k); if (r.name && !canon[r.key]) canon[r.key] = r.name; });
    who.canon = function (key) { return canon[key] || null; };
    who.aliases = A;
    return who;
  }
  function key(name, aliases) { var r = resolver(aliases)(name); return r ? r.key : ""; }

  /* «Unisci giocatori»: da ora from è la stessa persona di to (e chi puntava a from punta a to).
     Restituisce una mappa nuova, piatta (ogni alias punta direttamente al nome canonico). */
  function alias(aliases, from, to) {
    var A = cleanAliases(aliases), f = norm(from), tk = norm(to);
    if (!f || !tk || f === tk) return A;
    var t = resolver(A)(to);
    /* to porta già a from: adesso la meta è to, quindi to non punta più a niente */
    if (t.key === f) { delete A[tk]; t = resolver(A)(to); }
    if (t.key === f) return A;
    var W = resolver(A), name = t.name || W.canon(t.key) || spell(to);
    Object.keys(A).forEach(function (k) { if (W(k).key === f) put(A, k, name); });
    put(A, f, name);
    delete A[t.key];
    /* piatta: ogni alias punta direttamente al nome canonico (via i giri e gli alias verso sé stessi) */
    var R = resolver(A);
    Object.keys(A).forEach(function (k) { var r = R(k); if (r.key === k) delete A[k]; else put(A, k, r.name); });
    return A;
  }
  /* separa di nuovo un nome unito */
  function unalias(aliases, name) { var A = cleanAliases(aliases); delete A[norm(name)]; return A; }

  /* identità del gioco fra tornei */
  function isCustom(g) {
    if (typeof g.custom === "boolean") return g.custom;
    var k = str(g.key);
    return /^c[a-z0-9]+$/.test(k) && BUILTIN.indexOf(k) < 0;
  }
  function baseLabel(g) { return str(g.game || g.name).replace(/\s*\(\d+\)$/, ""); }
  /* base: il gioco del programma di cui un personalizzato è la copia (Duplica: «Counter-Strike 2 (2)»), lo dice l'app.
     Allora è lo stesso gioco anche per la ladder: stessa classifica */
  function baseKey(g) { var b = str(g.base); return b && BUILTIN.indexOf(b) >= 0 ? b : ""; }
  function gameId(game) {
    var g = obj(game), k = str(g.key), b = baseKey(g);
    if (b) return b;
    if (isCustom(g)) return "c:" + (norm(baseLabel(g)) || k);
    if (!k) return "?";
    return k in Object.prototype ? "k:" + k : k;
  }
  function gameLabel(g) { return spell(isCustom(g) ? baseLabel(g) || g.key : g.game || g.name || g.key); }

  /* momento del torneo: data e ora (ora locale), senza data vale created */
  function evTime(e) {
    var d = /^(\d{4})-(\d\d)-(\d\d)$/.exec(str(e.date)), t = /^(\d\d?):(\d\d)/.exec(str(e.time));
    if (d) { var v = new Date(+d[1], +d[2] - 1, +d[3], t ? +t[1] : 0, t ? +t[2] : 0).getTime(); if (isFinite(v)) return v; }
    return num(e.created) || 0;
  }
  function expect(ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); }

  function compute(events, opt) {
    opt = obj(opt);
    var start = num(opt.start), k = num(opt.k), now = num(opt.now);
    if (start == null || start < 0) start = START;
    if (k == null || k <= 0) k = K;
    if (now == null || now <= 0) now = Date.now();
    var who = resolver(opt.aliases), prev = opt.prev && typeof opt.prev === "object" ? opt.prev : null;
    var pools = Object.create(null), names = Object.create(null), glab = Object.create(null), evOut = [];

    function pool(id) { return pools[id] || (pools[id] = Object.create(null)); }
    function rating(P, id) { return P[id] ? P[id].r : start; }
    function mean(P, ids) { return ids.reduce(function (s, id) { return s + rating(P, id); }, 0) / ids.length; }
    /* un lato: i componenti della squadra, o il nome stesso */
    function side(x, name) {
      var mb = x.P["\u0001" + name], src = mb && mb.length ? mb : [name], ids = [], raw = [], seen = Object.create(null);
      src.forEach(function (n) { var r = who(n); if (r && !seen[r.key]) { seen[r.key] = 1; ids.push(r.key); raw.push(spell(n)); } });
      return { ids: ids, raw: raw };
    }
    function overlap(a, b) { return a.some(function (id) { return b.indexOf(id) >= 0; }); }
    function upd(P, id, d, s, x) {
      var e = P[id] || (P[id] = { r: start, n: 0, w: 0, d: 0, l: 0, ev: Object.create(null), nev: 0, last: 0 });
      e.r += d; e.n++;
      if (s === 1) e.w++; else if (s === 0.5) e.d++; else e.l++;
      if (!e.ev[x.ei]) { e.ev[x.ei] = 1; e.nev++; }
      if (x.t > e.last) e.last = x.t;
    }
    function seen(x, sides) {
      glab[x.gid] = gameLabel(x.g);
      sides.forEach(function (sd) { sd.ids.forEach(function (id, i) { names[id] = sd.raw[i]; }); });
    }
    function duel(x) {
      var m = x.m, sd = list(m.sides).map(str);
      if (sd.length !== 2 || !sd[0] || !sd[1] || sd[0] === sd[1]) return false;
      var w = str(m.winner), draw = !!m.draw && !w;
      if (!draw && w !== sd[0] && w !== sd[1]) return false;
      var A = side(x, sd[0]), B = side(x, sd[1]);
      if (!A.ids.length || !B.ids.length || overlap(A.ids, B.ids)) return false;
      var sa = draw ? 0.5 : w === sd[0] ? 1 : 0;
      ["*", x.gid].forEach(function (pid) {
        var P = pool(pid), d = k * (sa - expect(mean(P, A.ids), mean(P, B.ids)));
        A.ids.forEach(function (id) { upd(P, id, d, sa, x); });
        B.ids.forEach(function (id) { upd(P, id, -d, 1 - sa, x); });
      });
      seen(x, [A, B]);
      return true;
    }
    function heat(x) {
      var H = [], used = Object.create(null), i, j;
      /* rank (se c'è): la posizione per punteggio fra tutti quelli che hanno un punteggio, anche chi si è ritirato
         dopo aver giocato la manche (in pos non ha posizione); così la manche giocata conta per tutti */
      var rk = x.m.heat.some(function (h) { return h && typeof h === "object" && num(h.rank) != null; });
      x.m.heat.forEach(function (h) {
        h = obj(h);
        var n = str(h.name), p = num(rk ? h.rank : h.pos);
        if (!n || p == null || p < 1 || used["\u0001" + n]) return;
        used["\u0001" + n] = 1;
        var s = side(x, n);
        if (s.ids.length) H.push({ p: Math.floor(p), s: s, on: false });
      });
      var n = H.length, pairs = [];
      if (n < 2) return false;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        if (overlap(H[i].s.ids, H[j].s.ids)) continue;
        pairs.push([i, j, H[i].p < H[j].p ? 1 : H[i].p === H[j].p ? 0.5 : 0]);
        H[i].on = H[j].on = true;
      }
      if (!pairs.length) return false;
      var kk = k / (n - 1), best = Math.min.apply(null, H.map(function (h) { return h.p; }));
      var nb = H.filter(function (h) { return h.p === best; }).length;
      ["*", x.gid].forEach(function (pid) {
        var P = pool(pid), R = H.map(function (h) { return mean(P, h.s.ids); }), D = H.map(function () { return 0; }), did = Object.create(null);
        pairs.forEach(function (q) { var d = kk * (q[2] - expect(R[q[0]], R[q[1]])); D[q[0]] += d; D[q[1]] -= d; });
        H.forEach(function (h, hi) {
          if (!h.on) return;
          var s = h.p === best ? (nb > 1 ? 0.5 : 1) : 0;
          h.s.ids.forEach(function (id) { if (did[id]) P[id].r += D[hi]; else { did[id] = 1; upd(P, id, D[hi], s, x); } });
        });
      });
      seen(x, H.filter(function (h) { return h.on; }).map(function (h) { return h.s; }));
      return true;
    }
    function play(x) {
      var m = x.m;
      if (m.state !== "done" || m.forfeit || m.bye) return false;
      return Array.isArray(m.heat) && m.heat.length ? heat(x) : duel(x);
    }

    var EV = list(events).map(function (e, i) { e = obj(e); return { e: e, i: i, t: evTime(e), c: num(e.created) || 0, id: str(e.id) }; });
    EV.sort(function (a, b) { return a.t - b.t || a.c - b.c || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || a.i - b.i; });
    EV.forEach(function (ev, ei) {
      var f = ev.e.facts, games = Array.isArray(f) ? f : list(obj(f).games), M = [], cnt = 0;
      games.forEach(function (g, gi) {
        if (!g || typeof g !== "object") return;
        var gid = gameId(g), st = time(g.started), P = Object.create(null);
        list(g.participants).forEach(function (p) {
          p = p && typeof p === "object" ? p : { name: p };
          var n = str(p.name);
          if (n && !P["\u0001" + n]) P["\u0001" + n] = list(p.members).map(str).filter(Boolean);
        });
        list(g.matches).forEach(function (m, mi) {
          if (!m || typeof m !== "object") return;
          var at = time(m.at), o = num(m.order);
          M.push({ m: m, g: g, gid: gid, gi: gi, P: P, ei: ei, t: at > 0 ? at : st, o: o == null ? mi : o, mi: mi });
        });
      });
      M.sort(function (a, b) { return a.t - b.t || a.gi - b.gi || a.o - b.o || a.mi - b.mi; });
      M.forEach(function (x) { if (play(x)) cnt++; });
      evOut.push({ id: ev.id, title: str(ev.e.title), date: str(ev.e.date), matches: cnt });
    });

    function cmpName(a, b) { return a.name.localeCompare(b.name) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); }
    function board(pid) {
      var P = pools[pid], L = Object.keys(P).map(function (id) {
        var e = P[id];
        return { pos: 0, key: id, name: who.canon(id) || names[id] || id, rating: r1(e.r), matches: e.n, w: e.w, d: e.d, l: e.l, events: e.nev, last: e.last, delta: null, move: null };
      });
      L.sort(function (a, b) { return b.rating - a.rating || b.matches - a.matches || cmpName(a, b); });
      L.forEach(function (e, i) { e.pos = i && e.rating === L[i - 1].rating ? L[i - 1].pos : i + 1; });
      var pb = prev && prev.boards && typeof prev.boards === "object" && OWN.call(prev.boards, pid) && Array.isArray(prev.boards[pid]) ? prev.boards[pid] : null;
      if (pb) {
        var old = Object.create(null);
        pb.forEach(function (e) { if (e && typeof e.key === "string" && !old[e.key]) old[e.key] = e; });
        L.forEach(function (e) {
          var o = old[e.key];
          if (!o) return;
          if (typeof o.rating === "number" && isFinite(o.rating)) e.delta = r1(e.rating - o.rating);
          if (typeof o.pos === "number" && isFinite(o.pos)) e.move = o.pos - e.pos;
        });
      }
      return L;
    }

    var games = Object.keys(glab).map(function (id) { return { id: id, label: glab[id] }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    var boards = { "*": pools["*"] ? board("*") : [] };
    games.forEach(function (g) { put(boards, g.id, board(g.id)); });
    return { v: 1, at: now, start: start, k: k, events: evOut, games: games, boards: boards, aliases: who.aliases };
  }

  /* media dei punteggi di uno o più nomi (una squadra: i componenti) nella classifica del gioco; se lì non c'è nessuno
     vale la classifica di tutti i giochi (solo se only è vero, niente ripiego: null); null se nessuno ha un punteggio.
     aliases: quelli di adesso (di base quelli della fotografia). */
  var IDX = typeof WeakMap === "function" ? new WeakMap() : null, RES = typeof WeakMap === "function" ? new WeakMap() : null;
  /* il risolutore degli alias della fotografia si costruisce una volta sola (chi chiama non cambia snap.aliases):
     ratingOf si chiama per ogni partecipante di ogni gioco */
  function snapWho(s) {
    var a = s.aliases, r = RES && a && typeof a === "object" ? RES.get(a) : null;
    if (r) return r;
    r = resolver(a);
    if (RES && a && typeof a === "object") RES.set(a, r);
    return r;
  }
  function index(L) {
    var x = IDX && IDX.get(L);
    if (x) return x;
    x = Object.create(null);
    L.forEach(function (e) { if (e && typeof e.key === "string" && typeof e.rating === "number" && isFinite(e.rating) && !(e.key in x)) x[e.key] = e.rating; });
    if (IDX) IDX.set(L, x);
    return x;
  }
  function ratingOf(snap, gid, nm, aliases, only) {
    var B = obj(obj(snap).boards), who = aliases !== undefined ? resolver(aliases) : snapWho(obj(snap)), keys = [];
    (Array.isArray(nm) ? nm : [nm]).forEach(function (n) { var r = who(n); if (r && keys.indexOf(r.key) < 0) keys.push(r.key); });
    function avg(bid) {
      if (!OWN.call(B, bid) || !Array.isArray(B[bid])) return null;
      var I = index(B[bid]), s = 0, c = 0;
      keys.forEach(function (k) { if (k in I) { s += I[k]; c++; } });
      return c ? r1(s / c) : null;
    }
    var v = gid != null && String(gid) !== "*" ? avg(String(gid)) : null;
    return v != null || (only && gid != null && String(gid) !== "*") ? v : avg("*");
  }

  /* CSV di una classifica: separatore ";", intestazioni tradotte con tr, decimali con la virgola (opt.dec "." per il
     punto), BOM per Excel. Un testo che comincia con = + - @ prende un apostrofo davanti (Excel lo eseguirebbe). */
  function csvSafe(v) { var x = String(v == null ? "" : v); return typeof v === "string" && /^[=+\-@\t\r]/.test(x) && !/^[+-]?\d+(?:[.,]\d+)?$/.test(x) ? "'" + x : x; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function csv(snap, bid, tr, opt) {
    var B = obj(obj(snap).boards), L = OWN.call(B, bid) && Array.isArray(B[bid]) ? B[bid] : [], dec = obj(opt).dec === "." ? "." : ",";
    function T(s) { var r = null; if (typeof tr === "function") { try { r = tr(s); } catch (e) { r = null; } } return typeof r === "string" && r.trim() ? r : s; }
    function n1(x) { return typeof x === "number" && isFinite(x) ? r1(x).toFixed(1).replace(".", dec) : ""; }
    function day(t) { var d = new Date(t); return t > 0 && !isNaN(d.getTime()) ? d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) : ""; }
    var rows = [HEAD.map(T)];
    L.forEach(function (e) {
      e = obj(e);
      rows.push([e.pos, str(e.name), n1(e.rating), typeof e.delta === "number" ? (e.delta > 0 ? "+" : "") + n1(e.delta) : "", e.matches, e.w, e.d, e.l, e.events, day(e.last)]);
    });
    return "﻿" + rows.map(function (r) { return r.map(function (v) { return '"' + csvSafe(v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\r\n");
  }

  /* contenuto del file della ladder (ladder.json, o localStorage nella versione web), ripulito:
     { v:1, cfg:{start,k}, aliases, snap, prev }. Un dato strano diventa il valore di base, mai un errore;
     gli altri campi dell'app (es. firme dei tornei) restano come sono. */
  function isSnap(s) { return !!(s && typeof s === "object" && s.boards && typeof s.boards === "object" && Array.isArray(s.boards["*"])); }
  function clean(d) {
    d = obj(d);
    var c = obj(d.cfg), st = num(c.start), kk = num(c.k), out = {
      v: 1,
      cfg: { start: st != null && st >= 0 ? st : START, k: kk != null && kk > 0 ? kk : K },
      aliases: cleanAliases(d.aliases),
      snap: isSnap(d.snap) ? d.snap : null,
      prev: isSnap(d.prev) ? d.prev : null
    };
    Object.keys(d).forEach(function (k) { if (!OWN.call(out, k)) put(out, k, d[k]); });
    return out;
  }

  var API = {
    START: START, K: K, BUILTIN: BUILTIN, HEAD: HEAD,
    norm: norm, key: key, alias: alias, unalias: unalias, gameId: gameId,
    compute: compute, ratingOf: ratingOf, csv: csv, clean: clean
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.LADDER = API;
})(this);
