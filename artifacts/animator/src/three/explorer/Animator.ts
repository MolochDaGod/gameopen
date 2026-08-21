import * as THREE from "three";
import type { ActionKey, MoveInput, TraversalMode, WeaponClass } from "./types";
import {
  WEAPON_SETS,
  TRAVERSAL_SETS,
  GLB_CLIP_IDS,
  BASE_PACK_FALLBACKS,
  UNIVERSAL_MOVEMENT,
  resolveGlobalAction,
  resolveReaction,
} from "./clipCatalog";
import { LocomotionBlend } from "./LocomotionBlend";
import type { VoxelCharacter } from "./rig";
import { mountWeapons, unmountWeapons, type MountedWeapons } from "./weapons";
import { stabilizeClipForMixer, clampMixerDt } from "../clipTracks";
import { isUpperBodyTrack } from "../upperBody";
import { FootGrounder, type GroundSampler } from "../anim/legIk";
import { FLAT_FOOT_SAMPLER } from "../anim/terrainFootSample";

/** Horizontal speed below which the character is considered standing still. */
const MOVE_EPS = 0.08;

/** Crossfade (seconds) used to ease the additive combat overlay in and out. */
const OVERLAY_FADE = 0.07;
/** Additive overlay weight at rest (slow walk) vs. full sprint. */
const OVERLAY_WEIGHT_MIN = 0.78;
const OVERLAY_WEIGHT_MAX = 1;
/** Additive overlay playback rate at slow walk vs. full sprint (heavier = faster). */
const OVERLAY_RATE_MIN = 1;
const OVERLAY_RATE_MAX = 1.35;

/**
 * Drives one {@link VoxelCharacter} with a single-active-clip state machine.
 *
 * **Fleet lane: mixamo-explorer only** (docs/ANIMATION_FLEET_SSOT.md).
 * Play clips: baked JSON rematched onto Mixamo bones (`fleetBakeHydrate`) +
 * base GLB. Mixamo FBX is editor-only. One mixer; attacks overlay or one-shot.
 *
 * Design: locomotion blend + optional overlay/one-shot on the same mixer. Crossfades
 * between them. Locomotion, blocking/aim holds, and one-shot actions (attacks,
 * rolls, dashes, hits, death) all resolve to a clip and flow through the same
 * crossfade path, which keeps weight management bug-free at the cost of additive
 * layering (not needed for these full-body clips).
 *
 * Each frame the engine pushes INTENT (locomotion vector, strafe flag, holds)
 * and the Animator reconciles it into the dominant clip in {@link update}.
 * One-shots are fired imperatively and auto-revert when they elapse.
 */
export class Animator {
  readonly character: VoxelCharacter;
  readonly root: THREE.Group;

  /** Always mixamo-explorer for this class. */
  readonly fleetAnimLane = "mixamo-explorer" as const;

  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Map<string, THREE.AnimationClip>;
  private readonly actionCache = new Map<string, THREE.AnimationAction>();
  private readonly footGrounder = new FootGrounder();

  private weapon: WeaponClass = "unarmed";
  private mounted: MountedWeapons | null = null;

  /** Traversal mode: ground uses the weapon loco; climb/swim use TRAVERSAL_SETS. */
  private mode: TraversalMode = "ground";

  private current: THREE.AnimationAction | null = null;
  private currentId: string | null = null;

  /** Weight-blended idle/walk/run layer; drives locomotion when no clip overrides. */
  private readonly locoBlend: LocomotionBlend;
  /** True while the blend (not a single clip) owns the pose. */
  private blendDriving = false;

  // INTENT pushed by the engine, reconciled each frame.
  private move: MoveInput = { x: 0, z: 0, speed: 0, running: false };
  private strafe = false;
  private crouch = false;
  private hold: "aim" | "block" | null = null;

  // Active one-shot (attack/roll/etc): suppresses reconcile until it elapses.
  private once: { endTime: number; hold: boolean } | null = null;

  // Guard pose queued behind a draw flourish on stance entry: played once the
  // draw one-shot elapses so equip reads as "draw THEN settle into guard".
  private pendingStance: ActionKey | null = null;

  /**
   * Active upper-body additive combat overlay (a moving attack). Unlike `once`
   * it does NOT suppress locomotion — it layers on top of the running blend, so
   * `isBusy()` stays false and the engine keeps the character moving. Auto-fades
   * out near the end of the clip and clears once fully faded.
   */
  private overlay: {
    action: THREE.AnimationAction;
    fadeTime: number;
    endTime: number;
    fading: boolean;
  } | null = null;

  private time = 0;
  private comboIndex = 0;
  private comboUntil = 0;
  private skillUntil = 0;
  /**
   * Bind-pose local hips position. Clips re-baseline hip X/Z to this (not the
   * clip's first frame — off-origin "Retargeted Clip" packs otherwise plant the
   * body tens of units away). Y keeps relative bob only.
   */
  private readonly bindHipX: number;
  private readonly bindHipY: number;
  private readonly bindHipZ: number;

