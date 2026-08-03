/**
 * Upload local files under artifacts/animator/public to R2 via wrangler OAuth.
 * Supports any extension (JSON baked anims, GLB, etc.).
 *
 *   node scripts/upload-local-files-wrangler.mjs anims/baked/sword_shield
 *   node scripts/upload-local-files-wrangler.mjs anims/baked/magic --ext=.json
 *   node scripts/upload-local-files-wrangler.mjs anims/baked --dry-run
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
const extArg = process.argv.find((a) => a.startsWith("--ext="));
const onlyExt = extArg ? extArg.slice("--ext=".length).toLowerCase() : null;
const target = process.argv.slice(2).find((a) => !a.startsWith("-"));

if (!target) {
  console.error(
    "Usage: node scripts/upload-local-files-wrangler.mjs <rel under public/> [--ext=.json] [--dry-run]",
  );
  process.exit(1);
}

const rel = target.replace(/^\/+/, "").replace(/\\/g, "/");
const localPath = path.join(publicRoot, rel);

function contentType(file) {
  const e = path.extname(file).toLowerCase();
  if (e === ".json") return "application/json";
  if (e === ".glb") return "model/gltf-binary";
  if (e === ".gltf") return "model/gltf+json";
  if (e === ".fbx") return "application/octet-stream";
  if (e === ".webp") return "image/webp";
  if (e === ".png") return "image/png";
  return "application/octet-stream";
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    const r2Key = path.relative(publicRoot, dir).replace(/\\/g, "/");
    if (onlyExt && !r2Key.toLowerCase().endsWith(onlyExt)) return out;
    return [{ full: dir, r2Key }];
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else {
      const r2Key = path.relative(publicRoot, full).replace(/\\/g, "/");
      if (onlyExt && !r2Key.toLowerCase().endsWith(onlyExt)) continue;
      // skip huge accidental files
      if (fs.statSync(full).size > 280 * 1024 * 1024) {
        console.warn("skip >280MiB", r2Key);
        continue;
      }
      out.push({ full, r2Key });
    }
  }
  return out;
}

if (!fs.existsSync(localPath)) {
  console.error("missing", localPath);
  process.exit(1);
}

const files = walk(localPath);
console.log(`[upload-files-wrangler] ${files.length} file(s) → r2://${bucket}/ dry=${dryRun}`);

let ok = 0;
let fail = 0;
for (const f of files) {
  const key = `${bucket}/${f.r2Key}`;
  const mb = fs.statSync(f.full).size / 1e6;
  console.log(`→ ${f.r2Key} (${mb.toFixed(2)} MB)`);
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
      `--content-type=${contentType(f.full)}`,
      "--remote",
    ],
    { cwd: root, encoding: "utf8", shell: true, maxBuffer: 20 * 1024 * 1024 },
  );
  if (r.status === 0) {
    ok++;
    console.log("  ok");
  } else {
    fail++;
    console.error("  FAIL", (r.stderr || r.stdout || "").slice(-300));
  }
}

console.log(`[upload-files-wrangler] ok=${ok} fail=${fail}`);
process.exit(fail ? 1 : 0);
