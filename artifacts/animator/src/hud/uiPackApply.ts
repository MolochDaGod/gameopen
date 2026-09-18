/**
 * Apply a ui.grudge-studio.com HYDRA game-ui pack onto Open HUD (viewGrid + hudConfig).
 * Does not invent a second HUD — maps pack comps onto existing HudPanelId slots.
 */

import {
  clampPanel,
  defaultHudConfig,
  HUD_PANEL_IDS,
  loadHudConfig,
  saveHudConfig,
  type HudConfig,
  type HudPanelId,
  type PanelLayout,
} from "./hudConfig";
import { parseUiKitExport } from "./uikitImport";
import { HUD_VIEWS, PANEL_HYDRA, type HydraType } from "./viewGrid";

export const UI_PACK_ORIGIN = "https://ui.grudge-studio.com";
export const UI_LAST_PACK_KEY = "grudge.open.uiPack";

const TYPE_ALIASES: Record<string, HydraType> = {
  hotbar: "hotbar-2row",
  "hotbar-2row": "hotbar-2row",
  "player-frame": "player-frame",
  "target-frame": "target-frame",
  minimap: "minimap",
  "weapon-selector": "weapon-selector",
  "alert-banner": "alert-banner",
  objectives: "objectives",
  crosshair: "crosshair",
  "action-orb": "action-orb",
  "health-orb": "health-orb",
  "mana-orb": "mana-orb",
  "interaction-prompt": "interaction-prompt",
  "chat-window": "chat-window",
  "dialogue-box": "dialogue-box",
  "skill-tree": "skill-tree",
};

export type HydraComp = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  groups?: string[];
};

export type HydraPack = {
  id?: string;
  name?: string;
  theme?: unknown;
  comps?: HydraComp[];
  components?: HydraComp[];
  baseVars?: unknown;
  overrides?: unknown;
  meta?: { inputProfile?: string };
};

export type UiPackApplyResult = {
  ok: boolean;
  packId: string;
  notes: string[];
  config: HudConfig;
  moved: HudPanelId[];
};

function hydraOf(type: string | undefined): HydraType | null {
  if (!type) return null;
  return TYPE_ALIASES[type.toLowerCase().trim()] ?? null;
}

function panelForHydra(hydra: HydraType, layout: HudConfig["layout"]): HudPanelId | null {
  if (hydra === "hotbar-2row") return layout === "tight" ? "tightbar" : "actionbar";
  for (const id of HUD_PANEL_IDS) {
    if (PANEL_HYDRA[id] === hydra) return id;
  }
  return null;
}

function defaultBox(hydra: HydraType): { x: number; y: number; w: number; h: number } | null {
  const v = HUD_VIEWS.find((x) => x.hydra === hydra && x.box);
  return v?.box ?? null;
}

/** Map pack comps → panel dx/dy/scale relative to HYDRA 1920×1080 viewGrid boxes. */
export function layoutFromHydraPack(
  pack: HydraPack,
  base: HudConfig = defaultHudConfig(),
): { panels: HudConfig["panels"]; moved: HudPanelId[]; notes: string[] } {
  const notes: string[] = [];
  const moved: HudPanelId[] = [];
  const panels = { ...base.panels };
  const comps = pack.comps ?? pack.components ?? [];
  if (!comps.length) {
    notes.push("Pack has no comps — layout unchanged.");
    return { panels, moved, notes };
  }

  const used = new Set<HudPanelId>();
  for (const c of comps) {
    const hydra = hydraOf(c.type);
    if (!hydra) continue;
    const panel = panelForHydra(hydra, base.layout);
    if (!panel || used.has(panel)) continue;
    const box = defaultBox(hydra);
    if (!box || typeof c.x !== "number" || typeof c.y !== "number") continue;
    const dx = Math.round(c.x - box.x);
    const dy = Math.round(c.y - box.y);
    const scale =
      typeof c.w === "number" && box.w > 0
        ? Math.min(2, Math.max(0.5, c.w / box.w))
        : 1;
    const next: PanelLayout = clampPanel({ dx, dy, scale, hidden: false });
    panels[panel] = next;
    used.add(panel);
    moved.push(panel);
  }
  notes.push(
    moved.length
      ? `Moved ${moved.length} HUD panel${moved.length === 1 ? "" : "s"} from HYDRA pack.`
      : "No HUD panels mapped from pack comps.",
  );
  return { panels, moved, notes };
}

export function applyHydraPackToHud(pack: HydraPack): UiPackApplyResult {
  const packId = String(pack.id || pack.name || "pack");
  const notes: string[] = [];
  const current = loadHudConfig();
  const kit = parseUiKitExport(pack);
  notes.push(...kit.notes);
  const { panels, moved, notes: layoutNotes } = layoutFromHydraPack(pack, current);
  notes.push(...layoutNotes);
  const next: HudConfig = {
    ...current,
    theme: kit.theme ?? current.theme,
    appearance: { ...current.appearance, ...kit.appearance },
    panels,
  };
  saveHudConfig(next);
  try {
    localStorage.setItem(UI_LAST_PACK_KEY, packId);
  } catch {
    /* */
  }
  return {
    ok: moved.length > 0 || kit.theme != null || Object.keys(kit.appearance).length > 0,
    packId,
    notes,
    config: next,
    moved,
  };
}

export async function fetchUiPack(packId: string): Promise<HydraPack> {
  const id = packId.replace(/[^a-z0-9-]/gi, "") || "open";
  const url = `${UI_PACK_ORIGIN}/game-ui-packs/${id}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`UI pack ${id} HTTP ${r.status}`);
  return (await r.json()) as HydraPack;
}
