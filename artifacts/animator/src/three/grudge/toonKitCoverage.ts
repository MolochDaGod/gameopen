/**
 * Toon RTS customizable kit coverage — from Unity
 * `{PREFIX}_Characters_customizable.FBX` (uMMORPG prefab) + live CDN GLB
 * bone-weight scan. Play mesh names are the GLB names.
 *
 * Robe / onesie bodies already include hands and/or feet. Do not also show
 * Arms_* / Legs_* or the hero doubles limbs.
 */
import type { RaceId } from "./raceAssets";

function meshKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/[^a-z0-9]/g, "");
}

export type LimbCover = { hands: boolean; feet: boolean };

/** Body meshKey → whether that body already skins hands / feet. */
const BODY_COVER: Record<string, LimbCover> = {
  // western-kingdoms
  bodya: { hands: true, feet: true },
  bodyb: { hands: false, feet: false },
  bodyc: { hands: false, feet: false },
  bodyd: { hands: false, feet: true },
  bodye: { hands: false, feet: true },
  // barbarians — every body has feet, none have hands
  // (same keys as WK; BRB bodies A–H)
  bodyf: { hands: false, feet: true },
  bodyg: { hands: false, feet: true },
  bodyh: { hands: false, feet: true },
};

const RACE_BODY_COVER: Partial<Record<RaceId, Record<string, LimbCover>>> = {
  barbarians: {
    bodya: { hands: false, feet: true },
    bodyb: { hands: false, feet: true },
    bodyc: { hands: false, feet: true },
    bodyd: { hands: false, feet: true },
    bodye: { hands: false, feet: true },
    bodyf: { hands: false, feet: true },
    bodyg: { hands: false, feet: true },
    bodyh: { hands: false, feet: true },
  },
  dwarves: {
    bodya: { hands: true, feet: true },
    bodyb: { hands: true, feet: true },
    bodyc: { hands: true, feet: true },
    bodyd: { hands: true, feet: true },
    bodye: { hands: false, feet: true },
  },
  "high-elves": {
    bodya: { hands: false, feet: false },
    bodyb: { hands: false, feet: false },
    bodyc: { hands: false, feet: false },
    bodyd: { hands: false, feet: false },
    bodye: { hands: false, feet: false },
    bodyf: { hands: false, feet: true },
  },
  orcs: {
    bodya: { hands: true, feet: true },
    bodyb: { hands: true, feet: true },
    bodyc: { hands: true, feet: false },
    bodyd: { hands: true, feet: false },
    bodye: { hands: true, feet: false },
    bodyf: { hands: true, feet: true },
    bodyg: { hands: true, feet: true },
  },
  undead: {
    bodya: { hands: true, feet: true },
    bodyb: { hands: true, feet: true },
    bodyc: { hands: true, feet: true },
    bodyd: { hands: true, feet: true },
    bodye: { hands: true, feet: true },
    bodyf: { hands: true, feet: true },
    bodyg: { hands: true, feet: true },
  },
};

export function bodyLimbCover(race: RaceId, bodyMeshName: string): LimbCover {
  const key = meshKey(bodyMeshName);
  const raceMap = RACE_BODY_COVER[race];
  if (raceMap?.[key]) return raceMap[key];
  return BODY_COVER[key] ?? { hands: false, feet: false };
}

export function isBodyMesh(name: string): boolean {
  return /body/i.test(name) && !/weapon|shield|head|arm|leg|shoulder|xtra/i.test(name);
}

export function isArmsMesh(name: string): boolean {
  return /arms/i.test(name);
}

export function isLegsMesh(name: string): boolean {
  return /legs/i.test(name);
}

export function isBackMesh(name: string): boolean {
  return /xtra|bag|wood|quiver/i.test(name) && !/weapon|shield/i.test(name);
}

export function isMetaEquipId(name: string): boolean {
  return /^equip:/i.test(name);
}

export function isWeaponMesh(name: string): boolean {
  if (isMetaEquipId(name) || /shield/i.test(name)) return false;
  return /weapon|sword|axe|bow|staff|spear|dagger|hammer|mace|pick/i.test(name);
}

export function isShieldMesh(name: string): boolean {
  return /shield/i.test(name);
}

