/**
 * Hellfire chain path FX — Ghost Rider bake samples (no Marvel mesh).
 *
 * Source clips extend chain via Bone19–24 positions, NOT scale. Runtime:
 *  1. Load `anims/baked/ghost_rider/fx/<role>_chain_path.json`
 *  2. Transform path samples into world space from Bip001 R Hand
 *  3. Emit flame ribbon / particles along path (never stretch weapon mesh)
 */
import * as THREE from "three";
import { FLEET_ASSET_HOSTS, resolveAssetCandidates } from "../fleetAssetResolver";

export interface ChainPathSample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface HellfireChainPath {
  role: string;
  sourceClip?: string;
  hasChain: boolean;
  tipBone: string;
  handBone?: string;
  chainBones?: string[];
  maxExtensionM?: number;
  flameRecipe?: {
    effectIds: string[];
    mode: string;
    attach: string;
    widthM: number;
    life: number;
    color: number;
  };
  pathSamples?: ChainPathSample[];
  note?: string;
}

const cache = new Map<string, HellfireChainPath | null>();

/** Map combat role → FX rel (under /anims/baked/). */
export const CHAIN_FX_BY_ROLE: Record<string, string> = {
  quakesmash: "ghost_rider/fx/quakesmash_chain_path",
  combo_finisher: "ghost_rider/fx/quakesmash_chain_path",
  finisher: "ghost_rider/fx/quakesmash_chain_path",
  megachain_slam: "ghost_rider/fx/megachain_slam_chain_path",
  ultimate: "ghost_rider/fx/megachain_slam_chain_path",
  chain_throw: "ghost_rider/fx/chain_throw_chain_path",
  chain_stab: "ghost_rider/fx/chain_stab_hyper_chain_path",
  chain_spin: "ghost_rider/fx/chain_spin_chain_path",
  forward_chain_slam: "ghost_rider/fx/forward_chain_slam_chain_path",
  fireball: "ghost_rider/fx/fireball_chain_path",
  whip_rainbow: "ghost_rider/fx/whip_rainbow_chain_path",
};

export async function loadHellfireChainPath(
  relOrRole: string,
): Promise<HellfireChainPath | null> {
  const rel = CHAIN_FX_BY_ROLE[relOrRole] ?? relOrRole.replace(/\.json$/i, "");
  if (cache.has(rel)) return cache.get(rel)!;

  const path = `anims/baked/${rel}.json`;
  const urls = [
    ...resolveAssetCandidates(path),
    `${FLEET_ASSET_HOSTS.r2}/${path}`,
    `/${path}`,
  ];
  for (const url of [...new Set(urls)]) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) continue;
      const data = (await res.json()) as HellfireChainPath;
      cache.set(rel, data);
      return data;
    } catch {
      /* try next host */
    }
  }
  cache.set(rel, null);
  return null;
}

/**
 * Convert local path samples to world points using a hand bone (or Object3D).
 * Samples are authoring-space offsets; we treat them as local deltas from hand.
 */
export function chainPathToWorldPoints(
  path: HellfireChainPath,
  handWorld: THREE.Object3D,
  opts?: { maxPoints?: number },
): THREE.Vector3[] {
  const samples = path.pathSamples;
  if (!samples?.length) return [];
  const max = opts?.maxPoints ?? 24;
  const step = Math.max(1, Math.floor(samples.length / max));
  handWorld.updateWorldMatrix(true, false);
  const m = handWorld.matrixWorld;
  const out: THREE.Vector3[] = [];
  const o = samples[0]!;
  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i]!;
    // Relative to first sample so path is motion of tip in chain-local space
    const local = new THREE.Vector3(s.x - o.x, s.y - o.y, s.z - o.z);
    out.push(local.applyMatrix4(m));
  }
  return out;
}

/**
 * Build a simple Catmull-Rom curve for ribbon / tube mesh (procedural chain).
 * Caller disposes geometry after use.
 */
export function chainPathCurve(
  worldPoints: THREE.Vector3[],
): THREE.CatmullRomCurve3 | null {
  if (worldPoints.length < 2) return null;
  return new THREE.CatmullRomCurve3(worldPoints);
}

/** Suggested particle step along path (meters). */
export const HELLFIRE_PARTICLE_STEP_M = 0.12;
