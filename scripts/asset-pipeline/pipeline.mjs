#!/usr/bin/env node
/**
 * Full asset production pipeline for Open / Danger Room / AI combat.
 *
 *   node scripts/asset-pipeline/pipeline.mjs [dir]
 *   node scripts/asset-pipeline/pipeline.mjs --report-only
 *   node scripts/asset-pipeline/pipeline.mjs --convert-red   # only re-bake fails (needs grudge-convert)
 *
 * Stages:
 *   1. Classify every model/texture under public/
 *   2. Verify scale + AI clip readiness on GLBs
 *   3. Emit production registry + convert recipe sheet
 *   4. Optional: convert reds with purpose flags + Draco last
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyAsset } from "./lib/purpose.mjs";
import { verifyFileScale } from "./lib/scale.mjs";
import { convertFlagsForPurpose, namedPipelineForFile } from "./lib/purpose.mjs";
import {
  ANIMATOR_PUBLIC,
  GAMEOPEN_ROOT,
  PIPELINE_OUT,
  ensureDir,
  findGrudgeConvert,
} from "./lib/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, base));
    else out.push({ rel: path.relative(base, full).replace(/\\/g, "/"), abs: full });
  }
  return out;
}

const args = process.argv.slice(2);
const reportOnly = args.includes("--report-only");
const convertRed = args.includes("--convert-red");
const rootArg = args.find((a) => !a.startsWith("--"));
const root = rootArg ? path.resolve(rootArg) : ANIMATOR_PUBLIC;

const all = walk(root);
const models = all.filter((f) => /\.(glb|gltf|fbx|obj)$/i.test(f.rel));
const textures = all.filter((f) => /\.(webp|png|jpg|jpeg|ktx2)$/i.test(f.rel));

const classified = [];
const byPurpose = {};

for (const f of models) {
  const c = classifyAsset(f.rel);
  byPurpose[c.purpose] = (byPurpose[c.purpose] || 0) + 1;
  let verify = null;
  if (/\.glb$/i.test(f.rel)) {
    verify = verifyFileScale(f.abs, c.purpose);
  }
  const flags = convertFlagsForPurpose(c.purpose);
  classified.push({
    path: f.rel,
    abs: f.abs,
    purpose: c.purpose,
    confidence: c.confidence,
    reasons: c.reasons,
    ai: c.pipeline?.ai || null,
    verify: verify
      ? {
          score: verify.score,
          size: verify.size || verify.info?.size,
          checks: verify.checks,
          clips: verify.info?.clipNames?.slice(0, 20),
          skins: verify.info?.skinCount,
          anims: verify.info?.animCount,
        }
      : null,
    convertRecipe: flags.skip
      ? null
      : {
          pipeline: namedPipelineForFile(f.rel),
          flags: flags.flags,
          note: "Run scale bake before Draco; --draco is last flag",
        },
  });
}

const textureClassified = textures.map((f) => ({
  path: f.rel,
  purpose: classifyAsset(f.rel).purpose,
}));

// AI game-flow registry: which assets feed brains / loadouts
const aiRegistry = {
  characters: classified.filter((c) => c.purpose === "character"),
  npcs: classified.filter((c) => c.purpose === "npc"),
  weapons: classified.filter((c) => c.purpose === "weapon"),
  maps: classified.filter((c) => c.purpose === "map"),
  animBanks: classified.filter((c) => c.purpose === "animation"),
  redScale: classified.filter((c) => c.verify?.score === "red"),
  yellowScale: classified.filter((c) => c.verify?.score === "yellow"),
  missingAiClips: classified.filter((c) =>
    c.verify?.checks?.some((x) => x.code === "AI_CLIPS" || x.code === "NO_ANIMS"),
  ),
};

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  root: path.relative(GAMEOPEN_ROOT, root).replace(/\\/g, "/") || ".",
  summary: {
    models: models.length,
    textures: textures.length,
    byPurpose,
    scale: {
      green: classified.filter((c) => c.verify?.score === "green").length,
      yellow: aiRegistry.yellowScale.length,
      red: aiRegistry.redScale.length,
      unscored: classified.filter((c) => !c.verify).length,
    },
  },
  /** Import map for loaders / content */
  importers: {
    models: "artifacts/animator/src/three/loaders/gltf.ts (Draco + Meshopt + KTX2)",
    fbxRuntime: "avoid for production heroes — bake to GLB first",
    textures: "flipY=false for grudge6 atlases; sRGB colorSpace",
    convertCli: "ObjectStore tools/grudge-convert (npm run convert from ObjectStore)",
    orchestrator: "gameopen scripts/asset-pipeline/convert.mjs",
  },
  /** Best-practice order */
  processOrder: [
    "1. Identify purpose (classify)",
    "2. DCC cleanup / skeleton / clip names (Blender MCP if needed)",
    "3. Convert with purpose flags: --cm-to-m --height (heroes) — bake scale into meshes",
    "4. Verify scale + hand bones + AI clip roles (green/yellow/red)",
    "5. Draco / meshopt LAST — only after scale + anim integrity",
    "6. Register CDN path + content JSON + weapon/AI roles",
    "7. Smoke: Danger Room load + AI hostile equip + player hand mount",
  ],
  aiGameFlow: {
    note: "FighterBrain uses weaponRole + anim packs; assets must match contracts",
    characterNeeds: ["skinned rig", "idle/walk/run/attack clips", "hand sockets"],
    npcNeeds: ["attack + hurt + death", "aggro range from WEAPON_COMBAT"],
    weaponNeeds: ["hand-scale mesh", "tip/muzzle extras optional", "not height-normalized"],
    mapNeeds: ["grounded y=0", "navmesh or walkable collider"],
  },
  assets: classified,
  textures: textureClassified,
  aiRegistry: {
    redScale: aiRegistry.redScale.map((c) => c.path),
    yellowScale: aiRegistry.yellowScale.map((c) => c.path),
    missingAiClips: aiRegistry.missingAiClips.map((c) => c.path),
    weaponCount: aiRegistry.weapons.length,
    characterCount: aiRegistry.characters.length,
    mapCount: aiRegistry.maps.length,
  },
};

