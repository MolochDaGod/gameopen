/**
 * Bone trace math — hip XYZ / spine path sampling through AnimationClips.
 *
 * "hxyz" in fleet language = **Hips (and chain) world/local XYZ over clip time**.
 * Graphical spine-line traces = ordered bone samples → polyline for debug / agent QA.
 *
 * Three.js: AnimationMixer + AnimationClip tracks · SkeletonHelper for live bones.
 * Fleet SSOT: docs/GRUDOX_ANIMATOR_LIBRARY_MATH_SSOT.md
 */
import * as THREE from "three";

/** Mixamo hip names used on explorer / GRUDOX animator. */
export const HIP_BONE_NAMES = [
  "mixamorigHips",
  "mixamorig:Hips",
  "Hips",
  "Bip001",
  "Bip001 Pelvis",
] as const;

/** Default spine chain for line traces (Mixamo). */
export const SPINE_CHAIN = [
  "mixamorigHips",
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  "mixamorigNeck",
  "mixamorigHead",
] as const;

export type Vec3 = { x: number; y: number; z: number };

export interface BoneSample {
  /** Clip time (s). */
  t: number;
  /** Bone local or world position. */
  p: Vec3;
  bone: string;
}

export interface HipXyzTrace {
  bone: string;
  /** Samples along clip [0, duration]. */
  samples: BoneSample[];
  /** Bounding box of path (for SI sanity). */
  min: Vec3;
  max: Vec3;
  /** Peak |Δxz| from first sample — root-motion drift metric. */
  planarDriftM: number;
  /** Peak |Δy| bob. */
  verticalBobM: number;
}

function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function findBone(root: THREE.Object3D, names: readonly string[]): THREE.Object3D | null {
  for (const n of names) {
    const o = root.getObjectByName(n);
    if (o) return o;
  }
  return null;
}

/**
 * Locomotion intensity → idle/walk/run weights (mirrors LocomotionBlend).
 * speed ∈ [0,1]. Returns { idle, walk, run } summing to ~1 when active.
 */
export function locoWeightsFromSpeed(
  speed: number,
  crouch = false,
): { idle: number; walk: number; run: number } {
  const IDLE_AT = 0.06;
  const WALK_AT = 0.45;
  const RUN_AT = 0.9;
  const s = THREE.MathUtils.clamp(speed, 0, 1);
  let idle = 0;
  let walk = 0;
  let run = 0;
  if (s <= WALK_AT) {
    const t = THREE.MathUtils.clamp((s - IDLE_AT) / (WALK_AT - IDLE_AT), 0, 1);
    idle = 1 - t;
    walk = t;
  } else {
    const t = THREE.MathUtils.clamp((s - WALK_AT) / (RUN_AT - WALK_AT), 0, 1);
    walk = 1 - t;
    run = t;
  }
  if (crouch) {
    walk += run;
    run = 0;
  }
  return { idle, walk, run };
}

/**
 * Sample a bone's **local position** track from a clip (if authored).
 * Falls back to bind position when no position track exists (rotation-only bakes).
 */
export function sampleBoneLocalPath(
  clip: THREE.AnimationClip,
  boneName: string,
  steps = 24,
  bind: Vec3 = { x: 0, y: 0, z: 0 },
): HipXyzTrace {
  const duration = Math.max(1e-4, clip.duration || 1);
  const track = clip.tracks.find((tr) => {
    const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(tr.name);
    return nodeName === boneName && propertyName === "position";
  }) as THREE.VectorKeyframeTrack | undefined;

  const samples: BoneSample[] = [];
  let min = v3(Infinity, Infinity, Infinity);
  let max = v3(-Infinity, -Infinity, -Infinity);

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    let p = { ...bind };
    if (track) {
      const arr = track.values;
      const times = track.times;
      // Linear sample
      let j = 0;
      while (j < times.length - 1 && times[j + 1]! < t) j++;
      const t0 = times[j] ?? 0;
      const t1 = times[j + 1] ?? t0;
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      const i0 = j * 3;
      const i1 = Math.min(j + 1, Math.floor(arr.length / 3) - 1) * 3;
      p = {
        x: THREE.MathUtils.lerp(arr[i0] ?? bind.x, arr[i1] ?? bind.x, u),
        y: THREE.MathUtils.lerp(arr[i0 + 1] ?? bind.y, arr[i1 + 1] ?? bind.y, u),
        z: THREE.MathUtils.lerp(arr[i0 + 2] ?? bind.z, arr[i1 + 2] ?? bind.z, u),
      };
    }
    samples.push({ t, p, bone: boneName });
    min = v3(Math.min(min.x, p.x), Math.min(min.y, p.y), Math.min(min.z, p.z));
    max = v3(Math.max(max.x, p.x), Math.max(max.y, p.y), Math.max(max.z, p.z));
  }

  const p0 = samples[0]?.p ?? bind;
  let planarDriftM = 0;
  let verticalBobM = 0;
  for (const s of samples) {
    const dx = s.p.x - p0.x;
    const dz = s.p.z - p0.z;
    planarDriftM = Math.max(planarDriftM, Math.hypot(dx, dz));
    verticalBobM = Math.max(verticalBobM, Math.abs(s.p.y - p0.y));
  }

  return { bone: boneName, samples, min, max, planarDriftM, verticalBobM };
}

