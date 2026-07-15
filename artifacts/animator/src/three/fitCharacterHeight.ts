/**
 * Fit a loaded character GLB/FBX to a target height without the classic 100× bug.
 *
 * Root cause of ~100× oversized heroes: world-space Box3 on a skinned mesh
 * (or a model already scaled, or cm/m unit mismatch) was used as if it were
 * a local bind-pose height. Applying `target / wrongSize` once yields ~100×.
 *
 * Rules:
 *  1. Reset uniform scale to 1 before measuring
 *  2. Prefer SkinnedMesh body bboxes only (gear/prop meshes don't warp scale)
 *  3. Snap units to nearest power-of-ten when native height is absurd
 *  4. Clamp final scale so a single bad measure can't explode the player
 *  5. Ground feet to y=0 and center XZ on hips when possible
 */
import * as THREE from "three";
import { CHARACTER_HEIGHT_M } from "./types";
import { prepObjectMaterials } from "./texturePrep";

const MIN_NATIVE_M = 0.05;
const MAX_NATIVE_M = 50;
const MAX_SCALE = 12;
const MIN_SCALE = 0.02;

export function powerOfTenToward(reference: number, current: number): number {
  if (!(reference > 0) || !(current > 0)) return 1;
  return Math.pow(10, Math.round(Math.log10(reference / current)));
}

/** World-space AABB over skinned body meshes only; fallback = full object. */
export function bodyBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let n = 0;
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh && node.visible) {
      box.expandByObject(node);
      n++;
    }
  });
  if (n === 0) box.setFromObject(root);
  return box;
}

export interface FitResult {
  scale: number;
  nativeHeight: number;
  unitFix: number;
}

/**
 * Normalize `model` in place: height ≈ targetM, feet on y=0, horizontal center
 * on hips (or bbox center). Caller parents the model.
 */
export function fitCharacterHeight(
  model: THREE.Object3D,
  targetM: number = CHARACTER_HEIGHT_M,
  authorScale = 1,
): FitResult {
  model.scale.set(1, 1, 1);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);

  const nativeHeight = bodyBox(model).getSize(new THREE.Vector3()).y || 1;

  // Decade unit fix (cm vs m etc.) so height fit stays in a sane range.
  let unitFix = 1;
  if (nativeHeight < MIN_NATIVE_M || nativeHeight > MAX_NATIVE_M) {
    unitFix = powerOfTenToward(targetM, nativeHeight);
  }

  model.scale.setScalar(unitFix);
  model.updateMatrixWorld(true);
  const midH = bodyBox(model).getSize(new THREE.Vector3()).y || targetM;
  let fit = midH > 1e-6 ? (targetM / midH) * authorScale : authorScale;
  if (!Number.isFinite(fit) || fit <= 0) fit = 1;
  fit = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));

  const finalScale = unitFix * fit;
  // Re-clamp the product so unitFix alone can't explode
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, finalScale));
  model.scale.setScalar(clamped);
  model.updateMatrixWorld(true);

  const box2 = bodyBox(model);
  const center = box2.getCenter(new THREE.Vector3());
  let hips: THREE.Bone | null = null;
  model.traverse((o) => {
    const b = o as THREE.Bone;
    if (!hips && b.isBone && /hips$/i.test(b.name)) hips = b;
  });
  const ax = new THREE.Vector3();
  if (hips) (hips as THREE.Bone).getWorldPosition(ax);
  else ax.set(center.x, 0, center.z);

  model.position.x -= ax.x;
  model.position.z -= ax.z;
  model.position.y -= box2.min.y;
  model.updateMatrixWorld(true);

  return { scale: clamped, nativeHeight, unitFix };
}

/**
 * Materials: race/hero kits often bake high metalness so meshes read as grey
 * chrome without an env map — looks "no color". Neutralise metal, keep maps,
 * and run {@link prepObjectMaterials} for colour-space + mipmap correctness.
 */
export function restoreCharacterMaterials(
  root: THREE.Object3D,
  opts?: { neutralizeMetal?: boolean },
) {
  // Shared production path: sRGB albedo, linear data maps, soft shadows, mips.
  prepObjectMaterials(root, {
    neutralizeMetal: opts?.neutralizeMetal !== false,
    receiveShadow: true,
  });
}
