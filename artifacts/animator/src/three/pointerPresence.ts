/**
 * Pointer presence SSOT — mouse visual + lock policy for Open / Danger / Play.
 *
 * Layers:
 *   shell     — lobby, doors, menus (OS-style UI cursor)
 *   ui        — settings / admin / equip / bag / systems open (free mouse, no lock)
 *   play-locked — immersive combat aim (pointer-lock + HUD crosshair)
 *   play-free   — sticky free mouse in world (no lock; free-aim still works via NDC)
 *
 * Play context refines the *look* of cursor/crosshair when not pure UI:
 *   combat-soft | combat-hard | harvest | build | swim | climb | interact
 */

export type PointerLayer = "shell" | "ui" | "play-locked" | "play-free";

export type PlayPointerCtx =
  | "default"
  | "combat-soft"
  | "combat-hard"
  | "harvest"
  | "build"
  | "swim"
  | "climb"
  | "interact"
  | "tool";

export interface PointerPresence {
  layer: PointerLayer;
  playCtx: PlayPointerCtx;
  /** User sticky free-mouse (F8 / `\`); survives panel close until re-lock. */
  freeMouseSticky: boolean;
  /** Hover over interactive DOM (`[data-cursor=interact]`). */
  hoverInteract: boolean;
}

const state: PointerPresence = {
  layer: "shell",
  playCtx: "default",
  freeMouseSticky: false,
  hoverInteract: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getPointerPresence(): Readonly<PointerPresence> {
  return state;
}

export function subscribePointerPresence(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setPointerLayer(layer: PointerLayer): void {
  if (state.layer === layer) return;
  state.layer = layer;
  emit();
}

export function setPlayPointerCtx(ctx: PlayPointerCtx): void {
  if (state.playCtx === ctx) return;
  state.playCtx = ctx;
  emit();
}

export function setFreeMouseSticky(on: boolean): void {
  if (state.freeMouseSticky === on) return;
  state.freeMouseSticky = on;
  emit();
}

export function setHoverInteract(on: boolean): void {
  if (state.hoverInteract === on) return;
  state.hoverInteract = on;
  emit();
}

/** Body class for CSS cursor pack (one primary class). */
export function pointerBodyClass(p: PointerPresence = state): string {
  if (p.layer === "play-locked") return "ptr-combat";
  if (p.hoverInteract || p.playCtx === "interact") return "ptr-interact";
  if (p.layer === "ui" || p.layer === "shell") {
    if (p.playCtx === "harvest") return "ptr-harvest";
    if (p.playCtx === "build" || p.playCtx === "tool") return "ptr-tool";
    return "ptr-ui";
  }
  // play-free
  switch (p.playCtx) {
    case "combat-hard":
      return "ptr-aim-hard";
    case "combat-soft":
      return "ptr-aim-soft";
    case "harvest":
      return "ptr-harvest";
    case "build":
    case "tool":
      return "ptr-tool";
    case "swim":
      return "ptr-swim";
    case "climb":
      return "ptr-climb";
    default:
      return "ptr-free";
  }
}

/** Whether the OS/custom cursor should be visible (not pointer-lock combat). */
export function pointerShowsOsCursor(p: PointerPresence = state): boolean {
  return p.layer !== "play-locked";
}

/** Whether the centred HUD reticle should render. */
export function pointerShowsCrosshair(p: PointerPresence = state): boolean {
  return p.layer === "play-locked" || p.layer === "play-free";
}

const BODY_PTR = [
  "ptr-ui",
  "ptr-free",
  "ptr-combat",
  "ptr-interact",
  "ptr-harvest",
  "ptr-tool",
  "ptr-aim-soft",
  "ptr-aim-hard",
  "ptr-swim",
  "ptr-climb",
] as const;

/** Apply presence classes on document.body (call from CursorManager). */
export function applyPointerBodyClass(p: PointerPresence = state): void {
  const b = document.body;
  for (const c of BODY_PTR) b.classList.remove(c);
  b.classList.add(pointerBodyClass(p));
  b.dataset.pointerLayer = p.layer;
  b.dataset.pointerCtx = p.playCtx;
  b.dataset.freeMouse = p.freeMouseSticky ? "1" : "0";
}
