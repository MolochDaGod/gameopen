/**
 * Harvest / survival tool kits — same shape as weapon skills.
 *
 * Tools are equippable in harvest mode (keys 1–8 / wheel). Each has:
 * - a primary LMB action (tool identity work)
 * - 4 skill slots (keys F is free; 1–4 when tool equipped use skill kit OR
 *   Studio maps Digit1–8 to tool select and LMB to primary)
 *
 * Mapping (user SSOT):
 * - hatchet  → woodcutting
 * - pick     → stone / ore
 * - knife    → skinning, cooking, cloth
 * - bucket   → farming after plant (water)
 * - hoe      → earth prep + planting
 * - shovel   → height / leveling earth
 * - fishing  → water fishing
 * - buildHammer → modular / RTS / defense / crafting benches
 *
 * Hand mesh: `voxelTools.ts` / toolsvoxel.glb isolate on R_hand_container.
 * Armor: Unity Player race prefabs → Toon mesh_ids (not a second body).
 */

import type { SkillKind } from "../types";

export type HarvestToolId =
  | "hatchet"
  | "pick"
  | "knife"
  | "bucket"
  | "hoe"
  | "shovel"
  | "fishingPole"
  | "buildHammer";

/** Farming / work clip keys playable via Explorer.farm or playClipOnce. */
export type HarvestClipId =
  | "harvest"
  | "water"
  | "pick"
  | "plantTree"
  | "pullPlant"
  | "slashArc"
  | "push"
  | "throw"
  | "castSpell"
  | "skill"
  | "attack1"
  | "startSwing";

export type HarvestSkillBehavior =
  | "work" // primary gather / craft gesture + VFX
  | "areaWork" // wider radius work (leveling, plant row)
  | "projectile" // cast line (fishing cast, water toss)
  | "place" // structure / bench place pulse
  | "finisher"; // heavy tool swing

export interface HarvestSkillSlot {
  label: string;
  clip: HarvestClipId | string;
  kind: SkillKind;
  behavior: HarvestSkillBehavior;
  /** Display / VFX colour. */
  color?: number;
  radius?: number;
  stamina?: number;
}

export interface HarvestToolDef {
  id: HarvestToolId;
  label: string;
  /** Short domain blurb for HUD / radial. */
  domain: string;
  color: number;
  /** LMB primary skill (always first in `skills` as well for F-skill mirror). */
  primary: HarvestSkillSlot;
  /** Four tool skills (keys 1–4 while this tool is active in harvest mode). */
  skills: [HarvestSkillSlot, HarvestSkillSlot, HarvestSkillSlot, HarvestSkillSlot];
}

export const HARVEST_TOOL_ORDER: HarvestToolId[] = [
  "hatchet",
  "pick",
  "knife",
  "bucket",
  "hoe",
  "shovel",
  "fishingPole",
  "buildHammer",
];

