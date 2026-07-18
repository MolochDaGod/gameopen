/**
 * Purge stale featured seed clutter + rebuild map-chunk deployments from
 * voxel-last30 catalog. Syncs content/worlds → public/content/worlds.
 *
 *   node scripts/update-voxel-deployments.mjs
 *   node scripts/update-voxel-deployments.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cdnUrl } from "./lib/assetUuid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dry = process.argv.includes("--dry-run");

const last30Path = path.join(root, "content/worlds/voxel-last30-catalog.json");
const seedPath = path.join(root, "content/worlds/seed-deployments.json");
const chunkDeployPath = path.join(root, "content/worlds/voxel-map-chunk-deployments.json");
const islandLifePath = path.join(root, "content/worlds/island-life-deployments.json");
const publicWorlds = path.join(root, "artifacts/animator/public/content/worlds");

const last30 = JSON.parse(fs.readFileSync(last30Path, "utf8"));
const seedCat = JSON.parse(fs.readFileSync(seedPath, "utf8"));

const maps = (last30.assets || []).filter(
  (a) => a.category === "voxel_map" || a.role === "map_chunk",
);
const animals = (last30.assets || []).filter((a) => a.category === "voxel_animal");
const vfx = (last30.assets || []).filter((a) => a.category === "voxel_vfx");
const content = (last30.assets || []).filter((a) => a.category === "voxel_content");

function biomeFor(id) {
  const s = String(id).toLowerCase();
  if (/pirat|bay|coast|marine|island_life/.test(s)) return "coast";
  if (/canyon|desert|geonosis|glowstone/.test(s)) return "desert";
  if (/grotto|cave|dragon_head|koth|tower/.test(s)) return "mixed";
  if (/floating|dwarves|dalaran|sky/.test(s)) return "mountains";
  if (/castle|faction|eltz|awesome|lobby/.test(s)) return "plains";
  return "mixed";
}

function chunkIdxFor(mb) {
  if (mb >= 300) return 7; // 1024
  if (mb >= 100) return 6; // 512
  return 5; // 256
}

function portalThemes(id) {
  const s = String(id).toLowerCase();
  if (/cave|grotto|dragon/.test(s)) return ["mine", "crypt", "ruins"];
  if (/pirat|bay|coast/.test(s)) return ["ruins", "mine", "temple"];
  if (/castle|faction|eltz|lobby/.test(s)) return ["ruins", "crypt", "temple", "mine"];
  if (/koth|arena|geonosis/.test(s)) return ["ruins", "temple"];
  if (/glow|canyon|desert/.test(s)) return ["temple", "mine", "ruins"];
  return ["ruins", "mine", "temple", "crypt"];
}

// --- map-chunk deployments catalog ---
const mapChunkDeployments = {
  format: "grudge.voxel-map-chunk.deployments.v1",
  version: 1,
  updated: new Date().toISOString().slice(0, 10),
  label: "Voxel map-chunk deployments (last-30 + D1/CDN)",
  notes:
    "Purge old prop-scale map uses. Every entry is forceMap / MAP_CHUNKS. " +
    "1 block = 1 m. Codex blocks/defs from voxel-last30-catalog. CDN = assets.grudge-studio.com.",
  policy: last30.policy,
  codex: last30.policy?.codex,
  cdnHost: "https://assets.grudge-studio.com",
  animals: animals.map((a) => ({
    id: a.id,
    r2Key: a.r2Key,
    cdnUrl: cdnUrl(a.r2Key),
    codex: a.codex || null,
  })),
  vfx: vfx.map((a) => ({
    id: a.id,
    r2Key: a.r2Key,
    cdnUrl: cdnUrl(a.r2Key),
    codex: a.codex || null,
  })),
  content: content.map((a) => ({
    id: a.id,
    r2Key: a.r2Key,
    cdnUrl: cdnUrl(a.r2Key),
    role: a.role,
    codex: a.codex || null,
  })),
  deployments: maps.map((a) => {
    const themes = portalThemes(a.id);
    const featured = [
      "castle_eltz",
      "pirat_bay",
      "island_life",
      "animal_company_lobby",
      "grotto_cavern_cave",
      "tower_koth",
      "floating_islands_dwarves_haven",
      "geonosis_arena",
    ].includes(a.id);
    return {
      id: `mapchunk-${a.id.replace(/_/g, "-")}`,
      name: a.id
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      blurb: a.codex?.hint || `Map chunk · ${a.r2Key}`,
      seed: `mapchunk-${a.id}`,
      chunkIdx: chunkIdxFor(a.mb || 20),
      biome: biomeFor(a.id),
      featured,
      deploy: a.upload === "multipart" ? "open-playtest" : "both",
      mapChunkId: a.id,
      mesh: a.r2Key,
      cdnUrl: cdnUrl(a.r2Key),
      forceMap: true,
      codexBlocks: a.codex?.blocks || [],
      codexDefs: a.codex?.defs || [],
      d1Category: a.category,
      mb: a.mb,
      uploadPolicy: a.upload,
      portalPlan: {
        portalCount: Math.min(5, Math.max(3, themes.length)),
        radiusMin: 28,
        radiusMax: 100,
        surfaceY: 2,
        themes,
      },
    };
  }),
};

// --- purge + rebuild seed-deployments ---
/** Keep only core procedural seeds featured; demote rascals & swamp; inject map chunks. */
const KEEP_FEATURED_SEEDS = new Set([
  "seed-grudge-plains",
  "seed-frost-coast",
  "seed-ember-peaks",
  "seed-desert-sun",
]);

