/**
 * Directional projectile awareness — aim, arc, and orientation math.
 *
 * Used by imperative Open Vfx (Getsuga / orbs / bolts) and as the SSOT for
 * R3F hooks that mirror the same basis (no React import here — pure three).
 *
 * Slash / Getsuga rule of thumb:
 *  - Mesh AABB often has one thin axis (the "flat" of the ribbon) and one long
 *    axis (the spine of the bow/crescent).
 *  - **faceOn** (default, anime Getsuga): thin axis → travel so the *curve*
 *    faces the target (not the flat board-side flying past).
 *  - **edgeLead**: long axis → travel for spears/javelins.
 */
import * as THREE from "three";

export type FaceMode = "faceOn" | "edgeLead" | "lookAt";

export interface AimDirOpts {
  /** Prefer this world point (hostile torso) over free aim dir. */
  aim?: THREE.Vector3 | null;
  /** Clamp pitch toward elevated targets (rad). Default ±0.4. */
  maxPitch?: number;
  minPitch?: number;
  /** Flatten Y somewhat for ground-skimming slashes. */
  flatten?: number;
}

export interface ArcPathOpts {
  /** Peak height as fraction of horizontal distance (default 0.18). */
  heightFrac?: number;
  /** Absolute min/max arc height (m). */
  minHeight?: number;
  maxHeight?: number;
  /**
   * Lateral sway (m) for a slight S-curve so the slash doesn't fly as a boring
   * straight board. 0 = pure vertical arc.
   */
  lateral?: number;
  /** Seed for deterministic lateral sign (−1 | +1). */
  lane?: number;
}

export interface OrientOpts {
  /**
   * faceOn  — thin mesh axis along travel (crescent face reads toward target)
   * edgeLead — long mesh axis along travel (spear / bolt)
   * lookAt  — classic Object3D.lookAt (model −Z toward travel)
   */
  faceMode?: FaceMode;
  /**
   * Optional pre-measured local unit axes of the *template* mesh after SI
   * normalize (in template local space). If omitted, uses identity basis and
   * only applies faceMode rotation convention for crescents.
   */
  localThin?: THREE.Vector3;
  localLong?: THREE.Vector3;
  localMid?: THREE.Vector3;
  /** Extra local euler (rad) applied before world basis (mesh authoring fix). */
  localEuler?: THREE.Euler;
  /** World up preference. */
  up?: THREE.Vector3;
}

const _f = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qLocal = new THREE.Quaternion();
const _eul = new THREE.Euler();

/** Resolve flight direction toward optional aim with mild pitch clamp. */
export function resolveAimDir(
  from: THREE.Vector3,
  dir: THREE.Vector3,
  opts?: AimDirOpts,
): THREE.Vector3 {
  const out = opts?.aim ? opts.aim.clone().sub(from) : dir.clone();
  if (out.lengthSq() < 1e-8) out.copy(dir);
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1);

  const flat = Math.hypot(out.x, out.z);
  if (flat > 1e-4) {
    const pitch = Math.atan2(out.y, flat);
    const minP = opts?.minPitch ?? -0.4;
    const maxP = opts?.maxPitch ?? 0.35;
    let cPitch = THREE.MathUtils.clamp(pitch, minP, maxP);
    if (opts?.flatten != null) cPitch *= 1 - THREE.MathUtils.clamp(opts.flatten, 0, 1);
    const cos = Math.cos(cPitch);
    out.set((out.x / flat) * cos, Math.sin(cPitch), (out.z / flat) * cos);
  }
  return out.normalize();
}

/**
 * Quadratic Bézier control point for an arcing slash/projectile toward `to`.
 * Lateral offset uses lane so multi-slash fans don't stack.
 */
