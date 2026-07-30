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

/** Combat VFX kind for skill cast / impact. */
export type SkillEffectKind =
  | "impact"
  | "slash"
  | "slashWave"
  | "getsuga"
  | "nova"
  | "slam";

export type SlashVariantId = "slashred" | "slashblue" | "slashpurple" | "slashyellow";

export interface SkillPack {
  /** Matches `animKey` in content/skills/*.json. */
  animKey: string;
  /** Hotbar slot (1-4). */
  slot: 1 | 2 | 3 | 4;
  /** Human-readable label. */
  label: string;
  /**
   * Baked clip path (relative to public/) — prefer anims/baked or prod/anims.
   * Mixamo FBX is authoring only (not on Vercel).
   */
  clipPath: string;
  /**
   * Clip role on the loaded mixer (attack / skill1 / skill2 / …).
   * GrudgeAvatar / director one-shots use this when present.
   */
  animRole?: string;
  /**
   * Alias of {@link animRole} for grudge6 combat kits / playtests.
   * Prefer this name when mapping hotbar → baked mixer role.
   */
  bakedRole?: string;
  /** Cross-fade in when skill starts (seconds). */
  blendIn?: number;
  /** Cross-fade out / recover (seconds). */
  blendOut?: number;
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
  /** Production combat VFX kind (Getsuga / arc / nova). */
  effectKind?: SkillEffectKind;
  /** Slash mesh variant for getsuga / slashWave. */
  slashVariant?: SlashVariantId;
  /** Optional fleet impact effect id. */
  impactEffectId?: string;
}

// ── Sword pack ───────────────────────────────────────────────────────────────
export const SWORD_SKILLS: readonly SkillPack[] = [
  {
    animKey: "sword_slash",
    slot: 1,
    label: "Slash",
    // Production: baked / prod/anims only (no FBX on Vercel)
    clipPath: "anims/baked/sword_shield/sword and shield attack.json",
    reach: 1.8, damage: 18, lungeSpeed: 3.5, lungeDuration: 0.22,
    vfxColor: 0xe8d9a0, cooldown: 0,
  },
  {
    animKey: "sword_two_hit",
    slot: 2,
    label: "Twin Slash",
    clipPath: "anims/baked/polearm/combo.json",
    reach: 1.9, damage: 26, lungeSpeed: 4.0, lungeDuration: 0.28,
    vfxColor: 0xffe8b0, cooldown: 1.5,
  },
  {
    animKey: "sword_spin_high",
    slot: 3,
    label: "Spin High",
    clipPath: "anims/baked/polearm/overhead.json",
    reach: 2.4, damage: 34, lungeSpeed: 2.0, lungeDuration: 0.45,
    vfxColor: 0xffd080, cooldown: 4.0,
  },
  {
    animKey: "sword_dash",
    slot: 4,
    label: "Slash Advance",
    clipPath: "anims/baked/polearm/special.json",
    reach: 3.2, damage: 28, lungeSpeed: 8.0, lungeDuration: 0.35,
    vfxColor: 0x80e0ff, cooldown: 6.0,
  },
] as const;

/**
 * 2H Greatsword / Samurai — production greatsword_samurai bake + Getsuga/slash VFX.
 * Slot map mirrors combat-map.json:
 *   1 combo_a · 2 combo_b · 3 dash_opener · 4 teleport_strike
 */
