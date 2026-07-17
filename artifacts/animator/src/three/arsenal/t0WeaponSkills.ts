/**
 * T0 equipment weapon-skill catalog for Danger Room combat.
 *
 * Source art / design refs (reviewed 2026-07-15):
 *  - docs/ref-combat/t0-equipment-skills-1.png  — skill kits (Combo / Special / Ranged / Power)
 *  - docs/ref-combat/t0-equipment-skills-2.png  — MM scale (+100 gap-close … −100 keep-distance)
 *  - docs/ref-combat/block-parry-1.png           — MM trajectory in Danger Room
 *  - docs/ref-combat/block-parry-2.png           — enemy attack reaction windows
 *
 * Slot order matches the HUD: 1=Combo, 2=Special, 3=Ranged, 4=Power Move.
 * Motion-math (MM): Studio uses `MM_TO_M = 0.01` → 100 MM ≈ 1 m body displacement.
 */
import type { SkillKind, WeaponId } from "../types";
import {
  buildMasterKit,
  getCachedMasterWeaponSkills,
  masterKitToSignatureSkills,
} from "../content/masterWeaponSkills";
import { isSpearWeapon, spearSignatureRows } from "../ummorpg/spearCombat";
import { heavySignatureRows, isHeavy2hWeapon } from "../combat/heavyWeaponCombat";

/** Skill role within a 4-slot T0 kit. */
export type T0SkillRole = "combo" | "special" | "ranged" | "power";

export type T0SkillDef = {
  role: T0SkillRole;
  /** HUD / loadout label */
  label: string;
  /** VFX / resolve kind used by Studio */
  kind: SkillKind;
  /**
   * Motion-math: +melee gap-close, −ranged keep-distance.
   * Range roughly −100 … +100 (see ref sheet).
   */
  mm: number;
  /** Optional dash mode for gap-closers */
  mode?: "default" | "dash";
  /** Seconds skill locks combat (cooldown floor) */
  cooldown?: number;
};

export type T0WeaponKit = {
  weaponId: WeaponId;
  /** Display family name matching the art sheet */
  family: string;
  skills: [T0SkillDef, T0SkillDef, T0SkillDef, T0SkillDef];
};

const ROLE_LABEL: Record<T0SkillRole, string> = {
  combo: "Combo",
  special: "Special",
  ranged: "Ranged",
  power: "Power Move",
};

function kit(
  weaponId: WeaponId,
  family: string,
  rows: Array<[T0SkillRole, string, SkillKind, number, ("default" | "dash")?]>,
): T0WeaponKit {
  const skills = rows.map(([role, label, kind, mm, mode]) => ({
    role,
    label: label || `${family} ${ROLE_LABEL[role]}`,
    kind,
    mm,
    mode,
    cooldown: role === "power" ? 4.5 : role === "special" ? 2.8 : role === "ranged" ? 2.2 : 1.6,
  })) as T0WeaponKit["skills"];
  return { weaponId, family, skills };
}

/**
 * Canonical T0 kits — MM values from ref sheet 2; families from sheet 1.
 * Melee families default +MM; staff/bow/gun default −MM.
 */
