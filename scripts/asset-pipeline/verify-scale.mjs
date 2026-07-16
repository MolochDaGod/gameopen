#!/usr/bin/env node
/**
 * Scale verification for GLB assets (meters, purpose-aware).
 *
 *   node scripts/asset-pipeline/verify-scale.mjs [file|dir]
 *   node scripts/asset-pipeline/verify-scale.mjs --purpose character path.glb
 *   node scripts/asset-pipeline/verify-scale.mjs --json --out reports/scale.json
 */
import fs from "node:fs";
import path from "node:path";
import { classifyAsset } from "./lib/purpose.mjs";
import { verifyFileScale } from "./lib/scale.mjs";
import { ANIMATOR_PUBLIC, ensureDir } from "./lib/paths.mjs";

function walkGlb(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkGlb(full));
    else if (/\.glb$/i.test(ent.name)) out.push(full);
  }
  return out;
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const purpIdx = args.indexOf("--purpose");
const forcePurpose = purpIdx >= 0 ? args[purpIdx + 1] : null;
const target = args.find(
  (a, i) =>
    !a.startsWith("--") &&
    a !== outPath &&
    a !== forcePurpose &&
    args[i - 1] !== "--out" &&
    args[i - 1] !== "--purpose",
);

const root = target ? path.resolve(target) : path.join(ANIMATOR_PUBLIC, "models");
const files = fs.existsSync(root) && fs.statSync(root).isFile()
  ? [root]
  : walkGlb(root);

const results = [];
let green = 0;
let yellow = 0;
let red = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  const purpose = forcePurpose || classifyAsset(rel).purpose;
  const v = verifyFileScale(file, purpose);
  if (v.score === "green") green++;
  else if (v.score === "yellow") yellow++;
  else red++;
  results.push({
    file: rel,
    purpose,
    score: v.score,
    size: v.size || v.info?.size || null,
    checks: v.checks,
    clips: v.info?.clipNames?.slice(0, 12) || [],
    skins: v.info?.skinCount ?? 0,
    anims: v.info?.animCount ?? 0,
  });
  if (!asJson) {
    const mark = v.score === "green" ? "OK " : v.score === "yellow" ? "WRN" : "BAD";
    console.log(`${mark} [${purpose}] ${rel}`);
    for (const c of v.checks) {
      console.log(`     ${c.level}: ${c.code} — ${c.msg}`);
    }
  }
}

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  root: path.relative(process.cwd(), root).replace(/\\/g, "/"),
  counts: { green, yellow, red, total: results.length },
  results,
};

if (outPath) {
  ensureDir(path.dirname(path.resolve(outPath)));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`[verify-scale] wrote ${outPath}`);
}

if (asJson) console.log(JSON.stringify(report, null, 2));
else {
  console.log(
    `[verify-scale] total=${results.length} green=${green} yellow=${yellow} red=${red}`,
  );
}

process.exit(red > 0 ? 1 : 0);
