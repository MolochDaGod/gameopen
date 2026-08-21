/**
 * Isolate one harvest tool from toolsvoxel.glb and parent it on uMMORPG sockets.
 * Same attach contract as WingBackRig — not a second equipment stack.
 */
import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { attachToSocket, resolveSkeletonSockets } from "../ummorpg/skeletonSockets";
import {
  VOXEL_TOOLS_PACK,
  voxelMeshForActivity,
  type VoxelToolMesh,
} from "../arsenal/voxelTools";

const HELD_NAME = "__voxelHarvestTool";

function isolateNamed(root: THREE.Object3D, isolate: string): THREE.Object3D | null {
  const want = isolate.toLowerCase();
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (hit || !o.name) return;
    const n = o.name.toLowerCase();
    if (n === want || n.startsWith(want)) hit = o;
  });
  return hit;
}

function fitLongestAxis(obj: THREE.Object3D, lengthM: number) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (longest < 1e-6) return;
  obj.scale.multiplyScalar(lengthM / longest);
}

export class VoxelHarvestToolRig {
  private pack: THREE.Object3D | null = null;
  private held: THREE.Object3D | null = null;
  private currentId: string | null = null;
  private kitWeaponVis: Array<{ mesh: THREE.Object3D; vis: boolean }> = [];

  async ensurePack(): Promise<THREE.Object3D | null> {
    if (this.pack) return this.pack;
    try {
      const { scene } = await loadGltfFirst(VOXEL_TOOLS_PACK, sharedGltfLoader());
      this.pack = scene;
      return scene;
    } catch (err) {
      console.warn("[VoxelHarvestToolRig] pack miss", VOXEL_TOOLS_PACK, err);
      return null;
    }
  }

  clear() {
    if (this.held?.parent) this.held.parent.remove(this.held);
    this.held = null;
    this.currentId = null;
    for (const row of this.kitWeaponVis) row.mesh.visible = row.vis;
    this.kitWeaponVis = [];
  }

  async equip(characterRoot: THREE.Object3D, toolId: string): Promise<boolean> {
    const spec = voxelMeshForActivity(toolId);
    if (!spec) {
      this.clear();
      return false;
    }
    if (this.currentId === toolId && this.held?.parent) return true;

    const pack = await this.ensurePack();
    if (!pack) return false;
    const src = isolateNamed(pack, spec.isolate);
    if (!src) {
      console.warn("[VoxelHarvestToolRig] isolate miss", spec.isolate);
      this.clear();
      return false;
    }

    this.clear();
    const clone = src.clone(true);
    clone.name = HELD_NAME;
    clone.userData.voxelTool = toolId;
    clone.userData.isolate = spec.isolate;
    fitLongestAxis(clone, spec.lengthM);

    const sockets = resolveSkeletonSockets(characterRoot);
    const parent = attachToSocket(clone, sockets, spec.socket);
    if (!parent) {
      console.warn("[VoxelHarvestToolRig] no hand socket");
      return false;
    }
    this.held = clone;
    this.currentId = toolId;
    this.hideKitWeapons(characterRoot);
    return true;
  }

  private hideKitWeapons(root: THREE.Object3D) {
    this.kitWeaponVis = [];
    root.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      if (o.name === HELD_NAME || o.userData.voxelTool) return;
      if (!/weapon|sword|axe|bow|staff|spear|dagger|hammer|mace|shield|quiver/i.test(o.name))
        return;
      this.kitWeaponVis.push({ mesh: o, vis: o.visible });
      o.visible = false;
    });
  }
}

export type { VoxelToolMesh };
