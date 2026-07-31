/**
 * Grudge Anim AI Worker — text/image → Mixamo clips + deterministic tools.
 *
 * POST /generate          { prompt, motion?, frames? }     → { clip, warnings }
 * POST /edit              { clip, instruction }            → { clip, warnings }
 * POST /pose              { prompt, frames?, hold? }       → { clip, warnings }
 * POST /pose-from-image   { imageBase64? | imageUrl? | description?, prompt? }
 * POST /ik                { limb, aimYawDeg?, aimPitchDeg?, bend?, applyToClip? }
 * POST /weapon            { style? | clip + yaw/pitch/roll }
 * POST /optimize          { clip, smoothPasses?, mergeEpsilon?, targetFrames? }
 * POST /chat              { message, history?, clip? }     → { reply, clip?, action }
 * GET  /tools                                           → tool catalog
 * GET  /health                                          → readiness
 * GET|POST|DELETE /clips                                → cloud library
 */
import {
  normalizeAiClip,
  resampleFramesExact,
  POSABLE_BONES,
  MAX_FRAMES,
  type AiClip,
} from "./clipContract";
import {
  TOOL_CATALOG,
  poseToClip,
  solveLimbIk,
  weaponPresetPose,
  adjustWeaponAngles,
  optimizeClip,
  blendPoseClip,
  type LimbId,
  type WeaponStyle,
  IDENTITY,
} from "./animTools";

export interface Env {
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
  DB: D1Database;
  CLIPS?: R2Bucket;
  SHARED_TOKEN?: string;
  AI_MODEL?: string;
  VISION_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const DEFAULT_VISION = "@cf/llava-hf/llava-1.5-7b-hf";
const INLINE_MAX_BYTES = 90_000;

interface ClipMeta {
  id: string;
  name: string;
  duration: number;
  frameCount: number;
  updatedAt: number;
}

interface ClipRow {
  id: string;
  name: string;
  frame_count: number;
  duration: number;
  payload: string | null;
  r2_key: string | null;
  updated_at: number;
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allow = (env.ALLOWED_ORIGINS ?? "*").trim();
  let allowOrigin = "*";
  if (allow !== "*" && !allow.split(",").map((s) => s.trim()).includes("*")) {
    const list = allow.split(",").map((s) => s.trim()).filter(Boolean);
    allowOrigin = origin && list.includes(origin) ? origin : list[0] ?? "*";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-auth-token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function authed(req: Request, env: Env): boolean {
  if (!env.SHARED_TOKEN) return true;
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = req.headers.get("x-auth-token")?.trim() ?? "";
  return bearer === env.SHARED_TOKEN || header === env.SHARED_TOKEN;
}

function clipDuration(clip: AiClip): number {
  return clip.frames.reduce((sum, f) => sum + f.duration, 0);
}

function metaFromRow(row: ClipRow): ClipMeta {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration,
    frameCount: row.frame_count,
    updatedAt: row.updated_at,
  };
}

interface MotionReq {
  time?: number;
  distance?: number;
  direction?: number;
}

function readMotion(raw: unknown): MotionReq | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const time = num(m.time);
  const distance = num(m.distance);
  const direction = num(m.direction);
  if (time === undefined && distance === undefined && direction === undefined) return undefined;
  return { time, distance, direction };
}

function systemPrompt(motion?: MotionReq, exactFrames?: number, mode: "clip" | "pose" = "clip"): string {
  const lines = [
    "You are an animation engine for a humanoid Mixamo rig used by Grudge Studio games.",
    "Output ONLY a single JSON object, no prose, no markdown fences.",
    mode === "pose"
      ? 'Schema: { "frames": [ { "duration": number, "pose": { boneName: [x,y,z,w] } } ] } — prefer 1–4 key poses.'
      : 'Schema: { "frames": [ { "duration": number, "pose": { boneName: [x,y,z,w] } } ] }',
    "- duration is seconds to interpolate to the NEXT frame, between 0.05 and 5.",
    `- at most ${MAX_FRAMES} frames.`,
    "- each pose value is a LOCAL-space unit quaternion [x,y,z,w] relative to the bind pose.",
    "- identity (no rotation) is [0,0,0,1]. Only include bones that move.",
    "- Prefer readable, game-ready poses (combat / loco / gesture).",
  ];
  if (exactFrames && exactFrames > 0) {
    lines.push(
      `- IMPORTANT: output EXACTLY ${exactFrames} frames — no more, no fewer.`,
    );
  }
  if (motion && ((motion.distance ?? 0) > 0 || (motion.time ?? 0) > 0)) {
    const travels = (motion.distance ?? 0) > 0;
    lines.push(
      "",
      "LOCOMOTION REQUEST — author as a clean IN-PLACE cycle (engine bakes travel):",
      travels
        ? `- Travel ${motion.distance} world units${motion.time ? ` over ${motion.time}s` : ""}. Looping gait; first≈last pose.`
        : `- Hold about ${motion.time}s total.`,
      travels
        ? "- Alternating leg swing, arm counterswing, subtle hip bob."
        : "- Grounded, balanced, exaggerated keys.",
    );
  }
  lines.push("Allowed bones:", POSABLE_BONES.join(", "));
  return lines.join("\n");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* brace scan */
  }
  const start = trimmed.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === "{") depth++;
    else if (trimmed[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function runModel(env: Env, system: string, user: string): Promise<unknown> {
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const out = (await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 4096,
  })) as { response?: string } | string;
  const text = typeof out === "string" ? out : out.response ?? "";
  return extractJson(text);
}

