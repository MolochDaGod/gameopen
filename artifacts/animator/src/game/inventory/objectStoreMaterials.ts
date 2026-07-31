/**
 * ObjectStore materials + icon shard prefetch for Harvest / craft UI.
 * Soft-fails when ObjectStore/info APIs are offline so Open still boots.
 */

export interface ObjectStoreMaterial {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  r2Key?: string;
}

export interface ObjectStoreMaterialsState {
  loaded: boolean;
  materials: ObjectStoreMaterial[];
  icons: Record<string, string>;
  source?: string;
  error?: string;
}

const INFO_MATERIALS =
  "https://info.grudge-studio.com/api/v1/materials";
const OBJECTSTORE_SEARCH =
  "https://objectstore.grudge-studio.com/api/v1/search?q=material&limit=64";

let cache: ObjectStoreMaterialsState | null = null;
let inflight: Promise<ObjectStoreMaterialsState> | null = null;

async function tryJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeMaterials(raw: unknown): ObjectStoreMaterial[] {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : Array.isArray((raw as { materials?: unknown[] }).materials)
        ? (raw as { materials: unknown[] }).materials
        : [];
  return arr
    .map((m) => {
      const o = m as Record<string, unknown>;
      const id = String(o.id || o.key || o.slug || o.name || "");
      if (!id) return null;
      return {
        id,
        name: String(o.name || o.title || id),
        icon: o.icon ? String(o.icon) : o.iconUrl ? String(o.iconUrl) : undefined,
        category: o.category ? String(o.category) : undefined,
        r2Key: o.r2Key ? String(o.r2Key) : o.key ? String(o.key) : undefined,
      } satisfies ObjectStoreMaterial;
    })
    .filter(Boolean) as ObjectStoreMaterial[];
}

/**
 * Prefetch materials + icon map. Safe to call repeatedly; cached after first success/fail.
 */
export async function prefetchObjectStoreMaterials(): Promise<ObjectStoreMaterialsState> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const icons: Record<string, string> = {};

    const info = await tryJson(INFO_MATERIALS);
    let materials = normalizeMaterials(info);
    let source = materials.length ? "info.grudge-studio.com" : undefined;

    if (!materials.length) {
      const os = await tryJson(OBJECTSTORE_SEARCH);
      materials = normalizeMaterials(os);
      if (materials.length) source = "objectstore.grudge-studio.com";
    }

    for (const m of materials) {
      if (m.icon) icons[m.id] = m.icon;
    }

    cache = {
      loaded: true,
      materials,
      icons,
      source: source || "empty",
      error: materials.length ? undefined : "no materials endpoint data",
    };
    inflight = null;
    return cache;
  })().catch((e) => {
    inflight = null;
    cache = {
      loaded: false,
      materials: [],
      icons: {},
      error: e instanceof Error ? e.message : String(e),
    };
    return cache;
  });

  return inflight;
}

export function getCachedObjectStoreMaterials(): ObjectStoreMaterialsState | null {
  return cache;
}
