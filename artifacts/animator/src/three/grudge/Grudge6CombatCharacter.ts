/**
 * Grudge6CombatCharacter
 *
 * A fully-operational combat character using the baked grudge6 GLB mesh for
 * visuals, combined with:
 *
 *   • Procedural MM (Maneuver Motion) — forward-lunge velocity impulse during
 *     the strike phase of an attack, so hits feel connected to movement.
 *   • Weapon skill slots 1–4 mapped from `weaponSkillPacks.ts` to reach,
 *     damage, lunge speed, VFX colour, and cooldown.
 *   • Simple pose-transform states (idle bob, walk sway, attack pivot, hurt
 *     flinch, death topple) that work without skeleton animation — the baked
 *     GLB has no bones so we animate the group transforms instead.
 *   • Optional FBXLoader clip application: when full-rig animation is needed
 *     (e.g. loading the race FBX), the `loadAnimatedRig()` path handles it.
 *
 * Usage (drop-in for MimicDungeon, BrawlerScene, WarlordGenesisScene):
 *
 *   const ch = new Grudge6CombatCharacter(scene, raceIndex, weaponFamily);
 *   await ch.load();
 *   // per-frame:
 *   ch.update(dt);
 *   ch.root.position.copy(pos);
 *   ch.root.rotation.y = yaw;
 *   // combat:
 *   const { lunge } = ch.triggerSkill(slot);  // returns lunge vector
 *   ch.applyHurt(damage);
 */

import * as THREE from "three";
import { getBakedCharacter } from "./bakedRoster";
import { Vfx } from "../Vfx";
import {
  type WeaponFamily,
  type SkillPack,
  skillPackForFamily,
  skillBakedRole,
  familyFromAnimPack,
} from "./weaponSkillPacks";
import type { AnimPack } from "./anims";

// ── Constants ──────────────────────────────────────────────────────────────

const IDLE_BOB_AMP  = 0.04;   // metres
const IDLE_BOB_HZ   = 1.4;    // cycles/second
const WALK_BOB_AMP  = 0.07;
const WALK_BOB_HZ   = 2.4;
const ATTACK_TILT   = 0.22;   // radians — forward lean at peak of swing
const HURT_RECOIL   = 0.18;   // radians backward
const HURT_DUR      = 0.35;   // seconds
const DEATH_DUR     = 1.2;    // seconds (fall-over time)
const FLASH_DUR     = 0.14;   // seconds of emissive hit-flash

type CharState =
  | "loading"
  | "idle"
  | "walk"
  | "attack"
  | "hurt"
  | "dead";

export interface SkillResult {
  /** Triggered skill pack entry. */
  skill: SkillPack;
  /** Unit direction of the MM lunge (world space). */
  lungeDir: THREE.Vector3;
  /** Lunge speed in m/s (0 for ranged/magic). */
  lungeSpeed: number;
  /** Duration the lunge applies (seconds). */
  lungeDuration: number;
  /** Mixer role to play on baked grudge6 rig (attack / skill1 / overhead…). */
  bakedRole: string;
  /** Cross-fade into the skill clip. */
  blendIn: number;
  /** Apply Controller.dash for MM. */
  useDash: boolean;
  /** Projectile kind for Vfx.getsugaSlash / bolts. */
  projectile: string;
  castEffectId?: string;
  impactEffectId?: string;
}

// ── Grudge6CombatCharacter class ──────────────────────────────────────────

export class Grudge6CombatCharacter {
  /** World-space root — attach weapons, follow for camera. */
  readonly root = new THREE.Group();

  private mesh: THREE.Group | null = null;
  private pivot = new THREE.Group();   // child of root; handles tilt/bob
  private vfx: Vfx;
  private state: CharState = "loading";
  private t = 0;          // time accumulator for periodic motion
  private stateT = 0;     // time in current state

  // ── HP ────────────────────────────────────────────────────────────────────
  readonly maxHp: number;
  private _hp: number;
  get hp() { return this._hp; }
  get alive() { return this._hp > 0; }

  // ── Skill system ─────────────────────────────────────────────────────────
  private skills: readonly SkillPack[];
  private cooldowns: number[] = [0, 0, 0, 0];
  private activeSkill: SkillPack | null = null;
  private skillT = 0;

  // ── Flash ────────────────────────────────────────────────────────────────
  private flashT = 0;
  private meshMaterials: THREE.MeshStandardMaterial[] = [];

