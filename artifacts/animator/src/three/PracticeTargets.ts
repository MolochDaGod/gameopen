/**
 * Danger Room practice targets — replaces heavy punching bags.
 *
 * Two selectable GLB testers off to the side:
 *  - Practice Dummy (the_practice_dummy.glb)
 *  - Boss Tester (free_dummy_monster.glb)
 *
 * Walk up → interact chip (E) to power ON (combat slot) or OFF (corner park).
 * Health reaches 0 → auto OFF, heal, park in corner.
 *
 * Hit detection is sphere-based (same blast path as old bags); no pendulum joints.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { asset } from "./assets";
import { HealthBar } from "./HealthBar";

export type PracticeTargetId = "practice_dummy" | "boss_tester";

export type PracticeTargetDef = {
  id: PracticeTargetId;
  /** Same-origin public path under models/props/ */
  file: string;
  name: string;
  maxHealth: number;
  /** Combat lane (off to the side of the room centre). */
  activePos: readonly [number, number, number];
  /** Powered-off parking corner. */
  cornerPos: readonly [number, number, number];
  /** Target total height in metres (SI). */
  targetHeight: number;
  /** Hit / collision radius (metres). */
  radius: number;
};

export const PRACTICE_TARGET_DEFS: readonly PracticeTargetDef[] = [
  {
    id: "practice_dummy",
    // Same-origin under /ui/* (allowlisted; /models/props rewrites to R2 CDN)
    file: "ui/training-targets/the_practice_dummy.glb",
    name: "Practice Dummy",
    maxHealth: 150,
    activePos: [-10.5, 0, -3.5],
    cornerPos: [-14.2, 0, -14.0],
    targetHeight: 1.85,
    radius: 0.55,
  },
  {
    id: "boss_tester",
    file: "ui/training-targets/free_dummy_monster.glb",
    name: "Boss Tester",
    maxHealth: 900,
    activePos: [-10.5, 0, 3.5],
    cornerPos: [-14.2, 0, -12.2],
    targetHeight: 2.6,
    radius: 0.95,
  },
] as const;

export type PracticeTargetState = {
  id: PracticeTargetId;
  name: string;
  on: boolean;
  health: number;
  maxHealth: number;
  /** World position of feet. */
  position: THREE.Vector3;
  /** True when player is within interact range. */
  near: boolean;
};

type Unit = {
  def: PracticeTargetDef;
  root: THREE.Group;
  mesh: THREE.Object3D;
  bar: HealthBar;
  health: number;
  on: boolean;
  /** Slight hit flash. */
  flashT: number;
  baseMats: THREE.MeshStandardMaterial[];
};

const INTERACT_RANGE = 3.2;

export class PracticeTargets {
  readonly group = new THREE.Group();
  private scene: THREE.Scene;
  private units: Unit[] = [];
  private loaded = false;
  private flashMsg: ((msg: string, t?: number) => void) | null = null;
  private onStateChange: (() => void) | null = null;

