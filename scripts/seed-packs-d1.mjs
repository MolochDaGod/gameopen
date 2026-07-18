/**
 * Seed D1 asset_registry for outdoor + pack catalog rows using LIVE schema.
 *
 * Live columns (grudge-assets-db / asset_registry):
 *   id, name, category, r2_key, bone_map, animation_packs,
 *   file_size, updated_at, created_at, grudge_uuid
 *
 *   node scripts/seed-packs-d1.mjs
 *   node scripts/seed-packs-d1.mjs --apply
 *   node scripts/seed-packs-d1.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { grudgeUuidFromR2Key, cdnUrl } from "./lib/assetUuid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
const dbName = process.env.D1_DATABASE || "grudge-assets-db";

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

function collectFromCatalog(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return [];
  const cat = JSON.parse(fs.readFileSync(p, "utf8"));
  const out = [];
  for (const a of cat.assets || []) {
    if (!a.r2Key) continue;
    const grudgeUuid = grudgeUuidFromR2Key(a.r2Key);
    // Optional local size probe under public/
    let file_size = null;
    const local = path.join(root, "artifacts/animator/public", a.r2Key);
    if (fs.existsSync(local)) file_size = fs.statSync(local).size;
    out.push({
      id: grudgeUuid,
      name: a.id || path.basename(a.r2Key),
      category: a.category || "model",
      r2_key: a.r2Key,
      file_size,
      grudge_uuid: grudgeUuid,
      animation_packs: JSON.stringify({
        cdnUrl: cdnUrl(a.r2Key),
        role: a.role || null,
        testWorldId: a.testWorldId || null,
        sourceSet: "gameopen-outdoor-packs",
        contentType: a.contentType || "model/gltf-binary",
        notes: a.notes || null,
      }),
    });
  }
  return out;
}

// Kenney roads directory walk
function collectKenneyRoads() {
  const dir = path.join(root, "artifacts/animator/public/models/kenney/roads");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".glb"))
    .map((f) => {
      const r2Key = `models/kenney/roads/${f}`;
      const full = path.join(dir, f);
      const grudgeUuid = grudgeUuidFromR2Key(r2Key);
      return {
        id: grudgeUuid,
        name: f,
        category: "road_tile",
        r2_key: r2Key,
        file_size: fs.statSync(full).size,
        grudge_uuid: grudgeUuid,
        animation_packs: JSON.stringify({
          cdnUrl: cdnUrl(r2Key),
          role: "kenney_road",
          sourceSet: "kenney-city-kit-roads",
          contentType: "model/gltf-binary",
          tileM: 8,
        }),
      };
    });
}

const byKey = new Map();
for (const r of [
  ...collectFromCatalog("content/worlds/outdoor-asset-catalog.json"),
  ...collectKenneyRoads(),
]) {
  byKey.set(r.r2_key, r);
}
const rows = [...byKey.values()];
const now = Date.now();

const stmts = rows.map((r) => {
  const size = r.file_size == null ? "NULL" : Number(r.file_size);
  return (
    `INSERT OR REPLACE INTO asset_registry ` +
    `(id, name, category, r2_key, bone_map, animation_packs, file_size, updated_at, created_at, grudge_uuid) VALUES (` +
    `'${esc(r.id)}', '${esc(r.name)}', '${esc(r.category)}', '${esc(r.r2_key)}', ` +
    `NULL, '${esc(r.animation_packs)}', ${size}, ${now}, ${now}, '${esc(r.grudge_uuid)}');`
  );
});

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
const sqlPath = path.join(outDir, "packs-outdoor-d1-seed.sql");
fs.writeFileSync(
  sqlPath,
  `-- outdoor + packs live schema · ${rows.length} rows · ${new Date().toISOString()}\n` +
    stmts.join("\n") +
    "\n",
);
fs.writeFileSync(
  path.join(outDir, "packs-outdoor-d1-rows.json"),
  JSON.stringify({ database: dbName, count: rows.length, rows }, null, 2),
);

console.log(`[seed-packs-d1] ${rows.length} rows → ${sqlPath}`);

if (dryRun || !apply) {
  if (!apply) {
    console.log(`\nApply: node scripts/seed-packs-d1.mjs --apply`);
  }
  process.exit(0);
}

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", dbName, "--remote", `--file=${sqlPath}`],
  { cwd: root, stdio: "inherit", shell: true },
);
process.exit(r.status ?? 1);
