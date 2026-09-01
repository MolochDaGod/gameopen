/**
 * Durable Open production deploy process.
 *
 * Order (fail-closed):
 *   1. Inventory unit tests (ledger / bag law — Postgres SSOT)
 *   2. Fleet SSOT gate (R2 binaries, SPA, uuid/ledger, D1 asset-registry, health)
 *   3. Optional CDN asset verify (--assets) — R2 HEADs + D1 index
 *   4. vercel deploy --prod --yes
 *   5. Post-deploy smoke (SPA + uuid + ledger + asset-registry + health)
 *
 * Data law (do not invert):
 *   Postgres (Railway) = characters, bag, wallet, grudge_uuid ledger
 *   D1                = asset / catalog INDEX only
 *   R2                = GLB/FBX/tex/audio binaries
 *   localStorage      = offline cache / drafts — never production bag SSOT
 *
 * Usage:
 *   node scripts/deploy-durable.mjs
 *   node scripts/deploy-durable.mjs --skip-tests
 *   node scripts/deploy-durable.mjs --assets
 *   node scripts/deploy-durable.mjs --dry-run   # gate + tests only
 *   npm run deploy:prod   # alias of this script
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipTests = args.includes("--skip-tests");
const withAssets = args.includes("--assets");
const dryRun = args.includes("--dry-run");

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n> ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || root,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });
  if ((r.status ?? 1) !== 0) {
    console.error(`[deploy-durable] FAIL step exit ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[deploy-durable] Open production durable pipeline");
console.log(`  root=${root}`);
console.log(`  dryRun=${dryRun} skipTests=${skipTests} assets=${withAssets}`);

// 1. Unit tests — ledger bag law
if (!skipTests) {
  run(
    "npm",
    [
      "--prefix",
      "artifacts/animator",
      "run",
      "test",
      "--",
      "src/game/inventory/characterBag.test.ts",
      "src/game/inventory/ledgerClient.test.ts",
    ],
    {},
  );
}

// 2. Pre-deploy fleet gate
run("node", ["scripts/open-deploy-gate.mjs"]);

// 3. Optional CDN inventory
if (withAssets) {
  run("node", ["scripts/verify-fleet-assets.mjs", "--cdn-only"]);
}

if (dryRun) {
  console.log("\n[deploy-durable] dry-run complete — not deploying");
  process.exit(0);
}

// 4. Ship
run("npx", ["vercel", "deploy", "--prod", "--yes", "--force"]);

// 5. Post smoke
run("node", ["scripts/smoke-prod.mjs", "--base", "https://open.grudge-studio.com"]);

console.log("\n[deploy-durable] DONE — open.grudge-studio.com");
process.exit(0);
