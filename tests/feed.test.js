// Feed per MaiTv (js/feed.js e feedserver.js): notizie e RSS dallo storico, e il piccolo server HTTP.
// Il server gira su una porta scelta dal sistema (0) e legge una cartella finta: mai i dati veri.
// Cartella temporanea: FEED_TEST_TMP se c'è, altrimenti quella del sistema.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const { spawnSync } = require("node:child_process");
const CR = require("../js/cronaca.js");
const FEED = require("../js/feed.js");
const createFeedServer = require("../feedserver.js");

const T0 = Date.UTC(2026, 9, 10, 13, 0, 0);
const at = (min) => T0 + min * 60000;
const NOW = Date.UTC(2026, 9, 10, 18, 0, 0);
const BASE = "http://127.0.0.1:18810";
const KEY = "0123456789abcdef01234567";

/* eliminazione diretta a squadre, conclusa: una vittoria a tavolino, la finale */
function cs2() {
  const M = (id, order, min, stage, kind, a, b, sa, sb, w, extra) => Object.assign({
    id, order, at: at(min), stage, kind, state: "done", sides: [a, b], score: sa == null ? null : [sa, sb], winner: w, draw: false, forfeit: false, eliminated: null, heat: null
  }, extra || {});
  return {
    key: "cs2", game: "Counter-Strike 2", name: "Counter-Strike 2", format: "elim", formatLabel: "Eliminazione diretta",
    team: true, done: true, status: "Concluso", started: at(0), finished: at(120),
    participants: [["Lupi", "Marco", "Luca"], ["Orsi", "Ada"], ["Volpi", "Carlo"], ["Tori", "Ivo"]].map((t, i) => ({ name: t[0], seed: i + 1, members: t.slice(1), withdrawn: t[0] === "Tori" })),
    matches: [
      M("e0-0", 0, 30, "Semifinale", "semi", "Lupi", "Orsi", 13, 4, "Lupi", { eliminated: "Orsi" }),
      M("e0-1", 1, 5, "Semifinale", "semi", "Volpi", "Tori", null, null, "Volpi", { forfeit: true, eliminated: "Tori" }),
      M("e1-0", 2, 110, "Finale", "final", "Lupi", "Volpi", 3, 2, "Lupi", { eliminated: "Volpi" })
    ],
    standings: [["Lupi", 1], ["Volpi", 2], ["Orsi", 3], ["Tori", 3]].map(([name, pos]) => ({ name, pos })),
    champion: "Lupi"
  };
}
/* girone in corso: pareggio, vittoria, una partita pronta e una che aspetta */
function tf2() {
  const M = (id, order, min, a, b, sa, sb, extra) => Object.assign({ id, order, at: at(min), stage: "Giornata 1", kind: "group", state: "done", sides: [a, b], score: [sa, sb], winner: null, draw: false, forfeit: false, eliminated: null, heat: null }, extra || {});
  return {
    key: "tf2", game: "Team Fortress 2", name: "Team Fortress 2", format: "rr", formatLabel: "Gironi all'italiana + playoff",
    team: false, done: false, status: "Torneo in corso", started: at(0), finished: null,
    participants: ["Eva", "Fil", "Gea", "Ivo"].map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: false })),
    matches: [
      M("g0-0", 0, 20, "Eva", "Fil", 1, 1, { draw: true }),
      M("g0-1", 1, 25, "Gea", "Ivo", 3, 0),
      { id: "g0-2", order: 2, at: null, stage: "Giornata 2", kind: "group", state: "ready", sides: ["Eva", "Gea"], score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: null },
      { id: "g0-3", order: 3, at: null, stage: "Giornata 3", kind: "group", state: "pending", sides: ["Fil", "Ivo"], score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: null }
    ],
    standings: [{ pos: 1, name: "Gea" }, { pos: 2, name: "Eva" }, { pos: 2, name: "Fil" }, { pos: 4, name: "Ivo" }],
    champion: null
  };
}
/* manche: passano i primi 2, una manche con il primo posto condiviso, finale da giocare */
function fn() {
  const H = (arr) => arr.map(([name, score, pos]) => ({ name, score, pos }));
  return {
    key: "fn", game: "Fortnite", name: "Fortnite", format: "ffa", formatLabel: "Free for all a punti (battle royale)",
    team: false, done: false, status: "Torneo in corso", started: at(40), finished: null,
    participants: ["Pia", "Quo", "Ray", "Sam", "Tea", "Uma"].map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: false })),
    matches: [
      { id: "f0-0", order: 0, at: at(50), stage: "Manche 1, girone A", kind: "heat", state: "done", sides: ["Pia", "Quo", "Ray"], score: null, winner: "Pia", draw: false, forfeit: false, eliminated: null, heat: H([["Pia", 30, 1], ["Quo", 22.5, 2], ["Ray", 10, 3]]), adv: 2, advanced: ["Pia", "Quo"] },
      { id: "f0-1", order: 1, at: at(60), stage: "Manche 1, girone B", kind: "heat", state: "done", sides: ["Sam", "Tea", "Uma"], score: null, winner: null, draw: true, forfeit: false, eliminated: null, heat: H([["Sam", 25, 1], ["Tea", 25, 1], ["Uma", 5, 3]]), adv: 2, advanced: ["Sam", "Tea"] },
      { id: "f1-0", order: 2, at: null, stage: "Finale", kind: "final", state: "ready", sides: ["Pia", "Quo", "Sam", "Tea"], score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: null }
    ],
    standings: [["Pia", 1], ["Sam", 2], ["Tea", 2], ["Quo", 4], ["Ray", 5], ["Uma", 6]].map(([name, pos]) => ({ name, pos })),
    champion: null
  };
}
/* svizzero: un riposo, una vittoria di chi fa meno punti, sei partite pronte (le prossime sono al massimo 6) */
function rl() {
  const P = ["Kai", "Leo", "Max", "Noa", "Oti", "Pat", "Rui", "Sol", "Tim", "Ugo", "Val", "Zoe"];
  const ready = [0, 1, 2, 3, 4, 5].map((k) => ({ id: "s1-" + k, order: 10 + k, at: null, stage: "Turno 2", kind: "swiss", state: "ready", sides: [P[k * 2], P[k * 2 + 1]], score: null, winner: null, draw: false, forfeit: false, eliminated: null, heat: null }));
  return {
    key: "rl", game: "Rocket League", name: "Rocket League", format: "swiss", formatLabel: "Sistema svizzero + playoff",
    team: false, done: false, status: "Turno 2 di 3", started: at(0), finished: null,
    participants: P.map((name, i) => ({ name, seed: i + 1, members: [], withdrawn: false })),
    matches: [
      { id: "s0-0", order: 0, at: at(70), stage: "Turno 1", kind: "swiss", state: "done", sides: ["Kai", "Leo"], score: [68, 72], winner: "Kai", draw: false, forfeit: false, eliminated: null, heat: null },
      { id: "s0-1", order: 1, at: at(71), stage: "Turno 1", kind: "swiss", state: "done", sides: ["Max"], score: null, winner: "Max", draw: false, forfeit: false, eliminated: null, heat: null, bye: true }
    ].concat(ready),
    standings: P.map((name, i) => ({ pos: i + 1, name })),
    champion: null
  };
}
function facts() {
  return {
    app: { name: "Tornei Fragmarathon", version: "3.11.0" },
    lang: "it",
    event: { id: "ev1", title: "Fragmarathon d'Autunno 2026", subtitle: "La LAN dei record", date: "2026-10-10", time: "15:00", place: "Palazzetto di Ponzano", mode: "lan", address: "Via dello Sport 1, Ponzano" },
    games: [cs2(), tf2(), fn(), rl()]
  };
}
function storico(f, now) { return CR.build(f || facts(), { now: now || NOW }); }

