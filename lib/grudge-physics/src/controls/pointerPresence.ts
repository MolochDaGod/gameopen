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

/**
 * OS/custom cursor should show whenever the browser is NOT holding pointer-lock.
 * Even in "play-locked" layer intent, if lock failed/dropped, show the mouse.
 * (Real pointer-lock still hides the system cursor — that's a browser rule;
 *  HUD Crosshair must cover that case.)
 */
export function pointerShowsOsCursor(p: PointerPresence = state): boolean {
  if (typeof document !== "undefined" && document.pointerLockElement) {
    // UA hides system cursor while locked — software reticle only
    return false;
  }
  return true;
}

/**
 * Centred HUD reticle: always in play layers so aim never disappears.
 * shell/ui still allow optional reticle off (menus).
 */
export function pointerShowsCrosshair(p: PointerPresence = state): boolean {
  return (
    p.layer === "play-locked" ||
    p.layer === "play-free" ||
    // sticky free-mouse while a panel was just closed
    p.freeMouseSticky
  );
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

/**
 * Apply presence classes on document.body (call from CursorManager).
 *
 * NEVER leave open.* with cursor:none + no reticle.
 * - Lock held → body still gets ptr-combat; CSS uses crosshair fallback; HUD reticle on
 * - Lock dropped / failed → demote to play-free so custom mouse PNGs return immediately
 */
export function applyPointerBodyClass(p: PointerPresence = state): void {
  const b = document.body;
  const root = document.documentElement;
  const lockHeld =
    typeof document !== "undefined" && !!document.pointerLockElement;

  // Effective presence: demote play-locked → play-free when lock is not held
  // so cursor images return the same frame as ESC / lock fail.
  const effective: PointerPresence =
    p.layer === "play-locked" && !lockHeld
      ? { ...p, layer: "play-free" }
      : p;

  for (const c of BODY_PTR) b.classList.remove(c);
  b.classList.add(pointerBodyClass(effective));
  b.dataset.pointerLayer = effective.layer;
  b.dataset.pointerCtx = effective.playCtx;
  b.dataset.freeMouse = p.freeMouseSticky || !lockHeld ? "1" : "0";
  b.dataset.cursorVisible = pointerShowsOsCursor(effective) ? "1" : "0";
  b.dataset.crosshairVisible = pointerShowsCrosshair(effective) || lockHeld ? "1" : "0";

  if (lockHeld) root.classList.add("pointer-locked");
  else root.classList.remove("pointer-locked");

  // Belt-and-suspenders: never leave blank cursor on document
  if (!lockHeld && (b.style.cursor === "none" || root.style.cursor === "none")) {
    b.style.cursor = "";
    root.style.cursor = "";
  }
}