async function runVision(
  env: Env,
  imageBase64: string,
  prompt: string,
): Promise<string> {
  const model = env.VISION_MODEL || DEFAULT_VISION;
  // Strip data-url prefix if present
  const b64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  try {
    const out = (await env.AI.run(model, {
      image: [...Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))],
      prompt:
        prompt ||
        "Describe the human pose in detail for animation: limb angles, torso lean, head direction, weight shift. Be precise.",
      max_tokens: 512,
    })) as { description?: string; response?: string } | string;
    if (typeof out === "string") return out;
    return out.description || out.response || "";
  } catch {
    // Fallback: some models want image as base64 string field
    const out = (await env.AI.run(model, {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                prompt ||
                "Describe this human pose for a Mixamo skeleton: arm/leg bends, torso, head.",
            },
            { type: "image", image: b64 },
          ],
        },
      ],
    })) as { response?: string } | string;
    return typeof out === "string" ? out : out.response ?? "";
  }
}

async function handleGenerate(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | { prompt?: unknown; motion?: unknown; frames?: unknown }
    | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "Missing prompt." }, 400, cors);
  const motion = readMotion(body?.motion);
  const exactFrames =
    typeof body?.frames === "number" && Number.isFinite(body.frames)
      ? Math.max(1, Math.min(MAX_FRAMES, Math.round(body.frames)))
      : undefined;

  const userMsg = [
    motion
      ? [
          `Create this motion: ${prompt}`,
          (motion.distance ?? 0) > 0
            ? `Travel ${motion.distance} units${motion.time ? ` over ${motion.time}s` : ""} — in-place looping gait.`
            : motion.time
              ? `Hold about ${motion.time}s total.`
              : "",
        ]
          .filter(Boolean)
          .join("\n")
      : `Create this motion: ${prompt}`,
    exactFrames ? `Return EXACTLY ${exactFrames} keyframes.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await runModel(env, systemPrompt(motion, exactFrames), userMsg);
  const norm = normalizeAiClip(raw);
  if (!norm.ok || !norm.clip) {
    return json({ error: norm.error ?? "The model produced an unusable clip." }, 422, cors);
  }
  let clip = norm.clip;
  const warnings = [...norm.warnings];
  if (exactFrames && clip.frames.length !== exactFrames) {
    warnings.push(`Resampled ${clip.frames.length} frame(s) to exactly ${exactFrames}.`);
    clip = { bones: clip.bones, frames: resampleFramesExact(clip.frames, exactFrames) };
  }
  return json({ clip, warnings }, 200, cors);
}

async function handleEdit(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { clip?: unknown; instruction?: unknown } | null;
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) return json({ error: "Missing instruction." }, 400, cors);
  const base = normalizeAiClip(body?.clip);
  if (!base.ok || !base.clip) {
    return json({ error: base.error ?? "The clip to edit is invalid." }, 400, cors);
  }
  const user = [
    "Current clip JSON:",
    JSON.stringify({ frames: base.clip.frames }),
    "",
    `Apply this change and return the FULL updated clip JSON: ${instruction}`,
  ].join("\n");
  const raw = await runModel(env, systemPrompt(), user);
  const norm = normalizeAiClip(raw);
  if (!norm.ok || !norm.clip) {
    return json({ error: norm.error ?? "The model produced an unusable clip." }, 422, cors);
  }
  return json({ clip: norm.clip, warnings: norm.warnings }, 200, cors);
}

async function handlePose(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    prompt?: unknown;
    frames?: unknown;
    hold?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "Missing prompt." }, 400, cors);
  const exactFrames =
    typeof body?.frames === "number" && Number.isFinite(body.frames)
      ? Math.max(1, Math.min(8, Math.round(body.frames)))
      : 1;
  const hold = typeof body?.hold === "number" && body.hold > 0 ? body.hold : 0.5;

  const raw = await runModel(
    env,
    systemPrompt(undefined, exactFrames, "pose"),
    `Create a single readable KEY POSE (or short hold sequence) for: ${prompt}. Exactly ${exactFrames} frame(s), duration ~${hold}s each.`,
  );
  const norm = normalizeAiClip(raw);
  if (!norm.ok || !norm.clip) {
    return json({ error: norm.error ?? "Could not produce a pose." }, 422, cors);
  }
  let clip = norm.clip;
  const warnings = [...norm.warnings];
  if (clip.frames.length !== exactFrames) {
    warnings.push(`Resampled to ${exactFrames} pose frame(s).`);
    clip = { bones: clip.bones, frames: resampleFramesExact(clip.frames, exactFrames) };
  }
  return json({ clip, warnings, kind: "pose" }, 200, cors);
}

async function handlePoseFromImage(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    imageBase64?: unknown;
    imageUrl?: unknown;
    description?: unknown;
    prompt?: unknown;
  } | null;

  let description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const extra = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!description && typeof body?.imageBase64 === "string" && body.imageBase64.length > 32) {
    description = await runVision(env, body.imageBase64, extra);
  } else if (!description && typeof body?.imageUrl === "string") {
    try {
      const imgRes = await fetch(body.imageUrl);
      if (!imgRes.ok) throw new Error("image fetch failed");
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      const b64 = btoa(binary);
      description = await runVision(env, b64, extra);
    } catch (e) {
      return json(
        { error: `Could not fetch/analyze image: ${(e as Error).message}` },
        400,
        cors,
      );
    }
  }

  if (!description) {
    return json(
      { error: "Provide imageBase64, imageUrl, or description of the pose." },
      400,
      cors,
    );
  }

  const user = [
    "Convert this human pose description into a Mixamo key pose JSON clip (1–3 frames):",
    description,
    extra ? `Additional direction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await runModel(env, systemPrompt(undefined, 2, "pose"), user);
  const norm = normalizeAiClip(raw);
  if (!norm.ok || !norm.clip) {
    return json(
      {
        error: norm.error ?? "Vision/pose conversion failed.",
        description,
      },
      422,
      cors,
    );
  }
  return json(
    { clip: norm.clip, warnings: norm.warnings, description, kind: "pose-from-image" },
    200,
    cors,
  );
}

