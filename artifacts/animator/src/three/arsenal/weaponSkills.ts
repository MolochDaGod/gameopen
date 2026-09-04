/**
 * Canonical 4-slot weapon skill kits (keys 1–4).
 *
 * Replaces generic “Power Throw” / grenade-pose stubs with real per-weapon
 * skills: melee arcs + swept colliders, dashes, slams, and true projectiles.
 *
 * Slot index 2 (key **3**) is never a throw animation — it is a weapon-identity
 * special (spin, multi-shot, lance charge, etc.). Throw lives only on javelin
 * slot 0 / F and the dedicated mace chain-throw (slot 4 / index 3).
 */

import type { SkillKind, WeaponId } from "../types";

/** How Studio executes the skill beyond clip + VFX kind. */
export type WeaponSkillBehavior =
  | "slashArc" // blade swing + swept hit
  | "cleave" // wide frontal AoE
  | "dashStrike" // lunge + hit
  | "spinStrike" // whirl / spin AoE
  | "groundSlam" // shockwave slam
  | "thrustLunge" // long poke / spear
  | "uppercut" // gap-close knock-up
  | "hurricane" // spinning kick flourish
  | "bolt" // single aimed projectile
  | "volley" // multi-projectile fan
  | "shot" // firearm burst
  | "nova" // caster-centred nova
  | "maceThrow" // flanged mace recall throw
  | "javelinThrow"; // real javelin projectile

export interface WeaponSkillSlot {
  label: string;
  /** ActionKey / clip name for playClipOnce. */
  clip: string;
  kind: SkillKind;
  mode?: "default" | "dash" | "uppercut";
  behavior: WeaponSkillBehavior;
  /** Stamina cost (default 18). */
  stamina?: number;
  /** Hit radius / projectile count overrides. */
  radius?: number;
  projectiles?: number;
  damage?: number;
}

