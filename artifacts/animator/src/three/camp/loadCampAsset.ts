/**
 * Canonical camp asset loader — correct importer + textures + scale.
 *
 * Always use this (or loadGltfFirst) for placeable ghosts / solids / island.
 * Do not call bare GLTFLoader without Draco/Meshopt/prep.
 */

import * as THREE from "three";
import { loadGltfFirst, loadFbxFirst, assetCandidates, asset } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  applyCanonicalScale,
  getCampAssetBinding,
  resolvePlaceableIconKeys,
  resolvePlaceableMeshKeys,
  type CampImporter,
} from "./campAssetCatalog";

export type LoadedCampMesh = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  url: string;
  placeableId: string;
  importer: CampImporter;
};

const fbxLoader = new FBXLoader();

function scaleLoaded(
  root: THREE.Object3D,
  placeableId: string,
  opts?: { meshScale?: number; targetHeightM?: number; fitHeight?: boolean },
) {
  applyCanonicalScale(
    root,
    placeableId,
    {
      meshScale: opts?.meshScale,
      targetHeightM: opts?.targetHeightM,
      fitHeight: opts?.fitHeight,
    },
    THREE,
  );
}

/**
 * Load placeable mesh with fleet multi-CDN resolve + production importers.
 * Returns null if binding is procedural or all candidates fail.
 */
export async function loadPlaceableMesh(
  placeableId: string,
  opts?: {
    fallbackMeshUrl?: string;
    meshScale?: number;
    targetHeightM?: number;
    /** When false, skip targetHeight fit (island / raw author scale). Default true. */
    fitHeight?: boolean;
    /** Skip texture prep (ghost may re-tint materials). Default false. */
    skipPrep?: boolean;
  },
): Promise<LoadedCampMesh | null> {
  const binding = getCampAssetBinding(placeableId);
  const importer: CampImporter = binding?.importer ?? "gltf";

  if (importer === "procedural") return null;

  const keys = resolvePlaceableMeshKeys(placeableId, opts?.fallbackMeshUrl);
  if (!keys.length) return null;

  if (importer === "fbx") {
    try {
      const { group, url } = await loadFbxFirst(keys, fbxLoader);
      scaleLoaded(group, placeableId, opts);
      return {
        scene: group,
        animations: [],
        url,
        placeableId,
        importer: "fbx",
      };
    } catch (err) {
      console.warn("[camp] FBX load failed", placeableId, keys, err);
      return null;
    }
  }

  // gltf (default) — Draco + Meshopt + KTX2 + prepObjectMaterials
  try {
    const { scene, animations, url } = await loadGltfFirst(keys, sharedGltfLoader(), {
      prepMaterials: opts?.skipPrep ? false : true,
    });
    scaleLoaded(scene, placeableId, opts);
    return {
      scene,
      animations: animations ?? [],
      url,
      placeableId,
      importer: "gltf",
    };
  } catch (err) {
    console.warn("[camp] GLB load failed", placeableId, keys, err);
    return null;
  }
}

/** Primary icon URL for UI (same-origin / CDN path). */
export function placeableIconUrl(
  placeableId: string,
  fallbackIcon?: string | null,
): string {
  const keys = resolvePlaceableIconKeys(placeableId, fallbackIcon || undefined);
  if (!keys.length) return asset("icons/pack/misc/Naturecircle.png");
  return asset(keys[0]!);
}

/** All candidate icon URLs (for <img onError> chains). */
export function placeableIconCandidates(
  placeableId: string,
  fallbackIcon?: string | null,
): string[] {
  const keys = resolvePlaceableIconKeys(placeableId, fallbackIcon || undefined);
  const urls: string[] = [];
  for (const k of keys) {
    for (const u of assetCandidates(k)) urls.push(u);
  }
  return [...new Set(urls)];
}

/** World terrain (small island / breeze / home concept). */
export async function loadCampWorld(
  _worldId: "small_island" | "breeze_island" = "small_island",
): Promise<LoadedCampMesh | null> {
  // Binding includes small_island → breeze-island → example_home_island fallbacks
  return loadPlaceableMesh("small_island", {
    fitHeight: false,
    meshScale: 1,
  });
}