  constructor(character: VoxelCharacter, clips: Map<string, THREE.AnimationClip>) {
    this.character = character;
    this.root = character.root;
    this.clips = clips;
    this.mixer = new THREE.AnimationMixer(character.skeletonRoot);
    this.footGrounder.maxLift = 0.28;
    this.footGrounder.maxDrop = 0.22;
    this.footGrounder.smooth = 16;
    this.footGrounder.alignFeet = true;
    this.footGrounder.bind(character.skeletonRoot);
    this.footGrounder.setEnabled(true);
    this.footGrounder.setGroundSampler(FLAT_FOOT_SAMPLER);
    const hips =
      character.skeletonRoot.getObjectByName("mixamorigHips") ||
      character.skeletonRoot.getObjectByName("Hips") ||
      character.skeletonRoot.getObjectByName("mixamorig:Hips");
    this.bindHipX = hips ? hips.position.x : 0;
    this.bindHipY = hips ? hips.position.y : 0;
    this.bindHipZ = hips ? hips.position.z : 0;
    this.locoBlend = new LocomotionBlend((id) => this.action(id));
  }

  // ------------------------------------------------------------------- intent

  /** Push per-frame locomotion intent (local-space move dir + speed). */
  setLocomotion(move: MoveInput): void {
    this.move = move;
  }

  /** When true, locomotion uses directional clips (body faces aim, not motion). */
  setStrafe(on: boolean): void {
    this.strafe = on;
  }

  /**
   * Hold a crouch/sneak state: suppresses running in the blend, slows the stride
   * cadence, and (where the class ships a crouch clip, e.g. ranged) plays a
   * dedicated crouched idle when standing still.
   */
  setCrouch(on: boolean): void {
    this.crouch = on;
  }

  /** Whether the crouch/sneak state is currently engaged. */
  isCrouching(): boolean {
    return this.crouch;
  }

  /** The class currently equipped. */
  getWeapon(): WeaponClass {
    return this.weapon;
  }

  /** Whether a blocking one-shot (attack/roll/etc) is currently playing. */
  isBusy(): boolean {
    return this.once !== null && !this.once.hold;
  }

  // ------------------------------------------------------------------ weapons

  /**
   * Equip a weapon class: swap the hand props and play the draw/equip flourish.
   * Locomotion immediately adopts the new class's clip set.
   */
  setWeapon(weapon: WeaponClass, mountMesh = true): void {
    const sameClass = weapon === this.weapon;
    // When NOT mounting the procedural mesh (a host rig carries a real model),
    // a same-class call is a no-op only if we already have no procedural mesh.
    if (sameClass && (mountMesh ? !!this.mounted : !this.mounted)) return;
    if (this.mounted) {
      unmountWeapons(this.mounted);
      this.mounted = null;
    }
    this.weapon = weapon;
    if (mountMesh) this.mounted = mountWeapons(this.character, weapon);
    this.currentId = null; // force loco re-eval against the new set
    this.clearOverlay(); // a half-played swing for the old weapon must not linger
    if (sameClass) return; // class unchanged: keep pose, just (un)swapped the mesh
    // Class swap: fade to idle only. Equip/draw flourishes often carry residual
    // root / hip keys that spin or tip the body into the ground on pedestal/play.
    // Actions stay on ONE mixer; cached actions from old class remain valid.
    const idle = this.resolve("idle");
    if (idle) {
      this.setActive(idle, { loop: true, fade: 0.18 });
      this.once = null;
    } else {
      // Last resort — still avoid long equip takes; prefer short draw if any
      const intro = this.resolve("draw") ?? this.resolve("equip");
      if (intro) this.playOnce(intro);
    }
  }

  /** Hide/show the off-hand prop (e.g. while its thrown knife is in flight). No-op if none. */
  setOffhandVisible(visible: boolean): void {
    const off = this.mounted?.offhand;
    if (off) off.visible = visible;
  }

  /** Whether the equipped loadout carries an off-hand prop (a throwable). */
  hasOffhand(): boolean {
    return !!this.mounted?.offhand;
  }

  // --------------------------------------------------------------- one-shots

  /**
   * Melee combo: advances the chain when re-pressed inside the buffer window and
   * returns the next clip id (undefined when the class has no combo). Shared by
   * the rooted full-body {@link attack} and the moving {@link attackMoving}.
   */
  private nextComboClip(): string | undefined {
    const set = WEAPON_SETS[this.weapon];
    if (set.combo.length === 0) return undefined;
    if (this.time <= this.comboUntil && this.comboIndex < set.combo.length - 1) {
      this.comboIndex += 1;
    } else {
      this.comboIndex = 0;
    }
    return this.resolve(set.combo[this.comboIndex]);
  }

