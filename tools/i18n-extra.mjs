// Inserisce nei dizionari le frasi di tools/i18n/extra.json (traduzioni già pronte), senza toccare le altre.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const X = JSON.parse(fs.readFileSync(path.join(root, "tools", "i18n", "extra.json"), "utf8"));
for (const [code, list] of Object.entries(X.tr)) {
  const f = path.join(root, "js", "lang", code + ".js");
  let src = fs.readFileSync(f, "utf8"), added = 0;
  const d = require(f);
  X.ui.forEach((k, i) => {
    if (k in d.s) return;
    /* aggiunge la voce subito dopo "s: {" */
    src = src.replace(/(\n\s*"?s"?\s*:\s*\{)/, (m) => m + "\n    " + JSON.stringify(k) + ": " + JSON.stringify(list[i]) + ",");
    added++;
  });
  fs.writeFileSync(f, src);
  console.log(code, "aggiunte", added);
}
