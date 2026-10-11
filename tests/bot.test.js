// Bot Telegram (bot.js) con un Telegram finto: collegamenti confermati, iscrizioni, /discord, CSV della Hall of Fame, file rovinati. Niente rete.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const createBot = require("../bot.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/* Telegram finto: getUpdates restituisce i messaggi messi in coda dal test, gli invii si registrano */
function fakeTelegram() {
  const st = { sent: [], docs: [], updates: [] };
  async function fetch(url, init) {
    const m = url.split("/").pop(), J = (j) => ({ status: 200, json: async () => j });
    if (m === "getMe") return J({ ok: true, result: { username: "tbot" } });
    if (m === "getUpdates") {
      for (let i = 0; i < 20 && !st.updates.length; i++) { if (init.signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" }); await sleep(10); }
      return J({ ok: true, result: st.updates.splice(0) });
    }
    if (m === "sendMessage") { const b = JSON.parse(init.body); st.sent.push({ chat: String(b.chat_id), text: b.text, kb: b.reply_markup }); return J({ ok: true, result: {} }); }
    if (m === "sendDocument") { const f = init.body.get("document"); st.docs.push({ chat: String(init.body.get("chat_id")), name: f.name, text: await f.text() }); return J({ ok: true, result: {} }); }
    return J({ ok: true, result: true });
  }
  return { st, fetch };
}
/* cfg: oggetto (salvato come JSON), testo (salvato così com'è) o niente (nessun file) */
function setup(cfg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tornei-bot-")), file = path.join(dir, "telegram.json");
  if (cfg !== undefined) fs.writeFileSync(file, typeof cfg === "string" ? cfg : JSON.stringify(cfg));
  const T = fakeTelegram(), ev = { joins: [], disc: [] };
  const b = createBot({ file, fetch: T.fetch, onJoin: (r) => ev.joins.push(r), onDiscord: (r) => ev.disc.push(r), onPng: () => {}, onChange: () => {} });
  return { dir, file, b, st: T.st, ev, end: () => { b.dispose(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
let uid = 1;
/* scrive al bot e aspetta la risposta (l'ultima arrivata a quella chat) */
async function say(h, chat, text) {
  const n = h.st.sent.length;
  h.st.updates.push({ update_id: uid++, message: { chat: { id: chat, type: "private" }, from: { id: chat, first_name: "U" + chat }, text } });
  for (let i = 0; i < 300 && !h.st.sent.slice(n).some((x) => x.chat === String(chat)); i++) await sleep(10);
  const s = h.st.sent.filter((x) => x.chat === String(chat));
  return s.length ? s[s.length - 1].text : "";
}
const person = (h, id) => h.b.status().people.find((p) => p.id === String(id)) || {};
const VM = (o) => Object.assign({ title: "LAN", sub: "", roster: ["Max", "Maxwell", "Bob", "neo"], lang: "it", hof: { players: [], teams: [] },
  tournaments: [{ k: "ev1:quake", ev: "ev1", l: "QUAKE LIVE", name: "", mode: "FFA", team: false, players: ["Max", "Maxwell", "Bob", "neo"], members: {}, status: "Turno 1", open: false, done: false, top: [], pl: {}, lines: [], results: [],
    nextP: [{ t: "Turno 1: Maxwell vs Bob", p: ["Maxwell", "Bob"], srv: { name: "Sala torneo", addr: "1.2.3.4", pass: "torneo" } }, { t: "Turno 1: Max vs neo", p: ["Max", "neo"], srv: { name: "S2", addr: "5.6.7.8", pass: "torneo" } }],
    next: ["Turno 1: Maxwell vs Bob", "Turno 1: Max vs neo"] },
  { k: "ev1:cs2", ev: "ev1", l: "CS2", name: "", mode: "SE", team: false, players: [], members: {}, status: "Iscrizioni", open: true, done: false, top: [], pl: {}, lines: [], results: [], nextP: [], next: [] }],
  sala: { servers: [{ name: "Sala torneo", addr: "1.2.3.4", pass: "torneo" }] }, links: {} }, o || {});
const F = () => ({ all: false, games: [] });

test("collegamenti: quelli salvati prima della conferma valgono come confermati, /io da solo no, l'organizzatore conferma", async () => {
  const h = setup({ token: TOKEN, enabled: true, chats: {
    "20": { follow: F(), player: "Max" },
    "21": { follow: F(), player: "Bob", verified: false },
    "22": { follow: F(), player: "maxwell" } } });
  try {
    assert.strictEqual(person(h, 20).verified, true, "collegamento di una versione precedente: confermato");
    assert.strictEqual(person(h, 21).verified, false, "un «non confermato» salvato resta tale");
    h.b.setVM(VM()); await h.b.start();

    assert.match(await say(h, 20, "/server"), /Password: <code>torneo<\/code>/);
    assert.match(await say(h, 10, "/io Maxwell"), /Sei collegato/);
    assert.strictEqual(person(h, 10).verified, false);
    const sv = await say(h, 10, "/server");
    assert.ok(!/torneo<\/code>/.test(sv) && /organizzatore/.test(sv), sv);
    assert.match(await say(h, 10, "/discord pippo_1"), /confermat/);
    assert.strictEqual(h.ev.disc.length, 0, "/discord rifiutato senza conferma");

    /* l'organizzatore conferma dalla pagina */
    h.b.configure({ setPlayer: { id: "10", player: "Maxwell" } });
    assert.strictEqual(person(h, 10).verified, true);
    assert.match(await say(h, 10, "/discord pippo_1"), /Entrerai nei canali/);
    assert.deepStrictEqual([h.ev.disc[0].name, h.ev.disc[0].account], ["Maxwell", "pippo_1"]);

    /* collegamento con maiuscole diverse: alla pagina arriva la grafia dell'elenco */
    await say(h, 22, "/discord mx_2");
    assert.strictEqual(h.ev.disc[1].name, "Maxwell");
    assert.strictEqual(JSON.parse(fs.readFileSync(h.file, "utf8")).chats["20"].verified, true, "la conferma si salva");
  } finally { h.end(); }
});

test("/discord con un nome che non è tra i partecipanti: non promette i canali", async () => {
  const h = setup({ token: TOKEN, enabled: true, chats: { "30": { follow: F(), player: "Ghost", verified: true } } });
  try {
    h.b.setVM(VM()); await h.b.start();
    const r = await say(h, 30, "/discord ghost_1");
    assert.match(r, /non è ancora tra i partecipanti/);
    assert.ok(!/Entrerai/.test(r), r);
  } finally { h.end(); }
});

test("iscrizione con accenti o maiuscole diversi: richiesta e collegamento con la grafia dell'elenco", async () => {
  const h = setup({ token: TOKEN, enabled: true, join: "approve" });
  try {
    h.b.setVM(VM()); await h.b.start();
    assert.match(await say(h, 40, "/iscrivimi cs2|BÓB"), /Richiesta inviata/);
    const p = h.b.status().pending;
    assert.deepStrictEqual(p.map((x) => x.name), ["Bob"]);
    assert.deepStrictEqual([person(h, 40).player, person(h, 40).verified], ["Bob", false]);
    h.b.decide(p[0].id, true);
    assert.strictEqual(person(h, 40).verified, true, "iscrizione accettata: collegamento confermato");
    assert.strictEqual(h.ev.joins[0].name, "Bob");
  } finally { h.end(); }
});

test("Hall of Fame in CSV: un testo che sembra una formula diventa testo, i numeri restano numeri", async () => {
  const h = setup({ token: TOKEN, enabled: true });
  try {
    h.b.setVM(VM({ hof: { players: [{ n: "=HYPERLINK(1)", tot: -5, by: [] }, { n: "-12", tot: 3, by: [] }, { n: "@x", tot: 1.5, by: [{ l: "QUAKE", pos: 1, v: 10 }] }], teams: [] } }));
    await h.b.start();
    await say(h, 50, "/hof");
    for (let i = 0; i < 300 && !h.st.docs.length; i++) await sleep(10);
    const csv = h.st.docs[0].text;
    assert.match(csv, /"'=HYPERLINK\(1\)";"-5"/);
    assert.match(csv, /"-12";"3"/);
    assert.match(csv, /"'@x";"1.5";"QUAKE 1º 10"/);
  } finally { h.end(); }
});

test("file rovinato: messo da parte, si riparte dalla copia temporanea se c'è; salvataggio senza file temporanei lasciati", async () => {
  let h = setup('{"token":"' + TOKEN + '","enabled":tr');
  try {
    assert.strictEqual(h.b.status().hasToken, false);
    assert.ok(fs.readdirSync(h.dir).some((x) => x.startsWith("telegram.json.rovinato-")), "il file rovinato resta da parte");
    await h.b.configure({ join: "auto" });
    assert.strictEqual(JSON.parse(fs.readFileSync(h.file, "utf8")).join, "auto");
    assert.ok(!fs.existsSync(h.file + ".tmp"));
  } finally { h.end(); }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tornei-bot-")), file = path.join(dir, "telegram.json");
  fs.writeFileSync(file, '{"tok'); fs.writeFileSync(file + ".tmp", JSON.stringify({ token: TOKEN, join: "off" }));
  const b = createBot({ file, fetch: fakeTelegram().fetch, onJoin: () => {}, onChange: () => {} });
  try { assert.strictEqual(b.status().hasToken, true); assert.strictEqual(b.status().join, "off"); }
  finally { b.dispose(); fs.rmSync(dir, { recursive: true, force: true }); }
});
