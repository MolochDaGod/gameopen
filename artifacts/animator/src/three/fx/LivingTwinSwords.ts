/**
 * Living twin swords — dual "Brothers Keeper" blades for Racalvin the Pirate King.
 *
 * Modes:
 *  - sheathed: X-cross on upper back
 *  - orbit: circle around host (living idle)
 *  - spinAoe: fast spin AOE ring around Racalvin
 *  - projectile: both blades fly at a target point then return
 *  - tornado: spin up → convert to fire-tornado launches, one after the other
 *
 * Mesh: models/weapons/my-brothers-keeper.prod.glb
 */
import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";

export type LivingSwordMode =
  | "sheathed"
  | "orbit"
  | "spinAoe"
  | "projectile"
  | "tornado";

const MESH_CANDIDATES = [
  "models/weapons/my-brothers-keeper.prod.glb",
  "models/weapons/my-brothers-keeper.glb",
  "models/weapons/sword.glb",
  "models/weapons/sculk-sword.glb",
];

const BLADE_LEN_M = 1.05;

const SPINE_NAMES = [
  "Bip001 Spine2",
  "Bip001 Spine1",
  "Bip001 Spine",
  "mixamorig:Spine2",
  "mixamorig:Spine1",
  "mixamorig:Spine",
  "Spine2",
  "Spine1",
  "Spine",
  "Chest",
  "Back",
];

export type LivingSwordHitKind = "projectile" | "aoe" | "tornado";

export type LivingSwordCallbacks = {
  /** Melee / projectile footprint hits for damage. */
  onHit?: (worldPos: THREE.Vector3, kind: LivingSwordHitKind) => void;
  /**
   * When a sword converts to a fire tornado and launches.
   * Studio should call vfx.castFireTornado(from, dir, …).
   */
  onTornadoLaunch?: (
    from: THREE.Vector3,
    dir: THREE.Vector3,
    swordIndex: number,
  ) => void;
};

export class LivingTwinSwords {
  readonly root = new THREE.Group();
  private swords: THREE.Group[] = [];
  private mode: LivingSwordMode = "sheathed";
  private t = 0;
  private phaseT = 0;
  private attackDir = new THREE.Vector3(0, 0, -1);
  private targetWorld = new THREE.Vector3();
  private host: THREE.Object3D | null = null;
  private spine: THREE.Object3D | null = null;
  private orbitRadius = 1.2;
  private orbitHeight = 1.05;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private disposed = false;
  private cbs: LivingSwordCallbacks = {};
  private aoeHitAcc = 0;
  private projectileHit = false;
  private tornadoLaunched = [false, false];
  private tornadoSpinDur = 0.85;
  private tornadoStagger = 0.28;
  private projectileDur = 0.85;
  private spinAoeDur = 1.35;
  /** Prefer orbit when host is moving (set by host each frame). */
  moving = false;

  constructor() {
    this.root.name = "LivingTwinSwords";
  }

  setCallbacks(cbs: LivingSwordCallbacks): void {
    this.cbs = cbs;
  }

