// Canali Discord per partita: creazione, giocatori, chiusura a fine partita, pulizia. Con un Discord finto, senza rete.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const createDiscord = require("../discord.js");

function fakeDiscord() {
  let seq = 100; const ch = {}, msgs = [], calls = [];
  const members = [{ user: { id: "11111111111111111", username: "ada_92", global_name: "Ada" } }, { user: { id: "22222222222222222", username: "bo.games", global_name: "Bo" } }];
  const res = (status, body) => ({ ok: status < 300, status, json: async () => body });
  async function fetch(url, o) {
    const p = url.replace(/^https:\/\/discord\.com\/api\/v10/, ""), m = o.method || "GET", b = o.body ? JSON.parse(o.body) : null; let x;
    calls.push(m + " " + p);
    if (p === "/users/@me") return res(200, { id: "99999999999999999", username: "Bot" });
    if (p === "/users/@me/guilds") return res(200, [{ id: "77777777777777777", name: "LAN" }]);
    if ((x = p.match(/^\/guilds\/\d+\/members\/search\?.*query=([^&]+)/))) { const q = decodeURIComponent(x[1]); return res(200, members.filter((e) => e.user.username.startsWith(q))); }
    if (/^\/guilds\/\d+\/channels$/.test(p) && m === "POST") { const c = Object.assign({ id: String(++seq) }, b); ch[c.id] = c; return res(201, c); }
    if ((x = p.match(/^\/channels\/(\d+)$/))) {
      if (!ch[x[1]]) return res(404, { message: "Unknown Channel" });
      if (m === "GET") return res(200, ch[x[1]]);
      if (m === "PATCH") { Object.assign(ch[x[1]], b); return res(200, ch[x[1]]); }
      if (m === "DELETE") { delete ch[x[1]]; return res(200, {}); }
    }
    if ((x = p.match(/^\/channels\/(\d+)\/messages$/))) { msgs.push({ ch: x[1], content: b.content }); return res(200, { id: String(++seq) }); }
    return res(404, { message: "404" });
  }
  return { fetch, ch, msgs, calls };
}
const VIEW = 1n << 10n, SEND = 1n << 11n;
function vm(state, sig) {
  return { ev: "tprova1", guild: "77777777777777777", voice: false, title: "Prova", accounts: ["ada_92", "bo.games", "nessuno"],
    games: [{ key: "quake", label: "QUAKE LIVE", all: ["e0-0", "e1-0"], matches: state ? [{ key: "e0-0", name: "Ada vs Bo", label: "Semifinali", players: ["Ada", "Bo"], sig: sig || "Ada|Bo", accounts: ["ada_92", "bo.games"], state, result: state === "done" ? "Ada 3–1 Bo" : "", server: null }] : [] }], t: {} };
}

test("canale privato per partita, chiuso a fine partita, rifatto se cambiano i giocatori, pulizia", async () => {
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
  assert.ok(BigInt(ow(text, "77777777777777777").deny) & VIEW, "@everyone non vede il canale");
  assert.ok(BigInt(ow(text, "11111111111111111").allow) & SEND, "Ada scrive");
  assert.ok(ow(text, "22222222222222222"), "Bo c'è");
  assert.match(F.msgs[0].content, /<@11111111111111111>/);

  r = await d.sync(vm("ready"));
  assert.strictEqual(r.created, 0, "nessun doppione");

  r = await d.sync(vm("done"));
  assert.strictEqual(r.closed, 1);
  assert.ok(BigInt(ow(F.ch[text.id], "11111111111111111").deny) & SEND, "a fine partita sola lettura");
  assert.match(F.msgs[F.msgs.length - 1].content, /Ada 3–1 Bo/);

  r = await d.sync(vm("ready", "Ada|Cy"));
  assert.strictEqual(r.removed, 1); assert.strictEqual(r.created, 1);
  assert.ok(!F.ch[text.id], "il canale della partita vecchia è stato tolto");

  const n = await d.clear("tprova1");
  assert.ok(n >= 1);
  assert.strictEqual(Object.keys(F.ch).length, 0, "canali e categoria eliminati");
  assert.ok(!JSON.stringify(fs.readdirSync(dir).map((f) => f)).includes("abc.def"));
  fs.rmSync(dir, { recursive: true, force: true });
});
test("nomi dei canali", () => {
  assert.strictEqual(createDiscord.slug("Àda vs Bò — Finale!"), "ada-vs-bo-finale");
  assert.strictEqual(createDiscord.slug("???"), "partita");
});
