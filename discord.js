/* Tornei Fragmarathon: integrazione Discord.
   Solo API REST con il token di un bot Discord (niente connessione permanente): il bot crea, per ogni
   partita pronta, un canale di testo (e se richiesto uno vocale) visibile solo ai giocatori di quella
   partita, ci scrive chi gioca e su quale server, e a partita finita lo rende di sola lettura.
   Token e stato dei canali stanno nella cartella dati dell'app, mai nei backup dei tornei. */
"use strict";
const fs = require("fs");
const path = require("path");

/* TORNEI_DISCORD_API: solo per le prove con un server finto */
const API = process.env.TORNEI_DISCORD_API || "https://discord.com/api/v10";
/* permessi (bit) */
const P = { VIEW: 1n << 10n, SEND: 1n << 11n, HISTORY: 1n << 16n, CONNECT: 1n << 20n, SPEAK: 1n << 21n, MANAGE_CH: 1n << 4n, MANAGE_ROLES: 1n << 28n, INVITE: 1n, EMBED: 1n << 14n, ATTACH: 1n << 15n };
const PLAYER = P.VIEW | P.SEND | P.HISTORY | P.CONNECT | P.SPEAK | P.EMBED | P.ATTACH;
const READONLY = P.VIEW | P.HISTORY;
const BOT = P.VIEW | P.SEND | P.HISTORY | P.CONNECT | P.MANAGE_CH | P.MANAGE_ROLES | P.EMBED;
/* permessi da chiedere quando si aggiunge il bot al server */
const INVITE_PERMS = (P.VIEW | P.SEND | P.HISTORY | P.CONNECT | P.SPEAK | P.MANAGE_CH | P.MANAGE_ROLES | P.INVITE | P.EMBED | P.ATTACH).toString();
/* canali al massimo in una categoria (limite di Discord); un account non trovato si cerca di nuovo dopo MISS_MS */
const MAXCH = 50, MISS_MS = 120000;

function cleanToken(t) { return String(t || "").trim().replace(/^Bot\s+/i, "").replace(/\s+/g, ""); }
/* lettere di ogni alfabeto (Discord le accetta); gli accenti si tolgono solo alle lettere latine */
function slug(s) {
  const x = String(s || "").toLowerCase().normalize("NFD").replace(/([a-z])[̀-ͯ]+/g, "$1").normalize("NFC").replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+/, "");
  return Array.from(x).slice(0, 90).join("").replace(/-+$/, "") || "partita";
}
function isId(s) { return /^\d{16,21}$/.test(String(s || "").trim()); }
function same(a, b) { return (a || []).slice().sort().join() === (b || []).slice().sort().join(); }
/* errori che fermano tutta la sincronizzazione (rete, token, permessi, limiti di frequenza, Discord giù); gli altri riguardano una partita sola */
function fatal(e) { return !e.status || e.status === 403 || e.status === 429 || e.status >= 500; }
/* Discord rifiuta il canale perché la categoria ne ha già 50 */
function isFull(e) { return e.status === 400 && /CHANNEL_PARENT_MAX_CHANNELS|Maximum number of channels in category/i.test(JSON.stringify(e.body || "")); }
function topic(title, g, m) { return (title + " · " + g.label + " · " + (m.label && m.label !== m.name ? m.label + ": " : "") + m.name).slice(0, 1000); }

