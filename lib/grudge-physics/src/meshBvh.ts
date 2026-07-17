import * as THREE from "three";

/**
 * Optional three-mesh-bvh acceleration for dense Warlords meshes
 * (islands, dungeons, zone props). Peer-optional — no-ops if package missing.
 *
 * Install once per process:
 *   await installMeshBvh();
 *   accelerateMesh(mesh);
 */

let installed = false;

/** Patch THREE.BufferGeometry / Mesh raycast with BVH when available. */
export async function installMeshBvh(): Promise<boolean> {
  if (installed) return true;
  try {
    // Dynamic import so hosts without the peer still bundle.
    const bvh = await import("three-mesh-bvh");
    const { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } = bvh;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BG = THREE.BufferGeometry.prototype as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MP = THREE.Mesh.prototype as any;
    if (!BG.computeBoundsTree) {
      BG.computeBoundsTree = computeBoundsTree;
      BG.disposeBoundsTree = disposeBoundsTree;
      MP.raycast = acceleratedRaycast;
    }
    installed = true;
    return true;
  } catch {
    return false;
  }
}

/** Build BVH on a mesh geometry (no-op if BVH not installed). */
export function accelerateMesh(mesh: THREE.Mesh): boolean {
  const geo = mesh.geometry as THREE.BufferGeometry & {
    computeBoundsTree?: () => void;
  };
  if (typeof geo.computeBoundsTree !== "function") return false;
  try {
    geo.computeBoundsTree();
    return true;
  } catch {
    return false;
  }
}

/** Walk a root and accelerate every Mesh. */
export function accelerateObject3D(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      if (accelerateMesh(m)) n++;
    }
  });
  return n;
}

export function isMeshBvhInstalled(): boolean {
  return installed;
}
