// Canali Discord per partita: creazione, giocatori, chiusura a fine partita, pulizia. Con un Discord finto, senza rete.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const createDiscord = require("../discord.js");

/* opt: max (canali per categoria), failVoice (i vocali non si creano), denyDelete (403 sulle cancellazioni), delay (ms per chiamata) */
function fakeDiscord(opt) {
  opt = opt || {};
  let seq = 100; const ch = {}, msgs = [], calls = [];
  const members = [{ user: { id: "11111111111111111", username: "ada_92", global_name: "Ada", discriminator: "0" } }, { user: { id: "22222222222222222", username: "bo.games", global_name: "Bo", discriminator: "0" } },
    { user: { id: "33333333333333333", username: "cy.plays", global_name: "Cy", discriminator: "0" } }, { user: { id: "44444444444444444", username: "marco_99", global_name: "Marco", discriminator: "0" }, nick: "marco" }];
  const res = (status, body) => ({ ok: status < 300, status, json: async () => body });
  async function fetch(url, o) {
    if (opt.delay) await new Promise((ok) => setTimeout(ok, opt.delay));
    const p = url.replace(/^https:\/\/discord\.com\/api\/v10/, ""), m = o.method || "GET", b = o.body ? JSON.parse(o.body) : null; let x;
    calls.push(m + " " + p);
    if (p === "/users/@me") return res(200, { id: "99999999999999999", username: "Bot" });
    if (p === "/users/@me/guilds") return res(200, [{ id: "77777777777777777", name: "LAN" }]);
    /* come Discord: prefisso del nome utente o del soprannome, maiuscole a parte */
    if ((x = p.match(/^\/guilds\/\d+\/members\/search\?.*query=([^&]+)/))) { const q = decodeURIComponent(x[1]).toLowerCase(); return res(200, members.filter((e) => [e.user.username, e.nick || ""].some((s) => s.toLowerCase().startsWith(q)))); }
    if (/^\/guilds\/\d+\/channels$/.test(p) && m === "POST") {
      if (opt.failVoice && b.type === 2) return res(400, { message: "Invalid Form Body", code: 50035 });
      if (b.parent_id && Object.values(ch).filter((c) => c.parent_id === b.parent_id).length >= (opt.max || 50))
        return res(400, { message: "Invalid Form Body", code: 50035, errors: { parent_id: { _errors: [{ code: "CHANNEL_PARENT_MAX_CHANNELS", message: "Maximum number of channels in category reached (50)" }] } } });
      const c = Object.assign({ id: String(++seq) }, b); ch[c.id] = c; return res(201, c);
    }
    if ((x = p.match(/^\/channels\/(\d+)$/))) {
      if (!ch[x[1]]) return res(404, { message: "Unknown Channel" });
      if (m === "GET") return res(200, ch[x[1]]);
      if (m === "PATCH") { Object.assign(ch[x[1]], b); return res(200, ch[x[1]]); }
      if (m === "DELETE") { if (opt.denyDelete) return res(403, { message: "Missing Permissions" }); delete ch[x[1]]; return res(200, {}); }
    }
    if ((x = p.match(/^\/channels\/(\d+)\/messages$/))) { msgs.push({ ch: x[1], content: b.content }); return res(200, { id: String(++seq) }); }
    return res(404, { message: "404" });
  }
  return { fetch, ch, msgs, calls, opt };
}
const VIEW = 1n << 10n, SEND = 1n << 11n, G = "77777777777777777";
function vm(state, sig, accounts) {
  sig = sig || "Ada|Bo"; const ps = sig.split("|");
  return { ev: "tprova1", guild: G, voice: false, title: "Prova", accounts: ["ada_92", "bo.games", "cy.plays", "nessuno"],
    games: [{ key: "quake", label: "QUAKE LIVE", all: ["e0-0", "e1-0"], matches: state ? [{ key: "e0-0", name: ps.join(" vs "), label: "Semifinali", players: ps, sig, accounts: accounts || ["ada_92", "bo.games"], state, result: state === "done" ? ps[0] + " 3–1 " + ps[1] : "", server: null }] : [] }], t: {} };
}
/* n partite pronte senza account */
function many(n) { return Array.from({ length: n }, (_, i) => ({ key: "e" + i, name: "P" + i + " vs Q" + i, label: "Turno 1", players: ["P" + i, "Q" + i], sig: "P" + i + "|Q" + i, accounts: [], state: "ready", result: "", server: null })); }
async function setup(opt) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tornei-dc-")), F = fakeDiscord(opt), d = createDiscord({ dir, fetch: F.fetch });
  await d.configure({ token: "abc" });
  return { dir, F, d, end: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const of = (F, type) => Object.values(F.ch).filter((c) => c.type === type);

test("canale privato per partita, chiuso a fine partita, rinominato, rifatto se cambiano i giocatori, pulizia", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tornei-dc-")), F = fakeDiscord();
  const d = createDiscord({ dir, fetch: F.fetch });
  const ok = await d.configure({ token: "Bot  abc.def " });
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.guilds.map((g) => g.name), ["LAN"]);

  let r = await d.sync(vm("ready"));
  assert.strictEqual(r.created, 1, JSON.stringify(r));
  assert.deepStrictEqual(r.missing, ["nessuno"]);
  const text = Object.values(F.ch).find((c) => c.type === 0), cat = Object.values(F.ch).find((c) => c.type === 4);
  assert.ok(cat && text && text.parent_id === cat.id);
  assert.strictEqual(text.name, "ada-vs-bo");
  const ow = (c, id) => c.permission_overwrites.find((o) => o.id === id);
  assert.ok(BigInt(ow(text, G).deny) & VIEW, "@everyone non vede il canale");
  assert.ok(BigInt(ow(text, "11111111111111111").allow) & SEND, "Ada scrive");
  assert.ok(ow(text, "22222222222222222"), "Bo c'è");
  assert.match(F.msgs[0].content, /<@11111111111111111>/);

  r = await d.sync(vm("ready"));
  assert.strictEqual(r.created, 0, "nessun doppione");

  r = await d.sync(vm("done"));
  assert.strictEqual(r.closed, 1);
  assert.ok(BigInt(ow(F.ch[text.id], "11111111111111111").deny) & SEND, "a fine partita sola lettura");
  assert.match(F.msgs[F.msgs.length - 1].content, /Ada 3–1 Bo/);

  /* nome del giocatore corretto, stessi account: il canale (con la sua chat) resta e cambia solo nome */
  r = await d.sync(vm("done", "Adaa|Bo"));
  assert.strictEqual(r.removed, 0, JSON.stringify(r));
  assert.ok(F.ch[text.id], "il canale della partita finita non si cancella");
  assert.strictEqual(F.ch[text.id].name, "adaa-vs-bo");

  r = await d.sync(vm("ready", "Ada|Cy", ["ada_92", "cy.plays"]));
  assert.strictEqual(r.removed, 1); assert.strictEqual(r.created, 1);
  assert.ok(!F.ch[text.id], "il canale della partita vecchia è stato tolto");

  const n = await d.clear("tprova1");
  assert.ok(n >= 1);
  assert.strictEqual(Object.keys(F.ch).length, 0, "canali e categoria eliminati");
  assert.ok(!JSON.stringify(fs.readdirSync(dir).map((f) => f)).includes("abc.def"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("account: solo il nome utente esatto; chi non c'è non si cerca a ogni sincronizzazione", async () => {
  const { F, d, end } = await setup();
  let r = await d.lookup(G, ["marco", "ada_92", "ada_92#1234"]);
  assert.strictEqual(r.marco, null, "marco_99 col nome visualizzato o il soprannome «marco» non è marco");
  assert.strictEqual(r.ada_92, "11111111111111111");
  assert.strictEqual(r["ada_92#1234"], null, "discriminatore diverso");
  const searches = () => F.calls.filter((c) => c.includes("query=nessuno")).length;
  await d.sync(vm("ready")); const s0 = searches();
  await d.sync(vm("ready"));
  assert.strictEqual(searches(), s0, "account non trovato da poco: niente nuova ricerca");
  await d.lookup(G, ["nessuno"]);
  assert.strictEqual(searches(), s0 + 1, "«Controlla» cerca sempre");
  end();
});

test("categorie piene: oltre 50 canali se ne apre un'altra, anche quando Discord la dice piena prima", async () => {
  let { F, d, end } = await setup();
  const v = { ev: "tgrande", guild: G, voice: true, title: "Grande", accounts: [], t: {},
    games: [{ key: "quake", label: "QUAKE", all: [], matches: many(30) }, { key: "cpma", label: "CPMA", all: [], matches: many(2) }] };
  let r = await d.sync(v);
  assert.ok(!r.err, r.err); assert.strictEqual(r.created, 32); assert.strictEqual(d.channels("tgrande").n, 32);
  assert.strictEqual(of(F, 0).length, 32); assert.strictEqual(of(F, 2).length, 32);
  assert.strictEqual(of(F, 4).length, 3, "quake, quake (2), cpma");
  of(F, 4).forEach((c) => assert.ok(Object.values(F.ch).filter((x) => x.parent_id === c.id).length <= 50));
  r = await d.sync(v);
  assert.strictEqual(r.created, 0); assert.ok(!r.err, r.err);
  assert.strictEqual(await d.clear("tgrande"), 64);
  assert.strictEqual(Object.keys(F.ch).length, 0, "anche la categoria in più è eliminata");
  end();

  ({ F, d, end } = await setup({ max: 4 }));
  r = await d.sync({ ev: "tpieno", guild: G, voice: false, title: "Pieno", accounts: [], t: {}, games: [{ key: "quake", label: "QUAKE", all: [], matches: many(6) }] });
  assert.ok(!r.err, r.err); assert.strictEqual(r.created, 6); assert.strictEqual(of(F, 4).length, 2);
  end();
});

test("un errore su una partita non ferma le altre, e il canale di testo creato non resta orfano", async () => {
  const { F, d, end } = await setup({ failVoice: true });
  const v = { ev: "tvoce", guild: G, voice: true, title: "Voce", accounts: [], t: {}, games: [{ key: "quake", label: "QUAKE", all: [], matches: many(2) }] };
  let r = await d.sync(v);
  assert.ok(r.err, "l'errore arriva alla pagina"); assert.strictEqual(r.errors.length, 2);
  assert.strictEqual(r.created, 2); assert.strictEqual(d.channels("tvoce").n, 2);
  r = await d.sync(v);
  assert.strictEqual(of(F, 0).length, 2, "nessun testo doppio a ogni tentativo");
  F.opt.failVoice = false;
  r = await d.sync(v);
  assert.ok(!r.err, r.err); assert.strictEqual(of(F, 2).length, 2, "il vocale mancante si crea dopo");
  await d.clear("tvoce");
  assert.strictEqual(Object.keys(F.ch).length, 0);
  end();
});

test("vocale riallineato e canali cancellati a mano", async () => {
  const { F, d, end } = await setup();
  const V = (state, more) => Object.assign(vm(state), { voice: true }, more);
  await d.sync(V("ready"));
  assert.strictEqual(of(F, 2).length, 1);
  /* testo cancellato a mano, poi la partita finisce: va via anche il vocale */
  delete F.ch[of(F, 0)[0].id];
  await d.sync(V("done"));
  assert.strictEqual(of(F, 2).length, 0, "nessun vocale orfano"); assert.strictEqual(d.channels("tprova1").n, 0);
  let r = await d.sync(V("ready"));
  assert.strictEqual(r.created, 1); assert.strictEqual(of(F, 2).length, 1);
  await d.sync(vm("ready"));
  assert.strictEqual(of(F, 2).length, 0, "opzione vocale spenta: vocale tolto");
  r = await d.sync(V("ready"));
  assert.strictEqual(r.created, 0); assert.strictEqual(of(F, 2).length, 1, "opzione accesa dopo: vocale creato");
  await d.sync(V("done"));
  assert.strictEqual(of(F, 2).length, 0);
  await d.sync(V("ready"));
  assert.strictEqual(of(F, 2).length, 1, "partita riaperta: vocale di nuovo");
  /* aggiornamento chiesto a mano: il testo cancellato a mano si rifà */
  delete F.ch[of(F, 0)[0].id];
  r = await d.sync(V("ready", { now: true }));
  assert.strictEqual(r.created, 1); assert.strictEqual(of(F, 0).length, 1); assert.strictEqual(of(F, 2).length, 1);
  /* vocale cancellato a mano, poi rinomina o giocatori cambiati: il testo (con la chat) resta, il vocale si rifà */
  const t0 = of(F, 0)[0].id;
  delete F.ch[of(F, 2)[0].id];
  r = await d.sync(Object.assign(vm("ready", "Adaa|Bo"), { voice: true }));
  assert.ok(F.ch[t0], "testo non cancellato"); assert.strictEqual(r.created, 0); assert.strictEqual(of(F, 2).length, 1);
  delete F.ch[of(F, 2)[0].id];
  r = await d.sync(Object.assign(vm("ready", "Adaa|Bo", ["ada_92"]), { voice: true }));
  assert.ok(F.ch[t0], "testo non cancellato"); assert.strictEqual(of(F, 2).length, 1); assert.strictEqual(d.channels("tprova1").n, 1);
  end();
});

test("«Elimina i canali»: se Discord non cancella lo dice e non dimentica; aspetta la sincronizzazione in corso", async () => {
  let { F, d, end } = await setup();
  await d.sync(vm("ready"));
  F.opt.denyDelete = true;
  let r = await d.clear("tprova1");
  assert.ok(r && r.err, "errore, non «eliminati»");
  assert.strictEqual(d.channels("tprova1").n, 1, "gli id restano per riprovare");
  F.opt.denyDelete = false;
  assert.strictEqual(await d.clear("tprova1"), 1);
  assert.strictEqual(Object.keys(F.ch).length, 0);
  end();

  ({ F, d, end } = await setup({ delay: 2 }));
  const v = { ev: "tcorsa", guild: G, voice: false, title: "Corsa", accounts: [], t: {}, games: [{ key: "quake", label: "QUAKE", all: [], matches: many(8) }] };
  const p = d.sync(v); d.sync(v);
  await new Promise((ok) => setTimeout(ok, 30));
  r = await d.clear("tcorsa"); await p;
  assert.ok(!(r && r.err), r && r.err);
  assert.strictEqual(Object.keys(F.ch).length, 0, "nessun canale rifatto dopo la cancellazione");
  assert.strictEqual(d.channels("tcorsa").n, 0);
  end();
});

test("server Discord cambiato: con confirmMove si chiede conferma prima di togliere i canali dal server di prima", async () => {
  const { F, d, end } = await setup(), G2 = "88888888888888888";
  await d.sync(vm("ready"));
  const old = Object.keys(F.ch);
  let r = await d.sync(Object.assign(vm("ready"), { guild: G2, confirmMove: false }));
  assert.strictEqual(r.needConfirm, true, JSON.stringify(r));
  assert.strictEqual(r.channels, 1);
  assert.deepStrictEqual(Object.keys(F.ch), old, "nessun canale tolto senza conferma");
  assert.strictEqual(d.channels("tprova1").guild, G, "resta il server di prima");
  r = await d.sync(Object.assign(vm("ready"), { guild: G2, confirmMove: true }));
  assert.ok(!r.needConfirm && !r.err, JSON.stringify(r));
  assert.strictEqual(d.channels("tprova1").guild, G2);
  assert.ok(old.every((id) => !F.ch[id]), "canali e categoria del server di prima tolti");
  assert.strictEqual(r.created, 1);
  end();
  /* pagina che non conosce confirmMove: come prima, si sposta subito */
  const s2 = await setup();
  await s2.d.sync(vm("ready"));
  r = await s2.d.sync(Object.assign(vm("ready"), { guild: G2 }));
  assert.ok(!r.needConfirm && r.created === 1, JSON.stringify(r));
  assert.strictEqual(s2.d.channels("tprova1").guild, G2);
  s2.end();
});

test("nomi dei canali", () => {
  assert.strictEqual(createDiscord.slug("Àda vs Bò — Finale!"), "ada-vs-bo-finale");
  assert.strictEqual(createDiscord.slug("???"), "partita");
  assert.strictEqual(createDiscord.slug("Иван vs Пётр"), "иван-vs-пётр");
  assert.strictEqual(createDiscord.slug("がくと vs ぱんだ"), "がくと-vs-ぱんだ");
});
