/**
 * Two-hand grip assist for spear / 2H / bow / staff on grudge6 kits.
 *
 * Post-mixer two-bone arm IK ({@link solveArmToTarget} / same math as foot IK).
 * Weapon stays on R_hand_container; IK solves Bip001 hand bones only.
 * Safe no-op when the arm chain or grip target is missing.
 */
import * as THREE from "three";
import { armPoleHint, findArmChain, solveArmToTarget, type ArmChain } from "../anim/armIk";
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
const _pole = new THREE.Vector3();

export class TwoHandGrip {
  enabled = true;
  strength = 0.55;
  gripAlong = 0.35;
  onlyWhileAttacking = false;

  private model: THREE.Object3D | null = null;
  private leftArm: ArmChain | null = null;
  private rightHand: THREE.Object3D | null = null;
  private weapon: THREE.Object3D | null = null;
  private attacking = false;

  bind(model: THREE.Object3D, weapon?: THREE.Object3D | null): void {
    this.model = model;
    this.leftArm = findArmChain(model, "L");
    this.rightHand = findHandBone(model, "R");
    this.weapon = weapon ?? null;
  }

  setWeapon(weapon: THREE.Object3D | null): void {
    this.weapon = weapon;
  }

  setAttacking(on: boolean): void {
    this.attacking = on;
  }

  /**
   * Call after mixer.update each frame. Two-bone IK pulls the left hand to a
   * shaft point on the weapon (or 0.35 m along the right-hand bone if no mesh).
   */
  apply(dt: number, opts?: TwoHandGripOpts): void {
    if (!this.enabled || !this.leftArm || !this.model) return;
    if (opts?.onlyWhileAttacking ?? this.onlyWhileAttacking) {
      if (!this.attacking) return;
    }
    const strength = opts?.strength ?? this.strength;
    if (strength <= 0.01) return;
    const along = opts?.gripAlong ?? this.gripAlong;

    const weapon = this.weapon;
    if (weapon) {
      weapon.updateWorldMatrix(true, false);
      _gripWorld.set(0, along, 0).applyMatrix4(weapon.matrixWorld);
    } else if (this.rightHand) {
      this.rightHand.updateWorldMatrix(true, false);
      _gripWorld.set(0, along, 0).applyMatrix4(this.rightHand.matrixWorld);
    } else {
      return;
    }

    armPoleHint(this.model, _pole);
    solveArmToTarget(this.leftArm, _gripWorld, _pole);
    void dt;
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
    w === "javelin" ||
    w === "bow" ||
    w === "longbow" ||
    w === "staff" ||
    w.startsWith("staff")
  );
}
