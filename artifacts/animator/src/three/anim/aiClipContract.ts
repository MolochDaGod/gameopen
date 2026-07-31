/**
 * AI skeleton-mover clip contract + strict validator/normalizer.
 *
 * This module is the trust boundary for AI-authored animation. It is pure data
 * (no three.js, no DOM) so the same logic runs on BOTH ends:
 *   - the Cloudflare Worker (which mirrors it in `worker/src/clipContract.ts`),
 *     immediately after the model responds and before anything is persisted, and
 *   - this frontend, on every clip received from the Worker, before it is ever
 *     allowed to drive the rig.
 *
 * The normalizer is deliberately defensive: it drops unknown bones, re-normalizes
 * every quaternion (replacing NaN / zero-length with identity), clamps frame
 * durations, and caps the frame count. A malformed model response can therefore
 * never break the rig — at worst it produces a harmless identity-ish pose.
 */
import { POSABLE_BONES } from "./posableBones";

export type QuatTuple = [number, number, number, number];

export interface AiClipFrame {
  /** Time to interpolate from this frame to the next, in seconds. */
  duration: number;
  /** Local-space quaternion per posable bone (relative to the rig's bind pose). */
  pose: Record<string, QuatTuple>;
  /**
   * Optional ROOT MOTION: the hips' local-space position `[x, y, z]` for this
   * frame (i.e. where the body is, not just how it is rotated). Absent for
   * legacy / in-place clips. The Animator bakes this from a requested travel
   * distance + direction so a clip is real, mocap-style locomotion that moves
   * through space rather than rotation-only motion stuck at the origin.
   */
  root?: [number, number, number];
}

export interface AiClip {
  /** The posable bones this clip animates (subset of POSABLE_BONES). */
  bones: string[];
  frames: AiClipFrame[];
}

export const POSABLE_BONE_SET: ReadonlySet<string> = new Set(POSABLE_BONES);

/** Hard limits — kept in lockstep with the Worker copy. */
export const MAX_FRAMES = 64;
export const MIN_FRAME_DURATION = 0.05;
export const MAX_FRAME_DURATION = 5;
/** Root-motion coordinates are clamped to this half-extent (sanity bound). */
export const MAX_ROOT_COORD = 512;

const IDENTITY: QuatTuple = [0, 0, 0, 1];

export interface NormalizeResult {
  ok: boolean;
  clip: AiClip | null;
  /** Non-fatal adjustments (dropped bones, clamped durations, capped frames…). */
  warnings: string[];
  /** Set only when the input could not be salvaged into a playable clip. */
  error?: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Coerce an unknown value into a unit quaternion, falling back to identity. */
function normalizeQuat(v: unknown): { quat: QuatTuple; ok: boolean } {
  if (!Array.isArray(v) || v.length !== 4) return { quat: [...IDENTITY], ok: false };
  const x = Number(v[0]);
  const y = Number(v[1]);
  const z = Number(v[2]);
  const w = Number(v[3]);
  if (![x, y, z, w].every((c) => Number.isFinite(c))) {
    return { quat: [...IDENTITY], ok: false };
  }
  const len = Math.hypot(x, y, z, w);
  if (len < 1e-6) return { quat: [...IDENTITY], ok: false };
  return { quat: [x / len, y / len, z / len, w / len], ok: true };
}

/** Coerce an unknown value into a clamped `[x, y, z]` root position, or null. */
function normalizeRoot(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const x = Number(v[0]);
  const y = Number(v[1]);
  const z = Number(v[2]);
  if (![x, y, z].every((c) => Number.isFinite(c))) return null;
  return [
    clamp(x, -MAX_ROOT_COORD, MAX_ROOT_COORD),
    clamp(y, -MAX_ROOT_COORD, MAX_ROOT_COORD),
    clamp(z, -MAX_ROOT_COORD, MAX_ROOT_COORD),
  ];
}

/**
 * Validate + normalize an untrusted clip payload into a playable {@link AiClip}.
 * Accepts either the bare clip object (`{bones?, frames}`) or a `{clip: {...}}`
 * wrapper (which is what the Worker returns).
 */
export function normalizeAiClip(raw: unknown): NormalizeResult {
  const warnings: string[] = [];

  let obj = raw as Record<string, unknown> | null | undefined;
  if (obj && typeof obj === "object" && "clip" in obj && obj.clip) {
    obj = obj.clip as Record<string, unknown>;
  }
  if (!obj || typeof obj !== "object") {
    return { ok: false, clip: null, warnings, error: "Clip is not an object." };
  }

  const rawFrames = (obj as { frames?: unknown }).frames;
  if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
    return { ok: false, clip: null, warnings, error: "Clip has no frames." };
  }

