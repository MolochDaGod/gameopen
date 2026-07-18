/**
 * Tree registry — class, profession, camp account, weapon-tier UUID branches.
 * UI surfaces these in harvest production / systems panels.
 */

import { newWeaponTreeBranchId } from "./types";
import type { SkillTree } from "../harvestCatalog";

export type TreeDomain =
  | "class"
  | "profession"
  | "mastery"
  | "camp"
  | "weapon_tier";

export interface TreeRef {
  domain: TreeDomain;
  id: string;
  name: string;
  /** Absolute or relative icon */
  icon?: string;
  /** Weapon family when domain is weapon_tier */
  weaponFamily?: string;
  /** Tier 0–5 for weapon trees */
  tier?: number;
  /** Stable UUID branch id for weapon trees */
  branchId?: string;
  /** Linked harvest/class skill tree id when applicable */
  skillTreeId?: string;
}

const WEAPON_FAMILIES = [
  "sword",
  "axe",
  "spear",
  "bow",
  "staff",
  "gun",
  "dagger",
  "hammer",
  "mace",
  "greatsword",
  "greataxe",
  "crossbow",
  "wand",
  "tome",
  "scythe",
  "shield",
] as const;

/** Fallback profession ids if skill trees not loaded yet. */
const DEFAULT_PROF_TREES: TreeRef[] = [
  { domain: "profession", id: "prof_harvest", name: "Harvest", skillTreeId: "harvest" },
  { domain: "profession", id: "prof_crafting", name: "Crafting", skillTreeId: "crafting" },
  { domain: "profession", id: "prof_building", name: "Building", skillTreeId: "building" },
  { domain: "profession", id: "prof_survival", name: "Survival", skillTreeId: "survival" },
  { domain: "profession", id: "prof_explorer", name: "Explorer", skillTreeId: "explorer" },
];

const CAMP_TREES: TreeRef[] = [
  { domain: "camp", id: "camp_claim", name: "Claim & Territory", icon: "/icons/camp/flag.png" },
  { domain: "camp", id: "camp_farm", name: "Farming & Livestock", icon: "/icons/pack/misc/Effect.png" },
  { domain: "camp", id: "camp_build", name: "Structures", icon: "/icons/pack/weapons/Hammer_01.png" },
  { domain: "camp", id: "camp_defense", name: "Defenses", icon: "/icons/pack/weapons/Shield_01.png" },
  { domain: "camp", id: "camp_tame", name: "Taming", icon: "/icons/pack/misc/Effect.png" },
];

/** Profession trees from harvest skill-trees.json (pass loaded trees). */
export function professionTreeRefs(trees?: SkillTree[]): TreeRef[] {
  if (!trees?.length) return DEFAULT_PROF_TREES;
  return trees.map((t) => ({
    domain: "profession" as const,
    id: `prof_${t.id}`,
    name: t.name,
    icon: t.iconUrl || t.icon,
    skillTreeId: t.id,
  }));
}

/** Class mastery trees (warrior / mage / …) — bridge to systems class trees. */
export function classTreeRefs(classId = "warrior"): TreeRef[] {
  return [
    {
      domain: "class",
      id: `class_${classId}`,
      name: `${classId[0]!.toUpperCase()}${classId.slice(1)} Path`,
      skillTreeId: classId,
      icon: "/icons/skill_nobg/Warriorskill_01_nobg.png",
    },
    {
      domain: "mastery",
      id: `mastery_${classId}`,
      name: `${classId[0]!.toUpperCase()}${classId.slice(1)} Mastery`,
      skillTreeId: classId,
      icon: "/icons/skill_nobg/Warriorskill_10_nobg.png",
    },
  ];
}

/**
 * Weapon-specific UUID tree per family × tier.
 * Each branch gets a stable id for unlock storage: wpn_tree_<family>_tN_<uuid>.
 * Pass existingBranches to keep ids stable across sessions.
 */
export function weaponTierTreeRefs(
  existing?: Record<string, string>,
): TreeRef[] {
  const out: TreeRef[] = [];
  const map = { ...(existing || {}) };
  for (const family of WEAPON_FAMILIES) {
    for (let tier = 0; tier <= 5; tier++) {
      const key = `${family}:t${tier}`;
      if (!map[key]) map[key] = newWeaponTreeBranchId(family, tier);
      out.push({
        domain: "weapon_tier",
        id: key,
        name: `${family} T${tier}`,
        weaponFamily: family,
        tier,
        branchId: map[key],
        icon: `/icons/pack/weapons/${family[0]!.toUpperCase()}${family.slice(1)}_01.png`,
      });
    }
  }
  return out;
}

export function allTreeRefs(opts?: {
  classId?: string;
  weaponBranchMap?: Record<string, string>;
  skillTrees?: SkillTree[];
}): TreeRef[] {
  return [
    ...classTreeRefs(opts?.classId),
    ...professionTreeRefs(opts?.skillTrees),
    ...CAMP_TREES,
    ...weaponTierTreeRefs(opts?.weaponBranchMap),
  ];
}

const WEAPON_BRANCH_KEY = "grudge:weapon-tree-branches:v1";

export function loadWeaponBranchMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEAPON_BRANCH_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, string>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function saveWeaponBranchMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(WEAPON_BRANCH_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Ensure all weapon branches exist and persist UUIDs. */
export function ensureWeaponBranches(): TreeRef[] {
  const existing = loadWeaponBranchMap();
  const refs = weaponTierTreeRefs(existing);
  const next: Record<string, string> = {};
  for (const r of refs) {
    if (r.branchId) next[r.id] = r.branchId;
  }
  saveWeaponBranchMap(next);
  return refs;
}
