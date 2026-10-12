const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const LD = require("../js/ladder.js");

const T0 = Date.UTC(2026, 4, 1, 16, 0, 0);
const at = (min) => T0 + min * 60000;
/* Elo scritto a mano, indipendente dal modulo */
const E = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
const r1 = (x) => Math.round(x * 10) / 10;
let seq = 0;
/* partita a due giocata (come la scrive histFacts) */
const M = (a, b, w, extra) => Object.assign({ id: "m" + ++seq, order: seq, at: 0, stage: "", kind: "round", state: "done", sides: [a, b], score: null, winner: w, draw: false, forfeit: false, eliminated: null, heat: null }, extra || {});
const D = (a, b, extra) => M(a, b, null, Object.assign({ draw: true }, extra));
/* manche: [[nome, posizione]] */
const H = (rows, extra) => Object.assign({ id: "h" + ++seq, order: seq, at: 0, stage: "", kind: "heat", state: "done", sides: rows.map((r) => r[0]), score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: rows.map(([name, pos]) => ({ name, score: null, pos })) }, extra || {});
const G = (key, game, matches, extra) => Object.assign({ key, game, name: game, format: "elim", team: false, started: null, participants: [], matches }, extra || {});
const EV = (id, date, games, extra) => Object.assign({ id, title: "Torneo " + id, date, time: "", created: 0, facts: { games } }, extra || {});
const run = (events, opt) => LD.compute(events, Object.assign({ now: 1 }, opt));
const rt = (s, b, name) => { const e = s.boards[b].find((x) => x.name === name); return e ? e.rating : undefined; };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.051, (msg || "") + " " + a + " invece di " + b);

test("ladder: Elo uno contro uno, 2000 contro 2000 (K 32)", () => {
  assert.strictEqual(LD.START, 2000);
  assert.strictEqual(LD.K, 32);
  const s = run([EV("a", "2026-05-01", [G("cs2", "Counter-Strike 2", [M("Ada", "Bo", "Ada", { at: at(0) })])])]);
  assert.deepStrictEqual(s.boards["*"].map((e) => [e.pos, e.key, e.name, e.rating, e.matches, e.w, e.d, e.l, e.events, e.last, e.delta, e.move]),
    [[1, "ada", "Ada", 2016, 1, 1, 0, 0, 1, at(0), null, null], [2, "bo", "Bo", 1984, 1, 0, 0, 1, 1, at(0), null, null]]);
  assert.deepStrictEqual(Object.keys(s.boards["*"][0]), ["pos", "key", "name", "rating", "matches", "w", "d", "l", "events", "last", "delta", "move"]);
  assert.deepStrictEqual(s.boards.cs2, s.boards["*"]);
  assert.deepStrictEqual(s.games, [{ id: "cs2", label: "Counter-Strike 2" }]);
  assert.deepStrictEqual(s.events, [{ id: "a", title: "Torneo a", date: "2026-05-01", matches: 1 }]);
  assert.deepStrictEqual([s.v, s.at, s.start, s.k], [1, 1, 2000, 32]);
  /* punteggio iniziale e K configurabili */
  const c = run([EV("a", "", [G("cs2", "CS", [M("Ada", "Bo", "Bo")])])], { start: 1500, k: 16 });
  assert.deepStrictEqual(c.boards["*"].map((e) => [e.name, e.rating]), [["Bo", 1508], ["Ada", 1492]]);
  assert.deepStrictEqual([c.start, c.k], [1500, 16]);
  /* valori strani: quelli di base */
  const z = run([], { start: "boh", k: -3 });
  assert.deepStrictEqual([z.start, z.k, z.boards, z.games, z.events], [2000, 32, { "*": [] }, [], []]);
});

test("ladder: pareggio", () => {
  const s = run([EV("a", "", [G("cs2", "CS", [D("Ada", "Bo")])])]);
  assert.deepStrictEqual(s.boards["*"].map((e) => [e.pos, e.name, e.rating, e.w, e.d, e.l]), [[1, "Ada", 2000, 0, 1, 0], [1, "Bo", 2000, 0, 1, 0]]);
  /* pareggio tra punteggi diversi: chi era più in alto perde qualcosa */
  const t = run([EV("a", "", [G("cs2", "CS", [M("Ada", "Bo", "Ada"), D("Bo", "Ada")])])]);
  const d = 32 * (0.5 - E(2016, 1984));
  close(rt(t, "*", "Ada"), 2016 + d);
  close(rt(t, "*", "Bo"), 1984 - d);
  assert.ok(rt(t, "*", "Ada") < 2016);
});

