/**
 * Typed client for the user's self-hosted AI animation Worker (Cloudflare).
 *
 * The Animator is a static, self-contained frontend with NO Replit backend and
 * NO `@workspace/*` secret code — it reaches AI + storage ONLY by calling the
 * user's Worker over HTTPS with a shared token. Both the URL and the token are
 * build-time Vite env vars (`VITE_ANIM_WORKER_URL`, `VITE_ANIM_WORKER_TOKEN`).
 *
 * Because the token ships inside a static bundle it is a shared access token, not
 * a per-user login — the Worker README documents this trade-off. Every clip the
 * Worker returns is re-validated here with {@link normalizeAiClip} before it can
 * touch the rig: we never trust the network, even though the Worker validates too.
 */
import {
  MAX_FRAMES,
  normalizeAiClip,
  resampleFramesExact,
  type AiClip,
} from "../anim/aiClipContract";

/** Fleet default (GRUDOX fleet-config animAi) when build env is unset. */
const FLEET_ANIM_AI = "https://anim-ai-worker.grudge.workers.dev";
const WORKER_URL = (
  import.meta.env.VITE_ANIM_WORKER_URL ||
  (typeof window !== "undefined"
    ? (window as unknown as { __GRUDGE_FLEET__?: { endpoints?: { animAi?: string } } }).__GRUDGE_FLEET__
        ?.endpoints?.animAi
    : "") ||
  FLEET_ANIM_AI
)
  .trim()
  .replace(/\/+$/, "");
const WORKER_TOKEN = (import.meta.env.VITE_ANIM_WORKER_TOKEN ?? "").trim();

/** True when a Worker URL has been configured at build time. */
export function workerConfigured(): boolean {
  return WORKER_URL.length > 0;
}

/** Metadata for a clip stored in the user's cloud (D1). */
export interface CloudClipMeta {
  id: string;
  name: string;
  duration: number;
  frameCount: number;
  updatedAt: number;
}

/** A friendly, user-facing error. The `.message` is safe to render in the UI. */
export class WorkerError extends Error {}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!workerConfigured()) {
    throw new WorkerError("The AI worker isn't configured yet. See the worker/README.md to deploy it.");
  }
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(WORKER_TOKEN ? { Authorization: `Bearer ${WORKER_TOKEN}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new WorkerError("Couldn't reach the AI worker. Check it's deployed and the URL is correct.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new WorkerError("The AI worker rejected the token. Check VITE_ANIM_WORKER_TOKEN matches the worker's secret.");
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const msg =
      (payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : null) ?? `The AI worker returned an error (${res.status}).`;
    throw new WorkerError(msg);
  }

  return payload as T;
}

/** Re-validate a clip received from the network before it can drive the rig. */
function trustClip(raw: unknown): AiClip {
  const norm = normalizeAiClip(raw);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "The AI returned a clip the rig can't use.");
  }
  return norm.clip;
}

/**
 * Locomotion request that shapes a generated clip: how long it should last, how
 * far the body travels, and in which direction. Sent to the Worker so the model
 * can pick an appropriate gait (the exact root motion is baked on the frontend).
 */
export interface MotionRequest {
  /** Total clip duration in seconds (0 / omitted → let the AI choose). */
  time?: number;
  /** Travel distance in world units (0 / omitted → in-place). */
  distance?: number;
  /** Travel heading in degrees (0 = forward, clockwise). */
  direction?: number;
}

/**
 * Generate a brand-new clip from a natural-language prompt.
 *
 * `frames`, when given, asks the worker (A.L.E. mode) to author EXACTLY that many
 * keyframes — e.g. a tight 8-frame pose cycle — instead of letting the model pick
 * the count. It is clamped server-side to the contract's frame cap.
 */
export async function generateClip(
  prompt: string,
  motion?: MotionRequest,
  frames?: number,
): Promise<{ clip: AiClip; warnings: string[] }> {
  const body: Record<string, unknown> = { prompt };
  if (motion) body.motion = motion;
  if (typeof frames === "number" && Number.isFinite(frames) && frames > 0) {
    body.frames = Math.round(frames);
  }
  const res = await call<{ clip: unknown }>("/generate", {
    method: "POST",
    body,
  });
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "The AI returned a clip the rig can't use.");
  }
  let clip = norm.clip;
  const warnings = norm.warnings;
  // A.L.E. mode guarantee: enforce the exact requested frame count here too, so it
  // holds even if the worker hasn't been redeployed with the matching change.
  if (typeof frames === "number" && Number.isFinite(frames) && frames > 0) {
    const n = Math.min(MAX_FRAMES, Math.round(frames));
    if (clip.frames.length !== n) {
      warnings.push(`Adjusted to exactly ${n} frames.`);
      clip = { bones: clip.bones, frames: resampleFramesExact(clip.frames, n) };
    }
  }
  return { clip, warnings };
}

/** Ask the AI to edit an existing clip given an instruction. */
export async function editClip(
  clip: AiClip,
  instruction: string,
): Promise<{ clip: AiClip; warnings: string[] }> {
  const res = await call<{ clip: unknown }>("/edit", { method: "POST", body: { clip, instruction } });
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "The AI returned a clip the rig can't use.");
  }
  return { clip: norm.clip, warnings: norm.warnings };
}

/** List the user's cloud clips (metadata only). */
export async function listCloudClips(): Promise<CloudClipMeta[]> {
  const res = await call<{ clips: CloudClipMeta[] }>("/clips");
  return Array.isArray(res.clips) ? res.clips : [];
}

/** Fetch + validate a single cloud clip by id. */
export async function getCloudClip(id: string): Promise<{ meta: CloudClipMeta; clip: AiClip }> {
  const res = await call<{ meta: CloudClipMeta; clip: unknown }>(`/clips/${encodeURIComponent(id)}`);
  return { meta: res.meta, clip: trustClip(res.clip) };
}

/** Save (create/replace) a named clip in the cloud. */
export async function saveCloudClip(name: string, clip: AiClip): Promise<CloudClipMeta> {
  const res = await call<{ meta: CloudClipMeta }>("/clips", {
    method: "POST",
    body: { name, clip },
  });
  return res.meta;
}

/** Delete a cloud clip by id. */
export async function deleteCloudClip(id: string): Promise<void> {
  await call(`/clips/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Worker health + tool ids. */
export async function workerHealth(): Promise<{
  ok: boolean;
  version?: string;
  tools?: string[];
  model?: string;
}> {
  return call("/");
}

/** Text → single key pose (1–N hold frames). */
export async function generatePose(
  prompt: string,
  opts?: { frames?: number; hold?: number },
): Promise<{ clip: AiClip; warnings: string[] }> {
  const res = await call<{ clip: unknown; warnings?: string[] }>("/pose", {
    method: "POST",
    body: { prompt, frames: opts?.frames ?? 1, hold: opts?.hold },
  });
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "Pose generation failed.");
  }
  return { clip: norm.clip, warnings: [...(res.warnings ?? []), ...norm.warnings] };
}

