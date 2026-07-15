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
  "models/grudge6/races/WK_Characters.fbx",
  "models/grudge6/races/BRB_Characters.fbx",
  "models/grudge6/races/ORC_Characters.fbx",
  "models/grudge6/races/ELF_Characters.fbx",
  "models/grudge6/races/DWF_Characters.fbx",
  "models/grudge6/races/UD_Characters.fbx",
  // TVS production GLB (compressed)
  "models/voxels/tvs/voxel-knights/characters/voxel-knights-champion.glb",
  "models/voxels/tvs/unit-roster.json",
  // icons
  "icons/pack/weapons/Sword_01.png",
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

async function main() {
  const list = [];
  for (const key of CRITICAL) {
    list.push(`${CDN}/${key}`);
    if (!cdnOnly) list.push(`${BASE}/${key}`);
  }
  for (const key of ARENA_KEYS) {
    list.push(`${ARENA}/${key}`);
    if (!cdnOnly) list.push(`${BASE}/${key}`);
  }

  console.log(`verify-fleet-assets base=${BASE} cdnOnly=${cdnOnly} n=${list.length}`);
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
  console.log(`\nSummary ok=${ok} fail=${fail}`);
  if (fail) {
    console.error(`
Missing production assets. Fix:
  1. R2 keys under assets.grudge-studio.com (upload via grudge-convert / upload:r2)
  2. Vercel rewrites for /textures/grudge6 /models/grudge6 /models/voxels → R2
  3. Re-deploy Open (gameopen) so same-origin proxies work
`);
    process.exit(1);
  }
  console.log("Fleet textures + models + compressed builds: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
