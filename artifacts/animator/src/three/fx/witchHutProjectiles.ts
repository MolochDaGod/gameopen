/**
 * Witch Hut in a Swamp → projectile pack.
 *
 * Same GLB reused with authored scales:
 *  - arrow:   [0.1276, 2.0858, 0.1011]  long thin (also legion-island scale)
 *  - disk:    [3.9617, 0.1837, 3.3952]  spinning AOE disc
 *  - missile: mid stretch + spin for spell bolts
 *
 * Materials get animated emissive/opacity/UV for magical read.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";

export const WITCH_HUT_R2_KEY = "models/vfx/witch_hut_in_a_swamp.glb";
export const WITCH_HUT_WORLD_KEY = "models/worlds/witch_hut_in_a_swamp.glb";

export type WitchProjectileRole = "arrow" | "missile" | "aoe_disk";
export type WitchMatAnim = "emberScroll" | "arcanePulse" | "swampGlow";

export interface WitchProjectileVariant {
  id: string;
  label: string;
  role: WitchProjectileRole;
  scale: [number, number, number];
  /** Model-local axis aligned to travel (null = lookAt). */
  align: [number, number, number] | null;
  speed: number;
  range: number;
  spin: number;
  trail: boolean;
  homing?: boolean;
  groundSeek?: boolean;
  matAnim: WitchMatAnim;
  tint: number;
  tint2: number;
  aoeRadius?: number;
}

/** Authored transforms from the user’s Unity/Blender placement. */
export const WITCH_PROJECTILE_VARIANTS: Record<
  "arrow" | "missile" | "disk",
  WitchProjectileVariant
> = {
  arrow: {
    id: "witch_arrow",
    label: "Witch Arrow",
    role: "arrow",
    scale: [0.1276, 2.0858, 0.1011],
    align: [0, 1, 0],
    speed: 34,
    range: 28,
    spin: 0,
    trail: true,
    matAnim: "emberScroll",
    tint: 0xff6a1e,
    tint2: 0xffd27a,
  },
  missile: {
    id: "witch_missile",
    label: "Witch Missile",
    role: "missile",
    scale: [0.22, 1.4, 0.18],
    align: [0, 1, 0],
    speed: 22,
    range: 26,
    spin: 4.5,
    trail: true,
    homing: true,
    matAnim: "arcanePulse",
    tint: 0xb070ff,
    tint2: 0xe0a0ff,
  },
  disk: {
    id: "witch_disk",
    label: "Witch Disk AoE",
    role: "aoe_disk",
    scale: [3.9617, 0.1837, 3.3952],
    align: null,
    speed: 12,
    range: 18,
    spin: 8.5,
    trail: false,
    groundSeek: true,
    matAnim: "swampGlow",
    tint: 0x3dff9a,
    tint2: 0xa0ffe0,
    aoeRadius: 3.2,
  },
};

/** Legion island placement (same Y-stretch as arrow — elongated hut island). */
export const WITCH_LEGION_ISLAND = {
  r2Key: WITCH_HUT_WORLD_KEY,
  position: [0, 0, 0] as const,
  rotation: [0, 0, 0] as const,
  scale: [0.1276, 2.0858, 0.1011] as const,
};

let packRoot: THREE.Object3D | null = null;
let packLoad: Promise<THREE.Object3D | null> | null = null;

export async function ensureWitchHutLoaded(): Promise<THREE.Object3D | null> {
  if (packRoot) return packRoot;
  if (!packLoad) {
    packLoad = (async () => {
      try {
        const { scene } = await loadGltfFirst(
          [WITCH_HUT_R2_KEY, WITCH_HUT_WORLD_KEY, "models/vfx/witch_hut_in_a_swamp.glb"],
          sharedGltfLoader(),
          { prepMaterials: true },
        );
        // Strip lights — we only want meshes for projectiles
        const keep: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if ((o as THREE.Light).isLight) {
            o.visible = false;
          }
        });
        // Prefer hero + lantern + water + bridge meshes for denser read at small scale
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const n = (m.name || "").toLowerCase();
          if (
            n.includes("hero") ||
            n.includes("lantern") ||
            n.includes("water") ||
            n.includes("bridge") ||
            n.includes("barrel") ||
            n.includes("tree")
          ) {
            keep.push(m);
          }
        });
        packRoot = scene;
        return scene;
      } catch (err) {
        console.warn("[witchHut] load failed", err);
        packLoad = null;
        return null;
      }
    })();
  }
  return packLoad;
}

