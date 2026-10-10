// Frasi ancora da tradurre: estrae di nuovo le frasi italiane e le confronta con js/lang/<codice>.js.
// Scrive tools/i18n/missing.json { codice: { s: [frasi], help: [argomenti] } }. Uso: node tools/i18n-missing.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
execFileSync(process.execPath, [path.join(root, "tools", "i18n-extract.mjs")], { cwd: root, stdio: "inherit" });
const S = JSON.parse(fs.readFileSync(path.join(root, "tools", "i18n", "strings.json"), "utf8"));
/* tradotte.json: le frasi com'erano all'ultima traduzione (per accorgersi degli argomenti della guida cambiati) */
const B = fs.existsSync(path.join(root, "tools", "i18n", "tradotte.json")) ? JSON.parse(fs.readFileSync(path.join(root, "tools", "i18n", "tradotte.json"), "utf8")) : { help: {} };
const all = [...S.ui, ...S.bot, ...S.changelog], out = {};
for (const f of fs.readdirSync(path.join(root, "js", "lang")).filter((x) => x.endsWith(".js"))) {
  const d = require(path.join(root, "js", "lang", f)), code = d.code;
  const s = all.filter((k) => !(k in d.s)), help = Object.keys(S.help).filter((k) => !d.help || !d.help[k] || !B.help[k] || B.help[k].h !== S.help[k].h || B.help[k].t !== S.help[k].t);
  out[code] = { s, help };
  console.log(code.padEnd(4), "mancano", String(s.length).padStart(4), "frasi,", help.length, "argomenti della guida");
}
fs.writeFileSync(path.join(root, "tools", "i18n", "missing.json"), JSON.stringify(out, null, 1));
