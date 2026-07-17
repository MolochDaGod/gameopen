/**
 * Local camp claim state — roster, camp skills, placed structure levels.
 * Railway bag bind later (same pattern as grudgeSystems persist).
 */

import type { UnitProgression } from "../game/campClaimCatalog";
import { unitXpToNext } from "../game/campClaimCatalog";

const KEY = (characterId: string) => `open:campClaim:v1:${characterId || "guest"}`;

export type CampUnitInstance = {
  instanceId: string;
  defId: string;
  name: string;
  type: string;
  factionId: string;
  /** RTS production building that trained this unit. */
  producedBy: string;
  level: number;
  xp: number;
  /** Profession levels earned while a unit (carry to hero). */
  professions: Record<string, number>;
  /** If converted, hero character id / marker. */
  convertedHeroId?: string;
  convertedAt?: number;
};

export type CampClaimState = {
  version: 1;
  claimPlanted: boolean;
  campSkillLevels: Record<string, number>;
  /** Structure id → upgrade level */
  structureLevels: Record<string, number>;
  units: CampUnitInstance[];
  heroesFromUnits: Array<{
    heroId: string;
    fromUnitInstanceId: string;
    fromDefId: string;
    name: string;
    equipMaxTier: number;
    professions: Record<string, number>;
    at: number;
  }>;
};

function defaultState(): CampClaimState {
  return {
    version: 1,
    claimPlanted: true,
    campSkillLevels: {},
    structureLevels: {},
    units: [],
    heroesFromUnits: [],
  };
}

/** Seed a few demo roster units so the Units page is playable offline. */
export function ensureDemoRoster(state: CampClaimState): CampClaimState {
  if (state.units.length > 0) return state;
  const demo: CampUnitInstance[] = [
    {
      instanceId: "cu_demo_archer",
      defId: "crusade_archer",
      name: "Archer",
      type: "ranged",
      factionId: "crusade",
      producedBy: "archery",
      level: 42,
      xp: 180,
      professions: { Logging: 8, Forester: 3 },
    },
    {
      instanceId: "cu_demo_soldier",
      defId: "crusade_soldier",
      name: "Soldier",
      type: "melee",
      factionId: "crusade",
      producedBy: "barracks",
      level: 97,
      xp: 40,
      professions: { Mining: 12, Miner: 5 },
    },
    {
      instanceId: "cu_demo_ready",
      defId: "crusade_knight",
      name: "Knight",
      type: "heavy",
      factionId: "crusade",
      producedBy: "barracks",
      level: 100,
      xp: 0,
      professions: { Mining: 18, Miner: 11, Engineering: 4 },
    },
  ];
  return { ...state, units: demo };
}

export function loadCampClaimState(characterId: string): CampClaimState {
  try {
    const raw = localStorage.getItem(KEY(characterId));
    if (!raw) return ensureDemoRoster(defaultState());
    const parsed = JSON.parse(raw) as CampClaimState;
    if (parsed?.version !== 1) return ensureDemoRoster(defaultState());
    return ensureDemoRoster({
      ...defaultState(),
      ...parsed,
      campSkillLevels: parsed.campSkillLevels || {},
      structureLevels: parsed.structureLevels || {},
      units: parsed.units || [],
      heroesFromUnits: parsed.heroesFromUnits || [],
    });
  } catch {
    return ensureDemoRoster(defaultState());
  }
}

export function saveCampClaimState(characterId: string, state: CampClaimState): void {
  try {
    localStorage.setItem(KEY(characterId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleCampClaimSave(characterId: string, state: CampClaimState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveCampClaimState(characterId, state), 200);
}

export function setCampSkillLevel(
  state: CampClaimState,
  skillId: string,
  level: number,
  maxLevel: number,
): CampClaimState {
  const next = Math.max(0, Math.min(maxLevel, Math.floor(level)));
  return {
    ...state,
    campSkillLevels: { ...state.campSkillLevels, [skillId]: next },
  };
}

export function setStructureLevel(
  state: CampClaimState,
  structureId: string,
  level: number,
  maxLevel: number,
): CampClaimState {
  const next = Math.max(0, Math.min(maxLevel, Math.floor(level)));
  return {
    ...state,
    structureLevels: { ...state.structureLevels, [structureId]: next },
  };
}

export function grantUnitXp(
  state: CampClaimState,
  instanceId: string,
  amount: number,
  prog: UnitProgression,
): CampClaimState {
  return {
    ...state,
    units: state.units.map((u) => {
      if (u.instanceId !== instanceId || u.convertedHeroId) return u;
      let level = u.level;
      let xp = u.xp + amount;
      while (level < prog.maxLevel) {
        const need = unitXpToNext(level, prog.maxLevel);
        if (xp < need) break;
        xp -= need;
        level += 1;
      }
      if (level >= prog.maxLevel) {
        level = prog.maxLevel;
        xp = 0;
      }
      return { ...u, level, xp };
    }),
  };
}

export function trainUnit(
  state: CampClaimState,
  unit: Omit<CampUnitInstance, "instanceId" | "level" | "xp" | "professions"> & {
    professions?: Record<string, number>;
  },
): CampClaimState {
  const instance: CampUnitInstance = {
    instanceId: `cu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    defId: unit.defId,
    name: unit.name,
    type: unit.type,
    factionId: unit.factionId,
    producedBy: unit.producedBy,
    level: 1,
    xp: 0,
    professions: unit.professions || {},
  };
  return { ...state, units: [...state.units, instance] };
}

/**
 * Convert a max-level unit into a T0-only L1 hero; professions carry over.
 * Unit is marked converted (stays in history, not active roster).
 */
export function convertUnitToHero(
  state: CampClaimState,
  instanceId: string,
  prog: UnitProgression,
): { state: CampClaimState; ok: boolean; error?: string } {
  const unit = state.units.find((u) => u.instanceId === instanceId);
  if (!unit) return { state, ok: false, error: "Unit not found" };
  if (unit.convertedHeroId) return { state, ok: false, error: "Already converted" };
  if (unit.level < prog.heroConvertAtLevel) {
    return {
      state,
      ok: false,
      error: `Need level ${prog.heroConvertAtLevel} (currently ${unit.level})`,
    };
  }
  const heroId = `hero_from_${unit.defId}_${Date.now().toString(36)}`;
  const professions = prog.professionCarryOver ? { ...unit.professions } : {};
  const nextUnits = state.units.map((u) =>
    u.instanceId === instanceId
      ? { ...u, convertedHeroId: heroId, convertedAt: Date.now() }
      : u,
  );
  return {
    ok: true,
    state: {
      ...state,
      units: nextUnits,
      heroesFromUnits: [
        ...state.heroesFromUnits,
        {
          heroId,
          fromUnitInstanceId: instanceId,
          fromDefId: unit.defId,
          name: `${unit.name} (Hero)`,
          equipMaxTier: prog.heroEquipMaxTier,
          professions,
          at: Date.now(),
        },
      ],
    },
  };
}
