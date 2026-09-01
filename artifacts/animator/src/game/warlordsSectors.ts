/**
 * Warlords-era 9-sector overworld meta (client mirror).
 *
 * Authoritative sailing math + island placement lives in warlord-genesis:
 *   `lib/world-content/src/sectors.ts` (SECTOR_GRID = 3 → 9 cells).
 *
 * HARD RULE: Sectors are **in-Warlords-game only**. Open library must never
 * list them as standalone titles — play via Grudge Warlords client
 * (`client.grudge-studio.com` / grudgewarlords.com). This file is labels/meta
 * for docs + fleet wiring, not Open launch tiles.
 */

export const WARLORDS_SECTOR_GRID = 3;
export const WARLORDS_SECTOR_COUNT = WARLORDS_SECTOR_GRID * WARLORDS_SECTOR_GRID;

export type WarlordsSectorTone =
  | "crusade"
  | "fabled"
  | "legion"
  | "pirate"
  | "neutral"
  | "frontier";

export interface WarlordsSectorMeta {
  id: string;
  sx: number;
  sz: number;
  name: string;
  subtitle: string;
  tone: WarlordsSectorTone;
}

/** Lore names for the 9 sectors (NW→SE) — keep in sync with warlord-genesis SECTOR_META. */
export const WARLORDS_SECTOR_META: WarlordsSectorMeta[] = [
  { id: "nw", sx: 0, sz: 0, name: "Frozen Expanse", subtitle: "Northern Ethereal Falls", tone: "frontier" },
  { id: "n", sx: 1, sz: 0, name: "Odin's Reach", subtitle: "Crusade northern seas", tone: "crusade" },
  { id: "ne", sx: 2, sz: 0, name: "Gilded Frontier", subtitle: "Crusade trade routes", tone: "crusade" },
  { id: "w", sx: 0, sz: 1, name: "Forgotten Shoals", subtitle: "Western ruins & lighthouses", tone: "neutral" },
  { id: "c", sx: 1, sz: 1, name: "Sanctuary Waters", subtitle: "Waterfall Isle hub — no PvP", tone: "neutral" },
  {
    id: "e",
    sx: 2,
    sz: 1,
    name: "Starfall Archipelago",
    subtitle: "Fabled eastern realms · main town fabledzone.glb",
    tone: "fabled",
  },
  { id: "sw", sx: 0, sz: 2, name: "Wildwood Drift", subtitle: "Legion western approach", tone: "legion" },
  { id: "s", sx: 1, sz: 2, name: "Hellmaw Depths", subtitle: "Legion volcanic south", tone: "legion" },
  { id: "se", sx: 2, sz: 2, name: "Pirate Expanse", subtitle: "Freeport & lawless coves", tone: "pirate" },
];

export function warlordsSectorById(id: string): WarlordsSectorMeta | undefined {
  return WARLORDS_SECTOR_META.find((s) => s.id === id);
}

export function warlordsSectorAt(sx: number, sz: number): WarlordsSectorMeta {
  return (
    WARLORDS_SECTOR_META.find((m) => m.sx === sx && m.sz === sz) ??
    WARLORDS_SECTOR_META[4]!
  );
}

/**
 * Chicken Gun / PolygonPirates lobby — Warlords opening + tutorial mesh only.
 * Not a GRUDOX product; not an Explorer game; not an Open library tile.
 * @see client.grudge-studio.com/island-3d?mode=lobby&map=pirate-islands
 * @see client.grudge-studio.com/tutorial
 */
export const WARLORDS_PIRATE_LOBBY = {
  mapId: "pirate-islands",
  meshCdn: "https://assets.grudge-studio.com/models/lobby/pirate-islands/scene.glb",
  lobbyPath: "/island-3d?mode=lobby&map=pirate-islands",
  tutorialPath: "/tutorial",
  roles: ["opening", "tutorial", "era-center-lobby"] as const,
  notProducts: ["grudox", "explorer", "open-standalone"] as const,
} as const;

/** Production pillars wired into the Warlords-era client. */
export const WARLORDS_PRODUCTION_PILLARS = [
  {
    id: "pirate-lobby",
    label: "Chicken Gun pirate lobby = opening + tutorial",
    host: "client.grudge-studio.com · map=pirate-islands (not GRUDOX/Explorer)",
  },
  { id: "sectors", label: "9 sailing sectors", host: "warlord-genesis / grudgewarlords.com" },
  {
    id: "aethermoor-map",
    label: "Aethermoor world map + event-island conveyor",
    host: "warlord-genesis lib/world-content (aethermoor + eventConveyor) · Railway player SSOT",
  },
  { id: "heroes", label: "4-slot campfire heroes", host: "Railway Postgres · era=warlords" },
  { id: "units", label: "Explorers = units (not the pirate lobby product)", host: "factionUnits + explorer rig" },
  { id: "rts", label: "RTS lanes / buildings", host: "warlord-genesis + RTS-Grudge" },
  { id: "sailing", label: "Water / wind / ships", host: "SailEnvironment · sectors" },
  { id: "combat", label: "Hero + unit combat", host: "Danger Room · genesis · jungle camps" },
  { id: "harvest", label: "Auto harvest / craft", host: "Production UI · professions API" },
] as const;
