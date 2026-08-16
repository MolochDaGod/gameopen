// Gear presets — vendored from the grudge character-kit (which duplicated
// RACE_GEAR_PRESETS from the character-viewer meshCatalog). Each preset's
// `visibleMeshes` already includes the weapon mesh — equipment dictates which
// armour + weapon meshes render. `animPack` drives the combat/idle/run clip set.

import type { RaceId } from "./raceAssets";
import type { AnimPack } from "./anims";
import {
  TOON_WARDROBE,
  TOON_RELICS,
  TOON_CLASS_ITEMS,
  TOON_RINGS,
  reconcileKitLoadout,
  kitSlotGate,
  kitWeaponFamily,
  isQuiverMesh,
} from "./toonKitCoverage";
import { paperdollBackIds } from "../equipment/backSlotItems";

export type PresetId = "mage" | "knight" | "ranger" | "warrior" | "unarmed";

export interface GearPreset {
  id: PresetId;
  label: string;
  description: string;
  color: string;
  animPack: AnimPack;
  visibleMeshes: string[];
}

const BRB: GearPreset[] = [
  { id: "mage",    label: "Mage",    description: "Cloth & Staff",         color: "#7c3aed", animPack: "magic",        visibleMeshes: ["BRB_head_A","BRB_body_A","BRB_arms_A","BRB_weapon_staff_C"] },
  { id: "knight",  label: "Knight",  description: "Full Plate & Sword",    color: "#1d4ed8", animPack: "sword_shield", visibleMeshes: ["BRB_head_F","BRB_body_F","BRB_arms_C","BRB_shoulderpads_C","BRB_weapon_sword_B","BRB_Shield_B"] },
  { id: "ranger",  label: "Ranger",  description: "Leather & Bow",         color: "#15803d", animPack: "longbow",      visibleMeshes: ["BRB_head_C","BRB_body_B","BRB_arms_B","BRB_shoulderpads_A","BRB_weapon_Bow","BRB_Xtra_quiver"] },
  { id: "warrior", label: "Warrior", description: "Chainmail & Sword",     color: "#c2410c", animPack: "sword_shield", visibleMeshes: ["BRB_head_B","BRB_body_C","BRB_arms_B","BRB_shoulderpads_B","BRB_weapon_sword_B","BRB_Shield_B"] },
  { id: "unarmed", label: "Unarmed", description: "Cloth & No Weapon",     color: "#78716c", animPack: "unarmed",      visibleMeshes: ["BRB_head_A","BRB_body_B","BRB_arms_A"] },
];

const DWF: GearPreset[] = [
  { id: "mage",    label: "Mage",    description: "Cloth & Staff",         color: "#7c3aed", animPack: "magic",        visibleMeshes: ["DWF_Units_Head_A","DWF_Units_Body_A","DWF_Weapon_staff_B"] },
  { id: "knight",  label: "Knight",  description: "Full Plate & Sword",    color: "#1d4ed8", animPack: "sword_shield", visibleMeshes: ["DWF_Units_Head_F","DWF_Units_Body_D","DWF_Units_Shoulderpads_C","DWF_Weapon_sword_B","DWF_Shield_B"] },
  { id: "ranger",  label: "Ranger",  description: "Leather & Bow",         color: "#15803d", animPack: "longbow",      visibleMeshes: ["DWF_Units_Head_C","DWF_Units_Body_B","DWF_Units_Shoulderpads_A","DWF_Weapon_bow","DWF_Xtra_quiver"] },
  { id: "warrior", label: "Warrior", description: "Chainmail & Sword",     color: "#c2410c", animPack: "sword_shield", visibleMeshes: ["DWF_Units_Head_G","DWF_Units_Body_C","DWF_Units_Shoulderpads_B","DWF_Weapon_sword_B","DWF_Shield_B"] },
  { id: "unarmed", label: "Unarmed", description: "Cloth & No Weapon",     color: "#78716c", animPack: "unarmed",      visibleMeshes: ["DWF_Units_Head_A","DWF_Units_Body_B"] },
];

