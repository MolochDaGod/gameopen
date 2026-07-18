/**
 * Forest Map + Sailtest outdoor world loader.
 *
 * - Loads terrain GLB from fleet R2 (CDN) via loadGltfFirst — not from git
 * - Strips chicken-gun trees/rocks/leaves by mesh name
 * - Scatters Warlords stylized nature + harvest nodes (ore, flowers, foliage)
 * - Places wildlife markers for skin harvest tests
 * - Tags harvestables for LMB select / RMB approach in production harvest mode
 *
 * Asset pipeline: docs/OUTDOOR_ASSETS_D1_R2.md (upload-outdoor-r2 + seed-outdoor-d1).
 */

import * as THREE from "three";
import { loadGltfFirst } from "./assets";
import { sharedGltfLoader } from "./loaders/gltf";
import {
  FOREST_STRIP_NAME_RE,
  WARLORDS_NATURE,
  type TestWorldDef,
  type TestWorldId,
} from "./testWorlds";
import { SailEnvironment } from "./SailEnvironment";

export type HarvestNodeKind = "wood" | "ore" | "flower" | "forage" | "skin" | "mine";

export type HarvestNode = {
  id: string;
  kind: HarvestNodeKind;
  tool: string;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  remaining: number;
};

export type ForestWorldCallbacks = {
  flash?: (msg: string, t?: number) => void;
};

function stripReplacedMeshes(root: THREE.Object3D): number {
  let n = 0;
  const hide: THREE.Object3D[] = [];
  root.traverse((o) => {
    const name = `${o.name} ${(o as THREE.Mesh).geometry?.type || ""}`;
    if (FOREST_STRIP_NAME_RE.test(name) || FOREST_STRIP_NAME_RE.test(o.name)) {
      // Keep large terrain planes
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const box = new THREE.Box3().setFromObject(o);
        const size = new THREE.Vector3();
        box.getSize(size);
        // Huge flat ground stays
        if (size.x > 40 && size.z > 40 && size.y < 4) return;
        hide.push(o);
      }
    }
  });
  for (const o of hide) {
    o.visible = false;
    o.userData.strippedForWarlords = true;
    n++;
  }
  return n;
}

function pickChildren(root: THREE.Object3D, max = 12): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) meshes.push(m);
  });
  if (meshes.length === 0) return [root];
  // Prefer mid-size props
  const scored = meshes
    .map((m) => {
      const b = new THREE.Box3().setFromObject(m);
      const s = new THREE.Vector3();
      b.getSize(s);
      const vol = s.x * s.y * s.z;
      return { m, vol };
    })
    .filter((x) => x.vol > 0.01 && x.vol < 80)
    .sort((a, b) => b.vol - a.vol);
  const out: THREE.Object3D[] = [];
  for (const x of scored) {
    if (out.length >= max) break;
    // Avoid children of already picked
    if (out.some((p) => p === x.m.parent || p.children.includes(x.m))) continue;
    out.push(x.m);
  }
  return out.length ? out : meshes.slice(0, max);
}

function cloneIsolated(src: THREE.Object3D, scale = 1): THREE.Object3D {
  const c = src.clone(true);
  // Detach from parent hierarchy volume
  c.position.set(0, 0, 0);
  c.rotation.set(0, 0, 0);
  c.scale.setScalar(1);
  const wrap = new THREE.Group();
  wrap.add(c);
  // Ground to y=0
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  wrap.position.y -= box.min.y;
  if (scale !== 1) wrap.scale.setScalar(scale);
  wrap.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(wrap);
  wrap.position.y -= box2.min.y;
  return wrap;
}

function ringPositions(
  count: number,
  radius: number,
  y = 0,
  jitter = 1.2,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const r = radius + (Math.random() - 0.5) * jitter * 2;
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}

export class ForestWorld {
  readonly group = new THREE.Group();
  private terrain: THREE.Object3D | null = null;
  private natureRoot = new THREE.Group();
  private harvestNodes: HarvestNode[] = [];
  private activeId: TestWorldId | null = null;
  private sailEnv: SailEnvironment | null = null;
  private readonly scene: THREE.Scene;
  private readonly cbs: ForestWorldCallbacks;

  constructor(scene: THREE.Scene, cbs: ForestWorldCallbacks = {}) {
    this.scene = scene;
    this.cbs = cbs;
    this.group.name = "ForestWorld";
    this.natureRoot.name = "warlords-nature";
    this.group.add(this.natureRoot);
    scene.add(this.group);
  }

  get worldId(): TestWorldId | null {
    return this.activeId;
  }

