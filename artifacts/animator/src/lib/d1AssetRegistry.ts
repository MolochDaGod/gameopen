/**
 * D1 asset_registry client for Open zone games.
 *
 * Live index: grudge-assets-db via asset-api Worker (api.grudge-studio.com).
 * Binaries still load from assets.grudge-studio.com / loadGltfFirst.
 *
 * D1 = metadata (r2_key, grudge_uuid, category, file_size) — never player state.
 */

/** Prefer same-origin proxy when on Open; else direct asset-api. */
export const D1_ASSET_API =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_ASSET_API_URL as string | undefined)?.replace(/\/+$/, "")) ||
  (typeof window !== "undefined" &&
  /open\.grudge-studio\.com|gameopen\.vercel\.app|localhost/i.test(window.location.hostname)
    ? "" // same-origin /api/asset-registry
    : "https://api.grudge-studio.com");

export interface D1AssetRow {
  id: string;
  name: string;
  category: string;
  r2_key: string;
  grudge_uuid?: string | null;
  file_size?: number | null;
  animation_packs?: string | null;
  /** Derived CDN URL */
  cdnUrl: string;
}

const CDN = "https://assets.grudge-studio.com";

function cdnForKey(r2Key: string): string {
  return `${CDN}/${String(r2Key).replace(/^\/+/, "")}`;
}

function normalizeRow(raw: Record<string, unknown>): D1AssetRow {
  const r2 =
    (raw.r2_key as string) ||
    (raw.r2Key as string) ||
    (raw.key as string) ||
    "";
  return {
    id: String(raw.id || r2),
    name: String(raw.name || r2.split("/").pop() || "asset"),
    category: String(raw.category || "model"),
    r2_key: r2,
    grudge_uuid: (raw.grudge_uuid as string) || (raw.grudgeUuid as string) || null,
    file_size: (raw.file_size as number) ?? (raw.fileSize as number) ?? null,
    animation_packs:
      typeof raw.animation_packs === "string"
        ? raw.animation_packs
        : raw.animation_packs
          ? JSON.stringify(raw.animation_packs)
          : null,
    cdnUrl: r2 ? cdnForKey(r2) : "",
  };
}

let cache: D1AssetRow[] | null = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

/** Fetch a page of registry assets (cached 5 min). */
export async function fetchD1Assets(opts?: {
  limit?: number;
  category?: string;
  force?: boolean;
}): Promise<D1AssetRow[]> {
  if (!opts?.force && cache && Date.now() - cacheAt < CACHE_MS) {
    if (opts?.category) return cache.filter((a) => a.category === opts.category);
    return cache;
  }
  const limit = opts?.limit ?? 100;
  const base = D1_ASSET_API || "";
  const urls = [
    base ? `${base}/assets?limit=${limit}` : `/api/asset-registry?limit=${limit}`,
    opts?.category
      ? base
        ? `${base}/assets?category=${encodeURIComponent(opts.category)}&limit=${limit}`
        : `/api/asset-registry?category=${encodeURIComponent(opts.category)}&limit=${limit}`
      : null,
    // Direct fallback if proxy missing
    `https://api.grudge-studio.com/assets?limit=${limit}`,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const r = await fetch(url, { credentials: "omit" });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        assets?: Record<string, unknown>[];
        results?: Record<string, unknown>[];
      };
      const list = j.assets || j.results || [];
      if (!Array.isArray(list) || !list.length) continue;
      cache = list.map((row) => normalizeRow(row));
      cacheAt = Date.now();
      if (opts?.category) return cache.filter((a) => a.category === opts.category);
      return cache;
    } catch {
      /* try next */
    }
  }
  return cache ?? [];
}

/** Find asset by r2 key or name substring. */
export async function findD1Asset(query: string): Promise<D1AssetRow | null> {
  const q = query.toLowerCase();
  const all = await fetchD1Assets({ limit: 200 });
  return (
    all.find((a) => a.r2_key.toLowerCase() === q || a.id.toLowerCase() === q) ||
    all.find((a) => a.r2_key.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) ||
    null
  );
}

/** Zone-relevant packs: worlds, vfx, characters, props. */
export async function assetsForZoneGame(zoneId: string): Promise<D1AssetRow[]> {
  const all = await fetchD1Assets({ limit: 200 });
  const needles: string[] = [];
  switch (zoneId) {
    case "brawler":
    case "survival":
      needles.push("arena", "agama", "vfx", "weapon");
      break;
    case "danger":
      needles.push("grudge", "weapon", "vfx", "karate");
      break;
    case "voxgrudge":
    case "minegrudge":
      needles.push("world", "nature", "pack", "voxel");
      break;
    case "racer":
      needles.push("road", "vehicle", "city");
      break;
    default:
      needles.push("vfx", "world");
  }
  return all.filter((a) =>
    needles.some(
      (n) =>
        a.category.toLowerCase().includes(n) ||
        a.r2_key.toLowerCase().includes(n) ||
        a.name.toLowerCase().includes(n),
    ),
  );
}

/** 2D impact / gore sprite keys (CDN icons — always available). */
export const GORE_IMPACT_SPRITES = {
  slash: [
    "icons/pack/misc/Slash_07.png",
    "icons/pack/misc/Effect.png",
    "icons/pack/misc/Flow.png",
  ],
  impact: ["icons/pack/misc/Effect.png", "icons/pack/misc/Slash_07.png"],
  heavy: ["icons/pack/misc/Flow.png", "icons/pack/misc/Effect.png"],
} as const;

export function goreSpriteUrl(
  kind: keyof typeof GORE_IMPACT_SPRITES = "slash",
  index = 0,
): string {
  const list = GORE_IMPACT_SPRITES[kind];
  const key = list[index % list.length]!;
  return cdnForKey(key);
}
