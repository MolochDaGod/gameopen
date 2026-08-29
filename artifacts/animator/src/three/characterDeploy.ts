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
  const deployed = model.userData.characterDeployed === true;
  // GUARD: NEVER call fitCharacterHeight if grudgeHeightFit=true (ingest-only SI).
  // If ingest already converted metres, skip even on first deploy. Runtime never re-fits.
  if (!already && !deployed) {
    fit = fitCharacterHeight(model, target, opts.authorScale ?? 1);
    model.userData.grudgeHeightFit = true;
    h = bodyBox(model).getSize(new THREE.Vector3()).y || target;
  }

  const faceMode = opts.facePlusZ ?? "auto";
  if (faceMode === true) {
    facingApplied = applyArtForwardPlusZ(model, opts.faceYaw ?? Math.PI / 2);
  } else if (faceMode === "auto") {
    const pipeline = model.userData.importPipeline as string | undefined;
    // FBX modular kits: always art-forward +Z (export is +X).
    // glb-baked grudge6 Characters.glb: apply when not proven +Z (convert must set
    // userData.artForwardProven=true after orient bake; otherwise need yaw).
    const needForward =
      !model.userData.artForwardSet &&
      (pipeline === "fbx-atlas" ||
        model.userData.needsArtForward === true ||
        (pipeline === "glb-baked" &&
          model.userData.artForwardProven !== true &&
          /Characters\.glb|_Characters|grudge6/i.test(
            String(model.userData.importUrl || model.name || ""),
          )));
    if (needForward) {
      facingApplied = applyArtForwardPlusZ(model, opts.faceYaw ?? Math.PI / 2);
    }
  }

  // GUARD: Skip XZ centering if already deployed (ingest-only hip placement).
  let dx = 0;
  let dz = 0;
  let pelvis: THREE.Bone | null = null;
  if (!deployed) {
    const center = centerXZOnPelvis(model);
    dx = center.dx;
    dz = center.dz;
    pelvis = center.pelvis;
  } else {
    pelvis = findPelvisBone(model);
  }
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
 * Find the skinned deploy model under an Avatar root (holder → rig → model).
 * Prefer an object already marked by deployCharacterModel / fitCharacterHeight.
 */
export function findDeployModel(avatarRoot: THREE.Object3D): THREE.Object3D | null {
  let marked: THREE.Object3D | null = null;
  let firstSkinned: THREE.Object3D | null = null;
  avatarRoot.traverse((o) => {
    if (!marked && (o.userData?.characterDeployed === true || o.userData?.grudgeHeightFit === true)) {
      // Prefer fully deployed kit over intermediate height-fit nodes
      if (o.userData?.characterDeployed === true || !marked) marked = o;
      if (o.userData?.characterDeployed === true) marked = o;
    }
    if (!firstSkinned && (o as THREE.SkinnedMesh).isSkinnedMesh) {
      firstSkinned = o;
    }
  });
  if (marked) return marked;
  if (!firstSkinned) return null;
  // Walk up from first skinned mesh to a group that is a direct-ish child of
  // avatarRoot or holder (skip the SkinnedMesh itself for scale ops).
  let p: THREE.Object3D | null = firstSkinned;
  while (p?.parent && p.parent !== avatarRoot) {
    if (
      p.userData?.importPipeline ||
      p.userData?.grudgeHeightFit ||
      p.userData?.characterDeployed
    ) {
      return p;
    }
    // Stop one level under avatarRoot (holder's child = rig/model)
    if (p.parent.parent === avatarRoot) return p;
    p = p.parent;
  }
  return p;
}

/**
 * Gross scale guard for live Avatar after spawn (BrawlerScene parity).
 * Returns true if a refit ran.
 *
 * Re-grounds the **skinned model** (not the holder wrapper). Grounding
 * `avatarRoot.children[0]` (holder) double-offset Y and pushed feet under the floor.
 *
 * GUARD: Ingest-only SI fit. If already fitted or deployed, only re-ground Y.
 */
