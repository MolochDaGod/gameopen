/**
 * 3D hats for Avatar Edit cube heads.
 *
 * Sources under `public/avatar/hats/`:
 * - `hat-pack.glb` — Pirate / Cowboy / Witch / TopHat / Princess
 * - `pirate-voxel.glb` — blocky voxel pirate
 * - `crown.glb` — golden crown
 * - Procedural fallbacks for horns / hood when GLBs are missing
 *
 * Templates are normalized into head-unit space and cached. Mounted hats
 * clone shared geometry — dispose never frees template GPU resources.
 */
import * as THREE from "three";
import type { AvatarConfig, HatId, PartAdjust, RaceId } from "./catalog";
import { isHidden } from "./catalog";

interface HatDef {
  src: "pack" | "voxel" | "file" | "procedural";
  node?: string;
  /** Relative path from public root (not always under avatar/hats/). */
  file?: string;
  fit: number;
  y: number;
  rotY?: number;
  rotX?: number;
  /** Skip metal neutralization — keeps hat textures readable. */
  keepMetal?: boolean;
}

const HAT_DEFS: Record<Exclude<HatId, "none">, HatDef> = {
  pirateVoxel: { src: "voxel", fit: 1.45, y: -0.1 },
  pirate: { src: "pack", node: "Pirate_low", fit: 1.5, y: -0.06 },
  cowboy: { src: "pack", node: "Cowboy_low", fit: 1.55, y: -0.05 },
  witch: { src: "pack", node: "Witch_low", fit: 1.45, y: -0.06 },
  tophat: { src: "pack", node: "TopHat_low", fit: 1.2, y: -0.03 },
  princess: { src: "pack", node: "Princess_low", fit: 0.85, y: -0.02 },
  horns: { src: "procedural", fit: 1.05, y: -0.04 },
  hood: { src: "procedural", fit: 1.32, y: -0.38 },
  crown: {
    src: "file",
    file: "avatar/hats/crown.glb",
    fit: 1.15,
    y: -0.02,
    rotX: -Math.PI / 2,
    keepMetal: true,
  },
  circlet3d: { src: "procedural", fit: 1.05, y: 0.02 },
  warhelm: { src: "procedural", fit: 1.35, y: -0.22 },
  leafCrown: { src: "procedural", fit: 1.1, y: -0.02 },
};

function hatPath(file: string): string {
  // Absolute-from-public paths (contain /) pass through; short names live under avatar/hats/
  if (file.includes("/")) return file;
  return `avatar/hats/${file}`;
}

let packScene: Promise<THREE.Group> | null = null;
let voxelScene: Promise<THREE.Group> | null = null;
const fileScenes = new Map<string, Promise<THREE.Group>>();

async function loadScene(path: string, keepMetal = false): Promise<THREE.Group> {
  const { loadGltfFirst } = await import("../assets");
  const { sharedGltfLoader } = await import("../loaders/gltf");
  const gltf = await loadGltfFirst(path, sharedGltfLoader(), {
    // Hats often ship with metalness=1 that washes to black after neutralize;
    // still fix colorSpace/mips via prep when keepMetal is false.
    prepMaterials: !keepMetal,
  });
  gltf.scene.updateWorldMatrix(true, true);
  // Ensure textures are sRGB and maps visible even when prep is skipped.
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm) continue;
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.needsUpdate = true;
      }
      // Guard against fully-black metal-only hats under ACES
      if (sm.metalness !== undefined && sm.metalness > 0.85 && !sm.map) {
        sm.metalness = 0.35;
        sm.roughness = Math.min(sm.roughness ?? 0.5, 0.55);
      }
      sm.needsUpdate = true;
    }
  });
  return gltf.scene as THREE.Group;
}

function loadFileScene(file: string, keepMetal = false): Promise<THREE.Group> {
  const key = `${file}|${keepMetal ? 1 : 0}`;
  let p = fileScenes.get(key);
  if (!p) {
    p = loadScene(hatPath(file), keepMetal);
    fileScenes.set(key, p);
  }
  return p;
}

/** Normalized, cached template per hat id (shared geo/mats — never dispose). */
const templates = new Map<HatId, Promise<THREE.Group | null>>();

function cloneWithWorldTransform(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);
  source.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
  return clone;
}

