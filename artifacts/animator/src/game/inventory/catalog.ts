/**
 * Built-in material + consumable templates for bag / account inventory.
 * Extends content/items when present; materials use short ids (wood, ore, …)
 * matching Railway /api/account/resources.
 *
 * Icons: ObjectStore material shard → assets.grudge-studio.com/game-assets/icons/materials/*
 * @see lib/objectStore.ts · info.grudge-studio.com/api/v1/icon-shards/material.json
 */

import type { ItemTemplate } from "./types";
import { MATERIAL_STACK_MAX } from "./types";
import { materialIconPath, resolveIconUrl } from "../../lib/objectStore";
import { BACK_SLOT_ITEMS, backItemIconUrl } from "../../three/equipment/backSlotItems";

const mat = (
  id: string,
  name: string,
  /** ObjectStore material slug for icon (e.g. oak-log) or relative pack path */
  iconOrMaterialSlug: string,
  tags: string[] = [],
): ItemTemplate => {
  const isMaterialSlug = !iconOrMaterialSlug.includes("/") && !iconOrMaterialSlug.startsWith("http");
  const iconPath = isMaterialSlug
    ? materialIconPath(iconOrMaterialSlug)
    : iconOrMaterialSlug;
  const iconUrl = resolveIconUrl(iconPath) || iconPath;
  return {
    id,
    kind: "material",
    name,
    rarity: "common",
    maxStack: MATERIAL_STACK_MAX,
    icon: iconUrl,
    tags: ["harvest", ...tags],
  };
};

/** Harvest materials — stack 100 in character bag. Icons from ObjectStore materials. */
export const MATERIAL_TEMPLATES: Record<string, ItemTemplate> = {
  wood: mat("wood", "Wood", "oak-log", ["logging"]),
  stone: mat("stone", "Stone", "scrap-ore", ["mining"]),
  fiber: mat("fiber", "Fiber", "cotton-thread", ["gather"]),
  ore: mat("ore", "Ore", "iron-ore", ["mining"]),
  meat: mat("meat", "Meat", "rawhide", ["skin"]),
  hide: mat("hide", "Hide", "rawhide", ["skin"]),
  planks: mat("planks", "Planks", "oak-plank", ["craft"]),
  sticks: mat("sticks", "Sticks", "pine-log", ["craft"]),
  stone_brick: mat("stone_brick", "Stone Brick", "scrap-ore", ["craft"]),
  iron_ingot: mat("iron_ingot", "Iron Ingot", "iron-ingot", ["craft"]),
  coin: mat("coin", "Coin", "/ui/craftpix/part3/resources/coin.png", ["currency"]),
  clay: mat("clay", "Clay", "scrap-ore", ["dig"]),
  coal: mat("coal", "Coal", "ore_t1", ["mining"]),
};

export const CONSUMABLE_TEMPLATES: Record<string, ItemTemplate> = {
  itm_ration_01: {
    id: "itm_ration_01",
    kind: "consumable",
    name: "Field Ration",
    description: "Restore a little health. Bind to J/H/V from bag.",
    rarity: "common",
    maxStack: MATERIAL_STACK_MAX,
    // WCS / ObjectStore pack icon (info + assets CDN)
    icon: resolveIconUrl("icons/pack/misc/Effect.png") || "/icons/pack/misc/Effect.png",
    heal: 25,
    tags: ["food", "utility"],
  },
  itm_water_01: {
    id: "itm_water_01",
    kind: "consumable",
    name: "Waterskin",
    description: "Restore stamina. Bind to J/H/V from bag.",
    rarity: "common",
    maxStack: MATERIAL_STACK_MAX,
    icon: resolveIconUrl("icons/pack/misc/Effect.png") || "/icons/pack/misc/Effect.png",
    stamina: 30,
    tags: ["drink", "utility"],
  },
  /** Deploy claim flag ghost from bag (RMB → Deploy · J/H/V · E near flag after plant). */
  itm_claim_flag: {
    id: "itm_claim_flag",
    kind: "tool",
    name: "Claim Flag",
    description:
      "Deploy from bag or J/H/V to plant a camp claim. Walk up and press E to open camp UI.",
    rarity: "uncommon",
    maxStack: 5,
    icon: "/icons/camp/flag.png",
    tags: ["camp", "claim", "deploy", "placeable:claim_flag", "utility"],
  },
};

