/**
 * Starting-scene terrain + mesh recognition for Encament / lobby seed play.
 *
 * Reuses classifyForestMeshGeometry (Forest Mountains) plus name tokens.
 * Tags sticks / stones / logs so Q-harvest + pinata work — no second gather engine.
 */
import * as THREE from "three";
import { classifyForestMeshGeometry } from "../maps/forestMountainsMap";
import { locationIdForCell } from "../harvest/harvestIds";

export type StartHarvestKind = "stick" | "stone" | "wood" | "ore" | "terrain" | "skip";

export type StartHarvestNode = {
  id: string;
  kind: StartHarvestKind;
  tool: "gather" | "axe" | "pick";
  materialId: string;
  yields: string[];
  hp: number;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
};

export type StartHarvestReport = {
  nodes: StartHarvestNode[];
  classified: number;
  scattered: number;
  terrain: number;
};

const NAME_STICK = /stick|twig|branch|log|wood|plank|fence|post|timber|bark|trunk|stump/i;
const NAME_STONE = /stone|rock|pebble|cobble|boulder|gravel|rubble|slate/i;
const NAME_TERRAIN = /ground|terrain|floor|path|dirt|sand|grass|water|hub|road|tile/i;
const NAME_SKIP = /building|wall|roof|house|door|window|chair|table|npc|enemy|character|collider/i;

export function classifyStartMeshName(name: string): StartHarvestKind | null {
  const n = name || "";
  if (NAME_SKIP.test(n)) return "skip";
  if (NAME_TERRAIN.test(n)) return "terrain";
  if (NAME_STONE.test(n)) return "stone";
  if (NAME_STICK.test(n)) return "stick";
  return null;
}

export function classifyStartMeshGeometry(size: THREE.Vector3): StartHarvestKind {
  const footprint = size.x * size.z;
  const aspect = size.y / Math.max(size.x, size.z, 0.01);
  const role = classifyForestMeshGeometry(size, footprint, aspect);
  if (role === "ground") return "terrain";
  if (role === "wood") return size.y < 1.25 ? "stick" : "wood";
  if (role === "ore") return size.y < 0.85 && footprint < 1.4 ? "stone" : "ore";
  if (role === "skip") return "skip";
  if (aspect < 0.9 && size.y < 0.55) return "stone";
  return "stick";
}

function metaFor(kind: StartHarvestKind): {
  tool: StartHarvestNode["tool"];
  materialId: string;
  yields: string[];
  hp: number;
} | null {
  if (kind === "stick") return { tool: "gather", materialId: "mat_stick", yields: ["mat_stick"], hp: 8 };
  if (kind === "stone") return { tool: "gather", materialId: "mat_stone", yields: ["mat_stone"], hp: 10 };
  if (kind === "wood") return { tool: "axe", materialId: "mat_log", yields: ["mat_log", "mat_stick"], hp: 40 };
  if (kind === "ore") return { tool: "pick", materialId: "mat_stone", yields: ["mat_stone"], hp: 36 };
  return null;
}

function makeSeedRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Walk a starting scene (town chunk + seed terrain). Tag harvestable meshes.
 * If the GLB has almost no debris, scatter starter sticks/stones outside the hub.
 */
export function tagStartSceneHarvest(
  root: THREE.Object3D,
  opts?: { seed?: string | number; hubRadius?: number; scatterMin?: number },
): StartHarvestReport {
  const seed = String(opts?.seed ?? "start");
  const hub = opts?.hubRadius ?? 16;
  const scatterMin = opts?.scatterMin ?? 10;
  const nodes: StartHarvestNode[] = [];
  let classified = 0;
  let terrain = 0;

  root.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  const box = new THREE.Box3();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.mapChunk) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      mesh.userData.selectable = "ground";
      mesh.userData.startTerrain = true;
      terrain++;
      classified++;
      return;
    }
    if (mesh.userData.harvestable || mesh.userData.startHarvestSkip) return;
    box.setFromObject(mesh);
    if (box.isEmpty()) return;
    box.getSize(size);
    const byName = classifyStartMeshName(mesh.name);
    const kind = byName ?? classifyStartMeshGeometry(size);
    classified++;
    if (kind === "terrain") {
      terrain++;
      mesh.userData.selectable = "ground";
      mesh.userData.startTerrain = true;
      return;
    }
    const spec = metaFor(kind);
    if (!spec) {
      mesh.userData.startHarvestSkip = true;
      return;
    }
    const pos = box.getCenter(new THREE.Vector3());
    const id = locationIdForCell(seed, pos.x, pos.y, pos.z, kind);
    mesh.userData.harvestable = true;
    mesh.userData.harvestId = id;
    mesh.userData.harvestKind = kind;
    mesh.userData.harvestTool = spec.tool;
    mesh.userData.harvestMaterialId = spec.materialId;
    mesh.userData.harvestYields = spec.yields;
    mesh.userData.selectable = "harvest";
    nodes.push({
      id,
      kind,
      tool: spec.tool,
      materialId: spec.materialId,
      yields: spec.yields,
      hp: spec.hp,
      mesh,
      position: pos,
    });
  });

  let scattered = 0;
  if (nodes.filter((n) => n.kind === "stick" || n.kind === "stone").length < scatterMin) {
    scattered = scatterStarterPickups(root, seed, hub, nodes);
  }

  return { nodes, classified, scattered, terrain };
}

function scatterStarterPickups(
  root: THREE.Object3D,
  seed: string,
  hub: number,
  nodes: StartHarvestNode[],
): number {
  const rng = makeSeedRng(hashStr(seed) ^ 0x57a11);
  const group = new THREE.Group();
  group.name = "start-harvest-scatter";
  const stickGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.55, 5);
  const stoneGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85 });
  let n = 0;
  const want = [
    ...Array.from({ length: 8 }, () => "stick" as const),
    ...Array.from({ length: 6 }, () => "stone" as const),
  ];
  for (let i = 0; i < want.length; i++) {
    const kind = want[i]!;
    const spec = metaFor(kind)!;
    const ang = rng() * Math.PI * 2;
    const dist = hub + 4 + rng() * 18;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const mesh = new THREE.Mesh(kind === "stick" ? stickGeo : stoneGeo, kind === "stick" ? stickMat : stoneMat);
    mesh.name = kind === "stick" ? "start_stick" : "start_stone";
    mesh.position.set(x, kind === "stick" ? 0.28 : 0.12, z);
    mesh.rotation.z = kind === "stick" ? Math.PI / 2.4 : 0;
    mesh.castShadow = true;
    const id = locationIdForCell(seed, x, 0, z, `scatter_${kind}_${i}`);
    mesh.userData.harvestable = true;
    mesh.userData.harvestId = id;
    mesh.userData.harvestKind = kind;
    mesh.userData.harvestTool = spec.tool;
    mesh.userData.harvestMaterialId = spec.materialId;
    mesh.userData.harvestYields = spec.yields;
    mesh.userData.selectable = "harvest";
    mesh.userData.startScattered = true;
    group.add(mesh);
    nodes.push({
      id,
      kind,
      tool: spec.tool,
      materialId: spec.materialId,
      yields: spec.yields,
      hp: spec.hp,
      mesh,
      position: mesh.position.clone(),
    });
    n++;
  }
  root.add(group);
  return n;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
