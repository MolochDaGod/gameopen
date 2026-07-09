import type { SkillKind, StaffElement, WeaponModelPiece } from "../types";
import type { WeaponDef, WeaponTier } from "./types";
import { PI2 } from "./types";

/**
 * Magic weapon prefabs. Not eligible for the melee duel, but a full
 * self-contained module equipped through the same path as every other weapon.
 *
 * The roster is the original Arcane Staff (the bespoke "Soulbinder" kit) plus
 * five ELEMENTAL staff types — Fire / Ice / Storm / Nature / Holy. Each element
 * is its own weapon type with six selectable cane skins (sliced from the 24
 * converted craftpix canes, element-tinted at mount), sharing the proven caster
 * feel but casting its OWN themed projectile + status (see `elements.ts` +
 * `Studio.doElementalCast`).
 */

const TIER_TITLES = ["Apprentice", "Adept", "Conjurer's", "Archon", "Magus", "Archmage"] as const;

/**
 * Build the six cane-skin tiers for an elemental staff. Each tier swaps only the
 * main GLB (one of the 24 canes, wrapped across the schools) while sharing the
 * magic clip set, grip, hold-style and elemental cast. `start` is the 1-based
 * cane index this school's first tier uses.
 */
function caneTiers(start: number, label: string): WeaponTier[] {
  return TIER_TITLES.map((title, t) => ({
    name: `${title} ${label}`,
    power: 1 + t * 0.1,
    model: caneModel(((start - 1 + t) % 24) + 1),
  }));
}

function caneModel(index: number): WeaponModelPiece {
  return { file: `models/weapons/cane-${index}.glb`, length: 1.4, forward: "y+", align: "y", anchor: "base" };
}

function elementalStaff(
  id: WeaponDef["id"],
  element: StaffElement,
  label: string,
  skillName: string,
  kind: SkillKind,
  startCane: number,
): WeaponDef {
  return {
    id,
    label,
    hand: "right",
    kind,
    element,
    skillName,
    skillDuration: 1,
    cooldown: 2.4,
    combat: { intensity: 50, direction: 70, range: [1, 2.2] },
    animSet: "magic",
    group: "magic",
    duelEligible: false,
    tiers: caneTiers(startCane, label),
    grip: { main: { rot: [PI2, 0, 0], pos: [0, 0.05, 0] } },
    model: { main: caneModel(startCane) },
  };
}

export const MAGIC_WEAPONS: WeaponDef[] = [
  {
    id: "staff",
    label: "Arcane Staff",
    hand: "right",
    kind: "nova",
    skillName: "Arcane Nova",
    skillDuration: 1,
    cooldown: 2.4,
    combat: { intensity: 50, direction: 70, range: [1, 2.2] },
    animSet: "magic",
    group: "magic",
    duelEligible: false,
    tiers: [
      { name: "Apprentice Staff", power: 1 },
      { name: "Adept Staff", power: 1.1 },
      { name: "Conjurer's Staff", power: 1.2 },
      { name: "Archon Staff", power: 1.3 },
      { name: "Magus Staff", power: 1.4 },
      { name: "Archmage Staff", power: 1.5 },
    ],
    grip: { main: { rot: [PI2, 0, 0], pos: [0, 0.05, 0] } },
    model: { main: { file: "models/weapons/staff.glb", length: 1.4, forward: "y+", align: "y", anchor: "base" } },
  },
  elementalStaff("staffFire", "fire", "Fire Staff", "Flame Cast", "fireDragon", 1),
  elementalStaff("staffIce", "ice", "Ice Staff", "Frost Cast", "bolt", 7),
  elementalStaff("staffStorm", "storm", "Storm Staff", "Shock Cast", "laser", 13),
  elementalStaff("staffNature", "nature", "Nature Staff", "Bloom Cast", "soul", 19),
  elementalStaff("staffHoly", "holy", "Holy Staff", "Radiant Cast", "nova", 1),
];