function normalize(raw: THREE.Object3D, def: HatDef): THREE.Group {
  const wrap = new THREE.Group();
  const pivot = new THREE.Group();
  if (def.rotY) pivot.rotation.y = def.rotY;
  if (def.rotX) pivot.rotation.x = def.rotX;
  pivot.add(raw);
  wrap.add(pivot);
  wrap.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);
  const width = Math.max(size.x, size.z) || 1;
  const s = def.fit / width;
  pivot.scale.multiplyScalar(s);
  pivot.position.sub(centre.multiplyScalar(s));
  pivot.position.y += (size.y * s) / 2;

  wrap.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return wrap;
}

/** Clean pixel-adjacent box hats when GLB assets are missing. */
function buildProcedural(id: Exclude<HatId, "none">): THREE.Group {
  const g = new THREE.Group();
  const mat = (color: number, rough = 0.72, metal = 0.08) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

  if (id === "horns") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.35), mat(0x3a2818));
    base.position.y = 0.06;
    g.add(base);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 6), mat(0xe8e0d4, 0.55, 0.15));
      horn.position.set(side * 0.22, 0.38, -0.02);
      horn.rotation.z = side * 0.35;
      horn.rotation.x = -0.15;
      g.add(horn);
    }
  } else if (id === "hood") {
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.05), mat(0x3a3028));
    cowl.position.set(0, 0.2, -0.05);
    g.add(cowl);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.18, 0.55), mat(0x2a2218));
    rim.position.set(0, -0.18, 0.28);
    g.add(rim);
    // face opening
    const open = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.2), mat(0x0a0c10));
    open.position.set(0, 0.12, 0.48);
    g.add(open);
  } else if (id === "circlet3d") {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.05, 8, 24),
      mat(0xd4af37, 0.35, 0.65),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.48;
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const gem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), mat(0x5ec8ff, 0.3, 0.4));
      gem.position.set(Math.cos(a) * 0.42, 0.55, Math.sin(a) * 0.42);
      g.add(gem);
    }
  } else if (id === "warhelm") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a727c, 0.4, 0.55));
    dome.position.y = 0.15;
    g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.1, 14), mat(0x4a5058, 0.45, 0.5));
    brim.position.y = 0.12;
    g.add(brim);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.12), mat(0x5a6068, 0.4, 0.5));
    nose.position.set(0, 0.05, 0.48);
    g.add(nose);
  } else if (id === "leafCrown") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 5), mat(0x3d8a4a, 0.8, 0.05));
      leaf.position.set(Math.cos(a) * 0.4, 0.52, Math.sin(a) * 0.4);
      leaf.rotation.z = Math.cos(a) * 0.5;
      leaf.rotation.x = Math.sin(a) * 0.4;
      g.add(leaf);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 6, 20), mat(0x5a8f3a, 0.75, 0.05));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.45;
    g.add(band);
  } else if (id === "crown" || id === "princess") {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.14, 12), mat(0xd4af37, 0.35, 0.7));
    band.position.y = 0.48;
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), mat(0xffe08a, 0.3, 0.65));
      spike.position.set(Math.cos(a) * 0.38, 0.62, Math.sin(a) * 0.38);
      g.add(spike);
    }
  } else if (id === "pirateVoxel" || id === "pirate" || id === "cowboy" || id === "tophat" || id === "witch") {
    // Blocky soft cap so missing pack nodes never leave a bare head.
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.1), mat(0x3a2818));
    brim.position.y = 0.42;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), mat(0x4a3020));
    crown.position.y = 0.62;
    g.add(crown);
  } else {
    // Generic soft cap fallback
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4a5568));
    cap.position.y = 0.2;
    g.add(cap);
  }

  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.frustumCulled = false;
    }
  });
  return g;
}