async function handleIk(req: Request, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    limb?: unknown;
    aimYawDeg?: unknown;
    aimPitchDeg?: unknown;
    bend?: unknown;
    clip?: unknown;
  } | null;

  const limbRaw = typeof body?.limb === "string" ? body.limb : "rightArm";
  const limbs: LimbId[] = ["rightArm", "leftArm", "rightLeg", "leftLeg"];
  if (!limbs.includes(limbRaw as LimbId)) {
    return json({ error: `limb must be one of: ${limbs.join(", ")}` }, 400, cors);
  }
  const limb = limbRaw as LimbId;
  const aimYawDeg = typeof body?.aimYawDeg === "number" ? body.aimYawDeg : 0;
  const aimPitchDeg = typeof body?.aimPitchDeg === "number" ? body.aimPitchDeg : 0;
  const bend = typeof body?.bend === "number" ? body.bend : 0.45;

  let basePose: Record<string, [number, number, number, number]> | undefined;
  if (body?.clip) {
    const base = normalizeAiClip(body.clip);
    if (base.ok && base.clip?.frames[0]) {
      basePose = base.clip.frames[0].pose as Record<string, [number, number, number, number]>;
    }
  }

  const pose = solveLimbIk({ limb, aimYawDeg, aimPitchDeg, bend, basePose });
  const clip = poseToClip(pose, 0.4);
  const norm = normalizeAiClip(clip);
  return json(
    {
      clip: norm.clip,
      warnings: norm.warnings,
      kind: "ik",
      limb,
      aimYawDeg,
      aimPitchDeg,
      bend,
    },
    200,
    cors,
  );
}

