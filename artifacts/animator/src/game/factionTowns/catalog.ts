/**
 * Faction main towns + island NPC dock seeds.
 *
 * Maps:
 *  - fabledzone.glb → Fabled faction main town (Starfall Archipelago / sector e)
 *  - bridge_town.glb → modular Bridge Town kit for NPC docks on islands
 *
 * Dwarf main city: use grudge6 dwarf race NPCs (uMMORPG-style prefabs) +
 * modular / converted city mesh when licensed — see DWARF_CITY policy below.
 */

import type { WarlordsSectorTone } from "../warlordsSectors";
import type { RaceId } from "../../three/grudge/raceAssets";

export type FactionId = "fabled" | "crusade" | "legion" | "pirate" | "neutral" | "dwarf";

export type TownMapDef = {
  id: string;
  name: string;
  faction: FactionId;
  sectorId?: string;
  tone: WarlordsSectorTone | "dwarf";
  blurb: string;
  /** Public mesh keys (stage to public/R2). */
  meshKeys: string[];
  /** Authoring absolute paths on studio machine. */
  sourcePaths: string[];
  seed: string;
  featured: boolean;
  /** Default NPC spawn table id */
  npcTableId: string;
  /** Optional dock seed recipe ids to scatter around water edge */
  dockSeedIds: string[];
};

export type DockPiece = {
  kitNode: string;
  role: "deck" | "stilt" | "bridge" | "cap" | "stair" | "prop" | "light";
  /** Approximate footprint cells (Bridge Town kit is ~1 unit modular) */
  footprint: { x: number; z: number };
};

export type DockSeedRecipe = {
  id: string;
  name: string;
  blurb: string;
  /** Pieces laid in local XZ grid for a pier / dock */
  layout: Array<{ piece: string; x: number; z: number; yawDeg?: number }>;
  /** NPC slots relative to dock origin */
  npcSlots: Array<{
    id: string;
    role: "merchant" | "guard" | "fisher" | "traveler" | "quest_npc";
    /** grudge6 RaceId */
    raceId: RaceId;
    x: number;
    z: number;
    yawDeg?: number;
  }>;
  kitMeshKey: string;
};

/** Friendly aliases used in spawn docs → grudge6 RaceId */
export function resolveTownRace(
  alias: "human" | "dwarf" | "high_elf" | "orc" | "barbarian" | "undead" | RaceId,
): RaceId {
  switch (alias) {
    case "human":
      return "western-kingdoms";
    case "dwarf":
      return "dwarves";
    case "high_elf":
      return "high-elves";
    case "orc":
      return "orcs";
    case "barbarian":
      return "barbarians";
    case "undead":
      return "undead";
    default:
      return alias;
  }
}