function loadTemplate(id: Exclude<HatId, "none">): Promise<THREE.Group | null> {
  const def = HAT_DEFS[id];
  if (!def) return Promise.resolve(null);

  if (def.src === "procedural") {
    return Promise.resolve(normalize(buildProcedural(id), def));
  }

  if (def.src === "voxel") {
    voxelScene ??= loadScene(hatPath("pirate-voxel.glb")).then((scene) => {
      const root = scene.getObjectByName("Sketchfab_model");
      if (root) {
        root.quaternion.set(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
        scene.updateWorldMatrix(true, true);
      }
      return scene;
    });
    return voxelScene
      .then((scene) => normalize(cloneWithWorldTransform(scene), def))
      .catch((err) => {
        console.error(`avatar hat "${id}" failed to load`, err);
        return normalize(buildProcedural("pirateVoxel" as Exclude<HatId, "none">), def);
      });
  }

  if (def.src === "file") {
    const file = def.file!;
    return loadFileScene(file, def.keepMetal)
      .then((scene) => {
        const sketch = scene.getObjectByName("Sketchfab_model");
        if (sketch) {
          sketch.quaternion.set(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
          scene.updateWorldMatrix(true, true);
        }
        let source: THREE.Object3D = scene;
        if (def.node) {
          const node = scene.getObjectByName(def.node);
          if (!node) {
            console.error(`avatar hat "${id}": node "${def.node}" missing from ${file}`);
            return normalize(buildProcedural(id), def);
          }
          source = node;
        }
        return normalize(cloneWithWorldTransform(source), def);
      })
      .catch((err) => {
        console.error(`avatar hat "${id}" failed to load`, err);
        return normalize(buildProcedural(id), def);
      });
  }

  packScene ??= loadScene(hatPath("hat-pack.glb"));
  return packScene
    .then((scene) => {
      const node = def.node ? scene.getObjectByName(def.node) : null;
      if (!node) {
        console.error(`avatar hat "${id}": node "${def.node}" missing from pack`);
        return normalize(buildProcedural(id), def);
      }
      return normalize(cloneWithWorldTransform(node), def);
    })
    .catch((err) => {
      console.error(`avatar hat "${id}" failed to load`, err);
      return normalize(buildProcedural(id), def);
    });
}

export function resolveMountedHatId(cfg: AvatarConfig): HatId {
  if (cfg.hat !== "none" && !isHidden(cfg, "hat")) return cfg.hat;
  if (cfg.headgear === "horns" && !isHidden(cfg, "headgear")) return "horns";
  return "none";
}

export interface HatMount {
  dispose(): void;
}

export function mountHat(parent: THREE.Object3D, id: HatId, adjust?: PartAdjust): HatMount {
  if (id === "none" || adjust?.hide) return { dispose() {} };
  let cancelled = false;
  let attached: THREE.Object3D | null = null;

  let promise = templates.get(id);
  if (!promise) {
    promise = loadTemplate(id as Exclude<HatId, "none">);
    templates.set(id, promise);
  }
  void promise.then((template) => {
    if (cancelled || !template) return;
    const inst = template.clone(true);
    const def = HAT_DEFS[id as Exclude<HatId, "none">];
    if (!def) return;
    inst.position.set(adjust?.x ?? 0, 0.5 + def.y + (adjust?.y ?? 0), adjust?.z ?? 0);
    if (adjust && adjust.scale !== 1) inst.scale.setScalar(adjust.scale);
    if (adjust && (adjust.rotX !== 0 || adjust.rotY !== 0 || adjust.rotZ !== 0)) {
      const d = Math.PI / 180;
      inst.rotation.set(adjust.rotX * d, adjust.rotY * d, adjust.rotZ * d);
    }
    parent.add(inst);
    attached = inst;
  });

  return {
    dispose() {
      cancelled = true;
      if (attached) {
        attached.parent?.remove(attached);
        attached = null;
      }
    },
  };
}

/** Public icon path for hat chips (may 404 → CSS glyph fallback). */
export function hatIconUrl(id: HatId): string | null {
  if (id === "none") return null;
  return `avatar/hats/icons/${id}.jpg`;
}

/** Prefetch common hat templates so switching feels instant. */
export function warmHatTemplates(ids: HatId[]): void {
  for (const id of ids) {
    if (id === "none") continue;
    if (templates.has(id)) continue;
    templates.set(id, loadTemplate(id as Exclude<HatId, "none">));
  }
}

/** Race-filtered hat list (always includes none). */
export function hatsForRace(race: RaceId): HatId[] {
  const table: Record<RaceId, HatId[]> = {
    human: ["none", "pirateVoxel", "pirate", "cowboy", "tophat", "hood", "crown", "circlet3d"],
    barbarian: ["none", "horns", "warhelm", "hood", "pirateVoxel", "crown"],
    orc: ["none", "horns", "warhelm", "hood", "pirate", "crown"],
    undead: ["none", "hood", "witch", "tophat", "warhelm", "crown"],
    dwarf: ["none", "hood", "crown", "warhelm", "cowboy", "tophat"],
    elf: ["none", "leafCrown", "circlet3d", "princess", "hood", "crown", "witch"],
  };
  return table[race] ?? ["none", "hood", "crown"];
}
