/* Tornei Fragmarathon: diretta su YouTube, Twitch o un server RTMP.
   Una finestra nascosta (stream.html) compone su una tela la finestra scelta e le telecamere
   e la registra con MediaRecorder; i pezzi arrivano qui e vanno a ffmpeg, che codifica in
   H.264/AAC (con la scheda video se possibile) e trasmette, anche a più destinazioni insieme.
   La configurazione (con le chiavi di trasmissione) sta in userData, mai nei backup. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { BrowserWindow, desktopCapturer } = require("electron");

const QUALITY = {
  "720p30": { w: 1280, h: 720, fps: 30, kbps: 4500 },
  "1080p30": { w: 1920, h: 1080, fps: 30, kbps: 6000 },
  "1080p60": { w: 1920, h: 1080, fps: 60, kbps: 9000 }
};
const SCENES = { finestra: "Solo la finestra", pip: "Finestra con telecamera nell'angolo", affiancati: "Finestra e telecamere affiancate", camera: "Solo la telecamera", telecamere: "Tutte le telecamere" };

function ffmpegPath() {
  let p = require("ffmpeg-static");
  if (!p) return null;
  p = p.replace("app.asar" + path.sep, "app.asar.unpacked" + path.sep);
  /* l'antivirus può averlo messo in quarantena: meglio «ffmpeg non trovato» subito che «Avvio…» per sempre */
  return fs.existsSync(p) ? p : null;
}

