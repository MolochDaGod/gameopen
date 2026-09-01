/**
 * Smoke live game stacks listed in content/worlds/open-game-library.json
 * + Open SPA library + PWA assets.
 *
 *   node scripts/library-stack-smoke.mjs
 *   node scripts/library-stack-smoke.mjs --base https://open.grudge-studio.com
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
  "https://open.grudge-studio.com";

const catalogPath = path.join(root, "content/worlds/open-game-library.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

let failed = 0;
function pass(msg) {
  console.log("OK  ", msg);
}
function fail(msg) {
  console.error("FAIL", msg);
  failed += 1;
}

async function head(url, opts = {}) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "Cache-Control": "no-cache" },
    });
    const ct = res.headers.get("content-type") || "";
    return { ok: res.ok, status: res.status, ct, url };
  } catch (e) {
    return { ok: false, status: 0, ct: "", url, err: String(e) };
  }
}

console.log(`[library-stack-smoke] base=${base}`);
console.log(`[library-stack-smoke] catalog v${catalog.version}`);

// Open shell
for (const p of [
  "/",
  "/?door=library",
  "/manifest.webmanifest",
  "/sw.js",
  "/pwa-192.png",
  "/pwa-512.png",
  "/rooms/gst-islands-scene.jpg",
  "/rooms/library-danger-scene.png",
  "/api/health",
]) {
  const r = await head(base.replace(/\/$/, "") + p);
  if (!r.ok && !(p === "/api/health" && r.status === 200)) {
    if (p.startsWith("/api/") && [401, 403].includes(r.status)) {
      pass(`${p} ${r.status} (auth-gated OK)`);
    } else if (!r.ok) fail(`${p} → ${r.status} ${r.err || r.ct}`);
    else pass(`${p} ${r.status}`);
  } else pass(`${p} ${r.status}`);
}

// Shared account scheme hosts
for (const [name, url] of Object.entries({
  auth: catalog.sharedAccountScheme.authHost + "/login",
  playerApi:
    catalog.sharedAccountScheme.playerApi.replace(/\/$/, "") + "/api/health",
  cdn: catalog.sharedAccountScheme.assetsCdn + "/models/grudge6/races/WK_Characters.glb",
})) {
  const r = await head(url);
  if (name === "cdn") {
    if (r.ok && !r.ct.includes("text/html")) pass(`CDN ${name} ${r.status}`);
    else fail(`CDN ${name} ${r.status} ${r.ct}`);
  } else if (r.ok || [401, 403].includes(r.status)) {
    pass(`${name} ${r.status}`);
  } else fail(`${name} ${r.status}`);
}

// Each cataloged external game
for (const g of catalog.games) {
  if (!g.url) {
    pass(`${g.id} native/no-url`);
    continue;
  }
  const r = await head(g.url);
  // Some SPAs return 200 only on exact path
  if (r.ok || r.status === 200) pass(`game ${g.id} ${r.status} ${g.url}`);
  else if ([301, 302, 307, 308].includes(r.status))
    pass(`game ${g.id} redirect ${r.status}`);
  else fail(`game ${g.id} ${r.status} ${g.url}`);
}

// Stack rules
for (const g of catalog.games) {
  if (g.id === "mine-loader-realms" && !g.stack?.singleReplica) {
    fail("mine-loader-realms missing singleReplica");
  }
  if (g.stack?.server === "railway" && !g.sso && g.id !== "grudox-games") {
    // soft: warn multiplayer without sso flag
  }
}

if (failed) {
  console.error(`\n[library-stack-smoke] FAILED (${failed})`);
  process.exit(1);
}
console.log("\n[library-stack-smoke] PASS");
