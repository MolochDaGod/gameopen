/**
 * Island / arena mesh classification SSOT for colliders, nav, interact, build grid.
 *
 * Roles map onto GamePlayLayers (terrain, climb, swim, burn, claim, enemy_zone, …).
 */
import * as THREE from "three";
import {
  applyGameLayer,
  type GameLayerTag,
} from "../gameplay/GamePlayLayers";

export type IslandMeshRole =
  | "ground"
  | "solid"
  | "climb"
  | "swim"
  | "burn"
  | "ocean_floor"
  | "harvest"
  | "vehicle"
  | "interact"
  | "claim"
  | "enemy_zone"
  | "reward"
  | "prop"
  | "exclude";

export interface ClassifiedMesh {
  object: THREE.Object3D;
  mesh: THREE.Mesh | null;
  name: string;
  role: IslandMeshRole;
  materialNames: string[];
}

export interface IslandMapLayers {
  root: THREE.Group;
  ground: THREE.Mesh[];
  solids: THREE.Object3D[];
  climbables: THREE.Object3D[];
  swim: THREE.Object3D[];
  burn: THREE.Object3D[];
  oceanFloor: THREE.Object3D[];
  harvestables: THREE.Object3D[];
  vehicles: THREE.Object3D[];
  interactables: THREE.Object3D[];
  claimVolumes: THREE.Object3D[];
  enemyZones: THREE.Object3D[];
  rewards: THREE.Object3D[];
  /** Ground meshes for build-grid raycast + nav height. */
  navSources: THREE.Mesh[];
  waterBand: { top: number; bottom: number } | null;
  burnBand: { top: number; bottom: number } | null;
  scale: number;
  boundHalf: number;
  footprint: { min: THREE.Vector3; max: THREE.Vector3 };
}

function roleToGameTag(role: IslandMeshRole): GameLayerTag {
  switch (role) {
    case "ground":
      return "terrain";
    case "ocean_floor":
      return "ocean_floor";
    case "climb":
      return "climb";
    case "swim":
      return "swim";
    case "burn":
      return "burn";
    case "harvest":
      return "harvest";
    case "claim":
      return "claim";
    case "enemy_zone":
      return "enemy_zone";
    case "reward":
      return "reward";
    case "vehicle":
      return "vehicle";
    case "solid":
      return "solid";
    case "interact":
      return "interact";
    case "exclude":
      return "exclude";
    default:
      return "prop";
  }
}

/** Heuristic mesh role from node name + material names. */
export function classifyIslandMesh(
  name: string,
  materialNames: string[] = [],
  mapKind: "arena" | "shipwreck" | "generic" = "generic",
): IslandMeshRole {
  const s = `${name} ${materialNames.join(" ")}`;

  // Exclude cameras / free projections / helpers
  if (/cam[eé]ra|proj\.?\s*libre|object_38/i.test(s)) return "exclude";

  // Arena: metal chain rings (Tore) are props/solids, NOT ore
  if (mapKind === "arena" && /tore\d*|chaine/i.test(s) && /metal/i.test(s)) {
    return "prop";
  }
  if (mapKind === "arena" && /tore\d*|chaine/i.test(name)) return "prop";

  if (/skybox|sky/i.test(s)) return "exclude";
  if (/lava|magma|burn|fire_pit|volcanic_pool/i.test(s)) return "burn";
  if (/ocean.?floor|seabed|sea.?bed|oceanfloor/i.test(s)) return "ocean_floor";
  if (/water|waterfall|ocean|sea|lake|river|swim/i.test(s)) return "swim";
  if (/ladder|climb|rope|vine|escalier|stair/i.test(s)) return "climb";
  if (/claim|flag.?radius|build.?rights|territory_zone/i.test(s)) return "claim";
  if (/enemy.?zone|aggro|encounter|combat.?zone/i.test(s)) return "enemy_zone";
  if (/reward|loot_chest|treasure_drop/i.test(s)) return "reward";

  // Ground / terrain
  if (
    /sand|grass|herbe|terre|terrain|ground|landscape|beach|world_sprytile|ar[eè]ne_base|ar[eè]ne_grass|d[eé]cors_grass|plan\d+_herbe/i.test(
      s,
    )
  ) {
    return "ground";
  }
  // Shipwreck World tilemap is the island body
  if (mapKind === "shipwreck" && /^world($|[_])/i.test(name.trim())) return "ground";

  // Harvest — trees / rocks / ore (world assets, not path cobble)
  if (/palm|pine|oak|fir|spruce|cedar|canopy|foliage|bark|leaf|leaves|trunk|stump|b[uû]che|souche|demi-b[uû]che|bois_0|tree/i.test(s)) {
    if (!/street|path|road|tile/i.test(s)) return "harvest";
  }
  if (/boulder|pebble|gravel|rubble|slate|ore|harvest/i.test(s)) return "harvest";
  if (/rock/i.test(s) && !/tore|metal|bedrock/i.test(s)) return "harvest";
  if (/palmtree|tree_|_tree|rock$/i.test(name)) return "harvest";

  // Interact (benches, chests, barrels, workstations)
  if (
    /bench|table|forge|anvil|work|chest|crate|barrel|tonneau|bo[iî]te|box-|grave|altar|campfire|flag|door|gate/i.test(
      s,
    )
  ) {
    return "interact";
  }

  // Vehicle
  if (/ship|boat|wreck|raft|hull|mast/i.test(s)) return "vehicle";

  // Solid structures
  if (
    /lighthouse|wall|fence|barri[eè]re|building|house|hut|tower|ruin|pillar|dock|pier|bridge|rail|fort|casque|bouclier|shield/i.test(
      s,
    )
  ) {
    return "solid";
  }

  return "prop";
}

