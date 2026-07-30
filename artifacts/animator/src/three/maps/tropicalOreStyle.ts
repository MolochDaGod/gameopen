/**
 * Tropical island style + Valheim geometric ore chunks.
 *
 * Uses textures cloned from the island GLB materials (RocksBig / RocksSmall /
 * BeachBaked / palms) so harvestables match the scene palette — not plain grey.
 *
 * Ore nodes are **angular crystal clusters** (icosa / octa / box chips) with
 * rock albedo + mineral tint + vein emissive — minable via PinataHarvestSystem.
 */
import * as THREE from "three";

export type OreVeinId =
  | "copper-ore"
  | "iron-ore"
  | "steel-ore"
  | "mithril-ore"
  | "scrap-ore"
  | "ore_t1";

export interface OreVeinDef {
  id: OreVeinId;
  label: string;
  /** Base rock multiply */
  rockTint: number;
  /** Crystal / metal face color */
  crystalTint: number;
  emissive: number;
  metalness: number;
  roughness: number;
  hp: number;
  /** Relative spawn weight */
  weight: number;
}

/** ObjectStore-aligned ore veins for tropical beach mining. */
export const TROPICAL_ORE_VEINS: OreVeinDef[] = [
  {
    id: "copper-ore",
    label: "Copper Ore Chunk",
    rockTint: 0xb8926a,
    crystalTint: 0xc4783a,
    emissive: 0x5a2a10,
    metalness: 0.55,
    roughness: 0.42,
    hp: 55,
    weight: 3,
  },
  {
    id: "iron-ore",
    label: "Iron Ore Chunk",
    rockTint: 0x6a6560,
    crystalTint: 0x8a9098,
    emissive: 0x222830,
    metalness: 0.7,
    roughness: 0.38,
    hp: 70,
    weight: 4,
  },
  {
    id: "steel-ore",
    label: "Steel Ore Chunk",
    rockTint: 0x5a5e62,
    crystalTint: 0xa8b0b8,
    emissive: 0x1a2830,
    metalness: 0.78,
    roughness: 0.32,
    hp: 90,
    weight: 2,
  },
  {
    id: "mithril-ore",
    label: "Mithril Ore Chunk",
    rockTint: 0x5a6878,
    crystalTint: 0x9ec8e8,
    emissive: 0x204060,
    metalness: 0.85,
    roughness: 0.28,
    hp: 110,
    weight: 1,
  },
  {
    id: "scrap-ore",
    label: "Scrap Ore Chunk",
    rockTint: 0x7a6a58,
    crystalTint: 0x9a8870,
    emissive: 0x2a2018,
    metalness: 0.4,
    roughness: 0.55,
    hp: 40,
    weight: 3,
  },
];

export interface RockTextureKit {
  rocksBig: THREE.Texture | null;
  rocksSmall: THREE.Texture | null;
  beach: THREE.Texture | null;
  palm: THREE.Texture | null;
}

/**
 * Pull albedo maps from tropical island materials by name.
 * Clones textures so we can set wrap/repeat without breaking the beach.
 */
export function extractRockTextureKit(root: THREE.Object3D): RockTextureKit {
  const kit: RockTextureKit = {
    rocksBig: null,
    rocksSmall: null,
    beach: null,
    palm: null,
  };

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || !("map" in m) || !m.map) continue;
      const name = String(m.name || "");
      const cloneMap = () => {
        const t = m.map!.clone();
        t.needsUpdate = true;
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.max(t.anisotropy || 1, 4);
        return t;
      };
      if (/rocksbig/i.test(name) && !kit.rocksBig) kit.rocksBig = cloneMap();
      if (/rockssmall/i.test(name) && !kit.rocksSmall) kit.rocksSmall = cloneMap();
      if (/beach/i.test(name) && !kit.beach) kit.beach = cloneMap();
      if (/palm|palme|areca|cat_palm|tropical/i.test(name) && !kit.palm) {
        kit.palm = cloneMap();
      }
    }
  });

  return kit;
}

/**
 * Style pass: make beach/sand, palms, and strange rocks read as one tropical set.
 * Does not strip meshes — only material tuning + harvest ore restyle on rock meshes.
 */
