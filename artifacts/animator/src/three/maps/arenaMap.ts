/**
 * Viking / fantasy arena (arena.glb from arena (1).glb).
 *
 * Large prop-rich combat pit: Sand + Grass ground, Rock harvest, wood props,
 * barriers, stairs (climb). Good for combat + build-grid overlay on sand.
 *
 * Asset: public/models/maps/arena/arena.glb (~19 MB, ~1600 meshes)
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

export interface ArenaMapResult extends IslandMapLayers {
  agent: typeof ORC_AGENT;
  mapId: "arena";
  /** Suggested build snap (m) — 1 m SI grid. */
  buildSnapM: number;
}

function loadGltf(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g.scene), undefined, reject);
  });
}

/**
 * Load arena. Default scale 1; if the pit reads huge/tiny, pass explicit scale
 * after measuring door/human props.
 */
export async function loadArenaMap(opts?: {
  scale?: number;
}): Promise<ArenaMapResult> {
  const scale = opts?.scale ?? 1.0;
  const url = `${BASE}models/maps/arena/arena.glb`;
  const scene = await loadGltf(url);

  const root = new THREE.Group();
  root.name = "ArenaMap";
  scene.scale.setScalar(scale);
  root.add(scene);

  reGroundToY0(root);
  centerXZ(root);

  const layers = classifyIslandScene(root, "arena");
  const fp = measureFootprint(root);

  // Prefer Sand + Grass as nav; if none, largest horizontal meshes
  if (!layers.navSources.length) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const b = new THREE.Box3().setFromObject(m);
      const s = new THREE.Vector3();
      b.getSize(s);
      if (s.x > 8 && s.z > 8 && s.y < 6) {
        m.userData.gameLayer = "ground";
        m.userData.nav = true;
        layers.ground.push(m);
        layers.navSources.push(m);
      }
    });
  }

  return {
    root,
    ...layers,
    waterBand: null,
    scale,
    boundHalf: fp.boundHalf,
    footprint: { min: fp.min, max: fp.max },
    agent: ORC_AGENT,
    mapId: "arena",
    buildSnapM: 1,
  };
}

export function arenaQaSummary(map: ArenaMapResult): string {
  return [
    `Arena scale=${map.scale} boundHalf=${map.boundHalf.toFixed(1)}m snap=${map.buildSnapM}m`,
    `ground=${map.ground.length} climb=${map.climbables.length} harvest=${map.harvestables.length}`,
    `solid=${map.solids.length} interact=${map.interactables.length} (Tore/chains = prop, not ore)`,
    `Q&A: combat on sand · stairs climb · rock pick · build grid on grass/sand · R rotate ghost`,
  ].join("\n");
}
