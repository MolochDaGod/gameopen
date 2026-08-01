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
import { loadTropicalHarvestTestMap } from "./maps/tropicalIslandHarvest";
import { loadPirateVillageMap } from "./maps/pirateVillageMap";
import { loadShipwreckIslandMap } from "./maps/shipwreckIslandMap";
import { loadArenaMap } from "./maps/arenaMap";
import { loadForestMountainsMap } from "./maps/forestMountainsMap";
import { createTerrainHeightSampler } from "./brawler/survivalEnvironment";
import { upgradeMapPresentation } from "./materials/toonStyle";
import { getMapRegistryEntry } from "./maps/mapRegistry";

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

/** Map map-loader harvest kinds onto ForestWorld HarvestNodeKind. */
function mapHarvestKind(kind: string | undefined): HarvestNodeKind {
  switch ((kind || "").toLowerCase()) {
    case "wood":
      return "wood";
    case "ore":
    case "mine":
      return "ore";
    case "flower":
      return "flower";
    case "skin":
      return "skin";
    case "food":
    case "fiber":
    case "loot":
    case "forage":
      return "forage";
    default:
      return "ore";
  }
}

/** Map tool names to activity tools used by harvest mode. */
function mapHarvestTool(tool: string | undefined): string {
  switch ((tool || "").toLowerCase()) {
    case "axe":
    case "chop":
      return "chop";
    case "pick":
    case "mine":
      return "mine";
    case "hand":
    case "gather":
      return "gather";
    case "forage":
      return "forage";
    default:
      return tool || "gather";
  }
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
  /** Water band from pirate (or other) mesh sensors — for Controller.setWaterBand. */
  private waterBand: { top: number; bottom: number } | null = null;
  /** L0 height sampler for outdoor mesh floors (beach / landscape). */
  private heightAt: ((x: number, z: number) => number | null) | null = null;
  /** Suggested room half-extent after load (SI metres). */
  private boundHalf = 16;
  /** Ground meshes for build-grid raycast. */
  private groundMeshes: THREE.Mesh[] = [];
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

  getWaterBand(): { top: number; bottom: number } | null {
    return this.waterBand;
  }

  getGroundHeightAt(): ((x: number, z: number) => number | null) | null {
    return this.heightAt;
  }

  /** Half-extent for Controller.setRoomBound after outdoor load. */
  getBoundHalf(): number {
    return this.boundHalf;
  }

  /** Ground / nav meshes for BuildGridOverlay raycast. */
  getGroundMeshes(): THREE.Mesh[] {
    return this.groundMeshes;
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
    this.waterBand = null;
    this.heightAt = null;
    this.boundHalf = 16;
    this.groundMeshes = [];
    (this as unknown as { _forestMountainsMap?: unknown })._forestMountainsMap = null;
    if (this.sailEnv) {
      this.sailEnv.dispose();
      this.sailEnv = null;
    }
  }

  /**
   * Load outdoor map. danger-room → clear outdoor only.
   * Local loco QA maps (tropical / pirate / shipwreck / arena) use dedicated loaders.
   */
  async load(def: TestWorldDef): Promise<boolean> {
    this.clear();
    this.activeId = def.id;

    if (def.kind === "combat" || !def.meshKeys?.length) {
      this.cbs.flash?.("MAP · Danger Room (combat)", 0.9);
      return true;
    }

    if (def.id === "tropical-harvest") {
      const ok = await this.loadTropicalHarvestLocal(def);
      if (ok) return true;
      // SPA dry 404 on prod — fall through to CDN tropical_island_small chain
      this.cbs.flash?.("Tropical dry SPA miss — CDN tropical_small…", 1.0);
    }
    if (def.id === "pirate-village") {
      const ok = await this.loadPirateVillageLocal(def);
      if (ok) return true;
      this.cbs.flash?.("Pirate village SPA miss — CDN pirate pack…", 1.0);
    }
    if (def.id === "shipwreck-island") {
      const ok = await this.loadShipwreckLocal(def);
      if (ok) return true;
      this.cbs.flash?.("Shipwreck SPA miss — CDN coast fallback…", 1.0);
    }
    if (def.id === "arena") {
      const ok = await this.loadArenaLocal(def);
      if (ok) return true;
      this.cbs.flash?.("Arena SPA miss — geonosis stand-in…", 1.0);
    }
    if (def.id === "forest-mountains") {
      const ok = await this.loadForestMountainsLocal(def);
      if (ok) return true;
      // SPA forest_mountains missing → CDN mountain chain (forest-map / glowstone)
      this.cbs.flash?.("Forest Mountains SPA miss — CDN mountain fallback…", 1.0);
    }

    // ice / plains / desert / volcanic / CDN biomes use generic loadGltfFirst(meshKeys)
    try {
      const { scene, url } = await loadGltfFirst(def.meshKeys, sharedGltfLoader(), {
        prepMaterials: true,
      });
      // Grudge6-parity presentation for CDN maps flagged toonStyle
      if (getMapRegistryEntry(def.id)?.toonStyle) {
        upgradeMapPresentation(scene, { toon: true });
      }
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

      // Bound from footprint
      scene.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(scene);
      if (Number.isFinite(bb.min.x)) {
        const hx = Math.max(24, (bb.max.x - bb.min.x) * 0.55);
        const hz = Math.max(24, (bb.max.z - bb.min.z) * 0.55);
        this.boundHalf = Math.min(def.sailing ? 200 : 120, Math.max(hx, hz));
      } else {
        this.boundHalf = def.sailing ? 120 : 60;
      }

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
        const wy = this.sailEnv.waterSurfaceY;
        this.waterBand = { top: wy + 0.05, bottom: wy - 2.2 };
      }

      // Height sampler from large terrain meshes
      {
        const terrainMeshes: THREE.Mesh[] = [];
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.visible) return;
          const b = new THREE.Box3().setFromObject(m);
          const s = new THREE.Vector3();
          b.getSize(s);
          if (s.x > 8 && s.z > 8) terrainMeshes.push(m);
        });
        this.heightAt = terrainMeshes.length
          ? createTerrainHeightSampler(terrainMeshes.slice(0, 48))
          : null;
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

  /**
   * Tropical island: styled textures, geometric ore chunks (Valheim mine),
   * palms/wood scatter, beach ground. Water/sky stripped.
   */
  private async loadTropicalHarvestLocal(def: TestWorldDef): Promise<boolean> {
    try {
      const map = await loadTropicalHarvestTestMap({
        preferDry: true,
        meshKeys: def.meshKeys,
        scatter: true,
        seed: 42,
        oreCount: 18,
      });
      upgradeMapPresentation(map.root, { toon: true });
      map.root.userData.testWorldId = def.id;
      map.root.userData.uuid = def.uuid;
      map.root.userData.seed = def.seed;
      map.root.userData.tropicalStyle = true;
      this.group.add(map.root);
      this.terrain = map.root;
      this.waterBand = null; // intentionally no water

      // Center XZ, already grounded by loader
      map.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(map.root);
      if (Number.isFinite(box.min.x)) {
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        map.root.position.x -= cx;
        map.root.position.z -= cz;
        map.root.updateMatrixWorld(true);
      }
      const box2 = new THREE.Box3().setFromObject(map.root);
      const halfX = Math.max(20, (box2.max.x - box2.min.x) * 0.55);
      const halfZ = Math.max(20, (box2.max.z - box2.min.z) * 0.55);
      this.boundHalf = Math.min(90, Math.max(halfX, halfZ));

      // Ground height from beach + large meshes
      const terrainMeshes: THREE.Mesh[] = [];
      map.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || o.userData.excluded) return;
        if (o.userData.gameLayer === "ground" || /beach/i.test(o.name)) {
          terrainMeshes.push(m);
        }
      });
      if (!terrainMeshes.length && map.terrain) {
        map.terrain.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !o.userData.excluded) terrainMeshes.push(m);
        });
      }
      this.heightAt = terrainMeshes.length
        ? createTerrainHeightSampler(terrainMeshes)
        : null;
      this.groundMeshes = terrainMeshes.slice();

      // Prefer geometric ore + wood scatter; also register tagged island rocks
      const sources: THREE.Object3D[] = [...map.instances];
      map.root.traverse((o) => {
        if (
          o.userData.harvest &&
          !o.userData.generativeInstance &&
          !sources.includes(o)
        ) {
          sources.push(o);
        }
      });

      let i = 0;
      let oreN = 0;
      for (const inst of sources) {
        const h = inst.userData.harvest as {
          kind?: string;
          tool?: string;
          hp?: number;
          materialId?: string;
        } | undefined;
        if (!h) continue;
        const matId =
          h.materialId ||
          inst.userData.harvestMaterialId ||
          inst.userData.oreVein ||
          undefined;
        const id = `trop_${i++}_${matId || h.kind || "node"}`;
        inst.userData.harvestId = id;
        inst.userData.harvestable = true;
        if (matId) {
          inst.userData.harvestMaterialId = matId;
          if (inst.userData.harvest && typeof inst.userData.harvest === "object") {
            (inst.userData.harvest as { materialId?: string }).materialId = String(matId);
          }
        }
        if (h.kind === "ore" || inst.userData.geometricOre) oreN++;
        const world = new THREE.Vector3();
        inst.getWorldPosition(world);
        this.harvestNodes.push({
          id,
          kind: mapHarvestKind(h.kind),
          tool: mapHarvestTool(h.tool),
          position: world,
          mesh: inst,
          remaining: Math.max(1, Math.ceil((h.hp ?? 40) / 20)),
        });
      }

      // Soft tropical fill light (sand haze)
      try {
        const hemi = new THREE.HemisphereLight(0xc8e8ff, 0xc4a574, 0.45);
        hemi.name = "TropicalHemi";
        map.root.add(hemi);
      } catch {
        /* ignore */
      }

      this.cbs.flash?.(
        `TROPICAL · ${this.harvestNodes.length} harvest · ${oreN} ore (geometric) · tex ${map.textureKit?.rocksBig ? "RocksBig" : "fallback"} · dry beach`,
        1.8,
      );
      return true;
    } catch (err) {
      console.warn("[ForestWorld] tropical-harvest load failed", err);
      this.cbs.flash?.("Tropical Harvest load failed", 1.2);
      return false;
    }
  }

  /**
   * Pirate village ×4 for 2 m orc — palms, water band, harvest, climb ladder.
   */
  private async loadPirateVillageLocal(def: TestWorldDef): Promise<boolean> {
    try {
      const map = await loadPirateVillageMap();
      map.root.userData.testWorldId = def.id;
      map.root.userData.uuid = def.uuid;
      map.root.userData.seed = def.seed;
      this.group.add(map.root);
      this.terrain = map.root;
      this.waterBand = {
        top: map.waterBand.top,
        bottom: map.waterBand.bottom,
      };

      map.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(map.root);
      if (Number.isFinite(box.min.x)) {
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        map.root.position.x -= cx;
        map.root.position.z -= cz;
        map.root.updateMatrixWorld(true);
      }
      const box2 = new THREE.Box3().setFromObject(map.root);
      const halfX = Math.max(16, (box2.max.x - box2.min.x) * 0.55);
      const halfZ = Math.max(16, (box2.max.z - box2.min.z) * 0.55);
      this.boundHalf = Math.min(80, Math.max(halfX, halfZ));

      const terrainMeshes =
        map.navSources.length > 0
          ? map.navSources
          : (() => {
              const out: THREE.Mesh[] = [];
              map.root.traverse((o) => {
                const m = o as THREE.Mesh;
                if (m.isMesh && (o.userData.gameLayer === "ground" || /Landscape|Stairs|Sand/i.test(o.name))) {
                  out.push(m);
                }
              });
              return out;
            })();
      this.heightAt = terrainMeshes.length
        ? createTerrainHeightSampler(terrainMeshes)
        : null;

      let i = 0;
      for (const inst of map.harvestables) {
        const h = inst.userData.harvest as { kind?: string; tool?: string; hp?: number } | undefined;
        if (!h) continue;
        const id = `pirate_${i++}_${h.kind ?? "node"}`;
        inst.userData.harvestId = id;
        inst.userData.harvestable = true;
        const world = new THREE.Vector3();
        inst.getWorldPosition(world);
        this.harvestNodes.push({
          id,
          kind: mapHarvestKind(h.kind),
          tool: mapHarvestTool(h.tool),
          position: world,
          mesh: inst,
          remaining: Math.max(1, Math.ceil((h.hp ?? 40) / 20)),
        });
      }

      this.groundMeshes = terrainMeshes.slice();
      this.cbs.flash?.(
        `PIRATE VILLAGE · scale ${map.scale} · ${this.harvestNodes.length} harvest · water [${this.waterBand.bottom.toFixed(1)}, ${this.waterBand.top.toFixed(1)}] · climb ${map.climbables.length}`,
        1.8,
      );
      return true;
    } catch (err) {
      console.warn("[ForestWorld] pirate-village load failed", err);
      this.cbs.flash?.("Pirate Village load failed — check models/maps/pirate/", 1.4);
      return false;
    }
  }

  /**
   * Shipwreck island — climb ladders, swim water, harvest palms/rock, ship vehicle, build grid.
   */
  private async loadShipwreckLocal(def: TestWorldDef): Promise<boolean> {
    try {
      const map = await loadShipwreckIslandMap({ scale: 1 });
      upgradeMapPresentation(map.root, { toon: true });
      map.root.userData.testWorldId = def.id;
      map.root.userData.uuid = def.uuid;
      map.root.userData.seed = def.seed;
      this.group.add(map.root);
      this.terrain = map.root;
      this.waterBand = map.waterBand;
      this.boundHalf = map.boundHalf;
      this.groundMeshes = map.navSources.slice();
      this.heightAt = map.navSources.length
        ? createTerrainHeightSampler(map.navSources)
        : null;

      let i = 0;
      for (const inst of map.harvestables) {
        const h = inst.userData.harvest as { kind?: string; tool?: string; hp?: number } | undefined;
        if (!h) continue;
        const id = `wreck_${i++}_${h.kind ?? "node"}`;
        inst.userData.harvestId = id;
        inst.userData.harvestable = true;
        const world = new THREE.Vector3();
        inst.getWorldPosition(world);
        this.harvestNodes.push({
          id,
          kind: mapHarvestKind(h.kind),
          tool: mapHarvestTool(h.tool),
          position: world,
          mesh: inst,
          remaining: Math.max(1, Math.ceil((h.hp ?? 40) / 20)),
        });
      }

      this.cbs.flash?.(
        `SHIPWRECK · harvest ${this.harvestNodes.length} · climb ${map.climbables.length} · swim ${map.swim.length} · ship ${map.vehicles.length} · build ground ${map.navSources.length}`,
        1.8,
      );
      return true;
    } catch (err) {
      console.warn("[ForestWorld] shipwreck-island load failed", err);
      this.cbs.flash?.("Shipwreck Island load failed — models/maps/shipwreck/", 1.4);
      return false;
    }
  }

  /**
   * Fantasy arena — combat sand/grass, rock harvest, stairs climb, 1 m build grid.
   */
  private async loadArenaLocal(def: TestWorldDef): Promise<boolean> {
    try {
      const map = await loadArenaMap({ scale: 1 });
      upgradeMapPresentation(map.root, { toon: true });
      map.root.userData.testWorldId = def.id;
      map.root.userData.uuid = def.uuid;
      map.root.userData.seed = def.seed;
      this.group.add(map.root);
      this.terrain = map.root;
      this.waterBand = null;
      this.boundHalf = map.boundHalf;
      this.groundMeshes = map.navSources.slice();
      this.heightAt = map.navSources.length
        ? createTerrainHeightSampler(map.navSources)
        : null;

      let i = 0;
      for (const inst of map.harvestables) {
        const h = inst.userData.harvest as { kind?: string; tool?: string; hp?: number } | undefined;
        if (!h) continue;
        const id = `arena_${i++}_${h.kind ?? "node"}`;
        inst.userData.harvestId = id;
        inst.userData.harvestable = true;
        const world = new THREE.Vector3();
        inst.getWorldPosition(world);
        this.harvestNodes.push({
          id,
          kind: mapHarvestKind(h.kind),
          tool: mapHarvestTool(h.tool),
          position: world,
          mesh: inst,
          remaining: Math.max(1, Math.ceil((h.hp ?? 40) / 20)),
        });
      }

      this.cbs.flash?.(
        `ARENA · ground ${map.ground.length} · harvest ${this.harvestNodes.length} · climb ${map.climbables.length} · snap ${map.buildSnapM}m build grid`,
        1.8,
      );
      return true;
    } catch (err) {
      console.warn("[ForestWorld] arena load failed", err);
      this.cbs.flash?.("Arena load failed — models/maps/arena/arena.glb", 1.4);
      return false;
    }
  }

  /**
   * Dense forest mountains — geometry-classified harvest zone with UUIDs + heightmap.
   */
  private async loadForestMountainsLocal(def: TestWorldDef): Promise<boolean> {
    try {
      const map = await loadForestMountainsMap({
        scale: 1,
        worldSeed: def.seed,
        maxHarvest: 200,
      });
      upgradeMapPresentation(map.root, { toon: true });
      map.root.userData.testWorldId = def.id;
      map.root.userData.uuid = def.uuid;
      map.root.userData.seed = def.seed;
      map.root.userData.forestMountains = true;
      map.root.userData.harvestManifest = {
        worldSeed: map.worldSeed,
        stats: map.stats,
        defs: map.defs.map((d) => d.defId),
      };
      this.group.add(map.root);
      this.terrain = map.root;
      this.waterBand = null;
      this.boundHalf = map.boundHalf;
      this.groundMeshes = map.terrain.slice();
      this.heightAt = map.heightAt;

      for (const n of map.harvestNodes) {
        this.harvestNodes.push({
          id: n.instanceId,
          kind: mapHarvestKind(n.kind === "forage" ? "forage" : n.kind),
          tool: mapHarvestTool(n.tool),
          position: n.position.clone(),
          mesh: n.mesh,
          remaining: Math.max(1, Math.ceil(n.maxHp / 20)),
        });
      }

      // Stash full map for bake / raycast tools
      (this as unknown as { _forestMountainsMap?: typeof map })._forestMountainsMap = map;

      this.cbs.flash?.(
        `FOREST MTNS · terrain ${map.stats.terrainCount} · wood ${map.stats.wood} · ore ${map.stats.ore} · forage ${map.stats.forage} · UUID harvest nodes`,
        2.0,
      );
      return true;
    } catch (err) {
      console.warn("[ForestWorld] forest-mountains load failed", err);
      this.cbs.flash?.("Forest Mountains load failed — models/maps/forest_mountains/", 1.4);
      return false;
    }
  }

  /** Full forest mountains result after load (for bake / Q&A). */
  getForestMountainsMap(): import("./maps/forestMountainsMap").ForestMountainsMapResult | null {
    return (this as unknown as { _forestMountainsMap?: import("./maps/forestMountainsMap").ForestMountainsMapResult })
      ._forestMountainsMap ?? null;
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
