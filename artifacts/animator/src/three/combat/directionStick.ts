/**
 * Sticky directional awareness SSOT for combat.
 *
 * Goal: mouse aim, character facing, weapon blade (grip→tip), and projectile
 * barrel stay coherent frame-to-frame — "things are right at mouse" and
 * "bullets leave near the barrel / tip".
 *
 * Used by Studio melee swings, ranged release, slash waves, and impact zones.
 */
import * as THREE from "three";

export type StickSample = {
  /** Horizontal aim (XZ), y usually 0. */
  aim: THREE.Vector3;
  /** Weapon edge direction grip→tip when available. */
  weapon: THREE.Vector3 | null;
  /** Spawn point for projectiles / slash (tip preferred, else hand, else body). */
  muzzle: THREE.Vector3;
  /** Impact / hit-zone centre (biased toward tip along weapon). */
  impactCenter: THREE.Vector3;
  /** Blended sticky forward used for dashes + projectile flight. */
  forward: THREE.Vector3;
};

export type StickOpts = {
  /** How strongly mouse aim pulls facing (0..1). Default 0.85. */
  aimWeight?: number;
  /** How strongly the blade edge pulls swing arc (0..1). Default 0.55. */
  weaponWeight?: number;
  /** Exponential stick rate (higher = snappier). Default 14. */
  stickRate?: number;
  /** Bias impact center along grip→tip (0=grip, 1=tip). Default 0.72. */
  tipBias?: number;
  /** Keep impact slightly above ground. Default 0.9. */
  impactLift?: number;
};

/**
 * Low-pass sticky direction: preserves last facing so micro mouse noise does not
 * flip swings mid-combo.
 */
export class DirectionStick {
  private readonly sticky = new THREE.Vector3(0, 0, 1);
  private hasSample = false;

  /** Current sticky forward (normalized XZ+Y). */
  get forward(): THREE.Vector3 {
    return this.sticky;
  }

  reset(dir?: THREE.Vector3): void {
    if (dir && dir.lengthSq() > 1e-8) {
      this.sticky.copy(dir).normalize();
      this.hasSample = true;
    } else {
      this.sticky.set(0, 0, 1);
      this.hasSample = false;
    }
  }

  /**
   * Blend aim + optional weapon edge into sticky forward.
   * `dt` in seconds; use ~0 for instant snap (first sample).
   */
  update(
    aimDir: THREE.Vector3,
    weaponDir: THREE.Vector3 | null,
    dt: number,
    opts: StickOpts = {},
  ): THREE.Vector3 {
    const aimW = opts.aimWeight ?? 0.85;
    const wepW = opts.weaponWeight ?? 0.55;
    const rate = opts.stickRate ?? 14;

    const target = new THREE.Vector3();
    const a = aimDir.clone();
    a.y = 0;
    if (a.lengthSq() < 1e-8) a.set(0, 0, 1);
    else a.normalize();

    if (weaponDir && weaponDir.lengthSq() > 1e-8) {
      const w = weaponDir.clone();
      // Prefer horizontal weapon swing for dash/projectile facing
      const wH = w.clone();
      wH.y = 0;
      if (wH.lengthSq() > 1e-6) wH.normalize();
      else wH.copy(a);
      // Mix: aim dominates for mouse feel; weapon keeps blade honest
      target.copy(a).multiplyScalar(aimW).addScaledVector(wH, wepW * (1 - aimW + 0.15));
      if (target.lengthSq() < 1e-8) target.copy(a);
      else target.normalize();
    } else {
      target.copy(a);
    }

    if (!this.hasSample || dt <= 0) {
      this.sticky.copy(target);
      this.hasSample = true;
      return this.sticky;
    }
    const alpha = 1 - Math.exp(-rate * Math.max(0, dt));
    this.sticky.lerp(target, alpha);
    if (this.sticky.lengthSq() < 1e-8) this.sticky.copy(target);
    else this.sticky.normalize();
    return this.sticky;
  }
}

/**
 * Build a full combat direction sample from body, camera aim, and mounted tip.
 */