export const SAMURAI_2H_SKILLS: readonly SkillPack[] = [
  {
    animKey: "gs_samurai_cleave",
    slot: 1,
    label: "Samurai Cleave",
    clipPath: "anims/baked/greatsword_samurai/gs_samurai_combo_a.json",
    animRole: "attack",
    reach: 2.6, damage: 32, lungeSpeed: 5.0, lungeDuration: 0.28,
    vfxColor: 0xff6060, cooldown: 0,
    effectKind: "getsuga",
    slashVariant: "slashred",
    impactEffectId: "getsuga_slash",
  },
  {
    animKey: "gs_samurai_twin",
    slot: 2,
    label: "Twin Combo",
    clipPath: "anims/baked/greatsword_samurai/gs_samurai_combo_b.json",
    animRole: "skill1",
    reach: 2.8, damage: 40, lungeSpeed: 4.5, lungeDuration: 0.32,
    vfxColor: 0xffd040, cooldown: 2.2,
    effectKind: "slashWave",
    slashVariant: "slashyellow",
    impactEffectId: "getsuga_slash",
  },
  {
    animKey: "gs_samurai_dash",
    slot: 3,
    label: "Dash Opener",
    clipPath: "anims/baked/greatsword_samurai/gs_samurai_dash_opener.json",
    animRole: "skill2",
    reach: 3.4, damage: 38, lungeSpeed: 11.0, lungeDuration: 0.36,
    vfxColor: 0x80e0ff, cooldown: 5.0,
    effectKind: "getsuga",
    slashVariant: "slashblue",
    impactEffectId: "getsuga_slash",
  },
  {
    animKey: "gs_samurai_teleport",
    slot: 4,
    label: "Teleport Strike",
    clipPath: "anims/baked/greatsword_samurai/gs_samurai_teleport_strike.json",
    animRole: "skill3",
    reach: 3.8, damage: 58, lungeSpeed: 14.0, lungeDuration: 0.40,
    vfxColor: 0xc080ff, cooldown: 10.0,
    effectKind: "getsuga",
    slashVariant: "slashpurple",
    impactEffectId: "getsuga_slash",
  },
] as const;

/** @deprecated alias — heavy 2H uses samurai pack */
export const AXE_SKILLS = SAMURAI_2H_SKILLS;

// ── Spear (Madarame): 1_1 base · 1_5 lunge · skill2_1 rush/AoE · ultimate ───
export const SPEAR_SKILLS: readonly SkillPack[] = [
  {
    animKey: "spear_thrust",
    slot: 1,
    label: "Spear Combo",
    clipPath: "anims/baked/polearm/attack.json",
    reach: 4.0, damage: 40, lungeSpeed: 4.0, lungeDuration: 0.18,
    vfxColor: 0xc8e8ff, cooldown: 0,
  },
  {
    animKey: "spear_lunge",
    slot: 2,
    label: "Piercing Lunge",
    clipPath: "anims/baked/polearm/attack5.json",
    reach: 6.0, damage: 55, lungeSpeed: 10.0, lungeDuration: 0.34,
    vfxColor: 0x90d0ff, cooldown: 3.2,
  },
  {
    animKey: "spear_cyclone",
    slot: 3,
    label: "Spear Rush",
    clipPath: "anims/baked/polearm/skill2.json",
    reach: 5.0, damage: 80, lungeSpeed: 9.0, lungeDuration: 0.38,
    vfxColor: 0xa0d8ff, cooldown: 8.0,
  },
  {
    animKey: "spear_dragontail",
    slot: 4,
    label: "Dragontail Sweep",
    clipPath: "anims/baked/polearm/special.json",
    reach: 6.0, damage: 120, lungeSpeed: 3.0, lungeDuration: 0.28,
    vfxColor: 0xffd080, cooldown: 18.0,
  },
] as const;

// ── Magic pack ───────────────────────────────────────────────────────────────
export const MAGIC_SKILLS: readonly SkillPack[] = [
  {
    animKey: "magic_bolt",
    slot: 1,
    label: "Arcane Bolt",
    clipPath: "anims/baked/magic/standing 1h cast spell 01.json",
    reach: 8.0, damage: 22, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xb98cff, cooldown: 0,
  },
  {
    animKey: "magic_nova",
    slot: 2,
    label: "Arcane Nova",
    clipPath: "anims/baked/magic/staffattack.json",
    reach: 4.0, damage: 35, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xd4aaff, cooldown: 3.0,
  },
  {
    animKey: "magic_area",
    slot: 3,
    label: "Area Burst",
    clipPath: "anims/baked/polearm/skill1.json",
    reach: 5.0, damage: 48, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x8844ff, cooldown: 6.0,
  },
  {
    animKey: "magic_cast",
    slot: 4,
    label: "Grand Casting",
    clipPath: "anims/baked/polearm/special.json",
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
    clipPath: "anims/baked/longbow/standing aim recoil.json",
    reach: 12.0, damage: 20, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x70ff90, cooldown: 0,
  },
  {
    animKey: "bow_overdraw",
    slot: 2,
    label: "Overdraw",
    clipPath: "anims/baked/longbow/overdraw.json",
    reach: 18.0, damage: 38, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0x40ffa0, cooldown: 4.0,
  },
  {
    animKey: "bow_dodge",
    slot: 3,
    label: "Dive & Fire",
    clipPath: "anims/baked/longbow/standing dodge forward.json",
    reach: 8.0, damage: 28, lungeSpeed: 6.0, lungeDuration: 0.3,
    vfxColor: 0x20e060, cooldown: 5.0,
  },
  {
    animKey: "bow_kick",
    slot: 4,
    label: "Melee Kick",
    clipPath: "anims/baked/polearm/attack.json",
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
    clipPath: "anims/baked/unarmed/punching.json",
    reach: 1.6, damage: 14, lungeSpeed: 4.0, lungeDuration: 0.20,
    vfxColor: 0xff7a1e, cooldown: 0,
  },
  {
    animKey: "striker_combo",
    slot: 2,
    label: "Punch Combo",
    clipPath: "anims/baked/polearm/combo.json",
    reach: 1.8, damage: 22, lungeSpeed: 3.5, lungeDuration: 0.30,
    vfxColor: 0xff5500, cooldown: 2.0,
  },
  {
    animKey: "striker_flip",
    slot: 3,
    label: "Flip Kick",
    clipPath: "anims/baked/polearm/attack5.json",
    reach: 2.2, damage: 32, lungeSpeed: 6.0, lungeDuration: 0.38,
    vfxColor: 0xff3300, cooldown: 4.0,
  },
  {
    animKey: "striker_uppercut",
    slot: 4,
    label: "Knee Uppercut",
    clipPath: "anims/baked/polearm/special.json",
    reach: 1.9, damage: 40, lungeSpeed: 2.0, lungeDuration: 0.45,
    vfxColor: 0xffd44d, cooldown: 7.0,
  },
] as const;

