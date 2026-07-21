/**
 * Ash Ghast — floating ranged volcano enemy / Shadow Call summon.
 * Clips: Idle | Fire
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight } from "../fitCharacterHeight";
import type { Vfx } from "../Vfx";
import { GHAST_CLIPS, VOLCANO_GHAST } from "./volcanoBossCatalog";

export type GhastCallbacks = {
  flash?: (msg: string, t?: number) => void;
  damagePlayer?: (amount: number, from: THREE.Vector3) => void;
};

export class VolcanoGhastMinion {
  readonly root = new THREE.Group();
  hp: number;
  maxHp: number;
  dead = false;

  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private fireCd = 0;
  private hoverT = Math.random() * Math.PI * 2;
  private readonly baseY: number = 2.2;
  private readonly vfx: Vfx | null;
  private readonly cbs: GhastCallbacks;
  private readonly tmp = new THREE.Vector3();
  private readonly projPool: THREE.Mesh[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    vfx: Vfx | null = null,
    cbs: GhastCallbacks = {},
  ) {
    this.vfx = vfx;
    this.cbs = cbs;
    this.root.name = "VolcanoGhast";
    this.maxHp = VOLCANO_GHAST.hp;
    this.hp = this.maxHp;
    scene.add(this.root);
  }

  get alive() {
    return !this.dead && this.hp > 0;
  }

  async load(x: number, y: number, z: number): Promise<boolean> {
    let gltf: Awaited<ReturnType<typeof loadGltfFirst>>;
    try {
      gltf = await loadGltfFirst(VOLCANO_GHAST.meshKeys, sharedGltfLoader());
    } catch {
      return false;
    }
    if (!gltf?.scene) return false;
    this.model = gltf.scene;
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
      }
    });
    fitCharacterHeight(this.model, VOLCANO_GHAST.heightM);
    this.root.add(this.model);
    this.root.position.set(x, y || this.baseY, z);

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations || []) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.play(GHAST_CLIPS.idle, true);
    return true;
  }

  takeDamage(n: number) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - n);
    if (this.hp <= 0) this.dismiss();
  }

  dismiss() {
    this.dead = true;
    this.root.visible = false;
  }

  update(dt: number, playerPos: THREE.Vector3 | null) {
    if (this.dead) return;
    this.mixer?.update(dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.hoverT += dt;
    // Bob in air
    this.root.position.y = this.baseY + Math.sin(this.hoverT * 1.7) * 0.35;

    if (!playerPos) {
      this.play(GHAST_CLIPS.idle, true);
      return;
    }

    const to = this.tmp.copy(playerPos).sub(this.root.position);
    const dist = to.length();
    to.y = 0;
    if (to.lengthSq() > 1e-4) {
      this.root.rotation.y = Math.atan2(to.x, to.z);
    }

    // Keep mid range
    if (dist < 10) {
      this.root.position.addScaledVector(to.normalize().multiplyScalar(-1), VOLCANO_GHAST.speed * 0.6 * dt);
    } else if (dist > 22) {
      this.root.position.addScaledVector(to.normalize(), VOLCANO_GHAST.speed * 0.5 * dt);
    }

    if (this.fireCd <= 0 && dist < VOLCANO_GHAST.atkReach && dist > 4) {
      this.fireCd = 2.8;
      this.play(GHAST_CLIPS.fire, false);
      this.fireProjectile(playerPos);
      // return to idle after fire
      window.setTimeout(() => {
        if (!this.dead) this.play(GHAST_CLIPS.idle, true);
      }, 900);
    }
  }

  private fireProjectile(target: THREE.Vector3) {
    const origin = this.root.position.clone();
    origin.y += 0.6;
    this.vfx?.smokePop?.(origin, 0xff8844, 0.6);
    // Simple fireball mesh
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5522 }),
    );
    ball.position.copy(origin);
    this.scene.add(ball);
    this.projPool.push(ball);

    const dir = target.clone().sub(origin).normalize();
    const speed = 18;
    const maxT = 2.2;
    let t = 0;
    const step = (dt: number) => {
      if (this.dead) {
        this.scene.remove(ball);
        return;
      }
      t += dt;
      ball.position.addScaledVector(dir, speed * dt);
      if (ball.position.distanceTo(target) < 1.2 && t > 0.08) {
        this.cbs.damagePlayer?.(VOLCANO_GHAST.damage, ball.position.clone());
        this.vfx?.smokePop?.(ball.position, 0xffaa44, 0.9);
        this.scene.remove(ball);
        return;
      }
      if (t < maxT) requestAnimationFrame((now) => {
        // approximate dt
        step(1 / 60);
      });
      else this.scene.remove(ball);
    };
    // use simple interval for dt stability
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ball.position.addScaledVector(dir, speed * dt);
      // soft track player a bit
      if (t < 1.2) {
        const steer = target.clone().sub(ball.position).normalize();
        ball.position.addScaledVector(steer, 2.5 * dt);
      }
      if (ball.position.distanceTo(target) < 1.35) {
        this.cbs.damagePlayer?.(VOLCANO_GHAST.damage, ball.position.clone());
        this.vfx?.smokePop?.(ball.position, 0xffaa44, 0.9);
        this.scene.remove(ball);
        return;
      }
      if (t < maxT) requestAnimationFrame(tick);
      else this.scene.remove(ball);
    };
    requestAnimationFrame(tick);
  }

  private play(name: string, loop: boolean) {
    const act = this.actions.get(name);
    if (!act) return;
    for (const a of this.actions.values()) {
      if (a !== act) a.fadeOut(0.12);
    }
    act.reset();
    act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    act.clampWhenFinished = !loop;
    act.fadeIn(0.12).play();
  }

  dispose() {
    for (const b of this.projPool) this.scene.remove(b);
    this.scene.remove(this.root);
    this.mixer?.stopAllAction();
  }
}
