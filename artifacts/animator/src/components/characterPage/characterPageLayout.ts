/**
 * Character page layout scripts — XY slot grid (Minecraft inventory parity).
 *
 * All panel positions are data-driven so UI designers can tweak without
 * fighting CSS. Units = CSS grid cells (1-based) on a 12-column board.
 *
 * Fantasy-Scene-Creator / charactersgrudox: craftpix frames + Explorer avatar
 * sit in the center cell; armor / loadout / craft / bag surround it.
 */

export type SlotKind =
  | "armor"
  | "kept"
  | "bag"
  | "craft"
  | "craftResult"
  | "hotbar"
  | "avatar"
  | "label";

export type LayoutCell = {
  id: string;
  kind: SlotKind;
  /** 1-based grid column */
  x: number;
  /** 1-based grid row */
  y: number;
  /** Span columns (default 1) */
  w?: number;
  /** Span rows (default 1) */
  h?: number;
  /** Human label */
  label?: string;
  /** Maps to kept loadout / armor logical id */
  bind?: string;
  /** Bag slot index 0..n */
  bagIndex?: number;
  /** Craft grid index 0..3 (2×2) */
  craftIndex?: number;
};

/** Minecraft-inspired inventory board (12 × 10 cells). */
export const CHARACTER_PAGE_GRID = {
  cols: 12,
  rows: 10,
  cellPx: 52,
  gapPx: 6,
} as const;

/**
 * Default layout script — single source for the Explorer character page.
 * Edit this array (or load JSON later) to move slots without code forks.
 */
export const DEFAULT_CHARACTER_LAYOUT: LayoutCell[] = [
  // Left armor column (Minecraft-style)
  { id: "armor-head", kind: "armor", x: 1, y: 1, label: "Head", bind: "head" },
  { id: "armor-chest", kind: "armor", x: 1, y: 2, label: "Chest", bind: "chest" },
  { id: "armor-legs", kind: "armor", x: 1, y: 3, label: "Legs", bind: "legs" },
  { id: "armor-feet", kind: "armor", x: 1, y: 4, label: "Feet", bind: "feet" },

  // Center avatar stage (Explorer + Avatar Edit head)
  { id: "avatar", kind: "avatar", x: 3, y: 1, w: 4, h: 4, label: "Explorer" },

  // Right kept loadout (2×2 + accessory)
  { id: "kept-main", kind: "kept", x: 8, y: 1, label: "Main", bind: "mainHand" },
  { id: "kept-side", kind: "kept", x: 9, y: 1, label: "Side", bind: "sideArm" },
  { id: "kept-mount", kind: "kept", x: 8, y: 2, label: "Mount", bind: "mount" },
  { id: "kept-boat", kind: "kept", x: 9, y: 2, label: "Boat", bind: "boat" },
  { id: "armor-acc", kind: "armor", x: 8, y: 3, label: "Acc", bind: "accessory" },
  { id: "armor-tool", kind: "armor", x: 9, y: 3, label: "Tool", bind: "tool" },

  // Crafting 2×2 (Minecraft upper-right style)
  { id: "craft-0", kind: "craft", x: 11, y: 1, craftIndex: 0, label: "C1" },
  { id: "craft-1", kind: "craft", x: 12, y: 1, craftIndex: 1, label: "C2" },
  { id: "craft-2", kind: "craft", x: 11, y: 2, craftIndex: 2, label: "C3" },
  { id: "craft-3", kind: "craft", x: 12, y: 2, craftIndex: 3, label: "C4" },
  { id: "craft-out", kind: "craftResult", x: 12, y: 3, label: "Out" },

  // Section label row
  { id: "lbl-bag", kind: "label", x: 1, y: 6, w: 9, label: "Carry bag · drops on death" },
  { id: "lbl-kept", kind: "label", x: 10, y: 6, w: 3, label: "Kept" },

  // Bag 3×3 (indices 0–8)
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `bag-${i}`,
    kind: "bag" as const,
    x: 1 + (i % 3),
    y: 7 + Math.floor(i / 3),
    bagIndex: i,
    label: `${i + 1}`,
  })),

  // Hotbar 9 slots (map to bag 0–8 for display parity; UX: first row of bag)
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `hot-${i}`,
    kind: "hotbar" as const,
    x: 1 + i,
    y: 10,
    bagIndex: i,
    label: String(i + 1),
  })),
];

/** CSS grid placement for a layout cell (no React import). */
export function cellGridStyle(cell: LayoutCell): {
  gridColumn: string;
  gridRow: string;
} {
  return {
    gridColumn: `${cell.x} / span ${cell.w ?? 1}`,
    gridRow: `${cell.y} / span ${cell.h ?? 1}`,
  };
}

/** Load optional override from localStorage (designer scripting hook). */
export function loadLayoutScript(): LayoutCell[] {
  try {
    const raw = localStorage.getItem("gw_character_page_layout_v1");
    if (!raw) return DEFAULT_CHARACTER_LAYOUT;
    const parsed = JSON.parse(raw) as LayoutCell[];
    if (!Array.isArray(parsed) || parsed.length < 8) return DEFAULT_CHARACTER_LAYOUT;
    return parsed;
  } catch {
    return DEFAULT_CHARACTER_LAYOUT;
  }
}

export function saveLayoutScript(cells: LayoutCell[]): void {
  try {
    localStorage.setItem("gw_character_page_layout_v1", JSON.stringify(cells));
  } catch {
    /* ignore */
  }
}
