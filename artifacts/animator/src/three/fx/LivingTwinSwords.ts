/**
 * Living twin swords — dual "Brothers Keeper" blades for Racalvin the Pirate King.
 *
 * Rest poses:
 *  - **sheathed / put away (Z)** — X-cross on upper back (spine-anchored)
 *  - **drawn** — each blade follows its hand bone (IK grip)
 *
 * Attack:
 *  - **projectile** — CatmullRom spline out → hit → return to hands; blade
 *    orients to path tangent (direction / "IK" heading)
 *  - **spinAoe** / **tornado** — combat specials
 *  - **trails** + **hand energy** only while attacking; shrink to ~0 when idle
 *
 * Mesh: models/weapons/my-brothers-keeper.prod.glb
 */
import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";

export type LivingSwordMode =
  | "sheathed"
  | "drawn"
  | "spinAoe"
  | "projectile"
  | "return"
  | "tornado";

const MESH_CANDIDATES = [
  "models/weapons/my-brothers-keeper.prod.glb",
  "models/weapons/my-brothers-keeper.glb",
  "models/weapons/sword.glb",
  "models/weapons/sculk-sword.glb",
];

const BLADE_LEN_M = 1.05;
const TRAIL_SEGS = 18;
const HAND_FX_PEAK = 1;
const HAND_FX_IDLE = 0.04;

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

const HAND_R_NAMES = [
  "Bip001 R Hand",
  "Bip001 Rhand",
  "mixamorig:RightHand",
  "RightHand",
  "Hand_R",
  "hand_r",
  "R_Hand",
];
const HAND_L_NAMES = [
  "Bip001 L Hand",
  "Bip001 Lhand",
  "mixamorig:LeftHand",
  "LeftHand",
  "Hand_L",
  "hand_l",
  "L_Hand",
];

export type LivingSwordHitKind = "projectile" | "aoe" | "tornado";

export type LivingSwordCallbacks = {
  onHit?: (worldPos: THREE.Vector3, kind: LivingSwordHitKind) => void;
  onTornadoLaunch?: (
    from: THREE.Vector3,
    dir: THREE.Vector3,
    swordIndex: number,
  ) => void;
  /** Optional: host can spawn external VFX when attack energy spikes. */
  onHandFx?: (intensity: number, burst: boolean) => void;
};

