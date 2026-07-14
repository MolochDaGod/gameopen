import type { TerrainBlockId, TerrainPaletteEntry } from "./types";

/**
 * Terrain + place palette aligned with Voxel Realms (mine-loader `dV` + gen types).
 * Colors approximate the procedural atlas so solid-color editors match the game.
 */
export const TERRAIN_BLOCKS: readonly TerrainPaletteEntry[] = [
  { id: "grass", name: "Grass", emoji: "🟩", color: 0x5d9e3f, css: "#5d9e3f", placeable: true, solid: true },
  { id: "dirt", name: "Dirt", emoji: "🟫", color: 0x8b5e3c, css: "#8b5e3c", placeable: true, solid: true },
  { id: "stone", name: "Stone", emoji: "🪨", color: 0x888888, css: "#888888", placeable: true, solid: true },
  { id: "sand", name: "Sand", emoji: "🟨", color: 0xc2b280, css: "#c2b280", placeable: true, solid: true },
  { id: "snow", name: "Snow", emoji: "⬜", color: 0xf0f5ff, css: "#f0f5ff", placeable: true, solid: true },
  { id: "log", name: "Wood", emoji: "🪵", color: 0x6b4423, css: "#6b4423", placeable: true, solid: true },
  { id: "woodPlanks", name: "Planks", emoji: "🟫", color: 0xc4a35a, css: "#c4a35a", placeable: true, solid: true },
  { id: "leaves", name: "Leaves", emoji: "🍃", color: 0x3d8b37, css: "#3d8b37", placeable: true, solid: true },
  { id: "brickRed", name: "Red Bricks", emoji: "🧱", color: 0xb55239, css: "#b55239", placeable: true, solid: true },
  { id: "brickGrey", name: "Stone Bricks", emoji: "🧱", color: 0x8a8a8a, css: "#8a8a8a", placeable: true, solid: true },
  { id: "brickDark", name: "Dark Bricks", emoji: "🧱", color: 0x4a4a4a, css: "#4a4a4a", placeable: true, solid: true },
  { id: "brickYellow", name: "Sandstone", emoji: "🟨", color: 0xd2b48c, css: "#d2b48c", placeable: true, solid: true },
  { id: "ice", name: "Ice", emoji: "🧊", color: 0xa5f2f3, css: "#a5f2f3", placeable: true, solid: true },
  { id: "diamond", name: "Diamond Ore", emoji: "💎", color: 0x5bdee5, css: "#5bdee5", placeable: true, solid: true },
  { id: "coal", name: "Coal Ore", emoji: "⚫", color: 0x2c2c2c, css: "#2c2c2c", placeable: true, solid: true },
  { id: "question", name: "Question", emoji: "❓", color: 0xf4c430, css: "#f4c430", placeable: true, solid: true },
  { id: "exclamation", name: "Exclamation", emoji: "❗", color: 0xe85d04, css: "#e85d04", placeable: true, solid: true },
  { id: "blockSquare", name: "Crate", emoji: "📦", color: 0xa67c52, css: "#a67c52", placeable: true, solid: true },
  { id: "blockBlank", name: "Blank", emoji: "⬜", color: 0xe8e8e8, css: "#e8e8e8", placeable: true, solid: true },
  // Gen-only
  { id: "deep", name: "Deep Stone", emoji: "⬛", color: 0x3a3a40, css: "#3a3a40", placeable: false, solid: true },
  { id: "water", name: "Water", emoji: "💧", color: 0x2e6bb2, css: "#2e6bb2", placeable: false, solid: false },
  { id: "lava", name: "Lava", emoji: "🌋", color: 0xff5a12, css: "#ff5a12", placeable: false, solid: false },
  { id: "pinelog", name: "Pine Log", emoji: "🪵", color: 0x5a3d22, css: "#5a3d22", placeable: false, solid: true },
] as const;

const BY_ID = new Map<string, TerrainPaletteEntry>(TERRAIN_BLOCKS.map((b) => [b.id, b]));

/** Placeable subset (mine-loader editor palette `dV`). */
export const PLACEABLE_TERRAIN: readonly TerrainPaletteEntry[] = TERRAIN_BLOCKS.filter((b) => b.placeable);

export const DEFAULT_BLOCK_TYPE: TerrainBlockId = "stone";

export function getTerrainBlock(id: string | undefined | null): TerrainPaletteEntry | undefined {
  if (!id) return undefined;
  // catalog:cat:slug already handled elsewhere; strip accidental prefixes
  const key = id.startsWith("cat:") ? id.slice(4) : id.includes(":") ? id.split(":").pop()! : id;
  return BY_ID.get(key) ?? BY_ID.get(id);
}

/** Resolve a solid color for any block type id (terrain or catalog tint). */
export function colorForBlockType(
  type: string | undefined | null,
  fallback = 0x888888,
  catalogTint?: string | null,
): number {
  if (catalogTint) {
    const n = parseCssColor(catalogTint);
    if (n != null) return n;
  }
  const t = getTerrainBlock(type ?? undefined);
  if (t) return t.color;
  if (type?.startsWith("cat:")) return 0x38bdf8; // default catalog cyan (mine-loader Utility tint)
  return fallback;
}

/** Nearest placeable terrain block for a free-form hex color (legacy map migration). */
export function nearestTerrainType(color: number): TerrainBlockId {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  let best: TerrainBlockId = DEFAULT_BLOCK_TYPE;
  let bestDist = Infinity;
  for (const entry of PLACEABLE_TERRAIN) {
    const er = (entry.color >> 16) & 0xff;
    const eg = (entry.color >> 8) & 0xff;
    const eb = entry.color & 0xff;
    const d = (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = entry.id;
    }
  }
  return best;
}

export function parseCssColor(css: string): number | null {
  const s = css.trim();
  if (s.startsWith("#")) {
    const h = s.slice(1);
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return (r << 16) | (g << 8) | b;
    }
    if (h.length === 6) {
      const n = parseInt(h, 16);
      return Number.isNaN(n) ? null : n;
    }
  }
  return null;
}

/** Catalog cell storage form used by mine-loader mesher. */
export function catalogTypeId(slug: string): `cat:${string}` {
  const clean = slug.replace(/^cat:/, "").trim();
  return `cat:${clean}`;
}

export function isCatalogType(type: string | null | undefined): type is `cat:${string}` {
  return !!type && type.startsWith("cat:");
}

export function catalogSlug(type: string): string | null {
  if (!type.startsWith("cat:")) return null;
  return type.slice(4);
}
