/**
 * Three.js map instance — one exclusive world at a time.
 *
 * Best practices (threejs-skills / WebGL Insights):
 *  - Own a root Group; never leak meshes into the ambient scene without dispose
 *  - Dispose geometries/materials/textures when leaving the instance
 *  - Progress callbacks for load screens (no second WebGL context)
 *  - Ready only when terrain / height / shell contract is satisfied
 *
 * Studio uses ForestWorld for outdoor content; this type is the contract for
 * REST-driven instance switching + load UX.
 */
import * as THREE from "three";
import type { MapInstanceDescriptor } from "../../lib/mapInstanceApi";

export type MapLoadStage =
  | "rest_catalog"
  | "rest_descriptor"
  | "dispose_prev"
  | "load_assets"
  | "build_colliders"
  | "wire_layers"
  | "activate"
  | "ready"
  | "failed";

export type MapLoadProgress = {
  stage: MapLoadStage | string;
  progress: number;
  mapId: string;
  detail?: string;
};

export type MapInstanceReady = {
  id: string;
  group: THREE.Group;
  descriptor: MapInstanceDescriptor;
  /** Feet height sampler (SI metres). */
  groundHeightAt: ((x: number, z: number) => number | null) | null;
  groundMeshes: THREE.Mesh[];
  waterBand: { top: number; bottom: number } | null;
  boundHalf: number;
  hideDangerRoomShell: boolean;
};

/**
 * Dispose a Three.js subgraph (geometry + material + texture).
 * Safe for shared materials if `sharedMaterials` is true (skip dispose).
 */
export function disposeObject3D(
  root: THREE.Object3D,
  opts?: { sharedMaterials?: boolean },
): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose?.();
      if (!opts?.sharedMaterials) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose?.();
          std.normalMap?.dispose?.();
          std.emissiveMap?.dispose?.();
          std.roughnessMap?.dispose?.();
          std.metalnessMap?.dispose?.();
          m.dispose?.();
        }
      }
    }
  });
  if (root.parent) root.parent.remove(root);
}

/** Build LoadingManager-style progress (0..1) for multi-URL GLB loads. */
export function createLoadProgressReporter(
  mapId: string,
  onProgress: (p: MapLoadProgress) => void,
): {
  manager: THREE.LoadingManager;
  setStage: (stage: MapLoadStage, progress: number, detail?: string) => void;
} {
  const setStage = (stage: MapLoadStage, progress: number, detail?: string) => {
    onProgress({
      stage,
      progress: Math.max(0, Math.min(1, progress)),
      mapId,
      detail,
    });
  };

  const manager = new THREE.LoadingManager();
  manager.onStart = () => setStage("load_assets", 0.2);
  manager.onProgress = (_url, loaded, total) => {
    const t = total > 0 ? loaded / total : 0.5;
    setStage("load_assets", 0.2 + t * 0.45, `${loaded}/${total}`);
  };
  manager.onLoad = () => setStage("build_colliders", 0.7);
  manager.onError = (url) =>
    setStage("failed", 1, `asset error ${url}`);

  return { manager, setStage };
}
