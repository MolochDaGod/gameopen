/**
 * Test world / map SSOT for Open Danger Room production testing.
 *
 * Three named maps:
 *  - **danger-room** — combat chamber (RoomPresets holo/foundry/colosseum)
 *  - **sailtest** — dual-island camp / sail / harvest (CDN mesh)
 *  - **forest-map** — dark forest base + Warlords nature/harvest scatter
 *
 * **Binaries are NOT in git.** meshKeys / WARLORDS_NATURE are R2 keys resolved via
 * loadGltfFirst → assets.grudge-studio.com. Catalog + upload/seed:
 * content/worlds/outdoor-asset-catalog.json · scripts/upload-outdoor-r2.mjs ·
 * scripts/seed-outdoor-d1.mjs · docs/OUTDOOR_ASSETS_D1_R2.md
 */

export type TestWorldId =
  | "danger-room"
  | "sailtest"
  | "forest-map"
  | "island-life"
  | "fabled-zone"
  | "bridge-town-docks";

export type TestWorldKind =
  | "combat"
  | "camp_sail"
  | "harvest_forest"
  | "survival_island"
  | "faction_town"
  | "dock_kit";

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
    meshKeys: [
      "models/worlds/sailtest.glb",
      "models/worlds/small_island.glb",
      "models/worlds/breeze-island.glb",
    ],
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
    meshKeys: ["models/worlds/forest-map.glb"],
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
      "Survival RPG island (island_life.glb) — Minecraft-like build/mine, orc tribes + outlaws at red mushrooms, bandit boat raids, trailer ore blocks. Voxel wildlife only.",
    kind: "survival_island",
    uuid: "d4e5f6a7-b8c9-4d03-be24-islandlife0004",
    seed: "island-life-survival-01",
    meshKeys: [
      "models/worlds/island_life.glb",
      "models/worlds/sailtest.glb",
      "models/worlds/small_island.glb",
      "models/worlds/breeze-island.glb",
    ],
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
      "Fabled faction capital (fabledzone.glb) — Starfall Archipelago sector e. Main town map + harbor dock seeds (Bridge Town kit).",
    kind: "faction_town",
    uuid: "e5f6a7b8-c9d0-4e14-af35-fabledzone0005",
    seed: "fabled-main-town-01",
    meshKeys: ["models/worlds/fabled-zone.glb", "models/worlds/fabledzone.glb"],
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
      "Modular Bridge Town kit (bridge_town.glb) — seed NPC docks on islands (stilts, piers, lamps, barrels) + fisher/merchant/guard slots.",
    kind: "dock_kit",
    uuid: "f6a7b8c9-d0e1-4f25-b046-bridgetown0006",
    seed: "bridge-town-docks-01",
    meshKeys: ["models/towns/bridge-town-kit.glb", "models/worlds/bridge_town.glb"],
    campSandbox: true,
    sailing: true,
    defaultMode: "build",
    fog: { color: 0x7eb8d0, near: 20, far: 120, background: 0x5a9ab8 },
  },
};

export const TEST_WORLD_LIST: TestWorldDef[] = [
  TEST_WORLDS["danger-room"],
  TEST_WORLDS.sailtest,
  TEST_WORLDS["forest-map"],
  TEST_WORLDS["island-life"],
  TEST_WORLDS["fabled-zone"],
  TEST_WORLDS["bridge-town-docks"],
];

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

/** Warlords nature pack keys (R2-proven). Isolate mesh children at runtime. */
export const WARLORDS_NATURE = {
  trees: "models/nature/stylized/biome/nature_vegetation.glb",
  treesAlt: "models/nature/stylized/biome/realistic_trees.glb",
  rocks: "models/nature/stylized/rocks/stylised_rocks.glb",
  flowers: "models/nature/stylized/harvest/flowers_pack.glb",
  foliage: "models/nature/stylized/harvest/foliage_pack.glb",
  ore: "models/nature/stylized/harvest/ore_nodes.glb",
  minerals: "models/nature/stylized/harvest/minerals_pack.glb",
  /** Voxel / Blockbench wildlife only — never COTW photoreal animals. */
  animals: [
    "models/battle/animals/wolf.glb",
    "models/battle/animals/bear.glb",
    "models/battle/animals/deer.glb",
    "models/battle/animals/buffalo.glb",
  ],
  /** Trailer-style ores for mine / place palette */
  trailerOres: "models/blocks/minecrafts_trailer_style_ores.glb",
} as const;

/** Mesh-name heuristics to strip from chicken-gun forest base (replaced by Warlords). */
export const FOREST_STRIP_NAME_RE =
  /tree|leaf|leaves|branch|foliage|bush|pine|birch|oak|spruce|plant|rock|stone|boulder|trunk|canopy|grass|fern|ivy|moss|twig|bark/i;
