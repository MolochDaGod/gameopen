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

/** Parent group (Grave2) or Sketchfab child (Grave2_Graves_0). */
function findIsolateNode(scene: THREE.Object3D, name: string): THREE.Object3D | null {
  const exact = scene.getObjectByName(name);
  if (exact) return exact;
  let found: THREE.Object3D | null = null;
  const prefix = `${name}_`;
  const dot = `${name}.`;
  scene.traverse((o) => {
    if (found) return;
    if (o.name.startsWith(prefix) || o.name.startsWith(dot)) found = o;
  });
  return found;
}

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
    const isolate = binding?.isolateNode;
    let root: THREE.Object3D = scene;
    if (isolate) {
      const hit = findIsolateNode(scene, isolate);
      if (!hit) {
        console.warn("[camp] isolate miss", placeableId, isolate);
        return null;
      }
      const cloned = hit.clone(true);
      const box = new THREE.Box3().setFromObject(cloned);
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3());
        cloned.position.sub(c);
        const box2 = new THREE.Box3().setFromObject(cloned);
        if (!box2.isEmpty()) cloned.position.y -= box2.min.y;
      }
      cloned.name = isolate;
      const g = new THREE.Group();
      g.name = `placeable:${placeableId}`;
      g.add(cloned);
      root = g;
    }
    scaleLoaded(root, placeableId, opts);
    if (placeableId === "claim_flag") {
      const { applyClaimFlagMaterials, loadGuildEmblem, textureFromDataUrl } =
        await import("./claimFlagEmblem");
      const data = loadGuildEmblem("guest");
      applyClaimFlagMaterials(root, data ? textureFromDataUrl(data) : null);
    }
    return {
      scene: root,
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