  let frames = rawFrames as unknown[];
  if (frames.length > MAX_FRAMES) {
    warnings.push(`Capped ${frames.length} frames to ${MAX_FRAMES}.`);
    frames = frames.slice(0, MAX_FRAMES);
  }

  const usedBones = new Set<string>();
  const cleanFrames: AiClipFrame[] = [];
  let droppedBones = 0;
  let fixedQuats = 0;
  let clampedDurations = 0;

  for (const fr of frames) {
    if (!fr || typeof fr !== "object") continue;
    const frame = fr as { duration?: unknown; pose?: unknown };

    let duration = Number(frame.duration);
    if (!Number.isFinite(duration)) {
      duration = MIN_FRAME_DURATION;
      clampedDurations++;
    } else {
      const clamped = clamp(duration, MIN_FRAME_DURATION, MAX_FRAME_DURATION);
      if (clamped !== duration) clampedDurations++;
      duration = clamped;
    }

    const pose: Record<string, QuatTuple> = {};
    const rawPose = frame.pose;
    if (rawPose && typeof rawPose === "object") {
      for (const [bone, q] of Object.entries(rawPose as Record<string, unknown>)) {
        if (!POSABLE_BONE_SET.has(bone)) {
          droppedBones++;
          continue;
        }
        const { quat, ok } = normalizeQuat(q);
        if (!ok) fixedQuats++;
        pose[bone] = quat;
        usedBones.add(bone);
      }
    }

    const root = normalizeRoot((frame as { root?: unknown }).root);
    cleanFrames.push(root ? { duration, pose, root } : { duration, pose });
  }

  if (usedBones.size === 0) {
    return {
      ok: false,
      clip: null,
      warnings,
      error: "Clip contains no recognized bones.",
    };
  }

  // Canonical bone order (POSABLE_BONES order) for stable, deterministic tracks.
  const bones = POSABLE_BONES.filter((b) => usedBones.has(b));

  // Ensure every used bone has a value in every frame (fill gaps with identity)
  // so downstream track-builders never produce a partial track.
  for (const frame of cleanFrames) {
    for (const bone of bones) {
      if (!frame.pose[bone]) frame.pose[bone] = [...IDENTITY];
    }
  }

  if (droppedBones) warnings.push(`Dropped ${droppedBones} unknown bone key(s).`);
  if (fixedQuats) warnings.push(`Reset ${fixedQuats} invalid rotation(s) to identity.`);
  if (clampedDurations) warnings.push(`Clamped ${clampedDurations} frame duration(s).`);

  return { ok: true, clip: { bones, frames: cleanFrames }, warnings };
}

/**
 * Resample a frame list to EXACTLY `n` frames by selecting evenly-spaced source
 * frames (no interpolation): downsamples by skipping, upsamples by repeating. Used
 * by A.L.E. mode to guarantee a requested keyframe count. Pure data — MIRRORED in
 * the Worker's `clipContract.ts`; keep the two in lockstep.
 */
export function resampleFramesExact(frames: AiClipFrame[], n: number): AiClipFrame[] {
  if (!Number.isFinite(n) || n <= 0 || frames.length === 0 || frames.length === n) {
    return frames;
  }
  const cloneFrame = (f: AiClipFrame): AiClipFrame => {
    const pose: Record<string, QuatTuple> = {};
    for (const bone of Object.keys(f.pose)) pose[bone] = [...f.pose[bone]];
    return f.root
      ? { duration: f.duration, pose, root: [...f.root] }
      : { duration: f.duration, pose };
  };
  const out: AiClipFrame[] = [];
  for (let i = 0; i < n; i++) {
    const src = n === 1 ? 0 : Math.round((i * (frames.length - 1)) / (n - 1));
    out.push(cloneFrame(frames[src]));
  }
  return out;
}
