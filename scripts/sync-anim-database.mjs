/**
 * Sync content/anims → animator embed + public mirror.
 * Run after editing content/anims/database.json or states.json.
 *
 *   node scripts/sync-anim-database.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "content/anims");
const targets = [
  path.join(root, "artifacts/animator/src/three/anim/data"),
  path.join(root, "artifacts/animator/public/content/anims"),
];

const files = ["database.json", "states.json", "weapon-live-packs.json"];

for (const t of targets) {
  fs.mkdirSync(t, { recursive: true });
  for (const f of files) {
    const from = path.join(srcDir, f);
    const to = path.join(t, f);
    if (!fs.existsSync(from)) {
      console.error("missing", from);
      process.exit(1);
    }
    fs.copyFileSync(from, to);
    console.log("sync", path.relative(root, from), "→", path.relative(root, to));
  }
}

// Quick readiness summary
const db = JSON.parse(fs.readFileSync(path.join(srcDir, "database.json"), "utf8"));
const counts = { ready: 0, placeholder: 0, missing: 0, banned: 0 };
for (const c of db.clips || []) {
  counts[c.status] = (counts[c.status] || 0) + 1;
}
console.log("\nclip status:", counts, "total", (db.clips || []).length);
console.log("packs:", Object.keys(db.packs || {}).join(", "));
