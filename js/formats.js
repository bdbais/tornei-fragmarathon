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

  /* undefined = da definire, null = posto vuoto (bye), stringa = nome. */
  function deEval(st, seeds, res, reset) {
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
      }
      M[m.id] = e;
      return e;
    }
    all.forEach(function (x) { ev(x.m); });
    var gf = ev(st.GF), gf2 = null;
    if (reset !== false && gf.ready && gf.w !== undefined && gf.w === gf.b) {
      gf2 = { id: "GF2", a: gf.a, b: gf.b, w: undefined, l: undefined, sa: null, sb: null, ready: true, bye: false };
      var r2 = res.GF2;
      if (r2 && ((r2.a === gf.a && r2.b === gf.b) || (r2.a === gf.b && r2.b === gf.a))) {
        var s2 = r2.a !== gf.a;
        gf2.sa = s2 ? r2.sb : r2.sa; gf2.sb = s2 ? r2.sa : r2.sb;
        if (r2.w === gf.a || r2.w === gf.b) { gf2.w = r2.w; gf2.l = r2.w === gf.a ? gf.b : gf.a; }
      }
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
  /* Accoppiamento del turno successivo: punteggi simili, senza rivincite (se possibile). */
  function swPair(players, rounds, shuffleFn) {
    var list, out = [];
    if (!rounds.length) list = shuffleFn ? shuffleFn(players.slice()) : players.slice();
    else list = swStandings(players, rounds).map(function (t) { return t.n; });
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
  function rrStandings(gr, rank) {
    var T = {};
    gr.players.forEach(function (p) { T[p] = { n: p, g: 0, w: 0, d: 0, l: 0, gf: 0, gs: 0, pt: 0 }; });
    gr.matches.forEach(function (m) {
      if (m.sa == null || m.sb == null || !T[m.a] || !T[m.b]) return;
      var A = T[m.a], B = T[m.b];
      A.g++; B.g++; A.gf += m.sa; A.gs += m.sb; B.gf += m.sb; B.gs += m.sa;
      if (m.sa > m.sb) { A.w++; B.l++; } else if (m.sa < m.sb) { B.w++; A.l++; } else { A.d++; B.d++; }
      if (rank) { A.pt += rank.run(fxMatchVars(m.sa, m.sb)); B.pt += rank.run(fxMatchVars(m.sb, m.sa)); }
      else if (m.sa > m.sb) A.pt += WIN; else if (m.sa < m.sb) B.pt += WIN; else { A.pt += DRAW; B.pt += DRAW; }
    });
    return Object.keys(T).map(function (k) { return T[k]; }).sort(function (x, y) {
      return y.pt - x.pt || (y.gf - y.gs) - (x.gf - x.gs) || y.gf - x.gf || x.n.localeCompare(y.n);
    });
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
          var f = FN[t.v]; if (!f) throw new Error("Funzione sconosciuta: " + t.v);
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

  var TF = {
    seedOrder: seedOrder,
    deBuild: deBuild, deEval: deEval,
    swStandings: swStandings, swPair: swPair, swDone: swDone, swDefaultRounds: swDefaultRounds,
    rrMatches: rrMatches, rrStandings: rrStandings,
    fxCompile: fxCompile, fxMatchVars: fxMatchVars, FX_MATCH_VARS: FX_MATCH_VARS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TF;
  else root.TF = TF;
})(this);
