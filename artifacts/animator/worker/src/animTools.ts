/**
 * Deterministic animation tools (no LLM).
 * Used by the Worker for IK, weapon angle, optimize, and pose scaffolding.
 * Pure TypeScript — runs in Workers and can be mirrored on the client later.
 */

import {
  POSABLE_BONES,
  MAX_FRAMES,
  MIN_FRAME_DURATION,
  MAX_FRAME_DURATION,
  type AiClip,
  type AiClipFrame,
  type QuatTuple,
} from "./clipContract";

export const IDENTITY: QuatTuple = [0, 0, 0, 1];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Euler XYZ degrees → unit quaternion [x,y,z,w]. */
export function eulerDegToQuat(xDeg: number, yDeg: number, zDeg: number): QuatTuple {
  const x = (xDeg * Math.PI) / 180;
  const y = (yDeg * Math.PI) / 180;
  const z = (zDeg * Math.PI) / 180;
  const cx = Math.cos(x * 0.5);
  const sx = Math.sin(x * 0.5);
  const cy = Math.cos(y * 0.5);
  const sy = Math.sin(y * 0.5);
  const cz = Math.cos(z * 0.5);
  const sz = Math.sin(z * 0.5);
  // XYZ order
  const qx = sx * cy * cz + cx * sy * sz;
  const qy = cx * sy * cz - sx * cy * sz;
  const qz = cx * cy * sz + sx * sy * cz;
  const qw = cx * cy * cz - sx * sy * sz;
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  return [qx / len, qy / len, qz / len, qw / len];
}

export function mulQuat(a: QuatTuple, b: QuatTuple): QuatTuple {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  const out: QuatTuple = [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
  const len = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
  return [out[0] / len, out[1] / len, out[2] / len, out[3] / len];
}

export function slerpQuat(a: QuatTuple, b: QuatTuple, t: number): QuatTuple {
  let [ax, ay, az, aw] = a;
  let [bx, by, bz, bw] = b;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    const x = ax + t * (bx - ax);
    const y = ay + t * (by - ay);
    const z = az + t * (bz - az);
    const w = aw + t * (bw - aw);
    const len = Math.hypot(x, y, z, w) || 1;
    return [x / len, y / len, z / len, w / len];
  }
  const theta0 = Math.acos(clamp(dot, -1, 1));
  const theta = theta0 * t;
  const s0 = Math.sin(theta0 - theta) / Math.sin(theta0);
  const s1 = Math.sin(theta) / Math.sin(theta0);
  return [s0 * ax + s1 * bx, s0 * ay + s1 * by, s0 * az + s1 * bz, s0 * aw + s1 * bw];
}

function emptyPose(): Record<string, QuatTuple> {
  const pose: Record<string, QuatTuple> = {};
  for (const b of POSABLE_BONES) pose[b] = [...IDENTITY];
  return pose;
}

function clonePose(p: Record<string, QuatTuple>): Record<string, QuatTuple> {
  const out: Record<string, QuatTuple> = {};
  for (const k of Object.keys(p)) out[k] = [...p[k]];
  return out;
}

/** Single-frame clip from a partial pose map. */
export function poseToClip(
  posePartial: Record<string, QuatTuple>,
  duration = 0.4,
): AiClip {
  const pose = emptyPose();
  for (const [bone, q] of Object.entries(posePartial)) {
    if ((POSABLE_BONES as readonly string[]).includes(bone)) pose[bone] = q;
  }
  return {
    bones: [...POSABLE_BONES],
    frames: [{ duration: clamp(duration, MIN_FRAME_DURATION, MAX_FRAME_DURATION), pose }],
  };
}

export type LimbId = "rightArm" | "leftArm" | "rightLeg" | "leftLeg";

const LIMB_BONES: Record<LimbId, [string, string, string]> = {
  rightArm: ["mixamorigRightArm", "mixamorigRightForeArm", "mixamorigRightHand"],
  leftArm: ["mixamorigLeftArm", "mixamorigLeftForeArm", "mixamorigLeftHand"],
  rightLeg: ["mixamorigRightUpLeg", "mixamorigRightLeg", "mixamorigRightFoot"],
  leftLeg: ["mixamorigLeftUpLeg", "mixamorigLeftLeg", "mixamorigLeftFoot"],
};

/**
 * Approximate two-bone IK: maps a unit direction + bend amount into local joint
 * rotations. Not a full CCD solver — designed for readable combat / aim poses.
 *
 * @param limb which chain
 * @param aimYawDeg world yaw of the aim direction (0 = +Z)
 * @param aimPitchDeg elevation (positive = up)
 * @param bend 0..1 elbow/knee bend
 * @param basePose optional starting pose (merged)
 */
