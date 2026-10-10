// Copia la PWA dentro site/public/app/ così la pagina e l'app escono dallo stesso deploy.
// Uso: node site/build.mjs   (poi: cd site && npx wrangler deploy)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "site", "public", "app");
const FILES = [
  "index.html", "manifest.webmanifest", "sw.js",
  "icon.png", "icon-192.png", "icon-512.png", "icon-maskable.png",
  "js/formats.js", "js/help.js", "js/ai.js", "js/app.js", "js/pwa.js", "css/ui.css", "css/themes.css"
];

fs.rmSync(out, { recursive: true, force: true });
for (const f of FILES) {
  const dst = path.join(out, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(root, f), dst);
}
console.log(`PWA copiata in ${path.relative(root, out)} (${FILES.length} file)`);
