/**
 * Open map registry — all Danger / loco / harvest / build maps with bake status,
 * stack services, and public paths. Best-practice access for UI + AI tools.
 *
 * ## Instance rule (HARD)
 * Each map is an **exclusive full instance**. Never hot-load a GLB into the
 * Danger Room shell and hide walls without terrain height + ground meshes.
 * Studio.setTestWorld:
 *   - danger-room → activateDangerRoomInstance (walls, DJ, bags, KCC)
 *   - outdoor → ForestWorld.load until isReady() → activateOutdoorMapInstance
 *   - fail → restore Danger Room (never black void)
 *
 * Scale SSOT: maps/mapOrcScale.ts — all outdoor maps fit for **2.0 m orc**
 * (door clear ≥ 2.45 m, storey ≈ 3.8 m). Not 1.8 m human default.
 *
 * Stack: Three r185 · Rapier (@workspace/grudge-physics) · pinata harvest ·
 * GamePlayLayers · BuildGrid · Controller water/climb · ObjectStore icons ·
 * Railway bag · info.grudge-studio.com definitions.
 */
import type { TestWorldId } from "../testWorlds";
import { TEST_WORLDS } from "../testWorlds";

export type MapBakeStatus = "baked" | "runtime" | "cdn" | "partial";

export type MapRegistryEntry = {
  id: string;
  /** Matches TestWorldId when live on /danger */
  testWorldId?: TestWorldId;
  name: string;
  blurb: string;
  /** public/ relative path(s) */
  assets: string[];
  kind: "combat" | "harvest" | "loco" | "build" | "sail" | "town" | "mixed";
  bake: MapBakeStatus;
  colliders: string[];
  layers: string[];
  features: string[];
  /** Services / stack modules */
  stack: string[];
  defaultMode?: "combat" | "harvest" | "build";
  toonStyle?: boolean;
  approxMb?: number;
};