const ELF: GearPreset[] = [
  { id: "mage",    label: "Mage",    description: "Cloth & Arcane Staff",  color: "#7c3aed", animPack: "magic",        visibleMeshes: ["ELF_Units_Head_B","ELF_Units_Body_A","ELF_Units_Arms_A","ELF_Units_Legs_A","ELF_weapon_staff_C"] },
  { id: "knight",  label: "Knight",  description: "Full Plate & Sword",    color: "#1d4ed8", animPack: "sword_shield", visibleMeshes: ["ELF_Units_Head_G","ELF_Units_Body_E","ELF_Units_Arms_C","ELF_Units_Legs_C","ELF_Units_Shoulderpads_C","ELF_weapon_sword_B","ELF_shield_B"] },
  { id: "ranger",  label: "Ranger",  description: "Leather & Bow",         color: "#15803d", animPack: "longbow",      visibleMeshes: ["ELF_Units_Head_C","ELF_Units_Body_B","ELF_Units_Arms_B","ELF_Units_Legs_B","ELF_Units_Shoulderpads_A","ELF_weapon_bow","ELF_Xtra_quiver"] },
  { id: "warrior", label: "Warrior", description: "Chainmail & Sword",     color: "#c2410c", animPack: "sword_shield", visibleMeshes: ["ELF_Units_Head_D","ELF_Units_Body_C","ELF_Units_Arms_B","ELF_Units_Legs_B","ELF_Units_Shoulderpads_B","ELF_weapon_sword_B","ELF_shield_B"] },
  { id: "unarmed", label: "Unarmed", description: "Cloth & No Weapon",     color: "#78716c", animPack: "unarmed",      visibleMeshes: ["ELF_Units_Head_A","ELF_Units_Body_B","ELF_Units_Arms_A","ELF_Units_Legs_A"] },
];

const ORC: GearPreset[] = [
  { id: "mage",    label: "Shaman",   description: "Hide & Totem Staff",   color: "#7c3aed", animPack: "magic",        visibleMeshes: ["ORC_Units_Head_A","ORC_Units_Body_A","ORC_weapon_staff_C"] },
  { id: "knight",  label: "Warchief", description: "Heavy Plate & Axe",    color: "#1d4ed8", animPack: "sword_shield", visibleMeshes: ["ORC_Units_Head_G","ORC_Units_Body_F","ORC_Units_Shoulderpads_F","ORC_weapon_Axe_C","ORC_Shield_C"] },
  { id: "ranger",  label: "Hunter",   description: "Leather & Bow",        color: "#15803d", animPack: "longbow",      visibleMeshes: ["ORC_Units_Head_B","ORC_Units_Body_B","ORC_Units_Shoulderpads_A","ORC_weapon_Bow","ORC_Xtra_quiver"] },
  { id: "warrior", label: "Warrior",  description: "Chainmail & Axe",      color: "#c2410c", animPack: "sword_shield", visibleMeshes: ["ORC_Units_Head_E","ORC_Units_Body_C","ORC_Units_Legs_B","ORC_Units_Shoulderpads_C","ORC_weapon_Axe_B","ORC_Shield_C"] },
  { id: "unarmed", label: "Brawler",  description: "Bare Hide & No Weapon",color: "#78716c", animPack: "unarmed",      visibleMeshes: ["ORC_Units_Head_A","ORC_Units_Body_A"] },
];

