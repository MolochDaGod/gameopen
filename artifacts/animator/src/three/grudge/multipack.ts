/**
 * 30-character grudge6 multipack — SSOT for playground / battle characters.
 *
 * Source: Desktop/MouseWithoutBorders/30grudge6characters.glb (skin joints fixed).
 * Served at /models/grudge6/30grudge6characters.glb + catalog.json
 *
 * Each of the 30 ForgeScene/AuxScene children is a pre-equipped race×preset kit.
 * Load once, clone by index for every spawn.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { RaceId } from "./raceAssets";
import type { PresetId } from "./gearPresets";
import { normalizeCharacterGroup } from "./loadCharacter";
import { resolveAssetUrl } from "./assetBase";

/** Prefer CDN (R2) — pack is ~262MB, too large for Vercel static. Same-origin fallback for local. */
export function multipackUrl(): string {
  return resolveAssetUrl("/models/grudge6/30grudge6characters.glb");
}
export function multipackCatalogUrl(): string {
  // Catalog is tiny — try same-origin first, else CDN
  return "/models/grudge6/catalog.json";
}

/** @deprecated use multipackUrl() */
export const MULTIPACK_URL = "/models/grudge6/30grudge6characters.glb";
/** @deprecated use multipackCatalogUrl() */
export const MULTIPACK_CATALOG_URL = "/models/grudge6/catalog.json";

export interface MultipackCharacterEntry {
  index: number;
  raceId: RaceId | string;
  presetId: PresetId | string;
  meshNames: string[];
  matchScore?: number;
}

export interface MultipackCatalog {
  multipack: string;
  source?: string;
  count: number;
  characters: MultipackCharacterEntry[];
  byRacePreset: Record<string, number>;
}

let catalogPromise: Promise<MultipackCatalog> | null = null;
let packPromise: Promise<THREE.Object3D[]> | null = null;

export function multipackKey(raceId: string, presetId: string): string {
  return `${raceId}/${presetId}`;
}

export async function loadMultipackCatalog(): Promise<MultipackCatalog> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const urls = [
        multipackCatalogUrl(),
        resolveAssetUrl("/models/grudge6/catalog.json"),
      ];
      let lastErr: unknown;
      for (const url of urls) {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`catalog ${r.status} @ ${url}`);
          return (await r.json()) as MultipackCatalog;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr ?? new Error("catalog load failed");
    })().catch((err) => {
      catalogPromise = null;
      throw err;
    });
  }
  return catalogPromise;
}

/** Resolve AuxScene index for race+preset (falls back to race unarmed / first). */
export async function resolveMultipackIndex(
  raceId: RaceId | string,
  presetId: PresetId | string,
): Promise<number> {
  const cat = await loadMultipackCatalog();
  const exact = cat.byRacePreset[multipackKey(raceId, presetId)];
  if (typeof exact === "number") return exact;
  const unarmed = cat.byRacePreset[multipackKey(raceId, "unarmed")];
  if (typeof unarmed === "number") return unarmed;
  const any = cat.characters.find((c) => c.raceId === raceId);
  return any?.index ?? 0;
}

/**
 * Load multipack once; return array of AuxScene roots (index-aligned with catalog).
 * Uses same-origin URL so Vercel serves the fixed pack.
 */
export async function loadMultipackAuxScenes(): Promise<THREE.Object3D[]> {
  if (!packPromise) {
    packPromise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      // CDN first (production); same-origin only if present (local dist)
      const url = multipackUrl();
      console.log("[multipack] loading", url);
      loader.load(
        url,
        (gltf) => {
          try {
            let forge: THREE.Object3D | null = null;
            gltf.scene.traverse((o) => {
              if (o.name === "ForgeScene") forge = o;
            });
            if (!forge) {
              reject(new Error("[multipack] ForgeScene missing"));
              return;
            }
            const aux = (forge as THREE.Object3D).children.filter(
              (c) => c.name === "AuxScene" || c.children.length > 0,
            );
            if (aux.length < 30) {
              console.warn(
                `[multipack] expected 30 AuxScenes, got ${aux.length}`,
              );
            }
            resolve(aux);
          } catch (e) {
            reject(e);
          }
        },
        undefined,
        (err) => reject(err),
      );
    }).catch((err) => {
      packPromise = null;
      throw err;
    }) as Promise<THREE.Object3D[]>;
  }
  return packPromise;
}

export interface ClonedPackCharacter {
  group: THREE.Group;
  meshNames: string[];
  raceId: string;
  presetId: string;
  index: number;
}

/**
 * Clone one pre-equipped character from the multipack, normalized for play.
 */
export async function cloneMultipackCharacter(
  raceId: RaceId | string,
  presetId: PresetId | string,
): Promise<ClonedPackCharacter> {
  const [auxList, cat] = await Promise.all([
    loadMultipackAuxScenes(),
    loadMultipackCatalog(),
  ]);
  const index = await resolveMultipackIndex(raceId, presetId);
  const src = auxList[index];
  if (!src) {
    throw new Error(`[multipack] no AuxScene at index ${index}`);
  }

  const clone = SkeletonUtils.clone(src);
  const wrap = new THREE.Group();
  wrap.name = `grudge6_${raceId}_${presetId}`;
  wrap.add(clone);

  // Normalize for Bip001 (feet, scale, face +Z)
  normalizeCharacterGroup(wrap);

  const meshNames: string[] = [];
  wrap.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name) meshNames.push(o.name);
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const meta = cat.characters.find((c) => c.index === index);
  return {
    group: wrap,
    meshNames,
    raceId: meta?.raceId ?? String(raceId),
    presetId: meta?.presetId ?? String(presetId),
    index,
  };
}

/** Invalidate caches (hot-reload / tests). */
export function clearMultipackCache(): void {
  catalogPromise = null;
  packPromise = null;
}
