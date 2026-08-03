/**
 * Terrain ground sampler for FootGrounder + Controller feet.
 * Builds world Y + slope normals from a height field (ForestWorld heightAt).
 */
import * as THREE from "three";
import type { GroundSample, GroundSampler } from "./legIk";

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Finite-difference normal from height samples (SI metres).
 * Returns +Y when slope cannot be estimated (void / flat fallback).
 */
export function normalFromHeightField(
  heightAt: (x: number, z: number) => number | null,
  x: number,
  z: number,
  epsilon = 0.28,
): THREE.Vector3 | null {
  const y = heightAt(x, z);
  if (y == null || !Number.isFinite(y)) return null;
  const yx0 = heightAt(x - epsilon, z);
  const yx1 = heightAt(x + epsilon, z);
  const yz0 = heightAt(x, z - epsilon);
  const yz1 = heightAt(x, z + epsilon);
  if (
    yx0 == null ||
    yx1 == null ||
    yz0 == null ||
    yz1 == null ||
    !Number.isFinite(yx0) ||
    !Number.isFinite(yx1) ||
    !Number.isFinite(yz0) ||
    !Number.isFinite(yz1)
  ) {
    return UP.clone();
  }
  // Gradient → normal (unnormalized dx, 2ε, dz)
  const n = new THREE.Vector3(yx0 - yx1, 2 * epsilon, yz0 - yz1);
  if (n.lengthSq() < 1e-10) return UP.clone();
  return n.normalize();
}

/** Flat Danger Room floor (y=0, no tilt). */
export const FLAT_FOOT_SAMPLER: GroundSampler = () => ({ y: 0, normal: null });

/**
 * Foot IK sampler from outdoor height field.
 * When height is void, y is non-finite so FootGrounder leaves that foot alone.
 */
export function footSamplerFromHeightAt(
  heightAt: (x: number, z: number) => number | null,
  opts?: { epsilon?: number; withNormals?: boolean },
): GroundSampler {
  const eps = opts?.epsilon ?? 0.28;
  const withNormals = opts?.withNormals !== false;
  return (x: number, z: number): GroundSample => {
    const y = heightAt(x, z);
    if (y == null || !Number.isFinite(y)) {
      return { y: Number.NaN, normal: null };
    }
    const normal = withNormals ? normalFromHeightField(heightAt, x, z, eps) : UP.clone();
    return { y, normal };
  };
}
