const test = require("node:test");
const assert = require("node:assert");
const TF = require("../js/formats.js");

const names = (n) => Array.from({ length: n }, (_, i) => "P" + (i + 1));

/* Gioca una doppia eliminazione fino in fondo con risultati casuali. */
function playDE(n, reset, rnd) {
  const st = TF.deBuild(n), seeds = names(n), res = {};
  for (let guard = 0; guard < 500; guard++) {
    const e = TF.deEval(st, seeds, res, reset);
    if (e.done) return { st, e, res };
    const open = Object.values(e.M).filter((m) => m.ready && m.w === undefined);
    assert.ok(open.length > 0, "nessuna partita giocabile ma torneo non concluso (n=" + n + ")");
    const m = open[0], aw = rnd() < 0.5;
    res[m.id] = { a: m.a, b: m.b, sa: aw ? 2 : 1, sb: aw ? 1 : 2, w: aw ? m.a : m.b };
  }
  throw new Error("loop");
}

test("doppia eliminazione: si conclude per ogni numero di partecipanti", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 2; n <= 33; n++) {
    for (let t = 0; t < 4; t++) {
      const { e } = playDE(n, t % 2 === 0, rnd);
      assert.strictEqual(e.top.length, 3);
      assert.ok(e.top[0] && e.top[1], "campione e secondo definiti");
      assert.notStrictEqual(e.top[0], e.top[1]);
      if (n >= 3) assert.ok(e.top[2], "terzo definito con n=" + n);
      /* nessuno è eliminato con meno di due sconfitte, tranne in finale senza bella */
      const losses = {};
      Object.values(e.M).forEach((m) => { if (m.ready && m.l) losses[m.l] = (losses[m.l] || 0) + 1; });
      Object.entries(losses).forEach(([p, l]) => assert.ok(l <= 2, p + " ha " + l + " sconfitte"));
      const eliminated = names(n).filter((p) => p !== e.top[0]);
      eliminated.forEach((p) => {
        if (t % 2 === 0) assert.strictEqual(losses[p], 2, p + " eliminato con " + losses[p] + " sconfitte (n=" + n + ")");
      });
    }
  }
});

test("doppia eliminazione: un risultato cambiato a monte invalida quelli a valle", () => {
  const st = TF.deBuild(4), seeds = names(4), res = {};
  let e = TF.deEval(st, seeds, res);
  const m0 = e.M["W0-0"];
  res["W0-0"] = { a: m0.a, b: m0.b, sa: 2, sb: 0, w: m0.a };
  const m1 = e.M["W0-1"];
  res["W0-1"] = { a: m1.a, b: m1.b, sa: 2, sb: 0, w: m1.a };
  e = TF.deEval(st, seeds, res);
  const f = e.M["W1-0"];
  res["W1-0"] = { a: f.a, b: f.b, sa: 1, sb: 0, w: f.a };
  assert.strictEqual(TF.deEval(st, seeds, res).M["W1-0"].w, m0.a);
  res["W0-0"] = { a: m0.a, b: m0.b, sa: 0, sb: 2, w: m0.b };
  assert.strictEqual(TF.deEval(st, seeds, res).M["W1-0"].w, undefined);
});

test("svizzero: niente rivincite e bye a rotazione", () => {
  for (const n of [4, 5, 7, 8, 12, 16]) {
    const P = names(n), rounds = [], R = TF.swDefaultRounds(n);
    for (let r = 0; r < R; r++) {
      const rd = TF.swPair(P, rounds);
      const seen = new Set();
      rd.forEach((m) => { assert.ok(!seen.has(m.a) && !seen.has(m.b)); seen.add(m.a); if (m.b) seen.add(m.b); });
      assert.strictEqual(seen.size, n);
      rd.forEach((m) => { if (m.b) { m.sa = 1; m.sb = 0; m.w = m.a; } });
      rounds.push(rd);
    }
    const pairs = new Set();
    rounds.flat().filter((m) => m.b).forEach((m) => {
      const k = [m.a, m.b].sort().join("|");
      assert.ok(!pairs.has(k), "rivincita " + k + " con n=" + n);
      pairs.add(k);
    });
    const byes = rounds.flat().filter((m) => m.b === null).map((m) => m.a);
    assert.strictEqual(new Set(byes).size, byes.length, "bye ripetuto");
    const st = TF.swStandings(P, rounds);
    assert.strictEqual(st.length, n);
    for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].pts >= st[i].pts);
  }
});

