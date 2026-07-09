import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { asset } from "../assets";

/**
 * Self-hosted, normalized loader + per-instance wrapper for the Exo-Armour mech
 * GLB. The source is a single rigged mech (one 29-joint skeleton, 27 skinned
 * meshes) carrying EXACTLY ONE embedded clip ("Exo-Armor") and a non-humanoid
 * skeleton, so it cannot reuse the shared Mixamo character clip library — the
 * open/close + locomotion are driven procedurally and the embedded clip plays as
 * the mech's signature motion/idle.
 *
 * The template is loaded + prepared ONCE and cached; every {@link ExoArmor}
 * instance clones it with {@link cloneSkinned} (SkeletonUtils) so each clone gets
 * its own rebound skeleton (a plain `.clone()` would break skinning). Clones
 * SHARE the template's geometry + materials, so an instance must NEVER dispose
 * those — only the cached template owns those GPU resources for the app's life.
 */
const MECH_FILE = "models/exo-armor.glb";

/** Mech target height in metres — larger/heavier than a ~2m fighter. */
export const MECH_HEIGHT_M = 3.2;

interface ExoArmorTemplate {
  scene: THREE.Group;
  /** The single embedded clip, or null if the GLB shipped none. */
  clip: THREE.AnimationClip | null;
}

const loader = new GLTFLoader();
let templatePromise: Promise<ExoArmorTemplate | null> | null = null;

/** Load + normalize the mech template once; cached for the app's lifetime. */
export function loadExoArmorTemplate(): Promise<ExoArmorTemplate | null> {
  if (!templatePromise) {
    templatePromise = buildTemplate().catch((err) => {
      console.error("[exoArmor] failed to load mech template", err);
      templatePromise = null; // allow a later retry
      return null;
    });
  }
  return templatePromise;
}

