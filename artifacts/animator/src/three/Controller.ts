import * as THREE from "three";
import type { InputState } from "./input";
import type { Avatar, EditorParams } from "./types";
import {
  NO_WATER_BAND,
  isInWaterBand,
  sinkClampVertical,
  type WaterBand,
} from "./dungeon/water";
import {
  PlayerAnimationDirector,
  type LocomotionSetMap,
  type PlayAnimationOpts,
  type RegisterAnimationOpts,
} from "./PlayerAnimationDirector";

export interface ControllerState {
  grounded: boolean;
  jumpsLeft: number;
  speed: number;
  /** True when an edge/cliff probe blocked forward motion this frame. */
  edgeBlocked?: boolean;
}

/**
 * Optional third-person camera + locomotion polish (three-player-controller parity).
 * All fields optional; defaults preserve existing Danger Room / dungeon feel.
 */
export interface ControllerCameraOpts {
  /** Over-the-shoulder horizontal view offset ratio (0..0.45). */
  enableOverShoulderView?: boolean;
  camOverShoulderOffsetRatio?: number;
  /** Spring-damped look-at follow (GameCamera-style critically damped spring). */
  enableSpringCamera?: boolean;
  springCameraTime?: number;
  /** Look-at height as ratio of cameraHeight (0 = feet, 1 = params.cameraHeight). */
  camLookAtHeightRatio?: number;
  /** When false, ignore mouse wheel distance zoom (default: allow zoom). */
  enableZoom?: boolean;
  /** Optional override for orbit distance (Minecraft harvest/build ~closer). */
  cameraDistance?: number;
  /** Optional override for look-at height meters. */
  cameraHeight?: number;
  /** Optional third-person pitch (radians, higher = more top-down). */
  pitch?: number;
}

export interface EdgeProbeOpts {
  /** Stop walking toward unsupported drops (default true). */
  enableEdgeStop?: boolean;
  /** How far ahead (m) to sample ground for edges. */
  probeDistance?: number;
  /** Max allowed drop (m) before the edge is treated as a cliff. */
  maxDrop?: number;
  /** Optional height sampler; return null when no ground (void). */
  groundHeightAt?: (x: number, z: number) => number | null;
}

/**
 * Pluggable world-collision backend. When set on the Controller, end-of-frame
 * movement is reconciled through `move()` (a Rapier KCC in the dungeon) instead
 * of the flat Danger Room floor + box bounds. `from` is the body feet position
 * at the start of the frame, `delta` the attempted displacement; the result is
 * the corrected feet position + whether the body is standing on ground.
 */
export interface CollisionProvider {
  move(from: THREE.Vector3, delta: THREE.Vector3): { pos: THREE.Vector3; grounded: boolean };
}

/**
 * Third-person controller: camera-relative WASD over a yaw/pitch orbit camera,
 * gravity + ground clamp, ground jump + one mid-air double jump, and it drives
 * the Character's locomotion blend + facing.
 */
export class Controller {
  yaw = 0;
  pitch = 0.32;
  private velocity = new THREE.Vector3();
  /** Damped external knockback impulse (e.g. taking a hit), added every frame on
   *  top of whatever the movement branch does, so it survives input override. */
  private extVel = new THREE.Vector3();
  /** Decay rate for `extVel` (per second, used as exp(-k·dt)). Higher = more
   *  friction / shorter slide. Set per-impulse by {@link applyImpulse}; a blocked
   *  big-hit bounce-back drops it low so the separation slides out smoothly. */
  private extVelDamp = 7;
  private vertical = 0;
  private grounded = true;
  private jumpsLeft = 2;
  private wantFacing = 0;
  private smoothedSpeed = 0;
  /** Transient move-speed multiplier (e.g. the Kiter's Smoke Phantom sprint). */
  private speedMult = 1;
  private bound = 15;
  /** Half-extent of the flat-floor play box (Danger Room analytic walls / clamp). */
  private roomBound = 15;
  /**
   * When a CollisionProvider is set (Rapier KCC), bound is usually huge so mesh
   * worlds aren't clipped. Danger Room still sets {@link keepRoomBounds} so the
   * arena box + wall-run probes keep working on top of the shared KCC ground.
   */
  private keepRoomBounds = false;
  /** Pluggable world collision (Rapier KCC SSOT). Null = pure Y=0 fallback. */
  private collision: CollisionProvider | null = null;
  /** Live interior obstacle circles (XZ) for Danger Room push-out collision —
   *  pillars, training dummies and opponents. Only consulted on the null
   *  (Danger Room) path; the dungeon/arena KCC owns collision when set. */
  private obstacles: (() => { x: number; z: number; r: number }[]) | null = null;
  /** Meshes the third-person camera pulls in front of (dungeon walls). */
  private occluders: THREE.Object3D[] = [];
  /** Dungeon water band [bottom, top] (world Y). Outside the band ⇒ no clamp. */
  private waterBand: WaterBand = NO_WATER_BAND;
  /** Slow constant sink speed (u/s) while inside the water band. */
  private readonly SINK_SPEED = 4;
  private camRay = new THREE.Raycaster();
  private didDoubleJump = false;
  /** Seconds left of a fast-turn window (set by faceToward) for crosshair lock. */
  private facingBoost = 0;
  /**
   * Hard focus lock: camera frames this point and body faces it so A/D is pure
   * strafe. Soft lock (selected target without RMB) leaves this null so A/D is
   * camera-relative walk/run. Null = free / soft-lock locomotion.
   */
  private lockTarget: THREE.Vector3 | null = null;

  /** Camera framing: orbit "third" person, or eye-anchored "first" person. */
  private viewMode: "third" | "first" = "third";
  /** First-person look elevation (radians, + = up). Full range, unlike the
   *  third-person `pitch` which stays positive so the orbit never dips underfloor. */
  private fpPitch = 0;
  /** Live recoil offset (radians) added to the aim each frame; pushed in by the
   *  consumer from the shared `Recoil` model. +pitch kicks the view up. */
  private aimPitch = 0;
  private aimYaw = 0;
  /** Additive FOV offset (degrees) on top of params.fov — the sprint "kick"
   *  (DGS CameraController). Owned by the consumer via setFovKick. */
  private fovKickAmt = 0;
  /** Camera-shake "trauma" (0..1) that decays each frame; the screen offset is
   *  trauma² so light taps barely register while heavy hits rattle hard. Fed by
   *  the consumer (e.g. heavy mech footsteps / landings) via {@link addCameraShake}. */
  private shakeTrauma = 0;
  /** Per-Controller phase seed so two sessions don't shake in lock-step. */
  private readonly shakeSeed = Math.random() * 1000;
  /** The additive shake offset applied last frame, removed before the next base
   *  pose is computed so the (lerped) third-person camera never accumulates it. */
  private readonly shakeOffset = new THREE.Vector3();
  /** Scratch ray reused by aimRay() so screen-centre aim allocates nothing. */
  private aimRayCache = new THREE.Ray();

  // --- three-player-controller parity: events, edge, camera polish, anim API ---
  /** Animation director (register/play/locomotion sets). Lazy-created on first use. */
  private animDirector: PlayerAnimationDirector | null = null;
  /** Fired when grounded flag flips. */
  onGroundChange?: (onGround: boolean) => void;
  /** Fired just before first/third person switch. */
  onBeforeViewChange?: (isFirstPerson: boolean) => void;
  /** Fired after first/third person switch. */
  onViewChange?: (isFirstPerson: boolean) => void;
  /** Fired when look/move intent updates (dx, dy mouse deltas + planar speed). */
  onTowardChange?: (dx: number, dy: number, speed: number) => void;
  /** Forwarded from PlayerAnimationDirector when the active clip changes. */
  onAnimationChange?: (name: string, action: THREE.AnimationAction | null) => void;

  private enableOverShoulderView = false;
  private camOverShoulderOffsetRatio = 0.2;
  private enableSpringCamera = false;
  private springCameraTime = 0.05;
  private camLookAtHeightRatio = 1;
  private enableZoom = true;
  private springLookAt = new THREE.Vector3();
  private springVel = new THREE.Vector3();
  private springInited = false;
  private overShoulderApplied = false;

  private enableEdgeStop = true;
  private edgeProbeDistance = 0.55;
  private edgeMaxDrop = 0.9;
  private groundHeightAt: ((x: number, z: number) => number | null) | null = null;
  private edgeBlocked = false;
  private prevGrounded = true;

  // Lunge state (signature / kick attacks): an eased "spline" body translation
  // that drives in toward a strike point then springs back, kept in sync with
  // the animation clip so the joint motion and the root motion read as one move.
  private dashActive = false;
  private dashElapsed = 0;
  private dashDuration = 0;
  private dashReach = 0;
  private dashSettle = 0;
  private dashImpactAt = 0.5;
  private dashImpactFired = false;
  private dashOrigin = new THREE.Vector3();
  private dashDir = new THREE.Vector3();
  private justDashImpact = false;
  // Skyfall special: track the launch so we can fire a barrage at the apex.
  private skyfallArmed = false;
  private justApex = false;
  // Skyfall launch flair: a twist-flip while rising straight up to the apex.
  private skyfallRiseElapsed = 0;
  private skyfallRiseDur = 0;

