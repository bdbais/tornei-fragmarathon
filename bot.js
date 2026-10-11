/* Tornei Fragmarathon: bot Telegram.
   Gira nel processo principale dell'app installata, con long polling (getUpdates): non serve
   un server, basta che l'app sia aperta sul PC dell'organizzatore e che ci sia internet.
   La pagina manda una "vista" già calcolata dei tornei (setVM); il bot risponde da lì e,
   confrontando una vista con la precedente, manda le notifiche a chi segue i tornei.
   Token, chat e richieste di iscrizione stanno in un file nella cartella dati dell'app,
   mai nei backup dei tornei. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const I18N = require("./js/i18n-core.js");
/* dizionari js/lang/<codice>.js, caricati quando servono */
const DICTS = {};
function dictOf(code) {
  code = I18N.pick(code); if (!code || code === "it") return null;
  if (!(code in DICTS)) { try { DICTS[code] = require(path.join(__dirname, "js", "lang", code + ".js")); } catch { DICTS[code] = null; } }
  return DICTS[code];
}

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
  "/server – il server dove giochi la prossima partita: indirizzo e password",
  "/mappa – la mappa della sala con la tua postazione",
  "/discord <i>account</i> – il tuo account Discord: entri nei canali delle tue partite",
  "/info – data, luogo e link del torneo (WhatsApp, Telegram, Discord, TeamSpeak)",
  "/teamspeak – indirizzo e password del server TeamSpeak",
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
  ["giocatore", "Cerca un giocatore"], ["io", "Collega il tuo giocatore"], ["miepartite", "Le tue prossime partite"], ["server", "Il server della tua prossima partita"], ["mappa", "Mappa della sala e la tua postazione"], ["discord", "Il tuo account Discord"], ["info", "Data, luogo e link del torneo"], ["teamspeak", "Server TeamSpeak"],
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
/* codice amministratore: 10 caratteri casuali (32^10 combinazioni, non si indovina per tentativi), senza 0/O e 1/I */
const CODE_A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() { return Array.from(crypto.randomBytes(10), (b) => CODE_A[b % 32]).join(""); }
/* Ripristino di un backup: impostazioni del bot che mancavano (prendono il valore predefinito)
   e differenze rispetto alla configurazione sostituita. Il token non compare mai, si dice solo se cambia. */
const JOIN_L = { off: "chiuse", approve: "con approvazione", auto: "automatiche" };
const NOTIFY_L = { stage: "Avvisi di fase", final: "Avviso della finale", results: "Avviso dei risultati", player: "Avvisi personali ai giocatori" };
function cfgReport(txt, prevTxt) {
  let c = {}, p = null;
  try { c = JSON.parse(txt) || {}; } catch {}
  try { p = prevTxt ? JSON.parse(prevTxt) : null; } catch {}
  const defaults = [], diffs = [], yn = (v) => (v ? "sì" : "no");
  if (c.join === undefined) defaults.push(["Iscrizioni dal bot", JOIN_L.approve]);
  const nd = { stage: true, final: true, results: false, player: true }, n = c.notify || {};
  Object.keys(nd).forEach((k) => { if (n[k] === undefined) defaults.push([NOTIFY_L[k], yn(nd[k])]); });
  if (c.welcome === undefined) defaults.push(["Messaggio di benvenuto", "quello standard"]);
  if (c.groups === undefined) defaults.push(["Gruppi e canali abilitati", "nessuno"]);
  if (c.blocked === undefined) defaults.push(["Gruppi bloccati", "nessuno"]);
  if (c.code === undefined) defaults.push(["Codice amministratore", "nuovo"]);
  const oldAdm = (c.admins || []).length + (c.adminUsers || []).length;
  if (oldAdm) defaults.push(["Amministratori del formato vecchio convertiti in ruoli", String(oldAdm)]);
  if (p) {
    const q = (l, a, b) => { if (String(a) !== String(b)) diffs.push([l, String(a), String(b)]); };
    const adm = (x) => Object.values(x.chats || {}).filter((h) => h && h.role === "admin").length + Object.values(x.userRoles || {}).filter((r) => r && r.role === "admin").length + (x.admins || []).length + (x.adminUsers || []).length;
    const grp = (x) => Object.values(x.groups || {}).filter((g) => g && g.status === "on").length;
    if ((p.token || "") !== (c.token || "")) diffs.push(["Token", c.token ? "cambiato" : "tolto", ""]);
    q("Bot acceso", yn(p.enabled), yn(c.enabled));
    q("Iscrizioni dal bot", JOIN_L[p.join || "approve"], JOIN_L[c.join || "approve"]);
    const pn = Object.assign({}, nd, p.notify), cn = Object.assign({}, nd, c.notify);
    Object.keys(nd).forEach((k) => q(NOTIFY_L[k], yn(pn[k]), yn(cn[k])));
    if ((p.welcome || "") !== (c.welcome || "")) diffs.push(["Messaggio di benvenuto", "cambiato", ""]);
    q("Persone collegate", Object.keys(p.chats || {}).length, Object.keys(c.chats || {}).length);
    q("Amministratori", adm(p), adm(c));
    q("Richieste in attesa", (p.pending || []).length, (c.pending || []).length);
    q("Gruppi e canali abilitati", grp(p), grp(c));
    q("Gruppi bloccati", Object.keys(p.blocked || {}).length, Object.keys(c.blocked || {}).length);
  }
  return { defaults, diffs };
}
function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
/* testo diviso in messaggi da max caratteri; una riga troppo lunga si spezza su uno spazio, mai dentro &amp; né in una coppia surrogata */
function chunks(text, max) {
  const out = []; let cur = "";
  const add = (l) => { if (cur.length + l.length + 1 > max && cur) { out.push(cur); cur = ""; } cur += (cur ? "\n" : "") + l; };
  for (let line of String(text).split("\n")) {
    while (line.length > max) {
      let k = line.lastIndexOf(" ", max); if (k < max / 2) k = max;
      const a = line.lastIndexOf("&", k - 1); if (a > 0 && a > line.lastIndexOf(";", k - 1) && k - a < 10) k = a;
      if (/[\uD800-\uDBFF]/.test(line[k - 1])) k--;
      add(line.slice(0, k)); line = line.slice(k).replace(/^ /, "");
    }
    add(line);
  }
  if (cur) out.push(cur);
  return out;
}

