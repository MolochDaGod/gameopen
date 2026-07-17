/**
 * Load master-weaponSkills catalog and map to systems weapon skill trees
 * with original ability icons preserved.
 */

import { fetchCatalogJson } from "../fleetSsot";
import { resolveSkillNodeIconUrl } from "../skillTreeIcons";
import { WEAPON_SKILLS, WEAPON_TYPES, type SkillNode } from "./gameData";

type MasterSkill = {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  tier?: number;
  damage?: number;
  cooldown?: number;
  effects?: string[];
};

type MasterSlot = {
  type?: string;
  label?: string;
  skills?: MasterSkill[];
};

type MasterWeaponType = {
  id?: string;
  name?: string;
  icon?: string;
  slots?: MasterSlot[];
};

/** Open systems weapon key → master type id */
const SYSTEMS_TO_MASTER: Record<string, string> = {
  sword: "SWORD",
  "2h_sword": "GREATSWORD",
  axe: "AXE",
  "2h_axe": "GREATAXE",
  hammer: "HAMMER",
  "2h_hammer": "HAMMER",
  dagger: "DAGGER",
  spear: "SPEAR",
  bow: "BOW",
  crossbow: "CROSSBOW",
  gun: "GUN",
  staff: "STAFF",
  wand: "WAND",
  mace: "MACE",
  tome: "TOME",
  shield: "SHIELD",
  scythe: "SCYTHE",
  offhand_relic: "TOME",
};

let cache: Record<string, { name: string; icon: string; cdnIcon?: string; skills: SkillNode[] }> | null =
  null;

function flattenMasterSkills(wt: MasterWeaponType): SkillNode[] {
  const out: SkillNode[] = [];
  const slots = wt.slots || [];
  let order = 0;
  for (const slot of slots) {
    for (const s of slot.skills || []) {
      if (!s.id || !s.name) continue;
      order += 1;
      const level =
        typeof s.tier === "number" ? Math.max(1, s.tier * 5 - 4) : Math.min(25, order * 4);
      const icon = s.icon || wt.icon;
      const iconUrl = resolveSkillNodeIconUrl({
        icon,
        iconUrl: s.icon,
        id: s.id,
        treeId: `weapon-${wt.id || "SWORD"}`,
      });
      const bonusParts: string[] = [];
      if (typeof s.damage === "number") bonusParts.push(`DMG ${s.damage}`);
      if (typeof s.cooldown === "number" && s.cooldown > 0) bonusParts.push(`CD ${s.cooldown}s`);
      if (s.effects?.length) bonusParts.push(s.effects[0]!);
      out.push({
        id: s.id,
        name: s.name,
        level,
        desc: s.description || s.name,
        bonus: bonusParts.join(" · ") || (slot.label || slot.type || "skill"),
        icon: icon || undefined,
        iconUrl,
        slot: slot.type || slot.label,
      });
    }
  }
  return out;
}

/**
 * Build weapon skill trees from fleet master-weaponSkills.json.
 * Falls back to local WEAPON_SKILLS generators when offline.
 */
export async function loadWeaponSkillTrees(): Promise<
  Record<string, { name: string; icon: string; cdnIcon?: string; skills: SkillNode[] }>
> {
  if (cache) return cache;

  const data = await fetchCatalogJson<{ weaponTypes?: MasterWeaponType[] }>(
    "master-weaponSkills.json",
  );
  const byMaster = new Map<string, MasterWeaponType>();
  for (const wt of data?.weaponTypes || []) {
    if (wt.id) byMaster.set(String(wt.id).toUpperCase(), wt);
  }

  const out: Record<string, { name: string; icon: string; cdnIcon?: string; skills: SkillNode[] }> =
    {};

  for (const [sysId, wep] of Object.entries(WEAPON_TYPES)) {
    const masterId = SYSTEMS_TO_MASTER[sysId] || sysId.toUpperCase();
    const master = byMaster.get(masterId);
    if (master && (master.slots?.length || 0) > 0) {
      const skills = flattenMasterSkills(master);
      const headerIcon = resolveSkillNodeIconUrl({
        icon: master.icon || wep.cdnIcon,
        treeId: `weapon-${masterId}`,
      });
      out[sysId] = {
        name: master.name || wep.name,
        icon: wep.icon,
        cdnIcon: headerIcon,
        skills: skills.length ? skills : WEAPON_SKILLS[sysId]?.skills || [],
      };
    } else {
      // Local generated tree — still has pack icons on each node
      out[sysId] = {
        ...WEAPON_SKILLS[sysId]!,
        cdnIcon: wep.cdnIcon,
        skills: (WEAPON_SKILLS[sysId]?.skills || []).map((s) => ({
          ...s,
          iconUrl:
            s.iconUrl ||
            resolveSkillNodeIconUrl({
              icon: s.icon || wep.cdnIcon,
              id: s.id,
              treeId: `weapon-${sysId}`,
            }),
        })),
      };
    }
  }

  cache = out;
  return out;
}