export const T0_WEAPON_KITS: Record<string, T0WeaponKit> = {
  none: kit("none", "Unarmed", [
    ["combo", "Unarmed Combo", "slash", 70],
    ["special", "Unarmed Special", "nova", 85],
    ["ranged", "Unarmed Ranged", "bolt", 55],
    ["power", "Unarmed Power", "slam", 100, "dash"],
  ]),
  sword: kit("sword", "Sword and Shield", [
    ["combo", "Sword Combo", "slash", 70],
    ["special", "Shield Bash", "slam", 85],
    ["ranged", "Sword Throw", "bolt", 55],
    ["power", "Blade Storm", "nova", 100],
  ]),
  greatsword: kit("greatsword", "Great Sword", [
    ["combo", "Greatsword Combo", "slash", 70],
    ["special", "Whirlwind", "nova", 85],
    ["ranged", "Shockwave", "slam", 55],
    ["power", "Judgement", "slam", 100, "dash"],
  ]),
  axe: kit("axe", "Battle Axe", [
    ["combo", "Axe Combo", "slash", 70],
    ["special", "Spin Cleave", "nova", 85],
    ["ranged", "Axe Toss", "bolt", 55],
    ["power", "Earth Shatter", "slam", 100, "dash"],
  ]),
  greataxe: kit("greataxe", "Battle Axe", [
    ["combo", "Greataxe Combo", "slash", 70],
    ["special", "Carnage Spin", "nova", 85],
    ["ranged", "Cleave Wave", "slash", 55],
    ["power", "Execute", "slam", 100, "dash"],
  ]),
  dagger: kit("dagger", "Daggers", [
    ["combo", "Dagger Combo", "slash", 70],
    ["special", "Fan of Knives", "nova", 85],
    ["ranged", "Throwing Knives", "bolt", 55],
    ["power", "Shadow Ambush", "slash", 100, "dash"],
  ]),
  // Madarame: 1_1/1_2 base · 1_5 lunge · skill2_1 speed/AoE · dragontail
  spear: kit("spear", "Spear", [
    ["combo", "Spear Combo", "thrust", 55],
    ["special", "Piercing Lunge", "thrust", 100, "dash"],
    ["ranged", "Spear Rush", "nova", 70, "dash"],
    ["power", "Dragontail Sweep", "nova", 50],
  ]),
  hammer: kit("hammer", "War Hammer", [
    ["combo", "Hammer Combo", "slam", 70],
    ["special", "Ground Pound", "slam", 85],
    ["ranged", "Shock Pulse", "nova", 55],
    ["power", "Meteor Smash", "slam", 100, "dash"],
  ]),
  hammer2h: kit("hammer2h", "War Hammer", [
    ["combo", "2H Hammer Combo", "slam", 70],
    ["special", "Quake", "slam", 85],
    ["ranged", "Rubble Shot", "bolt", 55],
    ["power", "Anvil Drop", "slam", 100, "dash"],
  ]),
  mace: kit("mace", "War Hammer", [
    ["combo", "Mace Combo", "slam", 70],
    ["special", "Holy Smite", "slam", 85],
    ["ranged", "Consecrate", "nova", 55],
    ["power", "Judgement", "slam", 100],
  ]),
  bow: kit("bow", "Long Bow", [
    ["combo", "Aimed Shot", "muzzle", -70],
    ["special", "Multi Shot", "muzzle", -85],
    ["ranged", "Rain of Arrows", "nova", -100],
    ["power", "Piercing Volley", "muzzle", -95],
  ]),
  staff: kit("staff", "Arcane Staff", [
    ["combo", "Arcane Bolt", "bolt", -70],
    ["special", "Scatter", "nova", -85],
    ["ranged", "Barrage", "bolt", -100],
    ["power", "Arcane Nova", "nova", -95],
  ]),
  staffFire: kit("staffFire", "Arcane Staff", [
    ["combo", "Firebolt", "bolt", -70],
    ["special", "Flame Wave", "nova", -85],
    ["ranged", "Meteor", "meteor", -100],
    ["power", "Inferno", "nova", -95],
  ]),
  staffIce: kit("staffIce", "Ice Staff", [
    ["combo", "Ice Spline", "bolt", -70],
    ["special", "Ice Wall", "slam", 55],
    ["ranged", "Frost Shell", "bolt", -40],
    ["power", "Blizzard", "nova", -100],
  ]),
  staffStorm: kit("staffStorm", "Arcane Staff", [
    ["combo", "Spark", "bolt", -70],
    ["special", "Chain Lightning", "nova", -85],
    ["ranged", "Thunder", "laser", -100],
    ["power", "Tempest", "nova", -95],
  ]),
  staffNature: kit("staffNature", "Arcane Staff", [
    ["combo", "Thorn", "bolt", -70],
    ["special", "Bloom", "nova", -85],
    ["ranged", "Vine Lash", "bolt", -100],
    ["power", "Wild Growth", "nova", -95],
  ]),
  staffHoly: kit("staffHoly", "Arcane Staff", [
    ["combo", "Smite", "bolt", -70],
    ["special", "Radiance", "nova", -85],
    ["ranged", "Holy Lance", "bolt", -100],
    ["power", "Judgement", "nova", -95],
  ]),
  // Class GUN — labels/kind from arsenal/gunClass (6 tiers each elsewhere).
  pistol: kit("pistol", "Revolver", [
    ["combo", "Quick Draw", "muzzle", -70],
    ["special", "Smoke Phantom", "muzzle", -85],
    ["ranged", "Dive Kick", "slam", 70],
    ["power", "Hexaring Beam", "laser", -95],
  ]),
  rifle: kit("rifle", "Rifle", [
    ["combo", "3-Round Burst", "muzzle", -70],
    ["special", "Deploy Turret", "turret", -85],
    ["ranged", "Combat Vault", "muzzle", 55],
    ["power", "Heavy Turret", "turret", -95],
  ]),
  "hunter-rifle": kit("hunter-rifle", "Sniper Rifle", [
    ["combo", "Marked Burst", "muzzle", -70],
    ["special", "Marked Shot", "muzzle", -85],
    ["ranged", "Vault Shot", "muzzle", 55],
    ["power", "Heavy Turret", "turret", -95],
  ]),
  shotgun: kit("shotgun", "Shotgun", [
    ["combo", "Pump Chain", "muzzle", -40],
    ["special", "Slug Piercer", "muzzle", -70],
    ["ranged", "Combat Vault", "muzzle", 60],
    ["power", "Dragon Breath", "nova", -90],
  ]),
  shield: kit("shield", "Tower Shield", [
    ["combo", "Shield Bash Combo", "slam", 70],
    ["special", "Phalanx", "nova", -85],
    ["ranged", "Shield Toss", "bolt", 55],
    ["power", "Bulwark Slam", "slam", -95],
  ]),
  javelin: kit("javelin", "Spear", [
    ["combo", "Javelin Combo", "slash", 70],
    ["special", "Skewer", "slash", 85],
    ["ranged", "Throw", "bolt", -70],
    ["power", "Rain of Spears", "nova", 55],
  ]),
  gunblade: kit("gunblade", "Sword and Shield", [
    ["combo", "Gunblade Combo", "slash", 70],
    ["special", "Blast Slash", "muzzle", 55],
    ["ranged", "Point Blank", "muzzle", -70],
    ["power", "Lion Heart", "nova", 100],
  ]),
  // uMMORPG / master-weaponSkills families
  crossbow: kit("crossbow", "Heavy Crossbow", [
    ["combo", "Scatter Bolt", "muzzle", -55],
    ["special", "Explosive Burst", "slam", -70],
    ["ranged", "Caltrop Trap", "nova", 40],
    ["power", "Skyfall Barrage", "meteor", -90],
  ]),
  wand: kit("wand", "Wand", [
    ["combo", "Magic Missile", "bolt", -70],
    ["special", "Arcane Pulse", "nova", -85],
    ["ranged", "Void Bolt", "bolt", -100],
    ["power", "Meteor Shower", "meteor", -95],
  ]),
  tome: kit("tome", "Grudge Tome", [
    ["combo", "Elemental Bolt", "bolt", -70],
    ["special", "Elemental Nova", "nova", -85],
    ["ranged", "Elemental Surge", "bolt", -90],
    ["power", "Page Surge", "nova", -100],
  ]),
  scythe: kit("scythe", "Reaper Scythe", [
    ["combo", "Reaping Slash", "slash", 70],
    ["special", "Soul Harvest", "darkBlades", 85],
    ["ranged", "Spectral Chains", "bolt", 55],
    ["power", "Grim Reaper", "nova", 100, "dash"],
  ]),
};

