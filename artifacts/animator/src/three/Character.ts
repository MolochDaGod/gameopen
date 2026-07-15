import * as THREE from "three";
import { sharedGltfLoader } from "./loaders/gltf";
import type { AnimRole, CharacterDef } from "./types";
import { CHARACTER_HEIGHT_M } from "./types";
import { filterBindableTracks } from "./clipTracks";
import { isUpperBodyTrack } from "./upperBody";
import { LocomotionBlend } from "./explorer/LocomotionBlend";
import { sliceClipFraction, type SnippetSpec } from "./snippets";
import { fitCharacterHeight, restoreCharacterMaterials } from "./fitCharacterHeight";

/** Crossfade (seconds) used to ease the additive combat overlay in and out. */
const OVERLAY_FADE = 0.07;
/** Additive overlay weight at rest (slow walk) vs. full sprint. */
const OVERLAY_WEIGHT_MIN = 0.78;
const OVERLAY_WEIGHT_MAX = 1;
/** Additive overlay playback rate at slow walk vs. full sprint (heavier = faster). */
const OVERLAY_RATE_MIN = 1;
const OVERLAY_RATE_MAX = 1.35;

/**
 * Loads a rigged GLB, owns its AnimationMixer, and exposes a small blending API:
 * a continuous, weight-blended locomotion layer (idle/walk/run eased by speed,
 * with the same phase-synced stride + collapse-to-dominant handoff the procedural
 * Explorer rig uses) plus one-shot actions (attack / skill / jump) that crossfade
 * in and hand control back, and an UPPER-BODY ADDITIVE OVERLAY so a swing can
 * layer over locomotion (a moving attack) without freezing the legs.
 */
export class Character {
  root = new THREE.Group();
  def: CharacterDef;
  mixer: THREE.AnimationMixer | null = null;
  rightHand: THREE.Object3D | null = null;
  leftHand: THREE.Object3D | null = null;

  private model: THREE.Object3D | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private roleClip = new Map<AnimRole, string>();
  private current: THREE.AnimationAction | null = null;
  private oneShot: THREE.AnimationAction | null = null;
  private oneShotEnd = 0;
  private skeletonHelper: THREE.SkeletonHelper | null = null;
  private blendTime = 0.22;
  private modelYaw = 0;
  private disposed = false;

  /** Monotonic clock (seconds) driving the additive overlay lifecycle. */
  private elapsed = 0;

  // --- Weight-blended locomotion (step 1) ---
  /** Idle/walk/run weight-blend layer; drives locomotion via {@link setLocomotion}. */
  private locoBlend: LocomotionBlend | null = null;
  /** True once {@link setLocomotion} has been used (the blend owns locomotion). */
  private blendActive = false;
  /** True while the blend (not a single clip) currently owns the pose. */
  private blendDriving = false;
  /** Latest 0..1 locomotion intensity pushed by the engine. */
  private locoSpeed = 0;

  // --- Upper-body additive overlay (step 2) ---
  /** Additive (upper-body) actions, cached separately from full-body actions. */
  private additiveActions = new Map<string, THREE.AnimationAction>();
  /** Active additive combat overlay (a moving attack), or null. */
  private overlay: {
    action: THREE.AnimationAction;
    fadeTime: number;
    endTime: number;
    fading: boolean;
  } | null = null;

  constructor(def: CharacterDef) {
    this.def = def;
    this.modelYaw = def.modelYaw ?? 0;
  }

