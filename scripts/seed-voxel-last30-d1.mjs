/**
 * Seed D1 asset_registry for voxel last-30 downloads (maps / animals / content / VFX).
 * Uses LIVE schema (grudge-assets-db):
 *   id, name, category, r2_key, bone_map, animation_packs,
 *   file_size, updated_at, created_at, grudge_uuid
 *
 * animation_packs JSON carries CDN + codex links (Mine-Loader blocks/defs).
 *
 *   node scripts/seed-voxel-last30-d1.mjs
 *   node scripts/seed-voxel-last30-d1.mjs --apply
 *   node scripts/seed-voxel-last30-d1.mjs --dry-run
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
const catalogPath = path.join(root, "content/worlds/voxel-last30-catalog.json");
const publicRoot = path.join(root, "artifacts/animator/public");

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const now = Date.now();
const rows = [];

for (const a of cat.assets || []) {
  if (!a.r2Key) continue;
  const grudgeUuid = grudgeUuidFromR2Key(a.r2Key);
  let file_size = null;
  const local = path.join(publicRoot, a.r2Key);
  if (fs.existsSync(local)) file_size = fs.statSync(local).size;
  else if (a.mb != null) file_size = Math.round(Number(a.mb) * 1024 * 1024);

  const animation_packs = {
    cdnUrl: cdnUrl(a.r2Key),
    sourceSet: "voxel-last30-downloads",
    contentType: "model/gltf-binary",
    role: a.role || null,
    category: a.category || null,
    forceMap: !!a.forceMap,
    forceProp: !!a.forceProp,
    uploadPolicy: a.upload || null,
    nativeBounds: a.nativeBounds || null,
    codex: a.codex || null,
    codexApis: cat.policy?.codex || null,
    notes: a.notes || null,
    src: a.src || null,
  };

  rows.push({
    id: grudgeUuid,
    name: a.id,
    category: a.category || "voxel",
    r2_key: a.r2Key,
    file_size,
    grudge_uuid: grudgeUuid,
    animation_packs: JSON.stringify(animation_packs),
  });
}

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
const sqlPath = path.join(outDir, "voxel-last30-d1-seed.sql");
fs.writeFileSync(
  sqlPath,
  `-- voxel last-30 · live schema · ${rows.length} rows · ${new Date().toISOString()}\n` +
    stmts.join("\n") +
    "\n",
);
fs.writeFileSync(
  path.join(outDir, "voxel-last30-d1-rows.json"),
  JSON.stringify(
    {
      database: dbName,
      count: rows.length,
      byCategory: rows.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      }, {}),
      rows,
    },
    null,
    2,
  ),
);

console.log(`[seed-voxel-last30] ${rows.length} rows → ${sqlPath}`);
const byCat = rows.reduce((acc, r) => {
  acc[r.category] = (acc[r.category] || 0) + 1;
  return acc;
}, {});
console.log("  categories:", byCat);

if (dryRun || !apply) {
  if (!apply) console.log(`\nApply: node scripts/seed-voxel-last30-d1.mjs --apply`);
  process.exit(0);
}

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", dbName, "--remote", `--file=${sqlPath}`],
  { cwd: root, stdio: "inherit", shell: true },
);
process.exit(r.status ?? 1);