/* ---- XML: ben formato (tag bilanciati, attributi tra virgolette, solo le cinque entità) e notizie lette indietro ---- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unx = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m, e) => ENT[e]);
function wellFormed(x) {
  assert.ok(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'), "dichiarazione XML");
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(x), "niente caratteri di controllo");
  const body = x.slice(x.indexOf("?>") + 2);
  assert.ok(!/&(?!(amp|lt|gt|quot|apos);)/.test(body), "ogni & è un'entità");
  const stack = [], re = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)|(<)/g;
  let m, root = 0;
  while ((m = re.exec(body))) {
    if (m[6]) assert.fail("< fuori da un tag: " + body.slice(m.index, m.index + 40));
    if (m[5] !== undefined) { if (!stack.length) assert.ok(!m[5].trim(), "testo fuori dalla radice"); continue; }
    if (m[1]) assert.strictEqual(stack.pop(), m[2], "tag chiuso nell'ordine giusto");
    else if (!m[4]) { if (!stack.length) root++; stack.push(m[2]); }
  }
  assert.strictEqual(stack.length, 0, "tutti i tag chiusi");
  assert.strictEqual(root, 1, "una sola radice");
}
function rssItems(x) {
  const out = [], re = /<item>\n<title>(.*?)<\/title>\n(?:<link>(.*?)<\/link>\n)?<description>(.*?)<\/description>\n<pubDate>(.*?)<\/pubDate>\n<guid isPermaLink="false">(.*?)<\/guid>\n<category>(.*?)<\/category>\n<\/item>/g;
  let m;
  while ((m = re.exec(x))) out.push({ title: unx(m[1]), link: m[2] == null ? "" : unx(m[2]), desc: unx(m[3]), pubDate: m[4], guid: unx(m[5]), cat: unx(m[6]) });
  assert.strictEqual(out.length, (x.match(/<item>/g) || []).length, "ogni <item> letto");
  return out;
}
const RFC822 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d\d (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d\d:\d\d:\d\d GMT$/;
const cps = (s) => Array.from(s).length;

test("feed: le quattro categorie, nell'ordine del contratto", () => {
  assert.deepStrictEqual(FEED.CATS, ["evento", "risultati", "prossime-partite", "tabellone"]);
});

test("feed: RSS 2.0 ben formato e uguale alle notizie", () => {
  const { data } = storico();
  const its = FEED.items(data, { base: BASE, now: NOW }), x = FEED.rss(data, { base: BASE, now: NOW, self: BASE + "/feed.rss?cat=risultati&ev=ev1" });
  wellFormed(x);
  assert.match(x, /<rss version="2\.0"/);
  for (const t of ["title", "link", "description", "language", "lastBuildDate", "ttl"]) assert.match(x, new RegExp("<channel>[\\s\\S]*<" + t + ">[^<]+</" + t + ">"), "canale: " + t);
  assert.match(x, /<ttl>1<\/ttl>/);
  assert.match(x, /<language>it<\/language>/);
  assert.match(x, /<atom:link href="http:\/\/127\.0\.0\.1:18810\/feed\.rss\?cat=risultati&amp;ev=ev1" rel="self" type="application\/rss\+xml"\/>/);
  const back = rssItems(x);
  assert.strictEqual(back.length, its.length);
  const byGuid = new Map(its.map((i) => [i.guid, i]));
  back.forEach((b) => {
    const i = byGuid.get(b.guid);
    assert.ok(i, "notizia del feed: " + b.guid);
    assert.strictEqual(b.title, i.title);
    assert.strictEqual(b.desc, i.desc);
    assert.strictEqual(b.cat, i.cat);
    /* niente <link> nelle notizie: MaiTv lo userebbe come id, e cambia con l'indirizzo del server */
    assert.strictEqual(b.link, "");
    assert.match(b.pubDate, RFC822);
    assert.strictEqual(Date.parse(b.pubDate), Math.floor(i.at / 1000) * 1000);
  });
  /* dalla più recente */
  for (let k = 1; k < back.length; k++) assert.ok(Date.parse(back[k - 1].pubDate) >= Date.parse(back[k].pubDate));
  assert.match(x, /<lastBuildDate>Sat, 10 Oct 2026 18:00:00 GMT<\/lastBuildDate>/);
});

