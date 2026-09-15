/**
 * Character vitals — wraps Open statsEngine (8 ATTR) + need pools.
 * SSOT: https://info.grudge-studio.com/character-builder.html
 *       https://info.grudge-studio.com/api/v1/master-attributes.json
 * Allocation stays 8. O2 / hunger / thirst are progress.stats need pools.
 */
import {
  calculateDerivedStats,
  effectivePoints as engineEffectivePoints,
  type AttrKey,
  type AttrMap,
} from "../lib/grudgeSystems/statsEngine";

export const BUILDER_ATTR_IDS = [
  "strength",
  "vitality",
  "endurance",
  "intellect",
  "wisdom",
  "dexterity",
  "agility",
  "tactics",
] as const;

export type BuilderAttrId = (typeof BUILDER_ATTR_IDS)[number];

export type NeedPoolId = "oxygen" | "hunger" | "thirst";

export type CharacterVitals = {
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  armor: number;
  maxOxygen: number;
  maxHunger: number;
  maxThirst: number;
};

const TO_ENGINE: Record<BuilderAttrId, AttrKey> = {
  strength: "STR",
  vitality: "VIT",
  endurance: "END",
  intellect: "INT",
  wisdom: "WIS",
  dexterity: "DEX",
  agility: "AGI",
  tactics: "TAC",
};

export function effectivePoints(raw: number): number {
  return engineEffectivePoints(Math.max(0, Number(raw) || 0));
}

function toEngineAttrs(src?: Record<string, number>): Partial<AttrMap> {
  const out: Partial<AttrMap> = {};
  if (!src) return out;
  for (const id of BUILDER_ATTR_IDS) {
    const pascal = id.charAt(0).toUpperCase() + id.slice(1);
    const n = Number(src[id] ?? src[pascal] ?? src[TO_ENGINE[id]] ?? 0);
    if (n) out[TO_ENGINE[id]] = n;
  }
  return out;
}

/** Max pools from allocated attributes (statsEngine + need pools). */
export function deriveCharacterVitals(
  attributes?: Record<string, number>,
): CharacterVitals {
  const d = calculateDerivedStats(toEngineAttrs(attributes), 1);
  return {
    maxHealth: Math.max(1, Math.floor(d.maxHP || 100)),
    maxMana: Math.max(0, Math.floor(d.maxMana || 0)),
    maxStamina: Math.max(1, Math.floor(d.maxStamina || 100)),
    armor: Math.max(0, Math.floor(d.armor || d.defense || 0)),
    maxOxygen: Math.max(1, Math.floor(d.maxOxygen || 80)),
    maxHunger: Math.max(1, Math.floor(d.maxHunger || 100)),
    maxThirst: Math.max(1, Math.floor(d.maxThirst || 80)),
  };
}

export const NEED_DRAIN = {
  hungerPerSec: 0.15,
  thirstPerSec: 0.22,
  oxygenUnderwaterPerSec: 8,
  oxygenSurfaceRegenPerSec: 12,
  manaRegenPerSec: 2,
  staminaRegenPerSec: 8,
} as const;

export type VitalsState = {
  health: number;
  mana: number;
  stamina: number;
  armor: number;
  oxygen: number;
  hunger: number;
  thirst: number;
} & CharacterVitals;

export function fillVitals(max: CharacterVitals, cur?: Partial<VitalsState>): VitalsState {
  return {
    ...max,
    health: clampPool(cur?.health ?? max.maxHealth, max.maxHealth),
    mana: clampPool(cur?.mana ?? max.maxMana, max.maxMana),
    stamina: clampPool(cur?.stamina ?? max.maxStamina, max.maxStamina),
    armor: max.armor,
    oxygen: clampPool(cur?.oxygen ?? max.maxOxygen, max.maxOxygen),
    hunger: clampPool(cur?.hunger ?? max.maxHunger, max.maxHunger),
    thirst: clampPool(cur?.thirst ?? max.maxThirst, max.maxThirst),
  };
}

function clampPool(v: number, max: number) {
  return Math.max(0, Math.min(max, Number(v) || 0));
}

/** Tick need + regen pools. Underwater drains oxygen; surface restores it. */
export function tickVitals(
  state: VitalsState,
  dt: number,
  opts: { underwater?: boolean } = {},
): VitalsState {
  const next = { ...state };
  const t = Math.max(0, dt);
  next.hunger = clampPool(next.hunger - NEED_DRAIN.hungerPerSec * t, next.maxHunger);
  next.thirst = clampPool(next.thirst - NEED_DRAIN.thirstPerSec * t, next.maxThirst);
  if (opts.underwater) {
    next.oxygen = clampPool(
      next.oxygen - NEED_DRAIN.oxygenUnderwaterPerSec * t,
      next.maxOxygen,
    );
  } else {
    next.oxygen = clampPool(
      next.oxygen + NEED_DRAIN.oxygenSurfaceRegenPerSec * t,
      next.maxOxygen,
    );
  }
  next.mana = clampPool(next.mana + NEED_DRAIN.manaRegenPerSec * t, next.maxMana);
  next.stamina = clampPool(
    next.stamina + NEED_DRAIN.staminaRegenPerSec * t,
    next.maxStamina,
  );
  if (next.oxygen <= 0) {
    next.health = clampPool(next.health - 6 * t, next.maxHealth);
  }
  if (next.hunger <= 0 || next.thirst <= 0) {
    next.stamina = clampPool(next.stamina - 4 * t, next.maxStamina);
  }
  return next;
}

export function vitalsToProgressStats(v: VitalsState): Record<string, number> {
  return {
    health: v.health,
    maxHealth: v.maxHealth,
    mana: v.mana,
    maxMana: v.maxMana,
    stamina: v.stamina,
    maxStamina: v.maxStamina,
    armor: v.armor,
    maxArmor: v.armor,
    oxygen: v.oxygen,
    maxOxygen: v.maxOxygen,
    hunger: v.hunger,
    maxHunger: v.maxHunger,
    thirst: v.thirst,
    maxThirst: v.maxThirst,
  };
}
