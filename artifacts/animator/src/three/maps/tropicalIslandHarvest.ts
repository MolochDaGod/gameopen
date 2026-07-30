/**
 * Tropical island harvest nodes — per-mesh extract from tropical_island.glb
 * (water + skybox removed). Generative scatter for Q&A AI test map + loco.
 *
 * Style: island textures (RocksBig/Small, BeachBaked, palms) drive **geometric
 * ore chunks** (Valheim-like crystal/rock clusters) minable with pinata system.
 *
 * Assets (try order — see biomeMeshKeys tropical):
 *  1. SPA models/maps/tropical/* (local / deploy when not vercel-ignored)
 *  2. R2 models/warlords-era/worlds/tropical_island_small.glb (proven CDN)
 *  3. low_poly_island / small_island / breeze fallbacks
 *
 * Catalog: harvest-catalog.json (from scripts/extract-tropical-island-harvest.mjs)
 */
import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { ORC_AGENT } from "./pirateVillageMap";
import { meshKeysForBiome } from "./biomeMeshKeys";
import {
  extractRockTextureKit,
  scatterGeometricOreChunks,
  styleTropicalIslandMaterials,
  tagIslandRocksAsOre,
  TROPICAL_ISLAND_FOG,
  type RockTextureKit,
} from "./tropicalOreStyle";

export type HarvestKind = "ore" | "wood" | "fiber" | "food" | "loot";

export interface HarvestSpec {
  kind: HarvestKind;
  tool: string;
  hp: number;
  label: string;
  /** ObjectStore material id when known (iron-ore, oak-log, …). */
  materialId?: string;
}

export interface GenerativeHarvestNode {
  id: string;
  /** Template object (cloned when scattering). */
  template: THREE.Object3D;
  harvest: HarvestSpec;
  material: string;
  sourceNode: string;
}

export interface TropicalHarvestMapResult {
  root: THREE.Group;
  /** Dry island (no water/skybox) as terrain backdrop. */
  terrain: THREE.Object3D | null;
  waterExcluded: true;
  generative: GenerativeHarvestNode[];
  /** Scattered harvest instances for Q&A testing (wood + geometric ore). */
  instances: THREE.Object3D[];
  /** Valheim geometric ore clusters only. */
  oreChunks: THREE.Object3D[];
  /** Textures pulled from RocksBig / RocksSmall / Beach. */
  textureKit: RockTextureKit | null;
  scale: number;
  agent: typeof ORC_AGENT;
  fog: typeof TROPICAL_ISLAND_FOG;
}

/** Material / name → harvest (mirrors extract script). */
export function classifyTropicalMesh(
  material: string,
  nodeName: string,
): { role: "exclude" | "ground" | "harvest" | "prop"; harvest: HarvestSpec | null } {
  const s = `${material} ${nodeName}`;
  if (/skybox/i.test(s)) return { role: "exclude", harvest: null };
  if (/material\.001|armature/i.test(s) && !/palm|rock|beach/i.test(s)) {
    return { role: "exclude", harvest: null };
  }
  // Flat armature water plane
  if (/Object_31|Object_12/i.test(nodeName) && /material\.001/i.test(material)) {
    return { role: "exclude", harvest: null };
  }
  if (/beach/i.test(s)) return { role: "ground", harvest: null };
  if (/rocksbig|rock_assembly/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "ore",
        tool: "pick",
        hp: 90,
        label: "Strange Ore Rock",
        materialId: "iron-ore",
      },
    };
  }
  if (/rockssmall/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "ore",
        tool: "pick",
        hp: 50,
        label: "Ore Pebble Cluster",
        materialId: "copper-ore",
      },
    };
  }
  if (/rock/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "ore",
        tool: "pick",
        hp: 60,
        label: "Mineral Rock",
        materialId: "scrap-ore",
      },
    };
  }
  if (/palme_blaetter/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "wood",
        tool: "axe",
        hp: 15,
        label: "Palm Fronds",
        materialId: "pine-log",
      },
    };
  }
  if (/palme|palm|cat_palm|areca|tropical_palm/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "wood",
        tool: "axe",
        hp: 40,
        label: "Palm",
        materialId: "oak-log",
      },
    };
  }
  if (/treibholz/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "wood",
        tool: "axe",
        hp: 25,
        label: "Driftwood",
        materialId: "driftwood-log",
      },
    };
  }
  if (/forest_root|(^|[^a-z])root([^a-z]|$)/i.test(s)) {
    return {
      role: "harvest",
      harvest: {
        kind: "wood",
        tool: "axe",
        hp: 30,
        label: "Forest Root",
        materialId: "oak-log",
      },
    };
  }
  return { role: "prop", harvest: null };
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Strip water + skybox from a loaded tropical island scene (in place).
 */