export function ensureHumanScale(
  avatarRoot: THREE.Object3D,
  targetM = DEPLOY_TARGET_HEIGHT_M,
): boolean {
  prepareSkinnedMeasure(avatarRoot);
  const h = bodyBox(avatarRoot).getSize(new THREE.Vector3()).y;
  if (!(h > 0.01)) return false;

  const model = findDeployModel(avatarRoot) ?? avatarRoot;
  
  // GUARD: Skip re-fit if already fitted or deployed (ingest-only SI, Y-only at runtime).
  const fitted = model.userData.grudgeHeightFit === true;
  const deployed = model.userData.characterDeployed === true;
  if (fitted || deployed) {
    groundFeetLocal(model, 0);
    return false;
  }

  if (h <= targetM * RE_FIT_MAX_RATIO && h >= targetM * RE_FIT_MIN_RATIO) {
    // Uniform scale guard: non-uniform axes = "stretched" look.
    avatarRoot.traverse((o) => {
      if (o === avatarRoot) return;
      const sx = Math.abs(o.scale.x);
      const sy = Math.abs(o.scale.y);
      const sz = Math.abs(o.scale.z);
      if (sx > 1e-6 && (Math.abs(sx - sy) > 0.02 || Math.abs(sx - sz) > 0.02)) {
        const u = (sx + sy + sz) / 3;
        o.scale.set(u, u, u);
      }
    });
    // Avatar.root.y is world feet for Controller — only re-ground model-local Y.
    groundFeetLocal(model, 0);
    return false;
  }

  console.warn(
    `[characterDeploy] height ${h.toFixed(2)}m off target ${targetM}m — refitting`,
  );
  const priorForward = model.userData.artForwardSet === true;
  const priorYaw =
    typeof model.userData.artForwardYaw === "number"
      ? model.userData.artForwardYaw
      : Math.PI / 2;
  // Clear flag so re-deploy can re-apply facing after scale (do not leave sideways).
  model.userData.artForwardSet = false;
  fitCharacterHeight(model, targetM, 1);
  model.userData.grudgeHeightFit = true;
  deployCharacterModel(model, {
    facePlusZ: priorForward ? true : false,
    faceYaw: priorYaw,
    refitIfAbsurd: false,
  });
  // Uniform scale on model after refit (non-uniform = stretch)
  const sx = Math.abs(model.scale.x);
  const sy = Math.abs(model.scale.y);
  const sz = Math.abs(model.scale.z);
  if (sx > 1e-6 && (Math.abs(sx - sy) > 0.02 || Math.abs(sx - sz) > 0.02)) {
    const u = (sx + sy + sz) / 3;
    model.scale.set(u, u, u);
  }
  return true;
}

/**
 * After first idle/attack sample, re-sit soles on groundY (position tracks /
 * bind-pose drift). Safe no-op when already grounded.
 *
 * GUARD: Only adjusts model.position.y, NEVER XZ or scale.
 * Clip switch may call this; SI fit and hip XZ centering are ingest-only.
 */
export function reGroundAfterAnimSample(
  model: THREE.Object3D,
  groundY = 0,
): number {
  return groundFeetLocal(model, groundY);
}

/** Walk a remapped bone up to the scene-graph root Bone (Bip001 / Hips). */
function rootMostBone(bone: THREE.Bone): THREE.Bone {
  let last: THREE.Bone = bone;
  let n: THREE.Object3D | null = bone.parent;
  while (n) {
    if ((n as THREE.Bone).isBone) last = n as THREE.Bone;
    n = n.parent;
  }
  return last;
}

/**
 * How many disconnected *character* skeletons a kit still has.
 *
 * unifySkeletons() allocates a new THREE.Skeleton per SkinnedMesh (inverses
 * differ) but remaps bones onto the same Bip001 nodes. Helmet / weapon skins
 * often omit pelvis from their bone array — do not treat bones[0] as a kit.
 * Count unique root-most Bip001/Hips objects on **visible** skins only.
 */
export function countVisibleSkeletonRoots(model: THREE.Object3D): number {
  const roots = new Set<string>();
  model.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || sm.visible === false) return;
    const bones = sm.skeleton?.bones;
    if (!bones?.length) return;
    for (const b of bones) {
      if (!b?.name) continue;
      if (!/Bip001|mixamorig|Pelvis|^Hips$|Spine/i.test(b.name)) continue;
      roots.add(rootMostBone(b).uuid);
    }
  });
  return roots.size;
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
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || sm.visible === false) return;
    skinned++;
  });
  if (skinned === 0) issues.push("no SkinnedMesh");
  const skeletonRoots = countVisibleSkeletonRoots(model);
  // Disconnected kits = more than one Bip001/Hips *object* after unify.
  if (skeletonRoots > 1) {
    issues.push(`multiple skeletons (${skeletonRoots}) — run unifySkeletons`);
  }
  const h = bodyBox(model).getSize(new THREE.Vector3()).y;
  if (!(h > 0.5 && h < 4)) issues.push(`height ${h.toFixed(2)}m not human-scale`);
  // SI gate for heroes (stricter than 0.5–4)
  if (h > 0.5 && (h < 1.55 || h > 2.05)) {
    issues.push(`height ${h.toFixed(2)}m outside human band 1.55–2.05`);
  }
  const box = bodyBox(model);
  if (Math.abs(box.min.y) > 0.15) {
    issues.push(`feet not grounded minY=${box.min.y.toFixed(3)}`);
  }
  const pelvis = findPelvisBone(model);
  if (!pelvis) issues.push("no pelvis/hips bone");
  // Uniform scale
  const sx = Math.abs(model.scale.x);
  const sy = Math.abs(model.scale.y);
  const sz = Math.abs(model.scale.z);
  if (sx > 1e-6 && (Math.abs(sx - sy) > 0.05 || Math.abs(sx - sz) > 0.05)) {
    issues.push(`non-uniform scale (${sx.toFixed(3)},${sy.toFixed(3)},${sz.toFixed(3)})`);
  }
  return { ok: issues.length === 0, issues, heightM: h };
}

