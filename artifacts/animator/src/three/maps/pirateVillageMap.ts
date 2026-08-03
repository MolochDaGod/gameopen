/**
 * Pirate village Danger map — scale for 2 m orc, layers, harvest, water, palms.
 *
 * Assets: public/models/maps/pirate/{village,palm_trees,date_palm}.glb
 * Recipe: content/worlds/pirate-village-production.json
 * Docs: docs/DANGER_MAP_MOBILITY_AND_PIRATE_VILLAGE.md
 * Scale SSOT: maps/mapOrcScale.ts (ORC_AGENT 2.0 m)
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ORC_AGENT } from "./mapOrcScale";

export type GameLayer = "ground" | "solid" | "climb" | "swim" | "harvest" | "vehicle" | "prop";

/** Re-export SSOT — all maps use the same 2 m orc agent. */
export { ORC_AGENT };
export { ORC_NAV_AGENT } from "./mapOrcScale";

const LAYER_MATCH: Record<GameLayer, string[]> = {
  ground: ["Landscape", "Stairs", "Sand"],
  solid: ["Hut", "Tower", "Fence", "Cell", "Rock", "Big_Rock", "CookingPlace"],
  climb: ["Ladder", "Stairs"],
  swim: ["Water"],
  harvest: ["Tree", "Palm", "Mangrove", "Rock", "Big_Rock", "Coconut", "Barrel", "Box", "Bag"],
  vehicle: ["Boat", "Raft"],
  prop: [],
};

const HARVEST: Record<string, { kind: string; tool: string; hp: number }> = {
  Tree: { kind: "wood", tool: "axe", hp: 40 },
  Palm: { kind: "wood", tool: "axe", hp: 35 },
  Mangrove: { kind: "wood", tool: "axe", hp: 45 },
  Rock: { kind: "ore", tool: "pick", hp: 50 },
  Big_Rock: { kind: "ore", tool: "pick", hp: 80 },
  Coconut: { kind: "food", tool: "hand", hp: 5 },
  Barrel: { kind: "loot", tool: "hand", hp: 15 },
  Box: { kind: "loot", tool: "hand", hp: 12 },
  Bag: { kind: "loot", tool: "hand", hp: 10 },
};

export interface PirateMapLoadResult {
  root: THREE.Group;
  village: THREE.Object3D;
  waterBand: { bottom: number; top: number };
  harvestables: THREE.Object3D[];
  solids: THREE.Object3D[];
  climbables: THREE.Object3D[];
  vehicles: THREE.Object3D[];
  /** Landscape meshes suitable for navmesh source. */
  navSources: THREE.Mesh[];
  scale: number;
  agent: typeof ORC_AGENT;
}

const BASE = import.meta.env.BASE_URL || "/";

function matchLayer(name: string): GameLayer {
  const n = name.toLowerCase();
  for (const [layer, keys] of Object.entries(LAYER_MATCH) as [GameLayer, string[]][]) {
    for (const m of keys) {
      if (n.includes(m.toLowerCase())) return layer;
    }
  }
  return "prop";
}

function harvestDef(name: string): { kind: string; tool: string; hp: number } | null {
  for (const [key, def] of Object.entries(HARVEST)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return def;
  }
  return null;
}

function loadGltf(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (g) => resolve(g.scene),
      undefined,
      reject,
    );
  });
}

/**
 * Re-ground group so the lowest point sits at y=0 (SI feet).
 */
export function reGroundToY0(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.y)) return;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

/**
 * Fit uniform scale so measured village height approaches orc-playable vertical
 * (default from recipe.uniformScale). Optionally pass measuredDoorHeightM to
 * auto-fit door clear for 2 m orc.
 */
export function villageScaleForOrc(opts?: {
  measuredDoorHeightM?: number;
  doorClearM?: number;
}): number {
  if (opts?.measuredDoorHeightM && opts.measuredDoorHeightM > 0.05) {
    const clear = opts.doorClearM ?? ORC_AGENT.doorClearM;
    return clear / opts.measuredDoorHeightM;
  }
  return ORC_AGENT.villageUniformScale;
}