export function stripWaterAndSkybox(root: THREE.Object3D): THREE.Object3D[] {
  const removed: THREE.Object3D[] = [];
  const toRemove: THREE.Object3D[] = [];
  root.traverse((o) => {
    const matNames: string[] = [];
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && "name" in m) matNames.push(String((m as THREE.Material).name || ""));
      }
    }
    const blob = `${o.name} ${matNames.join(" ")}`;
    if (/skybox/i.test(blob)) toRemove.push(o);
    if (/material\.001/i.test(blob) && /object_31|object_12/i.test(o.name)) toRemove.push(o);
    // Parent Skybox / Armature water
    if (/^Skybox/i.test(o.name) || (/^Armature/i.test(o.name) && /water|material/i.test(blob))) {
      toRemove.push(o);
    }
  });
  for (const o of toRemove) {
    o.visible = false;
    o.userData.excluded = true;
    o.userData.excludeReason = "water_or_skybox";
    removed.push(o);
    // Prefer hide over dispose so templates still readable
  }
  return removed;
}

/**
 * Collect generative harvest templates from tropical island meshes.
 */
export function collectGenerativeNodes(root: THREE.Object3D): GenerativeHarvestNode[] {
  const out: GenerativeHarvestNode[] = [];
  let id = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o.userData.excluded) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const matName = mats.map((m) => (m && "name" in m ? String((m as THREE.Material).name) : "")).join("|");
    const cls = classifyTropicalMesh(matName, o.name);
    if (cls.role !== "harvest" || !cls.harvest) return;
    // Skip tiny leaf-only if parent palm already harvested — keep both for variety
    const tpl = mesh.clone(true);
    tpl.position.set(0, 0, 0);
    tpl.rotation.set(0, 0, 0);
    tpl.scale.set(1, 1, 1);
    out.push({
      id: `gen_${id++}_${cls.harvest.kind}`,
      template: tpl,
      harvest: cls.harvest,
      material: matName,
      sourceNode: o.name,
    });
    // Mark original as harvestable in-scene too
    o.userData.gameLayer = "harvest";
    o.userData.harvest = cls.harvest;
    o.userData.harvestMaterialId = cls.harvest.materialId;
    o.userData.harvestTool = cls.harvest.tool;
    o.userData.harvestKind = cls.harvest.kind;
    o.userData.generativeSource = true;
  });
  return out;
}

/**
 * Scatter wood/fiber clones (palms, driftwood). Ore uses geometric chunks instead.
 */
