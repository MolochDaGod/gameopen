/**
 * Production media resolver — icons, items, materials from fleet catalogs.
 *
 * Best practices (grudge-warlords-assets + grudge-production-wiring):
 *  1. Definitions  → info.grudge-studio.com/api/v1 (master-items, materials, weapons)
 *  2. Binaries     → assets.grudge-studio.com (R2) OR ObjectStore Pages icons
 *  3. Never invent Meshy / emoji as shipped item art when catalog has iconUrl
 *  4. Multi-host candidates; skip HTML fake-200 responses
 *  5. Same-origin local icons only as last-resort fallback
 *
 * Call {@link warmProductionMedia} once at app/shell boot (or on Account open).
 */

import { FLEET, publicUrl } from "./fleet";
import { fetchCatalogJson } from "./fleetSsot";

const CDN = FLEET.assets.replace(/\/$/, "");
const OBJECTSTORE_PAGES = "https://molochdagod.github.io/ObjectStore";

export type ProductionItem = {
  id: string;
  uuid?: string;
  name: string;
  type?: string;
  category?: string;
  tier?: number;
  iconUrl: string | null;
  modelR2Key?: string | null;
  raw: Record<string, unknown>;
};

export type ProductionMediaIndex = {
  byId: Map<string, ProductionItem>;
  byUuid: Map<string, ProductionItem>;
  byName: Map<string, ProductionItem>;
  warmedAt: number;
  itemCount: number;
};

let index: ProductionMediaIndex | null = null;
let warmPromise: Promise<ProductionMediaIndex> | null = null;

/** Known local pack fallbacks when catalog miss (Open public/icons). */
const LOCAL_FALLBACK: Record<string, string> = {
  sword: "icons/equip.png",
  axe: "icons/charge.png",
  staff: "icons/skill-vfx-lab.png",
  shield: "icons/defend.png",
  pick: "icons/build.png",
  hammer: "icons/build.png",
  bow: "icons/ranged.png",
  herb: "icons/harvest.png",
  wood: "icons/harvest.png",
  stone: "icons/build.png",
  ore: "icons/build.png",
  meat: "icons/loot.png",
  fish: "icons/explore.png",
  cloth: "icons/skill-slot.png",
  default: "icons/skill-slot.png",
};

/** Harvest mat id → production catalog id hints. */
const MAT_TO_CATALOG: Record<string, string[]> = {
  mat_stick: ["stick", "wood", "log", "mat_wood"],
  mat_log: ["log", "wood", "timber"],
  mat_stone: ["stone", "rock", "cobble"],
  mat_coal: ["coal"],
  mat_iron_ore: ["iron_ore", "iron-ore", "ore_iron", "iron"],
  mat_herb: ["herb", "plant", "leaf"],
  mat_fiber: ["fiber", "cloth", "flax"],
  mat_berry: ["berry", "fruit"],
  mat_raw_meat: ["meat", "raw_meat", "venison"],
  mat_leather: ["leather", "hide"],
  mat_cloth: ["cloth", "fabric"],
  mat_dirt: ["dirt", "soil"],
  mat_sand: ["sand"],
  mat_clay: ["clay"],
  mat_mushroom: ["mushroom", "fungus"],
  mat_resin: ["resin", "sap"],
  mat_fish: ["fish", "raw_fish"],
  tool_pick: ["pickaxe", "pick", "t0-hammer1h"],
  tool_axe: ["t0-axe1h", "axe", "hand_axe"],
  tool_sword: ["t0-sword", "sword", "training_sword"],
  build_wall: ["wall", "plank", "stone"],
  build_floor: ["floor", "plank"],
};

