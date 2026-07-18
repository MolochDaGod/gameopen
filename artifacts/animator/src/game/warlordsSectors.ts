/**
 * Warlords-era 9-sector overworld meta (client mirror).
 *
 * Authoritative sailing math + island placement lives in warlord-genesis:
 *   `lib/world-content/src/sectors.ts` (SECTOR_GRID = 3 → 9 cells).
 * Open / gameopen uses this for launch labels, deploy docs, and fleet wiring
 * without importing the full world-content package.
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

/** Production pillars wired into the Warlords-era client. */
export const WARLORDS_PRODUCTION_PILLARS = [
  { id: "sectors", label: "9 sailing sectors", host: "warlord-genesis / grudgewarlords.com" },
  { id: "heroes", label: "4-slot campfire heroes", host: "Railway Postgres · era=warlords" },
  { id: "units", label: "Explorers = units", host: "factionUnits + explorer rig" },
  { id: "rts", label: "RTS lanes / buildings", host: "warlord-genesis + RTS-Grudge" },
  { id: "sailing", label: "Water / wind / ships", host: "SailEnvironment · sectors" },
  { id: "combat", label: "Hero + unit combat", host: "Danger Room · genesis · jungle camps" },
  { id: "harvest", label: "Auto harvest / craft", host: "Production UI · professions API" },
] as const;