test("ladder: squadre con componenti diversi e squadra senza componenti", () => {
  const team = (matches) => G("cs2", "Counter-Strike 2", matches, {
    team: true, participants: [{ name: "Rossi", members: ["Ada", "Bea"] }, { name: "Blu", members: ["Cy"] }, { name: "Verdi", members: [] }]
  });
  const s = run([EV("a", "2026-05-01", [
    G("quake", "QUAKE LIVE", [M("Ada", "Cy", "Ada", { at: at(0) })]),
    team([M("Rossi", "Blu", "Rossi", { at: at(10) }), M("Verdi", "Rossi", "Verdi", { at: at(20) })])
  ])]);
  /* tutti i giochi: Ada 2016 e Bea 2000 -> la squadra vale 2008 contro i 1984 di Cy; tutti e due ricevono lo stesso Δ */
  const d1 = 32 * (1 - E(2008, 1984)), A = 2016 + d1, B = 2000 + d1, C = 1984 - d1;
  const d2 = 32 * (1 - E(2000, (A + B) / 2));
  close(rt(s, "*", "Ada"), A - d2);
  close(rt(s, "*", "Bea"), B - d2);
  close(rt(s, "*", "Cy"), C);
  close(rt(s, "*", "Verdi"), 2000 + d2);
  /* le squadre con componenti non sono in classifica: ci sono le persone */
  assert.strictEqual(rt(s, "*", "Rossi"), undefined);
  assert.strictEqual(rt(s, "*", "Blu"), undefined);
  /* nel gioco a squadre si parte da capo: 2000 contro 2000 */
  assert.deepStrictEqual(["Ada", "Bea", "Cy"].map((n) => rt(s, "cs2", n)), [r1(2016 - 32 * (1 - E(2000, 2016))), r1(2016 - 32 * (1 - E(2000, 2016))), 1984]);
  assert.strictEqual(s.boards.cs2.find((e) => e.name === "Ada").matches, 2);
  assert.strictEqual(s.boards.quake.length, 2);
});

test("ladder: manche a 4 con pari merito, confronto a coppie con K/(n−1)", () => {
  const s = run([EV("a", "", [G("quake", "QUAKE LIVE", [H([["P1", 1], ["P2", 2], ["P3", 2], ["P4", 4], ["Ritirato", null]])])])]);
  assert.deepStrictEqual(s.boards["*"].map((e) => [e.name, e.rating, e.w, e.d, e.l]), [["P1", 2016, 1, 0, 0], ["P2", 2000, 0, 0, 1], ["P3", 2000, 0, 0, 1], ["P4", 1984, 0, 0, 1]]);
  assert.deepStrictEqual(s.boards["*"].map((e) => e.pos), [1, 2, 2, 4]);
  /* primo posto condiviso: pareggio tra i due, K/(n−1) = 16 */
  const t = run([EV("a", "", [G("quake", "Q", [H([["A", 1], ["B", 1], ["C", 3]])])])]);
  assert.deepStrictEqual(t.boards["*"].map((e) => [e.name, e.rating, e.w, e.d, e.l]), [["A", 2008, 0, 1, 0], ["B", 2008, 0, 1, 0], ["C", 1984, 0, 0, 1]]);
});

