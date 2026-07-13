/**
 * Grudge6 Danger Room runtime — skinned race mesh + baked Bip001 clips.
 *
 * Same pipeline as grudge-arena `createBakedGrudge6Unit`:
 *   arena CDN GLB (Bip001 skins) + /anims/baked/{pack} JSON → AnimationMixer
 *
 * Used by GrudgeAvatar so fleet characters are NOT static T-pose meshes.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  ANIM_PACK_CLIPS,
  SPRINT_CLIP,
  asAnimPack,
  loadBakedClip,
  type AnimPack,
} from "./anims";
import type { RaceId } from "./raceAssets";
import type { PresetId } from "./gearPresets";
import { getPreset } from "./index";

/** Arena race folder names under /cdn/assets/characters/{race}/ */
export const ARENA_RACE_DIR: Record<RaceId, string> = {
  "western-kingdoms": "human",
  barbarians: "barbarian",
  "high-elves": "elf",
  dwarves: "dwarf",
  orcs: "orc",
  undead: "undead",
};

/** Arena GLB filenames (prod-proven on grudge-arena.grudge-studio.com). */
export const ARENA_RACE_GLB: Record<RaceId, string> = {
  "western-kingdoms": "WK_Characters.glb",
  barbarians: "BRB_Characters.glb",
  "high-elves": "ELF_Characters.glb",
  dwarves: "DWF_Characters.glb",
  orcs: "ORC_Characters.glb",
  undead: "UD_Characters.glb",
};

/** Prefer same-origin proxy (vercel rewrites → arena); fall back to absolute arena. */
export const ARENA_ORIGIN = "https://grudge-arena.grudge-studio.com";

export function arenaCharacterGlbUrl(raceId: RaceId): string {
  const dir = ARENA_RACE_DIR[raceId];
  const file = ARENA_RACE_GLB[raceId];
  // Same-origin first so open.grudge-studio.com can proxy via vercel.json
  return `/cdn/assets/characters/${dir}/${file}`;
}

export function arenaCharacterGlbUrlAbsolute(raceId: RaceId): string {
  const dir = ARENA_RACE_DIR[raceId];
  const file = ARENA_RACE_GLB[raceId];
  return `${ARENA_ORIGIN}/cdn/assets/characters/${dir}/${file}`;
}

const TARGET_HEIGHT = 1.85;
const gltfLoader = new GLTFLoader();
const meshCache = new Map<RaceId, Promise<THREE.Object3D>>();

async function loadRaceTemplate(raceId: RaceId): Promise<THREE.Object3D> {
  let p = meshCache.get(raceId);
  if (p) return p;
  p = (async () => {
    const urls = [arenaCharacterGlbUrl(raceId), arenaCharacterGlbUrlAbsolute(raceId)];
    let lastErr: unknown;
    for (const url of urls) {
      try {
        const gltf = await gltfLoader.loadAsync(url);
        return gltf.scene;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error(`Failed to load grudge6 race mesh for ${raceId}`);
  })();
  meshCache.set(raceId, p);
  return p;
}

function normalizeSkinned(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  // Body-only height (ignore weapon props when possible)
  const box = new THREE.Box3();
  let hasSkinned = false;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      box.expandByObject(o);
      hasSkinned = true;
    }
  });
  if (!hasSkinned) box.setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const h = size.y || 1;
  const s = TARGET_HEIGHT / h;
  root.scale.multiplyScalar(s);
  root.updateWorldMatrix(true, true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  const c = box2.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
}

/** Apply gear preset mesh visibility (hide non-listed equipment children). */
export function applyGearVisibility(root: THREE.Object3D, visibleMeshes: string[]): void {
  if (!visibleMeshes.length) return;
  const want = new Set(visibleMeshes.map((n) => n.toLowerCase()));
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const n = o.name;
    if (!n) return;
    // Always keep body/head-ish meshes if listed; hide explicit gear not in preset
    const ln = n.toLowerCase();
    const isGear =
      /weapon|shield|shoulder|xtra|quiver|staff|sword|bow|axe|helm|armor/i.test(n);
    if (!isGear) return;
    // Show if name matches any listed mesh (substring or exact)
    let show = false;
    for (const w of want) {
      if (ln === w || ln.includes(w) || w.includes(ln)) {
        show = true;
        break;
      }
    }
    o.visible = show;
  });
}

export interface Grudge6LoadedRig {
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  roles: Map<string, string>;
  animPack: AnimPack;
}

/**
 * Load a playable grudge6 unit: skinned GLB + baked idle/walk/run/attack(+sprint).
 */
export async function loadGrudge6CombatRig(
  raceId: RaceId,
  presetId: PresetId,
): Promise<Grudge6LoadedRig> {
  const preset = getPreset(raceId, presetId);
  const animPack = asAnimPack(preset.animPack);
  const pack = ANIM_PACK_CLIPS[animPack];

  const template = await loadRaceTemplate(raceId);
  const model = cloneSkinned(template);
  normalizeSkinned(model);
  applyGearVisibility(model, preset.visibleMeshes);

  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map<string, THREE.AnimationClip>();
  const roles = new Map<string, string>();

  const loadRole = async (role: string, rel: string) => {
    try {
      // Prefer same-origin /anims/baked (vercel → arena); loadBakedClip handles base
      const clip = await loadBakedClip(rel);
      clips.set(role, clip);
      roles.set(role, role);
      return clip;
    } catch (e1) {
      try {
        const clip = await loadBakedClip(rel, ARENA_ORIGIN);
        clips.set(role, clip);
        roles.set(role, role);
        return clip;
      } catch (e2) {
        console.warn(`[grudge6Runtime] clip failed ${role} ${rel}`, e1, e2);
        return null;
      }
    }
  };

  await Promise.all([
    loadRole("idle", pack.idle),
    loadRole("walk", pack.walk),
    loadRole("run", pack.run),
    loadRole("attack", pack.attack),
    loadRole("sprint", SPRINT_CLIP).catch(() => loadRole("sprint", pack.run)),
  ]);

  // Guarantee idle exists so we never sit in bind pose (T-pose)
  if (!clips.has("idle") && clips.size) {
    const first = clips.values().next().value!;
    clips.set("idle", first);
    roles.set("idle", "idle");
  }
  if (!clips.has("walk") && clips.has("run")) {
    clips.set("walk", clips.get("run")!);
    roles.set("walk", "walk");
  }
  if (!clips.has("run") && clips.has("walk")) {
    clips.set("run", clips.get("walk")!);
    roles.set("run", "run");
  }
  if (!clips.has("sprint") && clips.has("run")) {
    clips.set("sprint", clips.get("run")!);
    roles.set("sprint", "sprint");
  }

  if (!clips.has("idle")) {
    throw new Error(`[grudge6Runtime] no locomotion clips for ${raceId}/${animPack}`);
  }

  return { root, model, mixer, clips, roles, animPack };
}