  /**
   * Full-body rooted attack: the whole skeleton plays the combo clip and the
   * locomotion blend is suppressed until it elapses. Use when standing still or
   * for a planted heavy swing. Advances the combo and returns the clip duration.
   */
  attack(): number {
    const id = this.nextComboClip();
    if (!id) return 0;
    const dur = this.playOnce(id);
    this.comboUntil = this.time + dur * 1.1;
    return dur;
  }

  /**
   * Moving attack: play the next combo clip as an UPPER-BODY ADDITIVE OVERLAY on
   * top of the running locomotion blend, so the legs keep walking/sprinting while
   * the upper body swings. `intensity` (0..1, the engine's current locomotion
   * speed) scales the overlay weight + playback rate so a sprint attack reads
   * heavier and faster than a walk attack. `isBusy()` stays false throughout, so
   * the engine keeps translating the body and the combo can still chain. Returns
   * the (rate-adjusted) clip duration, or 0 when no combo/clip is available.
   */
  attackMoving(intensity: number): number {
    const id = this.nextComboClip();
    if (!id) return 0;
    const dur = this.playOverlay(id, intensity);
    if (dur > 0) this.comboUntil = this.time + dur * 1.1;
    return dur;
  }

  /** Class signature move; gated by a short cooldown. */
  skill(cooldown = 1.5): number {
    if (this.time < this.skillUntil) return 0;
    const id = this.resolve("skill") ?? this.resolve("attack1");
    if (!id) return 0;
    const dur = this.playOnce(id);
    this.skillUntil = this.time + dur + cooldown;
    return dur;
  }

  /**
   * Play a class one-shot by its {@link ActionKey}, resolving to the current
   * weapon's clip (falling back to the class-independent globals). Returns the
   * clip duration so the engine can time effects, 0 when the class ships no clip
   * for that key. This is the generic surface the data-driven weapon-skill
   * executor uses to drive bespoke kit motions (pistol whip, uppercut, mma kick,
   * charged shot, kip-up) without a dedicated method per move.
   */
  playAction(key: ActionKey, holdLast = false): number {
    const id = this.resolve(key) ?? resolveGlobalAction(key);
    return id ? this.playOnce(id, holdLast) : 0;
  }

  /**
   * Play a class-independent defensive REACTION clip (stumble / stunned /
   * fallDown / fallen / getUp / kipUp / wallCrash …) with a caller-controlled
   * crossfade so each reaction reads with its own blend feel — a flinch snaps in
   * fast, a fall eases, a get-up/kip-up blends slowly back to stance. `hold`
   * keeps the final frame (the grounded "fallen" pose) until a recovery one-shot
   * overrides it. Returns the clip duration, or 0 when the reaction ships no clip.
   */
  reaction(key: ActionKey, fade = 0.12, hold = false): number {
    // resolveReaction guarantees a real clip (falls back to `stumble`) so a
    // defensive reaction never silently no-ops, even for a key this class ships
    // no clip for — both the player and AI route every reaction through here.
    const id = this.resolve(key) ?? resolveGlobalAction(key) ?? resolveReaction(key);
    return id ? this.playOnce(id, hold, fade) : 0;
  }

  /**
   * Play a one-shot ready / guard pose on stance entry (e.g. on equip). `pose`
   * is the category hold-style guard key; `draw` is an optional draw flourish
   * played first. Both resolve through the normal class→global chain and blend
   * back to idle, so a class that ships no clip simply no-ops. Returns the clip
   * duration played (0 when neither resolves).
   */
  enterStance(pose: ActionKey, draw?: ActionKey): number {
    const drawId = draw ? (this.resolve(draw) ?? resolveGlobalAction(draw)) : undefined;
    if (drawId) {
      // Draw flourish first; queue the guard pose so it plays once the draw
      // one-shot elapses (see `update`). The guard pose is never skipped just
      // because a draw clip exists.
      this.pendingStance = pose;
      return this.playOnce(drawId, false, 0.12);
    }
    this.pendingStance = null;
    const poseId = this.resolve(pose) ?? resolveGlobalAction(pose);
    return poseId ? this.playOnce(poseId, false, 0.15) : 0;
  }

  /** Hold a block/guard stance (rooted). Call with false to release. */
  block(active: boolean): void {
    this.hold = active ? "block" : this.hold === "block" ? null : this.hold;
  }

  /** Hold an aim stance (strafe locomotion + draw pose when still). */
  aim(active: boolean): void {
    if (active) {
      this.hold = "aim";
      this.strafe = true;
    } else if (this.hold === "aim") {
      this.hold = null;
      this.strafe = false;
      const release = this.resolve("release");
      if (release) this.playOnce(release);
    }
  }

