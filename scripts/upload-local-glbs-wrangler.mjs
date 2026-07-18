/**
 * Upload local GLBs under artifacts/animator/public to R2 via wrangler CLI
 * (uses OAuth session — no R2 S3 keys required).
 *
 *   node scripts/upload-local-glbs-wrangler.mjs models/kenney/roads
 *   node scripts/upload-local-glbs-wrangler.mjs models/packs/low_poly_farm.glb
 *   node scripts/upload-local-glbs-wrangler.mjs models/worlds/island_life.glb
 *   node scripts/upload-local-glbs-wrangler.mjs models/kenney/roads --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "artifacts/animator/public");
const bucket = process.env.R2_BUCKET || "grudge-assets";
const dryRun = process.argv.includes("--dry-run");
// argv: node script.mjs <target> [--dry-run]
const target = process.argv.slice(2).find((a) => !a.startsWith("-"));

if (!target) {
  console.error("Usage: node scripts/upload-local-glbs-wrangler.mjs <rel under public/> [--dry-run]");
  process.exit(1);
}

const rel = target.replace(/^\/+/, "").replace(/\\/g, "/");
const localPath = path.join(publicRoot, rel);

function walkGlbs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const st = fs.statSync(dir);
  if (st.isFile() && dir.toLowerCase().endsWith(".glb")) {
    const r2Key = path.relative(publicRoot, dir).replace(/\\/g, "/");
    return [{ full: dir, r2Key }];
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkGlbs(full));
    else if (ent.name.toLowerCase().endsWith(".glb")) {
      out.push({ full, r2Key: path.relative(publicRoot, full).replace(/\\/g, "/") });
    }
  }
  return out;
}

if (!fs.existsSync(localPath)) {
  console.error("missing", localPath);
  process.exit(1);
}

const files = walkGlbs(localPath);
console.log(`[upload-wrangler] ${files.length} file(s) → r2://${bucket}/ dry=${dryRun}`);

let ok = 0,
  fail = 0;
for (const f of files) {
  const key = `${bucket}/${f.r2Key}`;
  console.log(`→ ${f.r2Key} (${(fs.statSync(f.full).size / 1e6).toFixed(2)} MB)`);
  if (dryRun) {
    ok++;
    continue;
  }
  const r = spawnSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      key,
      `--file=${f.full}`,
      "--content-type=model/gltf-binary",
      "--remote",
    ],
    { cwd: root, encoding: "utf8", shell: true, maxBuffer: 20 * 1024 * 1024 },
  );
  if (r.status === 0) {
    ok++;
    console.log("  ok");
  } else {
    fail++;
    console.error("  FAIL", r.stderr?.slice(-400) || r.stdout?.slice(-400));
  }
}

console.log(`[upload-wrangler] ok=${ok} fail=${fail}`);
process.exit(fail ? 1 : 0);
