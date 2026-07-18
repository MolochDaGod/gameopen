/**
 * Built-in material + consumable templates for bag / account inventory.
 * Extends content/items when present; materials use short ids (wood, ore, …)
 * matching Railway /api/account/resources.
 */

import type { ItemTemplate } from "./types";
import { MATERIAL_STACK_MAX } from "./types";

const mat = (
  id: string,
  name: string,
  icon: string,
  tags: string[] = [],
): ItemTemplate => ({
  id,
  kind: "material",
  name,
  rarity: "common",
  maxStack: MATERIAL_STACK_MAX,
  icon,
  tags: ["harvest", ...tags],
});

/** Harvest materials — stack 100 in character bag. */
export const MATERIAL_TEMPLATES: Record<string, ItemTemplate> = {
  wood: mat("wood", "Wood", "/icons/pack/misc/Slash_07.png", ["logging"]),
  stone: mat("stone", "Stone", "/icons/pack/weapons/Hammer_01.png", ["mining"]),
  fiber: mat("fiber", "Fiber", "/icons/pack/misc/Effect.png", ["gather"]),
  ore: mat("ore", "Ore", "/icons/pack/weapons/Hammer_01.png", ["mining"]),
  meat: mat("meat", "Meat", "/icons/pack/misc/Effect.png", ["skin"]),
  hide: mat("hide", "Hide", "/icons/pack/misc/Effect.png", ["skin"]),
  planks: mat("planks", "Planks", "/icons/pack/weapons/Axe_01.png", ["craft"]),
  sticks: mat("sticks", "Sticks", "/icons/pack/misc/Slash_07.png", ["craft"]),
  stone_brick: mat("stone_brick", "Stone Brick", "/icons/pack/weapons/Hammer_01.png", ["craft"]),
  iron_ingot: mat("iron_ingot", "Iron Ingot", "/icons/pack/weapons/Hammer_01.png", ["craft"]),
  coin: mat("coin", "Coin", "/ui/craftpix/part3/resources/coin.png", ["currency"]),
  clay: mat("clay", "Clay", "/icons/pack/misc/Effect.png", ["dig"]),
  coal: mat("coal", "Coal", "/icons/pack/weapons/Hammer_01.png", ["mining"]),
};

export const CONSUMABLE_TEMPLATES: Record<string, ItemTemplate> = {
  itm_ration_01: {
    id: "itm_ration_01",
    kind: "consumable",
    name: "Field Ration",
    description: "Restore a little health.",
    rarity: "common",
    maxStack: MATERIAL_STACK_MAX,
    icon: "/icons/pack/misc/Effect.png",
    heal: 25,
    tags: ["food"],
  },
  itm_water_01: {
    id: "itm_water_01",
    kind: "consumable",
    name: "Waterskin",
    description: "Restore stamina.",
    rarity: "common",
    maxStack: MATERIAL_STACK_MAX,
    icon: "/icons/pack/misc/Effect.png",
    stamina: 30,
    tags: ["drink"],
  },
};

const CACHE: Record<string, ItemTemplate> = {
  ...MATERIAL_TEMPLATES,
  ...CONSUMABLE_TEMPLATES,
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
        : templateId.startsWith("itm_")
          ? "consumable"
          : "material",
    name: templateId.replace(/^itm_|^wpn_|^arm_/, "").replace(/_/g, " "),
    rarity: "common",
    maxStack:
      templateId.startsWith("wpn_") || templateId.startsWith("arm_")
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
