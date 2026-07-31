/**
 * Clip contract + strict validator/normalizer — Worker mirror.
 *
 * This is a byte-for-byte logical mirror of the frontend's
 * `src/three/anim/aiClipContract.ts` (+ `posableBones.ts`). It is pure data with
 * zero dependencies so it runs unchanged inside the Worker. Keep the POSABLE_BONES
 * list and the MAX_FRAMES / *_DURATION limits in lockstep with the frontend copy.
 *
 * The Worker runs this immediately after the AI model responds and before ANY
 * clip is persisted; the frontend runs the same logic again on receipt. Neither
 * end ever trusts the other — a malformed model response can never break the rig.
 */

export type QuatTuple = [number, number, number, number];

export interface AiClipFrame {
  duration: number;
  pose: Record<string, QuatTuple>;
  /** Optional root motion: hips local-space position `[x, y, z]` for this frame. */
  root?: [number, number, number];
}

export interface AiClip {
  bones: string[];
  frames: AiClipFrame[];
}

export const POSABLE_BONES = [
  "mixamorigHips",
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  "mixamorigNeck",
  "mixamorigHead",
  "mixamorigLeftShoulder",
  "mixamorigLeftArm",
  "mixamorigLeftForeArm",
  "mixamorigLeftHand",
  "mixamorigRightShoulder",
  "mixamorigRightArm",
  "mixamorigRightForeArm",
  "mixamorigRightHand",
  "mixamorigLeftUpLeg",
  "mixamorigLeftLeg",
  "mixamorigLeftFoot",
  "mixamorigRightUpLeg",
  "mixamorigRightLeg",
  "mixamorigRightFoot",
] as const;

export const POSABLE_BONE_SET: ReadonlySet<string> = new Set(POSABLE_BONES);

export const MAX_FRAMES = 64;
export const MIN_FRAME_DURATION = 0.05;
export const MAX_FRAME_DURATION = 5;
export const MAX_ROOT_COORD = 512;

const IDENTITY: QuatTuple = [0, 0, 0, 1];

export interface NormalizeResult {
  ok: boolean;
  clip: AiClip | null;
  warnings: string[];
  error?: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

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
    return { ok: false, clip: null, warnings, error: "Clip contains no recognized bones." };
  }

  const bones = POSABLE_BONES.filter((b) => usedBones.has(b));

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
 * the frontend's `aiClipContract.ts`; keep the two in lockstep.
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
