/**
 * Starting equipment for GrudaChain / Railway characters created from Open Account Hub.
 *
 * uMMORPG main-panel contract:
 *   race + class → gear preset → visibleMeshes (mesh_ids)
 *   slots (weapon/chest/…) drive paperdoll icons + Danger Room loadout
 *
 * SSOT mesh lists: three/grudge/gearPresets.ts (Toon RTS modular kit names).
 */
import {
  getPreset,
  type PresetId,
  type RaceId,
} from "../three/grudge";
import { resolveRaceId, resolvePresetId } from "./raceModel";
import type { PaperEquipped, PaperSlotId } from "../components/equip/AccountPaperdoll";
import type { WeaponId } from "../three/types";

export type StarterWeaponChoice = "sword" | "axe" | "staff";

/** Map create-hero weapon cycle → class preset (uMMORPG role). */
export function classFromStarterWeapon(w: StarterWeaponChoice | null | undefined): PresetId {
  if (w === "staff") return "mage";
  if (w === "axe") return "warrior";
  return "knight";
}

/** Map starter weapon → Open arsenal WeaponId. */
export function weaponIdFromStarter(w: StarterWeaponChoice | null | undefined): WeaponId {
  if (w === "staff") return "staffFire";
  if (w === "axe") return "greataxe";
  return "sword";
}

export type StartingEquipmentBlob = {
  /** grudge6 child mesh visibility list */
  mesh_ids: string[];
  meshIds: string[];
  gearPresetId: string;
  classId: string;
  raceId: string;
  weaponId: WeaponId;
  offHand: WeaponId | null;
  /** Slot bags for paperdoll / main panel */
  weapon: { id: string; name: string; icon: string; slot: string };
  mainHand: { id: string; name: string; icon: string; slot: string };
  offhand?: { id: string; name: string; icon: string; slot: string } | null;
  chest: { id: string; name: string; icon: string; slot: string };
  helmet: { id: string; name: string; icon: string; slot: string };
  /** Namespaced Open save (Danger Room loadout) */
  open: {
    weaponId: WeaponId;
    offHand: WeaponId | null;
    meshIds: string[];
    gearPresetId: string;
    avatarId?: string;
    updatedAt: number;
  };
};

const WEAPON_META: Record<
  StarterWeaponChoice,
  { id: string; name: string; icon: string }
> = {
  sword: { id: "starter_sword", name: "Starter Sword", icon: "equip" },
  axe: { id: "starter_axe", name: "Starter Axe", icon: "charge" },
  staff: { id: "starter_staff", name: "Starter Staff", icon: "skill-vfx-lab" },
};

/**
 * Build full starting equipment for a new GrudaChain character.
 * @param fleetRaceId — human, orc, elf, dwarf, barbarian, undead, western-kingdoms, …
 * @param weapon — UI create-hero weapon cycle
 * @param catalogId — e.g. race-human for Open mesh resolver
 */
export function buildStartingEquipment(
  fleetRaceId: string,
  weapon: StarterWeaponChoice = "sword",
  catalogId?: string,
): StartingEquipmentBlob {
  const raceId = resolveRaceId(fleetRaceId);
  const classId = classFromStarterWeapon(weapon);
  const preset = getPreset(raceId, classId);
  const meshIds = preset.visibleMeshes.slice();
  const gearPresetId = `${raceId}:${classId}`;
  const weaponId = weaponIdFromStarter(weapon);
  const offHand: WeaponId | null = classId === "knight" ? "shield" : null;
  const wMeta = WEAPON_META[weapon];
  const now = Date.now();

  const offhand =
    offHand === "shield"
      ? {
          id: "starter_shield",
          name: "Starter Shield",
          icon: "defend",
          slot: "offhand",
        }
      : null;

  return {
    mesh_ids: meshIds,
    meshIds,
    gearPresetId,
    classId,
    raceId,
    weaponId,
    offHand,
    weapon: { ...wMeta, slot: "weapon" },
    mainHand: { ...wMeta, slot: "mainHand" },
    offhand,
    chest: {
      id: `starter_chest_${classId}`,
      name: `${preset.label} Chest`,
      icon: "equip",
      slot: "chest",
    },
    helmet: {
      id: `starter_helm_${classId}`,
      name: `${preset.label} Helm`,
      icon: "equip",
      slot: "helmet",
    },
    open: {
      weaponId,
      offHand,
      meshIds,
      gearPresetId,
      avatarId: catalogId,
      updatedAt: now,
    },
  };
}

/** Paperdoll equipped map from starting kit or resolved character bag. */
export function paperEquippedFromStarter(
  starter: StartingEquipmentBlob,
): PaperEquipped {
  const out: PaperEquipped = {
    weapon: { name: starter.weapon.name, iconName: starter.weapon.icon },
    chest: { name: starter.chest.name, iconName: starter.chest.icon },
    helmet: { name: starter.helmet.name, iconName: starter.helmet.icon },
  };
  if (starter.offhand) {
    out.offhand = {
      name: starter.offhand.name,
      iconName: starter.offhand.icon,
    };
  }
  return out;
}

/** Map resolveCharacterEquipmentVisual slotIcons/labels → paperdoll. */
export function paperEquippedFromSlots(
  slotIcons: Record<string, string>,
  slotLabels: Record<string, string>,
  fallback?: PaperEquipped,
): PaperEquipped {
  const slotMap: Record<string, PaperSlotId> = {
    weapon: "weapon",
    mainHand: "weapon",
    mainhand: "weapon",
    offhand: "offhand",
    offHand: "offhand",
    shield: "offhand",
    helmet: "helmet",
    head: "helmet",
    helm: "helmet",
    chest: "chest",
    body: "chest",
    armor: "chest",
    gloves: "gloves",
    arms: "gloves",
    legs: "legs",
    boots: "boots",
    belt: "belt",
    cloak: "cloak",
    amulet: "amulet",
    ring: "ring",
  };
  const out: PaperEquipped = { ...(fallback || {}) };
  for (const [raw, label] of Object.entries(slotLabels)) {
    const paper = slotMap[raw] || slotMap[raw.toLowerCase()];
    if (!paper) continue;
    out[paper] = {
      name: label,
      iconUrl: slotIcons[raw],
      iconName: out[paper]?.iconName || "equip",
    };
  }
  for (const [raw, url] of Object.entries(slotIcons)) {
    const paper = slotMap[raw] || slotMap[raw.toLowerCase()];
    if (!paper) continue;
    out[paper] = {
      name: out[paper]?.name || raw,
      iconUrl: url,
      iconName: out[paper]?.iconName,
    };
  }
  return out;
}

/** Human-readable mesh list for account inventory UI. */
export function meshIdsSummary(meshIds: string[]): string[] {
  return meshIds.map((m) =>
    m
      .replace(/^(WK_|BRB_|ORC_|ELF_|UD_|DWF_)/i, "")
      .replace(/Units_/gi, "")
      .replace(/_/g, " "),
  );
}

export function ensurePresetId(classId: string | undefined): PresetId {
  return resolvePresetId(classId);
}

export type { RaceId, PresetId };
