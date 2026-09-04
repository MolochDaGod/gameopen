/**
 * Fleet input action map — GF InputManager pattern (sources → named actions),
 * without Closure. Single binding table; hosts query by action id.
 *
 * Pair with pointer lock helpers for FPS/TPS. Does not invent combat hotkeys —
 * fleet defaults match existing Open / Vox / Mine maps (WASD, X interact, Q/E/R/F skills).
 */

export type ActionId =
  | "move_forward"
  | "move_back"
  | "move_left"
  | "move_right"
  | "jump"
  | "sprint"
  | "crouch"
  | "interact"
  | "attack"
  | "aim"
  | "block"
  | "skill1"
  | "skill2"
  | "skill3"
  | "skill4"
  | "inventory"
  | "craft"
  | "build"
  | "command_center"
  | "camera_cycle"
  | "pause"
  | "dodge"
  | "reload";

export type Binding =
  | { type: "key"; code: string }
  | { type: "mouse"; button: number };

/** Fleet default bindings — extend, do not fork. */
export const FLEET_DEFAULT_BINDINGS: Record<ActionId, Binding[]> = {
  move_forward: [
    { type: "key", code: "KeyW" },
    { type: "key", code: "ArrowUp" },
  ],
  move_back: [
    { type: "key", code: "KeyS" },
    { type: "key", code: "ArrowDown" },
  ],
  move_left: [
    { type: "key", code: "KeyA" },
    { type: "key", code: "ArrowLeft" },
  ],
  move_right: [
    { type: "key", code: "KeyD" },
    { type: "key", code: "ArrowRight" },
  ],
  jump: [{ type: "key", code: "Space" }],
  sprint: [
    { type: "key", code: "ShiftLeft" },
    { type: "key", code: "ShiftRight" },
  ],
  crouch: [{ type: "key", code: "ControlLeft" }],
  interact: [{ type: "key", code: "KeyX" }],
  attack: [{ type: "mouse", button: 0 }],
  aim: [{ type: "mouse", button: 2 }],
  block: [{ type: "mouse", button: 2 }],
  skill1: [{ type: "key", code: "KeyQ" }],
  skill2: [{ type: "key", code: "KeyE" }],
  skill3: [{ type: "key", code: "KeyR" }],
  skill4: [{ type: "key", code: "KeyF" }],
  inventory: [{ type: "key", code: "KeyI" }],
  craft: [{ type: "key", code: "KeyC" }],
  build: [{ type: "key", code: "KeyB" }],
  command_center: [{ type: "key", code: "KeyK" }],
  camera_cycle: [{ type: "key", code: "KeyV" }],
  pause: [{ type: "key", code: "Escape" }],
  dodge: [{ type: "key", code: "KeyZ" }],
  reload: [{ type: "key", code: "KeyR" }],
};

export type InputActionMapOptions = {
  bindings?: Partial<Record<ActionId, Binding[]>>;
  /** Element for mouse buttons / pointer lock. Default window document. */
  target?: EventTarget | null;
  /** When false, ignore all input (pause menus). */
  enabled?: boolean;
};

/**
 * Tracks keyboard + mouse button state and resolves fleet action ids.
 */
export class InputActionMap {
  private keys = new Set<string>();
  private mouse = new Set<number>();
  private bindings: Record<ActionId, Binding[]>;
  private enabled = true;
  private target: EventTarget | null;
  private attached = false;

  private onKeyDown = (e: Event) => {
    if (!this.enabled) return;
    const ke = e as KeyboardEvent;
    this.keys.add(ke.code);
  };
  private onKeyUp = (e: Event) => {
    const ke = e as KeyboardEvent;
    this.keys.delete(ke.code);
  };
  private onMouseDown = (e: Event) => {
    if (!this.enabled) return;
    const me = e as MouseEvent;
    this.mouse.add(me.button);
  };
  private onMouseUp = (e: Event) => {
    const me = e as MouseEvent;
    this.mouse.delete(me.button);
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouse.clear();
  };
  private onVis = () => {
    if (typeof document !== "undefined" && document.hidden) {
      this.keys.clear();
      this.mouse.clear();
    }
  };

