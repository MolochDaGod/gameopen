/**
 * Weapon reticle SSOT — shape, pulse, and AoE expand rules for the HUD crosshair.
 *
 *   sword / melee  → centre **dot** (minimal; free-aim ticks optional soft)
 *   bow            → **X** cross (archer mark)
 *   gun / xbow     → classic **+** crosshair ticks
 *   staff / magic  → **ring** that breathes (scale pulse); expands into AoE
 *                    ground-radius indicator when casting AoE skills
 *
 * UI layers (settings/admin) still use CursorManager — this only drives the
 * combat HUD reticle while playing.
 */

/**
 * Fleet SSOT — lives in @workspace/grudge-physics so every Open surface and
 * external host can import one reticle map. Weapon ids are plain strings
 * (no dependency on animator WeaponId / getWeapon).
 */

/** Visual family of the screen reticle. */
export type ReticleShape = "dot" | "x" | "cross" | "ring";

/** Loose weapon id string (matches Open WeaponId union). */
export type ReticleWeaponId = string;

export type WeaponGroupHint =
  | "unarmed"
  | "melee-1h"
  | "melee-2h"
  | "off-hand"
  | "ranged"
  | "magic";

export interface ReticleProfile {
  shape: ReticleShape;
  /**
   * Soft idle pulse speed (Hz-ish). 0 = static.
   * Staffs breathe; others stay still unless blooming from recoil.
   */
  pulseHz: number;
  /** Pulse amplitude as fraction of base size (0.12 = ±12%). */
  pulseAmp: number;
  /**
   * When true, an active AoE cast expands this reticle into a large ring whose
   * on-screen scale tracks the ability radius (screen % of viewport height).
   */
  aoeExpand: boolean;
  /** CSS accent token class suffix (matches index.css). */
  accent: "melee" | "bow" | "gun" | "magic";
  /** Default gap between ticks (px) before movement/recoil bloom. */
  baseGap: number;
  /** Show fixed centre reference dot under free-aim offset. */
  showCenterDot: boolean;
}

const MELEE: ReticleProfile = {
  shape: "dot",
  pulseHz: 0,
  pulseAmp: 0,
  aoeExpand: false,
  accent: "melee",
  baseGap: 0,
  showCenterDot: true,
};

const BOW: ReticleProfile = {
  shape: "x",
  pulseHz: 0,
  pulseAmp: 0,
  aoeExpand: false,
  accent: "bow",
  baseGap: 4,
  showCenterDot: false,
};

const GUN: ReticleProfile = {
  shape: "cross",
  pulseHz: 0,
  pulseAmp: 0,
  aoeExpand: false,
  accent: "gun",
  baseGap: 3,
  showCenterDot: true,
};

const MAGIC: ReticleProfile = {
  shape: "ring",
  pulseHz: 0.85,
  pulseAmp: 0.14,
  aoeExpand: true,
  accent: "magic",
  baseGap: 0,
  showCenterDot: true,
};

/** Explicit weapon overrides (id beats group). */
const BY_ID: Record<string, ReticleProfile> = {
  none: MELEE,
  sword: MELEE,
  greatsword: MELEE,
  axe: MELEE,
  greataxe: MELEE,
  dagger: MELEE,
  spear: MELEE,
  javelin: MELEE,
  hammer: MELEE,
  hammer2h: MELEE,
  mace: MELEE,
  scythe: MELEE,
  shield: MELEE,
  gunblade: GUN,
  bow: BOW,
  crossbow: { ...GUN, accent: "bow", baseGap: 5 },
  pistol: GUN,
  rifle: GUN,
  "hunter-rifle": { ...GUN, baseGap: 2 },
  shotgun: { ...GUN, baseGap: 8 },
  staff: MAGIC,
  staffFire: MAGIC,
  staffIce: MAGIC,
  staffStorm: MAGIC,
  staffNature: MAGIC,
  staffHoly: MAGIC,
  wand: MAGIC,
  tome: MAGIC,
};

const BY_GROUP: Record<WeaponGroupHint, ReticleProfile> = {
  unarmed: MELEE,
  "melee-1h": MELEE,
  "melee-2h": MELEE,
  "off-hand": MELEE,
  ranged: GUN,
  magic: MAGIC,
};

/**
 * Resolve reticle profile for the equipped weapon.
 * Pass optional `group` when the host knows roster family (avoids local asset lookup).
 */
export function reticleProfileForWeapon(
  weaponId: ReticleWeaponId | undefined | null,
  group?: WeaponGroupHint | null,
): ReticleProfile {
  if (!weaponId) return group ? BY_GROUP[group] ?? MELEE : MELEE;
  if (BY_ID[weaponId]) return BY_ID[weaponId]!;
  if (group && BY_GROUP[group]) return BY_GROUP[group];
  // Heuristic for unregistered fleet weapons
  if (/bow/i.test(weaponId)) return BOW;
  if (/staff|wand|tome|magic/i.test(weaponId)) return MAGIC;
  if (/rifle|pistol|gun|shotgun|crossbow/i.test(weaponId)) return GUN;
  return MELEE;
}

/**
 * Screen-space ring scale (0.5–1 = idle; up to ~4 when casting large AoE).
 * `aoeRadiusM` is world metres; converted heuristically to reticle scale.
 */
export function aoeReticleScale(aoeRadiusM: number, basePulse = 1): number {
  if (aoeRadiusM <= 0) return basePulse;
  // ~1 m → 1.15 scale, ~6 m → ~2.8, clamp so HUD never fills the whole screen
  return Math.min(4.2, 1 + aoeRadiusM * 0.32) * basePulse;
}
