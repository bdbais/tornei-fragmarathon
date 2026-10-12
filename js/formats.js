/* Tornei Fragmarathon — logica pura dei formati di torneo.
   Nessun accesso al DOM: le funzioni ricevono dati e restituiscono dati, così si possono
   provare con `npm test` (node --test). Nel browser sono esposte come window.TF. */
(function (root) {
  "use strict";

  /* Ordine dei semi in un tabellone da P posti (1 contro P, 2 contro P-1, ...). */
  function seedOrder(P) {
    var ord = [1];
    while (ord.length < P) {
      var L = ord.length * 2, nx = [];
      ord.forEach(function (x) { nx.push(x); nx.push(L + 1 - x); });
      ord = nx;
    }
    return ord;
  }

  /* ---------------- Doppia eliminazione ----------------
     Struttura: lista di partite con "sorgenti" (seme, vincitore di, perdente di).
     I risultati sono salvati a parte (res[id] = {a,b,sa,sb,w}) e valgono solo se la coppia
     di partecipanti è ancora la stessa: se cambia un risultato a monte, quelli a valle
     non più validi vengono ignorati da soli. */
  function deBuild(n) {
    var P = 2, k = 1;
    while (P < n) { P *= 2; k++; }
    var ord = seedOrder(P), WB = [], LB = [], i, r;
    var first = [];
    for (i = 0; i < P / 2; i++) first.push({ id: "W0-" + i, a: { s: ord[2 * i] - 1 }, b: { s: ord[2 * i + 1] - 1 } });
    WB.push(first);
    for (r = 1; r < k; r++) {
      var rd = [];
      for (i = 0; i < P / Math.pow(2, r + 1); i++) rd.push({ id: "W" + r + "-" + i, a: { w: "W" + (r - 1) + "-" + (2 * i) }, b: { w: "W" + (r - 1) + "-" + (2 * i + 1) } });
      WB.push(rd);
    }
    var lbFinal = null;
    if (k >= 2) {
      var l0 = [];
      for (i = 0; i < P / 4; i++) l0.push({ id: "L0-" + i, a: { l: "W0-" + (2 * i) }, b: { l: "W0-" + (2 * i + 1) } });
      LB.push(l0);
      for (var j = 1; j < k; j++) {
        var prev = LB[LB.length - 1], cnt = prev.length, drop = [], li = LB.length;
        for (i = 0; i < cnt; i++) {
          var x = j % 2 ? cnt - 1 - i : i; /* ordine invertito a turni alterni: evita le rivincite immediate */
          drop.push({ id: "L" + li + "-" + i, a: { w: prev[i].id }, b: { l: WB[j][x].id } });
        }
        LB.push(drop);
        if (j < k - 1) {
          var red = [], ri = LB.length;
          for (i = 0; i < drop.length / 2; i++) red.push({ id: "L" + ri + "-" + i, a: { w: drop[2 * i].id }, b: { w: drop[2 * i + 1].id } });
          LB.push(red);
        }
      }
      lbFinal = LB[LB.length - 1][0].id;
    }
    var wbFinal = WB[WB.length - 1][0].id;
    var GF = { id: "GF", a: { w: wbFinal }, b: lbFinal ? { w: lbFinal } : { l: wbFinal } };
    return { P: P, k: k, WB: WB, LB: LB, GF: GF, wbFinal: wbFinal, lbFinal: lbFinal };
  }

  /* undefined = da definire, null = posto vuoto (bye), stringa = nome.
     out (facoltativo): funzione vera per chi ha lasciato il torneo. In una partita pronta senza un risultato
     salvato valido vince a tavolino l'altro (e.ff, senza punteggio). out può restituire l'ordine di ritiro (1, 2, ...):
     se sono ritirati entrambi passa chi si è ritirato dopo (era ancora in gara quando l'altro è uscito, quindi il
     tavolino già vinto resta suo); con out vero/falso passa a. */
  function deEval(st, seeds, res, reset, out) {
    res = res || {};
    var M = {};
    /* il tabellone perdenti dipende dal vincenti dello stesso livello: valutiamo per livelli */
    var all = [];
    st.WB.forEach(function (rd, r) { rd.forEach(function (m) { all.push({ m: m, lv: r * 2 }); }); });
    st.LB.forEach(function (rd, r) { rd.forEach(function (m) { all.push({ m: m, lv: r + 1.5 }); }); });
    all.sort(function (x, y) { return x.lv - y.lv; });
    function src(s) {
      if (s.s !== undefined) { var v = seeds[s.s]; return v == null ? null : v; }
      var e = M[s.w || s.l];
      if (!e) return undefined;
      return s.w ? e.w : e.l;
    }
    function ev(m) {
      var a = src(m.a), b = src(m.b), e = { id: m.id, a: a, b: b, w: undefined, l: undefined, sa: null, sb: null, ready: false, bye: false };
      if (a === undefined || b === undefined) {
        if (a === null && b === undefined || b === null && a === undefined) e.l = null;
      } else if (a === null && b === null) { e.w = null; e.l = null; e.bye = true; }
      else if (a === null) { e.w = b; e.l = null; e.bye = true; }
      else if (b === null) { e.w = a; e.l = null; e.bye = true; }
      else {
        e.ready = true;
        var r = res[m.id];
        if (r && ((r.a === a && r.b === b) || (r.a === b && r.b === a))) {
          var sw = r.a !== a;
          e.sa = sw ? r.sb : r.sa; e.sb = sw ? r.sa : r.sb;
          if (r.w === a || r.w === b) { e.w = r.w; e.l = r.w === a ? b : a; }
        }
        deFf(e, out);
      }
      M[m.id] = e;
      return e;
    }
    all.forEach(function (x) { ev(x.m); });
    var gf = ev(st.GF), gf2 = null;
    /* finale vinta a tavolino: niente bella */
    if (reset !== false && gf.ready && gf.w !== undefined && gf.w === gf.b && !gf.ff) {
      gf2 = { id: "GF2", a: gf.a, b: gf.b, w: undefined, l: undefined, sa: null, sb: null, ready: true, bye: false };
      var r2 = res.GF2;
      if (r2 && ((r2.a === gf.a && r2.b === gf.b) || (r2.a === gf.b && r2.b === gf.a))) {
        var s2 = r2.a !== gf.a;
        gf2.sa = s2 ? r2.sb : r2.sa; gf2.sb = s2 ? r2.sa : r2.sb;
        if (r2.w === gf.a || r2.w === gf.b) { gf2.w = r2.w; gf2.l = r2.w === gf.a ? gf.b : gf.a; }
      }
      deFf(gf2, out);
      M.GF2 = gf2;
    }
    var champ, second, third = null, fin = gf2 || gf;
    if (fin.ready && fin.w !== undefined) { champ = fin.w; second = fin.l; }
    if (st.lbFinal && M[st.lbFinal].l) third = M[st.lbFinal].l;
    return {
      M: M, gf: gf, gf2: gf2,
      done: champ !== undefined,
      top: champ !== undefined ? [champ, second, third] : []
    };
  }

  /* tavolino della doppia eliminazione: solo se non c'è già un vincitore (un risultato inserito vale di più).
     Un punteggio parziale già scritto resta visibile, così si può completare e prende il posto del tavolino. */
  function deFf(e, out) {
    if (e.w !== undefined || !out) return;
    var oa = out(e.a), ob = out(e.b);
    if (!oa && !ob) return;
    e.w = ffSide(oa, ob) ? e.b : e.a; e.l = e.w === e.a ? e.b : e.a; e.ff = true;
  }
  /* vero se il tavolino va al lato b: a è fuori e b no, oppure sono fuori entrambi e b si è ritirato dopo
     (oa e ob sono l'ordine di ritiro, 0 = in gara; con valori vero/falso tra due ritirati vince a) */
  function ffSide(oa, ob) { return !!oa && (!ob || +ob > +oa); }
  /* partita del primo turno (W0-i) che contiene il seme s: {i, k} oppure null */
  function deSeedMatch(st, s) {
    var W = st.WB[0];
    for (var i = 0; i < W.length; i++) { if (W[i].a.s === s) return { i: i, k: "a" }; if (W[i].b.s === s) return { i: i, k: "b" }; }
    return null;
  }
  /* vero se ogni risultato salvato che vale con seeds vale ancora con next (stessa coppia nella stessa partita) */
  function deSeedSafe(st, seeds, next, res, reset, out) {
    res = res || {};
    var A = deEval(st, seeds, res, reset, out).M, B = deEval(st, next, res, reset, out).M;
    function on(M, id) { var m = M[id], r = res[id]; return !!(m && m.ready && r && ((r.a === m.a && r.b === m.b) || (r.a === m.b && r.b === m.a))); }
    return Object.keys(res).every(function (id) { return !on(A, id) || on(B, id); });
  }

  /* ---------------- Eliminazione diretta ----------------
     R = [[{a,b,sa,sb,w}]] turno per turno; il vincitore passa nella partita i>>1 del turno dopo.
     m.ff = 1: vittoria a tavolino contro chi ha lasciato il torneo (m.w vincitore, senza punteggio). */
  function elSetWinner(R, r, i, name) {
    var m = R[r][i]; m.w = name; delete m.ff;
    if (r + 1 < R.length) { var nm = R[r + 1][i >> 1], k = i % 2 ? "b" : "a"; if (nm[k] !== name) { nm[k] = name; elClearFrom(R, r + 1, i >> 1); } }
  }
  function elUnsetWinner(R, r, i) {
    var m = R[r][i]; delete m.ff;
    if (m.w) { m.w = null; if (r + 1 < R.length) { var nm = R[r + 1][i >> 1]; nm[i % 2 ? "b" : "a"] = null; elClearFrom(R, r + 1, i >> 1); } }
  }
  function elClearFrom(R, r, i) { R[r][i].sa = R[r][i].sb = null; elUnsetWinner(R, r, i); }
  /* tavolini: ogni partita con due nomi, senza vincitore e con un lato fuori la vince l'altro (se sono fuori
     entrambi, chi si è ritirato dopo: vedi ffSide). Turni in ordine: le conseguenze nei turni dopo si risolvono nello stesso passaggio. Restituisce quante. */
  function elForfeits(R, out) {
    var n = 0;
    if (!R || !out) return 0;
    for (var r = 0; r < R.length; r++) for (var i = 0; i < R[r].length; i++) {
      var m = R[r][i];
      if (!m.a || !m.b || m.w || !(out(m.a) || out(m.b))) continue;
      var w = ffSide(out(m.a), out(m.b)) ? m.b : m.a;
      m.sa = m.sb = null; elSetWinner(R, r, i, w); m.ff = 1; n++;
    }
    return n;
  }
  /* finale per il 3º posto: stessa regola */
  function thirdForfeit(t, out) {
    if (!t || !t.match || !t.a || !t.b || t.w || !out) return false;
    var oa = out(t.a), ob = out(t.b);
    if (!oa && !ob) return false;
    t.w = ffSide(oa, ob) ? t.b : t.a; t.sa = t.sb = null; t.ff = 1;
    return true;
  }

  /* ---------------- Sistema svizzero ----------------
     rounds: [[{a,b,sa,sb,w}]]  w = nome del vincitore, "=" per il pareggio. b = null è il bye. */
  var WIN = 3, DRAW = 1;
  function swDone(m) { return m.b === null || m.w != null; }
  /* rank (facoltativo) = formula compilata con fxCompile sulle variabili FX_MATCH_VARS. */
  function swStandings(players, rounds, rank) {
    var T = {};
    players.forEach(function (p) { T[p] = { n: p, pts: 0, w: 0, d: 0, l: 0, sf: 0, ss: 0, opp: [], bye: false, buch: 0 }; });
    rounds.forEach(function (rd) {
      rd.forEach(function (m) {
        var A = T[m.a], B = m.b ? T[m.b] : null;
        if (!A) return;
        if (m.b === null) { A.pts += rank ? rank.run({ vinta: 1, bye: 1 }) : WIN; A.w++; A.bye = true; return; }
        if (!B || m.w == null) return;
        A.opp.push(m.b); B.opp.push(m.a);
        if (m.sa != null && m.sb != null) { A.sf += m.sa; A.ss += m.sb; B.sf += m.sb; B.ss += m.sa; }
        var dr = m.w === "=", aw = m.w === m.a;
        if (dr) { A.d++; B.d++; } else if (aw) { A.w++; B.l++; } else { B.w++; A.l++; }
        if (rank) {
          var va = { punti: m.sa || 0, avversario: m.sb || 0, diff: (m.sa || 0) - (m.sb || 0), vinta: aw && !dr ? 1 : 0, pareggio: dr ? 1 : 0, persa: !aw && !dr ? 1 : 0, bye: 0 };
          var vb = { punti: m.sb || 0, avversario: m.sa || 0, diff: -va.diff, vinta: va.persa, pareggio: va.pareggio, persa: va.vinta, bye: 0 };
          A.pts += rank.run(va); B.pts += rank.run(vb);
        } else if (dr) { A.pts += DRAW; B.pts += DRAW; }
        else if (aw) A.pts += WIN; else B.pts += WIN;
      });
    });
    var L = Object.keys(T).map(function (k) { return T[k]; });
    L.forEach(function (t) { t.buch = t.opp.reduce(function (s, o) { return s + (T[o] ? T[o].pts : 0); }, 0); });
    L.sort(function (x, y) { return y.pts - x.pts || y.buch - x.buch || (y.sf - y.ss) - (x.sf - x.ss) || y.sf - x.sf || x.n.localeCompare(y.n); });
    return L;
  }
  function swPlayed(rounds) {
    var P = {};
    rounds.forEach(function (rd) { rd.forEach(function (m) { if (m.b) { P[m.a + "\u0000" + m.b] = 1; P[m.b + "\u0000" + m.a] = 1; } }); });
    return P;
  }
  /* Accoppiamento del turno successivo: punteggi simili, senza rivincite (se possibile).
     rank (facoltativo): la formula della classifica mostrata, così accoppiamenti e riposo seguono quella.
     skip (facoltativo): chi non va più accoppiato (ha lasciato il torneo). La classifica si calcola su tutti,
     così i punti vinti contro di lui contano per l'ordine. */
  function swPair(players, rounds, shuffleFn, rank, skip) {
    var list, out = [];
    if (!rounds.length) list = shuffleFn ? shuffleFn(players.slice()) : players.slice();
    else list = swStandings(players, rounds, rank).map(function (t) { return t.n; });
    if (skip) list = list.filter(function (n) { return !skip(n); });
    var hadBye = {};
    rounds.forEach(function (rd) { rd.forEach(function (m) { if (m.b === null) hadBye[m.a] = 1; }); });
    if (list.length % 2) {
      var bi = list.length - 1;
      while (bi >= 0 && hadBye[list[bi]]) bi--;
      if (bi < 0) bi = list.length - 1;
      out.push({ a: list[bi], b: null, sa: null, sb: null, w: null });
      list = list.slice(0, bi).concat(list.slice(bi + 1));
    }
    var played = swPlayed(rounds), steps = 0;
    function rec(L) {
      if (!L.length) return [];
      if (++steps > 20000) return null;
      var p = L[0];
      for (var i = 1; i < L.length; i++) {
        var q = L[i];
        if (played[p + "\u0000" + q]) continue;
        var rest = rec(L.slice(1, i).concat(L.slice(i + 1)));
        if (rest) return [[p, q]].concat(rest);
      }
      return null;
    }
    var pairs = rec(list);
    if (!pairs) { pairs = []; for (var i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]); }
    return pairs.map(function (x) { return { a: x[0], b: x[1], sa: null, sb: null, w: null }; }).concat(out);
  }
  function swDefaultRounds(n) { var r = 0; while (Math.pow(2, r) < n) r++; return Math.max(1, r); }

  /* ---------------- Girone all'italiana ----------------
     Ogni girone: {players:[...], matches:[{a,b,sa,sb}]}. Vittoria 3, pareggio 1, sconfitta 0.
     Le partite sono ordinate a "giornate" (metodo del cerchio): nessuno gioca due volte di fila. */
  function rrMatches(players) {
    var p = players.slice(), out = [];
    if (p.length % 2) p.push(null);
    var n = p.length;
    for (var r = 0; r < n - 1; r++) {
      for (var i = 0; i < n / 2; i++) {
        var a = p[i], b = p[n - 1 - i];
        if (a !== null && b !== null) out.push({ a: r % 2 ? b : a, b: r % 2 ? a : b, sa: null, sb: null, day: r + 1 });
      }
      p.splice(1, 0, p.pop());
    }
    return out;
  }
  /* out (facoltativo): chi ha lasciato il torneo. Le sue partite senza punteggio completo le vince a tavolino
     l'avversario (3 punti o la formula con vinta e bye, nessun punto fatto o subito); tra due ritirati la vince chi
     si è ritirato dopo, se out ne dà l'ordine, altrimenti non conta.
     Le partite m.void (di chi è uscito senza giocare) non contano mai. */
  function rrStandings(gr, rank, out) {
    var T = {};
    gr.players.forEach(function (p) { T[p] = { n: p, g: 0, w: 0, d: 0, l: 0, gf: 0, gs: 0, pt: 0, out: !!(out && out(p)) }; });
    gr.matches.forEach(function (m) {
      if (m.void || !T[m.a] || !T[m.b]) return;
      var A = T[m.a], B = T[m.b];
      if (m.sa == null || m.sb == null) {
        if (!out) return;
        var oa = out(m.a) || 0, ob = out(m.b) || 0;
        /* tra due ritirati vince a tavolino chi si è ritirato dopo (out = ordine di ritiro): il tavolino che aveva
           già vinto resta suo. Con out vero/falso, o con nessuno dei due fuori, la partita non conta. */
        if (+oa === +ob) return;
        var bw = ffSide(oa, ob), W = bw ? B : A, L = bw ? A : B;
        W.g++; L.g++; W.w++; L.l++;
        if (rank) { W.pt += rank.run(fxMatchVars(null, null, true)); L.pt += rank.run({ punti: 0, avversario: 0, diff: 0, vinta: 0, pareggio: 0, persa: 1, bye: 0 }); }
        else W.pt += WIN;
        return;
      }
      A.g++; B.g++; A.gf += m.sa; A.gs += m.sb; B.gf += m.sb; B.gs += m.sa;
      if (m.sa > m.sb) { A.w++; B.l++; } else if (m.sa < m.sb) { B.w++; A.l++; } else { A.d++; B.d++; }
      if (rank) { A.pt += rank.run(fxMatchVars(m.sa, m.sb)); B.pt += rank.run(fxMatchVars(m.sb, m.sa)); }
      else if (m.sa > m.sb) A.pt += WIN; else if (m.sa < m.sb) B.pt += WIN; else { A.pt += DRAW; B.pt += DRAW; }
    });
    return Object.keys(T).map(function (k) { return T[k]; }).sort(rrCmp);
  }
  /* nuovo iscritto in un girone già iniziato: una partita contro ognuno, ciascuna in una giornata nuova in fondo
     al calendario (nessuno gioca due volte nella stessa giornata, gli indici delle partite esistenti non cambiano) */
  function rrJoin(gr, n) {
    var d = 0, k = 0;
    gr.matches.forEach(function (m) { if (m.day > d) d = m.day; });
    gr.players.forEach(function (p, j) { gr.matches.push({ a: j % 2 ? p : n, b: j % 2 ? n : p, sa: null, sb: null, day: d + 1 + j }); k++; });
    gr.players.push(n);
    return k;
  }
  /* ordine della classifica all'italiana: punti, differenza reti, reti fatte, nome (lo usa anche la classifica complessiva) */
  function rrCmp(x, y) { return y.pt - x.pt || (y.gf - y.gs) - (x.gf - x.gs) || y.gf - x.gf || x.n.localeCompare(y.n); }

  /* ---------------- Free for all ----------------
     Un girone: {p:[nomi], s:{nome: punti}}. Pareggi ammessi: punti uguali = stessa posizione (1,2,2,4).
     out (facoltativo): chi ha lasciato il torneo. Non serve il suo punteggio, non passa e non ha posizione (pos null);
     se in gara restano al massimo quanti passano, passano tutti senza giocare (free). */
  function ffaEval(grp, fin, adv, out) {
    var arr = grp.p.map(function (n, i) { return { n: n, s: grp.s[n], i: i, out: !!(out && out(n)) }; }),
      act = arr.filter(function (x) { return !x.out; }), wd = arr.filter(function (x) { return x.out; }),
      full = act.every(function (x) { return x.s != null; }),
      sortedA = act.slice().sort(function (a, b) { return (b.s == null ? -1 : b.s) - (a.s == null ? -1 : a.s) || a.i - b.i; }),
      na = fin ? Math.min(3, act.length) : Math.min(adv, Math.max(1, arr.length - 1), act.length),
      free = !fin && act.length <= na, rk = {}, tie = false, adn = [], fb = false;
    sortedA.forEach(function (x, k) { x.pos = (k > 0 && x.s === sortedA[k - 1].s) ? sortedA[k - 1].pos : k + 1; rk[x.n] = x.pos; if (k > 0 && x.pos === sortedA[k - 1].pos) tie = true; });
    wd.forEach(function (x) { x.pos = null; });
    if (full) {
      adn = sortedA.filter(function (x) { return x.pos <= na; });
      if (!fin && !free && adn.length >= sortedA.length) { adn = sortedA.slice(0, na); fb = true; } /* tutti pari: passano i primi per ordine di inserimento */
    } else if (free) adn = act.slice();
    return { sorted: sortedA.concat(wd), full: full, tie: tie, ok: full || free, free: free, na: na, rk: rk, adv: adn.map(function (x) { return x.n; }), fb: fb, extra: full ? Math.max(0, adn.length - na) : 0 };
  }

  /* ---------------- Formule dei punti ----------------
     Piccolo linguaggio per le formule dei punti, senza eval: numeri, variabili,
     + - * / % ^, confronti, && || !, condizione ? a : b e le funzioni
     min, max, abs, arrotonda (round), giu (floor), su (ceil), se(c; a; b),
     tabella(i; v1; v2; ...) che restituisce il valore i-esimo (1 = primo).
     Gli argomenti si separano con ; oppure ,  -  i decimali usano il punto. */
  var FN = {
    min: function (a) { return a.length ? Math.min.apply(null, a) : 0; },
    max: function (a) { return a.length ? Math.max.apply(null, a) : 0; },
    abs: function (a) { return Math.abs(a[0] || 0); },
    arrotonda: function (a) { return Math.round(a[0] || 0); },
    giu: function (a) { return Math.floor(a[0] || 0); },
    su: function (a) { return Math.ceil(a[0] || 0); },
    se: function (a) { return a[0] ? (a[1] || 0) : (a[2] || 0); },
    tabella: function (a) { var i = Math.round(a[0]); return i >= 1 && i < a.length ? a[i] : 0; }
  };
  FN.round = FN.arrotonda; FN.floor = FN.giu; FN.ceil = FN.su; FN.if = FN.se; FN.table = FN.tabella;
  function fxCompile(src, allowed) {
    src = String(src == null ? "" : src);
    var toks = [], i = 0, m, re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_\u00C0-\u017F][\w\u00C0-\u017F]*)|(<=|>=|==|!=|&&|\|\||[-+*\/%^()<>!?:;,]))/y;
    while (i < src.length) {
      re.lastIndex = i;
      if (/^\s*$/.test(src.slice(i))) break;
      m = re.exec(src);
      if (!m) throw new Error("Carattere non valido alla posizione " + (i + 1) + ": «" + src.slice(i).trim().charAt(0) + "»");
      toks.push(m[1] ? { t: "n", v: +m[1] } : m[2] ? { t: "id", v: m[2].toLowerCase() } : { t: "op", v: m[3] === ";" ? "," : m[3] });
      i = re.lastIndex;
    }
    var p = 0, used = {};
    function peek(v) { return toks[p] && toks[p].t === "op" && toks[p].v === v; }
    function eat(v) { if (!peek(v)) throw new Error("Manca «" + v + "»"); p++; }
    function primary() {
      var t = toks[p++];
      if (!t) throw new Error("La formula finisce troppo presto");
      if (t.t === "n") return function () { return t.v; };
      if (t.t === "id") {
        if (peek("(")) {
          /* solo le funzioni dell'elenco: niente chiavi ereditate (__proto__, constructor) */
          var f = Object.prototype.hasOwnProperty.call(FN, t.v) ? FN[t.v] : null; if (!f) throw new Error("Funzione sconosciuta: " + t.v);
          p++; var args = [];
          if (!peek(")")) { args.push(expr()); while (peek(",")) { p++; args.push(expr()); } }
          eat(")");
          return function (V) { return f(args.map(function (a) { return a(V); })); };
        }
        if (allowed && allowed.indexOf(t.v) < 0) throw new Error("Variabile sconosciuta: " + t.v + " (disponibili: " + allowed.join(", ") + ")");
        used[t.v] = 1;
        return function (V) { var x = V[t.v]; return typeof x === "number" && isFinite(x) ? x : 0; };
      }
      if (t.v === "(") { var e = expr(); eat(")"); return e; }
      if (t.v === "-") { var u = primary(); return function (V) { return -u(V); }; }
      if (t.v === "+") return primary();
      if (t.v === "!") { var n = primary(); return function (V) { return n(V) ? 0 : 1; }; }
      throw new Error("Simbolo inatteso: «" + t.v + "»");
    }
    function pow() { var b = primary(); if (peek("^")) { p++; var e = pow(); return function (V) { return Math.pow(b(V), e(V)); }; } return b; }
    function bin(next, ops, f) {
      return function () {
        var l = next();
        while (toks[p] && toks[p].t === "op" && ops.indexOf(toks[p].v) >= 0) {
          var o = toks[p++].v, r = next(), L = l;
          l = (function (L, r, o) { return function (V) { return f(o, L(V), r(V)); }; })(L, r, o);
        }
        return l;
      };
    }
    var mul = bin(pow, ["*", "/", "%"], function (o, a, b) { return o === "*" ? a * b : b === 0 ? 0 : o === "/" ? a / b : a % b; });
    var add = bin(mul, ["+", "-"], function (o, a, b) { return o === "+" ? a + b : a - b; });
    var cmp = bin(add, ["<", ">", "<=", ">=", "==", "!="], function (o, a, b) {
      return (o === "<" ? a < b : o === ">" ? a > b : o === "<=" ? a <= b : o === ">=" ? a >= b : o === "==" ? a === b : a !== b) ? 1 : 0; });
    var and = bin(cmp, ["&&"], function (o, a, b) { return a && b ? 1 : 0; });
    var or = bin(and, ["||"], function (o, a, b) { return a || b ? 1 : 0; });
    function expr() { var c = or(); if (peek("?")) { p++; var a = expr(); eat(":"); var b = expr(); return function (V) { return c(V) ? a(V) : b(V); }; } return c; }
    if (!toks.length) throw new Error("La formula è vuota");
    var root = expr();
    if (p < toks.length) throw new Error("Simbolo inatteso: «" + toks[p].v + "»");
    return { run: function (V) { var r = root(V || {}); return typeof r === "number" && isFinite(r) ? Math.round(r * 1000) / 1000 : 0; }, used: Object.keys(used) };
  }
  /* Punti di una partita uno contro uno, dal punto di vista di un lato. */
  function fxMatchVars(own, opp, bye) {
    var done = own != null && opp != null;
    return { punti: own || 0, avversario: opp || 0, diff: (own || 0) - (opp || 0), vinta: bye || (done && own > opp) ? 1 : 0, pareggio: done && own === opp && !bye ? 1 : 0, persa: done && own < opp ? 1 : 0, bye: bye ? 1 : 0 };
  }
  var FX_MATCH_VARS = ["punti", "avversario", "diff", "vinta", "pareggio", "persa", "bye"];

  /* ---------------- Teste di serie ----------------
     tds = nomi in ordine di testa di serie (1 = la prima). Contano solo quelli presenti in players, una volta sola;
     senza teste di serie valide ogni funzione fa esattamente il sorteggio di prima (stesso shuffleFn, stesso risultato).
     shuffleFn riceve sempre una copia; se manca resta l'ordine dato. */
  function seedPick(players, tds) {
    var has = {}, used = {}, top = [];
    players.forEach(function (p) { has["\u0001" + p] = 1; });
    (Array.isArray(tds) ? tds : []).forEach(function (n) { var k = "\u0001" + n; if (has[k] && !used[k]) { used[k] = 1; top.push(n); } });
    return { top: top, rest: players.filter(function (p) { return !used["\u0001" + p]; }) };
  }
  function seedMix(a, shuffleFn) { return shuffleFn ? shuffleFn(a.slice()) : a.slice(); }
  /* eliminazione e doppia: teste di serie in ordine, poi gli altri sorteggiati. Il tabellone (ordine 1 contro N)
     mette 1 e 2 in metà opposte e dà i riposi alle prime teste di serie. */
  function seedList(players, tds, shuffleFn) {
    players = (players || []).slice();
    var s = seedPick(players, tds);
    return s.top.length ? s.top.concat(seedMix(s.rest, shuffleFn)) : seedMix(players, shuffleFn);
  }
  /* gironi e manche: k gruppi con le stesse dimensioni della distribuzione j % k (i primi n % k hanno uno in più).
     Teste di serie a serpentina (1→A, 2→B, ..., poi all'indietro), saltando un gruppo già pieno; poi gli altri sorteggiati
     a riempire. */
  function seedSpread(players, tds, k, shuffleFn) {
    players = (players || []).slice();
    k = Math.max(1, Math.floor(+k) || 1);
    var n = players.length, out = [], cap = [], i, s = seedPick(players, tds);
    for (i = 0; i < k; i++) { out.push([]); cap.push(Math.floor(n / k) + (i < n % k ? 1 : 0)); }
    if (!s.top.length) { seedMix(players, shuffleFn).forEach(function (p, j) { out[j % k].push(p); }); return out; }
    var t = 0;
    s.top.forEach(function (p) {
      for (;;) {
        var r = Math.floor(t / k), q = t % k, gi = r % 2 ? k - 1 - q : q;
        t++;
        if (out[gi].length < cap[gi]) { out[gi].push(p); return; }
      }
    });
    var g = 0;
    seedMix(s.rest, shuffleFn).forEach(function (p) { while (out[g].length >= cap[g]) g++; out[g].push(p); });
    return out;
  }
  /* primo turno dello svizzero: metà alta contro metà bassa della lista seminata (1 contro n/2+1, 2 contro n/2+2, ...),
     con un numero dispari riposa l'ultimo. Stessa forma di swPair; dal secondo turno non cambia niente. */
  function swSeedRound(players, tds, shuffleFn) {
    players = (players || []).slice();
    if (!seedPick(players, tds).top.length) return swPair(players, [], shuffleFn);
    var L = seedList(players, tds, shuffleFn), bye = L.length % 2 ? L.pop() : null, h = L.length / 2, out = [];
    for (var i = 0; i < h; i++) out.push({ a: L[i], b: L[i + h], sa: null, sb: null, w: null });
    if (bye !== null) out.push({ a: bye, b: null, sa: null, sb: null, w: null });
    return out;
  }

  var TF = {
    seedOrder: seedOrder,
    deBuild: deBuild, deEval: deEval, deSeedMatch: deSeedMatch, deSeedSafe: deSeedSafe,
    elSetWinner: elSetWinner, elUnsetWinner: elUnsetWinner, elClearFrom: elClearFrom, elForfeits: elForfeits, thirdForfeit: thirdForfeit,
    swStandings: swStandings, swPair: swPair, swDone: swDone, swDefaultRounds: swDefaultRounds,
    rrMatches: rrMatches, rrStandings: rrStandings, rrCmp: rrCmp, rrJoin: rrJoin,
    ffaEval: ffaEval,
    seedList: seedList, seedSpread: seedSpread, swSeedRound: swSeedRound,
    fxCompile: fxCompile, fxMatchVars: fxMatchVars, FX_MATCH_VARS: FX_MATCH_VARS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TF;
  else root.TF = TF;
})(this);
