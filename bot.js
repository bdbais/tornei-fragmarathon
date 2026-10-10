/* Tornei Fragmarathon: bot Telegram.
   Gira nel processo principale dell'app installata, con long polling (getUpdates): non serve
   un server, basta che l'app sia aperta sul PC dell'organizzatore e che ci sia internet.
   La pagina manda una "vista" già calcolata dei tornei (setVM); il bot risponde da lì e,
   confrontando una vista con la precedente, manda le notifiche a chi segue i tornei.
   Token, chat e richieste di iscrizione stanno in un file nella cartella dati dell'app,
   mai nei backup dei tornei. */
"use strict";
const fs = require("fs");

const HELP = [
  "<b>Comandi</b>",
  "/tornei – i tornei e come stanno andando",
  "/torneo <i>nome</i> – dettagli di un torneo",
  "/classifica <i>nome</i> – classifica o tabellone",
  "/partite <i>nome</i> – partite da giocare adesso",
  "/risultati – podi dei tornei conclusi",
  "/hof – Hall of Fame (con file da scaricare)",
  "/giocatore <i>nome</i> – dove gioca, posizioni, prossime partite",
  "/io <i>nome</i> – collega il tuo account al tuo giocatore: ti avviso quando tocca a te",
  "/miepartite – le tue partite e posizioni",
  "/segui <i>nome</i> o /segui tutti – ricevi gli avvisi",
  "/nonseguire <i>nome</i> o /nonseguire tutti",
  "/seguiti – i tornei che segui",
  "/iscrivimi <i>torneo</i> – iscriviti a un torneo aperto",
  "/immagine <i>nome</i> – immagine del torneo",
  "/diretta – dove guardare la diretta",
  "/stop – non ricevere più nulla"
].join("\n");
const COMMANDS = [
  ["tornei", "I tornei e come stanno andando"], ["torneo", "Dettagli di un torneo"], ["classifica", "Classifica o tabellone"],
  ["partite", "Partite da giocare adesso"], ["risultati", "Podi dei tornei conclusi"], ["hof", "Hall of Fame"],
  ["giocatore", "Cerca un giocatore"], ["io", "Collega il tuo giocatore"], ["miepartite", "Le tue prossime partite"],
  ["segui", "Ricevi gli avvisi di un torneo"], ["nonseguire", "Smetti di seguire"], ["seguiti", "Tornei che segui"],
  ["iscrivimi", "Iscriviti a un torneo"], ["immagine", "Immagine del torneo"], ["diretta", "Dove guardare la diretta"], ["aiuto", "Elenco dei comandi"], ["stop", "Non ricevere più nulla"]
];

function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function num(x) { return Number(x || 0).toLocaleString("it-IT", { maximumFractionDigits: 2 }); }
/* Il token si incolla spesso con spazi, con "bot" davanti o con tutto il messaggio di BotFather:
   se ne estrae la parte valida (numero:segreto). */
function cleanToken(t) {
  const re = /(\d{5,}:[A-Za-z0-9_-]{20,})/, raw = String(t || "");
  const m = re.exec(raw) || re.exec(raw.replace(/\s+/g, ""));
  return m ? m[1] : "";
}
/* errori di Telegram e di rete spiegati in italiano */
function friendly(e) {
  e = String(e || ""); if (!e) return "";
  if (/Unauthorized|Not Found/i.test(e)) return "Token non valido o revocato: copialo di nuovo da @BotFather (comando /mybots, poi API Token). Formato: 123456789:AA…";
  if (/Conflict/i.test(e)) return "Un altro programma sta usando questo bot (Conflict): chiudilo, oppure usa un bot diverso per i tornei.";
  if (/fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|tempo scaduto|network|ERR_/i.test(e)) return "Telegram non è raggiungibile da questo PC: controlla la connessione a internet, il firewall o il proxy. (" + e.slice(0, 80) + ")";
  return e;
}
function newCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
function chunks(text, max) {
  const out = []; let cur = "";
  for (const line of String(text).split("\n")) {
    if (cur.length + line.length + 1 > max && cur) { out.push(cur); cur = ""; }
    cur += (cur ? "\n" : "") + line.slice(0, max);
  }
  if (cur) out.push(cur);
  return out;
}

