/**
 * Gun weapon class — production SSOT.
 *
 * Architecture (fleet-wide):
 *  - Guns are one **weapon class** under master type `GUN`.
 *  - Canonical subtypes in Danger Room / Open: **pistol**, **rifle**, **sniper**,
 *    **shotgun**. Pistol is the design reference kit; other subtypes reuse the
 *    same 6-tier + 4-skill pattern for other games / loadouts.
 *  - Each subtype has **exactly 6 weapons** (T0…T5) — same shape as melee /
 *    bows. T0 ships with a canonical GLB; T1+ fill model + skill overrides as
 *    assets land.
 *  - Models (strict):
 *      pistol  → models/weapons/revolver.glb only
 *      rifle   → models/weapons/rifle.glb only
 *      sniper  → models/weapons/rifle.glb (longer hold; sniper.glb when ready)
 *      shotgun → models/weapons/rifle.glb stand-in until shotgun.glb ships
 *
 * Scriptable layer: {@link generateScriptableGun} + anim/VFX key patterns so
 * generators and master-weaponSkills can fill kits without hardcoding Studio.
 */
import type { SkillKind, WeaponId } from "../types";
import type { GunLoadout } from "../gunCombat";
import type { SkillVfxOp } from "../skillCombos";
import type { T0SkillDef, T0SkillRole } from "./t0WeaponSkills";

/** Canonical gun families (subtypes of class GUN). */
export type GunFamilyId = "pistol" | "rifle" | "sniper" | "shotgun";

/** Six-tier ladder (T0 base → T5 apex). */
export type GunTierIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface GunAnimPattern {
  /** Primary fire one-shot / overlay */
  shoot: string[];
  reload: string[];
  aim: string[];
  vault: string[];
  /** Per hotbar slot 0..3 preferred clips */
  skills: [string[], string[], string[], string[]];
}

export interface GunVfxPattern {
  tracer: number;
  plasma: number;
  muzzle: number;
  impact: number;
  /** Special (F hold / power) accent */
  special: number;
}

export interface GunTierDef {
  index: GunTierIndex;
  /** Display name within the family */
  name: string;
  /** Damage / force scalar vs T0 */
  power: number;
  /**
   * Optional GLB when the tier has unique art. Empty → family canonical model.
   * Path relative to public (e.g. models/weapons/revolver-t3.glb).
   */
  modelFile?: string;
  /** Optional loadout overrides (clip, damage, colors) */
  loadout?: Partial<GunLoadout>;
}

export interface GunSkillTemplate {
  role: T0SkillRole;
  label: string;
  kind: SkillKind;
  /** Motion-math (− = keep distance, + = close) */
  mm: number;
  cooldown: number;
  castTime: number;
  /** Scriptable skill id suffix */
  id: string;
  description: string;
  /** Anim keys to try (generation pattern) */
  anims: string[];
  /** VFX recipe seed for multi-part / Studio */
  vfx: SkillVfxOp[];
  /** Runtime routing hint for Studio */
  route:
    | "multiPart"
    | "turretMed"
    | "turretHeavy"
    | "vault"
    | "beam"
    | "slug"
    | "cone"
    | "breath"
    | "mark"
    | "custom";
}

export interface GunFamilyDef {
  id: GunFamilyId;
  /** Arsenal {@link WeaponId} */
  weaponId: WeaponId;
  label: string;
  /** Short design note */
  blurb: string;
  /** Canonical mesh (all tiers until T1+ models ship) */
  modelFile: string;
  modelLength: number;
  /** "z+" barrel out of hand for grip align */
  modelForward: "z+" | "z-" | "x+" | "x-" | "y+" | "y-";
  modelAlign: "z" | "y";
  twoHanded: boolean;
  animSet: "pistol" | "ranged";
  anim: GunAnimPattern;
  vfx: GunVfxPattern;
  /** Base combat loadout (T0) */
  loadout: GunLoadout;
  /** Exactly 4 signature skill templates (slots 1–4) */
  skills: [GunSkillTemplate, GunSkillTemplate, GunSkillTemplate, GunSkillTemplate];
  /** Exactly 6 tier weapons */
  tiers: [GunTierDef, GunTierDef, GunTierDef, GunTierDef, GunTierDef, GunTierDef];
}