test("girone all'italiana: tutti contro tutti una volta, uno solo per giornata", () => {
  for (const n of [2, 3, 4, 5, 6, 9]) {
    const P = names(n), ms = TF.rrMatches(P);
    assert.strictEqual(ms.length, (n * (n - 1)) / 2);
    const pairs = new Set(ms.map((m) => [m.a, m.b].sort().join("|")));
    assert.strictEqual(pairs.size, ms.length);
    const byDay = {};
    ms.forEach((m) => { (byDay[m.day] = byDay[m.day] || []).push(m.a, m.b); });
    Object.values(byDay).forEach((l) => assert.strictEqual(new Set(l).size, l.length));
  }
  const g = { players: ["A", "B", "C"], matches: [{ a: "A", b: "B", sa: 2, sb: 2 }, { a: "A", b: "C", sa: 3, sb: 0 }, { a: "B", b: "C", sa: 0, sb: 1 }] };
  const s = TF.rrStandings(g);
  assert.deepStrictEqual(s.map((x) => x.n + ":" + x.pt), ["A:4", "C:3", "B:1"]);
});

test("formule: calcolo, funzioni ed errori", () => {
  const r = (f, v, al) => TF.fxCompile(f, al).run(v);
  assert.strictEqual(r("3*vinta + pareggio", { vinta: 1 }), 3);
  assert.strictEqual(r("tabella(pos; 12; 9; 7) + kill", { pos: 2, kill: 4 }), 13);
  assert.strictEqual(r("tabella(pos; 12; 9; 7)", { pos: 9 }), 0);
  assert.strictEqual(r("diff >= 2 ? 4 : 3*vinta", { diff: 1, vinta: 1 }), 3);
  assert.strictEqual(r("max(0, kill*2 - morti)", { kill: 1, morti: 5 }), 0);
  assert.strictEqual(r("punti / 0", { punti: 5 }), 0);
  assert.strictEqual(r("-(2+3)*2", {}), -10);
  assert.throws(() => TF.fxCompile("kill +", ["kill"]), /troppo presto/);
  assert.throws(() => TF.fxCompile("morti", ["kill"]), /Variabile sconosciuta/);
  assert.throws(() => TF.fxCompile("alert(1)"), /Funzione sconosciuta/);
  assert.throws(() => TF.fxCompile("constructor.constructor"), /Carattere non valido/);
  assert.throws(() => TF.fxCompile("__proto__(1)"), /Funzione sconosciuta/);
  assert.throws(() => TF.fxCompile("constructor(2)"), /Funzione sconosciuta/);
  assert.throws(() => TF.fxCompile("tostring(2)"), /Funzione sconosciuta/);
});

test("formule: punti personalizzati in gironi e svizzero", () => {
  const rank = TF.fxCompile("2*vinta + pareggio + se(diff >= 3; 1; 0)", TF.FX_MATCH_VARS);
  const g = { players: ["A", "B", "C"], matches: [{ a: "A", b: "B", sa: 3, sb: 0 }, { a: "A", b: "C", sa: 1, sb: 1 }, { a: "B", b: "C", sa: 0, sb: 1 }] };
  assert.deepStrictEqual(TF.rrStandings(g, rank).map((x) => x.n + ":" + x.pt), ["A:4", "C:3", "B:0"]);
  const rounds = [[{ a: "A", b: "B", sa: 5, sb: 1, w: "A" }, { a: "C", b: null }]];
  const st = TF.swStandings(["A", "B", "C"], rounds, rank);
  assert.deepStrictEqual(st.map((x) => x.n + ":" + x.pts), ["A:3", "C:2", "B:0"]);
});

test("girone all'italiana: a pari punti e differenza conta chi ha segnato di più", () => {
  const g = { players: ["Alfa", "Beta", "Zeta"], matches: [{ a: "Zeta", b: "Beta", sa: 5, sb: 3 }, { a: "Alfa", b: "Beta", sa: 2, sb: 0 }, { a: "Alfa", b: "Zeta", sa: 1, sb: 1 }] };
  const s = TF.rrStandings(g);
  assert.deepStrictEqual(s.map((x) => x.n), ["Zeta", "Alfa", "Beta"]);
  assert.deepStrictEqual(s.slice().reverse().sort(TF.rrCmp).map((x) => x.n), ["Zeta", "Alfa", "Beta"]);
});

