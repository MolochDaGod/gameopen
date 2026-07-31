/**
 * Toon / stepped presentation for fleet maps & props (grudge6 parity).
 */
import * as THREE from "three";

export interface ToonStyleOpts {
  outline?: boolean;
  steps?: number;
}

function toonizeMaterial(mat: THREE.Material, steps: number): THREE.Material {
  if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial) return mat;
  if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial &&
      !(mat as THREE.MeshPhongMaterial).isMeshPhongMaterial &&
      !(mat as THREE.MeshLambertMaterial).isMeshLambertMaterial &&
      !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
    return mat;
  }
  const src = mat as THREE.MeshStandardMaterial;
  const toon = new THREE.MeshToonMaterial({
    color: src.color?.clone?.() ?? new THREE.Color(0xcccccc),
    map: src.map ?? null,
    gradientMap: null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    depthWrite: src.depthWrite,
  });
  // steps reserved for future gradientMap ramp
  void steps;
  return toon;
}

/** Apply MeshToonMaterial to all meshes under root. */
export function applyToonStyle(root: THREE.Object3D, opts: ToonStyleOpts = {}): void {
  const steps = opts.steps ?? 4;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => toonizeMaterial(m, steps));
    } else if (mesh.material) {
      mesh.material = toonizeMaterial(mesh.material, steps);
    }
  });
}

/** Upgrade a loaded map scene for production toon presentation. */
export function upgradeMapPresentation(
  root: THREE.Object3D,
  opts: { toon?: boolean } = {},
): void {
  if (opts.toon !== false) applyToonStyle(root, { outline: false, steps: 4 });
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}