test("feed: notizie, guid unici e link unici senza chiave", () => {
  const { data } = storico();
  const its = FEED.items(data, { base: BASE, now: NOW });
  const cats = new Set(its.map((i) => i.cat));
  FEED.CATS.forEach((c) => assert.ok(cats.has(c), "categoria " + c));
  assert.strictEqual(new Set(its.map((i) => i.guid)).size, its.length, "guid unici");
  assert.strictEqual(new Set(its.map((i) => i.link)).size, its.length, "link unici");
  its.forEach((i) => {
    assert.strictEqual(i.link, BASE + "/n/" + encodeURIComponent(i.guid));
    assert.ok(i.guid.startsWith("ev1:"), i.guid);
    assert.ok(!/k=|0123456789abcdef/.test(i.link));
    assert.ok(i.title && cps(i.title) <= 120 && cps(i.desc) <= 600);
    assert.ok(!/[<>]|\bundefined\b|\bnull\b|\bNaN\b|\{[a-z]\}/.test(i.title + " " + i.desc), i.title + " / " + i.desc);
    assert.strictEqual(typeof i.at, "number");
  });
  /* nel feed nessuna notizia ha <link>, con qualsiasi indirizzo: MaiTv usa il guid, lo stesso da 127.0.0.1 o da localhost */
  const items = (x) => x.split("<item>").slice(1);
  ["http://127.0.0.1:18812", "http://localhost:18812", "http://192.168.1.20:8810"].forEach((b) => {
    const x = FEED.rss(data, { base: b, now: NOW });
    assert.ok(items(x).length > 0 && items(x).every((i) => !/<link>/.test(i)), b);
  });
  assert.deepStrictEqual(rssItems(FEED.rss(data, { base: "http://localhost:1", now: NOW })).map((i) => i.guid), rssItems(FEED.rss(data, { base: BASE, now: NOW })).map((i) => i.guid));
  /* senza base: niente link (MaiTv usa il guid) */
  assert.ok(FEED.items(data, { now: NOW }).every((i) => i.link === ""));
  assert.ok(!/<link>[^<]*\/n\//.test(FEED.rss(data, { now: NOW })));
});

test("feed: risultati (punteggio, tavolino, pareggio, vince chi fa meno punti, manche, campione)", () => {
  const { data } = storico();
  const its = FEED.items(data, { base: BASE, now: NOW }), R = its.filter((i) => i.cat === "risultati");
  const one = (re) => { const a = R.filter((i) => re.test(i.title)); assert.strictEqual(a.length, 1, "una notizia per " + re + ": " + R.map((i) => i.title).join(" | ")); return a[0]; };
  const fin = one(/^Counter-Strike 2 · Finale: /);
  assert.strictEqual(fin.title, "Counter-Strike 2 · Finale: Lupi 3–2 Volpi");
  assert.ok(fin.desc.startsWith("Lupi batte Volpi 3–2. Per Volpi il torneo finisce qui."), fin.desc);
  assert.match(fin.desc, / Commento: .+/);
  assert.strictEqual(fin.at, at(110));
  const ff = one(/a tavolino/);
  assert.strictEqual(ff.title, "Counter-Strike 2 · Semifinale: Volpi vince a tavolino contro Tori");
  assert.ok(ff.desc.startsWith("Vittoria a tavolino per Volpi contro Tori: la partita non è stata giocata."), ff.desc);
  const dr = one(/Eva 1–1 Fil/);
  assert.strictEqual(dr.title, "Team Fortress 2 · Giornata 1: Eva 1–1 Fil (pareggio)");
  assert.ok(dr.desc.startsWith("Pareggio 1–1 tra Eva e Fil."), dr.desc);
  /* nei gironi vince chi ha più punti anche senza winner */
  assert.ok(one(/Gea 3–0 Ivo/).desc.startsWith("Gea batte Ivo 3–0."));
  const low = one(/Kai 68–72 Leo/);
  assert.strictEqual(low.title, "Rocket League · Turno 1: Kai 68–72 Leo · vince Kai");
  assert.ok(low.desc.startsWith("Kai batte Leo. Punteggio: Kai 68–72 Leo."), low.desc);
  /* il riposo non è una notizia */
  assert.ok(!R.some((i) => /Max/.test(i.title)));
  /* manche: vincitore, podio, chi passa; e il primo posto condiviso */
  const h1 = one(/Manche 1, girone A/);
  assert.strictEqual(h1.title, "Fortnite · Manche 1, girone A: vince Pia");
  assert.ok(h1.desc.startsWith("Podio della manche: 1º Pia (30), 2º Quo (22,5), 3º Ray (10). "), h1.desc);
  /* chi passa: una volta sola, anche se lo dice già il commento della cronaca */
  assert.strictEqual(h1.desc.split("Passano il turno: Pia e Quo.").length, 2, h1.desc);
  const h2 = one(/Manche 1, girone B/);
  assert.strictEqual(h2.title, "Fortnite · Manche 1, girone B: primo posto a pari merito: Sam e Tea");
  assert.ok(h2.desc.startsWith("Podio della manche: 1º Sam (25), 1º Tea (25), 3º Uma (5)."), h2.desc);
  /* campione, con podio e squadra */
  const ch = one(/campione/);
  assert.strictEqual(ch.title, "Il campione di Counter-Strike 2 è Lupi");
  assert.ok(ch.desc.startsWith("Lupi vince Counter-Strike 2. Podio: 1º Lupi, 2º Volpi, 3º Orsi, 3º Tori. In squadra: Marco e Luca."), ch.desc);
  assert.strictEqual(ch.guid.split(":").slice(0, 3).join(":"), "ev1:cs2:campione");
  assert.strictEqual(ch.at, at(120));
  /* guid delle partite: evento:gioco:partita:impronta */
  assert.match(fin.guid, /^ev1:cs2:e1-0:[0-9a-f]{8}$/);
});

test("feed: prossime partite (al massimo 6, per gioco e ordine) e classifiche (prime 8)", () => {
  const { data } = storico();
  const its = FEED.items(data, { base: BASE, now: NOW });
  const P = its.filter((i) => i.cat === "prossime-partite");
  assert.deepStrictEqual(P.map((i) => i.title), [
    "Team Fortress 2 · Giornata 2: Eva contro Gea",
    "Fortnite · Finale: in campo Pia, Quo, Sam e Tea",
    "Rocket League · Turno 2: Kai contro Leo",
    "Rocket League · Turno 2: Max contro Noa",
    "Rocket League · Turno 2: Oti contro Pat",
    "Rocket League · Turno 2: Rui contro Sol"
  ]);
  assert.strictEqual(P[0].desc, "Prossima partita di Team Fortress 2 (Giornata 2): Eva contro Gea. Torneo: Fragmarathon d'Autunno 2026.");
  assert.strictEqual(P[1].desc, "Prossima manche di Fortnite (Finale): in campo Pia, Quo, Sam e Tea. Torneo: Fragmarathon d'Autunno 2026.");
  P.forEach((i) => assert.strictEqual(i.at, Date.parse(data.generated)));
  const T = its.filter((i) => i.cat === "tabellone");
  assert.deepStrictEqual(T.map((i) => i.title), ["Counter-Strike 2: classifica finale", "Team Fortress 2: classifica provvisoria", "Fortnite: classifica provvisoria", "Rocket League: classifica provvisoria"]);
  const rl = T[3];
  assert.ok(rl.desc.startsWith("Stato: Turno 2 di 3. Partite giocate: 1 su 7. Classifica: 1º Kai, 2º Leo, 3º Max, 4º Noa, 5º Oti, 6º Pat, 7º Rui, 8º Sol. Formato: Sistema svizzero + playoff."), rl.desc);
  assert.ok(!/Tim|Ugo/.test(rl.desc), "solo le prime 8");
  assert.match(rl.guid, /^ev1:rl:tabellone:[0-9a-f]{8}$/);
  const E = its.filter((i) => i.cat === "evento");
  assert.strictEqual(E.length, 1);
  assert.strictEqual(E[0].title, "Fragmarathon d'Autunno 2026");
  assert.ok(E[0].desc.startsWith("La LAN dei record. "), E[0].desc);
  assert.match(E[0].desc, /Dove: Palazzetto di Ponzano\. Quando: 2026-10-10, 15:00\. In programma: Counter-Strike 2, Team Fortress 2, Fortnite e Rocket League\.$/);
  assert.ok(!/Via dello Sport/.test(E[0].desc), "l'indirizzo non va nel feed");
});

test("feed: un gioco in corso senza classifica ha comunque il punto sul torneo (stato e partite giocate)", () => {
  const f = facts(), g = fn();
  g.standings = [];
  f.games = [g];
  const its = FEED.items(storico(f).data, { base: BASE, now: NOW });
  const T = its.filter((i) => i.cat === "tabellone");
  assert.strictEqual(T.length, 1);
  assert.strictEqual(T[0].title, "Fortnite: il punto sul torneo");
  assert.ok(T[0].desc.startsWith("Stato: Torneo in corso. Partite giocate: 2 su 3. Formato: "), T[0].desc);
  assert.ok(!/Classifica:/.test(T[0].desc), T[0].desc);
  /* senza partite e senza classifica: niente */
  g.matches = [];
  assert.strictEqual(FEED.items(storico(f).data, { base: BASE, now: NOW }).filter((i) => i.cat === "tabellone").length, 0);
});

test("feed: guid stabili; una correzione del risultato è una notizia nuova", () => {
  const a = FEED.items(storico().data, { base: BASE, now: NOW });
  /* stesso torneo, file rigenerato più tardi: le notizie delle partite non cambiano */
  const b = FEED.items(storico(null, NOW + 3600000).data, { base: BASE, now: NOW });
  const ga = a.filter((i) => i.cat === "risultati").map((i) => i.guid), gb = b.filter((i) => i.cat === "risultati").map((i) => i.guid);
  assert.deepStrictEqual(gb, ga);
  assert.deepStrictEqual(FEED.items(storico().data, { base: BASE }).map((i) => i.guid), a.map((i) => i.guid));
  /* correzione: la finale 3–2 diventa 3–1 */
  const f = facts();
  f.games[0].matches[2].score = [3, 1];
  const c = FEED.items(storico(f).data, { base: BASE, now: NOW });
  const old = a.find((i) => i.title.startsWith("Counter-Strike 2 · Finale")), neu = c.find((i) => i.title.startsWith("Counter-Strike 2 · Finale"));
  assert.notStrictEqual(neu.guid, old.guid);
  assert.strictEqual(neu.guid.split(":").slice(0, 3).join(":"), old.guid.split(":").slice(0, 3).join(":"));
  assert.strictEqual(neu.title, "Counter-Strike 2 · Finale: Lupi 3–1 Volpi");
  /* le altre partite tengono il loro guid */
  const others = (L) => L.filter((i) => i.cat === "risultati" && !i.title.startsWith("Counter-Strike 2 · Finale") && !/campione/.test(i.title)).map((i) => i.guid);
  assert.deepStrictEqual(others(c), others(a));
  /* anche il vincitore cambiato e il pareggio cambiano l'impronta */
  const g = facts();
  g.games[1].matches[0] = Object.assign(g.games[1].matches[0], { score: [2, 1], draw: false });
  const d = FEED.items(storico(g).data, { now: NOW });
  assert.ok(!d.some((i) => i.guid === a.find((x) => /Eva 1–1 Fil/.test(x.title)).guid));
  /* il campione ha la sua impronta: un altro campione è un'altra notizia */
  const h = facts();
  h.games[0].champion = "Volpi";
  const ch = (L) => L.find((i) => /campione/.test(i.guid)).guid;
  assert.notStrictEqual(ch(FEED.items(storico(h).data, { now: NOW })), ch(a));
});

test("feed: filtro per categoria", () => {
  const { data } = storico();
  FEED.CATS.forEach((c) => {
    const x = FEED.rss(data, { cat: c, base: BASE, now: NOW });
    wellFormed(x);
    const L = rssItems(x);
    assert.ok(L.length > 0, c);
    assert.ok(L.every((i) => i.cat === c), c);
  });
  assert.match(FEED.rss(data, { cat: "risultati", now: NOW }), /<title>Fragmarathon d&apos;Autunno 2026: Risultati<\/title>/);
  /* categoria sconosciuta: tutte le notizie */
  assert.strictEqual(rssItems(FEED.rss(data, { cat: "boh", now: NOW })).length, FEED.items(data, { now: NOW }).length);
  /* al massimo max notizie, le più recenti */
  assert.strictEqual(rssItems(FEED.rss(data, { max: 3, now: NOW })).length, 3);
});

test("feed: dati vuoti, nulli o di un altro schema: canale valido senza notizie", () => {
  for (const d of [null, undefined, {}, [], "x", 42, { schema: "altro" }, { schema: "tornei-fragmarathon/storico@1" }]) {
    const x = FEED.rss(d, { now: NOW });
    wellFormed(x);
    assert.strictEqual((x.match(/<item>/g) || []).length, 0, JSON.stringify(d));
    assert.match(x, /<lastBuildDate>Sat, 10 Oct 2026 18:00:00 GMT<\/lastBuildDate>/);
    assert.deepStrictEqual(FEED.items(d, { now: NOW }), []);
  }
  /* storico di un torneo senza giochi: solo l'evento */
  const e = storico({ lang: "it", event: { id: "x1", title: "Vuoto" }, games: [] }).data;
  assert.deepStrictEqual(FEED.items(e, { now: NOW }).map((i) => i.cat), ["evento"]);
  /* campi rovinati: niente eccezioni */
  const bad = { schema: "tornei-fragmarathon/storico@1", generated: "boh", event: { title: { x: 1 } }, games: [null, 3, { matches: [null, { state: "done", sides: "x" }, { state: "done", sides: ["A", "B"], score: ["a", 2] }], standings: [{ pos: "x", name: "A" }] }] };
  assert.doesNotThrow(() => FEED.rss(bad, { now: NOW }));
  wellFormed(FEED.rss(bad, { now: NOW }));
});

test("feed: escape XML, caratteri di controllo e tagli puliti a 120 e 600", () => {
  const f = facts();
  const nasty = "Ra<b>&\"Co'\u0001\u0007z\u{1F600}";
  f.games[1].matches[1].sides = [nasty, "Ivo"];
  f.games[1].participants[2].name = nasty;
  f.games[1].standings[0].name = nasty;
  f.games[0].name = "Torneo dal nome lunghissimo ".repeat(8).trim();
  const { data } = storico(f);
  data.games[0].matches[2].comment = "Parola ".repeat(200).trim();
  const its = FEED.items(data, { base: BASE, now: NOW });
  const x = FEED.rss(data, { base: BASE, now: NOW });
  wellFormed(x);
  assert.ok(x.includes("Ra&lt;b&gt;&amp;&quot;Co&apos;z\u{1F600}"), "escape dei cinque caratteri");
  const back = rssItems(x);
  const n = back.find((i) => i.title.includes("Ra<b>"));
  assert.ok(n && n.title.includes("Ra<b>&\"Co'z\u{1F600} 3–0 Ivo"), n && n.title);
  /* titolo lungo: tagliato a una parola, con … */
  const long = its.filter((i) => i.title.startsWith("Torneo dal nome"));
  assert.ok(long.length > 0);
  long.forEach((i) => {
    assert.ok(cps(i.title) <= 120, cps(i.title));
    assert.ok(i.title.endsWith("…"), i.title);
    assert.ok(/[a-z]…$/.test(i.title), "taglio sul confine di una parola: " + i.title);
  });
  const fin = its.find((i) => /Lupi 3–2 Volpi/.test(i.title) || /e1-0/.test(i.guid));
  assert.ok(cps(fin.desc) <= 600 && cps(fin.desc) > 550, cps(fin.desc));
  assert.ok(/Parola…$/.test(fin.desc), fin.desc.slice(-20));
  /* le emoji non si spezzano: il taglio conta i punti di codice */
  assert.strictEqual(FEED.cut("\u{1F600}".repeat(130), 120), "\u{1F600}".repeat(119) + "…");
  assert.strictEqual(FEED.cut("breve", 120), "breve");
  assert.strictEqual(FEED.rfc822(Date.UTC(2026, 0, 5, 7, 8, 9)), "Mon, 05 Jan 2026 07:08:09 GMT");
});

test("feed: opt.tr traduce i modelli interi, mai i nomi", () => {
  const { data } = storico();
  const seen = new Set();
  const tr = (s) => { seen.add(s); return s === "{w} batte {l} {s}." ? "{w} beats {l} {s}." : s === "{a} contro {b}" ? "{a} vs {b}" : s === "Prossima partita di {g} ({f}): {a} contro {b}." ? "Next match in {g} ({f}): {a} vs {b}." : s; };
  const its = FEED.items(data, { tr, now: NOW });
  assert.ok(its.some((i) => i.desc.startsWith("Lupi beats Volpi 3–2.")));
  assert.ok(its.some((i) => i.title === "Team Fortress 2 · Giornata 2: Eva vs Gea"));
  assert.ok(its.some((i) => i.desc === "Next match in Team Fortress 2 (Giornata 2): Eva vs Gea. Torneo: Fragmarathon d'Autunno 2026."));
  /* nomi mai tradotti, né passati al traduttore */
  ["Lupi", "Volpi", "Eva", "Counter-Strike 2"].forEach((n) => assert.ok(!seen.has(n)));
  /* un traduttore rotto non ferma niente */
  assert.ok(FEED.items(data, { tr: () => { throw new Error("x"); }, now: NOW }).length > 0);
  assert.ok(FEED.items(data, { tr: () => "", now: NOW }).some((i) => i.title === "Il campione di Counter-Strike 2 è Lupi"));
  /* «ed» davanti a un nome che comincia per e, solo nel modello italiano */
  const f = facts();
  f.games[1].matches[0].sides = ["Ada", "Elio"];
  assert.ok(FEED.items(storico(f).data, { now: NOW }).some((i) => i.desc.startsWith("Pareggio 1–1 tra Ada ed Elio.")));
});

test("feed: l'estrattore delle traduzioni prende le frasi intere di js/feed.js e feedserver.js", () => {
  const tmp = fs.mkdtempSync(path.join(process.env.FEED_TEST_TMP || os.tmpdir(), "tornei-feed-strings-"));
  const out = path.join(tmp, "strings.json"), root = path.join(__dirname, "..");
  try {
    const p = spawnSync(process.execPath, [path.join(root, "tools", "i18n-extract.mjs"), out], { cwd: root, encoding: "utf8" });
    assert.strictEqual(p.status, 0, p.stderr);
    const ui = new Set(JSON.parse(fs.readFileSync(out, "utf8")).ui), seen = new Set();
    const tr = (s) => { seen.add(s); return s; };
    const { data } = storico();
    FEED.items(data, { tr, now: NOW });
    FEED.CATS.forEach((cat) => FEED.rss(data, { tr, cat, now: NOW }));
    FEED.rss(data, { tr, now: NOW });
    const f = facts();
    f.games[0].matches[0].stage = "";
    f.games[2].matches[0].heat = f.games[2].matches[0].heat.map((h) => ({ name: h.name, score: h.score, pos: null }));
    f.games[2].matches[0].winner = null;
    FEED.items(storico(f).data, { tr, now: NOW });
    assert.ok(seen.size > 30, "frasi: " + seen.size);
    seen.forEach((s) => assert.ok(ui.has(s), "non estratta: " + s));
    Object.values(createFeedServer.TXT).forEach((s) => assert.ok(ui.has(s), "non estratta: " + s));
    /* niente pezzi di codice */
    ["Sun", "Jan", "Dec", "GMT", "application/rss+xml", "prossime-partite"].forEach((s) => assert.ok(!ui.has(s), "estratto per sbaglio: " + s));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ---------------- Il server ---------------- */
const tmps = [], servers = [];
test.after(async () => {
  for (const s of servers) await s.stop();
  tmps.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
});
function folder() {
  const d = fs.mkdtempSync(path.join(process.env.FEED_TEST_TMP || os.tmpdir(), "tornei-feed-"));
  tmps.push(d);
  const st = path.join(d, "storici");
  fs.mkdirSync(st);
  /* due tornei archiviati e un file rovinato; fuori dalla cartella un file da non servire mai */
  const a = storico(), f2 = facts();
  f2.event = { id: "ev2", title: "Vecchio torneo", date: "2025-05-01" };
  f2.games = [cs2()];
  const b = storico(f2, NOW - 86400000);
  fs.writeFileSync(path.join(st, "fragmarathon-d-autunno-2026_ev1abc.storico.md"), a.md);
  fs.writeFileSync(path.join(st, "vecchio-torneo_ev2abc.storico.md"), b.md);
  fs.writeFileSync(path.join(st, "rotto_zzzz.storico.md"), "# niente json\n");
  fs.writeFileSync(path.join(d, "segreto.storico.md"), b.md.replace("Vecchio torneo", "SEGRETO"));
  fs.writeFileSync(path.join(d, "segreto.md"), "SEGRETO");
  const t = (s) => new Date(s);
  fs.utimesSync(path.join(st, "vecchio-torneo_ev2abc.storico.md"), t(NOW - 86400000), t(NOW - 86400000));
  fs.utimesSync(path.join(st, "fragmarathon-d-autunno-2026_ev1abc.storico.md"), t(NOW), t(NOW));
  fs.utimesSync(path.join(st, "rotto_zzzz.storico.md"), t(NOW + 1000), t(NOW + 1000));
  return { dir: d, storici: st, a, b };
}
function get(port, p, o) {
  o = o || {};
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, path: p, method: o.method || "GET", headers: o.headers || {}, agent: false }, (res) => {
      const ch = [];
      res.on("data", (c) => ch.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(ch).toString("utf8") }));
    });
    r.on("error", reject);
    r.end();
  });
}
async function server(o) {
  const F = folder();
  let cur = null;
  const s = createFeedServer({ dir: () => F.storici, current: () => cur, tr: (o && o.tr) || ((t) => t), log: () => {} });
  servers.push(s);
  const r = await s.start({ port: 0, lan: false, key: KEY });
  assert.ok(r.ok, r.err);
  return { s, r, port: r.port, F, setCur: (c) => { cur = c; } };
}
const K = "k=" + KEY;

