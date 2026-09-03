/**
 * Claim-flag cloth + pole materials + painted guild emblem.
 * Applies to uMMORPG Flag1.FBX bake (models/camp/claim-flag.glb).
 */
import * as THREE from "three";

const POLE = 0x3a2a18;
const CLOTH = 0xc9a24a;

export function applyClaimFlagMaterials(
  root: THREE.Object3D,
  emblemMap?: THREE.Texture | null,
) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const n = (mesh.name || o.parent?.name || "").toLowerCase();
    const pole = /pole|stick|shaft|wood|mast/.test(n);
    const mat = new THREE.MeshStandardMaterial({
      color: pole ? POLE : CLOTH,
      roughness: pole ? 0.82 : 0.62,
      metalness: pole ? 0.05 : 0.08,
      side: pole ? THREE.FrontSide : THREE.DoubleSide,
      map: pole ? null : emblemMap || null,
    });
    if (emblemMap && !pole) {
      mat.color.set(0xffffff);
      emblemMap.colorSpace = THREE.SRGBColorSpace;
      emblemMap.needsUpdate = true;
      emblemMap.flipY = false;
    }
    mesh.material = mat;
  });
}

export function textureFromDataUrl(dataUrl: string): THREE.Texture | null {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return null;
  const img = new Image();
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  img.onload = () => {
    tex.needsUpdate = true;
  };
  img.src = dataUrl;
  return tex;
}

export const EMBLEM_STORAGE_KEY = (accountId: string) =>
  `open:guildEmblem:v1:${accountId || "guest"}`;

export function loadGuildEmblem(accountId: string): string | null {
  try {
    return localStorage.getItem(EMBLEM_STORAGE_KEY(accountId));
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

export function saveGuildEmblem(accountId: string, dataUrl: string | null) {
  try {
    const k = EMBLEM_STORAGE_KEY(accountId);
    if (!dataUrl) localStorage.removeItem(k);
    else localStorage.setItem(k, dataUrl);
  } catch {
    /* quota */
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
