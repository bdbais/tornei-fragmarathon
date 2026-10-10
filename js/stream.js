/* Tornei Fragmarathon: compositore della diretta (finestra nascosta stream.html).
   Cattura la finestra scelta, le telecamere e l'audio, li compone su una tela secondo la
   scena e registra con MediaRecorder; i pezzi WebM vanno al processo principale e a ffmpeg. */
(function () {
  "use strict";
  var desk = window.desk, cv = document.getElementById("c"), ctx = cv.getContext("2d");
  var cfg = null, gen = 0, win = null, cams = [], streams = [], audioCtx = null, audioDest = null, hasAudio = false, rec = null, timer = null, prevT = 0;
  var scene = "pip", camIdx = 0, logo = null, title = "", sub = "";

  /* Sorgente video. In una finestra nascosta Chromium non disegna i <video>: si leggono i
     fotogrammi direttamente dalla traccia (WebCodecs) e si tiene sempre l'ultimo. */
  function video(stream) {
    var track = stream.getVideoTracks()[0], o = { frame: null, w: 0, h: 0, track: track, el: null };
    if (window.MediaStreamTrackProcessor && track) {
      var reader = new MediaStreamTrackProcessor({ track: track }).readable.getReader();
      o.reader = reader;
      (async function () {
        for (;;) {
          var r; try { r = await reader.read(); } catch (e) { break; }
          if (r.done) break;
          if (o.frame) o.frame.close();
          o.frame = r.value; o.w = r.value.displayWidth; o.h = r.value.displayHeight;
        }
      })();
    } else {
      var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.srcObject = stream; v.play().catch(function () {}); o.el = v;
    }
    o.stop = function () { try { if (o.reader) o.reader.cancel(); } catch (e) {} if (o.frame) { try { o.frame.close(); } catch (e) {} o.frame = null; } };
    return o;
  }
  function img(v) { return v.frame || v.el; }
  function dims(v) { return v.frame ? [v.w, v.h] : v.el ? [v.el.videoWidth, v.el.videoHeight] : [0, 0]; }
  function ready(v) { if (!v) return false; var d = dims(v); return d[0] > 0 && (v.frame || (v.el && v.el.readyState >= 2)); }
  /* disegna v nel riquadro: "contain" lascia tutto visibile, "cover" riempie tagliando */
  function draw(v, x, y, w, h, cover) {
    if (!ready(v)) { ctx.fillStyle = "#111"; ctx.fillRect(x, y, w, h); return; }
    var dd = dims(v), vw = dd[0], vh = dd[1], s = cover ? Math.max(w / vw, h / vh) : Math.min(w / vw, h / vh);
    var dw = vw * s, dh = vh * s;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img(v), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  }
  function frame(x, y, w, h) { ctx.lineWidth = Math.max(3, cv.width / 400); ctx.strokeStyle = "#FF5A1F"; ctx.strokeRect(x, y, w, h); }
  function readMeta() {
    try {
      var s = JSON.parse(localStorage.getItem("tornei-v2") || "{}"), ui = s.ui || {};
      title = ui.title || "Tornei Fragmarathon"; sub = ui.sub || "";
      if (ui.logo && (!logo || logo.src !== ui.logo)) { var i = new Image(); i.src = ui.logo; logo = i; }
      if (!ui.logo) logo = null;
    } catch (e) {}
  }
  function overlay() {
    var W = cv.width, H = cv.height, u = H / 720;
    if (logo && logo.complete && logo.naturalWidth) { var lh = 70 * u, lw = lh * logo.naturalWidth / logo.naturalHeight; ctx.globalAlpha = 0.95; ctx.drawImage(logo, W - lw - 24 * u, 20 * u, lw, lh); ctx.globalAlpha = 1; }
    var bh = 54 * u, by = H - bh - 22 * u, bx = 24 * u;
    ctx.font = "700 " + Math.round(24 * u) + "px Bahnschrift, 'Segoe UI', sans-serif";
    var tw = ctx.measureText(title).width, live = "LIVE", lw2;
    ctx.font = "800 " + Math.round(18 * u) + "px Bahnschrift, 'Segoe UI', sans-serif"; lw2 = ctx.measureText(live).width + 24 * u;
    var subW = 0; if (sub) { ctx.font = "500 " + Math.round(16 * u) + "px Bahnschrift, 'Segoe UI', sans-serif"; subW = ctx.measureText(sub).width + 24 * u; }
    var bw = lw2 + tw + 40 * u + subW;
    ctx.fillStyle = "rgba(10,10,10,.82)"; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#E5202A"; ctx.fillRect(bx, by, lw2, bh);
    ctx.fillStyle = "#fff"; ctx.font = "800 " + Math.round(18 * u) + "px Bahnschrift, 'Segoe UI', sans-serif"; ctx.textBaseline = "middle"; ctx.fillText(live, bx + 12 * u, by + bh / 2);
    ctx.font = "700 " + Math.round(24 * u) + "px Bahnschrift, 'Segoe UI', sans-serif"; ctx.fillText(title, bx + lw2 + 18 * u, by + bh / 2);
    if (sub) { ctx.fillStyle = "#FF5A1F"; ctx.font = "500 " + Math.round(16 * u) + "px Bahnschrift, 'Segoe UI', sans-serif"; ctx.fillText(sub, bx + lw2 + tw + 40 * u, by + bh / 2); }
    ctx.fillStyle = "#FF5A1F"; ctx.fillRect(bx, by + bh - 4 * u, bw, 4 * u);
  }
  function render() {
    var W = cv.width, H = cv.height, m = Math.round(H / 40);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    var c0 = cams[Math.min(camIdx, cams.length - 1)] || null, sc = scene;
    if (!cams.length && (sc === "camera" || sc === "telecamere")) sc = "finestra";
    if (!win && cams.length && (sc === "finestra" || sc === "pip" || sc === "affiancati")) sc = "camera";
    if (sc === "finestra") draw(win, 0, 0, W, H, false);
    else if (sc === "pip") {
      draw(win, 0, 0, W, H, false);
      if (c0) { var pw = Math.round(W * 0.28), ph = Math.round(pw * 9 / 16), px = W - pw - m, py = H - ph - m; draw(c0, px, py, pw, ph, true); frame(px, py, pw, ph); }
    } else if (sc === "affiancati") {
      var lw = Math.round(W * 0.66); draw(win, 0, 0, lw, H, false);
      var n = Math.max(1, cams.length), ch = Math.floor((H - m * (n + 1)) / n), cw = W - lw - m * 2;
      cams.forEach(function (c, i) { var y = m + i * (ch + m); draw(c, lw + m, y, cw, ch, true); frame(lw + m, y, cw, ch); });
    } else if (sc === "camera") draw(c0, 0, 0, W, H, true);
    else if (sc === "telecamere") {
      var k = cams.length, cols = k <= 1 ? 1 : 2, rows = Math.ceil(k / cols), gw = W / cols, gh = H / rows;
      cams.forEach(function (c, i) { draw(c, (i % cols) * gw, Math.floor(i / cols) * gh, gw, gh, true); });
    }
    if (cfg && cfg.overlay) overlay();
  }
  function tick() {
    try { render(); } catch (e) {}
    var now = Date.now();
    if (now - prevT > 1000) { prevT = now; readMeta(); try { var t = document.createElement("canvas"); t.width = 384; t.height = 216; t.getContext("2d").drawImage(cv, 0, 0, 384, 216); desk.streamPreview(t.toDataURL("image/jpeg", 0.6)); } catch (e) {} }
  }
  function startRecorder() {
    if (rec) { try { rec.ondataavailable = null; rec.stop(); } catch (e) {} rec = null; }
    var out = cv.captureStream(cfg.fps);
    if (hasAudio) audioDest.stream.getAudioTracks().forEach(function (t) { out.addTrack(t); });
    var types = hasAudio ? ["video/webm;codecs=h264,opus", "video/webm;codecs=vp8,opus"] : ["video/webm;codecs=h264", "video/webm;codecs=vp8"];
    var mt = types.filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0] || "video/webm";
    var g = gen;
    rec = new MediaRecorder(out, { mimeType: mt, videoBitsPerSecond: cfg.h >= 1080 ? 16e6 : 10e6, audioBitsPerSecond: 192000 });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) e.data.arrayBuffer().then(function (b) { desk.streamChunk(g, b); }); };
    rec.start(250);
  }
  async function start(c, g) {
    stop(); cfg = c; gen = g; scene = c.scene || "pip"; camIdx = c.cam || 0;
    cv.width = c.w; cv.height = c.h; readMeta();
    var errs = [];
    try {
      if (c.sourceId === "offscreen") {
        /* fotogrammi JPEG dal processore principale (schermo del proiettore disegnato fuori schermo) */
        var o = { frame: null, w: 0, h: 0, stop: function () { if (o.frame && o.frame.close) o.frame.close(); o.frame = null; } };
        offTarget = o; win = o;
      } else if (c.sourceId) {
        var s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: c.sourceId, maxWidth: 1920, maxHeight: 1080, maxFrameRate: c.fps } } });
        streams.push(s); win = video(s);
      }
    } catch (e) { errs.push("finestra: " + e.message); }
    for (var i = 0; i < (c.cams || []).length; i++) {
      try { var cs = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: c.cams[i] }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }); streams.push(cs); cams.push(video(cs)); }
      catch (e) { errs.push("telecamera " + (i + 1) + ": " + e.message); }
    }
    audioCtx = new AudioContext({ sampleRate: 48000 }); audioDest = audioCtx.createMediaStreamDestination(); hasAudio = false;
    if (c.mic) {
      try { var ms = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: c.mic }, echoCancellation: false, noiseSuppression: true, autoGainControl: true }, video: false }); streams.push(ms); audioCtx.createMediaStreamSource(ms).connect(audioDest); hasAudio = true; }
      catch (e) { errs.push("microfono: " + e.message); }
    }
    if (c.pcAudio) {
      try {
        var ps = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: "desktop" } }, video: { mandatory: { chromeMediaSource: "desktop", maxWidth: 16, maxHeight: 16 } } });
        ps.getVideoTracks().forEach(function (t) { t.stop(); });
        if (ps.getAudioTracks().length) { streams.push(ps); audioCtx.createMediaStreamSource(new MediaStream(ps.getAudioTracks())).connect(audioDest); hasAudio = true; }
      } catch (e) { errs.push("audio del PC: " + e.message); }
    }
    if (!win && !cams.length) { stop(); return { ok: false, err: "Nessuna immagine: " + (errs.join("; ") || "scegli una finestra o una telecamera") }; }
    timer = setInterval(tick, Math.round(1000 / c.fps));
    await new Promise(function (r) { setTimeout(r, 400); });
    startRecorder();
    return { ok: true, audio: hasAudio, warn: errs.join("; ") };
  }
  function stop() {
    if (timer) clearInterval(timer); timer = null;
    if (rec) { try { rec.ondataavailable = null; rec.stop(); } catch (e) {} rec = null; }
    [win].concat(cams).forEach(function (v) { if (v && v.stop) v.stop(); });
    streams.forEach(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); });
    streams = []; cams = []; win = null; offTarget = null;
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
  }
  /* diagnostica: stato delle sorgenti (usata dai test e utile per l'assistenza) */
  window.__streamDebug = function () {
    function info(v) { return v ? { ready: ready(v), size: dims(v), webcodecs: !!v.reader, track: v.track ? v.track.readyState + (v.track.muted ? " muted" : "") : "" } : null; }
    function luma(v) { try { if (!ready(v)) return null; var c = document.createElement("canvas"); c.width = 64; c.height = 36; var x = c.getContext("2d"); x.drawImage(img(v), 0, 0, 64, 36); var d = x.getImageData(0, 0, 64, 36).data, t = 0; for (var i = 0; i < d.length; i += 4) t += d[i] + d[i + 1] + d[i + 2]; return Math.round(t / (d.length / 4) / 3); } catch (e) { return "err " + e.message; } }
    return { win: info(win), winLuma: luma(win), cams: cams.map(info), camLuma: cams.map(luma), audio: hasAudio, rec: rec ? rec.state + " " + rec.mimeType : null, scene: scene };
  };
  /* fotogrammi del proiettore disegnato fuori schermo: un solo ascolto, si aggiorna la sorgente attiva */
  var offTarget = null, offBusy = false;
  desk.onStreamFrame(function (jpg) {
    var o = offTarget; if (!o || offBusy || win !== o) return; offBusy = true;
    createImageBitmap(new Blob([jpg], { type: "image/jpeg" })).then(function (b) { if (o.frame) o.frame.close(); o.frame = b; o.w = b.width; o.h = b.height; offBusy = false; }).catch(function () { offBusy = false; });
  });
  desk.onStreamCmd(function (m) {
    if (m.type === "start") start(m.cfg, m.gen).then(function (r) { desk.streamReady(r); }).catch(function (e) { desk.streamReady({ ok: false, err: String(e && e.message || e) }); });
    else if (m.type === "stop") stop();
    else if (m.type === "scene") { scene = m.scene; if (typeof m.cam === "number") camIdx = m.cam; }
    else if (m.type === "restart" && cfg) { gen = m.gen; startRecorder(); }
  });
})();