const SHOOT_PISTOL = ["chargedShot", "attack", "shoot"];
const SHOOT_RIFLE = ["chargedShot", "attack", "rangedAttack", "shoot"];
const RELOAD = ["reload", "chargedShot"];
const VAULT = ["standing-dodge-backward", "airDodge", "dodgeB", "roll", "chargedShot"];

/** Production gun families — SSOT for models, 6-tier ladders, skill/anim/VFX patterns. */
export const GUN_FAMILIES: Record<GunFamilyId, GunFamilyDef> = {
  pistol: {
    id: "pistol",
    weaponId: "pistol",
    label: "Revolver",
    blurb: "Canonical gun kit — one-hand revolver, kiter mobility, 5-round cylinder.",
    modelFile: "models/weapons/revolver.glb",
    modelLength: 0.26,
    modelForward: "x-",
    modelAlign: "z",
    twoHanded: false,
    animSet: "pistol",
    anim: {
      shoot: SHOOT_PISTOL,
      reload: RELOAD,
      aim: ["chargedShot", "attack"],
      vault: VAULT,
      skills: [
        ["chargedShot", "attack"],
        ["airDodge", "chargedShot"],
        ["mmaKick", "jumpAttack", "airDodge"],
        ["chargedShot", "cast", "attack"],
      ],
    },
    vfx: {
      tracer: 0xfff2a8,
      plasma: 0x7fd8ff,
      muzzle: 0xfff2a8,
      impact: 0xffe080,
      special: 0x9fd8ff,
    },
    loadout: {
      clip: 5,
      burst: 1,
      fireLock: 0.22,
      damage: 15,
      reloadTime: 1.05,
      chargeTime: 0.55,
      color: 0xfff2a8,
      plasmaColor: 0x7fd8ff,
    },
    skills: [
      {
        role: "combo",
        label: "Quick Draw",
        kind: "muzzle",
        mm: -70,
        cooldown: 5.5,
        castTime: 0.18,
        id: "quick_draw",
        description: "Charge → fan → plasma beam (3-part).",
        anims: SHOOT_PISTOL,
        vfx: [{ op: "charge", color: 0xfff2a8 }, { op: "bolt", color: 0xfff2a8, charged: true }],
        route: "multiPart",
      },
      {
        role: "special",
        label: "Smoke Phantom",
        kind: "muzzle",
        mm: -85,
        cooldown: 8,
        castTime: 0.1,
        id: "smoke_phantom",
        description: "Decoy shots + vanish sprint + whip combo.",
        anims: ["airDodge", "chargedShot"],
        vfx: [{ op: "castAura", color: 0x8893a6 }],
        route: "custom",
      },
      {
        role: "ranged",
        label: "Dive Kick",
        kind: "slam",
        mm: 70,
        cooldown: 6.5,
        castTime: 0,
        id: "dive_kick",
        description: "Dive kick → rebound hover aim.",
        anims: ["mmaKick", "airDodge", "jumpAttack"],
        vfx: [{ op: "afterimage", color: 0xffe080 }, { op: "shockwave", color: 0xffd080, radius: 2 }],
        route: "custom",
      },
      {
        role: "power",
        label: "Hexaring Beam",
        kind: "laser",
        mm: -95,
        cooldown: 12,
        castTime: 0.5,
        id: "hexaring_beam",
        description: "Hover + charge + sweeping beam.",
        anims: ["chargedShot", "cast"],
        vfx: [{ op: "hexaring", color: 0x9fd8ff }, { op: "beam", color: 0x7fd8ff, length: 22 }],
        route: "beam",
      },
    ],
    tiers: [
      { index: 0, name: "Sidearm", power: 1 },
      { index: 1, name: "Hand Cannon", power: 1.1 },
      { index: 2, name: "Marksman", power: 1.2 },
      { index: 3, name: "Deadeye", power: 1.3 },
      { index: 4, name: "Peacemaker", power: 1.4 },
      { index: 5, name: "Tempest", power: 1.5 },
    ],
  },

  rifle: {
    id: "rifle",
    weaponId: "rifle",
    label: "Rifle",
    blurb: "Two-hand carbine — 3-round burst, combat vault, deploy turrets.",
    modelFile: "models/weapons/rifle.glb",
    modelLength: 0.9,
    modelForward: "z-",
    modelAlign: "z",
    twoHanded: true,
    animSet: "ranged",
    anim: {
      shoot: SHOOT_RIFLE,
      reload: RELOAD,
      aim: ["chargedShot", "attack"],
      vault: VAULT,
      skills: [
        ["chargedShot", "attack"],
        ["cast", "chargedShot"],
        VAULT,
        ["cast", "chargedShot"],
      ],
    },
    vfx: {
      tracer: 0xffe8a0,
      plasma: 0x66e0ff,
      muzzle: 0xffe8a0,
      impact: 0xffd060,
      special: 0x50a0ff,
    },
    loadout: {
      clip: 18,
      burst: 3,
      fireLock: 0.4,
      damage: 11,
      reloadTime: 1.55,
      chargeTime: 0.65,
      color: 0xffe8a0,
      plasmaColor: 0x66e0ff,
    },
    skills: [
      {
        role: "combo",
        label: "3-Round Burst",
        kind: "muzzle",
        mm: -70,
        cooldown: 5.5,
        castTime: 0.1,
        id: "burst_chain",
        description: "Burst → suppress → full-auto dump (3-part).",
        anims: SHOOT_RIFLE,
        vfx: [{ op: "bolt", color: 0x80c8ff, charged: true }],
        route: "multiPart",
      },
      {
        role: "special",
        label: "Deploy Turret",
        kind: "turret",
        mm: -85,
        cooldown: 8.5,
        castTime: 0.28,
        id: "turret_med",
        description: "Animated game-ready turret (medium impact).",
        anims: ["cast", "chargedShot"],
        vfx: [{ op: "charge", color: 0x66e0ff }, { op: "hexaring", color: 0x66e0ff }],
        route: "turretMed",
      },
      {
        role: "ranged",
        label: "Combat Vault",
        kind: "muzzle",
        mm: 55,
        cooldown: 6.5,
        castTime: 0,
        id: "vault",
        description: "Vault away with parting shot.",
        anims: VAULT,
        vfx: [{ op: "afterimage", color: 0x9ef0ff }],
        route: "vault",
      },
      {
        role: "power",
        label: "Heavy Turret",
        kind: "turret",
        mm: -95,
        cooldown: 12,
        castTime: 0.3,
        id: "turret_heavy",
        description: "Classic heavy turret chassis.",
        anims: ["cast", "chargedShot"],
        vfx: [{ op: "charge", color: 0x50a0ff, scale: 1.4 }],
        route: "turretHeavy",
      },
    ],
    tiers: [
      { index: 0, name: "Carbine", power: 1 },
      { index: 1, name: "Marksman", power: 1.15 },
      { index: 2, name: "Longshot", power: 1.3 },
      { index: 3, name: "Sharpshooter", power: 1.4 },
      { index: 4, name: "Hellfire", power: 1.5 },
      { index: 5, name: "Annihilator", power: 1.6 },
    ],
  },

  sniper: {
    id: "sniper",
    weaponId: "hunter-rifle",
    label: "Sniper Rifle",
    blurb: "Long-range marksman — harder hits, slower fire, heavy turret power.",
    // No dedicated sniper.glb yet — longer rifle hold until asset ships.
    modelFile: "models/weapons/rifle.glb",
    modelLength: 1.15,
    modelForward: "z-",
    modelAlign: "z",
    twoHanded: true,
    animSet: "ranged",
    anim: {
      shoot: SHOOT_RIFLE,
      reload: RELOAD,
      aim: ["chargedShot", "attack"],
      vault: VAULT,
      skills: [
        ["chargedShot", "attack"],
        ["chargedShot", "cast"],
        VAULT,
        ["cast", "chargedShot"],
      ],
    },
    vfx: {
      tracer: 0xffd080,
      plasma: 0x88f0ff,
      muzzle: 0xffd080,
      impact: 0xffb050,
      special: 0xff9040,
    },
    loadout: {
      clip: 12,
      burst: 1,
      fireLock: 0.55,
      damage: 22,
      reloadTime: 1.85,
      chargeTime: 0.75,
      color: 0xffd080,
      plasmaColor: 0x88f0ff,
    },
    skills: [
      {
        role: "combo",
        label: "Marked Burst",
        kind: "muzzle",
        mm: -70,
        cooldown: 5.6,
        castTime: 0.12,
        id: "marked_burst",
        description: "Marked multi-part precision chain.",
        anims: SHOOT_RIFLE,
        vfx: [{ op: "bolt", color: 0xffc070, charged: true }],
        route: "multiPart",
      },
      {
        role: "special",
        label: "Marked Shot",
        kind: "muzzle",
        mm: -85,
        cooldown: 7,
        castTime: 0.22,
        id: "marked_shot",
        description: "High-damage charged slug.",
        anims: ["chargedShot"],
        vfx: [{ op: "charge", color: 0xff9040 }, { op: "bolt", color: 0xffe080, charged: true, scale: 1.3 }],
        route: "slug",
      },
      {
        role: "ranged",
        label: "Vault Shot",
        kind: "muzzle",
        mm: 55,
        cooldown: 6.5,
        castTime: 0,
        id: "vault_shot",
        description: "Vault with parting precision shot.",
        anims: VAULT,
        vfx: [{ op: "afterimage", color: 0xffd080 }],
        route: "vault",
      },
      {
        role: "power",
        label: "Heavy Turret",
        kind: "turret",
        mm: -95,
        cooldown: 12,
        castTime: 0.3,
        id: "turret_heavy",
        description: "Classic heavy turret.",
        anims: ["cast", "chargedShot"],
        vfx: [{ op: "charge", color: 0xff9040, scale: 1.4 }],
        route: "turretHeavy",
      },
    ],
    tiers: [
      { index: 0, name: "Scout Scope", power: 1 },
      { index: 1, name: "Tracker", power: 1.15 },
      { index: 2, name: "Big Game", power: 1.3 },
      { index: 3, name: "Trophy", power: 1.45 },
      { index: 4, name: "Apex", power: 1.6 },
      { index: 5, name: "Railmark", power: 1.75 },
    ],
  },

  shotgun: {
    id: "shotgun",
    weaponId: "shotgun",
    label: "Shotgun",
    blurb: "Close-range cone pellets, strong knockback, breath / slug skills.",
    // Stand-in mesh until models/weapons/shotgun.glb ships.
    modelFile: "models/weapons/rifle.glb",
    modelLength: 0.75,
    modelForward: "z-",
    modelAlign: "z",
    twoHanded: true,
    animSet: "ranged",
    anim: {
      shoot: SHOOT_RIFLE,
      reload: RELOAD,
      aim: ["chargedShot", "attack"],
      vault: VAULT,
      skills: [
        ["chargedShot", "attack"],
        ["chargedShot", "cast"],
        VAULT,
        ["cast", "chargedShot", "attack"],
      ],
    },
    vfx: {
      tracer: 0xffb070,
      plasma: 0xff7040,
      muzzle: 0xffc090,
      impact: 0xff9040,
      special: 0xff5020,
    },
    loadout: {
      clip: 6,
      burst: 1,
      fireLock: 0.55,
      damage: 8, // per pellet; cone fires many
      reloadTime: 1.7,
      chargeTime: 0.6,
      color: 0xffb070,
      plasmaColor: 0xff7040,
    },
    skills: [
      {
        role: "combo",
        label: "Pump Chain",
        kind: "muzzle",
        mm: -40,
        cooldown: 5.0,
        castTime: 0.12,
        id: "pump_chain",
        description: "Pump → wide cone → knockback blast (3-part).",
        anims: SHOOT_RIFLE,
        vfx: [
          { op: "muzzle", color: 0xffb070 },
          { op: "shockwave", color: 0xff9040, radius: 2.2 },
        ],
        route: "multiPart",
      },
      {
        role: "special",
        label: "Slug Piercer",
        kind: "muzzle",
        mm: -70,
        cooldown: 6.5,
        castTime: 0.2,
        id: "slug",
        description: "Single heavy slug — shield break + launch.",
        anims: ["chargedShot"],
        vfx: [
          { op: "charge", color: 0xff7040, scale: 1.2 },
          { op: "bolt", color: 0xffe0a0, charged: true, speed: 42, range: 14, scale: 1.5 },
        ],
        route: "slug",
      },
      {
        role: "ranged",
        label: "Combat Vault",
        kind: "muzzle",
        mm: 60,
        cooldown: 6.5,
        castTime: 0,
        id: "vault",
        description: "Vault back with parting cone.",
        anims: VAULT,
        vfx: [{ op: "afterimage", color: 0xffb070 }],
        route: "vault",
      },
      {
        role: "power",
        label: "Dragon Breath",
        kind: "nova",
        mm: -90,
        cooldown: 11,
        castTime: 0.25,
        id: "dragon_breath",
        description: "Wide fire cone + fire aura + shield break.",
        anims: ["cast", "chargedShot"],
        vfx: [
          { op: "charge", color: 0xff5020, scale: 1.4 },
          { op: "fireAura", scale: 1.4 },
          { op: "aoeBlast", color: 0xff6020, radius: 3.0 },
        ],
        route: "breath",
      },
    ],
    tiers: [
      { index: 0, name: "Street Gauge", power: 1 },
      { index: 1, name: "Riot", power: 1.12 },
      { index: 2, name: "Breacher", power: 1.25 },
      { index: 3, name: "Slugger", power: 1.4 },
      { index: 4, name: "Dragon", power: 1.55 },
      { index: 5, name: "Judgement", power: 1.7 },
    ],
  },
};

