/**
 * Master weapon-skills catalog for Danger Room.
 *
 * Definitions SSOT: info.grudge-studio.com/api/v1/master-weaponSkills.json
 * (multi-host via contentCandidates — objectstore host 404s as of 2026-07)
 *
 * Concepts (uMMORPG): Scriptable weapon types → hotbar slots (primary / secondary /
 * ability / ultimate) + off-hand TOME coupling for spell schools.
 *
 * Runtime: fetch once, map to 4-slot T0-shaped kits used by Studio HUD / combat.
 * Prefab JSON under content/skills remains the sandbox anim/VFX layer.
 */
import type { SkillKind, WeaponId } from "../types";
import { contentCandidates } from "../../lib/fleetSsot";
import { cdnIconUrl } from "../skillIcons";
import { spearClipForSkillId } from "../ummorpg/spearCombat";

export const MASTER_WEAPON_SKILLS_VERSION = "3.1.0";

/** Master catalog weapon type ids. */
export type MasterWeaponTypeId =
  | "SWORD"
  | "AXE"
  | "BOW"
  | "CROSSBOW"
  | "GUN"
  | "DAGGER"
  | "STAFF"
  | "HAMMER"
  | "SHIELD"
  | "GREATSWORD"
  | "GREATAXE"
  | "SPEAR"
  | "TOME"
  | "MACE"
  | "WAND"
  | "SCYTHE"
  | "TOOL";

export type MasterSlotType = "primary" | "secondary" | "ability" | "ultimate";

export interface MasterSkill {
  uuid?: string;
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tier?: number;
  damage?: number;
  cooldown?: number;
  castTime?: number | null;
  range?: number | null;
  projectile?: string | null;
  damageType?: string;
  effects?: string[];
  resourceCost?: { mana?: number; stamina?: number };
}

export interface MasterSlot {
  type: MasterSlotType;
  label?: string;
  skills: MasterSkill[];
}

export interface MasterWeaponType {
  id: MasterWeaponTypeId | string;
  name: string;
  icon?: string;
  totalSkills?: number;
  slots?: MasterSlot[];
  classification?: string;
  role?: string;
  mechanic?: Record<string, unknown>;
  couplingModes?: Record<string, unknown>;
}

export interface MasterWeaponSkillsCatalog {
  version: string;
  totalSkills: number;
  weaponTypes: MasterWeaponType[];
  classRestrictions?: Record<string, string[]>;
  offhandMechanics?: Record<string, unknown>;
  raw: unknown;
}

/** Animator WeaponId → master type. */
export const WEAPON_TO_MASTER: Partial<Record<WeaponId, MasterWeaponTypeId>> = {
  sword: "SWORD",
  axe: "AXE",
  bow: "BOW",
  dagger: "DAGGER",
  staff: "STAFF",
  staffFire: "STAFF",
  staffIce: "STAFF",
  staffStorm: "STAFF",
  staffNature: "STAFF",
  staffHoly: "STAFF",
  hammer: "HAMMER",
  hammer2h: "HAMMER",
  mace: "MACE",
  greatsword: "GREATSWORD",
  greataxe: "GREATAXE",
  spear: "SPEAR",
  javelin: "SPEAR",
  shield: "SHIELD",
  pistol: "GUN",
  rifle: "GUN",
  "hunter-rifle": "GUN",
  shotgun: "GUN",
  gunblade: "SWORD",
  // Extended ids (added with arsenal port)
  tome: "TOME",
  wand: "WAND",
  scythe: "SCYTHE",
  crossbow: "CROSSBOW",
};

/** damageType → SkillKind for VFX routing */
export function damageTypeToSkillKind(dt?: string, projectile?: string | null): SkillKind {
  const d = (dt || "physical").toLowerCase();
  if (projectile === "spell" || projectile === "arrow" || projectile === "bolt") {
    if (d === "fire") return "fireDragon";
    if (d === "holy") return "bolt";
    return "bolt";
  }
  if (d === "fire") return "fireDragon";
  if (d === "frost" || d === "ice") return "bolt";
  if (d === "lightning" || d === "storm") return "laser";
  if (d === "holy") return "nova";
  if (d === "shadow" || d === "arcane") return "darkBlades";
  if (d === "nature") return "bolt";
  return "slash";
}