export function isQuiverMesh(name: string): boolean {
  return /quiver/i.test(name);
}

export function isShoulderMesh(name: string): boolean {
  return /shoulder/i.test(name);
}

/** Relic slot: Unity elemental orbs only (not class items). */
export const TOON_RELICS = [
  "equip:relic:nature",
  "equip:relic:frost",
  "equip:relic:fury",
  "equip:relic:void",
] as const;

/** Class item slot — class-relic-skillTrees.json identities (not Relic). */
export const TOON_CLASS_ITEMS = [
  "equip:class:warrior",
  "equip:class:ranger",
  "equip:class:mage",
  "equip:class:worge",
] as const;

/** Unity Equipment Rings (Assets/.../Items/Equipment Rings). No Toon child mesh. */
export const TOON_RINGS = [
  "equip:ring:silver",
  "equip:ring:ranger",
  "equip:ring:warrior",
  "equip:ring:elder",
  "equip:ring:assassin",
] as const;

export const META_EQUIP_LABEL: Record<string, string> = {
  "equip:relic:nature": "Relic of Nature",
  "equip:relic:frost": "Relic of Frost",
  "equip:relic:fury": "Relic of Fury",
  "equip:relic:void": "Relic of the Void",
  "equip:class:warrior": "Battle Forms",
  "equip:class:ranger": "Ranger's Log",
  "equip:class:mage": "Wand Spellbook",
  "equip:class:worge": "Nature Grimoire",
  "equip:back:wind_surf": "Wind Surf",
  "equip:back:holy_wings": "Holy Wings",
  "equip:back:traveler_wings": "Traveler's Wings",
  "equip:back:cape": "Cape",
  "equip:back:cape_long": "Long Cape",
  "equip:back:cape_wide": "Wide Cape",
  "equip:back:wing_pack": "Wing Pack",
  "equip:back:parachute": "Parachute",
  "equip:back:glider": "Glider",
  "equip:back:flight_rig": "Flight Rig",
  "equip:back:sail_deploy": "Deployable Sail",
  "equip:ring:silver": "Silver Band",
  "equip:ring:ranger": "Ranger's Ring",
  "equip:ring:warrior": "Warrior's Ring",
  "equip:ring:elder": "Elder Ring",
  "equip:ring:assassin": "Assassin's Band",
};

export type KitWeaponFamily = "none" | "1h" | "2h" | "bow" | "staff";

/** Two-hand kit weapons occupy both hands — no shield. */
export function kitWeaponFamily(name: string | null | undefined): KitWeaponFamily {
  if (!name) return "none";
  if (/bow/i.test(name)) return "bow";
  if (/staff/i.test(name)) return "staff";
  if (/spear/i.test(name)) return "2h";
  if (isWeaponMesh(name)) return "1h";
  return "none";
}

export function defaultSlotMesh(
  race: RaceId,
  kind: "arms" | "legs" | "quiver",
): string | null {
  const list = TOON_WARDROBE[race] ?? [];
  if (kind === "arms") return list.find((m) => isArmsMesh(m)) ?? null;
  if (kind === "legs") return list.find((m) => isLegsMesh(m)) ?? null;
  return list.find((m) => isQuiverMesh(m)) ?? null;
}

export function kitSlotGate(
  race: RaceId,
  meshIds: string[],
  slot: "arms" | "legs" | "back" | string,
): { ok: boolean; reason?: string } {
  const body = meshIds.find((m) => isBodyMesh(m));
  if (body && (slot === "arms" || slot === "legs")) {
    const cover = bodyLimbCover(race, body);
    if (slot === "arms" && cover.hands) {
      return { ok: false, reason: `${body} already skins hands — Hands slot is in the robe` };
    }
    if (slot === "legs" && cover.feet) {
      return { ok: false, reason: `${body} already skins feet — Boots slot is in the robe` };
    }
  }
  if (slot === "back") {
    const weapon = meshIds.find((m) => isWeaponMesh(m));
    if (kitWeaponFamily(weapon) === "bow") {
      return { ok: true };
    }
  }
  return { ok: true };
}

