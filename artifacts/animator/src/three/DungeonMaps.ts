/**
 * Selectable gameplay maps loaded behind the Danger Room door (the {@link
 * Dungeon} system). Each entry is just a GLB level file plus a label/blurb for
 * the picker; the Dungeon loader auto-scales the model and bakes its own
 * colliders + navmesh, so any reasonably-sized scene GLB can be dropped in here.
 *
 * The choice is persisted per browser session (mirroring {@link RoomPresets}) so
 * the next dungeon entry reuses it. `enterDungeon` reads {@link loadDungeonMap}
 * at entry time — no extra Studio↔App plumbing needed.
 */

import { packPieceById } from "./packs/openMeshPacks";

export type DungeonMapId = "default" | "chicken-gun-town" | "modular-crypt" | "npc-village";

export interface DungeonMap {
  id: DungeonMapId;
  name: string;
  /** One-line blurb shown in the picker. */
  blurb: string;
  /** GLB file under `public/` (resolved through `asset()`). */
  file: string;
  /**
   * Author metres already SI (1.8 m human fits). Dungeon.load must not grow
   * these to the 46 m combat footprint — that turns 2.9 m walls into 13 m.
   */
  keepSi?: boolean;
}

export const DUNGEON_MAPS: Record<DungeonMapId, DungeonMap> = {
  default: {
    id: "default",
    name: "Forge Depths",
    blurb: "The original dungeon level — tight corridors and a sealed boss pit.",
    file: "models/minecraft-kit.glb",
  },
  "chicken-gun-town": {
    id: "chicken-gun-town",
    name: "Chicken Gun Town",
    blurb: "Open small-town test map — streets and buildings for ranged duels.",
    file: "models/chicken-gun-town.glb",
  },
  "modular-crypt": {
    id: "modular-crypt",
    name: "Modular Crypt",
    blurb: "Gapless 5×5 low-poly dungeon tiles (floors + walls + door). Isolated pieces, 2 m snap.",
    file: packPieceById("mod-crypt")?.file ?? "models/packs/modular-dungeon/assembled-crypt.glb",
    keepSi: true,
  },
  "npc-village": {
    id: "npc-village",
    name: "NPC Village",
    blurb: "Mineways village — 28 fused block-type layers (Oak_Planks, Chest, …), not houses.",
    file: packPieceById("vil-map")?.file ?? "models/packs/npc-village/npc-village.glb",
    keepSi: true,
  },
};

export const DUNGEON_MAP_LIST: DungeonMap[] = [
  DUNGEON_MAPS.default,
  DUNGEON_MAPS["chicken-gun-town"],
  DUNGEON_MAPS["modular-crypt"],
  DUNGEON_MAPS["npc-village"],
];

const STORAGE_KEY = "dangerroom:dungeon-map";

/** Narrow an arbitrary string to a known map id (or null when unknown). */
export function asDungeonMapId(v: string | null | undefined): DungeonMapId | null {
  return v === "default" || v === "chicken-gun-town" || v === "modular-crypt" || v === "npc-village"
    ? v
    : null;
}

/** Read the session-persisted map choice (defaults to the original level). */
export function loadDungeonMap(): DungeonMapId {
  try {
    return asDungeonMapId(sessionStorage.getItem(STORAGE_KEY)) ?? "default";
  } catch {
    return "default";
  }
}

/** Persist the map choice for the current browser session. */
export function saveDungeonMap(id: DungeonMapId): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* no-op */
  }
}