  async load(): Promise<void> {
    const loader = sharedGltfLoader();
    // Same-origin first (never absolute R2 / CORS-blocked Animator CDN).
    const { loadGltfFirst } = await import("./assets");
    const { scene, animations, url } = await loadGltfFirst(this.def.file, loader);
    if (this.disposed) {
      this.disposeGltfScene(scene);
      return;
    }
    this.model = scene as THREE.Object3D;
    // Restore colour (de-chrome metalness) then fit height safely.
    // Old path: setFromObject world box → target/size.y could yield ~100× scale.
    restoreCharacterMaterials(this.model, { neutralizeMetal: true });
    const fit = fitCharacterHeight(this.model, CHARACTER_HEIGHT_M, this.def.scale ?? 1);
    if (fit.unitFix !== 1 || fit.scale > 5 || fit.scale < 0.05) {
      console.info(
        `[Character] ${this.def.id} fit h=${fit.nativeHeight.toFixed(3)} unitFix=${fit.unitFix} scale=${fit.scale.toFixed(4)} url=${url}`,
      );
    }
    this.model.rotation.y = this.modelYaw;
    this.root.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.locoBlend = new LocomotionBlend((id) => this.actions.get(id) ?? null);
    for (const clip of animations) {
      const action = this.mixer.clipAction(filterBindableTracks(this.model, clip));
      this.actions.set(clip.name, action);
    }
    for (const [role, name] of Object.entries(this.def.clips)) {
      if (name && this.actions.has(name)) this.roleClip.set(role as AnimRole, name);
    }
    this.autoMapClips();

    this.model.updateMatrixWorld(true);
    this.findHands();
    this.playRole("idle", 0);
  }

  /**
   * Fill any role the def didn't pin (or pinned to a missing clip) by fuzzy-
   * matching the GLB's actual clip names. Keeps every character "aware" of its
   * own animations even when its export uses non-standard clip names.
   */
  private autoMapClips() {
    const roleKeywords: [AnimRole, RegExp][] = [
      ["idle", /idle|idol|breath|stand/i],
      ["walk", /walk|stroll/i],
      ["run", /\brun\b|running|sprint|jog/i],
      ["attack", /attack|slash|strike|punch|kick|swing|combat|melee|\bhit\b|chop|stab/i],
      ["jump", /jump|leap|flip|vault/i],
      ["death", /death|die|dead|defeat|ko\b/i],
      ["hurt", /hurt|damage|flinch|stagger|impact|recoil/i],
      ["block", /block|guard|parry|defen[cs]e|shield/i],
    ];
    const names = [...this.actions.keys()];
    for (const [role, re] of roleKeywords) {
      if (this.roleClip.has(role)) continue;
      const found = names.find((n) => re.test(n));
      if (found) this.roleClip.set(role, found);
    }
    // Guarantee a base idle, and cross-fill locomotion so movement always reads.
    if (!this.roleClip.has("idle") && names.length) this.roleClip.set("idle", names[0]);
    if (!this.roleClip.has("walk") && this.roleClip.has("run")) {
      this.roleClip.set("walk", this.roleClip.get("run")!);
    }
    if (!this.roleClip.has("run") && this.roleClip.has("walk")) {
      this.roleClip.set("run", this.roleClip.get("walk")!);
    }
  }

  /** List of every clip name embedded in this GLB (for editor introspection). */
  clipNames(): string[] {
    return [...this.actions.keys()];
  }

  /** Name of the clip currently driving the rig (one-shot wins over locomotion). */
  currentClipName(): string {
    if (this.oneShot) return this.oneShot.getClip().name;
    if (this.current) return this.current.getClip().name;
    return "";
  }

  /** Rotate the model mesh so its art-forward aligns with the controller. */
  setModelYaw(rad: number) {
    this.modelYaw = rad;
    if (this.model) this.model.rotation.y = rad;
  }

