/**
 * Verify Danger Room map assets exist under artifacts/animator/public
 * and that danger-maps.json catalog is consistent.
 *
 * Usage:
 *   node scripts/verify-danger-maps.mjs
 *   node scripts/verify-danger-maps.mjs --prod
 *   node scripts/verify-danger-maps.mjs --base https://open.grudge-studio.com
 *
 * --prod HEAD-checks catalog + each local-bake map asset + health + wing on origin.
 * Tropical (~70MB) is expected SPA-miss unless on R2; reported as WARN not fail unless --strict-tropical.
 */
import { existsSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "artifacts/animator/public");
const catalogPath = join(publicRoot, "content/maps/danger-maps.json");

const args = process.argv.slice(2);
const prod = args.includes("--prod") || args.includes("--cdn");
const strictTropical = args.includes("--strict-tropical");
let base = "https://open.grudge-studio.com";
const bi = args.indexOf("--base");
if (bi >= 0 && args[bi + 1]) base = args[bi + 1].replace(/\/$/, "");

function mb(n) {
  return (n / (1024 * 1024)).toFixed(2);
}

async function head(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.status;
  } catch (e) {
    return `ERR:${e?.message || e}`;
  }
}

let failed = 0;
const rows = [];

if (!existsSync(catalogPath)) {
  console.error("MISSING catalog", catalogPath);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
console.log("catalog version", catalog.version, "maps", catalog.maps?.length);

for (const m of catalog.maps || []) {
  const assets = m.assets || [];
  if (!assets.length) {
    rows.push({ id: m.id, status: "ok", note: "no local assets (procedural)" });
    continue;
  }
  // CDN-only maps: optional on disk (loaded via assets.grudge-studio.com at runtime)
  if (m.bake === "cdn") {
    rows.push({
      id: m.id,
      status: "cdn",
      note: "R2/CDN at runtime — local optional",
      bake: m.bake,
      mode: m.defaultMode,
    });
    continue;
  }
  let allOk = true;
  const sizes = [];
  for (const a of assets) {
    const p = join(publicRoot, a.replace(/^\//, ""));
    if (!existsSync(p)) {
      allOk = false;
      failed++;
      rows.push({ id: m.id, status: "MISS", path: a });
    } else {
      sizes.push(mb(statSync(p).size) + "MB");
    }
  }
  if (allOk) {
    rows.push({
      id: m.id,
      status: "ok",
      bake: m.bake,
      mode: m.defaultMode,
      sizes: sizes.join(", "),
    });
  }
}

console.table(rows);
console.log(failed ? `FAILED ${failed} missing assets` : "ALL LOCAL MAP ASSETS PRESENT");

if (prod) {
  console.log("\n--- production HEAD", base, "---");
  const checks = [
    "/api/health",
    "/content/maps/danger-maps.json",
    "/models/equipment/wing_animated.glb",
  ];
  for (const m of catalog.maps || []) {
    if (m.bake === "cdn" || !m.assets?.length) continue;
    for (const a of m.assets) {
      checks.push("/" + a.replace(/^\//, ""));
    }
  }
  const prodRows = [];
  for (const path of checks) {
    const url = base + path;
    const status = await head(url);
    const isTropical = /tropical/i.test(path);
    const ok = status === 200;
    if (!ok) {
      if (isTropical && !strictTropical) {
        prodRows.push({ path, status, note: "WARN tropical — R2 preferred" });
      } else {
        failed++;
        prodRows.push({ path, status, note: "FAIL" });
      }
    } else {
      prodRows.push({ path, status, note: "ok" });
    }
  }
  console.table(prodRows);
}

process.exit(failed ? 1 : 0);
