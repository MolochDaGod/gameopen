/**
 * Runtime combat / harvest skill tuning for Danger Room debug (Leva dock).
 *
 * **SSOT for production numbers stays in code** (`weaponSkills.ts`,
 * `harvestTools.ts`, Studio constants). This store only holds **session +
 * localStorage overrides** so designers can live-tune without editing source
 * or fighting the Settings / Admin panels.
 *
 * Isolation rules (no UI conflicts):
 * - Does **not** replace player HUD, Q radial, or catalog skill defs.
 * - Does **not** own locomotion/camera `EditorParams` (Settings panel +
 *   `controlsSettings.ts`). Optional shared knobs are mirrored one-way into
 *   EditorParams via the Leva panel’s `onParam` callback.
 * - Studio reads via {@link getSkillDebug} at cast time; Leva writes via
 *   {@link patchSkillDebug} / {@link setSkillDebug}.
 */

export interface UppercutDebug {
  stamina: number;
  gapMin: number;
  gapMax: number;
  launchUp: number;
  hitRadius: number;
  damage: number;
}

export interface KickDebug {
  /** Hurricane kick stamina (unarmed / dagger / spear). */
  hurricaneStamina: number;
  hurricaneRadius: number;
  hurricaneDamage: number;
  hurricaneLaunch: number;
  hurricaneCd: number;
  /** MMA kick dash + KB (other weapons). */
  mmaStamina: number;
  mmaRadius: number;
  mmaDamage: number;
  mmaForceMult: number;
  mmaLaunch: number;
  mmaCd: number;
}

export interface StabDebug {
  /** Multiplier on open-poke damage. */
  openDamageMult: number;
  /** Multiplier on grab-throw land damage. */
  grabLandDamageMult: number;
  /** Extra recover lock after open poke (seconds). */
  openRecover: number;
}

export interface SkillScaleDebug {
  /** Multiplies weapon-skill damage at cast time. */
  damageMult: number;
  /** Multiplies weapon-skill hit radius. */
  radiusMult: number;
  /** Multiplies weapon / harvest skill stamina costs. */
  staminaMult: number;
}

export interface HarvestScaleDebug {
  radiusMult: number;
  staminaMult: number;
}

export interface SkillDebugParams {
  uppercut: UppercutDebug;
  kick: KickDebug;
  stab: StabDebug;
  skill: SkillScaleDebug;
  harvest: HarvestScaleDebug;
}

export const DEFAULT_SKILL_DEBUG: SkillDebugParams = {
  uppercut: {
    stamina: 52,
    gapMin: 1.0,
    gapMax: 2.0,
    launchUp: 9.4,
    hitRadius: 2.35,
    damage: 40,
  },
  kick: {
    hurricaneStamina: 14,
    hurricaneRadius: 2.3,
    hurricaneDamage: 28,
    hurricaneLaunch: 5.5,
    hurricaneCd: 1.35,
    mmaStamina: 12,
    mmaRadius: 2.2,
    mmaDamage: 30,
    mmaForceMult: 1.55,
    mmaLaunch: 4.2,
    mmaCd: 1.15,
  },
  stab: {
    openDamageMult: 1,
    grabLandDamageMult: 1,
    openRecover: 0.58,
  },
  skill: {
    damageMult: 1,
    radiusMult: 1,
    staminaMult: 1,
  },
  harvest: {
    radiusMult: 1,
    staminaMult: 1,
  },
};

export const SKILL_DEBUG_RANGES = {
  uppercut: {
    stamina: [10, 100] as const,
    gapMin: [0.4, 2.5] as const,
    gapMax: [0.8, 4] as const,
    launchUp: [4, 16] as const,
    hitRadius: [1, 5] as const,
    damage: [8, 120] as const,
  },
  kick: {
    hurricaneStamina: [4, 40] as const,
    hurricaneRadius: [1, 5] as const,
    hurricaneDamage: [8, 80] as const,
    hurricaneLaunch: [0, 12] as const,
    hurricaneCd: [0.3, 4] as const,
    mmaStamina: [4, 40] as const,
    mmaRadius: [1, 5] as const,
    mmaDamage: [8, 80] as const,
    mmaForceMult: [0.5, 3] as const,
    mmaLaunch: [0, 12] as const,
    mmaCd: [0.3, 4] as const,
  },
  stab: {
    openDamageMult: [0.25, 3] as const,
    grabLandDamageMult: [0.25, 3] as const,
    openRecover: [0.2, 1.5] as const,
  },
  skill: {
    damageMult: [0.25, 3] as const,
    radiusMult: [0.25, 3] as const,
    staminaMult: [0.25, 3] as const,
  },
  harvest: {
    radiusMult: [0.25, 3] as const,
    staminaMult: [0.25, 3] as const,
  },
} as const;

const KEY = "dangerroom:skilldebug";
const SCHEMA = 1;

type NumRange = readonly [number, number];

