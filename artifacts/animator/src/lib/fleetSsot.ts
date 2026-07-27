/**
 * Fleet source-of-truth map — single module for Open connections.
 *
 * Layers (do not invert):
 *  1. Player state     → Railway Postgres (characters, account, wallet, island)
 *  2. Definitions      → info.grudge-studio.com/api/v1  (catalog JSON)
 *  3. Binaries         → assets.grudge-studio.com       (R2 CDN)
 *  4. Asset index only → D1 registries (optional lookup; never player bag)
 *  5. Worlds           → Mine-Loader Railway (seed + block edits)
 *
 * Probed 2026-07-16:
 *  - objectstore.grudge-studio.com/api/v1/* catalogs → 404
 *  - info.grudge-studio.com/api/v1/* catalogs        → 200
 *  - assets.grudge-studio.com meshes/textures        → 200
 *
 * Prefer {@link contentUrl} / {@link contentCandidates} over hard-coded hosts.
 */

import { FLEET, apiUrl } from "./fleet";

/** Logical catalog names Open actually fetches. */
export const FLEET_CATALOGS = {
  races: "races.json",
  weapons: "weapons.json",
  equipment: "equipment.json",
  materials: "materials.json",
  armor: "armor.json",
  professions: "professions.json",
  masterItems: "master-items.json",
  masterRecipes: "master-recipes.json",
  masterWeaponSkills: "master-weaponSkills.json",
  grudge6GearPresets: "grudge6-gear-presets.json",
  grudge6Canonical: "grudge6-canonical.json",
  raceModelsV1: "race-models.v1.json",
  raceModels: "race-models.json",
  /** Existing fleet class / skill catalogs (character.grudge-studio.com/skills). */
  classes: "classes.json",
  classRelics: "class-relic-skillTrees.json",
  masterSkillTrees: "master-skillTrees.json",
} as const;

export type FleetCatalogKey = keyof typeof FLEET_CATALOGS;

/**
 * Ordered definition hosts. First live host wins at runtime via
 * {@link fetchCatalogJson}.
 *
 * Probed 2026-07-27:
 *  - `info…/content/*` + Open same-origin `/content/*` → 200 (gear presets, etc.)
 *  - `info…/api/v1/*` → 200 for materials/weapons; **404** for grudge6-gear-presets
 *  - `assets…/content/*` → 200 mirror for gear presets
 * Prefer `/content` before `/api/v1` so lobby does not paint a red 404 first.
 */
export function definitionBaseCandidates(): string[] {
  const env = (import.meta.env?.VITE_OBJECTSTORE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const list = [
    // Same-origin first (vercel /content rewrite + any SPA-shipped catalogs)
    origin ? `${origin}/content` : "",
    // info content mount (gear presets live here — not under /api/v1)
    "https://info.grudge-studio.com/content",
    // R2 content mirror
    "https://assets.grudge-studio.com/content",
    // Classic definitions API (materials, weapons, master-*)
    FLEET.definitions,
    origin ? `${origin}/api/v1` : "",
    origin ? `${origin}/api/objectstore/v1` : "",
    env || "",
    // Legacy public name (often 404 — last)
    FLEET.objectStoreLegacy,
  ];
  return [...new Set(list.filter(Boolean))];
}

/** Absolute URL for a catalog file under the primary definitions host. */
export function contentUrl(path: string): string {
  // Prefer content mount — gear presets and most lobby catalogs resolve here.
  return `https://info.grudge-studio.com/content/${path.replace(/^\//, "")}`;
}

/** All candidate URLs for a catalog path (for resilient fetch). */
export function contentCandidates(path: string): string[] {
  const clean = path.replace(/^\//, "");
  return definitionBaseCandidates().map((b) => `${b.replace(/\/$/, "")}/${clean}`);
}

/** Session dead catalog URLs — avoid re-probing same-origin 404s after info hits. */
const _deadCatalogUrls = new Set<string>();

/** Fetch first successful catalog JSON (CORS). */
export async function fetchCatalogJson<T = unknown>(
  pathOrKey: string | FleetCatalogKey,
  init?: RequestInit,
): Promise<T | null> {
  const path =
    pathOrKey in FLEET_CATALOGS
      ? FLEET_CATALOGS[pathOrKey as FleetCatalogKey]
      : String(pathOrKey).replace(/^\//, "");
  for (const url of contentCandidates(path)) {
    if (_deadCatalogUrls.has(url)) continue;
    try {
      const r = await fetch(url, { mode: "cors", ...init });
      if (!r.ok) {
        if (r.status === 404 || r.status === 410) _deadCatalogUrls.add(url);
        continue;
      }
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) {
        _deadCatalogUrls.add(url);
        continue;
      }
      return (await r.json()) as T;
    } catch {
      /* next host — network errors may be transient; do not mark dead */
    }
  }
  console.warn(`[fleetSsot] catalog miss: ${path}`);
  return null;
}

/** Binary CDN root (R2). */
export const BINARY_CDN = () => FLEET.assets.replace(/\/$/, "");

/** Player-state API paths (same-origin first). */
export const PLAYER_API = {
  characters: () => apiUrl("/api/characters?era=warlords"),
  charactersAll: () => apiUrl("/api/characters"),
  account: () => apiUrl("/api/account"),
  health: () => apiUrl("/api/health"),
  /** Absolute Railway for probes only — browser prefers same-origin. */
  railwayHealth: () => `${FLEET.gameData.replace(/\/$/, "")}/api/health`,
} as const;

/**
 * Human-readable SSOT table for agents/docs (keep in sync with
 * docs/CANONICAL_DATA_LAYER.md).
 */
export const SSOT_LAYERS = [
  {
    layer: "player",
    authority: "Railway Postgres (grudge-api-production)",
    examples: ["characters", "account bag", "wallet", "island state"],
    openAccess: "same-origin /api/characters|/api/account|/api/wallet",
  },
  {
    layer: "definitions",
    authority: "info.grudge-studio.com/api/v1",
    examples: ["weapons", "skills", "gear presets", "races"],
    openAccess: "contentUrl() / fetchCatalogJson() / /api/objectstore/v1/*",
  },
  {
    layer: "binaries",
    authority: "assets.grudge-studio.com (R2)",
    examples: ["grudge6 FBX/GLB", "atlases", "icons", "anims (partial)"],
    openAccess: "fleetAssetResolver + vercel rewrites",
  },
  {
    layer: "asset-index",
    authority: "D1 grudge-assets-db (registry only)",
    examples: ["asset_registry r2Key → cdnUrl"],
    openAccess: "optional; never player inventory",
  },
  {
    layer: "worlds",
    authority: "Mine-Loader Railway (1 replica)",
    examples: ["seed", "block_edits", "lobby"],
    openAccess: "/api/blocks|/api/worlds → mine-loader-api",
  },
] as const;
