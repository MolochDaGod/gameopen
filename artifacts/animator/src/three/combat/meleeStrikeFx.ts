/**
 * Deterministic melee strike VFX + physics feedback profiles.
 *
 * NO Math.random for arc selection — combo stage + weapon family maps to a
 * stable slash crescent index and authored params (see slashSettings).
 *
 * Covers: slash arc, weapon-collider trail emphasis, optional projectile,
 * ground AoE telegraph, knockback / knock-up on connect.
 */

import type { WeaponId } from "../types";
import { getWeapon } from "../assets";
import type { SlashFxParams } from "../slashSettings";
import { DEFAULT_SLASH_FX } from "../slashSettings";

export type MeleeStrikeKind =
  | "light"
  | "mid"
  | "heavy"
  | "finisher"
  | "thrust"
  | "cleave";

export type MeleeStrikeFxProfile = {
  /** Human label for debug / combat flash. */
  id: string;
  kind: MeleeStrikeKind;
  /**
   * Stable index into attack-slashes.glb mesh list (sorted by name).
   * 0..n-1; clamped at runtime if fewer arcs loaded.
   */
  arcIndex: number;
  /** Optional second arc (same family, offset) — never random. */
  secondaryArcIndex?: number;
  secondaryDelay?: number;
  /** Authored crescent params (rotate/scale/direction/bend/thickness/particles/color). */
  arc: SlashFxParams;
  secondaryArc?: SlashFxParams;
  /** Blade trail color (collider grip→tip ribbon). */
  trailColor: number;
  /** Extend trail sampling window as fraction of swing (0.3–0.7). */
  trailWindow: number;
  /** Soft cast aura / ring at swing peak. */
  swingAura: boolean;
  /** Deploy a short projectile along swing dir on impact. */
  projectile?: {
    kind: "slash_wave" | "bolt" | "none";
    speed: number;
    range: number;
    color: number;
  };
  /** Ground AoE on connect (radius m). 0 = none. */
  aoeRadius: number;
  aoeColor: number;
  /** Horizontal knockback force (m/s impulse scale via Targets.playerHit force). */
  knockback: number;
  /** Vertical launch (knock-up) for finishers / heavies. */
  knockUp: number;
  /** Fire-aura intensity on connect (0 = skip). */
  fireAuraScale: number;
  /** Extra poise / force tier for CombatController. */
  forceTier: 1 | 2 | 3;
};

const HEX = (n: number) =>
  `#${n.toString(16).padStart(6, "0")}`;

function arcParams(
  partial: Partial<SlashFxParams> & { colorHex?: number },
): SlashFxParams {
  const color =
    partial.color ??
    (partial.colorHex != null ? HEX(partial.colorHex) : DEFAULT_SLASH_FX.color);
  return {
    ...DEFAULT_SLASH_FX,
    ...partial,
    color,
  };
}

/** 1H sword / dagger / axe — diagonal light → horizontal mid → heavy cleave. */
const ONE_HAND: MeleeStrikeFxProfile[] = [
  {
    id: "1h_light",
    kind: "light",
    arcIndex: 0,
    arc: arcParams({
      rotate: -28,
      scale: 0.95,
      direction: -12,
      bend: 0.15,
      thickness: 0.85,
      particles: 6,
      colorHex: 0xb8e8ff,
    }),
    trailColor: 0xb8e8ff,
    trailWindow: 0.42,
    swingAura: true,
    aoeRadius: 0,
    aoeColor: 0xb8e8ff,
    knockback: 1.2,
    knockUp: 0,
    fireAuraScale: 0.55,
    forceTier: 1,
  },
  {
    id: "1h_mid",
    kind: "mid",
    arcIndex: 1,
    secondaryArcIndex: 0,
    secondaryDelay: 0.045,
    arc: arcParams({
      rotate: 8,
      scale: 1.1,
      direction: 18,
      bend: 0.25,
      thickness: 1.0,
      particles: 10,
      colorHex: 0x9fd0ff,
    }),
    secondaryArc: arcParams({
      rotate: -40,
      scale: 0.75,
      direction: -8,
      bend: 0.1,
      thickness: 0.7,
      particles: 4,
      colorHex: 0xd0ecff,
    }),
    trailColor: 0x9fd0ff,
    trailWindow: 0.5,
    swingAura: true,
    projectile: { kind: "slash_wave", speed: 14, range: 4.5, color: 0x9fd0ff },
    aoeRadius: 0.6,
    aoeColor: 0x9fd0ff,
    knockback: 2.0,
    knockUp: 0.4,
    fireAuraScale: 0.75,
    forceTier: 1,
  },
  {
    id: "1h_finisher",
    kind: "finisher",
    arcIndex: 2,
    secondaryArcIndex: 1,
    secondaryDelay: 0.05,
    arc: arcParams({
      rotate: 35,
      scale: 1.35,
      direction: 28,
      bend: 0.35,
      thickness: 1.25,
      particles: 18,
      colorHex: 0xffe08a,
    }),
    secondaryArc: arcParams({
      rotate: -50,
      scale: 1.0,
      direction: -20,
      bend: 0.2,
      thickness: 0.95,
      particles: 8,
      colorHex: 0xffc060,
    }),
    trailColor: 0xffd070,
    trailWindow: 0.58,
    swingAura: true,
    projectile: { kind: "slash_wave", speed: 16, range: 6, color: 0xffd070 },
    aoeRadius: 1.4,
    aoeColor: 0xffc060,
    knockback: 3.2,
    knockUp: 4.2,
    fireAuraScale: 1.15,
    forceTier: 2,
  },
];