const UD: GearPreset[] = [
  { id: "mage",    label: "Lich",         description: "Robe & Lich Staff",     color: "#7c3aed", animPack: "magic",        visibleMeshes: ["UD_Units_head_A","UD_Units_body_G","UD_weapon_staff_D"] },
  { id: "knight",  label: "Death Knight", description: "Full Plate & Sword",    color: "#1d4ed8", animPack: "sword_shield", visibleMeshes: ["UD_Units_head_F","UD_Units_body_F","UD_Units_shoulderpads_C","UD_weapon_Sword_B","UD_Shield_C"] },
  { id: "ranger",  label: "Shade",        description: "Bone Armor & Bow",      color: "#15803d", animPack: "longbow",      visibleMeshes: ["UD_Units_head_C","UD_Units_body_B","UD_Units_shoulderpads_A","UD_weapon_Bow","UD_Xtra_Quiver"] },
  { id: "warrior", label: "Warrior",      description: "Plague Plate & Sword",  color: "#c2410c", animPack: "sword_shield", visibleMeshes: ["UD_Units_head_G","UD_Units_body_D","UD_Units_shoulderpads_B","UD_weapon_Sword_B","UD_Shield_C"] },
  { id: "unarmed", label: "Risen",        description: "Bone Armor & No Weapon",color: "#78716c", animPack: "unarmed",      visibleMeshes: ["UD_Units_head_A","UD_Units_body_B"] },
];

const WK: GearPreset[] = [
  { id: "mage",    label: "Wizard",  description: "Cloth Robe & Holy Staff", color: "#7c3aed", animPack: "magic",        visibleMeshes: ["WK_Units_head_A","WK_Units_Body_A","WK_weapon_staff_C"] },
  { id: "knight",  label: "Knight",  description: "Full Plate & Sword",      color: "#1d4ed8", animPack: "sword_shield", visibleMeshes: ["WK_Units_head_F","WK_Units_Body_E","WK_Units_Arms_D","WK_Units_shoulderpads_B","WK_weapon_sword_B","WK_Shield_B"] },
  { id: "ranger",  label: "Archer",  description: "Leather & Longbow",       color: "#15803d", animPack: "longbow",      visibleMeshes: ["WK_Units_head_C","WK_Units_Body_B","WK_Units_Arms_B","WK_Units_Legs_B","WK_weapon_Bow","WK_Xtra_quiver"] },
  { id: "warrior", label: "Warrior", description: "Chainmail & Sword",       color: "#c2410c", animPack: "sword_shield", visibleMeshes: ["WK_Units_head_D","WK_Units_Body_C","WK_Units_Arms_B","WK_Units_Legs_B","WK_Units_shoulderpads_A","WK_weapon_sword_B","WK_Shield_B"] },
  { id: "unarmed", label: "Unarmed", description: "Cloth & No Weapon",       color: "#78716c", animPack: "unarmed",      visibleMeshes: ["WK_Units_head_A","WK_Units_Body_B","WK_Units_Arms_A","WK_Units_Legs_A"] },
];

export const RACE_GEAR_PRESETS: Record<RaceId, GearPreset[]> = {
  barbarians: BRB,
  dwarves: DWF,
  "high-elves": ELF,
  orcs: ORC,
  undead: UD,
  "western-kingdoms": WK,
};

export const PRESET_IDS: PresetId[] = ["mage", "knight", "ranger", "warrior", "unarmed"];

export function getPreset(race: RaceId, preset: PresetId): GearPreset {
  const list = RACE_GEAR_PRESETS[race];
  return list.find((p) => p.id === preset) ?? list[0];
}

/** Main-panel families — Unity Player.prefab slotInfo + Toon child meshes. */
export type KitPanelSlot =
  | "head"
  | "body"
  | "arms"
  | "legs"
  | "shoulders"
  | "weapon"
  | "shield"
  | "back"
  | "relic"
  | "ring"
  | "classItem";

const KIT_SLOT_RE: Record<KitPanelSlot, RegExp> = {
  head: /head|hat/i,
  body: /body/i,
  arms: /arms/i,
  legs: /legs/i,
  shoulders: /shoulder/i,
  weapon: /weapon|sword|axe|bow|staff|spear|dagger|hammer|mace|pick/i,
  shield: /shield/i,
  back: /xtra|bag|wood|quiver|^equip:back:/i,
  relic: /^equip:relic:(nature|frost|fury|void)$/i,
  ring: /^equip:ring:/i,
  classItem: /^equip:class:|^equip:relic:(warrior|ranger|mage|worge)$/i,
};

