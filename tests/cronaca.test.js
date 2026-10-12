const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const CR = require("../js/cronaca.js");

const T0 = Date.UTC(2026, 9, 10, 13, 0, 0);
const at = (min) => T0 + min * 60000;
const NOW = Date.UTC(2026, 9, 11, 21, 30, 0);
/* dati che non devono mai finire nello storico */
const SECRETS = ["SEGRETA-EV", "ts-segreta", "123456789012345678", "pw-lupi", "lupo#1234", "99887766", "10.0.0.5", "srv-pass", "tok-bot"];

/* eliminazione diretta a squadre: 8 squadre, una ritirata (tavolino), una sorpresa, finale 3º posto */
function cs2() {
  const teams = [["Lupi", "Marco", "Luca", "Gianni"], ["Orsi", "Ada", "Bea"], ["Volpi", "Carlo", "Dario"], ["Falchi", "Enzo", "Franco"],
    ["Aquile", "Gino", "Ugo"], ["Tori", "Ivo", "Leo"], ["Cervi", "Mia", "Nina"], ["Squali", "Oreste", "Pino"]];
  const M = (id, order, min, stage, kind, a, b, sa, sb, w, extra) => Object.assign({
    id, order, at: at(min), stage, kind, state: "done", sides: [a, b], score: sa == null ? null : [sa, sb], winner: w, draw: false, forfeit: false,
    eliminated: null, heat: null, server: { addr: "10.0.0.5:27015", pass: "srv-pass" }, accounts: ["lupo#1234"]
  }, extra || {});
  return {
    key: "cs2", game: "Counter-Strike 2", name: "Counter-Strike 2 — Coppa d'Autunno", format: "elim", formatLabel: "Eliminazione diretta",
    team: true, done: true, status: "Concluso", started: at(0), finished: at(240),
    participants: teams.map((t, i) => ({ name: t[0], seed: i + 1, members: t.slice(1), withdrawn: t[0] === "Tori", discord: "lupo#1234", telegram: 99887766, password: "pw-lupi" })),
    matches: [
      M("e0-0", 0, 30, "Quarti di finale", "round", "Lupi", "Squali", 2, 0, "Lupi", { eliminated: "Squali" }),
      M("e0-1", 1, 10, "Quarti di finale", "round", "Falchi", "Aquile", 1, 2, "Aquile", { eliminated: "Falchi" }),
      M("e0-2", 2, 45, "Quarti di finale", "round", "Orsi", "Cervi", 1, 2, "Cervi", { eliminated: "Orsi" }),
      M("e0-3", 3, 5, "Quarti di finale", "round", "Volpi", "Tori", null, null, "Volpi", { forfeit: true, eliminated: "Tori" }),
      M("e1-0", 4, 90, "Semifinale", "semi", "Lupi", "Aquile", 13, 4, "Lupi"),
      M("e1-1", 5, 100, "Semifinale", "semi", "Cervi", "Volpi", 1, 2, "Volpi"),
      M("e3", 7, 180, "Finale 3º posto", "third", "Aquile", "Cervi", 16, 14, "Cervi", { eliminated: "Aquile" }),
      M("e2-0", 6, 210, "Finale", "final", "Lupi", "Volpi", 3, 2, "Lupi", { eliminated: "Volpi" })
    ],
    standings: [["Lupi", 1], ["Volpi", 2], ["Cervi", 3], ["Aquile", 4], ["Squali", 5], ["Falchi", 5], ["Orsi", 5], ["Tori", 5]].map(([name, pos]) => ({ name, pos })),
    champion: "Lupi"
  };
}

/* doppia eliminazione a 4 con bella; orari mancanti (0) mescolati a orari veri -> ordine del tabellone */
function ql() {
  const M = (id, order, t, kind, stage, a, b, sa, sb, w, el) => ({ id: "d" + id, order, at: t, stage, kind, state: "done", sides: [a, b], score: [sa, sb], winner: w, draw: false, forfeit: false, eliminated: el || null, heat: null });
  return {
    key: "ql", game: "QUAKE LIVE", name: "QUAKE LIVE", format: "double", formatLabel: "Doppia eliminazione (winner + loser bracket)",
    team: false, done: true, status: "Concluso", started: at(0), finished: at(90),
    participants: ["Ada", "Bo", "Cy", "Di"].map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: false })),
    matches: [
      M("W0-0", 0, 0, "winners", "Vincenti", "Ada", "Di", 3, 10, "Di"),
      M("W0-1", 1, at(10), "winners", "Vincenti", "Bo", "Cy", 10, 8, "Bo"),
      M("W1-0", 2, 0, "winners", "Vincenti", "Di", "Bo", 9, 10, "Bo"),
      M("L0-0", 3, at(40), "losers", "Perdenti", "Ada", "Cy", 10, 2, "Ada", "Cy"),
      M("L1-0", 4, at(55), "losers", "Perdenti", "Di", "Ada", 7, 10, "Ada", "Di"),
      M("GF", 5, at(70), "grand", "Finale", "Bo", "Ada", 6, 10, "Ada"),
      M("GF2", 6, at(85), "bella", "Bella", "Bo", "Ada", 9, 10, "Ada", "Bo")
    ],
    standings: [{ pos: 1, name: "Ada" }, { pos: 2, name: "Bo" }, { pos: 3, name: "Di" }, { pos: 4, name: "Cy" }],
    champion: "Ada"
  };
}

/* gironi: pareggio, punteggi decimali, tavolini di un ritirato */
function tf2() {
  const M = (id, order, min, day, a, b, sa, sb, extra) => Object.assign({ id, order, at: at(min), stage: "giornata " + day, kind: "group", state: "done", sides: [a, b], score: sa == null ? null : [sa, sb], winner: null, draw: false, forfeit: false, eliminated: null, heat: null }, extra || {});
  return {
    key: "tf2", game: "Team Fortress 2", name: "Team Fortress 2", format: "rr", formatLabel: "Gironi all'italiana + playoff",
    team: false, done: true, status: "Concluso", started: at(0), finished: at(200),
    participants: ["Eva", "Fil", "Gea", "Ivo"].map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: name === "Ivo" })),
    matches: [
      M("g0-0", 0, 20, 1, "Eva", "Fil", 3, 3, { draw: true }),
      M("g0-1", 1, 25, 1, "Gea", "Ivo", 2.5, 1),
      M("g0-2", 2, 60, 2, "Eva", "Gea", 5, 1, { winner: "Eva" }),
      M("g0-3", 3, 65, 2, "Fil", "Ivo", null, null, { winner: "Fil", forfeit: true }),
      M("g0-4", 4, 100, 3, "Eva", "Ivo", null, null, { winner: "Eva", forfeit: true }),
      M("g0-5", 5, 110, 3, "Fil", "Gea", 4, 3, { winner: "Fil" })
    ],
    standings: [{ pos: 1, name: "Eva" }, { pos: 2, name: "Fil" }, { pos: 3, name: "Gea" }, { pos: 4, name: "Ivo" }],
    champion: "Eva"
  };
}

