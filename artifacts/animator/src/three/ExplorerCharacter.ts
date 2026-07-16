import * as THREE from "three";
import type { AnimRole, AvatarMarkers, Avatar, CharacterDef } from "./types";
import { CHARACTER_HEIGHT_M } from "./types";
import { getWeapon } from "./assets";
import { holdStyle } from "./arsenal/holdStyle";
import { createAnimatedCharacter } from "./explorer/loader";
import type { Animator } from "./explorer/Animator";
import type { VoxelPart } from "./explorer/rig";
import type { ShellId } from "./LedMaskShells";
import type { WeaponClass, ActionKey } from "./explorer/types";
import { isGlobalAction, resolveActionAnywhere, WEAPON_SETS } from "./explorer/clipCatalog";
import type { ExplorerPose } from "./ale/replay";

/** Synthetic "clip" verbs the procedural Explorer exposes to the slot editor. */
export const VERBS = [
  "attack",
  "attack2",
  "attack3",
  "stab",
  "jumpAttack",
  "meleeCombo1",
  "meleeCombo2",
  "skill",
  "cast",
  "magicAttack",
  "magicArea",
  "slide",
  "throw",
  "dash",
  "dashAttack",
  "roll",
  "jump",
  "death",
  "hit",
  // Pistol "kiter" kit verbs (resolve to the pistol class one-shots).
  "pistolWhip",
  "uppercut",
  "chargedShot",
  "mmaKick",
  "kipUp",
  // Acrobatic UX movement blends (resolve to universal movement clips).
  "airDodge",
  "utilityKick",
  "frontFlip",
  "twistFlip",
  "butterflyTwirl",
  "spinEvade",
  "corkscrewEvade",
  "evadeThreat",
  // Extra footwork / acrobatics + dirty melee (user clip batch).
  "stylishFlip",
  "backJump",
  "runningFlip",
  "longBackJump",
  "pivotR",
  "sideStepL",
  "jumpDown",
  "headbutt",
  "hurricaneKick",
  // Ground finisher (execution on a knocked-down enemy).
  "stomp",
  // Extra casting / greatsword bodies (vfx-sandbox library).
  "castSpell2",
  "magicChannel",
  "overheadSlash",
  // Horizontal slash pair + guard (class-independent).
  "insideSlash",
  "outsideSlash",
  "block",
  "blockGuard",
  "blockLeft",
  "blockRight",
  "blockReact",
  "blockReactWide",
  "blockReactHeavy",
  "parry",
  // Personality gesture idles (vfx-sandbox emotes).
  "gestureAcknowledge",
  "gestureCocky",
  "gestureDismiss",
  "gestureHappy",
  "gestureLookAway",
  "gestureRelievedSigh",
  "gestureHeadShake",
  "gestureWeightShift",
] as const;

/**
 * Maps each preview {@link VERBS verb} to the {@link ActionKey} that names its
 * clip, so the Dressing Room library can play the SAME-NAMED animation for every
 * verb regardless of the equipped weapon (resolved equipped-class-first, then
 * across all classes / globals via `resolveActionAnywhere`). Keep in lockstep
 * with {@link VERBS}; verbs absent here fall back to the gameplay one-shot path.
 */
