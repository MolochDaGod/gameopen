/**
 * Third-person locomotion basis — industry TPS (Souls / Unreal / three-player-controller).
 *
 * Warlords laterality (character local after idle):
 *   +Z art-forward · +X character-right · +Y up
 *
 * Camera-relative WASD (what the player sees):
 *   W = flattened camera look (into the scene)
 *   D = camera world +X flattened (screen-right)
 *
 * Do **not** treat Three.js default camera-local −Z as walk-forward. That
 * convention is only the un-orbited PerspectiveCamera; after lookAt from behind
 * the hero, look is +Z when yaw is 0.
 */
import * as THREE from "three";

const _look = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function flattenXz(v: THREE.Vector3, out: THREE.Vector3): boolean {
  out.set(v.x, 0, v.z);
  if (out.lengthSq() < 1e-10) return false;
  out.normalize();
  return true;
}

/**
 * Sample the camera the player is looking through. Call after
 * `camera.updateMatrixWorld(true)` so lookAt/position from last frame are in
 * `matrixWorld` — a stale identity matrix looks down −Z and inverts W/A.
 */
export function tpsMoveBasis(
  camera: THREE.Camera,
  outFwd: THREE.Vector3,
  outRight: THREE.Vector3,
): void {
  camera.getWorldDirection(_look);
  if (!flattenXz(_look, outFwd)) {
    // Pitch ±90°: use camera back vector (world −Z column) flipped to XZ.
    outFwd.set(-camera.matrixWorld.elements[8], 0, -camera.matrixWorld.elements[10]);
    if (!flattenXz(outFwd, outFwd)) outFwd.set(0, 0, 1);
  }
  outRight.setFromMatrixColumn(camera.matrixWorld, 0);
  if (!flattenXz(outRight, outRight)) {
    outRight.crossVectors(outFwd, _up);
    if (!flattenXz(outRight, outRight)) outRight.set(1, 0, 0);
  }
}

/** Yaw-only fallback when no camera is mounted yet. yaw 0 → +Z, right → −X. */
export function tpsMoveBasisFromYaw(
  yaw: number,
  outFwd: THREE.Vector3,
  outRight: THREE.Vector3,
): void {
  outFwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  outRight.set(-outFwd.z, 0, outFwd.x);
}

/**
 * Wish direction. `moveZ` +1 = W (forward), `moveX` +1 = D (screen-right).
 */
export function wishFromWasd(
  fwd: THREE.Vector3,
  right: THREE.Vector3,
  moveX: number,
  moveZ: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.set(0, 0, 0);
  out.addScaledVector(fwd, moveZ);
  out.addScaledVector(right, moveX);
  return out;
}

/**
 * Project world wish onto body yaw → local laterality.
 * +z = forward, +x = right. Magnitude clamped to 1.
 */
export function bodyLocalMove(
  wishX: number,
  wishZ: number,
  bodyYaw: number,
): { x: number; z: number } {
  const mag = Math.min(1, Math.hypot(wishX, wishZ));
  if (mag < 1e-6) return { x: 0, z: 0 };
  const rel = Math.atan2(wishX, wishZ) - bodyYaw;
  return { x: Math.sin(rel) * mag, z: Math.cos(rel) * mag };
}