function asItem(raw: Record<string, unknown>): ProductionItem | null {
  const id = String(raw.id || raw.slug || raw.itemId || raw.key || "").trim();
  const uuid = raw.uuid != null ? String(raw.uuid) : undefined;
  if (!id && !uuid) return null;
  const name = String(raw.name || raw.baseName || raw.label || id || uuid || "Item");
  const iconRaw =
    raw.iconUrl ||
    raw.icon ||
    raw.iconPath ||
    raw.cdnIcon ||
    raw.image ||
    raw.thumbnail;
  return {
    id: id || uuid || name,
    uuid,
    name,
    type: raw.type != null ? String(raw.type) : undefined,
    category: raw.category != null ? String(raw.category) : undefined,
    tier: typeof raw.tier === "number" ? raw.tier : undefined,
    iconUrl: typeof iconRaw === "string" && iconRaw ? iconRaw : null,
    modelR2Key:
      raw.modelR2Key != null
        ? String(raw.modelR2Key)
        : raw.model_r2_key != null
          ? String(raw.model_r2_key)
          : raw.r2Key != null
            ? String(raw.r2Key)
            : null,
    raw,
  };
}

function normalizeItemsPayload(j: unknown): ProductionItem[] {
  if (!j) return [];
  const list: unknown[] = Array.isArray(j)
    ? j
    : Array.isArray((j as { items?: unknown[] }).items)
      ? ((j as { items: unknown[] }).items)
      : Array.isArray((j as { materials?: unknown[] }).materials)
        ? ((j as { materials: unknown[] }).materials)
        : Array.isArray((j as { weapons?: unknown[] }).weapons)
          ? ((j as { weapons: unknown[] }).weapons)
          : [];
  const out: ProductionItem[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const item = asItem(row as Record<string, unknown>);
    if (item) out.push(item);
  }
  return out;
}

function indexItems(items: ProductionItem[]): ProductionMediaIndex {
  const byId = new Map<string, ProductionItem>();
  const byUuid = new Map<string, ProductionItem>();
  const byName = new Map<string, ProductionItem>();
  for (const it of items) {
    byId.set(it.id.toLowerCase(), it);
    if (it.uuid) byUuid.set(it.uuid.toLowerCase(), it);
    byName.set(it.name.toLowerCase(), it);
    // Also index without tier prefixes
    const bare = it.id.replace(/^t\d+-/, "").toLowerCase();
    if (bare && !byId.has(bare)) byId.set(bare, it);
  }
  return {
    byId,
    byUuid,
    byName,
    warmedAt: Date.now(),
    itemCount: items.length,
  };
}

/**
 * Load master-items (+ materials merge) into memory.
 * Safe to call repeatedly; concurrent calls share one promise.
 */
export async function warmProductionMedia(force = false): Promise<ProductionMediaIndex> {
  if (index && !force && index.itemCount > 0) return index;
  if (warmPromise && !force) return warmPromise;

  warmPromise = (async () => {
    const [master, materials, weapons] = await Promise.all([
      fetchCatalogJson("masterItems"),
      fetchCatalogJson("materials"),
      fetchCatalogJson("weapons"),
    ]);
    const merged = [
      ...normalizeItemsPayload(master),
      ...normalizeItemsPayload(materials),
      ...normalizeItemsPayload(weapons),
    ];
    // Prefer first occurrence (master-items first)
    const seen = new Set<string>();
    const deduped: ProductionItem[] = [];
    for (const it of merged) {
      const k = (it.uuid || it.id).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(it);
    }
    index = indexItems(deduped);
    if (!index.itemCount) {
      console.warn(
        "[productionMedia] empty catalogs — icons will use local/CDN pack fallbacks",
      );
    } else {
      console.info(
        `[productionMedia] warmed ${index.itemCount} items from fleet definitions`,
      );
    }
    return index;
  })();

  try {
    return await warmPromise;
  } finally {
    warmPromise = null;
  }
}

export function getProductionMediaIndex(): ProductionMediaIndex | null {
  return index;
}

/** Absolute-ify icon path using production hosts. */
export function resolveProductionIconUrl(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) {
    // Prefer ObjectStore Pages for /icons/* historical paths, CDN for models
    if (s.startsWith("/icons/")) return `${OBJECTSTORE_PAGES}${s}`;
    return `${CDN}${s}`;
  }
  if (s.startsWith("icons/")) return `${OBJECTSTORE_PAGES}/${s}`;
  // Relative R2 key
  return `${CDN}/${s.replace(/^\//, "")}`;
}