test("ladder: aggiornamento simultaneo (tutti i Δ sui punteggi di prima)", () => {
  const pre = [M("A", "B", "A"), M("C", "D", "C"), M("A", "C", "A")];
  const rows = [["B", 1], ["D", 2], ["A", 3], ["C", 4]];
  const s = run([EV("a", "", [G("quake", "Q", pre.concat([H(rows)]))])]);
  /* punteggi prima della manche, calcolati a mano */
  const R = { A: 2016, B: 1984, C: 2016, D: 1984 };
  const dAC = 32 * (1 - E(R.A, R.C));
  R.A += dAC; R.C -= dAC;
  const before = Object.assign({}, R), kk = 32 / 3, delta = { A: 0, B: 0, C: 0, D: 0 };
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const [a, pa] = rows[i], [b, pb] = rows[j], S = pa < pb ? 1 : pa === pb ? 0.5 : 0, d = kk * (S - E(before[a], before[b]));
    delta[a] += d; delta[b] -= d;
  }
  ["A", "B", "C", "D"].forEach((n) => close(rt(s, "*", n), before[n] + delta[n], n));
  /* l'ordine delle righe della manche non cambia niente */
  const p = run([EV("a", "", [G("quake", "Q", pre.concat([H([rows[2], rows[0], rows[3], rows[1]])]))])]);
  assert.deepStrictEqual(p.boards, s.boards);
});

test("ladder: non contano tavolini, riposi, partite non giocate o senza esito, stessa persona dai due lati", () => {
  const team = G("cs2", "CS", [
    M("Rossi", "Blu", "Rossi", { id: "t1" })
  ], { team: true, participants: [{ name: "Rossi", members: ["Ada", "Bea"] }, { name: "Blu", members: ["ada ", "Cy"] }] });
  const s = run([EV("a", "", [team, G("quake", "Q", [
    M("Ada", "Bo", "Ada", { forfeit: true }),
    M("Ada", null, "Ada", { sides: ["Ada"], bye: true }),
    M("Ada", "Bo", null, { state: "ready", winner: null }),
    M("Ada", "Bo", null),
    M("Ada", "Bo", "Cy"),
    M("Ada", "Ada", "Ada"),
    M("Ada", "Bo", "Ada", { state: "pending" }),
    H([["Ada", 1], ["Bo", null]]),
    H([["Ada", 1], ["Bo", 2]], { forfeit: true })
  ])])]);
  assert.deepStrictEqual(s.boards["*"], []);
  assert.deepStrictEqual(s.games, []);
  assert.strictEqual(s.events[0].matches, 0);
  /* una partita vera conta */
  const t = run([EV("a", "", [G("quake", "Q", [M("Ada", "Bo", "Ada", { forfeit: true }), M("Ada", "Bo", "Bo")])])]);
  assert.strictEqual(t.events[0].matches, 1);
  assert.deepStrictEqual(t.boards["*"].map((e) => [e.name, e.rating]), [["Bo", 2016], ["Ada", 1984]]);
  /* in una manche si salta solo la coppia con la stessa persona: qui la manche conta con A da sola contro C */
  const u = run([EV("a", "", [G("cs2", "CS", [H([["T1", 1], ["T2", 2], ["T3", 3]])], {
    team: true, participants: [{ name: "T1", members: ["A"] }, { name: "T2", members: ["A", "B"] }, { name: "T3", members: ["C"] }]
  })])]);
  assert.strictEqual(u.events[0].matches, 1);
  assert.ok(rt(u, "*", "A") > 2000 && rt(u, "*", "C") < 2000);
});