  constructor(
    scene: THREE.Scene,
    opts?: {
      flash?: (msg: string, t?: number) => void;
      onStateChange?: () => void;
    },
  ) {
    this.scene = scene;
    this.flashMsg = opts?.flash ?? null;
    this.onStateChange = opts?.onStateChange ?? null;
    this.group.name = "PracticeTargets";
    scene.add(this.group);
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Load both GLBs and park them OFF in the corner. */
  async load(): Promise<void> {
    if (this.loaded) return;
    const loader = new GLTFLoader();
    for (const def of PRACTICE_TARGET_DEFS) {
      try {
        const url = asset(def.file);
        const gltf = await loader.loadAsync(url);
        const unit = this.buildUnit(def, gltf.scene);
        this.units.push(unit);
        // Start OFF in corner
        this.applyPose(unit, false, true);
      } catch (err) {
        console.warn(`[PracticeTargets] failed to load ${def.file}`, err);
      }
    }
    this.loaded = true;
    this.flashMsg?.(
      "TARGETS · Practice Dummy + Boss Tester · walk up · E power on/off",
      2.2,
    );
    this.onStateChange?.();
  }

  private buildUnit(def: PracticeTargetDef, src: THREE.Object3D): Unit {
    const mesh = src.clone(true);
    // SI scale to target height, feet on ground
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const h = Math.max(size.y, 1e-3);
    const s = def.targetHeight / h;
    mesh.scale.setScalar(s);
    mesh.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(mesh);
    mesh.position.y -= box2.min.y;

    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      // Ensure materials are clonable for flash tint
      if (m.material) {
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mat) => mat.clone());
        } else {
          m.material = m.material.clone();
        }
      }
    });

    const root = new THREE.Group();
    root.name = `practice-target:${def.id}`;
    root.userData.practiceTargetId = def.id;
    root.add(mesh);
    this.group.add(root);

    const bar = new HealthBar(def.id === "boss_tester" ? 1.6 : 1.1);
    bar.setVisible(false);
    this.group.add(bar.group);

    const baseMats: THREE.MeshStandardMaterial[] = [];
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          baseMats.push(mat as THREE.MeshStandardMaterial);
        }
      }
    });

    return {
      def,
      root,
      mesh,
      bar,
      health: def.maxHealth,
      on: false,
      flashT: 0,
      baseMats,
    };
  }

  private applyPose(unit: Unit, on: boolean, snap = false) {
    unit.on = on;
    const [x, , z] = on ? unit.def.activePos : unit.def.cornerPos;
    const y = unit.def.activePos[1];
    if (snap) {
      unit.root.position.set(x, y, z);
    } else {
      // Instant for now (readable); could tween later
      unit.root.position.set(x, y, z);
    }
    // Face center of room when on; face out when off
    unit.root.rotation.y = on ? Math.PI / 2 : -Math.PI / 4;
    unit.bar.setVisible(on);
    // Dim when off
    const dim = on ? 1 : 0.45;
    for (const mat of unit.baseMats) {
      mat.opacity = on ? 1 : 0.75;
      mat.transparent = !on;
      if ("emissiveIntensity" in mat) {
        (mat as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.15 : 0.02;
      }
      mat.needsUpdate = true;
      void dim;
    }
    unit.root.visible = true;
  }

  /** Toggle power for a unit by id. */
  setPowered(id: PracticeTargetId, on: boolean): boolean {
    const unit = this.units.find((u) => u.def.id === id);
    if (!unit) return false;
    if (unit.on === on) return true;
    if (on) {
      unit.health = unit.def.maxHealth;
      this.applyPose(unit, true);
      this.flashMsg?.(`${unit.def.name.toUpperCase()} · ONLINE · HP ${unit.health}`, 1.2);
    } else {
      unit.health = unit.def.maxHealth;
      this.applyPose(unit, false);
      this.flashMsg?.(`${unit.def.name.toUpperCase()} · OFFLINE · corner`, 1.1);
    }
    this.onStateChange?.();
    return true;
  }

  toggle(id: PracticeTargetId): boolean {
    const unit = this.units.find((u) => u.def.id === id);
    if (!unit) return false;
    return this.setPowered(id, !unit.on);
  }

  /** Nearest unit within interact range of player feet, or null. */
  nearestInteract(playerPos: THREE.Vector3): PracticeTargetId | null {
    let best: PracticeTargetId | null = null;
    let bestD = INTERACT_RANGE;
    for (const u of this.units) {
      const dx = u.root.position.x - playerPos.x;
      const dz = u.root.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = u.def.id;
      }
    }
    return best;
  }

  getState(id: PracticeTargetId): PracticeTargetState | null {
    const u = this.units.find((x) => x.def.id === id);
    if (!u) return null;
    return {
      id: u.def.id,
      name: u.def.name,
      on: u.on,
      health: u.health,
      maxHealth: u.def.maxHealth,
      position: u.root.position.clone(),
      near: false,
    };
  }

  listStates(playerPos?: THREE.Vector3): PracticeTargetState[] {
    return this.units.map((u) => {
      let near = false;
      if (playerPos) {
        const d = Math.hypot(
          u.root.position.x - playerPos.x,
          u.root.position.z - playerPos.z,
        );
        near = d <= INTERACT_RANGE;
      }
      return {
        id: u.def.id,
        name: u.def.name,
        on: u.on,
        health: u.health,
        maxHealth: u.def.maxHealth,
        position: u.root.position.clone(),
        near,
      };
    });
  }

  /**
   * Melee / skill blast — only powered-on units take damage.
   * Returns total damage applied across units.
   */
  blast(
    center: THREE.Vector3,
    radius: number,
    force: number,
    damage = 0,
  ): { damage: number; hitPos: THREE.Vector3 | null; critHint: boolean } {
    let total = 0;
    let hitPos: THREE.Vector3 | null = null;
    let maxSingle = 0;
    for (const u of this.units) {
      if (!u.on) continue;
      // Hit center ~ chest height
      const chest = u.root.position.clone();
      chest.y += u.def.targetHeight * 0.55;
      const dist = chest.distanceTo(center);
      const reach = radius + u.def.radius;
      if (dist > reach) continue;
      const falloff = 1 - dist / reach;
      const dmg = Math.max(1, Math.round((damage || force * 2) * (0.45 + 0.55 * falloff)));
      u.health = Math.max(0, u.health - dmg);
      u.flashT = 0.18;
      total += dmg;
      if (dmg > maxSingle) {
        maxSingle = dmg;
        hitPos = chest;
      }
      // Light knock visual (wobble)
      u.root.rotation.z = (Math.random() - 0.5) * 0.12 * falloff;

      if (u.health <= 0) {
        this.flashMsg?.(`${u.def.name.toUpperCase()} · DEFEATED · offline`, 1.4);
        this.setPowered(u.def.id, false);
      }
    }
    return { damage: total, hitPos, critHint: maxSingle >= 40 };
  }

  /** Collision circles for player push-out (active targets only). */
  obstacleCircles(): { x: number; z: number; r: number }[] {
    return this.units
      .filter((u) => u.on)
      .map((u) => ({
        x: u.root.position.x,
        z: u.root.position.z,
        r: u.def.radius + 0.15,
      }));
  }

  /**
   * Per-frame: health bars, flash fade, interact state.
   */
  update(dt: number, camera: THREE.Camera, playerPos?: THREE.Vector3): void {
    const barAt = new THREE.Vector3();
    for (const u of this.units) {
      if (u.flashT > 0) {
        u.flashT = Math.max(0, u.flashT - dt);
        const k = u.flashT / 0.18;
        for (const mat of u.baseMats) {
          if (mat.emissive) mat.emissive.setRGB(k * 0.6, k * 0.05, 0.02);
        }
        if (u.flashT <= 0) {
          u.root.rotation.z = 0;
          for (const mat of u.baseMats) {
            if (mat.emissive) mat.emissive.setRGB(0, 0, 0);
          }
        }
      }
      if (u.on) {
        u.bar.setRatio(u.health / u.def.maxHealth);
        barAt.set(
          u.root.position.x,
          u.def.targetHeight + 0.35,
          u.root.position.z,
        );
        u.bar.place(barAt, camera);
        u.bar.setVisible(true);
      } else {
        u.bar.setVisible(false);
      }
    }
    void playerPos;
  }

  dispose(): void {
    for (const u of this.units) {
      u.bar.dispose();
      u.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    }
    this.units = [];
    this.scene.remove(this.group);
    this.group.clear();
    this.loaded = false;
  }
}
