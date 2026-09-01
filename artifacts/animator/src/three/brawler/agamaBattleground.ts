/**
 * Agama Survival battleground contract — scale, zones, harvest, factions,
 * LOS/aggro, combat memory, extraction. Pure data (no Three.js) so the
 * map-fit policy and AI rules stay unit-testable.
 *
 * Scale bug this module exists to kill:
 *   Sketchfab/FBX Agama already has a 0.01 cm→m child. Measuring the ~2 km
 *   authored span then applying another 0.01 + TARGET_SPAN=90 crushed farms
 *   and harvestables to dollhouse size next to a 1.8 m player.
 */

export const AGAMA_PLAYER_HEIGHT_M = 1.8;

/** Crops / gatherables a standing character can swing at. */
export const AGAMA_HARVEST_HEIGHT_M = 1.15;
export const AGAMA_TREE_HEIGHT_M = 4.2;
export const AGAMA_ORE_HEIGHT_M = 0.85;

/** Farm plot a character can walk through (not a texture stamp). */
export const AGAMA_FARM_PLOT = { w: 16, d: 22 } as const;

/**
 * Survival playable span floor. Agama native is ~1.5–2 km after correct
 * units; never shrink below this. If a fallback map is tiny, pad terrain.
 */
export const AGAMA_MIN_SPAN_M = 420;
export const AGAMA_TARGET_SPAN_M = 720;

export const AGAMA_CAMERA_FAR = 1800;
export const AGAMA_CAMERA_NEAR = 0.18;
export const AGAMA_FOG_NEAR = 110;
export const AGAMA_FOG_FAR = 680;

/** LOD distances (m) from the player. */
export const AGAMA_LOD_NEAR = 72;
export const AGAMA_LOD_MID = 180;
export const AGAMA_LOD_FAR = 340;
export const AGAMA_LOD_CULL = 520;

export const AGAMA_AGGRO_LOS_M = 42;
export const AGAMA_AGGRO_HEARING_M = 16;
export const AGAMA_LEASH_M = 62;
export const AGAMA_ALLY_ASSIST_M = 28;

export const AGAMA_HARVEST_REACH_M = 2.15;
export const AGAMA_EXTRACT_RADIUS_M = 14;

export type AgamaFactionId = "player" | "ally" | "orc" | "crusade" | "neutral";

export type AgamaZoneKind =
  | "safe"
  | "farm"
  | "harvest"
  | "camp"
  | "war"
  | "extract";

export interface AgamaZone {
  id: string;
  name: string;
  kind: AgamaZoneKind;
  faction: AgamaFactionId;
  x: number;
  z: number;
  r: number;
}