const reportDir = path.join(GAMEOPEN_ROOT, "reports");
ensureDir(reportDir);
const reportPath = path.join(reportDir, "asset-pipeline-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Human-readable recipe sheet
const recipeLines = [
  "# Asset convert recipes (purpose-aware)",
  `# generated ${report.generatedAt}`,
  "",
  "## Process",
  ...report.processOrder.map((l) => `- ${l}`),
  "",
  "## Scale summary",
  JSON.stringify(report.summary.scale, null, 2),
  "",
  "## By purpose",
  JSON.stringify(byPurpose, null, 2),
  "",
  "## Convert recipes (GLB/FBX)",
];
for (const c of classified) {
  if (!c.convertRecipe) continue;
  const outName = path.basename(c.path).replace(/\.(fbx|obj|gltf|glb)$/i, ".glb");
  recipeLines.push(
    "",
    `### ${c.path}`,
    `- purpose: **${c.purpose}** (confidence ${c.confidence})`,
    `- verify: ${c.verify?.score || "n/a"}`,
    `- command:`,
    "```",
    `node scripts/asset-pipeline/convert.mjs ${c.path} -o dist/production-assets/${c.purpose}/${outName} --purpose ${c.purpose}`,
    "```",
    `- flags: \`${c.convertRecipe.flags.join(" ")}\``,
  );
}
const recipePath = path.join(reportDir, "asset-convert-recipes.md");
fs.writeFileSync(recipePath, recipeLines.join("\n"));

console.log(`[pipeline] models=${models.length} textures=${textures.length}`);
console.log(`[pipeline] byPurpose`, byPurpose);
console.log(`[pipeline] scale`, report.summary.scale);
console.log(`[pipeline] report → ${path.relative(GAMEOPEN_ROOT, reportPath)}`);
console.log(`[pipeline] recipes → ${path.relative(GAMEOPEN_ROOT, recipePath)}`);

if (convertRed && !reportOnly) {
  const bin = findGrudgeConvert();
  if (!bin) {
    console.error("[pipeline] --convert-red needs grudge-convert (ObjectStore)");
    process.exit(2);
  }
  ensureDir(PIPELINE_OUT);
  for (const c of aiRegistry.redScale) {
    if (!/\.glb$/i.test(c.path)) continue;
    const outDir = path.join(PIPELINE_OUT, c.purpose);
    ensureDir(outDir);
    const out = path.join(outDir, path.basename(c.path));
    console.log(`[pipeline] re-bake RED ${c.path}`);
    const r = spawnSync(
      process.execPath,
      [
        path.join(__dirname, "convert.mjs"),
        c.abs,
        "-o",
        out,
        "--purpose",
        c.purpose,
      ],
      { stdio: "inherit" },
    );
    if (r.status !== 0) console.warn(`  failed ${c.path}`);
  }
}

process.exit(aiRegistry.redScale.length && !reportOnly ? 1 : 0);