export const HARVEST_TOOLS: Record<HarvestToolId, HarvestToolDef> = {
  hatchet: {
    id: "hatchet",
    label: "Hatchet",
    domain: "Woods — chop trees & timber",
    color: 0xc4a060,
    primary: {
      label: "Chop Wood",
      clip: "skill",
      kind: "slash",
      behavior: "work",
      color: 0xc4a060,
    },
    skills: [
      { label: "Chop Wood", clip: "skill", kind: "slash", behavior: "work", color: 0xc4a060 },
      { label: "Felling Swing", clip: "overheadSlash", kind: "slam", behavior: "finisher", radius: 2.2 },
      { label: "Branch Clear", clip: "outsideSlash", kind: "slash", behavior: "areaWork", radius: 2.6 },
      { label: "Timber Crash", clip: "meleeComboB", kind: "nova", behavior: "finisher", radius: 2.8 },
    ],
  },
  pick: {
    id: "pick",
    label: "Pickaxe",
    domain: "Stone & ore mining",
    color: 0x9aa8b8,
    primary: {
      label: "Mine Strike",
      clip: "attack1",
      kind: "slam",
      behavior: "work",
      color: 0x9aa8b8,
    },
    skills: [
      { label: "Mine Strike", clip: "attack1", kind: "slam", behavior: "work", color: 0x9aa8b8 },
      { label: "Ore Crack", clip: "overheadSlash", kind: "slam", behavior: "finisher", radius: 2.0 },
      { label: "Vein Probe", clip: "thrustLunge", kind: "thrust", behavior: "work", radius: 1.6 },
      { label: "Quarry Blast", clip: "skill", kind: "nova", behavior: "areaWork", radius: 3.0 },
    ],
  },
  knife: {
    id: "knife",
    label: "Work Knife",
    domain: "Skinning · cooking · cloth",
    color: 0xd0d8e0,
    primary: {
      label: "Skin / Cut",
      clip: "attack1",
      kind: "slash",
      behavior: "work",
      color: 0xd0d8e0,
    },
    skills: [
      { label: "Skin Hide", clip: "attack1", kind: "slash", behavior: "work", color: 0xd0d8e0 },
      { label: "Butcher", clip: "attack2", kind: "slash", behavior: "finisher", radius: 1.8 },
      { label: "Tailor Cut", clip: "outsideSlash", kind: "slash", behavior: "work" },
      { label: "Cook Prep", clip: "pick", kind: "slash", behavior: "work", color: 0xffb080 },
    ],
  },
  bucket: {
    id: "bucket",
    label: "Water Bucket",
    domain: "Farming after plant — water crops",
    color: 0x5ec8ff,
    primary: {
      label: "Water Crops",
      clip: "water",
      kind: "bolt",
      behavior: "work",
      color: 0x5ec8ff,
    },
    skills: [
      { label: "Water Crops", clip: "water", kind: "bolt", behavior: "work", color: 0x5ec8ff },
      { label: "Splash Row", clip: "water", kind: "nova", behavior: "areaWork", radius: 3.2 },
      { label: "Fill Bucket", clip: "pullPlant", kind: "bolt", behavior: "work" },
      { label: "Drench Field", clip: "magicArea", kind: "nova", behavior: "areaWork", radius: 4.0 },
    ],
  },
  hoe: {
    id: "hoe",
    label: "Hoe",
    domain: "Earth prep & planting",
    color: 0x8bc34a,
    primary: {
      label: "Till Soil",
      clip: "harvest",
      kind: "slam",
      behavior: "work",
      color: 0x8bc34a,
    },
    skills: [
      { label: "Till Soil", clip: "harvest", kind: "slam", behavior: "work", color: 0x8bc34a },
      { label: "Plant Seeds", clip: "plantTree", kind: "nova", behavior: "place", color: 0x6dce7a },
      { label: "Furrow Row", clip: "harvest", kind: "slash", behavior: "areaWork", radius: 2.8 },
      { label: "Seedbed Finish", clip: "plantTree", kind: "nova", behavior: "finisher", radius: 2.4 },
    ],
  },
  shovel: {
    id: "shovel",
    label: "Shovel",
    domain: "Earth height · leveling",
    color: 0xb8956a,
    primary: {
      label: "Dig / Level",
      clip: "harvest",
      kind: "slam",
      behavior: "work",
      color: 0xb8956a,
    },
    skills: [
      { label: "Dig", clip: "harvest", kind: "slam", behavior: "work", color: 0xb8956a },
      { label: "Raise Earth", clip: "pullPlant", kind: "slam", behavior: "place", radius: 2.0 },
      { label: "Level Ground", clip: "pushing", kind: "slash", behavior: "areaWork", radius: 3.0 },
      { label: "Trench", clip: "overheadSlash", kind: "slam", behavior: "finisher", radius: 2.5 },
    ],
  },
  fishingPole: {
    id: "fishingPole",
    label: "Fishing Pole",
    domain: "Fish in water",
    color: 0x4fc3f7,
    primary: {
      label: "Cast Line",
      clip: "throw",
      kind: "bolt",
      behavior: "projectile",
      color: 0x4fc3f7,
    },
    skills: [
      { label: "Cast Line", clip: "throw", kind: "bolt", behavior: "projectile", color: 0x4fc3f7 },
      { label: "Reel In", clip: "pullPlant", kind: "thrust", behavior: "work" },
      { label: "Bobber Wait", clip: "water", kind: "bolt", behavior: "work" },
      { label: "Net Scoop", clip: "pick", kind: "slash", behavior: "areaWork", radius: 2.4 },
    ],
  },
  buildHammer: {
    id: "buildHammer",
    label: "Build Hammer",
    domain: "Modular · RTS · defense · benches",
    color: 0xffb74d,
    primary: {
      label: "Hammer Nail",
      clip: "start-swinging",
      kind: "slam",
      behavior: "work",
      color: 0xffb74d,
    },
    skills: [
      { label: "Hammer Nail", clip: "startSwing", kind: "slam", behavior: "work", color: 0xffb74d },
      { label: "Place Module", clip: "pushing", kind: "nova", behavior: "place", radius: 2.2 },
      { label: "Craft Bench", clip: "skill", kind: "nova", behavior: "place", radius: 2.5 },
      { label: "Fortify", clip: "overheadSlash", kind: "slam", behavior: "finisher", radius: 2.6 },
    ],
  },
};

/** Map clip aliases used above to catalog / farm verb names. */
export function resolveHarvestClip(clip: string): string {
  const map: Record<string, string> = {
    startSwing: "animations/extra/start-swinging",
    "start-swinging": "animations/extra/start-swinging",
    pushing: "animations/extra/pushing",
    push: "animations/extra/pushing",
    harvest: "harvest",
    water: "water",
    pick: "pick",
    plantTree: "plantTree",
    pullPlant: "pullPlant",
    throw: "throw",
    skill: "skill",
    attack1: "attack1",
    attack2: "attack2",
    overheadSlash: "overheadSlash",
    outsideSlash: "outsideSlash",
    meleeComboB: "meleeComboB",
    magicArea: "magicArea",
  };
  return map[clip] ?? clip;
}

export function getHarvestTool(id: HarvestToolId): HarvestToolDef {
  return HARVEST_TOOLS[id];
}

export function harvestToolList(): HarvestToolDef[] {
  return HARVEST_TOOL_ORDER.map((id) => HARVEST_TOOLS[id]);
}

export function harvestToolIndex(id: HarvestToolId): number {
  return HARVEST_TOOL_ORDER.indexOf(id);
}
