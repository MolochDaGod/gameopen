/**
 * Volcano / Hellmaw world-boss + minion SSOT.
 *
 * Assets (local → public/models):
 *  - bosses/shadow-flame-mantis.glb  (Shadow Flame Mantis — world boss)
 *  - enemies/volcano/minecraft-ghast.glb  (ranged minion / Shadow Call summons)
 *
 * Allowed on: boss event islands, volcanic / Hellmaw sector islands.
 * Yardstick: human 1.8 m — mantis boss ~3.2 m tall, ghast ~2.4 m float body.
 */

export const HUMAN_HEIGHT_M = 1.8;

/** Clip names from the source GLB (do not rename without re-bake). */
export const MANTIS_CLIPS = {
  idle: "Idle",
  walk: "Walk",
  run: "Run",
  grab: "Grabbing Munch",
  charge: "Rushing Charge",
  upperStab: "Flaming Upper Stab",
  /** Ability: smoke VFX + spawn 2 ghasts */
  shadowCall: "Shadow Call",
  burningSlice: "Burning Slice",
  nuclearSlice: "Nuclear Slice",
} as const;

export const GHAST_CLIPS = {
  idle: "Idle",
  fire: "Fire",
} as const;

export type BossAbilityId =
  | "grab"
  | "charge"
  | "upperStab"
  | "shadowCall"
  | "burningSlice"
  | "nuclearSlice";

export type VolcanoBossUnit = {
  id: string;
  name: string;
  role: "world_boss" | "volcano_ranged" | "summon";
  meshKeys: string[];
  /** Target height (metres) after fit — relative to 1.8 m human. */
  heightM: number;
  hp: number;
  damage: number;
  speed: number;
  atkReach: number;
  aggroRange: number;
  xp: number;
  tags: string[];
  /** Island / sector placement gates */
  allowOn: Array<"boss_event" | "volcanic" | "hellmaw" | "event_island">;
  animClips: Record<string, string>;
  abilities?: BossAbilityId[];
};

export const SHADOW_FLAME_MANTIS: VolcanoBossUnit = {
  id: "shadow_flame_mantis",
  name: "Shadow Flame Mantis",
  role: "world_boss",
  meshKeys: [
    "models/bosses/shadow-flame-mantis.prod.glb",
    "models/bosses/shadow-flame-mantis.glb",
  ],
  /** ~1.8× human — readable world boss, not 100× junk */
  heightM: 3.2,
  hp: 4200,
  damage: 48,
  speed: 3.4,
  atkReach: 3.2,
  aggroRange: 42,
  xp: 1200,
  tags: [
    "world_boss",
    "volcano",
    "hellmaw",
    "boss_event",
    "mantis",
    "shadow_flame",
  ],
  allowOn: ["boss_event", "volcanic", "hellmaw", "event_island"],
  animClips: { ...MANTIS_CLIPS },
  abilities: [
    "grab",
    "charge",
    "upperStab",
    "shadowCall",
    "burningSlice",
    "nuclearSlice",
  ],
};

export const VOLCANO_GHAST: VolcanoBossUnit = {
  id: "volcano_ghast",
  name: "Ash Ghast",
  role: "volcano_ranged",
  meshKeys: [
    "models/enemies/volcano/minecraft-ghast.prod.glb",
    "models/enemies/volcano/minecraft-ghast.glb",
  ],
  heightM: 2.4,
  hp: 180,
  damage: 22,
  speed: 2.8,
  atkReach: 28,
  aggroRange: 36,
  xp: 95,
  tags: ["volcano", "hellmaw", "ranged", "flying", "ghast", "minion"],
  allowOn: ["boss_event", "volcanic", "hellmaw", "event_island"],
  animClips: { ...GHAST_CLIPS },
};

/** Hellmaw Depths (sector s) world-boss pin — local island coords. */
export const HELLMAW_WORLD_BOSS_SPAWN = {
  sectorId: "s",
  sectorName: "Hellmaw Depths",
  /** Offset from island origin (metres, XZ ground) */
  x: 12,
  y: 0,
  z: -8,
  /** Patrol radius around pin */
  patrolRadius: 18,
  /** Ambient ash ghasts near caldera (not summons) */
  ambientGhastCount: 2,
  ambientGhastRadius: 22,
};

export type AbilityDef = {
  id: BossAbilityId;
  clip: string;
  /** Cooldown seconds */
  cd: number;
  /** Windup before damage / effect */
  windup: number;
  /** Active window length */
  active: number;
  damageMul: number;
  range: number;
  /** Min HP fraction remaining to prefer this (0–1); ultimates when low */
  preferBelowHp?: number;
  telegraph: string;
};