/**
 * Classify a loaded village scene graph: layers, harvest tags, water band.
 */
export function classifyVillageScene(
  village: THREE.Object3D,
  scale: number,
): Omit<PirateMapLoadResult, "root" | "village" | "scale" | "agent"> {
  village.scale.setScalar(scale);
  reGroundToY0(village);

  const harvestables: THREE.Object3D[] = [];
  const solids: THREE.Object3D[] = [];
  const climbables: THREE.Object3D[] = [];
  const vehicles: THREE.Object3D[] = [];
  const navSources: THREE.Mesh[] = [];
  let waterBox: THREE.Box3 | null = null;

  village.traverse((o) => {
    const name = o.name || o.parent?.name || "";
    if (!(o as THREE.Mesh).isMesh && o.children.length) {
      // still tag groups
    }
    const layer = matchLayer(name);
    o.userData.gameLayer = layer;
    o.userData.nav =
      layer === "ground" ||
      (layer === "solid" && /stairs/i.test(name));

    const h = harvestDef(name);
    if (h) {
      o.userData.harvest = h;
      harvestables.push(o);
    }
    if (layer === "solid" || layer === "ground") solids.push(o);
    if (layer === "climb") climbables.push(o);
    if (layer === "vehicle") {
      o.userData.vehicleKind = /boat/i.test(name) ? "boat" : "raft";
      vehicles.push(o);
    }
    if ((o as THREE.Mesh).isMesh && layer === "swim") {
      const mesh = o as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      const b = new THREE.Box3().setFromObject(mesh);
      if (waterBox) waterBox.union(b);
      else waterBox = b.clone();
      // Water is a sensor — don't cast hard shadows as solid terrain
      mesh.userData.sensor = true;
    }
    if ((o as THREE.Mesh).isMesh && /Landscape|Stairs/i.test(name)) {
      navSources.push(o as THREE.Mesh);
    }
    // Hide stock palms when replacing with better assets
    if (/Palm_/i.test(name)) {
      o.visible = false;
      o.userData.replaced = true;
    }
  });

  const waterBand = waterBox
    ? { bottom: waterBox.min.y - 0.5, top: waterBox.max.y }
    : { bottom: -0.5, top: 0.35 * scale };

  return { waterBand, harvestables, solids, climbables, vehicles, navSources };
}

/**
 * Instance better palm GLBs at hidden Palm_* transforms.
 */
export async function instanceBetterPalms(
  village: THREE.Object3D,
  parent: THREE.Group,
): Promise<THREE.Object3D[]> {
  const palmUrl = `${BASE}models/maps/pirate/palm_trees.glb`;
  const dateUrl = `${BASE}models/maps/pirate/date_palm.glb`;
  const placed: THREE.Object3D[] = [];

  let palmTpl: THREE.Object3D | null = null;
  let dateTpl: THREE.Object3D | null = null;
  try {
    palmTpl = await loadGltf(palmUrl);
  } catch {
    console.warn("[pirateVillage] palm_trees.glb missing at", palmUrl);
  }
  try {
    dateTpl = await loadGltf(dateUrl);
    dateTpl.scale.setScalar(ORC_AGENT.datePalmScale);
  } catch {
    console.warn("[pirateVillage] date_palm.glb missing at", dateUrl);
  }

  const anchors: THREE.Object3D[] = [];
  village.traverse((o) => {
    if (/Palm_/i.test(o.name) && o.userData.replaced) anchors.push(o);
  });

  let i = 0;
  for (const a of anchors) {
    const tpl = i % 3 === 0 && dateTpl ? dateTpl : palmTpl;
    if (!tpl) break;
    const inst = tpl.clone(true);
    a.getWorldPosition(inst.position);
    a.getWorldQuaternion(inst.quaternion);
    // Keep uniform hero scale; slight random yaw variety
    inst.rotateY((i * 0.7) % (Math.PI * 2));
    inst.userData.gameLayer = "harvest";
    inst.userData.harvest = { kind: "wood", tool: "axe", hp: 40 };
    inst.userData.nav = false;
    parent.add(inst);
    placed.push(inst);
    i++;
  }
  return placed;
}