test("server: avvio su 127.0.0.1, stato, chiave obbligatoria", async () => {
  const { s, r, port } = await server();
  assert.ok(port > 0);
  assert.deepStrictEqual(r.urls, ["http://127.0.0.1:" + port]);
  const st = s.status();
  assert.strictEqual(st.on, true);
  assert.strictEqual(st.port, port);
  assert.strictEqual(st.lan, false);
  for (const p of ["/", "/feed.rss", "/storico.md", "/storico.json", "/eventi.json", "/storico/ev1abc.md", "/nope"]) {
    assert.strictEqual((await get(port, p)).status, 403, p + " senza chiave");
    assert.strictEqual((await get(port, p + "?k=sbagliata")).status, 403, p + " chiave sbagliata");
    assert.strictEqual((await get(port, p + "?k=" + KEY.slice(0, -1))).status, 403, p + " chiave quasi giusta");
  }
  const ok = await get(port, "/feed.rss?" + K);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.headers["content-type"], "application/rss+xml; charset=utf-8");
  assert.strictEqual(ok.headers["cache-control"], "no-cache");
  assert.strictEqual(ok.headers["access-control-allow-origin"], "*");
  assert.strictEqual(ok.headers["x-content-type-options"], "nosniff");
  assert.ok(ok.headers.etag);
  wellFormed(ok.body);
  assert.ok(!ok.body.includes(KEY), "la chiave non finisce nel feed");
  assert.ok(s.status().hits >= 1 && s.status().last > 0);
  /* /n/…: senza chiave, solo un testo breve */
  const n = await get(port, "/n/" + encodeURIComponent("ev1:cs2:e1-0:abcd1234"));
  assert.strictEqual(n.status, 200);
  assert.strictEqual(n.headers["content-type"], "text/plain; charset=utf-8");
  assert.ok(n.body.length < 200 && !/Lupi|ev1/.test(n.body));
});