test("ladder: ordine cronologico fra tornei e dentro il torneo", () => {
  /* Elo dipende dall'ordine: X vince e poi perde non è come X perde e poi vince */
  const xFirst = 2016 - 32 * (1 - E(1984, 2016)), yFirst = 1984 + 32 * (1 - E(1984, 2016));
  const e1 = EV("e1", "2026-05-02", [G("cs2", "CS", [M("X", "Y", "X")])]);
  const e2 = EV("e2", "2026-05-01", [G("cs2", "CS", [M("Y", "X", "Y")])]);
  const s = run([e1, e2]);
  assert.deepStrictEqual(s.events.map((e) => e.id), ["e2", "e1"]);
  close(rt(s, "*", "X"), yFirst, "X");
  assert.deepStrictEqual(run([e2, e1]), s, "l'ordine in ingresso non conta");
  /* stessa data: decide l'ora, poi created, poi id; senza data vale created */
  const ev = (id, date, time, created) => EV(id, date, [], { time, created });
  const noon = new Date(2026, 4, 1, 12, 0).getTime();
  const o = run([ev("z", "2026-05-01", "21:00", 0), ev("b", "2026-05-01", "09:00", 5), ev("a", "2026-05-01", "09:00", 5), ev("c", "2026-05-01", "09:00", 1), ev("nd", "", "", noon), ev("old", "", "", 0)]);
  assert.deepStrictEqual(o.events.map((e) => e.id), ["old", "c", "a", "b", "nd", "z"]);
  /* dentro il torneo: orario della partita, poi inizio del gioco (senza orario), poi ordine dei giochi, poi order */
  const inside = run([EV("t", "", [
    G("cs2", "CS", [M("X", "Y", "X", { order: 2, at: at(50) }), M("Y", "X", "Y", { order: 1, at: at(40) })]),
    G("quake", "Q", [M("X", "Y", "X", { order: 1, at: 0 })], { started: at(45) }),
    G("tf2", "TF", [M("Y", "X", "Y", { order: 9 }), M("X", "Y", "X", { order: 3 })])
  ])]);
  /* sequenza attesa: tf2 order 3 (X), tf2 order 9 (Y) [orario 0, gioco senza inizio], cs2 at 40 (Y), quake at 45 (X), cs2 at 50 (X) */
  const ref = run([EV("t", "", [G("cs2", "CS", [M("X", "Y", "X"), M("Y", "X", "Y"), M("Y", "X", "Y"), M("X", "Y", "X"), M("X", "Y", "X")])])]);
  assert.deepStrictEqual(inside.boards["*"].map((e) => [e.name, e.rating]), ref.boards["*"].map((e) => [e.name, e.rating]));
  /* a parità di orario decide l'ordine dei giochi */
  const tie = run([EV("t", "", [G("cs2", "CS", [M("Y", "X", "Y", { at: at(5) })]), G("quake", "Q", [M("X", "Y", "X", { at: at(5) })])])]);
  close(rt(tie, "*", "X"), yFirst);
  assert.strictEqual(tie.boards["*"][0].last, at(5));
  assert.ok(xFirst !== yFirst);
});

test("ladder: classifica di tutti i giochi e classifica di ogni gioco", () => {
  const s = run([EV("a", "", [G("cs2", "Counter-Strike 2", [M("Ada", "Bo", "Ada")]), G("quake", "QUAKE LIVE", [M("Bo", "Ada", "Bo")])])]);
  const back = 32 * (1 - E(1984, 2016));
  close(rt(s, "*", "Ada"), 2016 - back);
  close(rt(s, "*", "Bo"), 1984 + back);
  assert.deepStrictEqual([rt(s, "cs2", "Ada"), rt(s, "cs2", "Bo"), rt(s, "quake", "Bo"), rt(s, "quake", "Ada")], [2016, 1984, 2016, 1984]);
  assert.deepStrictEqual(s.games, [{ id: "cs2", label: "Counter-Strike 2" }, { id: "quake", label: "QUAKE LIVE" }]);
  assert.deepStrictEqual(Object.keys(s.boards), ["*", "cs2", "quake"]);
  assert.strictEqual(s.boards["*"].find((e) => e.name === "Ada").matches, 2);
  /* i tornei di ognuno: quanti tornei diversi */
  const t = run([EV("a", "2026-01-01", [G("cs2", "CS", [M("Ada", "Bo", "Ada")])]), EV("b", "2026-02-01", [G("cs2", "CS", [M("Ada", "Cy", "Ada"), M("Ada", "Bo", "Ada")])])]);
  assert.deepStrictEqual(t.boards["*"].map((e) => [e.name, e.events, e.matches]), [["Ada", 2, 3], ["Cy", 1, 1], ["Bo", 2, 2]]);
});