/**
 * Hip XYZ trace for a clip — primary metric for root-lock / foot plant QA.
 * Agent language: "hip path", "root drift", "vertical bob", "in-place cycle".
 */
export function sampleHipXyzTrace(
  clip: THREE.AnimationClip,
  steps = 24,
  bindHip: Vec3 = { x: 0, y: 1, z: 0 },
): HipXyzTrace {
  // Prefer first hip name that has a track; else use Hips name with bind
  for (const name of HIP_BONE_NAMES) {
    const has = clip.tracks.some((tr) => {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(tr.name);
      return nodeName === name && propertyName === "position";
    });
    if (has) return sampleBoneLocalPath(clip, name, steps, bindHip);
  }
  return sampleBoneLocalPath(clip, "mixamorigHips", steps, bindHip);
}

/**
 * Build a THREE.Line polyline from a hip/bone trace (debug graphics).
 * SI units: path is local bone space — parent under skeleton root for display.
 */
export function buildTraceLine(
  trace: HipXyzTrace,
  color = 0x4ade80,
): THREE.Line {
  const pts = trace.samples.map((s) => new THREE.Vector3(s.p.x, s.p.y, s.p.z));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const line = new THREE.Line(geo, mat);
  line.name = `bone_trace_${trace.bone}`;
  line.userData.trace = trace;
  return line;
}

/**
 * Sample live skeleton world positions for spine chain (after mixer.update).
 * Used for graphical spine-line overlay each frame.
 */
export function sampleLiveSpineWorld(
  skeletonRoot: THREE.Object3D,
  chain: readonly string[] = SPINE_CHAIN,
): Vec3[] {
  const out: Vec3[] = [];
  const w = new THREE.Vector3();
  for (const name of chain) {
    const b = findBone(skeletonRoot, [name, name.replace("mixamorig", "mixamorig:")]);
    if (!b) continue;
    b.getWorldPosition(w);
    out.push(v3(w.x, w.y, w.z));
  }
  return out;
}

export function buildLiveSpineLine(
  skeletonRoot: THREE.Object3D,
  color = 0x60a5fa,
): THREE.Line | null {
  const pts = sampleLiveSpineWorld(skeletonRoot).map((p) => new THREE.Vector3(p.x, p.y, p.z));
  if (pts.length < 2) return null;
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
  const line = new THREE.Line(geo, mat);
  line.name = "spine_trace_live";
  return line;
}

/**
 * Root-lock rule (fleet): re-baseline hip X/Z to bind; keep relative Y bob.
 * Returns corrected local hip position for a sampled hip p.
 */
export function applyHipRootLock(
  p: Vec3,
  bind: Vec3,
  firstFrame: Vec3,
): Vec3 {
  return {
    x: bind.x, // strip planar travel → lock X to bind
    y: bind.y + (p.y - firstFrame.y), // keep relative bob
    z: bind.z, // strip planar travel → lock Z to bind
  };
}

/** Agent-facing summary string for a hip trace. */
export function describeHipTrace(trace: HipXyzTrace): string {
  return (
    `hip:${trace.bone} samples=${trace.samples.length} ` +
    `planarDrift=${trace.planarDriftM.toFixed(3)}m bob=${trace.verticalBobM.toFixed(3)}m ` +
    (trace.planarDriftM > 0.35 ? "WARN:large-root-motion " : "ok:in-place-ish ")
  );
}