/* svizzero in corso, senza orari (versione vecchia): vittorie senza punteggio, pareggio senza punteggio,
   decimali, e una vittoria di chi ha fatto meno punti */
function rl() {
  const M = (id, order, turn, a, b, sc, w, extra) => Object.assign({ id, order, at: 0, stage: "Turno " + turn, kind: "swiss", state: "done", sides: [a, b], score: sc, winner: w, draw: false, forfeit: false, eliminated: null, heat: null }, extra || {});
  return {
    key: "rl", game: "Rocket League", name: "Rocket League", format: "swiss", formatLabel: "Sistema svizzero + playoff",
    team: false, done: false, status: "Turno 3 di 4", started: null, finished: null,
    participants: ["Kai", "Leo", "Max", "Noa"].map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: false })),
    matches: [
      M("s0-0", 0, 1, "Kai", "Leo", null, "Kai"),
      M("s0-1", 1, 1, "Max", "Noa", null, null, { draw: true }),
      M("s1-0", 2, 2, "Kai", "Max", [2.5, 1.5], "Kai"),
      M("s1-1", 3, 2, "Leo", "Noa", [0, 3], "Noa"),
      M("s2-0", 4, 3, "Kai", "Noa", null, "Kai"),
      M("s2-1", 5, 3, "Leo", "Max", [1, 2], "Leo"),
      { id: "s3-0", order: 6, at: null, stage: "Turno 4", kind: "swiss", state: "ready", sides: ["Kai", "Max"], score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: null }
    ],
    standings: [{ pos: 1, name: "Kai" }, { pos: 2, name: "Noa" }, { pos: 3, name: "Max" }, { pos: 4, name: "Leo" }],
    champion: null
  };
}

/* free for all a manche: passano i primi 2, una manche con pari merito, finale */
function fn() {
  const H = (arr) => arr.map(([name, score, pos]) => ({ name, score, pos }));
  return {
    key: "fn", game: "Fortnite", name: "Fortnite", format: "ffa", formatLabel: "Free for all a punti (battle royale)",
    team: false, done: true, status: "Concluso", started: at(300), finished: at(400),
    participants: ["Pia", "Quo", "Ray", "Sam", "Tea", "Uma"].map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: false })),
    matches: [
      { id: "f0-0", order: 0, at: at(310), stage: "Turno 1, girone A", kind: "heat", state: "done", sides: ["Pia", "Quo", "Ray"], score: null, winner: "Pia", draw: false, forfeit: false, eliminated: null, heat: H([["Pia", 30, 1], ["Quo", 22, 2], ["Ray", 10, 3]]), adv: 2 },
      { id: "f0-1", order: 1, at: at(320), stage: "Turno 1, girone B", kind: "heat", state: "done", sides: ["Sam", "Tea", "Uma"], score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: H([["Sam", 25, 1], ["Tea", 25, 1], ["Uma", 5, 3]]), adv: 2 },
      { id: "f1-0", order: 2, at: at(380), stage: "Finale", kind: "final", state: "done", sides: ["Pia", "Sam", "Tea", "Quo"], score: null, winner: "Pia", draw: false, forfeit: false, eliminated: null, heat: H([["Pia", 40.5, 1], ["Sam", 35, 2], ["Tea", 20, 3], ["Quo", null, 4]]) }
    ],
    standings: [["Pia", 1], ["Sam", 2], ["Tea", 3], ["Quo", 4], ["Ray", 5], ["Uma", 6]].map(([name, pos]) => ({ name, pos })),
    champion: "Pia"
  };
}

function facts() {
  return {
    app: { name: "Tornei Fragmarathon", version: "3.11.0" },
    lang: "it",
    event: {
      id: "ev1", title: "Fragmarathon d'Autunno 2026", subtitle: "La LAN dei record", date: "2026-10-10", time: "15:00",
      place: "Palazzetto di Ponzano", mode: "lan", address: "Via dello Sport 1, Ponzano",
      password: "SEGRETA-EV", dguild: "123456789012345678", tsPass: "ts-segreta", botToken: "tok-bot"
    },
    games: [cs2(), ql(), tf2(), rl(), fn(), {
      key: "wf", game: "Wreckfest", name: "Wreckfest", format: "elim", formatLabel: "Eliminazione diretta", team: false, done: false, status: "Non ancora avviato",
      participants: [{ name: "Zed", seed: 1, members: [], withdrawn: false }, { name: "Yul", seed: 2, members: [], withdrawn: false }], matches: [], standings: [], champion: null
    }]
  };
}

/* front matter YAML: solo righe `chiave: "stringa"`, `chiave:` + `  - "stringa"`, `chiave: []` */
function frontMatter(md) {
  const L = md.split("\n");
  assert.strictEqual(L[0], "---");
  const end = L.indexOf("---", 1);
  assert.ok(end > 1, "front matter chiuso");
  const out = {};
  let cur = null;
  for (const line of L.slice(1, end)) {
    let m;
    if ((m = /^([a-z_]+): (".*")$/.exec(line))) { out[m[1]] = JSON.parse(m[2]); cur = null; }
    else if ((m = /^([a-z_]+): \[\]$/.exec(line))) { out[m[1]] = []; cur = null; }
    else if ((m = /^([a-z_]+):$/.exec(line))) { cur = out[m[1]] = []; }
    else if ((m = /^ {2}- (".*")$/.exec(line)) && cur) cur.push(JSON.parse(m[1]));
    else assert.fail("riga YAML inattesa: " + line);
  }
  return { fm: out, text: L.slice(1, end).join("\n") };
}
function jsonBlock(md) {
  const m = /\n```json\n([\s\S]*?)\n```\n?$/.exec(md);
  assert.ok(m, "blocco json in fondo al file");
  return JSON.parse(m[1]);
}
function prose(md) { return md.slice(0, md.indexOf("```json")); }