async function handleWeapon(req: Request, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    style?: unknown;
    angleDeg?: unknown;
    clip?: unknown;
    yawDeg?: unknown;
    pitchDeg?: unknown;
    rollDeg?: unknown;
    arm?: unknown;
  } | null;

  const warnings: string[] = [];
  let clip: AiClip | null = null;

  if (typeof body?.style === "string") {
    const styles: WeaponStyle[] = [
      "sword_guard",
      "sword_overhead",
      "sword_slash_r",
      "sword_slash_l",
      "spear_thrust",
      "bow_draw",
      "rifle_aim",
      "pistol_aim",
      "staff_cast",
      "twohand_high",
    ];
    if (!styles.includes(body.style as WeaponStyle)) {
      return json({ error: `style must be one of: ${styles.join(", ")}` }, 400, cors);
    }
    const angle = typeof body.angleDeg === "number" ? body.angleDeg : 0;
    const pose = weaponPresetPose(body.style as WeaponStyle, angle);
    const built = poseToClip(pose, 0.35);
    const norm = normalizeAiClip(built);
    clip = norm.clip;
    warnings.push(...norm.warnings, `Weapon preset: ${body.style}`);
  } else if (body?.clip) {
    const base = normalizeAiClip(body.clip);
    if (!base.ok || !base.clip) {
      return json({ error: base.error ?? "Invalid clip." }, 400, cors);
    }
    clip = adjustWeaponAngles(base.clip, {
      yawDeg: typeof body.yawDeg === "number" ? body.yawDeg : 0,
      pitchDeg: typeof body.pitchDeg === "number" ? body.pitchDeg : 0,
      rollDeg: typeof body.rollDeg === "number" ? body.rollDeg : 0,
      arm:
        body.arm === "left" || body.arm === "both" || body.arm === "right"
          ? body.arm
          : "right",
    });
    warnings.push("Applied weapon angle offset to arm chain.");
  } else {
    return json(
      {
        error: "Provide style (preset) or clip + yawDeg/pitchDeg/rollDeg.",
        styles: [
          "sword_guard",
          "sword_overhead",
          "sword_slash_r",
          "sword_slash_l",
          "spear_thrust",
          "bow_draw",
          "rifle_aim",
          "pistol_aim",
          "staff_cast",
          "twohand_high",
        ],
      },
      400,
      cors,
    );
  }

  // Optional secondary angle adjust after preset
  if (clip && (body?.yawDeg || body?.pitchDeg || body?.rollDeg) && body?.style) {
    clip = adjustWeaponAngles(clip, {
      yawDeg: typeof body.yawDeg === "number" ? body.yawDeg : 0,
      pitchDeg: typeof body.pitchDeg === "number" ? body.pitchDeg : 0,
      rollDeg: typeof body.rollDeg === "number" ? body.rollDeg : 0,
    });
  }

  const final = normalizeAiClip(clip);
  return json({ clip: final.clip, warnings: [...warnings, ...final.warnings], kind: "weapon" }, 200, cors);
}

