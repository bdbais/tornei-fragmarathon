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
ipcMain.handle("wall:open", () => { openWall(); return true; });
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
/* Sala: ping delle postazioni (IP o nome del PC). Un "ping -n 1" per indirizzo, 16 alla volta, senza shell. */
function pingOne(host) {
  return new Promise((res) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$/.test(host)) return res({ ok: false, err: "indirizzo non valido" });
    const win = process.platform === "win32", args = win ? ["-n", "1", "-w", "900", host] : ["-c", "1", "-W", "1", host];
    require("child_process").execFile("ping", args, { timeout: 4000, windowsHide: true, encoding: "latin1" }, (err, out) => {
      out = String(out || "");
      const ok = /TTL=/i.test(out) || (!win && !err && /bytes from/i.test(out)), m = /[=<]\s?(\d+(?:[.,]\d+)?)\s?ms/i.exec(out);
      res({ ok, ms: ok && m ? Math.round(parseFloat(m[1].replace(",", "."))) : null });
    });
  });
}
ipcMain.handle("sala:ping", async (_e, hosts) => {
  const list = [...new Set((Array.isArray(hosts) ? hosts : []).map(String).filter(Boolean))].slice(0, 512), out = {};
  for (let i = 0; i < list.length; i += 16) {
    const part = list.slice(i, i + 16), r = await Promise.all(part.map(pingOne));
    part.forEach((h, j) => { out[h] = r[j]; });
  }
  return out;
});
/* elenco giocatori da Google Sheets: solo l'esportazione CSV di un foglio condiviso con il link */
ipcMain.handle("sheets:fetch", async (_e, url) => {
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]{20,}\/export\?format=csv(&gid=\d+)?$/.test(String(url || ""))) return { error: "link non valido" };
  try {
    const r = await require("electron").net.fetch(url, { redirect: "follow" });
    const t = await r.text();
    if (!r.ok || /^\s*<(!doctype|html)/i.test(t)) return { error: "il foglio non è condiviso con chiunque abbia il link" };
    return { text: t.slice(0, 2000000) };
  } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
});
ipcMain.handle("ev:write", (_e, id, data) => { ensureDirs(); JSON.parse(data); writeAtomic(evFile(id), data); return true; });
ipcMain.handle("ev:trash", (_e, id) => {
  const f = evFile(id); if (!fs.existsSync(f)) return false;
  fs.mkdirSync(DIRS.cestino, { recursive: true });
  fs.renameSync(f, path.join(DIRS.cestino, stamp() + "_" + id + ".json")); return true;
});
/* "Annulla cancellazione": riporta dal cestino l'ultima copia di quel torneo */
ipcMain.handle("ev:untrash", (_e, id) => {
  const f = evFile(id); if (fs.existsSync(f) || !fs.existsSync(DIRS.cestino)) return false;
  const c = fs.readdirSync(DIRS.cestino).filter((x) => x.endsWith("_" + id + ".json")).sort().pop(); if (!c) return false;
  fs.renameSync(path.join(DIRS.cestino, c), f); return true;
});

/* Bot Telegram: girano qui, con i dati che la pagina manda già calcolati.
   Si possono avere più bot (ognuno col suo file: token, ruoli, iscritti, impostazioni). Tutti quelli
   accesi partono con il programma; ognuno risponde per tutti i tornei che lo hanno scelto, anche se
   non sono aperti. Le impostazioni della pagina valgono per il bot del torneo aperto ("selezionato"). */
