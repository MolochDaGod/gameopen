/**
 * Seed D1 asset_registry for production world uploads (Grudge L0 pattern).
 *
 *   node scripts/seed-prod-worlds-d1.mjs           # write SQL
 *   node scripts/seed-prod-worlds-d1.mjs --apply   # wrangler d1 execute --remote
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { grudgeUuidFromR2Key, cdnUrl } from "./lib/assetUuid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apply = process.argv.includes("--apply");
const dbName = process.env.D1_DATABASE || "grudge-assets-db";

const assets = [
  { id: "vol", r2Key: "models/vol.glb", category: "world", role: "mimic-dungeon" },
  { id: "bridge_town", r2Key: "models/worlds/bridge_town.glb", category: "world", role: "dock-kit" },
  { id: "bridge-town-kit", r2Key: "models/towns/bridge-town-kit.glb", category: "world", role: "dock-kit" },
  { id: "fabled-zone", r2Key: "models/worlds/fabled-zone.glb", category: "world", role: "faction-town" },
  { id: "fabledzone", r2Key: "models/worlds/fabledzone.glb", category: "world", role: "faction-town" },
  { id: "barrel-01", r2Key: "models/destructibles/barrel-01.glb", category: "prop", role: "destructible" },
  { id: "island_life", r2Key: "models/worlds/island_life.glb", category: "world", role: "survival" },
];

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

// Live schema (PRAGMA 2026-08-01):
// id PK TEXT, name, category, r2_key, bone_map, animation_packs, file_size,
// updated_at INTEGER, created_at INTEGER, grudge_uuid TEXT
const nowMs = Date.now();
const statements = assets.map((a) => {
  const grudgeUuid = grudgeUuidFromR2Key(a.r2Key);
  // Prefer stable id = r2Key so re-seeds upsert cleanly
  const id = a.r2Key;
  // UNIQUE(r2_key) on live DB — upsert on r2_key; id = grudge_uuid for stability
  return (
    `INSERT INTO asset_registry (id, name, category, r2_key, grudge_uuid, file_size, updated_at, created_at) VALUES (` +
    `'${esc(grudgeUuid)}', '${esc(a.id)}', '${esc(a.category)}', '${esc(a.r2Key)}', ` +
    `'${esc(grudgeUuid)}', NULL, ${nowMs}, ${nowMs}` +
    `) ON CONFLICT(r2_key) DO UPDATE SET ` +
    `name=excluded.name, category=excluded.category, ` +
    `grudge_uuid=excluded.grudge_uuid, updated_at=excluded.updated_at;`
  );
});

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
const sqlPath = path.join(outDir, "prod-worlds-d1-seed.sql");
fs.writeFileSync(sqlPath, statements.join("\n") + "\n", "utf8");
console.log(`[seed-prod-worlds-d1] wrote ${statements.length} stmts → ${sqlPath}`);

if (!apply) {
  console.log("Dry SQL only. Apply: node scripts/seed-prod-worlds-d1.mjs --apply");
  process.exit(0);
}

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", dbName, "--remote", `--file=${sqlPath}`],
  { cwd: root, encoding: "utf8", shell: true, maxBuffer: 10 * 1024 * 1024 },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status === 0 ? 0 : 1);
