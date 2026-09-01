/**
 * Verify production asset delivery for Open / Danger Room / grudge6 / TVS.
 *
 *   node scripts/verify-fleet-assets.mjs
 *   node scripts/verify-fleet-assets.mjs --base https://open.grudge-studio.com
 *   node scripts/verify-fleet-assets.mjs --cdn-only
 */
const CDN = "https://assets.grudge-studio.com";
const ARENA = "https://grudge-arena.grudge-studio.com";
const args = process.argv.slice(2);
const cdnOnly = args.includes("--cdn-only");
const baseIdx = args.indexOf("--base");
const BASE =
  baseIdx >= 0
    ? args[baseIdx + 1].replace(/\/$/, "")
    : "https://open.grudge-studio.com";

/** Critical production keys: textures, models, colors (atlases), compressed builds */
const CRITICAL = [
  // grudge6 race kits + atlases (Toon RTS colors)
  "textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
  "textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
  "textures/grudge6/dwarves/DWF_Standard_Units.webp",
  "textures/grudge6/elves/ELF_HighElves_Texture.webp",
  "textures/grudge6/orcs/ORC_StandardUnits.webp",
  "textures/grudge6/undead/UD_Standard_Units.webp",
  // Production combat GLBs (SSOT for Open Danger / annihilate)
  "models/grudge6/races/WK_Characters.glb",
  "models/grudge6/races/BRB_Characters.glb",
  "models/grudge6/races/ORC_Characters.glb",
  "models/grudge6/races/ELF_Characters.glb",
  "models/grudge6/races/DWF_Characters.glb",
  "models/grudge6/races/UD_Characters.glb",
  // Author FBX still on CDN for convert pipeline
  "models/grudge6/races/WK_Characters.fbx",
  "models/grudge6/races/BRB_Characters.fbx",
  "models/grudge6/races/ORC_Characters.fbx",
  "models/grudge6/races/ELF_Characters.fbx",
  "models/grudge6/races/DWF_Characters.fbx",
  "models/grudge6/races/UD_Characters.fbx",
  // Game props / heroes used by Open doors + camp
  "models/racalvin.glb",
  "models/props/dying-torch.glb",
  "models/camp/claim-flag.glb",
  "models/vfx/stylized_ice_bow.glb",
  // TVS production GLB (compressed)
  "models/voxels/tvs/voxel-knights/characters/voxel-knights-champion.glb",
  "models/voxels/tvs/unit-roster.json",
  // icons
  "icons/pack/weapons/Sword_01.png",
  // outdoor / harvest terrain (R2 — not git)
  "models/worlds/sailtest.glb",
  "models/worlds/forest-map.glb",
  "models/worlds/small_island.glb",
  "models/nature/stylized/biome/nature_vegetation.glb",
  "models/nature/stylized/harvest/ore_nodes.glb",
  "models/nature/stylized/rocks/stylised_rocks.glb",
  // arena skinned + anims (combat)
];

const ARENA_KEYS = [
  "cdn/assets/characters/human/WK_Characters.glb",
  "anims/baked/locomotion/walking.json",
];

async function head(url) {
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (r.ok) {
      const ct = r.headers.get("content-type") || "";
      // HTML fake-200
      if (ct.includes("text/html")) {
        return { url, ok: false, status: r.status, err: "HTML content-type" };
      }
      return { url, ok: true, status: r.status, ct };
    }
    r = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-32" },
      redirect: "follow",
    });
    const ct = r.headers.get("content-type") || "";
    if ((r.ok || r.status === 206) && !ct.includes("text/html")) {
      return { url, ok: true, status: r.status, ct };
    }
    return { url, ok: false, status: r.status, ct, err: "bad status" };
  } catch (e) {
    return { url, ok: false, status: 0, err: String(e.message || e) };
  }
}

/** Probe D1 asset INDEX (JSON). Binaries remain R2-only. */
async function probeRegistry(url) {
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const text = await r.text();
    const bodyStart = text.slice(0, 160);
    const isSpa =
      bodyStart.includes("<!DOCTYPE html") || bodyStart.includes('<div id="root"');
    const looksJson =
      ct.includes("json") ||
      bodyStart.trim().startsWith("{") ||
      bodyStart.trim().startsWith("[");
    if (!r.ok || isSpa || !looksJson) {
      return {
        url,
        ok: false,
        status: r.status,
        err: isSpa
          ? "SPA HTML masquerade"
          : !looksJson
            ? "not JSON"
            : `status ${r.status}`,
      };
    }
    return { url, ok: true, status: r.status, ct };
  } catch (e) {
    return { url, ok: false, status: 0, err: String(e?.message || e) };
  }
}

async function main() {
  console.log(
    "verify-fleet-assets — law: D1=index only · R2=binaries · Postgres=player/bag/ledger",
  );
  // Always probe asset INDEX so agents don't ship against a dead D1.
  const registryUrls = [
    `${BASE}/api/asset-registry?limit=3`,
    "https://api.grudge-studio.com/assets?limit=1",
  ];
  let regFail = 0;
  for (const u of registryUrls) {
    const r = await probeRegistry(u);
    if (r.ok) console.log(`  OK  D1-index ${r.status} ${u}`);
    else {
      const critical = u.includes("/api/asset-registry");
      if (critical) {
        regFail++;
        console.log(`  BAD D1-index ${r.status || ""} ${u} ${r.err || ""}`);
      } else {
        console.log(`  WARN D1-edge ${r.status || ""} ${u} ${r.err || ""}`);
      }
    }
  }

  const list = [];
  for (const key of CRITICAL) {
    list.push(`${CDN}/${key}`);
    if (!cdnOnly) list.push(`${BASE}/${key}`);
  }
  for (const key of ARENA_KEYS) {
    list.push(`${ARENA}/${key}`);
    if (!cdnOnly) list.push(`${BASE}/${key}`);
  }

  console.log(
    `verify-fleet-assets base=${BASE} cdnOnly=${cdnOnly} n=${list.length} binary keys`,
  );
  let ok = 0;
  let fail = 0;
  const bad = [];
  for (let i = 0; i < list.length; i += 6) {
    const batch = list.slice(i, i + 6);
    const results = await Promise.all(batch.map(head));
    for (const r of results) {
      if (r.ok) {
        ok++;
        console.log(`  OK  ${r.status} ${r.ct || ""} ${r.url}`);
      } else {
        fail++;
        bad.push(r);
        console.log(`  BAD ${r.status} ${r.url} ${r.err || r.ct || ""}`);
      }
    }
  }
  fail += regFail;
  console.log(`\nSummary ok=${ok} fail=${fail} (incl. D1 index fails ${regFail})`);
  if (fail) {
    console.error(`
Missing production assets / index. Fix:
  1. R2 keys under assets.grudge-studio.com (upload via grudge-convert / upload:r2)
  2. D1 asset index via api.grudge-studio.com/assets (seed/register — never player bag)
  3. Vercel rewrites: /api/asset-registry → D1; /models /textures → R2
  4. Re-deploy Open (gameopen) so same-origin proxies work
`);
    process.exit(1);
  }
  console.log("Fleet D1 index + R2 textures/models: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