  private findHands() {
    if (!this.model) return;
    // Prefer Bip001 / mixamo / standard third-person + RTS hand sockets
    const re = new RegExp(
      this.def.handBone ||
        "Bip001.*(R|L).*Hand|mixamorig.*(Right|Left)Hand|hand|wrist|R_hand|L_hand|weapon",
      "i",
    );
    const rightRe = /right|_r_|\.r$|r_hand|hand_r|R Hand|RHand|bip001 r/i;
    const leftRe = /left|_l_|\.l$|l_hand|hand_l|L Hand|LHand|bip001 l/i;
    let right: THREE.Object3D | null = null;
    let left: THREE.Object3D | null = null;
    this.model.traverse((o) => {
      if (!o.name) return;
      if (re.test(o.name) || /hand|wrist|weapon/i.test(o.name)) {
        if (leftRe.test(o.name)) left = left ?? o;
        else if (rightRe.test(o.name)) right = right ?? o;
        else if (!right) right = o;
      }
    });
    // Generic fallback: any bone with hand/wrist (prefer right for primary weapon).
    if (!right) {
      this.model.traverse((o) => {
        if (right) return;
        if (/hand|wrist|palm/i.test(o.name) && !leftRe.test(o.name)) right = o;
      });
    }
    if (!left) {
      this.model.traverse((o) => {
        if (left) return;
        if (/hand|wrist|palm/i.test(o.name) && leftRe.test(o.name)) left = o;
      });
    }
    this.rightHand = this.makeMount(right);
    this.leftHand = this.makeMount(left ?? right);
  }

  /**
   * Create a child mount object so weapon transforms are isolated from the bone.
   * The mount is counter-rotated to the model's (body) frame, so its axes align
   * with the rig's forward/up exactly like the procedural Explorer rig's mounts —
   * letting ONE per-weapon grip table fit both rigs.
   */
  private makeMount(bone: THREE.Object3D | null): THREE.Object3D {
    const mount = new THREE.Object3D();
    if (bone) {
      const boneQuat = bone.getWorldQuaternion(new THREE.Quaternion());
      const modelQuat = this.model
        ? this.model.getWorldQuaternion(new THREE.Quaternion())
        : new THREE.Quaternion();
      mount.quaternion.copy(boneQuat.invert().multiply(modelQuat));
      bone.add(mount);
    } else {
      // No bone found — mount near the right side of the body root.
      mount.position.set(0.4, 1.1, 0.1);
      this.root.add(mount);
    }
    return mount;
  }

  setBlendTime(t: number) {
    this.blendTime = t;
  }

  setShowSkeleton(show: boolean) {
    if (!this.model) return;
    if (show && !this.skeletonHelper) {
      this.skeletonHelper = new THREE.SkeletonHelper(this.model);
      this.root.add(this.skeletonHelper);
    } else if (!show && this.skeletonHelper) {
      this.root.remove(this.skeletonHelper);
      this.skeletonHelper.dispose?.();
      this.skeletonHelper = null;
    }
  }

  hasRole(role: AnimRole): boolean {
    return this.roleClip.has(role);
  }

  hasClip(name: string): boolean {
    return this.actions.has(name);
  }

  /** Crossfade the persistent locomotion action to the given role. */
  playRole(role: AnimRole, fade = this.blendTime) {
    const name = this.roleClip.get(role) ?? this.roleClip.get("idle");
    if (!name) return;
    const action = this.actions.get(name);
    if (!action || action === this.current) return;
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.fadeIn(fade);
    action.play();
    if (this.current && this.current !== action) this.current.fadeOut(fade);
    this.current = action;
  }

  /** Set playback rate of the active locomotion clip (walk -> run feel). */
  setLocomotionRate(rate: number) {
    if (this.current) this.current.setEffectiveTimeScale(rate);
  }

  /**
   * Continuous, weight-blended locomotion (step 1): push a 0..1 movement
   * intensity and the idle/walk/run clips are eased together by {@link locoBlend}
   * (acceleration reads as a smooth crossfade, strides stay phase-synced). The
   * first call latches the blend on as the locomotion owner — replacing the
   * discrete {@link playRole}/{@link setLocomotionRate} path for engine-driven
   * characters (NPC/editor rigs that never call this keep the discrete path).
   * The blend yields automatically to one-shots via collapse-to-dominant.
   */
  setLocomotion(speed: number) {
    this.blendActive = true;
    this.locoSpeed = THREE.MathUtils.clamp(speed, 0, 1);
  }