module.exports = function createStreamer(opts) {
  const file = opts.file;
  let off = null, offLast = 0, offFrames = 0;
  let cfg = load(), win = null, ff = null, st = idle(), encoder = null, restarts = 0, stopping = false, startedAt = 0, gen = 0, early = [], liveSent = false, lastFrames = 0, previewData = null, saveFile = null;
  /* session: cambia a ogni avvio e a ogni stop, così un avvio fermato a metà non va in onda;
     restartT: riconnessione in attesa; slow/slowAt: riavvii perché ffmpeg non teneva il passo */
  let session = 0, restartT = null, slow = 0, slowAt = 0;

  function idle() { return { live: false, starting: false, since: 0, scene: cfg ? cfg.scene : "pip", fps: 0, kbps: 0, frames: 0, err: "", encoder: "", outputs: [] }; }
  function defaults() {
    return { yt: { on: false, key: "", link: "" }, tw: { on: false, key: "", channel: "" }, rtmp: { on: false, url: "", key: "", link: "" },
      quality: "720p30", kbps: 0, source: "wall", cams: [], mic: "", pcAudio: false, overlay: true, save: false, scene: "pip", cam: 0 };
  }
  /* un file rovinato (JSON troncato) si mette da parte invece di sovrascriverlo: le chiavi si possono recuperare a mano */
  function load() { try { const c = Object.assign(defaults(), JSON.parse(fs.readFileSync(file, "utf8"))); ["yt", "tw", "rtmp"].forEach((k) => (c[k] = Object.assign(defaults()[k], c[k]))); return c; } catch (e) { if (e instanceof SyntaxError) { try { fs.renameSync(file, file + ".rovinato-" + Date.now()); } catch {} } return defaults(); } }
  /* scrittura atomica: un crash o un calo di corrente a metà non lascia un file vuoto */
  /* se la sostituzione non riesce (file tenuto aperto dall'antivirus) si scrive direttamente: meglio che perdere la modifica */
  function persist() { const t = file + ".tmp", data = JSON.stringify(cfg, null, 1); try { const fd = fs.openSync(t, "w"); try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch { return; } try { fs.renameSync(t, file); } catch { try { fs.writeFileSync(file, data); fs.unlinkSync(t); } catch {} } }
  function emit() { opts.onStatus && opts.onStatus(status()); }

  function links() {
    const L = [];
    if (cfg.yt.on && cfg.yt.key) L.push({ name: "YouTube", url: cfg.yt.link || "" });
    if (cfg.tw.on && cfg.tw.key) L.push({ name: "Twitch", url: cfg.tw.channel ? "https://www.twitch.tv/" + cfg.tw.channel.replace(/^.*twitch\.tv\//i, "").replace(/[^\w]/g, "") : "" });
    if (cfg.rtmp.on && cfg.rtmp.url) L.push({ name: "Diretta", url: cfg.rtmp.link || "" });
    return L;
  }
  function outputs() {
    const o = [];
    if (cfg.yt.on && cfg.yt.key) o.push({ name: "YouTube", url: "rtmps://a.rtmps.youtube.com/live2/" + cfg.yt.key.trim() });
    if (cfg.tw.on && cfg.tw.key) o.push({ name: "Twitch", url: "rtmp://live.twitch.tv/app/" + cfg.tw.key.trim() });
    if (cfg.rtmp.on && cfg.rtmp.url) { const u = cfg.rtmp.url.trim().replace(/\/+$/, ""); o.push({ name: "RTMP", url: cfg.rtmp.key ? u + "/" + cfg.rtmp.key.trim() : u }); }
    return o;
  }
  function status() {
    const mask = (k) => (k ? "••••" + String(k).slice(-4) : "");
    return Object.assign({}, st, {
      config: {
        yt: { on: cfg.yt.on, hasKey: !!cfg.yt.key, keyHint: mask(cfg.yt.key), link: cfg.yt.link }, tw: { on: cfg.tw.on, hasKey: !!cfg.tw.key, keyHint: mask(cfg.tw.key), channel: cfg.tw.channel },
        rtmp: { on: cfg.rtmp.on, url: cfg.rtmp.url, hasKey: !!cfg.rtmp.key, link: cfg.rtmp.link },
        quality: cfg.quality, kbps: cfg.kbps, source: cfg.source, cams: cfg.cams, mic: cfg.mic, pcAudio: cfg.pcAudio, overlay: cfg.overlay, save: cfg.save, scene: cfg.scene, cam: cfg.cam
      },
      scenes: SCENES, qualities: Object.keys(QUALITY), links: links(), ffmpeg: !!ffmpegPath()
    });
  }

  /* encoder H.264: prima la scheda video (NVIDIA, Intel, AMD), altrimenti il processore */
  function pickEncoder() {
    if (encoder) return encoder;
    const bin = ffmpegPath();
    for (const e of ["h264_nvenc", "h264_qsv", "h264_amf"]) {
      try {
        const r = spawnSync(bin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=640x360:r=30:d=0.3", "-c:v", e, "-f", "null", "-"], { timeout: 8000, windowsHide: true });
        if (r.status === 0) return (encoder = e);
      } catch {}
    }
    return (encoder = "libx264");
  }
  function encArgs(e, q, kbps) {
    const k = String(kbps) + "k", g = String(q.fps * 2);
    const common = ["-b:v", k, "-maxrate", k, "-bufsize", String(kbps * 2) + "k", "-g", g, "-keyint_min", g, "-r", String(q.fps)];
    if (e === "h264_nvenc") return ["-c:v", e, "-preset", "p4", "-tune", "ll", "-rc", "cbr", "-pix_fmt", "yuv420p"].concat(common);
    if (e === "h264_qsv") return ["-c:v", e, "-preset", "veryfast", "-pix_fmt", "nv12"].concat(common);
    if (e === "h264_amf") return ["-c:v", e, "-usage", "lowlatency", "-rc", "cbr", "-pix_fmt", "yuv420p"].concat(common);
    return ["-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-profile:v", "high", "-pix_fmt", "yuv420p", "-x264-params", "nal-hrd=cbr"].concat(common);
  }

  function spawnFfmpeg(hasAudio) {
    const bin = ffmpegPath(); if (!bin) throw new Error("ffmpeg non trovato");
    const q = QUALITY[cfg.quality] || QUALITY["720p30"], kbps = cfg.kbps || q.kbps, outs = outputs(), e = pickEncoder();
    /* le chiavi di trasmissione non devono finire nel registro né negli errori (mostrati e mandati dal bot):
       ffmpeg scrive l'indirizzo completo quando un'uscita non si apre */
    const secrets = [cfg.yt.key, cfg.tw.key, cfg.rtmp.key].map((k) => String(k || "").trim()).filter((k) => k.length >= 4);
    if (cfg.rtmp.on && cfg.rtmp.url && !cfg.rtmp.key) { const seg = cfg.rtmp.url.trim().replace(/\/+$/, "").split("/"); if (seg.length > 4 && seg[seg.length - 1].length >= 4) secrets.push(seg[seg.length - 1]); }
    const scrub = (t) => secrets.reduce((a, k) => a.split(k).join("***"), String(t));
    /* nel tee | separa le uscite; ' e \ sono virgolette ed escape (un apostrofo nei Documenti, come D'Amico, rompeva la registrazione) */
    const tee = outs.map((o) => "[f=flv:onfail=ignore]" + o.url.replace(/([|\[\]'\\])/g, "\\$1"));
    if (cfg.save && opts.saveDir) {
      fs.mkdirSync(opts.saveDir, { recursive: true });
      const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
      saveFile = path.join(opts.saveDir, `diretta_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}.mkv`);
      /* onfail=ignore: se la registrazione non riesce (disco pieno, cartella non scrivibile) la diretta continua */
      tee.push("[f=matroska:onfail=ignore]" + saveFile.replace(/\\/g, "/").replace(/([|\[\]:'])/g, "\\$1"));
    }
    const args = ["-hide_banner", "-loglevel", "warning", "-stats", "-stats_period", "2",
      "-fflags", "+genpts", "-thread_queue_size", "1024", "-i", "pipe:0"];
    if (!hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    args.push("-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0");
    args.push(...encArgs(e, q, kbps), "-fps_mode", "cfr");
    args.push("-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-af", "aresample=async=1");
    if (!hasAudio) args.push("-shortest");
    args.push("-flags", "+global_header", "-f", "tee", tee.join("|"));
    const logf = opts.logFile;
    const p = spawn(bin, args, { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
    /* exe mancante o bloccato: arriva solo 'error' e mai 'exit'; senza questo ascolto resterebbe «Avvio…» per sempre */
    p.on("error", (err) => { try { if (logf) fs.appendFileSync(logf, "ffmpeg: " + scrub(err.message) + "\n"); } catch {} if (ff !== p) return; ff = null; stop("ffmpeg non avviabile: " + (err.code || err.message)); });
    early.forEach((b) => p.stdin.write(b)); early = [];
    st.encoder = e; st.outputs = outs.map((o) => o.name);
    let errBuf = "", pend = "";
    const lost = []; /* uscite cadute e non ricollegate da questo processo: restano visibili nell'errore */
    try { if (logf) fs.writeFileSync(logf, "[" + new Date().toISOString() + "] ffmpeg " + args.map((a) => scrub(/rtmps?:\/\//.test(a) ? a.replace(/(live2\/|app\/|live\/)[^|\]]+/g, "$1***") : a)).join(" ") + "\n"); } catch {}
    p.stderr.on("data", (d) => {
      if (ff !== p || stopping) return; /* processo già sostituito o fermato: le ultime statistiche non contano */
      /* solo righe intere: una chiave spezzata fra due pezzi sfuggirebbe alla maschera */
      const raw = pend + d.toString(), cut = Math.max(raw.lastIndexOf("\n"), raw.lastIndexOf("\r"));
      if (cut < 0 && raw.length < 8192) { pend = raw; return; }
      pend = cut < 0 ? "" : raw.slice(cut + 1);
      const s = scrub(cut < 0 ? raw : raw.slice(0, cut + 1));
      try { if (logf) fs.appendFileSync(logf, s); } catch {}
      /* con il muxer tee ffmpeg scrive bitrate=N/A: si usa il bitrate impostato */
      const m = /frame=\s*(\d+)\s+fps=\s*([\d.]+)/.exec(s), br = /bitrate=\s*([\d.]+)kbits/.exec(s), sm = /Slave muxer #(\d+) failed/i.exec(s);
      if (m) {
        st.frames = +m[1]; st.fps = +m[2]; st.kbps = br ? Math.round(+br[1]) : kbps;
        if (!st.live && st.frames > q.fps * 2) { st.live = true; st.starting = false; st.err = lost.join("; "); st.since = st.since || Date.now(); restarts = 0; p.__liveAt = p.__liveAt || Date.now(); emit(); if (!liveSent) { liveSent = true; opts.onLive && opts.onLive(links()); } }
        else emit();
      }
      if (sm) {
        /* tee non riapre un'uscita caduta. Si riparte da capo (e si riconnette) solo se è caduta dopo almeno 30 s
           in onda e non c'è una registrazione su disco da interrompere. Se non si apre all'avvio (chiave
           sbagliata, rete assente) le altre uscite e la registrazione continuano; il tee dice quale (#N). */
        const i = +sm[1], remote = i < outs.length;
        if (remote && !cfg.save && p.__liveAt && Date.now() - p.__liveAt > 30000) { st.err = "Connessione persa con " + outs[i].name + ": mi riconnetto…"; emit(); try { p.kill("SIGKILL"); } catch {} }
        else { lost.push(remote ? "Connessione persa con " + outs[i].name + ": per ricollegarla ferma e riavvia la diretta" : "Registrazione su disco non riuscita"); st.err = lost.join("; "); emit(); }
      } else if (!m && /error|failed|refused|denied|Invalid|unauthorized|403|404/i.test(s)) { errBuf = (errBuf + s).slice(-400); st.err = s.trim().split("\n").pop().slice(0, 200); emit(); }
    });
    p.stdin.on("error", () => {});
    p.on("exit", (code) => {
      if (ff !== p) return;
      ff = null;
      if (stopping) return;
      /* caduta: si riparte da capo (nuova intestazione WebM) */
      st.live = false; st.starting = true; st.err = st.err || "trasmissione interrotta (codice " + code + ")";
      /* si riprova a lungo (alla LAN la connessione può cadere per minuti): fino a 60 tentativi, al massimo ogni 30 s */
      if (++restarts > 60) { stop("riconnessione non riuscita: " + st.err); return; }
      st.err = st.err.replace(/ \(tentativo \d+\)$/, "") + " (tentativo " + restarts + ")"; emit();
      /* il timer si tiene: stop() lo annulla, altrimenti dopo Ferma e Avvia partirebbe un secondo ffmpeg orfano */
      clearTimeout(restartT);
      restartT = setTimeout(() => {
        restartT = null;
        if (stopping || !win || ff) return;
        gen++; early = [];
        try { ff = spawnFfmpeg(hasAudio); } catch (x) { stop(String(x.message || x)); return; }
        win.webContents.send("stream-cmd", { type: "restart", gen });
      }, Math.min(30000, 2000 * restarts));
    });
    return p;
  }

  function ensureWin() {
    if (win && !win.isDestroyed()) return Promise.resolve(win);
    win = new BrowserWindow({ show: false, width: 640, height: 400, webPreferences: Object.assign({}, opts.webPreferences, { backgroundThrottling: false }) });
    win.on("closed", () => { win = null; });
    return win.loadFile(path.join(__dirname, "stream.html")).then(() => win);
  }

  /* Schermo del proiettore: disegnato fuori schermo alla risoluzione della diretta (rendering
     offscreen di Electron). Non serve che il proiettore sia aperto o visibile, e funziona anche
     a schermo spento o bloccato. I fotogrammi vanno alla finestra della diretta come JPEG. */
  function startOffscreen(q) {
    stopOffscreen();
    off = new BrowserWindow({ show: false, width: q.w, height: q.h, useContentSize: true, webPreferences: Object.assign({}, opts.webPreferences, { offscreen: true, backgroundThrottling: false }) });
    off.webContents.setFrameRate(q.fps);
    const minGap = 1000 / q.fps - 2;
    off.webContents.on("paint", (_e, _dirty, image) => {
      const now = Date.now(); if (now - offLast < minGap || !win || win.isDestroyed()) return; offLast = now; offFrames++;
      const sz = image.getSize(), im = sz.width !== q.w || sz.height !== q.h ? image.resize({ width: q.w, height: q.h, quality: "good" }) : image;
      win.webContents.send("stream-frame", im.toJPEG(88));
    });
    /* ridisegno periodico: la pagina dipinge solo quando cambia, la diretta vuole sempre fotogrammi */
    off.__keep = setInterval(() => { if (off && !off.isDestroyed()) off.webContents.invalidate(); }, 1000);
    off.on("closed", () => { off = null; });
    off.loadFile(path.join(__dirname, "index.html"), { query: { wall: "1", stream: "1" } });
  }
  function stopOffscreen() { if (off && !off.isDestroyed()) { clearInterval(off.__keep); off.destroy(); } off = null; }
  async function sourceId() {
    if (cfg.source === "wall") return "offscreen";
    if (cfg.source === "main") { const w = opts.getMain(); return w ? w.getMediaSourceId() : null; }
    return cfg.source || null;
  }

  async function start() {
    if (ff || st.starting) return status();
    if (!ffmpegPath()) { st.err = "ffmpeg non trovato"; emit(); return status(); }
    if (!outputs().length && !cfg.save) { st.err = "Scegli almeno una destinazione (YouTube, Twitch o RTMP) e inserisci la chiave."; emit(); return status(); }
    stopping = false; liveSent = false; restarts = 0; clearTimeout(restartT); restartT = null;
    const my = ++session; /* stop() lo cambia: dopo ogni attesa si controlla che l'avvio non sia stato fermato */
    st = idle(); st.starting = true; st.scene = cfg.scene; emit();
    try {
      const sid = await sourceId();
      if (my !== session) return status();
      await ensureWin();
      if (my !== session) return status();
      const q = QUALITY[cfg.quality] || QUALITY["720p30"];
      if (sid === "offscreen") startOffscreen(q);
      const ok = await new Promise((resolve) => {
        let t = null;
        const done = (r) => { clearTimeout(t); if (opts.onReady === done) opts.onReady = null; resolve(r || {}); };
        t = setTimeout(() => done({ ok: false, err: "la finestra della diretta non risponde" }), 20000);
        opts.onReady = done;
        gen++; early = [];
        win.webContents.send("stream-cmd", { type: "start", gen, cfg: { w: q.w, h: q.h, fps: q.fps, sourceId: sid, cams: cfg.cams, mic: cfg.mic, pcAudio: cfg.pcAudio, overlay: cfg.overlay, scene: cfg.scene, cam: cfg.cam } });
      });
      /* fermata durante l'attesa (Ferma subito dopo Avvia, /diretta ferma): niente ffmpeg; la finestra ha già avuto il suo «stop» */
      if (my !== session) return status();
      /* avvio non riuscito o scaduto: stop() chiude anche telecamere, microfono e registrazione rimasti aperti */
      if (!ok.ok) return stop(ok.err || "avvio non riuscito");
      ff = spawnFfmpeg(!!ok.audio);
      startedAt = Date.now();
    } catch (e) { if (my === session) stop(String(e.message || e)); }
    return status();
  }
  function stop(reason) {
    stopping = true; session++;
    clearTimeout(restartT); restartT = null;
    /* un avvio ancora in attesa della finestra si chiude subito, senza andare in onda */
    if (opts.onReady) { const f = opts.onReady; opts.onReady = null; f({ ok: false, err: "fermata" }); }
    if (win && !win.isDestroyed()) win.webContents.send("stream-cmd", { type: "stop" });
    stopOffscreen();
    if (ff) { const p = ff; ff = null; try { p.stdin.end(); } catch {} setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 4000); }
    /* la fine si annuncia se l'inizio era stato annunciato, anche se in quel momento si stava riconnettendo */
    const was = liveSent; liveSent = false;
    st = idle(); st.err = reason || ""; emit();
    if (was && opts.onEnd) opts.onEnd();
    return status();
  }
  /* ffmpeg non tiene il passo (rete lenta o PC lento): i pezzi si accumulerebbero in memoria senza limite.
     Si riparte da capo (nuova intestazione WebM); dopo 3 volte in mezz'ora ci si ferma con un consiglio. */
  function tooSlow(p) {
    p.__slow = true;
    const now = Date.now(), msg = "Connessione o PC troppo lenti per la qualità scelta";
    if (now - slowAt > 30 * 60000) slow = 0;
    slowAt = now;
    if (++slow >= 3) { stop(msg + ": scegli una qualità più bassa"); return; }
    st.err = msg + ": riavvio"; emit();
    try { p.kill("SIGKILL"); } catch {}
  }

  return {
    status, start, stop: () => stop(""), SCENES,
    /* i primi pezzi (con l'intestazione WebM) possono arrivare prima che ffmpeg sia partito: si tengono da parte */
    chunk(g, buf) {
      if (g !== gen) return;
      if (ff && ff.stdin.writable) {
        if (ff.__slow) return; /* già in chiusura: non si accoda altro */
        /* in onda bastano 32 MB (circa 20 s di ritardo); prima, l'apertura delle connessioni può bloccare qualche secondo */
        if (ff.stdin.writableLength > (ff.__liveAt ? 32 : 128) * 1048576) { tooSlow(ff); return; }
        ff.stdin.write(Buffer.from(buf));
      } else if (!stopping && early.length < 400) early.push(Buffer.from(buf));
    },
    ready(r) {
      r = r || {};
      if (r.gen != null && r.gen !== gen) return; /* risposta di un avvio già annullato */
      if (opts.onReady) { const f = opts.onReady; opts.onReady = null; f(r); }
      else if (r.ok && win && !win.isDestroyed()) win.webContents.send("stream-cmd", { type: "stop" }); /* nessuno aspetta più: si spengono telecamere e microfono */
    },
    preview(d) { previewData = d; },
    getPreview() { return previewData; },
    scene(name, cam) {
      if (!SCENES[name]) return status();
      cfg.scene = name; if (typeof cam === "number") cfg.cam = cam; persist(); st.scene = name;
      if (win && !win.isDestroyed()) win.webContents.send("stream-cmd", { type: "scene", scene: name, cam: cfg.cam });
      emit(); return status();
    },
    configure(c) {
      c = c || {};
      ["yt", "tw", "rtmp"].forEach((k) => {
        if (!c[k]) return;
        const t = cfg[k], s = c[k];
        if (typeof s.on === "boolean") t.on = s.on;
        if (typeof s.key === "string" && s.key.trim()) t.key = s.key.trim();
        if (s.removeKey) t.key = "";
        ["link", "channel", "url"].forEach((f) => { if (typeof s[f] === "string") t[f] = s[f].trim(); });
      });
      if (QUALITY[c.quality]) cfg.quality = c.quality;
      if (typeof c.kbps === "number") cfg.kbps = Math.max(0, Math.min(20000, Math.round(c.kbps)));
      ["source", "mic"].forEach((f) => { if (typeof c[f] === "string") cfg[f] = c[f]; });
      if (Array.isArray(c.cams)) cfg.cams = c.cams.slice(0, 4).map(String);
      ["pcAudio", "overlay", "save"].forEach((f) => { if (typeof c[f] === "boolean") cfg[f] = c[f]; });
      persist(); emit(); return status();
    },
    async sources() {
      const out = { windows: [], screens: [], cams: [], mics: [] };
      try {
        const s = await desktopCapturer.getSources({ types: ["window", "screen"], thumbnailSize: { width: 0, height: 0 } });
        s.forEach((x) => (x.id.startsWith("screen") ? out.screens : out.windows).push({ id: x.id, name: x.name }));
      } catch {}
      try {
        await ensureWin();
        const d = await win.webContents.executeJavaScript("navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop())}).catch(()=>{}).then(()=>navigator.mediaDevices.enumerateDevices()).then(L=>L.map(d=>({kind:d.kind,id:d.deviceId,label:d.label})))", true);
        d.forEach((x) => { if (x.kind === "videoinput") out.cams.push({ id: x.id, name: x.label || "Telecamera" }); if (x.kind === "audioinput" && x.id !== "default" && x.id !== "communications") out.mics.push({ id: x.id, name: x.label || "Microfono" }); });
      } catch {}
      return out;
    },
    isLive() { return st.live; },
    links,
    dispose() { stop(""); if (win && !win.isDestroyed()) win.destroy(); }
  };
};
