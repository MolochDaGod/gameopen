/**
 * Weapon skill packs — production combat definitions for grudge6 characters.
 *
 * Maps the `animKey` strings from `content/skills/*.json` (e.g. "sword_slash")
 * to full combat parameters: FBX animation clip path, hit reach, damage, MM
 * (Maneuver Motion) lunge impulse, VFX colour, and cooldown.
 *
 * These are consumed by Grudge6CombatCharacter to build the character's
 * hotbar-slot skill set at load time.
 */

/** Weapon families with associated skill sets. */
export type WeaponFamily =
  | "sword"       // 1H sword ± shield — sword_shield anim pack
  | "greatsword"  // 2H sword / axe / greatsword — heavy melee
  | "axe"         // Great-axe — heavy melee (shares greatsword clips)
  | "mace"        // Hammer / mace — heavy melee
  | "spear"       // Spear / lance
  | "magic"       // Staff / tome — ranged spells
  | "longbow"     // Bow — ranged physical
  | "unarmed";    // Kick / striker

export interface SkillPack {
  /** Matches `animKey` in content/skills/*.json. */
  animKey: string;
  /** Hotbar slot (1-4). */
  slot: 1 | 2 | 3 | 4;
  /** Human-readable label. */
  label: string;
  /** FBX clip path (relative to `public/`) for full rig animation. */
  clipPath: string;
  /** Reach in metres for melee hit detection. */
  reach: number;
  /** Base damage before stat scaling. */
  damage: number;
  /** MM forward lunge speed (m/s) applied during the strike phase. */
  lungeSpeed: number;
  /** Duration of the MM lunge (seconds). */
  lungeDuration: number;
  /** VFX hex colour for the impact/trail. */
  vfxColor: number;
  /** Skill cooldown (seconds). 0 = primary (no CD). */
  cooldown: number;
}

// ── Sword pack ───────────────────────────────────────────────────────────────
export const SWORD_SKILLS: readonly SkillPack[] = [
  {
    animKey: "sword_slash",
    slot: 1,
    label: "Slash",
    clipPath: "anim/sword/outward-slash.fbx",
    reach: 1.8, damage: 18, lungeSpeed: 3.5, lungeDuration: 0.22,
    vfxColor: 0xe8d9a0, cooldown: 0,
  },
  {
    animKey: "sword_two_hit",
    slot: 2,
    label: "Twin Slash",
    clipPath: "anim/sword/one-hand-sword-combo.fbx",
    reach: 1.9, damage: 26, lungeSpeed: 4.0, lungeDuration: 0.28,
    vfxColor: 0xffe8b0, cooldown: 1.5,
  },
  {
    animKey: "sword_spin_high",
    slot: 3,
    label: "Spin High",
    clipPath: "anim/sword/sword-and-shield-attack-2.fbx",
    reach: 2.4, damage: 34, lungeSpeed: 2.0, lungeDuration: 0.45,
    vfxColor: 0xffd080, cooldown: 4.0,
  },
  {
    animKey: "sword_dash",
    slot: 4,
    label: "Slash Advance",
    clipPath: "anim/sword/slash-advance.fbx",
    reach: 3.2, damage: 28, lungeSpeed: 8.0, lungeDuration: 0.35,
    vfxColor: 0x80e0ff, cooldown: 6.0,
  },
] as const;

// ── Axe / greatsword pack ────────────────────────────────────────────────────
export const AXE_SKILLS: readonly SkillPack[] = [
  {
    animKey: "axe_primary",
    slot: 1,
    label: "Heavy Strike",
    clipPath: "anim/greataxe/great-axe-combo.fbx",
    reach: 2.0, damage: 28, lungeSpeed: 4.5, lungeDuration: 0.30,
    vfxColor: 0xff8c44, cooldown: 0,
  },
  {
    animKey: "axe_secondary",
    slot: 2,
    label: "Overhead Slam",
    clipPath: "anim/greatsword/great-sword-overhead.fbx",
    reach: 2.2, damage: 38, lungeSpeed: 5.0, lungeDuration: 0.35,
    vfxColor: 0xff6020, cooldown: 2.0,
  },
  {
    animKey: "axe_ability",
    slot: 3,
    label: "Spin Attack",
    clipPath: "anim/greatsword/great-sword-high-spin-attack.fbx",
    reach: 2.8, damage: 42, lungeSpeed: 1.5, lungeDuration: 0.55,
    vfxColor: 0xff4400, cooldown: 5.0,
  },
  {
    animKey: "axe_ultimate",
    slot: 4,
    label: "Berserker Rush",
    clipPath: "anim/greatsword/great-sword-combo.fbx",
    reach: 2.6, damage: 55, lungeSpeed: 9.0, lungeDuration: 0.42,
    vfxColor: 0xff2200, cooldown: 10.0,
  },
] as const;

