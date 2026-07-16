/**
 * Ingest threejs-rapier Animator lab assets + missing source modules into Open.
 *
 * Canonical product: https://open.grudge-studio.com (gameopen)
 * Legacy source:     threejs-rapier-react-three-controller (do not ship features there)
 *
 * Usage (from gameopen root):
 *   node scripts/ingest-threejs-rapier.mjs
 *   node scripts/ingest-threejs-rapier.mjs --assets-only
 *   node scripts/ingest-threejs-rapier.mjs --code-only
 *   THREEJS_RAPIER_ROOT=D:/path/to/repo node scripts/ingest-threejs-rapier.mjs
 *
 * Never overwrites existing files unless FORCE_OVERWRITE=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const force = process.env.FORCE_OVERWRITE === "1";
const args = new Set(process.argv.slice(2));
const assetsOnly = args.has("--assets-only");
const codeOnly = args.has("--code-only");

const candidates = [
  process.env.THREEJS_RAPIER_ROOT,
  "F:/GitHub/threejs-rapier-react-three-controller/threejs-rapier-react-three-controller",
  "D:/GitHub/threejs-rapier-react-three-controller",
  path.join(root, "../threejs-rapier-react-three-controller"),
  path.join(root, "../threejs-rapier-react-three-controller/threejs-rapier-react-three-controller"),
  "C:/Users/nugye/Documents/threejs-rapier-react-three-controller",
].filter(Boolean);

function findSource() {
  for (const c of candidates) {
    const anim = path.join(c, "artifacts/animator");
    if (fs.existsSync(path.join(anim, "public")) && fs.existsSync(path.join(anim, "src"))) {
      return anim;
    }
    // monorepo root that nests the package
    const nested = path.join(c, "threejs-rapier-react-three-controller/artifacts/animator");
    if (fs.existsSync(path.join(nested, "public"))) return nested;
  }
  return null;
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

function copyMissing(srcDir, destDir, { label, filter } = {}) {
  let copied = 0;
  let skipped = 0;
  if (!fs.existsSync(srcDir)) {
    console.warn(`[ingest] skip missing source: ${srcDir}`);
    return { copied, skipped };
  }
  for (const rel of walk(srcDir)) {
    if (filter && !filter(rel)) continue;
    const from = path.join(srcDir, rel);
    const to = path.join(destDir, rel);
    if (fs.existsSync(to) && !force) {
      skipped++;
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
    if (process.env.VERBOSE === "1") console.log(`  + ${label || rel}: ${rel}`);
  }
  console.log(`[ingest] ${label || destDir}: copied=${copied} skipped=${skipped}`);
  return { copied, skipped };
}

const srcAnim = findSource();
if (!srcAnim) {
  console.error(
    "[ingest] threejs-rapier animator not found. Set THREEJS_RAPIER_ROOT to the monorepo (or nested package) root.",
  );
  process.exit(1);
}

console.log(`[ingest] source=${srcAnim}`);
console.log(`[ingest] dest=${path.join(root, "artifacts/animator")}`);

const openAnim = path.join(root, "artifacts/animator");
let totalCopied = 0;

if (!codeOnly) {
  // Full public tree (models, anim, audio, avatar, backdrops, ui, …)
  const r = copyMissing(path.join(srcAnim, "public"), path.join(openAnim, "public"), {
    label: "public",
  });
  totalCopied += r.copied;
}

if (!assetsOnly) {
  const codeTrees = [
    ["src/three", "three"],
    ["src/components", "components"],
    ["src/auth", "auth"],
    ["src/lib", "lib"],
    ["src/wallet", "wallet"],
    ["src/hud", "hud"],
    ["src/net", "net"],
    ["src/ai", "ai"],
    ["src/hooks", "hooks"],
  ];
  for (const [rel, label] of codeTrees) {
    const r = copyMissing(path.join(srcAnim, rel), path.join(openAnim, rel), {
      label,
      filter: (f) => /\.(ts|tsx|css)$/.test(f),
    });
    totalCopied += r.copied;
  }
}

console.log(`[ingest] done totalCopied=${totalCopied} force=${force}`);
console.log(
  "[ingest] next: pnpm build / npm run deploy:prod — smoke /login /danger /dressing /avatar /ledmask",
);
console.log(
  "[ingest] note: App.tsx is NOT auto-merged (Open owns GRUDOX/fleet modes). Wire new components manually.",
);
