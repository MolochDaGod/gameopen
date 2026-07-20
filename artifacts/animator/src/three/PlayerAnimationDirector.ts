/**
 * Thin animation façade over {@link Character} for register/play/locomotion-set
 * APIs used by Controller. Keeps Controller free of Character import cycles
 * while exposing a single director surface (three-player-controller parity).
 */
import type * as THREE from "three";
import type { Character } from "./Character";

export interface RegisterAnimationOpts {
  loop?: boolean;
  fade?: number;
}

export interface PlayAnimationOpts {
  fade?: number;
  /** When true, play once even if registered as looping. */
  once?: boolean;
}

/** Maps logical locomotion keys to clip names for a named set. */
export type LocomotionSetMap = {
  idle?: string;
  walk?: string;
  run?: string;
  [key: string]: string | undefined;
};

/**
 * Registers named clips, plays them by key/name, and switches locomotion sets
 * on the underlying Character mixer.
 */
export class PlayerAnimationDirector {
  private readonly char: Character;
  private readonly registry = new Map<string, { clipName: string; opts: RegisterAnimationOpts }>();
  private readonly locoSets = new Map<string, LocomotionSetMap>();
  private activeLoco: string | null = null;
  private baselineCaptured = false;

  /** Fired when the active clip changes (name + optional action). */
  onAnimationChange: ((name: string, action: THREE.AnimationAction | null) => void) | null = null;

  constructor(character: Character) {
    this.char = character;
  }

  /** Snapshot current locomotion as the baseline set (idempotent). */
  captureBaseline(): void {
    if (this.baselineCaptured) return;
    this.baselineCaptured = true;
    if (!this.locoSets.has("default")) {
      this.locoSets.set("default", {
        idle: "idle",
        walk: "walk",
        run: "run",
      });
    }
    if (!this.activeLoco) this.activeLoco = "default";
  }

  /**
   * Play a clip by its raw mixer name (must already be loaded on Character).
   * Returns true if the clip existed.
   */
  playPlayerAnimationByName(name: string, fade = 0.12): boolean {
    if (!this.char.hasClip?.(name) && !this.char.clipNames().includes(name)) {
      return false;
    }
    this.char.playClipOnce(name, fade);
    this.onAnimationChange?.(name, null);
    return true;
  }

  /** Bind a logical key to a clip name for later {@link playAnimation}. */
  registerAnimation(key: string, clipName: string, opts: RegisterAnimationOpts = {}): boolean {
    if (!clipName) return false;
    this.registry.set(key, { clipName, opts });
    return true;
  }

  /**
   * Play a previously registered key (or raw clip name as fallback).
   * Returns approximate duration seconds (0 if unknown / failed).
   */
  playAnimation(key: string, opts: PlayAnimationOpts = {}): number {
    const reg = this.registry.get(key);
    const clipName = reg?.clipName ?? key;
    const fade = opts.fade ?? reg?.opts.fade ?? 0.12;
    const once = opts.once ?? reg?.opts.loop === false;
    if (!this.char.clipNames().includes(clipName) && !this.char.hasClip?.(clipName)) {
      return 0;
    }
    const dur = once
      ? this.char.playClipOnce(clipName, fade)
      : this.char.playClipOnce(clipName, fade);
    this.onAnimationChange?.(clipName, null);
    return typeof dur === "number" && isFinite(dur) ? dur : 0.5;
  }

  /** Register a named locomotion set (idle/walk/run clip map). */
  registerLocomotionSet(setName: string, map: LocomotionSetMap): void {
    this.locoSets.set(setName, { ...map });
  }

  /**
   * Switch active locomotion set. Character already blends idle/walk/run via
   * setLocomotion(speed); this stores the preferred set for tooling.
   */
  switchLocomotionSet(setName: string, fade = 0.15): boolean {
    const map = this.locoSets.get(setName);
    if (!map) return false;
    this.activeLoco = setName;
    // Cross-fade into set idle if available so the switch is visible.
    if (map.idle && this.char.clipNames().includes(map.idle)) {
      this.char.playClipOnce(map.idle, fade);
      this.onAnimationChange?.(map.idle, null);
    }
    return true;
  }

  /** Currently active locomotion set name, if any. */
  get activeLocomotionSet(): string | null {
    return this.activeLoco;
  }
}
