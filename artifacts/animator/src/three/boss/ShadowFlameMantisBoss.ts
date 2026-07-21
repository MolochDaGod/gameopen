/**
 * Shadow Flame Mantis — volcano world boss AI + ability kit.
 *
 * Anim pack (from GLB):
 *  Idle | Walk | Run | Grabbing Munch | Rushing Charge |
 *  Flaming Upper Stab | Shadow Call | Burning Slice | Nuclear Slice
 *
 * Shadow Call: smoke column + smokePop + spawn 2 Ash Ghasts (see VolcanoGhast).
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight } from "../fitCharacterHeight";
import { groundFeetLocal } from "../characterDeploy";
import type { Vfx } from "../Vfx";
import {
  MANTIS_ABILITIES,
  MANTIS_CLIPS,
  SHADOW_FLAME_MANTIS,
  type AbilityDef,
  type BossAbilityId,
} from "./volcanoBossCatalog";
import { VolcanoGhastMinion } from "./VolcanoGhastMinion";

export type MantisBossCallbacks = {
  flash?: (msg: string, t?: number) => void;
  damagePlayer?: (amount: number, from: THREE.Vector3) => void;
  onBossDeath?: () => void;
  onShadowCall?: (ghasts: VolcanoGhastMinion[]) => void;
};

type Phase = "idle" | "chase" | "ability" | "dead";

export class ShadowFlameMantisBoss {
  readonly root = new THREE.Group();
  readonly id = "shadow_flame_mantis";
  hp: number;
  maxHp: number;
  dead = false;

  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentClip = "";
  private phase: Phase = "idle";
  private abilityCd = new Map<BossAbilityId, number>();
  private abilityTimer = 0;
  private activeAbility: AbilityDef | null = null;
  private hitDone = false;
  private thinkTimer = 0;
  private readonly speed: number;
  private readonly damage: number;
  private readonly atkReach: number;
  private readonly aggro: number;
  private readonly vfx: Vfx | null;
  private readonly cbs: MantisBossCallbacks;
  private summons: VolcanoGhastMinion[] = [];
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    vfx: Vfx | null = null,
    cbs: MantisBossCallbacks = {},
  ) {
    this.vfx = vfx;
    this.cbs = cbs;
    this.root.name = "ShadowFlameMantisBoss";
    this.maxHp = SHADOW_FLAME_MANTIS.hp;
    this.hp = this.maxHp;
    this.speed = SHADOW_FLAME_MANTIS.speed;
    this.damage = SHADOW_FLAME_MANTIS.damage;
    this.atkReach = SHADOW_FLAME_MANTIS.atkReach;
    this.aggro = SHADOW_FLAME_MANTIS.aggroRange;
    scene.add(this.root);
    for (const a of MANTIS_ABILITIES) this.abilityCd.set(a.id, 0);
  }

  get alive() {
    return !this.dead && this.hp > 0;
  }

  get position() {
    return this.root.position;
  }

  async load(x: number, y: number, z: number): Promise<boolean> {
    let gltf: Awaited<ReturnType<typeof loadGltfFirst>>;
    try {
      gltf = await loadGltfFirst(SHADOW_FLAME_MANTIS.meshKeys, sharedGltfLoader());
    } catch {
      this.cbs.flash?.("Shadow Flame Mantis mesh missing", 2);
      return false;
    }
    if (!gltf?.scene) {
      this.cbs.flash?.("Shadow Flame Mantis mesh missing", 2);
      return false;
    }
    this.model = gltf.scene;
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
      }
    });
    fitCharacterHeight(this.model, SHADOW_FLAME_MANTIS.heightM);
    groundFeetLocal(this.model, 0);
    this.root.add(this.model);
    this.root.position.set(x, y, z);

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations || []) {
      const act = this.mixer.clipAction(clip);
      act.enabled = true;
      this.actions.set(clip.name, act);
    }
    this.playLoop(MANTIS_CLIPS.idle);
    this.cbs.flash?.(`${SHADOW_FLAME_MANTIS.name} · world boss rises`, 2.2);
    return true;
  }

  takeDamage(amount: number) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.dead = true;
    this.phase = "dead";
    this.playOnce(MANTIS_CLIPS.idle); // no death clip in pack — freeze idle
    this.cbs.flash?.(`${SHADOW_FLAME_MANTIS.name} defeated`, 2.5);
    this.cbs.onBossDeath?.();
    for (const g of this.summons) g.dismiss();
    this.summons = [];
  }

  update(dt: number, playerPos: THREE.Vector3 | null) {
    if (this.dead) return;
    this.mixer?.update(dt);
    for (const [id, t] of this.abilityCd) {
      this.abilityCd.set(id, Math.max(0, t - dt));
    }
    for (const g of this.summons) g.update(dt, playerPos);
    this.summons = this.summons.filter((g) => g.alive);

    if (!playerPos) {
      this.phase = "idle";
      this.playLoop(MANTIS_CLIPS.idle);
      return;
    }

    const toPlayer = this.tmp.copy(playerPos).sub(this.root.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (this.phase === "ability" && this.activeAbility) {
      this.tickAbility(dt, playerPos, dist);
      return;
    }

    if (dist > this.aggro) {
      this.phase = "idle";
      this.playLoop(MANTIS_CLIPS.idle);
      return;
    }

    // Face player
    if (dist > 0.05) {
      const yaw = Math.atan2(toPlayer.x, toPlayer.z);
      this.root.rotation.y = yaw;
    }

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.35;
      const ab = this.pickAbility(dist);
      if (ab) {
        this.startAbility(ab, playerPos);
        return;
      }
    }

    // Chase
    this.phase = "chase";
    if (dist > this.atkReach * 0.85) {
      const step = Math.min(dist, this.speed * dt);
      this.root.position.addScaledVector(toPlayer.normalize(), step);
      this.playLoop(dist > 10 ? MANTIS_CLIPS.run : MANTIS_CLIPS.walk);
    } else {
      this.playLoop(MANTIS_CLIPS.idle);
    }
  }

  private pickAbility(dist: number): AbilityDef | null {
    const hpFrac = this.hp / this.maxHp;
    const ready = MANTIS_ABILITIES.filter((a) => (this.abilityCd.get(a.id) || 0) <= 0);
    if (!ready.length) return null;

    // Shadow Call when mid-fight and few summons
    if (this.summons.length < 2) {
      const sc = ready.find((a) => a.id === "shadowCall");
      if (sc && hpFrac < 0.92 && Math.random() < 0.35) return sc;
    }
    // Ultimate when low
    const ult = ready.find((a) => a.id === "nuclearSlice" && hpFrac <= (a.preferBelowHp ?? 1));
    if (ult && Math.random() < 0.45) return ult;

    // In range melee
    const melee = ready.filter((a) => a.range <= 6 && dist <= a.range + 0.5);
    if (melee.length) return melee[Math.floor(Math.random() * melee.length)]!;

    // Charge when mid range
    const charge = ready.find((a) => a.id === "charge" && dist > 5 && dist < 16);
    if (charge) return charge;

    return ready[Math.floor(Math.random() * ready.length)] || null;
  }

  private startAbility(ab: AbilityDef, playerPos: THREE.Vector3) {
    this.phase = "ability";
    this.activeAbility = ab;
    this.abilityTimer = 0;
    this.hitDone = false;
    this.abilityCd.set(ab.id, ab.cd);
    this.playOnce(ab.clip);
    this.cbs.flash?.(ab.telegraph, 1.1);

    if (ab.id === "charge") {
      // lunge direction locked at start
      this.tmp2.copy(playerPos).sub(this.root.position);
      this.tmp2.y = 0;
      if (this.tmp2.lengthSq() > 1e-4) this.tmp2.normalize();
    }
  }

  private tickAbility(dt: number, playerPos: THREE.Vector3, dist: number) {
    const ab = this.activeAbility!;
    this.abilityTimer += dt;

    if (ab.id === "charge" && this.abilityTimer < ab.windup + ab.active) {
      this.root.position.addScaledVector(this.tmp2, this.speed * 2.4 * dt);
    }

    // Shadow Call VFX + summons at end of windup
    if (ab.id === "shadowCall" && !this.hitDone && this.abilityTimer >= ab.windup) {
      this.hitDone = true;
      void this.executeShadowCall();
    }

    // Damage pulse
    if (
      ab.id !== "shadowCall" &&
      !this.hitDone &&
      this.abilityTimer >= ab.windup &&
      this.abilityTimer <= ab.windup + ab.active
    ) {
      if (dist <= ab.range + 0.4) {
        this.hitDone = true;
        const dmg = Math.round(this.damage * ab.damageMul);
        this.cbs.damagePlayer?.(dmg, this.root.position.clone());
        this.vfx?.smokePop?.(this.root.position.clone().setY(this.root.position.y + 1.2), 0xff6622, 1.1);
      }
    }

    const total = ab.windup + ab.active + 0.35;
    if (this.abilityTimer >= total) {
      this.phase = "chase";
      this.activeAbility = null;
      if (this.model) groundFeetLocal(this.model, 0);
    }
  }

  /** Shadow Call: dark smoke + two Ash Ghasts. */
  private async executeShadowCall() {
    const origin = this.root.position.clone();
    origin.y += 0.2;
    this.vfx?.smokeColumn?.(origin, 0x1a1020, 2.2, 2.8);
    this.vfx?.smokePop?.(origin.clone().setY(origin.y + 0.6), 0x442266, 1.8);
    this.vfx?.smokePop?.(origin.clone().setY(origin.y + 1.2), 0x110818, 1.4);

    const offsets = [
      new THREE.Vector3(4.5, 0, 2.5),
      new THREE.Vector3(-4.5, 0, 2.5),
    ];
    const spawned: VolcanoGhastMinion[] = [];
    for (const off of offsets) {
      if (this.summons.length >= 4) break;
      const g = new VolcanoGhastMinion(this.scene, this.vfx, {
        flash: this.cbs.flash,
        damagePlayer: this.cbs.damagePlayer,
      });
      const p = origin.clone().add(off);
      const ok = await g.load(p.x, p.y + 2.2, p.z);
      if (ok) {
        this.summons.push(g);
        spawned.push(g);
      }
    }
    this.cbs.flash?.(`Shadow Call · ${spawned.length} Ash Ghasts`, 1.6);
    this.cbs.onShadowCall?.(spawned);
  }

  private playLoop(name: string) {
    if (this.currentClip === name && this.phase !== "ability") return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.currentClip ? this.actions.get(this.currentClip) : null;
    next.reset().setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    if (prev && prev !== next) {
      prev.fadeOut(0.15);
      next.fadeIn(0.15);
    }
    next.play();
    this.currentClip = name;
  }

  private playOnce(name: string) {
    const next = this.actions.get(name);
    if (!next) {
      this.playLoop(MANTIS_CLIPS.idle);
      return;
    }
    const prev = this.currentClip ? this.actions.get(this.currentClip) : null;
    next.reset().setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    if (prev && prev !== next) {
      prev.fadeOut(0.1);
      next.fadeIn(0.1);
    }
    next.play();
    this.currentClip = name;
  }

  dispose() {
    for (const g of this.summons) g.dispose();
    this.summons = [];
    this.scene.remove(this.root);
    this.mixer?.stopAllAction();
  }
}
