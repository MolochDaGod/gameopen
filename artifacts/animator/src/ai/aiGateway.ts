/**
 * Fleet AI Gateway client — grudge-ai-hub (ai.grudge-studio.com).
 *
 * Complements the monorepo `/api/openai/*` assistant stream (Clerk/Orval path).
 * Prefer this for production companion / role chat / image when the SPA
 * should hit the Cloudflare Worker SSOT directly or via /api/ai rewrite.
 *
 * SSOT: docs/ENGINE_STACK_SSOT.md · lib/engineStack.ts · grudge-ai-hub README
 */

import {
  aiChatUrl,
  aiGatewayUrl,
  aiHealthUrl,
  aiImageUrl,
  aiRoleChatUrl,
  probeAiHub,
  type AiHubHealth,
} from "../lib/engineStack";
import { FLEET_TOKEN_KEYS } from "../lib/fleet";
import { getStoredToken } from "../lib/grudgeAuth";

export type { AiHubHealth };
export { probeAiHub, aiHealthUrl, aiChatUrl, aiRoleChatUrl, aiImageUrl };

export type FleetAiRole =
  | "general"
  | "dev"
  | "balance"
  | "lore"
  | "art"
  | "mission"
  | "companion"
  | "faction"
  | string;

/**
 * JWT for AI hub. Prefer Open's grudgeAuth store (grudge.open.token + fleet keys).
 * Previous bug: only scanned FLEET_TOKEN_KEYS without grudge.open.token → signed-in
 * Open users still got "AI gateway auth failed".
 */
function readFleetToken(): string | null {
  try {
    const t = getStoredToken();
    if (t) return t;
  } catch {
    /* private mode */
  }
  if (typeof localStorage === "undefined") return null;
  for (const k of FLEET_TOKEN_KEYS) {
    try {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return v;
    } catch {
      /* private mode */
    }
  }
  return null;
}

function authHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  const token = readFleetToken();
  if (token) h.set("Authorization", `Bearer ${token}`);
  return h;
}

export type FleetChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type FleetChatResult = {
  ok: boolean;
  text?: string;
  raw?: unknown;
  error?: string;
  status?: number;
};

/**
 * Role chat against AI hub. Tries absolute hub first (CORS allowlisted for
 * *.grudge-studio.com), then same-origin /api/ai proxy.
 */
export async function fleetRoleChat(
  role: FleetAiRole,
  messages: FleetChatMessage[],
  opts?: { signal?: AbortSignal; model?: string },
): Promise<FleetChatResult> {
  const body = JSON.stringify({
    messages,
    model: opts?.model,
  });
  // Prefer same-origin /api/ai (Vercel rewrite) first — no CORS / no cookie issues.
  // Absolute hub second (ai.grudge-studio.com is healthy but needs CORS + auth).
  const candidates = [
    `${aiGatewayUrl(true)}/v1/agents/${encodeURIComponent(role)}/chat`,
    `${aiGatewayUrl(true)}/v1/chat`,
    aiRoleChatUrl(role),
    aiChatUrl(),
  ];

  let lastErr = "AI gateway unreachable";
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body,
        signal: opts?.signal,
        mode: "cors",
        credentials: "omit",
      });
      if (res.status === 401 || res.status === 403) {
        const hasToken = !!readFleetToken();
        return {
          ok: false,
          status: res.status,
          error: hasToken
            ? "AI gateway rejected session — re-sign in with Grudge ID (token expired or wrong issuer)"
            : "AI gateway auth failed — sign in with Grudge ID (no fleet JWT in browser)",
        };
      }
      if (!res.ok) {
        lastErr = `HTTP ${res.status} @ ${url}`;
        continue;
      }
      const raw = (await res.json()) as {
        content?: string;
        text?: string;
        message?: { content?: string };
        choices?: Array<{ message?: { content?: string } }>;
        error?: string;
      };
      const text =
        raw.content ||
        raw.text ||
        raw.message?.content ||
        raw.choices?.[0]?.message?.content ||
        "";
      if (!text && raw.error) {
        return { ok: false, error: raw.error, raw, status: res.status };
      }
      return { ok: true, text: text || JSON.stringify(raw), raw, status: res.status };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "fetch failed";
    }
  }
  return { ok: false, error: lastErr };
}

/** Companion shortcut used by in-game assistant surfaces. */
export async function fleetCompanionChat(
  userText: string,
  system?: string,
  signal?: AbortSignal,
): Promise<FleetChatResult> {
  const messages: FleetChatMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: userText });
  return fleetRoleChat("companion", messages, { signal });
}

/** Image generate via hub (auth required). */
export async function fleetGenerateImage(
  prompt: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch(aiImageUrl(), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ prompt }),
      signal,
      mode: "cors",
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401
            ? "Sign in to generate images"
            : `Image gen HTTP ${res.status}`,
      };
    }
    const raw = (await res.json()) as {
      url?: string;
      dataUrl?: string;
      image?: string;
    };
    const url = raw.url || raw.dataUrl || raw.image;
    if (!url) return { ok: false, error: "No image in response" };
    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Image gen failed",
    };
  }
}