export function sampleCombatDirection(args: {
  bodyPos: THREE.Vector3;
  /** Character facing yaw (rad) when aim is weak. */
  bodyYaw?: number;
  aimDir: THREE.Vector3;
  tipWorld?: THREE.Vector3 | null;
  gripWorld?: THREE.Vector3 | null;
  /** Fallback muzzle when no tip: body + offset along aim. */
  bodyMuzzleOffset?: number;
  opts?: StickOpts;
  /** Existing stick to update (optional). */
  stick?: DirectionStick;
  dt?: number;
}): StickSample {
  const opts = args.opts ?? {};
  const tipBias = opts.tipBias ?? 0.72;
  const lift = opts.impactLift ?? 0.9;
  const muzzleOff = args.bodyMuzzleOffset ?? 0.85;

  const aim = args.aimDir.clone();
  if (aim.lengthSq() < 1e-8) {
    const yaw = args.bodyYaw ?? 0;
    aim.set(Math.sin(yaw), 0, Math.cos(yaw));
  } else {
    aim.normalize();
  }

  let weapon: THREE.Vector3 | null = null;
  const grip = args.gripWorld?.clone() ?? null;
  const tip = args.tipWorld?.clone() ?? null;
  if (grip && tip) {
    weapon = tip.clone().sub(grip);
    if (weapon.lengthSq() < 1e-8) weapon = null;
    else weapon.normalize();
  }

  const stick = args.stick ?? new DirectionStick();
  const forward = stick.update(aim, weapon, args.dt ?? 0, opts).clone();

  // Muzzle: tip if present, else body + aim offset (ranged / unarmed)
  const muzzle = tip
    ? tip.clone()
    : args.bodyPos.clone().addScaledVector(forward, muzzleOff).setY(args.bodyPos.y + lift);

  // Impact centre: along blade toward tip so zone sits on the steel, not the hip
  let impactCenter: THREE.Vector3;
  if (grip && tip) {
    impactCenter = grip.clone().lerp(tip, tipBias);
  } else if (tip) {
    impactCenter = tip.clone();
  } else {
    impactCenter = args.bodyPos
      .clone()
      .addScaledVector(forward, muzzleOff * 0.75)
      .setY(args.bodyPos.y + lift);
  }

  return {
    aim: aim.clone(),
    weapon,
    muzzle,
    impactCenter,
    forward,
  };
}

/**
 * Melee zone of impact: sector in front of the fighter along sticky forward.
 * Returns hit centre + radius for sphere queries (matches playerHit API).
 */
export function meleeImpactZone(args: {
  sample: StickSample;
  /** Base weapon reach (m). */
  reach: number;
  /** Combo stage 0..n — later stages push zone further / wider. */
  stage?: number;
  /** Profile AoE radius from meleeStrikeFx. */
  aoeRadius?: number;
  /** Weapon group for shape. */
  group?: "melee-1h" | "melee-2h" | "polearm" | "shield" | "ranged" | string;
}): { center: THREE.Vector3; radius: number; forward: THREE.Vector3 } {
  const stage = args.stage ?? 0;
  const aoe = args.aoeRadius ?? 0;
  const grp = args.group ?? "melee-1h";
  const fwd = args.sample.forward.clone();
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
  else fwd.normalize();

  // Push hit centre along sticky forward + keep tip bias from sample
  const stagePush = 0.12 + stage * 0.08;
  let reachFrac = 0.55;
  let radiusMul = 1;
  if (grp === "melee-2h") {
    reachFrac = 0.62;
    radiusMul = 1.25;
  } else if (grp === "polearm") {
    reachFrac = 0.78;
    radiusMul = 0.85;
  } else if (grp === "shield") {
    reachFrac = 0.35;
    radiusMul = 1.15;
  }

  const center = args.sample.impactCenter
    .clone()
    .addScaledVector(fwd, args.reach * stagePush * 0.35);
  // Blend tip-biased centre with forward reach point
  const reachPt = args.sample.muzzle
    .clone()
    .addScaledVector(fwd, args.reach * reachFrac * 0.25);
  center.lerp(reachPt, 0.35);

  const baseR = Math.max(0.35, args.reach * 0.28 * radiusMul);
  const radius = baseR + aoe * 0.4 + stage * 0.06;

  return { center, radius, forward: fwd };
}

/**
 * Projectile spawn at barrel: tip + small offset along aim (not body centre).
 */
export function barrelSpawn(
  sample: StickSample,
  along = 0.12,
): { origin: THREE.Vector3; dir: THREE.Vector3 } {
  const dir = sample.forward.clone();
  if (sample.weapon) {
    // Slight blend so guns/staves that tip along barrel stay honest
    dir.lerp(sample.weapon, 0.35);
    if (dir.lengthSq() > 1e-8) dir.normalize();
  }
  const origin = sample.muzzle.clone().addScaledVector(dir, along);
  return { origin, dir };
}
