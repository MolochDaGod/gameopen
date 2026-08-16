/**
 * Animated mechanical wing pack (wing_animated.glb).
 *
 * Static pose: only the **back circle / base ring** is visible — attach that
 * to Bip001 Spine / back. Deployed: open/expand wing planes (type 1 or 2).
 *
 * Modes (back-slot item driven — back slot **is** the effect slot):
 *  - stowed     — closed circle only (parachute pack on back)
 *  - parachute  — open (descent drag)
 *  - glide      — expand (horizontal glide)
 *  - flight     — expand + higher lift (powered / skill)
 *  - sail       — open; couples to open-ocean waterboard / sail deploy
 *
 * Wider item list (wind surf, hover, shell, stealth, …): see backSlotItems.ts.
 *
 * Clips in GLB (no skin — rigid keyframe hierarchy):
 *  open/expand/dispand/close × type 1 and type 2
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prepObjectMaterials } from "../texturePrep";
import { applyToonStyle } from "../materials/toonStyle";
import { applyGameLayer } from "../gameplay/GamePlayLayers";

const BASE = import.meta.env.BASE_URL || "/";

export type WingMode = "stowed" | "parachute" | "glide" | "flight" | "sail";
export type WingType = 1 | 2;

export const WING_CLIP = {
  open1: "open wing type 1",
  expand1: "expand wing type 1",
  dispand1: "dispand wing type 1",
  close1: "close wing type 1",
  open2: "open wing type 2",
  expand2: "expand wing type 2",
  dispand2: "dispand wing type 2",
  close2: "close wing type 2",
} as const;

/** Back-slot item → default wing behaviour. */
export const BACK_SLOT_WING_ITEMS: Record<
  string,
  { mode: WingMode; type: WingType; label: string }
> = {
  back_wing_pack: { mode: "stowed", type: 1, label: "Wing Pack" },
  back_parachute: { mode: "parachute", type: 1, label: "Parachute" },
  back_glider: { mode: "glide", type: 2, label: "Glider" },
  back_flight_rig: { mode: "flight", type: 2, label: "Flight Rig" },
  back_sail_deploy: { mode: "sail", type: 1, label: "Deployable Sail" },
  back_holy_wings: { mode: "glide", type: 1, label: "Holy Wings" },
  back_traveler_wings: { mode: "flight", type: 2, label: "Traveler's Wings" },
};

export type WingPhysicsProfile = {
  /** Extra drag while airborne (parachute high). */
  drag: number;
  /** Horizontal glide factor (0–1 of forward). */
  glide: number;
  /** Upward lift impulse scale. */
  lift: number;
  /** Max fall speed clamp (m/s, negative Y). */
  maxFall: number;
};

export function physicsForMode(mode: WingMode): WingPhysicsProfile {
  switch (mode) {
    case "parachute":
      return { drag: 0.85, glide: 0.15, lift: 0.05, maxFall: -3.5 };
    case "glide":
      return { drag: 0.45, glide: 0.75, lift: 0.12, maxFall: -6 };
    case "flight":
      return { drag: 0.25, glide: 0.9, lift: 0.55, maxFall: -2 };
    case "sail":
      // Ocean: wind-coupled later; moderate open wing + board link
      return { drag: 0.35, glide: 0.55, lift: 0.08, maxFall: -8 };
    case "stowed":
    default:
      return { drag: 0, glide: 0, lift: 0, maxFall: -40 };
  }
}

function loadGltf(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (g) => resolve({ scene: g.scene, animations: g.animations ?? [] }),
      undefined,
      reject,
    );
  });
}

/** Find spine/back bone on grudge6 / Mixamo kits. */
export function findBackBone(root: THREE.Object3D): THREE.Object3D | null {
  let best: THREE.Object3D | null = null;
  let score = -1;
  root.traverse((o) => {
    const n = o.name || "";
    let s = 0;
    if (/bip001.?spine2|mixamorig.?spine2/i.test(n)) s = 100;
    else if (/bip001.?spine1|mixamorig.?spine1/i.test(n)) s = 80;
    else if (/bip001.?spine|mixamorig.?spine$/i.test(n)) s = 60;
    else if (/spine/i.test(n)) s = 40;
    else if (/back.?attach|back.?slot|r_back|l_back/i.test(n)) s = 90;
    if (s > score) {
      score = s;
      best = o;
    }
  });
  return best;
}