  /**
   * Dodge roll in a local direction; returns the clip duration for the engine.
   * Longer crossfade into the roll so locomotion→roll blends cleanly; slightly
   * accelerated playback for a more exaggerated Elden Ring–style tumble.
   */
  roll(dir: "F" | "B" | "L" | "R", fade = 0.16): number {
    // Forward sprint-roll: Documents rollRunning.fbx exits into a run — prefer
    // when moving at pace so X-roll while running reads as combat parkour.
    const sprintRoll =
      dir === "F" && this.move.speed > 0.45
        ? this.resolveMovement("rollRun" as ActionKey) ??
          resolveGlobalAction("rollRun")
        : undefined;
    const id =
      sprintRoll ??
      this.resolveMovement(`dodge${dir}` as ActionKey) ??
      this.resolveMovement("dodgeF");
    if (!id) return 0;
    this.clearOverlay();
    // Blend into roll from current pose (jump/walk) rather than hard cut
    const a = this.setActive(id, { loop: false, clamp: true, fade });
    if (!a) return 0;
    const rate = 1.14; // snappier / slightly exaggerated roll
    a.setEffectiveTimeScale(rate);
    const dur = a.getClip().duration / rate;
    this.once = { endTime: this.time + dur * 0.96, hold: false };
    return dur;
  }

  /** Quick dash/lunge; returns clip duration so the engine can time displacement. */
  dash(): number {
    const id = this.resolveMovement("dash") ?? this.resolveMovement("dodgeF");
    return id ? this.playOnce(id) : 0;
  }

  /**
   * Play an acrobatic UX movement blend (air-dodge, flips, twirls, kicks) as a
   * priority rooted one-shot. Resolves through the universal movement fallback so
   * any equipped class can perform it; the engine drives any displacement.
   */
  movement(key: ActionKey, holdLast = false): number {
    const id = this.resolveMovement(key);
    return id ? this.playOnce(id, holdLast) : 0;
  }

  /** Lunging attack that covers ground; engine drives the forward displacement. */
  dashAttack(): number {
    const id = this.resolve("dashAttack") ?? this.resolve("attack1");
    return id ? this.playOnce(id) : 0;
  }

  /** Begin an airborne pose (looped fall) for the jump arc. */
  jump(): void {
    const id = this.resolveMovement("jumpAir");
    if (id) {
      this.setActive(id, { loop: true, fade: 0.1 });
      this.once = { endTime: Number.POSITIVE_INFINITY, hold: true };
    }
  }

  /** Land from a jump and recover to locomotion. */
  land(): number {
    this.once = null;
    const id = this.resolveMovement("land");
    return id ? this.playOnce(id) : 0;
  }

  /** Brief flinch reaction. */
  hit(): number {
    const id = this.resolve("hit");
    return id ? this.playOnce(id) : 0;
  }

  /** Play the death clip and hold the final pose until {@link revive}. */
  die(): number {
    const id = this.resolve("death");
    if (!id) return 0;
    const dur = this.playOnce(id, /*holdLast*/ true);
    return dur;
  }

  /** Clear a held death/jump pose and resume normal control. */
  revive(): void {
    this.once = null;
  }

  // ------------------------------------------------------------ traversal modes

  /**
   * Switch the traversal mode (ground / climb / swim). `climb` and `swim` swap in
   * their own locomotion (`TRAVERSAL_SETS`) until set back to `ground`; the next
   * `update` crossfades from whatever was playing, so transitions stay smooth.
   * Any in-flight one-shot is left to finish on its own.
   */
  setMode(mode: TraversalMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.currentId = null; // force a fresh loco evaluation against the new set
    this.clearOverlay(); // ground swings don't carry into climb/swim
  }

  /** The active traversal mode. */
  getMode(): TraversalMode {
    return this.mode;
  }

  /**
   * Mantle/climb-to-top one-shot. The clip carries the body up + over a ledge; the
   * engine should drive the world translation across the returned duration so the
   * visual reach and the world move stay in lockstep (root motion is locked
   * horizontally but keeps its vertical bob). Returns 0 if the clip is missing.
   */
  mantle(): number {
    return this.playGlobalOnce("mantle");
  }

  /** Swim-to-edge climb-out one-shot; returns the clip duration (0 if missing). */
  swimExit(): number {
    return this.playGlobalOnce("swimExit");
  }

  /**
   * Play a farming verb as a rooted one-shot (dig/plant, water, pick, plant-tree,
   * pull-plant). Returns the clip duration so the engine can time any effect.
   */
  farm(action: "harvest" | "water" | "pick" | "plantTree" | "pullPlant"): number {
    return this.playGlobalOnce(action);
  }

  /**
   * Play a magic verb as a rooted one-shot (cast / single-target / area). Returns
   * the clip duration. Available in any mode and for any equipped class.
   */
  magic(action: "castSpell" | "magicAttack" | "magicArea"): number {
    return this.playGlobalOnce(action);
  }

