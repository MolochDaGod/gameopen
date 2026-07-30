/**
 * Shipwreck island — small Sprytile island with water, ladders, palms, rock, ship, lighthouse.
 *
 * Asset: public/models/maps/shipwreck/shipwreck_island.glb (~1 MB)
 * Roles: ground World · swim Water · climb Ladders · harvest palms/rock/tree · vehicle Ship
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  centerXZ,
  classifyIslandScene,
  measureFootprint,
  reGroundToY0,
  type IslandMapLayers,
} from "./islandMapLayers";
import { ORC_AGENT } from "./pirateVillageMap";

const BASE = import.meta.env.BASE_URL || "/";

export interface ShipwreckMapResult extends IslandMapLayers {
  agent: typeof ORC_AGENT;
  mapId: "shipwreck-island";
}

function loadGltf(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g.scene), undefined, reject);
  });
}

/**
 * Load shipwreck island, classify layers, SI re-ground, optional uniform scale.
 * Default scale 1 — Sprytile maps are often already metre-ish; pass scale if tiny.
 */
export async function loadShipwreckIslandMap(opts?: {
  scale?: number;
}): Promise<ShipwreckMapResult> {
  const scale = opts?.scale ?? 1.0;
  const url = `${BASE}models/maps/shipwreck/shipwreck_island.glb`;
  const scene = await loadGltf(url);

  const root = new THREE.Group();
  root.name = "ShipwreckIslandMap";
  scene.scale.setScalar(scale);
  root.add(scene);

  reGroundToY0(root);
  centerXZ(root);

  const layers = classifyIslandScene(root, "shipwreck");
  const fp = measureFootprint(root);

  // Ensure water band if water mesh exists but band null
  let waterBand = layers.waterBand;
  if (!waterBand && layers.swim.length) {
    const b = new THREE.Box3();
    for (const o of layers.swim) b.expandByObject(o);
    waterBand = { bottom: b.min.y - 0.8, top: b.max.y + 0.1 };
  }

  return {
    root,
    ...layers,
    waterBand,
    scale,
    boundHalf: fp.boundHalf,
    footprint: { min: fp.min, max: fp.max },
    agent: ORC_AGENT,
    mapId: "shipwreck-island",
  };
}

export function shipwreckQaSummary(map: ShipwreckMapResult): string {
  return [
    `Shipwreck island scale=${map.scale} boundHalf=${map.boundHalf.toFixed(1)}m`,
    `ground=${map.ground.length} climb=${map.climbables.length} swim=${map.swim.length}`,
    `harvest=${map.harvestables.length} solid=${map.solids.length} vehicle=${map.vehicles.length} interact=${map.interactables.length}`,
    `waterBand=${map.waterBand ? `[${map.waterBand.bottom.toFixed(2)}, ${map.waterBand.top.toFixed(2)}]` : "none"}`,
    `Q&A: climb ladders · swim water · axe palms · pick rock · boat ship · build on World tilemap`,
  ].join("\n");
}
