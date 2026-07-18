/**
 * Seed Cloudflare D1 asset_registry for outdoor worlds + nature packs.
 *
 * Best practices (grudge-d1-r2):
 *  - Stable PK = deterministic grudgeUuid from r2Key
 *  - UNIQUE r2_key
 *  - Batch ≤ 100 statements
 *  - INSERT OR REPLACE / ON CONFLICT upsert
 *  - --remote for live DB
 *
 * Usage:
 *   node scripts/seed-outdoor-d1.mjs              # write SQL only
 *   node scripts/seed-outdoor-d1.mjs --apply      # wrangler d1 execute --remote
 *   node scripts/seed-outdoor-d1.mjs --dry-run
 *
 * Env / flags:
 *   D1_DATABASE  (default grudge-assets-db)
 *   --local      use wrangler without --remote
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
const localOnly = process.argv.includes("--local");
const dbName = process.env.D1_DATABASE || "grudge-assets-db";

const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "content/worlds/outdoor-asset-catalog.json"), "utf8"),
);

// Prefer upload manifest hashes when present
let manifestAssets = [];
const manPath = path.join(root, "reports/outdoor-r2-manifest.json");
if (fs.existsSync(manPath)) {
  try {
    manifestAssets = JSON.parse(fs.readFileSync(manPath, "utf8")).assets || [];
  } catch {
    /* */
  }
}
const byKey = new Map(manifestAssets.map((a) => [a.r2Key, a]));

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

const rows = catalog.assets.map((a) => {
  const r2Key = a.r2Key;
  const grudgeUuid = grudgeUuidFromR2Key(r2Key);
  const man = byKey.get(r2Key);
  const cdn = cdnUrl(r2Key, catalog.cdn);
  const bytes = man?.bytes ?? null;
  const hash = man?.md5 ?? null;
  return {
    grudgeUuid,
    r2Key,
    category: a.category || "world",
    name: a.id,
    cdnUrl: cdn,
    contentType: a.contentType || "model/gltf-binary",
    bytes,
    hash,
    metadata: JSON.stringify({
      role: a.role,
      testWorldId: a.testWorldId || null,
      sourceSet: "gameopen-outdoor",
      notes: a.notes || null,
    }),
  };
});

/**
 * Schema-tolerant upsert. RTS-Grudge asset_registry typically has:
 *   grudge_uuid, r2_key, category, updated_at, …
 * We emit columns widely present; adjust if remote schema differs.
 */
const statements = rows.map((r) => {
  const now = new Date().toISOString();
  return (
    `INSERT INTO asset_registry (grudge_uuid, r2_key, category, name, cdn_url, content_type, byte_size, source_hash, metadata_json, updated_at) VALUES (` +
    `'${esc(r.grudgeUuid)}', '${esc(r.r2Key)}', '${esc(r.category)}', '${esc(r.name)}', ` +
    `'${esc(r.cdnUrl)}', '${esc(r.contentType)}', ` +
    `${r.bytes == null ? "NULL" : Number(r.bytes)}, ` +
    `${r.hash ? `'${esc(r.hash)}'` : "NULL"}, ` +
    `'${esc(r.metadata)}', '${now}'` +
    `) ON CONFLICT(r2_key) DO UPDATE SET ` +
    `grudge_uuid=excluded.grudge_uuid, category=excluded.category, name=excluded.name, ` +
    `cdn_url=excluded.cdn_url, content_type=excluded.content_type, ` +
    `byte_size=COALESCE(excluded.byte_size, asset_registry.byte_size), ` +
    `source_hash=COALESCE(excluded.source_hash, asset_registry.source_hash), ` +
    `metadata_json=excluded.metadata_json, updated_at=excluded.updated_at;`
  );
});

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
const sqlPath = path.join(outDir, "outdoor-d1-seed.sql");
const header = `-- outdoor worlds + nature → D1 ${dbName}
-- generated ${new Date().toISOString()}
-- rows ${rows.length}
-- Apply: npx wrangler d1 execute ${dbName} --remote --file=${sqlPath.replace(/\\/g, "/")}
`;
fs.writeFileSync(sqlPath, header + statements.join("\n") + "\n");

const jsonPath = path.join(outDir, "outdoor-d1-rows.json");
fs.writeFileSync(jsonPath, JSON.stringify({ database: dbName, rows }, null, 2));

console.log(`[seed-outdoor-d1] wrote ${rows.length} rows`);
console.log(`  SQL  → ${sqlPath}`);
console.log(`  JSON → ${jsonPath}`);

if (dryRun) {
  console.log("[seed-outdoor-d1] dry-run — not applying");
  process.exit(0);
}

if (!apply) {
  console.log(
    "\nNext (with Cloudflare auth):\n" +
      `  npx wrangler d1 execute ${dbName} --remote --file=reports/outdoor-d1-seed.sql\n` +
      "  or: node scripts/seed-outdoor-d1.mjs --apply",
  );
  process.exit(0);
}

// Batch wrangler (≤100 statements — we are well under)
const args = [
  "wrangler",
  "d1",
  "execute",
  dbName,
  ...(localOnly ? [] : ["--remote"]),
  `--file=${sqlPath}`,
];
console.log(`\n> npx ${args.join(" ")}`);
const r = spawnSync("npx", args, { cwd: root, stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