/** Map arsenal WeaponId → gun family (null if not a gun). */
export function gunFamilyForWeapon(id: WeaponId | string): GunFamilyDef | null {
  if (id === "pistol") return GUN_FAMILIES.pistol;
  if (id === "rifle") return GUN_FAMILIES.rifle;
  if (id === "hunter-rifle") return GUN_FAMILIES.sniper;
  if (id === "shotgun") return GUN_FAMILIES.shotgun;
  return null;
}

export function isGunFamilyWeapon(id: WeaponId | string): boolean {
  return gunFamilyForWeapon(id) != null;
}

/** All arsenal WeaponIds that belong to class GUN. */
export const GUN_WEAPON_IDS: WeaponId[] = ["pistol", "rifle", "hunter-rifle", "shotgun"];

/** Resolve tier (clamped 0..5). */
export function gunTier(family: GunFamilyDef, tier: number): GunTierDef {
  const i = Math.max(0, Math.min(5, tier | 0)) as GunTierIndex;
  return family.tiers[i]!;
}

/** Loadout for family + tier (power scales damage). */
export function gunLoadoutForTier(family: GunFamilyDef, tier = 0): GunLoadout {
  const t = gunTier(family, tier);
  const base = { ...family.loadout, ...t.loadout };
  base.damage = Math.round(base.damage * t.power);
  if (t.loadout?.color != null) base.color = t.loadout.color;
  if (t.loadout?.plasmaColor != null) base.plasmaColor = t.loadout.plasmaColor;
  // Prefer family VFX palette when tier doesn't override
  if (t.loadout?.color == null) base.color = family.vfx.tracer;
  if (t.loadout?.plasmaColor == null) base.plasmaColor = family.vfx.plasma;
  return base;
}