test("ladder: identità, grafie e alias", () => {
  assert.strictEqual(LD.norm("  Ada \t B  "), "ada b");
  assert.strictEqual(LD.norm("José"), LD.norm("José"));
  /* stessa persona con grafie diverse: vale la più recente */
  const s = run([
    EV("a", "2026-01-01", [G("cs2", "CS", [M("marco  rossi", "Bo", "marco  rossi")])]),
    EV("b", "2026-02-01", [G("cs2", "CS", [M("Marco Rossi", "Bo", "Marco Rossi")])])
  ]);
  assert.deepStrictEqual(s.boards["*"].map((e) => [e.key, e.name, e.matches]), [["marco rossi", "Marco Rossi", 2], ["bo", "Bo", 2]]);
  /* alias: «Marco R» e «MR» sono Marco Rossi; il nome mostrato è quello canonico */
  const aliases = { "marco r": "Marco Rossi", "MR ": "Il Marco", "il marco": "Marco Rossi" };
  const t = run([
    EV("a", "2026-01-01", [G("cs2", "CS", [M("Marco R", "Bo", "Marco R")])]),
    EV("b", "2026-02-01", [G("cs2", "CS", [M("mr", "Bo", "mr"), M("marco rossi", "Bo", "marco rossi")])])
  ], { aliases });
  assert.deepStrictEqual(t.boards["*"].map((e) => [e.key, e.name, e.matches]), [["marco rossi", "Marco Rossi", 3], ["bo", "Bo", 3]]);
  assert.strictEqual(LD.key("MR", aliases), "marco rossi");
  /* alias in giro: nessun ciclo infinito */
  assert.ok(LD.key("a", { a: "B", b: "A" }));
  /* «Unisci giocatori» */
  let a = LD.alias({}, "Marco R", "Marco Rossi");
  assert.deepStrictEqual(a, { "marco r": "Marco Rossi" });
  a = LD.alias(a, "MR", "Marco R");
  assert.deepStrictEqual(a, { "marco r": "Marco Rossi", mr: "Marco Rossi" });
  a = LD.alias(a, "Marco Rossi", "Rossi M.");
  assert.deepStrictEqual(a, { "marco r": "Rossi M.", mr: "Rossi M.", "marco rossi": "Rossi M." });
  /* al contrario: la meta diventa «Marco R», che non punta più a niente */
  a = LD.alias(a, "Rossi M.", "Marco R");
  assert.deepStrictEqual(a, { mr: "Marco R", "marco rossi": "Marco R", "rossi m.": "Marco R" });
  assert.deepStrictEqual(LD.alias(a, "x", " X "), a, "un nome con sé stesso non cambia niente");
  assert.deepStrictEqual(LD.unalias(a, "MR"), { "marco rossi": "Marco R", "rossi m.": "Marco R" });
  /* un nome "__proto__" non tocca il prototipo */
  const p = LD.alias({}, "__proto__", "Ada");
  assert.strictEqual(Object.getPrototypeOf(p), Object.prototype);
  assert.strictEqual(LD.key("__PROTO__", p), "ada");
});

test("ladder: giochi personalizzati con la stessa etichetta in tornei diversi", () => {
  assert.strictEqual(LD.gameId({ key: "cs2", game: "Counter-Strike 2" }), "cs2");
  assert.strictEqual(LD.gameId({ key: "quake", game: "Il mio Quake" }), "quake");
  assert.strictEqual(LD.gameId({ key: "cmg1abc2", game: "Rocket League" }), "c:rocket league");
  assert.strictEqual(LD.gameId({ key: "cmh9zz10", game: "Rocket League (2)" }), "c:rocket league");
  assert.strictEqual(LD.gameId({ key: "cmz", game: " rocket   LEAGUE " }), "c:rocket league");
  assert.notStrictEqual(LD.gameId({ key: "cmz", game: "Trackmania" }), "c:rocket league");
  assert.strictEqual(LD.gameId({ key: "__proto__" }), "k:__proto__");
  const s = run([
    EV("a", "2026-01-01", [G("cmg1abc2", "Rocket League", [M("Ada", "Bo", "Ada")])]),
    EV("b", "2026-02-01", [G("cmh9zz10", "Rocket League (2)", [M("Ada", "Bo", "Ada")])])
  ]);
  assert.deepStrictEqual(s.games, [{ id: "c:rocket league", label: "Rocket League" }]);
  assert.strictEqual(s.boards["c:rocket league"][0].matches, 2);
  assert.deepStrictEqual(s.boards["c:rocket league"], s.boards["*"]);
});