  // --- Striker procedural specials (fire-kick fighter) ---
  // In-place backflip (launcher): a pitch tumble + vertical arc, NO horizontal
  // recoil; owns the body for its duration.
  private flipActive = false;
  private flipElapsed = 0;
  private flipDuration = 0;
  private flipHop = 0;
  // Ground forward roll-out used to absorb a hard / double-jump landing.
  private rollActive = false;
  private rollElapsed = 0;
  private rollDuration = 0;
  private rollDir = new THREE.Vector3(0, 0, 1);
  // Hover: hop back, then float at a fixed height for a beat (input allowed,
  // jump cancels). Gravity is suspended while active.
  private hoverActive = false;
  private hoverElapsed = 0;
  private hoverDuration = 0;
  private hoverHeight = 0;
  private hoverEnd = false;
  private hoverWasActive = false;
  /**
   * Skill short-flight (hh-hang three-player-controller fly mode, timed).
   * Free 3D cam-relative motion for leap/gap-closer skills — not full toggle-fly.
   */
  private skillFlightActive = false;
  private skillFlightElapsed = 0;
  private skillFlightDuration = 0;
  private skillFlightSpeed = 9;
  private skillFlightEnd = false;
  private justRollLanding = false;
  // Aerial spin: rise + spin the body fast, then report the end so the Studio can
  // fire the flame-slash projectile.
  private spinActive = false;
  private spinElapsed = 0;
  private spinDuration = 0;
  private spinHeight = 0;
  private justSpinEnd = false;
  // Landing telemetry (drives the roll-out decision in the Studio).
  private landingSpeed = 0;
  private landedWithDouble = false;
  private slamActive = false;
  private justSlamLanded = false;

  // ── Wall traversal (once-per-ground air charges) ───────────────────────
  /** One wall jump allowed between ground contacts. */
  private airWallJumpUsed = false;
  /** One double-jump / staff hover allowed between ground contacts. */
  private airDoubleUsed = false;
  private wallRunActive = false;
  private wallRunElapsed = 0;
  private wallRunMax = 1.35;
  private wallNormal = new THREE.Vector3(0, 0, 1);
  private justWallJumped = false;
  private justWallRunStart = false;
  private justWallRunEnd = false;
  /** Min height (m) above floor before wall-run can start. */
  private readonly WALL_RUN_MIN_Y = 0.4;
  /** Probe reach for wall contact (m). */
  private readonly WALL_PROBE = 0.62;

  constructor(
    private character: Avatar,
    private camera: THREE.PerspectiveCamera,
    private input: InputState,
    private params: EditorParams,
  ) {}

  setParams(p: EditorParams) {
    this.params = p;
  }

  get state(): ControllerState {
    return {
      grounded: this.grounded,
      jumpsLeft: this.jumpsLeft,
      speed: this.smoothedSpeed,
      edgeBlocked: this.edgeBlocked,
    };
  }

  /**
   * Camera polish options (over-shoulder, spring follow, look-at height, zoom).
   * Safe to call any time; applies on next {@link updateCamera}.
   */
  setCameraOpts(opts: ControllerCameraOpts) {
    if (opts.enableOverShoulderView != null) this.enableOverShoulderView = opts.enableOverShoulderView;
    if (opts.camOverShoulderOffsetRatio != null) {
      this.camOverShoulderOffsetRatio = THREE.MathUtils.clamp(opts.camOverShoulderOffsetRatio, 0, 0.45);
    }
    if (opts.enableSpringCamera != null) this.enableSpringCamera = opts.enableSpringCamera;
    if (opts.springCameraTime != null) this.springCameraTime = Math.max(0.0001, opts.springCameraTime);
    if (opts.camLookAtHeightRatio != null) {
      this.camLookAtHeightRatio = THREE.MathUtils.clamp(opts.camLookAtHeightRatio, 0, 1.5);
    }
    if (opts.enableZoom != null) this.enableZoom = opts.enableZoom;
    if (opts.cameraDistance != null && Number.isFinite(opts.cameraDistance)) {
      this.params.cameraDistance = THREE.MathUtils.clamp(opts.cameraDistance, 2.2, 16);
    }
    if (opts.cameraHeight != null && Number.isFinite(opts.cameraHeight)) {
      this.params.cameraHeight = THREE.MathUtils.clamp(opts.cameraHeight, 0.4, 3.5);
    }
    if (opts.pitch != null && Number.isFinite(opts.pitch)) {
      this.pitch = THREE.MathUtils.clamp(opts.pitch, 0.06, 1.35);
    }
    this.applyOverShoulder();
  }

  /** Cliff/ledge edge-stop options + optional ground height sampler for mesh worlds. */
  setEdgeProbeOpts(opts: EdgeProbeOpts) {
    if (opts.enableEdgeStop != null) this.enableEdgeStop = opts.enableEdgeStop;
    if (opts.probeDistance != null) this.edgeProbeDistance = Math.max(0.1, opts.probeDistance);
    if (opts.maxDrop != null) this.edgeMaxDrop = Math.max(0.05, opts.maxDrop);
    if (opts.groundHeightAt !== undefined) this.groundHeightAt = opts.groundHeightAt;
  }

  /** True when this frame's move was cut short by an unsupported edge. */
  get isEdgeBlocked(): boolean {
    return this.edgeBlocked;
  }

  /**
   * Lazily attach a {@link PlayerAnimationDirector} for register/play/locomotion-set APIs.
   * Character must already be loaded (clips present) for register calls to succeed.
   */
  getAnimationDirector(): PlayerAnimationDirector {
    if (!this.animDirector) {
      // Character is the concrete GLB avatar; cast is safe when Studio uses Character.
      this.animDirector = new PlayerAnimationDirector(
        this.character as import("./Character").Character,
      );
      this.animDirector.onAnimationChange = (name, action) => this.onAnimationChange?.(name, action);
      this.animDirector.captureBaseline();
    }
    return this.animDirector;
  }

  /** @see PlayerAnimationDirector.playPlayerAnimationByName */
  playPlayerAnimationByName(name: string, fade?: number): boolean {
    return this.getAnimationDirector().playPlayerAnimationByName(name, fade);
  }

  /** @see PlayerAnimationDirector.registerAnimation */
  registerAnimation(key: string, clipName: string, opts?: RegisterAnimationOpts): boolean {
    return this.getAnimationDirector().registerAnimation(key, clipName, opts);
  }

  /** @see PlayerAnimationDirector.playAnimation */
  playAnimation(key: string, opts?: PlayAnimationOpts): number {
    return this.getAnimationDirector().playAnimation(key, opts);
  }

  /** @see PlayerAnimationDirector.registerLocomotionSet */
  registerLocomotionSet(setName: string, map: LocomotionSetMap): void {
    this.getAnimationDirector().registerLocomotionSet(setName, map);
  }

  /** @see PlayerAnimationDirector.switchLocomotionSet */
  switchLocomotionSet(setName: string, fade?: number): boolean {
    return this.getAnimationDirector().switchLocomotionSet(setName, fade);
  }

  /** Returns true if a double jump fired this frame (for VFX hooks). */
  private justDoubleJumped = false;
  consumeDoubleJump(): boolean {
    const v = this.justDoubleJumped;
    this.justDoubleJumped = false;
    return v;
  }
  private justLanded = false;
  consumeLanded(): boolean {
    const v = this.justLanded;
    this.justLanded = false;
    return v;
  }

  /** World-space forward (camera yaw projected onto the floor). */
  forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  /**
   * Add camera-shake trauma (clamped to 1). The visible jitter scales with
   * trauma², so a small value (~0.2, a heavy footstep) is a subtle rattle while a
   * large value (~0.6, a landing slam) really kicks the view. Trauma decays on its
   * own each frame, so callers just pump in impulses on impact frames.
   */
  addCameraShake(amount: number) {
    this.shakeTrauma = THREE.MathUtils.clamp(this.shakeTrauma + amount, 0, 1);
  }

  /** True while the body is on the floor (no double-jump / air state). */
  get isGrounded(): boolean {
    return this.grounded;
  }

  /** Lock-on: face/frame this world point each frame (null clears the stance). */
  setLockTarget(p: THREE.Vector3 | null) {
    this.lockTarget = p ? new THREE.Vector3(p.x, 0, p.z) : null;
  }

  /** Current camera framing. */
  get view(): "third" | "first" {
    return this.viewMode;
  }

  /** True while the eye-anchored first-person camera is active. */
  get isFirstPerson(): boolean {
    return this.viewMode === "first";
  }

  /**
   * Switch camera framing. Entering first person hides the player's own avatar so
   * the body never blocks the view (no separate first-person arms model); exiting
   * restores it. The third-person orbit is untouched while in third person.
   */
  setViewMode(mode: "third" | "first") {
    if (mode === this.viewMode) return;
    this.onBeforeViewChange?.(this.viewMode === "first");
    this.viewMode = mode;
    this.character.root.visible = mode !== "first";
    if (mode === "first") {
      this.fpPitch = 0;
      this.clearOverShoulder();
    } else {
      this.applyOverShoulder();
    }
    this.onViewChange?.(mode === "first");
  }

  private applyOverShoulder() {
    if (!this.enableOverShoulderView || this.viewMode === "first") {
      this.clearOverShoulder();
      return;
    }
    const w = typeof window !== "undefined" ? window.innerWidth : 1;
    const h = typeof window !== "undefined" ? window.innerHeight : 1;
    if (w < 2 || h < 2) return;
    this.camera.setViewOffset(w, h, w * this.camOverShoulderOffsetRatio, 0, w, h);
    this.overShoulderApplied = true;
  }

