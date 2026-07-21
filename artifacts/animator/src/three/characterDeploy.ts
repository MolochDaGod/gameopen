/**
 * Character scene deployment — Three.js coordinate + scale SSOT for Open play.
 *
 * Agent SSOT skill: **grudge-character-correctness** (kill hip-float, sideways,
 * wrong texture/anim processes). Do not invent parallel deploy helpers.
 *
 * Three.js docs (r152–r185) conventions we follow:
 *  - **Y-up** world; ground is the **XZ plane** (`Object3D.up = (0,1,0)`).
 *  - **SI units**: 1 unit = 1 metre; target hero height ≈ {@link PLAYER_HEIGHT_M}.
 *  - **Art-forward = local +Z** when model yaw is 0 so Controller
 *    `forward() = (sin(yaw), 0, cos(yaw))` matches locomotion / aim.
 *  - **Feet on ground**: skinned body AABB `min.y` → offset `position.y`
 *    so soles sit on groundY (default 0). Never use pelvis origin alone.
 *  - **XZ center on hips/pelvis**: Bip001 Pelvis (or Mixamo Hips) world XZ,
 *    not full-prop bbox (asymmetric gear warps center).
 *  - **Skinned AABB**: measure **visible SkinnedMesh** only; update skeleton
 *    bind matrices before measure (`Box3.expandByObject`).
 *  - **Never** apply world-space bbox size as local scale without unit snap
 *    (classic ~100× oversized hero).
 *
 * Call order after load:
 *   1. unifySkeletons (grudge6 kits)
 *   2. fitCharacterHeight / normalizeCharacterGroup
 *   3. materials + gear visibility
 *   4. optional idle pose sample
 *   5. {@link deployCharacterModel} — final Y + XZ + optional facing
 *   6. parent under Avatar.root; Controller owns root world XZ/Y
 *
 * @see https://threejs.org/docs/#api/en/core/Object3D
 * @see https://threejs.org/docs/#api/en/math/Box3
 * @see docs/CHARACTER_MESH_DELIVERY.md
 */
import * as THREE from "three";
import { PLAYER_HEIGHT_M } from "../lib/productionRuntime";
import {
  bodyBox,
  findPelvisBone,
  fitCharacterHeight,
  type FitResult,
} from "./fitCharacterHeight";

export { findPelvisBone };

/** Controller art-forward when root.rotation.y = 0 (Three.js +Z). */
export const CHARACTER_ART_FORWARD = new THREE.Vector3(0, 0, 1);

/** Canonical fitted height (m). */
export const DEPLOY_TARGET_HEIGHT_M = PLAYER_HEIGHT_M || 1.8;

/** Gross height error triggers re-fit (× target). */
const RE_FIT_MAX_RATIO = 3;
const RE_FIT_MIN_RATIO = 0.4;

export interface DeployOpts {
  /** Target height metres (default PLAYER_HEIGHT_M). */
  targetHeightM?: number;
  /** Ground plane Y in model-local space after fit (default 0). */
  groundY?: number;
  /**
   * Face art-forward +Z.
   * - true: always apply faceYaw (default π/2 for Toon RTS FBX +X → +Z)
   * - false: never
   * - "auto": only for `userData.importPipeline === "fbx-atlas"`
   */
  facePlusZ?: boolean | "auto";
  /** Yaw (rad) when facePlusZ applies. Default π/2. */
  faceYaw?: number;
  /** Re-run height fit when measured height is absurd. Default true. */
  refitIfAbsurd?: boolean;
  /** Author scale multiplier into fitCharacterHeight. */
  authorScale?: number;
}

export interface DeployResult {
  heightM: number;
  groundDeltaY: number;
  centerDeltaX: number;
  centerDeltaZ: number;
  fit: FitResult | null;
  pelvis: THREE.Bone | null;
  facingApplied: boolean;
}

/** Force skeleton + world matrices current before any Box3 measure. */
export function prepareSkinnedMeasure(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) sk.skeleton.update();
  });
  root.updateWorldMatrix(true, true);
}

/**
 * Sit soles on groundY. Returns Δy applied.
 * Uses skinned body AABB only (wide gear must not lift the character).
 */
export function groundFeetLocal(root: THREE.Object3D, groundY = 0): number {
  prepareSkinnedMeasure(root);
  const box = bodyBox(root);
  if (!Number.isFinite(box.min.y)) return 0;
  const dy = groundY - box.min.y;
  if (Math.abs(dy) > 1e-5) {
    root.position.y += dy;
    root.updateWorldMatrix(true, true);
  }
  return dy;
}

/**
 * Center so pelvis (or body AABB center) sits on model local X=0, Z=0.
 * Same pattern as fitCharacterHeight: world pelvis − world origin → subtract from position.
 */
export function centerXZOnPelvis(
  model: THREE.Object3D,
): { dx: number; dz: number; pelvis: THREE.Bone | null } {
  prepareSkinnedMeasure(model);
  const pelvis = findPelvisBone(model);
  const ax = new THREE.Vector3();
  if (pelvis) {
    pelvis.getWorldPosition(ax);
  } else {
    bodyBox(model).getCenter(ax);
  }
  const origin = new THREE.Vector3();
  model.getWorldPosition(origin);
  const wdx = ax.x - origin.x;
  const wdz = ax.z - origin.z;
  model.position.x -= wdx;
  model.position.z -= wdz;
  model.updateWorldMatrix(true, true);
  return { dx: -wdx, dz: -wdz, pelvis };
}

/**
 * Face art-forward along local +Z (Controller convention).
 * Toon RTS FBX often faces +X in export → +π/2 yaw.
 * Idempotent when userData.artForwardSet is set.
 */