async function buildTemplate(): Promise<ExoArmorTemplate> {
  const gltf = await loader.loadAsync(asset(MECH_FILE));
  const model = gltf.scene;

  // Fit to the target world height.
  model.updateWorldMatrix(true, true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(MECH_HEIGHT_M / (size.y || 1));

  // Recentre on X/Z and drop the base to Y=0 (after scaling).
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const wrap = new THREE.Group();
  wrap.add(model);
  return { scene: wrap, clip: gltf.animations[0] ?? null };
}

/**
 * One spawned mech instance. Owns a SkeletonUtils clone of the shared template
 * plus its own {@link THREE.AnimationMixer} driving the embedded clip. The
 * visible assembly amount (0 = absent/open, 1 = fully closed) is applied as a
 * scale on an inner group so the open/close transition reads procedurally
 * without touching shared materials.
 */
export class ExoArmor {
  /** Outer group — the owner positions/orients THIS each frame. */
  readonly root = new THREE.Group();
  /** Inner group whose scale we drive for the assemble/close effect. */
  private readonly inner = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;

  // ── Procedural "heavy walk" state ──────────────────────────────────────────
  /** Stride phase (radians); a foot plants every π. Advanced only while moving. */
  private stridePhase = 0;
  /** Smoothed normalized move speed (0..1) driving bob/lean amplitude. */
  private smoothedSpeed = 0;
  /** Smoothed roll lean into turns (radians). */
  private leanRoll = 0;
  /** Previous facing yaw, for the lean-into-turn yaw-rate. */
  private prevYaw = 0;
  private yawInit = false;

  constructor() {
    this.root.add(this.inner);
    this.root.visible = false;
  }

  /** Clone the shared template + bind the embedded clip. Idempotent. */
  async load(): Promise<boolean> {
    if (this.model) return true;
    const tpl = await loadExoArmorTemplate();
    if (!tpl) return false;
    // SkeletonUtils clone so the skinned meshes rebind to a fresh skeleton.
    const model = cloneSkinned(tpl.scene) as THREE.Object3D;
    this.model = model;
    this.inner.add(model);
    if (tpl.clip) {
      this.mixer = new THREE.AnimationMixer(model);
      this.mixer.clipAction(tpl.clip).play();
    }
    return true;
  }

  get loaded(): boolean {
    return this.model != null;
  }

  /** Advance the embedded signature clip. */
  update(dt: number): void {
    this.mixer?.update(dt);
  }

  /** Drive the assemble/close visual: 0 = collapsed/open, 1 = fully formed. */
  setClosure(closure: number): void {
    const c = THREE.MathUtils.clamp(closure, 0, 1);
    // Rise from a flattened, partially-assembled state to full size; a small
    // floor keeps the meshes from inverting at closure 0.
    const s = THREE.MathUtils.lerp(0.25, 1, c);
    this.inner.scale.setScalar(s);
    this.root.visible = c > 0.001;
  }

  /**
   * Procedural "heavy walk" feel layered on top of the embedded clip. Scaled by
   * the (normalized 0..1) movement `speed` and only while `piloted`, it drives:
   *  - a foot-plant vertical heave (chassis rises between steps, drops on a plant),
   *  - a side-to-side weight sway,
   *  - a slight forward pitch into the walk, and
   *  - a roll lean into turns (from the owner-set yaw's rate of change).
   *
   * Returns a foot-plant event ({@link side}: -1 left / +1 right) on the frame a
   * heavy foot lands so the owner can spawn dust, a shockwave, audio and camera
   * shake at that foot — otherwise null. Eases back to a neutral pose when idle so
   * the transformation phases (which call this with piloted=false) read clean.
   */
  updateLocomotion(dt: number, speed: number, piloted: boolean): { side: -1 | 1 } | null {
    if (dt <= 0) return null;
    // Normalize the controller's smoothed speed: ~0.65 is the run threshold.
    const target = piloted ? THREE.MathUtils.clamp(speed / 0.9, 0, 1) : 0;
    this.smoothedSpeed += (target - this.smoothedSpeed) * Math.min(1, 8 * dt);
    const move = this.smoothedSpeed;

    // Lean into turns from the yaw rate (owner sets root.rotation.y before this).
    const yaw = this.root.rotation.y;
    if (!this.yawInit) {
      this.prevYaw = yaw;
      this.yawInit = true;
    }
    let dyaw = yaw - this.prevYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.prevYaw = yaw;
    const yawRate = dyaw / dt;
    const targetRoll =
      THREE.MathUtils.clamp(-yawRate * 0.1, -0.16, 0.16) * (0.4 + 0.6 * move);
    this.leanRoll += (targetRoll - this.leanRoll) * Math.min(1, 6 * dt);

    // Advance the stride only while actually moving so a stopped mech never bobs;
    // when stopped the phase is frozen and the smoothed speed eases the bob out.
    let footstep: { side: -1 | 1 } | null = null;
    if (move > 0.05) {
      const prevStep = Math.floor(this.stridePhase / Math.PI);
      this.stridePhase += (2.4 + 2.2 * move) * dt;
      const newStep = Math.floor(this.stridePhase / Math.PI);
      if (newStep > prevStep && move > 0.18) {
        footstep = { side: newStep % 2 === 0 ? 1 : -1 };
      }
    }

    const s = Math.sin(this.stridePhase);
    // Chassis heaves UP between steps and returns to ground on the plant (|sin|→0),
    // so feet never sink below the floor.
    this.inner.position.y = (1 - Math.abs(s)) * 0.12 * move;
    // Weight sway: one shift per full stride (half the foot cadence).
    this.inner.position.x = Math.sin(this.stridePhase * 0.5) * 0.06 * move;
    // Lean forward into the walk + roll into turns + a little sway roll.
    this.inner.rotation.x = 0.06 * move;
    this.inner.rotation.z = this.leanRoll + Math.sin(this.stridePhase * 0.5) * 0.03 * move;
    return footstep;
  }

  /** World-space transform helpers the owner calls each frame. */
  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
  }

  setYaw(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  /**
   * Dispose ONLY this instance's owned resources: the animation mixer and the
   * cloned scene graph nodes. Geometry + materials are SHARED with the cached
   * template (via SkeletonUtils clone), so they are intentionally left intact.
   */
  dispose(): void {
    this.mixer?.stopAllAction();
    this.mixer = null;
    if (this.model) {
      this.inner.remove(this.model);
      this.model = null;
    }
    this.root.removeFromParent();
  }
}
