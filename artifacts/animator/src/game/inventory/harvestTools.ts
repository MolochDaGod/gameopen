/**
 * Harvest / profession tools — one-time craft, power scales with profession level.
 *
 * Rules (product):
 *  - Each tool is crafted **once** per character (not consumable).
 *  - Effective tool level = max(1, character profession level for that tool’s profession).
 *  - No separate tool XP; profession XP (logging/mining/…) is the SSOT.
 *  - Combat loadout stays separate (main hand / side arm); harvest tools are harvest tab only.
 */

import { newItemInstance, type ItemInstance } from "./types";

export type ProfessionId =
  | "logging"
  | "mining"
  | "gathering"
  | "skinning"
  | "fishing"
  | "farming";

export type HarvestToolDef = {
  id: string;
  name: string;
  profession: ProfessionId;
  /** Activity tool id used by Studio radial / harvest mode */
  activityTool: string;
  description: string;
  /** Materials required for the one-time craft */
  craftCost: Array<{ templateId: string; qty: number; name: string }>;
  icon: string;
  /** Base power at profession level 1 */
  basePower: number;
  /** Extra power per profession level above 1 */
  powerPerLevel: number;
};

export const HARVEST_TOOLS: HarvestToolDef[] = [
  {
    id: "tool_hatchet",
    name: "Hatchet",
    profession: "logging",
    activityTool: "axe",
    description: "One-time craft. Logging power tracks your Forester / Logging level.",
    craftCost: [
      { templateId: "wood", qty: 12, name: "Wood" },
      { templateId: "stone", qty: 6, name: "Stone" },
    ],
    icon: "/icons/pack/weapons/Axe_01.png",
    basePower: 10,
    powerPerLevel: 2,
  },
  {
    id: "tool_pickaxe",
    name: "Pickaxe",
    profession: "mining",
    activityTool: "pick",
    description: "One-time craft. Mining power tracks Miner / Mining level.",
    craftCost: [
      { templateId: "wood", qty: 8, name: "Wood" },
      { templateId: "stone", qty: 14, name: "Stone" },
      { templateId: "ore", qty: 4, name: "Ore" },
    ],
    icon: "/icons/pack/weapons/Hammer_01.png",
    basePower: 10,
    powerPerLevel: 2,
  },
  {
    id: "tool_sickle",
    name: "Sickle",
    profession: "gathering",
    activityTool: "sickle",
    description: "One-time craft. Fiber / herb gathering tracks Gathering level.",
    craftCost: [
      { templateId: "wood", qty: 6, name: "Wood" },
      { templateId: "fiber", qty: 10, name: "Fiber" },
    ],
    icon: "/icons/pack/misc/Slash_07.png",
    basePower: 8,
    powerPerLevel: 1.5,
  },
  {
    id: "tool_skinning_knife",
    name: "Skinning Knife",
    profession: "skinning",
    activityTool: "knife",
    description: "One-time craft. Hide / meat yields track Skinning level.",
    craftCost: [
      { templateId: "wood", qty: 4, name: "Wood" },
      { templateId: "ore", qty: 3, name: "Ore" },
    ],
    icon: "/icons/pack/weapons/Dagger_01.png",
    basePower: 9,
    powerPerLevel: 1.8,
  },
  {
    id: "tool_fishing_rod",
    name: "Fishing Rod",
    profession: "fishing",
    activityTool: "rod",
    description: "One-time craft. Catch quality tracks Fishing level.",
    craftCost: [
      { templateId: "wood", qty: 10, name: "Wood" },
      { templateId: "fiber", qty: 8, name: "Fiber" },
    ],
    icon: "/icons/pack/misc/Effect.png",
    basePower: 8,
    powerPerLevel: 1.6,
  },
  {
    id: "tool_hoe",
    name: "Hoe",
    profession: "farming",
    activityTool: "hoe",
    description: "One-time craft. Crop yield tracks Farming level.",
    craftCost: [
      { templateId: "wood", qty: 8, name: "Wood" },
      { templateId: "stone", qty: 8, name: "Stone" },
    ],
    icon: "/icons/pack/weapons/Hammer_01.png",
    basePower: 8,
    powerPerLevel: 1.5,
  },
];

export type ProfessionLevels = Partial<Record<ProfessionId, number>>;

