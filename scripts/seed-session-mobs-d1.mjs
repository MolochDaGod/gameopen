#!/usr/bin/env node
/**
 * Seed session enemy pack into Cloudflare D1 `grudge-assets-db` (asset_registry)
 * and upload catalog JSON to R2.
 *
 * Usage (from gameopen):
 *   node scripts/seed-session-mobs-d1.mjs
 *   node scripts/seed-session-mobs-d1.mjs --dry-run
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEST = path.join(ROOT, "artifacts/animator/public/models/enemies/session");
const CATALOG = path.join(
  ROOT,
  "artifacts/animator/public/content/enemies/session-mobs.json",
);
const DRY = process.argv.includes("--dry-run");
const DB = process.env.D1_DATABASE_NAME || "grudge-assets-db";
const RTS = process.env.RTS_ROOT || "F:/GitHub/RTS-Grudge";
const CDN_DIR = process.env.CDN_WRANGLER_DIR || "F:/GitHub/GrudgeBuilder/workers/cdn";

function uuidFromKey(r2Key) {
  const hash = crypto.createHash("sha1").update(`grudge-asset:${r2Key}`).digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

function esc(s) {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

const ENTRIES = [
  { file: "blocker_broker.glb", name: "blocker_broker", height: 2.0, tags: ["enemy", "voxel", "elite", "session"] },
  { file: "hollow_knight_vengefly.glb", name: "hollow_knight_vengefly", height: 0.95, tags: ["enemy", "voxel", "flying", "session"] },
  { file: "mage_demon.glb", name: "mage_demon", height: 2.0, tags: ["enemy", "voxel", "magic", "session"] },
  { file: "lowpoly_rhino.glb", name: "lowpoly_rhino", height: 1.65, tags: ["enemy", "voxel", "beast", "session"] },
  { file: "violet_4_hn_creature.glb", name: "violet_4_hn_creature", height: 1.8, tags: ["enemy", "voxel", "creature", "session"] },
];

const now = Date.now();
const lines = [];

for (const e of ENTRIES) {
  const local = path.join(DEST, e.file);
  if (!fs.existsSync(local)) {
    console.error("missing", local);
    process.exit(1);
  }
  const r2Key = `models/enemies/session/${e.file}`;
  const id = r2Key.replace(/[^A-Za-z0-9]+/g, "_");
  const grudgeUuid = uuidFromKey(r2Key);
  const size = fs.statSync(local).size;
  const payload = JSON.stringify({
    grudgeUuid,
    metadata: {
      version: 1,
      sourceSet: "session-mobs",
      format: "glb",
      mimeType: "model/gltf-binary",
      recommendedTargetMeters: e.height,
      tags: e.tags,
      role: "enemy",
    },
    animationPacks: null,
  });
  lines.push(
    `INSERT INTO asset_registry (id, name, category, r2_key, bone_map, animation_packs, grudge_uuid, file_size, updated_at, created_at) VALUES (` +
      [
        esc(id),
        esc(e.name),
        esc("monster"),
        esc(r2Key),
        "NULL",
        esc(payload),
        esc(grudgeUuid),
        size,
        now,
        now,
      ].join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, r2_key=excluded.r2_key, animation_packs=excluded.animation_packs, grudge_uuid=excluded.grudge_uuid, file_size=excluded.file_size, updated_at=excluded.updated_at;`,
  );
  console.log("row", e.name, grudgeUuid, size);
}

if (fs.existsSync(CATALOG)) {
  const r2Key = "content/enemies/session-mobs.json";
  const id = r2Key.replace(/[^A-Za-z0-9]+/g, "_");
  const grudgeUuid = uuidFromKey(r2Key);
  const size = fs.statSync(CATALOG).size;
  const payload = JSON.stringify({
    grudgeUuid,
    metadata: { role: "enemy-catalog", sourceSet: "session-mobs" },
  });
  lines.push(
    `INSERT INTO asset_registry (id, name, category, r2_key, bone_map, animation_packs, grudge_uuid, file_size, updated_at, created_at) VALUES (` +
      [
        esc(id),
        esc("session-mobs"),
        esc("data"),
        esc(r2Key),
        "NULL",
        esc(payload),
        esc(grudgeUuid),
        size,
        now,
        now,
      ].join(", ") +
      `) ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, r2_key=excluded.r2_key, animation_packs=excluded.animation_packs, grudge_uuid=excluded.grudge_uuid, file_size=excluded.file_size, updated_at=excluded.updated_at;`,
  );

  // Upload catalog to R2
  if (!DRY) {
    const put = spawnSync(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `grudge-assets/${r2Key}`,
        `--file=${CATALOG}`,
        "--content-type=application/json",
        "--remote",
      ],
      { cwd: CDN_DIR, shell: true, stdio: "inherit" },
    );
    if (put.status !== 0) {
      console.warn("catalog R2 put failed (non-fatal for D1 seed)");
    }
  } else {
    console.log("[dry] would put", r2Key);
  }
}

const sqlPath = path.join(ROOT, "tmp/seed-session-mobs-d1.sql");
fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
fs.writeFileSync(sqlPath, lines.join("\n") + "\n", "utf8");
console.log("wrote", sqlPath, "stmts", lines.length);

if (DRY) {
  console.log("[dry] skip d1 execute");
  process.exit(0);
}

// Prefer RTS-Grudge asset-api wrangler.toml for DB binding
const wranglerDirs = [
  path.join(RTS, "workers/asset-api"),
  path.join(RTS),
  CDN_DIR,
].filter((d) => fs.existsSync(d));

let ok = false;
for (const cwd of wranglerDirs) {
  console.log("trying d1 execute from", cwd, "db=", DB);
  const r = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--remote", `--file=${sqlPath}`],
    { cwd, shell: true, stdio: "inherit" },
  );
  if (r.status === 0) {
    ok = true;
    break;
  }
}

if (!ok) {
  console.error("D1 seed failed from all wrangler dirs — SQL left at", sqlPath);
  process.exit(1);
}

console.log("D1 seed ok");
