/**
 * Low Poly Farm pack — clean named meshes for farm props (pairs with Amida layout).
 * R2: models/packs/low_poly_farm.glb
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import type { BlockTypeId } from "@workspace/voxel-canonical";

export const LOW_POLY_FARM_R2_KEY = "models/packs/low_poly_farm.glb";

export interface FarmPiece {
  meshIndex: number;
  name: string;
  role: string;
  group: "field" | "farm" | "structure" | "prop";
  codexTerrain: BlockTypeId;
}

export const FARM_PIECES: readonly FarmPiece[] = [
  { meshIndex: 0, name: "Ground_grass 2_0", role: "grass_a", group: "field", codexTerrain: "grass" },
  { meshIndex: 1, name: "Ground_Grass_0", role: "grass_b", group: "field", codexTerrain: "grass" },
  { meshIndex: 2, name: "Ground_05 - Default_0", role: "ground_misc_a", group: "field", codexTerrain: "dirt" },
  { meshIndex: 3, name: "Ground_Dirt2_0", role: "dirt_a", group: "farm", codexTerrain: "dirt" },
  { meshIndex: 4, name: "Ground_Dirt_0", role: "dirt_b", group: "farm", codexTerrain: "dirt" },
  { meshIndex: 5, name: "Ground_Dirt4_0", role: "dirt_c", group: "farm", codexTerrain: "dirt" },
  { meshIndex: 6, name: "Ground_grass 3_0", role: "grass_c", group: "field", codexTerrain: "grass" },
  { meshIndex: 7, name: "Ground_grass 3_0", role: "grass_d", group: "field", codexTerrain: "grass" },
  { meshIndex: 8, name: "Ground_grass 3_0", role: "grass_e", group: "field", codexTerrain: "grass" },
  { meshIndex: 9, name: "Ground_barn 2_0", role: "barn_a", group: "structure", codexTerrain: "woodPlanks" },
  { meshIndex: 10, name: "Ground_03 - Default_0", role: "structure_a", group: "structure", codexTerrain: "woodPlanks" },
  { meshIndex: 11, name: "Ground_11 - Default_0", role: "structure_b", group: "structure", codexTerrain: "log" },
  { meshIndex: 12, name: "Ground_barn_0", role: "barn_b", group: "structure", codexTerrain: "brickRed" },
  { meshIndex: 13, name: "Ground_08 - Default_0", role: "structure_c", group: "structure", codexTerrain: "woodPlanks" },
  { meshIndex: 14, name: "Ground_metal_0", role: "metal_a", group: "prop", codexTerrain: "brickGrey" },
  { meshIndex: 15, name: "Ground_23 - Default_0", role: "prop_a", group: "prop", codexTerrain: "blockSquare" },
  { meshIndex: 16, name: "Ground_14 - Default_0", role: "prop_b", group: "prop", codexTerrain: "blockSquare" },
  { meshIndex: 17, name: "Ground_Material #4640_0", role: "prop_c", group: "prop", codexTerrain: "blockBlank" },
  { meshIndex: 18, name: "Ground_yellow 2_0", role: "hay_a", group: "farm", codexTerrain: "brickYellow" },
  { meshIndex: 19, name: "Ground_04 - Default_0", role: "prop_d", group: "prop", codexTerrain: "woodPlanks" },
  { meshIndex: 20, name: "Ground_22 - Default_0", role: "prop_e", group: "prop", codexTerrain: "log" },
  { meshIndex: 21, name: "Ground_Pumpkin_0", role: "pumpkin_a", group: "farm", codexTerrain: "leaves" },
  { meshIndex: 22, name: "Ground_Pumpkin_0", role: "pumpkin_b", group: "farm", codexTerrain: "leaves" },
  { meshIndex: 23, name: "Ground_Pumpkin_0", role: "pumpkin_c", group: "farm", codexTerrain: "leaves" },
  { meshIndex: 24, name: "Ground_Pumpkin_0", role: "pumpkin_d", group: "farm", codexTerrain: "leaves" },
  { meshIndex: 25, name: "Ground_metal 2_0", role: "metal_b", group: "prop", codexTerrain: "brickGrey" },
  { meshIndex: 26, name: "Object001_metal_0", role: "metal_prop_a", group: "prop", codexTerrain: "brickGrey" },
  { meshIndex: 27, name: "Object002_metal_0", role: "metal_prop_b", group: "prop", codexTerrain: "brickGrey" },
] as const;

export function farmPiecesByGroup(group: FarmPiece["group"]): FarmPiece[] {
  return FARM_PIECES.filter((p) => p.group === group);
}

let packRoot: THREE.Object3D | null = null;
let packMeshes: THREE.Mesh[] = [];
let packLoad: Promise<void> | null = null;

export async function ensureFarmPackLoaded(): Promise<boolean> {
  if (packRoot && packMeshes.length) return true;
  if (!packLoad) {
    packLoad = (async () => {
      const { scene } = await loadGltfFirst(
        [LOW_POLY_FARM_R2_KEY, "models/packs/low_poly_farm.glb"],
        sharedGltfLoader(),
        { prepMaterials: true },
      );
      packRoot = scene;
      const meshes: THREE.Mesh[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) meshes.push(m);
      });
      // Prefer catalog name order
      meshes.sort((a, b) => {
        const ia = FARM_PIECES.findIndex((p) => p.name === a.name);
        const ib = FARM_PIECES.findIndex((p) => p.name === b.name);
        if (ia >= 0 && ib >= 0) return ia - ib;
        return a.name.localeCompare(b.name);
      });
      packMeshes = meshes;
      console.info(`[farmPack] loaded meshes=${packMeshes.length}`);
    })().catch((err) => {
      packLoad = null;
      console.warn("[farmPack] load failed", err);
      throw err;
    });
  }
  try {
    await packLoad;
    return !!(packRoot && packMeshes.length);
  } catch {
    return false;
  }
}

export async function extractFarmPiece(
  meshIndex: number,
  targetHeight = 1.4,
): Promise<THREE.Group | null> {
  const ok = await ensureFarmPackLoaded();
  if (!ok) return null;
  const src = packMeshes[meshIndex];
  if (!src) return null;
  const piece = FARM_PIECES[meshIndex];
  const wrap = new THREE.Group();
  wrap.add(src.clone(true));
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y || 1;
  wrap.scale.setScalar(targetHeight / h);
  wrap.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(wrap);
  const c = box2.getCenter(new THREE.Vector3());
  wrap.position.x -= c.x;
  wrap.position.z -= c.z;
  wrap.position.y -= box2.min.y;
  wrap.userData.farmPack = {
    meshIndex,
    role: piece?.role,
    group: piece?.group,
    codexTerrain: piece?.codexTerrain,
  };
  wrap.name = `farm:${piece?.role ?? meshIndex}`;
  return wrap;
}

/** Scatter barn + pumpkin + dirt accents into Amida-style lab. */
export async function scatterFarmPackProps(
  parent: THREE.Object3D,
): Promise<number> {
  const ok = await ensureFarmPackLoaded();
  if (!ok) return 0;
  let n = 0;
  const barns = farmPiecesByGroup("structure").slice(0, 3);
  const crops = farmPiecesByGroup("farm").filter((p) => p.role.startsWith("pumpkin"));
  const dirt = farmPiecesByGroup("farm").filter((p) => p.role.startsWith("dirt"));

  for (let i = 0; i < barns.length; i++) {
    const inst = await extractFarmPiece(barns[i]!.meshIndex, 2.2);
    if (!inst) continue;
    const ang = (i / Math.max(1, barns.length)) * Math.PI * 2;
    inst.position.set(Math.cos(ang) * 6, 0, Math.sin(ang) * 6);
    inst.rotation.y = -ang;
    parent.add(inst);
    n++;
  }

  const plotCenters: [number, number][] = [
    [-10, -10],
    [10, -10],
    [-10, 10],
    [10, 10],
  ];
  for (let i = 0; i < plotCenters.length; i++) {
    const piece = crops[i % Math.max(1, crops.length)] ?? dirt[i % Math.max(1, dirt.length)];
    if (!piece) continue;
    const inst = await extractFarmPiece(piece.meshIndex, 0.8);
    if (!inst) continue;
    const [x, z] = plotCenters[i]!;
    inst.position.set(x, 0, z);
    parent.add(inst);
    n++;
  }

  return n;
}
