/**
 * CursorManager — global context-aware cursor system for Open / Danger / fleet.
 *
 * Presence layers (see `pointerPresence.ts`):
 *   play-locked → OS cursor hidden; Crosshair owns aim
 *   play-free   → custom free-aim / soft lock cursor (no pointer lock)
 *   ui / shell  → UI arrow + hover hand on [data-cursor="interact"]
 *
 * Mount once near the app root. Three.js scenes can call setPlayPointerCtx /
 * setCursorCtx for mesh hovers (doors, nodes, NPCs).
 */
import { useEffect, type ReactNode } from "react";
import {
  applyPointerBodyClass,
  getPointerPresence,
  setHoverInteract,
  setPlayPointerCtx,
  subscribePointerPresence,
  type PlayPointerCtx,
} from "@workspace/grudge-physics";

// ── legacy aliases (mesh ray-cast helpers) ───────────────────────────────────

export type CursorCtx =
  | "default"
  | "interact"
  | "combat"
  | "harvest"
  | "tool"
  | "swim"
  | "climb";

/** Map mesh hover tags → play pointer context. */
export function setCursorCtx(ctx: CursorCtx): void {
  const map: Record<CursorCtx, PlayPointerCtx> = {
    default: "default",
    interact: "interact",
    combat: "combat-soft",
    harvest: "harvest",
    tool: "tool",
    swim: "swim",
    climb: "climb",
  };
  setPlayPointerCtx(map[ctx] ?? "default");
}

export function getCursorCtx(): CursorCtx {
  const p = getPointerPresence();
  if (p.layer === "play-locked") return "combat";
  switch (p.playCtx) {
    case "interact":
      return "interact";
    case "harvest":
      return "harvest";
    case "build":
    case "tool":
      return "tool";
    case "swim":
      return "swim";
    case "climb":
      return "climb";
    case "combat-soft":
    case "combat-hard":
      return "combat";
    default:
      return "default";
  }
}

interface Props {
  children?: ReactNode;
}

/**
 * Mount once near the root. Keeps body classes + data attributes in sync.
 */
export function CursorManager({ children }: Props) {
  useEffect(() => {
    const sync = () => applyPointerBodyClass(getPointerPresence());
    sync();
    return subscribePointerPresence(sync);
  }, []);

  // Hover over [data-cursor] — UI hand vs default UI arrow
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest("[data-cursor]");
      if (el) {
        const want = el.getAttribute("data-cursor");
        setHoverInteract(want === "interact" || want === "harvest" || want === "tool");
        if (want === "harvest") setPlayPointerCtx("harvest");
        else if (want === "tool" || want === "build") setPlayPointerCtx("tool");
        else if (want === "interact") setPlayPointerCtx("interact");
      } else {
        setHoverInteract(false);
      }
    };
    document.addEventListener("mouseover", onOver, { passive: true });
    return () => document.removeEventListener("mouseover", onOver);
  }, []);

  // Buttons / links get interact affordance without every author tagging them
  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest("[data-cursor]")) return; // explicit wins
      const clickable = t.closest(
        "button, a, [role='button'], .tab, .opt, input, select, textarea, label, .dock-item, .eq-open-btn",
      );
      if (clickable && getPointerPresence().layer !== "play-locked") {
        setHoverInteract(true);
      }
    };
    const onOut = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest("button, a, [role='button'], .tab, .opt")) return;
      // mouseover on next element will re-set; clear if leaving to non-clickable
      const related = e.relatedTarget as Element | null;
      if (
        related?.closest?.(
          "button, a, [role='button'], .tab, .opt, input, select, textarea, label, [data-cursor]",
        )
      ) {
        return;
      }
      setHoverInteract(false);
    };
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  return <>{children}</>;
}
