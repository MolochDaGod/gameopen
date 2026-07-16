/**
 * Gun combat loadouts — class GUN subtypes.
 *
 * Design:
 *  - Pistol (revolver): 5-shot cylinder, 1 bullet per LMB
 *  - Rifle: 18-round clip, 3-round burst per LMB
 *  - Sniper (`hunter-rifle`): 12-round, single hard shot
 *  - Shotgun: 6-shell tube, cone pellets per LMB
 *  - Tap F: reload · Hold F: full discharge (plasma charge)
 *  - Skill 3: vault · turret / breath on 2 & 4 per family (see arsenal/gunClass)
 *  - Enemy raised guard = forcefield; consecutive hits / kick break shield
 *
 * SSOT for models, 6-tier ladders, skill/anim/VFX patterns: {@link gunClass}.
 */
import type { WeaponId } from "./types";
import {
  GUN_FAMILIES,
  gunFamilyForWeapon,
  gunLoadoutForTier,
  isGunFamilyWeapon,
  type GunFamilyId,
} from "./arsenal/gunClass";

export type GunId = "pistol" | "rifle" | "hunter-rifle" | "shotgun";

export function isGunWeapon(id: WeaponId): boolean {
  return isGunFamilyWeapon(id);
}

export interface GunLoadout {
  /** Rounds in a full clip / cylinder / tube. */
  clip: number;
  /** Bullets fired per LMB press (shotgun still 1 “shell” → multi pellets). */
  burst: number;
  /** Seconds between LMB presses. */
  fireLock: number;
  /** Base damage per bullet / pellet. */
  damage: number;
  /** Tap-F reload time (s). */
  reloadTime: number;
  /** Hold-F charge before full discharge (s). */
  chargeTime: number;
  /** Tracer / muzzle color. */
  color: number;
  /** Plasma charge color on barrel. */
  plasmaColor: number;
}

/** Shotgun cone primary tuning. */
export const SHOTGUN = {
  /** Pellets per shell. */
  pellets: 7,
  /** Half-angle of cone (radians). */
  halfAngle: 0.22,
  /** Max pellet travel (m). */
  range: 9,
  /** Extra knockback mul vs rifle. */
  forceMul: 1.35,
  /** Close-range damage mul (< 3 m). */
  closeMul: 1.45,
  closeRange: 3.0,
} as const;

export const GUN_LOADOUT: Record<GunId, GunLoadout> = {
  pistol: { ...GUN_FAMILIES.pistol.loadout },
  rifle: { ...GUN_FAMILIES.rifle.loadout },
  "hunter-rifle": { ...GUN_FAMILIES.sniper.loadout },
  shotgun: { ...GUN_FAMILIES.shotgun.loadout },
};

/** Forcefield / parry rules for gunfire vs raised enemy guard. */
export const GUN_SHIELD = {
  /** Fraction of bullet damage that gets through a raised block. */
  damageMul: 0.15,
  /** Consecutive blocked bullets that drop the shield (shield-break). */
  hitsToBreak: 7,
  /** Damage returned to shooter on perfect parry reflect. */
  reflectDamage: 14,
  /** Force of reflected bolt knockback (× skillForce). */
  reflectForceMul: 0.55,
  /** shieldBreak seconds after kick / bomb / trap from a gunner. */
  utilityBreakSec: 3.5,
  /** Max knockback force mul for a clean gun hit. */
  hitForceMul: 0.42,
} as const;

export function gunLoadout(id: WeaponId, tier = 0): GunLoadout | null {
  const fam = gunFamilyForWeapon(id);
  if (!fam) return null;
  if (tier <= 0) return { ...GUN_LOADOUT[id as GunId] };
  return gunLoadoutForTier(fam, tier);
}

export function gunFamilyId(id: WeaponId): GunFamilyId | null {
  return gunFamilyForWeapon(id)?.id ?? null;
}

export function isShotgunWeapon(id: WeaponId): boolean {
  return id === "shotgun";
}

export function isSniperWeapon(id: WeaponId): boolean {
  return id === "hunter-rifle";
}