test("storico: front matter YAML ben formato", () => {
  const r = CR.build(facts(), { now: NOW });
  const { fm, text } = frontMatter(r.md);
  assert.deepStrictEqual(Object.keys(fm), ["schema", "app", "version", "generated", "lang", "event_title", "event_date", "place", "games", "note"]);
  assert.strictEqual(fm.schema, CR.SCHEMA);
  assert.strictEqual(fm.app, "Tornei Fragmarathon");
  assert.strictEqual(fm.version, "3.11.0");
  assert.strictEqual(fm.event_title, "Fragmarathon d'Autunno 2026");
  assert.strictEqual(fm.event_date, "2026-10-10");
  assert.deepStrictEqual(fm.games, ["Counter-Strike 2 — Coppa d'Autunno", "QUAKE LIVE", "Team Fortress 2", "Rocket League", "Fortnite", "Wreckfest"]);
  assert.strictEqual(Date.parse(fm.generated), NOW);
  /* se c'è un parser YAML vero (dipendenza di electron-builder), deve leggere la stessa cosa */
  let yaml = null;
  try { yaml = require("js-yaml"); } catch (e) { /* facoltativo */ }
  if (yaml) assert.deepStrictEqual(yaml.load(text, { schema: yaml.JSON_SCHEMA }), fm);
  /* titoli con virgolette, a capo e caratteri strani restano YAML valido */
  const f = facts();
  f.event.title = 'Il "grande" torneo\n#1: \\ — \u2028 fine';
  const r2 = CR.build(f, { now: NOW });
  assert.strictEqual(frontMatter(r2.md).fm.event_title, f.event.title);
});

test("storico: il JSON in fondo è parsabile e uguale a data", () => {
  const r = CR.build(facts(), { now: NOW });
  assert.deepStrictEqual(jsonBlock(r.md), r.data);
  assert.strictEqual(r.data.schema, CR.SCHEMA);
  assert.strictEqual(r.data.games.length, 6);
  /* ogni partita giocata ha il suo commento, quelle da giocare no */
  r.data.games.forEach((g) => {
    assert.ok(typeof g.intro === "string" && g.intro.length > 10, "intro di " + g.key);
    assert.ok(typeof g.outro === "string" && g.outro.length > 10, "outro di " + g.key);
    g.matches.forEach((m) => {
      if (m.state === "done") assert.ok(typeof m.comment === "string" && m.comment.length > 10, "commento di " + g.key + " " + m.id);
      else assert.strictEqual(m.comment, null);
    });
  });
  assert.ok(r.data.event.intro.length > 20 && r.data.event.outro.length > 20);
});

