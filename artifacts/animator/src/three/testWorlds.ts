/**
 * Test world / map SSOT for Open Danger Room production testing.
 *
 * Maps:
 *  - **danger-room** — combat chamber (RoomPresets holo/foundry/colosseum)
 *  - **sailtest** — dual-island camp / sail / harvest (CDN mesh)
 *  - **forest-map** — dark forest base + Warlords nature/harvest scatter
 *  - **island-life** / **fabled-zone** / **bridge-town-docks** — survival / towns
 *  - **tropical-harvest** — SPA tropical dry OR CDN tropical_island_small fallback
 *  - **pirate-village** — local village ×4 for 2 m orc + water band + palms
 *  - **ice-world** / **plains-fields** / **desert-canyon** / **volcanic-standin** — biome labs
 *
 * Biome mesh chains: `maps/biomeMeshKeys.ts` (HEAD-proven SPA + R2 keys only).
 * CDN maps: meshKeys / WARLORDS_NATURE via loadGltfFirst → assets.grudge-studio.com.
 * Catalog: content/worlds/outdoor-asset-catalog.json · docs/OUTDOOR_ASSETS_D1_R2.md
 */
import {
  BIOME_MESH_CHAINS,
  CDN_NATURE,
  meshKeysForBiome,
} from "./maps/biomeMeshKeys";

export type TestWorldId =
  | "danger-room"
  | "sailtest"
  | "forest-map"
  | "island-life"
  | "fabled-zone"
  | "bridge-town-docks"
  | "tropical-harvest"
  | "pirate-village"
  | "shipwreck-island"
  | "arena"
  | "forest-mountains"
  | "ice-world"
  | "plains-fields"
  | "desert-canyon"
  | "volcanic-standin";

export type TestWorldKind =
  | "combat"
  | "camp_sail"
  | "harvest_forest"
  | "survival_island"
  | "faction_town"
  | "dock_kit"
  | "loco_qa"
  | "build_arena";

export type TestWorldDef = {
  id: TestWorldId;
  name: string;
  blurb: string;
  kind: TestWorldKind;
  /** Stable UUID for seed / bag / deployment keys. */
  uuid: string;
  /** Seed string for Mine-Loader / open-playtest deploy. */
  seed: string;
  /** Relative mesh key(s) for outdoor terrain (none for pure danger room). */
  meshKeys?: string[];
  /** Replace chicken-gun trees/rocks/leaves with Warlords stylized packs. */
  natureReplace?: boolean;
  /** Scatter harvest nodes (ore / flowers / foliage / wildlife markers). */
  harvestScatter?: boolean;
  /** Load camp claim / placeables sandbox. */
  campSandbox?: boolean;
  /** Outdoor sailing stage: water plane, Sky, wind, sand retouch. */
  sailing?: boolean;
  /** Default player activity mode when entering. */
  defaultMode?: "combat" | "harvest" | "build";
  /** Fog mood. */
  fog?: { color: number; near: number; far: number; background?: number };
};

