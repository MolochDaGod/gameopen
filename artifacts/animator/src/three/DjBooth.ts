import * as THREE from "three";
import { loadGltfFirst } from "./assets";
import { sharedGltfLoader } from "./loaders/gltf";
import type { MusicPulse } from "./audio/CombatSfx";

/** Beats per phrase — DJ re-picks show clip on boundaries. */
const DANCE_PHRASE_BEATS = 8;

/**
 * Racalvin disc-jockey show piece for the Danger Room cove.
 *
 * Loads `models/dj/disc_jockey.glb` (native clips: idle, noticing player,
 * music playing, swing, change discs, towerup, defeated). Larger cove in
 * {@link DangerRoom} gives room for cages, lights, and VFX while backgrounds
 * stay visible through the alcove window.
 *
 * Fallback keys keep older racalvin + booth assets if the new pack is missing.
 */
export class DjBooth {
  readonly group = new THREE.Group();

  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private roots: THREE.Object3D[] = [];
  private dancing = false;
  private lastPhrase = -1;
  private disposed = false;
  /** Source URL that loaded (for debug HUD). */
  sourceUrl = "";

  constructor(
    private readonly anchor: THREE.Vector3,
    /** Facing yaw (radians); default faces into the room (-Z). */
    private readonly facing = Math.PI,
  ) {
    this.group.position.copy(anchor);
    this.group.name = "DjBoothRacalvin";
  }

  async load(): Promise<void> {
    const gltfLoader = sharedGltfLoader();
    // Primary: full disc_jockey show pack. Fallbacks: legacy booth + racalvin.
    const primary = await loadGltfFirst(
      [
        "models/dj/disc_jockey.glb",
        "models/disc_jockey.glb",
        "models/racalvin.glb",
      ],
      gltfLoader,
      { prepMaterials: true },
    ).catch(() => null);

    if (this.disposed) {
      if (primary) this.disposeObject(primary.scene);
      return;
    }
    if (!primary) {
      console.warn("[DjBooth] no disc_jockey / racalvin GLB found");
      return;
    }

    this.sourceUrl = primary.url;
    const root = primary.scene;
    root.name = "RacalvinDiscJockey";

    // disc_jockey authored large / uneven — fit to ~2.0 m visual height in cove
    // but allow wider footprint for decks/cages (cove is ~10 m wide after expand).
    this.normalizeToCove(root, {
      targetHeight: 2.05,
      maxFootprintXZ: 6.5,
    });
    root.rotation.y = this.facing;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = true;
      }
    });
    this.group.add(root);
    this.roots.push(root);

    this.mixer = new THREE.AnimationMixer(root);
    const clips = primary.animations ?? [];
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set(clip.name.toLowerCase(), action);
    }

    // Optional separate booth prop if we only got bare racalvin character.
    if (/racalvin/i.test(primary.url) && !/disc_jockey/i.test(primary.url)) {
      try {
        const boothGltf = await loadGltfFirst("models/dj-booth.glb", gltfLoader, {
          prepMaterials: true,
        });
        if (!this.disposed) {
          const booth = boothGltf.scene;
          this.normalizeToCove(booth, { targetHeight: 1.25, maxFootprintXZ: 3 });
          booth.position.set(0, 0, -1.2);
          booth.rotation.y = this.facing;
          this.group.add(booth);
          this.roots.push(booth);
        } else {
          this.disposeObject(boothGltf.scene);
        }
      } catch {
        /* booth optional */
      }
    }

    const idle = this.pickAction(["idle", "music playing", "noticing player"]);
    if (idle) {
      idle.play();
      this.current = idle;
    }
  }

  /**
   * Drive native show clips from the live music bed.
   * Calm → idle / noticing · heated → music playing / swing · peaks → change discs.
   */
  update(dt: number, music: MusicPulse | null = null): void {
    if (!this.mixer) return;
    this.mixer.update(dt);
    if (this.actions.size === 0) return;
    if (!music) return;

    const phrase = Math.floor(music.beat / DANCE_PHRASE_BEATS);
    if (phrase === this.lastPhrase) return;
    this.lastPhrase = phrase;

    const intensity = music.intensity;
    let want: string[];
    if (intensity > 0.72) {
      want = ["change discs 1", "change discs 2", "towerup", "swing", "music playing"];
    } else if (intensity > 0.4) {
      want = ["music playing", "swing", "idle"];
    } else if (intensity > 0.15) {
      want = ["noticing player", "idle", "music playing"];
    } else {
      want = ["idle", "noticing player"];
    }

    const next = this.pickAction(want);
    if (!next) return;
    if (this.current === next) {
      next.timeScale = 0.85 + intensity * 0.55;
      return;
    }
    next.timeScale = 0.85 + intensity * 0.55;
    this.fadeTo(next);
    this.dancing = intensity > 0.35;
  }

  private pickAction(names: string[]): THREE.AnimationAction | null {
    for (const n of names) {
      const key = n.toLowerCase();
      const hit = this.actions.get(key);
      if (hit) return hit;
      // fuzzy: clip name contains token
      for (const [k, a] of this.actions) {
        if (k.includes(key) || key.includes(k)) return a;
      }
    }
    // first available
    return this.actions.values().next().value ?? null;
  }

  private fadeTo(to: THREE.AnimationAction): void {
    if (this.current === to) return;
    to.reset().setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(to, 0.45, false);
    this.current = to;
  }

  /**
   * Fit showpiece into the cove: height target, then cap XZ footprint so decks
   * / cages don't punch through side walls.
   */
  private normalizeToCove(
    obj: THREE.Object3D,
    opts: { targetHeight: number; maxFootprintXZ: number },
  ): void {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (!Number.isFinite(box.min.x)) return;
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (size.y > 1e-4) s = opts.targetHeight / size.y;
    // Cap wild authored extents (disc_jockey accessor noise can be huge)
    const maxDim = Math.max(size.x, size.y, size.z) * s;
    if (maxDim > 12) s *= 8 / maxDim;
    obj.scale.setScalar(s);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    const size2 = box2.getSize(new THREE.Vector3());
    const foot = Math.max(size2.x, size2.z);
    if (foot > opts.maxFootprintXZ && foot > 1e-4) {
      obj.scale.multiplyScalar(opts.maxFootprintXZ / foot);
      obj.updateMatrixWorld(true);
    }
    const box3 = new THREE.Box3().setFromObject(obj);
    const center = box3.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box3.min.y;
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    for (const r of this.roots) this.disposeObject(r);
    this.roots = [];
    this.group.clear();
  }
}