export function scatterHarvestNodes(
  generative: GenerativeHarvestNode[],
  parent: THREE.Group,
  opts?: {
    seed?: number;
    halfExtentM?: number;
    minSeparationM?: number;
    counts?: Partial<Record<HarvestKind, number>>;
    /** When false, skip raw rock mesh clones (prefer geometric ore). */
    includeOreMeshes?: boolean;
  },
): THREE.Object3D[] {
  const rand = mulberry32(opts?.seed ?? 42);
  const half = opts?.halfExtentM ?? 18;
  const minSep = opts?.minSeparationM ?? 2.2;
  const counts = {
    ore: opts?.includeOreMeshes ? (opts?.counts?.ore ?? 4) : 0,
    wood: opts?.counts?.wood ?? 14,
    fiber: opts?.counts?.fiber ?? 6,
    food: opts?.counts?.food ?? 0,
    loot: opts?.counts?.loot ?? 0,
  };

  const byKind = new Map<HarvestKind, GenerativeHarvestNode[]>();
  for (const g of generative) {
    const k = g.harvest.kind;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(g);
  }

  const placed: THREE.Object3D[] = [];
  const pts: THREE.Vector2[] = [];

  const tryPlace = (kind: HarvestKind, n: number) => {
    const pool = byKind.get(kind);
    if (!pool?.length || n <= 0) return;
    let attempts = 0;
    let made = 0;
    while (made < n && attempts < n * 40) {
      attempts++;
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      if (Math.hypot(x, z) < 3) continue;
      if (pts.some((p) => p.distanceTo(new THREE.Vector2(x, z)) < minSep)) continue;
      const src = pool[Math.floor(rand() * pool.length)]!;
      const inst = src.template.clone(true);
      inst.position.set(x, 0, z);
      inst.rotation.y = rand() * Math.PI * 2;
      // Normalize instance height ~1–3 m for orc interaction
      const box = new THREE.Box3().setFromObject(inst);
      const h = Math.max(0.01, box.max.y - box.min.y);
      const targetH = kind === "ore" ? 0.8 + rand() * 1.2 : 1.5 + rand() * 2.5;
      const s = targetH / h;
      inst.scale.multiplyScalar(s);
      inst.position.y = 0;
      // re-ground
      const b2 = new THREE.Box3().setFromObject(inst);
      inst.position.y -= b2.min.y;
      inst.userData.gameLayer = "harvest";
      inst.userData.harvest = { ...src.harvest };
      inst.userData.harvestMaterialId = src.harvest.materialId;
      inst.userData.harvestTool = src.harvest.tool;
      inst.userData.harvestKind = src.harvest.kind;
      inst.userData.generativeInstance = true;
      inst.userData.qaTest = true;
      inst.name = `Harvest_${kind}_${made}_${src.id}`;
      parent.add(inst);
      placed.push(inst);
      pts.push(new THREE.Vector2(x, z));
      made++;
    }
  };

  tryPlace("ore", counts.ore);
  tryPlace("wood", counts.wood);
  tryPlace("fiber", counts.fiber);

  return placed;
}

/**
 * Load tropical island dry (or full + strip), style materials, tag rocks as ore,
 * scatter wood + **geometric ore chunks** (island rock textures).
 */
