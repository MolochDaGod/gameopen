/**
 * zhunbei.glb — grid-perfect placement cell frame (inner square + cardinal arrows).
 *
 * Used by BuildGridOverlay so the CampBuild ghost sits inside a snapped cell.
 * Native inner plate (zhunbei1 / zhunbei2) ≈ 3.457 m; overall with arrows ≈ 5.71 m.
 * Scale inner plate to the placeable footprint (or 1 m snap cell). Never prop-height-fit.
 */
import * as THREE from "three";

export const ZHUNBEI_MESH = "models/build/zhunbei.glb";

/** Inner zhunbei1/zhunbei2 square on the author mesh (metres, XZ after Y-up). */
export const ZHUNBEI_NATIVE_INNER_M = 3.457;

export function zhunbeiScaleForInner(targetInnerM: number, nativeInnerM = ZHUNBEI_NATIVE_INNER_M): number {
  const target = Math.max(0.25, targetInnerM);
  const native = Math.max(0.01, nativeInnerM);
  return target / native;
}

/** Full inner width from placeable half-extents. */
export function innerMFromFootprint(fp: { x: number; z: number }): number {
  return Math.max(fp.x, fp.z) * 2;
}

export function measureZhunbeiInnerM(root: THREE.Object3D): number {
  let inner = 0;
  root.traverse((o) => {
    const n = o.name.toLowerCase();
    if (!n.includes("zhunbei")) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    inner = Math.max(inner, size.x, size.z);
  });
  if (inner > 0.01) return inner;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return ZHUNBEI_NATIVE_INNER_M;
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.z);
}

/** Ground the frame and centre XZ on origin so snap pos is the cell centre. */
export function groundCenterZhunbei(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
}

/** Clone once after load so later recolors do not leak materials. */
export function tintZhunbei(root: THREE.Object3D, hex: number, opacity = 0.72): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map((mat) => {
      const src = mat as THREE.MeshStandardMaterial;
      const next = src.clone?.() ?? new THREE.MeshBasicMaterial({ color: hex });
      next.transparent = true;
      next.depthWrite = false;
      if ("opacity" in next) next.opacity = opacity;
      return next;
    }) as unknown as THREE.Material;
  });
  recolorZhunbei(root, hex);
}

export function recolorZhunbei(root: THREE.Object3D, hex: number): void {
  const color = new THREE.Color(hex);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const s = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
      if (s.color) s.color.copy(color);
      if (s.emissive) {
        s.emissive.copy(color);
        s.emissiveIntensity = 0.35;
      }
    }
  });
}
