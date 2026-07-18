/**
 * Declarative scripting SSOT for Warlords scenes.
 *
 * Production rule (fleet): prefer JSON/data modules over eval.
 * Scripts are pure data + host-registered handlers — never client eval of
 * untrusted JS. Server-side workers may interpret the same documents.
 */

import { newGrudgeId } from "./ids";
import type { WorldLocation } from "./location";

/** When a script fires. */
export type ScriptTriggerKind =
  | "enter-radius"
  | "exit-radius"
  | "interact"
  | "portal"
  | "on-spawn"
  | "on-death"
  | "on-timer"
  | "quest-flag"
  | "manual";

/** What the host should do (no free-form code). */
export type ScriptActionKind =
  | "teleport"
  | "load-instance"
  | "exit-instance"
  | "spawn-entity"
  | "despawn-entity"
  | "set-flag"
  | "grant-item"
  | "play-vfx"
  | "play-anim"
  | "open-ui"
  | "emit-event"
  | "start-combat"
  | "heal"
  | "message";

export interface ScriptTrigger {
  kind: ScriptTriggerKind;
  /** World radius (m) for enter/exit. */
  radius?: number;
  /** Anchor position for radius triggers. */
  position?: { x: number; y: number; z: number };
  /** Portal / prop id. */
  targetId?: string;
  /** Seconds for on-timer. */
  intervalSec?: number;
  /** Quest / world flag name. */
  flag?: string;
  /** Expected flag value for quest-flag. */
  flagValue?: string | boolean | number;
}

export interface ScriptAction {
  kind: ScriptActionKind;
  /** Destination location for teleport / load-instance. */
  location?: Partial<WorldLocation> & { kind?: WorldLocation["kind"] };
  /** Entity / item / UI / anim / event payload. */
  payload?: Record<string, unknown>;
  /** Delay before action (s). */
  delaySec?: number;
}

/**
 * One content script document — serializable JSON, shareable across hosts.
 * Hosts register handlers per ScriptActionKind.
 */
export interface ScriptDoc {
  /** Content id (mint with {@link newScriptId} or author statically). */
  id: string;
  /** Human label. */
  name?: string;
  /** Once | every time trigger matches. */
  mode?: "once" | "repeat";
  enabled?: boolean;
  trigger: ScriptTrigger;
  actions: ScriptAction[];
  /** Optional tags for filtering (zone, dungeon, tutorial). */
  tags?: string[];
}

export function newScriptId(): string {
  return newGrudgeId("script");
}

/** Runtime context passed to handlers. */
export interface ScriptContext {
  location: WorldLocation;
  /** Player fleet character id when known. */
  characterId?: string;
  /** World flags bag (host-owned). */
  flags: Record<string, string | boolean | number>;
  /** Elapsed session time (s). */
  time: number;
  now: number;
}

export type ScriptActionHandler = (
  action: ScriptAction,
  ctx: ScriptContext,
) => void | Promise<void>;

/**
 * Lightweight script runner — pure dispatch, no eval.
 * Hosts register action handlers once at scene boot.
 */
export class ScriptRunner {
  private handlers = new Map<ScriptActionKind, ScriptActionHandler>();
  private firedOnce = new Set<string>();
  private docs: ScriptDoc[] = [];

  register(kind: ScriptActionKind, handler: ScriptActionHandler): void {
    this.handlers.set(kind, handler);
  }

  load(docs: ScriptDoc[]): void {
    this.docs = docs.filter((d) => d.enabled !== false);
  }

  add(doc: ScriptDoc): void {
    if (doc.enabled === false) return;
    this.docs.push(doc);
  }

  clear(): void {
    this.docs = [];
    this.firedOnce.clear();
  }

  /** Manually fire a script by id (or all matching tag). */
  async fire(
    scriptId: string,
    ctx: ScriptContext,
  ): Promise<number> {
    const doc = this.docs.find((d) => d.id === scriptId);
    if (!doc) return 0;
    return this.runDoc(doc, ctx);
  }

  /**
   * Evaluate radius / portal-style triggers against player feet.
   * Returns number of actions executed.
   */
  async tickProximity(
    feet: { x: number; y: number; z: number },
    ctx: ScriptContext,
    opts?: { interactTargetId?: string },
  ): Promise<number> {
    let n = 0;
    for (const doc of this.docs) {
      if (!this.matchesTrigger(doc, feet, opts)) continue;
      if (doc.mode === "once" && this.firedOnce.has(doc.id)) continue;
      n += await this.runDoc(doc, ctx);
      if (doc.mode === "once") this.firedOnce.add(doc.id);
    }
    return n;
  }

  private matchesTrigger(
    doc: ScriptDoc,
    feet: { x: number; y: number; z: number },
    opts?: { interactTargetId?: string },
  ): boolean {
    const t = doc.trigger;
    switch (t.kind) {
      case "enter-radius":
      case "exit-radius": {
        if (!t.position || t.radius == null) return false;
        const dx = feet.x - t.position.x;
        const dy = feet.y - t.position.y;
        const dz = feet.z - t.position.z;
        const d = Math.hypot(dx, dy, dz);
        return t.kind === "enter-radius" ? d <= t.radius : d > t.radius;
      }
      case "interact":
      case "portal":
        return !!opts?.interactTargetId && opts.interactTargetId === t.targetId;
      case "manual":
        return false;
      case "on-spawn":
      case "on-death":
      case "on-timer":
      case "quest-flag":
        return false; // host fires explicitly
      default:
        return false;
    }
  }

  private async runDoc(doc: ScriptDoc, ctx: ScriptContext): Promise<number> {
    let n = 0;
    for (const action of doc.actions) {
      const h = this.handlers.get(action.kind);
      if (!h) continue;
      if (action.delaySec && action.delaySec > 0) {
        await delay(action.delaySec * 1000);
      }
      await h(action, ctx);
      n++;
    }
    return n;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Validate a script doc shape (lightweight). */
export function isScriptDoc(v: unknown): v is ScriptDoc {
  if (!v || typeof v !== "object") return false;
  const d = v as ScriptDoc;
  return (
    typeof d.id === "string" &&
    d.trigger != null &&
    typeof d.trigger === "object" &&
    Array.isArray(d.actions)
  );
}