  /** Play a one-shot clip by exact name; returns its duration (sec) or 0. */
  playClipOnce(name: string, fade = 0.12): number {
    const action = this.actions.get(name);
    if (!action) return 0;
    // A rooted full-body one-shot owns the whole skeleton: drop any upper-body
    // overlay, and take the pose back from the locomotion blend so the crossfade
    // has a single, stable `current` to fade from.
    this.clearOverlay();
    this.beginSingle();
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.fadeIn(fade);
    action.play();
    if (this.current && this.current !== action) this.current.fadeOut(fade);
    if (this.oneShot && this.oneShot !== action) this.oneShot.stop();
    this.oneShot = action;
    const dur = action.getClip().duration;
    this.oneShotEnd = dur;
    return dur;
  }

  /** Play a one-shot for a logical role (attack/jump). */
  playRoleOnce(role: AnimRole, fade = 0.12): number {
    const name = this.roleClip.get(role);
    if (!name) return 0;
    return this.playClipOnce(name, fade);
  }

  get isOneShotActive(): boolean {
    return this.oneShot !== null;
  }

  /**
   * Register an externally-loaded {@link THREE.AnimationClip} (e.g. from an
   * FBX file) under the given name so it can be played via
   * {@link playClipOnce} / {@link playRoleOnce}. No-op if the mixer isn't
   * ready yet (character not yet loaded).
   */
  addClip(name: string, clip: THREE.AnimationClip): void {
    if (!this.mixer || !this.model) return;
    const action = this.mixer.clipAction(filterBindableTracks(this.model, clip));
    this.actions.set(name, action);
  }

  update(dt: number) {
    if (!this.mixer) return;
    this.elapsed += dt;

    // Weight-blended locomotion (step 1). The blend drives the legs unless a
    // full-body one-shot owns the body; an upper-body OVERLAY (a moving attack)
    // does NOT suppress it, so the legs keep walking under the swing.
    if (this.blendActive && this.locoBlend) {
      const blendDrives = !this.oneShot;
      this.locoBlend.update({
        idleId: this.roleClip.get("idle") ?? "",
        walkId: this.roleClip.get("walk") ?? this.roleClip.get("idle") ?? "",
        runId: this.roleClip.get("run") ?? this.roleClip.get("walk") ?? "",
        speed: this.locoSpeed,
        crouch: false,
        active: blendDrives,
        dt,
      });
      if (blendDrives) {
        // Track the heaviest blend clip so the next one-shot can collapse onto it.
        this.current = this.locoBlend.peekDominant()?.action ?? this.current;
        this.blendDriving = true;
      }
    }

    // Additive combat overlay lifecycle (step 2): fade out near the tail, drop
    // when finished. Driven off `elapsed` so it's independent of the mixer.
    if (this.overlay) {
      if (!this.overlay.fading && this.elapsed >= this.overlay.fadeTime) {
        this.overlay.action.fadeOut(OVERLAY_FADE);
        this.overlay.fading = true;
      }
      if (this.elapsed >= this.overlay.endTime) {
        this.overlay.action.stop();
        this.overlay = null;
      }
    }

    this.mixer.update(dt);

    if (this.oneShot) {
      this.oneShotEnd -= dt;
      if (this.oneShotEnd <= 0) {
        this.oneShot.fadeOut(this.blendTime);
        this.oneShot = null;
        // The blend re-acquires locomotion on its own next frame; only the
        // discrete single-clip path needs to fade its persistent clip back in.
        if (!this.blendActive && this.current) {
          this.current.enabled = true;
          this.current.fadeIn(this.blendTime);
          this.current.play();
        }
      }
    }
  }

  /**
   * Release the locomotion blend so a single clip can take over (see
   * {@link playClipOnce}). Collapses the blend to its heaviest action (kept at
   * full weight + natural time) and adopts it as `current`, giving the next clip
   * a clean, single action to crossFadeFrom.
   */
  private beginSingle() {
    if (!this.blendDriving || !this.locoBlend) return;
    this.current = this.locoBlend.collapseToDominant()?.action ?? this.current;
    this.blendDriving = false;
  }

