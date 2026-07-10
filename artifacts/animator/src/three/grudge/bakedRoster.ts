/**
 * Baked grudge6 character roster.
 *
 * `30characters.glb` is a single self-contained GLB exported from the Forge with
 * all 30 grudge6 characters (6 races × 5 gear presets), each carrying its OWN
 * correctly-baked body-atlas texture. This is the fix for the legacy "yellow
 * model" bug: the old {@link ./GrudgeAvatar} path streamed a per-race FBX plus a
 * separate remote `.webp` atlas that frequently failed/mismatched, leaving an
 * untextured model. The baked GLB needs no remote texture and no FBX.
 *
 * The characters are static (no skins/animations), so they render as a
 * correctly-textured posed avatar. This module loads the GLB once, then hands
 * out a normalized clone (fit to ~1.9u, centred, feet at y=0) by index.
 *
 * The GLB textures were compressed 2048→1024 WebP (260MB → ~7MB) via
 * glTF-Transform; the pristine 2048 source is archived at
 * `D:\Games\Models\30characters-source-2048.glb`.
 */
import * as THREE from "three";
import { asset } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { PRESET_IDS, type PresetId } from "./gearPresets";
import { RACE_IDS, type RaceId } from "./raceAssets";

/** Served path (same-origin under the artifact base) — no remote asset host. */
const GLB_URL = "models/grudge6/30characters.glb";
const TARGET_HEIGHT = 1.9;

/**
 * Race-major layout of the 30 baked characters (6 races × 5 presets). The Forge
 * exported every combination into one scene, but the child order is not labelled
 * in the GLB, so this table is the ASSUMED mapping of (race, preset) → child
 * index under the "ForgeScene" group. Every one of the 30 is correctly textured
 * regardless, so a wrong entry only shows a mismatched (but correct-looking)
 * character — reorder this single table after a visual check if needed.
 */
export const BAKED_ORDER: ReadonlyArray<readonly [RaceId, PresetId]> = RACE_IDS.flatMap(
  (race) => PRESET_IDS.map((preset) => [race, preset] as const),
);

/** Map a (race, preset) pair to its baked-character index (0–29). */
export function bakedIndexFor(raceId: RaceId, presetId: PresetId): number {
  const i = BAKED_ORDER.findIndex(([r, p]) => r === raceId && p === presetId);
  return i >= 0 ? i : 0;
}

let rosterPromise: Promise<THREE.Object3D[]> | null = null;

/** Load the baked GLB once and return the 30 character sub-groups (cached). */
function loadRoster(): Promise<THREE.Object3D[]> {
  if (!rosterPromise) {
    rosterPromise = sharedGltfLoader()
      .loadAsync(asset(GLB_URL))
      .then((gltf) => {
        // The 30 characters are the children of the group with the most
        // children ("ForgeScene"); robust to any wrapper nodes GLTFLoader adds.
        let host: THREE.Object3D = gltf.scene;
        gltf.scene.traverse((o) => {
          if (o.children.length > host.children.length) host = o;
        });
        return [...host.children];
      })
      .catch((err) => {
        console.error("[grudge/bakedRoster] failed to load", asset(GLB_URL), err);
        rosterPromise = null; // allow a later retry
        throw err;
      });
  }
  return rosterPromise;
}

/** Fit a cloned character to TARGET_HEIGHT, centre on X/Z, feet at y=0. */
function normalize(character: THREE.Object3D): THREE.Group {
  const wrap = new THREE.Group();
  wrap.add(character);
  character.updateWorldMatrix(true, true);
  const size = new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3());
  character.scale.multiplyScalar(TARGET_HEIGHT / (size.y || 1));
  character.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(character);
  const center = box.getCenter(new THREE.Vector3());
  character.position.x -= center.x;
  character.position.z -= center.z;
  character.position.y -= box.min.y;
  wrap.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  return wrap;
}

/**
 * Return a normalized, correctly-textured baked character by index (0–29).
 * The clone shares geometry + baked materials with the cached roster (they are
 * owned by the cache for the app lifetime and must NOT be disposed per-instance).
 */
export async function getBakedCharacter(index: number): Promise<THREE.Group> {
  const roster = await loadRoster();
  const src = roster[Math.max(0, Math.min(roster.length - 1, index))];
  const clone = src.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.traverse((o) => {
    o.visible = true;
  });
  return normalize(clone);
}

/** Convenience: the baked character for a race + gear preset. */
export function loadBakedGrudgeCharacter(
  raceId: RaceId,
  presetId: PresetId,
): Promise<THREE.Group> {
  return getBakedCharacter(bakedIndexFor(raceId, presetId));
}
