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