test("ladder: la copia di un gioco del programma (base) sta nella classifica di quel gioco", () => {
  assert.strictEqual(LD.gameId({ key: "cmq1", game: "Counter-Strike 2 (2)", base: "cs2" }), "cs2");
  /* base che non è un gioco del programma: ignorata */
  assert.strictEqual(LD.gameId({ key: "cmq1", game: "Rocket League (2)", base: "rocket" }), "c:rocket league");
  assert.strictEqual(LD.gameId({ key: "cmq1", game: "Counter-Strike 2 (2)", base: "__proto__" }), "c:counter-strike 2");
  const s = run([
    EV("a", "2026-01-01", [G("cs2", "Counter-Strike 2", [M("Ada", "Bo", "Ada")]), G("cmq1", "Counter-Strike 2 (2)", [M("Ada", "Ciro", "Ciro")], { base: "cs2" })])
  ]);
  assert.deepStrictEqual(s.games, [{ id: "cs2", label: "Counter-Strike 2" }]);
  assert.strictEqual(s.boards.cs2.find((r) => r.name === "Ada").matches, 2);
  assert.deepStrictEqual(s.boards.cs2, s.boards["*"]);
});

test("ladder: variazioni e frecce rispetto al calcolo precedente", () => {
  const e1 = EV("a", "2026-01-01", [G("cs2", "CS", [M("Ada", "Bo", "Ada"), M("Cy", "Di", "Cy")])]);
  const e2 = EV("b", "2026-02-01", [G("cs2", "CS", [M("Di", "Ada", "Di"), M("Eve", "Cy", "Eve")]), G("quake", "Q", [M("Ada", "Bo", "Ada")])]);
  const s1 = run([e1]);
  assert.deepStrictEqual(s1.boards["*"].map((e) => [e.name, e.pos]), [["Ada", 1], ["Cy", 1], ["Bo", 3], ["Di", 3]]);
  const s2 = run([e1, e2], { prev: JSON.parse(JSON.stringify(s1)) });
  let checked = 0;
  s2.boards["*"].forEach((e) => {
    const o = s1.boards["*"].find((x) => x.key === e.key);
    if (!o) { assert.deepStrictEqual([e.delta, e.move], [null, null], e.name + " è nuovo"); return; }
    assert.strictEqual(e.delta, r1(e.rating - o.rating), e.name);
    assert.strictEqual(e.move, o.pos - e.pos, e.name);
    checked++;
  });
  assert.strictEqual(checked, 4);
  assert.ok(s2.boards["*"].some((e) => e.move < 0) && s2.boards["*"].find((e) => e.name === "Di").delta > 0);
  /* un gioco che prima non c'era: tutti nuovi */
  s2.boards.quake.forEach((e) => assert.deepStrictEqual([e.delta, e.move], [null, null]));
  /* senza calcolo precedente: nessuna variazione */
  run([e1, e2]).boards["*"].forEach((e) => assert.deepStrictEqual([e.delta, e.move], [null, null]));
});

