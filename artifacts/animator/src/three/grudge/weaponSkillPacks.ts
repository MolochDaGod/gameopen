/**
 * Weapon skill packs — production combat definitions for grudge6 characters.
 *
 * Maps the `animKey` strings from `content/skills/*.json` (e.g. "sword_slash")
 * to full combat parameters: FBX animation clip path, hit reach, damage, MM
 * (Maneuver Motion) lunge impulse, VFX colour, and cooldown.
 *
 * These are consumed by Grudge6CombatCharacter to build the character's
 * hotbar-slot skill set at load time.
 *
 * Magic / staffs: CastingAbilities element migration → castingElementSkills.ts
 */

import {
  MAGIC_SKILLS_FROM_CASTING,
  skillPackForStaffWeaponId,
  STAFF_ARCANE_SKILLS,
} from "./castingElementSkills";

/** Weapon families with associated skill sets. */
export type WeaponFamily =
  | "sword"       // 1H sword ± shield — sword_shield anim pack
  | "greatsword"  // 2H sword / axe / greatsword — heavy melee
  | "axe"         // Great-axe — heavy melee (shares greatsword clips)
  | "mace"        // Hammer / mace — heavy melee
  | "spear"       // Spear / lance
  | "magic"       // Staff / tome — ranged spells
  | "longbow"     // Bow — ranged physical
  | "gun"         // Pistol / rifle / shotgun — live /anims/baked clips
  | "unarmed"     // Kick / striker
  | "chain";      // Hellfire chain — ranged-melee extending projectile

/** Combat VFX kind for skill cast / impact. */
export type SkillEffectKind =
  | "impact"
  | "slash"
  | "slashWave"
  | "getsuga"
  | "nova"
  | "slam"
  /** Extending hellfire chain mesh projectile (ranged-melee). */
  | "chain";

export type SlashVariantId = "slashred" | "slashblue" | "slashpurple" | "slashyellow";

/** Traveling projectile kind spawned on skill fire. */
export type SkillProjectileKind =
  | "none"
  | "slash_wave"
  | "bolt"
  | "arrow"
  /** Extending chain weapon mesh + flame aura (Ghost Rider path). */
  | "hellfire_chain";

export interface SkillPack {
  /** Matches `animKey` in content/skills/*.json. */
  animKey: string;
  /** Hotbar slot (1-4). */
  slot: 1 | 2 | 3 | 4;
  /** Human-readable label. */
  label: string;
  /**
   * Baked clip path (relative to public/) — /anims/baked JSON only.
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
  /** Production combat VFX kind (Getsuga / arc / nova / chain). */
  effectKind?: SkillEffectKind;
  /** Slash mesh variant for getsuga / slashWave / chain flame kit. */
  slashVariant?: SlashVariantId;
  /** Optional fleet impact effect id. */
  impactEffectId?: string;
  /** Optional cast telegraph effect id. */
  castEffectId?: string;
  /**
   * Traveling projectile spawned with the skill.
   * `hellfire_chain` = extending chain weapon mesh + flame aura, quick dissipate.
   */
  projectile?: SkillProjectileKind;
  /** GR path sample role for hellfire_chain (chain_throw, megachain_slam…). */
  chainPathRole?: string;
  /** Apply Controller.dash for MM (default: lungeSpeed > 0.5). */
  useDash?: boolean;
}