module.exports = function createBot(opts) {
  const file = opts.file;
  let streamer = null, liveLinks = null;
  let cfg = load(), vm = null, prev = null, running = false, ctrl = null, me = null, lastErr = "", tokErr = "", lastOk = 0;
  /* gen: ogni start/stop la incrementa, così un ciclo o un avvio rimasto indietro si ferma da solo;
     dead: istanza scartata (bot tolto o ripristinato da un backup), non scrive più il file né manda messaggi */
  let gen = 0, dead = false, retryT = null, retryMs = 5000;
  /* domande in sospeso (nome, account Discord): valgono 10 minuti e le annulla qualsiasi altro comando o pulsante */
  const waits = {}, pngWait = {}, WAIT_MS = 10 * 60 * 1000;
  /* /admin: tentativi sbagliati per utente (in memoria, /stop non li azzera) */
  const admFail = {};

  function defaults() { return { token: "", enabled: false, join: "approve", notify: { stage: true, final: true, results: false, player: true }, admins: [], adminUsers: [], userRoles: {}, chats: {}, pending: [], offset: 0, code: newCode(), apiBase: "", welcome: "", groups: {}, blocked: {} }; }
  function load() {
    let raw, txt = null;
    try { txt = fs.readFileSync(file, "utf8"); } catch {}
    if (txt != null) {
      try { raw = JSON.parse(txt); }
      catch {
        /* file rovinato (corrente staccata durante la scrittura): si mette da parte, non si sovrascrive con i valori predefiniti;
           se c'è la copia temporanea dell'ultimo salvataggio e si legge, si riparte da quella */
        try { fs.renameSync(file, file + ".rovinato-" + Date.now()); } catch {}
        try { raw = JSON.parse(fs.readFileSync(file + ".tmp", "utf8")); } catch {}
      }
    }
    try {
      const c = Object.assign(defaults(), raw); c.notify = Object.assign(defaults().notify, c.notify);
      /* versioni precedenti: admin per chat e per username diventano ruoli */
      (c.admins || []).forEach((a) => { const ch = c.chats[a] || (c.chats[a] = { follow: { all: false, games: [] } }); if (!ch.role) ch.role = "admin"; });
      (c.adminUsers || []).forEach((u) => { if (!c.userRoles[u]) c.userRoles[u] = { role: "admin", games: [] }; });
      c.admins = []; c.adminUsers = [];
      /* il vecchio codice di 6 cifre si indovinava per tentativi: si sostituisce */
      if (!/^[A-Z2-9]{10}$/.test(String(c.code || ""))) c.code = newCode();
      /* collegamenti fatti prima che esistesse la conferma (c.verified): valgono come confermati, così aggiornare il programma
         durante un torneo non toglie /server e /discord a chi era già collegato. Da qui in poi /io da solo resta non confermato */
      Object.values(c.chats || {}).forEach((ch) => { if (ch && ch.player && !("verified" in ch)) ch.verified = true; });
      return c;
    }
    catch { return defaults(); }
  }
  /* scrittura sicura: file temporaneo scritto fino in fondo sul disco, poi rinominato sopra quello vero */
  function persist() {
    if (dead) return;
    const tmp = file + ".tmp", data = JSON.stringify(cfg, null, 1);
    try { const fd = fs.openSync(tmp, "w"); try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch { return; }
    try { fs.renameSync(tmp, file); } catch { try { fs.writeFileSync(file, data); fs.unlinkSync(tmp); } catch {} }
  }

  async function api(method, body, form) {
    if (!cfg.token) throw new Error("Manca il token del bot");
    const base = String(cfg.apiBase || "https://api.telegram.org").replace(/\/+$/, "");
    const c = new AbortController(); if (method === "getUpdates") ctrl = c;
    const t = setTimeout(() => c.abort(), method === "getUpdates" ? 70000 : 40000);
    try {
      const r = await (opts.fetch || fetch)(base + "/bot" + cfg.token + "/" + method, form ? { method: "POST", body: form, signal: c.signal }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: c.signal });
      const j = await r.json().catch(() => ({ ok: false, description: "risposta non valida (HTTP " + r.status + ")" }));
      if (!j.ok) { const e = new Error(j.description || "errore " + r.status), p = j.parameters || {}; e.retryAfter = +p.retry_after || 0; e.migrateTo = p.migrate_to_chat_id || null; throw e; }
      return j.result;
    } finally { clearTimeout(t); }
  }
  /* lingua del torneo (vm.lang): testi e pulsanti tradotti prima di partire */
  /* i testi degli utenti restano come sono: i nomi (titolo, giochi, giocatori, squadre) si riconoscono a confine di parola,
     gli altri valori (password, indirizzi, benvenuto, annunci, titoli dei gruppi) si segnano con U() */
  const U = (s) => "\u0002" + String(s == null ? "" : s).replace(/[\u0001-\u0003]/g, "") + "\u0003", UE = (s) => U(esc(s));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), WCH = /[\p{L}\p{N}]/u;
  let protVm = {}, protRe = null;
  function protectRe() {
    if (protVm === vm) return protRe;
    protVm = vm; const set = new Set();
    if (vm) {
      [vm.title, vm.sub].concat(vm.roster || []).forEach((x) => x && set.add(String(x)));
      (vm.tournaments || []).forEach((t) => { [t.l, t.name].concat(t.players || [], Object.keys(t.members || {})).forEach((x) => x && set.add(String(x))); });
    }
    const prot = [...set].filter((x) => x.length >= 2).flatMap((x) => (esc(x) !== x ? [esc(x), x] : [x])).sort((a, b) => b.length - a.length);
    const alt = prot.map((p) => (WCH.test(p[0]) ? "(?<![\\p{L}\\p{N}])" : "") + reEsc(p) + (WCH.test(p[p.length - 1]) ? "(?![\\p{L}\\p{N}])" : ""));
    /* una sola passata: i segnaposto già messi non si toccano più (un nome come "10" non finisce dentro un segnaposto) */
    protRe = new RegExp(["\\u0002[^\\u0003]*\\u0003"].concat(alt).join("|"), "gu");
    return protRe;
  }
  const L = (s) => {
    if (s == null) return s;
    const txt = String(s), d = dictOf(vm && vm.lang);
    if (!d) return /[\u0002\u0003]/.test(txt) ? txt.replace(/[\u0002\u0003]/g, "") : txt;
    const keep = [], t2 = txt.replace(protectRe(), (m) => "\u0001" + (keep.push(m.charAt(0) === "\u0002" ? m.slice(1, -1) : m) - 1) + "\u0001");
    return I18N.tr(t2, d).replace(/\u0001(\d+)\u0001/g, (_, i) => (keep[+i] == null ? "" : keep[+i]));
  };
  const Lkb = (kb) => kb && kb.map((row) => row.map((b) => Object.assign({}, b, { text: L(b.text) })));
  /* argomenti dei comandi: nei suggerimenti tradotti compaiono nella lingua del torneo (es. "/segui todos"), quindi si accettano anche così */
  const kw = (a, it) => { if (a === it) return true; const d = dictOf(vm && vm.lang); return !!d && a === norm(I18N.tr(it, d)); };
  /* invii uno alla volta, con un piccolo intervallo (Telegram limita circa 30 messaggi al secondo), in due code:
     prima le risposte a chi scrive, poi gli avvisi a tutti (annunci, notifiche, diretta), così un annuncio a molte chat
     non blocca le risposte. Ogni invio restituisce la sua promessa, non quella di tutta la coda.
     Troppi messaggi (429): il messaggio, e quelli dopo per la stessa chat, si riprovano dopo l'attesa chiesta da Telegram. */
  const hi = [], lo = []; let pumping = false;
  function enqueue(chat, fn, bulk, onErr) {
    if (dead) return Promise.resolve();
    /* se la chat è in attesa per un 429, anche il nuovo messaggio aspetta: l'ordine resta quello di invio */
    const ch = String(chat), at = hi.concat(lo).reduce((m, x) => (x.chat === ch && x.at > m ? x.at : m), 0);
    /* in quel caso la promessa si risolve subito: il ciclo degli aggiornamenti non resta fermo per una sola chat */
    return new Promise((res) => { (bulk ? lo : hi).push({ chat: ch, fn, onErr, res: at > Date.now() ? () => {} : res, at, n: 0 }); if (at > Date.now()) res(); pump(); });
  }
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      while (hi.length || lo.length) {
        if (dead) { hi.concat(lo).forEach((j) => j.res()); hi.length = 0; lo.length = 0; break; }
        const now = Date.now(), ready = (Q) => Q.findIndex((j) => j.at <= now);
        let Q = hi, i = ready(hi); if (i < 0) { Q = lo; i = ready(lo); }
        if (i < 0) { await sleep(Math.max(20, Math.min(250, Math.min(...hi.concat(lo).map((j) => j.at)) - now))); continue; }
        const j = Q.splice(i, 1)[0];
        try { await j.fn(); j.res(); }
        catch (e) {
          if (e && e.retryAfter && j.n < 2) {
            /* chi aspetta questo invio (il ciclo degli aggiornamenti fa await di handle) non resta fermo minuti per una sola chat */
            j.res(); j.res = () => {};
            j.n++; j.at = Date.now() + Math.min(e.retryAfter, 300) * 1000 + 200;
            hi.concat(lo).forEach((x) => { if (x.chat === j.chat && x.at < j.at) x.at = j.at; });
            Q.unshift(j);
          } else { try { j.onErr && j.onErr(e); } catch {} j.res(); }
        }
        await sleep(45);
      }
    } finally { pumping = false; }
  }
  function sendErr(chatId, e) {
    const m = String((e && e.message) || "");
    if (e && e.migrateTo && cfg.groups[String(chatId)]) migrateGroup(String(chatId), String(e.migrateTo));
    else if (/blocked|chat not found|deactivated/i.test(m) && cfg.chats[chatId]) { delete cfg.chats[chatId]; persist(); }
  }
  function send(chatId, text, kb, bulk) {
    text = L(text); kb = Lkb(kb);
    const parts = chunks(text, 3900); let last = Promise.resolve();
    parts.forEach((p, i) => {
      last = enqueue(chatId, () => api("sendMessage", { chat_id: chatId, text: p, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: i === parts.length - 1 && kb ? { inline_keyboard: kb } : undefined }), bulk, (e) => sendErr(chatId, e));
    });
    return last;
  }
  function sendFile(chatId, kind, name, type, buf, caption, bulk) {
    return enqueue(chatId, () => {
      const f = new FormData();
      f.append("chat_id", String(chatId));
      if (caption) { f.append("caption", L(caption)); f.append("parse_mode", "HTML"); }
      f.append(kind, new Blob([buf], { type }), name);
      return api(kind === "photo" ? "sendPhoto" : "sendDocument", null, f);
    }, bulk, (e) => sendErr(chatId, e));
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
    return L.find((t) => t.k === q || t.k.toLowerCase() === q) || L.find((t) => baseK(t.k) === q) || L.find((t) => norm(t.l) === q || norm(t.name) === q)
      || L.find((t) => norm(t.l).includes(q) || norm(t.name).includes(q) || norm(t.l + " " + t.name).includes(q)) || null;
  }
  /* ---------- gruppi e canali ----------
     Quando qualcuno aggiunge il bot a un gruppo o canale, il bot non parla finché un amministratore
     non lo abilita (dall'app o con /gruppi). Abilitato: si presenta con il link per scrivergli in privato,
     risponde ai comandi di sola lettura e riceve annunci e diretta. "Esci e blocca" lo fa uscire e
     blocca chi lo ha aggiunto: se ci riprova, il bot esce da solo; i suoi messaggi privati vengono ignorati. */
  const isBlocked = (u) => !!(u && cfg.blocked[String(u.id)]);
  const adminIds = () => Object.keys(cfg.chats).filter((id) => roleOf(id) === "admin");
  const who = (u) => (u ? (u.username ? "@" + u.username : [u.first_name, u.last_name].filter(Boolean).join(" ")) : "");
  const GTYPE = { group: "gruppo", supergroup: "gruppo", channel: "canale" };
  function gLabel(id) { const g = cfg.groups[id] || {}; return "<b>" + UE(g.title || id) + "</b> (" + (GTYPE[g.type] || "chat") + ")"; }
  const GSTATE = { pending: "⏳ in attesa", on: "✅ attivo", off: "⏸ disattivato" };
  function groupKb(id) {
    const g = cfg.groups[id] || {};
    return [[g.status === "on" ? { text: "⏸ Disattiva", callback_data: "Q:f:" + id } : { text: "✅ Abilita", callback_data: "Q:o:" + id }, { text: "🚪 Esci", callback_data: "Q:x:" + id }],
      [{ text: "⛔ Esci e blocca chi mi ha aggiunto", callback_data: "Q:b:" + id }]];
  }
  async function onMember(m) {
    const chat = m.chat, st = m.new_chat_member && m.new_chat_member.status, by = m.from, id = String(chat.id);
    if (chat.type === "private") return;
    const known = !!cfg.groups[id], g = cfg.groups[id] || (cfg.groups[id] = { status: "pending" });
    g.title = chat.title || g.title || id; g.type = chat.type; g.username = chat.username || "";
    if (st === "member" || st === "administrator") {
      /* era già nel gruppo: promosso, retrocesso o permessi cambiati. Niente presentazione né avvisi, e "chi mi ha aggiunto" non cambia */
      const old = m.old_chat_member || {}, wasIn = ["member", "administrator", "creator"].includes(old.status) || (old.status === "restricted" && old.is_member);
      if (wasIn && known && g.in !== false) { g.in = true; persist(); opts.onChange && opts.onChange(); return; }
      g.in = true; g.ts = Date.now(); g.by = by ? { id: String(by.id), name: who(by) } : g.by;
      if (isBlocked(by)) {
        g.in = false; g.status = "off"; persist(); await api("leaveChat", { chat_id: id }).catch(() => {});
        adminIds().forEach((a) => send(a, "⛔ " + UE(who(by)) + " (bloccato) mi ha aggiunto a " + gLabel(id) + ": sono uscito da solo."));
      } else if (g.status === "on") { persist(); intro(id); }
      else {
        g.status = g.status === "off" ? "off" : "pending"; persist();
        adminIds().forEach((a) => send(a, "📥 Mi hanno aggiunto a " + gLabel(id) + (by ? " (da " + UE(who(by)) + ")" : "") + ".\nNon scrivo nulla lì finché non mi abiliti.", groupKb(id)));
      }
    } else if (st === "left" || st === "kicked") { g.in = false; persist(); }
    opts.onChange && opts.onChange();
  }
  function intro(id) {
    const u = me && me.username;
    send(id, "👋 Ciao a tutti! Sono il bot dei tornei di <b>" + esc(vm ? vm.title : "Tornei") + "</b>." + linksInfo() +
      (u ? "\n\nPer iscriverti e ricevere gli avvisi personali scrivimi in privato: https://t.me/" + u : "") +
      "\n\nQui rispondo a /tornei, /classifica, /partite, /risultati e /diretta.", u ? [[{ text: "Apri il bot", url: "https://t.me/" + u + "?start=gruppo" }]] : null);
  }
  function groupSet(id, status) {
    const g = cfg.groups[id]; if (!g) return false;
    const was = g.status; g.status = status; persist(); opts.onChange && opts.onChange();
    if (status === "on" && was !== "on" && g.in !== false) intro(id);
    return true;
  }
  async function groupLeave(id, block) {
    const g = cfg.groups[id]; if (!g) return false;
    if (block && g.by && g.by.id) {
      cfg.blocked[g.by.id] = { name: g.by.name || g.by.id, ts: Date.now(), from: g.title || id };
      for (const [gid, x] of Object.entries(cfg.groups)) if (x.by && x.by.id === g.by.id && x.in !== false && gid !== id) { x.in = false; x.status = "off"; await api("leaveChat", { chat_id: gid }).catch(() => {}); }
    }
    g.in = false; g.status = "off"; persist(); opts.onChange && opts.onChange();
    await api("leaveChat", { chat_id: id }).catch(() => {});
    return true;
  }
  function groupsMsg() {
    const L = Object.entries(cfg.groups).filter(([, g]) => g.in !== false);
    if (!L.length) return { text: "Non sono in nessun gruppo o canale." + (Object.keys(cfg.blocked).length ? "\n\n/bloccati – chi è bloccato" : "") };
    return {
      text: "<b>Gruppi e canali in cui sono</b>\n\n" + L.map(([id, g], i) => (i + 1) + ". " + gLabel(id) + " – " + (GSTATE[g.status] || g.status) + (g.by ? "\n   aggiunto da " + esc(g.by.name) : "")).join("\n") +
        "\n\n<i>Abilita</i>: mi presento e rispondo ai comandi. <i>Esci e blocca</i>: esco e, se chi mi ha aggiunto ci riprova, esco da solo.",
      kb: [].concat(...L.map(([id, g]) => [[{ text: U(Array.from(String(g.title || id)).slice(0, 30).join("")), callback_data: "Q:i:" + id }]].concat(groupKb(id))))
    };
  }
  function blockedMsg() {
    const L = Object.entries(cfg.blocked);
    if (!L.length) return { text: "Nessuno è bloccato." };
    return { text: "<b>Bloccati</b> (se mi aggiungono a un gruppo esco da solo)\n\n" + L.map(([, b]) => "• " + UE(b.name) + (b.from ? " – da " + UE(b.from) : "")).join("\n"),
      kb: L.map(([uid, b]) => [{ text: "Sblocca " + U(Array.from(String(b.name)).slice(0, 24).join("")), callback_data: "B:" + uid }]) };
  }
  /* un gruppo diventato supergruppo cambia id: la voce (stato, chi l'ha aggiunto, titolo) passa al nuovo id */
  function migrateGroup(from, to) {
    const o = cfg.groups[from]; if (!o || from === to) return false;
    const n = cfg.groups[to] || {};
    cfg.groups[to] = Object.assign({}, o, { title: n.title || o.title, type: "supergroup", in: true, ts: Date.now() });
    delete cfg.groups[from];
    persist(); opts.onChange && opts.onChange();
    return true;
  }
  async function onGroupMsg(msg) {
    const id = String(msg.chat.id), text = typeof msg.text === "string" ? msg.text.trim() : "";
    if (msg.migrate_to_chat_id) { migrateGroup(id, String(msg.migrate_to_chat_id)); return; }
    if (msg.migrate_from_chat_id && migrateGroup(String(msg.migrate_from_chat_id), id)) return;
    const g = cfg.groups[id];
    if (!g) {
      /* era già nel gruppo prima di questa versione: lo registro in attesa e lo dico agli amministratori */
      cfg.groups[id] = { status: "pending", title: msg.chat.title || id, type: msg.chat.type, in: true, ts: Date.now() }; persist(); opts.onChange && opts.onChange();
      adminIds().forEach((a) => send(a, "📥 Sono in " + gLabel(id) + ".\nNon scrivo nulla lì finché non mi abiliti.", groupKb(id)));
      return;
    }
    if (g.status !== "on" || !text.startsWith("/") || !vm) return;
    const sp = text.slice(1).split(/\s+/), [c0, at] = sp[0].split("@"), cmd = c0.toLowerCase(), arg = text.slice(1 + sp[0].length).trim();
    if (at && me && at.toLowerCase() !== String(me.username || "").toLowerCase()) return;
    viewer = null;
    if (cmd === "start" || cmd === "aiuto" || cmd === "help") return intro(id);
    if (cmd === "tornei") return send(id, listMsg().text);
    if (cmd === "risultati") return send(id, resultsMsg());
    if (cmd === "classifica" || cmd === "partite" || cmd === "torneo") {
      const t = find(arg); if (!t) return send(id, "Quale torneo? Esempio: /" + cmd + " " + esc((T()[0] || { l: "cs2" }).l));
      if (cmd === "partite") return send(id, tTitle(t) + "\n\n" + (t.next.length ? "<b>Da giocare</b>\n" + t.next.map(esc).join("\n") : "Nessuna partita da giocare adesso."));
      return send(id, tTitle(t) + "\n\n" + (t.lines.length ? t.lines.map(esc).join("\n") : "Nessuna classifica ancora."));
    }
    if (cmd === "diretta") return send(id, liveLinks ? "🔴 <b>In diretta!</b>\n" + linksText(liveLinks) : "Nessuna diretta in questo momento.");
  }
  const enabledGroups = () => Object.entries(cfg.groups).filter(([, g]) => g.status === "on" && g.in !== false).map(([id]) => id);
  /* TeamSpeak: link di invito, oppure indirizzo da copiare (Telegram non apre i link ts3server://) */
  function tsLine(L) { return "🎙 TeamSpeak: " + (/^https:/i.test(L.ts) ? UE(L.ts) : "<code>" + UE(L.ts) + "</code>") + (L.tspass ? "\n🔑 Password TeamSpeak: <code>" + UE(L.tspass) + "</code>" : ""); }
  function linksInfo() {
    const L = (vm && vm.links) || {}, a = [];
    if (L.when) a.push("📅 " + UE(L.when) + (L.place ? ", " + UE(L.place) : ""));
    if (L.mode === "online") a.push("🌐 Online" + (L.addr ? ": " + UE(L.addr) : ""));
    else if (L.addr || L.maps) a.push("📍 " + (L.mode === "ibrido" ? "In presenza e online – " : "") + (L.addr ? UE(L.addr) : "Mappa") + (L.maps ? "\n🗺 " + UE(L.maps) : ""));
    if (L.wa) a.push("💬 Gruppo WhatsApp: " + UE(L.wa));
    if (L.tg) a.push("📣 Canale Telegram: " + UE(L.tg));
    if (L.discord) a.push("🎧 Server Discord: " + UE(L.discord));
    if (L.ts) a.push(tsLine(L));
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
    return ok.length ? ok.map((l) => "▶️ " + UE(l.name) + ": " + UE(l.url)).join("\n") : "(il link non è stato impostato: chiedi all'organizzatore)";
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
    if (kw(a, "avvia") || a === "start") {
      send(chatId, "Avvio la diretta…");
      const st = await streamer.start();
      return st.err && !st.starting && !st.live ? send(chatId, "❌ Non partita: " + esc(st.err)) : null;
    }
    if (kw(a, "ferma") || a === "stop") { streamer.stop(); return send(chatId, "⏹ Diretta fermata."); }
    if (kw(a, "scena") || a === "scene") {
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
    /* un testo che inizia con = + - @ Excel lo eseguirebbe come formula: gli si mette davanti un apice (i numeri restano numeri) */
    const h = vm.hof, q = (v) => { let s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }, rows = [["Classifica", "Posizione", "Nome", "Totale", "Dettaglio per gioco"]];
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
      const pos = t.pl[who], next = t.nextP ? t.nextP.filter((x) => (x.p || []).includes(who)).map((x) => x.t) : t.next.filter((x) => x.includes(who));
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
        if (msg) fol.forEach((id) => send(id, msg, [[{ text: "Apri il torneo", callback_data: "T:" + t.k }]], true));
      }
      if (cfg.notify.results) {
        const seen = new Set((o.results || []).map((r) => r.id)), nuovi = (t.results || []).filter((r) => !seen.has(r.id));
        if (nuovi.length && nuovi.length <= 6) fol.forEach((id) => send(id, "⚔️ " + tTitle(t) + "\n" + nuovi.map((r) => esc(r.text)).join("\n"), null, true));
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
        if (turn.length) send(id, "🎮 <b>Tocca a te</b> – " + tTitle(t) + "\n" + turn.map((x) => esc(x.t)).join("\n"), null, true);
        const seen = new Set((o.results || []).map((r) => r.id)), res = (t.results || []).filter((r) => !seen.has(r.id) && mine(r));
        if (res.length && res.length <= 4) send(id, "📊 Il tuo risultato – " + tTitle(t) + "\n" + res.map((r) => esc(r.text)).join("\n"), null, true);
        if (!o.done && t.done) { const who = me.find((n) => t.pl && t.pl[n]); if (who) send(id, "🏁 " + tTitle(t) + " è finito: " + (who !== P ? "la tua squadra " + esc(who) + " ha" : "hai") + " chiuso al <b>" + t.pl[who] + "º posto</b>.", null, true); }
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
  /* dati dei pulsanti: Telegram ne accetta al massimo 64 byte; si taglia per caratteri interi */
  const cbd = (p, s) => { const a = Array.from(String(s)); while (a.length && Buffer.byteLength(p + a.join("")) > 64) a.pop(); return p + a.join(""); };
  /* Il collegamento con /io è solo dichiarato: basta per gli avvisi. È "confermato" (c.verified) quando viene da un'iscrizione
     accettata o automatica, o dall'organizzatore nell'app: solo allora /discord cambia l'account e /server mostra la password. */
  function linkPlayer(chatId, name, force) {
    name = String(name || "").replace(/\s+/g, " ").trim();
    const L = knownNames(), exact = name ? L.find((n) => norm(n) === norm(name)) : null;
    if (!exact && !/^[^<>\u0000-\u001f]{1,32}$/.test(name)) return send(chatId, "Nome non valido: da 1 a 32 caratteri, senza < >.");
    if (!exact && !force) {
      const sim = L.filter((n) => norm(n).includes(norm(name)) || norm(name).includes(norm(n))).slice(0, 4);
      const kb = sim.map((n) => [{ text: "Sono " + n, callback_data: cbd("M:", n) }]).concat([[{ text: "Collegami comunque come «" + U(Array.from(name).slice(0, 20).join("")) + "»", callback_data: cbd("N:", name) }]]);
      return send(chatId, "Non trovo «" + UE(name) + "» tra i partecipanti." + (sim.length ? " Forse sei:" : "\nSe non sei ancora iscritto usa /iscrivimi, oppure collegati comunque: appena l'organizzatore ti aggiunge riceverai gli avvisi."), kb);
    }
    const c = cfg.chats[chatId], pl = exact || name;
    c.verified = !!c.verified && norm(c.player) === norm(pl); c.player = pl; persist(); opts.onChange && opts.onChange();
    return send(chatId, "✅ Sei collegato come <b>" + esc(c.player) + "</b>: ti avviso quando tocca a te, con i tuoi risultati e la posizione finale.\n/miepartite per le tue partite, /scollega per togliere il collegamento.");
  }
  function follow(chatId, q, on) {
    const c = cfg.chats[chatId]; c.follow = c.follow || { all: false, games: [] };
    if (kw(norm(q), "tutti")) { c.follow.all = on; if (!on) c.follow.games = []; persist(); return send(chatId, on ? "Ricevi gli avvisi di tutti i tornei." : "Non segui più nessun torneo."); }
    const t = find(q); if (!t) return send(chatId, "Quale torneo? " + (q ? "Non trovo «" + UE(q) + "»." : "") + "\nUsa /tornei per l'elenco.");
    const b = baseK(t.k), had = c.follow.games || [];
    c.follow.games = had.filter((k) => k !== t.k && k !== b);
    /* formato vecchio: la chiave del solo gioco valeva in ogni torneo; si toglie e restano seguiti gli altri tornei con quel gioco */
    if (had.includes(b) && b !== t.k) ((vm && vm.tournaments) || []).forEach((x) => { if (x.k !== t.k && baseK(x.k) === b && !c.follow.games.includes(x.k)) c.follow.games.push(x.k); });
    if (on) c.follow.games.push(t.k); persist();
    return send(chatId, on ? "Segui " + tTitle(t) + ": ti avviso a ogni cambio di turno e alla fine." : "Non segui più " + tTitle(t) + ".");
  }
  /* account Discord: nome utente (es. fede_73), vecchio formato nome#1234 oppure id numerico */
  function dcOk(s) { s = String(s || "").trim().replace(/^@/, ""); return /^[\w.]{2,32}$/.test(s) || /^[^#<>@:]{2,32}#\d{4}$/.test(s) || /^\d{16,21}$/.test(s) ? s : ""; }
  async function joinStart(chatId, from, t, name, dc) {
    if (!t) return send(chatId, "A quale torneo vuoi iscriverti? Usa /tornei e poi «Iscriviti».");
    if (cfg.join === "off") return send(chatId, "Le iscrizioni dal bot sono chiuse: chiedi all'organizzatore.");
    if (!t.open) return send(chatId, "Le iscrizioni a " + tTitle(t) + " sono chiuse: il torneo è già iniziato.");
    /* limiti per chat: una richiesta in attesa per torneo, e un tetto alle richieste di tutti */
    if (cfg.join !== "auto" && cfg.pending.some((p) => p.k === t.k && String(p.chatId) === String(chatId))) return send(chatId, "Hai già una richiesta in attesa per " + tTitle(t) + ": aspetta la conferma dell'organizzatore.");
    if (cfg.join !== "auto" && cfg.pending.length >= 200) return send(chatId, "Ci sono troppe richieste in attesa: riprova più tardi o chiedi all'organizzatore.");
    if (!name) { waits[chatId] = { ts: Date.now(), type: "join", k: t.k }; return send(chatId, "Scrivi il nome con cui vuoi giocare a " + tTitle(t) + " (massimo 32 caratteri)."); }
    name = String(name).replace(/\s+/g, " ").trim();
    if (!/^[^<>\u0000-\u001f]{1,32}$/.test(name)) return send(chatId, "Nome non valido: usa da 1 a 32 caratteri, senza < >.");
    const pool = t.team ? (vm.roster || []) : t.players, same = (p) => norm(p) === norm(name);
    /* nome già noto scritto con accenti o maiuscole diversi: si usa la grafia dell'elenco, per la richiesta e il collegamento */
    name = pool.find(same) || (vm.roster || []).find(same) || name;
    const taken = pool.some(same);
    if (taken && !t.team) return send(chatId, "«" + UE(name) + "» è già iscritto a " + tTitle(t) + ".");
    if (cfg.pending.some((p) => p.k === t.k && norm(p.name) === norm(name))) return send(chatId, "C'è già una richiesta per «" + UE(name) + "»: aspetta la conferma dell'organizzatore.");
    /* iscrizioni automatiche: da una chat al massimo 3 nomi per torneo (sé e qualche amico), poi decide l'organizzatore */
    const ch = cfg.chats[chatId], mine = ((ch.joined && ch.joined[t.k]) || []).filter((n) => norm(n) !== norm(name) && pool.some((p) => norm(p) === norm(n)));
    if (cfg.join === "auto" && mine.length >= 3) return send(chatId, "Hai già iscritto " + mine.map(UE).join(", ") + " a " + tTitle(t) + ": per altri nomi chiedi all'organizzatore.");
    /* torneo con Discord: si chiede anche l'account, per il canale delle partite */
    if (t.discord && dc === undefined) { waits[chatId] = { ts: Date.now(), type: "joindc", k: t.k, name }; return send(chatId, "Qual è il tuo account Discord? Scrivi il nome utente (es. fede_73): ti aggiungo ai canali delle tue partite.\nSe non ce l'hai, /salta."); }
    if (dc && !dcOk(dc)) { waits[chatId] = { ts: Date.now(), type: "joindc", k: t.k, name }; return send(chatId, "Account Discord non valido: scrivi il nome utente (es. fede_73), oppure /salta."); }
    dc = dcOk(dc);
    const req = { id: Math.random().toString(36).slice(2, 10), chatId, user: (from && (from.username ? "@" + from.username : from.first_name)) || "", name, discord: dc, k: t.k, l: t.l, team: !!t.team, ts: Date.now() };
    ch.verified = (cfg.join === "auto" && !taken) || (!!ch.verified && norm(ch.player) === norm(name));
    ch.player = name;
    const f = ch.follow; if (!hasK(f.games, t.k)) f.games.push(t.k);
    if (cfg.join === "auto") { (ch.joined || (ch.joined = {}))[t.k] = mine.concat(name).slice(-10); opts.onJoin(req); persist(); return send(chatId, "✅ Sei iscritto a " + tTitle(t) + " come <b>" + UE(name) + "</b>." + (dc ? "\nDiscord: <b>" + UE(dc) + "</b>" : "") + (t.team ? " L'organizzatore ti metterà in una squadra." : "") + "\nRiceverai gli avvisi del torneo."); }
    cfg.pending.push(req); persist(); opts.onChange && opts.onChange();
    managers(t.k).forEach((a) => send(a, "📝 Richiesta di iscrizione a " + tTitle(t) + ": <b>" + UE(name) + "</b>" + (req.user ? " (" + UE(req.user) + ")" : "") + (dc ? "\nDiscord: " + UE(dc) : ""), [[{ text: "Accetta", callback_data: "A:" + req.id }, { text: "Rifiuta", callback_data: "X:" + req.id }]]));
    return send(chatId, "📝 Richiesta inviata: l'organizzatore deve confermare l'iscrizione di <b>" + UE(name) + "</b> a " + tTitle(t) + ".");
  }
  function setDiscord(chatId, text) {
    const c = cfg.chats[chatId] || {}, dc = dcOk(text);
    if (!c.player) return send(chatId, "Prima dimmi chi sei: /io <i>il tuo nome</i>.");
    if (!c.verified) return send(chatId, "Per collegare l'account Discord a <b>" + UE(c.player) + "</b> serve un'iscrizione confermata: chiedi all'organizzatore di confermare il collegamento.");
    if (!dc) { waits[chatId] = { ts: Date.now(), type: "dc" }; return send(chatId, "Account Discord non valido: scrivi il nome utente (es. fede_73)."); }
    const evs = [...new Set(((vm && vm.tournaments) || []).map((t) => t.ev).filter(Boolean))];
    /* la pagina salva l'account solo per un nome tra i partecipanti: le si passa la grafia dell'elenco, e se il nome non c'è non si promettono i canali */
    const rn = vm ? (vm.roster || []).find((n) => norm(n) === norm(c.player)) : c.player;
    opts.onDiscord && opts.onDiscord({ name: rn || c.player, account: dc, evs });
    if (!rn) return send(chatId, "🎧 <b>" + UE(c.player) + "</b> non è ancora tra i partecipanti: l'account Discord <b>" + UE(dc) + "</b> non è stato salvato. Quando l'organizzatore ti avrà aggiunto, scrivi di nuovo /discord <i>account</i>.");
    return send(chatId, "🎧 Account Discord di <b>" + UE(c.player) + "</b>: <b>" + UE(dc) + "</b>. Entrerai nei canali delle tue partite.");
  }
  function decide(id, ok, byChat) {
    const i = cfg.pending.findIndex((p) => p.id === id); if (i < 0) { if (byChat) send(byChat, "Richiesta già gestita."); return false; }
    const req = cfg.pending.splice(i, 1)[0];
    const t = ok ? ((vm && vm.tournaments) || []).find((x) => x.k === req.k) : null, started = !!(t && !t.open);
    const ch = ok && cfg.chats[req.chatId];
    if (ch && norm(ch.player) === norm(req.name)) { ch.verified = true; (ch.joined || (ch.joined = {}))[req.k] = ((ch.joined[req.k]) || []).concat(req.name).slice(-10); }
    persist(); opts.onChange && opts.onChange();
    /* accettata dopo l'avvio del torneo: il nome va nell'elenco iscritti ma non nel torneo, e lo si dice */
    if (ok) opts.onJoin(req);
    send(req.chatId, ok ? (started ? "✅ Sei nell'elenco iscritti come <b>" + UE(req.name) + "</b>, ma <b>" + UE(req.l) + "</b> è già iniziato: l'organizzatore deciderà se aggiungerti."
      : "✅ Iscrizione a <b>" + UE(req.l) + "</b> accettata: giochi come <b>" + UE(req.name) + "</b>." + (req.team ? " Ti metteremo in una squadra." : ""))
      : "❌ L'iscrizione di <b>" + UE(req.name) + "</b> a " + UE(req.l) + " non è stata accettata.");
    if (byChat) send(byChat, (ok ? "Accettata" : "Rifiutata") + ": " + UE(req.name) + " – " + UE(req.l) + "." + (started ? " Il torneo è già iniziato: è nell'elenco iscritti, aggiungilo al torneo a mano se serve." : ""));
    return true;
  }
  /* l'immagine la disegna la pagina: non si aspetta qui, così il bot continua a rispondere */
  /* mappa della sala: la disegna la pagina, con la postazione del giocatore evidenziata */
  async function mapPhoto(chatId, P, seat) {
    send(chatId, seat ? "📍 La tua postazione è la <b>" + UE(seat) + "</b>. Preparo la mappa…" : "🗺 Preparo la mappa della sala…" + (P ? "" : "\nCollega il tuo giocatore con /io <i>nome</i> per vedere la tua postazione."));
    const id = Math.random().toString(36).slice(2);
    const p = new Promise((res) => { pngWait[id] = res; setTimeout(() => { if (pngWait[id]) { delete pngWait[id]; res(null); } }, 25000); });
    opts.onPng({ id, k: (vm.salaEv ? vm.salaEv + ":" : "") + "sala~" + (P || "") });
    const data = await p;
    if (!data) return send(chatId, "Non sono riuscito a creare la mappa, riprova tra poco.");
    const w = vm.sala && vm.sala.wifi;
    return sendFile(chatId, "photo", "mappa.png", "image/png", Buffer.from(String(data).split(",")[1] || "", "base64"),
      (seat ? "📍 " + UE(P) + ": postazione <b>" + UE(seat) + "</b>" : "🗺 Mappa della sala") + (w ? "\n📶 Wi-Fi: " + UE(w.ssid) + (w.pass ? " · password " + UE(w.pass) : "") : ""));
  }
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
    /* una domanda in sospeso scade dopo 10 minuti, e la annulla qualsiasi pulsante (quelli che fanno una domanda la rimettono) */
    if (waits[chatId] && (data || Date.now() - (waits[chatId].ts || 0) > WAIT_MS)) delete waits[chatId];
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
      if (data === "ME") { waits[chatId] = { ts: Date.now(), type: "me" }; return send(chatId, "Scrivi il nome con cui giochi ai tornei."); }
      if (a === "M") { const full = knownNames().find((n) => cbd("M:", n) === data); return linkPlayer(chatId, full || k, false); }
      if (a === "N") return linkPlayer(chatId, k, true);
      if (a === "Q" || a === "B") {
        if (!isAdmin) return send(chatId, "Solo gli amministratori gestiscono gruppi e canali.");
        if (a === "B") { const b = cfg.blocked[k]; delete cfg.blocked[k]; persist(); opts.onChange && opts.onChange(); return send(chatId, b ? "Sbloccato: " + esc(b.name) + "." : "Era già sbloccato."); }
        const op = k.slice(0, 1), gid = k.slice(2);
        if (!cfg.groups[gid]) return send(chatId, "Gruppo non trovato.");
        if (op === "i") return send(chatId, gLabel(gid) + " – " + (GSTATE[cfg.groups[gid].status] || ""), groupKb(gid));
        if (op === "on" || op === "o") { groupSet(gid, "on"); return send(chatId, "✅ Abilitato " + gLabel(gid) + ": mi sono presentato con il link."); }
        if (op === "f") { groupSet(gid, "off"); return send(chatId, "⏸ Disattivato " + gLabel(gid) + ": resto lì ma non scrivo."); }
        if (op === "x") { const l = gLabel(gid); await groupLeave(gid, false); return send(chatId, "🚪 Sono uscito da " + l + "."); }
        if (op === "b") { const l = gLabel(gid), by = (cfg.groups[gid].by || {}).name; await groupLeave(gid, true); return send(chatId, "⛔ Sono uscito da " + l + (by ? " e ho bloccato " + esc(by) + ": se ci riprova esco da solo." : ".")); }
      }
      if (a === "V" && isAdmin && streamer) { if (k === "stop") return liveCmd(chatId, "ferma", true); if (k === "avvia") return liveCmd(chatId, "avvia", true); return liveCmd(chatId, "scena " + k, true); }
      return;
    }
    if (waits[chatId] && waits[chatId].type === "joindc" && /^\/(salta|skip)\b/i.test(text)) { const w = waits[chatId]; delete waits[chatId]; return joinStart(chatId, from, find(w.k), w.name, ""); }
    if (text.startsWith("/")) delete waits[chatId];
    if (waits[chatId]) { const w = waits[chatId]; delete waits[chatId]; if (w.type === "join") return joinStart(chatId, from, find(w.k), text); if (w.type === "joindc") return joinStart(chatId, from, find(w.k), w.name, text); if (w.type === "me") return linkPlayer(chatId, text, false); if (w.type === "dc") return setDiscord(chatId, text); }
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
        return send(chatId, "Ciao! Sono il bot di <b>" + esc(vm.title) + "</b>." + linksInfo() + (cfg.welcome ? "\n\n" + UE(cfg.welcome) : "") + (c.player ? " Sei collegato come <b>" + UE(c.player) + "</b>." : "") + (liveLinks ? "\n\n🔴 <b>Siamo in diretta!</b>\n" + linksText(liveLinks) : "") + "\n\n" + HELP + (isOrg ? "\n\n<b>Organizzatori tornei</b>\n/richieste – iscrizioni da confermare" : "") + (isAdmin ? "\n\n<b>Amministratori</b>\n/annuncio <i>testo</i> – messaggio a tutti (anche ai gruppi abilitati)\n/gruppi – gruppi e canali in cui sono: abilita, esci, blocca\n/bloccati – chi non può più aggiungermi\n/diretta avvia, /diretta ferma, /diretta scena – la diretta" : ""), kb);
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
        if (c.player) return send(chatId, "Sei collegato come <b>" + UE(c.player) + "</b>.", [[{ text: "Cambia nome", callback_data: "ME" }]]);
        waits[chatId] = { ts: Date.now(), type: "me" }; return send(chatId, "Scrivi il nome con cui giochi ai tornei.");
      }
      case "discord": {
        if (!c.player) return send(chatId, "Prima dimmi chi sei: /io <i>il tuo nome</i>. Poi /discord <i>il tuo account Discord</i>.");
        if (arg || !c.verified) return setDiscord(chatId, arg);
        const inv = (vm && vm.links && vm.links.discord) || "";
        waits[chatId] = { ts: Date.now(), type: "dc" };
        return send(chatId, "Scrivi il tuo account Discord (nome utente, es. fede_73): ti aggiungo ai canali delle tue partite." + (inv ? "\nServer del torneo: " + UE(inv) : ""));
      }
      case "info": case "informazioni": { const li = linksInfo(); return send(chatId, "ℹ️ <b>" + esc(vm.title) + "</b>" + (vm.sub ? "\n" + esc(vm.sub) : "") + (li || "\n\nL'organizzatore non ha ancora inserito data, luogo e link.")); }
      case "teamspeak": case "ts": case "ts3": { const L = (vm && vm.links) || {}; return send(chatId, L.ts ? tsLine(L) + (/^https:/i.test(L.ts) ? "" : "\nIn TeamSpeak: Connessioni, Connetti, e incolla l'indirizzo.") : "Questo torneo non ha un server TeamSpeak."); }
      case "scollega": c.player = ""; c.verified = false; persist(); opts.onChange && opts.onChange(); return send(chatId, "Collegamento tolto: non ricevi più gli avvisi personali.");
      case "miepartite": return c.player ? send(chatId, playerMsg(c.player)) : send(chatId, "Prima dimmi chi sei: /io <i>il tuo nome</i>.");
      case "segui": return follow(chatId, arg, true);
      case "nonseguire": return follow(chatId, arg, false);
      case "seguiti": { const f = c.follow || {}; if (f.all) return send(chatId, "Segui tutti i tornei."); const L = (f.games || []).map((k) => find(k)).filter(Boolean); return send(chatId, L.length ? "Segui:\n" + L.map(tTitle).join("\n") : "Non segui nessun torneo. Usa /segui <i>nome</i> o /segui tutti."); }
      case "iscrivimi": { const parts = arg.split("|"); return joinStart(chatId, from, find(parts[0]), parts[1] ? parts[1].trim() : null); }
      case "immagine": return photo(chatId, find(arg));
      case "diretta": case "live": return liveCmd(chatId, arg, isAdmin);
      case "stop": delete cfg.chats[chatId]; persist(); opts.onChange && opts.onChange(); return send(chatId, "Fatto: non riceverai più messaggi. Per ricominciare scrivi /start.");
      case "admin": {
        /* 5 tentativi sbagliati: per un'ora /admin da quell'utente non risponde più (niente prove a raffica) */
        const uid = String((from && from.id) || chatId), fl = admFail[uid] || (admFail[uid] = { n: 0, t: 0 });
        if (Date.now() - fl.t >= 3600e3) fl.n = 0;
        if (fl.n >= 5) return;
        if (arg && arg.replace(/\s+/g, "").toUpperCase() === cfg.code) {
          delete admFail[uid]; c.role = "admin"; c.games = []; cfg.code = newCode(); persist(); opts.onChange && opts.onChange();
          adminIds().filter((a) => a !== String(chatId)).forEach((a) => send(a, "🔑 " + UE(c.name || String(chatId)) + " è diventato amministratore con il codice."));
          return send(chatId, "🔑 Ora sei un amministratore: ricevi le richieste di iscrizione, puoi mandare annunci e comandare la diretta.\n/richieste per le iscrizioni.");
        }
        fl.n++; fl.t = Date.now();
        return send(chatId, "Codice non valido. Il codice è nelle impostazioni del programma (Bot Telegram).");
      }
      case "richieste": {
        if (!isOrg) return send(chatId, "Comando riservato agli organizzatori.");
        const mineP = cfg.pending.filter((p) => canManage(chatId, p.k));
        if (!mineP.length) return send(chatId, "Nessuna richiesta da confermare.");
        for (const p of mineP) await send(chatId, "📝 " + esc(p.l) + ": <b>" + esc(p.name) + "</b>" + (p.user ? " (" + esc(p.user) + ")" : ""), [[{ text: "Accetta", callback_data: "A:" + p.id }, { text: "Rifiuta", callback_data: "X:" + p.id }]]);
        return;
      }
      case "server": case "servers": {
        const P = c.player, all = (vm.sala && vm.sala.servers) || [], out = [];
        const fmt = (sv) => "🖥 <b>" + (sv.name ? UE(sv.name) : "Server") + "</b>" + (sv.game ? " (" + UE(sv.game) + ")" : "") +
          (sv.addr ? "\nIndirizzo: <code>" + UE(sv.addr) + "</code>" : "") + (sv.pass ? "\nPassword: <code>" + UE(sv.pass) + "</code>" : "");
        /* la password solo a chi ha un collegamento confermato (o agli organizzatori): /io da solo non basta */
        const okPass = isOrg || !!c.verified;
        if (P) {
          T().forEach((t) => {
            const me = [P].concat(Object.keys(t.members || {}).filter((tn) => (t.members[tn] || []).includes(P)));
            (t.nextP || []).filter((x) => (x.p || []).some((n) => me.includes(n))).forEach((x) => {
              const hid = x.srv && x.srv.pass && !okPass;
              out.push(tTitle(t) + "\n" + esc(String(x.t).split(" — 🖥 ")[0]) + "\n" + (x.srv ? fmt(hid ? Object.assign({}, x.srv, { pass: "" }) : x.srv) + (hid ? "\n🔑 La password te la dà l'organizzatore: il tuo collegamento non è ancora confermato." : "") : "🖥 Server non ancora assegnato: chiedi agli organizzatori."));
            });
          });
          if (!out.length) out.push("Non hai partite da giocare adesso, " + UE(P) + ". Ti avviso quando tocca a te.");
        } else out.push("Collega prima il tuo giocatore con /io <i>nome</i>: così ti dico su quale server giochi.");
        if ((isOrg || !P) && all.length) out.push("<b>Tutti i server</b>\n" + all.map((sv) => fmt({ name: sv.name, addr: sv.addr, pass: isOrg ? sv.pass : "", game: "" })).join("\n\n"));
        return send(chatId, out.join("\n\n"));
      }
      case "mappa": case "dove": case "postazione": {
        if (!vm.sala) return send(chatId, "La mappa della sala non è ancora pronta.");
        const P = c.player, seat = P && vm.sala.seats && vm.sala.seats[P];
        mapPhoto(chatId, P, seat).catch(() => {});
        return;
      }
      case "annuncio": {
        if (!isAdmin) return send(chatId, "Comando riservato agli amministratori.");
        if (!arg) return send(chatId, "Scrivi il testo: /annuncio <i>testo</i>");
        const ids = Object.keys(cfg.chats).concat(enabledGroups()); ids.forEach((id) => send(id, "📢 <b>" + esc(vm.title) + "</b>\n" + UE(arg), null, true));
        return send(chatId, "Annuncio inviato a " + ids.length + " chat (" + (enabledGroups().length === 1 ? "1 gruppo o canale" : enabledGroups().length + " gruppi o canali") + ").");
      }
      case "gruppi": { if (!isAdmin) return send(chatId, "Comando riservato agli amministratori."); const m = groupsMsg(); return send(chatId, m.text, m.kb); }
      case "bloccati": { if (!isAdmin) return send(chatId, "Comando riservato agli amministratori."); const m = blockedMsg(); return send(chatId, m.text, m.kb); }
      default: return send(chatId, "Comando sconosciuto. /aiuto per l'elenco.");
    }
  }

  /* ---------- ciclo ---------- */
  /* my: la generazione di questo ciclo. Dopo uno stop/start il ciclo vecchio esce appena può: un solo getUpdates alla volta */
  async function loop(my) {
    let backoff = 2000;
    while (running && my === gen) {
      try {
        const ups = await api("getUpdates", { offset: cfg.offset, timeout: 50, allowed_updates: ["message", "callback_query", "my_chat_member", "channel_post"] });
        if (my !== gen) break;
        backoff = 2000; lastErr = ""; lastOk = Date.now();
        for (const u of ups) {
          if (my !== gen) break;
          cfg.offset = u.update_id + 1;
          try {
            if (u.my_chat_member) await onMember(u.my_chat_member);
            else if (u.callback_query) { const q = u.callback_query; api("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {}); if (q.message && q.message.chat.type === "private" && !isBlocked(q.from)) await handle(q.message.chat.id, q.from, null, String(q.data || "")); }
            else if (u.message && u.message.chat.type !== "private") await onGroupMsg(u.message);
            else if (u.message && typeof u.message.text === "string" && !isBlocked(u.message.from)) await handle(u.message.chat.id, u.message.from, u.message.text.trim(), null);
          } catch (e) { lastErr = String(e.message || e); }
        }
        if (ups.length) persist();
      } catch (e) {
        if (!running || my !== gen) break;
        lastErr = String(e.name === "AbortError" ? "tempo scaduto" : e.message || e);
        if (/Unauthorized|Not Found/i.test(lastErr)) { running = false; opts.onChange && opts.onChange(); break; }
        await sleep(backoff); backoff = Math.min(backoff * 2, 60000);
      }
    }
  }
  let cmdLang = null;
  function setCommands() { cmdLang = (vm && vm.lang) || "it"; api("setMyCommands", { commands: COMMANDS.map(([command, description]) => ({ command, description: L(description) })) }).catch(() => {}); }
  async function start() {
    stop(); const my = gen;
    if (dead || !cfg.enabled || !cfg.token) return status();
    try {
      const m = await api("getMe"); if (my !== gen) return status();
      me = m; lastErr = ""; retryMs = 5000;
    } catch (e) {
      if (my !== gen) return status();
      lastErr = String(e.name === "AbortError" ? "tempo scaduto" : e.message || e); me = null;
      /* rete non ancora pronta all'avvio (Wi-Fi, DNS): si riprova da soli, da 5 secondi fino a un minuto; un token sbagliato no */
      if (!/Unauthorized|Not Found/i.test(lastErr)) {
        retryT = setTimeout(() => { retryT = null; start().then(() => { if (running) opts.onChange && opts.onChange(); }).catch(() => {}); }, retryMs);
        retryMs = Math.min(retryMs * 2, 60000);
      }
      return status();
    }
    setCommands();
    running = true; loop(my); return status();
  }
  function stop() { gen++; clearTimeout(retryT); retryT = null; running = false; if (ctrl) { try { ctrl.abort(); } catch {} ctrl = null; } }
  function status() {
    const chats = Object.keys(cfg.chats);
    return {
      enabled: cfg.enabled, hasToken: !!cfg.token, tokenHint: cfg.token ? cfg.token.split(":")[0] + ":…" + cfg.token.slice(-4) : "", running, username: me && me.username, lastErr: tokErr || friendly(lastErr), lastOk,
      join: cfg.join, notify: cfg.notify, code: cfg.code, welcome: cfg.welcome || "",
      groups: Object.entries(cfg.groups).filter(([, g]) => g.in !== false).map(([id, g]) => ({ id, title: g.title || id, type: GTYPE[g.type] || "chat", status: g.status, by: (g.by && g.by.name) || "", ts: g.ts || 0 })),
      blocked: Object.entries(cfg.blocked).map(([id, b]) => ({ id, name: b.name, from: b.from || "" })),
      userRoles: Object.keys(cfg.userRoles).map((u) => ({ u: "@" + u, role: cfg.userRoles[u].role, games: cfg.userRoles[u].games || [] })),
      people: chats.map((id) => { const c = cfg.chats[id], f = c.follow || {}; return { id, name: c.name || c.first || String(id), role: roleOf(id), games: c.games || [], player: c.player || "", verified: !!(c.player && c.verified), follow: f.all ? "tutti" : (f.games || []).length, seen: c.seen || 0 }; })
        .sort((a, b) => ({ admin: 0, org: 1, "": 2 })[a.role] - ({ admin: 0, org: 1, "": 2 })[b.role] || b.seen - a.seen).slice(0, 300),
      chats: chats.length, followers: chats.filter((id) => { const f = cfg.chats[id].follow || {}; return f.all || (f.games || []).length; }).length,
      pending: cfg.pending.map((p) => ({ id: p.id, name: p.name, l: p.l, user: p.user, ts: p.ts }))
    };
  }
  return {
    start, stop, status,
    /* istanza scartata (bot tolto o sostituito da un backup): si ferma, non riscrive più il suo file e non manda i messaggi in coda */
    dispose() { dead = true; stop(); for (const k in pngWait) { const f = pngWait[k]; delete pngWait[k]; f(null); } pump(); },
    setVM(v) { prev = vm; vm = v; try { notifyDiff(); } catch {} if (running && vm && (vm.lang || "it") !== cmdLang) setCommands(); },
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
      if (c.groupSet && cfg.groups[c.groupSet.id] && ["on", "off", "pending"].includes(c.groupSet.status)) groupSet(String(c.groupSet.id), c.groupSet.status);
      if (c.groupLeave) await groupLeave(String(c.groupLeave.id), !!c.groupLeave.block);
      if (c.unblock) { delete cfg.blocked[String(c.unblock)]; persist(); }
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
      if (c.setPlayer && cfg.chats[c.setPlayer.id]) { const pn = String(c.setPlayer.player || "").replace(/\s+/g, " ").trim().slice(0, 32); const sp = cfg.chats[c.setPlayer.id]; sp.player = /[<>]/.test(pn) ? "" : pn; sp.verified = !!sp.player; }
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
      Object.keys(cfg.chats).concat(enabledGroups()).forEach((id) => send(id, "🔴 <b>" + esc(t) + " è in diretta!</b>\n\n" + linksText(liveLinks), null, true));
    },
    liveEnded() { liveLinks = null; },
    pngReply(id, data) { if (pngWait[id]) { const f = pngWait[id]; delete pngWait[id]; f(data); } }
  };
};
module.exports.cfgReport = cfgReport;