const clampNum = (v: unknown, [min, max]: NumRange, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

function clampUppercut(o: Partial<UppercutDebug> | undefined): UppercutDebug {
  const d = DEFAULT_SKILL_DEBUG.uppercut;
  const r = SKILL_DEBUG_RANGES.uppercut;
  return {
    stamina: clampNum(o?.stamina, r.stamina, d.stamina),
    gapMin: clampNum(o?.gapMin, r.gapMin, d.gapMin),
    gapMax: clampNum(o?.gapMax, r.gapMax, d.gapMax),
    launchUp: clampNum(o?.launchUp, r.launchUp, d.launchUp),
    hitRadius: clampNum(o?.hitRadius, r.hitRadius, d.hitRadius),
    damage: clampNum(o?.damage, r.damage, d.damage),
  };
}

function clampKick(o: Partial<KickDebug> | undefined): KickDebug {
  const d = DEFAULT_SKILL_DEBUG.kick;
  const r = SKILL_DEBUG_RANGES.kick;
  return {
    hurricaneStamina: clampNum(o?.hurricaneStamina, r.hurricaneStamina, d.hurricaneStamina),
    hurricaneRadius: clampNum(o?.hurricaneRadius, r.hurricaneRadius, d.hurricaneRadius),
    hurricaneDamage: clampNum(o?.hurricaneDamage, r.hurricaneDamage, d.hurricaneDamage),
    hurricaneLaunch: clampNum(o?.hurricaneLaunch, r.hurricaneLaunch, d.hurricaneLaunch),
    hurricaneCd: clampNum(o?.hurricaneCd, r.hurricaneCd, d.hurricaneCd),
    mmaStamina: clampNum(o?.mmaStamina, r.mmaStamina, d.mmaStamina),
    mmaRadius: clampNum(o?.mmaRadius, r.mmaRadius, d.mmaRadius),
    mmaDamage: clampNum(o?.mmaDamage, r.mmaDamage, d.mmaDamage),
    mmaForceMult: clampNum(o?.mmaForceMult, r.mmaForceMult, d.mmaForceMult),
    mmaLaunch: clampNum(o?.mmaLaunch, r.mmaLaunch, d.mmaLaunch),
    mmaCd: clampNum(o?.mmaCd, r.mmaCd, d.mmaCd),
  };
}

function clampStab(o: Partial<StabDebug> | undefined): StabDebug {
  const d = DEFAULT_SKILL_DEBUG.stab;
  const r = SKILL_DEBUG_RANGES.stab;
  return {
    openDamageMult: clampNum(o?.openDamageMult, r.openDamageMult, d.openDamageMult),
    grabLandDamageMult: clampNum(o?.grabLandDamageMult, r.grabLandDamageMult, d.grabLandDamageMult),
    openRecover: clampNum(o?.openRecover, r.openRecover, d.openRecover),
  };
}

function clampSkill(o: Partial<SkillScaleDebug> | undefined): SkillScaleDebug {
  const d = DEFAULT_SKILL_DEBUG.skill;
  const r = SKILL_DEBUG_RANGES.skill;
  return {
    damageMult: clampNum(o?.damageMult, r.damageMult, d.damageMult),
    radiusMult: clampNum(o?.radiusMult, r.radiusMult, d.radiusMult),
    staminaMult: clampNum(o?.staminaMult, r.staminaMult, d.staminaMult),
  };
}

function clampHarvest(o: Partial<HarvestScaleDebug> | undefined): HarvestScaleDebug {
  const d = DEFAULT_SKILL_DEBUG.harvest;
  const r = SKILL_DEBUG_RANGES.harvest;
  return {
    radiusMult: clampNum(o?.radiusMult, r.radiusMult, d.radiusMult),
    staminaMult: clampNum(o?.staminaMult, r.staminaMult, d.staminaMult),
  };
}

export function normalizeSkillDebug(raw: unknown): SkillDebugParams {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_SKILL_DEBUG);
  const o = raw as Partial<SkillDebugParams> & { schema?: number };
  return {
    uppercut: clampUppercut(o.uppercut),
    kick: clampKick(o.kick),
    stab: clampStab(o.stab),
    skill: clampSkill(o.skill),
    harvest: clampHarvest(o.harvest),
  };
}

/** In-memory cache so Studio hot path avoids JSON.parse every cast. */
let cache: SkillDebugParams | null = null;

export function loadSkillDebug(): SkillDebugParams {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = structuredClone(DEFAULT_SKILL_DEBUG);
      return cache;
    }
    const o = JSON.parse(raw) as Partial<SkillDebugParams> & { schema?: number };
    if (o.schema !== SCHEMA) {
      cache = structuredClone(DEFAULT_SKILL_DEBUG);
      return cache;
    }
    cache = normalizeSkillDebug(o);
    return cache;
  } catch {
    cache = structuredClone(DEFAULT_SKILL_DEBUG);
    return cache;
  }
}

/** Hot path: current overrides (loads once). */
export function getSkillDebug(): SkillDebugParams {
  return loadSkillDebug();
}

export function saveSkillDebug(p: SkillDebugParams): void {
  const next = normalizeSkillDebug(p);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, ...next }));
  } catch {
    /* private mode / quota — keep memory cache only */
  }
}

export function setSkillDebug(p: SkillDebugParams): void {
  saveSkillDebug(p);
}

export function patchSkillDebug(patch: DeepPartialSkillDebug): SkillDebugParams {
  const cur = getSkillDebug();
  const next: SkillDebugParams = {
    uppercut: { ...cur.uppercut, ...(patch.uppercut ?? {}) },
    kick: { ...cur.kick, ...(patch.kick ?? {}) },
    stab: { ...cur.stab, ...(patch.stab ?? {}) },
    skill: { ...cur.skill, ...(patch.skill ?? {}) },
    harvest: { ...cur.harvest, ...(patch.harvest ?? {}) },
  };
  saveSkillDebug(next);
  return getSkillDebug();
}

export function resetSkillDebug(): SkillDebugParams {
  cache = structuredClone(DEFAULT_SKILL_DEBUG);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return cache;
}

/** Export JSON for baking tuned numbers back into source catalogs. */
export function exportSkillDebugJson(): string {
  return JSON.stringify({ schema: SCHEMA, ...getSkillDebug() }, null, 2);
}

export type DeepPartialSkillDebug = {
  uppercut?: Partial<UppercutDebug>;
  kick?: Partial<KickDebug>;
  stab?: Partial<StabDebug>;
  skill?: Partial<SkillScaleDebug>;
  harvest?: Partial<HarvestScaleDebug>;
};
