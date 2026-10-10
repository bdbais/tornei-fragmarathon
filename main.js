const { app, BrowserWindow, shell, ipcMain, screen, session } = require("electron");
const path = require("path");
const fs = require("fs");
const AI = require("./js/ai.js");
const createBot = require("./bot.js");
const createStreamer = require("./streamer.js");

if (!app.requestSingleInstanceLock()) app.quit();

/* Cartelle dei dati: create al primo avvio, senza configurazione. */
/* TORNEI_DIR: cartella dati diversa (test automatici), così non si tocca quella vera nei Documenti */
const ROOT = process.env.TORNEI_DIR || path.join(app.getPath("documents"), "Tornei Fragmarathon");
const DIRS = { tornei: path.join(ROOT, "tornei"), backup: path.join(ROOT, "backup"), dirette: path.join(ROOT, "dirette"), eventi: path.join(ROOT, "eventi"), cestino: path.join(ROOT, "cestino") };
const MAX_BACKUPS = 200;
function ensureDirs() { [DIRS.tornei, DIRS.backup, DIRS.eventi].forEach((d) => fs.mkdirSync(d, { recursive: true })); }

/* Accetta solo nomi di file .json dentro la cartella indicata: niente percorsi. */
function safeFile(dir, name) {
  const base = path.basename(String(name || ""));
  if (!base || base !== name || !/\.json$/i.test(base)) throw new Error("Nome file non valido");
  return path.join(dir, base);
}
function slug(t) {
  return String(t || "torneo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "torneo";
}
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
function writeAtomic(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, file);
}
function listJson(dir) {
  return fs.readdirSync(dir).filter((f) => /\.json$/i.test(f)).map((f) => {
    const st = fs.statSync(path.join(dir, f));
    return { file: f, mtime: st.mtimeMs, size: st.size };
  }).sort((a, b) => b.mtime - a.mtime);
}

/* ---- finestra principale (posizione e dimensione ricordate) ---- */
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");
function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    const ok = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x >= a.x - 50 && b.y >= a.y - 50 && b.x < a.x + a.width && b.y < a.y + a.height;
    });
    return ok ? b : null;
  } catch { return null; }
}

let win = null, wall = null;
function hardenNav(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
}
const webPreferences = { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "preload.js") };