export const MAP_REGISTRY: MapRegistryEntry[] = [
  {
    id: "danger-room",
    testWorldId: "danger-room",
    name: "Danger Room",
    blurb: "Holo / foundry / colosseum combat chamber.",
    assets: [],
    kind: "combat",
    bake: "runtime",
    colliders: ["room shell", "prop circles"],
    layers: ["player", "monster", "boss", "ui"],
    features: ["spar", "weapon skills", "room presets"],
    stack: ["DangerRoom", "Controller", "epicfight", "pinata optional"],
    defaultMode: "combat",
  },
  {
    id: "forest-mountains",
    testWorldId: "forest-mountains",
    name: "Forest Mountains",
    blurb: "Dense harvest node zone — geometry-classified trees/rocks, UUIDs, convex bake.",
    assets: ["models/maps/forest_mountains/forest_mountains.glb"],
    kind: "harvest",
    bake: "partial",
    colliders: ["terrain trimesh", "harvest convex/cuboid"],
    layers: ["terrain", "harvest", "player"],
    features: ["hrvl/hrvi/hrvd", "heightmap", "pinata", "toon-ready"],
    stack: [
      "forestMountainsMap",
      "forestHarvestBake",
      "GamePlayLayers",
      "PinataHarvest",
      "ObjectStore materials",
    ],
    defaultMode: "harvest",
    toonStyle: true,
    approxMb: 11,
  },
  {
    id: "tropical-harvest",
    testWorldId: "tropical-harvest",
    name: "Tropical Harvest",
    blurb:
      "SPA dry island when present; else R2 tropical_island_small / low_poly_island. Geometric ore + palms.",
    assets: [
      "models/maps/tropical/tropical_island_dry.glb",
      "models/maps/tropical/tropical_island.glb",
      "models/warlords-era/worlds/tropical_island_small.glb",
      "models/warlords-era/worlds/low_poly_island.glb",
    ],
    kind: "harvest",
    bake: "cdn",
    colliders: ["beach height", "ore cuboid"],
    layers: ["terrain", "harvest"],
    features: ["geometric ore", "toon-ready", "pinata", "cdn-fallback"],
    stack: ["tropicalIslandHarvest", "biomeMeshKeys", "loadGltfFirst", "PinataHarvest"],
    defaultMode: "harvest",
    toonStyle: true,
    approxMb: 70,
  },
  {
    id: "shipwreck-island",
    testWorldId: "shipwreck-island",
    name: "Shipwreck Island",
    blurb: "Climb ladders, swim, harvest palms, ship vehicle, 1 m build grid.",
    assets: ["models/maps/shipwreck/shipwreck_island.glb"],
    kind: "mixed",
    bake: "runtime",
    colliders: ["World ground", "climb/swim sensors"],
    layers: ["terrain", "climb", "swim", "harvest", "vehicle", "claim"],
    features: ["build grid", "loco Q&A", "toon-ready"],
    stack: ["shipwreckIslandMap", "BuildGridOverlay", "CampBuild", "Controller waterBand"],
    defaultMode: "build",
    toonStyle: true,
    approxMb: 1,
  },
  {
    id: "arena",
    testWorldId: "arena",
    name: "Arena",
    blurb: "Viking pit — sand/grass combat + rock harvest + build grid.",
    assets: ["models/maps/arena/arena.glb"],
    kind: "build",
    bake: "runtime",
    colliders: ["sand/grass terrain", "barrier solids"],
    layers: ["terrain", "harvest", "climb", "solid", "player", "monster"],
    features: ["build grid", "combat", "toon-ready"],
    stack: ["arenaMap", "BuildGridOverlay", "CampBuild", "GamePlayLayers"],
    defaultMode: "build",
    toonStyle: true,
    approxMb: 19,
  },
  {
    id: "pirate-village",
    testWorldId: "pirate-village",
    name: "Pirate Village",
    blurb: "Village ×4 for 2 m orc — water band, palms, climb ladder.",
    assets: [
      "models/maps/pirate/village.glb",
      "models/maps/pirate/palm_trees.glb",
      "models/maps/pirate/date_palm.glb",
    ],
    kind: "loco",
    bake: "runtime",
    colliders: ["landscape", "water sensor"],
    layers: ["terrain", "swim", "climb", "harvest", "vehicle"],
    features: ["orc scale", "water band"],
    stack: ["pirateVillageMap", "Controller"],
    defaultMode: "harvest",
    toonStyle: true,
    approxMb: 20,
  },
  {
    id: "sailtest",
    testWorldId: "sailtest",
    name: "Sailtest",
    blurb: "Dual islands + water/wind — CDN mesh.",
    assets: ["models/worlds/sailtest.glb"],
    kind: "sail",
    bake: "cdn",
    colliders: ["island height", "water plane"],
    layers: ["terrain", "swim", "player", "vehicle"],
    features: ["SailEnvironment", "wind", "wing sail mode"],
    stack: ["ForestWorld", "SailEnvironment", "WingBackRig sail"],
    defaultMode: "build",
    approxMb: 0,
  },
  {
    id: "forest-map",
    testWorldId: "forest-map",
    name: "Forest Map",
    blurb: "CDN dark forest + Warlords nature scatter.",
    assets: ["models/worlds/forest-map.glb"],
    kind: "harvest",
    bake: "cdn",
    colliders: ["terrain"],
    layers: ["terrain", "harvest"],
    features: ["Warlords nature packs"],
    stack: ["ForestWorld", "loadGltfFirst", "R2 CDN"],
    defaultMode: "harvest",
  },
  {
    id: "island-life",
    testWorldId: "island-life",
    name: "Island Life",
    blurb: "Survival coast — island_life.glb when uploaded; else sailtest/small/breeze chain.",
    assets: [
      "models/worlds/island_life.glb",
      "models/worlds/sailtest.glb",
      "models/worlds/small_island.glb",
      "models/worlds/breeze-island.glb",
    ],
    kind: "mixed",
    bake: "cdn",
    colliders: ["terrain", "water"],
    layers: ["terrain", "swim", "monster", "player"],
    features: ["camp enemies", "raider boats", "cdn-fallback"],
    stack: ["ForestWorld", "CampEnemySystem", "biomeMeshKeys"],
    defaultMode: "build",
  },
  {
    id: "fabled-zone",
    testWorldId: "fabled-zone",
    name: "Fabled Main Town",
    blurb: "Faction capital — fabled GLB when on R2; else pirate_island_pack + camp.",
    assets: [
      "models/worlds/fabled-zone.glb",
      "models/warlords-era/worlds/pirate_island_pack.glb",
      "models/warlords-era/worlds/medieval_camp.glb",
      "models/worlds/sailtest.glb",
    ],
    kind: "town",
    bake: "cdn",
    colliders: ["town meshes"],
    layers: ["terrain", "npc", "player", "claim"],
    features: ["sky towns", "portals", "cdn-fallback"],
    stack: ["FabledSkyTowns", "ForestWorld", "biomeMeshKeys"],
    defaultMode: "combat",
  },
  {
    id: "ice-world",
    testWorldId: "ice-world",
    name: "Ice World",
    blurb: "Ice biome — warlords-era/worlds/ice_world.glb (R2).",
    assets: ["models/warlords-era/worlds/ice_world.glb"],
    kind: "harvest",
    bake: "cdn",
    colliders: ["terrain"],
    layers: ["terrain", "harvest", "player"],
    features: ["ice biome", "cdn"],
    stack: ["ForestWorld", "biomeMeshKeys", "loadGltfFirst"],
    defaultMode: "harvest",
    approxMb: 0,
  },
  {
    id: "plains-fields",
    testWorldId: "plains-fields",
    name: "Plains Fields",
    blurb: "Plains — Amida fields + low_poly_farm packs (R2).",
    assets: [
      "models/packs/fields_near_the_city_of_amida.glb",
      "models/packs/low_poly_farm.glb",
    ],
    kind: "build",
    bake: "cdn",
    colliders: ["field footprint"],
    layers: ["terrain", "harvest", "player"],
    features: ["plains biome", "farm"],
    stack: ["ForestWorld", "biomeMeshKeys"],
    defaultMode: "build",
  },
  {
    id: "desert-canyon",
    testWorldId: "desert-canyon",
    name: "Desert Canyon",
    blurb: "Desert — low_poly_canyon + glowstone_mountain voxel maps (R2).",
    assets: [
      "models/voxel/maps/low_poly_canyon.glb",
      "models/voxel/maps/glowstone_mountain.glb",
    ],
    kind: "harvest",
    bake: "cdn",
    colliders: ["canyon"],
    layers: ["terrain", "harvest"],
    features: ["desert biome"],
    stack: ["ForestWorld", "biomeMeshKeys"],
    defaultMode: "harvest",
  },
  {
    id: "volcanic-standin",
    testWorldId: "volcanic-standin",
    name: "Volcanic Stand-in",
    blurb: "No volcanic_island on R2 — geonosis arena + canyon + glow. Ghast boss separate.",
    assets: [
      "models/voxel/maps/geonosis_arena.glb",
      "models/voxel/maps/low_poly_canyon.glb",
      "models/enemies/volcano/minecraft-ghast.prod.glb",
    ],
    kind: "mixed",
    bake: "cdn",
    colliders: ["arena"],
    layers: ["terrain", "monster", "player"],
    features: ["volcanic stand-in"],
    stack: ["ForestWorld", "biomeMeshKeys", "VolcanoGhastMinion"],
    defaultMode: "combat",
  },
];