export function arcControlPoint(
  from: THREE.Vector3,
  to: THREE.Vector3,
  opts?: ArcPathOpts,
): THREE.Vector3 {
  const mid = from.clone().lerp(to, 0.5);
  const dist = from.distanceTo(to);
  const hFrac = opts?.heightFrac ?? 0.18;
  const minH = opts?.minHeight ?? 0.35;
  const maxH = opts?.maxHeight ?? 3.2;
  mid.y += THREE.MathUtils.clamp(dist * hFrac, minH, maxH);

  const lateral = opts?.lateral ?? 0;
  if (lateral !== 0) {
    const travel = _tmp.copy(to).sub(from);
    travel.y = 0;
    if (travel.lengthSq() > 1e-8) {
      travel.normalize();
      const side = _right.set(-travel.z, 0, travel.x); // left of travel on XZ
      const sign = (opts?.lane ?? 0) >= 0 ? 1 : -1;
      mid.addScaledVector(side, lateral * sign);
    }
  }
  return mid;
}

/** Build a quadratic arc curve from → control → to. */
export function makeArcCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  opts?: ArcPathOpts,
): THREE.QuadraticBezierCurve3 {
  return new THREE.QuadraticBezierCurve3(
    from.clone(),
    arcControlPoint(from, to, opts),
    to.clone(),
  );
}

/**
 * World quaternion so object local +Z = travel, +Y ≈ world-up.
 * (Camera lookAt uses −Z; we use +Z-forward for projectiles.)
 */
export function basisFromTravel(
  travel: THREE.Vector3,
  upPref: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
): THREE.Quaternion {
  _f.copy(travel);
  if (_f.lengthSq() < 1e-8) _f.set(0, 0, 1);
  else _f.normalize();

  _right.crossVectors(upPref, _f);
  if (_right.lengthSq() < 1e-8) {
    // Travel ~ vertical — pick stable side
    _right.set(1, 0, 0);
  } else {
    _right.normalize();
  }
  _up.crossVectors(_f, _right).normalize();
  // X=right, Y=up, Z=forward
  _mat.makeBasis(_right, _up, _f);
  return _q.setFromRotationMatrix(_mat).clone();
}

/**
 * Orient a projectile root at `pos` flying along `travel`.
 *
 * For slashes (`faceOn`): after authoring fix, mesh local thin axis should align
 * with travel so the crescent face reads toward the target — not the flat board
 * side flying past the camera.
 */
