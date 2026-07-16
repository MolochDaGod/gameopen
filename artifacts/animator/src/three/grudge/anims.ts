import * as THREE from "three";
import { assetLoadError, resolveGrudgeAssetCandidates } from "./assetBase";
import { FLEET_ASSET_HOSTS } from "../fleetAssetResolver";

// Animation packs match the gear-preset `animPack` field. Each pack maps to a
// set of pre-baked Bip001 clips (idle / walk / run / attack). The clips were
// retargeted offline to Bip001 by the viewer's bake tool and shipped as JSON
// under `/anims/baked/<rel>.json`; we load them directly (no runtime retarget).
export type AnimPack = "magic" | "sword_shield" | "longbow" | "unarmed";

export interface LoadoutClips {
  idle: string;
  walk: string;
  run: string;
  attack: string;
}

// Paths are relative to `/anims/baked/`, WITHOUT the `.json` extension. Every
// path below is verified to exist on disk (see character-viewer/public/anims/baked).
export const ANIM_PACK_CLIPS: Record<AnimPack, LoadoutClips> = {
  unarmed: {
    idle: "unarmed/fight_idle",
    walk: "locomotion/walking",
    run: "locomotion/running",
    attack: "unarmed/punching",
  },
  magic: {
    idle: "magic/standing idle",
    walk: "locomotion/walking",
    run: "magic/Standing Run Forward",
    attack: "magic/standing 1h cast spell 01",
  },
  sword_shield: {
    idle: "sword_shield/sword and shield idle",
    walk: "locomotion/walking",
    run: "sword_shield/sword and shield run",
    attack: "sword_shield/sword and shield attack",
  },
  longbow: {
    idle: "longbow/standing idle 01",
    walk: "locomotion/walking",
    run: "longbow/standing run forward",
    attack: "longbow/standing aim recoil",
  },
};

export function asAnimPack(value: string): AnimPack {
  return value in ANIM_PACK_CLIPS ? (value as AnimPack) : "unarmed";
}

// Dedicated sprint locomotion clip (uploaded 2026-06). Pack-agnostic body
// locomotion the world crossfades to while sprinting, instead of time-scaling
// the run clip (which causes foot-slide). Baked rotation-only like the rest, so
// it works on every race at any scale.
export const SPRINT_CLIP = "uploads_2026_06/locomotion/running";

// Build the primary URL for a baked clip (R2 default; loaders try all hosts).
export function bakedClipUrl(rel: string, baseOverride?: string): string {
  const path = `anims/baked/${rel}.json`;
  if (baseOverride !== undefined) {
    return `${baseOverride.replace(/\/+$/, "")}/${path}`;
  }
  return `${FLEET_ASSET_HOSTS.r2}/${path}`;
}

/** Ordered hosts for baked Bip001 JSON clips. */
export function bakedClipCandidates(rel: string, baseOverride?: string): string[] {
  const path = `anims/baked/${rel}.json`;
  const urls: string[] = [];
  if (baseOverride) {
    urls.push(`${baseOverride.replace(/\/+$/, "")}/${path}`);
  }
  // Arena is the live SSOT for baked Bip001 packs (R2 root often 404s).
  urls.push(`${FLEET_ASSET_HOSTS.arena}/${path}`);
  urls.push(...resolveGrudgeAssetCandidates(path));
  return [...new Set(urls)];
}

// Rotation-only conformation — bone lengths come from the MODEL skeleton, motion
// (rotations) comes from the clip. Baked Bip001 clips are already rotation-only,
// so this is effectively a no-op for them, but it stays as a safety net.
export function toRotationOnlyClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => t.name.endsWith(".quaternion"));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Fetch + parse a baked Bip001 clip as a rotation-only AnimationClip (multi-host).
export async function loadBakedClip(rel: string, baseOverride?: string): Promise<THREE.AnimationClip> {
  let lastErr: unknown;
  for (const url of bakedClipCandidates(rel, baseOverride)) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        lastErr = assetLoadError(`${url} (HTTP ${res.status})`);
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        lastErr = assetLoadError(`HTML fake-200 ${url}`);
        continue;
      }
      const json = (await res.json()) as THREE.AnimationClipJSON;
      return toRotationOnlyClip(THREE.AnimationClip.parse(json));
    } catch (err) {
      lastErr = err;
    }
  }
  throw assetLoadError(`anims/baked/${rel}.json`, lastErr);
}
