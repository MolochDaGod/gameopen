import * as THREE from "three";

/**
 * Persistence + runtime conversion for clips authored in the frame-based
 * Animation Creator door. Saved as the app's own JSON (NOT FBX/glTF) under a
 * versioned localStorage key, and rebuilt into a {@link THREE.AnimationClip}
 * (quaternion tracks on the Mixamo skeleton) so the combat room can list, bind,
 * and play them on either character rig. No `@workspace/*` imports.
 */

/** localStorage key the creator saves/loads authored clips under. */
const STORE_KEY = "dangerroom:customclips";
/** Bump when the on-disk shape changes; older payloads are dropped on load. */
export const CUSTOM_CLIP_VERSION = 1;

/** A quaternion as a plain tuple `[x, y, z, w]` (JSON-friendly). */
export type QuatTuple = [number, number, number, number];

/** One authored keyframe: how long it holds + a pose for every posable bone. */
export interface ClipFrame {
  /** Seconds this frame is held before interpolating to the next. */
  duration: number;
  /** Bone (sanitised Mixamo name) -> local-space quaternion. */
  pose: Record<string, QuatTuple>;
  /**
   * Optional root motion: the hips' local-space position `[x, y, z]` for this
   * frame. Present only on clips that carry baked travel (distance/direction);
   * absent for legacy in-place clips, which keep the rig's bind hips position.
   */
  root?: [number, number, number];
}

/** A single authored clip as persisted to localStorage. */
export interface StoredClip {
  name: string;
  version: number;
  /** The posable bones this clip animates (stable track order). */
  bones: string[];
  frames: ClipFrame[];
  /** Cached total duration (sum of frame durations); recomputed on save. */
  duration: number;
  /** Epoch ms of the last save (for sorting the library). */
  updatedAt: number;
}

const IDENTITY: QuatTuple = [0, 0, 0, 1];

function isQuatTuple(v: unknown): v is QuatTuple {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

function isClipFrame(v: unknown): v is ClipFrame {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  if (typeof f.duration !== "number" || !Number.isFinite(f.duration)) return false;
  if (!f.pose || typeof f.pose !== "object") return false;
  if (f.root !== undefined && !isVec3(f.root)) return false;
  return Object.values(f.pose as Record<string, unknown>).every(isQuatTuple);
}

function isStoredClip(v: unknown): v is StoredClip {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.name === "string" &&
    c.version === CUSTOM_CLIP_VERSION &&
    Array.isArray(c.bones) &&
    c.bones.every((b) => typeof b === "string") &&
    Array.isArray(c.frames) &&
    c.frames.length > 0 &&
    c.frames.every(isClipFrame)
  );
}

function safeParse(raw: string | null): StoredClip[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isStoredClip);
  } catch {
    return [];
  }
}

/** All saved authored clips, newest first. */
export function listStoredClips(): StoredClip[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(STORE_KEY)).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Look up one saved clip by name. */
export function getStoredClip(name: string): StoredClip | null {
  return listStoredClips().find((c) => c.name === name) ?? null;
}

/** Total duration of a frame list (sum of per-frame durations, min one tick). */
export function totalDuration(frames: ClipFrame[]): number {
  return Math.max(
    0.0001,
    frames.reduce((sum, f) => sum + Math.max(0, f.duration), 0),
  );
}

/**
 * Save (insert or replace by name) an authored clip. Recomputes `duration`,
 * stamps `version`/`updatedAt`. Returns the persisted record.
 */
export function saveStoredClip(input: {
  name: string;
  bones: string[];
  frames: ClipFrame[];
}): StoredClip {
  const record: StoredClip = {
    name: input.name,
    version: CUSTOM_CLIP_VERSION,
    bones: [...input.bones],
    frames: input.frames.map((f) => ({
      duration: f.duration,
      pose: { ...f.pose },
      ...(f.root ? { root: [f.root[0], f.root[1], f.root[2]] as [number, number, number] } : {}),
    })),
    duration: totalDuration(input.frames),
    updatedAt: Date.now(),
  };
  if (typeof localStorage === "undefined") return record;
  const all = listStoredClips().filter((c) => c.name !== input.name);
  all.push(record);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  return record;
}

/** Delete a saved clip by name. */
export function deleteStoredClip(name: string): void {
  if (typeof localStorage === "undefined") return;
  const all = listStoredClips().filter((c) => c.name !== name);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
}

/**
 * Rebuild a runtime {@link THREE.AnimationClip} from a stored clip. Emits one
 * {@link THREE.QuaternionKeyframeTrack} per posable bone (`<bone>.quaternion`),
 * with keyframe times at the cumulative start of each frame plus a final hold
 * keyframe at the total duration so the last pose persists. Returns null for an
 * empty clip.
 */
export function buildAnimationClip(stored: StoredClip): THREE.AnimationClip | null {
  if (!stored.frames.length) return null;

  // Cumulative frame start times, plus a trailing "hold" time at the end.
  const times: number[] = [];
  let t = 0;
  for (const f of stored.frames) {
    times.push(t);
    t += Math.max(0, f.duration);
  }
  const total = Math.max(0.0001, t);
  times.push(total); // final hold keyframe repeats the last pose

  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of stored.bones) {
    const values: number[] = [];
    for (const f of stored.frames) {
      const q = f.pose[bone] ?? IDENTITY;
      values.push(q[0], q[1], q[2], q[3]);
    }
    // Repeat the last frame's pose for the trailing hold keyframe.
    const last = stored.frames[stored.frames.length - 1].pose[bone] ?? IDENTITY;
    values.push(last[0], last[1], last[2], last[3]);
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }

  // Root motion: if any frame carries a baked hips position, emit a position
  // track on the hips so the body physically travels through space. Frames
  // without a root inherit the last known position (so partial data is safe).
  if (stored.frames.some((f) => f.root)) {
    const pos: number[] = [];
    let lastRoot: [number, number, number] = stored.frames.find((f) => f.root)?.root ?? [0, 0, 0];
    for (const f of stored.frames) {
      if (f.root) lastRoot = f.root;
      pos.push(lastRoot[0], lastRoot[1], lastRoot[2]);
    }
    pos.push(lastRoot[0], lastRoot[1], lastRoot[2]); // trailing hold
    tracks.push(new THREE.VectorKeyframeTrack("mixamorigHips.position", times, pos));
  }

  return new THREE.AnimationClip(stored.name, total, tracks);
}