module.exports = function createDiscord(opts) {
  const dir = opts.dir, file = path.join(dir, "discord.json"), evDir = path.join(dir, "discord-tornei");
  const doFetch = opts.fetch || fetch, log = opts.log || (() => {});
  let cfg = load(), me = null, lastErr = "";
  /* queue/running: un'operazione per torneo alla volta; gen: sale a ogni «Elimina i canali» e ferma la sincronizzazione in corso;
     miss: account non trovati di recente (solo in memoria) */
  const queue = {}, running = {}, gen = {}, miss = {};

  function load() {
    let c; try { c = Object.assign({ token: "", users: {} }, JSON.parse(fs.readFileSync(file, "utf8"))); } catch { c = { token: "", users: {} }; }
    /* uv 2: prima un account poteva essere stato preso per nome visualizzato o soprannome, cioè la persona sbagliata: si cercano di nuovo */
    if (c.uv !== 2) { c.users = {}; c.uv = 2; }
    return c;
  }
  function forget() { cfg.users = {}; for (const k of Object.keys(miss)) delete miss[k]; }
  function persist() { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file + ".tmp", JSON.stringify(cfg, null, 1)); fs.renameSync(file + ".tmp", file); } catch (e) { log("discord salvataggio", e); } }
  function evFile(id) { return path.join(evDir, String(id).replace(/[^a-z0-9-]/gi, "") + ".json"); }
  function evLoad(id) { try { return JSON.parse(fs.readFileSync(evFile(id), "utf8")); } catch { return { guild: "", cats: {}, ch: {} }; } }
  function evSave(id, st) { try { fs.mkdirSync(evDir, { recursive: true }); fs.writeFileSync(evFile(id) + ".tmp", JSON.stringify(st, null, 1)); fs.renameSync(evFile(id) + ".tmp", evFile(id)); } catch (e) { log("discord salvataggio torneo", e); } }

  /* chiamata all'API con attesa sui limiti di frequenza (429) */
  async function call(method, url, body, tries = 0) {
    if (!cfg.token) throw new Error("Manca il token del bot Discord.");
    const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 15000);
    let r;
    try {
      r = await doFetch(API + url, { method, headers: { Authorization: "Bot " + cfg.token, "Content-Type": "application/json", "User-Agent": "DiscordBot (https://tornei.bais.info, 1)" }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    } catch (e) { throw new Error("Discord non è raggiungibile da questo PC: controlla la connessione."); }
    finally { clearTimeout(to); }
    if (r.status === 429 && tries < 5) {
      let w = 1; try { w = (await r.json()).retry_after || 1; } catch {}
      await new Promise((ok) => setTimeout(ok, Math.min(30, w) * 1000 + 100));
      return call(method, url, body, tries + 1);
    }
    if (r.status === 204) return null;
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) {
      const m = (j && j.message) || ("HTTP " + r.status);
      if (r.status === 401) throw new Error("Token del bot Discord non valido: copialo di nuovo dal Developer Portal (Bot, Reset Token).");
      if (r.status === 403) { log("discord permessi", method + " " + url + ": " + m); const e403 = new Error("Al bot mancano dei permessi sul server Discord: aggiungilo di nuovo con il link della sezione Discord."); e403.status = 403; throw e403; }
      const err = new Error("Discord: " + m); err.status = r.status; err.body = j; throw err;
    }
    return j;
  }

  async function check() {
    try {
      me = await call("GET", "/users/@me");
      const guilds = await call("GET", "/users/@me/guilds");
      lastErr = "";
      return { ok: true, user: { id: me.id, name: me.username }, guilds: (guilds || []).map((g) => ({ id: g.id, name: g.name })), invite: inviteUrl() };
    } catch (e) { lastErr = e.message; return { ok: false, err: e.message, invite: inviteUrl() }; }
  }
  function inviteUrl() { return me ? "https://discord.com/oauth2/authorize?client_id=" + me.id + "&scope=bot&permissions=" + INVITE_PERMS : ""; }

  /* account Discord → id utente: id numerico usato così com'è, altrimenti ricerca tra i membri del server.
     Vale solo il nome utente esatto (unico su Discord), mai il nome visualizzato o il soprannome, che può avere chiunque.
     fresh: ricerca chiesta a mano, anche se l'account non è stato trovato da poco */
  async function resolve(guild, acc, fresh) {
    acc = String(acc || "").trim().replace(/^@/, ""); if (!acc) return null;
    if (isId(acc)) return acc;
    const key = guild + ":" + acc.toLowerCase();
    if (cfg.users[key]) return cfg.users[key];
    if (!fresh && miss[key] && Date.now() - miss[key] < MISS_MS) return null;
    const x = acc.match(/^(.*)#(\d{4})$/), name = x ? x[1] : acc, low = name.toLowerCase();
    const L = await call("GET", "/guilds/" + guild + "/members/search?limit=1000&query=" + encodeURIComponent(name));
    const m = (L || []).find((e) => e.user && String(e.user.username || "").toLowerCase() === low && (!x || e.user.discriminator === x[2]));
    if (!m) { miss[key] = Date.now(); return null; }
    delete miss[key]; cfg.users[key] = m.user.id; persist();
    return m.user.id;
  }
  async function lookup(guild, accounts, fresh) {
    const out = {};
    /* nella sincronizzazione un limite di frequenza sulla ricerca vale come «non trovato»: si riprova la volta dopo */
    for (const a of accounts || []) { try { out[a] = await resolve(guild, a, fresh); } catch (e) { out[a] = null; if (e.status !== 404 && (fresh || e.status !== 429)) throw e; } }
    return out;
  }

  function overwrites(guild, users, state) {
    const ow = [{ id: guild, type: 0, allow: "0", deny: P.VIEW.toString() }];
    if (me) ow.push({ id: me.id, type: 1, allow: BOT.toString(), deny: "0" });
    users.forEach((u) => ow.push({ id: u, type: 1, allow: (state === "done" ? READONLY : PLAYER).toString(), deny: (state === "done" ? (P.SEND | P.CONNECT) : 0n).toString() }));
    return ow;
  }
  /* canali per categoria del gioco (p: categoria del testo, pv: del vocale; i canali senza p stanno nella prima) */
  function used(st, gk) {
    const n = {}, add = (id) => { if (id) n[id] = (n[id] || 0) + 1; };
    for (const k of Object.keys(st.ch)) { if (!k.startsWith(gk + "|")) continue; const c = st.ch[k], p = c.p || st.cats[gk]; if (c.t) add(p); if (c.v) add(c.pv || p); }
    return n;
  }
  /* categoria del gioco con posto per altri `need` canali: Discord ne tiene al massimo 50, poi se ne apre un'altra
     (chiavi gioco, gioco#2, gioco#3...). prefer: quella da usare se ha posto (il vocale accanto al suo testo) */
  async function category(st, guild, g, title, cx, need, prefer) {
    const n = used(st, g.key), ok = (id) => !!id && !cx.full.has(id) && (n[id] || 0) + need <= MAXCH;
    /* una categoria cancellata a mano su Discord si rifà al suo posto (controllo una volta per sincronizzazione) */
    const live = async (id) => { if (cx.seen.has(id)) return true; try { await call("GET", "/channels/" + id); cx.seen.add(id); return true; } catch (e) { if (e.status !== 404) throw e; return false; } };
    if (ok(prefer) && Object.values(st.cats).includes(prefer) && await live(prefer)) return prefer;
    for (let i = 1; ; i++) {
      const ck = i > 1 ? g.key + "#" + i : g.key;
      if (ok(st.cats[ck])) { if (await live(st.cats[ck])) return st.cats[ck]; delete st.cats[ck]; }
      if (!st.cats[ck]) {
        const c = await call("POST", "/guilds/" + guild + "/channels", { name: (title + " · " + g.label + (i > 1 ? " (" + i + ")" : "")).slice(0, 100), type: 4, permission_overwrites: overwrites(guild, [], "ready") });
        st.cats[ck] = c.id; cx.seen.add(c.id); return c.id;
      }
    }
  }
  /* crea un canale nella categoria del gioco; se Discord la dice piena (canali aggiunti a mano) se ne prende un'altra e si riprova */
  async function mkChan(st, guild, g, title, cx, need, prefer, body) {
    for (let i = 0; ; i++) {
      const parent = await category(st, guild, g, title, cx, need, prefer);
      try { const c = await call("POST", "/guilds/" + guild + "/channels", Object.assign({}, body, { parent_id: parent })); c.p = parent; return c; }
      catch (e) { if (i || !isFull(e)) throw e; cx.full.add(parent); }
    }
  }
  /* testi nella lingua del torneo, preparati dalla pagina (d.t) */
  function srvText(sv, T) { return "🖥️ " + (T.server || "Server") + ": **" + sv.name + "**" + (sv.addr ? " `" + sv.addr + "`" : "") + (sv.pass ? " · " + (T.pass || "password") + " `" + sv.pass + "`" : ""); }
  function intro(m, title, g, T) {
    const who = m.users.map((u) => "<@" + u + ">").join(" ");
    return ("🎮 **" + title + "** · " + g.label + "\n**" + (m.label && m.label !== m.name ? m.label + ": " : "") + m.name + "**" +
      ((m.players || []).length > 2 ? "\n" + (T.players || "Giocatori") + ": " + m.players.join(", ") : "") + (who ? "\n" + who : "") +
      (m.server ? "\n" + srvText(m.server, T) : "") +
      "\n" + (T.only || "Questo canale lo vedono solo i giocatori della partita e gli organizzatori.")).slice(0, 1900);
  }
  /* cancella un canale: null se non c'è più (anche se era già stato tolto a mano), altrimenti l'errore. lax: anche quando il bot non ha più accesso */
  async function del(id, lax) {
    try { await call("DELETE", "/channels/" + id); return null; } catch (e) { return e.status === 404 || (lax && e.status === 403) ? null : e; }
  }
  /* toglie testo e vocale di una partita; dimentica solo quelli che non ci sono più (null, altrimenti l'errore) */
  async function drop(c) { let err = null; for (const f of ["t", "v"]) if (c[f]) { const e = await del(c[f]); if (e) err = e; else c[f] = null; } return err; }
  async function dropOrThrow(c) { const e = await drop(c); if (e) throw e; }

  /* allinea i canali del torneo a quello che chiede la pagina */
  async function syncNow(d) {
    if (!me) await check(); if (!me) throw new Error(lastErr || "Bot Discord non configurato.");
    const st = evLoad(d.ev), guild = d.guild, stat = { created: 0, updated: 0, closed: 0, removed: 0, missing: [], errors: [] };
    /* «Elimina i canali» chiesto nel frattempo (gen cambiato): ci si ferma e si lascia fare a lui */
    const g0 = gen[d.ev] || 0, stop = () => (gen[d.ev] || 0) !== g0, cx = { full: new Set(), seen: new Set() };
    /* server Discord cambiato: via i canali dal vecchio (quelli dove il bot non ha più accesso si lasciano perdere) */
    if (st.guild && st.guild !== guild) await removeAll(d.ev, st, true);
    st.guild = guild; st.cats = st.cats || {}; st.ch = st.ch || {};
    const ids = await lookup(guild, d.accounts), T = d.t || {};
    Object.keys(ids).forEach((a) => { if (!ids[a]) stat.missing.push(a); });
    /* want: tutte le partite che esistono, anche quelle non ancora pronte (i loro canali restano) */
    const want = {};
    (d.games || []).forEach((g) => (g.all || []).concat((g.matches || []).map((m) => m.key)).forEach((key) => { want[g.key + "|" + key] = 1; }));
    for (const g of d.games || []) {
      if (stop()) break;
      for (const m of g.matches || []) {
        if (stop()) break;
        const k = g.key + "|" + m.key, users = [...new Set((m.accounts || []).map((a) => ids[a]).filter(Boolean))];
        let cur = st.ch[k], fresh = false;
        const mm = Object.assign({}, m, { users });
        try {
          /* canale tolto a metà (una cancellazione non riuscita): si finisce di toglierlo */
          if (cur && !cur.t) { await dropOrThrow(cur); delete st.ch[k]; cur = null; }
          if (cur && cur.sig !== undefined && m.sig !== undefined && cur.sig !== m.sig) {
            if ((users.length && same(cur.users, users)) || (cur.state === "done" && m.state === "done")) {
              /* stessi giocatori con un nome nuovo (rinomina), o partita già finita: stesso canale con la sua chat, cambia solo il nome */
              const no404 = (e) => { if (e.status === 404) throw e; log("discord rinomina", e.message); }, vGone = (e) => { if (e.status === 404) cur.v = null; else no404(e); };
              await call("PATCH", "/channels/" + cur.t, { name: slug(m.name), topic: topic(d.title, g, m) }).catch(no404);
              if (cur.v) await call("PATCH", "/channels/" + cur.v, { name: m.name.slice(0, 100) }).catch(vGone);
              cur.sig = m.sig; cur.name = m.name; stat.updated++;
            } else {
              /* stessa partita ma giocatori diversi (tabellone rifatto): canale nuovo */
              await dropOrThrow(cur); delete st.ch[k]; cur = null; stat.removed++;
            }
          }
          /* aggiornamento chiesto a mano (d.now): un canale cancellato a mano su Discord si rifà */
          if (cur && d.now && m.state === "ready" && cur.state === "ready") {
            try { await call("GET", "/channels/" + cur.t); } catch (e) { if (e.status !== 404) throw e; await dropOrThrow(cur); delete st.ch[k]; cur = null; }
          }
          if (!cur) {
            if (m.state !== "ready") continue;
            const t = await mkChan(st, guild, g, d.title, cx, d.voice ? 2 : 1, null, { name: slug(m.name), type: 0, topic: topic(d.title, g, m), permission_overwrites: overwrites(guild, users, "ready") });
            /* registrato subito: se dopo qualcosa va storto il canale non resta orfano (il vocale si aggiunge sotto) */
            cur = st.ch[k] = { t: t.id, p: t.p, v: null, users, state: "ready", name: m.name, sig: m.sig, server: m.server ? m.server.name : "" };
            evSave(d.ev, st); fresh = true; stat.created++;
            await call("POST", "/channels/" + t.id + "/messages", { content: intro(mm, d.title, g, T), allowed_mentions: { users } }).catch(() => {});
          }
          const usersChanged = !same(cur.users, users);
          if (m.state === "done" && cur.state !== "done") {
            await call("PATCH", "/channels/" + cur.t, { permission_overwrites: overwrites(guild, users, "done") });
            if (m.result) await call("POST", "/channels/" + cur.t + "/messages", { content: ("🏁 " + m.result).slice(0, 1900), allowed_mentions: { parse: [] } }).catch(() => {});
            cur.state = "done"; cur.users = users; stat.closed++;
          } else if (usersChanged || (m.state === "ready" && cur.state === "done")) {
            const s = m.state === "done" ? "done" : "ready";
            await call("PATCH", "/channels/" + cur.t, { permission_overwrites: overwrites(guild, users, s) });
            /* vocale cancellato a mano: si dimentica e si rifà sotto, il testo con la sua chat resta */
            if (cur.v) await call("PATCH", "/channels/" + cur.v, { permission_overwrites: overwrites(guild, users, s) }).catch((e) => { if (e.status !== 404) throw e; cur.v = null; });
            cur.users = users; cur.state = s; stat.updated++;
          }
          const srv = m.server ? m.server.name : "";
          if (srv && srv !== cur.server && m.state === "ready") {
            await call("POST", "/channels/" + cur.t + "/messages", { content: srvText(m.server, T).slice(0, 1900), allowed_mentions: { parse: [] } }).catch(() => {});
          }
          cur.server = srv;
          /* vocale solo per le partite da giocare e se richiesto: si crea se manca (partita nuova o riaperta, opzione accesa dopo,
             creazione non riuscita), si toglie a fine partita o se l'opzione è spenta */
          const wantV = !!d.voice && cur.state === "ready";
          if (wantV && !cur.v) {
            const v = await mkChan(st, guild, g, d.title, cx, 1, cur.p, { name: m.name.slice(0, 100), type: 2, permission_overwrites: overwrites(guild, users, "ready") });
            cur.v = v.id; cur.pv = v.p; evSave(d.ev, st); if (!fresh) stat.updated++;
          } else if (!wantV && cur.v && !(await del(cur.v))) { cur.v = null; if (cur.state === "ready") stat.updated++; }
        } catch (e) {
          /* canale cancellato a mano su Discord: via anche l'altro della coppia, poi si dimentica (se è da giocare si rifà) */
          if (e.status === 404) { const c = st.ch[k]; if (c && !(await drop(c))) { delete st.ch[k]; stat.removed++; } continue; }
          if (fatal(e)) { evSave(d.ev, st); throw e; }
          /* errore di una partita sola: le altre vanno avanti */
          stat.errors.push(m.name + ": " + e.message);
        }
      }
    }
    if (stop()) { evSave(d.ev, st); return Object.assign(stat, { channels: Object.keys(st.ch).length, cancelled: true }); }
    /* partite che non esistono più (tabellone rifatto): via i loro canali */
    for (const k of Object.keys(st.ch)) {
      if (want[k]) continue;
      if (!(await drop(st.ch[k]))) { delete st.ch[k]; stat.removed++; }
    }
    /* categorie rimaste vuote: la prima di un gioco senza più partite, le altre (gioco#2...) appena non hanno più canali */
    for (const gk of Object.keys(st.cats)) {
      const base = gk.replace(/#\d+$/, ""), id = st.cats[gk], g = (d.games || []).find((x) => x.key === base);
      if (gk === base ? Object.keys(st.ch).some((k) => k.startsWith(base + "|")) || (g && (g.all || []).length) : Object.values(st.ch).some((c) => c.p === id || c.pv === id)) continue;
      if (!(await del(id))) delete st.cats[gk];
    }
    evSave(d.ev, st);
    if (stat.errors.length) stat.err = stat.errors[0] + (stat.errors.length > 1 ? " (+" + (stat.errors.length - 1) + ")" : "");
    return Object.assign(stat, { channels: Object.keys(st.ch).length });
  }
  /* cancella tutti i canali del torneo e dimentica solo quelli che non ci sono più: se qualcuno resta, errore (gli id restano per riprovare).
     lax: anche quelli dove il bot non ha più accesso (server Discord cambiato) */
  async function removeAll(evId, st, lax) {
    st = st || evLoad(evId); st.ch = st.ch || {}; st.cats = st.cats || {}; let n = 0, fail = 0, err = null;
    for (const k of Object.keys(st.ch)) { const c = st.ch[k]; for (const f of ["t", "v"]) if (c[f]) { const e = await del(c[f], lax); if (!e) { c[f] = null; n++; } else { fail++; err = e; } } if (!c.t && !c.v) delete st.ch[k]; }
    /* le categorie solo a canali tolti: cancellarle prima lascerebbe i canali sparsi nel server */
    if (!fail) for (const k of Object.keys(st.cats)) { const e = await del(st.cats[k], lax); if (!e) delete st.cats[k]; else { fail++; err = e; } }
    evSave(evId, st);
    if (fail) throw new Error("Canali Discord non eliminati: " + fail + ". " + err.message);
    return n;
  }
  /* un'operazione per torneo alla volta; le sincronizzazioni chieste nel frattempo si riducono all'ultima */
  function sync(d) {
    if (!d || !d.ev || !d.guild) return Promise.resolve({ skipped: true });
    if (running[d.ev]) { queue[d.ev] = d; return running[d.ev]; }
    const p = syncNow(d).then((r) => { lastErr = r.err || ""; return r; }, (e) => { lastErr = e.message; log("discord", e); return { err: e.message }; })
      .then((r) => next(d.ev, p, r));
    running[d.ev] = p; return p;
  }
  /* fine di un'operazione: se intanto è arrivata una sincronizzazione, si fa (a meno che un'altra operazione abbia preso il posto) */
  function next(ev, p, r) { if (running[ev] !== p) return r; delete running[ev]; const q = queue[ev]; delete queue[ev]; return q ? sync(q) : r; }
  /* «Elimina i canali»: ferma la sincronizzazione in corso, scarta quella in attesa, aspetta e cancella da solo */
  function clearEv(evId) {
    delete queue[evId]; gen[evId] = (gen[evId] || 0) + 1;
    const done = Promise.resolve(running[evId]).catch(() => {}).then(() => removeAll(evId)).catch((e) => ({ err: e.message }));
    const p = done.then(() => next(evId, p, { skipped: true }));
    running[evId] = p; return done;
  }
  async function makeInvite(guild) {
    const chs = await call("GET", "/guilds/" + guild + "/channels");
    const t = (chs || []).filter((c) => c.type === 0).sort((a, b) => a.position - b.position)[0];
    if (!t) throw new Error("Il server Discord non ha canali di testo per l'invito.");
    const inv = await call("POST", "/channels/" + t.id + "/invites", { max_age: 0, max_uses: 0, unique: false });
    return "https://discord.gg/" + inv.code;
  }

  return {
    status: () => ({ hasToken: !!cfg.token, user: me ? { id: me.id, name: me.username } : null, err: lastErr, invite: inviteUrl() }),
    configure: async (c) => {
      if (c.removeToken) { cfg.token = ""; me = null; forget(); persist(); return { ok: true }; }
      if (typeof c.token === "string") { const t = cleanToken(c.token); if (t !== cfg.token) { cfg.token = t; forget(); me = null; persist(); } }
      return check();
    },
    check, sync, lookup: (guild, acc) => lookup(guild, acc, true).catch((e) => ({ err: e.message })),
    clear: (evId) => clearEv(evId),
    invite: (guild) => makeInvite(guild).then((url) => ({ url }), (e) => ({ err: e.message })),
    channels: (evId) => { const st = evLoad(evId); return { guild: st.guild, n: Object.keys(st.ch || {}).length }; }
  };
};
module.exports.slug = slug;
module.exports.INVITE_PERMS = INVITE_PERMS;
