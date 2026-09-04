import * as THREE from "three";

/**
 * Drop the tracks of `clip` whose target node does not exist under `root`.
 *
 * Merged / retargeted clips (e.g. the Meshy-sourced GLB fighters whose baked
 * clips still carry finger bones — `mixamorig*Hand{Thumb,Index}1-4` — or a
 * `Sword` node) target joints a given model may not own. Binding those to an
 * `AnimationMixer` makes three log a flood of
 * `THREE.PropertyBinding: No target node found for track: …` warnings — one per
 * missing node, every time the action is bound. Filtering the misses out before
 * the mixer ever sees them keeps the console quiet without changing how the
 * tracks that DO bind play.
 *
 * Returns the original clip untouched when every track resolves (the common
 * case), so callers can use it unconditionally with no allocation cost.
 */
export function filterBindableTracks(
  root: THREE.Object3D,
  clip: THREE.AnimationClip,
): THREE.AnimationClip {
  const bindable = clip.tracks.filter((track) => {
    const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name);
    return THREE.PropertyBinding.findNode(root, nodeName) != null;
  });
  if (bindable.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, bindable, clip.blendMode);
}

/**
 * Strip `.position` tracks from a clip bound to an already-grounded kit.
 *
 * grudge-character-correctness: hip/root position tracks after idle/attack
 * sample cause hip-float, feet under terrain, and limb stretch when bone
 * proportions differ between bake source and live race kit. Rotation-only is
 * the default for grounded Controller characters (no true root-motion).
 *
 * @param keepRootPosition — when true, keep pelvis/hips position only (bob).
 *   Default false for grudge6 combat kits.
 */