export async function loadTropicalHarvestTestMap(opts?: {
  /** Prefer dry GLB if extract script ran. */
  preferDry?: boolean;
  /** Override mesh key chain (defaults to biomeMeshKeys tropical). */
  meshKeys?: string[];
  /** Uniform scale to SI (default 0.01 if raw ~cm). */
  scale?: number;
  scatter?: boolean;
  seed?: number;
  /** Geometric Valheim ore chunk count (default 16). */
  oreCount?: number;
}): Promise<TropicalHarvestMapResult> {
  // Beach mesh ~61×5×47: treat as metres (scale 1). Scatter instances self-normalize height.
  // If the dry island loads huge/tiny, pass scale explicitly (0.01 for cm exports).
  const scale = opts?.scale ?? 1.0;
  const preferDry = opts?.preferDry !== false;
  const seed = opts?.seed ?? 42;
  const keys = opts?.meshKeys?.length
    ? opts.meshKeys.slice()
    : meshKeysForBiome("tropical");
  // Prefer dry first when requested (already first in default chain)
  if (!preferDry && keys.length > 1) {
    const dryIdx = keys.findIndex((k) => /tropical_island_dry/i.test(k));
    if (dryIdx >= 0) {
      const [dry] = keys.splice(dryIdx, 1);
      keys.push(dry);
    }
  }

  let terrain: THREE.Object3D | null = null;
  let sourceUrl = "";
  try {
    const loaded = await loadGltfFirst(keys, sharedGltfLoader(), {
      prepMaterials: true,
    });
    terrain = loaded.scene;
    sourceUrl = loaded.url;
  } catch (e) {
    console.warn(
      "[tropicalHarvest] all tropical meshKeys failed — scatter-only mode",
      keys.slice(0, 4),
      e,
    );
  }

  const root = new THREE.Group();
  root.name = "TropicalHarvestQAMap";

  let textureKit: RockTextureKit | null = null;

  if (terrain) {
    terrain.scale.setScalar(scale);
    terrain.userData.sourceUrl = sourceUrl;
    stripWaterAndSkybox(terrain);
    // Island style: beach sand, palm double-side, mineral rocks
    // (safe on Warlords tropical_island_small — name heuristics skip unknown mats)
    styleTropicalIslandMaterials(terrain);
    textureKit = extractRockTextureKit(terrain);
    // re-ground
    terrain.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(terrain);
    if (Number.isFinite(box.min.y)) terrain.position.y -= box.min.y;
    root.add(terrain);
    // Strange rocks → pinata ore veins (ObjectStore material ids)
    tagIslandRocksAsOre(terrain, mulberry32(seed + 9));
  }

  const generative = terrain ? collectGenerativeNodes(terrain) : [];
  // Tag beach as ground loco surface for controller testing
  terrain?.traverse((o) => {
    if (/beach/i.test(o.name) || /BeachBaked/i.test(String((o as THREE.Mesh).material && "name" in ((o as THREE.Mesh).material as object) ? ((o as THREE.Mesh).material as THREE.Material).name : ""))) {
      o.userData.gameLayer = "ground";
      o.userData.nav = true;
    }
    if (/beach/i.test(o.name)) {
      o.userData.gameLayer = "ground";
      o.userData.nav = true;
    }
  });

  const scatterRoot = new THREE.Group();
  scatterRoot.name = "HarvestScatter";
  root.add(scatterRoot);

  const woodFiber =
    opts?.scatter === false
      ? []
      : scatterHarvestNodes(generative, scatterRoot, {
          seed,
          includeOreMeshes: false,
          counts: { wood: 14, fiber: 6, ore: 0 },
        });

  const oreRoot = new THREE.Group();
  oreRoot.name = "GeometricOreScatter";
  root.add(oreRoot);
  const oreChunks =
    opts?.scatter === false
      ? []
      : scatterGeometricOreChunks(oreRoot, textureKit || { rocksBig: null, rocksSmall: null, beach: null, palm: null }, {
          seed: seed + 100,
          count: opts?.oreCount ?? 16,
          halfExtentM: 18,
          minSeparationM: 2.5,
        });

  const instances = [...woodFiber, ...oreChunks];

  return {
    root,
    terrain,
    waterExcluded: true,
    generative,
    instances,
    oreChunks,
    textureKit,
    scale,
    agent: ORC_AGENT,
    fog: TROPICAL_ISLAND_FOG,
  };
}

/**
 * QA summary for AI playtesters / Danger Master tools.
 */
export function tropicalHarvestQaSummary(map: TropicalHarvestMapResult): string {
  const byKind: Record<string, number> = {};
  const byVein: Record<string, number> = {};
  for (const i of map.instances) {
    const k = i.userData.harvest?.kind || "?";
    byKind[k] = (byKind[k] || 0) + 1;
    const v = i.userData.oreVein || i.userData.harvestMaterialId;
    if (v) byVein[String(v)] = (byVein[String(v)] || 0) + 1;
  }
  const gens = map.generative.map((g) => `${g.harvest.label}(${g.harvest.kind})`).join(", ");
  const hasTex = map.textureKit
    ? `rocksBig=${!!map.textureKit.rocksBig} rocksSmall=${!!map.textureKit.rocksSmall} beach=${!!map.textureKit.beach}`
    : "no texture kit";
  return [
    `Tropical harvest QA map scale=${map.scale} water/skybox excluded · island textures styled`,
    `Generative templates: ${map.generative.length} — ${gens}`,
    `Scattered: ${map.instances.length} ${JSON.stringify(byKind)} · geometric ore ${map.oreChunks.length}`,
    `Ore veins: ${JSON.stringify(byVein)}`,
    `Textures: ${hasTex}`,
    `Valheim mine: pick geometric ore chunks → pinata break → absorb copper/iron/mithril`,
    `Orc agent h=${map.agent.baseHeightM} r=${map.agent.radiusM}`,
  ].join("\n");
}