export function styleTropicalIslandMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m?.isMeshStandardMaterial) continue;
      const name = String(m.name || "");

      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.anisotropy = Math.max(m.map.anisotropy || 1, 8);
      }

      if (/beach/i.test(name)) {
        m.roughness = 0.92;
        m.metalness = 0.02;
        m.color?.setHex(0xf0e0c0);
        m.envMapIntensity = 0.45;
      } else if (/rocksbig|rockssmall|rock/i.test(name)) {
        // Strange geometric coastal rocks — slightly metallic mineral flecks
        m.roughness = 0.72;
        m.metalness = 0.22;
        m.color?.setHex(0xc8c0b4);
        m.envMapIntensity = 0.55;
      } else if (/palme_blaetter|palm|areca|cat_palm|tropical/i.test(name)) {
        m.roughness = 0.78;
        m.metalness = 0.04;
        m.side = THREE.DoubleSide;
        m.color?.setHex(0xd8f0c8);
      } else if (/treibholz|root/i.test(name)) {
        m.roughness = 0.88;
        m.metalness = 0.05;
        m.color?.setHex(0xd2b48c);
      }
      m.needsUpdate = true;
    }

    // Shadow / receive for play
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/**
 * Retag in-scene rock assemblies as Valheim ore nodes (ObjectStore material ids).
 * Large landscape rocks stay visible but become pick-minable pinata targets.
 */
export function tagIslandRocksAsOre(
  root: THREE.Object3D,
  rand: () => number = Math.random,
): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o.userData.excluded) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const matName = mats
      .map((m) => (m && "name" in m ? String((m as THREE.Material).name) : ""))
      .join("|");
    const blob = `${o.name} ${matName}`;
    if (!/rocksbig|rockssmall|rock_assembly|rock/i.test(blob)) return;
    if (/palm|beach|sky/i.test(blob)) return;

    const vein = pickVein(rand);
    const big = /rocksbig|rock_assembly/i.test(blob);
    o.userData.gameLayer = "harvest";
    o.userData.harvest = {
      kind: "ore",
      tool: "pick",
      hp: big ? vein.hp + 30 : vein.hp,
      label: vein.label,
      materialId: vein.id,
    };
    o.userData.harvestMaterialId = vein.id;
    o.userData.harvestTool = "pick";
    o.userData.harvestKind = "ore";
    o.userData.oreVein = vein.id;
    o.userData.geometricOre = false; // original mesh
    o.userData.nav = false;
    // Subtle mineral emissive on rock materials for "vein" read
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m?.isMeshStandardMaterial) continue;
      const styled = m.clone();
      styled.emissive = new THREE.Color(vein.emissive);
      styled.emissiveIntensity = 0.18;
      styled.metalness = Math.max(styled.metalness ?? 0, 0.35);
      styled.roughness = Math.min(styled.roughness ?? 1, 0.65);
      styled.name = `${m.name || "Rock"}_OreVein`;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((x) => (x === m ? styled : x));
      } else {
        mesh.material = styled;
      }
    }
    n++;
  });
  return n;
}