export type LivingSwordEntity = {
  /** Stable id for net / debug / VFX pairing. */
  uuid: string;
  index: 0 | 1;
  side: "left" | "right";
};

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `ls_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

export class LivingTwinSwords {
  readonly root = new THREE.Group();
  /** System id (all swords share a twin set id). */
  readonly setUuid = newId();
  private swords: THREE.Group[] = [];
  private entities: LivingSwordEntity[] = [];
  private trails: {
    mesh: THREE.Mesh;
    geo: THREE.BufferGeometry;
    mat: THREE.MeshBasicMaterial;
    hist: THREE.Vector3[];
  }[] = [];
  private mode: LivingSwordMode = "sheathed";
  private t = 0;
  private phaseT = 0;
  private attackDir = new THREE.Vector3(0, 0, -1);
  private targetWorld = new THREE.Vector3();
  private host: THREE.Object3D | null = null;
  private spine: THREE.Object3D | null = null;
  private handR: THREE.Object3D | null = null;
  private handL: THREE.Object3D | null = null;
  private orbitRadius = 1.15;
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
  private projectileDur = 1.05;
  private spinAoeDur = 1.35;
  private returnDur = 0.28;
  /** When true (Z put-away), stay sheathed on back until drawWeapons(). */
  private putAway = true;
  /** 0..1 attack energy — drives trails + hand FX; decays when idle. */
  private attackEnergy = 0;
  /** Active projectile flight uuid (one per launch pair). */
  private projectileUuid: string | null = null;
  private outCurves: THREE.CatmullRomCurve3[] = [];
  private retCurves: THREE.CatmullRomCurve3[] = [];
  private scratch = {
    v: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    v3: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    e: new THREE.Euler(),
  };
  /** Prefer light motion cue when drawn (subtle float); ignored while putAway. */
  moving = false;

  constructor() {
    this.root.name = "LivingTwinSwords";
  }

  setCallbacks(cbs: LivingSwordCallbacks): void {
    this.cbs = cbs;
  }

  getEntities(): readonly LivingSwordEntity[] {
    return this.entities;
  }

  getProjectileUuid(): string | null {
    return this.projectileUuid;
  }

  /** 0..1 — use for external hand VFX scale. */
  getHandFxIntensity(): number {
    return this.attackEnergy;
  }

  /** True while trails / combat FX should be visible. */
  isAttackFxActive(): boolean {
    return this.attackEnergy > 0.08 || this.isBusy();
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
      // Tip along local +Y after normalize (grip near origin)
      const tipAlign = new THREE.Group();
      tipAlign.add(scene);

      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group();
        g.name = `LivingSword_${i}`;
        g.userData.uuid = newId();
        const clone = tipAlign.clone(true);
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
        this.entities.push({
          uuid: g.userData.uuid as string,
          index: i as 0 | 1,
          side: i === 0 ? "left" : "right",
        });
        this.trails.push(this.makeTrail(i === 0 ? 0x3dff8a : 0xb44dff));
      }
      this.loaded = true;
      this.applySheathedPose(true);
    } catch (err) {
      console.warn("[LivingTwinSwords] load failed", err);
    }
  }

  private makeTrail(color: number) {
    const segs = TRAIL_SEGS;
    const verts = segs * 2;
    const pos = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 4);
    const idx: number[] = [];
    for (let i = 0; i < segs - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "LivingSwordTrail";
    mesh.frustumCulled = false;
    mesh.visible = false;
    // World-space trail (not parented under spinning blades)
    this.root.parent?.add(mesh);
    return { mesh, geo, mat, hist: [] as THREE.Vector3[] };
  }

  /**
   * Bind host + skeleton anchors. Prefer explicit hands from Avatar; fall back
   * to name search under `model`.
   */
  attach(
    characterRoot: THREE.Object3D,
    model: THREE.Object3D | null,
    hands?: { right?: THREE.Object3D | null; left?: THREE.Object3D | null },
  ): void {
    this.host = characterRoot;
    this.spine = model ? findNamed(model, SPINE_NAMES) : null;
    this.setHands(hands?.right ?? null, hands?.left ?? null, model);
    if (this.root.parent !== characterRoot) {
      characterRoot.add(this.root);
    }
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    // Parent trails to scene root so history stays world-stable
    const sceneRoot = characterRoot.parent ?? characterRoot;
    for (const tr of this.trails) {
      if (tr.mesh.parent !== sceneRoot) sceneRoot.add(tr.mesh);
    }
  }

  /** Lightweight per-frame hand bone refresh (no reparent). */
  setHands(
    right: THREE.Object3D | null | undefined,
    left: THREE.Object3D | null | undefined,
    model?: THREE.Object3D | null,
  ): void {
    this.handR = right ?? (model ? findNamed(model, HAND_R_NAMES) : this.handR);
    this.handL = left ?? (model ? findNamed(model, HAND_L_NAMES) : this.handL);
  }

  getMode(): LivingSwordMode {
    return this.mode;
  }

  isPutAway(): boolean {
    return this.putAway;
  }

  isBusy(): boolean {
    return (
      this.mode === "spinAoe" ||
      this.mode === "projectile" ||
      this.mode === "return" ||
      this.mode === "tornado"
    );
  }

  /** Z — sheath weapons on back (X cross). */
  putWeaponsAway(): void {
    if (this.isBusy()) {
      // Cancel flight mid-air → fast return then sheath
      this.mode = "return";
      this.phaseT = 0;
      this.putAway = true;
      this.projectileUuid = null;
      return;
    }
    this.putAway = true;
    this.mode = "sheathed";
    this.attackEnergy = Math.min(this.attackEnergy, 0.2);
    this.applySheathedPose(false);
  }

  /** Draw to hands (call after put-away or on first equip if desired). */
  drawWeapons(): void {
    this.putAway = false;
    if (!this.isBusy()) {
      this.mode = "drawn";
      this.applyHandPose(false);
    }
  }

  /** Toggle put-away (Z). Returns new putAway state. */
  togglePutAway(): boolean {
    if (this.putAway) this.drawWeapons();
    else this.putWeaponsAway();
    return this.putAway;
  }

  /** Melee float slash → projectile. */
  strike(forward: THREE.Vector3): void {
    this.launchProjectile(
      forward,
      this.host
        ? this.host.position
            .clone()
            .addScaledVector(forward, 8)
            .setY(this.host.position.y + 1)
        : new THREE.Vector3(0, 1, -8),
    );
  }

  /**
   * Ranged projectile: both swords fly on CatmullRom splines to target then
   * return into hand bones. Each flight gets a projectile uuid.
   */
  launchProjectile(forward: THREE.Vector3, targetWorld?: THREE.Vector3): void {
    this.putAway = false;
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
    this.projectileUuid = newId();
    this.buildProjectileSplines();
    this.mode = "projectile";
    this.phaseT = 0;
    this.projectileHit = false;
    this.boostAttackEnergy(1);
  }

  /** Build outbound + return CatmullRom curves (host-local space). */
  private buildProjectileSplines(): void {
    this.outCurves = [];
    this.retCurves = [];
    if (!this.host) return;
    const hostPos = this.host.position.clone();
    const aim = this.targetWorld.clone().sub(hostPos);
    aim.y = 0;
    const dist = Math.min(14, Math.max(5, aim.length()));
    if (aim.lengthSq() < 1e-4) aim.copy(this.attackDir);
    else aim.normalize();
    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), aim)
      .normalize();
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0);

    for (let i = 0; i < this.swords.length; i++) {
      const side = i === 0 ? -1 : 1;
      const handLocal = this.handLocalPos(i);
      const start = handLocal.clone();
      const midLift = 0.55 + side * 0.08;
      const mid = aim
        .clone()
        .multiplyScalar(dist * 0.48)
        .addScaledVector(right, side * 0.55)
        .add(new THREE.Vector3(0, 1.15 + midLift, 0));
      const end = aim
        .clone()
        .multiplyScalar(dist)
        .addScaledVector(right, side * 0.22)
        .add(new THREE.Vector3(0, 1.05 + Math.sin(i) * 0.08, 0));
      // Slight arc control point past start
      const arc = start
        .clone()
        .lerp(mid, 0.45)
        .add(new THREE.Vector3(0, 0.35, 0))
        .addScaledVector(right, side * 0.25);

      this.outCurves.push(
        new THREE.CatmullRomCurve3([start, arc, mid, end], false, "catmullrom", 0.4),
      );
      // Return: end → high arc → hand
      const retMid = end
        .clone()
        .lerp(start, 0.5)
        .add(new THREE.Vector3(0, 0.75, 0))
        .addScaledVector(right, -side * 0.2);
      this.retCurves.push(
        new THREE.CatmullRomCurve3([end, retMid, start], false, "catmullrom", 0.35),
      );
    }
  }

  startSpinAoe(duration = 1.35): void {
    this.putAway = false;
    this.mode = "spinAoe";
    this.phaseT = 0;
    this.spinAoeDur = duration;
    this.aoeHitAcc = 0;
    this.boostAttackEnergy(1);
  }

  startTornadoBarrage(forward: THREE.Vector3, targetWorld?: THREE.Vector3): void {
    this.putAway = false;
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
    this.boostAttackEnergy(1);
  }

  private boostAttackEnergy(v: number): void {
    this.attackEnergy = Math.min(HAND_FX_PEAK, Math.max(this.attackEnergy, v));
    this.cbs.onHandFx?.(this.attackEnergy, true);
  }

  update(dt: number): void {
    if (!this.loaded || this.disposed) return;
    this.t += dt;

    // Decay attack energy → trails/hand FX shrink to nearly nothing
    if (!this.isBusy()) {
      const decay = this.putAway ? 4.5 : 2.8;
      this.attackEnergy = Math.max(0, this.attackEnergy - dt * decay);
      if (this.attackEnergy < HAND_FX_IDLE) this.attackEnergy = 0;
    } else {
      this.attackEnergy = Math.min(
        HAND_FX_PEAK,
        this.attackEnergy + dt * 1.2,
      );
    }

    if (!this.isBusy()) {
      if (this.putAway) this.mode = "sheathed";
      else this.mode = "drawn";
    }

    switch (this.mode) {
      case "sheathed":
        this.applySheathedPose(false);
        break;
      case "drawn":
        this.applyHandPose(false);
        break;
      case "spinAoe":
        this.updateSpinAoe(dt);
        break;
      case "projectile":
        this.updateProjectile(dt);
        break;
      case "return":
        this.updateReturn(dt);
        break;
      case "tornado":
        this.updateTornado(dt);
        break;
      default:
        break;
    }

    this.updateTrails(dt);
  }

  private updateSpinAoe(dt: number): void {
    this.phaseT += dt;
    this.applyOrbitPose(9.5, 1.55 + Math.sin(this.phaseT * 12) * 0.12);
    this.aoeHitAcc += dt;
    if (this.aoeHitAcc >= 0.12 && this.host) {
      this.aoeHitAcc = 0;
      const p = this.host.position.clone();
      p.y += 0.2;
      this.cbs.onHit?.(p, "aoe");
    }
    if (this.phaseT >= this.spinAoeDur) {
      this.finishAttackToRest();
    }
  }

  private updateProjectile(dt: number): void {
    this.phaseT += dt;
    const u = Math.min(1, this.phaseT / this.projectileDur);
    // 0..0.58 outbound spline, 0.58..1 return spline
    const outbound = u < 0.58;
    const su = outbound
      ? easeOutCubic(u / 0.58)
      : easeInOutCubic((u - 0.58) / 0.42);

    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      const curve = outbound ? this.outCurves[i] : this.retCurves[i];
      if (!curve) continue;
      const pt = curve.getPoint(su);
      const tan = curve.getTangent(su).normalize();
      g.position.lerp(pt, 0.55);
      // Orient blade long-axis along path tangent (IK heading)
      this.orientAlong(g, tan, outbound ? 14 : 10, i);
    }

    if (!this.projectileHit && outbound && su > 0.88) {
      this.projectileHit = true;
      const hit = this.targetWorld.clone();
      this.cbs.onHit?.(hit, "projectile");
    }
    if (u >= 1) {
      this.projectileUuid = null;
      this.finishAttackToRest(true);
    }
  }

  private updateReturn(dt: number): void {
    this.phaseT += dt;
    const u = Math.min(1, this.phaseT / this.returnDur);
    const e = easeOutCubic(u);
    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      const target = this.putAway
        ? this.sheathLocalPos(i)
        : this.handLocalPos(i);
      g.position.lerp(target, 0.25 + e * 0.55);
      if (this.putAway) {
        const euler = this.sheathEuler(i);
        g.rotation.x += (euler.x - g.rotation.x) * 0.3;
        g.rotation.y += (euler.y - g.rotation.y) * 0.3;
        g.rotation.z += (euler.z - g.rotation.z) * 0.3;
      } else {
        this.applyHandGripRotation(g, i, 0.35);
      }
    }
    if (u >= 1) {
      this.mode = this.putAway ? "sheathed" : "drawn";
      if (this.putAway) this.applySheathedPose(true);
      else this.applyHandPose(true);
    }
  }

  private finishAttackToRest(snapHands = false): void {
    if (this.putAway) {
      this.mode = "sheathed";
      this.applySheathedPose(snapHands);
    } else {
      // Return into hand bones explicitly
      this.mode = "return";
      this.phaseT = 0;
      if (snapHands) {
        // still ease into hands for readability
      }
    }
  }

  private updateTornado(dt: number): void {
    this.phaseT += dt;
    if (this.phaseT < this.tornadoSpinDur) {
      this.applyOrbitPose(14 + this.phaseT * 8, 1.35);
      return;
    }
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
    if (after >= this.tornadoStagger * (this.swords.length - 1) + 0.35) {
      for (const g of this.swords) g.visible = true;
      this.finishAttackToRest(true);
    }
  }

  swordWorldPos(i: number): THREE.Vector3 {
    const g = this.swords[i];
    if (!g) return this.host?.position.clone() ?? new THREE.Vector3();
    const wp = new THREE.Vector3();
    g.getWorldPosition(wp);
    return wp;
  }

  /** Better X-cross on upper back when put away. */
  private applySheathedPose(instant: boolean): void {
    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      g.visible = true;
      const targetPos = this.sheathLocalPos(i);
      const targetEuler = this.sheathEuler(i);
      if (instant) {
        g.position.copy(targetPos);
        g.rotation.copy(targetEuler);
      } else {
        g.position.lerp(targetPos, 0.2);
        g.rotation.x += (targetEuler.x - g.rotation.x) * 0.2;
        g.rotation.y += (targetEuler.y - g.rotation.y) * 0.2;
        g.rotation.z += (targetEuler.z - g.rotation.z) * 0.2;
      }
    }
    // Spine-follow: keep X anchored to upper back bone
    if (this.spine && this.host) {
      const wp = new THREE.Vector3();
      this.spine.getWorldPosition(wp);
      const local = this.host.worldToLocal(wp.clone());
      for (let i = 0; i < this.swords.length; i++) {
        const g = this.swords[i]!;
        const side = i === 0 ? -1 : 1;
        g.position.x = THREE.MathUtils.lerp(
          g.position.x,
          local.x + side * 0.14,
          0.12,
        );
        g.position.y = THREE.MathUtils.lerp(g.position.y, local.y + 0.22, 0.12);
        g.position.z = THREE.MathUtils.lerp(
          g.position.z,
          local.z - 0.22,
          0.12,
        );
      }
    }
  }

  private sheathLocalPos(i: number): THREE.Vector3 {
    const side = i === 0 ? -1 : 1;
    // Higher, tighter X on scapulae — clear of neck
    return new THREE.Vector3(side * 0.14, 1.38, -0.28);
  }

  private sheathEuler(i: number): THREE.Euler {
    const side = i === 0 ? -1 : 1;
    // Pronounced X: tips up-out, hilts toward spine
    return new THREE.Euler(
      -0.55,
      side * 0.72,
      side * (Math.PI * 0.52 + 0.35),
      "YXZ",
    );
  }

  /** Swords in hand bones (drawn rest). */
  private applyHandPose(instant: boolean): void {
    for (let i = 0; i < this.swords.length; i++) {
      const g = this.swords[i]!;
      g.visible = true;
      const target = this.handLocalPos(i);
      // Tiny living float while moving
      if (this.moving) {
        target.y += Math.sin(this.t * 3.2 + i) * 0.02;
      }
      if (instant) g.position.copy(target);
      else g.position.lerp(target, 0.32);
      this.applyHandGripRotation(g, i, instant ? 1 : 0.28);
    }
  }

  private handLocalPos(i: number): THREE.Vector3 {
    const hand = i === 0 ? this.handL : this.handR;
    if (hand && this.host) {
      const wp = new THREE.Vector3();
      hand.updateWorldMatrix(true, false);
      hand.getWorldPosition(wp);
      const local = this.host.worldToLocal(wp.clone());
      // Grip offset: slightly forward/down from palm
      const side = i === 0 ? -1 : 1;
      local.x += side * 0.02;
      local.y -= 0.04;
      local.z += 0.06;
      return local;
    }
    // Fallback: approximate hand height in front of body
    const side = i === 0 ? -1 : 1;
    return new THREE.Vector3(side * 0.32, 1.05, 0.22);
  }

  private applyHandGripRotation(g: THREE.Group, i: number, alpha: number): void {
    const hand = i === 0 ? this.handL : this.handR;
    if (hand && this.host) {
      hand.updateWorldMatrix(true, false);
      const qWorld = new THREE.Quaternion();
      hand.getWorldQuaternion(qWorld);
      const qHost = new THREE.Quaternion();
      this.host.getWorldQuaternion(qHost);
      const qLocal = qHost.clone().invert().multiply(qWorld);
      // Blade tip up relative to palm
      const fix = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, i === 0 ? 0.15 : -0.15, 0, "YXZ"),
      );
      qLocal.multiply(fix);
      g.quaternion.slerp(qLocal, alpha);
      return;
    }
    const side = i === 0 ? -1 : 1;
    const e = new THREE.Euler(0.15, side * 0.2, side * 0.4, "YXZ");
    g.rotation.x += (e.x - g.rotation.x) * alpha;
    g.rotation.y += (e.y - g.rotation.y) * alpha;
    g.rotation.z += (e.z - g.rotation.z) * alpha;
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
      const tan = new THREE.Vector3(-Math.sin(ang), 0.1, Math.cos(ang));
      this.orientAlong(g, tan, speed * 0.8, i);
    }
  }

  /** Point blade along tangent; spin around axis for living feel. */
  private orientAlong(
    g: THREE.Group,
    tangent: THREE.Vector3,
    spin: number,
    i: number,
  ): void {
    const up = Math.abs(tangent.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const m = this.scratch.m;
    m.lookAt(new THREE.Vector3(0, 0, 0), tangent, up);
    const q = this.scratch.q.setFromRotationMatrix(m);
    // Blade long axis was +Y; lookAt aims -Z — twist so edge leads
    const twist = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2,
    );
    q.multiply(twist);
    const spinQ = new THREE.Quaternion().setFromAxisAngle(
      tangent.clone().normalize(),
      this.t * spin + i * 0.7,
    );
    q.multiply(spinQ);
    g.quaternion.slerp(q, 0.45);
  }

  private updateTrails(_dt: number): void {
    const show = this.isAttackFxActive() && this.attackEnergy > 0.05;
    const width = 0.14 * Math.max(0.05, this.attackEnergy);
    const alphaScale = this.attackEnergy;

    for (let s = 0; s < this.trails.length; s++) {
      const tr = this.trails[s]!;
      const g = this.swords[s];
      if (!g) continue;
      tr.mesh.visible = show;
      if (!show) {
        tr.hist.length = 0;
        continue;
      }
      const wp = new THREE.Vector3();
      g.getWorldPosition(wp);
      tr.hist.unshift(wp.clone());
      if (tr.hist.length > TRAIL_SEGS) tr.hist.length = TRAIL_SEGS;

      const segs = TRAIL_SEGS;
      const pos = tr.geo.attributes.position as THREE.BufferAttribute;
      const col = tr.geo.attributes.color as THREE.BufferAttribute;
      const up = new THREE.Vector3(0, 1, 0);
      const dir = new THREE.Vector3();
      const side = new THREE.Vector3();
      const baseCol = s === 0 ? new THREE.Color(0x3dff8a) : new THREE.Color(0xb44dff);
      const n = tr.hist.length;
      for (let i = 0; i < segs; i++) {
        const p = tr.hist[Math.min(i, Math.max(0, n - 1))] ?? wp;
        const pNext = tr.hist[Math.min(i + 1, Math.max(0, n - 1))] ?? p;
        dir.copy(p).sub(pNext);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        side.crossVectors(dir, up);
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        side.normalize();
        const taper = 1 - i / segs;
        const w = width * taper;
        const a = alphaScale * taper * taper;
        const i2 = i * 2;
        pos.setXYZ(i2, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
        pos.setXYZ(i2 + 1, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
        col.setXYZW(i2, baseCol.r, baseCol.g, baseCol.b, a);
        col.setXYZW(i2 + 1, baseCol.r, baseCol.g, baseCol.b, a * 0.7);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const tr of this.trails) {
      tr.mesh.removeFromParent();
      tr.geo.dispose();
      tr.mat.dispose();
    }
    this.trails = [];
    for (const g of this.swords) {
      disposeObject(g);
      g.removeFromParent();
    }
    this.swords = [];
    this.entities = [];
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

function findNamed(model: THREE.Object3D, names: string[]): THREE.Object3D | null {
  for (const n of names) {
    const o = model.getObjectByName(n);
    if (o) return o;
  }
  let best: THREE.Object3D | null = null;
  const re = new RegExp(names.map((n) => n.replace(/[:\s]/g, ".?")).join("|"), "i");
  model.traverse((o) => {
    if (!best && re.test(o.name)) best = o;
  });
  return best;
}

function easeOutCubic(t: number): number {
  const x = 1 - Math.min(1, Math.max(0, t));
  return 1 - x * x * x;
}
function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