/** After a body swap, drop or keep Arms/Legs so robes stay whole. */
export function reconcileKitLimbs(race: RaceId, meshIds: string[]): string[] {
  const body = meshIds.find((m) => isBodyMesh(m));
  if (!body) return meshIds.slice();
  const cover = bodyLimbCover(race, body);
  return meshIds.filter((m) => {
    if (cover.hands && isArmsMesh(m)) return false;
    if (cover.feet && isLegsMesh(m)) return false;
    return true;
  });
}

/**
 * Full if-this-then-that pass after any slot change.
 * Body cover, required limbs, bow→quiver, 2H/staff/bow→no shield.
 */
export function reconcileKitLoadout(race: RaceId, meshIds: string[]): string[] {
  const meta = meshIds.filter((m) => isMetaEquipId(m));
  let ids = reconcileKitLimbs(
    race,
    meshIds.filter((m) => !isMetaEquipId(m)),
  );

  const body = ids.find((m) => isBodyMesh(m));
  const cover = body ? bodyLimbCover(race, body) : { hands: false, feet: false };
  if (!cover.hands && !ids.some((m) => isArmsMesh(m))) {
    const arms = defaultSlotMesh(race, "arms");
    if (arms) ids.push(arms);
  }
  if (!cover.feet && !ids.some((m) => isLegsMesh(m))) {
    const legs = defaultSlotMesh(race, "legs");
    if (legs) ids.push(legs);
  }

  const weapon = ids.find((m) => isWeaponMesh(m)) ?? null;
  const fam = kitWeaponFamily(weapon);
  if (fam === "bow") {
    ids = ids.filter((m) => !isShieldMesh(m));
    const mobilityBack = ids.some((m) => /^equip:back:/i.test(m));
    if (!mobilityBack && !ids.some((m) => isQuiverMesh(m))) {
      const quiver = defaultSlotMesh(race, "quiver");
      if (quiver) {
        ids = ids.filter((m) => !isBackMesh(m));
        ids.push(quiver);
      }
    }
  } else {
    ids = ids.filter((m) => !isQuiverMesh(m));
    if (fam === "staff" || fam === "2h") {
      ids = ids.filter((m) => !isShieldMesh(m));
    }
  }

  return [...ids, ...meta];
}

export function arsenalIdFromKitWeapon(mesh: string | null | undefined): string {
  if (!mesh) return "none";
  if (/bow/i.test(mesh)) return "bow";
  if (/staff/i.test(mesh)) return "staff";
  if (/spear/i.test(mesh)) return "spear";
  if (/axe/i.test(mesh)) return "axe";
  if (/hammer/i.test(mesh)) return "hammer";
  if (/mace/i.test(mesh)) return "mace";
  if (/dagger/i.test(mesh)) return "dagger";
  if (/pick/i.test(mesh)) return "pick";
  if (/sword/i.test(mesh)) return "sword";
  return "sword";
}

/**
 * Full play wardrobe on the CDN customizable GLB (Unity uMMORPG prefab bake).
 * Panel cycles this list — not only the 5 class presets.
 */