  constructor(opts: InputActionMapOptions = {}) {
    this.bindings = { ...FLEET_DEFAULT_BINDINGS, ...(opts.bindings || {}) } as Record<
      ActionId,
      Binding[]
    >;
    this.target = opts.target ?? (typeof window !== "undefined" ? window : null);
    this.enabled = opts.enabled !== false;
  }

  attach(): void {
    if (this.attached || !this.target) return;
    this.target.addEventListener("keydown", this.onKeyDown as EventListener);
    this.target.addEventListener("keyup", this.onKeyUp as EventListener);
    this.target.addEventListener("mousedown", this.onMouseDown as EventListener);
    this.target.addEventListener("mouseup", this.onMouseUp as EventListener);
    if (typeof window !== "undefined") {
      window.addEventListener("blur", this.onBlur);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVis);
    }
    this.attached = true;
  }

  detach(): void {
    if (!this.attached || !this.target) return;
    this.target.removeEventListener("keydown", this.onKeyDown as EventListener);
    this.target.removeEventListener("keyup", this.onKeyUp as EventListener);
    this.target.removeEventListener("mousedown", this.onMouseDown as EventListener);
    this.target.removeEventListener("mouseup", this.onMouseUp as EventListener);
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", this.onBlur);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVis);
    }
    this.attached = false;
    this.keys.clear();
    this.mouse.clear();
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.keys.clear();
      this.mouse.clear();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** True if any binding for action is active. */
  isDown(action: ActionId): boolean {
    if (!this.enabled) return false;
    const list = this.bindings[action] || [];
    for (const b of list) {
      if (b.type === "key" && this.keys.has(b.code)) return true;
      if (b.type === "mouse" && this.mouse.has(b.button)) return true;
    }
    return false;
  }

  /** Legacy bridge: true if key code is held. */
  isCodeDown(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * Binding-space axes for menus / overlay maps.
   * −z is Three default camera-local forward (un-orbited PerspectiveCamera).
   * Play TPS does **not** use this — Open Controller uses
   * `@workspace/grudge-physics` `tpsMoveBasis` (+Z look after orbit, +X screen-right).
   */
  moveAxes(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.isDown("move_forward")) z -= 1;
    if (this.isDown("move_back")) z += 1;
    if (this.isDown("move_left")) x -= 1;
    if (this.isDown("move_right")) x += 1;
    const len = Math.hypot(x, z);
    if (len > 1e-6) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  /** Whether code maps to a named action (for host keyIs bridges). */
  codeMatches(action: ActionId, code: string): boolean {
    const list = this.bindings[action] || [];
    return list.some((b) => b.type === "key" && b.code === code);
  }

  getBindings(): Readonly<Record<ActionId, Binding[]>> {
    return this.bindings;
  }

  rebind(action: ActionId, bindings: Binding[]): void {
    this.bindings[action] = bindings;
  }
}

export function createInputActionMap(opts?: InputActionMapOptions): InputActionMap {
  const m = new InputActionMap(opts);
  m.attach();
  return m;
}

/** Request pointer lock on element; no-op if unsupported. */
export function requestPointerLock(el: Element): void {
  const anyEl = el as HTMLElement & {
    requestPointerLock?: (opts?: { unadjustedMovement?: boolean }) => void;
  };
  try {
    anyEl.requestPointerLock?.({ unadjustedMovement: true });
  } catch {
    try {
      anyEl.requestPointerLock?.();
    } catch {
      /* ignore */
    }
  }
}

export function exitPointerLock(): void {
  try {
    document.exitPointerLock?.();
  } catch {
    /* ignore */
  }
}

export function isPointerLocked(el?: Element | null): boolean {
  if (typeof document === "undefined") return false;
  if (!el) return document.pointerLockElement != null;
  return document.pointerLockElement === el;
}