// ── Sword pack ───────────────────────────────────────────────────────────────
export const SWORD_SKILLS: readonly SkillPack[] = [
  {
    animKey: "sword_slash",
    slot: 1,
    label: "Slash",
    // Production: Sketchfab AttackCombo01 (trimmed wind-up) on Open baked
    clipPath: "anims/baked/sword_shield/attack-combo-01-trimmed.json",
    animRole: "attack",
    bakedRole: "attack",
    reach: 1.8, damage: 18, lungeSpeed: 3.5, lungeDuration: 0.22,
    vfxColor: 0xe8d9a0, cooldown: 0,
  },
  {
    animKey: "sword_two_hit",
    slot: 2,
    label: "Twin Slash",
    clipPath: "anims/baked/sword_shield/attack-combo-02.json",
    animRole: "attack2",
    bakedRole: "attack2",
    reach: 1.9, damage: 26, lungeSpeed: 4.0, lungeDuration: 0.28,
    vfxColor: 0xffe8b0, cooldown: 1.5,
  },
  {
    animKey: "sword_spin_high",
    slot: 3,
    label: "Spin High",
    clipPath: "anims/baked/dual_wield/sword_dash_attack.json",
    animRole: "skill2",
    bakedRole: "skill2",
    reach: 2.4, damage: 34, lungeSpeed: 2.0, lungeDuration: 0.45,
    vfxColor: 0xffd080, cooldown: 4.0,
  },
  {
    animKey: "sword_dash",
    slot: 4,
    label: "Slash Advance",
    clipPath: "anims/baked/dual_wield/sword_dash_attack.json",
    animRole: "skill3",
    bakedRole: "skill3",
    reach: 3.2, damage: 28, lungeSpeed: 8.0, lungeDuration: 0.35,
    vfxColor: 0x80e0ff, cooldown: 6.0,
    useDash: true,
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

/** @deprecated alias — heavy 2H blades use samurai pack (not blunt mace) */
export const AXE_SKILLS = SAMURAI_2H_SKILLS;

/**
 * Shared combo finisher + chain ultimate from Ghost Rider bake (mesh discarded).
 * Use quakesmash on many melee / ranged-melee enders; megachain with flame path FX.
 */
export const SHARED_FINISHER_SKILLS: readonly SkillPack[] = [
  {
    animKey: "combo_finisher_quake",
    slot: 3,
    label: "Quake Smash",
    clipPath: "anims/baked/ghost_rider/quakesmash.json",
    animRole: "combo_finisher",
    bakedRole: "quakesmash",
    reach: 2.6, damage: 44, lungeSpeed: 4.0, lungeDuration: 0.28,
    vfxColor: 0xff7030, cooldown: 4.0,
    effectKind: "slam",
    impactEffectId: "frost_wave",
  },
  {
    animKey: "megachain_firequake",
    slot: 4,
    label: "Mega Chain Firequake",
    clipPath: "anims/baked/ghost_rider/megachain_slam.json",
    animRole: "megachain_slam",
    bakedRole: "megachain_slam",
    reach: 4.5, damage: 72, lungeSpeed: 2.0, lungeDuration: 0.55,
    vfxColor: 0xff4010, cooldown: 12.0,
    effectKind: "nova",
    impactEffectId: "fire_aura",
  },
] as const;

/**
 * Ranged-melee hellfire chain — **extending weapon mesh** projectile.
 * Body anim from Ghost Rider bake; Vfx.hellfireChain grows chain links +
 * flame-aura energy (color variants), tip damages, quick dissipate on land.
 */
export const CHAIN_RANGED_MELEE_SKILLS: readonly SkillPack[] = [
  {
    animKey: "chain_throw",
    slot: 1,
    label: "Chain Throw",
    clipPath: "anims/baked/ghost_rider/chain_throw.json",
    animRole: "chain_throw",
    bakedRole: "chain_throw",
    reach: 6.0, damage: 28, lungeSpeed: 1.2, lungeDuration: 0.15,
    vfxColor: 0xff6020, cooldown: 0,
    effectKind: "chain",
    slashVariant: "slashred",
    projectile: "hellfire_chain",
    chainPathRole: "chain_throw",
    castEffectId: "fire_aura",
    impactEffectId: "hellfire_chain_path",
  },
  {
    animKey: "chain_stab",
    slot: 2,
    label: "Hyper Chain Stab",
    clipPath: "anims/baked/ghost_rider/chain_stab_hyper.json",
    animRole: "chain_stab",
    bakedRole: "chain_stab",
    reach: 5.5, damage: 42, lungeSpeed: 4.0, lungeDuration: 0.22,
    vfxColor: 0x4aa8ff, cooldown: 2.5,
    effectKind: "chain",
    slashVariant: "slashblue",
    projectile: "hellfire_chain",
    chainPathRole: "chain_stab",
    castEffectId: "fire_aura",
    impactEffectId: "hellfire_chain_path",
  },
  {
    animKey: "chain_spin",
    slot: 3,
    label: "Chain Spin",
    clipPath: "anims/baked/ghost_rider/chain_spin.json",
    animRole: "chain_spin",
    bakedRole: "chain_spin",
    reach: 3.8, damage: 38, lungeSpeed: 0.5, lungeDuration: 0.2,
    vfxColor: 0xffe08a, cooldown: 5.0,
    effectKind: "chain",
    slashVariant: "slashyellow",
    projectile: "hellfire_chain",
    chainPathRole: "chain_spin",
    castEffectId: "fire_aura",
    impactEffectId: "hellfire_chain_path",
  },
  {
    animKey: "megachain_firequake",
    slot: 4,
    label: "Mega Chain Firequake",
    clipPath: "anims/baked/ghost_rider/megachain_slam.json",
    animRole: "megachain_slam",
    bakedRole: "megachain_slam",
    reach: 7.5, damage: 72, lungeSpeed: 1.5, lungeDuration: 0.35,
    vfxColor: 0xb070ff, cooldown: 12.0,
    effectKind: "chain",
    slashVariant: "slashpurple",
    projectile: "hellfire_chain",
    chainPathRole: "megachain_slam",
    castEffectId: "inferno",
    impactEffectId: "hellfire_chain_path",
  },
] as const;

/**
 * 2H mace / war-hammer — SC_SC bake under anims/baked/twohand_hammer/*
 * (2hweaponhammerretarget.glb). Slot 3/4 reuse GR quakesmash + megachain.
 */
export const MACE_SKILLS: readonly SkillPack[] = [
  {
    animKey: "mace_jab",
    slot: 1,
    label: "Hammer Jab",
    clipPath: "anims/baked/twohand_hammer/attack.json",
    animRole: "attack",
    bakedRole: "attack",
    reach: 2.0, damage: 26, lungeSpeed: 3.8, lungeDuration: 0.28,
    vfxColor: 0xc8a070, cooldown: 0,
    effectKind: "slam",
    impactEffectId: "blunt_impact",
  },
  {
    animKey: "mace_charge",
    slot: 2,
    label: "Charge Strike",
    clipPath: "anims/baked/twohand_hammer/attack-charge.json",
    animRole: "skill1",
    bakedRole: "attack2",
    reach: 2.4, damage: 40, lungeSpeed: 6.5, lungeDuration: 0.42,
    vfxColor: 0xe0b070, cooldown: 2.5,
    effectKind: "slam",
    impactEffectId: "blunt_impact",
  },
  {
    animKey: "mace_quake_finisher",
    slot: 3,
    label: "Quake Smash",
    clipPath: "anims/baked/ghost_rider/quakesmash.json",
    animRole: "combo_finisher",
    bakedRole: "quakesmash",
    reach: 2.8, damage: 48, lungeSpeed: 1.5, lungeDuration: 0.45,
    vfxColor: 0xffc060, cooldown: 5.0,
    effectKind: "slam",
    impactEffectId: "frost_wave",
  },
  {
    animKey: "mace_firequake",
    slot: 4,
    label: "Firequake Slam",
    clipPath: "anims/baked/ghost_rider/megachain_slam.json",
    animRole: "megachain_slam",
    bakedRole: "megachain_slam",
    reach: 5.5, damage: 62, lungeSpeed: 2.0, lungeDuration: 0.4,
    vfxColor: 0xff4010, cooldown: 10.0,
    effectKind: "chain",
    slashVariant: "slashred",
    projectile: "hellfire_chain",
    chainPathRole: "megachain_slam",
    impactEffectId: "hellfire_chain_path",
  },
] as const;

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

// ── Magic pack (CastingAbilities migrate — purple arcane tree) ─────────────
// Full elemental staff packs: castingElementSkills.ts
//   STAFF_FIRE_SKILLS | STAFF_WATER_SKILLS | STAFF_EARTH_SKILLS
//   STAFF_WIND_SKILLS | STAFF_ARCANE_SKILLS

/** Default magic hotbar = arcane tree (cast/travel/impact from Casting VFX ids). */
export const MAGIC_SKILLS: readonly SkillPack[] = MAGIC_SKILLS_FROM_CASTING;

/** @deprecated alias — use STAFF_ARCANE_SKILLS */
export const MAGIC_SKILLS_LEGACY_LABELS = STAFF_ARCANE_SKILLS;

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

// ── Gun pack (live Open /anims/baked pistol + rifle) ────────────────────────
export const GUN_SKILLS: readonly SkillPack[] = [
  {
    animKey: "gun_shot",
    slot: 1,
    label: "Quick Draw",
    clipPath: "anims/baked/pistol/gunplay.json",
    animRole: "attack",
    bakedRole: "attack",
    reach: 18.0, damage: 22, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xffd080, cooldown: 0,
    effectKind: "impact",
    projectile: "bolt",
  },
  {
    animKey: "gun_charged",
    slot: 2,
    label: "Charged Shot",
    clipPath: "anims/baked/pistol/charged-pistol.json",
    animRole: "skill1",
    bakedRole: "skill1",
    reach: 24.0, damage: 36, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xffa040, cooldown: 2.8,
    effectKind: "impact",
    projectile: "bolt",
  },
  {
    animKey: "gun_whip",
    slot: 3,
    label: "Pistol Whip",
    clipPath: "anims/baked/pistol/pistol-whip.json",
    animRole: "skill2",
    bakedRole: "skill2",
    reach: 1.8, damage: 24, lungeSpeed: 3.5, lungeDuration: 0.2,
    vfxColor: 0xc8a070, cooldown: 4.0,
    effectKind: "slam",
  },
  {
    animKey: "gun_burst",
    slot: 4,
    label: "Rifle Burst",
    clipPath: "anims/baked/rifle/firing-rifle.json",
    animRole: "skill3",
    bakedRole: "skill3",
    reach: 28.0, damage: 48, lungeSpeed: 0, lungeDuration: 0,
    vfxColor: 0xffe0a0, cooldown: 8.0,
    effectKind: "impact",
    projectile: "bolt",
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
    case "mace":      return MACE_SKILLS;
    case "chain":     return CHAIN_RANGED_MELEE_SKILLS;
    case "spear":     return SPEAR_SKILLS;
    case "magic":     return MAGIC_SKILLS;
    case "longbow":   return LONGBOW_SKILLS;
    case "gun":       return GUN_SKILLS;
    case "unarmed":   return STRIKER_SKILLS;
    default:          return SWORD_SKILLS;
  }
}

/**
 * Equip / hotbar SSOT: arsenal weaponId → SkillPack tree.
 * staffFire|staffIce|staffNature|staffStorm|staff → Casting element packs;
 * other weapons → family packs.
 */
export function skillPackForWeaponId(weaponId: string): readonly SkillPack[] {
  const w = String(weaponId || "").toLowerCase();
  if (w.startsWith("staff") || w === "wand" || w === "tome") {
    return skillPackForStaffWeaponId(w);
  }
  return skillPackForFamily(familyFromWeaponId(w));
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
    case "hammer":
      return "mace";
    case "chain":
    case "hellfire_chain":
    case "ghost_rider":
      return "chain";
    case "crossbow":
      return "longbow"; // same ranged family until dedicated family ships
    case "rifle":
    case "gun":
    case "pistol":
      return "gun";
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
    default:
      return "sword";
  }
}

/** Map arsenal weapon id → skill family (spear ≠ sword). */
export function familyFromWeaponId(weaponId: string | null | undefined): WeaponFamily {
  const w = String(weaponId || "").toLowerCase();
  if (w === "spear" || w === "javelin" || w === "lance" || w === "halberd") return "spear";
  if (
    w === "hammer2h" ||
    w === "mace2h" ||
    w === "maul" ||
    w === "warhammer" ||
    w === "mace" ||
    w === "hammer"
  ) {
    return "mace";
  }
  if (
    w === "chain" ||
    w === "whip" ||
    w === "hellfire_chain" ||
    w === "chainwhip" ||
    w.includes("chain")
  ) {
    return "chain";
  }
  if (w === "greatsword" || w === "greataxe") return "greatsword";
  if (w === "axe") return "axe";
  if (w.startsWith("staff") || w === "wand") return "magic";
  if (w === "bow" || w === "longbow" || w === "crossbow") return "longbow";
  if (
    w === "pistol" ||
    w === "rifle" ||
    w === "shotgun" ||
    w === "hunter-rifle" ||
    w === "flintlock" ||
    w.includes("gun")
  ) {
    return "gun";
  }
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
