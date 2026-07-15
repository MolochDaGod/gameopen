/**
 * Lightweight AnimationDirector — uMMORPG Animator + locomotion blend.
 *
 * Unity analogy:
 *  - Animator Controller layers: Base (loco) + Override (attack/skill)
 *  - ScriptableSkill casts → CrossFade one-shot on override layer
 *
 * Web contract (grudge6-combat-runtime):
 *  - One director owns gait + overlay
 *  - Attack = one-shot, never permanently kills idle
 *  - Pack swap: load first, then rebuild director
 */
import * as THREE from "three";

export type LocoRole = "idle" | "walk" | "run" | "sprint";

export interface DirectorClips {
  idle?: THREE.AnimationClip | null;
  walk?: THREE.AnimationClip | null;
  run?: THREE.AnimationClip | null;
  sprint?: THREE.AnimationClip | null;
  attack?: THREE.AnimationClip | null;
  [key: string]: THREE.AnimationClip | null | undefined;
}

export interface AnimationDirectorOptions {
  fade?: number;
  /** Gait damp rate (1/s). ~9 is snappy. */
  gaitRate?: number;
}

export class AnimationDirector {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private loco: LocoRole = "idle";
  private gait = 0;
  private gaitTarget = 0;
  private gaitRate: number;
  private fade: number;
  private oneShot: THREE.AnimationAction | null = null;
  private oneShotEnd = 0;
  private busy = false;

  constructor(
    mixer: THREE.AnimationMixer,
    clips: DirectorClips,
    opts: AnimationDirectorOptions = {},
  ) {
    this.mixer = mixer;
    this.fade = opts.fade ?? 0.18;
    this.gaitRate = opts.gaitRate ?? 9;

    for (const [name, clip] of Object.entries(clips)) {
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0);
      this.actions.set(name, action);
    }
    // Start idle
    const idle = this.actions.get("idle");
    if (idle) {
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.setEffectiveWeight(1);
      idle.play();
      this.loco = "idle";
    }
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  get busyOverlay(): boolean {
    return this.busy;
  }

  /**
   * Continuous locomotion target (Controller speed 0..1 + sprint).
   * Maps to idle / walk / run / sprint like Animator blend tree.
   */
  setGaitTarget(moving: boolean, sprinting = false, speed01 = 0): void {
    if (!moving || speed01 < 0.05) {
      this.gaitTarget = 0;
      return;
    }
    if (sprinting || speed01 > 0.85) this.gaitTarget = 1;
    else if (speed01 > 0.55) this.gaitTarget = 0.7;
    else this.gaitTarget = 0.34;
  }

  /** Direct gait 0..1 (advanced). */
  setGait(gait: number): void {
    this.gaitTarget = Math.max(0, Math.min(1, gait));
  }

  private locoFromGait(g: number): LocoRole {
    if (g >= 0.92 && this.actions.has("sprint")) return "sprint";
    if (g >= 0.55 && this.actions.has("run")) return "run";
    if (g >= 0.12 && this.actions.has("walk")) return "walk";
    return "idle";
  }

  private applyLocoWeights(fade: number): void {
    if (this.busy) return; // overlay owns influence
    const role = this.locoFromGait(this.gait);
    if (role === this.loco) return;
    const next = this.actions.get(role);
    const prev = this.actions.get(this.loco);
    if (!next) return;
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    next.play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.loco = role;
  }

  /**
   * Play attack / skill one-shot (uMMORPG ScriptableSkill cast animation).
   * Returns duration seconds, or 0 if busy / missing.
   */
  requestOneShot(
    name: string,
    opts?: { fade?: number; allowQueue?: boolean; timeScale?: number },
  ): number {
    if (this.busy && !opts?.allowQueue) return 0;
    const action = this.actions.get(name);
    if (!action) return 0;
    const fade = opts?.fade ?? 0.1;
    const ts = opts?.timeScale ?? 1;

    // Dim locomotion
    for (const [n, a] of this.actions) {
      if (n === name) continue;
      if (n === "idle" || n === "walk" || n === "run" || n === "sprint") {
        a.setEffectiveWeight(Math.min(a.getEffectiveWeight(), 0.15));
      }
    }

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(ts);
    action.fadeIn(fade);
    action.play();

    this.oneShot = action;
    this.busy = true;
    const dur = action.getClip().duration / Math.max(0.05, ts);
    this.oneShotEnd = performance.now() / 1000 + dur;
    return dur;
  }

  update(dt: number): void {
    // Damp gait
    const k = 1 - Math.exp(-this.gaitRate * dt);
    this.gait += (this.gaitTarget - this.gait) * k;
    this.applyLocoWeights(this.fade);

    if (this.busy && this.oneShot) {
      const now = performance.now() / 1000;
      if (now >= this.oneShotEnd || !this.oneShot.isRunning()) {
        this.oneShot.fadeOut(this.fade);
        this.oneShot = null;
        this.busy = false;
        // Restore loco
        const locoA = this.actions.get(this.loco);
        if (locoA) {
          locoA.setEffectiveWeight(1);
          locoA.fadeIn(this.fade);
          locoA.play();
        }
      }
    }

    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
    this.oneShot = null;
    this.busy = false;
  }
}

/** Build director clips map from a role→clip Map (GrudgeAvatar / grudge6Runtime). */
export function clipsFromRoleMap(
  clips: Map<string, THREE.AnimationClip>,
): DirectorClips {
  return {
    idle: clips.get("idle") || null,
    walk: clips.get("walk") || clips.get("run") || null,
    run: clips.get("run") || clips.get("walk") || null,
    sprint: clips.get("sprint") || clips.get("run") || null,
    attack: clips.get("attack") || null,
  };
}
