import * as THREE from "three";
import { evaluateAssetRole } from "@workspace/voxel-canonical";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { attachTorchFlame } from "../fx/torchFlame";
import { PROPS, type PropId } from "./types";

/**
 * Loads + normalizes a deployable GLB prop once and caches the prepared
 * template, so every placement (both the Voxel Editor and play mode) clones the
 * same geometry/materials instead of re-downloading the model.
 *
 * The source models arrive at wildly different native scales and off-origin
 * pivots, so each template is fit to its {@link PropDef.targetHeight}, recentred
 * on X/Z, and dropped so its base sits at Y=0 (matching the deployable group
 * origin). Clones share the template's geometry + materials, so they must NOT be
 * disposed per instance — only the cached template owns those GPU resources for
 * the lifetime of the app.
 */
const cache = new Map<PropId, Promise<THREE.Group | null>>();

export function loadPropTemplate(id: PropId): Promise<THREE.Group | null> {
  let pending = cache.get(id);
  if (!pending) {
    pending = buildTemplate(id).catch((err) => {
      console.error(`[props] failed to load prop "${id}"`, err);
      cache.delete(id); // allow a later retry
      return null;
    });
    cache.set(id, pending);
  }
  return pending;
}

async function buildTemplate(id: PropId): Promise<THREE.Group> {
  const def = PROPS[id];
  // Same-origin → open hosts → R2 (props often missing from R2 gameopen prefix)
  const paths =
    id === "torch"
      ? [
          def.file,
          "models/props/torch.glb",
          "models/props/torch-burning.glb",
          "models/props/dying-torch.glb",
        ]
      : [def.file];
  const { scene: model, url } = await loadGltfFirst(paths, sharedGltfLoader());
  if (import.meta.env.DEV) console.info(`[props] ${id} from`, url);

  // Fit scale: props use targetHeight; map/structure assets must NOT be crushed
  // (1 block = 1 m — see mapAssetScale / evaluateAssetRole).
  model.updateWorldMatrix(true, true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const bounds = { x: size.x, y: size.y, z: size.z };
  const evaled = evaluateAssetRole({
    name: def.file,
    bounds,
    tags: [def.category, def.id],
  });
  let scale: number;
  if (evaled.forbidPropHeightFit) {
    scale = evaled.scale;
    console.warn(
      `[props] "${id}" looks like ${evaled.role} (${evaled.reason}) — using map scale ${scale.toFixed(4)} instead of targetHeight=${def.targetHeight}. Prefer loadMapChunk().`,
    );
  } else {
    scale = def.targetHeight / (size.y || 1);
  }
  model.scale.setScalar(scale);

  // Recentre on X/Z and drop the base to Y=0 (after scaling).
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
  wrap.add(model);

  // Torches get a live flame + warm point light. The flame animates via the
  // shared flame clock and survives the per-placement clone (clones share the
  // material); the light is baked at a warm base intensity per instance.
  if (id === "torch") {
    attachTorchFlame(wrap, def.targetHeight, { dying: 0.6, flameScale: 0.9 });
  }

  return wrap;
}