/** MM guess from range / role (matches T0 sheet conventions). */
export function estimateMm(skill: MasterSkill, slot: MasterSlotType): number {
  const name = skill.name || skill.id || "";
  const effects = (skill.effects || []).join(" ");
  const blob = `${name} ${effects} ${skill.description || ""}`.toLowerCase();
  // uMMORPG SPEAR gap-closers — force strong +MM for charge / lunge / vault
  if (/lunge|vault|charge|rush|skewer charge|gap/.test(blob)) return 100;
  if (/throw|javelin|rain|storm|phantom|missile|arrow/.test(blob) && /range|throw|homing/.test(blob)) {
    return -70;
  }
  const ranged =
    !!skill.projectile ||
    (typeof skill.range === "number" && skill.range > 8) ||
    /bolt|shot|missile|arrow|cast|blast|wave|rain|throw|javelin/i.test(name);
  if (slot === "ultimate") return ranged ? -95 : 100;
  if (slot === "ability") return ranged ? -85 : 90;
  if (slot === "secondary") return ranged ? -70 : 85;
  return ranged ? -70 : 70;
}

export interface MasterKitSkill {
  id: string;
  label: string;
  description?: string;
  kind: SkillKind;
  mm: number;
  cooldown: number;
  damage: number;
  mana: number;
  stamina: number;
  iconUrl: string | null;
  damageType: string;
  slot: MasterSlotType;
  castTime: number;
}

export interface MasterWeaponKit {
  masterType: MasterWeaponTypeId | string;
  weaponId: WeaponId;
  family: string;
  iconUrl: string | null;
  skills: [MasterKitSkill, MasterKitSkill, MasterKitSkill, MasterKitSkill];
  source: "master-weaponSkills";
  version: string;
}

let _catalog: MasterWeaponSkillsCatalog | null = null;
let _promise: Promise<MasterWeaponSkillsCatalog | null> | null = null;

export async function loadMasterWeaponSkills(
  force = false,
): Promise<MasterWeaponSkillsCatalog | null> {
  if (_catalog && !force) return _catalog;
  if (_promise && !force) return _promise;

  _promise = (async () => {
    const urls = contentCandidates("master-weaponSkills.json");
    for (const url of urls) {
      try {
        const r = await fetch(url, { credentials: "omit" });
        if (!r.ok) continue;
        const raw = await r.json();
        const weaponTypes = Array.isArray(raw?.weaponTypes) ? raw.weaponTypes : [];
        _catalog = {
          version: String(raw?.version || MASTER_WEAPON_SKILLS_VERSION),
          totalSkills: Number(raw?.totalSkills || 0),
          weaponTypes,
          classRestrictions: raw?.classRestrictions,
          offhandMechanics: raw?.offhandMechanics,
          raw,
        };
        console.info(
          `[masterWeaponSkills] v${_catalog.version} types=${weaponTypes.length} skills=${_catalog.totalSkills}`,
        );
        return _catalog;
      } catch (err) {
        console.warn("[masterWeaponSkills] fetch failed", url, err);
      }
    }
    return null;
  })();

  return _promise;
}

export function getCachedMasterWeaponSkills(): MasterWeaponSkillsCatalog | null {
  return _catalog;
}

function pickSkill(slot: MasterSlot | undefined, preferTier = 1): MasterSkill | null {
  if (!slot?.skills?.length) return null;
  const sorted = [...slot.skills].sort(
    (a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name),
  );
  return (
    sorted.find((s) => (s.tier ?? 1) <= preferTier) ||
    sorted[0] ||
    null
  );
}

