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
