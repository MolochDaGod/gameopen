/**
 * Hellfire chain — ranged-melee projectile that **extends a weapon mesh**
 * (procedural chain links) along the aim path, dressed in flame-aura energy
 * shaders (same family as Getsuga / fireAura).
 *
 * Learned from Ghost Rider PS2: chain length is Bone19–24 tip travel, not scale.
 * Runtime: grow chain length 0→range, tip is the damage probe, then dissipate
 * quickly on land/hit and apply damage via onHit / onPathTick.
 */
import * as THREE from "three";
import { createSlashEnergyMaterial } from "./auraShaders";
import type { AuraPattern } from "./auraShaders";
import {
  slashVariant,
  type SlashVariantId,
} from "./slashProjectileVariants";
import type { HellfireChainPath } from "./hellfireChainPath";

/** Flame color kit for chain projectiles (maps to slashred/blue/purple/yellow). */
export type ChainFlameId = SlashVariantId;

export interface ChainProjectileOpts {
  /** Max extension length (m). Default 6. */
  range?: number;
  /** Seconds to fully extend. Default 0.22. */
  extendTime?: number;
  /** Hold fully extended before retract/dissipate. Default 0.12. */
  holdTime?: number;
  /** Fast fade after hit or full flight. Default 0.28. */
  dissipateTime?: number;
  /** Tip contact radius for path damage ticks. */
  contactRadius?: number;
  /** Damage ticks while extending / flying. */
  tickEvery?: number;
  color?: number;
  variant?: ChainFlameId | string;
  /** Optional GR path samples — shapes extension curve (z as length fraction). */
  path?: HellfireChainPath | null;
  /** Number of chain link spheres + tube segments. */
  links?: number;
  /** Chain thickness (m). */
  thickness?: number;
  /** Called every tickEvery with tip world pos + radius (for damage probes). */
  onPathTick?: (tip: THREE.Vector3, radius: number) => void;
  /** Called once on land / max range / first solid hit request. */
  onHit?: (tip: THREE.Vector3, damageScale: number) => void;
  /** Optional aim point (homing mild). */
  aim?: THREE.Vector3 | null;
}

export interface ChainProjectileSpawn {
  root: THREE.Group;
  life: number;
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
  update: (age: number, dt: number) => void;
  /** Force early land (hit registered externally). */
  forceLand: () => void;
}

/** Production flame kits — same mid/core/edge language as slash projectiles. */
export function chainFlameKit(variant?: string | null, color?: number) {
  const id = (variant && slashVariant(variant).id) ||
    (color != null
      ? (["slashred", "slashblue", "slashpurple", "slashyellow"] as const)[
          Math.abs(Math.floor(color)) % 4
        ]
      : "slashred");
  const v = slashVariant(id);
  return {
    id: v.id as ChainFlameId,
    core: v.core,
    mid: v.mid,
    edge: v.edge,
    dark: v.dark,
    pattern: v.pattern as AuraPattern,
    color: color ?? v.mid,
  };
}

/**
 * Build extension fractions 0..1 over time from GR path samples (tip |z| growth).
 * Falls back to ease-out cubic if path is thin.
 */
export function extensionCurveFromPath(
  path: HellfireChainPath | null | undefined,
): (u: number) => number {
  const samples = path?.pathSamples;
  if (!samples || samples.length < 3) {
    return (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 2.2);
  }
  let maxZ = 0;
  for (const s of samples) maxZ = Math.max(maxZ, Math.abs(s.z), Math.abs(s.x));
  if (maxZ < 1e-4) {
    return (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 2.2);
  }
  const t0 = samples[0]!.t;
  const t1 = samples[samples.length - 1]!.t;
  const dur = Math.max(1e-3, t1 - t0);
  // Precompute length fraction vs normalized time
  const pts: { u: number; f: number }[] = samples.map((s) => {
    const len = Math.hypot(s.x, s.y, s.z);
    return { u: (s.t - t0) / dur, f: Math.min(1, len / maxZ) };
  });
  return (uRaw: number) => {
    const u = Math.min(1, Math.max(0, uRaw));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (u <= b.u || i === pts.length - 1) {
        const span = Math.max(1e-6, b.u - a.u);
        const t = (u - a.u) / span;
        return a.f + (b.f - a.f) * t;
      }
    }
    return pts[pts.length - 1]!.f;
  };
}

/**
 * Spawn a visual chain root (caller adds to scene + Effect list).
 * Extends weapon mesh along `dir`, flame-aura materials, tip damage probe.
 */
