// Estrae le frasi italiane da tradurre: testi e attributi (placeholder, title, aria-label) di index.html,
// stringhe dei file js dell'interfaccia (spezzate sui tag HTML), stringhe del bot, guida e novità.
// Scrive tools/i18n/strings.json (o il file indicato). Uso: node tools/i18n-extract.mjs [file]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (f) => fs.readFileSync(path.join(root, f), "utf8");

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&#92;": "\\" };
const dec = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp|#92);/g, (m) => ENT[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

/* stringhe letterali JS (', ", `) con gli escape */
function literals(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2); if (i < 0) break; i += 2; continue; }
    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") { const n = src[j + 1]; s += n === "n" ? "\n" : n === "t" ? "\t" : n === "u" ? String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)) : n; j += n === "u" ? 6 : 2; continue; }
        if (c !== "`" && src[j] === "\n") break;
        s += src[j++];
      }
      out.push(s); i = j + 1; continue;
    }
    /* regex letterali: salta /.../flags dopo ( , = : [ ! & | ? { } ; return */
    if (c === "/") {
      const before = src.slice(Math.max(0, i - 8), i).replace(/\s+$/, "");
      if (/[(,=:[!&|?{};]$|return$/.test(before)) { let j = i + 1, cls = false; while (j < src.length && src[j] !== "\n") { if (src[j] === "\\") { j += 2; continue; } if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; else if (src[j] === "/" && !cls) break; j++; } i = j + 1; continue; }
    }
    i++;
  }
  return out;
}
const CODE = /^(#|\.|\/|https?:|data:|var\(|rgba?\(|[a-z-]+:[^ ]|[\w-]+=)|[{};=]|=>|\bpx\b|^[a-z0-9_.-]+$|^[A-Z0-9_]+$/;
function keep(t) {
  t = t.replace(/\s+/g, " ");
  if (!/[A-Za-zÀ-ÿ]{2}/.test(t)) return false;
  const tt = t.trim();
  /* pezzi di frase in minuscolo con lo spazio ai bordi: " gironi", " partite.", " per " */
  if (t !== tt && /^[a-zà-ù]{2,}( [a-zà-ù]+)*[.,:;!?]?$/.test(tt) && /[aeiouàèéìòù][.,:;!?]?$/.test(tt)) return true;
  if (/^[A-ZÀ-Ù]{3,}$/.test(tt) && !/^(START|PNG|PDF|CSS|JSON|URL|HTML|RTMP|HTTP|HTTPS|OBS|MVP|AI|FFA|NVENC|QSV|AMF|GPU|CPU|ID|IP|OK)$/.test(tt)) return true;
  if (CODE.test(tt) && !/ /.test(tt)) return false;
  if (/^(function|return|var|const|let)\b/.test(tt)) return false;
  if (/[{};]/.test(tt) && !/[.!?]$/.test(tt)) return false;
  if (/^[\w-]+(\s[\w-]+)*$/.test(tt) && tt === tt.toLowerCase() && !/[àèéìòù]/.test(tt) && tt.split(" ").length < 2) return false;
  return true;
}
const IT = /\b(il|lo|la|le|gli|di|del|della|che|per|con|un|una|non|si|ai|al|alle|da|nel|sono|tutti|torneo|giocatori?|squadr[ae]|partit[ae]|turno|gironi?)\b|[àèéìòù]/i;
const EN = /\b(the|and|with|no|background|icon|style|for a|of the|text|metal|chrome|emblem|badge|flat|mascot)\b/gi;
const CSSY = /[#.][\w-]+[\s,:[>]|:not\(|minmax\(|\d+px\b|\bpx\b|sans-serif|\[name=|%%EOF|%PDF|^[a-z]+[A-Z]\w*$|^[\w-]+\/[\w.-]+$|^\/\*|\bcm\b.*\bDo\b|^[a-z]{2}-[A-Z]{2}$/;
function clean(t) {
  if (/^\[|="|='|^"|viewBox|data-|class=|^[A-Z][a-z]+[A-Z]\w*$/.test(t) || CSSY.test(t)) return "";
  if ((t.match(EN) || []).length >= 2 && !IT.test(t)) return "";
  return t;
}
function pieces(lit, set) {
  for (const m of lit.matchAll(/\b(?:placeholder|title|aria-label|alt)="([^"]*)"/g)) { const d = clean(dec(m[1])); if (d && keep(d)) set.add(d.replace(/\s+/g, " ")); }
  /* stringhe che iniziano o finiscono a metà di un tag (HTML costruito a pezzi) */
  const gt = lit.indexOf(">"), lt = lit.indexOf("<");
  if (gt >= 0 && (lt < 0 || gt < lt)) lit = lit.slice(gt + 1);
  if (lit.lastIndexOf("<") > lit.lastIndexOf(">")) lit = lit.slice(0, lit.lastIndexOf("<"));
  if (/<[a-z/!]/i.test(lit)) {
    for (const m of lit.matchAll(/\b(?:placeholder|title|aria-label|alt)="([^"]*)"/g)) if (keep(dec(m[1]))) set.add(dec(m[1]).replace(/\s+/g, " "));
    for (const part of lit.split(/<[^>]*>/)) { const d = clean(dec(part)); if (d && keep(d)) set.add(d.replace(/\s+/g, " ")); }
  } else { const d = clean(lit); if (d && keep(d)) set.add(d.replace(/\s+/g, " ")); }
}
const ui = new Set(), bot = new Set(), log = new Set();
/* index.html: testi tra i tag (senza <style>/<script>) e attributi */
const html = rd("index.html").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/src="data:[^"]*"/g, "");
pieces(html, ui);
/* parole scelte nel codice con ?: , es. (team?"squadra":"giocatore") */
function ternaries(src, set) {
  for (const m of src.matchAll(/\?\s*(["'])([a-zà-ù][a-zà-ù ]{2,30})\1\s*:\s*(["'])([a-zà-ù][a-zà-ù ]{2,30})\3/g)) [m[2], m[4]].forEach((w) => { if (IT.test(" " + w + " ") || /^[a-zà-ù]+[aeiou]$/.test(w)) set.add(w); });
}
for (const f of ["js/app.js", "js/home.js", "js/sections.js", "js/crypt.js", "js/pwa.js", "js/ai.js"]) if (fs.existsSync(path.join(root, f))) { const src = rd(f); literals(src).forEach((l) => pieces(l, ui)); ternaries(src, ui); }
literals(rd("bot.js")).forEach((l) => pieces(l, bot)); ternaries(rd("bot.js"), bot);
/* frasi composte a pezzi nel codice, scritte intere in tools/i18n/extra.json */
JSON.parse(rd("tools/i18n/extra.json")).ui.forEach((x) => ui.add(x));
/* novità: titoli e voci */
const CL = (await import("file://" + path.join(root, "js/changelog.js").replace(/\\/g, "/"))).default;
CL.forEach((r) => { log.add(r.t); r.items.forEach((x) => log.add(x)); });
/* guida: argomenti interi (titolo + HTML) */
globalThis.window = {}; await import("file://" + path.join(root, "js/help.js").replace(/\\/g, "/"));
const help = {}; for (const [k, v] of Object.entries(globalThis.window.HELP.topics)) help[k] = { t: v.t, h: v.h };
/* ripulisce: niente doppioni tra ui e bot, ordinati */
const out = { ui: [...ui].sort(), bot: [...bot].filter((s) => !ui.has(s)).sort(), changelog: [...log], help };
fs.mkdirSync(path.join(root, "tools", "i18n"), { recursive: true });
fs.writeFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "tools", "i18n", "strings.json"), JSON.stringify(out, null, 1));
const chars = (a) => a.reduce((n, s) => n + s.length, 0);
console.log(`ui ${out.ui.length} frasi (${chars(out.ui)} caratteri), bot ${out.bot.length} (${chars(out.bot)}), novità ${out.changelog.length} (${chars(out.changelog)}), guida ${Object.keys(help).length} argomenti (${Object.values(help).reduce((n, x) => n + x.t.length + x.h.length, 0)} caratteri)`);