/**
 * Full visual diagnosis (grudge-character-correctness gates).
 * Call after idle sample + reGroundAfterAnimSample.
 */
export function diagnoseCharacterLook(model: THREE.Object3D): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  heightM: number;
  feetMinY: number;
  artForwardSet: boolean;
  pelvis: string | null;
  skeletonCount: number;
  pipeline: string | null;
} {
  prepareSkinnedMeasure(model);
  const v = validateCharacterDeploy(model);
  const errors = [...v.issues];
  const warnings: string[] = [];
  const box = bodyBox(model);
  const pelvis = findPelvisBone(model);
  const skeletonCount = countVisibleSkeletonRoots(model);

  const pipeline = (model.userData.importPipeline as string) || null;
  if (pipeline === "fbx-atlas" && !model.userData.artForwardSet) {
    errors.push("fbx-atlas missing art-forward +Z (sideways risk)");
  }
  if (pipeline === "glb-baked" && !model.userData.artForwardSet && !model.userData.artForwardProven) {
    warnings.push("glb-baked without artForwardProven — verify facing +Z on convert");
  }

  // Hand containers for weapon packs
  let handR = false;
  model.traverse((o) => {
    if (/R_hand_container|Bip001.*R.*Hand|mixamorigRightHand/i.test(o.name)) handR = true;
  });
  if (!handR) warnings.push("no R hand / R_hand_container found");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    heightM: v.heightM,
    feetMinY: box.min.y,
    artForwardSet: model.userData.artForwardSet === true,
    pelvis: pelvis?.name ?? null,
    skeletonCount,
    pipeline,
  };
}

/**
 * Sample a clip on a temporary mixer, re-ground feet, dispose mixer.
 * Use after loading packs so bind-pose ≠ idle pose doesn't leave floating feet.
 *
 * **Final permanent Y must be from idle (or walk), never attack** — attack poses
 * often raise feet; re-grounding them permanently sinks idle/walk soles under floor.
 */
export function sampleClipAndReground(
  model: THREE.Object3D,
  clip: THREE.AnimationClip,
  opts?: { dt?: number; groundY?: number },
): number {
  const dt = opts?.dt ?? 1 / 30;
  const groundY = opts?.groundY ?? 0;
  const mixer = new THREE.AnimationMixer(model);
  try {
    const act = mixer.clipAction(clip);
    act.play();
    mixer.update(dt);
    return reGroundAfterAnimSample(model, groundY);
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }
}

/**
 * Sample a locomotion cycle at several times; if skinned soles dip below
 * groundY, lift the model so the deepest frame sits on the ground.
 * Call **after** idle re-ground so walk/run do not tunnel through the floor.
 * Returns Δy applied (always ≥ 0).
 */
export function liftForClipFootClearance(
  model: THREE.Object3D,
  clip: THREE.AnimationClip,
  opts?: { groundY?: number; samples?: number },
): number {
  const groundY = opts?.groundY ?? 0;
  const samples = Math.max(3, opts?.samples ?? 8);
  if (!clip || clip.duration <= 0) return 0;

  const mixer = new THREE.AnimationMixer(model);
  let deepest = Infinity;
  try {
    const act = mixer.clipAction(clip);
    act.play();
    act.setLoop(THREE.LoopOnce, 1);
    for (let i = 0; i < samples; i++) {
      const t = (i / (samples - 1)) * Math.max(1e-4, clip.duration * 0.98);
      act.time = t;
      mixer.update(0);
      prepareSkinnedMeasure(model);
      const minY = bodyBox(model).min.y;
      if (Number.isFinite(minY) && minY < deepest) deepest = minY;
    }
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }

  if (!Number.isFinite(deepest)) return 0;
  const sink = groundY - deepest;
  // Only lift when soles clearly go under (ignore float noise)
  if (sink <= 0.015) return 0;
  // Cap so a bad clip cannot launch the hero
  const dy = Math.min(sink, 0.35);
  model.position.y += dy;
  model.updateWorldMatrix(true, true);
  return dy;
}