export function applyArtForwardPlusZ(
  root: THREE.Object3D,
  yaw = Math.PI / 2,
): boolean {
  if (root.userData.artForwardSet === true) return false;
  root.rotation.y = yaw;
  root.userData.artForwardSet = true;
  root.userData.artForwardYaw = yaw;
  root.updateWorldMatrix(true, true);
  return true;
}

/**
 * Full model-local deploy: height fit (if needed) → facing → XZ pelvis → feet Y.
 * Does **not** set world position (Controller / Studio owns Avatar.root).
 */
export function deployCharacterModel(
  model: THREE.Object3D,
  opts: DeployOpts = {},
): DeployResult {
  const target = opts.targetHeightM ?? DEPLOY_TARGET_HEIGHT_M;
  const groundY = opts.groundY ?? 0;
  const refit = opts.refitIfAbsurd !== false;
  let fit: FitResult | null = null;
  let facingApplied = false;

  prepareSkinnedMeasure(model);

  let h = bodyBox(model).getSize(new THREE.Vector3()).y || 0;
  const already = model.userData.grudgeHeightFit === true;
  const absurd =
    h > target * RE_FIT_MAX_RATIO || h < target * RE_FIT_MIN_RATIO || h < 0.05;
  if (!already || (refit && absurd)) {
    fit = fitCharacterHeight(model, target, opts.authorScale ?? 1);
    model.userData.grudgeHeightFit = true;
    h = bodyBox(model).getSize(new THREE.Vector3()).y || target;
  }

  const faceMode = opts.facePlusZ ?? "auto";
  if (faceMode === true) {
    facingApplied = applyArtForwardPlusZ(model, opts.faceYaw ?? Math.PI / 2);
  } else if (faceMode === "auto") {
    const pipeline = model.userData.importPipeline as string | undefined;
    if (pipeline === "fbx-atlas" && !model.userData.artForwardSet) {
      facingApplied = applyArtForwardPlusZ(model, opts.faceYaw ?? Math.PI / 2);
    }
  }

  const { dx, dz, pelvis } = centerXZOnPelvis(model);
  const groundDeltaY = groundFeetLocal(model, groundY);

  model.userData.characterDeployed = true;
  model.userData.deployHeightM = h;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if (m instanceof THREE.SkinnedMesh) m.frustumCulled = false;
  });

  return {
    heightM: h,
    groundDeltaY,
    centerDeltaX: dx,
    centerDeltaZ: dz,
    fit,
    pelvis,
    facingApplied,
  };
}

/**
 * Place Avatar.root (controller body) at world XZ + ground Y.
 * Yaw is body facing (root.rotation.y).
 */
export function placeAvatarRoot(
  root: THREE.Object3D,
  world: { x: number; y?: number; z: number },
  yawRad = 0,
): void {
  root.position.set(world.x, world.y ?? 0, world.z);
  root.rotation.y = yawRad;
  root.updateWorldMatrix(true, true);
}

/** After gear visibility toggles, re-ground feet (bbox can change). */
export function reGroundAfterEquip(model: THREE.Object3D, groundY = 0): number {
  return groundFeetLocal(model, groundY);
}

/**
 * Gross scale guard for live Avatar after spawn (BrawlerScene parity).
 * Returns true if a refit ran.
 */
export function ensureHumanScale(
  avatarRoot: THREE.Object3D,
  targetM = DEPLOY_TARGET_HEIGHT_M,
): boolean {
  prepareSkinnedMeasure(avatarRoot);
  const h = bodyBox(avatarRoot).getSize(new THREE.Vector3()).y;
  if (!(h > 0.01)) return false;

  if (h <= targetM * RE_FIT_MAX_RATIO && h >= targetM * RE_FIT_MIN_RATIO) {
    // Re-ground visual child only (Avatar.root.y is world feet for Controller)
    const child = avatarRoot.children[0];
    if (child) groundFeetLocal(child, 0);
    return false;
  }

  let model: THREE.Object3D = avatarRoot;
  if (avatarRoot.children.length >= 1) {
    let m: THREE.Object3D | null = null;
    avatarRoot.traverse((o) => {
      if (m) return;
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        let p: THREE.Object3D | null = o;
        while (p && p.parent && p.parent !== avatarRoot) p = p.parent;
        m = p;
      }
    });
    if (m) model = m;
  }
  console.warn(
    `[characterDeploy] height ${h.toFixed(2)}m off target ${targetM}m — refitting`,
  );
  fitCharacterHeight(model, targetM, 1);
  model.userData.grudgeHeightFit = true;
  deployCharacterModel(model, { facePlusZ: false, refitIfAbsurd: false });
  return true;
}

/** Validate a deployed kit is playable before unlocking input. */
export function validateCharacterDeploy(model: THREE.Object3D): {
  ok: boolean;
  issues: string[];
  heightM: number;
} {
  prepareSkinnedMeasure(model);
  const issues: string[] = [];
  let skinned = 0;
  model.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++;
  });
  if (skinned === 0) issues.push("no SkinnedMesh");
  const h = bodyBox(model).getSize(new THREE.Vector3()).y;
  if (!(h > 0.5 && h < 4)) issues.push(`height ${h.toFixed(2)}m not human-scale`);
  const box = bodyBox(model);
  if (Math.abs(box.min.y) > 0.15) {
    issues.push(`feet not grounded minY=${box.min.y.toFixed(3)}`);
  }
  const pelvis = findPelvisBone(model);
  if (!pelvis) issues.push("no pelvis/hips bone");
  return { ok: issues.length === 0, issues, heightM: h };
}