/** 2H greatsword / greataxe / hammer — wider arcs, more knock. */
const TWO_HAND: MeleeStrikeFxProfile[] = [
  {
    id: "2h_light",
    kind: "light",
    arcIndex: 2,
    arc: arcParams({
      rotate: -18,
      scale: 1.2,
      direction: -8,
      bend: 0.2,
      thickness: 1.15,
      particles: 8,
      colorHex: 0xc8d8ff,
    }),
    trailColor: 0xc8d8ff,
    trailWindow: 0.48,
    swingAura: true,
    aoeRadius: 0.5,
    aoeColor: 0xc8d8ff,
    knockback: 2.0,
    knockUp: 0.5,
    fireAuraScale: 0.7,
    forceTier: 1,
  },
  {
    id: "2h_mid",
    kind: "mid",
    arcIndex: 3,
    secondaryArcIndex: 2,
    secondaryDelay: 0.055,
    arc: arcParams({
      rotate: 22,
      scale: 1.4,
      direction: 22,
      bend: 0.3,
      thickness: 1.3,
      particles: 14,
      colorHex: 0xa0b8ff,
    }),
    secondaryArc: arcParams({
      rotate: -35,
      scale: 1.05,
      direction: -15,
      bend: 0.15,
      thickness: 1.0,
      particles: 6,
      colorHex: 0xd0dcff,
    }),
    trailColor: 0xa0b8ff,
    trailWindow: 0.55,
    swingAura: true,
    projectile: { kind: "slash_wave", speed: 12, range: 5.5, color: 0xa0b8ff },
    aoeRadius: 1.1,
    aoeColor: 0xa0b8ff,
    knockback: 3.0,
    knockUp: 1.2,
    fireAuraScale: 0.95,
    forceTier: 2,
  },
  {
    id: "2h_finisher",
    kind: "finisher",
    arcIndex: 4,
    secondaryArcIndex: 3,
    secondaryDelay: 0.06,
    arc: arcParams({
      rotate: 42,
      scale: 1.65,
      direction: 30,
      bend: 0.4,
      thickness: 1.45,
      particles: 22,
      colorHex: 0xffb060,
    }),
    secondaryArc: arcParams({
      rotate: -55,
      scale: 1.25,
      direction: -25,
      bend: 0.25,
      thickness: 1.15,
      particles: 12,
      colorHex: 0xff9040,
    }),
    trailColor: 0xffa050,
    trailWindow: 0.65,
    swingAura: true,
    projectile: { kind: "slash_wave", speed: 14, range: 7, color: 0xffa050 },
    aoeRadius: 2.0,
    aoeColor: 0xff8040,
    knockback: 4.5,
    knockUp: 5.5,
    fireAuraScale: 1.35,
    forceTier: 3,
  },
];

/** Spear / polearm — thrust-forward arcs. */
const POLEARM: MeleeStrikeFxProfile[] = [
  {
    id: "pole_thrust",
    kind: "thrust",
    arcIndex: 0,
    arc: arcParams({
      rotate: 0,
      scale: 0.85,
      direction: 0,
      bend: -0.2,
      thickness: 0.7,
      particles: 5,
      colorHex: 0xa8f0d0,
    }),
    trailColor: 0xa8f0d0,
    trailWindow: 0.4,
    swingAura: true,
    projectile: { kind: "bolt", speed: 22, range: 8, color: 0xa8f0d0 },
    aoeRadius: 0.35,
    aoeColor: 0xa8f0d0,
    knockback: 2.4,
    knockUp: 0.2,
    fireAuraScale: 0.5,
    forceTier: 1,
  },
  {
    id: "pole_mid",
    kind: "mid",
    arcIndex: 1,
    arc: arcParams({
      rotate: -15,
      scale: 1.05,
      direction: 10,
      bend: 0.1,
      thickness: 0.9,
      particles: 9,
      colorHex: 0x88e0c0,
    }),
    trailColor: 0x88e0c0,
    trailWindow: 0.48,
    swingAura: true,
    projectile: { kind: "slash_wave", speed: 18, range: 6, color: 0x88e0c0 },
    aoeRadius: 0.8,
    aoeColor: 0x88e0c0,
    knockback: 2.8,
    knockUp: 0.8,
    fireAuraScale: 0.7,
    forceTier: 2,
  },
  {
    id: "pole_finisher",
    kind: "finisher",
    arcIndex: 2,
    secondaryArcIndex: 0,
    secondaryDelay: 0.05,
    arc: arcParams({
      rotate: 20,
      scale: 1.3,
      direction: 15,
      bend: 0.25,
      thickness: 1.1,
      particles: 16,
      colorHex: 0x60ffc0,
    }),
    secondaryArc: arcParams({
      rotate: -25,
      scale: 0.95,
      direction: -10,
      bend: 0.1,
      thickness: 0.8,
      particles: 6,
      colorHex: 0xa0ffe0,
    }),
    trailColor: 0x60ffc0,
    trailWindow: 0.55,
    swingAura: true,
    projectile: { kind: "bolt", speed: 24, range: 10, color: 0x60ffc0 },
    aoeRadius: 1.3,
    aoeColor: 0x50e0a0,
    knockback: 3.5,
    knockUp: 3.8,
    fireAuraScale: 1.0,
    forceTier: 2,
  },
];