  /**
   * Play `name` as an UPPER-BODY ADDITIVE overlay (step 2): a swing that layers
   * over locomotion so the legs keep walking/running underneath. Weight + rate
   * scale with `intensity` (0..1). Restarts cleanly if an overlay is already
   * running (combo chaining). Returns the rate-adjusted clip duration, or 0 when
   * the clip has no upper-body tracks / is missing. Does NOT set the one-shot
   * flag, so {@link isOneShotActive} stays false and locomotion keeps driving.
   */
  playClipOverlay(name: string, intensity: number): number {
    const action = this.additiveAction(name);
    if (!action) return 0;
    this.clearOverlay();

    const s = THREE.MathUtils.clamp(intensity, 0, 1);
    const weight = OVERLAY_WEIGHT_MIN + (OVERLAY_WEIGHT_MAX - OVERLAY_WEIGHT_MIN) * s;
    const rate = OVERLAY_RATE_MIN + (OVERLAY_RATE_MAX - OVERLAY_RATE_MIN) * s;

    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.setEffectiveTimeScale(rate);
    action.setEffectiveWeight(weight);
    action.enabled = true;
    action.play();
    action.fadeIn(OVERLAY_FADE);

    const dur = action.getClip().duration / rate;
    this.overlay = {
      action,
      fadeTime: this.elapsed + Math.max(0, dur - OVERLAY_FADE),
      endTime: this.elapsed + dur,
      fading: false,
    };
    return dur;
  }

  /** Stop and drop the active additive combat overlay, if any. */
  clearOverlay() {
    if (!this.overlay) return;
    this.overlay.action.stop();
    this.overlay = null;
  }

  /**
   * Get/create a cached UPPER-BODY ADDITIVE action for a clip name. The clip is
   * cloned, stripped to its upper-body tracks (legs stay on the locomotion
   * blend), made additive relative to its own first frame, and registered under
   * the additive blend mode. Cached separately so it never collides with the
   * full-body action of the same name. Returns null when the clip is missing or
   * has no upper-body tracks.
   */
  private additiveAction(name: string): THREE.AnimationAction | null {
    const cached = this.additiveActions.get(name);
    if (cached) return cached;
    const base = this.actions.get(name);
    if (!base || !this.mixer || !this.model) return null;
    const clip = filterBindableTracks(this.model, base.getClip().clone());
    clip.tracks = clip.tracks.filter((t) => isUpperBodyTrack(t.name));
    if (clip.tracks.length === 0) return null;
    THREE.AnimationUtils.makeClipAdditive(clip);
    const action = this.mixer.clipAction(clip, undefined, THREE.AdditiveAnimationBlendMode);
    this.additiveActions.set(name, action);
    return action;
  }

  /**
   * Register a SNIPPET (step 3): slice `[from, to]` (fractions of a parent native
   * clip's duration) into a new, independently-playable action under `spec.id`,
   * playable on demand via {@link playClipOnce}/{@link hasClip}. Pure data — no
   * extra files. Returns false when the parent clip isn't loaded or the rig isn't
   * ready. Re-registering an id overwrites the previous slice.
   */
  registerSnippet(spec: SnippetSpec): boolean {
    if (!this.mixer || !this.model) return false;
    const parent = this.actions.get(spec.parent)?.getClip();
    if (!parent) return false;
    const sub = sliceClipFraction(parent, spec.from, spec.to, spec.id);
    const action = this.mixer.clipAction(filterBindableTracks(this.model, sub));
    this.actions.set(spec.id, action);
    return true;
  }

  private disposeGltfScene(scene: THREE.Object3D) {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  }

  dispose() {
    this.disposed = true;
    this.overlay = null;
    this.locoBlend?.stopAll();
    this.locoBlend = null;
    if (this.mixer) this.mixer.stopAllAction();
    if (this.skeletonHelper) {
      this.skeletonHelper.dispose?.();
      this.skeletonHelper = null;
    }
    if (this.model) this.disposeGltfScene(this.model);
    this.root.clear();
    this.actions.clear();
    this.additiveActions.clear();
    this.roleClip.clear();
  }
}