/** Model path for family + tier (canonical until T1+ assets exist). */
export function gunModelFile(family: GunFamilyDef, tier = 0): string {
  const t = gunTier(family, tier);
  return t.modelFile || family.modelFile;
}

/** T0 skill defs for HUD (from family templates). */
export function gunFamilyToT0Skills(family: GunFamilyDef): [T0SkillDef, T0SkillDef, T0SkillDef, T0SkillDef] {
  return family.skills.map((s) => ({
    role: s.role,
    label: s.label,
    kind: s.kind,
    mm: s.mm,
    cooldown: s.cooldown,
  })) as [T0SkillDef, T0SkillDef, T0SkillDef, T0SkillDef];
}

/**
 * Scriptable skill generation pattern — used offline / by generators when
 * master-weaponSkills has no GUN entry. Mirrors uMMORPG ScriptableSkill shape.
 */
export interface GeneratedGunSkill {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  castTime: number;
  damage: number;
  range: number;
  animation: string;
  kind: SkillKind;
  slot: "primary" | "secondary" | "ability" | "ultimate";
  hitWindow: [number, number];
  vfx: SkillVfxOp[];
  route: GunSkillTemplate["route"];
  animCandidates: string[];
}

const SLOT_ORDER = ["primary", "secondary", "ability", "ultimate"] as const;

