/**
 * Two-hand grip assist for spear / 2H weapons on grudge6 kits.
 *
 * Polearm / Madarame anims already drive both arms via Bip001 rotation tracks.
 * This helper is a light **post-mixer** correction so the off-hand stays near the
 * weapon shaft when the arsenal mesh is parented only to the main hand socket
 * (common for Open arsenal attach).
 *
 * Not full CCD IK — a damped look-at blend of the left forearm toward a grip
 * point on the weapon. Safe no-op when bones/weapon missing.
 */
import * as THREE from "three";
import { findHandBone } from "./skeleton";

export type TwoHandGripOpts = {
  /** 0 = off, 1 = full blend toward grip point. */
  strength?: number;
  /** Metres along weapon local +Y (or forward) from main-hand origin. */
  gripAlong?: number;
  /** Only apply while attacking / skill one-shot. */
  onlyWhileAttacking?: boolean;
};

const _gripWorld = new THREE.Vector3();
const _handWorld = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export class TwoHandGrip {
  enabled = true;
  strength = 0.55;
  gripAlong = 0.35;
  onlyWhileAttacking = false;

  private model: THREE.Object3D | null = null;
  private leftHand: THREE.Object3D | null = null;
  private leftForearm: THREE.Object3D | null = null;
  private weapon: THREE.Object3D | null = null;
  private attacking = false;

  bind(model: THREE.Object3D, weapon?: THREE.Object3D | null): void {
    this.model = model;
    this.leftHand = findHandBone(model, "L");
    this.leftForearm = this.findForearm(model, "L");
    this.weapon = weapon ?? null;
  }

  setWeapon(weapon: THREE.Object3D | null): void {
    this.weapon = weapon;
  }

  setAttacking(on: boolean): void {
    this.attacking = on;
  }

  private findForearm(root: THREE.Object3D, side: "L" | "R"): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    const re =
      side === "L"
        ? /bip001.*l.*forearm|leftforearm|left_forearm/i
        : /bip001.*r.*forearm|rightforearm|right_forearm/i;
    root.traverse((n) => {
      if (found) return;
      if ((n as THREE.Bone).isBone && re.test(n.name)) found = n;
    });
    return found;
  }

  /**
   * Call after mixer.update each frame. Blends left hand toward a point on the
   * weapon so 2H / spear shafts read as gripped.
   */
  apply(dt: number, opts?: TwoHandGripOpts): void {
    if (!this.enabled || !this.leftHand) return;
    if (opts?.onlyWhileAttacking ?? this.onlyWhileAttacking) {
      if (!this.attacking) return;
    }
    const weapon = this.weapon;
    if (!weapon) return;

    const strength = opts?.strength ?? this.strength;
    if (strength <= 0.01) return;
    const along = opts?.gripAlong ?? this.gripAlong;

    weapon.updateWorldMatrix(true, false);
    // Grip point: weapon origin + along local Y (common shaft axis for arsenal GLBs)
    _gripWorld.set(0, along, 0).applyMatrix4(weapon.matrixWorld);
    this.leftHand.updateWorldMatrix(true, false);
    this.leftHand.getWorldPosition(_handWorld);

    _dir.subVectors(_gripWorld, _handWorld);
    if (_dir.lengthSq() < 1e-8) return;
    _dir.normalize();

    // Desired hand orientation: +Y toward grip direction (approx)
    _q.setFromUnitVectors(_up, _dir);
    // Convert desired world rot into parent-local if we have a forearm parent
    const target = this.leftForearm || this.leftHand;
    const parent = target.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.getWorldQuaternion(_q2);
      _q2.invert();
      _q.premultiply(_q2);
    }

    // Damped slerp so idle locomotion isn't yanked
    const t = 1 - Math.exp(-10 * Math.max(0.001, dt));
    target.quaternion.slerp(_q, strength * t);
  }
}

/** True when arsenal weapon id should use two-hand grip assist. */
export function wantsTwoHandGrip(weaponId: string | null | undefined): boolean {
  const w = String(weaponId || "").toLowerCase();
  return (
    w === "spear" ||
    w === "greatsword" ||
    w === "greataxe" ||
    w === "hammer2h" ||
    w === "halberd" ||
    w === "lance" ||
    w === "javelin"
  );
}