test("svizzero: accoppiamenti e riposo seguono la formula della classifica", () => {
  const punti = TF.fxCompile("punti", TF.FX_MATCH_VARS);
  const P = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const r1 = [[{ a: "A", b: "B", sa: 20, sb: 19, w: "A" }, { a: "C", b: "D", sa: 1, sb: 0, w: "C" }, { a: "E", b: "F", sa: 1, sb: 0, w: "E" }, { a: "G", b: "H", sa: 1, sb: 0, w: "G" }]];
  const order = TF.swStandings(P, r1, punti).map((x) => x.n);
  assert.deepStrictEqual(order.slice(0, 2), ["A", "B"]);
  const rd = TF.swPair(P, r1, null, punti);
  const opp = (n) => { const m = rd.find((x) => x.a === n || x.b === n); return m.a === n ? m.b : m.a; };
  assert.ok(["C", "E", "G"].indexOf(opp("B")) >= 0, "B (secondo) contro " + opp("B"));
  /* senza formula resta il 3/1/0: B è tra gli sconfitti */
  const rd0 = TF.swPair(P, r1);
  const m0 = rd0.find((x) => x.a === "B" || x.b === "B");
  assert.ok(["D", "F", "H"].indexOf(m0.a === "B" ? m0.b : m0.a) >= 0);
  /* bye: con 5 giocatori va all'ultimo della classifica mostrata */
  const r5 = [[{ a: "B", b: "A", sa: 9, sb: 2, w: "B" }, { a: "C", b: "D", sa: 1, sb: 0, w: "C" }, { a: "E", b: null }]];
  const st5 = TF.swStandings(["A", "B", "C", "D", "E"], r5, punti).map((x) => x.n);
  const bye = TF.swPair(["A", "B", "C", "D", "E"], r5, null, punti).find((m) => m.b === null).a;
  assert.notStrictEqual(bye, "A");
  assert.strictEqual(bye, st5.filter((n) => n !== "E").pop());
});

