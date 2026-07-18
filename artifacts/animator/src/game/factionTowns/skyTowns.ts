/**
 * Fabled sky towns — dwarf main city + elf town on floating islands
 * above the large tree island in fabledzone, linked by portals.
 *
 * Three.js migration SSOT (not Unity). Meshes staged to models/worlds/sky/.
 */

import type { RaceId } from "../../three/grudge/raceAssets";

export type SkyTownId = "dwarf-sky-city" | "elf-sky-town" | "tree-island-ground";

export type SkyPortalLink = {
  id: string;
  /** From sky site */
  from: SkyTownId;
  /** To sky site */
  to: SkyTownId;
  label: string;
  /** Local offset from site origin (m, after site placement) */
  local: { x: number; y: number; z: number };
  /** Destination spawn offset on target site */
  destLocal: { x: number; y: number; z: number };
  /** Portal visual radius (m) */
  radius: number;
  color: number;
};

export type SkySiteDef = {
  id: SkyTownId;
  name: string;
  faction: "dwarf" | "fabled" | "ground";
  blurb: string;
  /**
   * World offset from fabledzone terrain origin (after ForestWorld centers XZ / grounds Y).
   * Floating sites sit high above the large tree island mass.
   */
  world: { x: number; y: number; z: number };
  yawDeg: number;
  /** Target platform footprint diameter (m) for auto-scale */
  platformDiameterM: number;
  /** Town mesh target height (m) */
  townHeightM: number;
  /** Floating rock / island platform mesh keys */
  platformMeshKeys: string[];
  /** City / town mesh keys */
  townMeshKeys: string[];
  sourcePlatform?: string[];
  sourceTown?: string[];
  npcTableId: string;
  /** Race for ambient NPC markers */
  ambientRace: RaceId;
};

/**
 * Placement: large tree island sits near zone origin after ground.
 * Dwarf float: north-east high. Elf float: north-west high.
 * Ground portal: base of tree / rock main.
 */
export const SKY_SITES: readonly SkySiteDef[] = [
  {
    id: "tree-island-ground",
    name: "Great Tree Island",
    faction: "ground",
    blurb: "Fabledzone ground — large tree island. Portals ascend to sky cities.",
    world: { x: 0, y: 0, z: 0 },
    yawDeg: 0,
    platformDiameterM: 0,
    townHeightM: 0,
    platformMeshKeys: [],
    townMeshKeys: [],
    npcTableId: "fabled-town-npcs",
    ambientRace: "high-elves",
  },
  {
    id: "dwarf-sky-city",
    name: "Dwarf Main City (Sky)",
    faction: "dwarf",
    blurb:
      "Three.js migration of dwarf capital on a floating island above the great tree. Winter castle/town pack stand-in until ummorpgdev city bake.",
    world: { x: 48, y: 72, z: -36 },
    yawDeg: 25,
    platformDiameterM: 42,
    townHeightM: 14,
    platformMeshKeys: [
      "models/worlds/sky/floating-island-roots.glb",
      "models/worlds/sky/fantasy-floating-island.glb",
      "models/worlds/sky/floating-island-map.glb",
    ],
    townMeshKeys: [
      "models/worlds/sky/dwarf-main-city.glb",
      "models/worlds/sky/dwarf-winter-castle-town.glb",
      "models/worlds/sky/medieval-town.glb",
    ],
    sourcePlatform: [
      "D:/Games/Models/floating_island_with_roots_and_rocks.glb",
      "D:/Games/Models/fantasy_floating_island.glb",
    ],
    sourceTown: [
      "D:/Games/Models/low_poly_winter_medieval_castle_and_town_pack.glb",
      "D:/Games/Models/medieval_town.glb",
    ],
    npcTableId: "dwarf-city-npcs",
    ambientRace: "dwarves",
  },
  {
    id: "elf-sky-town",
    name: "Elf Sky Town",
    faction: "fabled",
    blurb:
      "High-elf sky settlement — temple + hand-painted floating town assets above the great tree, portal-linked to dwarf city and ground.",
    world: { x: -52, y: 78, z: 28 },
    yawDeg: -40,
    platformDiameterM: 38,
    townHeightM: 12,
    platformMeshKeys: [
      "models/worlds/sky/fantasy-floating-island.glb",
      "models/worlds/sky/floating-island-roots.glb",
      "models/worlds/sky/floating-island-map.glb",
    ],
    townMeshKeys: [
      "models/worlds/sky/elf-sky-town.glb",
      "models/worlds/sky/elf-lord-temple.glb",
      "models/worlds/sky/floating-town-hand-painted.glb",
    ],
    sourcePlatform: [
      "D:/Games/Models/fantasy_floating_island.glb",
      "D:/Games/Models/floating_island_with_roots_and_rocks.glb",
    ],
    sourceTown: [
      "D:/Games/Models/elf_lord_temple_-_low_poly_handpainted_stylized.glb",
      "D:/Games/Models/floating_town-hand_painted.glb",
    ],
    npcTableId: "fabled-town-npcs",
    ambientRace: "high-elves",
  },
] as const;

/** Portals connecting ground tree island ↔ dwarf sky ↔ elf sky. */
export const SKY_PORTALS: readonly SkyPortalLink[] = [
  {
    id: "portal-tree-to-dwarf",
    from: "tree-island-ground",
    to: "dwarf-sky-city",
    label: "Ascend · Dwarf City",
    local: { x: 8, y: 1.2, z: -6 },
    destLocal: { x: 0, y: 1.5, z: 6 },
    radius: 1.6,
    color: 0xc4a574,
  },
  {
    id: "portal-tree-to-elf",
    from: "tree-island-ground",
    to: "elf-sky-town",
    label: "Ascend · Elf Town",
    local: { x: -8, y: 1.2, z: 6 },
    destLocal: { x: 0, y: 1.5, z: 6 },
    radius: 1.6,
    color: 0x88e0a8,
  },
  {
    id: "portal-dwarf-to-elf",
    from: "dwarf-sky-city",
    to: "elf-sky-town",
    label: "Sky Bridge · Elf Town",
    local: { x: -10, y: 1.4, z: 0 },
    destLocal: { x: 10, y: 1.4, z: 0 },
    radius: 1.5,
    color: 0xb48cff,
  },
  {
    id: "portal-elf-to-dwarf",
    from: "elf-sky-town",
    to: "dwarf-sky-city",
    label: "Sky Bridge · Dwarf City",
    local: { x: 10, y: 1.4, z: 0 },
    destLocal: { x: -10, y: 1.4, z: 0 },
    radius: 1.5,
    color: 0xc4a574,
  },
  {
    id: "portal-dwarf-to-tree",
    from: "dwarf-sky-city",
    to: "tree-island-ground",
    label: "Descend · Great Tree",
    local: { x: 0, y: 1.4, z: 8 },
    destLocal: { x: 8, y: 2, z: -6 },
    radius: 1.5,
    color: 0x66ccff,
  },
  {
    id: "portal-elf-to-tree",
    from: "elf-sky-town",
    to: "tree-island-ground",
    label: "Descend · Great Tree",
    local: { x: 0, y: 1.4, z: 8 },
    destLocal: { x: -8, y: 2, z: 6 },
    radius: 1.5,
    color: 0x66ccff,
  },
] as const;

export function getSkySite(id: SkyTownId): SkySiteDef | undefined {
  return SKY_SITES.find((s) => s.id === id);
}

export function portalsFrom(id: SkyTownId): SkyPortalLink[] {
  return SKY_PORTALS.filter((p) => p.from === id);
}
