/**
 * Converted voxel asset pipeline — characters, bosses, creatures, maps.
 *
 * SSOT for loading production-converted GLBs with:
 *  - role-aware SI scale (mapAssetScale / voxel-canonical)
 *  - animation pattern table for AI brains
 *  - consistent materials (sRGB maps, shadows)
 *
 * Use this instead of ad-hoc Box3.scale on every enemy/character load.
 */
import * as THREE from "three";
import {
  evaluateAssetRole,
  scaleConvertedVoxelAsset,
  buildVoxelAnimBrain,
  matchVoxelAnimPattern,
  VOXEL_ROLE_HEIGHT_M,
  type AssetRole,
  type VoxelAnimPattern,
  type NativeBounds,
} from "@workspace/voxel-canonical";

export type { VoxelAnimPattern, AssetRole };

export interface ConvertedLoadResult {
  root: THREE.Object3D;
  role: AssetRole;
  scale: number;
  reason: string;
  boundsNative: NativeBounds;
  boundsWorld: NativeBounds;
  clips: THREE.AnimationClip[];
  /** Clip name → idle/walk/attack… for AI brain */
  animBrain: Partial<Record<VoxelAnimPattern, string>>;
  mixer: THREE.AnimationMixer | null;
}

function measureNative(root: THREE.Object3D): NativeBounds {
  root.updateMatrixWorld(true);
  // Temporarily strip scale so we measure authoring units
  const sx = root.scale.x;
  const sy = root.scale.y;
  const sz = root.scale.z;
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.set(sx, sy, sz);
  root.updateMatrixWorld(true);
  return {
    x: Math.max(size.x, 1e-4),
    y: Math.max(size.y, 1e-4),
    z: Math.max(size.z, 1e-4),
  };
}

function prepMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
      // Voxel kits: keep toon-friendly metal
      if ("metalness" in std && typeof std.metalness === "number" && std.metalness > 0.55) {
        std.metalness = 0.15;
      }
    }
  });
}

function groundFeet(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.y)) return;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

/**
 * Apply converted-asset scale + materials + optional AnimationMixer.
 * Call after GLTFLoader puts the scene under `root`.
 */
export function finalizeConvertedVoxelAsset(
  root: THREE.Object3D,
  opts: {
    name: string;
    tags?: string[];
    forceRole?: AssetRole;
    targetHeightM?: number;
    clips?: THREE.AnimationClip[];
    /** When true, plant feet at y=0 after scale */
    ground?: boolean;
    attachMixer?: boolean;
  },
): ConvertedLoadResult {
  prepMaterials(root);
  const boundsNative = measureNative(root);
  const evaled = scaleConvertedVoxelAsset({
    name: opts.name,
    bounds: boundsNative,
    tags: opts.tags,
    forceRole: opts.forceRole,
    targetHeightM: opts.targetHeightM,
  });

  root.scale.multiplyScalar(evaled.scale);
  root.updateMatrixWorld(true);
  if (opts.ground !== false) groundFeet(root);

  const worldBox = new THREE.Box3().setFromObject(root);
  const worldSize = worldBox.getSize(new THREE.Vector3());
  const clips = opts.clips ?? [];
  const animBrain = buildVoxelAnimBrain(clips.map((c) => c.name || ""));

  let mixer: THREE.AnimationMixer | null = null;
  if (opts.attachMixer !== false && clips.length) {
    mixer = new THREE.AnimationMixer(root);
  }

  return {
    root,
    role: evaled.role,
    scale: evaled.scale,
    reason: evaled.reason,
    boundsNative,
    boundsWorld: {
      x: worldSize.x,
      y: worldSize.y,
      z: worldSize.z,
    },
    clips,
    animBrain,
    mixer,
  };
}

/** Play a brain pattern if we have a matching clip. */
export function playVoxelAnimBrain(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  brain: Partial<Record<VoxelAnimPattern, string>>,
  pattern: VoxelAnimPattern,
  opts?: { fade?: number; loop?: boolean },
): THREE.AnimationAction | null {
  const name = brain[pattern];
  if (!name) {
    // fallback: scan clips
    const hit = clips.find((c) => matchVoxelAnimPattern(c.name) === pattern);
    if (!hit) return null;
    return playClip(mixer, hit, opts);
  }
  const clip = clips.find((c) => c.name === name) ?? clips.find((c) => c.name.includes(name));
  if (!clip) return null;
  return playClip(mixer, clip, opts);
}

function playClip(
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip,
  opts?: { fade?: number; loop?: boolean },
): THREE.AnimationAction {
  const act = mixer.clipAction(clip);
  act.reset();
  act.setLoop(
    opts?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat,
    opts?.loop === false ? 1 : Infinity,
  );
  if (opts?.loop === false) act.clampWhenFinished = true;
  act.fadeIn(opts?.fade ?? 0.15).play();
  return act;
}

/** Default SI heights for quick scene call-sites. */
export const CONVERTED_HEIGHT = VOXEL_ROLE_HEIGHT_M;

/**
 * Suggest forceRole from path/name for enemies & bosses in Open scenes.
 */
export function inferConvertedRole(pathOrName: string): AssetRole {
  const r = evaluateAssetRole({ name: pathOrName, bounds: { x: 2, y: 2, z: 1 } });
  return r.role;
}
