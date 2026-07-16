import type { WeaponDef } from "./types";
import { PI2 } from "./types";
import { GUN_FAMILIES } from "./gunClass";

/**
 * Ranged weapon prefabs (bow + firearms).
 *
 * Gun class (master GUN): exactly 4 subtypes × 6 tiers each.
 *  - pistol  → revolver.glb only
 *  - rifle   → rifle.glb only
 *  - sniper  → hunter-rifle id, rifle.glb longer hold (sniper.glb later)
 *  - shotgun → rifle.glb stand-in until shotgun.glb
 *
 * Tier ladders + skill/anim/VFX patterns: {@link GUN_FAMILIES}.
 */
function gunTiers(familyId: keyof typeof GUN_FAMILIES) {
  const f = GUN_FAMILIES[familyId];
  return f.tiers.map((t) => ({
    name: t.name,
    power: t.power,
    ...(t.modelFile
      ? {
          model: {
            file: t.modelFile,
            length: f.modelLength * (1 + t.index * 0.02),
            forward: f.modelForward,
            align: f.modelAlign,
            anchor: "center" as const,
          },
        }
      : {}),
  }));
}

export const RANGED_WEAPONS: WeaponDef[] = [
  {
    id: "bow",
    label: "Longbow",
    hand: "left",
    kind: "bolt",
    skillName: "Piercing Shot",
    skillDuration: 0.7,
    cooldown: 1.3,
    combat: { intensity: 20, direction: 100, range: [0.6, 1.4] },
    animSet: "bow",
    group: "ranged",
    duelEligible: false,
    tiers: [
      { name: "Hunter's Longbow", power: 1 },
      { name: "Recurve Bow", power: 1.1, model: { file: "models/weapons/bow-craft-1.glb", length: 1.25, forward: "y+", align: "y", anchor: "center" } },
      { name: "Composite Bow", power: 1.2, model: { file: "models/weapons/bow-craft-5.glb", length: 1.3, forward: "y+", align: "y", anchor: "center" } },
      { name: "Ranger's Bow", power: 1.3, model: { file: "models/weapons/bow-craft-7.glb", length: 1.4, forward: "y+", align: "y", anchor: "center" } },
      { name: "Warbow", power: 1.4, model: { file: "models/weapons/bow-craft-13.glb", length: 1.35, forward: "y+", align: "y", anchor: "center" } },
      { name: "Dragonhorn Bow", power: 1.5, model: { file: "models/weapons/bow-craft-20.glb", length: 1.4, forward: "y+", align: "y", anchor: "center" } },
    ],
    grip: { main: { rot: [0, 0, PI2], pos: [0, 0.05, 0] } },
    model: {
      main: { file: "models/weapons/bow.glb", length: 1.2, forward: "y+", align: "y", anchor: "center" },
      twoHanded: true,
    },
  },
  {
    // Heavy Crossbow — Albion magical siege (not class GUN).
    id: "crossbow",
    label: "Heavy Crossbow",
    hand: "right",
    kind: "muzzle",
    skillName: "Scatter Bolt",
    skillDuration: 0.55,
    cooldown: 1.1,
    combat: { intensity: 42, direction: 100, range: [0.5, 2.2] },
    animSet: "ranged",
    group: "ranged",
    duelEligible: false,
    grip: { main: { rot: [0, PI2, 0], pos: [0, 0.05, 0] } },
    model: {
      main: { file: "models/weapons/rifle.glb", length: 1.1, forward: "z+", align: "y", anchor: "base" },
      twoHanded: true,
    },
  },
  // ── Class GUN: pistol (canonical) ───────────────────────────────────────
  {
    id: "pistol",
    label: GUN_FAMILIES.pistol.label,
    hand: "right",
    kind: "muzzle",
    skillName: GUN_FAMILIES.pistol.skills[0].label,
    skillDuration: 0.5,
    cooldown: 0.9,
    combat: { intensity: 28, direction: 100, range: [0.5, 1.2] },
    animSet: "pistol",
    group: "ranged",
    duelEligible: false,
    tiers: gunTiers("pistol"),
    // Revolver only — never pistol.glb
    grip: { main: { rot: [0, 0, 0], pos: [0, 0.05, 0.04] } },
    model: {
      main: {
        file: GUN_FAMILIES.pistol.modelFile,
        length: GUN_FAMILIES.pistol.modelLength,
        forward: GUN_FAMILIES.pistol.modelForward,
        align: GUN_FAMILIES.pistol.modelAlign,
        anchor: "center",
      },
    },
  },
  // ── Class GUN: rifle ────────────────────────────────────────────────────
  {
    id: "rifle",
    label: GUN_FAMILIES.rifle.label,
    hand: "right",
    kind: "muzzle",
    skillName: GUN_FAMILIES.rifle.skills[0].label,
    skillDuration: 0.8,
    cooldown: 1.6,
    combat: { intensity: 40, direction: 100, range: [0.6, 1.4] },
    animSet: "ranged",
    group: "ranged",
    duelEligible: false,
    tiers: gunTiers("rifle"),
    grip: { main: { rot: [0, 0, 0], pos: [0, 0, 0.05] } },
    model: {
      main: {
        file: GUN_FAMILIES.rifle.modelFile,
        length: GUN_FAMILIES.rifle.modelLength,
        forward: GUN_FAMILIES.rifle.modelForward,
        align: GUN_FAMILIES.rifle.modelAlign,
        anchor: "center",
      },
      twoHanded: true,
    },
  },
  // ── Class GUN: sniper (WeaponId hunter-rifle) ───────────────────────────
  {
    id: "hunter-rifle",
    label: GUN_FAMILIES.sniper.label,
    hand: "right",
    kind: "muzzle",
    skillName: GUN_FAMILIES.sniper.skills[0].label,
    skillDuration: 0.9,
    cooldown: 1.9,
    combat: { intensity: 52, direction: 100, range: [0.6, 1.4] },
    animSet: "ranged",
    group: "ranged",
    duelEligible: false,
    tiers: gunTiers("sniper"),
    grip: { main: { rot: [0, 0, 0], pos: [0, 0, 0.05] } },
    model: {
      main: {
        file: GUN_FAMILIES.sniper.modelFile,
        length: GUN_FAMILIES.sniper.modelLength,
        forward: GUN_FAMILIES.sniper.modelForward,
        align: GUN_FAMILIES.sniper.modelAlign,
        anchor: "center",
      },
      twoHanded: true,
    },
  },
  // ── Class GUN: shotgun ──────────────────────────────────────────────────
  {
    id: "shotgun",
    label: GUN_FAMILIES.shotgun.label,
    hand: "right",
    kind: "muzzle",
    skillName: GUN_FAMILIES.shotgun.skills[0].label,
    skillDuration: 0.65,
    cooldown: 1.2,
    combat: { intensity: 48, direction: 90, range: [0.4, 1.6] },
    animSet: "ranged",
    group: "ranged",
    duelEligible: false,
    tiers: gunTiers("shotgun"),
    grip: { main: { rot: [0, 0, 0], pos: [0, 0, 0.04] } },
    model: {
      main: {
        file: GUN_FAMILIES.shotgun.modelFile,
        length: GUN_FAMILIES.shotgun.modelLength,
        forward: GUN_FAMILIES.shotgun.modelForward,
        align: GUN_FAMILIES.shotgun.modelAlign,
        anchor: "center",
      },
      twoHanded: true,
    },
  },
];

/** Re-export for HUD / generators that want T0 rows from the family SSOT. */
export { gunFamilyToT0Skills, GUN_FAMILIES };
