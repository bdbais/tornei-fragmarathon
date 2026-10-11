/* Tornei Fragmarathon: la Sala.
   Pianta della sala in 2D (canvas) e in 3D (Three.js, caricato solo quando serve): file di postazioni,
   giocatori e indirizzi IP, ping per sapere chi è acceso, e gli oggetti della sala (maxischermo, switch,
   server, uscite di sicurezza, quadro elettrico, estintori, podio, refrigerazione, bagni, ...).
   La stessa pianta disegnata in 2D serve al proiettore, al bot ("/mappa": dove sono) e al kit PDF da
   stampare (mappa, postazioni, Wi-Fi con QR, server dei giochi, cartellini delle postazioni).
   Tutto sta nel torneo, in S.sala, e si salva con lui. Misure in metri. */
(function () {
  "use strict";
  var A = window.__app; if (!A) return;
  var WALL = A.WALL, DESK = A.DESK, esc = A.esc;
  function $(id) { return document.getElementById(id); }
  function T(s) { return window.I18N ? window.I18N.tr(s) : s; }
  /* sui canvas (PDF, /mappa, proiettore) il testo resta in italiano: lo traduce i18n.js nella lingua del torneo;
     i testi scritti dall'utente (nomi, rete, password, note) si avvolgono con K() perché restino come sono */
  function K(s) { return window.I18N && window.I18N.keep ? window.I18N.keep(s) : s; }
  function toast(t) { A.toast(t); }

  /* ---------- catalogo degli oggetti: nome, larghezza, profondità, colore, simbolo, altezza 3D ---------- */
  var CAT = {
    fila: ["Fila di postazioni", 0, 0, "#3b82f6", "🖥️", 0.75],
    maxi: ["Maxischermo", 4, 0.3, "#111827", "📺", 3],
    proj: ["Proiettore", 0.6, 0.6, "#6b7280", "📽️", 2.6],
    switch: ["Switch di rete", 0.6, 0.4, "#0ea5e9", "🔀", 1],
    server: ["Server", 0.8, 0.8, "#0f766e", "🗄️", 2],
    wifi: ["Access point Wi-Fi", 0.4, 0.4, "#22c55e", "📶", 2.4],
    regia: ["Regia e organizzatori", 3, 1.2, "#a855f7", "🎛️", 0.8],
    podio: ["Podio e palco", 3, 1.5, "#eab308", "🏆", 0.5],
    uscita: ["Uscita di sicurezza", 1.2, 0.25, "#16a34a", "🚪", 2.2],
    estintore: ["Estintore", 0.4, 0.4, "#dc2626", "🧯", 0.7],
    soccorso: ["Primo soccorso", 0.8, 0.5, "#ef4444", "⛑️", 1],
    quadro: ["Quadro elettrico", 1, 0.4, "#f59e0b", "⚡", 1.8],
    clima: ["Refrigerazione e aria condizionata", 1.2, 0.6, "#38bdf8", "❄️", 1.8],
    bagni: ["Bagni", 3, 2, "#64748b", "🚻", 2.5],
    bar: ["Bar e ristoro", 3, 1.2, "#f97316", "☕", 1.1],
    ingresso: ["Ingresso", 1.6, 0.3, "#84cc16", "⬇️", 2.2],
    guardaroba: ["Guardaroba e deposito", 2, 1, "#8b5cf6", "🧥", 2],
    prese: ["Prese elettriche", 0.5, 0.3, "#facc15", "🔌", 0.3],
    tavolo: ["Tavolo", 1.6, 0.8, "#a16207", "▭", 0.75],
    muro: ["Muro o divisorio", 4, 0.2, "#9ca3af", "", 2.5],
    zona: ["Zona con nome", 4, 3, "#94a3b8", "", 0.02]
  };
  /* un tipo sconosciuto (torneo di una versione più nuova, file modificato) si mostra come un tavolo */
  function cat(t) { return CAT[t] || CAT.tavolo; }
  var PITCH = 1.2, DESK_W = 1.0, DESK_D = 0.7;

  function sala() {
    var s = A.S();
    if (!s.sala) s.sala = { w: 24, h: 16, items: [], st: {}, wifi: { ssid: "", pass: "", sec: "WPA" }, servers: [], info: "", seq: 1 };
    var x = s.sala; x.items = x.items || []; x.st = x.st || {}; x.wifi = x.wifi || { ssid: "", pass: "", sec: "WPA" }; x.servers = x.servers || []; x.seq = x.seq || 1;
    return x;
  }
  function save() { A.touch(); }
  function size(it) {
    if (it.type === "fila") return { w: (it.n || 8) * PITCH, h: it.double ? 1.9 : 1.0 };
    var c = CAT[it.type] || CAT.tavolo; return { w: it.w || c[1], h: it.h || c[2] };
  }
  function rad(d) { return (d || 0) * Math.PI / 180; }
  /* postazioni di una fila: centro, rotazione e nome (lettera della fila + numero) */
  function seats(it) {
    if (it.type !== "fila") return [];
    var n = Math.max(1, Math.min(60, it.n || 8)), sides = it.double ? 2 : 1, out = [], c = Math.cos(rad(it.rot)), s = Math.sin(rad(it.rot));
    for (var side = 0; side < sides; side++) for (var i = 0; i < n; i++) {
      var lx = (i - (n - 1) / 2) * PITCH, ly = it.double ? (side ? 0.47 : -0.47) : 0;
      out.push({ id: (it.name || "A") + (side * n + i + 1), x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c, rot: (it.rot || 0) + (side ? 180 : 0), row: it.id, side: side, pos: i });
    }
    return out;
  }
  function allSeats() { var o = []; sala().items.forEach(function (it) { o = o.concat(seats(it)); }); return o; }
  function local(it, px, py) { var dx = px - it.x, dy = py - it.y, c = Math.cos(rad(it.rot)), s = Math.sin(rad(it.rot)); return { x: dx * c + dy * s, y: -dx * s + dy * c }; }
  function rowName(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  /* lettera libera; si salta anche "A" se esiste una fila "A1": A11 sarebbe il posto 11 di A e il posto 1 di A1 */
  function nextRowName() { var used = []; sala().items.forEach(function (it) { if (it.type === "fila") used.push(it.name || "A"); }); for (var i = 0; i < 702; i++) { var l = rowName(i); if (!used.some(function (u) { return u === l || (u.indexOf(l) === 0 && /^\d/.test(u.slice(l.length))); })) return l; } return "R" + sala().seq; }
  /* primo blocco di cnt IP liberi dopo le file già numerate con la stessa base; se non c'è più posto
     prima di .255 si cerca un buco tra le file (resta tra 101 e 254) */
  function nextIp(cnt, base) {
    var B = base || "192.168.1.", R = [], top = 100; cnt = Math.max(1, cnt || 1);
    sala().items.forEach(function (it) { if (it.type === "fila" && (it.ipBase || "192.168.1.") === B) { var a = it.ipStart || 101, b = a + seats(it).length - 1; R.push([a, b]); top = Math.max(top, b); } });
    if (top + cnt <= 254) return top + 1;
    for (var a = 101; a + cnt - 1 <= 254; a++) { var h = R.filter(function (r) { return a <= r[1] && a + cnt - 1 >= r[0]; })[0]; if (!h) return a; a = h[1]; }
    return 101;
  }
  /* scorciatoie del menu Aggiungi: i tavoli da 1 e 2 postazioni sono file corte (numeri, IP, 3D e PDF come le file) */
  var PRESET = { post2: ["Tavolo da 2 postazioni", 2, "🖥️"], post1: ["Tavolo da 1 postazione", 1, "🖥️"] };

  /* ---------- stato dei PC (ping) ---------- */
  var PING = {}, pingT = null;
  function ipOf(seatId) { var st = sala().st[seatId]; return st && st.ip ? String(st.ip).trim() : ""; }
  function pingAll(quiet) {
    if (!DESK || !DESK.salaPing) { if (!quiet) toast(T("Il ping funziona solo nell'app installata.")); return Promise.resolve(); }
    var hosts = allSeats().map(function (x) { return ipOf(x.id); }).filter(Boolean);
    sala().servers.forEach(function (sv) { var h = String(sv.addr || "").split(":")[0]; if (h) hosts.push(h); });
    if (!hosts.length) { if (!quiet) toast(T("Nessun indirizzo IP da controllare: assegnali alle postazioni.")); return Promise.resolve(); }
    return DESK.salaPing(hosts).then(function (r) {
      Object.keys(r || {}).forEach(function (h) { PING[h] = Object.assign({ t: Date.now() }, r[h]); });
      if (!quiet) { var on = Object.keys(r).filter(function (h) { return r[h].ok; }).length; toast(T("Ping: ") + on + "/" + Object.keys(r).length + T(" raggiungibili.")); }
      redraw(); paintStats();
    });
  }
  function statusOf(seatId) { var ip = ipOf(seatId); if (!ip || !PING[ip]) return ""; return PING[ip].ok ? "on" : "off"; }
  function statCls(p) { return "sl-stat " + (p ? (p.ok ? "on" : "off") : ""); }
  function seatStat(p) { return p ? (p.ok ? "● " + T("acceso") + (p.ms != null ? " " + p.ms + " ms" : "") : "● " + T("spento")) : "—"; }
  function propStat(p) { return p ? (p.ok ? T("Acceso") + (p.ms != null ? " · " + p.ms + " ms" : "") : T("Non risponde")) : T("Stato sconosciuto"); }
  function svPing(sv) { return PING[String(sv.addr || "").split(":")[0]]; }
  /* dopo un ping cambiano solo le celle dello stato: niente ridisegno di tabelle e campi, così chi sta
     scrivendo un IP non perde né il testo né il punto in cui si trova */
  function paintStats() {
    var tb = $("salatab"), inf = $("salainfo"), pr = $("salaprops"), X = sala();
    if (tb) [].forEach.call(tb.querySelectorAll("td[data-st]"), function (td) { var p = PING[(X.st[td.getAttribute("data-st")] || {}).ip || ""]; td.className = statCls(p); td.textContent = seatStat(p); });
    if (inf) [].forEach.call(inf.querySelectorAll("td[data-svst]"), function (td) { var sv = X.servers[+td.getAttribute("data-svst")], p = sv && svPing(sv); td.className = statCls(p); td.textContent = p ? (p.ok ? "●" : "○") : "—"; });
    var ps = pr && sel && sel.seat && pr.querySelector("p.sl-stat"); if (ps) { var p2 = PING[(X.st[sel.seat] || {}).ip || ""]; ps.className = statCls(p2); ps.textContent = propStat(p2); }
  }

  /* ---------- disegno 2D (editor, proiettore, bot, PDF) ---------- */
  function themeColors(print) {
    if (print) return { bg: "#ffffff", floor: "#f8fafc", grid: "#e2e8f0", ink: "#0f172a", mut: "#64748b", line: "#334155", acc: "#ea580c", seat: "#e2e8f0" };
    var cs = getComputedStyle(document.documentElement), g = function (v, d) { return (cs.getPropertyValue(v) || "").trim() || d; };
    return { bg: g("--bg", "#111"), floor: g("--panel", "#1e1e1e"), grid: g("--line", "#333"), ink: g("--ink", "#eee"), mut: g("--mut", "#999"), line: g("--edge", "#555"), acc: g("--acc", "#ff5a1f"), seat: g("--line", "#3a3a3a") };
  }
  function draw(cv, o) {
    o = o || {}; var X = sala(), ctx = cv.getContext("2d"), W = cv.width, H = cv.height, C = themeColors(o.print);
    var top = o.title ? Math.round(H * 0.07) : 10, legendH = o.legend ? Math.round(H * 0.12) : 0, m = Math.round(Math.min(W, H) * 0.03);
    var sc = Math.min((W - 2 * m) / X.w, (H - top - legendH - 2 * m) / X.h), ox = (W - X.w * sc) / 2, oy = top + m + (H - top - legendH - 2 * m - X.h * sc) / 2;
    var P = function (x, y) { return [ox + x * sc, oy + y * sc]; };
    ctx.save(); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (o.title) { ctx.fillStyle = C.ink; ctx.font = "700 " + Math.round(top * 0.5) + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textBaseline = "middle"; ctx.fillText(o.title, m, top * 0.6, W - 2 * m); }
    /* pavimento e griglia di 1 metro */
    ctx.fillStyle = C.floor; ctx.fillRect(ox, oy, X.w * sc, X.h * sc);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (var gx = 1; gx < X.w; gx++) { ctx.moveTo(ox + gx * sc, oy); ctx.lineTo(ox + gx * sc, oy + X.h * sc); }
    for (var gy = 1; gy < X.h; gy++) { ctx.moveTo(ox, oy + gy * sc); ctx.lineTo(ox + X.w * sc, oy + gy * sc); }
    ctx.stroke(); ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(2, sc * 0.08); ctx.strokeRect(ox, oy, X.w * sc, X.h * sc);
    var order = X.items.slice().sort(function (a, b) { var z = function (t) { return t === "zona" ? 0 : t === "muro" ? 1 : t === "fila" ? 3 : 2; }; return z(a.type) - z(b.type); });
    var hiSeat = null, assigned = X.st;
    order.forEach(function (it) {
      var c = CAT[it.type] || CAT.tavolo, sz = size(it), p = P(it.x, it.y), sel = o.sel && o.sel.item === it.id && !o.sel.seat;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(rad(it.rot));
      if (it.type === "fila") {
        /* le postazioni le disegna sotto, una per una; qui solo la lettera della fila */
        ctx.fillStyle = C.mut; ctx.font = "700 " + Math.max(10, sc * 0.55) + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(K(it.name || "A"), -sz.w / 2 * sc - sc * 0.2, 0);
        if (sel) { ctx.strokeStyle = C.acc; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeRect(-sz.w / 2 * sc - 4, -sz.h / 2 * sc - 4, sz.w * sc + 8, sz.h * sc + 8); ctx.setLineDash([]); }
      } else {
        var w = sz.w * sc, h = sz.h * sc;
        if (it.type === "zona") { ctx.fillStyle = (it.color || c[3]) + "26"; ctx.strokeStyle = it.color || c[3]; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.setLineDash([]); }
        else { ctx.fillStyle = it.color || c[3]; ctx.fillRect(-w / 2, -h / 2, w, h); }
        if (sel) { ctx.strokeStyle = C.acc; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); }
        ctx.rotate(-rad(it.rot));
        var lab = it.label ? K(it.label) : (it.type === "zona" ? c[0] : ""), fs = Math.max(10, Math.min(sc * 0.42, 18 + sc * 0.1));
        if (c[4]) { ctx.font = Math.max(12, Math.min(Math.max(w, h) * 0.6, sc * 0.9)) + "px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c[4], 0, 0); }
        if (lab) { ctx.font = "600 " + fs + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = C.ink; ctx.fillText(lab, 0, (it.type === "zona" ? -h / 2 + 4 : Math.max(w, h) / 2 + 3), Math.max(w, sc * 4)); }
      }
      ctx.restore();
    });
    /* postazioni */
    allSeats().forEach(function (st) {
      var p = P(st.x, st.y), a = assigned[st.id] || {}, stt = statusOf(st.id), isHi = o.hi && o.hi === st.id, sel = o.sel && o.sel.seat === st.id;
      if (isHi) hiSeat = { p: p, st: st };
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(rad(st.rot));
      var w = DESK_W * sc, h = DESK_D * sc;
      ctx.fillStyle = isHi ? C.acc : stt === "on" ? "#16a34a" : stt === "off" ? "#b91c1c" : a.player ? "#2563eb" : C.seat;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(-w * 0.3, -h / 2, w * 0.6, h * 0.16); /* monitor */
      if (sel) { ctx.strokeStyle = C.acc; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); }
      ctx.restore();
      ctx.fillStyle = isHi || a.player || stt ? "#fff" : C.ink; ctx.textAlign = "center";
      ctx.font = "700 " + Math.max(8, sc * 0.26) + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textBaseline = "bottom"; ctx.fillText(st.id, p[0], p[1] + (a.player ? 0 : sc * 0.12), w);
      if (a.player && sc > 18) { ctx.font = "500 " + Math.max(7, sc * 0.2) + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textBaseline = "top"; ctx.fillText(K(a.player), p[0], p[1] + 1, w * 0.98); }
    });
    /* "sei qui" */
    if (hiSeat) {
      var hp = hiSeat.p, r = Math.max(14, sc * 0.55);
      ctx.strokeStyle = C.acc; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hp[0], hp[1], r * 1.6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(hp[0], hp[1] - r * 1.6); ctx.lineTo(hp[0] - r * 0.7, hp[1] - r * 3); ctx.lineTo(hp[0] + r * 0.7, hp[1] - r * 3); ctx.closePath(); ctx.fill();
      ctx.font = "800 " + Math.round(r * 1.1) + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      var lab2 = "Sei qui" + ": " + hiSeat.st.id, tw = ctx.measureText(lab2).width + r;
      ctx.fillStyle = C.acc; ctx.fillRect(hp[0] - tw / 2, hp[1] - r * 4.4, tw, r * 1.4); ctx.fillStyle = "#fff"; ctx.fillText(lab2, hp[0], hp[1] - r * 3.1);
    }
    /* legenda e scala */
    if (o.legend) {
      var types = {}; X.items.forEach(function (it) { if (it.type !== "zona" && it.type !== "muro") types[CAT[it.type] ? it.type : "tavolo"] = 1; });
      var keys = Object.keys(types), ly = H - legendH + m * 0.5, lx = m, fs2 = Math.max(11, Math.round(legendH * 0.16));
      ctx.font = "500 " + fs2 + "px Inter,'Segoe UI',Arial,sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      keys.forEach(function (k) {
        var t = (CAT[k][4] ? CAT[k][4] + " " : "") + CAT[k][0], tw2 = ctx.measureText(t).width + 22;
        if (lx + tw2 > W - m) { lx = m; ly += fs2 * 1.6; }
        ctx.fillStyle = CAT[k][3]; ctx.fillRect(lx, ly - 6, 12, 12); ctx.fillStyle = C.ink; ctx.fillText(t, lx + 16, ly); lx += tw2 + 12;
      });
      ctx.fillStyle = C.mut; ctx.fillRect(W - m - sc, H - m * 0.9, sc, 3); ctx.textAlign = "right"; ctx.fillText("1 m", W - m - sc - 6, H - m * 0.9);
    }
    ctx.restore();
    return { ox: ox, oy: oy, sc: sc };
  }

  /* ---------- editor ---------- */
  var view = "2d", sel = null, geo = null, drag = null, three = null;
  function selItem() { return sel && sala().items.filter(function (i) { return i.id === sel.item; })[0]; }
  function redraw() {
    var cv = $("salacv");
    if (cv && view === "2d") {
      var box = cv.parentElement, w = Math.max(320, box.clientWidth), h = Math.max(260, Math.round(w * Math.min(0.75, sala().h / sala().w + 0.08)));
      var dpr = window.devicePixelRatio || 1; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
      var g = draw(cv, { sel: sel }); geo = { ox: g.ox / dpr, oy: g.oy / dpr, sc: g.sc / dpr };
    }
    if (three && view === "3d") three.rebuild();
    mapImg();
  }
  var imgT = null;
  function mapImg() {
    clearTimeout(imgT);
    imgT = setTimeout(function () {
      var im = $("salaimg"); if (!im) return;
      if (!sala().items.length) { im.removeAttribute("src"); return; }
      var cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1000; draw(cv, { legend: true }); im.src = cv.toDataURL("image/png");
    }, 200);
  }
  function toRoom(e) { var cv = $("salacv"), r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - geo.ox) / geo.sc, y: (e.clientY - r.top - geo.oy) / geo.sc }; }
  function hit(pt) {
    var S2 = allSeats();
    for (var i = S2.length - 1; i >= 0; i--) { var st = S2[i], l = local({ x: st.x, y: st.y, rot: st.rot }, pt.x, pt.y); if (Math.abs(l.x) <= DESK_W / 2 && Math.abs(l.y) <= DESK_D / 2) return { item: st.row, seat: st.id }; }
    var it = sala().items.slice().reverse().filter(function (x) { var z = size(x), l2 = local(x, pt.x, pt.y); return Math.abs(l2.x) <= z.w / 2 + 0.1 && Math.abs(l2.y) <= z.h / 2 + 0.1; });
    it.sort(function (a, b) { return (a.type === "zona") - (b.type === "zona"); });
    return it[0] ? { item: it[0].id } : null;
  }
  function snap(v) { return Math.round(v * 4) / 4; }
  function clampIt(it) { var z = size(it), X = sala(); it.x = Math.max(0, Math.min(X.w, it.x)); it.y = Math.max(0, Math.min(X.h, it.y)); return it; }
  function select(s) { sel = s; redraw(); paintProps(); paintTableKeep(); }
  function addItem(type, at) {
    var pre = PRESET[type], X = sala(); if (pre) type = "fila"; var c = CAT[type]; if (!c) return;
    var it = { id: "o" + (X.seq++), type: type, x: X.w / 2, y: X.h / 2, rot: 0 };
    if (type === "fila") { it.name = nextRowName(); it.n = pre ? pre[1] : 8; it.double = false; it.ipBase = "192.168.1."; it.ipStart = nextIp(it.n, it.ipBase); it.y = Math.min(X.h - 1, 2 + X.items.filter(function (x) { return x.type === "fila"; }).length * 2.4); }
    if (type === "maxi") it.y = 0.4;
    else if (type !== "fila") { var fr = freeSpot(size(it)); it.x = fr.x; it.y = fr.y; }
    if (pre && !at) { var fp = freeSpot(size(it)); it.x = fp.x; it.y = fp.y; }
    if (at) { it.x = snap(at.x); it.y = snap(at.y); clampIt(it); }
    X.items.push(it); save(); select({ item: it.id });
  }
  /* copia di un oggetto: in un punto preciso (doppio clic) o accanto all'originale */
  function cloneItem(src, at) {
    var X = sala(), c = JSON.parse(JSON.stringify(src)); c.id = "o" + (X.seq++);
    if (c.type === "fila") { c.name = nextRowName(); c.ipStart = nextIp(seats(c).length, c.ipBase); }
    if (at) { c.x = snap(at.x); c.y = snap(at.y); }
    else if (c.type === "fila") { c.y = Math.min(X.h - 1, src.y + (src.double ? 2.4 : 1.6)); c.x = src.x; }
    else { c.x += 1; c.y += 1; }
    X.items.push(clampIt(c)); save(); select({ item: c.id });
  }
  /* primo posto libero (passo di mezzo metro) dove l'oggetto non si sovrappone agli altri */
  function freeSpot(z) {
    var X = sala(), boxes = X.items.map(function (o) { var q = size(o), r = Math.abs(Math.sin(rad(o.rot))) > 0.5; return { x: o.x, y: o.y, w: (r ? q.h : q.w) / 2 + 0.3, h: (r ? q.w : q.h) / 2 + 0.3 }; });
    for (var y = z.h / 2 + 0.5; y <= X.h - z.h / 2; y += 0.5) for (var x = z.w / 2 + 0.5; x <= X.w - z.w / 2; x += 0.5) {
      if (!boxes.some(function (b) { return Math.abs(b.x - x) < b.w + z.w / 2 && Math.abs(b.y - y) < b.h + z.h / 2; })) return { x: x, y: y };
    }
    return { x: X.w / 2, y: X.h / 2 };
  }
  function delItem(id) {
    var X = sala(), it = X.items.filter(function (i) { return i.id === id; })[0]; if (!it) return;
    if (A.delSnap) A.delSnap((T(cat(it.type)[0]) + " " + (it.name || it.label || "")).trim());
    seats(it).forEach(function (st) { delete X.st[st.id]; });
    X.items = X.items.filter(function (i) { return i.id !== id; }); sel = null; save(); select(null);
  }

  /* menu del tasto destro sulla pianta */
  var keepSel = null;
  function hideMenu() { var m = $("salamenu"); if (m) m.remove(); document.removeEventListener("pointerdown", menuAway, true); document.removeEventListener("keydown", menuKey, true); window.removeEventListener("blur", hideMenu); window.removeEventListener("scroll", hideMenu, true); }
  function menuAway(e) { if (!e.target.closest || !e.target.closest("#salamenu")) hideMenu(); }
  function menuKey(e) {
    var m = $("salamenu"); if (!m) return;
    var B = [].slice.call(m.querySelectorAll("button")), i = B.indexOf(document.activeElement);
    if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); hideMenu(); var cv = $("salacv"); if (cv) cv.focus(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); var dn = e.key === "ArrowDown"; B[i < 0 ? (dn ? 0 : B.length - 1) : (i + (dn ? 1 : B.length - 1)) % B.length].focus(); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); B[e.key === "Home" ? 0 : B.length - 1].focus(); }
  }
  function showMenu(x, y) {
    hideMenu(); var it = selItem(); if (!it) return;
    var m = document.createElement("div"); m.id = "salamenu"; m.className = "sl-menu"; m.setAttribute("role", "menu");
    m.innerHTML = [["rot90", "Ruota 90° →"], ["rot-90", "Ruota 90° ←"], ["dup", "Clona"], ["del", "Elimina"]].map(function (b) { return '<button type="button" role="menuitem" data-sm="' + b[0] + '">' + esc(T(b[1])) + '</button>'; }).join("");
    document.body.appendChild(m);
    var r = m.getBoundingClientRect(); m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + "px"; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + "px";
    m.addEventListener("click", function (e) { var b = e.target.closest("[data-sm]"); if (!b) return; var a = b.getAttribute("data-sm"); hideMenu(); onAction(a); var cv = $("salacv"); if (cv) cv.focus(); });
    /* il tasto Menu di Windows manda il contextmenu al rilascio, sul pulsante del menu che ha il focus: niente menu del browser sopra il nostro */
    m.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    setTimeout(function () { if (!m.isConnected) return; document.addEventListener("pointerdown", menuAway, true); document.addEventListener("keydown", menuKey, true); window.addEventListener("blur", hideMenu); window.addEventListener("scroll", hideMenu, true); }, 0);
    m.querySelector("button").focus();
  }

  /* pannello delle proprietà */
  function opt(v, cur, l) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + esc(l) + "</option>"; }
  function playersOpts(cur) {
    var R = A.S().roster || [], used = {}; Object.keys(sala().st).forEach(function (k) { if (sala().st[k].player) used[sala().st[k].player] = k; });
    return opt("", cur, "— " + T("libera") + " —") + R.map(function (p) { return opt(p, cur, p + (used[p] && used[p] !== (sel && sel.seat) ? " (" + used[p] + ")" : "")); }).join("");
  }
  function paintProps() {
    var el = $("salaprops"); if (!el) return;
    var it = selItem(), h = "", X = sala(), cur = sel && !sel.seat ? sel.item : "";
    /* elenco degli oggetti: per selezionarli anche da tastiera, non solo cliccando sulla pianta */
    var pick = X.items.length ? '<label>' + esc(T("Oggetto")) + '<select id="salasel">' + opt("", cur, "—") + X.items.map(function (o) { var c0 = cat(o.type); return opt(o.id, cur, (c0[4] ? c0[4] + " " : "") + T(c0[0]) + (o.name || o.label ? " " + (o.name || o.label) : "")); }).join("") + '</select></label>' : "";
    if (!it) h = '<p class="hint" style="margin:0">' + esc(T("Clicca un oggetto o una postazione nella pianta per modificarla, oppure aggiungi un oggetto qui sopra.")) + '</p>';
    else if (sel.seat) {
      var st = sala().st[sel.seat] || {}, ip = st.ip || "", p = PING[ip];
      h = '<h3>' + esc(T("Postazione")) + ' ' + esc(sel.seat) + '</h3>' +
        '<label>' + esc(T("Giocatore")) + '<select data-sp="player">' + playersOpts(st.player || "") + '</select></label>' +
        '<label>' + esc(T("Indirizzo IP o nome del PC")) + '<input type="text" data-sp="ip" value="' + esc(ip) + '" placeholder="192.168.1.101" spellcheck="false"></label>' +
        '<label>' + esc(T("Nota")) + '<input type="text" data-sp="note" value="' + esc(st.note || "") + '" maxlength="80"></label>' +
        '<p class="' + statCls(p) + '">' + esc(propStat(p)) + '</p>' +
        '<div class="row"><button type="button" data-sa="ping1">' + esc(T("Ping")) + '</button><button type="button" data-sa="row">' + esc(T("Modifica la fila")) + '</button></div>';
    } else {
      var c = cat(it.type), z = size(it);
      h = '<h3>' + esc(T(c[0])) + '</h3>';
      if (it.type === "fila") {
        h += '<div class="sp2"><label>' + esc(T("Lettera della fila")) + '<input type="text" data-sp="name" value="' + esc(it.name || "") + '" maxlength="3"></label>' +
          '<label>' + esc(T("Postazioni per lato")) + '<input type="number" data-sp="n" min="1" max="60" value="' + (it.n || 8) + '"></label></div>' +
          '<label class="chk"><input type="checkbox" data-sp="double"' + (it.double ? " checked" : "") + '> ' + esc(T("Fila doppia (postazioni una di fronte all'altra)")) + '</label>' +
          '<div class="sp2"><label>' + esc(T("IP di partenza")) + '<input type="text" data-sp="ipBase" value="' + esc(it.ipBase || "192.168.1.") + '" spellcheck="false"></label>' +
          '<label>' + esc(T("dal numero")) + '<input type="number" data-sp="ipStart" min="1" max="254" value="' + (it.ipStart || 101) + '"></label></div>' +
          '<div class="row"><button type="button" data-sa="numip">' + esc(T("Numera gli IP della fila")) + '</button><button type="button" data-sa="fillrow">' + esc(T("Metti i giocatori in ordine")) + '</button></div>';
      } else {
        h += '<label>' + esc(T("Nome sulla mappa")) + '<input type="text" data-sp="label" value="' + esc(it.label || "") + '" maxlength="40" placeholder="' + esc(T(c[0])) + '"></label>' +
          '<div class="sp2"><label>' + esc(T("Larghezza (m)")) + '<input type="number" data-sp="w" min="0.2" max="60" step="0.1" value="' + z.w + '"></label>' +
          '<label>' + esc(T("Profondità (m)")) + '<input type="number" data-sp="h" min="0.1" max="60" step="0.1" value="' + z.h + '"></label></div>';
      }
      h += '<div class="sp2"><label>X (m)<input type="number" data-sp="x" step="0.25" value="' + it.x + '"></label><label>Y (m)<input type="number" data-sp="y" step="0.25" value="' + it.y + '"></label></div>' +
        '<label>' + esc(T("Rotazione")) + '<span class="row"><button type="button" data-sa="rot-15">⟲ 15°</button><button type="button" data-sa="rot90">⟳ 90°</button><button type="button" data-sa="rot15">⟳ 15°</button><span class="hint" style="margin:0">' + (it.rot || 0) + '°</span></span></label>' +
        '<div class="row"><button type="button" data-sa="dup">' + esc(T("Duplica")) + '</button><button type="button" data-sa="del">' + esc(T("Elimina")) + '</button></div>';
    }
    el.innerHTML = pick + h;
  }
  function onProp(e) {
    var t = e.target, k = t.getAttribute("data-sp"); if (!k) return;
    var it = selItem(); if (!it) return;
    if (sel.seat) {
      var X = sala(), st = X.st[sel.seat] || (X.st[sel.seat] = {}), v = String(t.value || "").trim();
      if (k === "player" && v) Object.keys(X.st).forEach(function (s) { if (s !== sel.seat && X.st[s].player === v) delete X.st[s].player; });
      if (v) st[k] = v.slice(0, 80); else delete st[k];
      save(); redraw(); paintTable(); return;
    }
    if (k === "double" || k === "name" || k === "n") {
      /* lettera, postazioni per lato e fila doppia cambiano gli id delle postazioni: prima si controlla
         che non finiscano su quelli di un'altra fila, poi le assegnazioni seguono lato e posizione */
      var old = seats(it), cand = JSON.parse(JSON.stringify(it));
      cand[k] = k === "double" ? t.checked : k === "name" ? String(t.value || "A").trim().toUpperCase().slice(0, 3) || "A" : Math.max(1, Math.min(60, parseInt(t.value, 10) || 8));
      if (seatClash(it, cand)) { toast(T("Le postazioni avrebbero gli stessi numeri di quelle di un'altra fila: scegli un'altra lettera.")); paintProps(); return; }
      var X2 = sala(), now = {}; seats(cand).forEach(function (s) { now[s.side + ":" + s.pos] = 1; });
      if (A.delSnap && old.some(function (s) { return !now[s.side + ":" + s.pos] && X2.st[s.id] && Object.keys(X2.st[s.id]).length; })) A.delSnap((T(CAT.fila[0]) + " " + (it.name || "A")).trim());
      it[k] = cand[k]; renameSeats(old, seats(it));
    }
    else if (k === "ipBase") it.ipBase = String(t.value || "").trim();
    else if (k === "label") it.label = String(t.value || "").trim();
    else { var n = parseFloat(String(t.value).replace(",", ".")); if (!isNaN(n)) it[k] = k === "ipStart" ? Math.max(1, Math.min(254, Math.round(n))) : Math.round(n * 100) / 100; }
    clampIt(it); save(); redraw(); if (k !== "label" && k !== "x" && k !== "y" && k !== "w" && k !== "h") paintTable();
  }
  /* rinominare, allungare o accorciare una fila, o farla singola/doppia: le assegnazioni seguono la postazione
     per lato e posizione (nella fila doppia il secondo lato comincia da n+1); quelle dei posti spariti si tolgono */
  function renameSeats(oldL, newL) {
    var X = sala(), keep = {};
    oldL.forEach(function (s) { if (X.st[s.id]) keep[s.side + ":" + s.pos] = X.st[s.id]; delete X.st[s.id]; });
    newL.forEach(function (s) { var v = keep[s.side + ":" + s.pos]; if (v) X.st[s.id] = v; });
  }
  /* gli id delle postazioni (lettera + numero) devono restare unici: il posto 11 di "A" e il posto 1 di "A1" sono entrambi A11 */
  function seatClash(it, cand) {
    var mine = {}; seats(cand).forEach(function (s) { mine[s.id] = 1; });
    return sala().items.some(function (o) { return o.id !== it.id && seats(o).some(function (s) { return mine[s.id]; }); });
  }
  function onAction(a) {
    var it = selItem(), X = sala();
    if (a === "del" && it) return delItem(it.id);
    if (a === "dup" && it) return cloneItem(it);
    if (/^rot/.test(a) && it) { it.rot = (((it.rot || 0) + parseInt(a.slice(3), 10)) % 360 + 360) % 360; save(); redraw(); return paintProps(); }
    if (a === "row" && it) return select({ item: it.id });
    if (a === "numip" && it) {
      var base = it.ipBase || "192.168.1.", n0 = it.ipStart || 101, L0 = seats(it), mine = {}, other = {};
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.$/.test(base) && (n0 < 1 || n0 + L0.length - 1 > 254)) return toast(T("Gli IP della fila andrebbero oltre .254: cambia il numero di partenza."));
      L0.forEach(function (s) { mine[s.id] = 1; }); allSeats().forEach(function (s) { var ip = ipOf(s.id); if (ip && !mine[s.id]) other[ip] = 1; });
      L0.forEach(function (s, i) { (X.st[s.id] = X.st[s.id] || {}).ip = base + (n0 + i); }); save(); redraw(); paintTable();
      return toast(L0.some(function (s, i) { return other[base + (n0 + i)]; }) ? T("IP numerati, ma alcuni sono già di altre postazioni: controlla la tabella.") : T("IP numerati da ") + base + n0 + ".");
    }
    if (a === "fillrow" && it) { fillPlayers(seats(it)); return; }
    if (a === "ping1" && sel && sel.seat) { var ip = ipOf(sel.seat); if (!ip) return toast(T("Scrivi prima l'indirizzo IP.")); if (!DESK || !DESK.salaPing) return toast(T("Il ping funziona solo nell'app installata.")); DESK.salaPing([ip]).then(function (r) { PING[ip] = Object.assign({ t: Date.now() }, r[ip]); redraw(); paintStats(); }); }
  }
  function fillPlayers(list) {
    var X = sala(), seated = {}; Object.keys(X.st).forEach(function (k) { if (X.st[k].player) seated[X.st[k].player] = 1; });
    var free = (A.S().roster || []).filter(function (p) { return !seated[p]; }), k2 = 0;
    list.forEach(function (s) { var st = X.st[s.id] = X.st[s.id] || {}; if (!st.player && free[k2]) st.player = free[k2++]; });
    save(); redraw(); paintTable(); paintProps(); toast(T("Giocatori assegnati: ") + k2 + ".");
  }

  /* ---------- tabella delle postazioni ---------- */
  function paintTable() {
    var el = $("salatab"); if (!el) return;
    var L = allSeats(), X = sala();
    if (!L.length) { el.innerHTML = '<p class="hint">' + esc(T("Nessuna postazione: aggiungi una fila di postazioni nella pianta.")) + '</p>'; return; }
    el.innerHTML = '<div class="sl-tw"><table class="res sl-t"><tr><th>' + esc(T("Postazione")) + '</th><th>' + esc(T("Giocatore")) + '</th><th>' + esc(T("IP o nome del PC")) + '</th><th>' + esc(T("Stato")) + '</th></tr>' +
      L.map(function (s) {
        var st = X.st[s.id] || {}, p = PING[st.ip || ""];
        return '<tr' + (sel && sel.seat === s.id ? ' class="on"' : "") + '><td><button type="button" class="linkbtn" data-seat="' + esc(s.id) + '">' + esc(s.id) + '</button></td>' +
          '<td><select data-tp="player" data-seat="' + esc(s.id) + '">' + playersOptsFor(s.id, st.player || "") + '</select></td>' +
          '<td><input type="text" data-tp="ip" data-seat="' + esc(s.id) + '" value="' + esc(st.ip || "") + '" spellcheck="false"></td>' +
          '<td class="' + statCls(p) + '" data-st="' + esc(s.id) + '">' + esc(seatStat(p)) + '</td></tr>';
      }).join("") + '</table></div>';
  }
  /* ridisegna la tabella e rimette il focus sul campo dove si trovava (stessa postazione, stesso campo):
     chi la usa da tastiera non ricomincia da capo a ogni riga */
  function paintTableKeep() {
    var el = $("salatab"), a = document.activeElement, f = el && a && a !== el && el.contains(a) ? { tag: a.tagName, tp: a.getAttribute("data-tp") || "", seat: a.getAttribute("data-seat") } : null;
    paintTable(); if (!f || !f.seat) return;
    var n = [].filter.call(el.querySelectorAll("[data-seat]"), function (x) { return x.tagName === f.tag && (x.getAttribute("data-tp") || "") === f.tp && x.getAttribute("data-seat") === f.seat; })[0];
    if (n) n.focus();
  }
  function playersOptsFor(seat, cur) { var keep = sel; sel = { seat: seat }; var o = playersOpts(cur); sel = keep; return o; }

  /* ---------- informazioni: Wi-Fi, server dei giochi, note ---------- */
  function paintInfo() {
    var el = $("salainfo"); if (!el) return;
    var X = sala(), DEF = A.DEF ? A.DEF() : {};
    el.innerHTML = '<h3>' + esc(T("Wi-Fi della LAN")) + '</h3><div class="row"><input type="text" data-ip="ssid" value="' + esc(X.wifi.ssid || "") + '" placeholder="' + esc(T("Nome della rete (SSID)")) + '">' +
      '<input type="text" data-ip="pass" value="' + esc(X.wifi.pass || "") + '" placeholder="' + esc(T("Password")) + '" spellcheck="false">' +
      '<select data-ip="sec">' + opt("WPA", X.wifi.sec, "WPA/WPA2/WPA3") + opt("WEP", X.wifi.sec, "WEP") + opt("nopass", X.wifi.sec, T("Aperta, senza password")) + '</select></div>' +
      '<h3 style="margin-top:16px">' + esc(T("Server dei giochi")) + '</h3>' +
      (X.servers.length ? '<div class="sl-tw"><table class="res sl-t"><tr><th>' + esc(T("Nome")) + '</th><th>' + esc(T("Gioco")) + '</th><th>' + esc(T("Indirizzo:porta")) + '</th><th>' + esc(T("Password")) + '</th><th>' + esc(T("Stato")) + '</th><th></th></tr>' +
        X.servers.map(function (sv, i) {
          var hostp = svPing(sv);
          return '<tr><td><input type="text" data-sv="name" data-i="' + i + '" value="' + esc(sv.name || "") + '" placeholder="Server ' + (i + 1) + '"></td>' +
            '<td><select data-sv="game" data-i="' + i + '">' + opt("", sv.game, "—") + Object.keys(DEF).map(function (k) { return opt(k, sv.game, DEF[k].l); }).join("") + '</select></td>' +
            '<td><input type="text" data-sv="addr" data-i="' + i + '" value="' + esc(sv.addr || "") + '" placeholder="192.168.1.10:27960" spellcheck="false"></td>' +
            '<td><input type="text" data-sv="pass" data-i="' + i + '" value="' + esc(sv.pass || "") + '" spellcheck="false"></td>' +
            '<td class="' + statCls(hostp) + '" data-svst="' + i + '">' + (hostp ? (hostp.ok ? "●" : "○") : "—") + '</td>' +
            '<td><button type="button" data-sa="svdel" data-i="' + i + '" aria-label="' + esc(T("Togli il server")) + '">✕</button></td></tr>';
        }).join("") + '</table></div>' : '<p class="hint">' + esc(T("Nessun server: aggiungi quelli dei giochi, con il nome che preferisci (Server 1, Server Alpha, Server Linux q3dm1...).")) + '</p>') +
      '<div class="row"><button type="button" data-sa="svadd">' + esc(T("Aggiungi un server")) + '</button></div>' +
      '<h3 style="margin-top:16px">' + esc(T("Informazioni per i partecipanti")) + '</h3><textarea data-ip="info" rows="3" maxlength="1500" placeholder="' + esc(T("Orari, regolamento, contatti, parcheggio...")) + '">' + esc(X.info || "") + '</textarea>';
  }
  function onInfo(e) {
    var t = e.target, X = sala(), k = t.getAttribute("data-ip"), sk = t.getAttribute("data-sv");
    if (k) { if (k === "info") X.info = t.value.slice(0, 1500); else X.wifi[k] = t.value.trim(); save(); return; }
    if (sk) { var sv = X.servers[+t.getAttribute("data-i")]; if (!sv) return; sv[sk] = t.value.trim().slice(0, 120); save(); }
  }

  /* ---------- kit PDF da stampare ---------- */
  function loadScript(src, test) { return test() ? Promise.resolve() : new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error(src)); }; document.head.appendChild(s); }); }
  function wifiString(w) { var q = function (s) { return String(s || "").replace(/([\\;,:"])/g, "\\$1"); }; return "WIFI:T:" + (w.sec || "WPA") + ";S:" + q(w.ssid) + ";" + (w.sec === "nopass" ? "" : "P:" + q(w.pass) + ";") + ";"; }
  function drawQR(ctx, text, x, y, size) {
    /* UTF-8: la codifica predefinita della libreria tiene solo il byte basso (SSID e password con è, €, cirillico, cinese...) */
    var Q = window.qrcode; if (Q.stringToBytesFuncs && Q.stringToBytesFuncs["UTF-8"]) Q.stringToBytes = Q.stringToBytesFuncs["UTF-8"];
    var qr = Q(0, "M"); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), cell = size / (n + 4); ctx.fillStyle = "#fff"; ctx.fillRect(x, y, size, size); ctx.fillStyle = "#000";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
  }
  function page() { var c = document.createElement("canvas"); c.width = 1240; c.height = 1754; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); return c; }
  /* tema attivo: colori, carattere del titolo e logo come nella testata dell'app */
  function themeOf() {
    var cs = getComputedStyle(document.documentElement), v = function (n, d) { return (cs.getPropertyValue(n) || "").trim() || d; };
    var h1 = document.querySelector(".brand h1"), em = document.querySelector(".brand img.emblem");
    var panel = v("--panel", "#1b1b1b");
    return { acc: v("--acc", "#ea580c"), b1: v("--b1", panel), b2: v("--b2", v("--bg", "#111")),
      font: h1 ? getComputedStyle(h1).fontFamily : "Inter,'Segoe UI',Arial,sans-serif", logo: em && em.complete && em.naturalWidth ? em : null };
  }
  /* chiaro o scuro: per scegliere il colore del testo sopra un colore del tema */
  function isDark(col) {
    var c = document.createElement("canvas").getContext("2d"); c.fillStyle = "#808080"; c.fillStyle = col; var f = c.fillStyle, r, g, b, m;
    if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(f))) { r = parseInt(m[1], 16); g = parseInt(m[2], 16); b = parseInt(m[3], 16); }
    else if ((m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(f))) { r = +m[1]; g = +m[2]; b = +m[3]; } else return true;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
  }
  function logoAt(ctx, img, x, y, size) {
    var k = Math.min(size / img.naturalWidth, size / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  }
  function head(ctx, title, sub) {
    var TH = themeOf(), lw = TH.logo ? 120 : 0;
    ctx.fillStyle = "#0f172a"; ctx.font = "800 54px Inter,'Segoe UI',Arial,sans-serif"; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillText(title, 80, 70, 1080 - lw);
    if (sub) { ctx.fillStyle = "#475569"; ctx.font = "500 28px Inter,'Segoe UI',Arial,sans-serif"; ctx.fillText(sub, 80, 140, 1080 - lw); }
    if (TH.logo) logoAt(ctx, TH.logo, 1160 - 104, 64, 104);
    ctx.fillStyle = TH.acc; ctx.fillRect(80, 185, 1080, 6);
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  /* cartellino da tavolo di una postazione: testata nei colori del tema (righe diagonali e barre come il banner),
     logo e titolo del torneo, numero della postazione, giocatore, IP e QR del Wi-Fi */
  function seatCard(ctx, x, y, w, h, id, st, TH, title, when, wifi) {
    var bh = 100, dark = isDark(TH.b1), ink = "#0f172a", mut = "#64748b";
    ctx.save();
    ctx.strokeStyle = "#cbd5e1"; ctx.setLineDash([8, 8]); ctx.lineWidth = 1.5; ctx.strokeRect(x - 8, y - 8, w + 16, h + 16); ctx.setLineDash([]);
    ctx.save(); rrect(ctx, x, y, w, h, 18); ctx.clip();
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = TH.b1; ctx.fillRect(x, y, w, bh);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, bh); ctx.clip(); ctx.strokeStyle = TH.b2; ctx.lineWidth = 9; ctx.globalAlpha = 0.9;
    for (var d = -bh; d < w + bh; d += 26) { ctx.beginPath(); ctx.moveTo(x + d, y + bh); ctx.lineTo(x + d + bh, y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = TH.acc; ctx.beginPath(); ctx.moveTo(x + w - 86, y + bh); ctx.lineTo(x + w - 50, y); ctx.lineTo(x + w - 32, y); ctx.lineTo(x + w - 68, y + bh); ctx.fill();
    ctx.fillStyle = dark ? "rgba(255,255,255,.55)" : "rgba(15,23,42,.35)"; ctx.beginPath(); ctx.moveTo(x + w - 50, y + bh); ctx.lineTo(x + w - 14, y); ctx.lineTo(x + w - 4, y); ctx.lineTo(x + w - 40, y + bh); ctx.fill();
    ctx.restore();
    ctx.fillStyle = TH.acc; ctx.fillRect(x, y + bh, w, 7);
    var lx = x + 18;
    if (TH.logo) { logoAt(ctx, TH.logo, lx, y + 12, bh - 24); lx += bh - 24 + 14; }
    var tw = x + w - 100 - lx, fs = 36;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    do { ctx.font = "800 " + fs + "px " + TH.font; fs -= 2; } while (ctx.measureText(title).width > tw && fs > 20);
    ctx.fillStyle = dark ? "#fff" : ink; ctx.fillText(title, lx, y + bh / 2 - (when ? 12 : 0), tw);
    if (when) { ctx.font = "600 19px Inter,'Segoe UI',Arial,sans-serif"; ctx.fillStyle = dark ? "rgba(255,255,255,.8)" : mut; ctx.fillText(when, lx, y + bh / 2 + 22, tw); }
    ctx.textBaseline = "top";
    var qr = wifi && wifi.ssid ? 132 : 0, by = y + bh + 7;
    ctx.fillStyle = mut; ctx.font = "600 20px Inter,'Segoe UI',Arial,sans-serif"; ctx.fillText("Postazione", x + 26, by + 14, w - 60);
    ctx.fillStyle = TH.acc; ctx.font = "900 128px " + TH.font; ctx.fillText(id, x + 22, by + 36, w - 52 - qr);
    ctx.fillStyle = ink; ctx.font = "800 42px Inter,'Segoe UI',Arial,sans-serif"; ctx.fillText(K(st.player || ""), x + 26, by + 174, w - 52 - (qr ? qr + 10 : 0));
    if (st.ip) { ctx.fillStyle = "#475569"; ctx.font = "500 24px ui-monospace,Consolas,monospace"; ctx.fillText("IP " + K(st.ip), x + 26, y + h - 42, w - 60 - qr); }
    if (qr) {
      drawQR(ctx, wifiString(wifi), x + w - qr - 14, y + h - qr - 14, qr);
      ctx.fillStyle = mut; ctx.font = "600 17px Inter,'Segoe UI',Arial,sans-serif"; ctx.textAlign = "center"; ctx.fillText("Wi-Fi " + K(wifi.ssid), x + w - qr / 2 - 14, y + h - qr - 38, qr + 20); ctx.textAlign = "left";
    }
    ctx.restore();
    rrect(ctx, x, y, w, h, 18); ctx.strokeStyle = TH.acc; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  /* testo a capo: solo le righe, senza disegnarle (chi disegna sceglie anche la pagina); spezza le parole più larghe della riga (URL) */
  function wrapLines(ctx, text, maxW) {
    var out = [], mw = function (s) { return ctx.measureText(K(s)).width; };
    String(text || "").split(/\n/).forEach(function (par) {
      var line = "";
      par.split(" ").forEach(function (w) {
        while (w.length > 1 && mw(w) > maxW) { var k = w.length - 1; while (k > 1 && mw(w.slice(0, k)) > maxW) k--; if (line) { out.push(line); line = ""; } out.push(w.slice(0, k)); w = w.slice(k); }
        var t = line ? line + " " + w : w;
        if (mw(t) > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }
  function buildKit(parts) {
    var X = sala(), S0 = A.S(), title = (S0.ui && S0.ui.title) || A.ui0.title, pages = [], when = A.evWhen ? A.evWhen() : "", KT = K(title), sub = KT + (when ? " · " + when : "");
    if (parts.map && X.items.length) {
      var p = page(), ctx = p.getContext("2d"); head(ctx, "Mappa della sala", sub);
      var mc = document.createElement("canvas"); mc.width = 1080; mc.height = 1400; draw(mc, { print: true, legend: true }); ctx.drawImage(mc, 80, 230); pages.push(p);
    }
    var L = allSeats();
    if (parts.seats && L.length) {
      for (var i0 = 0; i0 < L.length; i0 += 34) {
        var p2 = page(), c2 = p2.getContext("2d"); head(c2, "Postazioni", KT);
        c2.font = "700 26px Inter,'Segoe UI',Arial,sans-serif"; c2.fillStyle = "#0f172a"; c2.fillText("Postazione", 80, 220); c2.fillText("Giocatore", 330, 220); c2.fillText("IP o nome del PC", 800, 220);
        L.slice(i0, i0 + 34).forEach(function (s, j) {
          var st = X.st[s.id] || {}, y = 270 + j * 42; if (j % 2) { c2.fillStyle = "#f1f5f9"; c2.fillRect(70, y - 8, 1100, 42); }
          c2.fillStyle = "#0f172a"; c2.font = "700 26px Inter,'Segoe UI',Arial,sans-serif"; c2.fillText(s.id, 80, y);
          c2.font = "500 26px Inter,'Segoe UI',Arial,sans-serif"; c2.fillText(st.player ? K(st.player) : "—", 330, y, 450); c2.fillText(K(st.ip || ""), 800, y, 360);
        });
        pages.push(p2);
      }
    }
    if (parts.info) {
      /* pagina "Informazioni": se un blocco non entra più si continua su una pagina nuova con la stessa testata */
      var p3 = page(), c3 = p3.getContext("2d"), y3 = 230, BOT = 1754 - 80, INK = "#0f172a"; head(c3, "Informazioni", sub);
      var room = function (hh) { if (y3 + hh <= BOT) return; pages.push(p3); p3 = page(); c3 = p3.getContext("2d"); head(c3, "Informazioni", sub); c3.fillStyle = INK; y3 = 230; };
      if (X.wifi.ssid) {
        drawQR(c3, wifiString(X.wifi), 80, y3, 340);
        c3.fillStyle = INK; c3.font = "800 40px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText("Wi-Fi", 460, y3 + 10);
        c3.font = "500 30px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText("Rete" + ": " + K(X.wifi.ssid), 460, y3 + 80, 700);
        if (X.wifi.pass && X.wifi.sec !== "nopass") c3.fillText("Password" + ": " + K(X.wifi.pass), 460, y3 + 130, 700);
        c3.fillStyle = "#475569"; c3.font = "400 24px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText("Inquadra il codice con la fotocamera per collegarti.", 460, y3 + 190, 700);
        y3 += 380;
      }
      var links = (S0.ev || {}), bot = A.botLink ? A.botLink() : "";
      var qrs = [[bot, "Telegram"], [links.wa, "WhatsApp"], [links.maps || "", "Mappa"]].filter(function (q) { return q[0]; });
      if (qrs.length) room(310);
      qrs.forEach(function (q, i) { drawQR(c3, q[0], 80 + i * 370, y3, 260); c3.fillStyle = INK; c3.font = "700 26px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText(q[1], 80 + i * 370, y3 + 275, 300); });
      if (qrs.length) y3 += 340;
      if (X.servers.length) {
        room(60 + 86); c3.fillStyle = INK; c3.font = "800 36px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText("Server dei giochi", 80, y3); y3 += 60;
        var DEF = A.DEF ? A.DEF() : {};
        X.servers.forEach(function (sv) {
          room(sv.pass ? 86 : 50); c3.fillStyle = INK;
          c3.font = "700 28px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText(K(sv.name || "Server") + (sv.game && DEF[sv.game] ? " – " + DEF[sv.game].l : ""), 80, y3, 700);
          c3.font = "500 28px ui-monospace,Consolas,monospace"; c3.fillText(K(sv.addr || ""), 800, y3, 360);
          if (sv.pass) { c3.font = "400 24px Inter,'Segoe UI',Arial,sans-serif"; c3.fillStyle = "#475569"; c3.fillText("Password" + ": " + K(sv.pass), 80, y3 + 36, 1000); c3.fillStyle = INK; y3 += 36; }
          y3 += 50;
        });
        y3 += 20;
      }
      if (X.info) {
        room(60 + 40); c3.fillStyle = INK; c3.font = "800 36px Inter,'Segoe UI',Arial,sans-serif"; c3.fillText("Informazioni per i partecipanti", 80, y3); y3 += 60;
        c3.font = "400 28px Inter,'Segoe UI',Arial,sans-serif";
        wrapLines(c3, X.info, 1080).forEach(function (ln) { room(40); c3.font = "400 28px Inter,'Segoe UI',Arial,sans-serif"; c3.fillStyle = INK; if (ln) c3.fillText(K(ln), 80, y3); y3 += 40; });
      }
      pages.push(p3);
    }
    if (parts.cards && L.length) {
      var TH = themeOf();
      for (var i1 = 0; i1 < L.length; i1 += 8) {
        var p4 = page(), c4 = p4.getContext("2d");
        L.slice(i1, i1 + 8).forEach(function (s, j) {
          seatCard(c4, 70 + (j % 2) * 560, 62 + Math.floor(j / 2) * 410, 540, 380, s.id, X.st[s.id] || {}, TH, KT, when, X.wifi);
        });
        pages.push(p4);
      }
    }
    return pages;
  }
  function printKit() {
    var f = $("salakit"), parts = { map: f.querySelector("[data-k=map]").checked, seats: f.querySelector("[data-k=seats]").checked, info: f.querySelector("[data-k=info]").checked, cards: f.querySelector("[data-k=cards]").checked };
    loadScript("js/vendor/qrcode.js", function () { return !!window.qrcode; }).then(function () {
      var pages = buildKit(parts);
      if (!pages.length) return toast(T("Niente da stampare: disegna la sala o aggiungi le informazioni."));
      var name = "kit-sala-" + String((A.S().ui && A.S().ui.title) || A.ui0.title).replace(/[^\w-]+/g, "-").slice(0, 40) + ".pdf";
      A.dl(A.makePdf(pages), name); toast(T("PDF pronto: ") + pages.length + T(" pagine.") );
    }).catch(function () { toast(T("Non riesco a creare il PDF.")); });
  }

  /* ---------- vista 3D (Three.js caricato solo qui) ---------- */
  function start3d(box) {
    return loadScript("js/vendor/three.js", function () { return !!window.THREE; }).then(function () {
      /* la pagina è già stata ridisegnata mentre si caricava lo script: questa vista non serve più */
      if (!box.isConnected) return;
      if (three) three.stop();
      var TH = window.THREE, X = sala();
      var r = new TH.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(window.devicePixelRatio || 1);
      box.innerHTML = ""; box.appendChild(r.domElement);
      var scene = new TH.Scene(), C = themeColors(false); scene.background = new TH.Color(C.bg);
      var cam = new TH.PerspectiveCamera(45, 1, 0.1, 500);
      var ctl = new TH.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.49;
      scene.add(new TH.HemisphereLight(0xffffff, 0x444444, 1.1)); var dl = new TH.DirectionalLight(0xffffff, 1.2); dl.position.set(10, 20, 8); scene.add(dl);
      var group = new TH.Group(); scene.add(group);
      var floor = null, pickables = [], objs = {}, hl = null;
      function label(text, color, scale) {
        var c = document.createElement("canvas"), x = c.getContext("2d"); c.width = 256; c.height = 64; x.font = "700 34px Inter,'Segoe UI',Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
        x.fillStyle = "rgba(0,0,0,.55)"; var w = Math.min(250, x.measureText(text).width + 24); x.fillRect(128 - w / 2, 8, w, 48); x.fillStyle = color || "#fff"; x.fillText(text, 128, 33, 240);
        var sp = new TH.Sprite(new TH.SpriteMaterial({ map: new TH.CanvasTexture(c), depthTest: false })); sp.scale.set(2 * (scale || 1), 0.5 * (scale || 1), 1); sp.renderOrder = 10; return sp;
      }
      function box3(w, h, d, color, opa) { var m = new TH.Mesh(new TH.BoxGeometry(w, h, d), new TH.MeshStandardMaterial({ color: color, transparent: opa < 1, opacity: opa || 1 })); return m; }
      /* libera geometrie, materiali e texture (la geometria degli sprite è una sola, condivisa: non si tocca) */
      function disposeTree(o) { o.traverse(function (n) { if (n.geometry && !n.isSprite) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); }); }); }
      function rebuild() {
        X = sala(); while (group.children.length) { var ch = group.children[0]; group.remove(ch); disposeTree(ch); } pickables = []; objs = {}; hl = null;
        floor = new TH.Mesh(new TH.PlaneGeometry(X.w, X.h), new TH.MeshStandardMaterial({ color: new TH.Color(C.floor) })); floor.rotation.x = -Math.PI / 2; floor.position.set(X.w / 2, 0, X.h / 2); group.add(floor);
        var grid = new TH.GridHelper(Math.max(X.w, X.h), Math.max(X.w, X.h), 0x666666, 0x444444); grid.position.set(Math.max(X.w, X.h) / 2, 0.005, Math.max(X.w, X.h) / 2); grid.material.opacity = 0.25; grid.material.transparent = true; group.add(grid);
        /* pareti basse sul perimetro */
        [[X.w / 2, 0, X.w, 0.1], [X.w / 2, X.h, X.w, 0.1], [0, X.h / 2, 0.1, X.h], [X.w, X.h / 2, 0.1, X.h]].forEach(function (wl) { var m = box3(wl[2], 0.6, wl[3], 0x9ca3af, 0.5); m.position.set(wl[0], 0.3, wl[1]); group.add(m); });
        X.items.forEach(function (it) {
          var c = CAT[it.type] || CAT.tavolo, z = size(it), hgt = c[5], g = new TH.Group(); g.position.set(it.x, 0, it.y); g.rotation.y = -rad(it.rot); g.userData = { item: it.id };
          if (it.type === "fila") {
            seats(it).forEach(function (st) {
              var a = X.st[st.id] || {}, stt = statusOf(st.id), col = sel && sel.seat === st.id ? C.acc : stt === "on" ? "#16a34a" : stt === "off" ? "#b91c1c" : a.player ? "#2563eb" : "#cbd5e1";
              var dsk = box3(DESK_W, 0.05, DESK_D, col); dsk.position.set(st.x, 0.75, st.y); dsk.userData = { item: it.id, seat: st.id };
              var mon = box3(0.55, 0.32, 0.04, 0x111111); var off = rad(st.rot); mon.position.set(st.x + Math.sin(off) * 0.22, 0.98, st.y - Math.cos(off) * 0.22); mon.rotation.y = -off; mon.userData = dsk.userData;
              var leg = box3(DESK_W * 0.9, 0.72, 0.05, 0x334155); leg.position.set(st.x, 0.37, st.y); leg.rotation.y = -off; leg.userData = dsk.userData;
              dsk.rotation.y = -off; group.add(dsk); group.add(mon); group.add(leg); pickables.push(dsk, mon);
              var lb = label(st.id + (a.player ? " · " + K(a.player) : ""), "#fff", 0.8); lb.position.set(st.x, 1.45, st.y); group.add(lb);
            });
            return;
          }
          var m;
          if (it.type === "zona") { m = new TH.Mesh(new TH.PlaneGeometry(z.w, z.h), new TH.MeshBasicMaterial({ color: new TH.Color(it.color || c[3]), transparent: true, opacity: 0.25 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.01; }
          else if (it.type === "estintore") { m = new TH.Mesh(new TH.CylinderGeometry(0.12, 0.12, 0.6, 16), new TH.MeshStandardMaterial({ color: c[3] })); m.position.y = 0.3; }
          else if (it.type === "maxi") { m = box3(z.w, z.w * 0.56, 0.1, 0x111827); m.position.y = 1.4 + z.w * 0.28; var st2 = box3(0.1, 1.4, 0.1, 0x374151); st2.position.y = 0.7; g.add(st2); }
          else if (it.type === "podio") {
            [[0, 0.5], [-z.w / 3, 0.35], [z.w / 3, 0.22]].forEach(function (pp, i) { var b = box3(z.w / 3, pp[1], z.h, ["#eab308", "#94a3b8", "#b45309"][i]); b.position.set(pp[0], pp[1] / 2, 0); b.userData = { item: it.id }; g.add(b); pickables.push(b); });
          }
          else { m = box3(z.w, hgt, z.h, it.color || c[3], it.type === "bagni" || it.type === "guardaroba" ? 0.55 : 1); m.position.y = hgt / 2; }
          if (m) { m.userData = { item: it.id }; g.add(m); pickables.push(m); }
          if (sel && sel.item === it.id && !sel.seat) { hl = new TH.BoxHelper(g, new TH.Color(C.acc)); group.add(hl); }
          var lb2 = label((c[4] ? c[4] + " " : "") + (it.label ? K(it.label) : c[0]), "#fff", 1); lb2.position.set(0, Math.max(hgt, 0.4) + 0.5, 0); g.add(lb2);
          objs[it.id] = g; group.add(g);
        });
        group.updateMatrixWorld(true);
      }
      function resize() { var w = box.clientWidth || 600, h = Math.max(320, Math.round(w * 0.6)); r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      cam.position.set(X.w / 2, Math.max(X.w, X.h) * 0.55, X.h * 1.1); ctl.target.set(X.w / 2, 0, X.h / 2);
      var ray = new TH.Raycaster(), mv = new TH.Vector2(), plane = new TH.Plane(new TH.Vector3(0, 1, 0), 0), pt = new TH.Vector3(), dragging = null;
      function pick(e) { var rc = r.domElement.getBoundingClientRect(); mv.x = (e.clientX - rc.left) / rc.width * 2 - 1; mv.y = -(e.clientY - rc.top) / rc.height * 2 + 1; ray.setFromCamera(mv, cam); }
      r.domElement.addEventListener("pointerdown", function (e) {
        pick(e); var h = ray.intersectObjects(pickables, false)[0];
        if (!h) return;
        var ud = h.object.userData; select(ud.seat ? { item: ud.item, seat: ud.seat } : { item: ud.item });
        if (!ud.seat) { var it = selItem(); if (it && ray.ray.intersectPlane(plane, pt)) { dragging = { it: it, dx: it.x - pt.x, dy: it.y - pt.z }; ctl.enabled = false; r.domElement.setPointerCapture(e.pointerId); } }
      });
      r.domElement.addEventListener("pointermove", function (e) {
        if (!dragging) return; pick(e); if (!ray.ray.intersectPlane(plane, pt)) return;
        dragging.it.x = snap(pt.x + dragging.dx); dragging.it.y = snap(pt.z + dragging.dy); clampIt(dragging.it);
        /* durante il trascinamento si sposta solo l'oggetto; la scena si ricostruisce al rilascio */
        var g = objs[dragging.it.id]; if (g) { g.position.set(dragging.it.x, 0, dragging.it.y); if (hl) hl.update(); }
      });
      r.domElement.addEventListener("pointerup", function () { if (dragging) { dragging = null; ctl.enabled = true; rebuild(); save(); mapImg(); paintProps(); } });
      /* una sola vista viva: alla chiusura si tolgono listener, controlli, risorse e contesto WebGL,
         e il riferimento globale si azzera solo se è ancora questa vista (non quella nuova) */
      var alive = true, me = null;
      function stop() {
        if (!alive) return; alive = false;
        window.removeEventListener("resize", resize); if (ctl.dispose) ctl.dispose();
        disposeTree(scene); r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
        if (three === me) three = null;
      }
      window.addEventListener("resize", resize); resize(); rebuild();
      three = me = { rebuild: rebuild, stop: stop };
      /* con la scheda Sala nascosta non si disegna */
      (function loop() { if (!alive) return; if (!box.isConnected) return stop(); if (box.offsetParent !== null) { ctl.update(); r.render(scene, cam); } requestAnimationFrame(loop); })();
    }).catch(function () { toast(T("Non riesco a caricare la vista 3D.")); });
  }

  /* ---------- pagina "Sala" ---------- */
  function render() {
    var box = $("salabox"); if (!box) return;
    var X = sala();
    /* proiettore e diretta: il pannello viene clonato subito dopo questo render, quindi l'immagine si crea ora
       (non con il ritardo di mapImg). Il titolo resta in italiano: sul proiettore lo traduce i18n.js nella lingua del torneo */
    if (WALL) {
      box.innerHTML = '<section class="panel salamap"><h2>' + esc("Mappa della sala") + '</h2><img id="salaimg" alt=""></section>';
      var im = box.querySelector("img"); if (X.items.length) { var cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1000; draw(cv, { legend: true }); im.src = cv.toDataURL("image/png"); }
      return;
    }
    if (three) three.stop();
    box.innerHTML = '<section class="panel salaed"><h2>' + esc(T("Sala")) + ' <button class="hb" data-help="sala" title="Guida" aria-label="Apri la guida">?</button></h2>' +
      '<div class="row sl-bar"><span class="sl-view" role="group" aria-label="' + esc(T("Vista")) + '"><button type="button" data-sv2="2d" aria-pressed="' + (view === "2d") + '">' + esc(T("Pianta 2D")) + '</button><button type="button" data-sv2="3d" aria-pressed="' + (view === "3d") + '">3D</button></span>' +
      '<label class="row" style="gap:6px">' + esc(T("Aggiungi")) + '<select id="saladd">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '">' + (CAT[k][4] ? CAT[k][4] + " " : "") + esc(T(CAT[k][0])) + '</option>' + (k === "fila" ? Object.keys(PRESET).map(function (q) { return '<option value="' + q + '">' + PRESET[q][2] + " " + esc(T(PRESET[q][0])) + '</option>'; }).join("") : ""); }).join("") + '</select></label><button type="button" class="p" data-sa="add">' + esc(T("Aggiungi")) + '</button>' +
      '<label class="row" style="gap:6px">' + esc(T("Sala")) + ' <input type="number" id="salaw" min="4" max="200" step="1" value="' + X.w + '" aria-label="' + esc(T("Larghezza della sala in metri")) + '"> × <input type="number" id="salah" min="4" max="200" step="1" value="' + X.h + '" aria-label="' + esc(T("Profondità della sala in metri")) + '"> m</label></div>' +
      '<div class="sl-wrap"><div class="sl-stage"><canvas id="salacv" tabindex="0" aria-label="' + esc(T("Pianta della sala")) + '"' + (view === "3d" ? " hidden" : "") + '></canvas><div id="sala3d"' + (view === "2d" ? " hidden" : "") + '></div></div><aside id="salaprops" class="sl-props"></aside></div>' +
      '<p class="hint">' + esc(T("Trascina gli oggetti per spostarli (anche nella vista 3D). Clic su una postazione per assegnare giocatore e IP. Con un oggetto selezionato, doppio clic su un punto vuoto ne crea un altro uguale lì. Tasto destro su un oggetto: ruota, clona, elimina. Tasti sulla pianta: R ruota di 90°, Q ed E di 15°, frecce spostano, Ctrl+D clona, Canc elimina.")) + '</p></section>' +
      '<section class="panel salamap"><h2>' + esc(T("Mappa della sala")) + '</h2><img id="salaimg" alt="' + esc(T("Mappa della sala")) + '"><p class="hint">' + esc(T("Questa è la mappa che vedono i partecipanti sul proiettore e con /mappa nel bot Telegram, con la loro postazione evidenziata.")) + '</p></section>' +
      '<section class="panel"><h2>' + esc(T("Postazioni")) + '</h2><div class="row"><button type="button" data-sa="pingall">' + esc(T("Ping di tutte")) + '</button><label class="row chk"><input type="checkbox" id="salaauto"' + (pingT ? " checked" : "") + '> ' + esc(T("Ping automatico ogni 30 secondi")) + '</label><button type="button" data-sa="fillall">' + esc(T("Metti i giocatori liberi nelle postazioni libere")) + '</button></div><div id="salatab"></div></section>' +
      '<section class="panel"><h2>' + esc(T("Wi-Fi, server dei giochi e informazioni")) + '</h2><div id="salainfo"></div></section>' +
      '<section class="panel" id="salakit"><h2>' + esc(T("Kit da stampare (PDF)")) + '</h2><div class="row"><label class="row chk"><input type="checkbox" data-k="map" checked> ' + esc(T("Mappa")) + '</label><label class="row chk"><input type="checkbox" data-k="seats" checked> ' + esc(T("Elenco postazioni")) + '</label><label class="row chk"><input type="checkbox" data-k="info" checked> ' + esc(T("Wi-Fi con QR, server, link")) + '</label><label class="row chk"><input type="checkbox" data-k="cards" checked> ' + esc(T("Cartellini delle postazioni")) + '</label><button type="button" class="p" data-sa="kit">' + esc(T("Crea il PDF")) + '</button></div></section>';
    if (view === "3d") start3d($("sala3d")); else requestAnimationFrame(redraw);
    paintProps(); paintTable(); paintInfo(); mapImg();
  }
  function wire() {
    var box = $("salabox"); if (!box || box.__wired) return; box.__wired = true;
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var v = b.getAttribute("data-sv2"); if (v) { view = v; if (three) three.stop(); render(); return; }
      var sb = b.getAttribute("data-seat"); if (sb) { var s = allSeats().filter(function (x) { return x.id === sb; })[0]; if (s) select({ item: s.row, seat: s.id }); return; }
      var a = b.getAttribute("data-sa"); if (!a) return;
      if (a === "add") return addItem($("saladd").value);
      if (a === "pingall") return pingAll(false);
      if (a === "fillall") return fillPlayers(allSeats());
      if (a === "kit") return printKit();
      if (a === "svadd") { var X = sala(); X.servers.push({ id: "s" + Date.now().toString(36), name: "Server " + (X.servers.length + 1), game: "", addr: "", pass: "" }); save(); return paintInfo(); }
      if (a === "svdel") { var X2 = sala(), i = +b.getAttribute("data-i"); if (A.delSnap) A.delSnap((X2.servers[i] || {}).name || "server"); X2.servers.splice(i, 1); save(); return paintInfo(); }
      onAction(a);
    });
    box.addEventListener("change", function (e) {
      var t = e.target;
      if (t.id === "salaw" || t.id === "salah") { var n = Math.max(4, Math.min(200, parseFloat(t.value) || 20)); sala()[t.id === "salaw" ? "w" : "h"] = n; save(); redraw(); return; }
      if (t.id === "salaauto") { clearInterval(pingT); pingT = t.checked ? setInterval(function () { if (document.getElementById("salabox") && !document.getElementById("salabox").hidden) pingAll(true); }, 30000) : null; if (t.checked) pingAll(true); return; }
      if (t.getAttribute("data-tp")) {
        var X = sala(), seat = t.getAttribute("data-seat"), st = X.st[seat] || (X.st[seat] = {}), k = t.getAttribute("data-tp"), v2 = String(t.value || "").trim();
        if (k === "player" && v2) Object.keys(X.st).forEach(function (s) { if (s !== seat && X.st[s].player === v2) delete X.st[s].player; });
        if (v2) st[k] = v2; else delete st[k]; save(); redraw();
        /* l'IP cambia solo la sua cella dello stato; il giocatore cambia le scelte di tutte le righe:
           si ridisegna dopo che il browser ha spostato il focus (Tab), e il focus si rimette dov'era */
        if (k === "ip") { paintStats(); if (sel && sel.seat === seat) paintProps(); } else { paintProps(); setTimeout(paintTableKeep, 0); }
        return;
      }
      if (t.id === "salasel") { select(t.value ? { item: t.value } : null); var s2 = $("salasel"); if (s2) s2.focus(); return; }
      if (t.closest("#salaprops")) return onProp(e);
      if (t.closest("#salainfo")) return onInfo(e);
    });
    box.addEventListener("input", function (e) { if (e.target.closest("#salaprops") && /^(x|y|w|h|label)$/.test(e.target.getAttribute("data-sp") || "")) onProp(e); });
    /* pianta: clic, trascinamento, tasti */
    box.addEventListener("pointerdown", function (e) {
      if (e.target.id !== "salacv" || !geo) return;
      var pt = toRoom(e), h = hit(pt); hideMenu();
      if (e.button === 2) return;
      /* il doppio clic vale solo nel punto del clic che ha tolto la selezione: un clic su un punto vuoto senza selezione la dimentica */
      if (!h) { if (sel && sel.item) keepSel = { id: sel.item, t: Date.now(), x: e.clientX, y: e.clientY }; else if (keepSel && (Date.now() - keepSel.t >= 800 || Math.abs(e.clientX - keepSel.x) >= 8 || Math.abs(e.clientY - keepSel.y) >= 8)) keepSel = null; }
      select(h);
      /* trascinando una postazione si sposta tutta la fila */
      var it = selItem(); if (it && h) { drag = { it: it, dx: it.x - pt.x, dy: it.y - pt.y, moved: false }; e.target.setPointerCapture(e.pointerId); }
    });
    box.addEventListener("pointermove", function (e) {
      if (!drag || e.target.id !== "salacv") return;
      var pt = toRoom(e); drag.it.x = snap(pt.x + drag.dx); drag.it.y = snap(pt.y + drag.dy); clampIt(drag.it); drag.moved = true; redraw();
    });
    box.addEventListener("pointerup", function () { if (drag) { if (drag.moved) { save(); paintProps(); } drag = null; } });
    /* doppio clic su un punto vuoto con un oggetto selezionato: un altro oggetto uguale in quel punto */
    box.addEventListener("dblclick", function (e) {
      if (e.target.id !== "salacv" || !geo) return;
      var pt = toRoom(e); if (hit(pt)) return;
      var X = sala(); if (pt.x < 0 || pt.y < 0 || pt.x > X.w || pt.y > X.h) return;
      var src = keepSel && Date.now() - keepSel.t < 800 && Math.abs(e.clientX - keepSel.x) < 8 && Math.abs(e.clientY - keepSel.y) < 8 && X.items.filter(function (i) { return i.id === keepSel.id; })[0]; keepSel = null;
      if (!src) return;
      e.preventDefault(); cloneItem(src, pt);
    });
    /* tasto destro su un oggetto: ruota, clona, elimina */
    box.addEventListener("contextmenu", function (e) {
      if (e.target.id !== "salacv" || !geo) return;
      e.preventDefault(); var h = hit(toRoom(e)); if (!h) { hideMenu(); return; }
      select({ item: h.item }); showMenu(e.clientX, e.clientY);
    });
    box.addEventListener("keydown", function (e) {
      if (e.target.id !== "salacv") return;
      var it = selItem(); if (!it) return;
      var k = e.key, d = e.shiftKey ? 1 : 0.25;
      if (k === "Delete" || k === "Backspace") { e.preventDefault(); if (!sel.seat) delItem(it.id); return; }
      if (k === "ContextMenu" || (k === "F10" && e.shiftKey)) { e.preventDefault(); var cr = $("salacv").getBoundingClientRect(); showMenu(cr.left + geo.ox + it.x * geo.sc, cr.top + geo.oy + it.y * geo.sc); return; }
      if ((k === "d" || k === "D") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); cloneItem(it); return; }
      if (k === "r" || k === "R") { e.preventDefault(); onAction("rot90"); return; }
      if (k === "q" || k === "Q") { e.preventDefault(); onAction("rot-15"); return; }
      if (k === "e" || k === "E") { e.preventDefault(); onAction("rot15"); return; }
      var mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[k];
      if (mv && !sel.seat) { e.preventDefault(); it.x += mv[0]; it.y += mv[1]; clampIt(it); save(); redraw(); paintProps(); }
    });
    window.addEventListener("resize", function () { if ($("salacv") && !$("salabox").hidden) redraw(); });
  }

  /* ---------- per il bot e il proiettore ---------- */
  function vm() {
    var X = A.S().sala; if (!X || !(X.items || []).length) return null;
    var seatsBy = {}; Object.keys(X.st || {}).forEach(function (k) { if (X.st[k].player) seatsBy[X.st[k].player] = k; });
    return { seats: seatsBy, servers: (X.servers || []).map(function (s) { return { name: s.name, game: s.game, addr: s.addr, pass: s.pass }; }), wifi: X.wifi && X.wifi.ssid ? { ssid: X.wifi.ssid, pass: X.wifi.sec === "nopass" ? "" : X.wifi.pass } : null };
  }
  /* immagine per "/mappa": con la postazione del giocatore evidenziata */
  function png(player) {
    var X = A.S().sala; if (!X) return Promise.reject(new Error("nessuna sala"));
    var hi = null; Object.keys(X.st || {}).forEach(function (k) { if (player && X.st[k].player === player) hi = k; });
    var cv = document.createElement("canvas"); cv.width = 1600; cv.height = 1100;
    draw(cv, { print: true, legend: true, hi: hi, title: "Mappa della sala" + (hi ? " – " + "Postazione" + " " + hi + " (" + K(player) + ")" : "") });
    return Promise.resolve(cv);
  }
  window.SALA = { render: function () { wire(); render(); }, vm: vm, png: png, draw: draw, kit: function (p) { return loadScript("js/vendor/qrcode.js", function () { return !!window.qrcode; }).then(function () { return buildKit(p); }); } };
  /* proiettore: app.js lo prepara prima che questo file sia caricato; se il ponte lo permette, si ridisegna ora
     così il pannello della sala non resta vuoto fino al primo salvataggio */
  if (WALL && A.wallRebuild) A.wallRebuild();
})();
