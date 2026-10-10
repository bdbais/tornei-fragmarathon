/* Tornei Fragmarathon: nucleo delle traduzioni, usato dalla pagina (js/i18n.js) e dal bot (bot.js).
   L'italiano è la lingua di partenza: i dizionari (js/lang/<codice>.js) hanno come chiave la frase
   italiana esatta. Una frase intera si traduce per intero; un testo composto da più pezzi
   (es. "Girone A · passano i primi 5") si traduce pezzo per pezzo, sostituendo le frasi note
   solo dove iniziano e finiscono a confine di parola. */
(function (root) {
  "use strict";
  var LANGS = [["it", "Italiano"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["ro", "Română"], ["ru", "Русский"], ["zh", "中文"], ["ja", "日本語"], ["vec", "Vèneto"]];
  var CODES = LANGS.map(function (l) { return l[0]; });
  var WORD = /[\p{L}\p{N}]/u;
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function compile(d) {
    if (d.__c) return d.__c;
    var exact = new Map(), map = new Map(), keys = [];
    Object.keys(d.s || {}).forEach(function (k) {
      var v = d.s[k], kt = k.trim(), vt = String(v == null ? "" : v).trim();
      if (!kt || !vt || kt === vt || /Fragmarathon/.test(kt)) return;
      exact.set(kt, vt);
      /* pezzi da sostituire dentro testi più lunghi: almeno 4 caratteri o con uno spazio */
      if ((kt.length >= 4 || / /.test(kt) || (kt.length >= 3 && kt !== k)) && !map.has(kt)) { map.set(kt, vt); keys.push(kt); }
    });
    keys.sort(function (a, b) { return b.length - a.length; });
    var parts = keys.map(function (k) {
      /* confine di parola; e mai dentro un comando (/giocatore), un @nome, un #tag o un nome_tecnico */
      return (WORD.test(k.charAt(0)) ? "(?<![\\p{L}\\p{N}/@#_-])" : "") + esc(k) + (WORD.test(k.charAt(k.length - 1)) ? "(?![\\p{L}\\p{N}_])" : "");
    });
    var re = parts.length ? new RegExp(parts.join("|"), "gu") : null;
    return (d.__c = { exact: exact, map: map, re: re });
  }
  function tr(str, d) {
    if (!d || str == null) return str;
    str = String(str);
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str), core = m[2];
    if (!core || !/[A-Za-zÀ-ÿ]{2}/.test(core)) return str;
    var c = compile(d), e = c.exact.get(core);
    if (e != null) return m[1] + e + m[3];
    if (!c.re) return str;
    return m[1] + core.replace(c.re, function (x) { var v = c.map.get(x); return v == null ? x : v; }) + m[3];
  }
  function pick(code) { code = String(code || "").toLowerCase(); if (CODES.indexOf(code) >= 0) return code; var b = code.split(/[-_]/)[0]; return CODES.indexOf(b) >= 0 ? b : ""; }
  var api = { LANGS: LANGS, CODES: CODES, compile: compile, tr: tr, pick: pick };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.I18NCORE = api;
})(typeof window !== "undefined" ? window : this);