export interface AgamaHarvestNode {
  id: string;
  kind: "crop" | "wood" | "ore" | "fiber";
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  yieldQty: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface Occluder2 {
  x: number;
  z: number;
  r: number;
}

export interface CombatMemory {
  hitsTaken: number;
  hitsLanded: number;
  skillHitsTaken: number;
  lastDamageFrom: Vec2 | null;
  /** Metres the fighter prefers after learning. */
  preferredRange: number;
  /** 0..1 chance to strafe/dodge after a hit. */
  dodgeBias: number;
  /** 0..1 extra weight on skill-like lunges. */
  skillWeight: number;
}

export function createCombatMemory(baseRange = 1.8): CombatMemory {
  return {
    hitsTaken: 0,
    hitsLanded: 0,
    skillHitsTaken: 0,
    lastDamageFrom: null,
    preferredRange: baseRange,
    dodgeBias: 0.08,
    skillWeight: 0.12,
  };
}

/** Enemy/ally learns from landing a hit — press harder, use skills more. */
export function rememberHitLanded(mem: CombatMemory, usedSkill: boolean): CombatMemory {
  const skillHits = mem.skillHitsTaken;
  return {
    ...mem,
    hitsLanded: mem.hitsLanded + 1,
    skillWeight: clamp01(mem.skillWeight + (usedSkill ? 0.06 : 0.015)),
    preferredRange: mix(mem.preferredRange, usedSkill ? mem.preferredRange : mem.preferredRange * 0.96, 0.25),
    skillHitsTaken: skillHits,
  };
}

/** Fighter learns from being hurt — space out, dodge, remember direction. */
export function rememberDamageTaken(
  mem: CombatMemory,
  from: Vec2,
  dist: number,
  wasSkill: boolean,
): CombatMemory {
  const dodge = clamp01(mem.dodgeBias + (wasSkill ? 0.1 : 0.045));
  const prefer = wasSkill
    ? Math.max(mem.preferredRange, dist + 1.4)
    : mix(mem.preferredRange, Math.max(1.2, dist * 0.85), 0.35);
  return {
    ...mem,
    hitsTaken: mem.hitsTaken + 1,
    skillHitsTaken: mem.skillHitsTaken + (wasSkill ? 1 : 0),
    lastDamageFrom: { x: from.x, z: from.z },
    dodgeBias: dodge,
    preferredRange: prefer,
  };
}

export function desiredEngageRange(mem: CombatMemory, weaponReach: number): number {
  return Math.max(weaponReach * 0.85, Math.min(weaponReach + 6, mem.preferredRange));
}

export interface MapScaleInput {
  spanXZ: number;
  height: number;
  /** True when an FBX/Sketchfab child already carries ~0.01 uniform scale. */
  hasFbxCmChild: boolean;
  /** Optional measured barn-door / human-portal height (m) at current scale. */
  doorHeight?: number;
}

export interface MapScaleDecision {
  unitScale: number;
  playScale: number;
  /** If native span is below the battleground floor, pad generated terrain to this. */
  padToSpan: number;
  reason: string;
}

/**
 * Unit conversion only. Never shrink a correctly-scaled world to a 90 m pad.
 * Battleground maps that are already human-scale (doors ~1.6–3 m, FBX 0.01
 * present, kilometre span) keep authored metres.
 */
export function decideAgamaMapScale(input: MapScaleInput, battleground: boolean): MapScaleDecision {
  const door = input.doorHeight ?? 0;
  let unitScale = 1;
  let reason = "authored-metres";

  if (input.hasFbxCmChild) {
    unitScale = 1;
    reason = "fbx-cm-child-already-applied";
  } else if (door > 20 && door < 400) {
    unitScale = 0.01;
    reason = "door-height-cm";
  } else if (input.spanXZ > 800 && input.height > 80 && !input.hasFbxCmChild) {
    unitScale = 0.01;
    reason = "span-height-cm";
  } else if (input.spanXZ < 0.6 && input.height < 0.6) {
    unitScale = 100;
    reason = "span-too-tiny";
  }

  const doorAfter = door > 0 ? door * unitScale : 0;
  if (doorAfter > 0 && doorAfter < 0.55 && unitScale === 1 && !input.hasFbxCmChild) {
    unitScale = 0.01;
    reason = "door-still-miniature";
  }

  const spanAfter = input.spanXZ * unitScale;
  let playScale = 1;
  if (!battleground) {
    // Ruins brawler may still clamp a giant unused pad — survival must not.
    const target = 90;
    if (spanAfter > target * 1.8) playScale = target / spanAfter;
  }

  const finalSpan = spanAfter * playScale;
  const padToSpan = battleground ? Math.max(finalSpan, AGAMA_MIN_SPAN_M) : finalSpan;

  return { unitScale, playScale, padToSpan, reason };
}

/** 2D LOS: a segment from `from` to `to` blocked by fat occluder discs. */
export function hasLineOfSight(from: Vec2, to: Vec2, occluders: readonly Occluder2[], fat = 0.55): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return true;
  const inv = 1 / len;
  const ux = dx * inv;
  const uz = dz * inv;
  for (const o of occluders) {
    const r = o.r + fat;
    const vx = o.x - from.x;
    const vz = o.z - from.z;
    const t = vx * ux + vz * uz;
    if (t <= 0.4 || t >= len - 0.4) continue;
    const px = from.x + ux * t;
    const pz = from.z + uz * t;
    if (Math.hypot(o.x - px, o.z - pz) < r) return false;
  }
  return true;
}

export function inAgroRange(
  self: Vec2,
  target: Vec2,
  los: boolean,
  hearing = AGAMA_AGGRO_HEARING_M,
  sight = AGAMA_AGGRO_LOS_M,
): boolean {
  const d = Math.hypot(target.x - self.x, target.z - self.z);
  if (d <= hearing) return true;
  return los && d <= sight;
}

export function shouldLeash(self: Vec2, home: Vec2, aggro: boolean): boolean {
  const d = Math.hypot(self.x - home.x, self.z - home.z);
  if (!aggro) return d > 3.5;
  return d > AGAMA_LEASH_M;
}

export function zoneAt(zones: readonly AgamaZone[], x: number, z: number): AgamaZone | null {
  let best: AgamaZone | null = null;
  let bestD = Infinity;
  for (const z0 of zones) {
    const d = Math.hypot(x - z0.x, z - z0.z);
    if (d <= z0.r && d < bestD) {
      best = z0;
      bestD = d;
    }
  }
  return best;
}