/** Pick the skill pack for a given weapon family. */
export function skillPackForFamily(family: WeaponFamily): readonly SkillPack[] {
  switch (family) {
    case "sword":     return SWORD_SKILLS;
    case "greatsword":return SAMURAI_2H_SKILLS;
    case "axe":       return SAMURAI_2H_SKILLS;
    case "mace":      return SAMURAI_2H_SKILLS;
    case "spear":     return SPEAR_SKILLS;
    case "magic":     return MAGIC_SKILLS;
    case "longbow":   return LONGBOW_SKILLS;
    case "unarmed":   return STRIKER_SKILLS;
    default:          return SWORD_SKILLS;
  }
}

/** Map an animPack string (from gearPresets.ts / Explosive map) to a weapon family. */
export function familyFromAnimPack(animPack: string): WeaponFamily {
  switch (animPack) {
    case "twohand":
    case "2h_melee":
    case "2h":
    case "samurai":
    case "greatsword_samurai":
      return "greatsword";
    case "crossbow":
      return "longbow"; // same ranged family until dedicated family ships
    case "rifle":
    case "gun":
      return "longbow"; // ranged VFX path; T0 skills still use rifle kit by weaponId
    case "sword_shield":
      return "sword";
    case "polearm":
      return "spear";
    case "longbow":
      return "longbow";
    case "magic":
      return "magic";
    case "unarmed":
      return "unarmed";
    case "pistol":
      return "longbow"; // ranged VFX; clips from pistol pack via animPack
    default:
      return "sword";
  }
}

/** Map arsenal weapon id → skill family (spear ≠ sword). */
export function familyFromWeaponId(weaponId: string | null | undefined): WeaponFamily {
  const w = String(weaponId || "").toLowerCase();
  if (w === "spear" || w === "javelin" || w === "lance" || w === "halberd") return "spear";
  if (w === "greatsword" || w === "greataxe" || w === "hammer2h") return "greatsword";
  if (w === "axe" || w === "mace" || w === "hammer") return "axe";
  if (w.startsWith("staff") || w === "wand") return "magic";
  if (w === "bow" || w === "longbow" || w === "crossbow") return "longbow";
  if (w === "none" || w === "unarmed" || w === "fist") return "unarmed";
  return "sword";
}

/** Primary attack skill (slot 1) for a weapon family. */
export function primarySkill(family: WeaponFamily): SkillPack {
  return skillPackForFamily(family)[0]!;
}

/**
 * Mixer role for a skill pack entry (baked grudge6 / director one-shot).
 * Prefer bakedRole → animRole → slot-based skillN → attack.
 */
export function skillBakedRole(skill: SkillPack): string {
  if (skill.bakedRole) return skill.bakedRole;
  if (skill.animRole) return skill.animRole;
  if (skill.slot >= 1 && skill.slot <= 4) return `skill${skill.slot}`;
  return "attack";
}