/** Fallback kit when a weapon id has no dedicated entry. */
const FALLBACK = T0_WEAPON_KITS.none;

export function getT0Kit(weaponId: WeaponId | string): T0WeaponKit {
  return T0_WEAPON_KITS[weaponId] ?? FALLBACK;
}

/** 0-based signature slot (0..3) → skill def. */
export function getT0Skill(weaponId: WeaponId | string, slotIndex: number): T0SkillDef {
  const kit = getT0Kit(weaponId);
  const i = Math.max(0, Math.min(3, slotIndex | 0));
  return kit.skills[i];
}

/**
 * Character signatureSkills-compatible rows for HUD / Studio.
 * Prefer ObjectStore master-weaponSkills names/icons when catalog is loaded,
 * else local T0 sheet kits.
 */
export function t0SignatureSkills(weaponId: WeaponId | string): {
  label: string;
  clip: string;
  kind: SkillKind;
  mode?: "default" | "dash";
  mm: number;
  cooldown: number;
  iconUrl?: string | null;
  skillId?: string;
  damage?: number;
  castTime?: number;
  dashM?: number;
  dashDur?: number;
}[] {
  // Heavy 2H: Madarame + annihilate GS (variable MM / intensity)
  if (isHeavy2hWeapon(weaponId)) {
    return heavySignatureRows(weaponId);
  }
  // SPEAR: uMMORPG runtime table (clips + charge distances) — always available offline
  if (isSpearWeapon(weaponId)) {
    const cat = getCachedMasterWeaponSkills();
    if (cat) {
      const mk = buildMasterKit(weaponId as WeaponId, cat);
      if (mk) {
        // Merge master names/icons with spearCombat clip/dash plan
        const base = spearSignatureRows();
        const master = masterKitToSignatureSkills(mk);
        return base.map((row, i) => {
          const m = master[i];
          return {
            ...row,
            label: m?.label || row.label,
            iconUrl: m?.iconUrl ?? row.iconUrl,
            damage: m?.damage ?? row.damage,
            cooldown: m?.cooldown ?? row.cooldown,
            skillId: m?.skillId || row.skillId,
            clip: row.clip, // keep polearm Madarame roles
            mode: row.mode,
            mm: row.mm,
          };
        });
      }
    }
    return spearSignatureRows();
  }
  // Prefer ObjectStore master-weaponSkills (uMMORPG catalog) when loaded
  const cat = getCachedMasterWeaponSkills();
  if (cat) {
    const mk = buildMasterKit(weaponId as WeaponId, cat);
    if (mk) return masterKitToSignatureSkills(mk);
  }
  return getT0Kit(weaponId).skills.map((s) => ({
    label: s.label,
    clip: "attack",
    kind: s.kind,
    mode: s.mode ?? (s.mm >= 80 ? "dash" : "default"),
    mm: s.mm,
    cooldown: s.cooldown ?? 2,
  }));
}