const purgedSeedDeployments = (seedCat.deployments || [])
  .filter((d) => {
    // Drop obsolete custom / broken mega if any; keep rascals but un-feature
    return true;
  })
  .map((d) => {
    const isRascals = String(d.id).includes("rascals") || d.sourceCollection;
    const keepFeatured = KEEP_FEATURED_SEEDS.has(d.id);
    return {
      ...d,
      featured: keepFeatured ? true : false,
      // tag purge
      purgedFeatured: isRascals || (!keepFeatured && d.featured) ? true : undefined,
    };
  })
  // strip undefined keys
  .map((d) => {
    const out = { ...d };
    if (out.purgedFeatured === undefined) delete out.purgedFeatured;
    return out;
  });

// Prepend featured map-chunk seeds (not already present)
const existingIds = new Set(purgedSeedDeployments.map((d) => d.id));
const mapAsSeeds = mapChunkDeployments.deployments
  .filter((d) => d.featured && !existingIds.has(d.id))
  .map((d) => ({
    id: d.id,
    name: d.name,
    blurb: `${d.blurb} · mapChunk=${d.mapChunkId} · codex blocks linked`,
    seed: d.seed,
    chunkIdx: d.chunkIdx,
    biome: d.biome,
    featured: true,
    deploy: d.deploy,
    mapChunkId: d.mapChunkId,
    mesh: d.mesh,
    cdnUrl: d.cdnUrl,
    codexBlocks: d.codexBlocks,
    codexDefs: d.codexDefs,
    portalPlan: d.portalPlan,
  }));

// Also add non-featured map chunks at end of catalog for library
const mapAsSeedsRest = mapChunkDeployments.deployments
  .filter((d) => !d.featured && !existingIds.has(d.id))
  .map((d) => ({
    id: d.id,
    name: d.name,
    blurb: `${d.blurb} · mapChunk=${d.mapChunkId}`,
    seed: d.seed,
    chunkIdx: d.chunkIdx,
    biome: d.biome,
    featured: false,
    deploy: d.deploy,
    mapChunkId: d.mapChunkId,
    mesh: d.mesh,
    cdnUrl: d.cdnUrl,
    codexBlocks: d.codexBlocks,
    codexDefs: d.codexDefs,
    portalPlan: d.portalPlan,
  }));

const newSeedCat = {
  ...seedCat,
  version: 4,
  updated: new Date().toISOString().slice(0, 10),
  label: "Minecraft-like seed + voxel map-chunk deployments",
  notes:
    "v4: purged old rascals/swamp featured flags. Featured = core procedural seeds + last-30 map chunks " +
    "(castle_eltz, pirate bay, island_life, lobby, grotto, koth, floating islands, geonosis). " +
    "Map chunks use MAP_CHUNKS scale (1 block=1m). Codex: /api/blocks + /api/definitions. " +
    "Full map list: content/worlds/voxel-map-chunk-deployments.json · D1 sourceSet voxel-last30-downloads.",
  mapChunkCatalog: "content/worlds/voxel-map-chunk-deployments.json",
  last30Catalog: "content/worlds/voxel-last30-catalog.json",
  deployments: [...mapAsSeeds, ...purgedSeedDeployments, ...mapAsSeedsRest],
};

// --- island-life wildlife → last30 animals ---
let islandLife = null;
if (fs.existsSync(islandLifePath)) {
  islandLife = JSON.parse(fs.readFileSync(islandLifePath, "utf8"));
  islandLife.version = (islandLife.version || 1) + 1;
  islandLife.updated = new Date().toISOString().slice(0, 10);
  islandLife.public = islandLife.public || {};
  islandLife.public.map = "models/worlds/island_life.glb";
  islandLife.public.mapCdn = cdnUrl("models/worlds/island_life.glb");
  islandLife.public.wildlifeVoxel = animals.map((a) => a.r2Key);
  islandLife.public.wildlifeCdn = animals.map((a) => cdnUrl(a.r2Key));
  islandLife.codex = {
    blocks: ["grass", "dirt", "sand", "water", "log", "leaves", "ore_iron"],
    defs: ["overworld", "island_life"],
    apis: last30.policy?.codex,
  };
  islandLife.notes =
    "Map + wildlife from voxel-last30 (D1/CDN). Wildlife = last30 animals only (no COTW). " +
    "Orcs/bandits polyart paths retained for raids.";
}

function writeJson(p, obj) {
  const body = JSON.stringify(obj, null, 2) + "\n";
  if (dry) {
    console.log(`[dry] would write ${path.relative(root, p)} (${body.length} bytes)`);
    return;
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  console.log(`wrote ${path.relative(root, p)}`);
}

function mirror(name) {
  const src = path.join(root, "content/worlds", name);
  const dest = path.join(publicWorlds, name);
  if (!fs.existsSync(src)) return;
  if (dry) {
    console.log(`[dry] mirror ${name}`);
    return;
  }
  fs.mkdirSync(publicWorlds, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`mirror → public/content/worlds/${name}`);
}

writeJson(chunkDeployPath, mapChunkDeployments);
writeJson(seedPath, newSeedCat);
if (islandLife) writeJson(islandLifePath, islandLife);

// also mirror last30 catalog
mirror("voxel-map-chunk-deployments.json");
mirror("seed-deployments.json");
mirror("island-life-deployments.json");
mirror("voxel-last30-catalog.json");

console.log("\n[update-voxel-deployments] summary");
console.log(`  map chunks: ${mapChunkDeployments.deployments.length}`);
console.log(`  featured map chunks: ${mapAsSeeds.length}`);
console.log(`  seed deployments total: ${newSeedCat.deployments.length}`);
console.log(
  `  featured seeds: ${newSeedCat.deployments.filter((d) => d.featured).length}`,
);
console.log(`  animals wired: ${animals.length}`);
if (dry) console.log("(dry-run — no files written)");
