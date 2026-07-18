/**
 * 2×2 crafting recipes for the Explorer character page (Minecraft-style).
 * Shaped recipes: null = empty cell. Order is row-major [0,1 / 2,3].
 */

export type CraftShape = [string | null, string | null, string | null, string | null];

export type CraftRecipe = {
  id: string;
  shape: CraftShape;
  /** Allow shapeless match (same counts, any order) */
  shapeless?: boolean;
  result: { templateId: string; qty: number };
};

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "sticks",
    shape: ["wood", null, "wood", null],
    shapeless: true,
    result: { templateId: "sticks", qty: 4 },
  },
  {
    id: "planks",
    shape: ["wood", null, null, null],
    shapeless: true,
    result: { templateId: "planks", qty: 4 },
  },
  {
    id: "stone_brick",
    shape: ["stone", "stone", "stone", "stone"],
    result: { templateId: "stone_brick", qty: 4 },
  },
  {
    id: "iron_ingot",
    shape: ["ore", "coal", null, null],
    shapeless: true,
    result: { templateId: "iron_ingot", qty: 1 },
  },
  {
    id: "ration",
    shape: ["meat", "fiber", null, null],
    shapeless: true,
    result: { templateId: "itm_ration_01", qty: 2 },
  },
];

function countMap(ids: (string | null)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

/** Match craft grid (4 cells of template ids) to a recipe. */
export function matchRecipe(grid: (string | null)[]): CraftRecipe | null {
  if (grid.length !== 4) return null;
  for (const r of CRAFT_RECIPES) {
    if (r.shapeless) {
      if (mapsEqual(countMap(grid), countMap(r.shape))) return r;
    } else {
      let ok = true;
      for (let i = 0; i < 4; i++) {
        if ((grid[i] ?? null) !== (r.shape[i] ?? null)) {
          ok = false;
          break;
        }
      }
      if (ok) return r;
    }
  }
  return null;
}