export interface AgamaLayout {
  zones: AgamaZone[];
  harvest: AgamaHarvestNode[];
  extract: AgamaZone;
  spawn: Vec2;
  half: number;
}

/**
 * Place farms, harvest rings, faction camps, and the extraction objective
 * relative to a measured map half-extent and a spawn (player-node or south farm).
 */
export function buildAgamaLayout(half: number, spawn: Vec2): AgamaLayout {
  const H = Math.max(AGAMA_MIN_SPAN_M * 0.5, half);
  const spawnSafe: AgamaZone = {
    id: "safe-farm",
    name: "Amida Farm Camp",
    kind: "safe",
    faction: "player",
    x: spawn.x,
    z: spawn.z,
    r: 18,
  };
  const farmEast: AgamaZone = {
    id: "farm-east",
    name: "East Allotments",
    kind: "farm",
    faction: "ally",
    x: spawn.x + Math.min(90, H * 0.28),
    z: spawn.z + Math.min(24, H * 0.08),
    r: 32,
  };
  const farmWest: AgamaZone = {
    id: "farm-west",
    name: "West Pasture",
    kind: "farm",
    faction: "ally",
    x: spawn.x - Math.min(80, H * 0.24),
    z: spawn.z + Math.min(18, H * 0.06),
    r: 28,
  };
  const allyCamp: AgamaZone = {
    id: "camp-ally",
    name: "Kingdom Outpost",
    kind: "camp",
    faction: "ally",
    x: spawn.x + Math.min(40, H * 0.12),
    z: spawn.z - Math.min(50, H * 0.16),
    r: 22,
  };
  const orcCamp: AgamaZone = {
    id: "camp-orc",
    name: "Orc War Camp",
    kind: "war",
    faction: "orc",
    x: spawn.x + Math.min(70, H * 0.22),
    z: spawn.z + Math.min(H * 0.55, H * 0.62),
    r: 36,
  };
  const crusade: AgamaZone = {
    id: "camp-crusade",
    name: "Crusade Line",
    kind: "war",
    faction: "crusade",
    x: spawn.x - Math.min(95, H * 0.3),
    z: spawn.z + Math.min(H * 0.4, H * 0.48),
    r: 30,
  };
  const harvestRidge: AgamaZone = {
    id: "harvest-ridge",
    name: "Timber Ridge",
    kind: "harvest",
    faction: "neutral",
    x: spawn.x - Math.min(40, H * 0.14),
    z: spawn.z + Math.min(H * 0.28, H * 0.32),
    r: 40,
  };
  const extract: AgamaZone = {
    id: "extract",
    name: "North Extraction",
    kind: "extract",
    faction: "neutral",
    x: spawn.x,
    z: spawn.z + Math.min(H * 0.82, H - 28),
    r: AGAMA_EXTRACT_RADIUS_M,
  };

  const zones = [
    spawnSafe,
    farmEast,
    farmWest,
    allyCamp,
    orcCamp,
    crusade,
    harvestRidge,
    extract,
  ];

  const harvest: AgamaHarvestNode[] = [];
  scatterHarvest(harvest, farmEast, "crop", 10);
  scatterHarvest(harvest, farmWest, "fiber", 8);
  scatterHarvest(harvest, harvestRidge, "wood", 12);
  scatterHarvest(harvest, orcCamp, "ore", 6);

  return { zones, harvest, extract, spawn, half: H };
}

function scatterHarvest(
  out: AgamaHarvestNode[],
  zone: AgamaZone,
  kind: AgamaHarvestNode["kind"],
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + zone.r * 0.01;
    const rad = zone.r * (0.28 + (i % 3) * 0.18);
    out.push({
      id: `${zone.id}-${kind}-${i}`,
      kind,
      x: zone.x + Math.sin(a) * rad,
      z: zone.z + Math.cos(a) * rad,
      hp: kind === "ore" ? 40 : kind === "wood" ? 28 : 16,
      maxHp: kind === "ore" ? 40 : kind === "wood" ? 28 : 16,
      yieldQty: kind === "ore" ? 3 : 2,
    });
  }
}

export function harvestYieldCredits(kind: AgamaHarvestNode["kind"]): number {
  switch (kind) {
    case "ore":
      return 14;
    case "wood":
      return 8;
    case "fiber":
      return 6;
    default:
      return 5;
  }
}

export function hostileToward(
  a: AgamaFactionId,
  b: AgamaFactionId,
): boolean {
  if (a === b || a === "neutral" || b === "neutral") return false;
  if (a === "player" && b === "ally") return false;
  if (a === "ally" && b === "player") return false;
  return true;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