/** Image base64 / URL / description → pose clip. */
export async function poseFromImage(input: {
  imageBase64?: string;
  imageUrl?: string;
  description?: string;
  prompt?: string;
}): Promise<{ clip: AiClip; warnings: string[]; description?: string }> {
  const res = await call<{ clip: unknown; warnings?: string[]; description?: string }>(
    "/pose-from-image",
    { method: "POST", body: input },
  );
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "Pose-from-image failed.");
  }
  return {
    clip: norm.clip,
    warnings: [...(res.warnings ?? []), ...norm.warnings],
    description: res.description,
  };
}

export type LimbId = "rightArm" | "leftArm" | "rightLeg" | "leftLeg";

/** Deterministic two-bone IK pose. */
export async function solveIk(opts: {
  limb: LimbId;
  aimYawDeg?: number;
  aimPitchDeg?: number;
  bend?: number;
  clip?: AiClip;
}): Promise<{ clip: AiClip; warnings: string[] }> {
  const res = await call<{ clip: unknown; warnings?: string[] }>("/ik", {
    method: "POST",
    body: opts,
  });
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "IK solve failed.");
  }
  return { clip: norm.clip, warnings: [...(res.warnings ?? []), ...norm.warnings] };
}

/** Weapon preset and/or arm angle adjust. */
export async function weaponAdjust(input: {
  style?: string;
  angleDeg?: number;
  clip?: AiClip;
  yawDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
  arm?: "right" | "left" | "both";
}): Promise<{ clip: AiClip; warnings: string[] }> {
  const res = await call<{ clip: unknown; warnings?: string[] }>("/weapon", {
    method: "POST",
    body: input,
  });
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "Weapon adjust failed.");
  }
  return { clip: norm.clip, warnings: [...(res.warnings ?? []), ...norm.warnings] };
}

/** Smooth / merge / downsample clip. */
export async function optimizeClipRemote(
  clip: AiClip,
  opts?: { smoothPasses?: number; mergeEpsilon?: number; targetFrames?: number },
): Promise<{ clip: AiClip; warnings: string[] }> {
  const res = await call<{ clip: unknown; warnings?: string[] }>("/optimize", {
    method: "POST",
    body: { clip, ...opts },
  });
  const norm = normalizeAiClip(res.clip);
  if (!norm.ok || !norm.clip) {
    throw new WorkerError(norm.error ?? "Optimize failed.");
  }
  return { clip: norm.clip, warnings: [...(res.warnings ?? []), ...norm.warnings] };
}

export interface ChatResult {
  reply: string;
  action: string;
  clip: AiClip | null;
  warnings: string[];
}

/** Multi-turn chat → create / edit / IK / weapon / optimize. */
export async function chatAnim(
  message: string,
  opts?: {
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    clip?: AiClip;
  },
): Promise<ChatResult> {
  const res = await call<{
    reply?: string;
    action?: string;
    clip?: unknown;
    warnings?: string[];
  }>("/chat", {
    method: "POST",
    body: {
      message,
      history: opts?.history,
      clip: opts?.clip,
    },
  });
  let clip: AiClip | null = null;
  const warnings = [...(res.warnings ?? [])];
  if (res.clip) {
    const norm = normalizeAiClip(res.clip);
    if (norm.ok && norm.clip) {
      clip = norm.clip;
      warnings.push(...norm.warnings);
    }
  }
  return {
    reply: res.reply ?? "",
    action: res.action ?? "talk",
    clip,
    warnings,
  };
}

export function workerBaseUrl(): string {
  return WORKER_URL;
}