export function solveLimbIk(opts: {
  limb: LimbId;
  aimYawDeg?: number;
  aimPitchDeg?: number;
  bend?: number;
  basePose?: Record<string, QuatTuple>;
}): Record<string, QuatTuple> {
  const limb = opts.limb;
  const yaw = opts.aimYawDeg ?? 0;
  const pitch = opts.aimPitchDeg ?? 0;
  const bend = clamp(opts.bend ?? 0.45, 0, 1);
  const [upper, mid, end] = LIMB_BONES[limb];
  const pose = opts.basePose ? clonePose(opts.basePose) : emptyPose();

  const isArm = limb === "rightArm" || limb === "leftArm";
  const side = limb === "rightArm" || limb === "rightLeg" ? 1 : -1;

  if (isArm) {
    // Upper arm points toward aim; forearm bends; hand aligns.
    pose[upper] = eulerDegToQuat(-pitch * 0.7, yaw * 0.35 * side, side * (20 + bend * 25));
    pose[mid] = eulerDegToQuat(0, 0, side * (15 + bend * 95));
    pose[end] = eulerDegToQuat(-pitch * 0.2, yaw * 0.1 * side, 0);
    // Shoulder + spine assist
    const shoulder = limb === "rightArm" ? "mixamorigRightShoulder" : "mixamorigLeftShoulder";
    pose[shoulder] = eulerDegToQuat(-pitch * 0.15, yaw * 0.1 * side, side * 8);
    pose["mixamorigSpine2"] = eulerDegToQuat(-pitch * 0.08, yaw * 0.05, 0);
    pose["mixamorigHead"] = eulerDegToQuat(-pitch * 0.25, yaw * 0.4, 0);
  } else {
    // Legs: pitch for stride / kick, bend for knee.
    pose[upper] = eulerDegToQuat(pitch * 0.9 + bend * 20, yaw * 0.2 * side, side * 5);
    pose[mid] = eulerDegToQuat(-(bend * 100 + 5), 0, 0);
    pose[end] = eulerDegToQuat(pitch * 0.15 - bend * 15, 0, 0);
    pose["mixamorigHips"] = eulerDegToQuat(0, yaw * 0.15, 0);
  }
  return pose;
}

export type WeaponStyle =
  | "sword_guard"
  | "sword_overhead"
  | "sword_slash_r"
  | "sword_slash_l"
  | "spear_thrust"
  | "bow_draw"
  | "rifle_aim"
  | "pistol_aim"
  | "staff_cast"
  | "twohand_high";

/** Preset weapon-ready / attack key poses (right-hand dominant Mixamo). */
export function weaponPresetPose(style: WeaponStyle, angleDeg = 0): Record<string, QuatTuple> {
  const a = angleDeg;
  switch (style) {
    case "sword_guard":
      return {
        mixamorigRightArm: eulerDegToQuat(-25 + a * 0.2, 15, 35),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 55 + a * 0.3),
        mixamorigRightHand: eulerDegToQuat(10, 0, 10),
        mixamorigLeftArm: eulerDegToQuat(-10, -20, -25),
        mixamorigLeftForeArm: eulerDegToQuat(0, 0, -40),
        mixamorigSpine1: eulerDegToQuat(0, a * 0.1, 0),
        mixamorigHead: eulerDegToQuat(0, a * 0.15, 0),
      };
    case "sword_overhead":
      return {
        mixamorigRightArm: eulerDegToQuat(-110 - a * 0.2, 10, 20),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 20),
        mixamorigRightHand: eulerDegToQuat(-20, 0, 0),
        mixamorigSpine2: eulerDegToQuat(-8, 0, 0),
        mixamorigHead: eulerDegToQuat(5, 0, 0),
      };
    case "sword_slash_r":
      return {
        mixamorigRightArm: eulerDegToQuat(-40, 50 + a * 0.5, 60),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 30),
        mixamorigSpine1: eulerDegToQuat(0, 25 + a * 0.3, 0),
        mixamorigHips: eulerDegToQuat(0, 15, 0),
      };
    case "sword_slash_l":
      return {
        mixamorigRightArm: eulerDegToQuat(-35, -45 - a * 0.5, 50),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 40),
        mixamorigSpine1: eulerDegToQuat(0, -20 - a * 0.3, 0),
        mixamorigHips: eulerDegToQuat(0, -12, 0),
      };
    case "spear_thrust":
      return {
        mixamorigRightArm: eulerDegToQuat(-5 + a * 0.1, 0, 90),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 5),
        mixamorigLeftArm: eulerDegToQuat(-10, 0, -70),
        mixamorigLeftForeArm: eulerDegToQuat(0, 0, -20),
        mixamorigSpine2: eulerDegToQuat(5, 0, 0),
      };
    case "bow_draw":
      return {
        mixamorigLeftArm: eulerDegToQuat(-5, -10, -85),
        mixamorigLeftForeArm: eulerDegToQuat(0, 0, -5),
        mixamorigRightArm: eulerDegToQuat(-20, 40 + a * 0.2, 70),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 95),
        mixamorigHead: eulerDegToQuat(0, -8, 0),
      };
    case "rifle_aim":
      return {
        mixamorigRightArm: eulerDegToQuat(-15 - a * 0.3, 5, 75),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 15),
        mixamorigLeftArm: eulerDegToQuat(-25, -15, -70),
        mixamorigLeftForeArm: eulerDegToQuat(0, 0, -40),
        mixamorigHead: eulerDegToQuat(-5 - a * 0.2, 0, 0),
        mixamorigSpine2: eulerDegToQuat(-3, 0, 0),
      };
    case "pistol_aim":
      return {
        mixamorigRightArm: eulerDegToQuat(-10 - a * 0.4, 0, 80),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 5),
        mixamorigRightHand: eulerDegToQuat(0, 0, 0),
        mixamorigHead: eulerDegToQuat(-8 - a * 0.15, 0, 0),
      };
    case "staff_cast":
      return {
        mixamorigRightArm: eulerDegToQuat(-80, 20, 30),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 25),
        mixamorigLeftArm: eulerDegToQuat(-40, -30, -50),
        mixamorigSpine2: eulerDegToQuat(-10, 0, 0),
        mixamorigHead: eulerDegToQuat(-15, 0, 0),
      };
    case "twohand_high":
      return {
        mixamorigRightArm: eulerDegToQuat(-95, 15, 25),
        mixamorigLeftArm: eulerDegToQuat(-90, -15, -25),
        mixamorigRightForeArm: eulerDegToQuat(0, 0, 15),
        mixamorigLeftForeArm: eulerDegToQuat(0, 0, -15),
        mixamorigSpine1: eulerDegToQuat(-5, 0, 0),
      };
    default:
      return {};
  }
}