/**
 * Hide wing surfaces; keep base circle / middle cylinders visible (static pack look).
 */
export function applyStowedVisibility(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const n = `${o.name} ${o.parent?.name || ""}`;
    // Wing membranes / planes — hide when stowed
    const isWingSurface =
      /plane|wing|left_wing|right_wing/i.test(n) && !/base|begin|middel|cylinder/i.test(n);
    // Segment bones of deployable wing frame
    const isWingSegment = /^(begin|2de|3de|4de|5de|6de|7de|einde)/i.test(o.name);
    if (isWingSurface || isWingSegment) {
      m.visible = false;
    } else if (/cylinder|base|middel|begin_base|einde_base/i.test(n) || /Mat\.3|base/i.test(n)) {
      m.visible = true;
    }
  });
}

export function applyDeployedVisibility(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.visible = true;
  });
}

export class WingBackRig {
  readonly group = new THREE.Group();
  private root: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private currentAction: THREE.AnimationAction | null = null;
  private mode: WingMode = "stowed";
  private wingType: WingType = 1;
  private attachedBone: THREE.Object3D | null = null;
  private ready = false;
  /** Local offset on spine (metres SI). */
  offset = new THREE.Vector3(0, 0.12, -0.18);
  euler = new THREE.Euler(0, Math.PI, 0);

  get isReady(): boolean {
    return this.ready;
  }

  getMode(): WingMode {
    return this.mode;
  }

  getPhysics(): WingPhysicsProfile {
    return physicsForMode(this.mode);
  }

  async load(opts?: { toon?: boolean; url?: string }): Promise<boolean> {
    const url = opts?.url ?? `${BASE}models/equipment/wing_animated.glb`;
    try {
      const { scene, animations } = await loadGltf(url);
      prepObjectMaterials(scene, { neutralizeMetal: true });
      if (opts?.toon !== false) applyToonStyle(scene, { outline: false, steps: 4 });

      this.root = scene;
      this.root.name = "WingBackRig";
      applyGameLayer(this.root, "prop");
      this.root.userData.backSlot = true;
      this.root.userData.equipment = "wing_animated";

      this.group.clear();
      this.group.add(this.root);
      this.mixer = new THREE.AnimationMixer(this.root);
      this.clips.clear();
      for (const c of animations) {
        this.clips.set(c.name.toLowerCase(), c);
        this.clips.set(c.name, c);
      }

      applyStowedVisibility(this.root);
      this.ready = true;
      return true;
    } catch (e) {
      console.warn("[WingBackRig] load failed", e);
      this.ready = false;
      return false;
    }
  }

  /** Parent under character spine bone (or character root if bone missing). */
  attachToCharacter(characterRoot: THREE.Object3D): boolean {
    if (!this.root) return false;
    const bone = findBackBone(characterRoot);
    this.attachedBone = bone || characterRoot;
    // Detach from previous
    this.group.removeFromParent();
    this.attachedBone.add(this.group);
    this.group.position.copy(this.offset);
    this.group.rotation.copy(this.euler);
    this.group.scale.setScalar(1);
    // Fit ring to ~human back (asset may be cm)
    this.normalizeScale(0.35);
    return true;
  }

  private normalizeScale(targetDiameterM: number) {
    if (!this.root) return;
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const d = Math.max(size.x, size.z, 0.01);
    const s = targetDiameterM / d;
    if (Number.isFinite(s) && s > 0 && s < 100) {
      this.group.scale.setScalar(s);
    }
  }

  setWingType(t: WingType) {
    this.wingType = t;
  }

  /**
   * Transition to a wing mode and play the matching clip once / hold.
   */
  setMode(mode: WingMode, opts?: { type?: WingType; snap?: boolean }): void {
    if (opts?.type) this.wingType = opts.type;
    const prev = this.mode;
    this.mode = mode;
    if (!this.root || !this.mixer) return;

    if (mode === "stowed") {
      if (!opts?.snap && prev !== "stowed") {
        void this.playClip(this.clipName("close"), 0.2);
      }
      applyStowedVisibility(this.root);
      return;
    }

    applyDeployedVisibility(this.root);
    if (mode === "parachute" || mode === "sail") {
      void this.playClip(this.clipName("open"), 0.15);
    } else {
      // glide / flight
      void this.playClip(this.clipName("expand"), 0.15);
    }
  }

