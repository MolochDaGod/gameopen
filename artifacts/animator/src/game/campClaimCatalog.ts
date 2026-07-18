/**
 * Camp claim flag SSOT — territory hub for build rights, units, farming, taming.
 *
 * Rules (product):
 *  - Claim flag grants build rights for structures / production / defensives.
 *  - Quick-craft (campfire, sleeping bag, torch, …) is NOT claim-gated.
 *  - Units spawn from RTS production buildings; level 1–100.
 *  - At level 100 a unit may convert to a level-1 hero (T0 equip only).
 *  - Profession levels earned as a unit carry over to the hero variant.
 *
 * Catalogs: local content/camp + fleet (factionUnits, master-buildings, nodeUpgrades).
 */

import { fetchCatalogJson } from "../lib/fleetSsot";

export type CampPageId =
  | "skills"
  | "farming"
  | "taming"
  | "defensives"
  | "units"
  | "buildings"
  | "upgrades";

export type CampPageDef = {
  id: CampPageId;
  label: string;
  summary: string;
};

export type UnitProgression = {
  minLevel: number;
  maxLevel: number;
  heroConvertAtLevel: number;
  heroStartLevel: number;
  heroEquipMaxTier: number;
  heroEquipNote: string;
  professionCarryOver: boolean;
  professionCarryNote: string;
  source: string;
  catalogs?: Record<string, string>;
  assetHints?: string[];
};

export type ProductionBuilding = {
  id: string;
  name: string;
  role: string;
  producesTypes: string[];
  assetLine: string;
  claimGated: boolean;
  maxLevel: number;
};

export type CampDefensive = {
  id: string;
  name: string;
  assetLine: string;
  tier: number;
};

export type CampFarmPlot = {
  id: string;
  name: string;
  assetLine: string;
  yield: string;
  tier: number;
};

export type CampTameFacility = {
  id: string;
  name: string;
  desc: string;
  tier: number;
  claimGated: boolean;
};

export type CampAccountSkill = {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  icon?: string;
  iconUrl?: string;
  /** Craftpix / achievement header badge (optional secondary art). */
  achievementBadge?: string;
};

export type QuickCraftItem = {
  id: string;
  name: string;
  uuid?: string;
  tags?: string[];
};

export type ClaimFlagDoc = {
  version: string;
  id: string;
  label: string;
  description: string;
  claim: {
    buildingUuid: string;
    name: string;
    category: string;
    iconUrl?: string;
    radiusM: number;
    grantsBuildRights: boolean;
    tags?: string[];
  };
  pages: CampPageDef[];
  quickCraft: {
    note: string;
    excludeFromClaimGate: QuickCraftItem[];
  };
  unitProgression: UnitProgression;
  productionBuildings: ProductionBuilding[];
  defensives: CampDefensive[];
  farming: CampFarmPlot[];
  taming: CampTameFacility[];
  accountCampSkills: CampAccountSkill[];
  stationBuildingsFromMaster?: {
    includeCategories: string[];
    excludeTags: string[];
    excludeNames: string[];
  };
};

export type MasterBuilding = {
  uuid: string;
  name: string;
  category: string;
  profession?: string;
  tier?: number;
  iconUrl?: string;
  description?: string;
  buildMaterials?: Array<{ name: string; quantity: number }>;
  tags?: string[];
};

export type FactionUnitDef = {
  id: string;
  name: string;
  type: string;
  spritePath?: string;
  description?: string;
  stats?: {
    health?: number;
    speed?: number;
    attackDamage?: number;
    attackRange?: number;
    attackCooldown?: number;
    size?: number;
  };
};

export type FactionUnitsCatalog = {
  version?: string;
  totalUnits?: number;
  unitTypes?: string[];
  factions: Record<
    string,
    {
      id: string;
      name: string;
      color?: string;
      description?: string;
      units: FactionUnitDef[];
    }
  >;
};

export type NodeUpgradesCatalog = {
  version?: string;
  unitTiers?: Record<string, Record<string, string[]>>;
  nodeTypes?: Record<
    string,
    {
      type: string;
      description?: string;
      upgrades?: Array<{
        level: number;
        cost: number;
        spawnRate?: number;
        health?: number;
        visionRadius?: number;
      }>;
    }
  >;
};

const LOCAL_CLAIM = `${import.meta.env.BASE_URL}content/camp/claim-flag.json`;

let claimCache: ClaimFlagDoc | null = null;
let unitsCache: FactionUnitsCatalog | null = null;
let buildingsCache: MasterBuilding[] | null = null;
let upgradesCache: NodeUpgradesCatalog | null = null;

async function fetchLocalJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Load claim-flag hub SSOT (local first, then fleet). */
export async function loadClaimFlagDoc(): Promise<ClaimFlagDoc | null> {
  if (claimCache) return claimCache;
  const local = await fetchLocalJson<ClaimFlagDoc>(LOCAL_CLAIM);
  if (local?.pages?.length) {
    claimCache = local;
    return local;
  }
  const fleet = await fetchCatalogJson<ClaimFlagDoc>("camp-claim-flag.json");
  if (fleet?.pages?.length) {
    claimCache = fleet;
    return fleet;
  }
  return null;
}

