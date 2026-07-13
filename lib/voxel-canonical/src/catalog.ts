import type { CatalogBlock, CatalogResponse } from "./types";
import { catalogTypeId, parseCssColor } from "./terrain";

/** Primary live Codex host (Voxel Realms / mine-loader). */
export const MINE_LOADER_ORIGIN = "https://mine-loader.replit.app";

/** Preferred same-origin path (Vercel rewrite / Railway proxy). */
export const BLOCKS_API_PATH = "/api/blocks";

const DEFAULT_FETCH_URLS = [
  BLOCKS_API_PATH,
  `${MINE_LOADER_ORIGIN}/api/blocks`,
] as const;

let cache: CatalogResponse | null = null;
let inflight: Promise<CatalogResponse> | null = null;

/**
 * Load the RPG block catalog (250 defs). Tries same-origin proxy first, then
 * mine-loader directly. Results are memoized for the page lifetime.
 */
export async function fetchBlockCatalog(
  opts: { force?: boolean; urls?: string[]; signal?: AbortSignal } = {},
): Promise<CatalogResponse> {
  if (!opts.force && cache) return cache;
  if (!opts.force && inflight) return inflight;

  const urls = opts.urls ?? [...DEFAULT_FETCH_URLS];
  inflight = (async () => {
    let lastErr: unknown;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          signal: opts.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const data = (await res.json()) as CatalogResponse;
        if (!data || !Array.isArray(data.blocks)) {
          throw new Error(`Invalid catalog payload from ${url}`);
        }
        cache = data;
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function getCachedCatalog(): CatalogResponse | null {
  return cache;
}

export function clearCatalogCache(): void {
  cache = null;
}

export function findCatalogBlock(
  catalog: CatalogResponse | null | undefined,
  typeOrSlug: string,
): CatalogBlock | undefined {
  if (!catalog) return undefined;
  const slug = typeOrSlug.startsWith("cat:") ? typeOrSlug.slice(4) : typeOrSlug;
  return catalog.blocks.find((b) => b.slug === slug || b.id === slug);
}

/** Tint color for a catalog block (falls back to cyan). */
export function catalogColor(block: CatalogBlock | undefined): number {
  if (!block?.ui?.tint) return 0x38bdf8;
  return parseCssColor(block.ui.tint) ?? 0x38bdf8;
}

export function catalogCellType(block: CatalogBlock): `cat:${string}` {
  return catalogTypeId(block.slug);
}