  /** Equip from back-slot item id. */
  equipBackItem(itemId: string | null): void {
    if (!itemId || !BACK_SLOT_WING_ITEMS[itemId]) {
      this.setMode("stowed", { snap: true });
      this.group.visible = !!itemId;
      return;
    }
    const def = BACK_SLOT_WING_ITEMS[itemId]!;
    this.group.visible = true;
    this.setWingType(def.type);
    this.setMode(def.mode);
  }

  private clipName(kind: "open" | "expand" | "dispand" | "close"): string {
    const t = this.wingType;
    const map: Record<string, string> = {
      open: t === 1 ? WING_CLIP.open1 : WING_CLIP.open2,
      expand: t === 1 ? WING_CLIP.expand1 : WING_CLIP.expand2,
      dispand: t === 1 ? WING_CLIP.dispand1 : WING_CLIP.dispand2,
      close: t === 1 ? WING_CLIP.close1 : WING_CLIP.close2,
    };
    return map[kind]!;
  }

  playClip(name: string, fade = 0.15): boolean {
    if (!this.mixer) return false;
    const clip =
      this.clips.get(name) ||
      this.clips.get(name.toLowerCase()) ||
      [...this.clips.values()].find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!clip) {
      console.warn("[WingBackRig] missing clip", name, [...this.clips.keys()]);
      return false;
    }
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    if (this.currentAction) this.currentAction.fadeOut(fade);
    next.fadeIn(fade).play();
    this.currentAction = next;
    return true;
  }

  listClips(): string[] {
    return [...new Set([...this.clips.values()].map((c) => c.name))];
  }

  update(dt: number) {
    this.mixer?.update(dt);
  }

  /**
   * Apply wing physics to a velocity / fall (Controller can call each frame).
   * Mutates `vel` y component when airborne and mode ≠ stowed.
   */
  applyAirAssist(
    vel: THREE.Vector3,
    forward: THREE.Vector3,
    airborne: boolean,
    wind?: THREE.Vector3,
  ): void {
    if (!airborne || this.mode === "stowed") return;
    const p = physicsForMode(this.mode);
    if (vel.y < p.maxFall) vel.y = p.maxFall;
    // Glide: pull velocity toward forward * glide
    if (p.glide > 0) {
      const f = forward.clone().setY(0);
      if (f.lengthSq() > 1e-6) {
        f.normalize().multiplyScalar(p.glide * 2.5);
        vel.x += (f.x - vel.x) * 0.04 * p.glide;
        vel.z += (f.z - vel.z) * 0.04 * p.glide;
      }
    }
    if (p.lift > 0 && vel.y < 0) {
      vel.y += p.lift * 0.15;
    }
    if (p.drag > 0) {
      vel.x *= 1 - p.drag * 0.02;
      vel.z *= 1 - p.drag * 0.02;
    }
    if (this.mode === "sail" && wind) {
      vel.x += wind.x * 0.4;
      vel.z += wind.z * 0.4;
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.mixer?.stopAllAction();
    this.root = null;
    this.ready = false;
  }
}

/** Machine-readable review of wing asset (for docs / AI). */
export const WING_ASSET_REVIEW = {
  source: "D:/Games/Models/wing_animated.glb",
  publicPath: "models/equipment/wing_animated.glb",
  sizeMB: 1.31,
  meshCount: 29,
  materials: ["Mat.3", "wing", "base", "Mat.1", "base_0"],
  skinned: false,
  note: "Rigid hierarchy animations (no skin). Static = base circle only.",
  hierarchy: {
    main: "root under main / RootNode",
    left_wing: "Plane segments + left_wing_base (begin…einde)",
    right_wing: "Plane segments + right_wing_base",
    middel: "Cylinder base ring — visible when stowed",
  },
  clips: [
    "open wing type 1",
    "expand wing type 1",
    "dispand wing type 1",
    "close wing type 1",
    "open wing type 2",
    "expand wing type 2",
    "dispand wing type 2",
    "close wing type 2",
  ],
  attachBone: "Bip001 Spine2 / mixamorigSpine2",
  modes: ["stowed", "parachute", "glide", "flight", "sail"],
  ocean: "mode=sail couples to SailEnvironment wind + waterboard deploy",
} as const;