function toKitSkill(skill: MasterSkill, slot: MasterSlotType): MasterKitSkill {
  const kind = damageTypeToSkillKind(skill.damageType, skill.projectile);
  const cd =
    typeof skill.cooldown === "number" && skill.cooldown > 0
      ? skill.cooldown
      : slot === "ultimate"
        ? 12
        : slot === "ability"
          ? 6
          : slot === "secondary"
            ? 3
            : 1.2;
  return {
    id: skill.id,
    label: skill.name || skill.id,
    description: skill.description,
    kind,
    mm: estimateMm(skill, slot),
    cooldown: cd,
    damage: Math.abs(Number(skill.damage) || 40),
    mana: Number(skill.resourceCost?.mana || 0),
    stamina: Number(skill.resourceCost?.stamina || 0),
    iconUrl: cdnIconUrl(skill.icon || null),
    damageType: skill.damageType || "physical",
    slot,
    castTime: Number(skill.castTime) || 0,
  };
}

/** Placeholder kit skill when catalog missing a slot. */
function placeholder(slot: MasterSlotType, label: string, kind: SkillKind, mm: number): MasterKitSkill {
  return {
    id: `placeholder_${slot}`,
    label,
    kind,
    mm,
    cooldown: slot === "ultimate" ? 10 : slot === "ability" ? 5 : 1.5,
    damage: 40,
    mana: 0,
    stamina: 0,
    iconUrl: null,
    damageType: "physical",
    slot,
    castTime: 0,
  };
}

/**
 * Build a 4-slot kit (primary, secondary, ability, ultimate) for a WeaponId.
 * For TOME off-hand, uses elemental coupling mode spell variants when present.
 */
export function buildMasterKit(
  weaponId: WeaponId,
  catalog: MasterWeaponSkillsCatalog | null = _catalog,
  opts?: { tomeSchool?: "fire" | "frost" | "lightning" | "nature" | "arcane" | "holy" },
): MasterWeaponKit | null {
  if (!catalog) return null;
  const masterType = WEAPON_TO_MASTER[weaponId];
  if (!masterType) return null;
  // SPEAR: prefer lunge/vault gap-close hotbar (uMMORPG Danger kit)
  if (masterType === "SPEAR") {
    return buildSpearMasterKit(weaponId, catalog);
  }
  const wt = catalog.weaponTypes.find((w) => w.id === masterType);
  if (!wt) return null;

  const slots = wt.slots || [];
  const byType = (t: MasterSlotType) => slots.find((s) => s.type === t);

  // TOME: prefer couplingModes.elemental slot skills for a real 4-spell bar
  if (masterType === "TOME") {
    const modes = (wt.couplingModes || {}) as Record<
      string,
      { slots?: MasterSlot[]; schools?: string[] }
    >;
    const school = opts?.tomeSchool || "fire";
    const modeKey =
      school === "holy"
        ? "heal"
        : school === "arcane" || school === "nature"
          ? "buff"
          : "elemental";
    const mode = modes[modeKey] || modes.elemental;
    const modeSlots = mode?.slots || [];
    const pickMode = (t: MasterSlotType, fallbackLabel: string, mm: number) => {
      const sl = modeSlots.find((s) => s.type === t) || byType(t);
      const sk = pickSkill(sl as MasterSlot | undefined);
      if (sk) return toKitSkill(sk, t);
      // Fall back to first ultimate child names if coupling empty
      const ult = pickSkill(byType("ultimate"));
      if (ult) return toKitSkill({ ...ult, name: fallbackLabel, damage: ult.damage || 50 }, t);
      return placeholder(t, fallbackLabel, "bolt", mm);
    };
    return {
      masterType,
      weaponId,
      family: wt.name,
      iconUrl: cdnIconUrl(wt.icon || "/icons/pack/weapons/Book_1.png"),
      skills: [
        pickMode("primary", "Elemental Bolt", -70),
        pickMode("secondary", "Elemental Nova", -85),
        pickMode("ability", "Elemental Surge", -90),
        pickMode("ultimate", "Page Surge", -100),
      ],
      source: "master-weaponSkills",
      version: catalog.version,
    };
  }

  const order: MasterSlotType[] = ["primary", "secondary", "ability", "ultimate"];
  const defaults: Array<[string, SkillKind, number]> = [
    ["Primary", "slash", 70],
    ["Secondary", "slam", 85],
    ["Ability", "nova", 85],
    ["Ultimate", "nova", 100],
  ];

  const skills = order.map((slot, i) => {
    const sk = pickSkill(byType(slot));
    if (sk) return toKitSkill(sk, slot);
    const [lab, kind, mm] = defaults[i]!;
    return placeholder(slot, lab, kind, mm);
  }) as MasterWeaponKit["skills"];

  return {
    masterType,
    weaponId,
    family: wt.name,
    iconUrl: cdnIconUrl(wt.icon || null),
    skills,
    source: "master-weaponSkills",
    version: catalog.version,
  };
}

