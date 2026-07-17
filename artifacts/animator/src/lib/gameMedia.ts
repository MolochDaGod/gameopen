/**
 * Unified game media — icons & images for HUD skills, craft mats, harvest ops,
 * codex blocks, and seed-world UI. Prefer absolute CDN, then same-origin icons.
 *
 * SSOT companions:
 *  - `three/skillIcons.ts` (weapon/skill pack art)
 *  - `three/icons.ts` (local RPG icon set)
 *  - Mine-Loader `blockIcons` (sliced block PNGs when available)
 */
import { cdnIconUrl, resolveSlotIconUrl, type SlotIconRole } from "../three/skillIcons";
import { iconUrl, type IconName } from "../three/icons";
import type { WeaponId } from "../three/types";

const CDN = "https://assets.grudge-studio.com";
const ML_BLOCKS = "https://mine-loader.vercel.app/assets/block-icons";

/** Material / bag item → icon path (R2 pack or local). */
const MAT_ICONS: Record<string, string> = {
  mat_stick: `${CDN}/icons/pack/misc/Flow.png`,
  mat_log: `${CDN}/icons/pack/misc/Slash_07.png`,
  mat_stone: `${CDN}/icons/pack/misc/Effect.png`,
  mat_coal: `${CDN}/icons/pack/misc/Chaos_2.png`,
  mat_iron_ore: `${CDN}/icons/pack/misc/Effect.png`,
  mat_herb: `${CDN}/icons/pack/misc/Slash_07.png`,
  mat_fiber: `${CDN}/icons/pack/misc/Flow.png`,
  mat_berry: `${CDN}/icons/pack/misc/Slash_07.png`,
  mat_raw_meat: `${CDN}/icons/pack/misc/Effect.png`,
  mat_leather: `${CDN}/icons/pack/misc/Flow.png`,
  mat_cloth: `${CDN}/icons/pack/misc/Flow.png`,
  mat_dirt: `${CDN}/icons/pack/misc/Slash_07.png`,
  mat_sand: `${CDN}/icons/pack/misc/Effect.png`,
  mat_clay: `${CDN}/icons/pack/misc/Effect.png`,
  mat_mushroom: `${CDN}/icons/pack/misc/Slash_07.png`,
  mat_resin: `${CDN}/icons/pack/misc/Flow.png`,
  mat_fish: `${CDN}/icons/pack/misc/Flow.png`,
  tool_pick: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  tool_axe: `${CDN}/icons/pack/weapons/Axe_01.png`,
  tool_sword: `${CDN}/icons/pack/weapons/Sword_01.png`,
  build_wall: `${CDN}/icons/pack/misc/Effect.png`,
  build_floor: `${CDN}/icons/pack/misc/Effect.png`,
};

/** Harvest op id → local icon name. */
const OP_ICONS: Record<string, IconName> = {
  gather: "harvest",
  skin: "loot",
  mine: "build",
  chop: "charge",
  dig: "build",
  forage: "harvest",
  fish: "explore",
  farm: "harvest",
  place: "build",
  wall: "build",
  floor: "build",
  demolish: "disband",
};

/** Skill tree id → accent icon. */
const TREE_ICONS: Record<string, IconName> = {
  harvest: "harvest",
  crafting: "build",
  building: "building-kit",
  survival: "rest",
  explorer: "explore",
  "weapon-combat": "combat-pad",
};

export function matIconUrl(matId: string): string {
  return MAT_ICONS[matId] || `${CDN}/icons/pack/misc/Flow.png`;
}

export function opIconName(opId: string): IconName {
  return OP_ICONS[opId] || "skill-slot";
}

export function opIconUrl(opId: string): string {
  return iconUrl(opIconName(opId));
}

export function treeIconName(treeId: string): IconName {
  return TREE_ICONS[treeId] || "skill-vfx-lab";
}

/** Block catalog id → icon (Mine-Loader public slice, then CDN fallback). */
export function blockIconUrl(blockId: string): string {
  const id = String(blockId || "stone").replace(/[^a-z0-9_-]/gi, "");
  return `${ML_BLOCKS}/${id}.png`;
}

/** Weapon skill slot media (absolute preferred). */
export function skillSlotMedia(
  role: SlotIconRole,
  weaponId: WeaponId,
  opts?: { cdnUrl?: string | null },
): { iconUrl: string; localName: string } {
  const fromSlot = resolveSlotIconUrl(role, weaponId, { cdnUrl: opts?.cdnUrl });
  const abs = cdnIconUrl(fromSlot) || fromSlot;
  return { iconUrl: abs, localName: role };
}

/** Recipe output/input chip image. */
export function recipeItemIconUrl(itemId: string): string {
  if (itemId.startsWith("mat_") || itemId.startsWith("tool_") || itemId.startsWith("build_")) {
    return matIconUrl(itemId);
  }
  if (itemId.startsWith("itm_")) return matIconUrl(itemId.replace("itm_", "mat_"));
  return matIconUrl(itemId);
}

/** Safe img onError → hide broken image (parent shows glyph fallback). */
export function hideBrokenImg(el: HTMLImageElement): void {
  el.style.visibility = "hidden";
  el.setAttribute("data-broken", "1");
}
