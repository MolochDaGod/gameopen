/**
 * Live Toon RTS ★ GLBs — already one Bip001_* armature (Object3D "Bip001"
 * parent, Bone "Bip001_Pelvis" root). Play refuse was counting Skeleton
 * wrapper UUIDs (23/27), not bone trees.
 */
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { unifySkeletons } from "./skeleton";
import { countVisibleSkeletonRoots, validateCharacterDeploy } from "../characterDeploy";
import { getPreset } from "./gearPresets";
import type { RaceId } from "./raceAssets";

if (typeof (globalThis as { self?: unknown }).self === "undefined") {
  (globalThis as { self: typeof globalThis }).self = globalThis;
}

const CDN = "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters";
const KITS: Array<{ race: RaceId; file: string; liveUuidFail: number }> = [
  { race: "western-kingdoms", file: "human.glb", liveUuidFail: 23 },
  { race: "barbarians", file: "barbarian.glb", liveUuidFail: 27 },
  { race: "high-elves", file: "elf.glb", liveUuidFail: 0 },
  { race: "dwarves", file: "dwarf.glb", liveUuidFail: 0 },
  { race: "orcs", file: "orc.glb", liveUuidFail: 0 },
  { race: "undead", file: "undead.glb", liveUuidFail: 0 },
];

function meshKey(name: string): string {
  return name.replace(/[.\s]/g, "_");
}

function applyWarrior(group: THREE.Object3D, want: string[]) {
  const wantKeys = want.map(meshKey);
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
    node.visible = false;
  });
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
    const key = meshKey(node.name);
    if (wantKeys.some((w) => key === w || key.endsWith(w) || w.endsWith(key))) {
      node.visible = true;
    }
  });
}

function countNamedBones(root: THREE.Object3D, name: string): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name === name) n++;
  });
  return n;
}

function countSkeletonUuids(model: THREE.Object3D, visibleOnly = false): number {
  const ids = new Set<string>();
  model.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    if (visibleOnly && sm.visible === false) return;
    ids.add(sm.skeleton.uuid);
  });
  return ids.size;
}

function uniqueBoneObjects(model: THREE.Object3D): number {
  const ids = new Set<string>();
  model.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    for (const b of sm.skeleton.bones) if (b) ids.add(b.uuid);
  });
  return ids.size;
}

async function loadToonGlb(file: string): Promise<THREE.Object3D> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const url = `${CDN}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => {
    if (/^data:/i.test(u) || /\.(png|jpe?g|webp|ktx2|gif)$/i.test(u)) {
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    }
    return u;
  });
  const loader = new GLTFLoader(manager);
  const gltf = await loader.parseAsync(buf, `${CDN}/`);
  return gltf.scene;
}

describe("Toon RTS GLB play kits (CDN)", () => {
  beforeAll(async () => {
    const probe = await fetch(`${CDN}/human.glb`, { method: "HEAD" }).catch(() => null);
    if (!probe?.ok) {
      throw new Error(`Toon RTS CDN unreachable: ${CDN}/human.glb`);
    }
  }, 30_000);

  it.each(KITS)(
    "$race $file is one Bip001_Pelvis tree (old gate counted Skeleton UUIDs)",
    async ({ race, file, liveUuidFail }) => {
      const model = await loadToonGlb(file);
      const uuidWrappers = countSkeletonUuids(model);
      expect(uuidWrappers).toBeGreaterThan(1);
      if (liveUuidFail) expect(uuidWrappers).toBe(liveUuidFail);
      expect(uniqueBoneObjects(model)).toBeGreaterThan(10);
      expect(countNamedBones(model, "Bip001_Pelvis")).toBe(1);

      unifySkeletons(model);
      applyWarrior(model, getPreset(race, "warrior").visibleMeshes);

      expect(countNamedBones(model, "Bip001_Pelvis")).toBe(1);
      expect(countVisibleSkeletonRoots(model)).toBe(1);
      const issues = validateCharacterDeploy(model).issues.filter((i) =>
        i.includes("multiple skeletons"),
      );
      expect(issues).toEqual([]);
      expect(model.userData.skeletonUnified).toBe(true);
    },
    60_000,
  );
});
