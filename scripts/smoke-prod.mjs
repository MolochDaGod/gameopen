/**
 * Production smoke probes for Grudge Open / annihilate-demo.
 *
 * Usage:
 *   node scripts/smoke-prod.mjs
 *   node scripts/smoke-prod.mjs --base https://open.grudge-studio.com
 *   node scripts/smoke-prod.mjs --base https://grudge-studio.com
 *
 * Exit 0 only if all critical checks pass.
 */
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || process.env.SMOKE_BASE || "https://open.grudge-studio.com";
const CDN = "https://assets.grudge-studio.com";

const results = [];

async function probe(name, url, opts = {}) {
  const critical = opts.critical !== false;
  const expect = opts.expect || "ok"; // ok | html | jsonish | any
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      redirect: "follow",
      headers: opts.headers || { Accept: "*/*" },
      signal: AbortSignal.timeout(opts.timeoutMs || 20000),
    });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const status = res.status;
    let bodyStart = "";
    if (expect === "html" || expect === "jsonish" || opts.sample) {
      const text = await res.text();
      bodyStart = text.slice(0, 200);
    } else {
      // drain
      await res.arrayBuffer().catch(() => null);
    }

    let ok = status >= 200 && status < 400;
    let detail = `${status} ${ct || "no-ct"}`;

    if (expect === "html") {
      const isHtml = ct.includes("text/html") || bodyStart.includes("<!DOCTYPE") || bodyStart.includes("<html");
      ok = ok && isHtml;
      if (!isHtml) detail += " (expected HTML SPA)";
    }
    if (expect === "jsonish") {
      // API must NOT be SPA index.html
      const isSpa = bodyStart.includes("<!DOCTYPE html") || bodyStart.includes('<div id="root"');
      const looksJson =
        ct.includes("json") || bodyStart.trim().startsWith("{") || bodyStart.trim().startsWith("[");
      // 401/403 with empty body is OK for unauthenticated characters
      ok = status === 200 || status === 401 || status === 403 || status === 204;
      if (isSpa) {
        ok = false;
        detail += " (got SPA HTML — rewrite broken)";
      } else if (status === 200 && !looksJson && bodyStart.length > 0) {
        detail += " (non-json body ok if empty/text)";
      }
    }
    if (expect === "asset") {
      ok = status === 200;
      if (ct.includes("text/html")) {
        ok = false;
        detail += " (HTML fake asset)";
      }
    }

    results.push({ name, url, ok, critical, detail });
    const mark = ok ? "PASS" : critical ? "FAIL" : "WARN";
    console.log(`[${mark}] ${name}: ${detail}\n       ${url}`);
    return ok;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, url, ok: false, critical, detail: msg });
    console.log(`[${critical ? "FAIL" : "WARN"}] ${name}: ${msg}\n       ${url}`);
    return false;
  }
}

console.log(`\n=== Grudge Open smoke · base=${BASE} ===\n`);

// SPA shells
await probe("open-home", `${BASE}/`, { expect: "html" });
await probe("danger", `${BASE}/danger`, { expect: "html" });
await probe("characters-campfire", `${BASE}/characters`, { expect: "html" });
await probe("lobby-campfire", `${BASE}/lobby`, { expect: "html" });
await probe("annihilate-demo", `${BASE}/annihilate-demo`, { expect: "html" });
await probe(
  "annihilate-hero",
  `${BASE}/annihilate-demo?hero=elf_worge`,
  { expect: "html" },
);

