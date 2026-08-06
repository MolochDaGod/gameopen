/**
 * three-generator / mcp-game-asset-gen → fleet CDN catalog consumer (Open stack).
 *
 * LAB generates props (mcp-game-asset-gen / three-generator). After convert + R2
 * publish, play hosts load **only** CDN mesh URLs from this catalog.
 *
 * Primary:
 *   https://assets.grudge-studio.com/catalogs/three-generator/fleet-catalog.json
 *
 * Do NOT import mcp-game-asset-gen or three-generator runtime into the SPA —
 * those are lab/dev tools. This module is the production import surface.
 *
 * @see docs/THREE_GENERATOR_FLEET_PLACEMENT.md
 * @see docs/MCP_GAME_ASSET_GEN_FLEET.md
 */

export const FLEET_GENERATED_CATALOG_CDN =
  "https://assets.grudge-studio.com/catalogs/three-generator/fleet-catalog.json";

export type FleetCatalogAsset = {
  id: string;
  name: string;
  meshUrl: string;
  colliderUrl?: string;
  manifestUrl?: string;
  kind?: string;
  tags?: string[];
  heightM?: number;
};

export type FleetCatalog = {
  version: number;
  updatedAt: string;
  source: string;
  cdnRoot: string;
  assets: FleetCatalogAsset[];
};

/**
 * Fetch published generated-prop catalog (CDN first; optional lab override).
 */
export async function fetchGeneratedCatalog(opts?: {
  labBase?: string;
  preferLab?: boolean;
  signal?: AbortSignal;
}): Promise<FleetCatalog> {
  const urls: string[] = [];
  if (opts?.preferLab && opts.labBase) {
    urls.push(`${opts.labBase.replace(/\/$/, "")}/api/catalog`);
  }
  urls.push(FLEET_GENERATED_CATALOG_CDN);
  if (opts?.labBase && !opts.preferLab) {
    urls.push(`${opts.labBase.replace(/\/$/, "")}/api/catalog`);
  }

  let lastErr: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: "cors", signal: opts?.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const json = (await res.json()) as FleetCatalog;
      if (!json?.assets) throw new Error(`invalid catalog ${url}`);
      return json;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("generated fleet catalog fetch failed");
}

export function findAssetByName(
  catalog: FleetCatalog,
  name: string,
): FleetCatalogAsset | null {
  const n = name.toLowerCase();
  return (
    catalog.assets.find((a) => a.name.toLowerCase() === n) ||
    catalog.assets.find((a) => a.name.toLowerCase().includes(n)) ||
    null
  );
}

/** Assets tagged for outdoor / Danger prop drops (SI heightM when present). */
export function outdoorGeneratedProps(catalog: FleetCatalog): FleetCatalogAsset[] {
  return catalog.assets.filter(
    (a) =>
      a.kind === "prop" ||
      a.tags?.some((t) => /prop|outdoor|generated|three-generator/i.test(t)),
  );
}