const OPTIONAL_EMPTY: ReadonlySet<KitPanelSlot> = new Set([
  "shoulders",
  "weapon",
  "shield",
  "back",
  "relic",
  "ring",
  "classItem",
]);

function meshMatchesSlot(name: string, slot: KitPanelSlot): boolean {
  if (!KIT_SLOT_RE[slot].test(name)) return false;
  if (slot === "weapon" && /shield/i.test(name)) return false;
  if (slot === "back" && /weapon|shield/i.test(name)) return false;
  if (slot === "body" && /head|arm|leg|shoulder|weapon|shield|xtra|equip:/i.test(name)) return false;
  if (slot === "relic" && !KIT_SLOT_RE.relic.test(name)) return false;
  if (slot === "classItem" && !KIT_SLOT_RE.classItem.test(name)) return false;
  if (slot === "ring" && !/^equip:ring:/i.test(name)) return false;
  return true;
}

/** Full customizable wardrobe for a slot (Unity prefab + CDN GLB). */
export function collectKitSlotMeshes(race: RaceId, slot: KitPanelSlot): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (m: string) => {
    if (!meshMatchesSlot(m, slot) || seen.has(m)) return;
    seen.add(m);
    out.push(m);
  };
  if (slot === "relic") {
    for (const m of TOON_RELICS) add(m);
    return out;
  }
  if (slot === "classItem") {
    for (const m of TOON_CLASS_ITEMS) add(m);
    return out;
  }
  if (slot === "ring") {
    for (const m of TOON_RINGS) add(m);
    return out;
  }
  if (slot === "back") {
    for (const m of paperdollBackIds()) add(m);
  }
  for (const m of TOON_WARDROBE[race] ?? []) add(m);
  for (const p of RACE_GEAR_PRESETS[race] ?? []) {
    for (const m of p.visibleMeshes) add(m);
  }
  return out;
}

export function currentKitSlotMesh(meshIds: string[], slot: KitPanelSlot): string | null {
  return meshIds.find((m) => meshMatchesSlot(m, slot)) ?? null;
}

function slotAllowsEmpty(race: RaceId, meshIds: string[], slot: KitPanelSlot): boolean {
  if (!OPTIONAL_EMPTY.has(slot)) return false;
  if (slot === "back") {
    const weapon = meshIds.find((m) => meshMatchesSlot(m, "weapon"));
    if (kitWeaponFamily(weapon) === "bow") return false;
  }
  return true;
}

/** Cycle one exclusive slot; robe/weapon rules reconcile required pieces. */
export function cycleKitSlot(race: RaceId, meshIds: string[], slot: KitPanelSlot): string[] {
  const gate = kitSlotGate(race, meshIds, slot);
  if (!gate.ok) return meshIds.slice();

  let variants = collectKitSlotMeshes(race, slot);
  if (slot === "back") {
    const weapon = meshIds.find((m) => meshMatchesSlot(m, "weapon"));
    if (kitWeaponFamily(weapon) === "bow") {
      variants = variants.filter((m) => isQuiverMesh(m));
    }
  }
  if (!variants.length && !slotAllowsEmpty(race, meshIds, slot)) return meshIds.slice();

  const cur = currentKitSlotMesh(meshIds, slot);
  const allowEmpty = slotAllowsEmpty(race, meshIds, slot);
  let next: string | null;
  if (allowEmpty) {
    if (!cur) next = variants[0] ?? null;
    else {
      const idx = variants.indexOf(cur);
      next = idx >= 0 && idx < variants.length - 1 ? variants[idx + 1]! : null;
    }
  } else {
    if (!variants.length) return meshIds.slice();
    const idx = cur ? variants.indexOf(cur) : -1;
    next = variants[(idx + 1) % variants.length]!;
  }

  const stripped = meshIds.filter((m) => !meshMatchesSlot(m, slot));
  const nextIds = next ? [...stripped, next] : stripped;
  return reconcileKitLoadout(race, nextIds);
}