test("server: 404, 405, 414, 400, HEAD senza corpo, ETag e 304", async () => {
  const { port } = await server();
  assert.strictEqual((await get(port, "/nope?" + K)).status, 404);
  assert.strictEqual((await get(port, "/feed.rss?cat=boh&" + K)).status, 400);
  assert.strictEqual((await get(port, "/feed.rss?ev=nessuno&" + K)).status, 404);
  for (const m of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
    const r = await get(port, "/feed.rss?" + K, { method: m });
    assert.strictEqual(r.status, 405, m);
    assert.strictEqual(r.headers.allow, "GET, HEAD");
  }
  assert.strictEqual((await get(port, "/feed.rss?" + K + "&x=" + "a".repeat(2100))).status, 414);
  assert.strictEqual((await get(port, "/n/" + "a".repeat(2100))).status, 414);
  const g = await get(port, "/storico.json?" + K), h = await get(port, "/storico.json?" + K, { method: "HEAD" });
  assert.strictEqual(h.status, 200);
  assert.strictEqual(h.body, "");
  assert.strictEqual(h.headers["content-length"], String(Buffer.byteLength(g.body)));
  assert.strictEqual(h.headers.etag, g.headers.etag);
  for (const p of ["/feed.rss?" + K, "/feed.rss?cat=risultati&" + K, "/storico.md?" + K, "/eventi.json?" + K, "/?" + K]) {
    const a = await get(port, p);
    assert.strictEqual(a.status, 200, p);
    const b = await get(port, p, { headers: { "If-None-Match": a.headers.etag } });
    assert.strictEqual(b.status, 304, p);
    assert.strictEqual(b.body, "");
    assert.strictEqual(b.headers.etag, a.headers.etag);
    assert.strictEqual((await get(port, p, { headers: { "If-None-Match": '"altro", W/' + a.headers.etag } })).status, 304, "elenco e W/");
    assert.strictEqual((await get(port, p, { headers: { "If-None-Match": '"altro"' } })).status, 200);
  }
});