  /**
   * Running slide: a rooted slide one-shot, class-independent. Returns the clip
   * duration so the engine can carry forward momentum for its length (like dash).
   */
  slide(): number {
    return this.playGlobalOnce("slide");
  }

  /**
   * Throw a grenade / bomb / trap: a rooted overhand throw one-shot, available to
   * any loadout. Returns the clip duration so the engine can time the release.
   */
  throwItem(): number {
    return this.playGlobalOnce("throw");
  }

  /**
   * Play an externally-supplied one-shot clip that is NOT part of the shared
   * catalog — e.g. a cabinet-specific interaction such as entering/leaving a
   * vehicle. The clip is registered under a synthetic id (keyed by its uuid so
   * repeat plays reuse the cached action) and flows through the same one-shot
   * path: its horizontal root is locked, so the host engine owns world
   * translation, and it auto-reverts to locomotion when it elapses (unless
   * `holdLast` clamps the final pose). Returns the clip duration (0 if invalid).
   */
  playClip(clip: THREE.AnimationClip, holdLast = false): number {
    if (!clip) return 0;
    const id = `__ext__/${clip.uuid}`;
    if (!this.clips.has(id)) this.clips.set(id, clip);
    return this.playOnce(id, holdLast);
  }

  /**
   * Register a fleet/baked clip under a catalog id (e.g. animations/sword/…).
   * Used when Mixamo FBX is absent so Explorer resolves the same packs as grudge6.
   */
  registerCatalogClip(id: string, clip: THREE.AnimationClip): void {
    if (!id || !clip) return;
    this.clips.set(id, clip);
    const drop = (key: string) => {
      const stale = this.actionCache.get(key);
      if (!stale) return;
      if (this.overlay?.action === stale) this.clearOverlay();
      try {
        stale.stop();
        this.mixer.uncacheAction(stale.getClip());
      } catch {
        /* */
      }
      this.actionCache.delete(key);
    };
    drop(id);
    drop(`__additive__/${id}`);
  }

  /** Whether a catalog clip id is loaded (for fleet hydrate skip logic). */
  hasCatalogClip(id: string): boolean {
    return this.clips.has(id);
  }

  /**
   * Play an externally-supplied clip as a LOOPED held pose — the airborne
   * equivalent of {@link jump} for a cabinet-specific fall loop (e.g. a skydive
   * pose). Registered under the same synthetic `__ext__` id as {@link playClip}
   * (so the cached action is reused), its horizontal root is locked, and it is
   * marked as a held one-shot so `isBusy()` stays false (the engine keeps
   * translating the body) while it loops until cleared by {@link revive},
   * {@link land}, or another one-shot. No-op for an invalid clip.
   */
  playClipLooped(clip: THREE.AnimationClip): void {
    if (!clip) return;
    const id = `__ext__/${clip.uuid}`;
    if (!this.clips.has(id)) this.clips.set(id, clip);
    this.setActive(id, { loop: true, fade: 0.1 });
    this.once = { endTime: Number.POSITIVE_INFINITY, hold: true };
  }

  /**
   * Clear any active one-shot / held external clip so the rig resumes its normal
   * locomotion blending. Used to "stop" a previewed external clip without the
   * death-recovery semantics of {@link revive}.
   */
  clearOneShot(): void {
    this.once = null;
  }

  /**
   * Play an ALREADY-LOADED catalog clip by its id as a one-shot, bypassing the
   * weapon-class resolution chain. The Dressing Room clip library uses this to
   * preview each verb's own same-named animation regardless of the equipped
   * weapon (the rig loads every referenced clip). Returns the clip duration, or
   * 0 when the id isn't loaded so the caller can fall back.
   */
  playById(id: string, holdLast = false): number {
    return this.clips.has(id) ? this.playOnce(id, holdLast) : 0;
  }

  /** True when a catalog clip id is loaded on this rig. */
  hasLoadedClip(id: string): boolean {
    return this.clips.has(id);
  }

  // ----------------------------------------------------------------- per-frame

  setGroundSampler(fn: GroundSampler | null): void {
    this.footGrounder.setGroundSampler(fn ?? FLAT_FOOT_SAMPLER);
  }

  setFootIk(on: boolean): void {
    this.footGrounder.setEnabled(on);
  }

  rebindFootIk(): void {
    this.footGrounder.bind(this.character.skeletonRoot);
  }

  get footIkBound(): boolean {
    return this.footGrounder.isBound;
  }