/** Bridge Town kit mesh (modular stilts / bridges / lamps / barrels). */
export const BRIDGE_TOWN_KIT = {
  id: "bridge-town-kit",
  publicPath: "models/towns/bridge-town-kit.glb",
  altPath: "models/worlds/bridge_town.glb",
  sourcePath: "D:/Games/Models/bridge_town.glb",
  title: "Bridge Town",
  notes: "Modular kit — seed NPC docks on island shores (stilts, bridges, lamps, barrels).",
  pieces: [
    { kitNode: "BridgeTownKit_Bridge", role: "bridge", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_BridgeCorner", role: "bridge", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_BridgeTJunc", role: "bridge", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_Bridge4Way", role: "bridge", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_BridgeCap", role: "cap", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_BridgeStair", role: "stair", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_Stilts", role: "stilt", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_StiltsFeet", role: "stilt", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_StiltsCorner", role: "stilt", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_RoofBridge", role: "deck", footprint: { x: 1, z: 1 } },
    { kitNode: "BridgeTownKit_Lamp", role: "light", footprint: { x: 0.3, z: 0.3 } },
    { kitNode: "BridgeTownKit_Barrel", role: "prop", footprint: { x: 0.4, z: 0.4 } },
    { kitNode: "BridgeTownKit_HangingLights", role: "light", footprint: { x: 0.5, z: 0.5 } },
  ] as DockPiece[],
} as const;

/**
 * Seed layouts for island docks (deterministic place tables).
 * Hosts instance Bridge Town kit meshes + uMMORPG-style NPC prefabs.
 */
export const DOCK_SEED_RECIPES: readonly DockSeedRecipe[] = [
  {
    id: "dock-small-fisher",
    name: "Small Fisher Dock",
    blurb: "Short pier + stilts — fisher + merchant NPCs.",
    kitMeshKey: BRIDGE_TOWN_KIT.publicPath,
    layout: [
      { piece: "BridgeTownKit_StiltsFeet", x: 0, z: 0 },
      { piece: "BridgeTownKit_Stilts", x: 0, z: 0 },
      { piece: "BridgeTownKit_Bridge", x: 0, z: 1 },
      { piece: "BridgeTownKit_Bridge", x: 0, z: 2 },
      { piece: "BridgeTownKit_BridgeCap", x: 0, z: 3 },
      { piece: "BridgeTownKit_Lamp", x: 0.4, z: 1.5 },
      { piece: "BridgeTownKit_Barrel", x: -0.4, z: 2.2 },
    ],
    npcSlots: [
      { id: "fisher-1", role: "fisher", raceId: "western-kingdoms", x: 0.3, z: 2.5, yawDeg: 180 },
      { id: "merchant-1", role: "merchant", raceId: "western-kingdoms", x: -0.5, z: 1.2, yawDeg: 90 },
    ],
  },
  {
    id: "dock-trade-pier",
    name: "Trade Pier",
    blurb: "T-junction pier with roof deck — merchant + guard + traveler.",
    kitMeshKey: BRIDGE_TOWN_KIT.publicPath,
    layout: [
      { piece: "BridgeTownKit_StiltsTJuncFeet", x: 0, z: 0 },
      { piece: "BridgeTownKit_StiltsTJunc", x: 0, z: 0 },
      { piece: "BridgeTownKit_Bridge", x: 0, z: 1 },
      { piece: "BridgeTownKit_BridgeTJunc", x: 0, z: 2 },
      { piece: "BridgeTownKit_Bridge", x: -1, z: 2 },
      { piece: "BridgeTownKit_Bridge", x: 1, z: 2 },
      { piece: "BridgeTownKit_BridgeCap", x: -2, z: 2 },
      { piece: "BridgeTownKit_BridgeCap", x: 2, z: 2 },
      { piece: "BridgeTownKit_RoofBridge", x: 0, z: 2 },
      { piece: "BridgeTownKit_HangingLights", x: 0, z: 2 },
      { piece: "BridgeTownKit_Lamp", x: 0.5, z: 1 },
      { piece: "BridgeTownKit_Barrel", x: -0.5, z: 1.5 },
      { piece: "BridgeTownKit_Barrel1", x: 0.6, z: 2.4 },
    ],
    npcSlots: [
      { id: "merchant-lead", role: "merchant", raceId: "high-elves", x: 0, z: 2.3, yawDeg: 180 },
      { id: "guard-1", role: "guard", raceId: "western-kingdoms", x: -1.2, z: 2, yawDeg: 270 },
      { id: "traveler-1", role: "traveler", raceId: "western-kingdoms", x: 1.1, z: 1.8, yawDeg: 90 },
    ],
  },
  {
    id: "dock-fabled-harbor",
    name: "Fabled Harbor Spur",
    blurb: "Longer pier for Fabled island outposts — guard + quest NPC + fisher.",
    kitMeshKey: BRIDGE_TOWN_KIT.publicPath,
    layout: [
      { piece: "BridgeTownKit_StiltsFeet", x: 0, z: 0 },
      { piece: "BridgeTownKit_Stilts", x: 0, z: 0 },
      { piece: "BridgeTownKit_Bridge", x: 0, z: 1 },
      { piece: "BridgeTownKit_Bridge", x: 0, z: 2 },
      { piece: "BridgeTownKit_Bridge", x: 0, z: 3 },
      { piece: "BridgeTownKit_BridgeStair", x: 0, z: 4 },
      { piece: "BridgeTownKit_RoofBridge", x: 0, z: 2 },
      { piece: "BridgeTownKit_RoofBridgeCap", x: 0, z: 3 },
      { piece: "BridgeTownKit_Lamp", x: 0.45, z: 1.5 },
      { piece: "BridgeTownKit_Lamp1", x: -0.45, z: 3 },
      { piece: "BridgeTownKit_Barrel", x: 0.5, z: 2.5 },
    ],
    npcSlots: [
      { id: "fabled-guard", role: "guard", raceId: "high-elves", x: 0.4, z: 3.2, yawDeg: 180 },
      { id: "fabled-quest", role: "quest_npc", raceId: "high-elves", x: -0.3, z: 2.2, yawDeg: 200 },
      { id: "fabled-fisher", role: "fisher", raceId: "western-kingdoms", x: 0.2, z: 3.8, yawDeg: 0 },
    ],
  },
] as const;

/** Faction main town maps. */
export const FACTION_TOWNS: readonly TownMapDef[] = [
  {
    id: "fabled-main-town",
    name: "Fabled Main Town",
    faction: "fabled",
    sectorId: "e",
    tone: "fabled",
    blurb:
      "Fabled faction capital zone (fabledzone.glb) — Starfall Archipelago main town. Harbor docks use Bridge Town kit seeds.",
    meshKeys: ["models/worlds/fabled-zone.glb", "models/worlds/fabledzone.glb"],
    sourcePaths: ["C:/Users/nugye/Desktop/fabledzone.glb"],
    seed: "fabled-main-town-01",
    featured: true,
    npcTableId: "fabled-town-npcs",
    dockSeedIds: ["dock-fabled-harbor", "dock-trade-pier"],
  },
  {
    id: "dwarf-main-city",
    name: "Dwarf Main City (Sky)",
    faction: "dwarf",
    sectorId: "e",
    tone: "frontier",
    blurb:
      "Three.js sky migration — winter castle/town on floating island above fabled great tree. NPCs: grudge6 dwarves. Portals link to elf sky town + ground.",
    meshKeys: [
      "models/worlds/sky/dwarf-main-city.glb",
      "models/worlds/sky/dwarf-winter-castle-town.glb",
    ],
    sourcePaths: [
      "D:/Games/Models/low_poly_winter_medieval_castle_and_town_pack.glb",
      "D:/Games/Models/medieval_town.glb",
    ],
    seed: "dwarf-sky-city-01",
    featured: true,
    npcTableId: "dwarf-city-npcs",
    dockSeedIds: ["dock-trade-pier", "dock-small-fisher"],
  },
  {
    id: "elf-sky-town",
    name: "Elf Sky Town",
    faction: "fabled",
    sectorId: "e",
    tone: "fabled",
    blurb:
      "High-elf temple + floating town assets on a sky island above the great tree, portal-linked to dwarf city and fabled ground.",
    meshKeys: [
      "models/worlds/sky/elf-sky-town.glb",
      "models/worlds/sky/elf-lord-temple.glb",
      "models/worlds/sky/floating-town-hand-painted.glb",
    ],
    sourcePaths: [
      "D:/Games/Models/elf_lord_temple_-_low_poly_handpainted_stylized.glb",
      "D:/Games/Models/floating_town-hand_painted.glb",
    ],
    seed: "elf-sky-town-01",
    featured: true,
    npcTableId: "fabled-town-npcs",
    dockSeedIds: ["dock-fabled-harbor"],
  },
] as const;

/**
 * NPC spawn tables — uMMORPG Entity/Npc style profiles (web prefabs).
 * Characters: grudge6 race meshes, not Unity prefab binaries.
 */
export type NpcSpawnLine = {
  prefabRole: string;
  raceId: RaceId;
  kind: "merchant" | "guard" | "traveler" | "quest_npc" | "commander" | "fisher";
  count: number;
  /** Optional Warlords gear preset */
  presetId?: string;
};

export const NPC_SPAWN_TABLES: Record<string, NpcSpawnLine[]> = {
  "fabled-town-npcs": [
    { prefabRole: "fabled_merchant", raceId: "high-elves", kind: "merchant", count: 4, presetId: "mage" },
    { prefabRole: "fabled_guard", raceId: "high-elves", kind: "guard", count: 6, presetId: "knight" },
    { prefabRole: "fabled_quest", raceId: "high-elves", kind: "quest_npc", count: 3, presetId: "mage" },
    { prefabRole: "fabled_traveler", raceId: "western-kingdoms", kind: "traveler", count: 5, presetId: "ranger" },
    { prefabRole: "fabled_commander", raceId: "high-elves", kind: "commander", count: 1, presetId: "knight" },
  ],
  "dwarf-city-npcs": [
    { prefabRole: "dwarf_merchant", raceId: "dwarves", kind: "merchant", count: 4, presetId: "warrior" },
    { prefabRole: "dwarf_guard", raceId: "dwarves", kind: "guard", count: 8, presetId: "knight" },
    { prefabRole: "dwarf_quest", raceId: "dwarves", kind: "quest_npc", count: 3, presetId: "warrior" },
    { prefabRole: "dwarf_smith", raceId: "dwarves", kind: "merchant", count: 2, presetId: "warrior" },
    { prefabRole: "dwarf_commander", raceId: "dwarves", kind: "commander", count: 1, presetId: "knight" },
  ],
  "island-dock-npcs": [
    { prefabRole: "dock_fisher", raceId: "western-kingdoms", kind: "fisher", count: 2, presetId: "ranger" },
    { prefabRole: "dock_merchant", raceId: "western-kingdoms", kind: "merchant", count: 1, presetId: "warrior" },
    { prefabRole: "dock_guard", raceId: "western-kingdoms", kind: "guard", count: 1, presetId: "knight" },
  ],
};

/**
 * Policy: uMMORPG assets for dwarf main city
 *
 * YES (adopt now):
 *  - uMMORPG *concepts*: Entity/Npc spawn tables, merchant/guard/quest roles
 *  - grudge6 **dwarf** race kits for all city NPCs (web-ready FBX/GLB pipeline)
 *  - Prefab profiles via three/ummorpg/prefabProfile.ts
 *
 * YES after convert (offline bake):
 *  - City *meshes* from ummorpgdev / modularcitybuilder if license allows
 *  - Pipeline: FBX → grudge-convert / Blender → GLB → R2 models/worlds/dwarf-main-city.glb
 *
 * NO:
 *  - Loading raw Unity .unity / .prefab / unconverted FBX in the browser
 *  - Shipping ummorpgdev proprietary packs without license check
 *  - Inventing a second character system parallel to grudge6 + Railway heroes
 */
export const DWARF_CITY_POLICY = {
  npcs: "grudge6 dwarf + uMMORPG-style prefab tables",
  cityMesh: "convert licensed source offline → models/worlds/dwarf-main-city.glb",
  interimMesh: BRIDGE_TOWN_KIT.publicPath,
  references: [
    "content/docs/UMMORPG_ADOPTION.md",
    "three/ummorpg/prefabProfile.ts",
    "three/grudge/raceAssets.ts (dwarf)",
  ],
} as const;

export function getFactionTown(id: string): TownMapDef | undefined {
  return FACTION_TOWNS.find((t) => t.id === id);
}

export function getDockSeed(id: string): DockSeedRecipe | undefined {
  return DOCK_SEED_RECIPES.find((d) => d.id === id);
}

export function docksForTown(townId: string): DockSeedRecipe[] {
  const t = getFactionTown(townId);
  if (!t) return [];
  return t.dockSeedIds
    .map((id) => getDockSeed(id))
    .filter((d): d is DockSeedRecipe => !!d);
}
