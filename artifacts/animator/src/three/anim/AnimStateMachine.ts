/**
 * AnimStateMachine — high-level intent → state id → AnimDatabase resolve.
 *
 * Aligns:
 *   SurfaceLocomotionMode (grudge-physics)
 *   Player activity (combat | harvest | build)
 *   Weapon pack / weapon id
 *   Loco speed / action requests
 *
 * Hosts (Studio / GrudgeAvatar / Controller) call {@link tick} or {@link requestAction}.
 */

import type { SurfaceLocomotionMode } from "@workspace/grudge-physics";
import {
  getAnimDatabase,
  type AnimClipEntry,
  type AnimDatabase,
  type AnimResolveResult,
  type AnimSurface,
  type PlayerActivity,
} from "./AnimDatabase";

export type AnimActionRequest =
  | { kind: "attack" }
  | { kind: "skill"; slot: 1 | 2 | 3 | 4 }
  | { kind: "jump" }
  | { kind: "dodge"; dir?: "F" | "B" | "L" | "R" }
  | { kind: "block" }
  | { kind: "parry" }
  | { kind: "hurt" }
  | { kind: "death" }
  | { kind: "harvest"; tool?: "chop" | "mine" | "gather" | "skin" }
  | { kind: "mantle" }
  | { kind: "grab" }
  | { kind: "climb"; dir?: "up" | "down" | "idle" };

export interface AnimMachineInput {
  surface: SurfaceLocomotionMode | "mantle";
  activity: PlayerActivity;
  weaponId?: string | null;
  pack?: string | null;
  /** Planar speed 0..1 */
  speed: number;
  /** Optional one-shot this frame */
  action?: AnimActionRequest | null;
  /** Grabbing vertical surface (wall/tree/boat) without full climb mode yet */
  verticalGrab?: boolean;
}

export interface AnimMachineOutput {
  stateId: string;
  role: string;
  resolve: AnimResolveResult | null;
  layer: string;
  /** Clip to play as one-shot (action layer) vs loco continuous */
  oneShot: boolean;
}

/**
 * Pure state machine: input → desired anim state + database resolve.
 */
export class AnimStateMachine {
  private db: AnimDatabase;
  private lastStateId = "loco.idle";
  private actionHold: { stateId: string; until: number } | null = null;

  constructor(db: AnimDatabase = getAnimDatabase()) {
    this.db = db;
  }

  get database(): AnimDatabase {
    return this.db;
  }

  /**
   * @param nowSec — performance clock seconds for action lock windows
   */
  tick(input: AnimMachineInput, nowSec = 0): AnimMachineOutput {
    // Hold action state until lock expires
    if (this.actionHold && nowSec < this.actionHold.until) {
      const held = this.emit(this.actionHold.stateId, input, true);
      return held;
    }
    this.actionHold = null;

    if (input.action) {
      const actionOut = this.applyAction(input.action, input, nowSec);
      if (actionOut) return actionOut;
    }

    // Vertical grab without full climb mode
    if (input.verticalGrab && input.surface !== "swim") {
      return this.emit("traversal.hang", input, false);
    }

    const surface: AnimSurface =
      input.surface === "wallRun"
        ? "wallRun"
        : input.surface === "climb"
          ? "climb"
          : input.surface === "swim"
            ? "swim"
            : input.surface === "mantle"
              ? "mantle"
              : input.surface;

    const stateId =
      this.db.inferStateId({
        surface,
        activity: input.activity,
        speed: input.speed,
        weaponId: input.weaponId,
        pack: input.pack,
      }) ?? "loco.idle";

    this.lastStateId = stateId;
    return this.emit(stateId, input, false);
  }

  /** Force a one-shot (skill / attack) with optional lock from clip.lockSec. */
  requestAction(
    action: AnimActionRequest,
    input: Omit<AnimMachineInput, "action">,
    nowSec = 0,
  ): AnimMachineOutput {
    return (
      this.applyAction(action, { ...input, action }, nowSec) ??
      this.tick({ ...input, action: null }, nowSec)
    );
  }

  private applyAction(
    action: AnimActionRequest,
    input: AnimMachineInput,
    nowSec: number,
  ): AnimMachineOutput | null {
    let stateId: string;
    switch (action.kind) {
      case "attack":
        stateId = "combat.attack";
        break;
      case "skill":
        stateId = `combat.skill${action.slot}` as const;
        break;
      case "jump":
        stateId = "traversal.jump";
        break;
      case "dodge":
        stateId = "traversal.dodge";
        break;
      case "block":
        stateId = "combat.block";
        break;
      case "parry":
        stateId = "combat.parry";
        break;
      case "hurt":
        stateId = "combat.hurt";
        break;
      case "death":
        stateId = "combat.death";
        break;
      case "harvest":
        if (action.tool === "chop") stateId = "activity.harvestChop";
        else if (action.tool === "mine") stateId = "activity.harvestMine";
        else if (action.tool === "gather") stateId = "activity.harvestGather";
        else stateId = "activity.harvest";
        break;
      case "mantle":
        stateId = "traversal.mantle";
        break;
      case "grab":
        stateId = "traversal.hang";
        break;
      case "climb":
        if (action.dir === "up") stateId = "traversal.climbUp";
        else if (action.dir === "down") stateId = "traversal.climbDown";
        else stateId = "traversal.climb";
        break;
      default:
        return null;
    }

    const out = this.emit(stateId, input, true);
    const lock = out.resolve?.clip.lockSec ?? 0.35;
    const st = this.db.getState(stateId);
    if (st && st.interruptible === false) {
      this.actionHold = { stateId, until: nowSec + lock };
    }
    // Dodge direction roles
    if (action.kind === "dodge" && action.dir) {
      const role =
        action.dir === "L"
          ? "dodgeL"
          : action.dir === "R"
            ? "dodgeR"
            : action.dir === "F"
              ? "dodgeF"
              : "dodge";
      const r = this.db.resolve({
        role,
        weaponId: input.weaponId,
        pack: input.pack,
        surface: input.surface as AnimSurface,
        activity: input.activity,
      });
      if (r) {
        return {
          ...out,
          role,
          resolve: r,
        };
      }
    }
    return out;
  }

  private emit(
    stateId: string,
    input: AnimMachineInput,
    oneShot: boolean,
  ): AnimMachineOutput {
    const st = this.db.getState(stateId);
    const role = st?.defaultRole ?? "idle";
    const resolve = this.db.resolve({
      stateId,
      role,
      weaponId: input.weaponId,
      pack: input.pack,
      surface: input.surface as AnimSurface,
      activity: input.activity,
      speed: input.speed,
    });
    this.lastStateId = stateId;
    return {
      stateId,
      role: resolve?.clip.role ?? role,
      resolve,
      layer: st?.layer ?? "loco",
      oneShot,
    };
  }

  get lastState(): string {
    return this.lastStateId;
  }
}

/** Convenience: resolve a single clip for hosts without full machine. */
export function resolveAnimForSurface(opts: {
  surface: SurfaceLocomotionMode | "mantle";
  activity?: PlayerActivity;
  weaponId?: string | null;
  speed?: number;
  action?: AnimActionRequest | null;
}): AnimResolveResult | null {
  const m = new AnimStateMachine();
  const out = m.tick(
    {
      surface: opts.surface,
      activity: opts.activity ?? "combat",
      weaponId: opts.weaponId,
      speed: opts.speed ?? 0,
      action: opts.action ?? null,
    },
    0,
  );
  return out.resolve;
}

export type { AnimClipEntry, AnimResolveResult };