/**
 * Apply a weapon angle offset (degrees) onto arm bones of every frame.
 * Positive yaw = open toward the right; pitch = raise/lower blade tip.
 */
export function adjustWeaponAngles(
  clip: AiClip,
  opts: { yawDeg?: number; pitchDeg?: number; rollDeg?: number; arm?: "right" | "left" | "both" },
): AiClip {
  const yaw = opts.yawDeg ?? 0;
  const pitch = opts.pitchDeg ?? 0;
  const roll = opts.rollDeg ?? 0;
  const arm = opts.arm ?? "right";
  const delta = eulerDegToQuat(pitch, yaw, roll);
  const bones: string[] = [];
  if (arm === "right" || arm === "both") {
    bones.push("mixamorigRightArm", "mixamorigRightForeArm", "mixamorigRightHand");
  }
  if (arm === "left" || arm === "both") {
    bones.push("mixamorigLeftArm", "mixamorigLeftForeArm", "mixamorigLeftHand");
  }

  const frames: AiClipFrame[] = clip.frames.map((f) => {
    const pose = clonePose(f.pose);
    for (const b of bones) {
      const cur = pose[b] ?? IDENTITY;
      // Apply half weight on forearm/hand for natural cascade
      const w = b.endsWith("Arm") && !b.includes("Fore") ? 1 : b.includes("Fore") ? 0.55 : 0.35;
      const scaled = slerpQuat(IDENTITY, delta, w);
      pose[b] = mulQuat(cur, scaled);
    }
    return f.root
      ? { duration: f.duration, pose, root: [...f.root] as [number, number, number] }
      : { duration: f.duration, pose };
  });

  const used = new Set<string>();
  for (const f of frames) for (const b of Object.keys(f.pose)) used.add(b);
  return {
    bones: POSABLE_BONES.filter((b) => used.has(b)),
    frames,
  };
}