/** Convert master kit → t0SignatureSkills-compatible rows for Studio. */
export function masterKitToSignatureSkills(kit: MasterWeaponKit): {
  label: string;
  clip: string;
  kind: SkillKind;
  mode?: "default" | "dash";
  mm: number;
  cooldown: number;
  iconUrl?: string | null;
  skillId?: string;
  damage?: number;
}[] {
  const isSpear =
    kit.masterType === "SPEAR" || kit.weaponId === "spear" || kit.weaponId === "javelin";
  return kit.skills.map((s) => {
    const gap = s.mm >= 85 && s.mm > 0;
    const clip = isSpear
      ? spearClipForSkillId(s.id)
      : "attack";
    return {
      label: s.label,
      clip,
      kind: s.kind,
      mode: gap ? ("dash" as const) : ("default" as const),
      mm: s.mm,
      cooldown: s.cooldown,
      iconUrl: s.iconUrl,
      skillId: s.id,
      damage: s.damage,
    };
  });
}

/**
 * SPEAR kit: prefer uMMORPG gap-close bar (thrust · lunge · vault · dragontail)
 * when those skill ids exist in the catalog.
 */
export function buildSpearMasterKit(
  weaponId: WeaponId,
  catalog: MasterWeaponSkillsCatalog | null = _catalog,
): MasterWeaponKit | null {
  if (!catalog) return null;
  const wt = catalog.weaponTypes.find((w) => w.id === "SPEAR");
  if (!wt) return null;
  const all = (wt.slots || []).flatMap((sl) =>
    (sl.skills || []).map((sk) => ({ sk, slot: sl.type as MasterSlotType })),
  );
  const pick = (id: string, slot: MasterSlotType): MasterKitSkill | null => {
    const hit = all.find((x) => x.sk.id === id);
    if (hit) return toKitSkill(hit.sk, slot);
    const any = all.find((x) => x.slot === slot);
    return any ? toKitSkill(any.sk, slot) : null;
  };
  const prefer = ["spear_thrust", "spear_lunge", "spear_cyclone", "spear_dragontail"] as const;
  const slots: MasterSlotType[] = ["primary", "secondary", "ability", "ultimate"];
  const skills = prefer.map((id, i) => {
    const slot = slots[i]!;
    return (
      pick(id, slot) ||
      placeholder(
        slot,
        id.replace("spear_", "").replace(/_/g, " "),
        i === 3 ? "nova" : "thrust",
        i === 0 ? 55 : 100,
      )
    );
  }) as MasterWeaponKit["skills"];
  // Force gap-close MM on lunge/vault
  if (skills[1]) skills[1] = { ...skills[1], mm: 100, kind: skills[1].kind };
  if (skills[2]) skills[2] = { ...skills[2], mm: 100, kind: skills[2].kind || "slam" };
  return {
    masterType: "SPEAR",
    weaponId,
    family: wt.name || "Spear",
    iconUrl: cdnIconUrl(wt.icon || "/icons/pack/weapons/Spear_01.png"),
    skills,
    source: "master-weaponSkills",
    version: catalog.version,
  };
}

/** List all master type ids present in the catalog (for importers / UI). */
export function listMasterWeaponTypes(
  catalog: MasterWeaponSkillsCatalog | null = _catalog,
): MasterWeaponType[] {
  return catalog?.weaponTypes ?? [];
}
