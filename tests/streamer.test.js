// Diretta (streamer.js): avvio e stop che si incrociano, riconnessioni, chiavi nascoste, ffmpeg lento o mancante.
// Con un Electron e un ffmpeg finti: niente finestre, niente rete, niente processi veri.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { EventEmitter } = require("events");

let procs = [], wins = [];
class FakeWin extends EventEmitter {
  constructor(o) {
    super(); const self = this; this.o = o; this.destroyed = false; this.sent = [];
    this.webContents = Object.assign(new EventEmitter(), { send(ch, m) { self.sent.push([ch, m]); }, setFrameRate() {}, invalidate() {}, executeJavaScript: async () => [] });
    wins.push(this);
  }
  loadFile() { return Promise.resolve(); }
  isDestroyed() { return this.destroyed; }
  destroy() { this.destroyed = true; this.emit("closed"); }
}
function fakeSpawn(bin, args) {
  const p = new EventEmitter(); p.args = args; p.killed = 0; p.written = 0;
  p.stdin = Object.assign(new EventEmitter(), { writable: true, writableLength: 0, write() { p.written++; return true; }, end() { this.writable = false; } });
  p.stderr = new EventEmitter();
  p.kill = () => { p.killed++; return true; };
  procs.push(p); return p;
}
const fakes = {
  electron: { BrowserWindow: FakeWin, desktopCapturer: { getSources: async () => [] } },
  "ffmpeg-static": process.execPath, /* un file che esiste */
  child_process: { spawn: fakeSpawn, spawnSync: () => ({ status: 1 }) }
};
const load0 = Module._load;
Module._load = function (req) { return Object.prototype.hasOwnProperty.call(fakes, req) ? fakes[req] : load0.apply(this, arguments); };
const createStreamer = require("../streamer.js");

const flush = () => new Promise((r) => setImmediate(r));
const tmp = [];
test.after(() => tmp.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
function make(extra, cfgIn) {
  procs = []; wins = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-stream-")); tmp.push(dir);
  const h = { dir, lived: 0, ended: 0 };
  h.s = createStreamer(Object.assign({ file: path.join(dir, "stream.json"), logFile: path.join(dir, "diretta-ffmpeg.log"), saveDir: path.join(dir, "D'Amico", "dirette"), webPreferences: {}, getMain: () => null, onLive: () => h.lived++, onEnd: () => h.ended++ }, extra));
  h.s.configure(Object.assign({ source: "window:1", yt: { on: true, key: "YTKEY-aaaa-bbbb" } }, cfgIn));
  h.cmds = () => (wins[0] ? wins[0].sent.filter((x) => x[0] === "stream-cmd").map((x) => x[1]) : []);
  h.last = (type) => h.cmds().filter((m) => m.type === type).pop();
  /* avvio completo: la finestra risponde subito */
  h.go = async () => { const pr = h.s.start(); await flush(); h.s.ready({ ok: true, audio: false, gen: h.last("start").gen }); await pr; return procs[procs.length - 1]; };
  h.err = (p, txt) => p.stderr.emit("data", Buffer.from(txt));
  return h;
}
const STATS = "frame=  100 fps= 30 q=-1.0 size=N/A time=00:00:03.33 bitrate=N/A speed=1x\r";

test("Ferma durante «Avvio…»: ffmpeg non parte, la finestra si ferma e si può riavviare", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const pr = h.s.start(); await flush();
  const g1 = h.last("start").gen;
  h.s.stop();
  const r = await pr;
  assert.strictEqual(r.starting, false);
  h.s.ready({ ok: true, audio: true, gen: g1 }); /* la finestra finisce l'avvio in ritardo */
  assert.strictEqual(procs.length, 0);
  assert.strictEqual(h.cmds().pop().type, "stop", "telecamere e microfono vanno spenti");
  const p = await h.go();
  assert.strictEqual(procs.length, 1); assert.ok(p);
});