/* ---------------- Cambi a torneo iniziato: ritiri, tavolini, nuovi iscritti ---------------- */
const lcg = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const det = (rnd) => (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* tabellone a eliminazione diretta come bracket() di app.js */
function elBracket(list) {
  const n = list.length; let size = 2; while (size < n) size *= 2;
  const ord = TF.seedOrder(size), first = [];
  for (let k = 0; k < size; k += 2) first.push({ a: list[ord[k] - 1] || null, b: list[ord[k + 1] - 1] || null, w: null });
  const R = [first]; let c = size / 2;
  while (c > 1) { c /= 2; const r = []; for (let q = 0; q < c; q++) r.push({ a: null, b: null, w: null }); R.push(r); }
  first.forEach((m, i) => { if (m.a && !m.b) TF.elSetWinner(R, 0, i, m.a); });
  return R;
}
const outOf = (...l) => (n) => l.indexOf(n) >= 0;

test("compatibilità: deEval senza out e con out sempre falso", () => {
  for (let n = 2; n <= 33; n++) {
    const rnd = lcg(n * 31 + 1), reset = n % 2 === 0, { st, res } = playDE(n, reset, rnd), seeds = names(n);
    while (seeds.length < st.P) seeds.push(null);
    assert.deepStrictEqual(TF.deEval(st, seeds, res, reset, () => false), TF.deEval(st, seeds, res, reset));
  }
});

test("compatibilità: rrStandings e swPair con out e skip sempre falsi", () => {
  const rnd = lcg(11);
  for (let t = 0; t < 30; t++) {
    const P = names(3 + (t % 5)), g = { players: P, matches: TF.rrMatches(P) };
    g.matches.forEach((m) => { if (rnd() < 0.7) { m.sa = Math.floor(rnd() * 4); m.sb = Math.floor(rnd() * 4); } });
    const rank = t % 2 ? TF.fxCompile("3*vinta + pareggio + diff", TF.FX_MATCH_VARS) : undefined;
    assert.deepStrictEqual(TF.rrStandings(g, rank, () => false), TF.rrStandings(g, rank));
  }
  for (const n of [5, 8, 9]) {
    const P = names(n), r1 = TF.swPair(P, [], det(lcg(n))), r2 = TF.swPair(P, [], det(lcg(n)), null, () => false);
    assert.deepStrictEqual(r2, r1);
    r1.forEach((m) => { if (m.b) { m.sa = 1; m.sb = 0; m.w = m.a; } });
    assert.deepStrictEqual(TF.swPair(P, [r1], null, null, () => false), TF.swPair(P, [r1]));
  }
});

/* gEval della 3.9.0, copiata qui come riferimento */
function gEvalOld(grp, fin, adv) {
  var arr = grp.p.map(function (n, i) { return { n: n, s: grp.s[n], i: i }; }), full = arr.every(function (x) { return x.s != null; }),
    sorted = arr.slice().sort(function (a, b) { return (b.s == null ? -1 : b.s) - (a.s == null ? -1 : a.s) || a.i - b.i; }),
    na = fin ? Math.min(3, sorted.length) : Math.min(adv, sorted.length - 1), rk = {}, tie = false, adn = [], fb = false;
  sorted.forEach(function (x, k) { x.pos = (k > 0 && x.s === sorted[k - 1].s) ? sorted[k - 1].pos : k + 1; rk[x.n] = x.pos; if (k > 0 && x.pos === sorted[k - 1].pos) tie = true; });
  if (full) { adn = sorted.filter(function (x) { return x.pos <= na; }); if (!fin && adn.length >= sorted.length) { adn = sorted.slice(0, na); fb = true; } }
  return { sorted: sorted, full: full, tie: tie, ok: full, na: na, rk: rk, adv: adn.map(function (x) { return x.n; }), fb: fb, extra: full ? Math.max(0, adn.length - na) : 0 };
}

test("compatibilità: ffaEval senza out è la gEval di prima", () => {
  const rnd = lcg(5), pick = (e) => ({ sorted: e.sorted.map((x) => [x.n, x.s, x.i, x.pos]), full: e.full, ok: e.ok, na: e.na, rk: e.rk, adv: e.adv, fb: e.fb, extra: e.extra, tie: e.tie });
  for (let gs = 2; gs <= 10; gs++) for (const fin of [true, false]) for (let adv = 1; adv < gs; adv++) for (let t = 0; t < 6; t++) {
    const p = names(gs), s = {};
    p.forEach((n) => { if (t === 0 || rnd() < 0.9) s[n] = Math.floor(rnd() * 4); });
    const grp = { p, s };
    assert.deepStrictEqual(pick(TF.ffaEval(grp, fin, adv)), pick(gEvalOld(grp, fin, adv)));
  }
});

test("eliminazione diretta: tavolini, propagazione e 3º posto", () => {
  const P = names(8), R = elBracket(P);
  /* P1 si ritira: il suo avversario al primo turno vince a tavolino e passa */
  const i = R[0].findIndex((m) => m.a === "P1" || m.b === "P1"), m = R[0][i], o = m.a === "P1" ? m.b : m.a;
  assert.strictEqual(TF.elForfeits(R, outOf("P1")), 1);
  assert.strictEqual(m.w, o); assert.strictEqual(m.ff, 1); assert.strictEqual(m.sa, null);
  assert.strictEqual(R[1][i >> 1][i % 2 ? "b" : "a"], o);
  assert.strictEqual(TF.elForfeits(R, outOf("P1")), 0, "idempotente");
  /* un ritirato in attesa: niente finché l'altra partita non ha un vincitore */
  const R2 = elBracket(P), j = R2[0].findIndex((x) => x.a === "P2" || x.b === "P2"), sib = j ^ 1;
  TF.elSetWinner(R2, 0, j, "P2");
  assert.strictEqual(TF.elForfeits(R2, outOf("P2")), 0);
  const nx = R2[1][j >> 1];
  assert.ok(!nx.w);
  TF.elSetWinner(R2, 0, sib, R2[0][sib].a);
  assert.strictEqual(TF.elForfeits(R2, outOf("P2")), 1);
  assert.strictEqual(nx.w, R2[0][sib].a); assert.strictEqual(nx.ff, 1);
  /* un risultato scritto sopra toglie ff */
  TF.elSetWinner(R2, 1, j >> 1, "P2");
  assert.strictEqual(nx.ff, undefined); assert.strictEqual(nx.w, "P2");
  /* elClearFrom a monte toglie ff a valle */
  const R3 = elBracket(P), k = R3[0].findIndex((x) => x.a === "P3" || x.b === "P3");
  TF.elSetWinner(R3, 0, k ^ 1, R3[0][k ^ 1].a); TF.elSetWinner(R3, 0, k, "P3");
  TF.elForfeits(R3, outOf("P3"));
  assert.strictEqual(R3[1][k >> 1].ff, 1);
  TF.elClearFrom(R3, 0, k);
  assert.strictEqual(R3[1][k >> 1].ff, undefined); assert.strictEqual(R3[1][k >> 1].w, null);
  /* entrambi ritirati: passa a, che perde a tavolino la partita dopo; una partita con w non si tocca */
  const R4 = elBracket(P), A = R4[0][0].a, B = R4[0][0].b;
  TF.elSetWinner(R4, 0, 1, R4[0][1].a);
  R4[0][2].w = R4[0][2].a; const done = JSON.stringify(R4[0][2]);
  assert.strictEqual(TF.elForfeits(R4, outOf(A, B)), 2);
  assert.strictEqual(R4[0][0].w, A); assert.strictEqual(R4[1][0].w, R4[0][1].a); assert.strictEqual(R4[1][0].ff, 1);
  assert.strictEqual(JSON.stringify(R4[0][2]), done);
  assert.strictEqual(TF.elForfeits(R4, outOf(A, B)), 0);
  /* 3º posto */
  const t = { match: true, a: "X", b: "Y", w: null, sa: 2, sb: null };
  assert.strictEqual(TF.thirdForfeit(t, outOf("X")), true);
  assert.strictEqual(t.w, "Y"); assert.strictEqual(t.ff, 1); assert.strictEqual(t.sa, null);
  assert.strictEqual(TF.thirdForfeit(t, outOf("X")), false);
  const t2 = { match: true, a: "X", b: "Y", w: null };
  TF.thirdForfeit(t2, outOf("X", "Y")); assert.strictEqual(t2.w, "X");
  assert.strictEqual(TF.thirdForfeit({ match: false, a: "X", b: "Y" }, outOf("X")), false);
});

/* gioca solo le partite vere: quelle con un ritirato le chiudono i tavolini */
function playDEout(n, out, reset) {
  const st = TF.deBuild(n), seeds = names(n), res = {};
  while (seeds.length < st.P) seeds.push(null);
  for (let g = 0; g < 500; g++) {
    const e = TF.deEval(st, seeds, res, reset, out);
    if (e.done) return { st, e, res, seeds };
    const open = Object.values(e.M).filter((m) => m.ready && m.w === undefined);
    assert.ok(open.length, "bloccato");
    const m = open[0];
    assert.ok(!out(m.a) && !out(m.b), "partita aperta con un ritirato");
    res[m.id] = { a: m.a, b: m.b, sa: 2, sb: 1, w: m.a };
  }
  throw new Error("loop");
}

test("doppia eliminazione: il ritirato perde a tavolino due volte e il torneo si chiude", () => {
  for (const n of [4, 6, 8, 11]) {
    const { e } = playDEout(n, outOf("P1"), true);
    const ffl = Object.values(e.M).filter((m) => m.ff && m.l === "P1");
    assert.strictEqual(ffl.length, 2, "due sconfitte a tavolino con n=" + n);
    ffl.forEach((m) => { assert.strictEqual(m.sa, null); assert.strictEqual(m.sb, null); });
    assert.notStrictEqual(e.top[0], "P1");
  }
  /* il campione dei vincenti si ritira prima della finale: finale a tavolino, niente bella */
  const st = TF.deBuild(4), seeds = names(4), res = {};
  let e = TF.deEval(st, seeds, res, true);
  const win = (id) => { const m = e.M[id]; res[id] = { a: m.a, b: m.b, sa: 1, sb: 0, w: m.a }; e = TF.deEval(st, seeds, res, true); };
  win("W0-0"); win("W0-1"); win("W1-0"); win("L0-0"); win("L1-0");
  const champ = e.M["W1-0"].w, lbw = e.M["L1-0"].w;
  const E = TF.deEval(st, seeds, res, true, outOf(champ));
  assert.strictEqual(E.gf.ff, true); assert.strictEqual(E.gf.w, lbw); assert.strictEqual(E.gf2, null);
  assert.strictEqual(E.top[0], lbw); assert.strictEqual(E.top[1], champ);
  /* un risultato salvato vale più del tavolino */
  res.GF = { a: E.gf.a, b: E.gf.b, sa: 3, sb: 0, w: champ };
  const E2 = TF.deEval(st, seeds, res, true, outOf(champ));
  assert.strictEqual(E2.gf.w, champ); assert.ok(!E2.gf.ff);
  /* entrambi ritirati: vince a */
  delete res.GF;
  const E3 = TF.deEval(st, seeds, res, true, outOf(champ, lbw));
  assert.strictEqual(E3.gf.w, E3.gf.a); assert.strictEqual(E3.gf.ff, true);
});

test("doppia eliminazione: deSeedMatch e deSeedSafe", () => {
  const st = TF.deBuild(8);
  for (let s = 0; s < 8; s++) {
    const p = TF.deSeedMatch(st, s);
    assert.ok(p); assert.strictEqual(st.WB[0][p.i][p.k].s, s);
  }
  assert.strictEqual(TF.deSeedMatch(st, 99), null);
  assert.deepStrictEqual(TF.deSeedMatch(st, 7), { i: 0, k: "b" });
  /* 6 iscritti su 8 posti: i semi 7 e 8 sono vuoti (W0-0 P1 contro nessuno, W0-2 P2 contro nessuno) */
  const st6 = TF.deBuild(6), seeds = names(6); while (seeds.length < st6.P) seeds.push(null);
  const free = 6, pf = TF.deSeedMatch(st6, free), next = seeds.slice(); next[free] = "NEW";
  assert.strictEqual(pf.i, 2);
  assert.strictEqual(TF.deSeedSafe(st6, seeds, next, {}, true), true, "seme libero senza risultati a valle");
  /* W0-3 P3 batte P6, che scende in L0-1 contro il posto vuoto (bye) e gioca subito L1-1 contro chi perde W1-0 */
  const res = {}; let e = TF.deEval(st6, seeds, res, true);
  const win = (id, w) => { const m = e.M[id]; res[id] = { a: m.a, b: m.b, sa: 1, sb: 0, w: w || m.a }; e = TF.deEval(st6, seeds, res, true); };
  win("W0-3", "P3"); win("W0-1"); win("W1-0", "P1");
  assert.strictEqual(e.M["L0-1"].bye, true);
  assert.strictEqual(TF.deSeedSafe(st6, seeds, next, res, true), true, "il bye di L0 non ha ancora giocato");
  const l1 = Object.values(e.M).find((m) => m.ready && /^L1-/.test(m.id) && (m.a === "P6" || m.b === "P6"));
  assert.ok(l1);
  win(l1.id, "P6");
  assert.strictEqual(TF.deSeedSafe(st6, seeds, next, res, true), false, "riempire il seme invaliderebbe L1");
});

test("svizzero: chi si è ritirato non viene accoppiato, la classifica completa conta", () => {
  const P = names(8), rounds = [TF.swPair(P, [], det(lcg(3)))];
  rounds[0].forEach((m) => { m.sa = 1; m.sb = 0; m.w = m.a; });
  const X = rounds[0][0].b, beat = rounds[0][0].a, out = outOf(X);
  const rd = TF.swPair(P, rounds, null, null, out), seen = [];
  rd.forEach((m) => { seen.push(m.a); if (m.b) seen.push(m.b); });
  assert.ok(seen.indexOf(X) < 0);
  assert.strictEqual(seen.length, 7);
  const played = new Set(rounds[0].map((m) => [m.a, m.b].sort().join("|")));
  rd.filter((m) => m.b).forEach((m) => assert.ok(!played.has([m.a, m.b].sort().join("|")), "rivincita"));
  /* chi ha battuto X resta tra i primi: senza X in players perderebbe la vittoria */
  const full = TF.swStandings(P, rounds).map((t) => t.n), cut = TF.swStandings(P.filter((n) => n !== X), rounds).map((t) => t.n);
  assert.ok(full.indexOf(beat) < 4);
  assert.ok(cut.indexOf(beat) > full.indexOf(beat));
  /* il bye a tavolino vale come un riposo */
  const st = TF.swStandings(["A", "B"], [[{ a: "A", b: null, sa: null, sb: null, w: null, ff: "B" }]]);
  assert.strictEqual(st[0].n, "A"); assert.strictEqual(st[0].pts, 3); assert.strictEqual(st[0].bye, true);
});

test("girone all'italiana: tavolini, partite annullate e nuovi iscritti", () => {
  const g = { players: ["A", "B", "C", "D"], matches: [
    { a: "A", b: "B", sa: 2, sb: 1 }, { a: "C", b: "D", sa: 0, sb: 0 },
    { a: "A", b: "C", sa: null, sb: null }, { a: "B", b: "D", sa: null, sb: null },
    { a: "A", b: "D", sa: 1, sb: 3 }, { a: "B", b: "C", sa: null, sb: null, void: true }] };
  const by = {};
  TF.rrStandings(g, null, outOf("C", "D")).forEach((t) => (by[t.n] = t));
  assert.deepStrictEqual([by.A.pt, by.A.w, by.A.g, by.A.gf, by.A.gs], [6, 2, 3, 3, 4], "A vince a tavolino contro C");
  assert.deepStrictEqual([by.B.pt, by.B.w, by.B.g], [3, 1, 2], "B vince a tavolino contro D, la void non conta");
  assert.deepStrictEqual([by.C.g, by.C.l, by.C.d], [2, 1, 1]);
  assert.strictEqual(by.C.out, true); assert.strictEqual(by.A.out, false);
  assert.strictEqual(by.D.pt, 4, "il 3-1 inserito vale più del tavolino");
  /* tra due ritirati non conta */
  TF.rrStandings({ players: ["C", "D"], matches: [{ a: "C", b: "D", sa: null, sb: null }] }, null, outOf("C", "D")).forEach((t) => assert.strictEqual(t.g, 0));
  /* con la formula vale vinta e bye */
  const rank = TF.fxCompile("2*vinta + 5*bye + 7*persa", TF.FX_MATCH_VARS);
  const s3 = TF.rrStandings({ players: ["A", "C"], matches: [{ a: "A", b: "C", sa: null, sb: null }] }, rank, outOf("C"));
  assert.strictEqual(s3[0].n, "A"); assert.strictEqual(s3[0].pt, rank.run(TF.fxMatchVars(null, null, true)));
  assert.strictEqual(s3[1].pt, 7);
  /* rrJoin */
  const P = ["A", "B", "C"], gr = { players: P.slice(), matches: TF.rrMatches(P) }, before = JSON.stringify(gr.matches);
  assert.strictEqual(TF.rrJoin(gr, "N"), 3);
  assert.strictEqual(JSON.stringify(gr.matches.slice(0, 3)), before);
  assert.deepStrictEqual(gr.matches.slice(3).map((m) => m.day), [4, 5, 6]);
  assert.deepStrictEqual(gr.matches.slice(3).map((m) => m.a + "-" + m.b), ["N-A", "B-N", "N-C"]);
  assert.ok(gr.players.indexOf("N") >= 0);
  const byDay = {};
  gr.matches.forEach((m) => { (byDay[m.day] = byDay[m.day] || []).push(m.a, m.b); });
  Object.values(byDay).forEach((l) => assert.strictEqual(new Set(l).size, l.length));
});

test("free for all: ritirati, gironi liberi e finale", () => {
  const o = outOf("D");
  /* girone da 4, passano 3, uno ritirato: passano gli altri senza giocare */
  let e = TF.ffaEval({ p: ["A", "B", "C", "D"], s: {} }, false, 3, o);
  assert.strictEqual(e.free, true); assert.strictEqual(e.ok, true); assert.deepStrictEqual(e.adv, ["A", "B", "C"]);
  /* il ritirato con punteggio non conta per full né per i qualificati */
  e = TF.ffaEval({ p: ["A", "B", "C", "D"], s: { A: 1, B: 5, D: 9 } }, false, 2, o);
  assert.strictEqual(e.full, false); assert.strictEqual(e.ok, false);
  e = TF.ffaEval({ p: ["A", "B", "C", "D"], s: { A: 1, B: 5, C: 3, D: 9 } }, false, 2, o);
  assert.strictEqual(e.full, true); assert.deepStrictEqual(e.adv, ["B", "C"]);
  assert.strictEqual(e.sorted[3].n, "D"); assert.strictEqual(e.sorted[3].pos, null); assert.strictEqual(e.rk.D, undefined);
  /* girone da 2 con un ritirato: passa l'altro */
  e = TF.ffaEval({ p: ["A", "D"], s: {} }, false, 1, o);
  assert.deepStrictEqual(e.adv, ["A"]); assert.ok(e.ok);
  /* girone vuoto: chiuso, non passa nessuno */
  e = TF.ffaEval({ p: [], s: {} }, false, 2);
  assert.ok(e.ok); assert.deepStrictEqual(e.adv, []);
  /* finale con un ritirato: podio senza di lui */
  e = TF.ffaEval({ p: ["A", "B", "C", "D"], s: { A: 1, B: 2, C: 3, D: 9 } }, true, 3, o);
  assert.ok(e.ok);
  assert.deepStrictEqual(e.sorted.filter((x) => x.pos != null && x.pos <= 3).map((x) => x.n), ["C", "B", "A"]);
  /* girone da 1 senza ritirati: passa */
  e = TF.ffaEval({ p: ["A"], s: {} }, false, 3);
  assert.ok(e.ok); assert.deepStrictEqual(e.adv, ["A"]);
});

/* out come wdF dell'app: 0 = in gara, altrimenti l'ordine di ritiro (1, 2, ...) */
const rankOf = (...wd) => (n) => wd.indexOf(n) + 1;

test("ritiri in sequenza: il tavolino già vinto resta a chi si ritira dopo", () => {
  /* doppia eliminazione a 8: X si ritira, Y vince a tavolino W1-0, poi batte Z davvero in W2-0 e si ritira anche lui */
  const st = TF.deBuild(8), seeds = names(8), res = {};
  const ev = (out) => TF.deEval(st, seeds, res, true, out).M;
  const play = (id, w, out) => { const m = ev(out)[id]; assert.ok(m.ready, id + " pronta"); res[id] = { a: m.a, b: m.b, sa: m.a === w ? 1 : 0, sb: m.a === w ? 0 : 1, w }; };
  st.WB[0].forEach((m) => play(m.id, ev()[m.id].a));
  const w10 = ev()["W1-0"], X = w10.a, Y = w10.b;
  let M = ev(rankOf(X));
  assert.strictEqual(M["W1-0"].w, Y); assert.ok(M["W1-0"].ff);
  play("W1-1", M["W1-1"].a, rankOf(X));
  const Z = ev(rankOf(X))["W2-0"].b;
  play("W2-0", Y, rankOf(X));
  M = ev(rankOf(X, Y));
  assert.strictEqual(M["W1-0"].w, Y, "il tavolino di W1-0 non cambia lato");
  assert.strictEqual(M["W2-0"].w, Y, "il risultato giocato in W2-0 vale ancora");
  assert.ok(!M["W2-0"].ff);
  assert.strictEqual(M["W2-0"].l, Z);
  /* con out vero/falso tra due ritirati passa a, come prima */
  assert.strictEqual(TF.deEval(st, seeds, res, true, (n) => n === X || n === Y).M["W1-0"].w, X);

  /* doppia eliminazione a 4, tabellone perdenti: P2 vince L0-0 a tavolino su P1, batte P3 e poi si ritira */
  const st4 = TF.deBuild(4), s4 = names(4), r4 = {};
  const ev4 = (out) => TF.deEval(st4, s4, r4, true, out).M;
  const p4 = (id, w, out) => { const m = ev4(out)[id]; assert.ok(m.ready, id + " pronta"); r4[id] = { a: m.a, b: m.b, sa: m.a === w ? 1 : 0, sb: m.a === w ? 0 : 1, w }; };
  st4.WB[0].forEach((m) => p4(m.id, ev4()[m.id].a));
  const l0 = ev4()[st4.LB[0][0].id], first = l0.a, second = l0.b;
  let M4 = ev4(rankOf(first));
  assert.strictEqual(M4[st4.LB[0][0].id].w, second);
  p4(st4.WB[1][0].id, M4[st4.WB[1][0].id].b, rankOf(first));
  const lf = ev4(rankOf(first))[st4.lbFinal], third = lf.a === second ? lf.b : lf.a;
  p4(st4.lbFinal, second, rankOf(first));
  M4 = ev4(rankOf(first, second));
  assert.strictEqual(M4[st4.LB[0][0].id].w, second);
  assert.strictEqual(M4[st4.lbFinal].w, second, "la finale perdenti giocata vale ancora");
  assert.strictEqual(M4[st4.lbFinal].l, third);
  const E4 = TF.deEval(st4, s4, r4, true, rankOf(first, second));
  assert.ok(E4.done); assert.strictEqual(E4.top[1], second); assert.strictEqual(E4.top[2], third);

  /* girone: B vince a tavolino contro A (ritirato prima), poi si ritira anche B: i 3 punti restano suoi */
  const gr = { players: ["A", "B", "C"], matches: [{ a: "A", b: "B", sa: null, sb: null }, { a: "B", b: "C", sa: 2, sb: 0 }, { a: "A", b: "C", sa: 0, sb: 1 }] };
  const by = {};
  TF.rrStandings(gr, null, rankOf("A", "B")).forEach((t) => (by[t.n] = t));
  assert.deepStrictEqual([by.B.pt, by.B.w, by.B.g, by.A.l, by.A.g], [6, 2, 2, 2, 2]);
  assert.strictEqual(by.B.out, true);
  TF.rrStandings(gr, null, rankOf("B", "A")).forEach((t) => (by[t.n] = t));
  assert.deepStrictEqual([by.A.pt, by.B.pt], [3, 3], "se si ritira prima B, il tavolino va ad A");
  /* con out vero/falso tra due ritirati la partita non conta, come prima */
  TF.rrStandings(gr, null, outOf("A", "B")).forEach((t) => (by[t.n] = t));
  assert.deepStrictEqual([by.A.g, by.B.g], [1, 1]);

  /* eliminazione diretta e 3º posto: stessa regola */
  const R = [[{ a: "A", b: "B", w: null }]];
  TF.elForfeits(R, rankOf("B", "A"));
  assert.strictEqual(R[0][0].w, "A"); assert.strictEqual(R[0][0].ff, 1);
  const t = { match: true, a: "C", b: "D", w: null };
  assert.ok(TF.thirdForfeit(t, rankOf("C", "D")));
  assert.strictEqual(t.w, "D");
  const t2 = { match: true, a: "C", b: "D", w: null };
  TF.thirdForfeit(t2, outOf("C", "D"));
  assert.strictEqual(t2.w, "C");
});