test("ladder: ratingOf con ripiego sulla classifica di tutti i giochi", () => {
  const s = run([EV("a", "", [G("cs2", "CS", [M("Ada", "Bo", "Ada")]), G("quake", "Q", [M("Cy", "Ada", "Cy")])])], { aliases: { "la ada": "Ada" } });
  const cs = (n) => rt(s, "cs2", n), all = (n) => rt(s, "*", n);
  assert.strictEqual(LD.ratingOf(s, "cs2", "Ada"), cs("Ada"));
  assert.strictEqual(LD.ratingOf(s, "cs2", ["ADA ", "Bo"]), r1((cs("Ada") + cs("Bo")) / 2));
  /* chi non ha giocato a quel gioco non pesa sulla media */
  assert.strictEqual(LD.ratingOf(s, "cs2", ["Ada", "Cy"]), cs("Ada"));
  /* nessuno valutato nel gioco: vale la classifica di tutti */
  assert.strictEqual(LD.ratingOf(s, "cs2", "Cy"), all("Cy"));
  assert.strictEqual(LD.ratingOf(s, "cs2", ["Cy", "Nessuno"]), all("Cy"));
  assert.strictEqual(LD.ratingOf(s, "fifa", "Ada"), all("Ada"));
  assert.strictEqual(LD.ratingOf(s, "*", "Ada"), all("Ada"));
  assert.strictEqual(LD.ratingOf(s, "cs2", "Nessuno"), null);
  assert.strictEqual(LD.ratingOf(s, "cs2", []), null);
  assert.strictEqual(LD.ratingOf(null, "cs2", "Ada"), null);
  /* alias: quelli della fotografia, o quelli passati */
  assert.strictEqual(LD.ratingOf(s, "cs2", "La Ada"), cs("Ada"));
  assert.strictEqual(LD.ratingOf(s, "cs2", "Adina", { adina: "Ada" }), cs("Ada"));
  assert.strictEqual(LD.ratingOf(JSON.parse(JSON.stringify(s)), "cs2", "La Ada"), cs("Ada"));
  /* only: solo la classifica del gioco, senza ripiego (teste di serie «Dalla ladder»: le due scale non si mescolano) */
  assert.strictEqual(LD.ratingOf(s, "cs2", "Cy", undefined, true), null);
  assert.strictEqual(LD.ratingOf(s, "cs2", "Ada", undefined, true), cs("Ada"));
  assert.strictEqual(LD.ratingOf(s, "*", "Cy", undefined, true), all("Cy"));
  /* il risolutore degli alias della fotografia si riusa: lo stesso risultato a ogni chiamata */
  for (let i = 0; i < 3; i++) assert.strictEqual(LD.ratingOf(s, "cs2", "La Ada"), cs("Ada"));
});

test("ladder: manche con chi si è ritirato dopo averla giocata (rank)", () => {
  /* Dino si è ritirato: pos null (fuori dalla classifica del gioco), ma la manche l'ha giocata ed è arrivato ultimo */
  const heat = [{ name: "Ada", score: 30, pos: 1, rank: 1 }, { name: "Eva", score: 20, pos: 2, rank: 2 }, { name: "Dino", score: 10, pos: null, rank: 3 }];
  const withRank = run([EV("a", "", [G("wreck", "W", [H([], { heat })], { format: "ffa" })])]);
  const all3 = run([EV("a", "", [G("wreck", "W", [H([["Ada", 1], ["Eva", 2], ["Dino", 3]])], { format: "ffa" })])]);
  assert.deepStrictEqual(withRank.boards["*"].map((e) => [e.name, e.rating, e.matches]), all3.boards["*"].map((e) => [e.name, e.rating, e.matches]));
  assert.ok(rt(withRank, "*", "Dino") < 2000);
  /* senza rank chi ha pos null resta fuori, come prima */
  const noRank = run([EV("a", "", [G("wreck", "W", [H([["Ada", 1], ["Eva", 2], ["Dino", null]])], { format: "ffa" })])]);
  assert.strictEqual(rt(noRank, "*", "Dino"), undefined);
});

test("ladder: deterministico, non tocca i dati, JSON pulito", () => {
  const evs = () => [
    EV("a", "2026-01-01", [G("cs2", "CS", [M("Ada", "Bo", "Ada"), D("Cy", "Di")]), G("quake", "Q", [H([["Ada", 1], ["Cy", 2], ["Bo", 2], ["Di", 4]])])]),
    EV("b", "", [G("cmab12cd", "Mio gioco", [M("Di", "Ada", "Di", { at: at(3) })])], { created: at(0) })
  ];
  const ev = evs(), copy = JSON.parse(JSON.stringify(ev));
  const a = run(ev), b = run(evs());
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(ev, copy, "i fatti non vengono modificati");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), a);
  Object.values(a.boards).forEach((B) => B.forEach((e) => assert.ok(Number.isFinite(e.rating) && Number.isFinite(e.pos), JSON.stringify(e))));
  /* fatti rotti: nessun errore */
  const r = run([null, 5, { facts: null }, { facts: [null, { matches: [null, 7, { state: "done", sides: [{}, []] }] }] }, EV("x", "boh", [G("cs2", "CS", [M("Ada", "Bo", "Ada")])])]);
  assert.strictEqual(r.boards["*"].length, 2);
  /* facts può essere anche l'elenco dei giochi */
  assert.deepStrictEqual(run([{ id: "l", facts: [G("cs2", "CS", [M("Ada", "Bo", "Ada")])] }]).boards["*"].map((e) => e.rating), [2016, 1984]);
});