// Same-origin API (must not return SPA HTML) — Railway DB proxies
await probe("api-characters", `${BASE}/api/characters`, {
  expect: "jsonish",
  sample: true,
});
await probe("api-characters-warlords", `${BASE}/api/characters?era=warlords`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
await probe("api-account", `${BASE}/api/account`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
await probe("api-content-skills", `${BASE}/api/content/skills`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
await probe("api-content-weapons", `${BASE}/api/content/weapons`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
// D1 asset INDEX (not player bag). Must not SPA-masquerade.
await probe("api-asset-registry", `${BASE}/api/asset-registry?limit=3`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("api-health", `${BASE}/api/health`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("api-healthz", `${BASE}/api/healthz`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
// Phase 1 identity: UUID mint system + ledger (must not SPA-masquerade)
await probe("api-uuid-test", `${BASE}/api/uuid/test`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("api-ledger-search", `${BASE}/api/ledger/search`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
// Definitions SSOT — R2 CDN + ObjectStore Worker (info.pages may 404)
await probe("cdn-weapons", `${CDN}/api/v1/weapons.json`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("cdn-gear-presets", `${CDN}/api/v1/grudge6-gear-presets.json`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("objectstore-discovery", "https://objectstore.grudge-studio.com/api/v1", {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("objectstore-assets-list", "https://objectstore.grudge-studio.com/v1/assets?limit=5", {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("objectstore-weapons", "https://objectstore.grudge-studio.com/api/v1/weapons.json", {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("gh-master-weaponSkills", "https://molochdagod.github.io/ObjectStore/api/v1/master-weaponSkills.json", {
  expect: "jsonish",
  sample: true,
  critical: true,
});
// info Pages — optional until host recovers
await probe("info-weapons-optional", "https://info.grudge-studio.com/api/v1/weapons.json", {
  expect: "jsonish",
  sample: true,
  critical: false,
});
await probe("open-objectstore-proxy-skills", `${BASE}/api/objectstore/v1/master-weaponSkills.json`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("open-objectstore-proxy-weapons", `${BASE}/api/objectstore/v1/weapons.json`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("open-api-v1-weapons", `${BASE}/api/v1/weapons.json`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("api-characters-voxel", `${BASE}/api/characters?era=voxel`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
await probe("realms-route", `${BASE}/realms`, {
  expect: "html",
  critical: false,
});

// CDN grudge6 kits (production meshes) — complete game pack
const RACE_GLB = ["WK", "BRB", "ELF", "DWF", "ORC", "UD"];
for (const p of RACE_GLB) {
  await probe(
    `cdn-${p}-glb`,
    `${CDN}/models/grudge6/races/${p}_Characters.glb`,
    { expect: "asset", critical: true },
  );
}
await probe("cdn-elf-kit-fbx", `${CDN}/models/grudge6/races/ELF_Characters.fbx`, {
  expect: "asset",
  critical: false,
});
await probe("cdn-wk-kit-fbx", `${CDN}/models/grudge6/races/WK_Characters.fbx`, {
  expect: "asset",
  critical: false,
});
await probe(
  "cdn-elf-atlas",
  `${CDN}/textures/grudge6/elves/ELF_HighElves_Texture.webp`,
  { expect: "asset", critical: false },
);
await probe("cdn-human-icon", `${CDN}/icons/pack/races/human.png`, {
  expect: "asset",
  critical: false,
});
await probe("cdn-warrior-icon", `${CDN}/icons/pack/classes/warrior.png`, {
  expect: "asset",
  critical: false,
});
await probe("cdn-racalvin", `${CDN}/models/racalvin.glb`, {
  expect: "asset",
  critical: false,
});
await probe("cdn-dying-torch", `${CDN}/models/props/dying-torch.glb`, {
  expect: "asset",
  critical: false,
});
await probe("cdn-claim-flag", `${CDN}/models/camp/claim-flag.glb`, {
  expect: "asset",
  critical: false,
});

// Campfire TVS farm props (R2 CDN law — Vercel SPA never ships these .glb)
const TVS_CRITICAL = ["campfire.glb", "chair.glb", "fence.glb", "tree.glb"];
for (const f of TVS_CRITICAL) {
  await probe(
    `cdn-campfire-tvs-${f.replace(".glb", "")}`,
    `${CDN}/models/campfire-lobby/tvs/${f}`,
    { expect: "asset", critical: true },
  );
}
await probe("cdn-campfire-tvs-barn", `${CDN}/models/campfire-lobby/tvs/barn.glb`, {
  expect: "asset",
  critical: false,
});
await probe(
  "cdn-tvs-farm-haybale-tex",
  `${CDN}/models/voxels/tvs/voxel-farm/textures/voxel-farm-haybale-texture.png`,
  { expect: "asset", critical: false },
);
await probe(
  "cdn-tvs-farm-fence-tex",
  `${CDN}/models/voxels/tvs/voxel-farm/textures/voxel-farm-fence-texture.png`,
  { expect: "asset", critical: false },
);
await probe(
  "cdn-encament-fruzer",
  `${CDN}/models/lobby/chicken_gun_fruzer_encampment.glb`,
  { expect: "asset", critical: true },
);

// AI hub — health public; same-origin rewrite must not SPA-masquerade
await probe("api-ai-health", `${BASE}/api/ai/health`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("ai-hub-health", "https://ai.grudge-studio.com/health", {
  expect: "jsonish",
  sample: true,
  critical: true,
});

// Same-origin Open game pack (must ship with SPA)
await probe("open-wk-arena-glb", `${BASE}/cdn/assets/characters/human/WK_Characters.glb`, {
  expect: "asset",
  critical: true,
});
await probe("open-sword-shield-idle", `${BASE}/anims/baked/sword_shield/sword%20and%20shield%20idle.json`, {
  expect: "asset",
  critical: true,
});
await probe("open-polearm-idle", `${BASE}/anims/baked/polearm/idle.json`, {
  expect: "asset",
  critical: false,
});
await probe("open-gear-presets", `${BASE}/content/grudge6-gear-presets.json`, {
  expect: "jsonish",
  sample: true,
  critical: true,
});
await probe("open-class-skill-bridges", `${BASE}/content/class-skill-bridges.json`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
// Combat VFX live on R2 (same-origin may omit large VFX pack — loaders CDN-first)
await probe("cdn-vfx-slashes", `${CDN}/models/vfx/attack-slashes.glb`, {
  expect: "asset",
  critical: true,
});
await probe("cdn-vfx-target-ring", `${CDN}/models/vfx/target-ring.glb`, {
  expect: "asset",
  critical: true,
});
await probe("cdn-vfx-ice-bow", `${CDN}/models/vfx/stylized_ice_bow.glb`, {
  expect: "asset",
  critical: false,
});
await probe("open-vfx-slashes", `${BASE}/models/vfx/attack-slashes.glb`, {
  expect: "asset",
  critical: false,
});
await probe("open-human-warrior-hero", `${BASE}/annihilate-demo?hero=human_warrior`, {
  expect: "html",
  critical: true,
});

// Optional portal host when BASE is open.*
if (!BASE.includes("grudge-studio.com") || BASE.includes("open.")) {
  await probe(
    "portal-annihilate",
    "https://grudge-studio.com/annihilate-demo?hero=elf_worge",
    { expect: "html", critical: false },
  );
}

const failed = results.filter((r) => !r.ok && r.critical);
const warned = results.filter((r) => !r.ok && !r.critical);

console.log("\n=== Summary ===");
console.log(
  `passed ${results.filter((r) => r.ok).length}/${results.length} · critical fails ${failed.length} · warns ${warned.length}`,
);

if (failed.length) {
  console.error("\nCritical failures:");
  for (const f of failed) console.error(` - ${f.name}: ${f.detail}`);
  process.exit(1);
}

console.log("\nSmoke OK (critical path green).\n");
process.exit(0);