/** Sample gear for loadout slots (main / side / mount / boat). */
export const LOADOUT_TEMPLATES: Record<string, ItemTemplate> = {
  wpn_sword_01: {
    id: "wpn_sword_01",
    kind: "weapon",
    name: "Iron Sword",
    rarity: "common",
    maxStack: 1,
    icon: "/icons/pack/weapons/Sword_01.png",
    equipSlot: "mainHand",
    tags: ["weapon", "melee"],
    weaponFamily: "sword",
    weaponTier: 0,
  },
  wpn_bow_01: {
    id: "wpn_bow_01",
    kind: "weapon",
    name: "Hunting Bow",
    rarity: "common",
    maxStack: 1,
    icon: "/icons/pack/weapons/Bow_01.png",
    equipSlot: "sideArm",
    tags: ["weapon", "ranged", "sidearm"],
    weaponFamily: "bow",
    weaponTier: 0,
  },
  wpn_flintlock_t0: {
    id: "wpn_flintlock_t0",
    kind: "weapon",
    name: "Flintlock (T0)",
    description: "Stylized flintlock sidearm — Danger Room / GUN class SSOT.",
    rarity: "uncommon",
    maxStack: 1,
    icon: "/icons/pack/weapons/Gun_01.png",
    equipSlot: "mainHand",
    tags: ["weapon", "ranged", "gun", "pistol", "flintlock"],
    weaponFamily: "pistol",
    weaponTier: 0,
  },
  arm_shield_01: {
    id: "arm_shield_01",
    kind: "equipment",
    name: "Round Shield",
    rarity: "common",
    maxStack: 1,
    icon: "/icons/pack/misc/Effect.png",
    equipSlot: "offHand",
    tags: ["shield", "offhand"],
  },
  itm_mount_horse_01: {
    id: "itm_mount_horse_01",
    kind: "mount",
    name: "Warhorse",
    rarity: "uncommon",
    maxStack: 1,
    icon: "/icons/pack/misc/Effect.png",
    equipSlot: "mount",
    tags: ["mount"],
  },
  itm_boat_skiff_01: {
    id: "itm_boat_skiff_01",
    kind: "boat",
    name: "Coastal Skiff",
    rarity: "uncommon",
    maxStack: 1,
    icon: "/icons/pack/misc/Effect.png",
    equipSlot: "boat",
    tags: ["boat", "ship"],
  },
};

/** Back-slot gear — unique instances; craft via rcp_back_* (harvest recipes). */
export const BACK_TEMPLATES: Record<string, ItemTemplate> = (() => {
  const out: Record<string, ItemTemplate> = {};
  const extras = [
    { id: "back_quiver", label: "Quiver" },
    { id: "back_bag", label: "Traveler's Bag" },
    { id: "back_wood", label: "Carry Wood" },
  ];
  for (const i of [...BACK_SLOT_ITEMS, ...extras]) {
    const itemId = `itm_${i.id}`;
    out[itemId] = {
      id: itemId,
      kind: "back",
      name: i.label,
      description: "effect" in i ? String((i as { effect?: string }).effect || "") : "",
      rarity: "status" in i && i.status === "planned" ? "uncommon" : "common",
      maxStack: 1,
      icon: backItemIconUrl(i.id),
      equipSlot: "back",
      tags: ["back", "equip"],
    };
  }
  return out;
})();

const CACHE: Record<string, ItemTemplate> = {
  ...MATERIAL_TEMPLATES,
  ...CONSUMABLE_TEMPLATES,
  ...LOADOUT_TEMPLATES,
  ...BACK_TEMPLATES,
};

export function getItemTemplate(templateId: string): ItemTemplate {
  if (CACHE[templateId]) return CACHE[templateId]!;
  // Fallback for unknown harvest ids / mission items
  return {
    id: templateId,
    kind: templateId.startsWith("wpn_")
      ? "weapon"
      : templateId.startsWith("arm_")
        ? "equipment"
        : templateId.startsWith("itm_back_") || templateId.startsWith("bck_")
          ? "back"
          : templateId.startsWith("itm_")
            ? "consumable"
            : "material",
    name: templateId.replace(/^itm_|^wpn_|^arm_/, "").replace(/_/g, " "),
    rarity: "common",
    maxStack:
      templateId.startsWith("wpn_") ||
      templateId.startsWith("arm_") ||
      templateId.startsWith("itm_back_") ||
      templateId.startsWith("bck_")
        ? 1
        : MATERIAL_STACK_MAX,
    icon: "/icons/pack/misc/Effect.png",
  };
}

export function isStackableMaterial(templateId: string): boolean {
  const t = getItemTemplate(templateId);
  return t.kind === "material" || t.maxStack > 1;
}

export function maxStackFor(templateId: string): number {
  return getItemTemplate(templateId).maxStack;
}

/**
 * Unique instances require Railway grudge_uuid + ledger when signed in.
 * Stackable mats/consumables use definition id + qty only.
 */
export function isLedgerUniqueItem(templateId: string): boolean {
  if (!templateId) return false;
  if (
    templateId.startsWith("wpn_") ||
    templateId.startsWith("arm_") ||
    templateId.startsWith("itm_back_") ||
    templateId.startsWith("bck_") ||
    templateId.startsWith("EQIP-") ||
    templateId.startsWith("ITEM-")
  ) {
    return true;
  }
  const t = getItemTemplate(templateId);
  if (t.maxStack <= 1) {
    if (
      t.kind === "weapon" ||
      t.kind === "equipment" ||
      t.kind === "mount" ||
      t.kind === "boat" ||
      t.kind === "tool" ||
      t.kind === "relic" ||
      t.kind === "back"
    ) {
      return true;
    }
  }
  // Bound mission tools / one-off placeables that must not stack
  if (templateId.startsWith("tool_") || /_tool_/.test(templateId)) return true;
  return false;
}