export function materialNamesOf(mesh: THREE.Mesh): string[] {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.map((m) => (m && "name" in m ? String((m as THREE.Material).name || "") : ""));
}

/**
 * Traverse scene, assign userData.gameLayer + collect layer buckets.
 */
export function classifyIslandScene(
  root: THREE.Object3D,
  mapKind: "arena" | "shipwreck" | "generic" = "generic",
): Omit<IslandMapLayers, "root" | "scale" | "boundHalf" | "footprint"> {
  const ground: THREE.Mesh[] = [];
  const solids: THREE.Object3D[] = [];
  const climbables: THREE.Object3D[] = [];
  const swim: THREE.Object3D[] = [];
  const burn: THREE.Object3D[] = [];
  const oceanFloor: THREE.Object3D[] = [];
  const harvestables: THREE.Object3D[] = [];
  const vehicles: THREE.Object3D[] = [];
  const interactables: THREE.Object3D[] = [];
  const claimVolumes: THREE.Object3D[] = [];
  const enemyZones: THREE.Object3D[] = [];
  const rewards: THREE.Object3D[] = [];
  const navSources: THREE.Mesh[] = [];
  let waterBox: THREE.Box3 | null = null;
  let burnBox: THREE.Box3 | null = null;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const isMesh = mesh.isMesh === true;
    const mats = isMesh ? materialNamesOf(mesh) : [];
    const role = classifyIslandMesh(o.name, mats, mapKind);

    if (role === "exclude") {
      o.visible = false;
      o.userData.excluded = true;
      applyGameLayer(o, "exclude");
      return;
    }

    const tag = roleToGameTag(role);
    applyGameLayer(o, tag, {
      sensor:
        role === "climb" ||
        role === "swim" ||
        role === "burn" ||
        role === "claim" ||
        role === "enemy_zone" ||
        role === "reward",
    });
    o.userData.islandRole = role;
    o.userData.mapKind = mapKind;

    if (role === "ground") {
      o.userData.nav = true;
      if (isMesh) {
        ground.push(mesh);
        navSources.push(mesh);
        mesh.receiveShadow = true;
      }
    } else if (role === "ocean_floor") {
      o.userData.nav = true;
      oceanFloor.push(o);
      if (isMesh) {
        navSources.push(mesh);
        mesh.receiveShadow = true;
      }
    } else if (role === "solid") {
      solids.push(o);
      if (isMesh) mesh.castShadow = true;
    } else if (role === "climb") {
      climbables.push(o);
    } else if (role === "swim") {
      swim.push(o);
      if (isMesh) {
        const b = new THREE.Box3().setFromObject(mesh);
        waterBox = waterBox ? waterBox.union(b) : b.clone();
      }
    } else if (role === "burn") {
      burn.push(o);
      if (isMesh) {
        const b = new THREE.Box3().setFromObject(mesh);
        burnBox = burnBox ? burnBox.union(b) : b.clone();
      }
    } else if (role === "harvest") {
      const isWood = /palm|tree|b[uû]che|souche|bois/i.test(o.name + mats.join(" "));
      o.userData.harvest = {
        kind: isWood ? "wood" : "ore",
        tool: isWood ? "axe" : "pick",
        hp: isWood ? 40 : 60,
        label: o.name || (isWood ? "Wood" : "Rock"),
        materialId: isWood ? "oak-log" : "iron-ore",
      };
      o.userData.harvestMaterialId = o.userData.harvest.materialId;
      o.userData.harvestTool = o.userData.harvest.tool;
      harvestables.push(o);
      if (isMesh) mesh.castShadow = true;
    } else if (role === "vehicle") {
      o.userData.vehicleKind = /ship|boat/i.test(o.name) ? "boat" : "raft";
      vehicles.push(o);
    } else if (role === "interact") {
      o.userData.interact = true;
      o.userData.interactId = o.name || "interact";
      interactables.push(o);
    } else if (role === "claim") {
      claimVolumes.push(o);
    } else if (role === "enemy_zone") {
      enemyZones.push(o);
    } else if (role === "reward") {
      rewards.push(o);
    }
  });

  const waterBand = waterBox
    ? { bottom: waterBox.min.y - 0.5, top: waterBox.max.y + 0.05 }
    : null;
  const burnBand = burnBox
    ? { bottom: burnBox.min.y - 0.2, top: burnBox.max.y + 0.4 }
    : null;

  return {
    ground,
    solids,
    climbables,
    swim,
    burn,
    oceanFloor,
    harvestables,
    vehicles,
    interactables,
    claimVolumes,
    enemyZones,
    rewards,
    navSources,
    waterBand,
    burnBand,
  };
}

