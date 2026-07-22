/**
 * Grudge fleet combat constants — CANONICAL for Open, Voxel, Warlords, RTS hosts.
 *
 * Pure numbers only (no Three.js). Hosts bind these to animation cuts / VFX colors.
 * Do not redefine dodge/slide/parry/stamina in game apps — import from here.
 */

/** Physical action stamina costs (absolute points). */
export const FLEET_STAMINA_COST = {
  uppercut: 16,
  stab: 14,
  throw: 18,
  jump: 8,
  doubleJump: 12,
  slide: 22,
  /** Block raise / parry use CombatConfig; kept 0 here for Studio extra tax. */
  blockTap: 0,
  parryExtra: 0,
} as const;

/**
 * Dodge (KeyX) — stamina-scaled travel.
 * Cost = staminaFrac × maxStamina (or remaining). Min dist under lowStaminaRatio.
 * maxDistance is full-stamina travel (+0.5 m over historical 4.4 baseline → 4.9).
 */
export const FLEET_DODGE = {
  duration: 0.72,
  iframeStart: 0.06,
  iframeEnd: 0.56,
  /** Full-stamina max travel (metres). */
  maxDistance: 4.9,
  /** Floor when stamina ratio &lt; lowStaminaRatio. */
  minDistance: 0.5,
  /** Fraction of max stamina spent per dodge. */
  staminaFrac: 0.4,
  /** Below this ratio, distance locks to minDistance. */
  lowStaminaRatio: 0.15,
  cooldown: 0.78,
  invuln: 0.55,
} as const;

/** Combat slide (Alt) — trip volume + rear push. */
export const FLEET_SLIDE = {
  distance: 3.4,
  rearPushM: 0.85,
  duration: 0.55,
  cooldown: 0.95,
  staminaCost: FLEET_STAMINA_COST.slide,
  hitRadius: 1.15,
  damage: 16,
  poiseDamage: 28,
  force: 2,
  /** Stuck on raised block. */
  blockStunSec: 0.2,
  /** Clip ids hosts should resolve (first match wins). */
  animClips: [
    "slide",
    "running-slide",
    "running_slide",
    "great-sword-slide-attack",
    "dashAttack",
  ] as const,
} as const;

/** Parry (KeyC) success / fail package. */
export const FLEET_PARRY = {
  perfectWindow: 0.12,
  deflectWindow: 0.3,
  staminaCost: 18,
  invuln: 0.22,
  forceFieldRadius: 1.1,
  forceFieldLife: 0.5,
  stunOnSuccess: 1.4,
  uppercutDashM: 2.35,
  uppercutDashDur: 0.12,
  uppercutDelay: 0.08,
  uppercutUpVel: 9.4,
  uppercutDamage: 26,
  uppercutRadius: 2.6,
  failStamRecoverSec: 2.0,
  failStamDebt: 22,
  /** Directional parry clip priority by threat side. */
  animBySide: {
    left: ["blockLeft", "parryReact", "parry", "blockReact", "block"] as const,
    right: ["blockRight", "parryReact", "parry", "blockReact", "block"] as const,
    front: ["parryReact", "parry", "blockReact", "blockStart", "block"] as const,
  },
} as const;

/** Canonical production slash projectile variant ids (Getsuga mesh family). */
export const FLEET_SLASH_VARIANTS = [
  "slashred",
  "slashblue",
  "slashpurple",
  "slashyellow",
] as const;

export type FleetSlashVariantId = (typeof FLEET_SLASH_VARIANTS)[number];

/** Paths relative to game public / CDN. */
export const FLEET_SLASH_MESH_PATH: Record<FleetSlashVariantId, string> = {
  slashred: "models/vfx/slash/slashred.glb",
  slashblue: "models/vfx/slash/slashblue.glb",
  slashpurple: "models/vfx/slash/slashpurple.glb",
  slashyellow: "models/vfx/slash/slashyellow.glb",
};

export const FLEET_SLASH_FALLBACK_MESH = "models/vfx/stylized_ice_bow.glb";

/**
 * Canonical combat input map — hosts MUST bind these (or document remaps).
 * Voxel / Warlords / Open share this semantic map.
 */
export const FLEET_COMBAT_INPUT = {
  /** Timed parry window */
  parry: "KeyC",
  /** Stamina-scaled i-frame roll */
  dodge: "KeyX",
  /** Combat slide (trip) — Alt alone; Alt+letter still sandbox VFX */
  slide: "AltLeft",
  slideAlt: "AltRight",
  /** Forcefield / hold block pulse */
  block: "KeyE",
  /** Stab / thrust */
  stab: "KeyZ",
  /** Utility kick / shadow parry */
  kick: "KeyV",
  /** Stomp finisher */
  stomp: "KeyT",
  /** Heavy / R skill */
  heavy: "KeyR",
  /** F skill / charge */
  skill: "KeyF",
  /** Throw consumable */
  throw: "KeyH",
  /** Jump / double jump */
  jump: "Space",
  /** Focus lock toggle */
  focus: "MouseRight",
  /** Primary attack */
  attack: "MouseLeft",
  /** Signature skill slots */
  skill1: "Digit1",
  skill2: "Digit2",
  skill3: "Digit3",
  skill4: "Digit4",
} as const;

export type FleetCombatInputAction = keyof typeof FLEET_COMBAT_INPUT;