export type CraftedToolsState = {
  characterId: string;
  /** tool id → craft timestamp */
  crafted: Record<string, number>;
  /** Active harvest tool id (activity) */
  activeToolId: string | null;
  updatedAt: number;
};

const KEY = (characterId: string) => `grudge:harvest-tools:v1:${characterId || "local"}`;

export function emptyCraftedTools(characterId: string): CraftedToolsState {
  return {
    characterId: characterId || "local",
    crafted: {},
    activeToolId: null,
    updatedAt: Date.now(),
  };
}

export function loadCraftedTools(characterId: string): CraftedToolsState {
  try {
    const raw = localStorage.getItem(KEY(characterId));
    if (!raw) return emptyCraftedTools(characterId);
    const p = JSON.parse(raw) as CraftedToolsState;
    return {
      characterId: characterId || "local",
      crafted: p.crafted || {},
      activeToolId: p.activeToolId ?? null,
      updatedAt: p.updatedAt || Date.now(),
    };
  } catch {
    return emptyCraftedTools(characterId);
  }
}

export function saveCraftedTools(state: CraftedToolsState): void {
  try {
    localStorage.setItem(KEY(state.characterId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function isToolCrafted(state: CraftedToolsState, toolId: string): boolean {
  return !!state.crafted[toolId];
}

/** Profession level defaults when systems/progress not wired. */
export function defaultProfessionLevels(): ProfessionLevels {
  return {
    logging: 1,
    mining: 1,
    gathering: 1,
    skinning: 1,
    fishing: 1,
    farming: 1,
  };
}

/**
 * Map skill-tree / systems progress into profession levels.
 * Accepts loose keys (Logging, miner, prof_mining, …).
 */
export function professionLevelsFromProgress(
  raw?: Record<string, number> | null,
): ProfessionLevels {
  const out = defaultProfessionLevels();
  if (!raw) return out;
  const map: Record<string, ProfessionId> = {
    logging: "logging",
    forester: "logging",
    wood: "logging",
    mining: "mining",
    miner: "mining",
    ore: "mining",
    gathering: "gathering",
    gather: "gathering",
    herbalism: "gathering",
    skinning: "skinning",
    skin: "skinning",
    hunting: "skinning",
    fishing: "fishing",
    fish: "fishing",
    farming: "farming",
    farm: "farming",
    agriculture: "farming",
  };
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().replace(/[^a-z]/g, "");
    const id = map[key];
    if (!id) continue;
    const lv = Math.max(1, Math.min(100, Math.floor(Number(v) || 1)));
    out[id] = Math.max(out[id] || 1, lv);
  }
  return out;
}

export function toolEffectiveLevel(
  tool: HarvestToolDef,
  professions: ProfessionLevels,
): number {
  return Math.max(1, Math.min(100, Math.floor(professions[tool.profession] ?? 1)));
}

export function toolPower(tool: HarvestToolDef, professions: ProfessionLevels): number {
  const lv = toolEffectiveLevel(tool, professions);
  return Math.round(tool.basePower + tool.powerPerLevel * (lv - 1));
}

export type CraftToolResult =
  | { ok: true; state: CraftedToolsState; instance: ItemInstance }
  | { ok: false; reason: string };

/**
 * One-time craft. Caller must verify + deduct materials from bag/account.
 */
export function craftHarvestTool(
  state: CraftedToolsState,
  toolId: string,
): CraftToolResult {
  const def = HARVEST_TOOLS.find((t) => t.id === toolId);
  if (!def) return { ok: false, reason: "Unknown tool" };
  if (state.crafted[toolId]) return { ok: false, reason: "Already crafted (one-time)" };
  const next: CraftedToolsState = {
    ...state,
    crafted: { ...state.crafted, [toolId]: Date.now() },
    activeToolId: state.activeToolId || toolId,
    updatedAt: Date.now(),
  };
  saveCraftedTools(next);
  return {
    ok: true,
    state: next,
    instance: newItemInstance(toolId, 1, { bound: true }),
  };
}

export function setActiveHarvestTool(
  state: CraftedToolsState,
  toolId: string | null,
): CraftedToolsState {
  if (toolId && !state.crafted[toolId]) return state;
  const next = { ...state, activeToolId: toolId, updatedAt: Date.now() };
  saveCraftedTools(next);
  return next;
}

export function getHarvestTool(toolId: string): HarvestToolDef | undefined {
  return HARVEST_TOOLS.find((t) => t.id === toolId);
}