  get nodes(): readonly HarvestNode[] {
    return this.harvestNodes;
  }

  get sail(): SailEnvironment | null {
    return this.sailEnv;
  }

  clear() {
    if (this.terrain) {
      this.group.remove(this.terrain);
      this.terrain = null;
    }
    while (this.natureRoot.children.length) {
      this.natureRoot.remove(this.natureRoot.children[0]!);
    }
    this.harvestNodes = [];
    this.activeId = null;
    if (this.sailEnv) {
      this.sailEnv.dispose();
      this.sailEnv = null;
    }
  }

  /**
   * Load outdoor map. danger-room → clear outdoor only.
   */
  async load(def: TestWorldDef): Promise<boolean> {
    this.clear();
    this.activeId = def.id;

    if (def.kind === "combat" || !def.meshKeys?.length) {
      this.cbs.flash?.("MAP · Danger Room (combat)", 0.9);
      return true;
    }

    try {
      const { scene, url } = await loadGltfFirst(def.meshKeys, sharedGltfLoader(), {
        prepMaterials: true,
      });
      // Fit loosely — keep author scale for forest; island already handled in camp
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      // Center XZ, seat on y=0
      const center = new THREE.Vector3();
      box.getCenter(center);
      scene.position.x -= center.x;
      scene.position.z -= center.z;
      scene.position.y -= box.min.y;
      scene.name = `terrain:${def.id}`;
      scene.userData.testWorldId = def.id;
      scene.userData.uuid = def.uuid;
      scene.userData.seed = def.seed;
      scene.userData.sourceUrl = url;

      let stripped = 0;
      if (def.natureReplace) {
        stripped = stripReplacedMeshes(scene);
      }

      this.group.add(scene);
      this.terrain = scene;

      // Sailtest: Sky + water + wind + sand (islands near sea level)
      if (def.sailing) {
        this.sailEnv = new SailEnvironment(this.scene);
        await this.sailEnv.mount({
          waterY: 0.12,
          waterSize: 480,
          windStrength: 0.6,
          sunElevationDeg: 32,
          sunAzimuthDeg: 158,
        });
        this.sailEnv.seatIslandsNearWater(scene, 0.1);
        await this.sailEnv.retouchTerrain(scene);
      }

      if (def.natureReplace || def.harvestScatter) {
        await this.scatterWarlords(def);
      }

      // Light tropical accents on sailtest beaches
      if (def.sailing) {
        try {
          await this.scatterTropicalCoast(def);
        } catch {
          /* optional */
        }
      }

      this.cbs.flash?.(
        `${def.name.toUpperCase()} · ${stripped ? `stripped ${stripped} · ` : ""}${this.harvestNodes.length} harvest · ${def.sailing ? "water+wind+sky" : "outdoor"}`,
        1.5,
      );
      return true;
    } catch (err) {
      console.warn("[ForestWorld] load failed", def.id, err);
      this.cbs.flash?.(`${def.name} load failed`, 1.2);
      return false;
    }
  }

