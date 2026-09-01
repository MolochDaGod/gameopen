/**
 * Claim-flag emblem helpers — optional guild texture on camp flags.
 * Dynamic-imported from loadCampAsset so missing textures never block boot.
 */
import * as THREE from "three";

export function loadGuildEmblem(_who: string): string | null {
  return null;
}

export function textureFromDataUrl(dataUrl: string): THREE.Texture | null {
  if (!dataUrl) return null;
  try {
    const tex = new THREE.TextureLoader().load(dataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch {
    return null;
  }
}

export function applyClaimFlagMaterials(
  root: THREE.Object3D,
  emblem: THREE.Texture | null,
): void {
  if (!emblem) return;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const n = (m.name || "").toLowerCase();
    if (!/flag|banner|emblem|cloth/.test(n)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat && "map" in mat) {
      mat.map = emblem;
      mat.needsUpdate = true;
    }
  });
}