/** Map MM (−100…+100) → metres (matches Studio MM_TO_M = 0.01). */
export function mmToMeters(mm: number, scale = 0.01): number {
  return mm * scale;
}

/**
 * Enemy attack phase template from reaction-timeline ref (Shadow Lunge style).
 * Hosts should scale to clip duration but keep ratios for telegraphs.
 */
export const T0_ATTACK_PHASE = {
  /** Total example attack duration (seconds) */
  total: 1.7,
  windup: 0.8,
  active: 0.3,
  recovery: 0.6,
  /** Absolute windows on the attack timeline (for telegraphs / AI) */
  parry: { start: 0.65, end: 0.95 }, // 0.30s narrow
  block: { start: 0.3, end: 1.2 }, // 0.90s wide
  dodge: { start: 0.3, end: 1.6 }, // 1.40s widest
} as const;

/**
 * Defender-side reaction windows used by CombatController (age since press).
 * Derived from ref: parry narrow 0.30s, perfect inside first ~40% of that.
 */
export const T0_REACTION_WINDOWS = {
  /** Perfect parry (opens enemy) */
  parryPerfect: 0.12,
  /** Full parry / deflect window */
  parryDeflect: 0.3,
  /** Early-dodge punish window */
  dodgePunish: 0.12,
  /** Dodge i-frame span (iframeEnd − iframeStart) — matches wide evade feel */
  dodgeIframeStart: 0.04,
  dodgeIframeEnd: 0.42,
  dodgeDuration: 0.55,
  /** Chip fraction when block force is overwhelmed (block still helps) */
  blockChipFraction: 0.4,
} as const;