export function stripPositionTracks(
  clip: THREE.AnimationClip,
  opts?: { keepRootPosition?: boolean },
): THREE.AnimationClip {
  const keepRoot = opts?.keepRootPosition === true;
  const kept = clip.tracks.filter((track) => {
    const name = track.name;
    const isPos =
      name.endsWith(".position") ||
      /\.position\[/.test(name) ||
      name.includes(".position.");
    if (!isPos) return true;
    if (!keepRoot) return false;
    const node = THREE.PropertyBinding.parseTrackName(name).nodeName || "";
    return isRootHipNode(node);
  });
  if (kept.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, kept, clip.blendMode);
}

/** True for hips/pelvis/root only — not limbs (avoids stretch when packs differ). */
export function isRootHipNode(nodeName: string): boolean {
  const n = String(nodeName || "")
    .replace(/^mixamorig:?/i, "")
    .replace(/^Armature\|/i, "")
    .replace(/^Bip001[\s._-]*/i, "");
  if (/thigh|leg|foot|toe|spine|hand|arm|shoulder|neck|head|finger|clavicle/i.test(n)) {
    return false;
  }
  return /^(hips?|pelvis|root)$/i.test(n) || n === "";
}

/**
 * Drop scale tracks — foreign weapon packs often author non-1 scale keys that
 * squash the spine / tip the body toward the ground on equip.
 */
export function stripScaleTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const kept = clip.tracks.filter((track) => {
    const name = track.name;
    return !(
      name.endsWith(".scale") ||
      /\.scale\[/.test(name) ||
      name.includes(".scale.")
    );
  });
  if (kept.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, kept, clip.blendMode);
}

/**
 * Replace non-finite keyframe values (NaN / Inf) that tip the hip “undefined Y”
 * and spin the mesh. Quaternions default to identity; vectors to 0.
 */
export function sanitizeClipTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  let dirty = false;
  for (const track of clip.tracks) {
    const v = track.values;
    if (!v) continue;
    const isQuat = track.name.endsWith(".quaternion") || /\.quaternion\[/.test(track.name);
    for (let i = 0; i < v.length; i++) {
      if (Number.isFinite(v[i]!)) continue;
      dirty = true;
      if (isQuat) {
        // identity quat [0,0,0,1] — set w on every 4th component
        v[i] = i % 4 === 3 ? 1 : 0;
      } else {
        v[i] = 0;
      }
    }
    // Re-normalize quaternion keys if any were repaired
    if (isQuat) {
      for (let i = 0; i + 3 < v.length; i += 4) {
        const x = v[i]!, y = v[i + 1]!, z = v[i + 2]!, w = v[i + 3]!;
        const len = Math.hypot(x, y, z, w);
        if (len > 1e-8 && Math.abs(len - 1) > 1e-4) {
          dirty = true;
          v[i] = x / len;
          v[i + 1] = y / len;
          v[i + 2] = z / len;
          v[i + 3] = w / len;
        }
      }
    }
  }
  return dirty ? clip : clip;
}

export type StabilizeClipOpts = {
  root: THREE.Object3D;
  /** Bind-pose hips local position (from skeleton). */
  bindHip: { x: number; y: number; z: number };
  /**
   * Keep hips position track for vertical bob (then lock X/Z).
   * Default **false** — grounded kits, Mixamo packs, custom blends.
   * Physics + groundFeetLocal own travel.
   */
  keepRootPosition?: boolean;
  /**
   * Mutator applied after strip, before sanitize.
   * Default {@link lockHorizontalRoot}. Pass `null` to skip.
   */
  lockHorizontalRoot?:
    | ((
        clip: THREE.AnimationClip,
        bind: { x: number; y: number; z: number },
      ) => void)
    | null;
};

/**
 * Bind-pose hip local translation for mixer stabilize.
 * Mixamo explorer + Bip001 Toon kits.
 */
export function bindHipFromRoot(root: THREE.Object3D): {
  x: number;
  y: number;
  z: number;
} {
  const hips =
    root.getObjectByName("mixamorigHips") ||
    root.getObjectByName("Hips") ||
    root.getObjectByName("mixamorig:Hips") ||
    root.getObjectByName("Bip001 Pelvis") ||
    root.getObjectByName("Bip001 Hips") ||
    root.getObjectByName("Bip001");
  return hips
    ? { x: hips.position.x, y: hips.position.y, z: hips.position.z }
    : { x: 0, y: 0, z: 0 };
}

/**
 * True for a clip's root (Hips) translation track under Mixamo, colon form,
 * bare Hips, and Bip001 pelvis/hips. Exact-string match alone lets un-normalised
 * packs walk off the pedestal.
 */
export function isHipsPositionTrack(name: string): boolean {
  if (!name.endsWith(".position") && !/\.position\[/.test(name)) return false;
  const bone = name
    .replace(/\.position(\[.*)?$/, "")
    .replace(/^mixamorig:?/i, "")
    .replace(/^Armature\|/i, "");
  if (/^Hips\d*$/i.test(bone)) return true;
  if (/^Bip001[\s._-]?Hips$/i.test(bone)) return true;
  if (/^Bip001[\s._-]?Pelvis$/i.test(bone)) return true;
  if (/^(root|Root|ROOT)$/.test(bone)) return true;
  return false;
}

/**
 * Pin hip X/Z to bind pose; keep relative Y bob. Never pin to clip frame 0
 * (off-origin retarget packs plant the body tens of units away).
 */
export function lockHorizontalRoot(
  clip: THREE.AnimationClip,
  bind: { x: number; y: number; z: number } | number,
): void {
  const b = typeof bind === "number" ? { x: 0, y: bind, z: 0 } : bind;
  for (const track of clip.tracks) {
    if (!isHipsPositionTrack(track.name)) continue;
    const v = track.values;
    if (!v || v.length < 3) continue;
    const y0 = v[1];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = b.x;
      v[i + 1] = v[i + 1] - y0 + b.y;
      v[i + 2] = b.z;
    }
  }
}

/** Cap mixer Δt so a hitch doesn't explode gait phase / overlay / IK (Casting Time.maxDelta). */
export const MIXER_DT_MAX = 1 / 20;

export function clampMixerDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return dt > MIXER_DT_MAX ? MIXER_DT_MAX : dt;
}

/**
 * Best-practice bind pipeline for ONE AnimationMixer on a grounded character:
 * 1. drop tracks that don't bind
 * 2. strip ALL position tracks (Mixamo / retarget / blends) — physics owns Y
 * 3. lock leftover hip tracks to bind (no root walk-off)
 * 4. sanitize NaN quats / positions
 *
 * Call once per clip clone before mixer.clipAction — never invent a second mixer.
 */
export function stabilizeClipForMixer(
  clip: THREE.AnimationClip,
  opts: StabilizeClipOpts,
): THREE.AnimationClip {
  let c = filterBindableTracks(opts.root, clip.clone());
  c = stripScaleTracks(c);
  c = stripPositionTracks(c, {
    keepRootPosition: opts.keepRootPosition === true,
  });
  const lock =
    opts.lockHorizontalRoot === null
      ? undefined
      : (opts.lockHorizontalRoot ?? lockHorizontalRoot);
  lock?.(c, opts.bindHip);
  sanitizeClipTracks(c);
  return c;
}