export function getMapRegistryEntry(id: string): MapRegistryEntry | undefined {
  return MAP_REGISTRY.find((m) => m.id === id || m.testWorldId === id);
}

export function listMapsByKind(kind: MapRegistryEntry["kind"]): MapRegistryEntry[] {
  return MAP_REGISTRY.filter((m) => m.kind === kind);
}

/** Sync check: every test world with meshKeys should appear in registry. */
export function registryCoverage(): { missing: string[]; extra: string[] } {
  const regIds = new Set(MAP_REGISTRY.map((m) => m.testWorldId).filter(Boolean));
  const missing: string[] = [];
  for (const id of Object.keys(TEST_WORLDS) as TestWorldId[]) {
    if (id === "danger-room" || id === "bridge-town-docks") continue;
    if (!regIds.has(id) && TEST_WORLDS[id].meshKeys?.length) missing.push(id);
  }
  return { missing, extra: [] };
}

/** Services agents should use with maps. */
export const MAP_STACK_SERVICES = {
  definitions: "https://info.grudge-studio.com/api/v1/",
  cdn: "https://assets.grudge-studio.com/",
  icons: "info…/icon-shards/* + assets CDN",
  physics: "@workspace/grudge-physics (Rapier)",
  playerState: "Railway grudge-api /api/characters · /api/account",
  layers: "three/gameplay/GamePlayLayers",
  harvest: "three/harvest/* pinata + UUIDs",
  build: "CampBuildSystem + BuildGridOverlay",
  characters: "grudge6 Bip001 · loadCharacter · WingBackRig back slot",
  ai: "Danger Master set_test_world · playtest suites",
} as const;