export function createHellfireChainProjectile(
  from: THREE.Vector3,
  dirIn: THREE.Vector3,
  opts: ChainProjectileOpts = {},
): ChainProjectileSpawn {
  const kit = chainFlameKit(opts.variant, opts.color);
  const range = opts.range ?? 6;
  const extendTime = opts.extendTime ?? 0.22;
  const holdTime = opts.holdTime ?? 0.12;
  const dissipateTime = opts.dissipateTime ?? 0.28;
  const contactRadius = opts.contactRadius ?? 0.55;
  const tickEvery = opts.tickEvery ?? 0.05;
  const links = Math.max(4, opts.links ?? 8);
  const thickness = opts.thickness ?? 0.055;
  const curveFn = extensionCurveFromPath(opts.path);

  const dir = dirIn.clone();
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize();
  if (opts.aim) {
    const to = opts.aim.clone().sub(from);
    to.y = 0;
    if (to.lengthSq() > 1e-4) dir.lerp(to.normalize(), 0.65).normalize();
  }

  const origin = from.clone();
  origin.y = Math.max(0.95, from.y);

  const root = new THREE.Group();
  root.name = `hellfireChain:${kit.id}`;
  root.position.copy(origin);
  // Orient +Z along flight dir
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const energyMats: THREE.ShaderMaterial[] = [];

  const makeEnergy = (opacity: number, expand: number) => {
    const m = createSlashEnergyMaterial({
      core: kit.core,
      mid: kit.mid,
      edge: kit.edge,
      dark: kit.dark,
      pattern: kit.pattern,
      opacity,
      speed: 1.55,
      expand,
    });
    energyMats.push(m);
    mats.push(m);
    return m;
  };

  // Core tube — rebuilt each frame via scale.z for extension (cheap mesh extend)
  const tubeGeo = new THREE.CylinderGeometry(thickness, thickness * 0.85, 1, 8, 1, true);
  tubeGeo.rotateX(Math.PI / 2); // length along +Z
  tubeGeo.translate(0, 0, 0.5); // pivot at hand (z=0 → z=1 local)
  geos.push(tubeGeo);
  const tube = new THREE.Mesh(tubeGeo, makeEnergy(0.88, 0.03));
  tube.renderOrder = 8;
  root.add(tube);

  // Outer flame shell (slightly thicker, more transparent)
  const shellGeo = new THREE.CylinderGeometry(thickness * 1.55, thickness * 1.25, 1, 10, 1, true);
  shellGeo.rotateX(Math.PI / 2);
  shellGeo.translate(0, 0, 0.5);
  geos.push(shellGeo);
  const shell = new THREE.Mesh(shellGeo, makeEnergy(0.55, 0.06));
  shell.renderOrder = 7;
  root.add(shell);

  // Link beads along chain (read as physical chain links)
  const linkGeo = new THREE.SphereGeometry(thickness * 1.35, 8, 6);
  geos.push(linkGeo);
  const linkMat = makeEnergy(0.92, 0.02);
  const linkMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < links; i++) {
    const bead = new THREE.Mesh(linkGeo, linkMat);
    bead.renderOrder = 9;
    root.add(bead);
    linkMeshes.push(bead);
  }

  // Hot tip head (damage focus)
  const tipGeo = new THREE.SphereGeometry(thickness * 2.1, 10, 8);
  geos.push(tipGeo);
  const tipMesh = new THREE.Mesh(tipGeo, makeEnergy(0.98, 0.05));
  tipMesh.renderOrder = 10;
  root.add(tipMesh);

  const life = extendTime + holdTime + dissipateTime;
  let landed = false;
  let hitFired = false;
  let tickAcc = 0;
  const tipWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const tipAt = (len: number) => {
    tipWorld.copy(origin).addScaledVector(dir, len);
    return tipWorld;
  };

  const forceLand = () => {
    landed = true;
  };

  const fireHit = (len: number, scale: number) => {
    if (hitFired) return;
    hitFired = true;
    landed = true;
    opts.onHit?.(tipAt(len).clone(), scale);
  };

  const update = (age: number, _dt: number) => {
    const extendU = Math.min(1, age / Math.max(1e-4, extendTime));
    const shape = curveFn(extendU);
    // Grow length: mesh extension (weapon reaches out)
    let len = range * shape;
    if (landed && age > extendTime) {
      // Snap retract slightly while dissipating
      const after = age - extendTime - holdTime;
      if (after > 0) {
        const d = Math.min(1, after / dissipateTime);
        len *= 1 - d * 0.35;
      }
    } else if (age > extendTime + holdTime) {
      landed = true;
    }

    // Full extend complete → land once at tip
    if (!hitFired && extendU >= 0.98 && age >= extendTime * 0.95) {
      fireHit(len, 1);
    }

    tube.scale.set(1, 1, Math.max(0.05, len));
    shell.scale.set(1.08, 1.08, Math.max(0.05, len));

    for (let i = 0; i < linkMeshes.length; i++) {
      const bead = linkMeshes[i]!;
      const t = (i + 1) / (links + 1);
      const z = len * t;
      bead.position.set(0, 0, z);
      // Slight sine whip for life
      bead.position.x = Math.sin(age * 18 + i * 0.9) * thickness * 0.8 * (1 - t);
      bead.position.y = Math.cos(age * 14 + i * 0.7) * thickness * 0.45 * (1 - t);
      const on = z <= len + 0.02;
      bead.visible = on && len > thickness * 2;
    }
    tipMesh.position.set(0, 0, len);
    tipMesh.scale.setScalar(1.05 + 0.12 * Math.sin(age * 22));

    // Fade: hold full, then rapid dissipate
    let fade = 1;
    if (age > extendTime + holdTime) {
      fade = 1 - (age - extendTime - holdTime) / dissipateTime;
    } else if (landed && hitFired) {
      // Hit early — dissipate from now
      const dStart = Math.max(extendTime, age - 0.05);
      fade = 1 - Math.min(1, (age - dStart) / dissipateTime);
    }
    fade = Math.max(0, fade);
    const pulse = 0.88 + 0.12 * Math.sin(age * 16);
    for (const m of energyMats) {
      m.uniforms.uTime.value = age;
      m.uniforms.uFade.value = fade;
      m.uniforms.uPulse.value = pulse;
    }

    tickAcc += _dt;
    while (tickAcc >= tickEvery) {
      tickAcc -= tickEvery;
      if (fade > 0.15 && len > 0.2) {
        opts.onPathTick?.(tipAt(len).clone(), contactRadius * (0.65 + 0.35 * extendU));
      }
    }

    // End of life — ensure hit if never landed
    if (age + _dt >= life && !hitFired) {
      fireHit(len, 0.85);
    }

    tmp.copy(origin); // silence unused if any
  };

  return { root, life, geos, mats, update, forceLand };
}