export function generateGunSkills(family: GunFamilyDef, tier = 0): GeneratedGunSkill[] {
  const t = gunTier(family, tier);
  const load = gunLoadoutForTier(family, tier);
  return family.skills.map((s, i) => {
    const slot = SLOT_ORDER[i]!;
    const anims = s.anims.length ? s.anims : family.anim.skills[i]!;
    return {
      id: `gun.${family.id}.t${t.index}.${s.id}`,
      name: s.label,
      description: s.description,
      cooldown: s.cooldown * (1 - t.index * 0.02),
      castTime: s.castTime,
      damage: Math.round(load.damage * (1 + i * 0.15) * t.power),
      range: family.id === "shotgun" ? 8 : family.id === "sniper" ? 32 : family.id === "rifle" ? 26 : 18,
      animation: anims[0] ?? "chargedShot",
      kind: s.kind,
      slot,
      hitWindow: s.castTime > 0.05 ? ([0.4, 0.75] as [number, number]) : ([0.28, 0.55] as [number, number]),
      vfx: s.vfx,
      route: s.route,
      animCandidates: anims,
    };
  });
}

/** Full scriptable gun weapon for a family + tier. */
export function generateScriptableGun(familyId: GunFamilyId, tier = 0) {
  const family = GUN_FAMILIES[familyId];
  const t = gunTier(family, tier);
  const load = gunLoadoutForTier(family, tier);
  return {
    class: "GUN" as const,
    familyId,
    weaponId: family.weaponId,
    tier: t.index,
    tierName: t.name,
    name: `${family.label} · ${t.name}`,
    modelFile: gunModelFile(family, tier),
    modelLength: family.modelLength * (1 + t.index * 0.02),
    twoHanded: family.twoHanded,
    animSet: family.animSet,
    anim: family.anim,
    vfx: family.vfx,
    loadout: load,
    skills: generateGunSkills(family, tier),
  };
}

/** List all 6×4 = 24 gun weapons (4 families × 6 tiers) for catalogs / generators. */
export function listAllGunWeapons() {
  const out: ReturnType<typeof generateScriptableGun>[] = [];
  for (const id of Object.keys(GUN_FAMILIES) as GunFamilyId[]) {
    for (let t = 0; t < 6; t++) out.push(generateScriptableGun(id, t));
  }
  return out;
}