function pickVein(rand: () => number): OreVeinDef {
  const total = TROPICAL_ORE_VEINS.reduce((s, v) => s + v.weight, 0);
  let r = rand() * total;
  for (const v of TROPICAL_ORE_VEINS) {
    r -= v.weight;
    if (r <= 0) return v;
  }
  return TROPICAL_ORE_VEINS[1]!;
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
 * Build one geometric ore cluster: rock base chips (textured) + crystal facets.
 * SI metres; feet at y=0.
 */
export function buildGeometricOreChunk(
  kit: RockTextureKit,
  vein: OreVeinDef,
  opts?: { seed?: number; targetHeightM?: number },
): THREE.Group {
  const rand = mulberry32(opts?.seed ?? 1);
  const targetH = opts?.targetHeightM ?? 0.9 + rand() * 1.1;
  const g = new THREE.Group();
  g.name = `GeometricOre_${vein.id}`;

  const rockMap = kit.rocksBig || kit.rocksSmall;
  const smallMap = kit.rocksSmall || kit.rocksBig;

  const rockMat = new THREE.MeshStandardMaterial({
    name: `OreRock_${vein.id}`,
    map: rockMap,
    color: new THREE.Color(vein.rockTint),
    roughness: 0.78,
    metalness: 0.28,
    envMapIntensity: 0.5,
  });
  if (rockMap) {
    rockMap.repeat.set(1.2 + rand(), 1.2 + rand());
  }

  const crystalMat = new THREE.MeshStandardMaterial({
    name: `OreCrystal_${vein.id}`,
    map: smallMap || rockMap,
    color: new THREE.Color(vein.crystalTint),
    emissive: new THREE.Color(vein.emissive),
    emissiveIntensity: 0.35 + rand() * 0.25,
    roughness: vein.roughness,
    metalness: vein.metalness,
    envMapIntensity: 0.85,
  });
  if (smallMap) {
    smallMap.repeat.set(0.8 + rand() * 0.6, 0.8 + rand() * 0.6);
  }

  // Core crystal — geometric (icosa / octa)
  const coreGeo =
    rand() > 0.45
      ? new THREE.IcosahedronGeometry(0.35, 0)
      : new THREE.OctahedronGeometry(0.38, 0);
  const core = new THREE.Mesh(coreGeo, crystalMat);
  core.position.y = 0.45;
  core.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.3);
  core.scale.set(0.85 + rand() * 0.4, 1.1 + rand() * 0.5, 0.85 + rand() * 0.4);
  core.castShadow = true;
  core.receiveShadow = true;
  g.add(core);

  // Satellite crystal spikes
  const spikes = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < spikes; i++) {
    const geo =
      rand() > 0.5
        ? new THREE.OctahedronGeometry(0.18 + rand() * 0.12, 0)
        : new THREE.ConeGeometry(0.12 + rand() * 0.08, 0.35 + rand() * 0.25, 5);
    const spike = new THREE.Mesh(geo, crystalMat);
    const a = (i / spikes) * Math.PI * 2 + rand() * 0.4;
    const r = 0.22 + rand() * 0.2;
    spike.position.set(Math.cos(a) * r, 0.35 + rand() * 0.35, Math.sin(a) * r);
    spike.rotation.set(rand() * 0.8, a, rand() * 0.5);
    spike.castShadow = true;
    g.add(spike);
  }

  // Strange angular rock chips (use island rock texture) — Valheim rubble look
  const chips = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < chips; i++) {
    const geo = new THREE.BoxGeometry(
      0.2 + rand() * 0.35,
      0.15 + rand() * 0.28,
      0.2 + rand() * 0.35,
    );
    // Non-uniform scale → weird rock silhouette
    const chip = new THREE.Mesh(geo, rockMat);
    const a = rand() * Math.PI * 2;
    const r = 0.15 + rand() * 0.35;
    chip.position.set(Math.cos(a) * r, 0.08 + rand() * 0.2, Math.sin(a) * r);
    chip.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    chip.scale.set(0.7 + rand() * 0.8, 0.5 + rand() * 0.9, 0.7 + rand() * 0.8);
    chip.castShadow = true;
    chip.receiveShadow = true;
    g.add(chip);
  }

  // Normalize height to targetH
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const h = Math.max(0.05, box.max.y - box.min.y);
  const s = targetH / h;
  g.scale.setScalar(s);
  g.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(g);
  g.position.y -= box2.min.y;

  g.userData.gameLayer = "harvest";
  g.userData.harvest = {
    kind: "ore",
    tool: "pick",
    hp: vein.hp,
    label: vein.label,
    materialId: vein.id,
  };
  g.userData.harvestMaterialId = vein.id;
  g.userData.harvestTool = "pick";
  g.userData.harvestKind = "ore";
  g.userData.oreVein = vein.id;
  g.userData.geometricOre = true;
  g.userData.nav = false;
  g.userData.harvestable = true;

  // Dispose helpers stored for later cleanup
  g.userData._oreMats = [rockMat, crystalMat];
  g.userData._oreGeos = true;

  return g;
}

/**
 * Scatter geometric ore chunks on the beach footprint for Valheim mining Q&A.
 */
export function scatterGeometricOreChunks(
  parent: THREE.Group,
  kit: RockTextureKit,
  opts?: {
    seed?: number;
    count?: number;
    halfExtentM?: number;
    minSeparationM?: number;
  },
): THREE.Object3D[] {
  const rand = mulberry32(opts?.seed ?? 77);
  const count = opts?.count ?? 16;
  const half = opts?.halfExtentM ?? 18;
  const minSep = opts?.minSeparationM ?? 2.4;
  const placed: THREE.Object3D[] = [];
  const pts: THREE.Vector2[] = [];

  let attempts = 0;
  while (placed.length < count && attempts < count * 50) {
    attempts++;
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    // Prefer ring off origin (leave spawn clear)
    if (Math.hypot(x, z) < 3.5) continue;
    if (pts.some((p) => p.distanceTo(new THREE.Vector2(x, z)) < minSep)) continue;

    const vein = pickVein(rand);
    const chunk = buildGeometricOreChunk(kit, vein, {
      seed: (opts?.seed ?? 77) + placed.length * 17,
      targetHeightM: 0.75 + rand() * 1.35,
    });
    chunk.position.set(x, 0, z);
    chunk.rotation.y = rand() * Math.PI * 2;
    chunk.name = `OreChunk_${vein.id}_${placed.length}`;
    chunk.userData.generativeInstance = true;
    chunk.userData.qaTest = true;
    parent.add(chunk);
    placed.push(chunk);
    pts.push(new THREE.Vector2(x, z));
  }

  return placed;
}

/** Fog / mood for tropical harvest map (sand haze, open horizon). */
export const TROPICAL_ISLAND_FOG = {
  color: 0xc8e0f0,
  near: 35,
  far: 120,
  background: 0x7eb8d8,
  ambient: 0xfff0d8,
  sun: 0xffe8c0,
} as const;
