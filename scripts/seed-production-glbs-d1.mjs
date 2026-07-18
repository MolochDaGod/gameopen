/**
 * Seed D1 asset_registry for production GLB manifests (correct live schema).
 *
 * Live columns (grudge-assets-db):
 *   id, name, category, r2_key, bone_map, animation_packs,
 *   file_size, updated_at, created_at, grudge_uuid
 *
 * PK = id (TEXT). We use deterministic grudgeUuid as id AND grudge_uuid.
 * UNIQUE-ish via r2_key upsert by deleting+insert or INSERT OR REPLACE on id.
 *
 *   node scripts/seed-production-glbs-d1.mjs
 *   node scripts/seed-production-glbs-d1.mjs --apply
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

/** Collect assets from outdoor + production manifests + outdoor catalog. */
function collectAssets() {
  const byKey = new Map();

  const outdoorCat = path.join(root, "content/worlds/outdoor-asset-catalog.json");
  if (fs.existsSync(outdoorCat)) {
    const cat = JSON.parse(fs.readFileSync(outdoorCat, "utf8"));
    for (const a of cat.assets || []) {
      const r2Key = a.r2Key;
      const grudgeUuid = grudgeUuidFromR2Key(r2Key);
      byKey.set(r2Key, {
        id: grudgeUuid,
        name: a.id || path.basename(r2Key),
        category: a.category || "model",
        r2_key: r2Key,
        file_size: null,
        grudge_uuid: grudgeUuid,
        animation_packs: JSON.stringify({
          cdnUrl: cdnUrl(r2Key),
          role: a.role || null,
          testWorldId: a.testWorldId || null,
          sourceSet: "gameopen-outdoor",
          contentType: a.contentType || "model/gltf-binary",
        }),
      });
    }
  }

  for (const manName of [
    "reports/outdoor-r2-manifest.json",
    "reports/production-glbs-r2-manifest.json",
  ]) {
    const p = path.join(root, manName);
    if (!fs.existsSync(p)) continue;
    const man = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const a of man.assets || []) {
      if (!a.r2Key) continue;
      const grudgeUuid = a.grudgeUuid || grudgeUuidFromR2Key(a.r2Key);
      const prev = byKey.get(a.r2Key) || {};
      byKey.set(a.r2Key, {
        id: grudgeUuid,
        name: path.basename(a.r2Key),
        category: a.category || prev.category || "model",
        r2_key: a.r2Key,
        file_size: a.bytes ?? prev.file_size ?? null,
        grudge_uuid: grudgeUuid,
        animation_packs: JSON.stringify({
          cdnUrl: a.cdnUrl || cdnUrl(a.r2Key),
          sourceHash: a.md5 || null,
          status: a.status || null,
          sourceSet: manName.includes("outdoor")
            ? "gameopen-outdoor"
            : "gameopen-production-glbs",
          contentType: a.contentType || "model/gltf-binary",
        }),
      });
    }
  }

  return [...byKey.values()];
}

const rows = collectAssets();
const now = Date.now();

// INSERT OR REPLACE requires all NOT NULL fields; use id as PK
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
const sqlPath = path.join(outDir, "production-asset-registry-seed.sql");
fs.writeFileSync(
  sqlPath,
  `-- asset_registry seed (live schema) · ${rows.length} rows · ${new Date().toISOString()}\n` +
    stmts.join("\n") +
    "\n",
);

// Chunks of 80
const chunkSize = 80;
const parts = [];
for (let i = 0; i < stmts.length; i += chunkSize) {
  const part = stmts.slice(i, i + chunkSize);
  const partPath = path.join(outDir, `production-asset-registry-part${parts.length + 1}.sql`);
  fs.writeFileSync(partPath, part.join("\n") + "\n");
  parts.push(partPath);
}

fs.writeFileSync(
  path.join(outDir, "production-asset-registry-rows.json"),
  JSON.stringify({ database: dbName, count: rows.length, rows }, null, 2),
);

console.log(`[seed-production-glbs-d1] ${rows.length} rows → ${sqlPath}`);
console.log(`  parts: ${parts.length}`);

if (dryRun || !apply) {
  if (!apply) {
    console.log(
      `\nApply:\n  node scripts/seed-production-glbs-d1.mjs --apply\n` +
        parts.map((p, i) => `  # or part ${i + 1}: npx wrangler d1 execute ${dbName} --remote --file=${p}`).join("\n"),
    );
  }
  if (!apply) process.exit(0);
}

let failed = 0;
for (const partPath of parts) {
  console.log(`\n> wrangler d1 execute ${dbName} --remote --file=${partPath}`);
  const r = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", dbName, "--remote", `--file=${partPath}`],
    { cwd: root, stdio: "inherit", shell: true },
  );
  if ((r.status ?? 1) !== 0) failed++;
}

// Verify count
const v = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    dbName,
    "--remote",
    "--command",
    "SELECT COUNT(*) AS n FROM asset_registry WHERE animation_packs LIKE '%gameopen%';",
  ],
  { cwd: root, stdio: "inherit", shell: true },
);

process.exit(failed > 0 ? 1 : 0);