test("Avvia, Ferma, Avvia: la risposta vecchia non conta e la scadenza vecchia non tocca il nuovo avvio", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const p1 = h.s.start(); await flush(); const g1 = h.last("start").gen;
  h.s.stop(); await p1;
  const p2 = h.s.start(); await flush(); const g2 = h.last("start").gen;
  assert.notStrictEqual(g1, g2);
  h.s.ready({ ok: true, gen: g1 });
  assert.strictEqual(procs.length, 0);
  h.s.ready({ ok: true, gen: g2 }); await p2;
  assert.strictEqual(procs.length, 1);
  t.mock.timers.tick(25000);
  assert.strictEqual(h.s.status().starting, true);
  assert.strictEqual(h.s.status().err, "");
  assert.strictEqual(procs[0].killed, 0);
});

test("finestra che non risponde: dopo 20 s errore e «stop» alla finestra", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const pr = h.s.start(); await flush();
  t.mock.timers.tick(20001);
  const r = await pr;
  assert.strictEqual(r.starting, false);
  assert.match(r.err, /non risponde/);
  assert.strictEqual(h.cmds().pop().type, "stop");
  assert.strictEqual(procs.length, 0);
});

test("Ferma durante «mi riconnetto…» annulla la riconnessione: nessun ffmpeg orfano", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const a = await h.go();
  a.emit("exit", 1);
  assert.strictEqual(h.s.status().starting, true);
  h.s.stop();
  const b = await h.go();
  t.mock.timers.tick(60000);
  assert.strictEqual(procs.length, 2);
  assert.strictEqual(procs[1], b);
});

test("fermata mentre si riconnette: i bot sanno che la diretta è finita, una volta sola", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const a = await h.go();
  h.err(a, STATS);
  assert.strictEqual(h.s.status().live, true); assert.strictEqual(h.lived, 1);
  a.emit("exit", 1);
  assert.strictEqual(h.s.status().live, false);
  h.s.stop();
  assert.strictEqual(h.ended, 1);
  h.s.dispose();
  assert.strictEqual(h.ended, 1);
});

test("una destinazione che non si apre non interrompe le altre; caduta dopo 30 s in onda: si riconnette", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1e12 });
  const h = make({}, { tw: { on: true, key: "live_123456_abcdef" } });
  const a = await h.go();
  h.err(a, "[tee @ 0] Slave muxer #0 failed: I/O error, continuing with 1/2 slaves.\n");
  assert.strictEqual(a.killed, 0);
  assert.match(h.s.status().err, /YouTube/);
  h.err(a, STATS);
  assert.strictEqual(h.s.status().live, true);
  assert.match(h.s.status().err, /YouTube/, "l'errore resta visibile anche in onda");
  t.mock.timers.tick(31000);
  h.err(a, "[tee @ 0] Slave muxer #1 failed: Broken pipe, continuing with 0/2 slaves.\n");
  assert.strictEqual(a.killed, 1);
  assert.match(h.s.status().err, /Twitch: mi riconnetto/);
});

test("con la registrazione su disco non si uccide ffmpeg; la registrazione che fallisce non ferma la diretta", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1e12 });
  const h = make({}, { save: true });
  const a = await h.go();
  h.err(a, STATS); t.mock.timers.tick(31000);
  h.err(a, "Slave muxer #1 failed: No space left on device, continuing with 1/2 slaves.\n");
  assert.strictEqual(a.killed, 0);
  assert.match(h.s.status().err, /Registrazione su disco/);
  h.err(a, "Slave muxer #0 failed: Broken pipe, continuing with 0/2 slaves.\n");
  assert.strictEqual(a.killed, 0);
});

test("percorso con apostrofo protetto nel tee, registrazione con onfail=ignore", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make({}, { save: true });
  const a = await h.go();
  const tee = a.args[a.args.length - 1];
  assert.ok(tee.includes("D\\'Amico"), tee);
  assert.ok(tee.includes("[f=matroska:onfail=ignore]"), tee);
});