export function reGroundToY0(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.y)) return;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

export function centerXZ(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.x)) return;
  root.position.x -= (box.min.x + box.max.x) / 2;
  root.position.z -= (box.min.z + box.max.z) / 2;
  root.updateMatrixWorld(true);
}

export function measureFootprint(root: THREE.Object3D): {
  min: THREE.Vector3;
  max: THREE.Vector3;
  boundHalf: number;
} {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const min = box.min.clone();
  const max = box.max.clone();
  const hx = Math.max(16, (max.x - min.x) * 0.55);
  const hz = Math.max(16, (max.z - min.z) * 0.55);
  return { min, max, boundHalf: Math.min(120, Math.max(hx, hz)) };
}

/** Collider plan for Rapier bake from classified object. */
export function colliderPlanForIslandObject(o: THREE.Object3D): {
  type: "cuboid" | "trimesh" | "sphere" | "sensor_box";
  layer: IslandMeshRole | GameLayerTag;
  sensor?: boolean;
} | null {
  const layer =
    (o.userData.islandRole as IslandMeshRole) ||
    (o.userData.gameLayer as GameLayerTag) ||
    "prop";
  if (layer === "exclude" || o.userData.excluded) return null;
  if (
    layer === "swim" ||
    layer === "climb" ||
    layer === "burn" ||
    layer === "claim" ||
    layer === "enemy_zone" ||
    layer === "reward" ||
    o.userData.sensor
  ) {
    return { type: "sensor_box", layer, sensor: true };
  }
  if (layer === "ground" || layer === "terrain" || layer === "ocean_floor") {
    return { type: "trimesh", layer: "ground", sensor: false };
  }
  if (layer === "solid" || layer === "vehicle" || layer === "world") {
    return { type: "trimesh", layer, sensor: false };
  }
  if (layer === "harvest" || layer === "interact") {
    return { type: "cuboid", layer, sensor: false };
  }
  return null;
}

/**
 * Create a cylindrical claim volume at a world position (flag plant).
 * Sensor only — grants build rights when player inside.
 */
export function createClaimVolume(
  center: THREE.Vector3,
  radiusM = 12,
  heightM = 8,
  claimId = "claim_local",
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radiusM, radiusM, heightM, 24, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x4fc3ff,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.position.y += heightM * 0.5;
  mesh.name = `ClaimVolume_${claimId}`;
  applyGameLayer(mesh, "claim", { sensor: true, claimId });
  mesh.userData.claimRadius = radiusM;
  return mesh;
}

/**
 * Create an enemy-zone box (aggro / encounter). Sensor.
 */
export function createEnemyZoneBox(
  center: THREE.Vector3,
  half: { x: number; y: number; z: number },
  zoneId = "zone_local",
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.name = `EnemyZone_${zoneId}`;
  applyGameLayer(mesh, "enemy_zone", { sensor: true, zoneId, faction: "enemy" });
  return mesh;
}
