/**
 * projectilebomb.glb → arrows, missiles, spinning AOE disks for weapon skills.
 *
 * Authored scales (user placement):
 *  - arrow:  [0.1276, 2.0858, 0.1011]  long thin
 *  - disk:   [3.9617, 0.1837, 3.3952]  spinning path / AOE
 *  - missile: mid stretch + spin
 *
 * Witch hut is NOT used here — island only (models/worlds/witch_hut_in_a_swamp.glb).
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";

export const PROJECTILE_BOMB_R2_KEY = "models/vfx/projectilebomb.glb";

export type BombProjectileRole = "arrow" | "missile" | "aoe_disk";
export type BombMatAnim = "emberScroll" | "arcanePulse" | "swampGlow";

export interface BombProjectileVariant {
  id: string;
  label: string;
  role: BombProjectileRole;
  scale: [number, number, number];
  align: [number, number, number] | null;
  speed: number;
  range: number;
  spin: number;
  trail: boolean;
  homing?: boolean;
  groundSeek?: boolean;
  matAnim: BombMatAnim;
  tint: number;
  tint2: number;
  aoeRadius?: number;
}

export const BOMB_PROJECTILE_VARIANTS: Record<
  "arrow" | "missile" | "disk",
  BombProjectileVariant
> = {
  arrow: {
    id: "bomb_arrow",
    label: "Bomb Arrow",
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
    id: "bomb_missile",
    label: "Bomb Missile",
    role: "missile",
    scale: [0.22, 1.4, 0.18],
    align: [0, 1, 0],
    speed: 24,
    range: 28,
    spin: 5.5,
    trail: true,
    homing: true,
    matAnim: "arcanePulse",
    tint: 0xb070ff,
    tint2: 0xe0a0ff,
  },
  disk: {
    id: "bomb_disk",
    label: "Bomb Disk AoE",
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

let packRoot: THREE.Object3D | null = null;
let packAnims: THREE.AnimationClip[] = [];
let packLoad: Promise<THREE.Object3D | null> | null = null;

export async function ensureProjectileBombLoaded(): Promise<{
  root: THREE.Object3D | null;
  clips: THREE.AnimationClip[];
}> {
  if (packRoot) return { root: packRoot, clips: packAnims };
  if (!packLoad) {
    packLoad = (async () => {
      try {
        const { scene, animations } = await loadGltfFirst(
          [PROJECTILE_BOMB_R2_KEY, "models/vfx/projectilebomb.glb"],
          sharedGltfLoader(),
          { prepMaterials: true },
        );
        // Normalize authoring scale (file has 100x skeleton nodes)
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const max = Math.max(size.x, size.y, size.z) || 1;
        // Fit to ~1m unit cube before variant scales
        scene.scale.multiplyScalar(1 / max);
        scene.position.set(0, 0, 0);
        packRoot = scene;
        packAnims = animations?.slice() ?? [];
        return scene;
      } catch (err) {
        console.warn("[projectileBomb] load failed", err);
        packLoad = null;
        return null;
      }
    })();
  }
  const root = await packLoad;
  return { root, clips: packAnims };
}

export function buildBombProjectileInstance(
  tpl: THREE.Object3D,
  variant: BombProjectileVariant,
  clips: THREE.AnimationClip[] = [],
): {
  obj: THREE.Group;
  mats: THREE.Material[];
  mixer: THREE.AnimationMixer | null;
} {
  const wrap = new THREE.Group();
  wrap.name = `bombProj:${variant.id}`;
  const clone = tpl.clone(true);
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
      if (m.map) {
        m.map = m.map.clone();
        m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
        m.map.needsUpdate = true;
      }
      if ("color" in m && m.color) m.color.lerp(c1, 0.4);
      if ("emissive" in m) {
        m.emissive = c1.clone();
        m.emissiveIntensity = 0.85;
      }
      m.userData.bombAnim = variant.matAnim;
      m.userData.tint1 = c1;
      m.userData.tint2 = c2;
      m.userData.baseEmissive = m.emissiveIntensity ?? 0.85;
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
    mats.push(...cloned);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  let mixer: THREE.AnimationMixer | null = null;
  if (clips.length) {
    mixer = new THREE.AnimationMixer(clone);
    const clip = clips.find((c) => /idle/i.test(c.name)) ?? clips[0]!;
    const action = mixer.clipAction(clip);
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }

  return { obj: wrap, mats, mixer };
}

export function tickBombMaterials(mats: THREE.Material[], age: number, dt: number) {
  for (const mat of mats) {
    const m = mat as THREE.MeshStandardMaterial;
    const anim = m.userData.bombAnim as BombMatAnim | undefined;
    const t1 = m.userData.tint1 as THREE.Color | undefined;
    const t2 = m.userData.tint2 as THREE.Color | undefined;
    const base = (m.userData.baseEmissive as number) ?? 0.85;
    if (!anim) continue;

    if (m.map) {
      if (anim === "emberScroll") {
        m.map.offset.y = (m.map.offset.y + dt * 2.2) % 1;
        m.map.offset.x = (m.map.offset.x + dt * 0.4) % 1;
      } else if (anim === "arcanePulse") {
        m.map.offset.x = (m.map.offset.x + dt * 1.1) % 1;
        m.map.rotation = age * 1.2;
      } else if (anim === "swampGlow") {
        m.map.offset.x = Math.sin(age * 1.4) * 0.06;
        m.map.offset.y = (m.map.offset.y + dt * 0.55) % 1;
      }
      m.map.needsUpdate = true;
    }

    if ("emissive" in m && m.emissive && t1 && t2) {
      const pulse =
        anim === "emberScroll"
          ? 0.55 + 0.5 * Math.sin(age * 14)
          : anim === "arcanePulse"
            ? 0.5 + 0.55 * Math.abs(Math.sin(age * 7))
            : 0.45 + 0.45 * Math.sin(age * 4);
      m.emissive.copy(t1).lerp(t2, 0.35 + 0.35 * Math.sin(age * 5));
      m.emissiveIntensity = base * (0.85 + pulse);
    }
    if ("opacity" in m) {
      m.opacity = 0.8 + 0.18 * Math.sin(age * 6 + mats.indexOf(mat));
    }
  }
}

export function projectileBombD1Meta() {
  return {
    r2Key: PROJECTILE_BOMB_R2_KEY,
    cdnUrl: `https://assets.grudge-studio.com/${PROJECTILE_BOMB_R2_KEY}`,
    source: "C:/Users/nugye/Documents/projectilebomb.glb",
    title: "Metroid Prime Missile Launcher mesh (projectilebomb)",
    variants: BOMB_PROJECTILE_VARIANTS,
    skillKinds: ["witchArrow", "witchMissile", "witchDisk"],
    weaponSkillBindings: [
      { weaponGroup: "bow", skillKinds: ["witchArrow"] },
      { weaponGroup: "magic", skillKinds: ["witchMissile", "witchDisk"] },
      { weaponGroup: "spear", skillKinds: ["witchArrow"] },
      { weaponGroup: "gunblade", skillKinds: ["witchMissile"] },
    ],
  };
}
