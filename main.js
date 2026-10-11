const { app, BrowserWindow, shell, ipcMain, screen, session } = require("electron");
const path = require("path");
const fs = require("fs");
const AI = require("./js/ai.js");
const createBot = require("./bot.js");
const createDiscord = require("./discord.js");
const createStreamer = require("./streamer.js");

/* Un solo programma aperto. Dopo un aggiornamento il nuovo programma parte mentre il vecchio si sta
   ancora chiudendo: in quel caso aspetta che si liberi il posto invece di chiudersi subito. */
let LOCKED = app.requestSingleInstanceLock();
const UPDATED = process.argv.includes("--updated");
if (!LOCKED && !UPDATED) app.exit(0);

/* Cartelle dei dati: create al primo avvio, senza configurazione. */
/* TORNEI_DIR: cartella dati diversa (test automatici), così non si tocca quella vera nei Documenti */
const ROOT = process.env.TORNEI_DIR || path.join(app.getPath("documents"), "Tornei Fragmarathon");
/* Registro degli errori: un errore imprevisto non chiude più il programma, finisce in errori.log */
function logErr(where, e) {
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    const f = path.join(ROOT, "errori.log");
    try { if (fs.statSync(f).size > 2e6) fs.renameSync(f, f + ".old"); } catch {}
    fs.appendFileSync(f, new Date().toISOString() + " [" + app.getVersion() + "] " + where + ": " + String((e && e.stack) || e).slice(0, 4000) + "\n");
  } catch {}
}
process.on("uncaughtException", (e) => logErr("processo principale", e));
process.on("unhandledRejection", (e) => logErr("processo principale (promessa)", e));
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
/* Su Windows il rename fallisce per un attimo (EPERM/EBUSY) se OneDrive o l'antivirus hanno il file aperto:
   si riprova per circa mezzo secondo, poi si rinuncia senza lasciare il .tmp */