  private clearOverShoulder() {
    if (this.overShoulderApplied) {
      this.camera.clearViewOffset();
      this.overShoulderApplied = false;
    }
  }

  /**
   * Sample ground height under (x,z). Custom sampler when set; otherwise flat
   * y=0 (Danger Room). Return null for void so edge-stop can block the step.
   */
  private sampleGroundY(x: number, z: number): number | null {
    if (this.groundHeightAt) return this.groundHeightAt(x, z);
    return 0;
  }

  /**
   * True when moving in `dir` (XZ unit) would step off an unsupported drop.
   * three-player-controller relies on capsule+mesh; we add an explicit cliff probe
   * so open edges do not walk the player into the void. Only active when a
   * custom groundHeightAt sampler is provided (mesh/heightmap worlds).
   */
  private isEdgeInDirection(dirX: number, dirZ: number, from: THREE.Vector3): boolean {
    if (!this.enableEdgeStop || !this.grounded || !this.groundHeightAt) return false;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-4) return false;
    const nx = dirX / len;
    const nz = dirZ / len;
    const ax = from.x + nx * this.edgeProbeDistance;
    const az = from.z + nz * this.edgeProbeDistance;
    const feetY = from.y;
    const groundY = this.sampleGroundY(ax, az);
    if (groundY == null) return true;
    return feetY - groundY > this.edgeMaxDrop;
  }

  /** Toggle between first- and third-person framing. */
  toggleView() {
    this.setViewMode(this.viewMode === "first" ? "third" : "first");
  }

  /**
   * Push the live recoil offset (radians) applied to the aim/camera this frame.
   * `pitch` kicks the view up; `yaw` nudges it sideways. Fed by the shared `Recoil`
   * model in the consumer; cleared to zero when no weapon is recoiling.
   */
  setAimOffset(pitch: number, yaw: number) {
    this.aimPitch = pitch;
    this.aimYaw = yaw;
  }

  /** Additive FOV offset (degrees) applied on top of the base params.fov, used
   *  for the sprint kick. Pass 0 to clear. */
  setFovKick(extraDeg: number) {
    this.fovKickAmt = extraDeg;
  }

  /**
   * Screen-centre aim ray (camera origin along camera forward) — identical maths
   * in both first and third person, since the camera is always looking through the
   * crosshair. Reuses a cached Ray; copy it if you need to retain the result.
   */
  aimRay(): THREE.Ray {
    this.camera.getWorldPosition(this.aimRayCache.origin);
    this.camera.getWorldDirection(this.aimRayCache.direction);
    this.aimRayCache.direction.normalize();
    return this.aimRayCache;
  }

  /**
   * Swap the world-collision backend (fleet SSOT: Rapier KCC from
   * `@workspace/grudge-physics`). When a provider is set, mesh worlds lift the
   * box clamp; Danger Room passes `keepRoomBounds: true` so arena walls + circle
   * obstacles still apply on top of the shared ground KCC. Passing null restores
   * pure Y=0 fallback (prefer re-applying the Danger Room KCC instead).
   */
  setCollision(
    p: CollisionProvider | null,
    spawn?: THREE.Vector3,
    opts?: { keepRoomBounds?: boolean },
  ) {
    this.collision = p;
    this.keepRoomBounds = !!(p && opts?.keepRoomBounds);
    this.bound = p && !this.keepRoomBounds ? 1e5 : this.roomBound;
    if (!p) this.occluders = [];
    if (spawn) {
      this.character.root.position.copy(spawn);
      this.vertical = 0;
      this.velocity.set(0, 0, 0);
      this.extVel.set(0, 0, 0);
      this.grounded = true;
      this.jumpsLeft = 2;
      this.didDoubleJump = false;
    }
  }

  /** Meshes the third-person camera pulls in front of (dungeon walls/props). */
  setCameraOccluders(meshes: THREE.Object3D[]) {
    this.occluders = meshes;
  }

  /**
   * Instantly relocate the body (a teleport / blink): copy `pos`, clamp it inside
   * the active room bounds, and reset fall/dash/velocity state so the caster lands
   * cleanly without inheriting pre-blink momentum. Used by the Arcane Staff's
   * void-jaunt; safe in both the flat Danger Room and dungeon (KCC) modes.
   */
  blinkTo(pos: THREE.Vector3) {
    const b = this.bound - 0.5;
    this.character.root.position.set(
      THREE.MathUtils.clamp(pos.x, -b, b),
      pos.y,
      THREE.MathUtils.clamp(pos.z, -b, b),
    );
    this.vertical = 0;
    this.velocity.set(0, 0, 0);
    this.extVel.set(0, 0, 0);
    this.dashActive = false;
    this.grounded = true;
  }

  /**
   * Define a vertical water band: while the body's feet are inside [bottom, top]
   * the downward fall speed is clamped to a slow sink (rather than free-fall
   * gravity) so the player descends gently through the dungeon's water layer.
   */
  setWaterBand(top: number, bottom: number) {
    this.waterBand = { top, bottom };
  }

  /** Drop the water band — body falls under normal gravity again. */
  clearWaterBand() {
    this.waterBand = NO_WATER_BAND;
  }

  /** True while the body's feet are within the active water band. */
  isInWater(): boolean {
    return isInWaterBand(this.character.root.position.y, this.waterBand);
  }

  /**
   * Supply a live source of interior obstacle circles (pillars, dummies,
   * opponents) so the body can't walk through them in the Danger Room. The
   * callback is read every frame (positions move), and is ignored while a
   * collision provider is active (the KCC handles collision there). Pass null
   * to disable.
   */
  setObstacles(fn: (() => { x: number; z: number; r: number }[]) | null) {
    this.obstacles = fn;
  }

  /**
   * Expand/shrink the flat Danger Room bounds (half-extent metres). Used by
   * Ruins Brawler and other large arenas that share this controller without a KCC.
   * No-op while a collision provider owns world bounds.
   */
  setRoomBound(halfExtent: number) {
    this.roomBound = Math.max(4, halfExtent);
    if (!this.collision) this.bound = this.roomBound;
  }

  /** True while a dungeon collision backend is active. */
  get hasCollision(): boolean {
    return this.collision !== null;
  }

  jump() {
    // Wall jump takes priority when airborne near a wall (Space on wall run /
    // near wall). Independent of double-jump charge — enables triple jump:
    // ground → double/hover → wall (or ground → wall → double).
    if (!this.grounded && this.tryWallJump()) return;

    // A hover is cancelled by jumping out of it (kept feeling responsive).
    // Does NOT grant a free second double — only cancels the float.
    if (this.hoverActive) {
      this.hoverActive = false;
      this.vertical = Math.sqrt(2 * this.params.gravity * this.params.jumpHeight) * 0.95;
      this.jumpsLeft = 0;
      this.didDoubleJump = true;
      this.airDoubleUsed = true;
      this.character.playRoleOnce("jump", 0.08);
      return;
    }
    if (this.grounded) {
      this.vertical = Math.sqrt(2 * this.params.gravity * this.params.jumpHeight);
      this.grounded = false;
      this.jumpsLeft = 1;
      this.didDoubleJump = false;
      this.airDoubleUsed = false;
      this.airWallJumpUsed = false;
      this.character.playRoleOnce("jump", 0.1);
    } else if (this.jumpsLeft > 0 && !this.didDoubleJump && !this.airDoubleUsed) {
      // One double-jump / staff-hover per ground cycle.
      this.vertical = Math.sqrt(2 * this.params.gravity * this.params.jumpHeight) * 0.95;
      this.jumpsLeft = 0;
      this.didDoubleJump = true;
      this.airDoubleUsed = true;
      this.justDoubleJumped = true;
      this.character.playRoleOnce("jump", 0.08);
    }
  }

  /**
   * Probe for a nearby vertical surface: room bounds or obstacle pillars.
   * Returns outward wall normal (points away from the wall into free space).
   */
  probeWall(reach = this.WALL_PROBE): { normal: THREE.Vector3; dist: number } | null {
    const pos = this.character.root.position;
    const candidates: { n: THREE.Vector3; d: number }[] = [];
    const b = this.bound;
    // Room box walls
    if (pos.x >= b - reach) candidates.push({ n: new THREE.Vector3(-1, 0, 0), d: Math.max(0, b - pos.x) });
    if (pos.x <= -b + reach) candidates.push({ n: new THREE.Vector3(1, 0, 0), d: Math.max(0, pos.x + b) });
    if (pos.z >= b - reach) candidates.push({ n: new THREE.Vector3(0, 0, -1), d: Math.max(0, b - pos.z) });
    if (pos.z <= -b + reach) candidates.push({ n: new THREE.Vector3(0, 0, 1), d: Math.max(0, pos.z + b) });
    // Pillar / obstacle circles (Danger Room)
    if (this.obstacles) {
      for (const o of this.obstacles()) {
        const dx = pos.x - o.x;
        const dz = pos.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-4) continue;
        const gap = d - o.r;
        if (gap < reach && gap > -0.25) {
          candidates.push({
            n: new THREE.Vector3(dx / d, 0, dz / d),
            d: Math.max(0, gap),
          });
        }
      }
    }
    if (candidates.length === 0) return null;
    let best = candidates[0]!;
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i]!.d < best.d) best = candidates[i]!;
    }
    return { normal: best.n.clone(), dist: best.d };
  }

  /** True when airborne and close enough to a wall for jump / run. */
  nearWall(reach = this.WALL_PROBE): boolean {
    if (this.grounded) return false;
    return this.probeWall(reach) != null;
  }

  /**
   * Kick off a nearby wall: foot-plant → jump away + up (higher than double).
   * One use between ground contacts. Returns true if the jump fired.
   */
  tryWallJump(): boolean {
    if (this.grounded || this.airWallJumpUsed || this.isBusy) return false;
    if (this.hoverActive) return false;
    const wall = this.probeWall(this.WALL_PROBE + 0.15);
    if (!wall) return false;

    this.airWallJumpUsed = true;
    this.endWallRun(false);
    this.hoverActive = false;

    const g = this.params.gravity;
    const h = this.params.jumpHeight;
    // Higher than a normal double-jump
    this.vertical = Math.sqrt(2 * g * h) * 1.22;
    this.grounded = false;
    // Push away from wall + slight tangential keep
    const push = 7.2;
    this.velocity.set(wall.normal.x * push, 0, wall.normal.z * push);
    this.extVel.set(wall.normal.x * 3.5, 0, wall.normal.z * 3.5);
    this.extVelDamp = 5;
    this.wallNormal.copy(wall.normal);
    this.wantFacing = Math.atan2(wall.normal.x, wall.normal.z);
    this.justWallJumped = true;

    // Prefer wall-kick / jump-away / utility kick clips when present
    const avatar = this.character as Avatar & {
      hasClip?: (n: string) => boolean;
      playClipOnce?: (n: string, f?: number) => number;
      reaction?: (n: string, f?: number) => boolean;
    };
    if (avatar.playClipOnce && avatar.hasClip) {
      if (avatar.hasClip("jumpAway")) avatar.playClipOnce("jumpAway", 0.06);
      else if (avatar.hasClip("utilityKick")) avatar.playClipOnce("utilityKick", 0.06);
      else if (avatar.hasClip("mmaKick")) avatar.playClipOnce("mmaKick", 0.06);
      else if (avatar.hasClip("backJump")) avatar.playClipOnce("backJump", 0.06);
      else this.character.playRoleOnce("jump", 0.06);
    } else {
      this.character.playRoleOnce("jump", 0.06);
    }
    return true;
  }

  /** True while body is stuck to a wall running / climbing. */
  get isWallRunning(): boolean {
    return this.wallRunActive;
  }

  /** Outward normal of the wall we're on (or last wall). */
  getWallNormal(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.wallNormal);
  }

  consumeWallJump(): boolean {
    const v = this.justWallJumped;
    this.justWallJumped = false;
    return v;
  }

  consumeWallRunStart(): boolean {
    const v = this.justWallRunStart;
    this.justWallRunStart = false;
    return v;
  }

  consumeWallRunEnd(): boolean {
    const v = this.justWallRunEnd;
    this.justWallRunEnd = false;
    return v;
  }

  /** Air charges remaining (for HUD / debug). */
  get airCharges(): { double: boolean; wallJump: boolean } {
    return { double: !this.airDoubleUsed, wallJump: !this.airWallJumpUsed };
  }

  private endWallRun(notify = true) {
    if (!this.wallRunActive) return;
    this.wallRunActive = false;
    this.wallRunElapsed = 0;
    if (notify) this.justWallRunEnd = true;
  }

  /**
   * Hold Shift while airborne near a wall (after a run jump) to wall-run.
   * Space during wall-run = wall jump. Gravity suspended; climb with W.
   */
  private updateWallRun(dt: number, sprinting: boolean, move: THREE.Vector3, mag: number) {
    const pos = this.character.root.position;

    if (this.wallRunActive) {
      this.wallRunElapsed += dt;
      const wall = this.probeWall(this.WALL_PROBE + 0.28);
      if (this.grounded || !sprinting || !wall || this.wallRunElapsed >= this.wallRunMax) {
        this.endWallRun(true);
        return;
      }
      this.wallNormal.copy(wall.normal);

      this.vertical = 0;
      this.grounded = false;
      // Climb up with W; S descends; slight auto-rise for "run up wall"
      const climb =
        this.input.down("KeyW") || this.input.down("ArrowUp") || this.input.moveY > 0.2
          ? 3.6
          : this.input.down("KeyS") || this.input.down("ArrowDown") || this.input.moveY < -0.2
            ? -2.2
            : 0.45;
      pos.y += climb * dt;
      pos.y = Math.max(0.05, pos.y);

      const n = this.wallNormal;
      const tangent = new THREE.Vector3(-n.z, 0, n.x);
      let along = 0;
      if (mag > 0.06) {
        along = move.x * tangent.x + move.z * tangent.z;
      } else {
        const f = this.forward();
        along = f.x * tangent.x + f.z * tangent.z;
        if (Math.abs(along) < 0.15) along = 1;
      }
      const sign = along >= 0 ? 1 : -1;
      const runSpeed = this.params.moveSpeed * 1.15 * this.speedMult;
      pos.x += tangent.x * sign * runSpeed * dt;
      pos.z += tangent.z * sign * runSpeed * dt;
      // Keep pressed against wall
      pos.x -= n.x * 0.03;
      pos.z -= n.z * 0.03;
      pos.x = THREE.MathUtils.clamp(pos.x, -this.bound, this.bound);
      pos.z = THREE.MathUtils.clamp(pos.z, -this.bound, this.bound);
      this.wantFacing = Math.atan2(
        -n.x * 0.4 + tangent.x * sign,
        -n.z * 0.4 + tangent.z * sign,
      );
      this.smoothedSpeed = runSpeed;
      return;
    }

    // Start: airborne + hold Shift + near wall + min height
    if (
      !this.grounded &&
      sprinting &&
      !this.isBusy &&
      !this.hoverActive &&
      !this.spinActive &&
      pos.y >= this.WALL_RUN_MIN_Y
    ) {
      const wall = this.probeWall(this.WALL_PROBE + 0.12);
      if (wall && wall.dist < this.WALL_PROBE) {
        this.wallRunActive = true;
        this.wallRunElapsed = 0;
        this.wallNormal.copy(wall.normal);
        this.justWallRunStart = true;
        this.vertical = 0;
        this.velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Lunge along `dir`: ease in to `distance` metres by `impactAt` of the move,
   * then ease back so the final offset is `distance - bounceBack` (a ninja-style
   * recoil when bounceBack > 0). `duration` is the whole in+out motion — pass a
   * value tied to the attack clip so the body and the joints stay in lockstep.
   */
  dash(dir: THREE.Vector3, distance: number, duration: number, bounceBack = 0, impactAt = 0.5) {
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-4 || duration <= 0) return;
    flat.normalize();
    this.dashActive = true;
    this.dashElapsed = 0;
    this.dashDuration = duration;
    this.dashReach = distance;
    this.dashSettle = distance - bounceBack;
    this.dashImpactAt = THREE.MathUtils.clamp(impactAt, 0.05, 0.95);
    this.dashImpactFired = false;
    this.dashOrigin.copy(this.character.root.position);
    this.dashDir.copy(flat);
    // Targets are physical colliders: if one lies inside the lunge path, stop the
    // body at its surface and REVERSE the leftover distance, so the lunge bounces
    // in and back out instead of clipping straight through the target. This
    // deliberately overrides any caller-supplied `bounceBack` for collided lunges.
    // The recoil is floored at the launch point (never behind origin): a contact
    // bounce reads as "in and out ON the target", and point-blank attacks (very
    // common in combos where the body is already adjacent) must not be flung
    // backward across the arena.
    const contact = this.dashContactDistance(distance);
    if (contact !== null && contact < distance) {
      const remaining = distance - contact;
      this.dashReach = contact;
      this.dashSettle = THREE.MathUtils.clamp(contact - remaining, 0, contact);
    }
    // Commit toward the target via a fast (but not snapped) turn — the lunge
    // facing is steered by the boosted turn rate below, avoiding a jarring snap.
    this.wantFacing = Math.atan2(flat.x, flat.z);
  }

  /**
   * Distance along the lunge direction to the first solid collider surface
   * (combatant footprint or prop) within `reach`, or null if the path is clear.
   * Only the flat Danger Room path is checked — the dungeon/arena KCC owns
   * collision when a provider is set. Standard ray↔circle intersection in XZ,
   * inflated by the player's footprint so the body stops flush, not overlapping.
   */
  private dashContactDistance(reach: number): number | null {
    if (this.collision || !this.obstacles) return null;
    const PLAYER_R = 0.35;
    const ox = this.dashOrigin.x;
    const oz = this.dashOrigin.z;
    const dx = this.dashDir.x;
    const dz = this.dashDir.z;
    let best: number | null = null;
    for (const o of this.obstacles()) {
      const R = o.r + PLAYER_R;
      const cx = o.x - ox;
      const cz = o.z - oz;
      // Already overlapping this collider at the start: contact is immediate.
      if (cx * cx + cz * cz <= R * R) return 0;
      const proj = cx * dx + cz * dz; // closest-approach parameter along the ray
      if (proj <= 0) continue; // collider sits behind the lunge
      const closestSq = cx * cx + cz * cz - proj * proj;
      const rSq = R * R;
      if (closestSq > rSq) continue; // ray misses the circle
      const t = proj - Math.sqrt(rSq - closestSq); // near intersection
      if (t >= 0 && t <= reach && (best === null || t < best)) best = t;
    }
    return best;
  }

  /**
   * Aim the body at a horizontal direction with a brief fast-turn window so the
   * character snaps to the crosshair target smoothly (not instantly) before a
   * strike. Used by the combo so every hit faces what you're aiming at.
   */
  faceToward(dir: THREE.Vector3, boost = 0.18) {
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-4) return;
    flat.normalize();
    this.wantFacing = Math.atan2(flat.x, flat.z);
    this.facingBoost = Math.max(this.facingBoost, boost);
  }

  /** Eased displacement (metres along the lunge dir) at normalized time tau. */
  private dashDisplacement(tau: number): number {
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    const impact = this.dashImpactAt;
    if (tau <= impact) return this.dashReach * easeOut(impact > 0 ? tau / impact : 1);
    const k = (tau - impact) / (1 - impact);
    return THREE.MathUtils.lerp(this.dashReach, this.dashSettle, easeOut(k));
  }

  get isDashing(): boolean {
    return this.dashActive;
  }

  /** True on the single frame the lunge reaches its strike point (for impact hooks). */
  consumeDashImpact(): boolean {
    const v = this.justDashImpact;
    this.justDashImpact = false;
    return v;
  }

  /** Launch high into the air; the apex is reported via consumeApex(). */
  skyLaunch(height: number) {
    // Cancel any competing aerial special so the gravity/apex path runs and the
    // apex is always detected — otherwise consumeApex() never fires and the
    // caller's skyfall barrage deadlocks.
    this.dashActive = false;
    this.flipActive = false;
    this.rollActive = false;
    this.spinActive = false;
    this.hoverActive = false;
    this.slamActive = false;
    this.vertical = Math.sqrt(2 * this.params.gravity * height);
    this.grounded = false;
    this.jumpsLeft = 0;
    this.didDoubleJump = true;
    this.skyfallArmed = true;
    this.justApex = false;
    // Estimate the rise time (v / g) so the twist-flip completes exactly at apex.
    this.skyfallRiseElapsed = 0;
    this.skyfallRiseDur = Math.max(0.2, this.vertical / this.params.gravity);
    this.character.root.rotation.x = 0;
    this.character.playRoleOnce("jump", 0.1);
  }

  /** True on the single frame the skyfall launch reaches its apex. */
  consumeApex(): boolean {
    const v = this.justApex;
    this.justApex = false;
    return v;
  }

  /** Add an upward velocity impulse (combo hops / flaming-foot bounce-away). */
  hop(v: number) {
    if (v <= 0) return;
    this.vertical = Math.max(this.vertical, v);
    this.grounded = false;
  }

  /**
   * Apply a horizontal knockback impulse (taking a hit), with a small hop.
   * `damp` sets the slide friction for this impulse: the default ~7 settles
   * quickly; a lower value (e.g. 2.5) gives a long, low-friction bounce-back
   * used for big hits soaked on a raised guard.
   */
  applyImpulse(dir: THREE.Vector3, speed: number, hop = 0, damp = 7) {
    this.extVel.x += dir.x * speed;
    this.extVel.z += dir.z * speed;
    this.extVelDamp = damp;
    if (hop > 0) this.hop(hop);
  }

  /**
   * Slam straight down: cancel any aerial special and drive a hard downward
   * velocity. The touchdown frame is reported via consumeSlamLanded() so the
   * host can detonate the ground-impact blast exactly on landing.
   */
  slamDown(speed = 28) {
    this.dashActive = false;
    this.flipActive = false;
    this.rollActive = false;
    this.spinActive = false;
    this.hoverActive = false;
    this.skyfallArmed = false;
    this.slamActive = true;
    this.vertical = -Math.abs(speed);
    this.grounded = false;
  }

  /** True on the single frame a slam touches down (fire the ground blast). */
  consumeSlamLanded(): boolean {
    const v = this.justSlamLanded;
    this.justSlamLanded = false;
    return v;
  }

  /** Drop a pending slam without detonating (a superseding action took over). */
  cancelSlam() {
    this.slamActive = false;
  }

  /**
   * In-place backflip (launcher): a full pitch tumble + a short vertical arc with
   * NO horizontal recoil. Owns the body until it lands again.
   */
  backflip(duration = 0.6, hop = 1.4) {
    this.flipActive = true;
    this.flipElapsed = 0;
    this.flipDuration = Math.max(0.2, duration);
    this.flipHop = hop;
    this.slamActive = false;
    this.grounded = false;
    this.jumpsLeft = 0;
    this.didDoubleJump = true;
    this.vertical = 0;
  }

  /** Ground forward roll-out (absorbs a hard / double-jump landing). */
  rollOut(dir: THREE.Vector3, duration = 0.55) {
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-4) flat.copy(this.forward());
    flat.normalize();
    this.rollActive = true;
    this.rollElapsed = 0;
    this.rollDuration = Math.max(0.2, duration);
    this.rollDir.copy(flat);
    this.wantFacing = Math.atan2(flat.x, flat.z);
  }

  /**
   * Hop back then float at `height` metres for `duration` seconds. Horizontal
   * input still works while hovering and a jump cancels it; gravity is suspended.
   */
  hover(height = 2, duration = 2, backHop = 3) {
    this.hoverActive = true;
    this.hoverElapsed = 0;
    this.hoverDuration = Math.max(0.2, duration);
    this.hoverHeight = height;
    this.slamActive = false;
    this.grounded = false;
    // Same once-per-ground rule as startHover (double-jump charge spent).
    this.jumpsLeft = 0;
    this.didDoubleJump = true;
    this.airDoubleUsed = true;
    this.vertical = 0;
    const back = this.forward().multiplyScalar(-backHop);
    this.velocity.x = back.x;
    this.velocity.z = back.z;
  }

  /** Rise + spin in place for `duration`s, then report via consumeSpinEnd(). */
  aerialSpin(duration = 1.5, height = 2.2) {
    this.spinActive = true;
    this.spinElapsed = 0;
    this.spinDuration = Math.max(0.3, duration);
    this.spinHeight = height;
    this.justSpinEnd = false;
    this.slamActive = false;
    this.grounded = false;
    this.jumpsLeft = 0;
    this.didDoubleJump = true;
    this.vertical = 0;
  }

  /** True on the single frame the aerial spin finishes (fire the projectile). */
  consumeSpinEnd(): boolean {
    const v = this.justSpinEnd;
    this.justSpinEnd = false;
    return v;
  }

  /** Downward speed at the last landing + whether a double jump was used. */
  get landingInfo(): { speed: number; doubled: boolean } {
    return { speed: this.landingSpeed, doubled: this.landedWithDouble };
  }

  /** True while any body-owning procedural special is running. */
  get isBusy(): boolean {
    return (
      this.dashActive ||
      this.flipActive ||
      this.rollActive ||
      this.spinActive ||
      this.skillFlightActive
    );
  }

  /** True while the aerial spin is active (for per-frame flame trails). */
  get spinning(): boolean {
    return this.spinActive;
  }

  /** True while hovering (for per-frame ember flicker). */
  get hovering(): boolean {
    return this.hoverActive;
  }

  /**
   * Begin a hover at `height` metres above the floor for `duration` seconds.
   * Gravity is suppressed while hovering; the player keeps one mid-hover jump.
   * A jump() call during hover exits it (the vertical impulse overrides the lock).
   */
  startHover(height: number, duration: number) {
    this.skillFlightActive = false;
    this.hoverActive = true;
    this.hoverElapsed = 0;
    this.hoverDuration = Math.max(0.1, duration);
    this.hoverHeight = Math.max(0.1, height);
    this.hoverEnd = false;
    this.hoverWasActive = true;
    this.vertical = 0;
    this.grounded = false;
    // Hover is the staff double-jump effect — one per ground cycle.
    // Keep one mid-hover jump only to *exit* float (not a free second double).
    this.jumpsLeft = 0;
    this.didDoubleJump = true;
    this.airDoubleUsed = true;
  }

  /** Cancel the hover early (e.g. character took damage). */
  endHover() {
    this.hoverActive = false;
  }

  /**
   * Skill short-flight — timed free-flight inspired by
   * [hh-hang/three-player-controller](https://github.com/hh-hang/three-player-controller)
   * `isFlying` mode, but for combat skills (gap-closers, leap slams), not full fly toggle.
   *
   * - Camera-relative 3D move (WASD + Space/Ctrl for up/down while active)
   * - Gravity off for `duration` seconds
   * - Ends → normal gravity / land
   */
  startSkillFlight(opts?: {
    duration?: number;
    speed?: number;
    /** Optional initial impulse along camera flat forward */
    launch?: number;
  }) {
    this.hoverActive = false;
    this.skillFlightActive = true;
    this.skillFlightElapsed = 0;
    this.skillFlightDuration = Math.max(0.12, opts?.duration ?? 0.42);
    this.skillFlightSpeed = Math.max(2, opts?.speed ?? 9);
    this.skillFlightEnd = false;
    this.grounded = false;
    this.vertical = 0;
    this.slamActive = false;
    const launch = opts?.launch ?? 4;
    if (launch > 0) {
      const f = this.forward();
      this.velocity.set(f.x * launch, 0, f.z * launch);
    }
    // Prefer fly / jump roles for visual
    if (this.character.hasRole("jump")) this.character.playRoleOnce("jump", 0.06);
  }

  endSkillFlight() {
    this.skillFlightActive = false;
  }

  get isSkillFlying(): boolean {
    return this.skillFlightActive;
  }

  /** True once when skill short-flight timer expires. */
  consumeSkillFlightEnd(): boolean {
    const v = this.skillFlightEnd;
    this.skillFlightEnd = false;
    return v;
  }

  /** Set a transient horizontal move-speed multiplier (1 = normal). */
  setSpeedMultiplier(m: number) {
    this.speedMult = Math.max(0, m);
  }

  /** True while the hover is active. */
  get isHovering(): boolean {
    return this.hoverActive;
  }

  /** True on the single frame the hover timer naturally expired (not a jump-exit). */
  consumeHoverEnd(): boolean {
    const v = this.hoverEnd;
    this.hoverEnd = false;
    return v;
  }

  /**
   * True on the frame the player lands after having double-jumped OR after
   * hovering — plays the Striker's roll-out recovery clip.
   */
  consumeRollLanding(): boolean {
    const v = this.justRollLanding;
    this.justRollLanding = false;
    return v;
  }

  /** Smoothstep ease used by the procedural tumbles. */
  private static easeInOut(x: number): number {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  /**
   * Optional splitter: Studio free-aim routes part of mouse to reticle offset
   * and returns residual deltas for camera look. Null = all mouse → camera.
   */
  onAimLook: ((dx: number, dy: number) => { camDx: number; camDy: number }) | null = null;

  update(dt: number) {
    const mouse = this.input.consumeMouse();
    let lookDx = mouse.dx;
    let lookDy = mouse.dy;
    if (this.onAimLook && (this.input.locked || this.input.lookActive)) {
      const split = this.onAimLook(mouse.dx, mouse.dy);
      lookDx = split.camDx;
      lookDy = split.camDy;
    }
    // Apply look from the mouse (pointer lock) OR from a touch look-pad drag.
    if (this.input.locked || this.input.lookActive) {
      const sens = 0.0022 * this.params.mouseSensitivity;
      const invert = this.params.invertY ? -1 : 1;
      // While locked on, the camera yaw is driven by the target, not the mouse.
      if (!this.lockTarget) this.yaw -= lookDx * sens;
      if (this.viewMode === "first") {
        // First person: dragging the mouse down looks down. fpPitch is the look
        // elevation (+ up), so drag-down decreases it; invertY flips. Near-±90°
        // clamp avoids gimbal flip at straight up/down.
        this.fpPitch = THREE.MathUtils.clamp(this.fpPitch - lookDy * sens * invert, -1.45, 1.45);
      } else {
        // Pitch up = camera rises and looks DOWN. By default dragging the mouse
        // down looks down (pitch up); invertY flips it. Clamp stays positive so
        // the orbit never drops the camera under the floor.
        this.pitch = THREE.MathUtils.clamp(this.pitch + lookDy * sens * invert, 0.06, 1.3);
      }
      if (lookDx !== 0 || lookDy !== 0) {
        this.onTowardChange?.(lookDx, lookDy, this.smoothedSpeed);
      }
    }
    // Wheel zooms the third-person orbit distance; in first person there is no
    // orbit, so the wheel is ignored (FOV zoom is owned by the consumer).
    if (this.enableZoom && mouse.wheel !== 0 && this.viewMode !== "first") {
      this.params.cameraDistance = THREE.MathUtils.clamp(
        this.params.cameraDistance + mouse.wheel * 0.005,
        2.5,
        10,
      );
    }
    this.edgeBlocked = false;
    this.prevGrounded = this.grounded;

    // Lock-on: drive the camera yaw so the player sits between the camera and the
    // target (enemy framed ahead). lockYaw also forces the body facing below so
    // A/D strafes instead of turning toward the movement direction.
    let lockYaw: number | null = null;
    if (this.lockTarget) {
      const toT = new THREE.Vector3(
        this.lockTarget.x - this.character.root.position.x,
        0,
        this.lockTarget.z - this.character.root.position.z,
      );
      if (toT.lengthSq() > 1e-4) {
        lockYaw = Math.atan2(toT.x, toT.z);
        let d = lockYaw - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += d * Math.min(1, 9 * dt);
      }
    }

    // Movement input (camera-relative).
    // forward() is the camera's view direction projected on the floor; the
    // camera sits BEHIND the character looking along +forward, so screen-right
    // is cross(up, -viewDir) = (-fwd.z, 0, fwd.x). The old (fwd.z,0,-fwd.x) was
    // the negative of that, which mirrored A/D (and the facing that tracks
    // movement) — it felt like driving the character from the far side of the
    // screen. Keep this sign so D = screen-right.
    const fwd = this.forward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (this.input.down("KeyW") || this.input.down("ArrowUp")) move.add(fwd);
    if (this.input.down("KeyS") || this.input.down("ArrowDown")) move.sub(fwd);
    if (this.input.down("KeyD") || this.input.down("ArrowRight")) move.add(right);
    if (this.input.down("KeyA") || this.input.down("ArrowLeft")) move.sub(right);

    // Analog joystick (touch) blends in on top of the keyboard. When the stick is
    // the only input, `analog` drives a proportional speed; the keyboard stays
    // full-speed (unit vectors) exactly as before.
    const analog = Math.abs(this.input.moveX) > 0.001 || Math.abs(this.input.moveY) > 0.001;
    if (analog) {
      move.addScaledVector(fwd, this.input.moveY);
      move.addScaledVector(right, this.input.moveX);
    }
    const mag = Math.min(1, move.length());

    const sprinting =
      this.input.down("ShiftLeft") || this.input.down("ShiftRight") || this.input.touchSprint;
    const speed =
      this.params.moveSpeed * (sprinting ? this.params.sprintMultiplier : 1) * this.speedMult;
    // Keyboard moves at full speed; the joystick scales by how far it's pushed.
    const intensity = analog && move.length() < 1 ? mag : 1;
    let moving = mag > 0.06;
    const pos = this.character.root.position;
    // Body position at the start of the frame — used to reconcile the attempted
    // displacement through the dungeon KCC at the end of the movement block.
    const prevPos = this.collision ? pos.clone() : null;
    if (this.dashActive) {
      // The lunge owns the body: drive position along the eased curve, overriding
      // input. This is the "spline motion" that pairs with the clip's joint motion.
      this.dashElapsed += dt;
      const tau = THREE.MathUtils.clamp(this.dashElapsed / this.dashDuration, 0, 1);
      const disp = this.dashDisplacement(tau);
      pos.x = THREE.MathUtils.clamp(this.dashOrigin.x + this.dashDir.x * disp, -this.bound, this.bound);
      pos.z = THREE.MathUtils.clamp(this.dashOrigin.z + this.dashDir.z * disp, -this.bound, this.bound);
      this.velocity.set(0, 0, 0);
      moving = false;
      if (!this.dashImpactFired && tau >= this.dashImpactAt) {
        this.dashImpactFired = true;
        this.justDashImpact = true;
      }
      if (tau >= 1) this.dashActive = false;
    } else if (this.flipActive || this.spinActive) {
      // Backflip / aerial spin own the body in place: no horizontal motion.
      this.velocity.set(0, 0, 0);
      moving = false;
    } else if (this.rollActive) {
      // Forward roll-out: glide along rollDir, decelerating over the duration.
      const tau = THREE.MathUtils.clamp(this.rollElapsed / this.rollDuration, 0, 1);
      const rollSpeed = this.params.moveSpeed * 1.7 * (1 - tau);
      pos.x = THREE.MathUtils.clamp(pos.x + this.rollDir.x * rollSpeed * dt, -this.bound, this.bound);
      pos.z = THREE.MathUtils.clamp(pos.z + this.rollDir.z * rollSpeed * dt, -this.bound, this.bound);
      this.velocity.set(0, 0, 0);
      moving = false;
    } else if (this.skillFlightActive) {
      // Timed free-flight (skill short hop) — cam-relative 3D like three-player-controller fly.
      this.skillFlightElapsed += dt;
      if (this.skillFlightElapsed >= this.skillFlightDuration) {
        this.skillFlightActive = false;
        this.skillFlightEnd = true;
        this.vertical = -2;
      } else {
        let up = 0;
        if (this.input.down("Space")) up += 1;
        if (this.input.down("ControlLeft") || this.input.down("ControlRight")) {
          up -= 1;
        }
        if (moving) {
          move.normalize();
          this.velocity.copy(move).multiplyScalar(this.skillFlightSpeed);
          this.wantFacing = Math.atan2(move.x, move.z);
        } else {
          this.velocity.x *= 0.88;
          this.velocity.z *= 0.88;
        }
        // Vertical integrated in the specials Y branch below
        this.vertical = up * this.skillFlightSpeed * 0.65;
        pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, -this.bound, this.bound);
        pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, -this.bound, this.bound);
        moving = true;
      }
    } else if (this.hoverActive) {
      // Float: keyboard/stick still steer (slower); the back-hop velocity decays.
      if (moving) {
        move.normalize();
        this.velocity.copy(move).multiplyScalar(speed * intensity * 0.7);
        this.wantFacing = Math.atan2(move.x, move.z);
      } else {
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
      }
      pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, -this.bound, this.bound);
      pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, -this.bound, this.bound);
      moving = false;
    } else {
      // Attempt / maintain wall-run before free air locomotion
      this.updateWallRun(dt, sprinting, move, mag);
      if (this.wallRunActive) {
        this.velocity.set(0, 0, 0);
        moving = true; // keep loco blend "running"
      } else if (moving) {
        move.normalize();
        // Edge / cliff probe: cancel planar velocity that would walk off a drop.
        if (this.isEdgeInDirection(move.x, move.z, pos)) {
          this.edgeBlocked = true;
          this.velocity.set(0, 0, 0);
          moving = false;
        } else {
          this.velocity.copy(move).multiplyScalar(speed * intensity);
          this.wantFacing = Math.atan2(move.x, move.z);
          pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, -this.bound, this.bound);
          pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, -this.bound, this.bound);
        }
      } else {
        this.velocity.multiplyScalar(0.001);
        pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, -this.bound, this.bound);
        pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, -this.bound, this.bound);
      }
    }

    // External knockback rides on top of every branch and decays smoothly.
    if (this.extVel.lengthSq() > 1e-4) {
      pos.x = THREE.MathUtils.clamp(pos.x + this.extVel.x * dt, -this.bound, this.bound);
      pos.z = THREE.MathUtils.clamp(pos.z + this.extVel.z * dt, -this.bound, this.bound);
      const damp = Math.exp(-this.extVelDamp * dt);
      this.extVel.x *= damp;
      this.extVel.z *= damp;
    }

    // Danger Room / arena living obstacles: XZ circle push-out for pillars and
    // NPCs. Runs when there is no KCC, OR when keepRoomBounds (shared DR ground
    // KCC) so bodies still can't walk through dummies. Full mesh dungeons skip
    // this (keepRoomBounds false) — trimeshes own collision.
    if ((!this.collision || this.keepRoomBounds) && this.obstacles) {
      const PLAYER_R = 0.35;
      const obs = this.obstacles();
      // Pass 1: radial push out of every overlapping circle (smooth slide when
      // approaching from open floor).
      for (const o of obs) {
        const dx = pos.x - o.x;
        const dz = pos.z - o.z;
        const minDist = o.r + PLAYER_R;
        const d = Math.hypot(dx, dz);
        if (d >= minDist) continue;
        if (d > 1e-4) {
          pos.x = o.x + (dx / d) * minDist;
          pos.z = o.z + (dz / d) * minDist;
        } else {
          // Standing exactly on the obstacle centre: eject along current facing.
          const f = this.forward();
          pos.x = o.x + f.x * minDist;
          pos.z = o.z + f.z * minDist;
        }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, -this.bound, this.bound);
      pos.z = THREE.MathUtils.clamp(pos.z, -this.bound, this.bound);
      // Pass 2: the wall clamp can shove the body back into a corner pillar (the
      // very corner has no walkable space). Slide along the wall to the nearest
      // in-bounds point that clears the circle, so the body stops cleanly
      // against the pillar instead of jittering.
      for (const o of obs) {
        const dx = pos.x - o.x;
        const dz = pos.z - o.z;
        const minDist = o.r + PLAYER_R;
        if (dx * dx + dz * dz >= minDist * minDist) continue;
        const candidates: { x: number; z: number }[] = [];
        const needX = Math.sqrt(Math.max(0, minDist * minDist - dz * dz));
        for (const sx of [o.x + needX, o.x - needX]) {
          if (sx >= -this.bound && sx <= this.bound) candidates.push({ x: sx, z: pos.z });
        }
        const needZ = Math.sqrt(Math.max(0, minDist * minDist - dx * dx));
        for (const sz of [o.z + needZ, o.z - needZ]) {
          if (sz >= -this.bound && sz <= this.bound) candidates.push({ x: pos.x, z: sz });
        }
        let best: { x: number; z: number } | null = null;
        let bestD = Infinity;
        for (const c of candidates) {
          const dd = (c.x - pos.x) ** 2 + (c.z - pos.z) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = c;
          }
        }
        if (best) {
          pos.x = best.x;
          pos.z = best.z;
        }
      }
    }

    // Vertical. Procedural specials drive their own height (gravity suspended);
    // otherwise the normal gravity + ground clamp runs.
    if (this.flipActive) {
      this.flipElapsed += dt;
      const tau = THREE.MathUtils.clamp(this.flipElapsed / this.flipDuration, 0, 1);
      pos.y = Math.sin(Math.PI * tau) * this.flipHop;
      this.character.root.rotation.x = -Math.PI * 2 * Controller.easeInOut(tau);
      this.vertical = 0;
      if (tau >= 1) {
        this.flipActive = false;
        this.character.root.rotation.x = 0;
        pos.y = 0;
        this.grounded = true;
        this.jumpsLeft = 2;
        this.didDoubleJump = false;
        this.airDoubleUsed = false;
        this.airWallJumpUsed = false;
        this.endWallRun(false);
      }
    } else if (this.rollActive) {
      this.rollElapsed += dt;
      const tau = THREE.MathUtils.clamp(this.rollElapsed / this.rollDuration, 0, 1);
      this.character.root.rotation.x = -Math.PI * 2 * Controller.easeInOut(tau);
      pos.y = 0;
      this.vertical = 0;
      this.grounded = true;
      if (tau >= 1) {
        this.rollActive = false;
        this.character.root.rotation.x = 0;
      }
    } else if (this.spinActive) {
      this.spinElapsed += dt;
      const tau = THREE.MathUtils.clamp(this.spinElapsed / this.spinDuration, 0, 1);
      pos.y = Math.sin(tau * Math.PI * 0.5) * this.spinHeight;
      this.vertical = 0;
      if (tau >= 1) {
        this.spinActive = false;
        this.justSpinEnd = true;
        // Falls from this height under gravity on the next frame.
      }
    } else if (this.hoverActive) {
      this.hoverElapsed += dt;
      pos.y += (this.hoverHeight - pos.y) * Math.min(1, 6 * dt);
      this.vertical = 0;
      if (this.hoverElapsed >= this.hoverDuration) {
        this.hoverActive = false;
        this.hoverEnd = true;
      }
    } else if (this.skillFlightActive) {
      // Free-flight Y (no gravity) — Space up / Ctrl down already in this.vertical
      pos.y = Math.max(0.08, pos.y + this.vertical * dt);
      this.grounded = false;
    } else if (this.wallRunActive) {
      // Gravity suspended while wall-running (climb handled in updateWallRun).
      this.vertical = 0;
      this.grounded = false;
    } else {
      // Gravity + ground.
      const prevVertical = this.vertical;
      this.vertical -= this.params.gravity * dt;
      // Inside the dungeon water band, buoyancy clamps the descent to a slow,
      // constant sink so the player drifts down through the water rather than
      // plummeting. Climbing/upward velocity (jumps) is left untouched.
      this.vertical = sinkClampVertical(pos.y, this.vertical, this.waterBand, this.SINK_SPEED);
      pos.y += this.vertical * dt;
      // Skyfall apex: the single frame vertical velocity flips from rising to falling.
      if (this.skyfallArmed && prevVertical > 0 && this.vertical <= 0) {
        this.skyfallArmed = false;
        this.justApex = true;
        this.character.root.rotation.x = 0;
      }
      // Twist-flip while rising: one forward somersault eased to finish at apex.
      if (this.skyfallArmed) {
        this.skyfallRiseElapsed += dt;
        const tau = THREE.MathUtils.clamp(this.skyfallRiseElapsed / this.skyfallRiseDur, 0, 1);
        this.character.root.rotation.x = -Math.PI * 2 * Controller.easeInOut(tau);
      }
      if (!this.collision && pos.y <= 0) {
        pos.y = 0;
        if (!this.grounded) {
          this.justLanded = true;
          this.landingSpeed = Math.abs(prevVertical);
          if (this.slamActive) {
            this.justSlamLanded = true;
            this.slamActive = false;
          }
          this.landedWithDouble = this.didDoubleJump;
          this.justRollLanding = this.didDoubleJump || this.hoverWasActive;
          this.hoverWasActive = false;
        }
        this.vertical = 0;
        this.grounded = true;
        this.jumpsLeft = 2;
        this.didDoubleJump = false;
        this.airDoubleUsed = false;
        this.airWallJumpUsed = false;
        this.endWallRun(false);
        this.skyfallArmed = false;
        this.character.root.rotation.x = 0;
      }
    }

    // Dungeon collision: reconcile the whole frame's attempted displacement
    // through the KCC, then derive grounding from the result. Only runs when a
    // collision provider is active, so the Danger Room path above is untouched.
    if (this.collision && prevPos) {
      const delta = new THREE.Vector3().subVectors(pos, prevPos);
      const res = this.collision.move(prevPos, delta);
      pos.copy(res.pos);
      if (res.grounded && this.vertical <= 0) {
        if (!this.grounded) {
          this.justLanded = true;
          this.landingSpeed = Math.abs(this.vertical);
          if (this.slamActive) {
            this.justSlamLanded = true;
            this.slamActive = false;
          }
          this.landedWithDouble = this.didDoubleJump;
          this.justRollLanding = this.didDoubleJump || this.hoverWasActive;
          this.hoverWasActive = false;
        }
        this.vertical = 0;
        this.grounded = true;
        this.jumpsLeft = 2;
        this.didDoubleJump = false;
        this.airDoubleUsed = false;
        this.airWallJumpUsed = false;
        this.endWallRun(false);
        this.skyfallArmed = false;
      } else if (!res.grounded) {
        this.grounded = false;
        // A ceiling bonk: kill upward velocity so we don't stick to it.
        if (this.vertical > 0 && delta.y > 0 && res.pos.y - prevPos.y < delta.y - 1e-3) {
          this.vertical = 0;
        }
      }
    }

    // Lock-on overrides facing: keep the body squared to the enemy so A/D reads
    // as a strafe instead of turning to face the movement direction.
    if (lockYaw !== null && !this.spinActive) this.wantFacing = lockYaw;

    // Face movement direction. During a lunge, turn faster so it reads as a
    // committed dash without the old jarring instant facing snap.
    const cur = this.character.root.rotation.y;
    let diff = this.wantFacing - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (this.facingBoost > 0) this.facingBoost = Math.max(0, this.facingBoost - dt);
    const boosted = this.dashActive || this.facingBoost > 0;
    const turn = boosted ? Math.max(this.params.turnResponsiveness, 20) : this.params.turnResponsiveness;
    if (this.spinActive) {
      // Fast continuous Y-spin overrides facing while the aerial spin runs.
      this.character.root.rotation.y += 16 * dt;
    } else if (this.skyfallArmed) {
      // Add a body twist to the rising Skyfall flip (twist-flip going straight up).
      this.character.root.rotation.y += 13 * dt;
    } else {
      this.character.root.rotation.y = cur + diff * Math.min(1, turn * dt);
    }

    // Locomotion blend by smoothed speed (skip while a one-shot owns the body).
    const targetSpeed = moving
      ? sprinting
        ? 1
        : analog
          ? Math.min(0.85, 0.3 + mag * 0.6)
          : 0.5
      : 0;
    this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * Math.min(1, 10 * dt);
    if (
      !this.character.isOneShotActive &&
      this.grounded &&
      !this.isBusy &&
      !this.hoverActive &&
      !(this.animDirector?.isOverridePlaying)
    ) {
      if (this.character.setLocomotion) {
        // Weight-blended path (GLB Character): one continuous speed eases the
        // idle/walk/run weights — no discrete role swap or rate hack needed.
        this.character.setLocomotion(this.smoothedSpeed);
      } else if (this.smoothedSpeed > 0.65 && this.character.hasRole("run")) {
        this.character.playRole("run");
        this.character.setLocomotionRate(1 + (this.smoothedSpeed - 0.65) * 0.6);
      } else if (this.smoothedSpeed > 0.06) {
        this.character.playRole("walk");
        this.character.setLocomotionRate(0.8 + this.smoothedSpeed);
      } else {
        this.character.playRole("idle");
        this.character.setLocomotionRate(1);
      }
    }

    // Ground-state event (three-player-controller onGroundChange parity).
    if (this.grounded !== this.prevGrounded) {
      this.onGroundChange?.(this.grounded);
    }
    this.animDirector?.update(dt);

    this.updateCamera(dt);
  }

  private updateCamera(dt: number) {
    // Decay trauma and strip last frame's additive shake before recomputing the
    // base pose, so the lerped third-person camera never accumulates the offset.
    if (this.shakeTrauma > 0) this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.6);
    this.camera.position.sub(this.shakeOffset);

    if (this.viewMode === "first") {
      this.updateFirstPersonCamera();
      this.applyCameraShake();
      return;
    }
    const feet = this.character.root.position;
    const target = new THREE.Vector3(
      feet.x,
      feet.y + this.params.cameraHeight * this.camLookAtHeightRatio,
      feet.z,
    );
    // Spring look-at (GameCamera critically-damped style from three-player-controller).
    let lookAt = target;
    if (this.enableSpringCamera) {
      if (!this.springInited) {
        this.springLookAt.copy(target);
        this.springVel.set(0, 0, 0);
        this.springInited = true;
      }
      lookAt = this.springToward(this.springLookAt, this.springVel, target, dt, this.springCameraTime);
      this.springLookAt.copy(lookAt);
    } else {
      this.springInited = false;
    }
    const dist = this.params.cameraDistance;
    // Spherical orbit BEHIND the character: the horizontal ring (x/z) sits on
    // -forward via -dist and shrinks with pitch (cos), while the vertical rises
    // with pitch (+sin * dist) so a higher pitch looks DOWN from above. The old
    // code multiplied the whole vector (incl. +sin(pitch)) by -dist, which sank
    // the camera underground and made it look up from beneath the floor.
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * -dist,
      Math.sin(this.pitch) * dist,
      Math.cos(this.yaw) * Math.cos(this.pitch) * -dist,
    );
    const desired = lookAt.clone().add(offset);
    if (!this.collision) {
      // Danger Room: hard floor clamp + keep the camera inside the room walls so
      // a wall can never end up between the camera and the character.
      desired.y = Math.max(desired.y, 0.5);
      const camBound = this.bound + 0.5;
      desired.x = THREE.MathUtils.clamp(desired.x, -camBound, camBound);
      desired.z = THREE.MathUtils.clamp(desired.z, -camBound, camBound);
    } else if (this.occluders.length) {
      // Dungeon: pull the camera in front of any wall/prop between it and the
      // player so the view never clips into geometry indoors.
      const dir = new THREE.Vector3().subVectors(desired, lookAt);
      const len = dir.length();
      if (len > 1e-3) {
        dir.divideScalar(len);
        this.camRay.set(lookAt, dir);
        this.camRay.far = len;
        const hits = this.camRay.intersectObjects(this.occluders, false);
        if (hits.length > 0) {
          const d = Math.max(0.5, hits[0].distance - 0.3);
          desired.copy(lookAt).addScaledVector(dir, d);
        }
      }
    }
    this.camera.position.lerp(desired, Math.min(1, 12 * dt));
    this.camera.lookAt(lookAt);
    this.applyFov();
    this.applyCameraShake();
  }

  /**
   * Critically-damped spring (Game Camera / SmoothDamp style) toward `dest`.
   * Ported from three-player-controller CameraSystem.springTarget.
   */
  private springToward(
    cur: THREE.Vector3,
    vel: THREE.Vector3,
    dest: THREE.Vector3,
    delta: number,
    smoothTime: number,
  ): THREE.Vector3 {
    const out = new THREE.Vector3();
    const st = Math.max(0.0001, smoothTime);
    const omega = 2 / st;
    const x = omega * delta;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    for (const a of ["x", "y", "z"] as const) {
      const change = cur[a] - dest[a];
      const temp = (vel[a] + omega * change) * delta;
      vel[a] = (vel[a] - omega * temp) * exp;
      let o = dest[a] + (change + temp) * exp;
      if (dest[a] - cur[a] > 0 === o > dest[a]) {
        o = dest[a];
        vel[a] = 0;
      }
      out[a] = o;
    }
    return out;
  }

  /**
   * Compute this frame's camera-shake offset from the current trauma and add it
   * to the (already-positioned) camera. Multi-frequency per-axis noise reads as a
   * non-repetitive rattle; the offset is recorded so {@link updateCamera} can undo
   * it next frame before recomputing the base pose.
   */
  private applyCameraShake() {
    const s = this.shakeTrauma * this.shakeTrauma;
    if (s <= 0) {
      this.shakeOffset.set(0, 0, 0);
      return;
    }
    const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
    this.shakeOffset.set(
      Math.sin(t * 47 + this.shakeSeed) * 0.22 * s,
      Math.sin(t * 61 + this.shakeSeed * 1.7) * 0.16 * s,
      Math.sin(t * 53 + this.shakeSeed * 2.3) * 0.22 * s,
    );
    this.camera.position.add(this.shakeOffset);
  }

  /**
   * Eye-anchored first-person camera: sit the camera at the body's eye height and
   * look along yaw + first-person pitch (plus any recoil offset). The avatar mesh
   * is hidden in this mode so the body never occludes the view. The screen-centre
   * aim ray (aimRay) is camera-forward, so the crosshair maps exactly to the hit
   * point — the DGS camera-forward raycast model.
   */
  private updateFirstPersonCamera() {
    const eye = this.character.root.position;
    const yaw = this.yaw + this.aimYaw;
    const pitch = THREE.MathUtils.clamp(this.fpPitch + this.aimPitch, -1.5, 1.5);
    const cp = Math.cos(pitch);
    const dirX = Math.sin(yaw) * cp;
    const dirY = Math.sin(pitch);
    const dirZ = Math.cos(yaw) * cp;
    const ex = eye.x;
    const ey = eye.y + this.params.cameraHeight;
    const ez = eye.z;
    this.camera.position.set(ex, ey, ez);
    this.camera.lookAt(ex + dirX, ey + dirY, ez + dirZ);
    this.applyFov();
  }

  /** Apply the base FOV plus the consumer-owned sprint kick, if it changed. */
  private applyFov() {
    const fov = this.params.fov + this.fovKickAmt;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