function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    width: b?.width || 1360, height: b?.height || 900, x: b?.x, y: b?.y, minWidth: 900, minHeight: 600,
    title: "Tornei Fragmarathon", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    backgroundColor: "#121212", show: false, webPreferences
  });
  if (b?.max) win.maximize();
  win.setMenuBarVisibility(false);
  hardenNav(win);
  win.once("ready-to-show", () => win.show());
  win.on("close", () => {
    try { fs.writeFileSync(STATE_FILE, JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch {}
  });
  win.on("closed", () => { win = null; if (wall) wall.close(); if (streamer) streamer.dispose(); });
  win.loadFile(path.join(__dirname, "index.html"));
}

/* ---- schermo proiettore: secondo monitor se c'è, a tutto schermo ---- */
function openWall() {
  if (wall) { wall.show(); wall.focus(); return wall; }
  const prim = screen.getPrimaryDisplay();
  const ext = screen.getAllDisplays().find((d) => d.id !== prim.id);
  const area = (ext || prim).bounds;
  wall = new BrowserWindow({
    x: area.x + 40, y: area.y + 40, width: Math.min(1600, area.width - 80), height: Math.min(900, area.height - 80),
    title: "Tornei Fragmarathon — Proiettore", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    backgroundColor: "#000000", fullscreen: !!ext, webPreferences
  });
  wall.setMenuBarVisibility(false);
  hardenNav(wall);
  wall.on("closed", () => { wall = null; });
  wall.loadFile(path.join(__dirname, "index.html"), { query: { wall: "1" } });
  return wall;
}

/* ---- aggiornamenti automatici (GitHub Releases del repository pubblico) ---- */
let updater = null;
function sendUpdate(state) { if (win) win.webContents.send("update", state); }
function initUpdater() {
  if (!app.isPackaged) return;
  try { updater = require("electron-updater").autoUpdater; } catch { return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
  updater.on("update-available", (i) => sendUpdate({ state: "available", version: i.version }));
  updater.on("update-not-available", () => sendUpdate({ state: "none" }));
  updater.on("download-progress", (p) => sendUpdate({ state: "downloading", percent: Math.round(p.percent) }));
  updater.on("update-downloaded", (i) => sendUpdate({ state: "ready", version: i.version }));
  updater.on("error", (e) => sendUpdate({ state: "error", message: String(e && e.message || e).slice(0, 200) }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

/* ---- API per la pagina (vedi preload.js) ---- */
ipcMain.handle("info", () => ({ version: app.getVersion(), dir: ROOT, packaged: app.isPackaged }));
ipcMain.handle("tornei:list", () => {
  ensureDirs();
  return listJson(DIRS.tornei).map((f) => {
    let meta = {};
    try {
      const j = JSON.parse(fs.readFileSync(path.join(DIRS.tornei, f.file), "utf8"));
      meta = { title: j.title || "", game: j.game && j.game.l || "", status: j.status || "", savedAt: j.savedAt || "" };
    } catch { meta = { broken: true }; }
    return { ...f, ...meta };
  });
});
ipcMain.handle("tornei:save", (_e, file, data, title) => {
  ensureDirs();
  JSON.parse(data);
  const name = file ? path.basename(safeFile(DIRS.tornei, file)) : `${stamp()}_${slug(title)}.json`;
  writeAtomic(path.join(DIRS.tornei, name), data);
  return { file: name };
});
ipcMain.handle("tornei:read", (_e, file) => fs.readFileSync(safeFile(DIRS.tornei, file), "utf8"));
ipcMain.handle("backup:write", (_e, label, data) => {
  ensureDirs();
  JSON.parse(data);
  const name = `${stamp()}_${slug(label)}.json`;
  writeAtomic(path.join(DIRS.backup, name), data);
  listJson(DIRS.backup).slice(MAX_BACKUPS).forEach((f) => { try { fs.unlinkSync(path.join(DIRS.backup, f.file)); } catch {} });
  return { file: name };
});
ipcMain.handle("backup:list", () => { ensureDirs(); return listJson(DIRS.backup).slice(0, 60); });
ipcMain.handle("backup:read", (_e, file) => fs.readFileSync(safeFile(DIRS.backup, file), "utf8"));
ipcMain.handle("folder:open", (_e, which) => { ensureDirs(); return shell.openPath(DIRS[which] || ROOT); });
ipcMain.handle("wall:open", () => openWall());
/* Generazione loghi: la richiesta parte da qui, senza i limiti CORS della pagina. */
ipcMain.handle("ai:image", async (_e, cfg, prompt, seed, size) => {
  try { return { data: await AI.generate(cfg || {}, prompt, seed, Math.min(1024, Math.max(256, size || 512))) }; }
  catch (e) { return { error: String((e && e.name === "TimeoutError") ? "Il servizio non ha risposto in tempo" : (e && e.message) || e).slice(0, 300) }; }
});
/* Elenco dei tornei (uno per file in "eventi"): la pagina lavora su una copia e la salva qui.
   Eliminare un torneo lo sposta in "cestino", da cui si può recuperare a mano. */
const evFile = (id) => { if (!/^[a-z0-9-]{4,40}$/.test(String(id || ""))) throw new Error("Torneo non valido"); return path.join(DIRS.eventi, id + ".json"); };
ipcMain.handle("ev:list", () => {
  ensureDirs();
  return listJson(DIRS.eventi).map((f) => {
    try { const j = JSON.parse(fs.readFileSync(path.join(DIRS.eventi, f.file), "utf8")); return { id: f.file.replace(/\.json$/i, ""), mtime: f.mtime, size: f.size, meta: j.meta || {} }; }
    catch { return { id: f.file.replace(/\.json$/i, ""), mtime: f.mtime, size: f.size, broken: true, meta: {} }; }
  });
});
ipcMain.handle("ev:read", (_e, id) => fs.readFileSync(evFile(id), "utf8"));
ipcMain.handle("ev:write", (_e, id, data) => { ensureDirs(); JSON.parse(data); writeAtomic(evFile(id), data); return true; });
ipcMain.handle("ev:trash", (_e, id) => {
  const f = evFile(id); if (!fs.existsSync(f)) return false;
  fs.mkdirSync(DIRS.cestino, { recursive: true });
  fs.renameSync(f, path.join(DIRS.cestino, stamp() + "_" + id + ".json")); return true;
});

/* Bot Telegram: gira qui, con i dati che la pagina gli manda già calcolati.
   Si possono avere più bot (ognuno col suo file: token, ruoli, iscritti, impostazioni);
   ne gira uno alla volta, quello scelto dal torneo aperto. */
let bot = null, botId = "";
const BOTS_FILE = path.join(app.getPath("userData"), "bots.json");
function botsLoad() {
  let b = null; try { b = JSON.parse(fs.readFileSync(BOTS_FILE, "utf8")); } catch {}
  if (!b || !Array.isArray(b.list) || !b.list.length) b = { list: [{ id: "b1", label: "Bot principale", file: "telegram.json" }] };
  return b;
}
function botsSave(b) { writeAtomic(BOTS_FILE, JSON.stringify(b, null, 1)); }
const botPath = (e) => path.join(app.getPath("userData"), path.basename(e.file));
function makeBot(entry) {
  const b = createBot({
    file: botPath(entry),
    onJoin: (req) => toPage({ type: "join", name: req.name, k: req.k }),
    onPng: (r) => toPage({ type: "png", id: r.id, k: r.k }),
    onChange: () => {
      toPage({ type: "status" });
      const u = b.status().username; if (u) { const L = botsLoad(), x = L.list.find((y) => y.id === entry.id); if (x && x.username !== u) { x.username = u; botsSave(L); } }
    },
    /* rete di Chromium: rispetta proxy e certificati di sistema (il fetch di Node no) */
    fetch: (url, o) => require("electron").net.fetch(url, o)
  });
  return b;
}
function botUse(id) {
  const L = botsLoad(), e = L.list.find((x) => x.id === id) || L.list[0];
  if (bot && botId === e.id) return bot.status();
  if (bot) bot.stop();
  botId = e.id; bot = makeBot(e);
  if (streamer) bot.setStreamer(streamer);
  bot.start().catch(() => {});
  return bot.status();
}
function botsInfo() {
  const L = botsLoad();
  return L.list.map((e) => {
    let c = {}; try { c = JSON.parse(fs.readFileSync(botPath(e), "utf8")); } catch {}
    const st = e.id === botId && bot ? bot.status() : null;
    return { id: e.id, label: e.label, color: e.color || "", username: (st && st.username) || e.username || "", hasToken: !!c.token, people: Object.keys(c.chats || {}).length, active: e.id === botId, running: !!(st && st.running) };
  });
}
ipcMain.handle("bots:list", () => botsInfo());
ipcMain.handle("bots:use", (_e, id) => { botUse(String(id || "")); return botsInfo(); });
ipcMain.handle("bots:add", (_e, label) => {
  const L = botsLoad(), id = "b" + Date.now().toString(36);
  L.list.push({ id, label: String(label || "Nuovo bot").slice(0, 60), file: "telegram-" + id + ".json" }); botsSave(L); return id;
});
ipcMain.handle("bots:edit", (_e, id, o) => {
  const L = botsLoad(), e = L.list.find((x) => x.id === id); if (!e) return botsInfo();
  if (o && typeof o.label === "string" && o.label.trim()) e.label = o.label.trim().slice(0, 60);
  if (o && typeof o.color === "string" && /^(#[0-9a-f]{6})?$/i.test(o.color)) e.color = o.color;
  botsSave(L); return botsInfo();
});
/* Togliere un bot sposta il suo file tra i dati dell'app ("bot-rimossi"): contiene il token, non va nei Documenti. */
ipcMain.handle("bots:remove", (_e, id) => {
  const L = botsLoad(); if (L.list.length < 2) return botsInfo();
  const e = L.list.find((x) => x.id === id); if (!e) return botsInfo();
  L.list = L.list.filter((x) => x !== e); botsSave(L);
  const dir = path.join(app.getPath("userData"), "bot-rimossi"); fs.mkdirSync(dir, { recursive: true });
  try { fs.renameSync(botPath(e), path.join(dir, stamp() + "_" + path.basename(e.file))); } catch {}
  if (botId === id) { if (bot) bot.stop(); bot = null; botId = ""; botUse(L.list[0].id); }
  return botsInfo();
});
function toPage(msg) { if (win) win.webContents.send("bot", msg); }
ipcMain.handle("bot:state", (_e, vm) => { if (bot) bot.setVM(vm); });
ipcMain.handle("bot:status", () => (bot ? bot.status() : null));
ipcMain.handle("bot:config", (_e, c) => (bot ? bot.configure(c) : null));
ipcMain.handle("bot:decide", (_e, id, ok) => (bot ? bot.decide(id, ok) : false));
ipcMain.handle("bot:png", (_e, id, data) => { if (bot) bot.pngReply(id, data); });
/* Diretta: la finestra nascosta compone, ffmpeg trasmette (streamer.js) */
let streamer = null;
ipcMain.handle("stream:status", () => (streamer ? streamer.status() : null));
ipcMain.handle("stream:config", (_e, c) => (streamer ? streamer.configure(c) : null));
ipcMain.handle("stream:start", () => (streamer ? streamer.start() : null));
ipcMain.handle("stream:stop", () => (streamer ? streamer.stop() : null));
ipcMain.handle("stream:scene", (_e, s, cam) => (streamer ? streamer.scene(s, cam) : null));
ipcMain.handle("stream:sources", () => (streamer ? streamer.sources() : null));
ipcMain.handle("stream:getPreview", () => (streamer ? streamer.getPreview() : null));
ipcMain.on("stream:ready", (_e, r) => { if (streamer) streamer.ready(r); });
ipcMain.on("stream:chunk", (_e, gen, buf) => { if (streamer) streamer.chunk(gen, buf); });
ipcMain.on("stream:preview", (_e, d) => { if (streamer) streamer.preview(d); });
ipcMain.handle("update:check", async () => {
  if (!updater) return { state: app.isPackaged ? "error" : "dev" };
  try { await updater.checkForUpdates(); return { state: "checking" }; } catch (e) { return { state: "error", message: String(e.message || e) }; }
});
ipcMain.handle("update:install", () => { if (updater) updater.quitAndInstall(false, true); });

app.on("second-instance", () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(() => {
  try { ensureDirs(); } catch {}
  createWindow();
  initUpdater();
  botUse(botsLoad().list[0].id);
  /* telecamere, microfono e cattura di finestre: solo per le pagine del programma */
  const own = (u) => String(u || "").startsWith("file://");
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(own(wc.getURL()) && (perm === "media" || perm === "display-capture")));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => own(wc ? wc.getURL() : origin) && (perm === "media" || perm === "display-capture"));
  streamer = createStreamer({
    file: path.join(app.getPath("userData"), "stream.json"),
    logFile: path.join(ROOT, "diretta-ffmpeg.log"),
    saveDir: DIRS.dirette,
    webPreferences,
    getMain: () => win,
    getWall: () => new Promise((res) => { const had = !!wall; const w = openWall(); if (had) return res(w); w.webContents.once("did-finish-load", () => setTimeout(() => res(w), 1200)); }),
    onStatus: (s) => { if (win) win.webContents.send("stream", s); },
    onLive: (links) => { if (bot) bot.liveStarted(links); },
    onEnd: () => { if (bot) bot.liveEnded(); }
  });
  bot.setStreamer(streamer);
});
app.on("before-quit", () => { if (bot) bot.stop(); if (streamer) streamer.dispose(); });
app.on("window-all-closed", () => app.quit());
