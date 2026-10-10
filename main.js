const { app, BrowserWindow, shell, ipcMain, screen, session } = require("electron");
const path = require("path");
const fs = require("fs");
const AI = require("./js/ai.js");
const createBot = require("./bot.js");
const createStreamer = require("./streamer.js");

if (!app.requestSingleInstanceLock()) app.quit();

/* Cartelle dei dati: create al primo avvio, senza configurazione. */
const ROOT = path.join(app.getPath("documents"), "Tornei Fragmarathon");
const DIRS = { tornei: path.join(ROOT, "tornei"), backup: path.join(ROOT, "backup"), dirette: path.join(ROOT, "dirette") };
const MAX_BACKUPS = 200;
function ensureDirs() { [DIRS.tornei, DIRS.backup].forEach((d) => fs.mkdirSync(d, { recursive: true })); }

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
/* Bot Telegram: gira qui, con i dati che la pagina gli manda già calcolati. */
let bot = null;
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
  bot = createBot({
    file: path.join(app.getPath("userData"), "telegram.json"),
    onJoin: (req) => toPage({ type: "join", name: req.name, k: req.k }),
    onPng: (r) => toPage({ type: "png", id: r.id, k: r.k }),
    onChange: () => toPage({ type: "status" }),
    /* rete di Chromium: rispetta proxy e certificati di sistema (il fetch di Node no) */
    fetch: (url, o) => require("electron").net.fetch(url, o)
  });
  bot.start().catch(() => {});
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
