#!/usr/bin/env node
/**
 * Production convert orchestrator.
 *
 * Order (best practice):
 *   1. classify purpose
 *   2. (optional) pre-verify raw scale
 *   3. grudge-convert with purpose flags (scale → mesh/anim → texture → quantize)
 *   4. --draco LAST
 *   5. post-verify scale + AI clip contract
 *
 *   node scripts/asset-pipeline/convert.mjs <input> -o <out.glb>
 *   node scripts/asset-pipeline/convert.mjs <input> -o <out.glb> --purpose character
 *   node scripts/asset-pipeline/convert.mjs batch <dir> -o <outDir>
 *   node scripts/asset-pipeline/convert.mjs doctor
 *   node scripts/asset-pipeline/convert.mjs --dry-run <input> -o <out.glb>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  classifyAsset,
  convertFlagsForPurpose,
  namedPipelineForFile,
} from "./lib/purpose.mjs";
import { verifyFileScale } from "./lib/scale.mjs";
import { findGrudgeConvert, ensureDir, PIPELINE_OUT } from "./lib/paths.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  if (name.startsWith("--") && (i + 1 >= process.argv.length || process.argv[i + 1].startsWith("-"))) {
    return true;
  }
  return process.argv[i + 1] ?? fallback;
}

function has(flag) {
  return process.argv.includes(flag);
}

function runConvert(convertBin, argv, dry) {
  console.log(`[convert] ${dry ? "DRY " : ""}${convertBin} ${argv.join(" ")}`);
  if (dry) return { status: 0 };
  const r = spawnSync(process.execPath, [convertBin, ...argv], {
    stdio: "inherit",
    env: process.env,
  });
  return r;
}

function convertOne(input, output, opts) {
  const convertBin = findGrudgeConvert();
  if (!convertBin) {
    console.error(
      "[convert] grudge-convert not found. Set GRUDGE_CONVERT or install ObjectStore/tools/grudge-convert",
    );
    process.exit(2);
  }

  const rel = input.replace(/\\/g, "/");
  const classified = classifyAsset(rel);
  const purpose = opts.purpose || classified.purpose;
  const { skip, flags, reason, pipeline } = convertFlagsForPurpose(purpose, {
    texture: opts.texture,
    forceCm: opts.cm,
    draco: opts.draco !== false,
  });

  if (skip) {
    console.warn(`[convert] skip ${input}: ${reason}`);
    return { ok: false, skipped: true };
  }

  ensureDir(path.dirname(output));
  const named = namedPipelineForFile(input);
  // Build argv: pipeline input -o output ...flags
  // Ensure --draco is last among compression flags (convertFlags already ends with --draco)
  const argv = [named, path.resolve(input), "-o", path.resolve(output), ...flags];

  console.log(`[convert] purpose=${purpose} (${pipeline?.label || "?"}) confidence=${classified.confidence}`);
  console.log(`[convert] flags: ${flags.join(" ") || "(defaults)"}`);

  const r = runConvert(convertBin, argv, opts.dry);
  if (r.status !== 0 && !opts.dry) {
    console.error(`[convert] failed status=${r.status}`);
    return { ok: false };
  }

  if (!opts.dry && fs.existsSync(output)) {
    const v = verifyFileScale(output, purpose);
    console.log(`[convert] post-verify score=${v.score}`);
    for (const c of v.checks) {
      console.log(`  ${c.level}: ${c.msg}`);
    }
    // Write sidecar purpose manifest
    const manPath = output.replace(/\.glb$/i, ".purpose.json");
    fs.writeFileSync(
      manPath,
      JSON.stringify(
        {
          purpose,
          classified,
          flags,
          verify: { score: v.score, checks: v.checks, size: v.size },
          ai: pipeline?.ai || null,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return { ok: v.score !== "red", score: v.score, purpose };
  }

  return { ok: true, dry: opts.dry, purpose };
}

function main() {
  if (has("doctor") || process.argv[2] === "doctor") {
    const bin = findGrudgeConvert();
    if (!bin) {
      console.error("grudge-convert: MISSING");
      process.exit(1);
    }
    console.log(`grudge-convert: ${bin}`);
    const r = spawnSync(process.execPath, [bin, "doctor"], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }

  const dry = has("--dry-run");
  const purpose = arg("--purpose");
  const texture = arg("--texture");
  const batch = process.argv[2] === "batch";
  const out = arg("-o") || arg("--out");

  if (batch) {
    const inDir = process.argv[3];
    if (!inDir || !out) {
      console.error("Usage: convert.mjs batch <inDir> -o <outDir> [--purpose x] [--dry-run]");
      process.exit(1);
    }
    ensureDir(out);
    const files = fs
      .readdirSync(inDir)
      .filter((f) => /\.(glb|gltf|fbx|obj|blend)$/i.test(f));
    let ok = 0;
    let fail = 0;
    for (const f of files) {
      const input = path.join(inDir, f);
      const base = path.basename(f, path.extname(f));
      const output = path.join(out, `${base}.glb`);
      const r = convertOne(input, output, { purpose, texture, dry, draco: !has("--no-draco") });
      if (r.ok || r.skipped) ok++;
      else fail++;
    }
    console.log(`[convert] batch done ok=${ok} fail=${fail}`);
    process.exit(fail ? 1 : 0);
  }

  // Single file: convert.mjs <input> -o <output>
  const input = process.argv.find(
    (a, i) =>
      i >= 2 &&
      !a.startsWith("-") &&
      a !== "batch" &&
      a !== "doctor" &&
      a !== purpose &&
      a !== texture &&
      a !== out,
  );
  if (!input || !out) {
    console.error(`Usage:
  node scripts/asset-pipeline/convert.mjs <input> -o <out.glb> [--purpose character] [--dry-run] [--no-draco]
  node scripts/asset-pipeline/convert.mjs batch <inDir> -o <outDir>
  node scripts/asset-pipeline/convert.mjs doctor`);
    process.exit(1);
  }

  const r = convertOne(input, out, {
    purpose,
    texture,
    dry,
    draco: !has("--no-draco"),
  });
  process.exit(r.ok ? 0 : 1);
}

main();