function writeAtomic(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, data, "utf8");
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (e) {
      if (i >= 8 || !/^(EPERM|EACCES|EBUSY)$/.test(e && e.code)) { try { fs.unlinkSync(tmp); } catch {} throw e; }
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60); } catch { const t = Date.now() + 60; while (Date.now() < t); }
    }
  }
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
    if (/^https?:\/\//i.test(url) || /^ts3server:\/\/[\w.\-\[\]:]+(\?[\w=&%.\-]*)?$/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url) || /^ts3server:\/\/[\w.\-\[\]:]+(\?[\w=&%.\-]*)?$/i.test(url)) shell.openExternal(url);
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
/* "Cerca sul PC": il servizio di immagini risponde a quell'indirizzo? (dalla pagina il CORS lo impedirebbe) */
ipcMain.handle("ai:probe", async (_e, base, prov) => {
  try {
    const u = String(base || "").trim().replace(/\/+$/, ""); if (!/^https?:\/\/[^\s]+$/i.test(u)) return false;
    const r = await fetch(u + (prov === "a1111" ? "/sdapi/v1/options" : "/models"), { signal: AbortSignal.timeout(2500) });
    if (r.body) r.body.cancel().catch(() => {});
    return r.ok;
  } catch { return false; }
});
/* Elenco dei tornei (uno per file in "eventi"): la pagina lavora su una copia e la salva qui.
   Eliminare un torneo lo sposta in "cestino", da cui si può recuperare a mano. */
/* anche maiuscole e trattini bassi: un file ripreso a mano dal cestino ("<data>_<id>.json") si apre; punti e separatori restano vietati */
const evFile = (id) => { if (!/^[A-Za-z0-9_-]{4,80}$/.test(String(id || ""))) throw new Error("Torneo non valido"); return path.join(DIRS.eventi, id + ".json"); };
ipcMain.handle("ev:list", () => {
  ensureDirs();
  /* solo i file che evFile sa aprire (un nome con spazi o punti, tipo "copia (2).json", darebbe errore) */
  return listJson(DIRS.eventi).filter((f) => /^[A-Za-z0-9_-]{4,80}\.json$/i.test(f.file)).map((f) => {
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
    onJoin: (req) => toPage({ type: "join", name: req.name, k: req.k, discord: req.discord || "" }),
    onDiscord: (r) => toPage({ type: "discord", name: r.name, account: r.account, evs: r.evs }),
    onPng: (r) => { pngOwner[r.id] = entry.id; toPage({ type: "png", id: r.id, k: r.k }); },
    /* la pagina mostra il bot selezionato: gli altri la aggiornano solo quando cambia il nome (@username) nell'elenco dei bot */
    onChange: () => {
      let named = false;
      const u = b.status().username; if (u) { const L = botsLoad(), x = L.list.find((y) => y.id === entry.id); if (x && x.username !== u) { x.username = u; botsSave(L); named = true; } }
      if (entry.id === selId || named) toPage({ type: "status", bot: entry.id });
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
  /* torna al suo posto: il primo bot dell'elenco è quello predefinito dei tornei senza un bot scelto */
  const L = botsLoad(), d = lastBotDel;
  /* nel frattempo un ripristino ha rimesso lo stesso bot: non si sovrascrive */
  if (L.list.some((x) => x.id === d.entry.id)) { lastBotDel = null; return botsInfo(); }
  L.list.splice(Math.min(d.index >= 0 ? d.index : L.list.length, L.list.length), 0, d.entry);
  botsSave(L);
  try { if (fs.existsSync(d.moved)) fs.renameSync(d.moved, botPath(d.entry)); } catch {}
  botStart(d.entry); if (d.sel) selId = d.entry.id; lastBotDel = null; distribute(); return botsInfo();
});
/* backup completo: elenco e file dei bot (con i token: il backup che li contiene è sempre cifrato) */
ipcMain.handle("bots:export", () => {
  const L = botsLoad(), files = {};
  L.list.forEach((e) => { try { files[e.id] = fs.readFileSync(botPath(e), "utf8"); } catch {} });
  return { list: L.list, files };
});
/* Stile da un sito: la pagina si apre in una finestra nascosta e isolata (sessione solo in memoria, nessun permesso,
   niente download né finestre), si leggono colori e caratteri calcolati, poi la finestra si chiude. I file dei caratteri
   si scaricano qui (niente CORS) e tornano alla pagina come data: con limiti di dimensione. */
const PROBE_JS = `(() => {
  const cs = (el) => getComputedStyle(el);
  const clear = (c) => !c || c === "transparent" || /rgba\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(c);
  const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight * 3; };
  const first = (sel) => { try { return [...document.querySelectorAll(sel)].find(vis) || null; } catch (e) { return null; } };
  const bgOf = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = cs(e).backgroundColor; if (!clear(c)) return c; } return "rgb(255, 255, 255)"; };
  const body = document.body || document.documentElement, main = first("main, [role=main], article, #content, .content") || body;
  const header = first("header, [role=banner], .navbar, nav, #header, .header");
  const h = first("h1") || first("h2") || first("h3"), p = first("main p, article p, p") || main;
  const link = [...document.querySelectorAll("main a, article a, a")].filter(vis).find((a) => a.textContent.trim().length > 2 && !a.querySelector("img"));
  const btn = [...document.querySelectorAll("button, .btn, .button, a[class*=btn], a[class*=button], input[type=submit], [role=button]")].filter(vis).find((b) => !clear(cs(b).backgroundColor));
  const freq = {}; let n = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (++n > 1500) break; if (!vis(el)) continue; const s = cs(el);
    if (!clear(s.backgroundColor)) freq[s.backgroundColor] = (freq[s.backgroundColor] || 0) + 3;
    if (parseFloat(s.borderTopWidth) > 0 && !clear(s.borderTopColor)) freq[s.borderTopColor] = (freq[s.borderTopColor] || 0) + 2;
    if (!clear(s.color)) freq[s.color] = (freq[s.color] || 0) + 1;
  }
  const rs = cs(document.documentElement), vars = {}, faces = [];
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch (e) { continue; }
    for (const r of rules || []) {
      if (r.type === 5) faces.push({ family: r.style.getPropertyValue("font-family"), src: r.style.getPropertyValue("src"), weight: r.style.getPropertyValue("font-weight"), style: r.style.getPropertyValue("font-style"), base: sh.href || location.href });
      else if (r.selectorText && /(^|,)\\s*(:root|html)\\s*(,|$)/.test(r.selectorText)) for (const k of r.style) if (k.startsWith("--") && Object.keys(vars).length < 120) vars[k] = rs.getPropertyValue(k).trim().slice(0, 80);
    }
  }
  const sheets = [...document.querySelectorAll('link[rel~="stylesheet"]')].map((l) => l.href).filter((u) => /^https?:/.test(u)).slice(0, 12);
  return { title: (document.title || "").slice(0, 120), url: location.href, page: bgOf(body), bg: bgOf(main), ink: cs(p).color, font: cs(p).fontFamily,
    header: header ? { bg: bgOf(header), ink: cs(header).color } : null, heading: h ? { ink: cs(h).color, font: cs(h).fontFamily, weight: cs(h).fontWeight } : null,
    link: link ? cs(link).color : null, button: btn ? { bg: cs(btn).backgroundColor, ink: cs(btn).color } : null,
    freq: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 24), vars, sheets, faces: faces.slice(0, 60) };
})()`;
const GENERIC_FONTS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|helvetica neue|roboto|georgia|times|times new roman|verdana|tahoma|trebuchet ms|courier new|calibri|cambria|consolas|inter|noto sans|ubuntu|cantarell|open sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji)$/i;
function famName(f) { return String(f || "").split(",")[0].trim().replace(/^["']|["']$/g, "").trim(); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function withTimeout(p, ms, msg) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })]).finally(() => clearTimeout(t)); }
/* Scaricamento con limiti veri: tempo massimo anche per il corpo della risposta (non solo per le intestazioni) e
   dimensione massima letta a pezzi, così un sito lento o un file enorme non bloccano né riempiono la memoria.
   cut: oltre il limite si tiene l'inizio (fogli di stile) invece di rinunciare (caratteri). Solo http e https. */
async function fetchCapped(ses, url, max, ms, cut) {
  if (!/^https?:\/\//i.test(String(url))) return null;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  const run = async () => {
    const res = await ses.fetch(url, { signal: ac.signal, credentials: "omit" });
    if (!res.ok || !res.body) return null;
    if (!cut && +res.headers.get("content-length") > max) return null;
    const rd = res.body.getReader(), parts = []; let n = 0;
    try {
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        n += value.length; parts.push(Buffer.from(value));
        if (n > max) { if (!cut) return null; break; }
      }
    } finally { try { rd.cancel().catch(() => {}); } catch {} }
    const buf = Buffer.concat(parts); return cut ? buf.subarray(0, max) : buf;
  };
  try { return await withTimeout(run(), ms + 500, "tempo scaduto"); }
  finally { clearTimeout(t); ac.abort(); }
}
/* @font-face dai fogli di stile (anche di altri domini, letti qui) per i caratteri usati da titoli e testo */
async function siteFonts(r, ses) {
  const want = [famName(r.heading && r.heading.font), famName(r.font)].filter((f, i, a) => f && !GENERIC_FONTS.test(f) && a.indexOf(f) === i);
  if (!want.length) return [];
  const until = Date.now() + 25000, wantL = want.map((f) => f.toLowerCase());
  let faces = (Array.isArray(r.faces) ? r.faces : []).filter((f) => f && typeof f === "object").slice(0, 60);
  for (const href of (Array.isArray(r.sheets) ? r.sheets : []).slice(0, 12)) {
    if (faces.some((f) => wantL.includes(famName(f.family).toLowerCase())) || Date.now() > until) break;
    try {
      const buf = await fetchCapped(ses, href, 2000000, 8000, true); if (!buf) continue;
      const txt = buf.toString("utf8");
      (txt.match(/@font-face\s*{[^}]*}/gi) || []).slice(0, 200).forEach((b) => {
        const g = (k) => { const m = new RegExp(k + "\\s*:\\s*([^;}]+)", "i").exec(b); return m ? m[1].trim() : ""; };
        faces.push({ family: g("font-family"), src: g("src"), weight: g("font-weight"), style: g("font-style"), base: href });
      });
    } catch {}
  }
  const out = []; let total = 0;
  for (const fam of want) {
    const mine = faces.filter((f) => famName(f.family).toLowerCase() === fam.toLowerCase() && !/italic/i.test(f.style || ""));
    const target = fam === famName(r.heading && r.heading.font) ? parseInt((r.heading && r.heading.weight) || "700", 10) : 400;
    mine.sort((a, b) => Math.abs((parseInt(a.weight, 10) || 400) - target) - Math.abs((parseInt(b.weight, 10) || 400) - target));
    for (const f of mine.slice(0, 1)) {
      const urls = []; String(f.src || "").replace(/url\(\s*["']?([^"')]+)["']?\s*\)\s*(?:format\(\s*["']?([\w-]+)["']?\s*\))?/gi, (_, u, fmt) => { urls.push({ u, fmt: (fmt || "").toLowerCase() }); return ""; });
      const rank = (x) => (/woff2/.test(x.fmt) || /\.woff2(\?|$)/i.test(x.u) ? 0 : /woff/.test(x.fmt) || /\.woff(\?|$)/i.test(x.u) ? 1 : /truetype|opentype/.test(x.fmt) || /\.(ttf|otf)(\?|$)/i.test(x.u) ? 2 : 9);
      urls.sort((a, b) => rank(a) - rank(b));
      const pick = urls.find((x) => rank(x) < 9); if (!pick) continue;
      try {
        if (Date.now() > until) break;
        const abs = new URL(pick.u, String(f.base || "")).href; if (!/^https?:/i.test(abs)) continue;
        const buf = await fetchCapped(ses, abs, 110 * 1024, 10000, false);
        if (!buf || !buf.length || total + buf.length > 200 * 1024) continue;
        total += buf.length;
        const fmt = ["woff2", "woff", "truetype"][rank(pick)] || "truetype", mime = { woff2: "font/woff2", woff: "font/woff", truetype: "font/ttf" }[fmt];
        out.push({ family: fam, weight: (/^\d{3}$/.exec(String(f.weight || "400").split(" ")[0]) || ["400"])[0], fmt, data: "data:" + mime + ";base64," + buf.toString("base64") });
      } catch {}
    }
  }
  return out;
}
/* Il risultato viene dalla pagina del sito, che può falsificarlo: alla pagina del programma torna solo ciò che ha la forma
   attesa (colori, nomi di caratteri, variabili CSS senza url() né caratteri che escono da una regola). */
const P_COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([0-9a-z.,%\s\/+-]{1,90}\))$/i;
const pColor = (c) => (typeof c === "string" && P_COLOR.test(c.trim()) ? c.trim() : null);
const pText = (s, n) => (typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").slice(0, n) : "");
const pFont = (s) => (typeof s === "string" ? s.replace(/[^\p{L}\p{N} ,'"._-]/gu, "").slice(0, 200) : "");
function cleanProbe(r) {
  const o = (x) => x && typeof x === "object" ? x : null, h = o(r.header), hd = o(r.heading), b = o(r.button), vars = {};
  Object.keys(o(r.vars) || {}).slice(0, 120).forEach((k) => {
    const v = r.vars[k];
    if (/^--[\w-]{1,60}$/.test(k) && typeof v === "string" && !/url\(|expression|@import|[<>{};\\]/i.test(v)) vars[k] = v.slice(0, 80);
  });
  const href = typeof r.url === "string" && /^https?:\/\//i.test(r.url) ? r.url.slice(0, 500) : "";
  return {
    title: pText(r.title, 120), url: href, page: pColor(r.page), bg: pColor(r.bg), ink: pColor(r.ink), font: pFont(r.font),
    header: h ? { bg: pColor(h.bg), ink: pColor(h.ink) } : null,
    heading: hd ? { ink: pColor(hd.ink), font: pFont(hd.font), weight: (/^\d{3}$/.exec(String(hd.weight)) || ["700"])[0] } : null,
    link: pColor(r.link), button: b ? { bg: pColor(b.bg), ink: pColor(b.ink) } : null,
    freq: (Array.isArray(r.freq) ? r.freq : []).filter((x) => Array.isArray(x) && pColor(x[0]) && isFinite(x[1])).slice(0, 24).map((x) => [pColor(x[0]), +x[1]]),
    vars, sheets: (Array.isArray(r.sheets) ? r.sheets : []).filter((u) => typeof u === "string" && /^https?:\/\//i.test(u)).slice(0, 12),
    faces: (Array.isArray(r.faces) ? r.faces : []).filter((f) => f && typeof f === "object").slice(0, 60).map((f) => ({ family: String(f.family || "").slice(0, 200), src: String(f.src || "").slice(0, 4000), weight: String(f.weight || "").slice(0, 20), style: String(f.style || "").slice(0, 20), base: String(f.base || "").slice(0, 500) }))
  };
}
/* sessione della finestra nascosta: solo in memoria, creata una volta, svuotata dopo ogni lettura */
let probeSes = null;
function probeSession() {
  if (probeSes) return probeSes;
  probeSes = session.fromPartition("probe", { cache: false });
  probeSes.setPermissionRequestHandler((_wc, _p, cb) => cb(false)); probeSes.setPermissionCheckHandler(() => false);
  probeSes.on("will-download", (ev, item) => { try { item.cancel(); } catch {} ev.preventDefault(); });
  return probeSes;
}
let probing = false;
ipcMain.handle("css:probe", async (_e, raw) => {
  let url = String(raw || "").trim().slice(0, 500); if (!url) return { err: "Scrivi l'indirizzo del sito." };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let u; try { u = new URL(url); } catch { return { err: "Indirizzo del sito non valido." }; }
  if (!/^https?:$/.test(u.protocol)) return { err: "Indirizzo del sito non valido." };
  if (probing) return { err: "Sto già leggendo un sito: aspetta qualche secondo." };
  probing = true;
  let w = null, ses = null;
  try {
    ses = probeSession();
    /* finestre di dialogo (alert, confirm) disattivate: una finestra nascosta non deve far comparire nulla */
    w = new BrowserWindow({ show: false, width: 1366, height: 900, webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, webgl: false, spellcheck: false, disableDialogs: true, autoplayPolicy: "document-user-activation-required" } });
    w.webContents.setAudioMuted(true);
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    w.webContents.on("will-navigate", (ev, nu) => { if (!/^https?:/i.test(nu)) ev.preventDefault(); });
    w.webContents.on("will-redirect", (ev, nu) => { if (!/^https?:/i.test(nu)) ev.preventDefault(); });
    try { await withTimeout(w.loadURL(u.href), 20000, "Il sito non risponde (20 secondi)."); }
    catch (e) { if (!/ERR_ABORTED|-3\b/.test(String(e && e.message)) || !w.webContents.getURL()) throw e; }
    await wait(1500);
    const raw = await withTimeout(w.webContents.executeJavaScript(PROBE_JS, true), 8000, "Il sito non si lascia leggere.");
    if (!raw || typeof raw !== "object") throw new Error("Il sito non si lascia leggere.");
    /* la pagina del sito non serve più: si chiude subito, mentre si scaricano i caratteri */
    try { w.destroy(); } catch {} w = null;
    const r = cleanProbe(raw);
    r.fonts = await siteFonts(r, ses).catch(() => []);
    delete r.faces; delete r.sheets;
    return r;
  } catch (e) {
    const m = String((e && e.message) || e);
    logErr("stile da un sito", u.href + ": " + m);
    return { err: /ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_CONNECTION|ERR_ADDRESS/.test(m) ? "Non raggiungo " + u.hostname + ": controlla l'indirizzo e la connessione." : /ERR_CERT/.test(m) ? "Il certificato di " + u.hostname + " non è valido." : /secondi|leggere/.test(m) ? m : "Non riesco a leggere lo stile di " + u.hostname + "." };
  } finally {
    try { if (w) w.destroy(); } catch {}
    if (ses) { ses.clearStorageData().catch(() => {}); ses.clearAuthCache().catch(() => {}); }
    probing = false;
  }
});
/* Discord: un solo bot per tutta l'app (token in userData/discord.json); il torneo sceglie il server */
let discord = null;
function DC() { return discord || (discord = createDiscord({ dir: app.getPath("userData"), fetch: (u, o) => require("electron").net.fetch(u, o), log: logErr })); }
ipcMain.handle("discord:status", () => DC().status());
ipcMain.handle("discord:config", (_e, c) => DC().configure(c || {}));
ipcMain.handle("discord:check", () => DC().check());
ipcMain.handle("discord:sync", (_e, d) => DC().sync(d));
ipcMain.handle("discord:lookup", (_e, g, a) => DC().lookup(String(g || ""), Array.isArray(a) ? a.slice(0, 500).map(String) : []));
ipcMain.handle("discord:clear", (_e, id) => DC().clear(String(id || "")));
ipcMain.handle("discord:invite", (_e, g) => DC().invite(String(g || "")));
/* Torneo eliminato e programma chiuso prima dei 60 secondi per annullare: la pagina non ha tolto i suoi canali Discord.
   All'avvio si tolgono, solo per i tornei che sono nel cestino (eliminati da qui, non quelli rovinati) e non più in "eventi",
   nemmeno ripresi a mano con la data davanti al nome. Il nome del file dei canali è quello di discord.js (solo a-z 0-9 -). */
function dcSweepTrash() {
  const dd = path.join(app.getPath("userData"), "discord-tornei"), key = (id) => String(id).replace(/[^a-z0-9-]/gi, "");
  if (!fs.existsSync(dd) || !fs.existsSync(DIRS.cestino) || !fs.existsSync(DIRS.eventi)) return;
  const live = () => fs.readdirSync(DIRS.eventi).filter((f) => /\.json$/i.test(f)).map((f) => key(f.replace(/\.json$/i, "")));
  const gone = new Set(fs.readdirSync(DIRS.cestino).map((f) => /^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_([A-Za-z0-9_-]{4,80})\.json$/.exec(f)).filter((m) => m && !/^rovinato_/.test(m[1])).map((m) => key(m[1])));
  const todo = fs.readdirSync(dd).filter((f) => /^[a-z0-9-]+\.json$/i.test(f)).map((f) => f.replace(/\.json$/i, "")).filter((k) => gone.has(k)).filter((k) => {
    try { const st = JSON.parse(fs.readFileSync(path.join(dd, k + ".json"), "utf8")); return Object.keys(st.ch || {}).length || Object.keys(st.cats || {}).length; } catch { return false; }
  });
  if (!todo.length || !DC().status().hasToken) return;
  (async () => {
    for (const k of todo) {
      /* ricontrollato ogni volta: nel frattempo la pagina può averlo ripristinato da un backup */
      if (live().some((x) => x === k || x.endsWith(k))) continue;
      const r = await DC().clear(k);
      logErr("discord", "canali del torneo eliminato " + k + (r && r.err ? " non tolti: " + r.err : " tolti (" + (r || 0) + ")"));
    }
  })().catch((e) => logErr("discord pulizia", e));
}
/* ripristino dei bot da un backup: quelli sostituiti vanno in bot-rimossi; il riepilogo dice cosa mancava
   (valore predefinito) e cosa cambia rispetto alla configurazione di prima */
ipcMain.handle("bots:import", (_e, p) => {
  const report = [];
  if (!p || !Array.isArray(p.list)) return { list: botsInfo(), report };
  const L = botsLoad(), dir = path.join(app.getPath("userData"), "bot-rimossi");
  p.list.forEach((e) => {
    const name = String((e && e.label) || "Bot").slice(0, 60);
    if (!e || !/^b[a-z0-9]{0,20}$/.test(String(e.id)) || !/^telegram(-[a-z0-9]+)?\.json$/.test(String(e.file))) { report.push({ label: name, status: "saltato", why: "voce non valida" }); return; }
    const txt = p.files && p.files[e.id]; if (typeof txt !== "string") { report.push({ label: name, status: "saltato", why: "configurazione mancante" }); return; }
    try { JSON.parse(txt); } catch { report.push({ label: name, status: "saltato", why: "configurazione illeggibile" }); return; }
    /* l'istanza vecchia non deve più riscrivere il suo file sopra quello ripristinato */
    if (bots[e.id]) { bots[e.id].dispose(); delete bots[e.id]; }
    const entry = { id: e.id, label: name, file: e.file, color: e.color || "", username: e.username || "" };
    let prev = null;
    if (fs.existsSync(botPath(entry))) {
      try { prev = fs.readFileSync(botPath(entry), "utf8"); } catch {}
      fs.mkdirSync(dir, { recursive: true }); try { fs.renameSync(botPath(entry), path.join(dir, stamp() + "_" + entry.file)); } catch {}
    }
    writeAtomic(botPath(entry), txt);
    const old = L.list.find((x) => x.id === entry.id);
    let r = { defaults: [], diffs: [] }; try { r = createBot.cfgReport(txt, prev); } catch (err) { logErr("ripristino bot", err); }
    if (old && old.label !== entry.label) r.diffs.unshift(["Nome", old.label, entry.label]);
    report.push({ label: name, status: old || prev ? "sostituito" : "nuovo", defaults: r.defaults, diffs: r.diffs });
    const i = L.list.findIndex((x) => x.id === entry.id); if (i >= 0) L.list[i] = entry; else L.list.push(entry);
  });
  botsSave(L); L.list.forEach(botStart); distribute();
  logErr("ripristino bot", report.map((x) => x.label + ": " + x.status + (x.why ? " (" + x.why + ")" : "") + (x.defaults && x.defaults.length ? ", " + x.defaults.length + " valori predefiniti" : "")).join("; ") || "nessuno");
  return { list: botsInfo(), report };
});
ipcMain.handle("bots:remove", (_e, id) => {
  const L = botsLoad(); if (L.list.length < 2) return botsInfo();
  const e = L.list.find((x) => x.id === id); if (!e) return botsInfo();
  if (bots[id]) { bots[id].dispose(); delete bots[id]; }
  const index = L.list.indexOf(e), sel = selId === id;
  L.list = L.list.filter((x) => x !== e); botsSave(L);
  const dir = path.join(app.getPath("userData"), "bot-rimossi"); fs.mkdirSync(dir, { recursive: true });
  const moved = path.join(dir, stamp() + "_" + path.basename(e.file));
  try { fs.renameSync(botPath(e), moved); } catch {}
  lastBotDel = { entry: e, moved, index, sel };
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
/* Primo avvio dopo un aggiornamento: controlla e migra le configurazioni, e lo scrive nel registro. */
function migrate() {
  const vf = path.join(app.getPath("userData"), "versione.json"), now = app.getVersion(), notes = [];
  let prev = ""; try { prev = JSON.parse(fs.readFileSync(vf, "utf8")).v || ""; } catch {}
  if (prev === now) return null;
  /* bot: elenco valido e file leggibili; quelli rovinati si mettono da parte e ripartono puliti */
  try {
    let L = null; try { L = JSON.parse(fs.readFileSync(BOTS_FILE, "utf8")); } catch {}
    if (L && (!Array.isArray(L.list) || !L.list.length)) { notes.push("elenco dei bot non valido: ricreato"); fs.renameSync(BOTS_FILE, BOTS_FILE + ".rovinato-" + stamp()); }
    botsLoad().list.forEach((e) => {
      const f = botPath(e); if (!fs.existsSync(f)) return;
      try { JSON.parse(fs.readFileSync(f, "utf8")); } catch { notes.push("configurazione del bot " + e.label + " illeggibile: messa da parte, il bot riparte vuoto"); fs.renameSync(f, f + ".rovinato-" + stamp()); }
    });
  } catch (e) { logErr("migrazione bot", e); }
  /* tornei: file leggibili */
  try {
    if (fs.existsSync(DIRS.eventi)) fs.readdirSync(DIRS.eventi).filter((f) => /\.json$/.test(f)).forEach((f) => {
      try { JSON.parse(fs.readFileSync(path.join(DIRS.eventi, f), "utf8")); } catch { notes.push("torneo " + f + " illeggibile: spostato nel cestino"); fs.mkdirSync(DIRS.cestino, { recursive: true }); fs.renameSync(path.join(DIRS.eventi, f), path.join(DIRS.cestino, stamp() + "_rovinato_" + f)); }
    });
  } catch (e) { logErr("migrazione tornei", e); }
  /* diretta: impostazioni leggibili */
  try { const sf = path.join(app.getPath("userData"), "stream.json"); if (fs.existsSync(sf)) JSON.parse(fs.readFileSync(sf, "utf8")); }
  catch { notes.push("impostazioni della diretta illeggibili: ripristinate"); try { fs.renameSync(path.join(app.getPath("userData"), "stream.json"), path.join(app.getPath("userData"), "stream.json.rovinato-" + stamp())); } catch {} }
  try { writeAtomic(vf, JSON.stringify({ v: now, prev, at: new Date().toISOString(), notes })); } catch {}
  logErr("aggiornamento", "da " + (prev || "versione precedente") + " a " + now + (notes.length ? ": " + notes.join("; ") : ": configurazioni controllate, nessun problema"));
  return { prev, now, notes };
}
let MIGR = null;
ipcMain.handle("app:migration", () => MIGR);
ipcMain.on("log:error", (_e, where, msg) => logErr("pagina " + String(where || "").slice(0, 40), String(msg || "").slice(0, 4000)));
function start() {
  try { ensureDirs(); } catch (e) { logErr("cartelle", e); }
  try { MIGR = migrate(); } catch (e) { logErr("migrazione", e); }
  createWindow();
  /* pagina andata in crash o bloccata: si registra e si ricarica */
  win.webContents.on("render-process-gone", (_e, d) => { logErr("pagina chiusa", d && d.reason); if (d && d.reason !== "clean-exit" && win && !win.isDestroyed()) setTimeout(() => { try { win.reload(); } catch {} }, 800); });
  win.on("unresponsive", () => logErr("pagina", "non risponde"));
  try { initUpdater(); } catch (e) { logErr("aggiornamenti", e); }
  /* telecamere, microfono, cattura di finestre, schermo intero (proiettore) e "Copia": solo per le pagine del programma */
  const own = (u) => String(u || "").startsWith("file://");
  const PERM_OK = new Set(["media", "display-capture", "fullscreen", "clipboard-sanitized-write"]);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(own(wc.getURL()) && PERM_OK.has(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => own(wc ? wc.getURL() : origin) && PERM_OK.has(perm));
  try {
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
  } catch (e) { logErr("diretta", e); }
  try { botsStartAll(); } catch (e) { logErr("bot", e); }
  setTimeout(() => { try { dcSweepTrash(); } catch (e) { logErr("discord pulizia", e); } }, 10000);
}
app.whenReady().then(() => {
  if (LOCKED) return start();
  /* aggiornamento: il programma vecchio si sta chiudendo, si aspetta al massimo 20 secondi */
  const t0 = Date.now(), iv = setInterval(() => {
    if (app.requestSingleInstanceLock()) { clearInterval(iv); LOCKED = true; start(); }
    else if (Date.now() - t0 > 20000) { clearInterval(iv); logErr("avvio", "un altro Tornei Fragmarathon è ancora aperto"); app.exit(0); }
  }, 500);
});
app.on("before-quit", () => {
  Object.values(bots).forEach((b) => { try { b.stop(); } catch (e) { logErr("chiusura bot", e); } });
  try { if (streamer) streamer.dispose(); } catch (e) { logErr("chiusura diretta", e); }
});
app.on("window-all-closed", () => app.quit());
