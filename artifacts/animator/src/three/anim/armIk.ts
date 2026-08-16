/**
 * Two-bone arm IK for weapon grip — same solver as foot/leg IK.
 *
 * Do not invent a second IK library. Uses {@link solveLegToTarget} (analytic
 * two-bone) on Bip001 / Mixamo arm chains. Weapon meshes stay parented to
 * R_hand_container; this solves UpperArm → Forearm → Hand (never the container).
 */
import * as THREE from "three";
import { findLegChain, solveLegToTarget, type LegChain } from "./legIk";

export type ArmChain = LegChain;

const _pole = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/**
 * Locate upper-arm → forearm → hand (excludes fingers and weapon containers).
 */
export function findArmChain(root: THREE.Object3D, side: "L" | "R"): ArmChain | null {
  const sideRe =
    side === "L" ? /(?:^|[_\s.])l(?:[_\s.]|$)|left/i : /(?:^|[_\s.])r(?:[_\s.]|$)|right/i;
  const skip = /finger|thumb|index|middle|ring|pinky|pinkie|container|socket|weapon|shield|end|nub/i;
  let upper: THREE.Object3D | null = null;
  let lower: THREE.Object3D | null = null;
  let hand: THREE.Object3D | null = null;

  root.traverse((n) => {
    if (!(n as THREE.Bone).isBone) return;
    if (skip.test(n.name)) return;
    if (!sideRe.test(n.name)) return;
    const nm = n.name;
    if (!upper && /upperarm|uparm|upper_arm/i.test(nm)) upper = n;
    else if (!lower && /forearm|lowerarm|lower_arm/i.test(nm)) lower = n;
    else if (!hand && /hand|wrist/i.test(nm) && !/fore/i.test(nm)) hand = n;
  });

  if (!upper || !lower || !hand) return null;
  return { upper, lower, foot: hand };
}

/** Reuse the tested two-bone applier (upper / lower / effector). */
export function solveArmToTarget(
  chain: ArmChain,
  target: THREE.Vector3,
  poleHint?: THREE.Vector3,
): void {
  solveLegToTarget(chain, target, poleHint);
}

/** Elbow pole: behind the character so arms bend naturally, not through the chest. */
export function armPoleHint(root: THREE.Object3D, out = _pole): THREE.Vector3 {
  root.getWorldDirection(_fwd);
  root.getWorldPosition(out);
  return out.addScaledVector(_fwd, -1.2);
}

/** Available for tests — same bone finder family as {@link findLegChain}. */
export const _findLegChain = findLegChain;