/** Deterministic UUIDs (namespace grudge-test-world + id). */
export const TEST_WORLDS: Record<TestWorldId, TestWorldDef> = {
  "danger-room": {
    id: "danger-room",
    name: "Danger Room",
    blurb: "Combat testing chamber — weapons, skills, sparring, focus lock.",
    kind: "combat",
    uuid: "a1b2c3d4-e5f6-4a70-8b91-dangerroom0001",
    seed: "danger-room-combat",
    defaultMode: "combat",
  },
  sailtest: {
    id: "sailtest",
    name: "Sailtest Map",
    blurb:
      "Dual islands near sea level (SAILTEST.glb) — water, wind, sand, sky, camp, harvest, Grudge characters.",
    kind: "camp_sail",
    uuid: "b2c3d4e5-f6a7-4b81-9c02-sailtestmap0002",
    seed: "sailtest-island-01",
    meshKeys: meshKeysForBiome("sail"),
    /** Enable SailEnvironment (water + Sky + sand retouch + wind). */
    sailing: true,
    harvestScatter: true,
    campSandbox: true,
    defaultMode: "build",
    fog: { color: 0x8ec8e8, near: 28, far: 160, background: 0x7eb8e0 },
  },
  "forest-map": {
    id: "forest-map",
    name: "Forest Map",
    blurb:
      "Dark forest (chicken_gun_fruzer) base — Warlords trees/rocks/leaves + flowers, ore, animals for harvest testing.",
    kind: "harvest_forest",
    uuid: "c3d4e5f6-a7b8-4c92-ad13-forestmap00003",
    seed: "forest-map-harvest-01",
    meshKeys: meshKeysForBiome("forest"),
    natureReplace: true,
    harvestScatter: true,
    campSandbox: true,
    defaultMode: "harvest",
    fog: { color: 0x1a2818, near: 12, far: 55, background: 0x0c140e },
  },
  "island-life": {
    id: "island-life",
    name: "Island Life",
    blurb:
      "Survival coast — island_life.glb on R2 when under size gate; else sailtest/small/breeze fallback chain.",
    kind: "survival_island",
    uuid: "d4e5f6a7-b8c9-4d03-be24-islandlife0004",
    seed: "island-life-survival-01",
    meshKeys: meshKeysForBiome("survival"),
    harvestScatter: true,
    campSandbox: true,
    sailing: true,
    defaultMode: "build",
    fog: { color: 0x8ec8e8, near: 24, far: 140, background: 0x6eb8d8 },
  },
  "fabled-zone": {
    id: "fabled-zone",
    name: "Fabled Main Town",
    blurb:
      "Faction capital — fabled-zone.glb on R2 (CDN). Pirate pack only if primary fails.",
    kind: "faction_town",
    uuid: "e5f6a7b8-c9d0-4e14-af35-fabledzone0005",
    seed: "fabled-main-town-01",
    meshKeys: meshKeysForBiome("town"),
    harvestScatter: false,
    campSandbox: true,
    sailing: true,
    defaultMode: "combat",
    fog: { color: 0xb8a0d8, near: 40, far: 220, background: 0x6a5090 },
  },
  "bridge-town-docks": {
    id: "bridge-town-docks",
    name: "Bridge Town Dock Kit",
    blurb:
      "Modular Bridge Town kit on R2 (bridge_town.glb / bridge-town-kit.glb) — dock seeds, piers, NPC slots.",
    kind: "dock_kit",
    uuid: "f6a7b8c9-d0e1-4f25-b046-bridgetown0006",
    seed: "bridge-town-docks-01",
    meshKeys: meshKeysForBiome("docks"),
    campSandbox: true,
    sailing: true,
    defaultMode: "build",
    fog: { color: 0x7eb8d0, near: 20, far: 120, background: 0x5a9ab8 },
  },
  /**
   * Tropical harvest QA — production uses Warlords tropical_island_small (CDN 200).
   * SPA tropical_island_dry is not deployed (404 both hosts).
   */
  "tropical-harvest": {
    id: "tropical-harvest",
    name: "Tropical Harvest (small island)",
    blurb:
      "Live mesh: tropical_island_small.glb (CDN). SPA tropical_island_dry is not on prod — harvest scatter + palms on small tropical.",
    kind: "loco_qa",
    uuid: "a7b8c9d0-e1f2-4060-c157-tropicalharv07",
    seed: "tropical-harvest-qa-01",
    meshKeys: meshKeysForBiome("tropical"),
    harvestScatter: true,
    campSandbox: false,
    sailing: false,
    defaultMode: "harvest",
    fog: { color: 0xc8e0f0, near: 35, far: 120, background: 0x7eb8d8 },
  },
  /**
   * Local public GLB: pirate village scaled ×4 for 2 m orc doors, palms, water band.
   */
  "pirate-village": {
    id: "pirate-village",
    name: "Pirate Village",
    blurb:
      "Sketchfab pirate village ×4 for 2 m orc — landscape/huts/tower, water band, better palms, climb ladder, boat/raft tags.",
    kind: "loco_qa",
    uuid: "b8c9d0e1-f2a3-4171-d268-piratevillag08",
    seed: "pirate-village-loco-01",
    meshKeys: meshKeysForBiome("pirate"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "harvest",
    fog: { color: 0x9ec8d8, near: 24, far: 90, background: 0x6a9ab0 },
  },
  /**
   * Shipwreck island — water + ladders + palms/rock + ship. Loco climb/swim Q&A + build grid.
   */
  "shipwreck-island": {
    id: "shipwreck-island",
    name: "Shipwreck Island",
    blurb:
      "Sprytile shipwreck island (~1 MB) — World ground, Water swim, Ladders climb, palms/rock harvest, Ship vehicle, Lighthouse solid. Build grid on World.",
    kind: "loco_qa",
    uuid: "c9d0e1f2-a3b4-4282-e379-shipwreckis09",
    seed: "shipwreck-island-loco-01",
    meshKeys: meshKeysForBiome("coast"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "build",
    fog: { color: 0x8ec8e0, near: 20, far: 80, background: 0x5a9ab8 },
  },
  /**
   * Viking arena — combat sand/grass + rock harvest + stairs climb + 1 m build grid.
   */
  arena: {
    id: "arena",
    name: "Arena",
    blurb:
      "Fantasy arena (~19 MB) — Sand/Grass nav, Rock harvest, stairs climb, barriers solid. 1 m SI build grid + ghost place (R rotate).",
    kind: "build_arena",
    uuid: "d0e1f2a3-b4c5-4393-f48a-arena0000010",
    seed: "arena-build-combat-01",
    meshKeys: meshKeysForBiome("arena"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "build",
    fog: { color: 0x3a2f1d, near: 28, far: 90, background: 0x5a4a30 },
  },
  /**
   * Dense forest-in-mountains harvest node zone — terrain height layer + generative
   * wood/ore/forage with hrvl_/hrvi_/hrvd_ UUIDs, convex colliders, pinata bake.
   */
  "forest-mountains": {
    id: "forest-mountains",
    name: "Forest Mountains",
    blurb:
      "Dense mountain forest (~11 MB, 546 meshes) — heightmap terrain layer, geometry-classified trees/rocks/forage, harvest UUIDs, convex/cuboid bake, pinata mining.",
    kind: "loco_qa",
    uuid: "e1f2a3b4-c5d6-44a4-059b-forestmtns011",
    seed: "forest-mountains-harvest-01",
    meshKeys: meshKeysForBiome("mountain"),
    harvestScatter: true,
    campSandbox: false,
    sailing: false,
    defaultMode: "harvest",
    fog: { color: 0x1a2818, near: 14, far: 70, background: 0x0c140e },
  },
  /** Ice biome lab — Warlords ice_world on R2. */
  "ice-world": {
    id: "ice-world",
    name: "Ice World",
    blurb: "Ice biome lab (warlords-era/worlds/ice_world.glb) — cold fog, camp sandbox, light harvest.",
    kind: "loco_qa",
    uuid: "f2a3b4c5-d6e7-45b5-16ac-iceworld00012",
    seed: "ice-world-biome-01",
    meshKeys: meshKeysForBiome("ice"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "harvest",
    fog: { color: 0xc8d8e8, near: 18, far: 90, background: 0xa0b8d0 },
  },
  /** Plains / farm — Amida fields + low poly farm packs (no full plains island mesh). */
  "plains-fields": {
    id: "plains-fields",
    name: "Plains Fields",
    blurb: "Plains biome from Amida fields + farm pack (R2) — open ground, harvest scatter, build.",
    kind: "loco_qa",
    uuid: "a3b4c5d6-e7f8-46c6-27bd-plainsfields13",
    seed: "plains-fields-biome-01",
    meshKeys: meshKeysForBiome("plains"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "build",
    fog: { color: 0xd8e0c8, near: 30, far: 140, background: 0xb8c890 },
  },
  /** Desert / canyon / glow mountain voxel chunks. */
  "desert-canyon": {
    id: "desert-canyon",
    name: "Desert Canyon",
    blurb: "Desert biome — low_poly_canyon + glowstone_mountain (R2 voxel maps).",
    kind: "loco_qa",
    uuid: "b4c5d6e7-f8a9-47d7-38ce-desertcanyon14",
    seed: "desert-canyon-biome-01",
    meshKeys: meshKeysForBiome("desert"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "harvest",
    fog: { color: 0xc8a878, near: 22, far: 100, background: 0xa88850 },
  },
  /**
   * No dedicated volcanic island on CDN — geonosis/canyon/glow stand-in.
   * Volcano ghast boss: models/enemies/volcano/minecraft-ghast.prod.glb
   */
  "volcanic-standin": {
    id: "volcanic-standin",
    name: "Volcanic Stand-in",
    blurb:
      "Volcanic lab (no volcanic_island.glb on R2) — geonosis arena + canyon glow; red fog. Ghast mesh separate.",
    kind: "loco_qa",
    uuid: "c5d6e7f8-a9b0-48e8-49df-volcanicstd15",
    seed: "volcanic-standin-01",
    meshKeys: meshKeysForBiome("volcanic"),
    harvestScatter: true,
    campSandbox: true,
    sailing: false,
    defaultMode: "combat",
    fog: { color: 0x401808, near: 10, far: 70, background: 0x280c04 },
  },
};

export const TEST_WORLD_LIST: TestWorldDef[] = [
  TEST_WORLDS["danger-room"],
  TEST_WORLDS.sailtest,
  TEST_WORLDS["forest-map"],
  TEST_WORLDS["forest-mountains"],
  TEST_WORLDS["tropical-harvest"],
  TEST_WORLDS["pirate-village"],
  TEST_WORLDS["shipwreck-island"],
  TEST_WORLDS.arena,
  TEST_WORLDS["island-life"],
  TEST_WORLDS["fabled-zone"],
  TEST_WORLDS["bridge-town-docks"],
  TEST_WORLDS["ice-world"],
  TEST_WORLDS["plains-fields"],
  TEST_WORLDS["desert-canyon"],
  TEST_WORLDS["volcanic-standin"],
];

/** Re-export biome inventory for tools / Admin. */
export { BIOME_MESH_CHAINS, meshKeysForBiome };

const STORAGE_KEY = "open:testWorld:v1";

export function loadTestWorldId(): TestWorldId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in TEST_WORLDS) return v as TestWorldId;
  } catch {
    /* ignore */
  }
  return "danger-room";
}

export function saveTestWorldId(id: TestWorldId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function asTestWorldId(raw: string | null | undefined): TestWorldId | null {
  if (!raw) return null;
  return raw in TEST_WORLDS ? (raw as TestWorldId) : null;
}

/** Warlords nature pack keys (R2-proven via biomeMeshKeys). Isolate mesh children at runtime. */
export const WARLORDS_NATURE = {
  trees: CDN_NATURE.trees,
  treesAlt: CDN_NATURE.treesAlt,
  rocks: CDN_NATURE.rocks,
  flowers: CDN_NATURE.flowers,
  foliage: CDN_NATURE.foliage,
  ore: CDN_NATURE.ore,
  minerals: CDN_NATURE.minerals,
  tropicalPlants: CDN_NATURE.tropicalPlants,
  /** Voxel / Blockbench wildlife only — never COTW photoreal animals. */
  animals: [
    "models/battle/animals/wolf.glb",
    "models/battle/animals/bear.glb",
    "models/battle/animals/deer.glb",
    "models/battle/animals/buffalo.glb",
  ],
  /** Trailer-style ores for mine / place palette (often missing on CDN — optional). */
  trailerOres: "models/blocks/minecrafts_trailer_style_ores.glb",
} as const;

/** Mesh-name heuristics to strip from chicken-gun forest base (replaced by Warlords). */
export const FOREST_STRIP_NAME_RE =
  /tree|leaf|leaves|branch|foliage|bush|pine|birch|oak|spruce|plant|rock|stone|boulder|trunk|canopy|grass|fern|ivy|moss|twig|bark/i;