/** Lookup catalog row by id / uuid / name. */
export function findProductionItem(idOrName: string): ProductionItem | null {
  if (!idOrName || !index) return null;
  const k = idOrName.toLowerCase().trim();
  return (
    index.byId.get(k) ||
    index.byUuid.get(k) ||
    index.byName.get(k) ||
    index.byId.get(k.replace(/^itm_/, "").replace(/^mat_/, "")) ||
    null
  );
}

function localFallbackFor(id: string): string {
  const lower = id.toLowerCase();
  for (const [key, path] of Object.entries(LOCAL_FALLBACK)) {
    if (key !== "default" && lower.includes(key)) return publicUrl(path);
  }
  return publicUrl(LOCAL_FALLBACK.default!);
}

/**
 * Resolve best production icon for an item/material/tool id.
 * Order: catalog iconUrl → CDN pack hint → local Open icon.
 */
export function productionItemIconUrl(itemId: string): string {
  const id = String(itemId || "").trim();
  if (!id) return localFallbackFor("default");

  // Direct catalog hit
  const hit = findProductionItem(id);
  if (hit?.iconUrl) {
    const abs = resolveProductionIconUrl(hit.iconUrl);
    if (abs) return abs;
  }

  // Harvest mat aliases
  const hints = MAT_TO_CATALOG[id] || MAT_TO_CATALOG[`mat_${id}`] || [];
  for (const h of hints) {
    const row = findProductionItem(h);
    if (row?.iconUrl) {
      const abs = resolveProductionIconUrl(row.iconUrl);
      if (abs) return abs;
    }
  }

  // Known weapon/tool pack on R2
  const packHint = packIconHint(id);
  if (packHint) return packHint;

  return localFallbackFor(id);
}

/** R2 pack paths for common tools/weapons when catalog misses. */
function packIconHint(id: string): string | null {
  const lower = id.toLowerCase();
  const pack = (rel: string) => `${CDN}/icons/pack/${rel}`;
  if (lower.includes("sword")) return pack("weapons/Sword_01.png");
  if (lower.includes("axe") || lower.includes("chop")) return pack("weapons/Axe_01.png");
  if (lower.includes("hammer") || lower.includes("pick") || lower.includes("mine"))
    return pack("weapons/Hammer_01.png");
  if (lower.includes("bow") || lower.includes("arrow")) return pack("weapons/Bow_01.png");
  if (lower.includes("staff") || lower.includes("wand")) return pack("weapons/Staff_01.png");
  if (lower.includes("shield")) return pack("weapons/Shield_01.png");
  return null;
}

/** Recipe chip helper — production catalog first. */
export function productionRecipeIconUrl(itemId: string): string {
  return productionItemIconUrl(itemId);
}

/**
 * Candidate icon URLs for progressive <img onError> fallback chains.
 * First entry is preferred production art.
 */
export function productionIconCandidates(itemId: string): string[] {
  const out: string[] = [];
  const primary = productionItemIconUrl(itemId);
  out.push(primary);
  const hit = findProductionItem(itemId);
  if (hit?.iconUrl) {
    const alt = resolveProductionIconUrl(hit.iconUrl);
    if (alt && !out.includes(alt)) out.push(alt);
  }
  const pack = packIconHint(itemId);
  if (pack && !out.includes(pack)) out.push(pack);
  const local = localFallbackFor(itemId);
  if (!out.includes(local)) out.push(local);
  return out;
}

/** Model URL when item has R2 mesh key (equipment 3D, not UI). */
export function productionModelUrl(itemId: string): string | null {
  const hit = findProductionItem(itemId);
  if (!hit?.modelR2Key) return null;
  const key = hit.modelR2Key.replace(/^\//, "");
  return `${CDN}/${key}`;
}

/** Bootstrap at shell boot — fire-and-forget. */
export function bootstrapProductionMedia(): void {
  void warmProductionMedia().catch((e) =>
    console.warn("[productionMedia] warm failed", e),
  );
}