export const PREVIEW_VERB_KEYS: Record<string, ActionKey> = {
  attack: "attack1",
  attack2: "attack2",
  attack3: "attack3",
  stab: "stab",
  jumpAttack: "jumpAttack",
  meleeCombo1: "meleeComboA",
  meleeCombo2: "meleeComboB",
  skill: "skill",
  cast: "castSpell",
  magicAttack: "magicAttack",
  magicArea: "magicArea",
  slide: "slide",
  throw: "throw",
  dash: "dash",
  dashAttack: "dashAttack",
  roll: "dodgeF",
  jump: "jumpAir",
  death: "death",
  hit: "hit",
  pistolWhip: "pistolWhip",
  uppercut: "uppercut",
  chargedShot: "chargedShot",
  mmaKick: "mmaKick",
  kipUp: "kipUp",
  airDodge: "airDodge",
  utilityKick: "utilityKick",
  frontFlip: "frontFlip",
  twistFlip: "twistFlip",
  butterflyTwirl: "butterflyTwirl",
  spinEvade: "spinEvade",
  corkscrewEvade: "corkscrewEvade",
  evadeThreat: "evadeThreat",
  stylishFlip: "stylishFlip",
  backJump: "backJump",
  runningFlip: "runningFlip",
  longBackJump: "longBackJump",
  pivotR: "pivotR",
  sideStepL: "sideStepL",
  jumpDown: "jumpDown",
  headbutt: "headbutt",
  hurricaneKick: "hurricaneKick",
  stomp: "stomp",
  castSpell2: "castSpell2",
  magicChannel: "magicChannel",
  overheadSlash: "overheadSlash",
  insideSlash: "insideSlash",
  outsideSlash: "outsideSlash",
  block: "blockStart",
  blockGuard: "blockGuard",
  blockLeft: "blockLeft",
  blockRight: "blockRight",
  blockReact: "blockReact",
  blockReactWide: "blockReactWide",
  blockReactHeavy: "blockReactHeavy",
  parry: "parryReact",
  gestureAcknowledge: "gestureAcknowledge",
  gestureCocky: "gestureCocky",
  gestureDismiss: "gestureDismiss",
  gestureHappy: "gestureHappy",
  gestureLookAway: "gestureLookAway",
  gestureRelievedSigh: "gestureRelievedSigh",
  gestureHeadShake: "gestureHeadShake",
  gestureWeightShift: "gestureWeightShift",
};

/**
 * Use-case grouping for the verb library, surfaced by the Animations panel so the
 * clip list reads by category (melee / skills / movement / acrobatics / ...) rather
 * than as one flat list. Order defines display order; any verb not listed here
 * falls into a trailing "Other" group, so {@link VERBS} can grow without silently
 * dropping clips from the UI.
 */
export const CLIP_CATEGORIES: ReadonlyArray<{ label: string; verbs: readonly string[] }> = [
  { label: "Melee", verbs: ["attack", "attack2", "attack3", "stab", "insideSlash", "outsideSlash", "jumpAttack", "meleeCombo1", "meleeCombo2", "dashAttack", "hurricaneKick", "headbutt"] },
  { label: "Skills & Magic", verbs: ["skill", "cast", "magicAttack", "magicArea", "castSpell2", "magicChannel"] },
  { label: "Greatsword", verbs: ["overheadSlash"] },
  { label: "Defense", verbs: ["block", "blockGuard", "blockLeft", "blockRight", "blockReact", "blockReactWide", "blockReactHeavy", "parry"] },
  { label: "Movement", verbs: ["dash", "roll", "jump", "slide", "pivotR", "sideStepL", "jumpDown"] },
  { label: "Acrobatics", verbs: ["airDodge", "utilityKick", "frontFlip", "twistFlip", "butterflyTwirl", "spinEvade", "corkscrewEvade", "evadeThreat", "stylishFlip", "backJump", "runningFlip", "longBackJump", "kipUp"] },
  { label: "Finishers", verbs: ["stomp"] },
  { label: "Gunslinger", verbs: ["pistolWhip", "uppercut", "chargedShot", "mmaKick"] },
  { label: "Gestures", verbs: ["gestureAcknowledge", "gestureCocky", "gestureDismiss", "gestureHappy", "gestureLookAway", "gestureRelievedSigh", "gestureHeadShake", "gestureWeightShift"] },
  { label: "Utility", verbs: ["throw", "death", "hit"] },
];

/**
 * Group an arbitrary clip-name list into the {@link CLIP_CATEGORIES} use-case
 * sections (preserving category order), appending any unrecognised clips to a
 * trailing "Other" group. Empty groups are omitted.
 */
export function categorizeClips(clips: string[]): { label: string; clips: string[] }[] {
  const remaining = new Set(clips);
  const groups: { label: string; clips: string[] }[] = [];
  for (const cat of CLIP_CATEGORIES) {
    const present = cat.verbs.filter((v) => remaining.has(v));
    for (const v of present) remaining.delete(v);
    if (present.length) groups.push({ label: cat.label, clips: present });
  }
  if (remaining.size) groups.push({ label: "Other", clips: [...remaining] });
  return groups;
}

/** verb → its built-in {@link CLIP_CATEGORIES} section label (the default grouping in the library). */
export const VERB_CATEGORY: Record<string, string> = Object.fromEntries(
  CLIP_CATEGORIES.flatMap((c) => c.verbs.map((v) => [v, c.label] as const)),
);

