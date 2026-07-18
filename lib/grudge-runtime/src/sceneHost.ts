/**
 * Uniform scene-host contract.
 * Every Warlords game surface (Danger Room, island, dungeon, zone, instance)
 * should expose this shape so tooling, multiplayer, and AI can treat them alike.
 */

import type { WorldLocation } from "./location";
import type { ScriptDoc, ScriptRunner } from "./scripting";
import type { SceneKind } from "./sceneKinds";
import { SCENE_PHYSICS_DEFAULTS } from "./sceneKinds";
import { GRUDGE_RUNTIME_CONTRACT } from "./stack";

export interface SceneHostMeta {
  /** Contract version. */
  contract: string;
  kind: SceneKind;
  /** Human title. */
  title: string;
  /** Hosting product URL path (e.g. /danger). */
  path?: string;
}

/**
 * Minimal host façade — implement on Studio, Island3D, DungeonRoom, etc.
 * Physics types stay in grudge-physics; hosts hold references without coupling
 * the runtime package to Rapier wasm.
 */
export interface WarlordsSceneHost {
  meta: SceneHostMeta;
  /** Current player / focus location. */
  getLocation(): WorldLocation;
  setLocation(loc: WorldLocation): void;
  /** Optional script runner. */
  scripts?: ScriptRunner;
  /** Load declarative content scripts. */
  loadScripts?(docs: ScriptDoc[]): void;
  /** Dispose host resources. */
  dispose(): void;
}

/** In-memory location bag used by hosts that do not yet own a full Scene class. */
export class LocationBag implements Pick<WarlordsSceneHost, "getLocation" | "setLocation"> {
  private loc: WorldLocation;

  constructor(initial: WorldLocation) {
    this.loc = initial;
  }

  getLocation(): WorldLocation {
    return this.loc;
  }

  setLocation(loc: WorldLocation): void {
    this.loc = loc;
  }

  /** Patch position/yaw from live controller each frame. */
  patchPose(position: { x: number; y: number; z: number }, yaw?: number): void {
    this.loc = {
      ...this.loc,
      position: { ...position },
      yaw: yaw ?? this.loc.yaw,
    };
  }
}

export function createSceneMeta(
  kind: SceneKind,
  title: string,
  path?: string,
): SceneHostMeta {
  return {
    contract: GRUDGE_RUNTIME_CONTRACT,
    kind,
    title,
    path,
  };
}

/** Physics defaults helper (hosts pass into createScenePhysics). */
export function physicsDefaultsFor(kind: SceneKind) {
  return SCENE_PHYSICS_DEFAULTS[kind];
}