const bots = {};
let selId = "", lastBotDel = null, lastEvents = [];
const pngOwner = {};
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
    onPng: (r) => { pngOwner[r.id] = entry.id; toPage({ type: "png", id: r.id, k: r.k }); },
    onChange: () => {
      toPage({ type: "status", bot: entry.id });
      const u = b.status().username; if (u) { const L = botsLoad(), x = L.list.find((y) => y.id === entry.id); if (x && x.username !== u) { x.username = u; botsSave(L); } }
    },
    /* rete di Chromium: rispetta proxy e certificati di sistema (il fetch di Node no) */
    fetch: (url, o) => require("electron").net.fetch(url, o)
  });
  if (streamer) b.setStreamer(streamer);
  return b;
}
function botStart(entry) {
  if (bots[entry.id]) return bots[entry.id];
  const b = (bots[entry.id] = makeBot(entry));
  b.start().catch(() => {});
  return b;
}
function botsStartAll() { const L = botsLoad(); L.list.forEach(botStart); if (!bots[selId]) selId = L.list[0].id; distribute(); }
const selBot = () => bots[selId] || null;
/* Un bot che serve più tornei vede un solo elenco: i giochi di tutti, con la chiave "torneo:gioco". */
function mergeVM(parts) {
  if (!parts.length) return null;
  const multi = parts.length > 1, vis = parts.filter((p) => !p.vm.draft), head = (vis[0] || parts[0]).vm, T = [];
  parts.forEach((p) => (p.vm.tournaments || []).forEach((t) => T.push(Object.assign({}, t, {
    k: p.id + ":" + t.k, ev: p.id, draft: !!(t.draft || p.vm.draft),
    name: multi ? [t.name, p.vm.title].filter(Boolean).join(" – ") : t.name
  }))));
  return {
    title: multi ? (vis.length ? vis : parts).map((p) => p.vm.title).join(", ") : head.title, sub: multi ? "" : head.sub,
    draft: parts.every((p) => p.vm.draft), roster: [...new Set([].concat(...parts.map((p) => p.vm.roster || [])))],
    tournaments: T, hof: head.hof, links: head.links || {}, lang: head.lang || "it",
    /* la sala: del primo torneo che ne ha una */
    sala: (parts.filter((p) => p.vm.sala)[0] || {}).vm ? (parts.filter((p) => p.vm.sala)[0]).vm.sala : null, salaEv: (parts.filter((p) => p.vm.sala)[0] || {}).id || ""
  };
}
function distribute() {
  const L = botsLoad(), ids = L.list.map((e) => e.id), def = ids[0];
  L.list.forEach((e) => {
    const b = bots[e.id]; if (!b) return;
    b.setVM(mergeVM(lastEvents.filter((ev) => ((ev.bot && ids.includes(ev.bot)) ? ev.bot : def) === e.id)));
  });
}
function botsInfo() {
  const L = botsLoad();
  return L.list.map((e) => {
    const st = bots[e.id] ? bots[e.id].status() : {};
    return { id: e.id, label: e.label, color: e.color || "", username: st.username || e.username || "", hasToken: !!st.hasToken, enabled: !!st.enabled,
      people: st.chats || 0, pending: (st.pending || []).length, active: e.id === selId, running: !!st.running, err: st.lastErr || "" };
  });
}
ipcMain.handle("bots:list", () => botsInfo());
/* il torneo aperto sceglie quale bot si configura dalle impostazioni; gli altri restano accesi */
ipcMain.handle("bots:use", (_e, id) => { const L = botsLoad(); selId = (L.list.find((x) => x.id === id) || L.list[0]).id; return botsInfo(); });
ipcMain.handle("bots:enable", async (_e, id, on) => { if (bots[id]) await bots[id].configure({ enabled: !!on }); return botsInfo(); });
ipcMain.handle("bots:add", (_e, label) => {
  const L = botsLoad(), id = "b" + Date.now().toString(36), e = { id, label: String(label || "Nuovo bot").slice(0, 60), file: "telegram-" + id + ".json" };
  L.list.push(e); botsSave(L); botStart(e); return id;
});
ipcMain.handle("bots:edit", (_e, id, o) => {
  const L = botsLoad(), e = L.list.find((x) => x.id === id); if (!e) return botsInfo();
  if (o && typeof o.label === "string" && o.label.trim()) e.label = o.label.trim().slice(0, 60);
  if (o && typeof o.color === "string" && /^(#[0-9a-f]{6})?$/i.test(o.color)) e.color = o.color;
  botsSave(L); return botsInfo();
});
/* Togliere un bot sposta il suo file tra i dati dell'app ("bot-rimossi"): contiene il token, non va nei Documenti. */
ipcMain.handle("bots:undoRemove", () => {
  if (!lastBotDel) return botsInfo();
  const L = botsLoad(); L.list.push(lastBotDel.entry); botsSave(L);
  try { if (fs.existsSync(lastBotDel.moved)) fs.renameSync(lastBotDel.moved, botPath(lastBotDel.entry)); } catch {}
  botStart(lastBotDel.entry); lastBotDel = null; distribute(); return botsInfo();
});
/* backup completo: elenco e file dei bot (con i token: il backup che li contiene è sempre cifrato) */
ipcMain.handle("bots:export", () => {
  const L = botsLoad(), files = {};
  L.list.forEach((e) => { try { files[e.id] = fs.readFileSync(botPath(e), "utf8"); } catch {} });
  return { list: L.list, files };
});
ipcMain.handle("bots:import", (_e, p) => {
  if (!p || !Array.isArray(p.list)) return botsInfo();
  const L = botsLoad(), dir = path.join(app.getPath("userData"), "bot-rimossi");
  p.list.forEach((e) => {
    if (!e || !/^b[a-z0-9]{0,20}$/.test(String(e.id)) || !/^telegram(-[a-z0-9]+)?\.json$/.test(String(e.file))) return;
    const txt = p.files && p.files[e.id]; if (typeof txt !== "string") return;
    try { JSON.parse(txt); } catch { return; }
    if (bots[e.id]) { bots[e.id].stop(); delete bots[e.id]; }
    const entry = { id: e.id, label: String(e.label || "Bot").slice(0, 60), file: e.file, color: e.color || "", username: e.username || "" };
    if (fs.existsSync(botPath(entry))) { fs.mkdirSync(dir, { recursive: true }); try { fs.renameSync(botPath(entry), path.join(dir, stamp() + "_" + entry.file)); } catch {} }
    writeAtomic(botPath(entry), txt);
    const i = L.list.findIndex((x) => x.id === entry.id); if (i >= 0) L.list[i] = entry; else L.list.push(entry);
  });
  botsSave(L); L.list.forEach(botStart); distribute(); return botsInfo();
});
ipcMain.handle("bots:remove", (_e, id) => {
  const L = botsLoad(); if (L.list.length < 2) return botsInfo();
  const e = L.list.find((x) => x.id === id); if (!e) return botsInfo();
  if (bots[id]) { bots[id].stop(); delete bots[id]; }
  L.list = L.list.filter((x) => x !== e); botsSave(L);
  const dir = path.join(app.getPath("userData"), "bot-rimossi"); fs.mkdirSync(dir, { recursive: true });
  const moved = path.join(dir, stamp() + "_" + path.basename(e.file));
  try { fs.renameSync(botPath(e), moved); } catch {}
  lastBotDel = { entry: e, moved };
  if (selId === id) selId = L.list[0].id;
  distribute(); return botsInfo();
});
function toPage(msg) { if (win) win.webContents.send("bot", msg); }
/* la pagina manda la vista di ogni torneo: { events: [{ id, bot, vm }] } */
ipcMain.handle("bot:state", (_e, s) => { lastEvents = (s && Array.isArray(s.events) ? s.events : []).filter((x) => x && x.id && x.vm); distribute(); });
ipcMain.handle("bot:status", () => { const b = selBot(); return b ? b.status() : null; });
ipcMain.handle("bot:config", (_e, c) => { const b = selBot(); return b ? b.configure(c) : null; });
ipcMain.handle("bot:decide", (_e, id, ok) => { const b = selBot(); return b ? b.decide(id, ok) : false; });
ipcMain.handle("bot:png", (_e, id, data) => { const b = bots[pngOwner[id]] || selBot(); delete pngOwner[id]; if (b) b.pngReply(id, data); });
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
    /* la diretta è del torneo aperto: la annuncia il suo bot */
    onLive: (links) => { const b = selBot(); if (b) b.liveStarted(links); },
    onEnd: () => { Object.values(bots).forEach((b) => b.liveEnded()); }
  });
  botsStartAll();
});
app.on("before-quit", () => { Object.values(bots).forEach((b) => b.stop()); if (streamer) streamer.dispose(); });
app.on("window-all-closed", () => app.quit());
