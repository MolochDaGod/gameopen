#!/usr/bin/env node
/**
 * Classify assets by purpose (maps, weapons, characters, NPCs, textures, …).
 *
 *   node scripts/asset-pipeline/classify.mjs [dir]
 *   node scripts/asset-pipeline/classify.mjs --json
 *   node scripts/asset-pipeline/classify.mjs --out reports/asset-purpose.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyAsset } from "./lib/purpose.mjs";
import { ANIMATOR_PUBLIC, GAMEOPEN_ROOT, ensureDir } from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const rootArg = args.find((a) => !a.startsWith("--") && a !== outPath);
const root = rootArg
  ? path.resolve(rootArg)
  : ANIMATOR_PUBLIC;

const files = walk(root).filter((f) =>
  /\.(glb|gltf|fbx|obj|blend|webp|png|jpg|jpeg|json)$/i.test(f),
);

const rows = files.map((rel) => {
  const c = classifyAsset(rel);
  return {
    path: rel,
    abs: path.join(root, rel),
    purpose: c.purpose,
    confidence: c.confidence,
    reasons: c.reasons,
    convert: c.pipeline?.convert !== false && /\.(glb|gltf|fbx|obj|blend)$/i.test(rel),
    ai: c.pipeline?.ai || null,
  };
});

const byPurpose = {};
for (const r of rows) {
  byPurpose[r.purpose] = (byPurpose[r.purpose] || 0) + 1;
}

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  root: path.relative(GAMEOPEN_ROOT, root).replace(/\\/g, "/") || ".",
  count: rows.length,
  byPurpose,
  assets: rows,
};

if (outPath) {
  ensureDir(path.dirname(path.resolve(outPath)));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`[classify] wrote ${outPath} (${rows.length} assets)`);
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`[classify] root=${report.root} n=${rows.length}`);
  console.log("byPurpose:", byPurpose);
  const sample = {};
  for (const r of rows) {
    if (!sample[r.purpose]) sample[r.purpose] = [];
    if (sample[r.purpose].length < 3) sample[r.purpose].push(r.path);
  }
  for (const [p, list] of Object.entries(sample)) {
    console.log(`  ${p}: ${list.join(", ")}`);
  }
}
