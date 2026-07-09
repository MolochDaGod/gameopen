/**
 * Merge production gameopen assets into artifacts/animator/public.
 * Source priority:
 *   1. legacy-static/public (packaged dist)
 *   2. client/public
 *   3. D:\Games\Models\gameopen\dist\public
 *
 * Only copies missing files; never overwrites richer existing animator packs
 * unless FORCE_OVERWRITE=1.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dest = path.join(root, "artifacts/animator/public");

const candidates = [
  path.join(root, "legacy-static/public"),
  path.join(root, "client/public"),
  "D:/Games/Models/gameopen/dist/public",
];

const src = candidates.find((p) => fs.existsSync(p));
if (!src) {
  console.error("No gameopen public source found");
  process.exit(1);
}

const force = process.env.FORCE_OVERWRITE === "1";
const SKIP = new Set(["assets", "index.html", "index.html.br", "index.html.gz"]);

function walk(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

let copied = 0;
let skipped = 0;
for (const rel of walk(src)) {
  if (rel.endsWith(".br") || rel.endsWith(".gz")) continue;
  // skip hashed vite bundles
  if (rel.startsWith("assets/") && /\.(js|css)$/.test(rel)) continue;

  const from = path.join(src, rel);
  const to = path.join(dest, rel);
  if (fs.existsSync(to) && !force) {
    skipped++;
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
}

console.log(
  `[merge-gameopen-assets] from=${src} → dest copied=${copied} skipped=${skipped}`,
);