export function orientProjectile(
  root: THREE.Object3D,
  pos: THREE.Vector3,
  travel: THREE.Vector3,
  opts?: OrientOpts,
): void {
  const mode = opts?.faceMode ?? "faceOn";
  root.position.copy(pos);

  if (mode === "lookAt") {
    const ahead = pos.clone().add(
      travel.lengthSq() > 1e-8 ? travel.clone().normalize() : new THREE.Vector3(0, 0, 1),
    );
    root.lookAt(ahead);
    if (opts?.localEuler) {
      _qLocal.setFromEuler(opts.localEuler);
      root.quaternion.multiply(_qLocal);
    }
    return;
  }

  // World basis: +Z = travel
  const worldQ = basisFromTravel(travel, opts?.up);

  // Mesh authoring correction: map thin/long axes into Z-forward / Y-up space
  if (opts?.localThin && opts?.localLong) {
    // Desired: thin → +Z (faceOn) or long → +Z (edgeLead)
    const forwardLocal = mode === "edgeLead" ? opts.localLong : opts.localThin;
    const upLocal = opts.localLong;
    // Build local→canonical rotation that maps forwardLocal→+Z, upLocal→+Y as best-effort
    const fL = forwardLocal.clone().normalize();
    let uL = upLocal.clone().normalize();
    // If long was used as forward, pick mid/thin as up preference
    if (mode === "edgeLead" && opts.localMid) uL = opts.localMid.clone().normalize();
    if (mode === "faceOn") {
      // thin → Z: use long as up if nearly ⟂
      uL = opts.localLong.clone().normalize();
    }
    // Orthonormalize
    const rL = new THREE.Vector3().crossVectors(uL, fL);
    if (rL.lengthSq() < 1e-8) rL.set(1, 0, 0);
    else rL.normalize();
    uL.crossVectors(fL, rL).normalize();
    // Matrix that takes canonical (+X,+Y,+Z) to (rL,uL,fL) in mesh space — we need inverse
    // (mesh local axes expressed in mesh space ARE rL,uL,fL if those are mesh-local).
    // We want q such that q * fL = +Z, q * uL = +Y.
    const fromBasis = new THREE.Matrix4().makeBasis(rL, uL, fL);
    const toCanonical = fromBasis.clone().invert();
    const qMesh = new THREE.Quaternion().setFromRotationMatrix(toCanonical);
    root.quaternion.copy(worldQ).multiply(qMesh);
  } else {
    // Default crescent authoring: ice-bow / slash GLBs ship long-Z, thin-Y.
    // faceOn: rotate so local +Y (thin) → world travel (+Z of basis) via fixed euler.
    // Empirically: (π/2, 0, 0) puts local Y→−Z of root; (0, π/2, π/2) was old — often flat.
    // New default faceOn: X=spine horizontal, Y=up along long after rotate.
    if (mode === "faceOn") {
      // Thin local Y → root +Z (travel): Rx(−π/2) maps +Y → +Z.
      // Optional localEuler then twists the crescent so the *belly/mid* leads
      // (bow-shot style) instead of a side-on board.
      _eul.set(-Math.PI / 2, 0, 0);
    } else {
      // edgeLead: long local Z already → root +Z; no extra
      _eul.set(0, 0, 0);
    }
    if (opts?.localEuler) {
      _eul.x += opts.localEuler.x;
      _eul.y += opts.localEuler.y;
      _eul.z += opts.localEuler.z;
    }
    _qLocal.setFromEuler(_eul);
    root.quaternion.copy(worldQ).multiply(_qLocal);
  }
}

/**
 * Measure thin / mid / long unit axes from an Object3D (template) AABB in local space.
 * Call after SI normalize on the template.
 */
export function measureMeshAxes(obj: THREE.Object3D): {
  thin: THREE.Vector3;
  mid: THREE.Vector3;
  long: THREE.Vector3;
  size: THREE.Vector3;
} {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const axes = [
    { ax: new THREE.Vector3(1, 0, 0), s: size.x },
    { ax: new THREE.Vector3(0, 1, 0), s: size.y },
    { ax: new THREE.Vector3(0, 0, 1), s: size.z },
  ].sort((a, b) => a.s - b.s);
  return {
    thin: axes[0]!.ax,
    mid: axes[1]!.ax,
    long: axes[2]!.ax,
    size,
  };
}

/**
 * Soft-home velocity toward a goal each frame (rad/s capped via lerp factor).
 * `strength` 0–1 per second scale: higher = snappier turns.
 */
export function steerToward(
  velocity: THREE.Vector3,
  from: THREE.Vector3,
  goal: THREE.Vector3,
  dt: number,
  strength = 2.2,
): void {
  const desired = goal.clone().sub(from);
  if (desired.lengthSq() < 1e-8) return;
  desired.normalize();
  const t = 1 - Math.exp(-strength * dt);
  velocity.lerp(desired, t).normalize();
}

/** Pick aim point: hostile torso if present, else along dir × range. */
export function resolveAimPoint(
  from: THREE.Vector3,
  dir: THREE.Vector3,
  range: number,
  hostile?: THREE.Vector3 | null,
  chestLift = 0.2,
): THREE.Vector3 {
  if (hostile && Number.isFinite(hostile.x)) {
    return hostile.clone().setY(hostile.y + chestLift);
  }
  const flat = dir.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-8) flat.set(0, 0, 1);
  else flat.normalize();
  return from.clone().addScaledVector(flat, range);
}
