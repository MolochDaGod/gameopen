/**
 * Copy last-30 Documents GLBs into artifacts/animator/public per catalog r2Keys.
 * Skips files already present. Does not copy multipart giants by default
 * (set STAGE_ALL=1 to include mb > maxMb).
 *
 *   node scripts/stage-voxel-last30.mjs
 *   node scripts/stage-voxel-last30.mjs --max-mb=80
 *   STAGE_ALL=1 node scripts/stage-voxel-last30.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "content/worlds/voxel-last30-catalog.json");
const publicRoot = path.join(root, "artifacts/animator/public");
const stageAll = process.env.STAGE_ALL === "1" || process.argv.includes("--all");
const maxMbArg = process.argv.find((a) => a.startsWith("--max-mb="));
const maxMb = maxMbArg ? Number(maxMbArg.split("=")[1]) : 90;

const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const srcRoot = cat.sourceRoot || path.join(process.env.USERPROFILE || "", "Documents");

let copied = 0,
  skipped = 0,
  missing = 0,
  deferred = 0;

for (const a of cat.assets || []) {
  const dest = path.join(publicRoot, a.r2Key);
  const src = path.join(srcRoot, a.src);
  const mb = Number(a.mb) || 0;

  if (!stageAll && (a.upload === "multipart" || mb > maxMb)) {
    if (fs.existsSync(dest)) {
      skipped++;
      console.log(`skip-exist (large) ${a.id}`);
      continue;
    }
    deferred++;
    console.log(`defer multipart/large ${a.id} (${mb} MB) — register D1 only`);
    continue;
  }

  if (fs.existsSync(dest)) {
    skipped++;
    console.log(`exists ${a.r2Key}`);
    continue;
  }
  if (!fs.existsSync(src)) {
    // try alternate: already staged under other public path
    missing++;
    console.warn(`MISSING src ${src}`);
    continue;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
  console.log(`copy ${a.src} → ${a.r2Key} (${mb} MB)`);
}

console.log(
  `[stage-voxel-last30] copied=${copied} skipped=${skipped} deferred=${deferred} missing=${missing}`,
);
