/**
 * Conversation lifecycle + streaming orchestration for the assistant.
 *
 * Production Open: prefer Cloudflare grudge-ai-hub (`/api/ai` → ai.grudge-studio.com)
 * when `/api/openai/conversations` is unavailable (common on the SPA host).
 * Tools always execute client-side against the live engine (page admin).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalAuth } from "../auth/clerkOptional";
import {
  createOpenaiConversation,
  getOpenaiConversation,
  deleteOpenaiConversation,
} from "@workspace/api-client-react";
import { streamAssistant, streamAssistantFleetOnly } from "./aiClient";
import type { AiMessage, AiTool, ToolCall, ToolResult } from "./types";

function storageKey(surface: string): string {
  return `animator.ai.conversation.${surface}`;
}

export interface UseAssistantArgs {
  /** Stable surface id (e.g. "editor" or "danger") — scopes the conversation. */
  surface: string;
  /** Live tool registry bound to the engine. */
  tools: AiTool[];
  /** Returns the full system prompt (with fresh scene context) for each turn. */
  getSystemPrompt: () => string;
}

export interface UseAssistant {
  messages: AiMessage[];
  streaming: boolean;
  ready: boolean;
  send: (text: string) => void;
  clear: () => void;
}

export function useAssistant({ surface, tools, getSystemPrompt }: UseAssistantArgs): UseAssistant {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  // Ready immediately — fleet CF path needs no conversation bootstrap.
  const [ready, setReady] = useState(true);
  const convoIdRef = useRef<number | null>(null);
  /** When true, skip openai convo CRUD and always hit Cloudflare hub. */
  const fleetOnlyRef = useRef(false);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const { getToken } = useOptionalAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const promptRef = useRef(getSystemPrompt);
  promptRef.current = getSystemPrompt;

  // Optional: hydrate prior openai conversation if it exists (non-blocking).
  useEffect(() => {
    let cancelled = false;
    const stored = Number(localStorage.getItem(storageKey(surface)) ?? "");
    if (!Number.isInteger(stored) || stored <= 0) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const convo = await getOpenaiConversation(stored);
        if (cancelled) return;
        convoIdRef.current = convo.id;
        setMessages(
          convo.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        );
      } catch {
        if (!cancelled) {
          localStorage.removeItem(storageKey(surface));
          fleetOnlyRef.current = true;
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      inFlightRef.current = false;
    };
  }, [surface]);

  const ensureConversation = useCallback(async (): Promise<number | null> => {
    if (fleetOnlyRef.current) return null;
    if (convoIdRef.current != null) return convoIdRef.current;
    try {
      const convo = await createOpenaiConversation({ surface, title: `${surface} assistant` });
      convoIdRef.current = convo.id;
      localStorage.setItem(storageKey(surface), String(convo.id));
      return convo.id;
    } catch {
      fleetOnlyRef.current = true;
      return null;
    }
  }, [surface]);

  const runToolCalls = useCallback(async (calls: ToolCall[]): Promise<ToolResult[]> => {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const tool = toolsRef.current.find((t) => t.name === call.name);
      if (!tool) {
        results.push({ name: call.name, label: "Unknown command", ok: false });
        continue;
      }
      let args: Record<string, unknown> = {};
      if (typeof call.arguments === "string") {
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          args = {};
        }
      } else if (call.arguments && typeof call.arguments === "object") {
        args = call.arguments as Record<string, unknown>;
      }
      try {
        const label = await tool.execute(args);
        results.push({ name: call.name, label, ok: true });
      } catch (err) {
        results.push({
          name: call.name,
          label: err instanceof Error ? err.message : "Failed",
          ok: false,
        });
      }
    }
    return results;
  }, []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || inFlightRef.current) return;
      inFlightRef.current = true;
      setStreaming(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content },
        { role: "assistant", content: "" },
      ]);

      const appendText = (delta: string) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });

      const attachTools = (results: ToolResult[]) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, tools: [...(last.tools ?? []), ...results] };
          }
          return next;
        });

      const controller = new AbortController();
      abortRef.current = controller;

      const payload = {
        content,
        system: promptRef.current(),
        tools: toolsRef.current,
      };

      const runOnce = async (): Promise<void> => {
        // Fleet-only when openai convo CRUD is dead (Open SPA production).
        if (fleetOnlyRef.current) {
          const outcome = await streamAssistantFleetOnly(
            payload,
            {
              onText: appendText,
              onToolCalls: async (calls) => attachTools(await runToolCalls(calls)),
              onError: (message) => appendText(message ? `\n${message}` : ""),
              onDone: () => {},
            },
            controller.signal,
          );
          if (outcome !== "ok" && !controller.signal.aborted) {
            appendText(
              "\nAI hub request failed. Confirm ai.grudge-studio.com/health and sign-in.",
            );
          }
          return;
        }

        let conversationId: number | null = null;
        try {
          conversationId = await ensureConversation();
        } catch {
          conversationId = null;
        }

        if (conversationId == null) {
          fleetOnlyRef.current = true;
          await runOnce();
          return;
        }

        const outcome = await streamAssistant(
          conversationId,
          payload,
          {
            onText: appendText,
            onToolCalls: async (calls) => attachTools(await runToolCalls(calls)),
            onError: (message) => appendText(message ? `\n${message}` : ""),
            onDone: () => {},
          },
          controller.signal,
          () => getTokenRef.current(),
        );

        if (controller.signal.aborted) return;

        if (outcome === "not_found") {
          convoIdRef.current = null;
          localStorage.removeItem(storageKey(surface));
          fleetOnlyRef.current = true;
          await runOnce();
          return;
        }
        if (outcome === "failed") {
          // Transparent failover to Cloudflare hub (no user re-prompt).
          fleetOnlyRef.current = true;
          await streamAssistantFleetOnly(
            payload,
            {
              onText: appendText,
              onToolCalls: async (calls) => attachTools(await runToolCalls(calls)),
              onError: (message) => appendText(message ? `\n${message}` : ""),
              onDone: () => {},
            },
            controller.signal,
          );
        }
      };

      (async () => {
        try {
          await runOnce();
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
          inFlightRef.current = false;
          if (!controller.signal.aborted) setStreaming(false);
        }
      })();
    },
    [ensureConversation, runToolCalls, surface],
  );

  const clear = useCallback(() => {
    const id = convoIdRef.current;
    convoIdRef.current = null;
    localStorage.removeItem(storageKey(surface));
    setMessages([]);
    if (id != null) void deleteOpenaiConversation(id).catch(() => {});
  }, [surface]);

  return { messages, streaming, ready, send, clear };
}
