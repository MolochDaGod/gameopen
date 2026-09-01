/**
 * Assistant streaming client.
 *
 * Primary path: monorepo `/api/openai/conversations/:id/messages` (SSE + tools)
 * when the gameopen-api Railway process is healthy.
 *
 * Production fallback (Open launcher): Cloudflare grudge-ai-hub via same-origin
 * `/api/ai` rewrite → ai.grudge-studio.com. Tool calls are executed client-side
 * against the live Dressing Room / Danger engine (admin-of-the-page contract).
 */
import type { AiTool, ToolCall } from "./types";
import { fleetRoleChat, type FleetChatMessage } from "./aiGateway";
import { FLEET_TOKEN_KEYS } from "../lib/fleet";

export interface StreamHandlers {
  /** A streamed natural-language text delta. */
  onText: (delta: string) => void;
  /** The single batch of tool calls the model issued this turn (awaited). */
  onToolCalls: (calls: ToolCall[]) => void | Promise<void>;
  /** A mid-stream server-side error event. */
  onError: (message: string) => void;
  /** The stream finished normally. */
  onDone: () => void;
}

/**
 * Result of a stream attempt. `not_found` means the conversation no longer
 * exists server-side (so the caller can transparently start a fresh one);
 * `failed` is a transport/HTTP failure; `ok` is a normal completion (which may
 * still have surfaced a mid-stream error via `onError`).
 */
export type StreamOutcome = "ok" | "not_found" | "failed";

/** Map our client tool registry into OpenAI function-tool definitions. */
function toToolDefs(tools: AiTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function readFleetToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  for (const k of FLEET_TOKEN_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v) return v;
    } catch {
      /* private mode */
    }
  }
  return null;
}

/**
 * Send a user message and stream the assistant response. Resolves when the
 * stream ends (after invoking the relevant handlers along the way).
 */
export async function streamAssistant(
  conversationId: number,
  body: { content: string; system: string; tools: AiTool[] },
  handlers: StreamHandlers,
  signal?: AbortSignal,
  getToken?: () => Promise<string | null>,
): Promise<StreamOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (getToken) {
    try {
      const token = await getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {
      /* fall through */
    }
  }
  // Prefer Grudge fleet JWT when Clerk is absent (production Open).
  if (!headers["Authorization"]) {
    const fleet = readFleetToken();
    if (fleet) headers["Authorization"] = `Bearer ${fleet}`;
  }

  let res: Response | null = null;
  try {
    res = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        content: body.content,
        system: body.system,
        tools: toToolDefs(body.tools),
      }),
      signal,
    });
  } catch {
    return signal?.aborted ? "ok" : "failed";
  }

  // Open production often 404s openai routes — fall through to Cloudflare hub.
  if (res.status === 404 || res.status === 502 || res.status === 503) {
    return fleetAssistantTurn(body, handlers, signal);
  }
  if (res.status === 401 || res.status === 403) {
    // Still try fleet — hub accepts grudge JWT and can answer unauthenticated with limits.
    const fleet = await fleetAssistantTurn(body, handlers, signal);
    if (fleet === "ok") return "ok";
    handlers.onError("Sign in with Grudge ID to use the page AI assistant.");
    return "failed";
  }
  if (!res.ok || !res.body) {
    return fleetAssistantTurn(body, handlers, signal);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      break;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const line = evt.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let parsed: {
        content?: string;
        toolCalls?: ToolCall[];
        error?: string;
        done?: boolean;
      };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      if (parsed.content) handlers.onText(parsed.content);
      else if (parsed.toolCalls) await handlers.onToolCalls(parsed.toolCalls);
      else if (parsed.error) handlers.onError(parsed.error);
      else if (parsed.done) handlers.onDone();
    }
  }

  handlers.onDone();
  return "ok";
}

/**
 * Cloudflare grudge-ai-hub path (same-origin /api/ai → ai.grudge-studio.com).
 * Implements a tool-calling contract the model can satisfy with a JSON block;
 * tools run in the browser against the live EditorScene / Studio (page admin).
 */
async function fleetAssistantTurn(
  body: { content: string; system: string; tools: AiTool[] },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  const toolCatalog = body.tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const system = [
    body.system,
    "",
    "You are the PAGE ADMIN assistant for Grudge Open (Dressing Room / Danger).",
    "You may execute tools against the live 3D engine. When you need to act, reply with ONLY a JSON object:",
    '{"tool_calls":[{"name":"tool_name","arguments":{...}}],"message":"optional short note"}',
    "When answering without acting, reply with plain natural language (no JSON).",
    "Never invent tool names — use only this catalog:",
    JSON.stringify(toolCatalog, null, 0),
  ].join("\n");

  const messages: FleetChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: body.content },
  ];

  // Prefer 3d/dev agents for Dressing Room admin tools; companion last.
  let result = await fleetRoleChat("3d", messages, { signal });
  if (!result.ok) result = await fleetRoleChat("dev", messages, { signal });
  if (!result.ok) result = await fleetRoleChat("companion", messages, { signal });
  if (!result.ok) {
    handlers.onError(
      result.error ||
        "Cloudflare AI hub unreachable. Check /api/ai/health and Grudge ID sign-in.",
    );
    return "failed";
  }

  const text = (result.text || "").trim();
  const parsed = tryParseToolPayload(text);
  if (parsed?.tool_calls?.length) {
    if (parsed.message) handlers.onText(parsed.message);
    const calls: ToolCall[] = parsed.tool_calls.map((c) => ({
      name: String(c.name || ""),
      arguments:
        typeof c.arguments === "string"
          ? c.arguments
          : JSON.stringify(c.arguments ?? {}),
    }));
    await handlers.onToolCalls(calls);

    // One follow-up turn so the model can confirm results in natural language.
    let follow = await fleetRoleChat(
      "3d",
      [
        ...messages,
        { role: "assistant", content: text },
        {
          role: "user",
          content:
            "Tools ran. Reply in one short natural sentence confirming what you did. No JSON.",
        },
      ],
      { signal },
    );
    if (!follow.ok) {
      follow = await fleetRoleChat(
        "companion",
        [
          ...messages,
          { role: "assistant", content: text },
          {
            role: "user",
            content:
              "Tools ran. Reply in one short natural sentence confirming what you did. No JSON.",
          },
        ],
        { signal },
      );
    }
    if (follow.ok && follow.text) handlers.onText(follow.text);
  } else {
    handlers.onText(text);
  }
  handlers.onDone();
  return "ok";
}

function tryParseToolPayload(text: string): {
  tool_calls?: Array<{ name?: string; arguments?: unknown }>;
  message?: string;
} | null {
  // Full JSON reply
  try {
    const j = JSON.parse(text);
    if (j && Array.isArray(j.tool_calls)) return j;
  } catch {
    /* try fence extract */
  }
  // Fenced ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const j = JSON.parse(fence[1]!.trim());
      if (j && Array.isArray(j.tool_calls)) return j;
    } catch {
      /* ignore */
    }
  }
  // Inline first { ... tool_calls ... }
  const brace = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (brace >= 0 && last > brace) {
    try {
      const j = JSON.parse(text.slice(brace, last + 1));
      if (j && Array.isArray(j.tool_calls)) return j;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Lightweight fleet-only chat (no conversation id) — used when OpenAI convo
 * create fails so the FAB still works as page admin.
 */
export async function streamAssistantFleetOnly(
  body: { content: string; system: string; tools: AiTool[] },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<StreamOutcome> {
  return fleetAssistantTurn(body, handlers, signal);
}