/** Four skills per weapon id, indices 0–3 → keys 1–4. */
export const WEAPON_SKILL_KITS: Partial<Record<WeaponId, WeaponSkillSlot[]>> = {
  none: [
    { label: "Palm Strike", clip: "attack1", kind: "slam", behavior: "slashArc", damage: 22 },
    // Hurricane kick: unarmed only (plus knife/spear kits below).
    { label: "Hurricane Kick", clip: "hurricaneKick", kind: "slash", behavior: "hurricane", stamina: 16 },
    { label: "Rising Uppercut", clip: "uppercut", kind: "thrust", mode: "uppercut", behavior: "uppercut", stamina: 48 },
    { label: "Shockwave Stomp", clip: "stomp", kind: "nova", behavior: "groundSlam", radius: 3.2, damage: 36 },
  ],
  sword: [
    { label: "Blade Arc", clip: "attack4", kind: "slash", behavior: "slashArc", damage: 28 },
    { label: "Advance Slash", clip: "dashAttack", kind: "slash", mode: "dash", behavior: "dashStrike", damage: 32 },
    // Slot 3 (key 3): real sword special — NOT throw
    { label: "Cross Cleave", clip: "outsideSlash", kind: "slash", behavior: "cleave", radius: 2.6, damage: 34 },
    { label: "Tempest Spin", clip: "meleeComboA", kind: "nova", behavior: "spinStrike", radius: 2.8, damage: 40 },
  ],
  dagger: [
    { label: "Flurry", clip: "comboHit1", kind: "slash", behavior: "slashArc", damage: 18 },
    { label: "Shadow Lunge", clip: "dashAttack", kind: "thrust", mode: "dash", behavior: "dashStrike", damage: 26 },
    // Knife keeps hurricane as a light-weapon acrobatic special.
    { label: "Hurricane Kick", clip: "hurricaneKick", kind: "slash", behavior: "hurricane", stamina: 16 },
    { label: "Blade Dance", clip: "skill", kind: "slash", behavior: "spinStrike", radius: 2.2, damage: 36 },
  ],
  axe: [
    { label: "Hook Cleave", clip: "attack1", kind: "slash", behavior: "cleave", radius: 2.5, damage: 34 },
    { label: "Rampage Charge", clip: "dashAttack", kind: "slash", mode: "dash", behavior: "dashStrike", damage: 38 },
    { label: "Skull Splitter", clip: "skill", kind: "slam", behavior: "groundSlam", radius: 2.8, damage: 42 },
    { label: "Blood Whirl", clip: "meleeComboB", kind: "nova", behavior: "spinStrike", radius: 3.0, damage: 44 },
  ],
  hammer: [
    { label: "Crushing Blow", clip: "attack1", kind: "slam", behavior: "slashArc", damage: 36 },
    { label: "Earth Shock", clip: "attack2", kind: "slam", behavior: "groundSlam", radius: 2.6, damage: 40 },
    { label: "Anvil Drop", clip: "skill", kind: "slam", behavior: "groundSlam", radius: 3.2, damage: 48 },
    { label: "Quake Swing", clip: "meleeComboB", kind: "nova", behavior: "cleave", radius: 2.9, damage: 44 },
  ],
  mace: [
    { label: "Skull Crusher", clip: "attack1", kind: "slam", behavior: "slashArc", damage: 32 },
    { label: "Flange Bash", clip: "attack2", kind: "slam", behavior: "cleave", radius: 2.3, damage: 34 },
    { label: "Hell Storm", clip: "attack3", kind: "slam", behavior: "spinStrike", radius: 2.5, damage: 40 },
    // Slot 4: real mace identity skill (chain throw / recall) — not grenade throw pose
    { label: "Chain Throw", clip: "throw", kind: "slam", behavior: "maceThrow", stamina: 16 },
  ],
  greatsword: [
    { label: "Earthshatter", clip: "attack1", kind: "slam", behavior: "cleave", radius: 2.8, damage: 42 },
    { label: "Slide Charge", clip: "dashAttack", kind: "slash", mode: "dash", behavior: "dashStrike", damage: 40 },
    { label: "High Spin", clip: "skill", kind: "nova", behavior: "spinStrike", radius: 3.2, damage: 48 },
    { label: "Overhead Ruin", clip: "overheadSlash", kind: "slam", behavior: "groundSlam", radius: 2.6, damage: 52 },
  ],
  greataxe: [
    { label: "Whirlwind", clip: "skill", kind: "slash", behavior: "spinStrike", radius: 3.4, damage: 46 },
    { label: "Headsman Leap", clip: "dashAttack", kind: "slash", mode: "dash", behavior: "dashStrike", damage: 44 },
    { label: "Ruin Howl", clip: "attack1", kind: "slash", behavior: "cleave", radius: 3.0, damage: 48 },
    { label: "Cataclysm Chop", clip: "overheadSlash", kind: "slam", behavior: "groundSlam", radius: 3.0, damage: 54 },
  ],
  hammer2h: [
    { label: "Ground Pound", clip: "skill", kind: "slam", behavior: "groundSlam", radius: 3.6, damage: 50 },
    { label: "Titan Charge", clip: "dashAttack", kind: "slam", mode: "dash", behavior: "dashStrike", damage: 46 },
    { label: "Mountain Fall", clip: "attack1", kind: "slam", behavior: "cleave", radius: 3.0, damage: 48 },
    { label: "World Breaker", clip: "overheadSlash", kind: "nova", behavior: "groundSlam", radius: 3.8, damage: 58 },
  ],
  spear: [
    { label: "Heartseeker Lunge", clip: "attack1", kind: "thrust", behavior: "thrustLunge", damage: 34 },
    { label: "Sweeping Cut", clip: "attack2", kind: "slash", behavior: "cleave", radius: 2.8, damage: 32 },
    // Spear keeps hurricane (pole-arm whirl / kick line).
    { label: "Hurricane Kick", clip: "hurricaneKick", kind: "slash", behavior: "hurricane", stamina: 16 },
    { label: "Impale Line", clip: "skill", kind: "thrust", behavior: "thrustLunge", damage: 44, radius: 1.4 },
  ],
  javelin: [
    // Slot 1: real thrown weapon projectile (not generic grenade anim as the only skill)
    { label: "Javelin Throw", clip: "throw", kind: "thrust", behavior: "javelinThrow", damage: 38 },
    { label: "Pinning Lunge", clip: "attack1", kind: "thrust", mode: "dash", behavior: "dashStrike", damage: 34 },
    { label: "Skewer Line", clip: "attack3", kind: "thrust", behavior: "thrustLunge", damage: 40 },
    { label: "Spear Rain", clip: "skill", kind: "bolt", behavior: "volley", projectiles: 5, damage: 16 },
  ],
  bow: [
    { label: "Piercing Shot", clip: "attack1", kind: "bolt", behavior: "bolt", damage: 32 },
    { label: "Multi Shot", clip: "release", kind: "bolt", behavior: "volley", projectiles: 3, damage: 18 },
    { label: "Rain of Arrows", clip: "skill", kind: "bolt", behavior: "volley", projectiles: 7, damage: 12 },
    { label: "Power Draw", clip: "aim", kind: "bolt", behavior: "bolt", damage: 48 },
  ],
  pistol: [
    { label: "Quick Draw", clip: "attack1", kind: "muzzle", behavior: "shot", damage: 26 },
    { label: "Fan Fire", clip: "gunplay", kind: "muzzle", behavior: "volley", projectiles: 4, damage: 14 },
    { label: "MMA Kick", clip: "mmaKick", kind: "slam", behavior: "slashArc", damage: 30 },
    { label: "Charged Round", clip: "chargedShot", kind: "muzzle", behavior: "shot", damage: 52 },
  ],
  rifle: [
    { label: "Burst Fire", clip: "attack1", kind: "muzzle", behavior: "shot", damage: 34 },
    { label: "Suppressing Fire", clip: "attack1", kind: "muzzle", behavior: "volley", projectiles: 5, damage: 12 },
    { label: "Marksman Shot", clip: "aim", kind: "muzzle", behavior: "bolt", damage: 48 },
    { label: "High-Cal Burst", clip: "skill", kind: "muzzle", behavior: "shot", damage: 56 },
  ],
  "hunter-rifle": [
    { label: "Piercing Shot", clip: "attack1", kind: "muzzle", behavior: "bolt", damage: 46 },
    { label: "Steady Aim", clip: "aim", kind: "muzzle", behavior: "shot", damage: 52 },
    { label: "Hunter's Mark", clip: "attack1", kind: "muzzle", behavior: "bolt", damage: 40 },
    { label: "Slug Round", clip: "skill", kind: "muzzle", behavior: "shot", damage: 64 },
  ],
  staff: [
    { label: "Arcane Bolt", clip: "magicAttack", kind: "bolt", behavior: "bolt", damage: 30 },
    { label: "Scatter Barrage", clip: "castSpell", kind: "bolt", behavior: "volley", projectiles: 5, damage: 14 },
    { label: "Nova Pulse", clip: "magicArea", kind: "nova", behavior: "nova", radius: 4.0, damage: 36 },
    { label: "Channel Storm", clip: "magicChannel", kind: "meteor", behavior: "bolt", damage: 50 },
  ],
  staffFire: [
    { label: "Firebolt", clip: "magicAttack", kind: "fireDragon", behavior: "bolt", damage: 34 },
    { label: "Flame Fan", clip: "castSpell", kind: "fireDragon", behavior: "volley", projectiles: 4, damage: 16 },
    { label: "Inferno Nova", clip: "magicArea", kind: "nova", behavior: "nova", radius: 3.8, damage: 40 },
    { label: "Meteor Call", clip: "magicChannel", kind: "meteor", behavior: "bolt", damage: 58 },
  ],
  staffIce: [
    { label: "Ice Lance", clip: "magicAttack", kind: "bolt", behavior: "bolt", damage: 32 },
    { label: "Frost Fan", clip: "castSpell", kind: "bolt", behavior: "volley", projectiles: 4, damage: 15 },
    { label: "Glacial Nova", clip: "magicArea", kind: "nova", behavior: "nova", radius: 3.6, damage: 38 },
    { label: "Blizzard", clip: "magicChannel", kind: "soul", behavior: "bolt", damage: 48 },
  ],
  staffStorm: [
    { label: "Storm Bolt", clip: "magicAttack", kind: "bolt", behavior: "bolt", damage: 34 },
    { label: "Chain Arc", clip: "castSpell", kind: "laser", behavior: "volley", projectiles: 5, damage: 14 },
    { label: "Thunder Nova", clip: "magicArea", kind: "nova", behavior: "nova", radius: 4.0, damage: 42 },
    { label: "Skyfall", clip: "magicChannel", kind: "meteor", behavior: "bolt", damage: 55 },
  ],
  staffNature: [
    { label: "Nordin Trap Totem", clip: "magicAttack", kind: "totem", behavior: "nova", radius: 3.2, damage: 12 },
    { label: "Freya Heal Totem", clip: "castSpell", kind: "totem", behavior: "nova", radius: 4.0, damage: 0 },
    { label: "Thor Ward Totem", clip: "magicArea", kind: "totem", behavior: "nova", radius: 4.2, damage: 14 },
    { label: "Odin Taunt Totem", clip: "magicChannel", kind: "totem", behavior: "nova", radius: 10, damage: 8 },
  ],
  staffHoly: [
    { label: "Holy Bolt", clip: "magicAttack", kind: "bolt", behavior: "bolt", damage: 32 },
    { label: "Radiant Fan", clip: "castSpell", kind: "bolt", behavior: "volley", projectiles: 4, damage: 15 },
    { label: "Sanctum Nova", clip: "magicArea", kind: "nova", behavior: "nova", radius: 4.0, damage: 38 },
    { label: "Judgment", clip: "magicChannel", kind: "meteor", behavior: "bolt", damage: 52 },
  ],
  staffArcane: [
    { label: "Arcane Missile", clip: "magicAttack", kind: "bolt", behavior: "bolt", damage: 34 },
    { label: "Void Fan", clip: "castSpell", kind: "darkBlades", behavior: "volley", projectiles: 5, damage: 16 },
    { label: "Rift Nova", clip: "magicArea", kind: "nova", behavior: "nova", radius: 4.0, damage: 40 },
    { label: "Singularity", clip: "magicChannel", kind: "soul", behavior: "bolt", damage: 56 },
  ],
  gunblade: [
    { label: "Blade Slash", clip: "attack1", kind: "slash", behavior: "slashArc", damage: 30 },
    { label: "Shield Bash", clip: "attack2", kind: "slam", behavior: "cleave", radius: 2.2, damage: 32 },
    { label: "Gunblade Burst", clip: "skill", kind: "muzzle", behavior: "shot", damage: 40 },
    { label: "Super Cannon", clip: "attack4", kind: "muzzle", behavior: "shot", damage: 60 },
  ],
  shield: [
    { label: "Shield Bash", clip: "attack1", kind: "slam", behavior: "slashArc", damage: 28 },
    { label: "Bulwark Charge", clip: "dashAttack", kind: "slam", mode: "dash", behavior: "dashStrike", damage: 34 },
    { label: "Guard Breaker", clip: "attack2", kind: "slam", behavior: "cleave", radius: 2.4, damage: 36 },
    { label: "Aegis Shock", clip: "skill", kind: "nova", behavior: "nova", radius: 3.0, damage: 32 },
  ],
};

/** Resolve the 4 skill slots for a weapon (fallback: unarmed kit). */
export function getWeaponSkills(id: WeaponId): WeaponSkillSlot[] {
  const kit = WEAPON_SKILL_KITS[id] ?? WEAPON_SKILL_KITS.none;
  return kit ?? WEAPON_SKILL_KITS.none!;
}

/** HUD-friendly view of weapon skills. */
export function weaponSkillLabels(id: WeaponId): { label: string; kind: SkillKind }[] {
  return getWeaponSkills(id).map((s) => ({ label: s.label, kind: s.kind }));
}