  private async scatterWarlords(def: TestWorldDef) {
    const loader = sharedGltfLoader();
    const packs: Array<{
      key: string;
      kind: HarvestNodeKind;
      tool: string;
      count: number;
      radius: number;
      scale: number;
    }> = [
      { key: WARLORDS_NATURE.trees, kind: "wood", tool: "chop", count: 10, radius: 14, scale: 1.1 },
      { key: WARLORDS_NATURE.rocks, kind: "mine", tool: "mine", count: 8, radius: 11, scale: 0.9 },
      { key: WARLORDS_NATURE.flowers, kind: "flower", tool: "gather", count: 12, radius: 9, scale: 0.7 },
      { key: WARLORDS_NATURE.foliage, kind: "forage", tool: "forage", count: 10, radius: 12, scale: 0.85 },
      { key: WARLORDS_NATURE.ore, kind: "ore", tool: "mine", count: 8, radius: 10, scale: 0.8 },
      { key: WARLORDS_NATURE.minerals, kind: "ore", tool: "mine", count: 6, radius: 13, scale: 0.75 },
    ];

    for (const pack of packs) {
      try {
        const { scene } = await loadGltfFirst([pack.key, WARLORDS_NATURE.treesAlt], loader, {
          prepMaterials: true,
        });
        const variants = pickChildren(scene, 8);
        const positions = ringPositions(pack.count, pack.radius, 0, 2.5);
        for (let i = 0; i < positions.length; i++) {
          const src = variants[i % variants.length]!;
          const inst = cloneIsolated(src, pack.scale * (0.85 + Math.random() * 0.35));
          const p = positions[i]!;
          inst.position.x = p.x;
          inst.position.z = p.z;
          inst.rotation.y = Math.random() * Math.PI * 2;
          // Re-ground
          inst.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(inst);
          inst.position.y -= b.min.y;

          const id = `${def.id}_${pack.kind}_${i}`;
          inst.name = `harvest:${id}`;
          inst.userData.harvestable = true;
          inst.userData.harvestKind = pack.kind;
          inst.userData.harvestTool = pack.tool;
          inst.userData.harvestId = id;
          inst.userData.selectable = "node";
          inst.userData.uuid = `${def.uuid}-${pack.kind}-${i}`;

          this.natureRoot.add(inst);
          this.harvestNodes.push({
            id,
            kind: pack.kind,
            tool: pack.tool,
            position: inst.position.clone(),
            mesh: inst,
            remaining: 3 + Math.floor(Math.random() * 3),
          });
        }
      } catch (err) {
        console.warn("[ForestWorld] pack fail", pack.key, err);
      }
    }

    // Animals for skin harvest (local creatures)
    for (let i = 0; i < 4; i++) {
      try {
        const key = WARLORDS_NATURE.animals[i % WARLORDS_NATURE.animals.length]!;
        const { scene } = await loadGltfFirst(key, loader, { prepMaterials: true });
        const inst = cloneIsolated(scene, key.includes("bear") ? 0.55 : 0.45);
        const a = (i / 4) * Math.PI * 2;
        const r = 7 + i * 1.2;
        inst.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        inst.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(inst);
        inst.position.y -= b.min.y;
        const id = `${def.id}_skin_${i}`;
        inst.name = `harvest:${id}`;
        inst.userData.harvestable = true;
        inst.userData.harvestKind = "skin";
        inst.userData.harvestTool = "skin";
        inst.userData.harvestId = id;
        inst.userData.selectable = "hostile";
        inst.userData.uuid = `${def.uuid}-skin-${i}`;
        this.natureRoot.add(inst);
        this.harvestNodes.push({
          id,
          kind: "skin",
          tool: "skin",
          position: inst.position.clone(),
          mesh: inst,
          remaining: 2,
        });
      } catch (err) {
        console.warn("[ForestWorld] animal fail", err);
      }
    }
  }

  /** Per-frame water/wind animation. */
  update(dt: number) {
    this.sailEnv?.update(dt);
  }

  private async scatterTropicalCoast(def: TestWorldDef) {
    try {
      const { scene } = await loadGltfFirst(
        ["models/nature/stylized/biome/tropical_plants.glb", WARLORDS_NATURE.foliage],
        sharedGltfLoader(),
        { prepMaterials: true },
      );
      const variants = pickChildren(scene, 6);
      const positions = ringPositions(8, 16, 0, 3);
      for (let i = 0; i < positions.length; i++) {
        const inst = cloneIsolated(variants[i % variants.length]!, 0.9);
        const p = positions[i]!;
        inst.position.x = p.x;
        inst.position.z = p.z;
        inst.rotation.y = Math.random() * Math.PI * 2;
        inst.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(inst);
        inst.position.y -= b.min.y;
        // Keep slightly above water after seat
        if (this.sailEnv) {
          inst.position.y = Math.max(inst.position.y, this.sailEnv.waterSurfaceY + 0.05);
        }
        inst.userData.coastPlant = true;
        this.natureRoot.add(inst);
      }
    } catch {
      /* pack optional */
    }
    void def;
  }

  /** Raycast harvest nodes (for LMB select in harvest mode). */
  pickHarvest(ray: THREE.Raycaster, maxDist = 28): HarvestNode | null {
    const meshes = this.harvestNodes.map((n) => n.mesh);
    if (!meshes.length) return null;
    const hits = ray.intersectObjects(meshes, true);
    for (const h of hits) {
      if (h.distance > maxDist) continue;
      let o: THREE.Object3D | null = h.object;
      while (o) {
        const id = o.userData.harvestId as string | undefined;
        if (id) {
          const node = this.harvestNodes.find((n) => n.id === id);
          if (node && node.remaining > 0) return node;
        }
        o = o.parent;
      }
    }
    return null;
  }

  /** Consume one harvest hit; hide mesh when depleted. */
  harvestNode(id: string): HarvestNode | null {
    const n = this.harvestNodes.find((x) => x.id === id);
    if (!n || n.remaining <= 0) return null;
    n.remaining -= 1;
    if (n.remaining <= 0) {
      n.mesh.visible = false;
      n.mesh.userData.harvestable = false;
    } else {
      n.mesh.scale.multiplyScalar(0.92);
    }
    return n;
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}