export const MANTIS_ABILITIES: AbilityDef[] = [
  {
    id: "grab",
    clip: MANTIS_CLIPS.grab,
    cd: 7,
    windup: 0.35,
    active: 0.55,
    damageMul: 1.1,
    range: 3.0,
    telegraph: "Grabbing Munch",
  },
  {
    id: "charge",
    clip: MANTIS_CLIPS.charge,
    cd: 11,
    windup: 0.4,
    active: 0.7,
    damageMul: 1.25,
    range: 12,
    telegraph: "Rushing Charge",
  },
  {
    id: "upperStab",
    clip: MANTIS_CLIPS.upperStab,
    cd: 6,
    windup: 0.3,
    active: 0.45,
    damageMul: 1.15,
    range: 3.4,
    telegraph: "Flaming Upper Stab",
  },
  {
    id: "shadowCall",
    clip: MANTIS_CLIPS.shadowCall,
    cd: 22,
    windup: 0.55,
    active: 1.1,
    damageMul: 0.35,
    range: 8,
    telegraph: "Shadow Call — smoke & ghasts",
  },
  {
    id: "burningSlice",
    clip: MANTIS_CLIPS.burningSlice,
    cd: 9,
    windup: 0.35,
    active: 0.5,
    damageMul: 1.35,
    range: 3.6,
    telegraph: "Burning Slice",
  },
  {
    id: "nuclearSlice",
    clip: MANTIS_CLIPS.nuclearSlice,
    cd: 32,
    /** Telegraph + dual orbit meteors (half circle) */
    windup: 0.45,
    /** Orbit duration ~2.4s + impact settle */
    active: 2.6,
    damageMul: 1.8,
    range: 9,
    preferBelowHp: 0.5,
    telegraph: "Nuclear Slice — dual meteor orbit + shockwave",
  },
];

/** Ultimate tuning (vfxgrudge O = meteor; D/A = shockwave/knockback). */
export const MANTIS_ULTIMATE = {
  meteorRadiusM: 7,
  meteorDurationSec: 2.4,
  meteorWarnRadiusM: 2.4,
  meteorDamage: 36,
  /** Continuous shockwave pulse while ultimate runs */
  shockwavePulseSec: 0.45,
  shockwaveRadiusM: 3.2,
  /** Knockback + damage for anything ≤ this distance from boss */
  pointBlankM: 1.0,
  pointBlankDamage: 22,
  knockbackSpeed: 14,
  knockbackHop: 0.35,
} as const;

/** Ghast fire pattern (vfxgrudge C = fireball). */
export const GHAST_FIRE = {
  castSec: 1.5,
  coneSec: 2.0,
  fireballDamageMul: 1.0,
  coneDamagePerTick: 6,
  coneTickSec: 0.25,
  coneRangeM: 9,
  cooldownSec: 5.5,
} as const;

export function unitAllowedOn(
  unit: VolcanoBossUnit,
  context: { archetype?: string; sectorId?: string; eventTags?: string[] },
): boolean {
  const arch = (context.archetype || "").toLowerCase();
  const tags = new Set((context.eventTags || []).map((t) => t.toLowerCase()));
  const sector = (context.sectorId || "").toLowerCase();

  if (unit.allowOn.includes("hellmaw") && (sector === "s" || arch.includes("hellmaw"))) {
    return true;
  }
  if (
    unit.allowOn.includes("volcanic") &&
    (arch.includes("volcan") || arch.includes("ash") || tags.has("volcanic"))
  ) {
    return true;
  }
  if (
    unit.allowOn.includes("boss_event") &&
    (arch === "boss" || arch.includes("boss") || tags.has("boss_event") || tags.has("world_boss"))
  ) {
    return true;
  }
  if (
    unit.allowOn.includes("event_island") &&
    (arch === "event" || tags.has("event") || tags.has("event_island"))
  ) {
    return true;
  }
  return false;
}

export const VOLCANO_BOSS_CATALOG = {
  version: "1.0.0",
  humanHeightM: HUMAN_HEIGHT_M,
  units: {
    shadow_flame_mantis: SHADOW_FLAME_MANTIS,
    volcano_ghast: VOLCANO_GHAST,
  },
  hellmawSpawn: HELLMAW_WORLD_BOSS_SPAWN,
  abilities: MANTIS_ABILITIES,
} as const;
