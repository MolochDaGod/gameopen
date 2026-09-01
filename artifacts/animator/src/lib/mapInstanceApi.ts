/**
 * REST API client for Danger / Open map instances.
 *
 * Best practice: catalog + descriptor over HTTP (same-origin), then Three.js
 * loads GLB assets only after the load screen is up. Never hot-swap meshes into
 * an incomplete chamber.
 *
 * Endpoints (prefer first that works):
 *   GET /api/maps              → list
 *   GET /api/maps/:id          → full descriptor
 *   GET /content/maps/danger-maps.json  → static SPA catalog (always on Vercel)
 */
import type { TestWorldId } from "../three/testWorlds";

export type MapInstanceDescriptor = {
  id: string;
  testWorldId?: TestWorldId | string;
  name: string;
  blurb?: string;
  kind: string;
  bake?: string;
  defaultMode?: string;
  assets: string[];
  cdnFallbacks?: string[];
  layers?: string[];
  colliders?: string[];
  features?: string[];
  stack?: string[];
  deploy?: string;
  approxMb?: number;
  /** Instance contract — exclusive full world, not a shell patch */
  instance?: {
    exclusive: boolean;
    requiresTerrain: boolean;
    requiresHeight: boolean;
    hideDangerRoomShell: boolean;
  };
};

export type MapCatalogResponse = {
  version: number;
  updated?: string;
  origin?: string;
  rest?: Record<string, string>;
  stack?: Record<string, string>;
  maps: MapInstanceDescriptor[];
  source?: string;
};

const CACHE_MS = 60_000;
let catalogCache: { at: number; data: MapCatalogResponse } | null = null;

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, {
      signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Load map catalog via REST. Static SPA path is the production SSOT on Vercel;
 * /api/maps is used when Railway/gameopen API is present.
 */
export async function fetchMapCatalog(
  signal?: AbortSignal,
): Promise<MapCatalogResponse> {
  if (catalogCache && Date.now() - catalogCache.at < CACHE_MS) {
    return catalogCache.data;
  }

  const candidates = [
    "/api/maps",
    "/api/content/maps",
    "/content/maps/danger-maps.json",
  ];

  for (const url of candidates) {
    const data = await fetchJson<MapCatalogResponse>(url, signal);
    if (data?.maps?.length) {
      const out: MapCatalogResponse = {
        ...data,
        source: url,
        maps: data.maps.map(normalizeDescriptor),
      };
      catalogCache = { at: Date.now(), data: out };
      return out;
    }
  }

  // Minimal fallback so UI still works offline
  const fallback: MapCatalogResponse = {
    version: 0,
    source: "fallback",
    maps: [
      {
        id: "danger-room",
        testWorldId: "danger-room",
        name: "Danger Room",
        kind: "combat",
        assets: [],
        instance: {
          exclusive: true,
          requiresTerrain: false,
          requiresHeight: false,
          hideDangerRoomShell: false,
        },
      },
    ],
  };
  return fallback;
}

export async function fetchMapDescriptor(
  id: string,
  signal?: AbortSignal,
): Promise<MapInstanceDescriptor | null> {
  const fromApi =
    (await fetchJson<MapInstanceDescriptor>(`/api/maps/${encodeURIComponent(id)}`, signal)) ||
    (await fetchJson<MapInstanceDescriptor>(
      `/api/content/maps/${encodeURIComponent(id)}`,
      signal,
    ));
  if (fromApi?.id) return normalizeDescriptor(fromApi);

  const cat = await fetchMapCatalog(signal);
  return cat.maps.find((m) => m.id === id || m.testWorldId === id) ?? null;
}

function normalizeDescriptor(m: MapInstanceDescriptor): MapInstanceDescriptor {
  const combat = m.kind === "combat" || m.id === "danger-room";
  return {
    ...m,
    assets: m.assets ?? [],
    instance: m.instance ?? {
      exclusive: true,
      requiresTerrain: !combat,
      requiresHeight: !combat,
      hideDangerRoomShell: !combat,
    },
  };
}

/** Map picker options for Danger UI. */
export function catalogToPickerOptions(cat: MapCatalogResponse): {
  id: string;
  name: string;
  blurb: string;
  kind: string;
}[] {
  return cat.maps.map((m) => ({
    id: String(m.testWorldId || m.id),
    name: m.name,
    blurb: m.blurb || m.kind,
    kind: m.kind,
  }));
}
