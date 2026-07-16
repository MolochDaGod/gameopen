/**
 * ScriptableSkill / ScriptableWeapon bridge — uMMORPG ScriptableObject pattern.
 *
 * Unity: ScriptableSkill assets (cooldown, damage, castTime, castAnimation,
 * requiresWeapon) assigned on Player.skills / Npc.skills.
 *
 * Web: ObjectStore master-weaponSkills.json → MasterWeaponKit (4 slots) +
 * content/skills prefabs for anim/VFX. This module is the typed join used by
 * Studio HUD, Brawler, and NPC AI.
 */
import type { WeaponId, SkillKind } from "../types";
import {
  buildMasterKit,
  loadMasterWeaponSkills,
  getCachedMasterWeaponSkills,
  WEAPON_TO_MASTER,
  type MasterKitSkill,
  type MasterWeaponKit,
  type MasterSlotType,
} from "../content/masterWeaponSkills";
import { WEAPON_COMBAT } from "./prefabProfile";
import { generateGunSkills, gunFamilyForWeapon } from "../arsenal/gunClass";

/** uMMORPG-like skill definition (runtime). */
export interface ScriptableSkill {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  /** Cooldown seconds */
  cooldown: number;
  castTime: number;
  damage: number;
  range: number;
  mana: number;
  stamina: number;
  /** Animator one-shot role / clip key */
  animation: string;
  /** VFX / combat routing */
  kind: SkillKind;
  damageType: string;
  slot: MasterSlotType | "utility";
  /** Master catalog uuid when present */
  masterId?: string;
  /** Projectile tag from catalog */
  projectile?: string | null;
  /** Hit window as fraction of cast/anim [0-1] */
  hitWindow: [number, number];
  /** Requires weapon master type (SWORD, BOW, …) */
  requiresWeaponType?: string;
}

export interface ScriptableWeapon {
  weaponId: WeaponId;
  masterType: string;
  name: string;
  iconUrl: string | null;
  combat: (typeof WEAPON_COMBAT)[string];
  skills: ScriptableSkill[];
}

const SLOT_ANIM: Record<string, string> = {
  primary: "attack",
  secondary: "attack",
  ability: "attack",
  ultimate: "attack",
};

function kitSkillToScriptable(
  sk: MasterKitSkill,
  weaponId: WeaponId,
  range: number,
): ScriptableSkill {
  return {
    id: sk.id,
    name: sk.label,
    description: sk.description || "",
    iconUrl: sk.iconUrl,
    cooldown: sk.cooldown,
    castTime: sk.castTime,
    damage: sk.damage,
    range,
    mana: sk.mana,
    stamina: sk.stamina,
    animation: SLOT_ANIM[sk.slot] || "attack",
    kind: sk.kind,
    damageType: sk.damageType,
    slot: sk.slot,
    masterId: sk.id,
    hitWindow: sk.castTime > 0.05 ? [0.4, 0.75] : [0.28, 0.55],
    requiresWeaponType: WEAPON_TO_MASTER[weaponId],
  };
}

/**
 * Ensure master catalog loaded, then build ScriptableWeapon for a WeaponId.
 * Call at Danger Room / brawler boot.
 */
export async function resolveScriptableWeapon(
  weaponId: WeaponId,
  opts?: { tomeSchool?: "fire" | "frost" | "lightning" | "nature" | "arcane" | "holy" },
): Promise<ScriptableWeapon | null> {
  await loadMasterWeaponSkills();
  return scriptableWeaponFromCache(weaponId, opts);
}

export function scriptableWeaponFromCache(
  weaponId: WeaponId,
  opts?: { tomeSchool?: "fire" | "frost" | "lightning" | "nature" | "arcane" | "holy" },
): ScriptableWeapon | null {
  const catalog = getCachedMasterWeaponSkills();
  const kit = buildMasterKit(weaponId, catalog, opts);
  const combat = WEAPON_COMBAT[weaponId] || WEAPON_COMBAT.sword!;
  if (!kit) {
    // Class GUN: offline scriptable kit from arsenal/gunClass (6-tier pattern).
    const gunFam = gunFamilyForWeapon(weaponId);
    if (gunFam) {
      const gen = generateGunSkills(gunFam, 0);
      return {
        weaponId,
        masterType: "GUN",
        name: gunFam.label,
        iconUrl: null,
        combat,
        skills: gen.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          iconUrl: null,
          cooldown: s.cooldown,
          castTime: s.castTime,
          damage: s.damage,
          range: s.range,
          mana: 0,
          stamina: 8 + (s.slot === "ultimate" ? 12 : 4),
          animation: s.animation,
          kind: s.kind,
          damageType: "physical",
          slot: s.slot,
          hitWindow: s.hitWindow,
          requiresWeaponType: "GUN",
        })),
      };
    }
    // Minimal scriptable fallback (still usable offline)
    return {
      weaponId,
      masterType: WEAPON_TO_MASTER[weaponId] || "SWORD",
      name: weaponId,
      iconUrl: null,
      combat,
      skills: [
        {
          id: `${weaponId}_primary`,
          name: "Primary",
          description: "",
          iconUrl: null,
          cooldown: combat.cd,
          castTime: 0,
          damage: combat.damage,
          range: combat.range,
          mana: 0,
          stamina: 0,
          animation: "attack",
          kind: combat.style === "magic" ? "bolt" : combat.style === "ranged" ? "bolt" : "slash",
          damageType: "physical",
          slot: "primary",
          hitWindow: [0.28, 0.55],
        },
      ],
    };
  }
  return {
    weaponId: kit.weaponId,
    masterType: String(kit.masterType),
    name: kit.family,
    iconUrl: kit.iconUrl,
    combat,
    skills: kit.skills.map((s) => kitSkillToScriptable(s, weaponId, combat.range)),
  };
}

/** Hotbar of 4 skills for Studio / Brawler (primary…ultimate). */
export function hotbarFromWeapon(weapon: ScriptableWeapon): ScriptableSkill[] {
  const order = ["primary", "secondary", "ability", "ultimate"] as const;
  return order.map((slot, i) => {
    const hit = weapon.skills.find((s) => s.slot === slot);
    return hit || weapon.skills[i] || weapon.skills[0]!;
  });
}

/**
 * Can cast skill? (uMMORPG Skill.CheckSelf)
 * - cooldown ready (caller tracks)
 * - optional range to target
 */
export function canCastSkill(
  skill: ScriptableSkill,
  opts: { distance?: number; mana?: number; stamina?: number },
): { ok: boolean; reason?: string } {
  if (opts.mana != null && skill.mana > 0 && opts.mana < skill.mana) {
    return { ok: false, reason: "mana" };
  }
  if (opts.stamina != null && skill.stamina > 0 && opts.stamina < skill.stamina) {
    return { ok: false, reason: "stamina" };
  }
  if (opts.distance != null && skill.range > 0 && opts.distance > skill.range * 1.05) {
    return { ok: false, reason: "range" };
  }
  return { ok: true };
}

export type { MasterWeaponKit, MasterKitSkill };