test("storico: niente undefined, NaN, null o segnaposto rimasti nel testo", () => {
  const r = CR.build(facts(), { now: NOW });
  const p = prose(r.md);
  assert.doesNotMatch(p, /undefined|NaN|\bnull\b|\[object/);
  assert.doesNotMatch(r.md, /\{[a-zA-Z]\}/);
  r.lines.forEach((l) => {
    assert.doesNotMatch(l.text + " " + l.comment, /undefined|NaN|\bnull\b|\{[a-zA-Z]\}/);
    assert.ok(l.text.length > 2);
  });
  /* tutti i numeri del contratto mancanti o sbagliati: nessun crash, nessun NaN */
  const f = facts();
  f.games[0].matches[0].score = ["x", 2];
  f.games[0].matches[1].at = "boh";
  f.games[1].matches[0].score = [NaN, Infinity];
  f.games[4].matches[0].heat[0].score = "dieci";
  f.games.push(null, { key: "vuoto" });
  const r2 = CR.build(f, { now: NOW });
  assert.doesNotMatch(prose(r2.md), /undefined|NaN|\bnull\b|\[object/);
  assert.deepStrictEqual(jsonBlock(r2.md), r2.data);
  /* fatti vuoti */
  const r3 = CR.build(null, { now: NOW });
  assert.doesNotMatch(prose(r3.md), /undefined|NaN|\bnull\b/);
  assert.deepStrictEqual(jsonBlock(r3.md), r3.data);
});

test("storico: deterministico", () => {
  const a = CR.build(facts(), { now: NOW }), b = CR.build(facts(), { now: NOW });
  assert.strictEqual(a.md, b.md);
  assert.deepStrictEqual(a.lines, b.lines);
  /* i fatti non vengono modificati */
  const f = facts(), copy = JSON.parse(JSON.stringify(f));
  CR.build(f, { now: NOW });
  assert.deepStrictEqual(f, copy);
});

test("storico: opt.tr traduce i modelli, mai i nomi", () => {
  const seen = new Set();
  const r = CR.build(facts(), { now: NOW, tr: (s) => { seen.add(s); return s.toUpperCase(); } });
  /* nessun nome passato al traduttore */
  ["Lupi", "Ada", "Kai", "Pia", "Fragmarathon d'Autunno 2026", "Counter-Strike 2 — Coppa d'Autunno", "Marco"].forEach((n) => assert.ok(!seen.has(n), n));
  assert.match(r.md, /^## COME LEGGERE QUESTO FILE$/m);
  assert.match(r.md, /^### CRONACA$/m);
  assert.match(r.md, /^## Counter-Strike 2 — Coppa d'Autunno$/m);
  assert.doesNotMatch(r.md, /LUPI|VOLPI|MARCO|\{[a-zA-Z]\}/);
  const fin = r.lines.find((l) => l.game === "cs2" && l.id === "e2-0");
  assert.strictEqual(fin.stage, "FINALE");
  assert.match(fin.comment, /Lupi/);
  assert.strictEqual(fin.comment.replace(/Lupi|Volpi|Counter-Strike 2 — Coppa d'Autunno/g, "").toUpperCase(), fin.comment.replace(/Lupi|Volpi|Counter-Strike 2 — Coppa d'Autunno/g, ""));
  /* traduttore che sbaglia: lancia, restituisce vuoto o perde segnaposto -> si usa l'italiano o si toglie il segnaposto */
  const bad = CR.build(facts(), { now: NOW, tr: (s) => { if (/vince/.test(s)) throw new Error("x"); if (/Signore/.test(s)) return ""; return s.replace("{l}", "{q}"); } });
  assert.doesNotMatch(bad.md, /\{[a-zA-Z]\}|undefined/);
  assert.deepStrictEqual(jsonBlock(bad.md), bad.data);
});

test("storico: password, account e server non arrivano mai nel file", () => {
  const r = CR.build(facts(), { now: NOW });
  const all = r.md + JSON.stringify(r.data) + JSON.stringify(r.lines);
  SECRETS.forEach((s) => assert.ok(all.indexOf(s) < 0, "trovato " + s));
  assert.deepStrictEqual(Object.keys(r.data.event), ["id", "title", "subtitle", "date", "time", "place", "mode", "address", "intro", "outro"]);
  assert.deepStrictEqual(Object.keys(r.data.games[0].participants[0]), ["name", "seed", "members", "withdrawn", "rating"]);
  assert.deepStrictEqual(Object.keys(r.data.games[0].matches[0]), ["id", "order", "at", "stage", "kind", "state", "sides", "score", "winner", "draw", "forfeit", "eliminated", "heat", "comment"]);
});

test("storico: ordine per orario se tutte le partite lo hanno, altrimenti del tabellone", () => {
  const r = CR.build(facts(), { now: NOW });
  const ids = (k) => r.lines.filter((l) => l.game === k).map((l) => l.id);
  assert.deepStrictEqual(ids("cs2"), ["e0-3", "e0-1", "e0-0", "e0-2", "e1-0", "e1-1", "e3", "e2-0"]);
  assert.deepStrictEqual(ids("ql"), ["dW0-0", "dW0-1", "dW1-0", "dL0-0", "dL1-0", "dGF", "dGF2"]);
  assert.deepStrictEqual(ids("rl"), ["s0-0", "s0-1", "s1-0", "s1-1", "s2-0", "s2-1"]);
  /* l'orario si mostra dove c'è */
  const q = r.lines.filter((l) => l.game === "ql");
  assert.strictEqual(q[0].time, "");
  assert.strictEqual(q[0].at, null);
  assert.match(q[1].time, /\d\d:\d\d$/);
  const d = new Date(at(10));
  assert.ok(q[1].time.endsWith(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")));
  assert.match(r.md, /Le partite senza orario sono state giocate quando il programma non registrava ancora l'ora\./);
  /* nel file la riga ha orario e fase in grassetto, il commento sotto, citato */
  assert.match(r.md, /\n- \*\*\d\d:\d\d · Finale\*\* — Lupi \*\*3–2\*\* Volpi\n {2}> \S/);
  assert.match(r.md, /\n- \*\*Vincenti\*\* — Ada \*\*3–10\*\* Di\n/);
});

test("storico: orari ISO 8601 con fuso", () => {
  const r = CR.build(facts(), { now: NOW });
  const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/;
  assert.match(r.data.generated, ISO);
  r.data.games.forEach((g) => g.matches.forEach((m) => { if (m.at !== null) { assert.match(m.at, ISO); } }));
  const m = r.data.games[0].matches[0];
  assert.strictEqual(Date.parse(m.at), at(30));
  assert.strictEqual(Date.parse(r.data.games[0].started), at(0));
  assert.strictEqual(r.data.games[3].started, null);
  /* giocata senza orario e non giocata: entrambe null, le distingue state */
  assert.strictEqual(r.data.games[3].matches[0].at, null);
  assert.strictEqual(r.data.games[3].matches[6].at, null);
  assert.strictEqual(r.data.games[3].matches[6].state, "ready");
});

test("storico: situazioni (tavolino, pareggio, decimali, senza punteggio, sorpresa, bella, manche)", () => {
  const r = CR.build(facts(), { now: NOW });
  const L = (k, id) => r.lines.find((l) => l.game === k && l.id === id);
  assert.strictEqual(L("cs2", "e0-3").text, "Volpi vince a tavolino contro Tori");
  assert.match(L("cs2", "e0-3").comment, /ritiro di Tori|Tori ha lasciato|ritiro di Tori/);
  assert.match(L("cs2", "e0-2").comment, /numero 7|numero 2/);
  assert.strictEqual(L("tf2", "g0-0").text, "Eva 3–3 Fil (pareggio)");
  assert.match(L("tf2", "g0-0").comment, /Eva e Fil/);
  assert.strictEqual(L("tf2", "g0-1").text, "Gea 2,5–1 Ivo");
  assert.strictEqual(L("rl", "s0-0").text, "Kai batte Leo");
  assert.strictEqual(L("rl", "s0-1").text, "Max e Noa pareggiano");
  assert.strictEqual(L("rl", "s1-0").text, "Kai 2,5–1,5 Max");
  assert.match(L("rl", "s1-0").comment, /2,5–1,5/);
  assert.strictEqual(L("rl", "s2-1").text, "Leo 1–2 Max · vince Leo");
  assert.match(L("rl", "s2-0").comment, /3/, "terza vittoria di fila di Kai");
  assert.match(L("ql", "dGF").comment, /bella|decisiva/);
  assert.match(L("ql", "dGF2").comment, /Ada/);
  assert.strictEqual(L("fn", "f0-0").text, "1º Pia (30) · 2º Quo (22) · 3º Ray (10)");
  assert.match(L("fn", "f0-0").comment, /Passano il turno: Pia e Quo\./);
  assert.match(L("fn", "f0-1").comment, /Sam e Tea/);
  assert.strictEqual(L("fn", "f1-0").text, "1º Pia (40,5) · 2º Sam (35) · 3º Tea (20) · 4º Quo");
  /* ritirati segnalati, componenti delle squadre, classifiche, numeri */
  assert.match(r.md, /- \*\*Tori\*\* \(testa di serie 6\): Ivo, Leo — \*fuori per ritiro\*/);
  assert.match(r.md, /- \*\*Lupi\*\* \(testa di serie 1\): Marco, Luca, Gianni/);
  assert.match(r.md, /### Classifica finale\n\n- \*\*1º\*\* Lupi\n- \*\*2º\*\* Volpi\n- \*\*3º\*\* Cervi/);
  assert.match(r.md, /### Classifica provvisoria/);
  assert.match(r.md, /- \*\*Partite giocate:\*\* 8, di cui 1 a tavolino/);
  assert.match(r.md, /- \*\*Vittoria più larga:\*\* Lupi \*\*13–4\*\* Aquile · Semifinale\n/);
  assert.match(r.md, /- \*\*Partita più combattuta:\*\* Eva \*\*3–3\*\* Fil \(pareggio\) · giornata 1\n/);
  assert.match(r.md, /- \*\*Miglior punteggio in una manche:\*\* Pia, 40,5 · Finale\n/);
  assert.match(r.md, /- \*\*Manche giocate:\*\* 3\n/);
  assert.match(r.md, /Partite ancora da giocare: 1\./);
  assert.match(r.md, /Nessuna partita giocata finora\./);
  assert.match(r.data.games[0].outro, /Lupi \(Marco, Luca e Gianni\)/);
  assert.deepStrictEqual(r.data.games[3].numbers.longest_streak, { length: 3, names: ["Kai"] });
  /* lo storico di un torneo in corso non dichiara campioni che non ci sono */
  assert.strictEqual(r.data.games[3].champion, null);
  assert.doesNotMatch(r.data.games[3].outro, /campion/i);
});

test("storico: varianti diverse, mai la stessa due volte di fila", () => {
  const P = Array.from({ length: 8 }, (_, i) => "P" + (i + 1)), ms = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) ms.push({ id: "g0-" + ms.length, order: ms.length, at: 0, stage: "giornata " + (i + 1), kind: "group", state: "done", sides: [P[i], P[j]], score: [3, 1], winner: P[i] });
  const f = { app: { name: "Tornei Fragmarathon", version: "3.11.0" }, lang: "it", event: { title: "Prova" }, games: [{ key: "x", name: "Gioco", format: "rr", participants: P.map((name) => ({ name })), matches: ms, done: false }] };
  const r = CR.build(f, { now: NOW });
  const c = r.lines.map((l) => l.comment.replace(/P\d/g, "X"));
  for (let i = 1; i < c.length; i++) assert.notStrictEqual(c[i], c[i - 1], "righe " + (i - 1) + " e " + i);
  assert.ok(new Set(c).size >= 6, "varietà: " + new Set(c).size);
});

test("storico: nomi con caratteri Markdown o segnaposto restano come sono", () => {
  const f = facts();
  f.games[2].participants[0].name = "Eva_*{w}*";
  f.games[2].matches.forEach((m) => { m.sides = m.sides.map((s) => (s === "Eva" ? "Eva_*{w}*" : s)); if (m.winner === "Eva") m.winner = "Eva_*{w}*"; });
  f.games[2].standings[0].name = f.games[2].champion = "Eva_*{w}*";
  /* il trattino basso dentro una parola non fa corsivo: non serve l'escape */
  f.games[2].participants[2].name = "gea_99";
  f.games[2].matches.forEach((m) => { m.sides = m.sides.map((s) => (s === "Gea" ? "gea_99" : s)); });
  const r = CR.build(f, { now: NOW });
  const l = r.lines.find((x) => x.game === "tf2" && x.id === "g0-2");
  assert.strictEqual(l.text, "Eva_*{w}* 5–1 gea_99");
  assert.match(l.comment, /Eva_\*\{w\}\*/);
  assert.match(r.md, /Eva\\_\\\*\{w\}\\\* \*\*5–1\*\* gea_99\n/);
  assert.match(r.md, /- \*\*gea_99\*\*\n/);
  assert.strictEqual(r.data.games[2].champion, "Eva_*{w}*");
});

test("storico: nome del file", () => {
  assert.strictEqual(CR.fileName(facts()), "fragmarathon-d-autunno-2026.storico.md");
  assert.strictEqual(CR.fileName({ event: { title: "  Città di Treviso — LAN!  " } }), "citta-di-treviso-lan.storico.md");
  assert.strictEqual(CR.fileName({}), "torneo.storico.md");
  assert.strictEqual(CR.fileName({ event: { title: "Con" } }), "torneo-con.storico.md");
  assert.strictEqual(CR.fileName({ event: { title: "比赛 2026" } }), "比赛-2026.storico.md");
});

test("storico: l'estrattore delle traduzioni prende i modelli interi", () => {
  const out = path.join(os.tmpdir(), "tornei-cronaca-strings-" + process.pid + ".json");
  const root = path.join(__dirname, "..");
  const p = spawnSync(process.execPath, [path.join(root, "tools", "i18n-extract.mjs"), out], { cwd: root, encoding: "utf8" });
  assert.strictEqual(p.status, 0, p.stderr);
  const ui = new Set(JSON.parse(fs.readFileSync(out, "utf8")).ui);
  fs.unlinkSync(out);
  /* ogni frase che il generatore passa al traduttore ed è scritta in js/cronaca.js deve essere estratta, uguale */
  const src = fs.readFileSync(path.join(root, "js", "cronaca.js"), "utf8"), seen = new Set();
  const tr = (s) => { seen.add(s); return s; };
  CR.build(facts(), { now: NOW, tr });
  CR.build(null, { now: NOW, tr });
  const f = facts();
  f.games.forEach((g) => { g.done = false; g.formatLabel = ""; g.format = "?"; });
  f.event.mode = "online";
  CR.build(f, { now: NOW, tr });
  /* sorpresa secondo la ladder */
  CR.build(rated({ Cervi: 1900, Orsi: 2050 }), { now: NOW, tr });
  let n = 0;
  seen.forEach((s) => { if (src.indexOf(JSON.stringify(s)) >= 0) { n++; assert.ok(ui.has(s), "non estratta: " + s); } });
  assert.ok(n > 60, "frasi controllate: " + n);
  assert.ok(ui.has("{w} batte {l}") && ui.has("Sul filo di lana! {w} la spunta {s} su {l}: cuori in gola!"));
});

test("storico: tabellone sorteggiato (seeded false), niente teste di serie né sorprese", () => {
  const f = facts();
  f.games.forEach((g) => { g.seeded = false; });
  const r = CR.build(f, { now: NOW });
  assert.doesNotMatch(r.md, /testa di serie|teste di serie/);
  assert.doesNotMatch(r.lines.find((l) => l.game === "cs2" && l.id === "e0-2").comment, /numero 7|numero 2|pronostic|Sorpresa|Clamoroso/);
  assert.strictEqual(r.data.games[0].seeded, false);
  /* senza il campo resta il comportamento di prima */
  assert.match(CR.build(facts(), { now: NOW }).md, /testa di serie 1/);
});

/* cs2 con le teste di serie vere: seeds = { squadra: numero }, chi non c'è non è testa di serie */
function seededFacts(seeds, ratings) {
  const f = facts(), g = f.games[0];
  g.seeded = true;
  g.participants.forEach((p) => { p.seed = seeds[p.name] || null; if (ratings && ratings[p.name] != null) p.rating = ratings[p.name]; });
  return f;
}
/* cs2 senza teste di serie, con i punteggi della ladder */
function rated(ratings) {
  const f = facts(), g = f.games[0];
  g.seeded = false;
  g.participants.forEach((p) => { p.seed = null; if (ratings[p.name] != null) p.rating = ratings[p.name]; });
  return f;
}
const SURPRISE = /numero \d|favorit|pronostic|Davide/;

test("storico: teste di serie vere, sorpresa e partecipanti senza seed", () => {
  /* e0-2: Cervi (testa di serie 4) batte Orsi (testa di serie 1) */
  const r = CR.build(seededFacts({ Orsi: 1, Lupi: 2, Volpi: 3, Cervi: 4, Falchi: 5 }), { now: NOW });
  const L = (id) => r.lines.find((l) => l.game === "cs2" && l.id === id);
  assert.match(L("e0-2").comment, /numero 4/);
  assert.match(L("e0-2").comment, /numero 1/);
  /* e0-1: Aquile (senza seed) batte Falchi (testa di serie 5): con un seed null niente sorpresa */
  assert.doesNotMatch(L("e0-1").comment, SURPRISE);
  /* solo chi è testa di serie lo porta scritto; nel JSON seed null per gli altri */
  assert.match(r.md, /- \*\*Orsi\*\* \(testa di serie 1\): Ada, Bea\n/);
  assert.match(r.md, /- \*\*Aquile\*\*: Gino, Ugo\n/);
  const P = r.data.games[0].participants;
  assert.strictEqual(r.data.games[0].seeded, true);
  assert.deepStrictEqual(P.map((p) => p.seed), [2, 1, 3, 5, null, null, 4, null]);
  P.forEach((p) => assert.strictEqual(p.rating, null));
  /* teste di serie vere in ogni formato (qui i gironi): la 4 che batte la 1 */
  const f = facts(), tf = f.games[2];
  tf.seeded = true;
  tf.participants.forEach((p) => { p.seed = { Gea: 1, Fil: 2, Ivo: 3, Eva: 4 }[p.name]; });
  const r2 = CR.build(f, { now: NOW });
  assert.match(r2.lines.find((l) => l.game === "tf2" && l.id === "g0-2").comment, /numero 4/);
  /* fuori dai tabelloni la frase non parla di tabellone: con qualunque seme di scelta delle frasi */
  for (let i = 0; i < 12; i++) {
    const fi = facts(), ti = fi.games[2];
    ti.key = "tf2x" + i; ti.seeded = true;
    ti.participants.forEach((p) => { p.seed = { Gea: 1, Fil: 2, Ivo: 3, Eva: 4 }[p.name]; });
    const ci = CR.build(fi, { now: NOW }).lines.find((l) => l.game === ti.key && l.id === "g0-2").comment;
    assert.match(ci, /numero 4/);
    assert.doesNotMatch(ci, /tabellone/);
  }
  /* fra due teste di serie decide il seed, anche se la ladder direbbe sorpresa */
  const r3 = CR.build(seededFacts({ Cervi: 1, Orsi: 2 }, { Cervi: 1800, Orsi: 2100 }), { now: NOW });
  assert.doesNotMatch(r3.lines.find((l) => l.game === "cs2" && l.id === "e0-2").comment, SURPRISE);
  /* seeded true ma nessun seed: nessuna testa di serie scritta (gli altri giochi sono fatti vecchi, senza il campo) */
  const r4 = CR.build(seededFacts({}), { now: NOW }), md4 = r4.md;
  assert.doesNotMatch(md4.slice(md4.indexOf("## Counter-Strike 2"), md4.indexOf("## QUAKE LIVE")), /testa di serie/);
  assert.match(md4.slice(md4.indexOf("## QUAKE LIVE")), /testa di serie 1/);
});

test("storico: sorpresa secondo la ladder (almeno 100 punti di differenza)", () => {
  const C = (f) => CR.build(f, { now: NOW }).lines.find((l) => l.game === "cs2" && l.id === "e0-2").comment;
  /* Cervi (1900) batte Orsi (2050): sfavorito che vince */
  const c = C(rated({ Cervi: 1900, Orsi: 2050 }));
  assert.match(c, /favorit|pronostic|Davide/);
  assert.doesNotMatch(c, /numero \d/);
  assert.match(c, /Cervi/);
  assert.match(c, /Orsi/);
  /* 99 punti: niente sorpresa; vince il favorito: niente sorpresa; un rating mancante: niente sorpresa */
  assert.doesNotMatch(C(rated({ Cervi: 1951, Orsi: 2050 })), SURPRISE);
  assert.doesNotMatch(C(rated({ Cervi: 2200, Orsi: 1900 })), SURPRISE);
  assert.doesNotMatch(C(rated({ Orsi: 2400 })), SURPRISE);
  /* con le teste di serie ma un seed mancante vale la ladder */
  assert.match(C(seededFacts({ Orsi: 1 }, { Cervi: 1900, Orsi: 2050 })), /favorit|pronostic|Davide/);
  /* il rating finisce nel JSON (un decimale), null per chi non lo ha */
  const r = CR.build(rated({ Cervi: 1900.04, Orsi: "2050.26" }), { now: NOW });
  const P = r.data.games[0].participants, by = (n) => P.find((p) => p.name === n);
  assert.deepStrictEqual([by("Cervi").rating, by("Orsi").rating, by("Lupi").rating], [1900, 2050.3, null]);
  assert.ok(r.data.legend["participants.rating"]);
});

test("storico: frasi tradotte solo intere (tr), etichette dei fatti a pezzi (trData)", () => {
  const I = require("../js/i18n-core.js");
  const dict = { s: { "Cronaca": "Chronicle", "Finale": "Final", "Girone": "Group", "giornata": "matchday", "torneo": "tournament", "ogni": "every", "Concluso": "Finished" } };
  const r = CR.build(facts(), { now: NOW, tr: (s) => I.exact(s, dict), trData: (s) => I.tr(s, dict) });
  assert.match(r.md, /^### Chronicle$/m);
  /* una frase che il dizionario non ha resta tutta in italiano: niente «tournament» o «every» in mezzo */
  assert.doesNotMatch(prose(r.md), /tournament|every/);
  assert.match(prose(r.md), /storico del torneo/);
  const L = (k, id) => r.lines.find((l) => l.game === k && l.id === id);
  assert.strictEqual(L("cs2", "e2-0").stage, "Final");
  assert.strictEqual(L("tf2", "g0-0").stage, "matchday 1");
  assert.strictEqual(r.data.games[0].status, "Finished");
  /* senza trData le etichette usano tr */
  assert.strictEqual(CR.build(facts(), { now: NOW, tr: (s) => I.exact(s, dict) }).lines.find((l) => l.id === "e2-0").stage, "Final");
  assert.strictEqual(I.exact("  Finale ", dict), "  Final ");
  assert.strictEqual(I.exact("Finale del torneo", dict), "Finale del torneo");
  assert.strictEqual(I.tr("Finale del torneo", dict), "Final del tournament");
});

test("storico: «ad»/«ed» davanti a un nome con la stessa vocale, solo nei modelli italiani", () => {
  const f = facts();
  const r = CR.build(f, { now: NOW });
  const all = prose(r.md);
  assert.doesNotMatch(all, /(^|\s)a A[a-z]|(^|\s)e E[a-z]/m);
  /* campioni elencati con «{a} e {b}»: l'ultimo comincia con la E */
  const g = (key, champ) => ({ key, game: key, name: key, format: "elim", done: true, status: "Concluso", participants: [{ name: champ }, { name: "Zed" }],
    matches: [{ id: "e0-0", order: 0, at: at(1), stage: "Finale", kind: "final", state: "done", sides: [champ, "Zed"], score: [2, 0], winner: champ }],
    standings: [{ pos: 1, name: champ }, { pos: 2, name: "Zed" }], champion: champ });
  const two = CR.build({ event: { title: "Ev" }, games: [g("A1", "Lupi"), g("B2", "Elio")] }, { now: NOW });
  assert.match(two.data.event.outro, /Lupi in A1 ed Elio in B2/);
  const fin = CR.build(f, { now: NOW, tr: (s) => s.toUpperCase() });
  /* modello tradotto (qui in maiuscolo): la regola italiana non si applica */
  assert.doesNotMatch(prose(fin.md), /\b(AD|ad) A[a-z]|\b(ED|ed) E[a-z]/);
});

/* ---- correzioni dopo la revisione ---- */
const EV = (games, ev) => ({ app: { name: "Tornei Fragmarathon", version: "3.11.0" }, lang: "it", event: Object.assign({ id: "ev9", title: "Prova", mode: "lan" }, ev || {}), games });
const heatM = (id, rows, adv, advanced, extra) => Object.assign({ id, order: 0, at: at(5), stage: "Manche 1, girone A", kind: "heat", state: "done", sides: rows.map((x) => x[0]), score: null,
  winner: null, draw: false, forfeit: false, eliminated: null, heat: rows.map(([name, score, pos]) => ({ name, score, pos })), adv, advanced }, extra || {});
const ffaG = (matches) => ({ key: "q", game: "Quake", name: "Quake", format: "ffa", seeded: false, done: false, status: "Turno 1 in corso", participants: [], matches });

test("storico: chi passa il turno è l'elenco vero del programma (advanced), anche nel JSON", () => {
  /* tutti a pari punti: il programma fa passare i primi 2 iscritti, non tutti */
  const r = CR.build(EV([ffaG([heatM("f0-0", [["Ada", 10, 1], ["Bo", 10, 1], ["Cy", 10, 1], ["Di", 10, 1]], 2, ["Ada", "Bo", "Zed"])])]), { now: NOW });
  assert.match(r.lines[0].comment, /Passano il turno: Ada e Bo\./);
  const m = jsonBlock(r.md).games[0].matches[0];
  assert.deepStrictEqual(m.advanced, ["Ada", "Bo"], "solo nomi della manche");
  assert.strictEqual(m.adv, 2);
  /* fatti vecchi senza advanced: pos <= adv */
  const o = CR.build(EV([ffaG([heatM("f0-0", [["Ada", 10, 1], ["Bo", 5, 2], ["Cy", 1, 3]], 2)])]), { now: NOW });
  assert.match(o.lines[0].comment, /Passano il turno: Ada e Bo\./);
  /* uno solo: verbo al singolare */
  const s = CR.build(EV([ffaG([heatM("f0-0", [["Ada", 10, 1], ["Bo", 5, 2], ["Cy", 1, 3]], 1, ["Ada"])])]), { now: NOW });
  assert.match(s.lines[0].comment, /Passa il turno: Ada\./);
});

test("storico: secondo e terzo della manche secondo la posizione vera (pari merito)", () => {
  for (let i = 0; i < 12; i++) {
    const r = CR.build(EV([ffaG([heatM("f0-" + i, [["Alba", 10, 1], ["Bruno", 0, 2], ["Carla", 0, 2]], 3, ["Alba", "Bruno", "Carla"])])]), { now: NOW });
    assert.doesNotMatch(r.lines[0].comment, /terzo per Carla|terzo posto per Carla|al terzo Carla/);
    assert.match(r.lines[0].comment, /Bruno e Carla/);
  }
});

test("storico: vittoria più larga e partita più combattuta solo quando spiccano davvero", () => {
  const g = (ms) => ({ key: "rr", game: "FIFA", name: "FIFA", format: "rr", seeded: false, done: false, participants: [], matches: ms.map(([a, b, sa, sb], i) => ({
    id: "g0-" + i, order: i, at: at(i), stage: "Giornata 1", kind: "group", state: "done", sides: [a, b], score: [sa, sb], winner: null })) });
  const nets = CR.build(EV([g([["Alba", "Bruno", 10, 0], ["Carla", "Dario", 9, 0], ["Elio", "Fabio", 8, 0]])]), { now: NOW });
  assert.strictEqual(nets.data.games[0].numbers.closest, null, "nessuna partita combattuta tra goleade");
  assert.strictEqual(nets.data.games[0].numbers.widest, "g0-0");
  assert.doesNotMatch(prose(nets.md), /Partita più combattuta/);
  const one = CR.build(EV([g([["G1", "G2", 2, 1]])]), { now: NOW });
  assert.strictEqual(one.data.games[0].numbers.widest, null, "una sola partita non è la «più larga»");
  assert.doesNotMatch(prose(one.md), /Vittoria più larga|Partita più combattuta/);
  const eq = CR.build(EV([g([["A1", "B1", 3, 0], ["C1", "D1", 3, 0], ["E1", "F1", 2, 1]])]), { now: NOW });
  assert.strictEqual(eq.data.games[0].numbers.widest, null, "scarto a pari merito: nessuna spicca");
  assert.strictEqual(eq.data.games[0].numbers.closest, "g0-2");
});

test("storico: il fuso della nota è quello degli orari delle partite, non del momento in cui si genera", () => {
  /* i fusi dipendono dalla macchina: si confrontano con quelli che iso() darebbe agli orari */
  const off = (t) => { const o = -new Date(t).getTimezoneOffset(), a = Math.abs(o); return (o < 0 ? "-" : "+") + String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0"); };
  const summer = Date.UTC(2026, 6, 18, 19, 4), winter = Date.UTC(2026, 11, 5, 10, 0), late = Date.UTC(2026, 11, 5, 12, 0);
  const g = (ts) => ({ key: "x", game: "X", name: "X", format: "rr", seeded: false, done: false, participants: [], matches: ts.map((t, i) => ({ id: "g0-" + i, order: i, at: t, stage: "Giornata 1", kind: "group", state: "done", sides: ["A" + i, "B" + i], score: [2, 0] })) });
  const r = CR.build(EV([g([summer])]), { now: winter });
  assert.ok(prose(r.md).includes("(UTC" + off(summer) + ")"), "nota col fuso della partita");
  const two = CR.build(EV([g([summer, winter])]), { now: late });
  if (off(summer) !== off(winter)) {
    assert.match(prose(two.md), /ha cambiato fuso/);
    assert.ok(prose(two.md).includes("UTC" + off(summer)) && prose(two.md).includes("UTC" + off(winter)), "ogni ora col suo fuso");
  } else assert.ok(prose(two.md).includes("(UTC" + off(summer) + ")"));
});

test("storico: il commento di una partita non cambia quando si gioca in un altro gioco", () => {
  const mk = (n) => ({ key: "cs", game: "CS", name: "CS", format: "rr", seeded: false, done: false, participants: [], matches: Array.from({ length: n }, (_, i) => ({
    id: "g0-" + i, order: i, at: at(i), stage: "Giornata 1", kind: "group", state: "done", sides: ["C" + i, "D" + i], score: [3, 1] })) });
  const base = CR.build(EV([mk(3), tf2(), fn()]), { now: NOW }), more = CR.build(EV([mk(4), tf2(), fn()]), { now: NOW });
  const c = (r, k) => r.lines.filter((l) => l.game === k).map((l) => l.comment);
  assert.deepStrictEqual(c(more, "tf2"), c(base, "tf2"));
  assert.deepStrictEqual(c(more, "fn"), c(base, "fn"));
});

test("storico: serie di vittorie solo dove perdere non elimina", () => {
  const P = Array.from({ length: 16 }, (_, i) => "G" + (i + 1)), ms = [];
  let alive = P.slice(), ri = 0;
  while (alive.length > 1) {
    const nx = [];
    for (let i = 0; i < alive.length; i += 2) {
      ms.push({ id: "e" + ri + "-" + i / 2, order: ms.length, at: at(ms.length), stage: "Turno " + (ri + 1), kind: alive.length === 2 ? "final" : alive.length === 4 ? "semi" : "round", state: "done",
        sides: [alive[i], alive[i + 1]], score: [2, 1], winner: alive[i], eliminated: alive[i + 1] });
      nx.push(alive[i]);
    }
    alive = nx; ri++;
  }
  const r = CR.build(EV([{ key: "e", game: "E", name: "E", format: "elim", seeded: false, done: true, participants: P.map((name) => ({ name })), matches: ms, standings: [{ pos: 1, name: "G1" }], champion: "G1" }]), { now: NOW });
  r.lines.forEach((l) => assert.doesNotMatch(l.comment, /di fila|consecutiv|una dietro l'altra/));
  assert.strictEqual(r.data.games[0].numbers.longest_streak, null);
});

test("storico: a capo e # finale nei nomi non rompono il Markdown; numeri con la virgola", () => {
  const g = { key: "x", game: "Torneo — Coppa #", name: "Torneo — Coppa #", format: "elim", seeded: false, done: false, participants: [{ name: "Tori\n# Hack" }, { name: "Orsi" }],
    matches: [{ id: "e0-0", order: 0, at: at(1), stage: "Semifinale", kind: "semi", state: "done", sides: ["Tori\n# Hack", "Orsi"], score: [0.5, 0], winner: "Tori\n# Hack" }] };
  const r = CR.build(EV([g], { title: "Coppa #" }), { now: NOW });
  const P = prose(r.md);
  assert.doesNotMatch(P, /^# Hack/m);
  assert.match(P, /^## Torneo — Coppa \\#$/m);
  assert.match(P, /^# Coppa \\#$/m);
  assert.match(P, /Tori # Hack \*\*0,5–0\*\* Orsi/);
  assert.deepStrictEqual(jsonBlock(r.md).games[0].matches[0].score, [0.5, 0], "nel JSON restano numeri");
});

test("storico: riposo dello svizzero nei fatti (spiega la classifica), senza commento", () => {
  const g = { key: "s", game: "S", name: "S", format: "swiss", seeded: false, done: false, participants: ["S1", "S2", "S3"].map((name) => ({ name })),
    matches: [{ id: "s0-0", order: 1, at: at(1), stage: "Turno 1", kind: "swiss", state: "done", sides: ["S1", "S3"], score: [2, 0], winner: "S1" },
      { id: "s0-1", order: 2, at: at(1), stage: "Turno 1", kind: "swiss", state: "done", sides: ["S2"], score: null, winner: "S2", bye: true }],
    standings: [{ pos: 1, name: "S1" }, { pos: 2, name: "S2" }, { pos: 3, name: "S3" }] };
  const r = CR.build(EV([g]), { now: NOW });
  assert.match(prose(r.md), /S2 riposa in questo turno: vale una vittoria/);
  assert.strictEqual(r.lines.length, 1, "il riposo non è una partita dell'anteprima");
  const m = jsonBlock(r.md).games[0].matches[1];
  assert.strictEqual(m.bye, true);
  assert.strictEqual(m.comment, null);
  assert.strictEqual(r.data.games[0].numbers.played, 1);
  assert.ok(jsonBlock(r.md).legend["matches.bye"]);
});

test("storico: finale giocata ma 3º posto da giocare: niente bronzo, partite da giocare, evento aperto", () => {
  const g = cs2();
  g.done = false; g.status = "Finale 3º posto in corso"; g.finished = null;
  const t = g.matches.find((m) => m.id === "e3");
  Object.assign(t, { state: "ready", at: null, score: null, winner: null, eliminated: null });
  g.standings = g.standings.filter((s) => s.name !== "Cervi" && s.name !== "Aquile");
  const r = CR.build(EV([g]), { now: NOW });
  const P = prose(r.md);
  assert.match(P, /Partite ancora da giocare: 1\./);
  assert.match(P, /### Classifica provvisoria/);
  assert.doesNotMatch(P, /bronzo per|al terzo/);
  assert.doesNotMatch(r.data.event.outro, /E qui si chiude|Si spengono le luci/);
  assert.match(r.data.event.outro, /Campione già incoronato: Lupi/);
  assert.strictEqual(r.data.games[0].champion, "Lupi");
});

test("storico: legenda dei campi nel JSON", () => {
  const L = jsonBlock(CR.build(facts(), { now: NOW }).md).legend;
  ["participants.seed", "matches.kind", "matches.draw", "matches.sides and score", "matches.eliminated", "games.format", "games.numbers", "times"].forEach((k) => assert.ok(L[k], k));
  assert.match(L["participants.seed"], /seeded/);
  assert.match(L["matches.kind"], /bella/);
});