  update(dt: number): void {
    dt = clampMixerDt(dt);
    this.time += dt;

    // Expire elapsed one-shots (held poses persist until cleared explicitly).
    if (this.once && !this.once.hold && this.time >= this.once.endTime) {
      this.once = null;
    }

    // Draw flourish finished → settle into the queued guard pose. Cleared first
    // so this fires exactly once; if the rig ships no pose clip it simply no-ops.
    if (this.pendingStance && !this.once) {
      const pose = this.pendingStance;
      this.pendingStance = null;
      const poseId = this.resolve(pose) ?? resolveGlobalAction(pose);
      if (poseId) this.playOnce(poseId, false, 0.15);
    }

    // Drive the additive combat overlay's lifecycle (it rides ON TOP of whatever
    // the blend/one-shot path does below; the shared mixer advances it for us).
    if (this.overlay) {
      if (!this.overlay.fading && this.time >= this.overlay.fadeTime) {
        this.overlay.action.fadeOut(OVERLAY_FADE);
        this.overlay.fading = true;
      }
      if (this.time >= this.overlay.endTime) {
        this.overlay.action.stop();
        this.overlay = null;
      }
    }

    // Traversal modes (climb / swim) own locomotion via a small directional set,
    // not the weapon blend. A one-shot (mantle, swim-exit, etc.) still wins; the
    // mixer just advances while it plays.
    if (this.mode !== "ground") {
      if (!this.once) this.updateTraversalLoco();
      this.footGrounder.beginFrame();
      this.mixer.update(dt);
      this.footGrounder.apply(dt);
      this.character.updateHeadFx(this.time);
      return;
    }

    // A rooted hold pose (block / aim-still / crouch-still) overrides the blend
    // when the class actually ships that clip; otherwise the blend keeps driving.
    const singleId = this.holdClip();
    const blendDrives = !this.once && !singleId;

    if (blendDrives) {
      // Coming back from a single clip: fade it out under the rising blend.
      if (!this.blendDriving && this.current) this.current.fadeOut(0.18);
      const tiers = this.locoTierIds();
      this.locoBlend.update({
        idleId: tiers.idle,
        walkId: tiers.walk,
        runId: tiers.run,
        speed: this.move.speed,
        crouch: this.crouch,
        active: true,
        dt,
      });
      // Track the heaviest blend clip so a one-shot can crossFadeFrom it.
      const dom = this.locoBlend.peekDominant();
      this.current = dom?.action ?? null;
      this.currentId = dom?.id ?? null;
      this.blendDriving = true;
    } else {
      if (this.blendDriving) {
        // Collapse to one clip so the upcoming hold/one-shot can crossfade cleanly.
        const dom = this.locoBlend.collapseToDominant();
        this.current = dom?.action ?? this.current;
        this.currentId = dom?.id ?? this.currentId;
        this.blendDriving = false;
      }
      if (!this.once && singleId) this.setActive(singleId, { loop: true });
    }

    this.footGrounder.beginFrame();
    this.mixer.update(dt);
    this.footGrounder.apply(dt);
    this.character.updateHeadFx(this.time);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.character.skeletonRoot);
    if (this.mounted) unmountWeapons(this.mounted);
    this.character.dispose();
  }

  // ------------------------------------------------------------------ internals

  /**
   * Prefer a catalog id only if the clip actually loaded on this Animator.
   * Falls through to Layer A base pack (`base/*`) as last resort.
   */
  private preferLoaded(id: string | undefined, fallbackKey?: string): string | undefined {
    if (id && this.clips.has(id)) return id;
    if (fallbackKey) {
      const baseId = BASE_PACK_FALLBACKS[fallbackKey];
      if (baseId && this.clips.has(baseId)) return baseId;
    }
    return id && this.clips.has(id) ? id : undefined;
  }

  /** Resolve a logical loco/action key to a clip id for the current class. */
  private resolve(key: ActionKey): string | undefined {
    const style = WEAPON_SETS[this.weapon].actions[key];
    return this.preferLoaded(style, key);
  }

  /**
   * Resolve a UNIVERSAL movement action (jump/land/dodge/dash).
   *
   * Directional dodges (F/B/L/R) ALWAYS prefer the longbow standing-dodge pack —
   * that is the fleet SSOT for every weapon skill's dodge + phase i-frames.
   * Other movement falls back: equipped class → unarmed → Layer A base pack.
   */
  private resolveMovement(key: ActionKey): string | undefined {
    // Directional dodges F/L/R always prefer the longbow standing-dodge pack
    // (fleet SSOT). dodgeB allows class override first (bow uses archer
    // standing-dodge-backward; rifle uses jump-backward) then universal.
    const uni = (UNIVERSAL_MOVEMENT as Record<string, string>)[key];
    if (key === "dodgeF" || key === "dodgeL" || key === "dodgeR") {
      if (uni && this.clips.has(uni)) return uni;
    }
    if (key === "dodgeB") {
      const style =
        this.resolve(key) ?? WEAPON_SETS.unarmed.actions[key] ?? uni;
      return this.preferLoaded(style, key);
    }
    // Shared loco one-shots: rollRun / wallRun / runningArc / jumpAway / etc.
    if (
      uni &&
      this.clips.has(uni) &&
      (key === "rollRun" ||
        key === "runningArc" ||
        key === "wallRun" ||
        key === "jumpAway" ||
        key === "jumpAttack" ||
        key === "dash" ||
        key === "jumpAir" ||
        key === "land")
    ) {
      return uni;
    }
    const style = this.resolve(key) ?? WEAPON_SETS.unarmed.actions[key] ?? uni;
    return this.preferLoaded(style, key);
  }

  /**
   * The single rooted clip that should override the locomotion blend this frame,
   * or undefined when the blend should drive. Only returns an id the current
   * class actually ships, so motion-light packs fall through to the blend.
   */
  private holdClip(): string | undefined {
    if (this.hold === "block")
      return this.resolve("blockIdle") ?? this.resolve("blockStart") ?? resolveGlobalAction("blockGuard");
    const still = this.move.speed < MOVE_EPS;
    if (this.hold === "aim" && still) return this.resolve("aim");
    if (this.crouch && still) return this.resolve("crouchIdle");
    return undefined;
  }

  /**
   * Resolve the idle/walk/run clip ids that the blend should mix for the current
   * move intent. Strafe picks the 8-dir clip for the dominant axis; otherwise the
   * body faces its motion so forward clips suffice. A fallback chain keeps partial
   * weapon packs animating.
   */
  private locoTierIds(): { idle?: string; walk?: string; run?: string } {
    const loco = WEAPON_SETS[this.weapon].loco;
    let idle = this.preferLoaded(loco.idle, "idle");
    let walk: string | undefined;
    let run: string | undefined;
    if (this.strafe) {
      const ax = Math.abs(this.move.x);
      const az = Math.abs(this.move.z);
      if (az >= ax) {
        if (this.move.z >= 0) {
          walk = this.preferLoaded(loco.walkF, "walkF");
          run = this.preferLoaded(loco.runF, "runF");
        } else {
          walk = this.preferLoaded(loco.walkB, "walkB");
          run = this.preferLoaded(loco.runB, "runB");
        }
      } else if (this.move.x >= 0) {
        walk = this.preferLoaded(loco.walkR, "walkR");
        run = this.preferLoaded(loco.runR, "runR");
      } else {
        walk = this.preferLoaded(loco.walkL, "walkL");
        run = this.preferLoaded(loco.runL, "runL");
      }
    } else {
      walk = this.preferLoaded(loco.walkF, "walkF");
      run = this.preferLoaded(loco.runF, "runF");
    }
    walk = walk ?? run ?? this.preferLoaded(loco.walkF, "walkF") ?? idle;
    run = run ?? walk ?? this.preferLoaded(loco.runF, "runF") ?? idle;
    idle = idle ?? walk ?? run;
    return { idle, walk, run };
  }

  /**
   * Drive climb/swim locomotion: pick the in-place idle (hang / tread) when still,
   * the forward stroke/up-climb when moving forward, or the back/down clip when
   * reversing. `setActive` crossfades from whatever played before (including the
   * collapsed ground blend on a mode change), so transitions stay smooth.
   */
  private updateTraversalLoco(): void {
    if (this.mode === "ground") return;
    const set = TRAVERSAL_SETS[this.mode];
    let id = set.idle;
    if (this.move.speed >= MOVE_EPS) {
      // Forward intent (z >= 0) climbs up / swims; backward intent climbs down.
      id = this.move.z >= 0 ? set.forward : set.back;
    }
    this.setActive(id, { loop: true, fade: 0.2 });
  }

  /** Fire a class-independent one-shot (traversal/farming/magic); 0 if missing. */
  private playGlobalOnce(key: ActionKey, holdLast = false): number {
    const id = resolveGlobalAction(key);
    return id ? this.playOnce(id, holdLast) : 0;
  }

  /** Fire a one-shot clip and schedule its auto-revert. */
  private playOnce(id: string, holdLast = false, fade = 0.08): number {
    // A rooted full-body one-shot takes over the whole skeleton, so drop any
    // upper-body additive overlay rather than layering a swing on top of it.
    this.clearOverlay();
    const a = this.setActive(id, { loop: false, clamp: true, fade });
    if (!a) return 0;
    const dur = a.getClip().duration;
    // Normal single swings end slightly early (0.92) so their settle tail doesn't
    // drag before the next chain hit. The retargeted GLB clips, however, are FULL
    // multi-swing combos — their "tail" is another swing — so they MUST run to true
    // clip duration or the final swing is truncated (USER-DIRECTED axe combo fix).
    const endFactor = GLB_CLIP_IDS.has(id) ? 1 : 0.92;
    this.once = { endTime: this.time + dur * endFactor, hold: holdLast };
    if (holdLast) this.once.endTime = Number.POSITIVE_INFINITY;
    return dur;
  }

  /**
   * Play `id` as an upper-body additive overlay (see {@link attackMoving}). The
   * weight + playback rate scale with `intensity` (0..1). Restarts cleanly if an
   * overlay is already running (combo chaining). Returns the rate-adjusted clip
   * duration, or 0 when the clip is missing.
   */
  private playOverlay(id: string, intensity: number): number {
    const action = this.additiveAction(id);
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
      fadeTime: this.time + Math.max(0, dur - OVERLAY_FADE),
      endTime: this.time + dur,
      fading: false,
    };
    return dur;
  }

  /** Stop and drop the active additive combat overlay, if any. */
  private clearOverlay(): void {
    if (!this.overlay) return;
    this.overlay.action.stop();
    this.overlay = null;
  }

  /**
   * Release the locomotion blend so a single clip can take over. Collapses the
   * blend to its heaviest action (kept at full weight + natural time) and adopts
   * it as `current`, giving the next clip something clean to crossFadeFrom.
   */
  private beginSingle(): void {
    if (!this.blendDriving) return;
    const dom = this.locoBlend.collapseToDominant();
    this.current = dom?.action ?? null;
    this.currentId = dom?.id ?? null;
    this.blendDriving = false;
  }

  /**
   * Make `id` the dominant clip, crossfading from whatever played before. Reuses
   * the cached action so repeated loco frames don't restart the clip.
   */
  private setActive(
    id: string,
    opts: { loop: boolean; timeScale?: number; clamp?: boolean; fade?: number },
  ): THREE.AnimationAction | null {
    // Any single-clip activation first takes the pose back from the blend so the
    // crossfade has a stable, single `current` to fade from.
    this.beginSingle();
    const a = this.action(id);
    if (!a) return null;

    const loop = opts.loop;
    if (this.current === a && this.currentId === id) {
      // Same clip still dominant: just keep the time-scale fresh (loco speed).
      if (opts.timeScale !== undefined) a.setEffectiveTimeScale(opts.timeScale);
      return a;
    }

    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop && (opts.clamp ?? false);
    a.setEffectiveTimeScale(opts.timeScale ?? 1);
    a.setEffectiveWeight(1);
    a.enabled = true;
    a.play();

    const fade = opts.fade ?? 0.2;
    if (this.current && this.current !== a) {
      a.crossFadeFrom(this.current, fade, true);
    }
    this.current = a;
    this.currentId = id;
    return a;
  }

  /**
   * Get/create a cached action for a clip id.
   * Stable bind: filter → strip limb/scale pos → hip X/Z lock → sanitize NaN.
   * One mixer only — never create a second AnimationMixer for weapon packs.
   */
  private action(id: string): THREE.AnimationAction | null {
    const cached = this.actionCache.get(id);
    if (cached) return cached;
    const clip = this.clips.get(id);
    if (!clip) return null;
    const c = stabilizeClipForMixer(clip, {
      root: this.character.skeletonRoot,
      bindHip: { x: this.bindHipX, y: this.bindHipY, z: this.bindHipZ },
      keepRootPosition: true,
    });
    const action = this.mixer.clipAction(c);
    this.actionCache.set(id, action);
    return action;
  }

  /**
   * Get/create a cached UPPER-BODY ADDITIVE action for a clip id. The clip is
   * stabilized, stripped to upper-body tracks (legs stay on the locomotion
   * blend), made additive relative to its own first frame, and registered with
   * the additive blend mode. Cached under a separate key so it never collides
   * with the full-body action of the same id.
   */
  private additiveAction(id: string): THREE.AnimationAction | null {
    const key = `__additive__/${id}`;
    const cached = this.actionCache.get(key);
    if (cached) return cached;
    const clip = this.clips.get(id);
    if (!clip) return null;
    const c = stabilizeClipForMixer(clip, {
      root: this.character.skeletonRoot,
      bindHip: { x: this.bindHipX, y: this.bindHipY, z: this.bindHipZ },
      keepRootPosition: false, // upper body only — no hip travel on overlay
    });
    c.tracks = c.tracks.filter((t) => isUpperBodyTrack(t.name));
    if (c.tracks.length === 0) return null;
    THREE.AnimationUtils.makeClipAdditive(c);
    const action = this.mixer.clipAction(c, undefined, THREE.AdditiveAnimationBlendMode);
    this.actionCache.set(key, action);
    return action;
  }

  /**
   * Clear action cache when clips are hot-replaced (weapon pack rebind).
   * Keeps the same AnimationMixer instance — best practice for stack.
   */
  invalidateActionCache(): void {
    for (const a of this.actionCache.values()) {
      try {
        a.stop();
        this.mixer.uncacheAction(a.getClip());
      } catch {
        /* ignore */
      }
    }
    this.actionCache.clear();
    this.current = null;
    this.currentId = null;
  }
}

export {
  isHipsPositionTrack,
  lockHorizontalRoot,
} from "../clipTracks";
