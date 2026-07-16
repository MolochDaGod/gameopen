import { asset, resolveIconUrl } from "./assets";
import type { SkillKind, WeaponId } from "./types";

/**
 * Registry for the framed RPG icon set sliced from the two source spritesheets
 * into public/icons/<name>.png. Names mirror the original sheet labels.
 * Missing icons fall through fleet R2 (`assets.grudge-studio.com/icons/`) and
 * ObjectStore registry via {@link resolveIconUrl}.
 */
export const UI_ICONS = [
  "animator", "skill-vfx-lab", "parkour", "physics", "foot-planting",
  "anim-test", "gear-trial", "camera", "ai-worker", "movement-pad",
  "action-bar", "hud-settings", "building-kit", "weapon-mesh", "animation-editor",
  "vfx-editor", "draggable-dock", "resizable-panel", "skill-slot", "combat-pad",
  "loadout-card", "world-editor", "clip-library", "asset-manager", "scriptable-skills",
] as const;

export const ACTION_ICONS = [
  "attack", "move", "stop", "patrol", "hold",
  "build", "inventory", "defend", "retreat", "charge",
  "guard", "explore", "harvest", "trade", "repair",
  "scout", "ambush", "siege", "rally", "disband",
  "loot", "equip", "unequip", "rest", "pray",
] as const;

export type IconName = (typeof UI_ICONS)[number] | (typeof ACTION_ICONS)[number];

/** Sync same-origin icon URL (fast path for <img>). */
export function iconUrl(name: IconName | string): string {
  return asset(`icons/${name}.png`);
}

/** Async multi-host icon resolve (R2 + ObjectStore registry). */
export async function iconUrlLive(name: IconName | string): Promise<string> {
  return resolveIconUrl(String(name));
}

/** Each weapon gets a thematically matched action icon. */
export const WEAPON_ICON: Record<WeaponId, IconName> = {
  none: "attack",
  sword: "equip",
  gunblade: "siege",
  greatsword: "siege",
  axe: "charge",
  dagger: "ambush",
  spear: "patrol",
  hammer: "build",
  mace: "charge",
  greataxe: "siege",
  hammer2h: "build",
  bow: "scout",
  crossbow: "defend",
  staff: "skill-vfx-lab",
  staffFire: "charge",
  staffIce: "hold",
  staffStorm: "rally",
  staffNature: "harvest",
  staffHoly: "pray",
  wand: "skill-vfx-lab",
  tome: "pray",
  scythe: "ambush",
  pistol: "stop",
  rifle: "defend",
  "hunter-rifle": "scout",
  shotgun: "siege",
  javelin: "patrol",
  shield: "guard",
};

/** Skill VFX kinds map to an action icon for the HUD signature row. */
export const SKILL_KIND_ICON: Record<SkillKind, IconName> = {
  slash: "attack",
  slam: "charge",
  bolt: "scout",
  nova: "skill-vfx-lab",
  muzzle: "stop",
  thrust: "ambush",
  fireDragon: "siege",
  meteor: "charge",
  turret: "defend",
  darkBlades: "ambush",
  swordVolley: "rally",
  soul: "pray",
  laser: "scout",
};