test("feed: il nome del torneo è nel testo di risultati, campione, prossime partite e classifiche (MaiTv lo legge solo da lì)", () => {
  const its = FEED.items(storico().data, { now: NOW });
  const tour = "Torneo: Fragmarathon d'Autunno 2026.";
  its.filter((i) => i.cat !== "evento").forEach((i) => assert.ok(i.desc.indexOf(tour) >= 0, i.title + " / " + i.desc));
  /* prima del commento: un commento lunghissimo si taglia, il nome del torneo resta */
  const f = facts();
  f.games[0].matches[2].comment = "parola ".repeat(200);
  const fin = FEED.items(storico(f).data, { now: NOW }).find((i) => i.title.startsWith("Counter-Strike 2 · Finale"));
  assert.ok(fin.desc.indexOf(tour) >= 0 && fin.desc.indexOf(tour) < fin.desc.indexOf("Commento:"), fin.desc);
  assert.ok(cps(fin.desc) <= 600);
  /* frase intera, tradotta come le altre */
  const x = FEED.items(storico().data, { now: NOW, tr: (s) => (s === "Torneo: {t}." ? "Tournament: {t}." : s) });
  assert.ok(x.some((i) => /Tournament: Fragmarathon d'Autunno 2026\.$/.test(i.desc)));
});

test("feed: la presentazione dell'evento tiene il guid quando parte un altro gioco o cambia l'introduzione", () => {
  const ev = (d) => FEED.items(d, { now: NOW }).filter((i) => i.cat === "evento");
  const a = storico().data, e0 = ev(a);
  assert.strictEqual(e0.length, 1);
  const b = JSON.parse(JSON.stringify(a));
  b.games = b.games.slice(0, 2);
  b.event.intro = "Davanti a noi 2 tornei.";
  const e1 = ev(b);
  assert.strictEqual(e1[0].guid, e0[0].guid);
  assert.notStrictEqual(e1[0].desc, e0[0].desc, "il testo si aggiorna");
  /* cambia luogo o data: è un'altra presentazione */
  const c = JSON.parse(JSON.stringify(a));
  c.event.place = "Altrove";
  assert.notStrictEqual(ev(c)[0].guid, e0[0].guid);
});

test("feed: prossime partite divise fra i giochi (un girone lungo non nasconde gli altri)", () => {
  const d = storico().data;
  const ready = (key, name, n) => ({
    key, name, game: name, done: false, status: "In corso", standings: [], participants: [],
    matches: Array.from({ length: n }, (_, i) => ({ id: key + i, order: i + 1, stage: "Turno 1", kind: "round", state: "ready", sides: [key + "A" + i, key + "B" + i] }))
  });
  d.games = [ready("qk", "Quake", 8), ready("tf", "TF2", 3)];
  const P = FEED.items(d, { now: NOW }).filter((i) => i.cat === "prossime-partite");
  assert.strictEqual(P.length, 6);
  assert.deepStrictEqual(P.map((i) => i.title.split(" · ")[0]), ["Quake", "Quake", "Quake", "TF2", "TF2", "TF2"]);
  assert.deepStrictEqual(P.slice(0, 3).map((i) => i.title), ["Quake · Turno 1: qkA0 contro qkB0", "Quake · Turno 1: qkA1 contro qkB1", "Quake · Turno 1: qkA2 contro qkB2"]);
  /* un gioco solo: le prime 6 in ordine */
  d.games = [ready("qk", "Quake", 8)];
  assert.deepStrictEqual(FEED.items(d, { now: NOW }).filter((i) => i.cat === "prossime-partite").map((i) => i.title.split(": ")[1]), [0, 1, 2, 3, 4, 5].map((i) => "qkA" + i + " contro qkB" + i));
  /* tre giochi con 1, 5 e 5: il primo prende 1, gli altri il resto a turno */
  d.games = [ready("a", "A", 1), ready("b", "B", 5), ready("c", "C", 5)];
  assert.deepStrictEqual(FEED.items(d, { now: NOW }).filter((i) => i.cat === "prossime-partite").map((i) => i.title.split(" · ")[0]), ["A", "B", "B", "B", "C", "C"]);
});

test("server: torneo aperto con ripiego sul file più recente, storici per id, eventi.json", async () => {
  const { port, F, setCur } = await server();
  /* senza torneo aperto: il file valido più recente (quello rovinato non conta) */
  let md = await get(port, "/storico.md?" + K);
  assert.strictEqual(md.status, 200);
  assert.strictEqual(md.headers["content-type"], "text/markdown; charset=utf-8");
  assert.strictEqual(md.body, F.a.md);
  const js = await get(port, "/storico.json?" + K);
  assert.strictEqual(js.headers["content-type"], "application/json; charset=utf-8");
  assert.deepStrictEqual(JSON.parse(js.body), F.a.data);
  /* torneo aperto: vale lui, anche se il suo file è più vecchio */
  setCur({ id: "ev2abc", md: F.b.md });
  md = await get(port, "/storico.md?" + K);
  assert.strictEqual(md.body, F.b.md);
  assert.match((await get(port, "/feed.rss?" + K)).body, /<title>Vecchio torneo: notizie<\/title>/);
  /* torneo aperto rovinato: di nuovo il file */
  setCur({ id: "x", md: "niente" });
  assert.strictEqual((await get(port, "/storico.md?" + K)).body, F.a.md);
  setCur(null);
  /* per id */
  assert.strictEqual((await get(port, "/storico/ev2abc.md?" + K)).body, F.b.md);
  assert.deepStrictEqual(JSON.parse((await get(port, "/storico/ev2abc.json?" + K)).body), F.b.data);
  assert.deepStrictEqual(JSON.parse((await get(port, "/storico/ev1.json?" + K)).body), F.a.data, "anche con l'id dell'evento");
  assert.strictEqual((await get(port, "/storico/zzzz.md?" + K)).status, 404, "file rovinato");
  const rs = await get(port, "/feed.rss?ev=ev2abc&cat=risultati&" + K);
  assert.match(rs.body, /<title>Vecchio torneo: Risultati<\/title>/);
  assert.ok(rssItems(rs.body).length > 0 && rssItems(rs.body).every((i) => i.cat === "risultati" && i.link === ""));
  /* elenco */
  const ev = await get(port, "/eventi.json?" + K);
  assert.strictEqual(ev.headers["content-type"], "application/json; charset=utf-8");
  const L = JSON.parse(ev.body);
  assert.deepStrictEqual(L.map((e) => e.id), ["ev1abc", "ev2abc"]);
  assert.strictEqual(L[0].title, "Fragmarathon d'Autunno 2026");
  assert.strictEqual(L[1].date, "2025-05-01");
  assert.strictEqual(L[0].updated, F.a.data.generated);
  for (const e of L) for (const k of ["md", "json", "rss"]) {
    const u = new URL(e[k]);
    const r = await get(port, u.pathname + u.search);
    assert.strictEqual(r.status, 200, e[k]);
  }
  assert.ok(!L.some((e) => /SEGRETO|zzzz/.test(JSON.stringify(e))));
  /* pagina con i link */
  const pg = await get(port, "/?" + K);
  assert.strictEqual(pg.headers["content-type"], "text/html; charset=utf-8");
  assert.match(pg.body, /<title>Feed per MaiTv e altre app<\/title>/);
  assert.match(pg.body, /feed\.rss\?cat=prossime-partite&amp;k=/);
  assert.ok(!/Lupi|Marco/.test(pg.body), "niente dati del torneo oltre al titolo");
});

test("server: path traversal, anche codificato, non esce mai dalla cartella", async () => {
  const { port } = await server();
  const bad = ["/storico/..%2Fsegreto.md", "/storico/%2e%2e%2fsegreto.md", "/storico/..%5Csegreto.md", "/storico/..%255Csegreto.md", "/storico/../segreto.md",
    "/storico/%2e%2e/segreto.md", "/storico/segreto.md/..", "/storico/..%00.md", "/storico/C:%5Cwindows%5Cwin.md", "/storico/%E0%A4%A.md", "/storico/.md", "/storico//ev1abc.md",
    "/storico/ev1abc.md%00", "/../segreto.md", "/storico/ev1abc.storico.md", "/storico/segreto.md"];
  for (const p of bad) {
    const r = await get(port, p + (p.includes("?") ? "&" : "?") + K);
    assert.ok(r.status === 404 || r.status === 400, p + " -> " + r.status);
    assert.ok(!/SEGRETO/.test(r.body), p);
  }
});

test("server: traduzioni della lingua del torneo", async () => {
  const { port, F, setCur } = await server({ tr: (s, lang) => (lang === "en" && s === "{w} batte {l} {s}." ? "{w} beats {l} {s}." : lang === "en" && s === "RSS dei risultati" ? "Results (RSS)" : s) });
  const en = F.a.md.replace(/"lang": "it"/, '"lang": "en"');
  setCur({ id: "ev1abc", md: en });
  assert.match((await get(port, "/feed.rss?" + K)).body, /Lupi beats Volpi 3–2\./);
  assert.match((await get(port, "/feed.rss?" + K)).body, /<language>en<\/language>/);
  assert.match((await get(port, "/?" + K)).body, /Results \(RSS\)/);
});

test("server: porta occupata, chiave mancante, porta non valida, stop che libera la porta", async () => {
  const { s, port } = await server();
  const s2 = createFeedServer({ dir: () => "", current: () => null });
  servers.push(s2);
  const busy = await s2.start({ port, lan: false, key: KEY });
  assert.strictEqual(busy.ok, false);
  assert.strictEqual(busy.code, "EADDRINUSE");
  assert.match(busy.err, /occupata/);
  assert.strictEqual(s2.status().on, false);
  assert.strictEqual(s2.status().err, busy.err);
  assert.strictEqual((await s2.start({ port: 0, key: "" })).ok, false);
  assert.strictEqual((await s2.start({ port: 70000, key: KEY })).ok, false);
  assert.strictEqual((await s2.start({ port: "8810", key: KEY })).ok, false);
  /* stop: la porta torna libera subito, anche con una connessione keep-alive aperta */
  const sock = net.connect(port, "127.0.0.1");
  await new Promise((r) => sock.once("connect", r));
  sock.on("error", () => {});
  await s.stop();
  assert.strictEqual(s.status().on, false);
  await assert.rejects(get(port, "/?" + K));
  const again = await s2.start({ port, lan: false, key: KEY });
  assert.ok(again.ok, again.err);
  assert.strictEqual(again.port, port);
  /* cartella che non c'è: niente storici, feed vuoto ma valido */
  const r = await get(port, "/feed.rss?" + K);
  assert.strictEqual(r.status, 200);
  wellFormed(r.body);
  assert.strictEqual((await get(port, "/storico.md?" + K)).status, 404);
  assert.deepStrictEqual(JSON.parse((await get(port, "/eventi.json?" + K)).body), []);
  /* un nuovo start riparte con la configurazione nuova (chiave cambiata) */
  const re = await s2.start({ port: 0, lan: false, key: "fedcba9876543210fedcba98" });
  assert.ok(re.ok);
  assert.strictEqual((await get(re.port, "/?" + K)).status, 403);
  assert.strictEqual((await get(re.port, "/?k=fedcba9876543210fedcba98")).status, 200);
  await s2.stop();
  await s2.stop();
  assert.strictEqual(s2.status().on, false);
});

test("server: eventi.json e gli id che non ci sono non rileggono i file (anche oltre 100 storici)", async () => {
  const { port, F } = await server();
  for (let i = 0; i < 105; i++) fs.writeFileSync(path.join(F.storici, "torneo-" + i + "_x" + String(i).padStart(4, "0") + ".storico.md"), F.b.md);
  const rd = fs.readFileSync;
  let n = 0;
  fs.readFileSync = function (f) { if (/\.storico\.md$/.test(String(f))) n++; return rd.apply(fs, arguments); };
  try {
    const L1 = JSON.parse((await get(port, "/eventi.json?" + K)).body);
    assert.strictEqual(L1.length, 107);
    assert.ok(n >= 105, "la prima volta li legge: " + n);
    n = 0;
    const L2 = JSON.parse((await get(port, "/eventi.json?" + K)).body);
    assert.deepStrictEqual(L2, L1);
    assert.strictEqual(n, 0, "la seconda volta solo dall'indice");
    assert.strictEqual((await get(port, "/storico/nessuno.md?" + K)).status, 404);
    assert.strictEqual((await get(port, "/feed.rss?ev=nessuno&" + K)).status, 404);
    assert.strictEqual(n, 0, "un id che non c'è non rilegge la cartella");
    /* un file cambiato si rilegge, lui solo */
    const f0 = path.join(F.storici, "torneo-0_x0000.storico.md");
    fs.writeFileSync(f0, F.b.md.replace(/Vecchio torneo/g, "Torneo cambiato"));
    fs.utimesSync(f0, new Date(NOW + 5000), new Date(NOW + 5000));
    const L3 = JSON.parse((await get(port, "/eventi.json?" + K)).body);
    assert.strictEqual(n, 1);
    assert.strictEqual(L3.find((e) => e.id === "x0000").title, "Torneo cambiato");
    /* un file tolto esce dall'elenco */
    fs.unlinkSync(f0);
    assert.ok(!JSON.parse((await get(port, "/eventi.json?" + K)).body).some((e) => e.id === "x0000"));
  } finally { fs.readFileSync = rd; }
});

test("server: connessioni a vuoto non bloccano il feed (limite per indirizzo, tempi che valgono davvero)", async () => {
  const { port } = await server();
  const open = (host) => new Promise((resolve) => {
    const c = net.connect({ host, port }, () => resolve(c));
    c.on("error", () => resolve(c));
  });
  const closed = (c) => new Promise((resolve) => { if (c.destroyed) return resolve(); c.on("close", () => resolve()); });
  /* da questo PC al massimo 32: la 33ª viene chiusa subito, le altre restano */
  const idle = [];
  for (let i = 0; i < 32; i++) idle.push(await open("127.0.0.1"));
  const extra = await open("127.0.0.1");
  const t0 = Date.now();
  await closed(extra);
  assert.ok(Date.now() - t0 < 2000, "chiusa subito");
  idle.forEach((c) => c.destroy());
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual((await get(port, "/feed.rss?" + K)).status, 200);
  /* un client che manda un'intestazione ogni secondo e non finisce mai: chiuso in circa 5 s, non 30 */
  const slow = await open("127.0.0.1");
  slow.write("GET /feed.rss?" + K + " HTTP/1.1\r\nHost: x\r\n");
  const tick = setInterval(() => { try { slow.write("X-A: b\r\n"); } catch {} }, 1000);
  const t1 = Date.now();
  await closed(slow);
  clearInterval(tick);
  const dt = Date.now() - t1;
  assert.ok(dt < 8000, "chiusa dopo " + dt + " ms");
});

test("server: rete locale, al massimo 8 connessioni per indirizzo della LAN", async (t) => {
  const F = folder();
  const s = createFeedServer({ dir: () => F.storici, current: () => null });
  servers.push(s);
  const r = await s.start({ port: 0, lan: true, key: KEY });
  assert.ok(r.ok, r.err);
  const ip = (r.urls[0] || "").replace(/^http:\/\/|:\d+$/g, "");
  if (!ip || ip === "127.0.0.1") { await s.stop(); t.skip("nessuna scheda di rete"); return; }
  const open = (host) => new Promise((resolve) => { const c = net.connect({ host, port: r.port }, () => resolve(c)); c.on("error", () => resolve(c)); });
  const idle = [];
  for (let i = 0; i < 8; i++) idle.push(await open(ip));
  const extra = await open(ip);
  await new Promise((resolve) => { if (extra.destroyed) return resolve(); extra.on("close", resolve); });
  assert.ok(idle.every((c) => !c.destroyed), "le prime 8 restano");
  /* gli altri (qui: da 127.0.0.1) leggono il feed lo stesso */
  assert.strictEqual((await get(r.port, "/feed.rss?" + K)).status, 200);
  idle.forEach((c) => c.destroy());
  await s.stop();
});

test("server: rete locale, indirizzi IPv4 delle schede", async () => {
  const F = folder();
  const s = createFeedServer({ dir: () => F.storici, current: () => null });
  servers.push(s);
  const r = await s.start({ port: 0, lan: true, key: KEY });
  assert.ok(r.ok, r.err);
  assert.ok(r.urls.length >= 1);
  r.urls.forEach((u) => assert.match(u, new RegExp("^http://\\d+\\.\\d+\\.\\d+\\.\\d+:" + r.port + "$")));
  assert.strictEqual((await get(r.port, "/feed.rss?" + K)).status, 200, "anche da 127.0.0.1");
  await s.stop();
  /* ordine dei link: prima la rete di casa, poi le altre, in fondo le schede virtuali (WSL, Hyper-V); mai 169.254 */
  const ni = os.networkInterfaces;
  os.networkInterfaces = () => ({
    "vEthernet (WSL (Hyper-V firewall))": [{ address: "172.29.160.1", family: "IPv4", internal: false }],
    "vEthernet (Default Switch)": [{ address: "192.168.160.1", family: "IPv4", internal: false }],
    "Wi-Fi": [{ address: "169.254.3.4", family: "IPv4", internal: false }, { address: "fe80::1", family: "IPv6", internal: false }],
    "Ethernet 2": [{ address: "192.168.1.13", family: "IPv4", internal: false }],
    "Loopback Pseudo-Interface 1": [{ address: "127.0.0.1", family: "IPv4", internal: true }]
  });
  try {
    const r2 = await s.start({ port: 0, lan: true, key: KEY });
    assert.deepStrictEqual(r2.urls.map((u) => u.replace(/:\d+$/, "")), ["http://192.168.1.13", "http://172.29.160.1", "http://192.168.160.1"]);
  } finally { os.networkInterfaces = ni; await s.stop(); }
});
