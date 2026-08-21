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

function purgeAnimFbx(dir, label) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.toLowerCase().endsWith(".fbx")) {
        fs.unlinkSync(p);
        n++;
      }
    }
  };
  walk(dir);
  if (n) console.log(`[vercel-build] purged ${n} Mixamo FBX from ${label}`);
  return n;
}

// On Vercel only: strip Mixamo FBX before Vite copies public → dist.
// Never delete local author FBX on a developer machine.
if (process.env.VERCEL) {
  purgeAnimFbx(path.join(anim, "public", "anim"), "public/anim");
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

// 5. Purge failed / non-SSOT character packs so Danger Room cannot load them
const purge = [
  "models/grudge6/30characters.glb",
  "models/characters/30characters.glb",
];
for (const rel of purge) {
  const p = path.join(anim, "dist/public", rel);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log("[vercel-build] purged failed character asset:", rel);
  }
  const pub = path.join(anim, "public", rel);
  if (fs.existsSync(pub)) {
    fs.unlinkSync(pub);
    console.log("[vercel-build] purged public:", rel);
  }
}

purgeAnimFbx(path.join(anim, "dist", "public", "anim"), "dist/public/anim");

console.log("\n[vercel-build] OK →", out);