/**
 * Full map load for Danger Room / playtest.
 */
export async function loadPirateVillageMap(opts?: {
  scale?: number;
  measuredDoorHeightM?: number;
}): Promise<PirateMapLoadResult> {
  const scale =
    opts?.scale ??
    villageScaleForOrc({ measuredDoorHeightM: opts?.measuredDoorHeightM });
  const villageUrl = `${BASE}models/maps/pirate/village.glb`;
  const village = await loadGltf(villageUrl);
  const classified = classifyVillageScene(village, scale);

  const root = new THREE.Group();
  root.name = "PirateVillageMap";
  root.add(village);

  const betterPalms = await instanceBetterPalms(village, root);
  classified.harvestables.push(...betterPalms);

  // Placeholder ladder volume on tallest solid (tower) if no ladder mesh
  {
    let tower: THREE.Object3D | null = null;
    let maxY = -Infinity;
    village.traverse((o) => {
      if (/Tower/i.test(o.name)) {
        const b = new THREE.Box3().setFromObject(o);
        if (b.max.y > maxY) {
          maxY = b.max.y;
          tower = o;
        }
      }
    });
    if (tower) {
      const b = new THREE.Box3().setFromObject(tower);
      const ladder = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, Math.max(2.5, b.max.y - b.min.y), 0.15),
        new THREE.MeshStandardMaterial({
          color: 0x6b4423,
          roughness: 0.9,
          transparent: true,
          opacity: 0.35,
        }),
      );
      ladder.name = "Ladder_Generated";
      const center = b.getCenter(new THREE.Vector3());
      ladder.position.set(b.max.x + 0.25, (b.min.y + b.max.y) / 2, center.z);
      ladder.userData.gameLayer = "climb";
      ladder.userData.sensor = true;
      ladder.userData.nav = false;
      root.add(ladder);
      classified.climbables.push(ladder);
    }
  }

  return {
    root,
    village,
    scale,
    agent: ORC_AGENT,
    ...classified,
  };
}

/**
 * Build simplified collider descriptors for Rapier bake (caller creates bodies).
 * Trimesh for landscape; cuboid fallbacks for small props.
 */
export function colliderPlanForObject(o: THREE.Object3D): {
  type: "trimesh" | "cuboid" | "sensor_box";
  layer: GameLayer;
} | null {
  const layer = (o.userData.gameLayer as GameLayer) || "prop";
  if (layer === "swim" || o.userData.sensor) {
    return { type: "sensor_box", layer: "swim" };
  }
  if (layer === "climb") return { type: "sensor_box", layer: "climb" };
  if (layer === "ground" || layer === "solid" || layer === "vehicle") {
    return { type: "trimesh", layer };
  }
  if (o.userData.harvest) {
    return { type: "cuboid", layer: "harvest" };
  }
  return null;
}

/**
 * Build a three-pathfinding zone from landscape meshes (merge geometries).
 * Call after map load; bake offline for production if possible.
 */
export async function buildNavZoneFromMeshes(
  meshes: THREE.Mesh[],
): Promise<{ zone: unknown; zoneId: string } | null> {
  if (!meshes.length) return null;
  try {
    const { Pathfinding } = await import("three-pathfinding");
    const geos: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      const g = m.geometry.clone();
      m.updateWorldMatrix(true, false);
      g.applyMatrix4(m.matrixWorld);
      geos.push(g);
    }
    // Use first landscape geo if merge not available
    const geo = geos[0]!;
    const zone = Pathfinding.createZone(geo);
    return { zone, zoneId: ORC_NAV_AGENT.zoneId };
  } catch (e) {
    console.warn("[pirateVillage] three-pathfinding nav zone failed", e);
    return null;
  }
}