/** Unarmed / blunt fallback. */
const UNARMED: MeleeStrikeFxProfile[] = [
  {
    id: "ua_light",
    kind: "light",
    arcIndex: 0,
    arc: arcParams({
      rotate: -10,
      scale: 0.7,
      direction: 0,
      bend: 0,
      thickness: 0.6,
      particles: 4,
      colorHex: 0xffe0c0,
    }),
    trailColor: 0xffe0c0,
    trailWindow: 0.35,
    swingAura: false,
    aoeRadius: 0,
    aoeColor: 0xffe0c0,
    knockback: 1.0,
    knockUp: 0,
    fireAuraScale: 0.4,
    forceTier: 1,
  },
  {
    id: "ua_mid",
    kind: "mid",
    arcIndex: 1,
    arc: arcParams({
      rotate: 15,
      scale: 0.9,
      direction: 12,
      bend: 0.1,
      thickness: 0.8,
      particles: 8,
      colorHex: 0xffc890,
    }),
    trailColor: 0xffc890,
    trailWindow: 0.45,
    swingAura: true,
    aoeRadius: 0.5,
    aoeColor: 0xffc890,
    knockback: 1.8,
    knockUp: 0.6,
    fireAuraScale: 0.65,
    forceTier: 1,
  },
  {
    id: "ua_finisher",
    kind: "finisher",
    arcIndex: 2,
    arc: arcParams({
      rotate: 25,
      scale: 1.15,
      direction: 20,
      bend: 0.2,
      thickness: 1.0,
      particles: 14,
      colorHex: 0xffa060,
    }),
    trailColor: 0xffa060,
    trailWindow: 0.52,
    swingAura: true,
    aoeRadius: 1.0,
    aoeColor: 0xff9040,
    knockback: 2.8,
    knockUp: 3.5,
    fireAuraScale: 1.0,
    forceTier: 2,
  },
];

function familyForWeapon(weaponId: WeaponId): MeleeStrikeFxProfile[] {
  const w = getWeapon(weaponId);
  const g = w.group || "";
  const id = weaponId.toLowerCase();
  if (g === "melee-2h" || id.includes("great") || id.includes("hammer2h")) return TWO_HAND;
  if (g === "polearm" || id.includes("spear") || id.includes("javelin") || id.includes("scythe"))
    return POLEARM;
  if (g === "melee-1h" || id.includes("sword") || id.includes("axe") || id.includes("dagger") || id.includes("mace"))
    return ONE_HAND;
  if (id === "none" || g === "unarmed") return UNARMED;
  // Magic / ranged LMB fallbacks still use 1h arcs if they call melee path
  return ONE_HAND;
}

/**
 * Resolve profile for a combo stage (0-based).
 * Stage 0 → light, middle → mid, last → finisher.
 */
export function meleeStrikeFxFor(
  weaponId: WeaponId,
  stage: number,
  opts?: { finisher?: boolean; fourHit?: boolean },
): MeleeStrikeFxProfile {
  const family = familyForWeapon(weaponId);
  const max = family.length - 1;
  let idx = 0;
  if (opts?.finisher) idx = max;
  else if (opts?.fourHit) {
    if (stage <= 0) idx = 0;
    else if (stage === 1) idx = Math.min(1, max);
    else if (stage === 2) idx = Math.min(1, max);
    else idx = max;
  } else {
    if (stage <= 0) idx = 0;
    else if (stage === 1) idx = Math.min(1, max);
    else idx = max;
  }
  return family[idx]!;
}

/** Clamp arc index to loaded crescent count. */
export function clampArcIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}