  // ── Hellfire chain projectile hit probe (ranged-melee) ───────────────────
  /** Latest chain tip world position (for external damage systems). */
  readonly lastChainTip = new THREE.Vector3();
  lastChainRadius = 0;
  lastChainDamage = 0;
  /** Optional host callback when chain lands (Studio / AI damage apply). */
  onChainHit: ((tip: THREE.Vector3, damage: number, skill: SkillPack) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    /**
     * Index into the baked roster (0–29).
     * Use `bakedIndexFor(raceId, presetId)` for precise mapping.
     */
    private rosterIndex: number,
    /**
     * Weapon family (controls which skill pack is loaded).
     * Use `familyFromAnimPack(preset.animPack)` to derive from gear preset.
     */
    weaponFamily: WeaponFamily | AnimPack = "sword",
    options: {
      maxHp?: number;
    } = {},
  ) {
    this.maxHp = options.maxHp ?? 100;
    this._hp = this.maxHp;

    // Normalise animPack string → WeaponFamily.
    const family: WeaponFamily =
      (weaponFamily as string) === "sword_shield" ? "sword"
      : (weaponFamily as string) === "2h_melee"   ? "greatsword"
      : (weaponFamily as string) === "longbow"    ? "longbow"
      : (weaponFamily as string) === "magic"      ? "magic"
      : (weaponFamily as string) === "unarmed"    ? "unarmed"
      : (weaponFamily as WeaponFamily);

    this.skills = skillPackForFamily(family);
    this.vfx = new Vfx(scene);
    this.root.add(this.pivot);
    scene.add(this.root);
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    try {
      const group = await getBakedCharacter(this.rosterIndex);
      this.mesh = group;
      this.pivot.add(group);

      // Collect materials for flash.
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            this.meshMaterials.push(mat as THREE.MeshStandardMaterial);
          }
        }
      });

      this.state = "idle";
    } catch (err) {
      console.error("[Grudge6CombatCharacter] load failed", err);
      this.state = "idle"; // continue without mesh (no-op)
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(dt: number): void {
    this.t += dt;
    this.stateT += dt;

    this.updateCooldowns(dt);
    this.updateFlash(dt);
    this.updatePose(dt);
  }

  private updateCooldowns(dt: number) {
    for (let i = 0; i < this.cooldowns.length; i++) {
      if (this.cooldowns[i]! > 0) this.cooldowns[i]! -= dt;
    }
  }

  private updateFlash(dt: number) {
    if (this.flashT <= 0) return;
    this.flashT -= dt;
    const on = this.flashT > 0;
    for (const mat of this.meshMaterials) {
      mat.emissiveIntensity = on ? 1.8 : 0;
    }
  }

  private updatePose(dt: number) {
    if (!this.mesh) return;

    switch (this.state) {
      case "idle": {
        const bob = Math.sin(this.t * IDLE_BOB_HZ * Math.PI * 2) * IDLE_BOB_AMP;
        this.pivot.position.y = bob;
        this.pivot.rotation.x = 0;
        break;
      }
      case "walk": {
        const bob = Math.sin(this.t * WALK_BOB_HZ * Math.PI * 2) * WALK_BOB_AMP;
        this.pivot.position.y = bob;
        // Slight side-sway on stride.
        this.pivot.rotation.z = Math.sin(this.t * WALK_BOB_HZ * Math.PI * 2 * 0.5) * 0.04;
        this.pivot.rotation.x = 0;
        break;
      }
      case "attack": {
        // Skill animation: tilt forward on first 40% of window, back on rest.
        const dur = this.activeSkill?.lungeDuration ?? 0.3;
        const fullDur = Math.max(0.5, dur * 2.5);
        const prog = Math.min(1, this.stateT / fullDur);
        const tilt = prog < 0.4
          ? (prog / 0.4) * ATTACK_TILT
          : ATTACK_TILT * (1 - (prog - 0.4) / 0.6);
        this.pivot.rotation.x = -tilt;
        this.pivot.position.y = 0;
        if (prog >= 1) this.transitionTo("idle");
        break;
      }
      case "hurt": {
        const prog = Math.min(1, this.stateT / HURT_DUR);
        // Rock backward then recover.
        const angle = prog < 0.5
          ? (prog / 0.5) * HURT_RECOIL
          : HURT_RECOIL * (1 - (prog - 0.5) / 0.5);
        this.pivot.rotation.x = angle;
        if (prog >= 1) this.transitionTo("idle");
        break;
      }
      case "dead": {
        // Topple sideways.
        const prog = Math.min(1, this.stateT / DEATH_DUR);
        this.pivot.rotation.z = -(prog * Math.PI / 2);
        this.pivot.position.y = -prog * 0.6;
        break;
      }
    }
  }

  private transitionTo(next: CharState) {
    this.state = next;
    this.stateT = 0;
    if (next !== "attack") {
      this.activeSkill = null;
      this.skillT = 0;
    }
  }

  // ── Combat API ────────────────────────────────────────────────────────────

  /**
   * Fire skill for hotbar slot (1–4). Applies MM lunge, VFX, cooldown.
   * Returns null if on cooldown, dead, or already attacking.
   */
  triggerSkill(slot: 1 | 2 | 3 | 4): SkillResult | null {
    if (!this.alive || this.state === "attack" || this.state === "dead") return null;

    const skill = this.skills.find((s) => s.slot === slot);
    if (!skill) return null;

    const cdIdx = slot - 1;
    if ((this.cooldowns[cdIdx] ?? 0) > 0) return null;

    this.cooldowns[cdIdx] = skill.cooldown;
    this.activeSkill = skill;
    this.transitionTo("attack");

    // VFX at weapon reach — samurai 2H uses Getsuga / slash waves + arc.
    const dir = new THREE.Vector3(
      Math.sin(this.root.rotation.y),
      0,
      Math.cos(this.root.rotation.y),
    ).normalize();
    const origin = this.root.position.clone().add(new THREE.Vector3(0, 1.15, 0));
    const impactPos = origin.clone().addScaledVector(dir, skill.reach * 0.75);
    const scale = 0.55 + skill.damage / 90;
    const kind = skill.effectKind ?? "impact";
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir,
    );

    try {
      if (kind === "chain" || skill.projectile === "hellfire_chain") {
        // Ranged-melee: extending hellfire chain weapon mesh + flame aura
        const from = this.root.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const hand = this.findHandWorld();
        if (hand) from.copy(hand);
        this.vfx.hellfireChain(from, dir, {
          range: Math.max(4, skill.reach),
          color: skill.vfxColor,
          variant: skill.slashVariant ?? "slashred",
          chainPathRole: skill.chainPathRole ?? skill.bakedRole ?? "chain_throw",
          damage: skill.damage,
          extendTime: 0.18 + skill.reach * 0.02,
          holdTime: 0.1,
          dissipateTime: 0.26,
          contactRadius: 0.55 + skill.damage * 0.004,
          onPathTick: (tip, radius) => {
            // Lightweight trail damage read for AI / hit probes
            this.lastChainTip?.copy(tip);
            this.lastChainRadius = radius;
            this.lastChainDamage = skill.damage * 0.35;
          },
          onHit: (tip, dmgScale) => {
            this.lastChainTip?.copy(tip);
            this.lastChainRadius = 0.9;
            this.lastChainDamage = skill.damage * dmgScale;
            this.onChainHit?.(tip, skill.damage * dmgScale, skill);
          },
        });
      } else if (kind === "getsuga" || kind === "slashWave") {
        this.vfx.slashWave(origin, dir, {
          speed: 14 + skill.lungeSpeed * 0.4,
          range: Math.max(6, skill.reach * 2.2),
          color: skill.vfxColor,
          variant: skill.slashVariant ?? "slashred",
          contactRadius: 0.95,
          followDuration: 0.08,
          onHit: (p) => this.vfx.impact(p, skill.vfxColor, scale * 1.1),
        });
        this.vfx.slashArc(impactPos, quat, skill.vfxColor);
      } else if (kind === "nova" || kind === "slam") {
        this.vfx.aoeBlast(impactPos.clone().setY(0.35), skill.vfxColor, 2.0 + skill.reach * 0.25);
        this.vfx.impact(impactPos, skill.vfxColor, scale * 1.3);
      } else if (kind === "slash") {
        this.vfx.slashArc(impactPos, quat, skill.vfxColor);
        this.vfx.impact(impactPos, skill.vfxColor, scale);
      } else {
        this.vfx.impact(impactPos, skill.vfxColor, scale);
      }
    } catch (e) {
      console.warn("[Grudge6CombatCharacter] skill VFX failed", e);
      this.vfx.impact(impactPos, skill.vfxColor, scale);
    }

    // Traveling slash / bolt projectiles (Getsuga family) when skill asks for them.
    const proj = skill.projectile ?? "none";
    if (proj === "slash_wave" || proj === "bolt" || proj === "arrow") {
      const from = this.root.position.clone().add(new THREE.Vector3(0, 1.05, 0));
      try {
        if (typeof (this.vfx as { getsugaSlash?: Function }).getsugaSlash === "function") {
          (this.vfx as { getsugaSlash: Function }).getsugaSlash(from, dir, {
            tint: proj === "slash_wave" ? "blue" : undefined,
            speed: proj === "arrow" ? 28 : 15,
            range: skill.reach,
            color: skill.vfxColor,
          });
        } else if (typeof (this.vfx as { slashWave?: Function }).slashWave === "function") {
          (this.vfx as { slashWave: Function }).slashWave(from, dir, {
            speed: 15,
            range: skill.reach,
            color: skill.vfxColor,
          });
        }
      } catch {
        /* Vfx host may not implement Getsuga yet */
      }
    }

    return {
      skill,
      lungeDir: dir,
      lungeSpeed: skill.lungeSpeed,
      lungeDuration: skill.lungeDuration,
      bakedRole: skillBakedRole(skill),
      blendIn: skill.blendIn ?? 0.1,
      useDash: skill.useDash ?? skill.lungeSpeed > 0.5,
      projectile: proj,
      castEffectId: skill.castEffectId,
      impactEffectId: skill.impactEffectId,
    };
  }

  /**
   * Shorthand: trigger the primary (slot 1) attack.
   */
  triggerPrimaryAttack(): SkillResult | null {
    return this.triggerSkill(1);
  }

  /** Prefer R hand bone world position for chain muzzle; else chest height. */
  private findHandWorld(): THREE.Vector3 | null {
    if (!this.mesh) return null;
    let hand: THREE.Object3D | null = null;
    this.mesh.traverse((o) => {
      if (hand) return;
      const n = o.name.replace(/_/g, " ");
      if (/Bip001 R Hand|mixamorigRightHand|RightHand/i.test(n)) hand = o;
    });
    if (!hand) return null;
    const p = new THREE.Vector3();
    (hand as THREE.Object3D).getWorldPosition(p);
    return p;
  }

  /**
   * Apply damage and transition to hurt/dead state.
   * Returns remaining HP.
   */
  applyHurt(damage: number): number {
    if (!this.alive) return 0;
    this._hp = Math.max(0, this._hp - damage);
    // Hit flash.
    this.flashT = FLASH_DUR;
    for (const mat of this.meshMaterials) {
      mat.emissive.setHex(0xff2020);
    }
    if (this._hp <= 0) {
      this.transitionTo("dead");
    } else {
      this.transitionTo("hurt");
    }
    return this._hp;
  }

  /**
   * Activate walk state (call every frame the character is moving; revert to
   * idle() when stopped).
   */
  setWalking(on: boolean): void {
    if (!this.alive) return;
    if (on && this.state === "idle") this.transitionTo("walk");
    if (!on && this.state === "walk") this.transitionTo("idle");
  }

  /** True while actively triggering a skill. */
  get isAttacking(): boolean { return this.state === "attack"; }

  /** True once HP has dropped to 0 and the death animation is playing. */
  get isDead(): boolean { return this.state === "dead"; }

  /** Cooldown remaining for a given slot (seconds). */
  slotCooldown(slot: 1 | 2 | 3 | 4): number {
    return Math.max(0, this.cooldowns[slot - 1] ?? 0);
  }

  /** All four slots' cooldowns (for HUD). */
  get allCooldowns(): [number, number, number, number] {
    return [
      this.cooldowns[0] ?? 0,
      this.cooldowns[1] ?? 0,
      this.cooldowns[2] ?? 0,
      this.cooldowns[3] ?? 0,
    ];
  }

  /** The loaded skill pack (for HUD label / icon). */
  get skillPack(): readonly SkillPack[] { return this.skills; }

  // ── Respawn ───────────────────────────────────────────────────────────────

  respawn(): void {
    this._hp = this.maxHp;
    this.cooldowns.fill(0);
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    this.flashT = 0;
    for (const mat of this.meshMaterials) {
      mat.emissiveIntensity = 0;
    }
    this.transitionTo("idle");
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    this.state = "loading";
    this.mesh = null;
    this.meshMaterials = [];
    this.root.removeFromParent();
    this.pivot.clear();
    this.root.clear();
  }
}

// ── Factory helpers ───────────────────────────────────────────────────────

/**
 * Create an animated combat character from a race index + animPack string.
 * Convenience wrapper that avoids calling familyFromAnimPack at the callsite.
 */
export function createCombatCharacter(
  scene: THREE.Scene,
  rosterIndex: number,
  animPack: AnimPack,
  maxHp = 100,
): Grudge6CombatCharacter {
  const family = familyFromAnimPack(animPack);
  return new Grudge6CombatCharacter(scene, rosterIndex, family, { maxHp });
}