async function handleOptimize(req: Request, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    clip?: unknown;
    smoothPasses?: unknown;
    mergeEpsilon?: unknown;
    targetFrames?: unknown;
  } | null;
  const base = normalizeAiClip(body?.clip);
  if (!base.ok || !base.clip) {
    return json({ error: base.error ?? "Invalid clip." }, 400, cors);
  }
  const result = optimizeClip(base.clip, {
    smoothPasses: typeof body?.smoothPasses === "number" ? body.smoothPasses : 1,
    mergeEpsilon: typeof body?.mergeEpsilon === "number" ? body.mergeEpsilon : 0.02,
    targetFrames: typeof body?.targetFrames === "number" ? body.targetFrames : undefined,
  });
  const norm = normalizeAiClip(result.clip);
  return json(
    {
      clip: norm.clip,
      warnings: [...result.warnings, ...norm.warnings],
      kind: "optimize",
    },
    200,
    cors,
  );
}

type ChatMsg = { role: "user" | "assistant"; content: string };

async function handleChat(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
    history?: unknown;
    clip?: unknown;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "Missing message." }, 400, cors);

  const history: ChatMsg[] = Array.isArray(body?.history)
    ? (body!.history as unknown[])
        .filter(
          (h): h is ChatMsg =>
            !!h &&
            typeof h === "object" &&
            ((h as ChatMsg).role === "user" || (h as ChatMsg).role === "assistant") &&
            typeof (h as ChatMsg).content === "string",
        )
        .slice(-12)
    : [];

  const lower = message.toLowerCase();
  let action:
    | "generate"
    | "edit"
    | "pose"
    | "ik"
    | "weapon"
    | "optimize"
    | "talk" = "generate";
  if (/\b(optim|smooth|clean|reduce frames?)\b/.test(lower)) action = "optimize";
  else if (/\b(ik|aim arm|point arm|reach|kick angle)\b/.test(lower)) action = "ik";
  else if (/\b(weapon|sword|bow|rifle|guard|slash|thrust|aim)\b/.test(lower) && !/\bwalk|run|jump\b/.test(lower))
    action = "weapon";
  else if (/\b(pose only|hold pose|key pose|t-pose|idle pose)\b/.test(lower)) action = "pose";
  else if (/\b(edit|change|make it|more|less|bigger|smaller|faster|slower)\b/.test(lower) && body?.clip)
    action = "edit";

  const baseClip = body?.clip ? normalizeAiClip(body.clip) : null;
  const warnings: string[] = [];
  let clip: AiClip | null = null;
  let reply = "";

  try {
    if (action === "optimize" && baseClip?.ok && baseClip.clip) {
      const r = optimizeClip(baseClip.clip, { smoothPasses: 2, mergeEpsilon: 0.025 });
      clip = r.clip;
      warnings.push(...r.warnings);
      reply = `Optimized the clip (${clip.frames.length} frames). ${r.warnings.join(" ")}`;
    } else if (action === "ik") {
      const limb: LimbId = /\bleft\b/.test(lower)
        ? /\bleg|kick\b/.test(lower)
          ? "leftLeg"
          : "leftArm"
        : /\bleg|kick\b/.test(lower)
          ? "rightLeg"
          : "rightArm";
      const pitch = /\bup\b/.test(lower) ? 35 : /\bdown\b/.test(lower) ? -25 : 10;
      const yaw = /\bright\b/.test(lower) ? 40 : /\bleft\b/.test(lower) ? -40 : 0;
      const pose = solveLimbIk({ limb, aimYawDeg: yaw, aimPitchDeg: pitch, bend: 0.5 });
      clip = poseToClip(pose);
      reply = `Applied IK on ${limb} (yaw ${yaw}°, pitch ${pitch}°). Tweak in the frame editor.`;
    } else if (action === "weapon") {
      let style: WeaponStyle = "sword_guard";
      if (/overhead|high/.test(lower)) style = "sword_overhead";
      else if (/slash.*left|left slash/.test(lower)) style = "sword_slash_l";
      else if (/slash/.test(lower)) style = "sword_slash_r";
      else if (/spear|thrust/.test(lower)) style = "spear_thrust";
      else if (/bow/.test(lower)) style = "bow_draw";
      else if (/rifle|gun/.test(lower)) style = "rifle_aim";
      else if (/pistol/.test(lower)) style = "pistol_aim";
      else if (/staff|cast|magic/.test(lower)) style = "staff_cast";
      else if (/two.?hand|2h/.test(lower)) style = "twohand_high";
      clip = poseToClip(weaponPresetPose(style, 0));
      reply = `Loaded weapon preset **${style}**. Say “raise 15 degrees” or use Weapon tools for fine angles.`;
    } else if (action === "pose") {
      const raw = await runModel(
        env,
        systemPrompt(undefined, 1, "pose"),
        `Key pose only: ${message}`,
      );
      const norm = normalizeAiClip(raw);
      if (norm.ok && norm.clip) {
        clip = norm.clip;
        warnings.push(...norm.warnings);
        reply = `Created a key pose (${clip.frames.length} frame).`;
      } else {
        reply = "Could not build that pose — try a clearer description.";
        action = "talk";
      }
    } else if (action === "edit" && baseClip?.ok && baseClip.clip) {
      const raw = await runModel(
        env,
        systemPrompt(),
        [
          "Current clip:",
          JSON.stringify({ frames: baseClip.clip.frames.slice(0, 12) }),
          `Edit: ${message}`,
          "Return full updated clip JSON.",
        ].join("\n"),
      );
      const norm = normalizeAiClip(raw);
      if (norm.ok && norm.clip) {
        clip = norm.clip;
        warnings.push(...norm.warnings);
        reply = `Edited clip → ${clip.frames.length} frames.`;
      } else {
        reply = "Edit failed to produce a valid clip.";
        action = "talk";
      }
    } else if (action === "generate" || action === "edit") {
      // Default: generate motion from chat text
      const hist = history
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n")
        .slice(-1500);
      const raw = await runModel(
        env,
        systemPrompt(),
        [
          hist ? `Conversation so far:\n${hist}\n` : "",
          `Create a playable Mixamo animation for: ${message}`,
          "Return clip JSON only in your model response path.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      const norm = normalizeAiClip(raw);
      if (norm.ok && norm.clip) {
        clip = norm.clip;
        warnings.push(...norm.warnings);
        reply = `Generated motion with ${clip.frames.length} frames on ${clip.bones.length} bones. Preview, then Save locally or to cloud.`;
        action = "generate";
      } else {
        // Friendly talk fallback
        const talk = (await env.AI.run(env.AI_MODEL || DEFAULT_MODEL, {
          messages: [
            {
              role: "system",
              content:
                "You help Grudge Studio designers create character animations. Be concise. Suggest prompts for /generate, IK limbs, weapon styles.",
            },
            ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
            { role: "user", content: message },
          ],
          max_tokens: 400,
        })) as { response?: string } | string;
        reply =
          typeof talk === "string"
            ? talk
            : talk.response ||
              "Try: “confident sword idle”, “walk cycle”, “rifle aim”, or “IK right arm up”.";
        action = "talk";
      }
    }
  } catch (e) {
    return json({ error: `Chat failed: ${(e as Error).message}` }, 500, cors);
  }

  // Ensure unused import doesn't tree-shake blend — available for future
  void blendPoseClip;
  void IDENTITY;

  return json(
    {
      reply,
      action,
      clip,
      warnings,
      kind: "chat",
    },
    200,
    cors,
  );
}

async function handleList(env: Env, cors: Record<string, string>): Promise<Response> {
  const res = await env.DB.prepare(
    "SELECT id, name, frame_count, duration, payload, r2_key, updated_at FROM clips ORDER BY updated_at DESC LIMIT 500",
  ).all<ClipRow>();
  const clips = (res.results ?? []).map(metaFromRow);
  return json({ clips }, 200, cors);
}

async function handleGet(env: Env, id: string, cors: Record<string, string>): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT id, name, frame_count, duration, payload, r2_key, updated_at FROM clips WHERE id = ?",
  )
    .bind(id)
    .first<ClipRow>();
  if (!row) return json({ error: "Clip not found." }, 404, cors);

  let payload = row.payload;
  if (!payload && row.r2_key && env.CLIPS) {
    const obj = await env.CLIPS.get(row.r2_key);
    payload = obj ? await obj.text() : null;
  }
  if (!payload) return json({ error: "Clip payload missing." }, 410, cors);

  const norm = normalizeAiClip(JSON.parse(payload));
  if (!norm.ok || !norm.clip) return json({ error: "Stored clip is corrupt." }, 410, cors);

  return json({ meta: metaFromRow(row), clip: norm.clip }, 200, cors);
}