test("le chiavi non finiscono nel registro né nell'errore, anche spezzate fra due pezzi", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make({}, { yt: { on: false }, rtmp: { on: true, url: "rtmp://host/stream", key: "SECRETKEY123" } });
  const a = await h.go();
  h.err(a, "[tee @ 0] Slave '[f=flv:onfail=ignore]rtmp://host/stream/SECRET");
  h.err(a, "KEY123': error opening: Error number -138 occurred\n");
  const log = fs.readFileSync(path.join(h.dir, "diretta-ffmpeg.log"), "utf8");
  assert.ok(!log.includes("SECRET"), log);
  assert.ok(log.includes("rtmp://host/stream/***"), log);
  assert.ok(!h.s.status().err.includes("SECRET"));
  assert.match(h.s.status().err, /error opening/);
  /* RTMP con la chiave dentro l'indirizzo */
  const h2 = make({}, { yt: { on: false }, rtmp: { on: true, url: "rtmps://live-api-s.facebook.com:443/rtmp/FBKEY999" } });
  const b = await h2.go();
  h2.err(b, "Slave '[f=flv:onfail=ignore]rtmps://live-api-s.facebook.com:443/rtmp/FBKEY999': error opening\n");
  const log2 = fs.readFileSync(path.join(h2.dir, "diretta-ffmpeg.log"), "utf8");
  assert.ok(!log2.includes("FBKEY999"), log2);
});

test("ffmpeg che non tiene il passo: riavvio invece di riempire la memoria, dopo 3 volte si ferma", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const a = await h.go();
  h.err(a, STATS);
  const g = () => h.last("restart") ? h.last("restart").gen : h.last("start").gen;
  h.s.chunk(g(), new ArrayBuffer(8));
  assert.strictEqual(a.written, 1);
  a.stdin.writableLength = 40 * 1048576;
  h.s.chunk(g(), new ArrayBuffer(8)); h.s.chunk(g(), new ArrayBuffer(8));
  assert.strictEqual(a.killed, 1); assert.strictEqual(a.written, 1);
  assert.match(h.s.status().err, /troppo lenti/);
  a.emit("exit", null); t.mock.timers.tick(2000);
  const b = procs[1]; assert.ok(b);
  b.stdin.writableLength = 200 * 1048576;
  h.s.chunk(g(), new ArrayBuffer(8));
  assert.strictEqual(b.killed, 1);
  b.emit("exit", null); t.mock.timers.tick(4000);
  const c = procs[2]; assert.ok(c);
  c.stdin.writableLength = 200 * 1048576;
  h.s.chunk(g(), new ArrayBuffer(8));
  assert.strictEqual(h.s.status().starting, false);
  assert.match(h.s.status().err, /qualità più bassa/);
});

test("ffmpeg mancante o bloccato ('error' senza 'exit'): errore chiaro e si può riavviare", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = make();
  const a = await h.go();
  a.emit("error", Object.assign(new Error("spawn ffmpeg.exe ENOENT"), { code: "ENOENT" }));
  assert.strictEqual(h.s.status().starting, false);
  assert.match(h.s.status().err, /ffmpeg non avviabile: ENOENT/);
  await h.go();
  assert.strictEqual(procs.length, 2);
});

test("configurazione: scritta in modo atomico, un file rovinato viene messo da parte", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-stream-")); tmp.push(dir);
  const file = path.join(dir, "stream.json");
  fs.writeFileSync(file, '{"yt":{"on":true,"key":"ABC');
  const s = createStreamer({ file, webPreferences: {}, getMain: () => null });
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith("stream.json.rovinato-")));
  s.configure({ quality: "1080p30" });
  assert.strictEqual(JSON.parse(fs.readFileSync(file, "utf8")).quality, "1080p30");
  assert.ok(!fs.existsSync(file + ".tmp"));
});
