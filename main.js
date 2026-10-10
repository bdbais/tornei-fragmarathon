const { app, BrowserWindow, shell, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const AI = require("./js/ai.js");

if (!app.requestSingleInstanceLock()) app.quit();

/* Cartelle dei dati: create al primo avvio, senza configurazione. */
const ROOT = path.join(app.getPath("documents"), "Tornei Fragmarathon");
const DIRS = { tornei: path.join(ROOT, "tornei"), backup: path.join(ROOT, "backup") };
const MAX_BACKUPS = 200;
function ensureDirs() { Object.values(DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true })); }

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
  win.on("closed", () => { win = null; if (wall) wall.close(); });
  win.loadFile(path.join(__dirname, "index.html"));
}

/* ---- schermo proiettore: secondo monitor se c'è, a tutto schermo ---- */
function openWall() {
  if (wall) { wall.show(); wall.focus(); return; }
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
});
app.on("window-all-closed", () => app.quit());