export const TOON_WARDROBE: Record<RaceId, string[]> = {
  "western-kingdoms": [
    "WK_Units_head_A", "WK_Units_head_B", "WK_Units_head_C", "WK_Units_head_D",
    "WK_Units_head_E", "WK_Units_head_F", "WK_Units_head_G", "WK_Units_head_H", "WK_Units_head_I",
    "WK_Units_Body_A", "WK_Units_Body_B", "WK_Units_Body_C", "WK_Units_Body_D", "WK_Units_Body_E",
    "WK_Units_Arms_A", "WK_Units_Arms_B", "WK_Units_Arms_C", "WK_Units_Arms_D",
    "WK_Units_Legs_A", "WK_Units_Legs_B", "WK_Units_Legs_C",
    "WK_Units_shoulderpads_A", "WK_Units_shoulderpads_B",
    "WK_weapon_sword_A", "WK_weapon_sword_B", "WK_weapon_axe_A", "WK_weapon_axe_B",
    "WK_weapon_hammer_A", "WK_weapon_hammer_B", "WK_weapon_spear", "WK_weapon_pick",
    "WK_weapon_Bow", "WK_weapon_staff_A", "WK_weapon_staff_B", "WK_weapon_staff_C",
    "WK_Shield_A", "WK_Shield_B", "WK_Shield_C", "WK_Shield_D",
    "WK_Xtra_bag", "WK_Xtra_wood", "WK_Xtra_quiver",
  ],
  barbarians: [
    "BRB_head_A", "BRB_head_B", "BRB_head_C", "BRB_head_D", "BRB_head_E",
    "BRB_head_F", "BRB_head_G", "BRB_head_H", "BRB_head_I", "BRB_head_J",
    "BRB_body_A", "BRB_body_B", "BRB_body_C", "BRB_body_D", "BRB_body_E",
    "BRB_body_F", "BRB_body_G", "BRB_body_H",
    "BRB_arms_A", "BRB_arms_B", "BRB_arms_C",
    "BRB_legs_A", "BRB_legs_B", "BRB_legs_C",
    "BRB_shoulderpads_A", "BRB_shoulderpads_B", "BRB_shoulderpads_C",
    "BRB_weapon_sword_A", "BRB_weapon_sword_B", "BRB_weapon_axe_A", "BRB_weapon_axe_B",
    "BRB_weapon_axe_C", "BRB_weapon_hammer_A", "BRB_weapon_hammer_B", "BRB_weapon_spear",
    "BRB_weapon_Dagger", "BRB_weapon_Bow", "BRB_weapon_staff_A", "BRB_weapon_staff_B",
    "BRB_weapon_staff_C", "BRB_Shield_A", "BRB_Shield_B", "BRB_Shield_C", "BRB_Shield_D",
    "BRB_Xtra_bag", "BRB_Xtra_wood", "BRB_Xtra_quiver",
  ],
  "high-elves": [
    "ELF_Units_Head_A", "ELF_Units_Head_B", "ELF_Units_Head_C", "ELF_Units_Head_D",
    "ELF_Units_Head_E", "ELF_Units_Head_F", "ELF_Units_Head_G", "ELF_Units_Head_H",
    "ELF_Units_Head_I", "ELF_Units_Head_J", "ELF_Units_Head_K", "ELF_Units_Head_L",
    "ELF_Units_Head_M", "ELF_Units_Head_N", "ELF_Units_Head_O", "ELF_Units_Head_P",
    "ELF_Units_Body_A", "ELF_Units_Body_B", "ELF_Units_Body_C", "ELF_Units_Body_D",
    "ELF_Units_Body_E", "ELF_Units_Body_F",
    "ELF_Units_Arms_A", "ELF_Units_Arms_B", "ELF_Units_Arms_C",
    "ELF_Units_Legs_A", "ELF_Units_Legs_B", "ELF_Units_Legs_C",
    "ELF_Units_Shoulderpads_A", "ELF_Units_Shoulderpads_B", "ELF_Units_Shoulderpads_C",
    "ELF_weapon_sword_A", "ELF_weapon_sword_B", "ELF_weapon_bow", "ELF_weapon_staff_B",
    "ELF_weapon_staff_C", "ELF_weapon_spear",
    "ELF_shield_A", "ELF_shield_B", "ELF_shield_C",
    "ELF_Xtra_bag", "ELF_Xtra_wood", "ELF_Xtra_quiver",
  ],
  dwarves: [
    "DWF_Units_Head_A", "DWF_Units_Head_B", "DWF_Units_Head_C", "DWF_Units_Head_D",
    "DWF_Units_Head_E", "DWF_Units_Head_F", "DWF_Units_Head_G", "DWF_Units_Head_H",
    "DWF_Units_Head_I", "DWF_Units_Head_J", "DWF_Units_Head_K", "DWF_Units_Head_L",
    "DWF_Units_Body_A", "DWF_Units_Body_B", "DWF_Units_Body_C", "DWF_Units_Body_D",
    "DWF_Units_Body_E",
    "DWF_Units_Arms_A", "DWF_Units_Arms_B", "DWF_Units_Arms_C",
    "DWF_Units_Legs_A", "DWF_Units_Legs_B", "DWF_Units_Legs_C",
    "DWF_Units_Shoulderpads_A", "DWF_Units_Shoulderpads_B", "DWF_Units_Shoulderpads_C",
    "DWF_Weapon_sword_A", "DWF_Weapon_sword_B", "DWF_Weapon_axe_A", "DWF_Weapon_axe_B",
    "DWF_Weapon_axe_C", "DWF_Weapon_hammer_A", "DWF_Weapon_hammer_B", "DWF_Weapon_spear",
    "DWF_Weapon_dagger", "DWF_Weapon_pick", "DWF_Weapon_bow", "DWF_Weapon_staff_A",
    "DWF_Weapon_staff_B",
    "DWF_Shield_A", "DWF_Shield_B", "DWF_Shield_C", "DWF_Shield_D",
    "DWF_Xtra_bag", "DWF_Xtra_wood", "DWF_Xtra_quiver",
  ],
  orcs: [
    "ORC_Units_Head_A", "ORC_Units_Head_B", "ORC_Units_Head_C", "ORC_Units_Head_D",
    "ORC_Units_Head_E", "ORC_Units_Head_F", "ORC_Units_Head_G", "ORC_Units_Head_H",
    "ORC_Units_Body_A", "ORC_Units_Body_B", "ORC_Units_Body_C", "ORC_Units_Body_D",
    "ORC_Units_Body_E", "ORC_Units_Body_F", "ORC_Units_Body_G",
    "ORC_Units_Arms_A", "ORC_Units_Arms_B", "ORC_Units_Arms_C",
    "ORC_Units_Legs_A", "ORC_Units_Legs_B", "ORC_Units_Legs_C", "ORC_Units_Legs_D",
    "ORC_Units_Shoulderpads_A", "ORC_Units_Shoulderpads_B", "ORC_Units_Shoulderpads_C",
    "ORC_Units_Shoulderpads_D", "ORC_Units_Shoulderpads_E", "ORC_Units_Shoulderpads_F",
    "ORC_weapon_Sword_A", "ORC_weapon_Sword_B", "ORC_weapon_Axe_A", "ORC_weapon_Axe_B",
    "ORC_weapon_Axe_C", "ORC_weapon_Hammer", "ORC_weapon_Mace_A", "ORC_weapon_spear",
    "ORC_weapon_Dagger", "ORC_weapon_Bow", "ORC_weapon_staff_A", "ORC_weapon_staff_B",
    "ORC_weapon_staff_C",
    "ORC_Shield_A", "ORC_Shield_B", "ORC_Shield_C", "ORC_Shield_D",
    "ORC_Xtra_Bag", "ORC_Xtra_Wood", "ORC_Xtra_quiver",
  ],
  undead: [
    "UD_Units_head_A", "UD_Units_head_B", "UD_Units_head_C", "UD_Units_head_D",
    "UD_Units_head_E", "UD_Units_head_F", "UD_Units_head_G", "UD_Units_head_H",
    "UD_Units_head_I", "UD_Units_head_J", "UD_Units_head_K", "UD_Units_head_L",
    "UD_Units_head_M",
    "UD_Units_body_A", "UD_Units_body_B", "UD_Units_body_C", "UD_Units_body_D",
    "UD_Units_body_E", "UD_Units_body_F", "UD_Units_body_G",
    "UD_Units_arms_A", "UD_Units_arms_B", "UD_Units_arms_C", "UD_Units_arms_D",
    "UD_Units_arms_E",
    "UD_Units_legs_A", "UD_Units_legs_B", "UD_Units_legs_C", "UD_Units_legs_D",
    "UD_Units_shoulderpads_A", "UD_Units_shoulderpads_B", "UD_Units_shoulderpads_C",
    "UD_weapon_Sword_A", "UD_weapon_Sword_B", "UD_weapon_Sword_C", "UD_weapon_Axe_A",
    "UD_weapon_Axe_B", "UD_weapon_Hammer", "UD_weapon_Spear", "UD_weapon_Bow",
    "UD_weapon_staff_A", "UD_weapon_staff_B", "UD_weapon_staff_C", "UD_weapon_staff_D",
    "UD_Shield_A", "UD_Shield_B", "UD_Shield_C",
    "UD_Xtra_Bag", "UD_Xtra_Wood", "UD_Xtra_Quiver",
  ],
};
