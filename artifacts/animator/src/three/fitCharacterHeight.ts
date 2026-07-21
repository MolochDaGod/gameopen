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
/** Residual aesthetic fit only — unit decade (100×) is NOT clamped by this. */
const MAX_FIT = 12;
const MIN_FIT = 0.02;
const HUMAN_HEIGHT_M = 1.8;

export function powerOfTenToward(reference: number, current: number): number {
  if (!(reference > 0) || !(current > 0)) return 1;
  return Math.pow(10, Math.round(Math.log10(reference / current)));
}

/**
 * Find hips / pelvis for XZ centering (Y-up, XZ ground).
 * grudge6 = Bip001 Pelvis; Mixamo = mixamorigHips / Hips.
 */
export function findPelvisBone(root: THREE.Object3D): THREE.Bone | null {
  let best: THREE.Bone | null = null;
  let bestScore = -1;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (!b.isBone || !b.name) return;
    const n = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    let score = 0;
    if (n === "bip001pelvis" || n === "pelvis") score = 100;
    else if (n.endsWith("pelvis")) score = 90;
    else if (n === "mixamorighips" || n === "hips") score = 80;
    else if (n.endsWith("hips")) score = 70;
    else if (n.includes("hip") && !n.includes("thigh")) score = 40;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  });
  return best;
}

/** World-space AABB over skinned body meshes only; fallback = full object. */
export function bodyBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let n = 0;
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh && node.visible) {
      try {
        // Incomplete test/stub skins (no skinIndex) throw inside expandByObject.
        box.expandByObject(node);
        n++;
      } catch {
        try {
          if (node.geometry) {
            if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
            const gb = node.geometry.boundingBox;
            if (gb && !gb.isEmpty()) {
              const w = gb.clone().applyMatrix4(node.matrixWorld);
              box.union(w);
              n++;
            }
          }
        } catch {
          /* skip broken mesh */
        }
      }
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

  // Unit snap vs human 1.8 m — unclamped so classic 100× (cm as m) fully corrects.
  // KILL: clamping unitFix×fit to 12 (left heroes wrong and broke deploy checks).
  let unitFix = 1;
  const ratio = nativeHeight / (targetM || HUMAN_HEIGHT_M);
  if (ratio >= 70 && ratio <= 140) unitFix = 0.01;
  else if (ratio >= 1 / 140 && ratio <= 1 / 70) unitFix = 100;
  else if (ratio >= 7 && ratio <= 14) unitFix = 0.1;
  else if (ratio >= 1 / 14 && ratio <= 1 / 7) unitFix = 10;
  else if (nativeHeight < MIN_NATIVE_M || nativeHeight > MAX_NATIVE_M) {
    unitFix = powerOfTenToward(targetM, nativeHeight);
  } else if (nativeHeight > 15 && nativeHeight < 500) {
    unitFix = 0.01; // absolute cm band (e.g. 180)
  }

  model.scale.setScalar(unitFix);
  model.updateMatrixWorld(true);
  const midH = bodyBox(model).getSize(new THREE.Vector3()).y || targetM;
  let fit = midH > 1e-6 ? (targetM / midH) * authorScale : authorScale;
  if (!Number.isFinite(fit) || fit <= 0) fit = 1;
  fit = Math.min(MAX_FIT, Math.max(MIN_FIT, fit));

  const finalScale = unitFix * fit;
  model.scale.setScalar(finalScale);
  model.updateMatrixWorld(true);
  model.userData.grudgeUnitFix = unitFix;
  model.userData.grudgeNativeHeight = nativeHeight;

  const box2 = bodyBox(model);
  const center = box2.getCenter(new THREE.Vector3());
  // grudge6 = Bip001 Pelvis; Mixamo = Hips — not only /hips$/i
  const hips = findPelvisBone(model);
  const ax = new THREE.Vector3();
  if (hips) {
    hips.getWorldPosition(ax);
  } else {
    ax.set(center.x, 0, center.z);
  }

  // World-space pelvis/center → model.position (Y-up, XZ ground plane)
  const origin = new THREE.Vector3();
  model.getWorldPosition(origin);
  model.position.x -= ax.x - origin.x;
  model.position.z -= ax.z - origin.z;
  // Re-measure after XZ so foot ground is correct
  model.updateMatrixWorld(true);
  const box3 = bodyBox(model);
  model.position.y -= box3.min.y;
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