/** Smooth poses (slerp neighbors) + optional frame merge when nearly identical. */
export function optimizeClip(
  clip: AiClip,
  opts?: { smoothPasses?: number; mergeEpsilon?: number; targetFrames?: number },
): { clip: AiClip; warnings: string[] } {
  const warnings: string[] = [];
  let frames = clip.frames.map((f) => ({
    duration: f.duration,
    pose: clonePose(f.pose),
    root: f.root ? ([...f.root] as [number, number, number]) : undefined,
  }));

  const passes = clamp(opts?.smoothPasses ?? 1, 0, 4);
  for (let p = 0; p < passes; p++) {
    if (frames.length < 3) break;
    const next = frames.map((f) => ({
      duration: f.duration,
      pose: clonePose(f.pose),
      root: f.root ? ([...f.root] as [number, number, number]) : undefined,
    }));
    for (let i = 1; i < frames.length - 1; i++) {
      for (const bone of Object.keys(frames[i].pose)) {
        const a = frames[i - 1].pose[bone] ?? IDENTITY;
        const b = frames[i].pose[bone] ?? IDENTITY;
        const c = frames[i + 1].pose[bone] ?? IDENTITY;
        const mid = slerpQuat(a, c, 0.5);
        next[i].pose[bone] = slerpQuat(b, mid, 0.35);
      }
    }
    frames = next;
  }
  if (passes) warnings.push(`Applied ${passes} smooth pass(es).`);

  const eps = opts?.mergeEpsilon ?? 0.02;
  if (frames.length > 2 && eps > 0) {
    const kept: typeof frames = [frames[0]];
    for (let i = 1; i < frames.length - 1; i++) {
      const prev = kept[kept.length - 1];
      let maxDiff = 0;
      for (const bone of Object.keys(frames[i].pose)) {
        const a = prev.pose[bone] ?? IDENTITY;
        const b = frames[i].pose[bone] ?? IDENTITY;
        const d =
          Math.abs(a[0] - b[0]) +
          Math.abs(a[1] - b[1]) +
          Math.abs(a[2] - b[2]) +
          Math.abs(a[3] - b[3]);
        if (d > maxDiff) maxDiff = d;
      }
      if (maxDiff < eps) {
        prev.duration += frames[i].duration;
      } else {
        kept.push(frames[i]);
      }
    }
    kept.push(frames[frames.length - 1]);
    if (kept.length < frames.length) {
      warnings.push(`Merged ${frames.length - kept.length} near-duplicate frame(s).`);
      frames = kept;
    }
  }

  const target = opts?.targetFrames;
  if (target && target > 0 && target < frames.length) {
    const n = Math.min(MAX_FRAMES, Math.round(target));
    const out: typeof frames = [];
    for (let i = 0; i < n; i++) {
      const src = n === 1 ? 0 : Math.round((i * (frames.length - 1)) / (n - 1));
      out.push({
        duration: frames[src].duration,
        pose: clonePose(frames[src].pose),
        root: frames[src].root ? ([...frames[src].root!] as [number, number, number]) : undefined,
      });
    }
    warnings.push(`Downsampled ${frames.length} → ${n} frames.`);
    frames = out;
  }

  // Clamp durations
  for (const f of frames) {
    f.duration = clamp(f.duration, MIN_FRAME_DURATION, MAX_FRAME_DURATION);
  }

  const used = new Set<string>();
  for (const f of frames) for (const b of Object.keys(f.pose)) used.add(b);
  return {
    clip: {
      bones: POSABLE_BONES.filter((b) => used.has(b)),
      frames: frames.map((f) =>
        f.root ? { duration: f.duration, pose: f.pose, root: f.root } : { duration: f.duration, pose: f.pose },
      ),
    },
    warnings,
  };
}

/** Build a simple multi-frame clip from start/end poses (for chat scaffolding). */
export function blendPoseClip(
  from: Record<string, QuatTuple>,
  to: Record<string, QuatTuple>,
  frames = 6,
  totalDuration = 0.8,
): AiClip {
  const n = clamp(Math.round(frames), 2, MAX_FRAMES);
  const per = totalDuration / (n - 1 || 1);
  const a = { ...emptyPose(), ...from };
  const b = { ...emptyPose(), ...to };
  const out: AiClipFrame[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const pose: Record<string, QuatTuple> = {};
    for (const bone of POSABLE_BONES) {
      pose[bone] = slerpQuat(a[bone] ?? IDENTITY, b[bone] ?? IDENTITY, t);
    }
    out.push({ duration: per, pose });
  }
  return { bones: [...POSABLE_BONES], frames: out };
}

export const TOOL_CATALOG = [
  {
    id: "generate",
    path: "POST /generate",
    desc: "Text → full motion clip (Workers AI + Mixamo pose schema)",
  },
  {
    id: "edit",
    path: "POST /edit",
    desc: "Instruction-edit an existing clip",
  },
  {
    id: "pose",
    path: "POST /pose",
    desc: "Text → single key pose (or multi-frame hold)",
  },
  {
    id: "pose-from-image",
    path: "POST /pose-from-image",
    desc: "Image (base64) or image description → key pose via vision/text model",
  },
  {
    id: "ik",
    path: "POST /ik",
    desc: "Deterministic two-bone IK for arm/leg aim + bend",
  },
  {
    id: "weapon",
    path: "POST /weapon",
    desc: "Weapon style preset and/or yaw/pitch/roll angle adjust on a clip",
  },
  {
    id: "optimize",
    path: "POST /optimize",
    desc: "Smooth, merge near-duplicates, optional downsample",
  },
  {
    id: "chat",
    path: "POST /chat",
    desc: "Multi-turn chat → create/edit animation (tool-routed)",
  },
  {
    id: "clips",
    path: "GET|POST|DELETE /clips",
    desc: "Cloud clip library (D1 + R2 overflow)",
  },
] as const;
