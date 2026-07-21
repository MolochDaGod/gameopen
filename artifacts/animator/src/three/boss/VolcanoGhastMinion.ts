/**
 * Ash Ghast — floating ranged volcano enemy / Shadow Call summon.
 *
 * Fire pattern (vfxgrudge.puter.site hotkey **C** = Fireball):
 *  1. 1.5 s cast (Idle hold + cast aura)
 *  2. Fireball bolt
 *  3. 2.0 s Fireball **cone** sustained flame (flameCone pulses)
 *
 * Clips: Idle | Fire
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight } from "../fitCharacterHeight";
import type { Vfx } from "../Vfx";
import { GHAST_CLIPS, GHAST_FIRE, VOLCANO_GHAST } from "./volcanoBossCatalog";

export type GhastCallbacks = {
  flash?: (msg: string, t?: number) => void;
  damagePlayer?: (amount: number, from: THREE.Vector3) => void;
};

type FirePhase = "idle" | "cast" | "cone" | "recover";

export class VolcanoGhastMinion {
  readonly root = new THREE.Group();
  hp: number;
  maxHp: number;
  dead = false;

  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private fireCd = 0;
  private firePhase: FirePhase = "idle";
  private phaseT = 0;
  private coneTick = 0;
  private hoverT = Math.random() * Math.PI * 2;
  private readonly baseY: number = 2.2;
  private readonly vfx: Vfx | null;
  private readonly cbs: GhastCallbacks;
  private readonly tmp = new THREE.Vector3();
  private readonly face = new THREE.Vector3(0, 0, 1);
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
    this.root.position.y = this.baseY + Math.sin(this.hoverT * 1.7) * 0.35;

    if (!playerPos) {
      this.firePhase = "idle";
      this.play(GHAST_CLIPS.idle, true);
      return;
    }

    const to = this.tmp.copy(playerPos).sub(this.root.position);
    const dist = to.length();
    to.y = 0;
    if (to.lengthSq() > 1e-4) {
      this.face.copy(to).normalize();
      this.root.rotation.y = Math.atan2(to.x, to.z);
    }

    // Kite while not in cast/cone
    if (this.firePhase === "idle" || this.firePhase === "recover") {
      if (dist < 10) {
        this.root.position.addScaledVector(
          this.face.clone().multiplyScalar(-1),
          VOLCANO_GHAST.speed * 0.6 * dt,
        );
      } else if (dist > 22) {
        this.root.position.addScaledVector(this.face, VOLCANO_GHAST.speed * 0.5 * dt);
      }
    }

    // ── Fire state machine ──
    if (this.firePhase === "idle") {
      if (this.fireCd <= 0 && dist < VOLCANO_GHAST.atkReach && dist > 4) {
        this.firePhase = "cast";
        this.phaseT = 0;
        this.play(GHAST_CLIPS.fire, false);
        // Cast telegraph (vfxgrudge C — charge)
        const mouth = this.root.position.clone().setY(this.root.position.y + 0.5);
        this.vfx?.castAura?.(mouth, 0xff7a1e);
        this.vfx?.auraRing?.(
          new THREE.Vector3(this.root.position.x, 0.05, this.root.position.z),
          0xff5522,
          1.6,
          GHAST_FIRE.castSec,
        );
        this.cbs.flash?.("Ash Ghast casting…", 0.8);
      }
      return;
    }

    if (this.firePhase === "cast") {
      this.phaseT += dt;
      // Hold aim during cast
      if (this.phaseT >= GHAST_FIRE.castSec) {
        this.firePhase = "cone";
        this.phaseT = 0;
        this.coneTick = 0;
        this.launchFireball(playerPos);
        this.cbs.flash?.("Fireball!", 0.5);
      }
      return;
    }

    if (this.firePhase === "cone") {
      this.phaseT += dt;
      this.coneTick += dt;
      // Sustained cone (vfxgrudge C fireball cone feel)
      if (this.coneTick >= GHAST_FIRE.coneTickSec) {
        this.coneTick = 0;
        const origin = this.root.position.clone().setY(this.root.position.y + 0.4);
        this.vfx?.flameCone?.(origin, this.face, 0xff7a1e, GHAST_FIRE.coneRangeM);
        // Cone damage if player in front arc
        const toP = playerPos.clone().sub(this.root.position);
        toP.y = 0;
        const d = toP.length();
        if (d < GHAST_FIRE.coneRangeM && d > 0.2) {
          const dir = toP.normalize();
          const dot = dir.dot(this.face);
          if (dot > 0.55) {
            this.cbs.damagePlayer?.(
              GHAST_FIRE.coneDamagePerTick,
              this.root.position.clone(),
            );
          }
        }
      }
      if (this.phaseT >= GHAST_FIRE.coneSec) {
        this.firePhase = "recover";
        this.phaseT = 0;
        this.fireCd = GHAST_FIRE.cooldownSec;
        this.play(GHAST_CLIPS.idle, true);
      }
      return;
    }

    // recover
    this.phaseT += dt;
    if (this.phaseT >= 0.35) {
      this.firePhase = "idle";
    }
  }

  /** Single fireball after cast (light mesh + VFX trail). */
  private launchFireball(target: THREE.Vector3) {
    const origin = this.root.position.clone();
    origin.y += 0.6;
    this.vfx?.smokePop?.(origin, 0xff8844, 0.55);
    this.vfx?.muzzle?.(origin, this.face, 0xff6622);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5522 }),
    );
    ball.position.copy(origin);
    this.scene.add(ball);
    this.projPool.push(ball);

    const dir = target.clone().sub(origin).normalize();
    const speed = 16;
    const maxT = 2.0;
    let t = 0;
    let last = performance.now();
    const dmg = Math.round(VOLCANO_GHAST.damage * GHAST_FIRE.fireballDamageMul);

    const tick = (now: number) => {
      if (this.dead) {
        this.scene.remove(ball);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ball.position.addScaledVector(dir, speed * dt);
      if (t < 1.0) {
        const steer = target.clone().sub(ball.position).normalize();
        ball.position.addScaledVector(steer, 2.2 * dt);
      }
      if (ball.position.distanceTo(target) < 1.4) {
        this.cbs.damagePlayer?.(dmg, ball.position.clone());
        this.vfx?.blastImpact?.(ball.position, 0xff6a22, 0.9, false);
        this.vfx?.smokePop?.(ball.position, 0xffaa44, 0.85);
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