test("ladder: CSV con separatore ; e intestazioni tradotte", () => {
  const e = EV("a", "2026-05-01", [G("cs2", "CS", [M("=Hack", 'Bo "il" Bello', "=Hack", { at: at(0) })])]);
  const s1 = run([EV("z", "2026-04-01", [G("cs2", "CS", [D("=Hack", 'Bo "il" Bello')])])]);
  const s = run([EV("z", "2026-04-01", [G("cs2", "CS", [D("=Hack", 'Bo "il" Bello')])]), e], { prev: s1 });
  const seen = [];
  const c = LD.csv(s, "*", (x) => { seen.push(x); return x.toUpperCase(); });
  assert.deepStrictEqual(seen, LD.HEAD);
  assert.ok(c.startsWith("﻿"));
  const L = c.slice(1).split("\r\n");
  assert.strictEqual(L[0], LD.HEAD.map((h) => '"' + h.toUpperCase() + '"').join(";"));
  const d = new Date(at(0)), day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  assert.strictEqual(L[1], ['1', "'=Hack", "2016,0", "+16,0", "2", "1", "1", "0", "2", day].map((v) => '"' + v + '"').join(";"));
  assert.strictEqual(L[2], ['2', 'Bo ""il"" Bello', "1984,0", "-16,0", "2", "0", "1", "1", "2", day].map((v) => '"' + v + '"').join(";"));
  assert.strictEqual(L.length, 3);
  /* decimali col punto, se richiesto; traduttore assente o che sbaglia: italiano */
  assert.match(LD.csv(s, "*", null, { dec: "." }), /"2016\.0";"\+16\.0"/);
  assert.ok(LD.csv(s, "cs2", () => { throw new Error("x"); }).includes('"Posizione";"Nome";"Punteggio"'));
  /* classifica che non c'è: solo le intestazioni */
  assert.strictEqual(LD.csv(s, "nessuna").split("\r\n").length, 1);
});

test("ladder: contenuto del file ripulito (clean)", () => {
  assert.deepStrictEqual(LD.clean(null), { v: 1, cfg: { start: 2000, k: 32 }, aliases: {}, snap: null, prev: null });
  const s = run([EV("a", "", [G("cs2", "CS", [M("Ada", "Bo", "Ada")])])]);
  const c = LD.clean({ v: 1, cfg: { start: 1800, k: "24" }, aliases: { " Marco R ": "Marco Rossi", x: "X", y: 5 }, snap: s, prev: { boards: 3 } });
  assert.deepStrictEqual(c.cfg, { start: 1800, k: 24 });
  assert.deepStrictEqual(c.aliases, { "marco r": "Marco Rossi", y: "5" });
  assert.strictEqual(c.snap, s);
  assert.strictEqual(c.prev, null);
  assert.deepStrictEqual(LD.clean({ cfg: { start: -1, k: 0 } }).cfg, { start: 2000, k: 32 });
  /* i campi dell'app restano */
  assert.deepStrictEqual(LD.clean({ v: 7, sigs: { t1: "abc" }, cfgAt: 5 }), { v: 1, cfg: { start: 2000, k: 32 }, aliases: {}, snap: null, prev: null, sigs: { t1: "abc" }, cfgAt: 5 });
});

test("ladder: l'estrattore delle traduzioni prende le intestazioni del CSV", () => {
  const out = path.join(os.tmpdir(), "tornei-ladder-strings-" + process.pid + ".json");
  const root = path.join(__dirname, "..");
  const p = spawnSync(process.execPath, [path.join(root, "tools", "i18n-extract.mjs"), out], { cwd: root, encoding: "utf8" });
  assert.strictEqual(p.status, 0, p.stderr);
  const ui = new Set(JSON.parse(fs.readFileSync(out, "utf8")).ui);
  fs.unlinkSync(out);
  LD.HEAD.forEach((h) => assert.ok(ui.has(h), "non estratta: " + h));
});
