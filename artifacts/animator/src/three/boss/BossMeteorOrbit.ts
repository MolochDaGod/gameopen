/**
 * Dual orbiting meteor shower for Shadow Flame Mantis ultimate (Nuclear Slice).
 *
 * vfxgrudge.puter.site hotkey **O** = meteor shower feel.
 * Two light meteors start opposite each other on a circle around the boss,
 * each with a warning circle. They rotate half a circle (π rad) so each ends
 * where the other began. Impacts use lightweight bolt+blast (not heavy GLB).
 */

import * as THREE from "three";
import type { Vfx } from "../Vfx";

export type MeteorOrbitOpts = {
  /** Circle radius around boss (m) */
  radius?: number;
  /** Half-orbit duration (s) — full π sweep */
  duration?: number;
  /** Warning circle radius (m) */
  warnRadius?: number;
  color?: number;
  damagePerImpact?: number;
  onImpact?: (pos: THREE.Vector3, damage: number) => void;
};

type MeteorSlot = {
  angle0: number;
  warnAge: number;
  fallen: boolean;
  impactPos: THREE.Vector3;
};

/**
 * Lightweight dual meteor orbit — call start() once, update(dt) each frame.
 */
export class BossMeteorOrbit {
  private active = false;
  private age = 0;
  private duration = 2.4;
  private radius = 7;
  private warnRadius = 2.4;
  private color = 0xff6a22;
  private damage = 28;
  private center = new THREE.Vector3();
  private slots: MeteorSlot[] = [];
  private onImpact: ((pos: THREE.Vector3, damage: number) => void) | null = null;
  private readonly tmp = new THREE.Vector3();
  private warnPulse = 0;

  constructor(private readonly vfx: Vfx | null) {}

  get running() {
    return this.active;
  }

  /**
   * Begin half-circle dual meteor shower around `bossPos`.
   * Meteor A starts at angle0, B at angle0+π; both advance by π over duration.
   */
  start(bossPos: THREE.Vector3, opts: MeteorOrbitOpts = {}) {
    this.active = true;
    this.age = 0;
    this.duration = opts.duration ?? 2.4;
    this.radius = opts.radius ?? 7;
    this.warnRadius = opts.warnRadius ?? 2.4;
    this.color = opts.color ?? 0xff6a22;
    this.damage = opts.damagePerImpact ?? 28;
    this.onImpact = opts.onImpact ?? null;
    this.center.copy(bossPos);
    this.center.y = 0;

    const a0 = Math.atan2(
      /* random orientation so pattern varies */
      Math.sin(performance.now() * 0.001),
      Math.cos(performance.now() * 0.0013),
    );
    this.slots = [
      {
        angle0: a0,
        warnAge: 0,
        fallen: false,
        impactPos: this.posAt(a0 + Math.PI),
      },
      {
        angle0: a0 + Math.PI,
        warnAge: 0,
        fallen: false,
        impactPos: this.posAt(a0 + Math.PI + Math.PI),
      },
    ];

    // Immediate warning rings at START of each arc (landing zones = end of half circle)
    for (const s of this.slots) {
      this.vfx?.auraRing?.(
        new THREE.Vector3(s.impactPos.x, 0.06, s.impactPos.z),
        this.color,
        this.warnRadius,
        this.duration + 0.15,
      );
    }
    // Soft ring at boss feet (telegraph ultimate)
    this.vfx?.auraRing?.(
      new THREE.Vector3(this.center.x, 0.05, this.center.z),
      0xff9944,
      this.radius * 0.35,
      0.9,
    );
  }

  private posAt(angle: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.center.x + Math.cos(angle) * this.radius,
      0.1,
      this.center.z + Math.sin(angle) * this.radius,
    );
  }

  /**
   * Advance orbit. Returns true while still active.
   */
  update(dt: number): boolean {
    if (!this.active) return false;
    this.age += dt;
    this.warnPulse += dt;

    const t = Math.min(1, this.age / this.duration);
    // Ease-in for arrival
    const u = t * t;

    // Pulse moving ground markers along the arc (light — not full meteors yet)
    if (this.warnPulse >= 0.28) {
      this.warnPulse = 0;
      for (const s of this.slots) {
        if (s.fallen) continue;
        const ang = s.angle0 + Math.PI * u;
        const p = this.posAt(ang);
        this.vfx?.auraRing?.(
          new THREE.Vector3(p.x, 0.05, p.z),
          this.color,
          this.warnRadius * 0.55,
          0.35,
        );
      }
    }

    // On complete: light meteor falls (bolt from sky) + blast at each impact
    if (t >= 1) {
      for (const s of this.slots) {
        if (s.fallen) continue;
        s.fallen = true;
        this.spawnLightMeteor(s.impactPos);
      }
      this.active = false;
      return false;
    }
    return true;
  }

  /** Lightweight sky-drop — bolt + blastImpact, no heavy meteor GLB. */
  private spawnLightMeteor(target: THREE.Vector3) {
    const color = this.color;
    const start = target.clone().setY(12);
    // Fast light meteor
    this.vfx?.bolt?.(
      start,
      new THREE.Vector3(0, -1, 0),
      color,
      38,
      12,
      (p) => {
        this.vfx?.blastImpact?.(p, color, 1.15, true);
        this.vfx?.shockwave?.(new THREE.Vector3(p.x, 0.05, p.z), color, this.warnRadius * 1.1, 0.55);
        this.vfx?.smokePop?.(p, color, 0.85);
        this.onImpact?.(p.clone(), this.damage);
      },
    );
    // Fallback if bolt missing: direct impact
    if (!this.vfx?.bolt) {
      this.vfx?.blastImpact?.(target, color, 1.15, true);
      this.vfx?.shockwave?.(new THREE.Vector3(target.x, 0.05, target.z), color, this.warnRadius, 0.5);
      this.onImpact?.(target.clone(), this.damage);
    }
  }

  cancel() {
    this.active = false;
  }
}