// ── Magic pack ───────────────────────────────────────────────────────────────
export const MAGIC_SKILLS: readonly SkillPack[] = [
  {
    animKey: "magic_bolt",
    slot: 1,
    label: "Arcane Bolt",
    clipPath: "anim/magic/standing-1h-magic-attack-01.fbx",
    reach: 8.0, damage: 22, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xb98cff, cooldown: 0,
  },
  {
    animKey: "magic_nova",
    slot: 2,
    label: "Arcane Nova",
    clipPath: "anim/magic/standing-1h-magic-attack-02.fbx",
    reach: 4.0, damage: 35, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xd4aaff, cooldown: 3.0,
  },
  {
    animKey: "magic_area",
    slot: 3,
    label: "Area Burst",
    clipPath: "anim/magic/standing-2h-magic-area-attack-01.fbx",
    reach: 5.0, damage: 48, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x8844ff, cooldown: 6.0,
  },
  {
    animKey: "magic_cast",
    slot: 4,
    label: "Grand Casting",
    clipPath: "anim/magic/casting-spell.fbx",
    reach: 10.0, damage: 65, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x6600ff, cooldown: 12.0,
  },
] as const;

// ── Longbow pack ─────────────────────────────────────────────────────────────
export const LONGBOW_SKILLS: readonly SkillPack[] = [
  {
    animKey: "bow_shot",
    slot: 1,
    label: "Quick Shot",
    clipPath: "anim/bow/shooting-arrow.fbx",
    reach: 12.0, damage: 20, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x70ff90, cooldown: 0,
  },
  {
    animKey: "bow_overdraw",
    slot: 2,
    label: "Overdraw",
    clipPath: "anim/bow/standing-aim-overdraw.fbx",
    reach: 18.0, damage: 38, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x40ffa0, cooldown: 4.0,
  },
  {
    animKey: "bow_dodge",
    slot: 3,
    label: "Dive & Fire",
    clipPath: "anim/bow/standing-dive-forward.fbx",
    reach: 8.0, damage: 28, lungeSpeed: 6.0, lungeDuration: 0.3,
    vfxColor: 0x20e060, cooldown: 5.0,
  },
  {
    animKey: "bow_kick",
    slot: 4,
    label: "Melee Kick",
    clipPath: "anim/bow/standing-melee-kick.fbx",
    reach: 1.8, damage: 22, lungeSpeed: 5.5, lungeDuration: 0.25,
    vfxColor: 0xffaa44, cooldown: 4.0,
  },
] as const;

// ── Striker / unarmed pack ───────────────────────────────────────────────────
export const STRIKER_SKILLS: readonly SkillPack[] = [
  {
    animKey: "striker_kick",
    slot: 1,
    label: "Quick Kick",
    clipPath: "anim/striker/quick-kick.fbx",
    reach: 1.6, damage: 14, lungeSpeed: 4.0, lungeDuration: 0.20,
    vfxColor: 0xff7a1e, cooldown: 0,
  },
  {
    animKey: "striker_combo",
    slot: 2,
    label: "Punch Combo",
    clipPath: "anim/striker/punch-combo.fbx",
    reach: 1.8, damage: 22, lungeSpeed: 3.5, lungeDuration: 0.30,
    vfxColor: 0xff5500, cooldown: 2.0,
  },
  {
    animKey: "striker_flip",
    slot: 3,
    label: "Flip Kick",
    clipPath: "anim/striker/flip_kick.fbx",
    reach: 2.2, damage: 32, lungeSpeed: 6.0, lungeDuration: 0.38,
    vfxColor: 0xff3300, cooldown: 4.0,
  },
  {
    animKey: "striker_uppercut",
    slot: 4,
    label: "Knee Uppercut",
    clipPath: "anim/striker/knee-jabs-to-uppercut.fbx",
    reach: 1.9, damage: 40, lungeSpeed: 2.0, lungeDuration: 0.45,
    vfxColor: 0xffd44d, cooldown: 7.0,
  },
] as const;

/** Pick the skill pack for a given weapon family. */
export function skillPackForFamily(family: WeaponFamily): readonly SkillPack[] {
  switch (family) {
    case "sword":     return SWORD_SKILLS;
    case "greatsword":return AXE_SKILLS;
    case "axe":       return AXE_SKILLS;
    case "mace":      return AXE_SKILLS;
    case "spear":     return SWORD_SKILLS; // spear uses 1H reach patterns
    case "magic":     return MAGIC_SKILLS;
    case "longbow":   return LONGBOW_SKILLS;
    case "unarmed":   return STRIKER_SKILLS;
    default:          return SWORD_SKILLS;
  }
}

/** Map an animPack string (from gearPresets.ts) to a weapon family. */
export function familyFromAnimPack(animPack: string): WeaponFamily {
  switch (animPack) {
    case "sword_shield": return "sword";
    case "2h_melee":     return "greatsword";
    case "longbow":      return "longbow";
    case "magic":        return "magic";
    case "unarmed":      return "unarmed";
    default:             return "sword";
  }
}

/** Primary attack skill (slot 1) for a weapon family. */
export function primarySkill(family: WeaponFamily): SkillPack {
  return skillPackForFamily(family)[0]!;
}
