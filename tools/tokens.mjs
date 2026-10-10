// Token spesi per ogni versione: legge i registri delle sessioni di Claude Code di questo progetto
// (anche quelli dei sotto-agenti), assegna ogni risposta alla prima release pubblicata dopo
// (commit con "(x.y.z)" nel titolo) e scrive js/tokens.js, che la finestra delle novità mostra.
// Uso: node tools/tokens.mjs [cartella dei registri]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = root.replace(/[:\\/]/g, "-").replace(/^-+/, "");
const logs = process.argv[2] || path.join(os.homedir(), ".claude", "projects", slug);

function walk(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.jsonl$/.test(e.name) ? [path.join(d, e.name)] : []);
}
/* release: commit con "(x.y.z)" o "x.y:" nel titolo */
const rel = execFileSync("git", ["log", "--reverse", "--format=%aI\t%s"], { cwd: root, encoding: "utf8" }).trim().split("\n").map((l) => {
  const [t, s] = l.split("\t"), m = /\((\d+\.\d+\.\d+)\)\s*$/.exec(s) || /\b(\d+\.\d+)(?:\.\d+)?:/.exec(s);
  if (!m) return null;
  const v = m[1].split(".").length === 2 ? m[1] + ".0" : m[1];
  return { v, t: Date.parse(t) };
}).filter(Boolean);

/* il lavoro dopo l'ultima release va alla versione in uscita (package.json) */
const NEXT = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const seen = new Set(), by = {}, zero = () => ({ in: 0, cw: 0, cr: 0, out: 0, msgs: 0 });
let files = 0;
for (const f of walk(logs)) {
  files++;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (!line.includes('"usage"')) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const u = o.message && o.message.usage, id = o.message && o.message.id;
    if (o.type !== "assistant" || !u || !o.timestamp) continue;
    const key = (id || "") + "|" + (o.requestId || "") + "|" + f;
    if (seen.has(key)) continue; seen.add(key);
    const ts = Date.parse(o.timestamp), r = rel.find((x) => x.t >= ts), v = r ? r.v : NEXT;
    const b = by[v] || (by[v] = zero());
    b.in += u.input_tokens || 0; b.cw += u.cache_creation_input_tokens || 0; b.cr += u.cache_read_input_tokens || 0; b.out += u.output_tokens || 0; b.msgs++;
  }
}
const total = zero();
for (const b of Object.values(by)) { b.tot = b.in + b.cw + b.cr + b.out; for (const k of ["in", "cw", "cr", "out", "msgs"]) total[k] += b[k]; }
total.tot = total.in + total.cw + total.cr + total.out;
const data = { updated: new Date().toISOString(), total, byVersion: by };
fs.writeFileSync(path.join(root, "js", "tokens.js"),
  "/* Generato da tools/tokens.mjs: token di Claude spesi per ogni versione (in = nuovi in ingresso, cw = scritti in cache,\n" +
  "   cr = letti dalla cache, out = scritti dal modello). Non modificare a mano. */\n" +
  "(function (d) { if (typeof module !== \"undefined\") module.exports = d; else window.TOKENS = d; })(" + JSON.stringify(data) + ");\n");
console.log(`${files} registri, ${seen.size} risposte, totale ${(total.tot / 1e6).toFixed(1)} M token (${(total.out / 1e3).toFixed(0)} k scritti)`);
for (const [v, b] of Object.entries(by)) console.log(v.padEnd(9), (b.tot / 1e6).toFixed(2).padStart(7), "M", String(Math.round(b.out / 1e3)).padStart(5), "k scritti");