async function handleSave(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { name?: unknown; clip?: unknown; id?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return json({ error: "Missing clip name." }, 400, cors);

  const norm = normalizeAiClip(body?.clip);
  if (!norm.ok || !norm.clip) {
    return json({ error: norm.error ?? "Clip is invalid." }, 400, cors);
  }

  const id = typeof body?.id === "string" && body.id ? body.id : crypto.randomUUID();
  const payload = JSON.stringify(norm.clip);
  const bytes = new TextEncoder().encode(payload).length;
  const duration = clipDuration(norm.clip);
  const frameCount = norm.clip.frames.length;
  const updatedAt = Date.now();

  let inlinePayload: string | null = payload;
  let r2Key: string | null = null;
  if (bytes > INLINE_MAX_BYTES) {
    if (!env.CLIPS) {
      return json({ error: "Clip is too large and no R2 bucket is configured." }, 413, cors);
    }
    r2Key = `clips/${id}.json`;
    await env.CLIPS.put(r2Key, payload, { httpMetadata: { contentType: "application/json" } });
    inlinePayload = null;
  } else if (env.CLIPS) {
    await env.CLIPS.delete(`clips/${id}.json`).catch(() => {});
  }

  await env.DB.prepare(
    "INSERT INTO clips (id, name, frame_count, duration, payload, r2_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET name=excluded.name, frame_count=excluded.frame_count, duration=excluded.duration, payload=excluded.payload, r2_key=excluded.r2_key, updated_at=excluded.updated_at",
  )
    .bind(id, name, frameCount, duration, inlinePayload, r2Key, updatedAt)
    .run();

  return json({ meta: { id, name, duration, frameCount, updatedAt } satisfies ClipMeta }, 200, cors);
}

async function handleDelete(env: Env, id: string, cors: Record<string, string>): Promise<Response> {
  const row = await env.DB.prepare("SELECT r2_key FROM clips WHERE id = ?").bind(id).first<{ r2_key: string | null }>();
  if (row?.r2_key && env.CLIPS) await env.CLIPS.delete(row.r2_key).catch(() => {});
  await env.DB.prepare("DELETE FROM clips WHERE id = ?").bind(id).run();
  return json({ ok: true }, 200, cors);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin");
    const cors = corsHeaders(env, origin);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!authed(req, env)) {
      return json({ error: "Unauthorized." }, 401, cors);
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (req.method === "GET" && (path === "/" || path === "/health")) {
        return json(
          {
            ok: true,
            service: "anim-ai-worker",
            version: "2.0.0",
            tools: TOOL_CATALOG.map((t) => t.id),
            model: env.AI_MODEL || DEFAULT_MODEL,
          },
          200,
          cors,
        );
      }
      if (req.method === "GET" && path === "/tools") {
        return json({ tools: TOOL_CATALOG }, 200, cors);
      }

      if (req.method === "POST" && path === "/generate") return await handleGenerate(req, env, cors);
      if (req.method === "POST" && path === "/edit") return await handleEdit(req, env, cors);
      if (req.method === "POST" && path === "/pose") return await handlePose(req, env, cors);
      if (req.method === "POST" && path === "/pose-from-image")
        return await handlePoseFromImage(req, env, cors);
      if (req.method === "POST" && path === "/ik") return await handleIk(req, cors);
      if (req.method === "POST" && path === "/weapon") return await handleWeapon(req, cors);
      if (req.method === "POST" && path === "/optimize") return await handleOptimize(req, cors);
      if (req.method === "POST" && path === "/chat") return await handleChat(req, env, cors);

      if (req.method === "GET" && path === "/clips") return await handleList(env, cors);
      if (req.method === "POST" && path === "/clips") return await handleSave(req, env, cors);

      const clipMatch = path.match(/^\/clips\/([^/]+)$/);
      if (clipMatch) {
        const id = decodeURIComponent(clipMatch[1]);
        if (req.method === "GET") return await handleGet(env, id, cors);
        if (req.method === "DELETE") return await handleDelete(env, id, cors);
      }

      return json({ error: "Not found.", tools: TOOL_CATALOG.map((t) => t.path) }, 404, cors);
    } catch (err) {
      return json({ error: `Worker error: ${(err as Error).message}` }, 500, cors);
    }
  },
};