  async load(meshKeys: string[] = MESH_CANDIDATES): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load(meshKeys);
    return this.loadPromise;
  }

  private async _load(meshKeys: string[]): Promise<void> {
    try {
      const { scene } = await loadGltfFirst(meshKeys, sharedGltfLoader(), {
        prepMaterials: true,
      });
      if (this.disposed) {
        disposeObject(scene);
        return;
      }
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z, 0.001);
      scene.scale.setScalar(BLADE_LEN_M / longest);
      scene.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(scene);
      const c = box2.getCenter(new THREE.Vector3());
      scene.position.sub(c);

      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group();
        g.name = `LivingSword_${i}`;
        const clone = scene.clone(true);
        clone.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.frustumCulled = false;
            if (mesh.material) {
              mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map((m) => m.clone())
                : mesh.material.clone();
            }
          }
        });
        g.add(clone);
        this.root.add(g);
        this.swords.push(g);
      }
      this.loaded = true;
      this.applySheathedPose(true);
    } catch (err) {
      console.warn("[LivingTwinSwords] load failed", err);
    }
  }

  attach(characterRoot: THREE.Object3D, model: THREE.Object3D | null): void {
    this.host = characterRoot;
    this.spine = model ? findSpine(model) : null;
    if (this.root.parent !== characterRoot) {
      characterRoot.add(this.root);
    }
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
  }

  getMode(): LivingSwordMode {
    return this.mode;
  }

  isBusy(): boolean {
    return (
      this.mode === "spinAoe" ||
      this.mode === "projectile" ||
      this.mode === "tornado"
    );
  }

  /** Melee float slash (legacy short range). */
  strike(forward: THREE.Vector3): void {
    this.launchProjectile(
      forward,
      this.host
        ? this.host.position.clone().addScaledVector(forward, 8).setY(this.host.position.y + 1)
        : new THREE.Vector3(0, 1, -8),
    );
  }

  /**
   * Ranged projectile: both swords fly toward world target (or along forward).
   */
  launchProjectile(forward: THREE.Vector3, targetWorld?: THREE.Vector3): void {
    this.attackDir.copy(forward);
    this.attackDir.y = 0;
    if (this.attackDir.lengthSq() < 1e-6) this.attackDir.set(0, 0, -1);
    this.attackDir.normalize();
    if (targetWorld) {
      this.targetWorld.copy(targetWorld);
    } else if (this.host) {
      this.targetWorld
        .copy(this.host.position)
        .addScaledVector(this.attackDir, 10)
        .setY(this.host.position.y + 1.0);
    }
    this.mode = "projectile";
    this.phaseT = 0;
    this.projectileHit = false;
  }

  /** Fast spin AOE around Racalvin. */
  startSpinAoe(duration = 1.35): void {
    this.mode = "spinAoe";
    this.phaseT = 0;
    this.spinAoeDur = duration;
    this.aoeHitAcc = 0;
  }

  /**
   * R skill: blades spin rapidly, then launch one-after-another as fire tornados
   * in a straight path toward the target.
   */
  startTornadoBarrage(forward: THREE.Vector3, targetWorld?: THREE.Vector3): void {
    this.attackDir.copy(forward);
    this.attackDir.y = 0;
    if (this.attackDir.lengthSq() < 1e-6) this.attackDir.set(0, 0, -1);
    this.attackDir.normalize();
    if (targetWorld) {
      this.targetWorld.copy(targetWorld);
      const from = this.host?.position.clone() ?? new THREE.Vector3();
      const dir = targetWorld.clone().sub(from);
      dir.y = 0;
      if (dir.lengthSq() > 1e-4) this.attackDir.copy(dir.normalize());
    }
    this.mode = "tornado";
    this.phaseT = 0;
    this.tornadoLaunched = [false, false];
  }

  update(dt: number): void {
    if (!this.loaded || this.disposed) return;
    this.t += dt;

    if (
      this.mode !== "spinAoe" &&
      this.mode !== "projectile" &&
      this.mode !== "tornado"
    ) {
      this.mode = this.moving ? "orbit" : "sheathed";
    }

    switch (this.mode) {
      case "sheathed":
        this.applySheathedPose(false);
        break;
      case "orbit":
        this.applyOrbitPose(1.55, this.orbitRadius);
        break;
      case "spinAoe":
        this.updateSpinAoe(dt);
        break;
      case "projectile":
        this.updateProjectile(dt);
        break;
      case "tornado":
        this.updateTornado(dt);
        break;
      default:
        break;
    }
  }

  private updateSpinAoe(dt: number): void {
    this.phaseT += dt;
    // Very fast orbit
    this.applyOrbitPose(9.5, 1.55 + Math.sin(this.phaseT * 12) * 0.12);
    this.aoeHitAcc += dt;
    if (this.aoeHitAcc >= 0.12 && this.host) {
      this.aoeHitAcc = 0;
      const p = this.host.position.clone();
      p.y += 0.2;
      this.cbs.onHit?.(p, "aoe");
    }
    if (this.phaseT >= this.spinAoeDur) {
      this.mode = this.moving ? "orbit" : "sheathed";
    }
  }

  private updateProjectile(dt: number): void {
    this.phaseT += dt;
    const u = Math.min(1, this.phaseT / this.projectileDur);
    // Out to target then return
    const go = u < 0.55 ? easeOutCubic(u / 0.55) : 1 - easeInCubic((u - 0.55) / 0.45);
    const hostPos = this.host?.position.clone() ?? new THREE.Vector3();
    const aim = this.targetWorld.clone().sub(hostPos);
    aim.y = 0;
    const dist = Math.min(12, Math.max(4, aim.length()));
    if (aim.lengthSq() < 1e-4) aim.copy(this.attackDir);
    else aim.normalize();

    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), aim).normalize();
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);

    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      const side = i === 0 ? -1 : 1;
      const reach = dist * go;
      const local = aim
        .clone()
        .multiplyScalar(reach)
        .addScaledVector(right, side * 0.35 * (1 - go * 0.3))
        .add(new THREE.Vector3(0, 1.05 + Math.sin(go * Math.PI) * 0.4, 0));
      g.position.lerp(local, 0.4);
      const yaw = Math.atan2(aim.x, aim.z);
      g.rotation.y = yaw;
      g.rotation.x = -1.1 + go * 0.4;
      g.rotation.z = this.t * 14 + side * 0.5;
    }

    if (!this.projectileHit && go > 0.5 && go < 0.85) {
      this.projectileHit = true;
      const hit = hostPos.clone().addScaledVector(aim, dist * 0.92);
      hit.y += 1.0;
      this.cbs.onHit?.(hit, "projectile");
    }
    if (u >= 1) {
      this.mode = this.moving ? "orbit" : "sheathed";
    }
  }

  private updateTornado(dt: number): void {
    this.phaseT += dt;
    // Phase 1: spin extremely fast around host
    if (this.phaseT < this.tornadoSpinDur) {
      this.applyOrbitPose(14 + this.phaseT * 8, 1.35);
      return;
    }
    // Phase 2: hide blades and launch tornadoes staggered
    const after = this.phaseT - this.tornadoSpinDur;
    for (let i = 0; i < this.swords.length; i++) {
      const launchAt = i * this.tornadoStagger;
      if (!this.tornadoLaunched[i] && after >= launchAt) {
        this.tornadoLaunched[i] = true;
        const g = this.swords[i]!;
        g.visible = false;
        const from = this.swordWorldPos(i);
        from.y = 0.08;
        this.cbs.onTornadoLaunch?.(from, this.attackDir.clone(), i);
      }
    }
    // Wait until both launched + travel visual time
    if (after >= this.tornadoStagger * (this.swords.length - 1) + 0.35) {
      for (const g of this.swords) g.visible = true;
      this.mode = this.moving ? "orbit" : "sheathed";
      this.applySheathedPose(true);
    }
  }

  /** World position of sword i for VFX spawn. */
  swordWorldPos(i: number): THREE.Vector3 {
    const g = this.swords[i];
    if (!g) return this.host?.position.clone() ?? new THREE.Vector3();
    const wp = new THREE.Vector3();
    g.getWorldPosition(wp);
    return wp;
  }

  private applySheathedPose(instant: boolean): void {
    const baseY = 1.15;
    const baseZ = -0.18;
    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      g.visible = true;
      const side = i === 0 ? -1 : 1;
      const targetPos = new THREE.Vector3(side * 0.12, baseY, baseZ);
      const targetEuler = new THREE.Euler(
        -0.35,
        side * 0.55,
        side * (Math.PI / 2 + 0.85),
        "YXZ",
      );
      if (instant) {
        g.position.copy(targetPos);
        g.rotation.copy(targetEuler);
      } else {
        g.position.lerp(targetPos, 0.18);
        g.rotation.x += (targetEuler.x - g.rotation.x) * 0.18;
        g.rotation.y += (targetEuler.y - g.rotation.y) * 0.18;
        g.rotation.z += (targetEuler.z - g.rotation.z) * 0.18;
      }
    }
    if (this.spine && this.host) {
      const wp = new THREE.Vector3();
      this.spine.getWorldPosition(wp);
      const local = this.host.worldToLocal(wp.clone());
      for (const g of this.swords) {
        g.position.y = THREE.MathUtils.lerp(g.position.y, local.y + 0.15, 0.08);
      }
    }
  }

  private applyOrbitPose(speed: number, radius: number): void {
    const n = this.swords.length || 1;
    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      g.visible = true;
      const ang = this.t * speed + (i * Math.PI * 2) / n;
      const x = Math.cos(ang) * radius;
      const z = Math.sin(ang) * radius;
      const y = this.orbitHeight + Math.sin(this.t * 2.4 + i) * 0.08;
      g.position.lerp(new THREE.Vector3(x, y, z), 0.28);
      g.rotation.y = -ang + Math.PI / 2;
      g.rotation.x = 0.2 + Math.sin(this.t * 3 + i) * 0.15;
      g.rotation.z = Math.sin(this.t * 2 + i * 1.7) * 0.35 + this.t * speed * 0.15;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const g of this.swords) {
      disposeObject(g);
      g.removeFromParent();
    }
    this.swords = [];
    this.root.removeFromParent();
    this.loaded = false;
  }
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

function findSpine(model: THREE.Object3D): THREE.Object3D | null {
  for (const n of SPINE_NAMES) {
    const o = model.getObjectByName(n);
    if (o) return o;
  }
  let best: THREE.Object3D | null = null;
  model.traverse((o) => {
    if (/spine|chest|torso|back/i.test(o.name) && !best) best = o;
  });
  return best;
}

function easeOutCubic(t: number): number {
  const x = 1 - Math.min(1, Math.max(0, t));
  return 1 - x * x * x;
}
function easeInCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x;
}