export async function loadFactionUnits(): Promise<FactionUnitsCatalog | null> {
  if (unitsCache) return unitsCache;
  const data = await fetchCatalogJson<FactionUnitsCatalog>("factionUnits.json");
  if (data?.factions) unitsCache = data;
  return unitsCache;
}

export async function loadMasterBuildings(): Promise<MasterBuilding[]> {
  if (buildingsCache) return buildingsCache;
  const data = await fetchCatalogJson<{ buildings?: MasterBuilding[] }>("master-buildings.json");
  buildingsCache = data?.buildings ?? [];
  return buildingsCache;
}

export async function loadNodeUpgrades(): Promise<NodeUpgradesCatalog | null> {
  if (upgradesCache) return upgradesCache;
  const data = await fetchCatalogJson<NodeUpgradesCatalog>("nodeUpgrades.json");
  if (data) upgradesCache = data;
  return upgradesCache;
}

/** True if a building is quick-craft (not claim-gated). */
export function isQuickCraftBuilding(
  b: MasterBuilding,
  doc: ClaimFlagDoc | null,
): boolean {
  const name = (b.name || "").toLowerCase();
  const tags = (b.tags || []).map((t) => t.toLowerCase());
  if (tags.includes("campfire") || tags.includes("quick_craft")) return true;
  if (name === "campfire") return true;
  if (doc?.quickCraft?.excludeFromClaimGate) {
    for (const q of doc.quickCraft.excludeFromClaimGate) {
      if (q.uuid && q.uuid === b.uuid) return true;
      if (q.name && q.name.toLowerCase() === name) return true;
      if (q.id && tags.includes(q.id)) return true;
    }
  }
  // Tier 0 utility without profession = field kit
  if (b.tier === 0 && b.category === "utility") return true;
  return false;
}

/**
 * Buildings the claim flag UI may place — stations / storage / territory /
 * production. Excludes quick-craft field items.
 */
export function filterClaimGatedBuildings(
  buildings: MasterBuilding[],
  doc: ClaimFlagDoc | null,
): MasterBuilding[] {
  const include = doc?.stationBuildingsFromMaster?.includeCategories ?? [
    "crafting_station",
    "storage",
    "territory",
  ];
  return buildings.filter((b) => {
    if (isQuickCraftBuilding(b, doc)) return false;
    if (include.includes(b.category)) return true;
    // Utility repair/dye/ship docks still claim-gated when not quick-craft
    if (b.category === "utility" && (b.tier ?? 0) >= 1) return true;
    return false;
  });
}

/** Flat list of all faction units. */
export function flattenFactionUnits(cat: FactionUnitsCatalog | null): Array<
  FactionUnitDef & { factionId: string; factionName: string; factionColor?: string }
> {
  if (!cat?.factions) return [];
  const out: Array<
    FactionUnitDef & { factionId: string; factionName: string; factionColor?: string }
  > = [];
  for (const [fid, f] of Object.entries(cat.factions)) {
    for (const u of f.units || []) {
      out.push({
        ...u,
        factionId: fid,
        factionName: f.name,
        factionColor: f.color,
      });
    }
  }
  return out;
}

/** Map unit combat type → preferred production building id. */
export function productionBuildingForUnitType(
  unitType: string,
  production: ProductionBuilding[],
): ProductionBuilding | undefined {
  const t = unitType.toLowerCase();
  return production.find((p) => p.producesTypes.map((x) => x.toLowerCase()).includes(t));
}

export function canConvertUnitToHero(
  level: number,
  prog: UnitProgression | undefined,
): boolean {
  if (!prog) return false;
  return level >= prog.heroConvertAtLevel;
}

export function unitXpToNext(level: number, maxLevel: number): number {
  if (level >= maxLevel) return 0;
  // Soft curve: ~100 base + 8 per level
  return Math.round(100 + level * 8);
}

export type ConvertedHeroPreview = {
  unitId: string;
  unitName: string;
  unitLevel: number;
  heroLevel: number;
  equipMaxTier: number;
  professions: Record<string, number>;
  note: string;
};

export function previewHeroConvert(
  unit: { id: string; name: string; level: number; professions: Record<string, number> },
  prog: UnitProgression,
): ConvertedHeroPreview | null {
  if (!canConvertUnitToHero(unit.level, prog)) return null;
  return {
    unitId: unit.id,
    unitName: unit.name,
    unitLevel: unit.level,
    heroLevel: prog.heroStartLevel,
    equipMaxTier: prog.heroEquipMaxTier,
    professions: prog.professionCarryOver ? { ...unit.professions } : {},
    note: [
      prog.heroEquipNote,
      prog.professionCarryNote,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
