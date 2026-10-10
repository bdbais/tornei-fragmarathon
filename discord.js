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

function cleanToken(t) { return String(t || "").trim().replace(/^Bot\s+/i, "").replace(/\s+/g, ""); }
function slug(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "partita";
}
function isId(s) { return /^\d{16,21}$/.test(String(s || "").trim()); }

module.exports = function createDiscord(opts) {
  const dir = opts.dir, file = path.join(dir, "discord.json"), evDir = path.join(dir, "discord-tornei");
  const doFetch = opts.fetch || fetch, log = opts.log || (() => {});
  let cfg = load(), me = null, lastErr = "";
  const queue = {}, running = {};

  function load() {
    try { return Object.assign({ token: "", users: {} }, JSON.parse(fs.readFileSync(file, "utf8"))); } catch { return { token: "", users: {} }; }
  }
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
      if (r.status === 403) { log("discord permessi", method + " " + url + ": " + m); throw new Error("Al bot mancano dei permessi sul server Discord: aggiungilo di nuovo con il link della sezione Discord."); }
      const err = new Error("Discord: " + m); err.status = r.status; throw err;
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

  /* account Discord → id utente: id numerico usato così com'è, altrimenti ricerca tra i membri del server */
  async function resolve(guild, acc) {
    acc = String(acc || "").trim().replace(/^@/, ""); if (!acc) return null;
    if (isId(acc)) return acc;
    const key = guild + ":" + acc.toLowerCase();
    if (cfg.users[key]) return cfg.users[key];
    const L = await call("GET", "/guilds/" + guild + "/members/search?limit=10&query=" + encodeURIComponent(acc.replace(/#\d{4}$/, "")));
    const low = acc.toLowerCase().replace(/#\d{4}$/, "");
    const m = (L || []).find((x) => x.user && (x.user.username.toLowerCase() === low)) ||
      (L || []).find((x) => x.user && ((x.user.global_name || "").toLowerCase() === low || (x.nick || "").toLowerCase() === low));
    if (!m) return null;
    cfg.users[key] = m.user.id; persist();
    return m.user.id;
  }
  async function lookup(guild, accounts) {
    const out = {};
    for (const a of accounts || []) { try { out[a] = await resolve(guild, a); } catch (e) { out[a] = null; if (e.status !== 404) throw e; } }
    return out;
  }

  function overwrites(guild, users, state) {
    const ow = [{ id: guild, type: 0, allow: "0", deny: P.VIEW.toString() }];
    if (me) ow.push({ id: me.id, type: 1, allow: BOT.toString(), deny: "0" });
    users.forEach((u) => ow.push({ id: u, type: 1, allow: (state === "done" ? READONLY : PLAYER).toString(), deny: (state === "done" ? (P.SEND | P.CONNECT) : 0n).toString() }));
    return ow;
  }
  async function category(st, guild, g, title) {
    if (st.cats[g.key]) return st.cats[g.key];
    const c = await call("POST", "/guilds/" + guild + "/channels", { name: (title + " · " + g.label).slice(0, 100), type: 4, permission_overwrites: overwrites(guild, [], "ready") });
    st.cats[g.key] = c.id; return c.id;
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
  async function drop(c) { for (const id of [c.t, c.v]) if (id) await call("DELETE", "/channels/" + id).catch(() => {}); }

  /* allinea i canali del torneo a quello che chiede la pagina */
  async function syncNow(d) {
    if (!me) await check(); if (!me) throw new Error(lastErr || "Bot Discord non configurato.");
    const st = evLoad(d.ev), guild = d.guild, stat = { created: 0, updated: 0, closed: 0, removed: 0, missing: [] };
    if (st.guild && st.guild !== guild) await removeAll(d.ev, st);
    st.guild = guild; st.cats = st.cats || {}; st.ch = st.ch || {};
    const ids = await lookup(guild, d.accounts), T = d.t || {};
    Object.keys(ids).forEach((a) => { if (!ids[a]) stat.missing.push(a); });
    /* want: tutte le partite che esistono, anche quelle non ancora pronte (i loro canali restano) */
    const want = {};
    (d.games || []).forEach((g) => (g.all || []).concat((g.matches || []).map((m) => m.key)).forEach((key) => { want[g.key + "|" + key] = 1; }));
    for (const g of d.games || []) {
      for (const m of g.matches || []) {
        const k = g.key + "|" + m.key, users = [...new Set((m.accounts || []).map((a) => ids[a]).filter(Boolean))];
        let cur = st.ch[k];
        const mm = Object.assign({}, m, { users });
        try {
          /* stessa partita ma giocatori diversi (tabellone rifatto): canale nuovo */
          if (cur && cur.sig !== undefined && m.sig !== undefined && cur.sig !== m.sig) { await drop(cur); delete st.ch[k]; cur = null; stat.removed++; }
          if (!cur) {
            if (m.state !== "ready") continue;
            let parent = await category(st, guild, g, d.title);
            /* categoria cancellata a mano su Discord: se ne crea una nuova */
            try { await call("GET", "/channels/" + parent); } catch (e) { if (e.status !== 404) throw e; delete st.cats[g.key]; parent = await category(st, guild, g, d.title); }
            const t = await call("POST", "/guilds/" + guild + "/channels", { name: slug(m.name), type: 0, parent_id: parent, topic: (d.title + " · " + g.label + " · " + (m.label && m.label !== m.name ? m.label + ": " : "") + m.name).slice(0, 1000), permission_overwrites: overwrites(guild, users, "ready") });
            let v = null;
            if (d.voice) v = (await call("POST", "/guilds/" + guild + "/channels", { name: m.name.slice(0, 100), type: 2, parent_id: parent, permission_overwrites: overwrites(guild, users, "ready") })).id;
            st.ch[k] = { t: t.id, v, users, state: "ready", name: m.name, sig: m.sig, server: m.server ? m.server.name : "" };
            evSave(d.ev, st);
            await call("POST", "/channels/" + t.id + "/messages", { content: intro(mm, d.title, g, T), allowed_mentions: { users } }).catch(() => {});
            stat.created++;
            continue;
          }
          const usersChanged = cur.users.slice().sort().join() !== users.slice().sort().join();
          if (m.state === "done" && cur.state !== "done") {
            await call("PATCH", "/channels/" + cur.t, { permission_overwrites: overwrites(guild, users, "done") });
            if (cur.v) { await call("DELETE", "/channels/" + cur.v).catch(() => {}); cur.v = null; }
            if (m.result) await call("POST", "/channels/" + cur.t + "/messages", { content: ("🏁 " + m.result).slice(0, 1900), allowed_mentions: { parse: [] } }).catch(() => {});
            cur.state = "done"; cur.users = users; stat.closed++;
          } else if (usersChanged || (m.state === "ready" && cur.state === "done")) {
            const s = m.state === "done" ? "done" : "ready";
            await call("PATCH", "/channels/" + cur.t, { permission_overwrites: overwrites(guild, users, s) });
            if (cur.v) await call("PATCH", "/channels/" + cur.v, { permission_overwrites: overwrites(guild, users, s) });
            cur.users = users; cur.state = s; stat.updated++;
          }
          const srv = m.server ? m.server.name : "";
          if (srv && srv !== cur.server && m.state === "ready") {
            await call("POST", "/channels/" + cur.t + "/messages", { content: srvText(m.server, T).slice(0, 1900), allowed_mentions: { parse: [] } }).catch(() => {});
          }
          cur.server = srv;
        } catch (e) {
          if (e.status === 404) { delete st.ch[k]; continue; }
          evSave(d.ev, st); throw e;
        }
      }
    }
    /* partite che non esistono più (tabellone rifatto): via i loro canali */
    for (const k of Object.keys(st.ch)) {
      if (want[k]) continue;
      await drop(st.ch[k]); delete st.ch[k]; stat.removed++;
    }
    /* categorie rimaste vuote di giochi senza partite */
    for (const gk of Object.keys(st.cats)) {
      const g = (d.games || []).find((x) => x.key === gk);
      if (Object.keys(st.ch).some((k) => k.startsWith(gk + "|")) || (g && (g.all || []).length)) continue;
      await call("DELETE", "/channels/" + st.cats[gk]).catch(() => {}); delete st.cats[gk];
    }
    evSave(d.ev, st);
    return Object.assign(stat, { channels: Object.keys(st.ch).length });
  }
  async function removeAll(evId, st) {
    st = st || evLoad(evId); let n = 0;
    for (const k of Object.keys(st.ch || {})) { for (const id of [st.ch[k].t, st.ch[k].v]) if (id) { await call("DELETE", "/channels/" + id).catch(() => {}); n++; } }
    for (const k of Object.keys(st.cats || {})) { await call("DELETE", "/channels/" + st.cats[k]).catch(() => {}); }
    st.ch = {}; st.cats = {}; evSave(evId, st);
    return n;
  }
  /* una sola sincronizzazione per torneo alla volta; le richieste arrivate nel frattempo si riducono all'ultima */
  function sync(d) {
    if (!d || !d.ev || !d.guild) return Promise.resolve({ skipped: true });
    if (running[d.ev]) { queue[d.ev] = d; return running[d.ev]; }
    const p = syncNow(d).then((r) => { lastErr = ""; return r; }, (e) => { lastErr = e.message; log("discord", e); return { err: e.message }; })
      .then((r) => { delete running[d.ev]; const next = queue[d.ev]; delete queue[d.ev]; return next ? sync(next) : r; });
    running[d.ev] = p; return p;
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
      if (c.removeToken) { cfg.token = ""; me = null; cfg.users = {}; persist(); return { ok: true }; }
      if (typeof c.token === "string") { const t = cleanToken(c.token); if (t !== cfg.token) { cfg.token = t; cfg.users = {}; me = null; persist(); } }
      return check();
    },
    check, sync, lookup: (guild, acc) => lookup(guild, acc).catch((e) => ({ err: e.message })),
    clear: (evId) => removeAll(evId).catch((e) => ({ err: e.message })),
    invite: (guild) => makeInvite(guild).then((url) => ({ url }), (e) => ({ err: e.message })),
    channels: (evId) => { const st = evLoad(evId); return { guild: st.guild, n: Object.keys(st.ch || {}).length }; }
  };
};
module.exports.slug = slug;
module.exports.INVITE_PERMS = INVITE_PERMS;
