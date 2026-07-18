/**
 * Production Vercel build: merge assets → install animator deps → Vite build.
 * Sets BASE_PATH=/ so the SPA serves at the domain root.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const anim = path.join(root, "artifacts/animator");

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    env: { ...process.env, ...opts.env },
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

// 1. Merge gameopen pack into animator public (idempotent)
run("node", ["scripts/merge-gameopen-assets.mjs"]);
run("node", ["scripts/fix-asset-aliases.mjs"]);
run("node", ["scripts/generate-asset-manifest.mjs"]);

// 2. Install animator deps (includes rapier for @workspace/grudge-physics source alias)
run("npm", ["install", "--no-fund", "--no-audit", "--legacy-peer-deps"], {
  cwd: anim,
});
// Fail fast if fleet physics dep missing (avoids opaque rollup resolve errors on Vercel)
const rapier = path.join(anim, "node_modules/@dimforge/rapier3d-compat/package.json");
if (!fs.existsSync(rapier)) {
  console.error("[vercel-build] missing @dimforge/rapier3d-compat after npm install");
  process.exit(1);
}

// 3. Polish index.html meta for production
const indexPath = path.join(anim, "index.html");
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");
  html = html
    .replace(/<title>[^<]*<\/title>/, "<title>Grudge Open — Combat Sandbox | Grudge Studio</title>")
    .replace(
      /content="Animator — built on Replit[^"]*"/g,
      'content="Grudge Open — Danger Room combat sandbox. Races, weapons, bosses, fleet auth."',
    )
    .replace(/content="Animator"/g, 'content="Grudge Open"');
  if (!html.includes("og:image")) {
    html = html.replace(
      "</head>",
      '    <meta property="og:image" content="/opengraph.jpg" />\n  </head>',
    );
  }
  fs.writeFileSync(indexPath, html);
  console.log("[vercel-build] index.html polished");
}

// 4. Vite production build at domain root
run("npm", ["run", "build"], {
  cwd: anim,
  env: {
    BASE_PATH: "/",
    NODE_ENV: "production",
    // Pass through Vercel-injected VITE_* vars
  },
});

const out = path.join(anim, "dist/public/index.html");
if (!fs.existsSync(out)) {
  console.error("Missing build output:", out);
  process.exit(1);
}
console.log("\n[vercel-build] OK →", out);
