/**
 * Map-chunk loader — full scenes / castles / islands for seed worlds.
 *
 * NEVER uses prop `targetHeight` fit (that shrinks maps to tabletop size).
 * Scale comes from {@link evaluateAssetRole} / {@link scaleForMapChunkId}
 * so 1 voxel block = 1 world metre after placement.
 */
import * as THREE from "three";
import {
  MAP_CHUNKS,
  evaluateAssetRole,
  scaleForMapChunkId,
  type MapChunkDef,
  type AssetEvalResult,
} from "@workspace/voxel-canonical";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";

export type { MapChunkDef };

const cache = new Map<string, Promise<THREE.Group | null>>();

export function listMapChunks(): MapChunkDef[] {
  return Object.values(MAP_CHUNKS);
}

export function getMapChunkDef(id: string): MapChunkDef | undefined {
  return MAP_CHUNKS[id];
}

/**
 * Load + scale a map chunk. Grounds base to y=0, recentres XZ, applies
 * block-grid scale (not prop height).
 */
export function loadMapChunk(id: string): Promise<THREE.Group | null> {
  let pending = cache.get(id);
  if (!pending) {
    pending = buildMapChunk(id).catch((err) => {
      console.error(`[mapChunks] failed "${id}"`, err);
      cache.delete(id);
      return null;
    });
    cache.set(id, pending);
  }
  return pending;
}

async function buildMapChunk(id: string): Promise<THREE.Group> {
  const def = MAP_CHUNKS[id];
  if (!def) throw new Error(`Unknown map chunk: ${id}`);

  const { scene: model, url } = await loadGltfFirst([def.file], sharedGltfLoader());
  console.info(`[mapChunks] ${id} from`, url);

  model.updateWorldMatrix(true, true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const bounds = { x: size.x, y: size.y, z: size.z };

  const evaled: AssetEvalResult = evaluateAssetRole({
    name: def.file,
    bounds,
    fileBytes: def.fileBytes,
    tags: def.tags,
    forceMap: true,
  });

  // Prefer catalog pitch / known scale over pure bounds when set
  const scale =
    def.sourceBlockPitch != null
      ? scaleForMapChunkId(id, bounds)
      : evaled.scale;

  if (evaled.forbidPropHeightFit === false) {
    console.warn(`[mapChunks] ${id} classified without forbidPropHeightFit — still using map scale`);
  }

  model.scale.setScalar(scale);
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const wrap = new THREE.Group();
  wrap.name = `mapChunk:${id}`;
  wrap.userData.mapChunk = true;
  wrap.userData.mapChunkId = id;
  wrap.userData.placementScale = scale;
  wrap.userData.role = evaled.role;
  wrap.userData.footprintBlocks = evaled.footprintBlocks;
  wrap.userData.evalReason = evaled.reason;
  wrap.add(model);

  console.info(
    `[mapChunks] ${id} role=${evaled.role} scale=${scale.toFixed(4)} footprint=${evaled.footprintBlocks.w}×${evaled.footprintBlocks.d}×${evaled.footprintBlocks.h} blocks (${evaled.reason})`,
  );

  return wrap;
}

/**
 * Place a map chunk at world cell (ix, iz) — multiplies cell coords by block size (1).
 */
export async function placeMapChunk(
  id: string,
  worldX: number,
  worldZ: number,
  parent: THREE.Object3D,
): Promise<THREE.Group | null> {
  const tpl = await loadMapChunk(id);
  if (!tpl) return null;
  const inst = tpl.clone(true);
  inst.position.set(worldX, 0, worldZ);
  parent.add(inst);
  return inst;
}