/**
 * Clone instance with per-spawn materials + authored variant scale.
 * Geometry shared with template.
 */
export function buildWitchProjectileInstance(
  tpl: THREE.Object3D,
  variant: WitchProjectileVariant,
): { obj: THREE.Group; mats: THREE.Material[] } {
  const wrap = new THREE.Group();
  wrap.name = `witchProj:${variant.id}`;
  const clone = tpl.clone(true);
  // Apply authored scale (arrow / disk / missile)
  clone.scale.set(variant.scale[0], variant.scale[1], variant.scale[2]);
  wrap.add(clone);

  const mats: THREE.Material[] = [];
  const c1 = new THREE.Color(variant.tint);
  const c2 = new THREE.Color(variant.tint2);

  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const srcList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = srcList.map((src) => {
      const m = (src as THREE.Material).clone() as THREE.MeshStandardMaterial;
      m.transparent = true;
      m.depthWrite = false;
      m.side = THREE.DoubleSide;
      // Preserve maps (texture from hut), add magic tint + emissive anim hooks
      if (m.map) {
        m.map = m.map.clone();
        m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
        m.map.needsUpdate = true;
      }
      if ("color" in m && m.color) m.color.lerp(c1, 0.45);
      if ("emissive" in m) {
        m.emissive = c1.clone();
        m.emissiveIntensity = 0.65;
      }
      // Store anim params on userData for tick
      m.userData.witchAnim = variant.matAnim;
      m.userData.tint1 = c1;
      m.userData.tint2 = c2;
      m.userData.baseEmissive = m.emissiveIntensity ?? 0.65;
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
    mats.push(...cloned);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  return { obj: wrap, mats };
}

/** Per-frame material animation (textures + emissive pulse). */
export function tickWitchMaterials(mats: THREE.Material[], age: number, dt: number) {
  for (const mat of mats) {
    const m = mat as THREE.MeshStandardMaterial;
    const anim = m.userData.witchAnim as WitchMatAnim | undefined;
    const t1 = m.userData.tint1 as THREE.Color | undefined;
    const t2 = m.userData.tint2 as THREE.Color | undefined;
    const base = (m.userData.baseEmissive as number) ?? 0.65;
    if (!anim) continue;

    if (m.map) {
      if (anim === "emberScroll") {
        m.map.offset.y = (m.map.offset.y + dt * 1.8) % 1;
        m.map.offset.x = (m.map.offset.x + dt * 0.35) % 1;
      } else if (anim === "arcanePulse") {
        m.map.offset.x = (m.map.offset.x + dt * 0.9) % 1;
        m.map.rotation = age * 0.8;
      } else if (anim === "swampGlow") {
        m.map.offset.x = Math.sin(age * 1.2) * 0.05;
        m.map.offset.y = (m.map.offset.y + dt * 0.45) % 1;
      }
      m.map.needsUpdate = true;
    }

    if ("emissive" in m && m.emissive && t1 && t2) {
      const pulse =
        anim === "emberScroll"
          ? 0.55 + 0.45 * Math.sin(age * 12)
          : anim === "arcanePulse"
            ? 0.5 + 0.5 * Math.abs(Math.sin(age * 6))
            : 0.45 + 0.4 * Math.sin(age * 3.5);
      m.emissive.copy(t1).lerp(t2, 0.35 + 0.35 * Math.sin(age * 4));
      m.emissiveIntensity = base * (0.8 + pulse);
    }
    if ("opacity" in m) {
      m.opacity = 0.75 + 0.2 * Math.sin(age * 5 + mats.indexOf(mat));
    }
  }
}

/** D1 / registry metadata for skill bindings. */
export function witchProjectileD1Meta() {
  return {
    r2Key: WITCH_HUT_R2_KEY,
    worldKey: WITCH_HUT_WORLD_KEY,
    cdnUrl: `https://assets.grudge-studio.com/${WITCH_HUT_R2_KEY}`,
    variants: WITCH_PROJECTILE_VARIANTS,
    legionIsland: WITCH_LEGION_ISLAND,
    skillKinds: ["witchArrow", "witchMissile", "witchDisk"],
    weaponSkillBindings: [
      { weaponGroup: "bow", variant: "arrow" },
      { weaponGroup: "magic", variant: "missile" },
      { weaponGroup: "staff", variant: "disk" },
      { weaponGroup: "spear", variant: "arrow" },
      { weaponGroup: "gunblade", variant: "missile" },
    ],
  };
}