/**
 * Display-name overrides for verbs the generic humaniser can't title-case nicely
 * (acronyms, hyphenated terms, and the redundant "gesture" prefix on emotes).
 */
const VERB_LABEL_OVERRIDES: Record<string, string> = {
  mmaKick: "MMA Kick",
  kipUp: "Kip-Up",
  pivotR: "Pivot Right",
  sideStepL: "Side-Step Left",
  gestureAcknowledge: "Acknowledge",
  gestureCocky: "Cocky",
  gestureDismiss: "Dismiss",
  gestureHappy: "Happy",
  gestureLookAway: "Look Away",
  gestureRelievedSigh: "Relieved Sigh",
  gestureHeadShake: "Head Shake",
  gestureWeightShift: "Weight Shift",
};

/**
 * Turn a clip id or verb into a human label: drop any path prefix, split
 * camelCase and letter/digit boundaries, swap dashes/underscores for spaces, and
 * Title-Case it (`"animations/sword/outward-slash"` → "Outward Slash",
 * `"jumpAttack"` → "Jump Attack", `"meleeCombo1"` → "Melee Combo 1").
 */
export function humanizeClipId(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable label for a preview {@link VERBS verb} (override first, else humanised). */
export function verbLabel(verb: string): string {
  return VERB_LABEL_OVERRIDES[verb] ?? humanizeClipId(verb);
}

/**
 * Adapter that drives the ported procedural {@link Animator} (box rig + Mixamo
 * FBX clips) behind the same surface the {@link import("./Character").Character}
 * GLB class exposes, so {@link import("./Studio").Studio} and
 * {@link import("./Controller").Controller} can treat it polymorphically (see
 * the {@link Avatar} interface).
 *
 * The GLB path is role/clip-name based; this rig is INTENT based. The shims here
 * translate the engine's role/clip calls into Animator intents: locomotion ids
 * become a 0..1 blend speed fed to {@link Animator.setLocomotion}, and one-shot
 * roles/verbs map onto the Animator's imperative one-shots.
 */
export class ExplorerCharacter implements Avatar {
  readonly root = new THREE.Group();
  rightHand: THREE.Object3D | null = null; // procedural weapons live on the rig
  leftHand: THREE.Object3D | null = null;

  def: CharacterDef;
  private animator: Animator | null = null;
  /** Inner avatar group; carries the model-yaw offset (root carries facing). */
  private inner: THREE.Group | null = null;
  private skeletonHelper: THREE.SkeletonHelper | null = null;

  /** 0..1 locomotion intensity requested by the controller's playRole calls. */
  private locoSpeed = 0;
  /** True while a jump's held airborne pose is active (cleared on landing). */
  private airborne = false;
  private modelYaw = 0;
  private showSkeleton = false;
  private weaponClass: WeaponClass = "sword";
  private lastClip = "idle";
  private disposed = false;

  /** Cached ordered skeleton bones for instant-replay pose capture/restore. */
  private poseBones: THREE.Bone[] | null = null;
  /** Scratch quaternions reused by {@link applyPoseLerp}. */
  private readonly _qa = new THREE.Quaternion();
  private readonly _qb = new THREE.Quaternion();

  constructor(def: CharacterDef) {
    this.def = def;
    this.modelYaw = def.modelYaw ?? 0;
  }

  async load(): Promise<void> {
    // Explorer uses Avatar Edit modular head (play-shell parity) unless look overrides.
    const look =
      this.def.id === "explorer"
        ? { ...this.def.look, avatarHead: true }
        : this.def.look;
    const animator = await createAnimatedCharacter({
      height: CHARACTER_HEIGHT_M,
      weapon: this.weaponClass,
      look,
    });
    if (this.disposed) {
      animator.dispose();
      return;
    }
    this.animator = animator;
    this.inner = animator.root;
    this.inner.rotation.y = this.modelYaw;
    this.inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
    this.root.add(this.inner);
    // Expose the rig's hand mounts so the host (Studio) can mount real GLB
    // weapon models, and clear the Animator's own procedural prop mesh so the
    // two don't double up.
    this.rightHand = animator.character.mounts.rightHand;
    this.leftHand = animator.character.mounts.leftHand;
    animator.setWeapon(this.weaponClass, false);
    if (this.showSkeleton) this.setShowSkeleton(true);
  }

  /** Swap the equipped weapon class's CLIP SET only (the host mounts the model). */
  setWeaponId(weaponId: string): void {
    this.weaponClass = (getWeapon(weaponId).animSet as WeaponClass) ?? "unarmed";
    this.animator?.setWeapon(this.weaponClass, false);
  }

  /**
   * Swap the weapon class AND show the Animator's own procedural prop mesh. Used
   * for AI-driven non-player fighters (e.g. duel opponents) that have no host
   * mounting a real GLB weapon, so they still visibly hold their weapon.
   */
  equipProceduralWeapon(weaponId: string): void {
    this.weaponClass = (getWeapon(weaponId).animSet as WeaponClass) ?? "unarmed";
    this.animator?.setWeapon(this.weaponClass, true);
  }

  /** Raise (or drop) a held guard — drives the Animator's block state directly. */
  setBlock(active: boolean): void {
    this.animator?.block(active);
  }

  /**
   * Play the equipped weapon's category ready / guard pose (and any draw
   * flourish) on stance entry, blending back to idle. GLB rigs omit this.
   */
  readyPose(weaponId: string): number {
    if (!this.animator) return 0;
    const { guard } = holdStyle(getWeapon(weaponId).group);
    return this.animator.enterStance(guard.pose, guard.draw);
  }

  /**
   * Play a directional evade roll (dodge), returning its duration in seconds.
   * `fade` controls blend-in from the prior pose (jump/locomotion → roll).
   */
  rollDir(dir: "F" | "B" | "L" | "R", fade = 0.16): number {
    if (!this.animator) return 0;
    this.lastClip = "roll";
    return this.animator.roll(dir, fade);
  }

  /**
   * Play a defensive reaction clip by key (stumble / stunned / fallDown / fallen
   * / getUp / kipUp / wallCrash) with caller-controlled blend. Distinct from the
   * generic `hurt` flinch so knock-downs, knock-ups and acrobatic recoveries each
   * show their real clip. `hold` keeps the grounded pose until a recovery plays.
   */
  reaction(key: string, fade?: number, hold?: boolean): number {
    if (!this.animator) return 0;
    this.lastClip = key;
    return this.animator.reaction(key as ActionKey, fade, hold);
  }

  /** Swap the locomotion clip set between ground and swim (dungeon water band). */
  setTraversalMode(mode: "ground" | "swim"): void {
    this.animator?.setMode(mode);
  }

  // ---- locomotion (role/rate shims -> blend speed intent) ----

  playRole(role: AnimRole): void {
    if (role === "run") this.locoSpeed = 1;
    else if (role === "walk") this.locoSpeed = 0.5;
    else if (role === "idle") this.locoSpeed = 0;
  }

  setLocomotionRate(_rate: number): void {
    // The weight-blended locomotion layer owns stride cadence; nothing to do.
  }

  // ---- one-shots ----

  playRoleOnce(role: AnimRole): number {
    if (!this.animator) return 0;
    this.lastClip = role;
    switch (role) {
      case "attack":
        return this.animator.attack();
      case "jump":
        this.airborne = true;
        this.animator.jump();
        return 0.6;
      case "death":
        return this.animator.die();
      case "hurt":
        return this.animator.hit();
      case "block":
        this.animator.block(true);
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Cut-animation approximation for the procedural rig: plays the full verb,
   * returns a shortened wall-clock duration so impact scheduling matches the
   * GLB `playClipCut` contract (slice × timeScale). True track slicing lives
   * on {@link Character}.
   */
  playClipCut(
    name: string,
    opts: { from?: number; to?: number; timeScale?: number; fade?: number } = {},
  ): number {
    const from = Math.min(1, Math.max(0, opts.from ?? 0));
    const to = Math.min(1, Math.max(from + 0.05, opts.to ?? 1));
    const scale = Math.max(0.05, opts.timeScale ?? 1);
    const full = this.playClipOnce(name);
    if (full <= 0) return 0;
    return Math.max(0.08, (full * (to - from)) / scale);
  }

  playClipOnce(name: string): number {
    if (!this.animator) return 0;
    this.lastClip = name;
    const a = this.animator;
    switch (name) {
      case "attack":
      case "attack2":
      case "attack3":
        return a.attack();
      case "stab":
        return a.playAction("stab");
      case "jumpAttack":
        return a.playAction("jumpAttack");
      case "meleeCombo1":
        return a.playAction("meleeComboA");
      case "meleeCombo2":
        return a.playAction("meleeComboB");
      case "skill":
        return a.skill();
      case "cast":
        return a.magic("castSpell");
      case "magicAttack":
        return a.magic("magicAttack");
      case "magicArea":
        return a.magic("magicArea");
      case "slide":
        return a.slide();
      case "throw":
        return a.throwItem();
      case "dash":
        return a.dash();
      case "dashAttack":
        return a.dashAttack();
      case "roll":
        return a.roll("F");
      // Directional dodges (e.g. the ranged AI's proactive backward hop, hold-style
      // `dodge: "dodgeB"`): route to the resolved per-class dodge clip via roll()
      // rather than falling through to the generic attack in the default branch.
      case "dodgeF":
        return a.roll("F");
      case "dodgeB":
        return a.roll("B");
      case "dodgeL":
        return a.roll("L");
      case "dodgeR":
        return a.roll("R");
      case "death":
        return a.die();
      case "hit":
        return a.hit();
      case "pistolWhip":
        return a.playAction("pistolWhip");
      case "uppercut":
        return a.playAction("uppercut");
      case "chargedShot":
        return a.playAction("chargedShot");
      case "mmaKick":
        return a.playAction("mmaKick");
      case "kipUp":
        return a.playAction("kipUp");
      case "airDodge":
        this.airborne = true;
        return a.movement("airDodge");
      case "utilityKick":
        return a.movement("utilityKick");
      case "frontFlip":
        return a.movement("frontFlip");
      case "twistFlip":
        return a.movement("twistFlip");
      case "butterflyTwirl":
        return a.movement("butterflyTwirl");
      case "spinEvade":
        return a.movement("spinEvade");
      case "corkscrewEvade":
        return a.movement("corkscrewEvade");
      case "hurricaneKick":
        return a.playAction("hurricaneKick");
      default:
        // Generic passthrough for class-independent catalog verbs (extra casting
        // bodies, greatsword variants, personality gestures): resolve via the
        // Animator's global-action lookup. Falls back to a basic attack so an
        // unknown verb still produces motion rather than freezing.
        if (isGlobalAction(name)) return a.playAction(name as ActionKey);
        return a.attack();
    }
  }

  previewClip(name: string): number {
    const a = this.animator;
    if (!a) return 0;
    // Dressing Room library preview: ALWAYS play the clip of the SAME NAME,
    // independent of the equipped weapon. Most verbs map to a concrete catalog
    // clip id (PREVIEW_VERB_KEYS); resolve the equipped class first, then fall
    // back to ANY class / global that ships the clip so out-of-class verbs
    // (jumpAttack, pistolWhip, hurricaneKick, hit, jump, …) still play their own
    // animation instead of no-opping or firing a generic attack. The rig loads
    // every referenced clip, so playById finds them all.
    const key = PREVIEW_VERB_KEYS[name];
    if (key) {
      const id = WEAPON_SETS[this.weaponClass].actions[key] ?? resolveActionAnywhere(key);
      if (id) {
        const dur = a.playById(id);
        if (dur) {
          this.lastClip = name;
          return dur;
        }
      }
    }
    // Verbs without a static clip id (or an unexpectedly missing clip) fall back
    // to the gameplay one-shot path so they still animate.
    return this.playClipOnce(name);
  }

  /**
   * Play an arbitrary, already-retargeted external clip on this rig (e.g. a
   * Mixamo animation auto-wired from an editor import). Looped by default so
   * locomotion clips read clearly during preview; the engine still owns world
   * translation (the clip's horizontal root is locked by the Animator).
   * Returns the clip duration, or 0 if the rig hasn't loaded.
   */
  playExternalClip(clip: THREE.AnimationClip, loop = true): number {
    if (!this.animator) return 0;
    if (loop) {
      this.animator.playClipLooped(clip);
      return clip.duration;
    }
    return this.animator.playClip(clip);
  }

  /** Stop a previewed external clip and return the rig to locomotion/idle. */
  stopExternalClip(): void {
    this.animator?.clearOneShot();
  }

  // ---- introspection ----

  hasRole(role: AnimRole): boolean {
    return ["idle", "walk", "run", "attack", "jump", "death", "hurt", "block"].includes(role);
  }

  hasClip(name: string): boolean {
    return (VERBS as readonly string[]).includes(name);
  }

  clipNames(): string[] {
    return [...VERBS];
  }

  currentClipName(): string {
    return this.lastClip;
  }

  get isOneShotActive(): boolean {
    return this.animator?.isBusy() ?? false;
  }

  /**
   * World-space tracking points (head / hands / feet / weapon tip) for the
   * A.L.E. Bot diagnostics lens. Returns null until the rig has loaded. Bones
   * use sanitised Mixamo names; missing bones fall back to a sensible offset of
   * the root so a marker never disappears.
   */
  getMarkers(): AvatarMarkers | null {
    if (!this.animator) return null;
    const ch = this.animator.character;
    const root = this.root.position;
    const world = (o: THREE.Object3D | null | undefined, fb: THREE.Vector3): THREE.Vector3 =>
      o ? o.getWorldPosition(new THREE.Vector3()) : fb;
    const bone = (n: string): THREE.Bone | undefined => ch.getBone(n);
    const head = world(bone("mixamorigHead"), new THREE.Vector3(root.x, root.y + 1.6, root.z));
    const rightHand = world(this.rightHand ?? bone("mixamorigRightHand"), head.clone());
    const leftHand = world(this.leftHand ?? bone("mixamorigLeftHand"), head.clone());
    const leftFoot = world(bone("mixamorigLeftFoot"), new THREE.Vector3(root.x, root.y, root.z));
    const rightFoot = world(bone("mixamorigRightFoot"), new THREE.Vector3(root.x, root.y, root.z));
    // Approx weapon tip: the weapon group rides the right hand with +Y toward the
    // tip; project a short reach along the hand's world up-axis.
    const weapon = rightHand.clone();
    if (this.rightHand) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
        this.rightHand.getWorldQuaternion(new THREE.Quaternion()),
      );
      weapon.addScaledVector(up, 0.9);
    }
    return { head, leftHand, rightHand, leftFoot, rightFoot, weapon };
  }

  // ---- config shims ----

  setModelYaw(rad: number): void {
    this.modelYaw = rad;
    if (this.inner) this.inner.rotation.y = rad;
  }

  setBlendTime(_t: number): void {
    // The Animator manages its own crossfade durations.
  }

  setShowSkeleton(show: boolean): void {
    this.showSkeleton = show;
    if (!this.animator) return;
    if (show && !this.skeletonHelper) {
      this.skeletonHelper = new THREE.SkeletonHelper(this.animator.character.skeletonRoot);
      this.root.add(this.skeletonHelper);
    } else if (!show && this.skeletonHelper) {
      this.root.remove(this.skeletonHelper);
      this.skeletonHelper.dispose?.();
      this.skeletonHelper = null;
    }
  }

  // ---- voxel-rig appearance (procedural box rig only) ----

  /** Recolour one body part of the procedural box rig (skin/shirt/pants/boot/hat/eye). */
  setPartColor(part: VoxelPart, color: THREE.ColorRepresentation): void {
    this.animator?.character.setPartColor(part, color);
  }

  /** Apply or clear a tiling pattern texture on one body part of the box rig. */
  setPartPattern(part: VoxelPart, texture: THREE.Texture | null): void {
    this.animator?.character.setPartPattern(part, texture);
  }

  /**
   * Swap the box rig's baked LED-mask head: `null` removes it (skin face), any
   * {@link ShellId} (re)builds the mask wearing that housing shell. Static bake.
   */
  setLedMask(shellId: ShellId | null): void {
    this.animator?.character.setLedMask(shellId);
  }

  // ---- per-frame ----

  update(dt: number): void {
    if (!this.animator) return;
    // The controller drives root.position.y; observe the landing here to clear
    // the held airborne pose and play the recovery one-shot.
    if (this.airborne && this.root.position.y <= 0.02) {
      this.animator.land();
      this.airborne = false;
    }
    this.animator.setLocomotion({
      x: 0,
      z: this.locoSpeed > 0.06 ? 1 : 0,
      speed: this.locoSpeed,
      running: this.locoSpeed > 0.65,
    });
    this.animator.update(dt);
  }

  // ---- instant-replay pose capture / restore ----

  /**
   * Ordered (and cached) list of every skeleton bone, traversed once from the
   * rig's `skeletonRoot`. The order is stable for the rig's lifetime, so it can
   * key the flat per-bone arrays in {@link capturePose} / {@link applyPose}.
   */
  private orderedBones(): THREE.Bone[] {
    if (this.poseBones) return this.poseBones;
    const bones: THREE.Bone[] = [];
    const sk = this.animator?.character.skeletonRoot;
    if (sk) sk.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
    });
    this.poseBones = bones;
    return bones;
  }

  /**
   * Snapshot the rig's full pose: root world transform + every bone's local
   * TRS (rotation + position; scale never animates). Reuses `out.bones` when it
   * already fits so steady-state recording avoids allocations. Returns null
   * before the rig has loaded.
   */
  capturePose(out?: ExplorerPose): ExplorerPose | null {
    if (!this.animator) return null;
    const bones = this.orderedBones();
    const n = bones.length * 7;
    const arr = out && out.bones.length === n ? out.bones : new Float32Array(n);
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const o = i * 7;
      arr[o] = b.position.x;
      arr[o + 1] = b.position.y;
      arr[o + 2] = b.position.z;
      arr[o + 3] = b.quaternion.x;
      arr[o + 4] = b.quaternion.y;
      arr[o + 5] = b.quaternion.z;
      arr[o + 6] = b.quaternion.w;
    }
    const r = this.root;
    const pose: ExplorerPose = out ?? {
      px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1, bones: arr,
    };
    pose.bones = arr;
    pose.px = r.position.x;
    pose.py = r.position.y;
    pose.pz = r.position.z;
    pose.qx = r.quaternion.x;
    pose.qy = r.quaternion.y;
    pose.qz = r.quaternion.z;
    pose.qw = r.quaternion.w;
    return pose;
  }

  /** Re-pose the rig to an exact captured pose (read-only replay; no mixer). */
  applyPose(p: ExplorerPose): void {
    if (!this.animator) return;
    const bones = this.orderedBones();
    if (p.bones.length !== bones.length * 7) return;
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const o = i * 7;
      b.position.set(p.bones[o], p.bones[o + 1], p.bones[o + 2]);
      b.quaternion.set(p.bones[o + 3], p.bones[o + 4], p.bones[o + 5], p.bones[o + 6]);
    }
    this.root.position.set(p.px, p.py, p.pz);
    this.root.quaternion.set(p.qx, p.qy, p.qz, p.qw);
  }

  /** Re-pose by interpolating between two captured poses (smooth slow-mo). */
  applyPoseLerp(a: ExplorerPose, b: ExplorerPose, alpha: number): void {
    if (!this.animator) return;
    const bones = this.orderedBones();
    const n = bones.length * 7;
    if (a.bones.length !== n || b.bones.length !== n) return;
    const t = THREE.MathUtils.clamp(alpha, 0, 1);
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      const o = i * 7;
      bone.position.set(
        a.bones[o] + (b.bones[o] - a.bones[o]) * t,
        a.bones[o + 1] + (b.bones[o + 1] - a.bones[o + 1]) * t,
        a.bones[o + 2] + (b.bones[o + 2] - a.bones[o + 2]) * t,
      );
      this._qa.set(a.bones[o + 3], a.bones[o + 4], a.bones[o + 5], a.bones[o + 6]);
      this._qb.set(b.bones[o + 3], b.bones[o + 4], b.bones[o + 5], b.bones[o + 6]);
      bone.quaternion.slerpQuaternions(this._qa, this._qb, t);
    }
    this.root.position.set(
      a.px + (b.px - a.px) * t,
      a.py + (b.py - a.py) * t,
      a.pz + (b.pz - a.pz) * t,
    );
    this._qa.set(a.qx, a.qy, a.qz, a.qw);
    this._qb.set(b.qx, b.qy, b.qz, b.qw);
    this.root.quaternion.slerpQuaternions(this._qa, this._qb, t);
  }

  dispose(): void {
    this.disposed = true;
    if (this.skeletonHelper) {
      this.skeletonHelper.dispose?.();
      this.skeletonHelper = null;
    }
    this.animator?.dispose();
    this.animator = null;
    this.inner = null;
    this.root.clear();
  }
}