module.exports = function createBot(opts) {
  const file = opts.file;
  let streamer = null, liveLinks = null;
  let cfg = load(), vm = null, prev = null, running = false, ctrl = null, me = null, lastErr = "", tokErr = "", lastOk = 0;
  const waits = {}, pngWait = {};
  let queue = Promise.resolve();

  function defaults() { return { token: "", enabled: false, join: "approve", notify: { stage: true, final: true, results: false, player: true }, admins: [], adminUsers: [], userRoles: {}, chats: {}, pending: [], offset: 0, code: newCode(), apiBase: "", welcome: "" }; }
  function load() {
    try {
      const c = Object.assign(defaults(), JSON.parse(fs.readFileSync(file, "utf8"))); c.notify = Object.assign(defaults().notify, c.notify);
      /* versioni precedenti: admin per chat e per username diventano ruoli */
      (c.admins || []).forEach((a) => { const ch = c.chats[a] || (c.chats[a] = { follow: { all: false, games: [] } }); if (!ch.role) ch.role = "admin"; });
      (c.adminUsers || []).forEach((u) => { if (!c.userRoles[u]) c.userRoles[u] = { role: "admin", games: [] }; });
      c.admins = []; c.adminUsers = [];
      return c;
    }
    catch { return defaults(); }
  }
  function persist() { try { fs.writeFileSync(file, JSON.stringify(cfg, null, 1)); } catch {} }

  async function api(method, body, form) {
    if (!cfg.token) throw new Error("Manca il token del bot");
    const base = String(cfg.apiBase || "https://api.telegram.org").replace(/\/+$/, "");
    const c = new AbortController(); if (method === "getUpdates") ctrl = c;
    const t = setTimeout(() => c.abort(), method === "getUpdates" ? 70000 : 40000);
    try {
      const r = await (opts.fetch || fetch)(base + "/bot" + cfg.token + "/" + method, form ? { method: "POST", body: form, signal: c.signal }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: c.signal });
      const j = await r.json().catch(() => ({ ok: false, description: "risposta non valida (HTTP " + r.status + ")" }));
      if (!j.ok) throw new Error(j.description || "errore " + r.status);
      return j.result;
    } finally { clearTimeout(t); }
  }
  /* invii in coda, con un piccolo intervallo: Telegram limita circa 30 messaggi al secondo */
  function send(chatId, text, kb) {
    const parts = chunks(text, 3900);
    parts.forEach((p, i) => {
      queue = queue.then(() => api("sendMessage", { chat_id: chatId, text: p, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: i === parts.length - 1 && kb ? { inline_keyboard: kb } : undefined }))
        .catch((e) => { if (/blocked|chat not found|deactivated/i.test(e.message)) { delete cfg.chats[chatId]; persist(); } })
        .then(() => sleep(45));
    });
    return queue;
  }
  function sendFile(chatId, kind, name, type, buf, caption) {
    queue = queue.then(() => {
      const f = new FormData();
      f.append("chat_id", String(chatId));
      if (caption) { f.append("caption", caption); f.append("parse_mode", "HTML"); }
      f.append(kind, new Blob([buf], { type }), name);
      return api(kind === "photo" ? "sendPhoto" : "sendDocument", null, f);
    }).catch(() => {}).then(() => sleep(45));
    return queue;
  }

  /* ---------- lettura della vista ---------- */
  /* chi sta scrivendo: i tornei "in lavorazione" li vedono solo amministratori e organizzatori */
  let viewer = null;
  const hiddenFor = (id, t) => (t.draft || (vm && vm.draft)) && !(id != null && canManage(id, t.k));
  const T = () => ((vm && vm.tournaments) || []).filter((t) => !hiddenFor(viewer, t));
  function find(q) {
    const L = T(); q = norm(q);
    if (!q) return null;
    if (/^\d+$/.test(q) && L[+q - 1]) return L[+q - 1];
    return L.find((t) => t.k === q) || L.find((t) => baseK(t.k) === q) || L.find((t) => norm(t.l) === q || norm(t.name) === q)
      || L.find((t) => norm(t.l).includes(q) || norm(t.name).includes(q) || norm(t.l + " " + t.name).includes(q)) || null;
  }
  function linksInfo() {
    const L = (vm && vm.links) || {}, a = [];
    if (L.when) a.push("📅 " + esc(L.when) + (L.place ? ", " + esc(L.place) : ""));
    if (L.wa) a.push("💬 Gruppo WhatsApp: " + esc(L.wa));
    if (L.tg) a.push("📣 Canale Telegram: " + esc(L.tg));
    return a.length ? "\n\n" + a.join("\n") : "";
  }
  function tTitle(t) { return "<b>" + esc(t.l) + "</b>" + (t.name ? " – " + esc(t.name) : "") + (t.draft || (vm && vm.draft) ? " 🛠 <i>in lavorazione</i>" : ""); }
  /* chiave "torneo:gioco"; seguiti e ruoli salvati prima valgono per quel gioco in ogni torneo */
  const baseK = (k) => String(k || "").split(":").pop();
  const hasK = (L, k) => (L || []).some((x) => x === k || x === baseK(k));
  function followers(k) { return Object.keys(cfg.chats).filter((id) => { const f = cfg.chats[id].follow || {}; return f.all || hasK(f.games, k); }); }
  function podium(t) { const m = ["🥇", "🥈", "🥉"]; return t.top.map((n, i) => m[Math.min(i, 2)] + " " + esc(n)).join("\n"); }
  function tKb(t, chatId) {
    const f = (cfg.chats[chatId] && cfg.chats[chatId].follow) || {}, on = f.all || hasK(f.games, t.k);
    const r1 = [{ text: "Classifica", callback_data: "S:" + t.k }, { text: "Partite", callback_data: "P:" + t.k }];
    const r2 = [{ text: on ? "Non seguire" : "Segui", callback_data: (on ? "U:" : "F:") + t.k }, { text: "Immagine", callback_data: "G:" + t.k }];
    const rows = [r1, r2];
    if (t.open && cfg.join !== "off") rows.push([{ text: "Iscriviti", callback_data: "I:" + t.k }]);
    rows.push([{ text: "‹ Tutti i tornei", callback_data: "L" }]);
    return rows;
  }
  function linksText(L) {
    const ok = (L || []).filter((l) => l.url);
    return ok.length ? ok.map((l) => "▶️ " + esc(l.name) + ": " + esc(l.url)).join("\n") : "(il link non è stato impostato: chiedi all'organizzatore)";
  }
  function liveKb() {
    if (!streamer) return null;
    const S = streamer.SCENES;
    return Object.keys(S).map((k) => [{ text: S[k], callback_data: "V:" + k }]).concat([[{ text: "⏹ Ferma la diretta", callback_data: "V:stop" }]]);
  }
  async function liveCmd(chatId, arg, isAdmin) {
    const a = norm(arg).split(" ")[0];
    if (!a || !isAdmin) {
      if (liveLinks) return send(chatId, "🔴 <b>Siamo in diretta!</b>\n" + linksText(liveLinks));
      if (!isAdmin) return send(chatId, "Nessuna diretta in corso, per ora. Ti avviso io quando parte.");
    }
    if (!streamer) return send(chatId, "La diretta non è disponibile su questo programma.");
    if (a === "avvia" || a === "start") {
      send(chatId, "Avvio la diretta…");
      const st = await streamer.start();
      return st.err && !st.starting && !st.live ? send(chatId, "❌ Non partita: " + esc(st.err)) : null;
    }
    if (a === "ferma" || a === "stop") { streamer.stop(); return send(chatId, "⏹ Diretta fermata."); }
    if (a === "scena") {
      const sc = norm(arg).split(" ")[1];
      if (sc && streamer.SCENES[sc]) { streamer.scene(sc); return send(chatId, "Scena: " + esc(streamer.SCENES[sc])); }
      return send(chatId, "Quale scena?", liveKb());
    }
    const st = streamer.status();
    return send(chatId, (st.live ? "🔴 In diretta da " + Math.round((Date.now() - st.since) / 60000) + " minuti, " + st.kbps + " kbit/s, scena: " + esc(streamer.SCENES[st.scene] || st.scene) : st.starting ? "Diretta in avvio…" : "Diretta spenta." + (st.err ? "\nUltimo errore: " + esc(st.err) : "")) +
      "\n\n/diretta avvia – /diretta ferma – /diretta scena", st.live ? liveKb() : [[{ text: "▶️ Avvia la diretta", callback_data: "V:avvia" }]]);
  }
  function listMsg() {
    const L = T();
    if (!L.length) return { text: vm && vm.draft ? "<b>" + esc(vm.title) + "</b> è in preparazione: i tornei compariranno qui appena saranno pronti." : "Ancora nessun torneo." };
    const text = "<b>" + esc(vm.title) + "</b>\n" + (vm.sub ? esc(vm.sub) + "\n" : "") + "\n" + L.map((t, i) =>
      (i + 1) + ". " + tTitle(t) + "\n   " + esc(t.mode) + ", " + t.players.length + (t.team ? " squadre" : " iscritti") + ": <i>" + esc(t.open ? "iscrizioni aperte" : t.status) + "</i>").join("\n");
    const kb = []; for (let i = 0; i < L.length; i += 2) kb.push(L.slice(i, i + 2).map((t) => ({ text: t.l.slice(0, 30), callback_data: "T:" + t.k })));
    kb.push([{ text: "Hall of Fame", callback_data: "H" }, { text: "Risultati", callback_data: "R" }]);
    return { text, kb };
  }
  function detailMsg(t, chatId) {
    let s = tTitle(t) + "\n" + esc(t.mode) + " · " + t.players.length + (t.team ? " squadre" : " iscritti") + "\nStato: <b>" + esc(t.open ? "iscrizioni aperte" : t.status) + "</b>";
    if (t.done && t.top.length) s += "\n\n" + podium(t);
    if (t.next.length) s += "\n\n<b>Da giocare</b>\n" + t.next.slice(0, 12).map(esc).join("\n");
    if (t.open && t.players.length) s += "\n\n<b>Iscritti</b>: " + t.players.map(esc).join(", ");
    return { text: s, kb: tKb(t, chatId) };
  }
  function hofText() {
    const h = vm && vm.hof; if (!h || (!h.players.length && !h.teams.length)) return "La Hall of Fame è ancora vuota.";
    const row = (e, i) => (e.pos || i + 1) + "º " + esc(e.n) + " – <b>" + num(e.tot) + "</b>" + (e.by.length ? " (" + e.by.map((b) => esc(b.l) + (b.pos ? " " + b.pos + "º" : "")).join(", ") + ")" : "");
    let s = "<b>Hall of Fame – " + esc(vm.title) + "</b>";
    if (h.players.length) s += "\n\n<b>Giocatori</b>\n" + h.players.slice(0, 10).map(row).join("\n");
    if (h.teams.length) s += "\n\n<b>Squadre</b>\n" + h.teams.slice(0, 10).map(row).join("\n");
    return s;
  }
  function hofCsv() {
    const h = vm.hof, q = (v) => '"' + String(v).replace(/"/g, '""') + '"', rows = [["Classifica", "Posizione", "Nome", "Totale", "Dettaglio per gioco"]];
    [["Giocatori", h.players], ["Squadre", h.teams]].forEach(([lab, L]) => L.forEach((e, i) => rows.push([lab, e.pos || i + 1, e.n, e.tot, e.by.map((b) => b.l + (b.pos ? " " + b.pos + "º" : "") + " " + b.v).join(" | ")])));
    return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  }
  function playerMsg(q) {
    const nq = norm(q); if (!nq) return "Scrivi il nome: /giocatore <i>nome</i>";
    const all = new Set(vm.roster || []); T().forEach((t) => { t.players.forEach((p) => all.add(p)); Object.values(t.members || {}).forEach((ms) => ms.forEach((m) => all.add(m))); });
    const names = [...all].filter((n) => norm(n) === nq); if (!names.length) names.push(...[...all].filter((n) => norm(n).includes(nq)).slice(0, 1));
    if (!names.length) return "Nessun partecipante con il nome «" + esc(q) + "».";
    const n = names[0], out = ["<b>" + esc(n) + "</b>"];
    T().forEach((t) => {
      const team = t.team ? Object.keys(t.members || {}).find((tn) => (t.members[tn] || []).includes(n)) : null;
      const who = t.team ? team : (t.players.includes(n) ? n : null); if (!who) return;
      const pos = t.pl[who], next = t.next.filter((x) => x.includes(who));
      out.push("\n" + tTitle(t) + (team ? " (squadra " + esc(team) + ")" : "") + "\n" + esc(t.open ? "Iscrizioni aperte" : t.status) + (pos ? " · posizione finale: <b>" + pos + "º</b>" : "") + (next.length ? "\nProssime: " + next.map(esc).join("; ") : ""));
    });
    const hp = vm.hof && vm.hof.players.find((e) => e.n === n);
    if (hp) out.push("\nHall of Fame: <b>" + (hp.pos) + "º</b> con " + num(hp.tot) + " punti");
    return out.length > 1 ? out.join("\n") : "<b>" + esc(n) + "</b> non è iscritto a nessun torneo.";
  }
  function resultsMsg() {
    const D = T().filter((t) => t.done && t.top.length);
    return D.length ? "<b>Risultati</b>\n\n" + D.map((t) => tTitle(t) + "\n" + podium(t)).join("\n\n") : "Nessun torneo concluso, per ora.";
  }

  /* ---------- notifiche: confronto tra la vista nuova e la precedente ---------- */
  function notifyDiff() {
    if (!prev || !vm || !running) return;
    const old = {}; prev.tournaments.forEach((t) => (old[t.k] = t));
    vm.tournaments.forEach((t) => {
      const o = old[t.k]; if (!o) return;
      const fol = followers(t.k).filter((id) => !hiddenFor(id, t)); if (!fol.length) return;
      if (o.status !== t.status && !t.open) {
        let msg = null;
        if (t.done && cfg.notify.final) msg = "🏆 " + tTitle(t) + " è concluso!\n\n" + podium(t);
        else if (!t.done && cfg.notify.stage) msg = "📣 " + tTitle(t) + ": <b>" + esc(t.status) + "</b>" + (t.next.length ? "\n\n<b>Da giocare</b>\n" + t.next.slice(0, 10).map(esc).join("\n") : "");
        if (msg) fol.forEach((id) => send(id, msg, [[{ text: "Apri il torneo", callback_data: "T:" + t.k }]]));
      }
      if (cfg.notify.results) {
        const seen = new Set((o.results || []).map((r) => r.id)), nuovi = (t.results || []).filter((r) => !seen.has(r.id));
        if (nuovi.length && nuovi.length <= 6) fol.forEach((id) => send(id, "⚔️ " + tTitle(t) + "\n" + nuovi.map((r) => esc(r.text)).join("\n")));
      }
    });
    if (cfg.notify.player !== false) personal(old);
  }
  /* avvisi personali a chi ha collegato il suo account a un giocatore: tocca a te, i tuoi risultati, la tua posizione */
  function personal(old) {
    Object.keys(cfg.chats).forEach((id) => {
      const P = cfg.chats[id].player; if (!P) return;
      vm.tournaments.forEach((t) => {
        const o = old[t.k]; if (!o || hiddenFor(id, t)) return;
        const me = [P].concat(Object.keys(t.members || {}).filter((tn) => (t.members[tn] || []).includes(P)));
        const mine = (x) => (x.p || []).some((n) => me.includes(n));
        const was = new Set((o.nextP || []).map((x) => x.t)), turn = (t.nextP || []).filter((x) => mine(x) && !was.has(x.t));
        if (turn.length) send(id, "🎮 <b>Tocca a te</b> – " + tTitle(t) + "\n" + turn.map((x) => esc(x.t)).join("\n"));
        const seen = new Set((o.results || []).map((r) => r.id)), res = (t.results || []).filter((r) => !seen.has(r.id) && mine(r));
        if (res.length && res.length <= 4) send(id, "📊 Il tuo risultato – " + tTitle(t) + "\n" + res.map((r) => esc(r.text)).join("\n"));
        if (!o.done && t.done) { const who = me.find((n) => t.pl && t.pl[n]); if (who) send(id, "🏁 " + tTitle(t) + " è finito: " + (who !== P ? "la tua squadra " + esc(who) + " ha" : "hai") + " chiuso al <b>" + t.pl[who] + "º posto</b>."); }
      });
    });
  }

  /* ---------- comandi ---------- */
  /* ---------- ruoli ----------
     admin = amministratore: tutto (iscrizioni, annunci, diretta).
     org = organizzatore tornei: conferma le iscrizioni di tutti i tornei o solo di quelli indicati.
     Il ruolo sta nella chat (assegnato dall'app o con /admin); per username si può assegnare a chi
     non ha ancora scritto al bot (cfg.userRoles): lo prende appena scrive in privato. */
  function roleOf(id) { const c = cfg.chats[id]; return c && (c.role === "admin" || c.role === "org") ? c.role : ""; }
  function canManage(id, k) { const r = roleOf(id); if (r === "admin") return true; if (r !== "org") return false; const g = cfg.chats[id].games || []; return !g.length || !k || hasK(g, k); }
  function managers(k) { return Object.keys(cfg.chats).filter((id) => canManage(id, k)); }
  function chat(id, from) {
    const c = cfg.chats[id] || (cfg.chats[id] = { follow: { all: false, games: [] } });
    const u = from && from.username ? String(from.username).toLowerCase() : "", ur = u && cfg.userRoles[u];
    if (ur && from.id === id && !c.role) { c.role = ur.role; c.games = (ur.games || []).slice(); c.viaUser = u; persist(); opts.onChange && opts.onChange(); }
    c.name = (from && (from.username ? "@" + from.username : from.first_name)) || c.name || ""; c.first = (from && from.first_name) || c.first || ""; c.seen = Date.now();
    return c;
  }
  function knownNames() {
    const all = new Set(vm.roster || []);
    T().forEach((t) => { t.players.forEach((p) => all.add(p)); Object.values(t.members || {}).forEach((ms) => ms.forEach((m) => all.add(m))); });
    return [...all];
  }
  /* collega l'account Telegram a un giocatore: da lì arrivano gli avvisi personali */
  function linkPlayer(chatId, name, force) {
    name = String(name || "").replace(/\s+/g, " ").trim();
    if (!/^[^<>\u0000-\u001f]{1,32}$/.test(name)) return send(chatId, "Nome non valido: da 1 a 32 caratteri, senza < >.");
    const L = knownNames(), exact = L.find((n) => norm(n) === norm(name));
    if (!exact && !force) {
      const sim = L.filter((n) => norm(n).includes(norm(name)) || norm(name).includes(norm(n))).slice(0, 4);
      const kb = sim.map((n) => [{ text: "Sono " + n, callback_data: "M:" + n.slice(0, 40) }]).concat([[{ text: "Collegami comunque come «" + name.slice(0, 20) + "»", callback_data: "N:" + name.slice(0, 40) }]]);
      return send(chatId, "Non trovo «" + esc(name) + "» tra i partecipanti." + (sim.length ? " Forse sei:" : "\nSe non sei ancora iscritto usa /iscrivimi, oppure collegati comunque: appena l'organizzatore ti aggiunge riceverai gli avvisi."), kb);
    }
    const c = cfg.chats[chatId]; c.player = exact || name; persist(); opts.onChange && opts.onChange();
    return send(chatId, "✅ Sei collegato come <b>" + esc(c.player) + "</b>: ti avviso quando tocca a te, con i tuoi risultati e la posizione finale.\n/miepartite per le tue partite, /scollega per togliere il collegamento.");
  }
  function follow(chatId, q, on) {
    const c = cfg.chats[chatId]; c.follow = c.follow || { all: false, games: [] };
    if (norm(q) === "tutti") { c.follow.all = on; if (!on) c.follow.games = []; persist(); return send(chatId, on ? "Ricevi gli avvisi di tutti i tornei." : "Non segui più nessun torneo."); }
    const t = find(q); if (!t) return send(chatId, "Quale torneo? " + (q ? "Non trovo «" + esc(q) + "»." : "") + "\nUsa /tornei per l'elenco.");
    c.follow.games = (c.follow.games || []).filter((k) => k !== t.k); if (on) c.follow.games.push(t.k); persist();
    return send(chatId, on ? "Segui " + tTitle(t) + ": ti avviso a ogni cambio di turno e alla fine." : "Non segui più " + tTitle(t) + ".");
  }
  async function joinStart(chatId, from, t, name) {
    if (!t) return send(chatId, "A quale torneo vuoi iscriverti? Usa /tornei e poi «Iscriviti».");
    if (cfg.join === "off") return send(chatId, "Le iscrizioni dal bot sono chiuse: chiedi all'organizzatore.");
    if (!t.open) return send(chatId, "Le iscrizioni a " + tTitle(t) + " sono chiuse: il torneo è già iniziato.");
    if (!name) { waits[chatId] = { type: "join", k: t.k }; return send(chatId, "Scrivi il nome con cui vuoi giocare a " + tTitle(t) + " (massimo 32 caratteri)."); }
    name = String(name).replace(/\s+/g, " ").trim();
    if (!/^[^<>\u0000-\u001f]{1,32}$/.test(name)) return send(chatId, "Nome non valido: usa da 1 a 32 caratteri, senza < >.");
    const taken = (t.team ? (vm.roster || []) : t.players).some((p) => norm(p) === norm(name));
    if (taken && !t.team) return send(chatId, "«" + esc(name) + "» è già iscritto a " + tTitle(t) + ".");
    if (cfg.pending.some((p) => p.k === t.k && norm(p.name) === norm(name))) return send(chatId, "C'è già una richiesta per «" + esc(name) + "»: aspetta la conferma dell'organizzatore.");
    const req = { id: Math.random().toString(36).slice(2, 10), chatId, user: (from && (from.username ? "@" + from.username : from.first_name)) || "", name, k: t.k, l: t.l, team: !!t.team, ts: Date.now() };
    cfg.chats[chatId].player = name;
    const f = cfg.chats[chatId].follow; if (!hasK(f.games, t.k)) f.games.push(t.k);
    if (cfg.join === "auto") { opts.onJoin(req); persist(); return send(chatId, "✅ Sei iscritto a " + tTitle(t) + " come <b>" + esc(name) + "</b>." + (t.team ? " L'organizzatore ti metterà in una squadra." : "") + "\nRiceverai gli avvisi del torneo."); }
    cfg.pending.push(req); persist(); opts.onChange && opts.onChange();
    managers(t.k).forEach((a) => send(a, "📝 Richiesta di iscrizione a " + tTitle(t) + ": <b>" + esc(name) + "</b>" + (req.user ? " (" + esc(req.user) + ")" : ""), [[{ text: "Accetta", callback_data: "A:" + req.id }, { text: "Rifiuta", callback_data: "X:" + req.id }]]));
    return send(chatId, "📝 Richiesta inviata: l'organizzatore deve confermare l'iscrizione di <b>" + esc(name) + "</b> a " + tTitle(t) + ".");
  }
  function decide(id, ok, byChat) {
    const i = cfg.pending.findIndex((p) => p.id === id); if (i < 0) { if (byChat) send(byChat, "Richiesta già gestita."); return false; }
    const req = cfg.pending.splice(i, 1)[0]; persist(); opts.onChange && opts.onChange();
    if (ok) opts.onJoin(req);
    send(req.chatId, ok ? "✅ Iscrizione a <b>" + esc(req.l) + "</b> accettata: giochi come <b>" + esc(req.name) + "</b>." + (req.team ? " Ti metteremo in una squadra." : "") : "❌ L'iscrizione di <b>" + esc(req.name) + "</b> a " + esc(req.l) + " non è stata accettata.");
    if (byChat) send(byChat, (ok ? "Accettata" : "Rifiutata") + ": " + esc(req.name) + " – " + esc(req.l) + ".");
    return true;
  }
  /* l'immagine la disegna la pagina: non si aspetta qui, così il bot continua a rispondere */
  function photo(chatId, t) { photoAsync(chatId, t).catch(() => {}); }
  async function photoAsync(chatId, t) {
    if (!t) return send(chatId, "Quale torneo? Usa /tornei.");
    send(chatId, "Preparo l'immagine di " + tTitle(t) + "…");
    const id = Math.random().toString(36).slice(2);
    const p = new Promise((res) => { pngWait[id] = res; setTimeout(() => { if (pngWait[id]) { delete pngWait[id]; res(null); } }, 25000); });
    opts.onPng({ id, k: t.k });
    const data = await p;
    if (!data) return send(chatId, "Non sono riuscito a creare l'immagine, riprova tra poco.");
    return sendFile(chatId, "photo", "torneo.png", "image/png", Buffer.from(String(data).split(",")[1] || "", "base64"), tTitle(t));
  }
  async function handle(chatId, from, text, data) {
    const c = chat(chatId, from); const isAdmin = roleOf(chatId) === "admin", isOrg = !!roleOf(chatId);
    viewer = chatId;
    if (!vm) return send(chatId, "Il programma dei tornei si sta avviando, riprova tra qualche secondo.");
    if (data) {
      const [a, k] = [data.slice(0, 1), data.slice(2)], t = k ? find(k) : null;
      if (a === "L") { const m = listMsg(); return send(chatId, m.text, m.kb); }
      if (a === "H") return command(chatId, from, "hof", "");
      if (a === "R") return send(chatId, resultsMsg());
      if (a === "T" && t) { const m = detailMsg(t, chatId); return send(chatId, m.text, m.kb); }
      if (a === "S" && t) return send(chatId, tTitle(t) + "\n\n" + (t.lines.length ? t.lines.map(esc).join("\n") : "Nessuna classifica ancora."));
      if (a === "P" && t) return send(chatId, tTitle(t) + "\n\n" + (t.next.length ? "<b>Da giocare</b>\n" + t.next.map(esc).join("\n") : "Nessuna partita da giocare adesso."));
      if (a === "F" && t) return follow(chatId, t.k, true);
      if (a === "U" && t) return follow(chatId, t.k, false);
      if (a === "G" && t) return photo(chatId, t);
      if (a === "I" && t) return joinStart(chatId, from, t, null);
      if (a === "A" || a === "X") { const rq = cfg.pending.find((p) => p.id === k); if (!rq) return send(chatId, "Richiesta già gestita."); return canManage(chatId, rq.k) ? decide(k, a === "A", chatId) : send(chatId, "Non puoi gestire le iscrizioni di questo torneo."); }
      if (data === "ME") { waits[chatId] = { type: "me" }; return send(chatId, "Scrivi il nome con cui giochi ai tornei."); }
      if (a === "M") return linkPlayer(chatId, k, false);
      if (a === "N") return linkPlayer(chatId, k, true);
      if (a === "V" && isAdmin && streamer) { if (k === "stop") return liveCmd(chatId, "ferma", true); if (k === "avvia") return liveCmd(chatId, "avvia", true); return liveCmd(chatId, "scena " + k, true); }
      return;
    }
    if (waits[chatId] && !text.startsWith("/")) { const w = waits[chatId]; delete waits[chatId]; if (w.type === "join") return joinStart(chatId, from, find(w.k), text); if (w.type === "me") return linkPlayer(chatId, text, false); }
    if (!text.startsWith("/")) return send(chatId, "Scrivi /tornei per vedere i tornei, oppure /aiuto per tutti i comandi.");
    const sp = text.slice(1).split(/\s+/), cmd = sp[0].split("@")[0].toLowerCase(), arg = text.slice(1 + sp[0].length).trim();
    return command(chatId, from, cmd, arg, isAdmin, isOrg);
  }
  async function command(chatId, from, cmd, arg, isAdmin, isOrg) {
    const c = cfg.chats[chatId];
    switch (cmd) {
      case "start": case "aiuto": case "help": {
        const m = listMsg();
        const kb = c.player || isOrg ? m.kb : [[{ text: "🎮 Sono un giocatore: collega il mio nome", callback_data: "ME" }]].concat(m.kb || []);
        return send(chatId, "Ciao! Sono il bot di <b>" + esc(vm.title) + "</b>." + linksInfo() + (cfg.welcome ? "\n\n" + esc(cfg.welcome) : "") + (c.player ? " Sei collegato come <b>" + esc(c.player) + "</b>." : "") + (liveLinks ? "\n\n🔴 <b>Siamo in diretta!</b>\n" + linksText(liveLinks) : "") + "\n\n" + HELP + (isOrg ? "\n\n<b>Organizzatori tornei</b>\n/richieste – iscrizioni da confermare" : "") + (isAdmin ? "\n\n<b>Amministratori</b>\n/annuncio <i>testo</i> – messaggio a tutti\n/diretta avvia, /diretta ferma, /diretta scena – la diretta" : ""), kb);
      }
      case "tornei": { const m = listMsg(); return send(chatId, m.text, m.kb); }
      case "torneo": { const t = find(arg); if (!t) { const m = listMsg(); return send(chatId, (arg ? "Non trovo «" + esc(arg) + "».\n\n" : "") + m.text, m.kb); } const d = detailMsg(t, chatId); return send(chatId, d.text, d.kb); }
      case "classifica": { const t = find(arg); return t ? handle(chatId, from, null, "S:" + t.k) : send(chatId, "Quale torneo? Esempio: /classifica " + esc((T()[0] || { l: "quake" }).l)); }
      case "partite": { const t = find(arg); return t ? handle(chatId, from, null, "P:" + t.k) : send(chatId, "Quale torneo? Esempio: /partite " + esc((T()[0] || { l: "quake" }).l)); }
      case "risultati": return send(chatId, resultsMsg());
      case "hof": case "halloffame": {
        await send(chatId, hofText());
        if (vm.hof && (vm.hof.players.length || vm.hof.teams.length)) await sendFile(chatId, "document", "hall-of-fame.csv", "text/csv", Buffer.from(hofCsv(), "utf8"), "Hall of Fame completa (si apre con Excel)");
        return;
      }
      case "giocatore": case "cerca": return send(chatId, playerMsg(arg));
      case "io": case "sono": {
        if (arg) return linkPlayer(chatId, arg, false);
        if (c.player) return send(chatId, "Sei collegato come <b>" + esc(c.player) + "</b>.", [[{ text: "Cambia nome", callback_data: "ME" }]]);
        waits[chatId] = { type: "me" }; return send(chatId, "Scrivi il nome con cui giochi ai tornei.");
      }
      case "scollega": c.player = ""; persist(); opts.onChange && opts.onChange(); return send(chatId, "Collegamento tolto: non ricevi più gli avvisi personali.");
      case "miepartite": return c.player ? send(chatId, playerMsg(c.player)) : send(chatId, "Prima dimmi chi sei: /io <i>il tuo nome</i>.");
      case "segui": return follow(chatId, arg, true);
      case "nonseguire": return follow(chatId, arg, false);
      case "seguiti": { const f = c.follow || {}; if (f.all) return send(chatId, "Segui tutti i tornei."); const L = (f.games || []).map((k) => find(k)).filter(Boolean); return send(chatId, L.length ? "Segui:\n" + L.map(tTitle).join("\n") : "Non segui nessun torneo. Usa /segui <i>nome</i> o /segui tutti."); }
      case "iscrivimi": { const parts = arg.split("|"); return joinStart(chatId, from, find(parts[0]), parts[1] ? parts[1].trim() : null); }
      case "immagine": return photo(chatId, find(arg));
      case "diretta": case "live": return liveCmd(chatId, arg, isAdmin);
      case "stop": delete cfg.chats[chatId]; persist(); opts.onChange && opts.onChange(); return send(chatId, "Fatto: non riceverai più messaggi. Per ricominciare scrivi /start.");
      case "admin":
        if (arg && arg === cfg.code) { c.role = "admin"; c.games = []; cfg.code = newCode(); persist(); opts.onChange && opts.onChange(); return send(chatId, "🔑 Ora sei un amministratore: ricevi le richieste di iscrizione, puoi mandare annunci e comandare la diretta.\n/richieste per le iscrizioni."); }
        return send(chatId, "Codice non valido. Il codice è nelle impostazioni del programma (Bot Telegram).");
      case "richieste": {
        if (!isOrg) return send(chatId, "Comando riservato agli organizzatori.");
        const mineP = cfg.pending.filter((p) => canManage(chatId, p.k));
        if (!mineP.length) return send(chatId, "Nessuna richiesta da confermare.");
        for (const p of mineP) await send(chatId, "📝 " + esc(p.l) + ": <b>" + esc(p.name) + "</b>" + (p.user ? " (" + esc(p.user) + ")" : ""), [[{ text: "Accetta", callback_data: "A:" + p.id }, { text: "Rifiuta", callback_data: "X:" + p.id }]]);
        return;
      }
      case "annuncio": {
        if (!isAdmin) return send(chatId, "Comando riservato agli amministratori.");
        if (!arg) return send(chatId, "Scrivi il testo: /annuncio <i>testo</i>");
        const ids = Object.keys(cfg.chats); ids.forEach((id) => send(id, "📢 <b>" + esc(vm.title) + "</b>\n" + esc(arg)));
        return send(chatId, "Annuncio inviato a " + ids.length + " chat.");
      }
      default: return send(chatId, "Comando sconosciuto. /aiuto per l'elenco.");
    }
  }

  /* ---------- ciclo ---------- */
  async function loop() {
    let backoff = 2000;
    while (running) {
      try {
        const ups = await api("getUpdates", { offset: cfg.offset, timeout: 50, allowed_updates: ["message", "callback_query"] });
        backoff = 2000; lastErr = ""; lastOk = Date.now();
        for (const u of ups) {
          cfg.offset = u.update_id + 1;
          try {
            if (u.callback_query) { const q = u.callback_query; api("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {}); if (q.message) await handle(q.message.chat.id, q.from, null, String(q.data || "")); }
            else if (u.message && typeof u.message.text === "string") await handle(u.message.chat.id, u.message.from, u.message.text.trim(), null);
          } catch (e) { lastErr = String(e.message || e); }
        }
        if (ups.length) persist();
      } catch (e) {
        if (!running) break;
        lastErr = String(e.name === "AbortError" ? "tempo scaduto" : e.message || e);
        if (/Unauthorized|Not Found/i.test(lastErr)) { running = false; opts.onChange && opts.onChange(); break; }
        await sleep(backoff); backoff = Math.min(backoff * 2, 60000);
      }
    }
  }
  async function start() {
    stop();
    if (!cfg.enabled || !cfg.token) return status();
    try { me = await api("getMe"); lastErr = ""; } catch (e) { lastErr = String(e.message || e); me = null; return status(); }
    api("setMyCommands", { commands: COMMANDS.map(([command, description]) => ({ command, description })) }).catch(() => {});
    running = true; loop(); return status();
  }
  function stop() { running = false; if (ctrl) { try { ctrl.abort(); } catch {} ctrl = null; } }
  function status() {
    const chats = Object.keys(cfg.chats);
    return {
      enabled: cfg.enabled, hasToken: !!cfg.token, tokenHint: cfg.token ? cfg.token.split(":")[0] + ":…" + cfg.token.slice(-4) : "", running, username: me && me.username, lastErr: tokErr || friendly(lastErr), lastOk,
      join: cfg.join, notify: cfg.notify, code: cfg.code, welcome: cfg.welcome || "",
      userRoles: Object.keys(cfg.userRoles).map((u) => ({ u: "@" + u, role: cfg.userRoles[u].role, games: cfg.userRoles[u].games || [] })),
      people: chats.map((id) => { const c = cfg.chats[id], f = c.follow || {}; return { id, name: c.name || c.first || String(id), role: roleOf(id), games: c.games || [], player: c.player || "", follow: f.all ? "tutti" : (f.games || []).length, seen: c.seen || 0 }; })
        .sort((a, b) => ({ admin: 0, org: 1, "": 2 })[a.role] - ({ admin: 0, org: 1, "": 2 })[b.role] || b.seen - a.seen).slice(0, 300),
      chats: chats.length, followers: chats.filter((id) => { const f = cfg.chats[id].follow || {}; return f.all || (f.games || []).length; }).length,
      pending: cfg.pending.map((p) => ({ id: p.id, name: p.name, l: p.l, user: p.user, ts: p.ts }))
    };
  }
  return {
    start, stop, status,
    setVM(v) { prev = vm; vm = v; try { notifyDiff(); } catch {} },
    async configure(c) {
      c = c || {};
      if (typeof c.token === "string" && c.token.trim()) {
        const tk = cleanToken(c.token);
        if (!tk) {
          const got = String(c.token).trim();
          tokErr = "Token non valido: " + (/^\d+:?$/.test(got) ? "sono arrivate solo le cifre iniziali (" + got.length + " caratteri). Il token completo è lungo circa 46 caratteri, tipo 123456789:AAH…, copialo di nuovo intero." : "deve essere nel formato 123456789:AAH… (lo trovi in @BotFather, /mybots, API Token).");
          return status();
        }
        tokErr = "";
        if (tk !== cfg.token) { cfg.token = tk; cfg.offset = 0; me = null; }
      }
      if (c.removeToken) { tokErr = ""; cfg.token = ""; cfg.enabled = false; me = null; }
      if (typeof c.enabled === "boolean") cfg.enabled = c.enabled;
      if (["off", "approve", "auto"].includes(c.join)) cfg.join = c.join;
      if (c.notify) cfg.notify = Object.assign(cfg.notify, c.notify);
      if (typeof c.apiBase === "string") cfg.apiBase = c.apiBase;
      if (c.renamePlayer && c.renamePlayer.from && c.renamePlayer.to) Object.values(cfg.chats).forEach((ch) => { if (ch.player === c.renamePlayer.from) ch.player = String(c.renamePlayer.to).slice(0, 60); });
      if (typeof c.welcome === "string") cfg.welcome = c.welcome.trim().slice(0, 800);
      if (c.newCode) cfg.code = newCode();
      const uname = (x) => String(x || "").replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").trim().toLowerCase();
      const gamesOk = (g) => (Array.isArray(g) ? g : []).map(String).slice(0, 50);
      /* ruolo per username (vale appena quella persona scrive al bot in privato) */
      if (c.userRole) {
        const u = uname(c.userRole.u);
        if (/^[a-z0-9_]{4,32}$/.test(u) && ["admin", "org"].includes(c.userRole.role)) {
          cfg.userRoles[u] = { role: c.userRole.role, games: c.userRole.role === "org" ? gamesOk(c.userRole.games) : [] };
          Object.keys(cfg.chats).forEach((id) => { const ch = cfg.chats[id]; if (ch.viaUser === u || (ch.name || "").toLowerCase() === "@" + u) { ch.role = cfg.userRoles[u].role; ch.games = cfg.userRoles[u].games.slice(); ch.viaUser = u; } });
        }
      }
      if (c.removeUserRole) {
        const u = uname(c.removeUserRole); delete cfg.userRoles[u];
        Object.keys(cfg.chats).forEach((id) => { const ch = cfg.chats[id]; if (ch.viaUser === u) { ch.role = "player"; ch.games = []; delete ch.viaUser; } });
      }
      /* ruolo, tornei e giocatore di una persona che ha già scritto al bot */
      if (c.setRole && cfg.chats[c.setRole.id]) { const ch = cfg.chats[c.setRole.id]; ch.role = ["admin", "org"].includes(c.setRole.role) ? c.setRole.role : "player"; ch.games = ch.role === "org" ? gamesOk(c.setRole.games) : []; delete ch.viaUser; }
      if (c.setPlayer && cfg.chats[c.setPlayer.id]) { const pn = String(c.setPlayer.player || "").replace(/\s+/g, " ").trim().slice(0, 32); cfg.chats[c.setPlayer.id].player = /[<>]/.test(pn) ? "" : pn; }
      if (c.removeChat && cfg.chats[c.removeChat]) delete cfg.chats[c.removeChat];
      if (c.removeAdmins) Object.keys(cfg.chats).forEach((id) => { if (cfg.chats[id].role === "admin" || cfg.chats[id].role === "org") cfg.chats[id].role = "player"; });
      persist();
      if ("token" in c || "enabled" in c || c.removeToken || "apiBase" in c) return start();
      return status();
    },
    decide(id, ok) { return decide(id, ok, null); },
    setStreamer(s) { streamer = s; },
    /* la diretta è partita: avviso a tutte le chat del bot, con dove guardarla */
    liveStarted(L) {
      liveLinks = L || [];
      if (!running) return;
      const t = vm ? vm.title : "Tornei";
      Object.keys(cfg.chats).forEach((id) => send(id, "🔴 <b>" + esc(t) + " è in diretta!</b>\n\n" + linksText(liveLinks)));
    },
    liveEnded() { liveLinks = null; },
    pngReply(id, data) { if (pngWait[id]) { const f = pngWait[id]; delete pngWait[id]; f(data); } }
  };
};
