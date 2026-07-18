/**
 * Engine stack SSOT (runtime) — Three.js / canvas / Rapier / VFX / AI / assets.
 *
 * Docs: docs/ENGINE_STACK_SSOT.md
 * Keep versions and hosts aligned with GrudgeBuilder grudgeConfig + grudge-ai-hub.
 */

import { FLEET } from "./fleet";

/** Pinned stack identities for diagnostics / Systems panel. */
export const ENGINE_STACK = {
  app: "@workspace/animator-app",
  three: "0.184.x",
  rapier: "0.19.x",
  postprocessing: "6.39.x",
  meshBvh: "0.8.x",
  yuka: "0.7.x",
  vite: "6.x",
  react: "19.x",
  nodeTarget: "22",
  physicsPrimary: "rapier3d-compat",
  vfxPrimary: "postprocessing",
  hud2dPrimary: "craftpix-png+css",
  /** Optional Warlords-only 2D stacks — not loaded in Open by default */
  hud2dOptional: ["pixi-v7-sprites", "spine-phaser"] as const,
} as const;

/** Production fleet hosts used by the engine (overridable via VITE_*). */
export const ENGINE_HOSTS = {
  auth: () => envStr("VITE_AUTH_GATEWAY_URL") || FLEET.auth,
  assets: () =>
    envStr("VITE_ASSET_BASE_URL") ||
    envStr("VITE_ASSETS_URL") ||
    envStr("VITE_ASSET_CDN_URL") ||
    FLEET.assets,
  definitions: () => envStr("VITE_OBJECTSTORE_URL") || FLEET.definitions,
  gameData: () => envStr("VITE_GAME_DATA_API") || FLEET.gameData,
  ai: () => envStr("VITE_AI_URL") || FLEET.ai,
  ws: () => envStr("VITE_WS_URL") || "wss://ws.grudge-studio.com",
  warlords: () => envStr("VITE_WARLORDS_URL") || "https://grudgewarlords.com",
  characterStudio: () =>
    envStr("VITE_GCS_URL") || "https://character.grudge-studio.com",
} as const;

function envStr(key: string): string {
  try {
    const v = (import.meta.env as Record<string, string | undefined>)[key];
    return typeof v === "string" && v.trim() ? v.trim().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

/**
 * AI Gateway base (Cloudflare Worker grudge-ai-hub).
 * Prefer same-origin `/api/ai` when Vercel rewrites exist; else absolute hub.
 */
/** Absolute AI hub (for health probes / admin). */
export function aiHubOrigin(): string {
  return ENGINE_HOSTS.ai();
}

/** Public AI health endpoint (no secrets) — absolute hub. */
export function aiHealthUrl(): string {
  return `${aiHubOrigin()}/health`;
}

export function aiGatewayUrl(preferSameOrigin = true): string {
  if (preferSameOrigin && typeof window !== "undefined") {
    // Same-origin proxy (vercel.json → ai.grudge-studio.com)
    return `${window.location.origin}/api/ai`;
  }
  return ENGINE_HOSTS.ai();
}

/** Same-origin AI health when rewrites are deployed; falls back to absolute hub. */
export function aiHealthUrlSameOrigin(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/ai/health`;
  }
  return aiHealthUrl();
}

/** Hub role chat URL — requires auth on Worker. */
export function aiRoleChatUrl(role: string): string {
  const r = encodeURIComponent(role.replace(/^\//, ""));
  return `${aiHubOrigin()}/v1/agents/${r}/chat`;
}

export function aiChatUrl(): string {
  return `${aiHubOrigin()}/v1/chat`;
}

export function aiImageUrl(): string {
  return `${aiHubOrigin()}/v1/image/generate`;
}

export type AiHubHealth = {
  ok: boolean;
  status?: string;
  service?: string;
  version?: string;
  providers?: Record<string, string>;
  raw?: unknown;
  error?: string;
};

/** Probe live AI hub (public). Safe for Systems / production badge. */
export async function probeAiHub(signal?: AbortSignal): Promise<AiHubHealth> {
  const urls = [
    typeof window !== "undefined" ? `${window.location.origin}/api/ai/health` : "",
    aiHealthUrl(),
  ].filter(Boolean);

  let lastErr = "AI hub unreachable";
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        mode: "cors",
        signal,
        cache: "no-store",
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const raw = (await res.json()) as {
        status?: string;
        service?: string;
        version?: string;
        providers?: Record<string, string>;
      };
      return {
        ok: raw.status === "ok" || res.ok,
        status: raw.status,
        service: raw.service,
        version: raw.version,
        providers: raw.providers,
        raw,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "AI hub unreachable";
    }
  }
  return { ok: false, error: lastErr };
}

/**
 * Best-practice engine bootstrap flags for Studio / productionRuntime.
 * Call sites may read these instead of hardcoding.
 */
export const ENGINE_PRACTICE = {
  /** Prefer WebGL2; fall back WebGL1 only if needed */
  preferWebGL2: true,
  /** Cap device pixel ratio for mobile */
  maxPixelRatio: 2,
  /** Separate fixed tick for combat/physics when heavy */
  fixedHz: 60,
  /** Dispose GPU resources on mode leave */
  disposeOnLeave: true,
  /** Load production GLB from CDN after local public candidates */
  assetCandidates: true,
  /** Rapier via vite-plugin-wasm + top-level-await */
  rapierWasm: true,
  /** HUD is DOM; do not draw Craftpix into Three as primary UI */
  hudDomOverlay: true,
  /** Heroes = Railway/campfire; units = faction catalog + explorer */
  heroesVsUnits: true,
} as const;

/** Asset path under binary CDN. */
export function cdnAssetUrl(rel: string): string {
  const base = ENGINE_HOSTS.assets().replace(/\/$/, "");
  return `${base}/${rel.replace(/^\//, "")}`;
}

/** Definition path under info catalog host. */
export function definitionUrl(rel: string): string {
  const base = ENGINE_HOSTS.definitions().replace(/\/$/, "");
  return `${base}/${rel.replace(/^\//, "")}`;
}

/** Snapshot for Systems panel / debug HUD. */
export function engineStackSnapshot(): {
  stack: typeof ENGINE_STACK;
  hosts: Record<string, string>;
  practice: typeof ENGINE_PRACTICE;
} {
  return {
    stack: ENGINE_STACK,
    hosts: {
      auth: ENGINE_HOSTS.auth(),
      assets: ENGINE_HOSTS.assets(),
      definitions: ENGINE_HOSTS.definitions(),
      gameData: ENGINE_HOSTS.gameData(),
      ai: ENGINE_HOSTS.ai(),
      ws: ENGINE_HOSTS.ws(),
      warlords: ENGINE_HOSTS.warlords(),
      characterStudio: ENGINE_HOSTS.characterStudio(),
    },
    practice: ENGINE_PRACTICE,
  };
}
