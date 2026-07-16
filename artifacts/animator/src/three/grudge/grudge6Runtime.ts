/**
 * Grudge6 Danger Room runtime — skinned race mesh + baked Bip001 clips.
 *
 * Same pipeline as grudge-arena `createBakedGrudge6Unit`:
 *   arena CDN GLB (Bip001 skins) + /anims/baked/{pack} JSON → AnimationMixer
 *
 * Used by GrudgeAvatar so fleet characters are NOT static T-pose meshes.
 */
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  ANIM_PACK_CLIPS,
  SPRINT_CLIP,
  asAnimPack,
  loadBakedClip,
  type AnimPack,
} from "./anims";
import { RACE_ASSETS, type RaceId } from "./raceAssets";
import { getPreset, type PresetId } from "./gearPresets";
import { applyBodyTexture, applyGearPreset, meshKey } from "./loadCharacter";
import { loadBodyTexture } from "./texture";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight } from "../fitCharacterHeight";
import { FLEET_ASSET_HOSTS, resolveAssetCandidates } from "../fleetAssetResolver";
import { PLAYER_HEIGHT_M } from "../../lib/productionRuntime";

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
export const ARENA_ORIGIN = FLEET_ASSET_HOSTS.arena;

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

/** Canonical player height (metres) — must match Controller / map scale. */
const TARGET_HEIGHT = PLAYER_HEIGHT_M || 1.8;
const meshCache = new Map<RaceId, Promise<THREE.Object3D>>();

async function loadRaceTemplate(raceId: RaceId): Promise<THREE.Object3D> {
  let p = meshCache.get(raceId);
  if (p) return p;
  p = (async () => {
    let lastErr: unknown;

    // 1) Prefer race FBX SSOT (correct UVs for Toon RTS atlas rebind)
    try {
      const { loadCharacterModel } = await import("./loadCharacter");
      const race = RACE_ASSETS[raceId];
      const loaded = await loadCharacterModel(race.modelUrl);
      console.info(`[grudge6Runtime] race kit FBX ready ${raceId}`);
      return loaded.group;
    } catch (e) {
      lastErr = e;
      console.warn(`[grudge6Runtime] FBX kit failed ${raceId}, trying arena GLB`, e);
    }

    // 2) Arena / CDN skinned GLB (still rebind atlas after load)
    const dir = ARENA_RACE_DIR[raceId];
    const file = ARENA_RACE_GLB[raceId];
    const rel = `cdn/assets/characters/${dir}/${file}`;
    const urls = [
      ...resolveAssetCandidates(rel),
      arenaCharacterGlbUrlAbsolute(raceId),
      `https://assets.grudge-studio.com/models/grudge6/races/${file}`,
    ];
    const loader = sharedGltfLoader();
    for (const url of [...new Set(urls)]) {
      try {
        const gltf = await loader.loadAsync(url);
        console.info(`[grudge6Runtime] race kit GLB ready ${raceId} ${url}`);
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

/**
 * Normalize race GLB to ~1.8 m human height.
 * Uses fitCharacterHeight (skinned body measure + decade unit fix + clamps)
 * so a bad bind-pose bbox cannot explode scale by ~100×.
 */
function normalizeSkinned(root: THREE.Object3D): void {
  // Force bind matrices current before measuring skinned AABB
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) {
      sk.skeleton.update();
    }
  });
  root.updateWorldMatrix(true, true);

  const fit = fitCharacterHeight(root, TARGET_HEIGHT, 1);
  if (fit.unitFix !== 1 || fit.scale > 3 || fit.scale < 0.05) {
    console.info(
      `[grudge6Runtime] height fit native=${fit.nativeHeight.toFixed(3)} unitFix=${fit.unitFix} scale=${fit.scale.toFixed(4)} target=${TARGET_HEIGHT}`,
    );
  }

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
}

/** Fuzzy mesh key — matches D1 mesh_ids to in-file Toon RTS names. */
function meshKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Equipment = child-mesh visibility (grudge6-modular-characters).
 * Hide all equippable race parts, then show only the preset mesh_ids.
 */
export function applyGearVisibility(root: THREE.Object3D, visibleMeshes: string[]): void {
  if (!visibleMeshes.length) return;
  const wantKeys = visibleMeshes.map(meshKey);
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const n = o.name;
    if (!n) return;
    // Only toggle Toon RTS / race kit pieces (not ground props accidentally parented)
    const equippable =
      /^(WK_|BRB_|ORC_|ELF_|UD_|DWF_)/i.test(n) ||
      /body|arms|legs|head|shoulder|weapon|shield|xtra|quiver|staff|sword|bow|axe|hammer|mace|spear|dagger|pick/i.test(
        n,
      );
    if (!equippable) return;
    const key = meshKey(n);
    let show = false;
    for (const w of wantKeys) {
      if (key === w || key.endsWith(w) || w.endsWith(key)) {
        show = true;
        break;
      }
    }
    o.visible = show;
  });
}

/** Per-race shared atlas (one Texture + one Material style bind). */
const atlasCache = new Map<RaceId, Promise<THREE.Texture>>();

async function loadRaceAtlas(raceId: RaceId): Promise<THREE.Texture> {
  let p = atlasCache.get(raceId);
  if (p) return p;
  const race = RACE_ASSETS[raceId];
  p = loadBodyTexture(race.textureUrl, race.textureFallbacks);
  atlasCache.set(raceId, p);
  return p;
}

/**
 * Rebind Toon RTS Standard Units atlas onto a loaded race kit.
 * flipY=false + MeshStandard is applied inside loadBodyTexture / applyBodyTexture.
 */
export async function rebindRaceAtlas(root: THREE.Object3D, raceId: RaceId): Promise<THREE.Material | null> {
  try {
    const tex = await loadRaceAtlas(raceId);
    return applyBodyTexture(root, tex);
  } catch (err) {
    console.warn(`[grudge6Runtime] atlas rebind failed for ${raceId}`, err);
    return null;
  }
}

export interface Grudge6LoadedRig {
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  roles: Map<string, string>;
  animPack: AnimPack;
}

export interface LoadGrudge6Opts {
  /** Override gear preset meshes with account / main-panel mesh_ids */
  meshIds?: string[];
  /** Prefer race FBX atlas rebind (always on). */
  rebindAtlas?: boolean;
}

/**
 * Load a playable grudge6 unit: skinned mesh + baked idle/walk/run/attack(+sprint).
 * Equipment = child-mesh visibility from meshIds (account) or class gear preset.
 */
export async function loadGrudge6CombatRig(
  raceId: RaceId,
  presetId: PresetId,
  opts?: LoadGrudge6Opts,
): Promise<Grudge6LoadedRig> {
  const preset = getPreset(raceId, presetId);
  const animPack = asAnimPack(preset.animPack);
  const pack = ANIM_PACK_CLIPS[animPack];
  const meshIds =
    opts?.meshIds && opts.meshIds.length >= 2 ? opts.meshIds : preset.visibleMeshes;

  const template = await loadRaceTemplate(raceId);
  const model = cloneSkinned(template);
  normalizeSkinned(model);
  // Toon RTS atlas on every mesh (sRGB, flipY false, MeshStandard) before equip hide
  if (opts?.rebindAtlas !== false) {
    await rebindRaceAtlas(model, raceId);
  }
  applyGearVisibility(model, meshIds);
  model.userData.equipMeshIds = meshIds.slice();
  model.userData.equipSource = opts?.meshIds?.length ? "account" : "class_preset";

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

  // Core locomotion + weapon pack attack (player-parity combat base)
  await Promise.all([
    loadRole("idle", pack.idle),
    loadRole("walk", pack.walk),
    loadRole("run", pack.run),
    loadRole("attack", pack.attack),
    loadRole("sprint", SPRINT_CLIP).catch(() => loadRole("sprint", pack.run)),
  ]);

  // Optional skill / cast / defense aliases — best-effort, never block load.
  // Magic kits load a dedicated cast clip; other packs alias cast → attack.
  if (animPack === "magic") {
    await loadRole("cast", pack.attack);
    await loadRole("magicAttack", pack.attack);
  } else if (animPack === "longbow") {
    // Ranged poke uses aim/recoil as both attack and "cast" (bolt)
    await loadRole("cast", pack.attack);
    await loadRole("magicAttack", pack.attack);
  } else {
    // Melee / unarmed: cast & skill slots fall back to attack swing
    if (clips.has("attack")) {
      clips.set("cast", clips.get("attack")!);
      roles.set("cast", "cast");
      clips.set("magicAttack", clips.get("attack")!);
      roles.set("magicAttack", "magicAttack");
    }
  }

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

  // Player-style skill slot aliases (F/1–4 + AI skill swings) → attack when
  // dedicated skill clips are not baked yet. Keeps weapon skills animating.
  if (clips.has("attack")) {
    const atk = clips.get("attack")!;
    const skillAliases = [
      "skill1",
      "skill2",
      "skill3",
      "skill4",
      "sig1",
      "sig2",
      "sig3",
      "sig4",
      "combo",
      "special",
      "power",
      "sword_dash_attack",
      "overhead",
      "thrust",
      "slash",
      "dodge",
      "parry",
      "block",
      "hurt",
      "death",
      "jump",
    ];
    for (const name of skillAliases) {
      if (!clips.has(name)) {
        clips.set(name, atk);
        roles.set(name, name);
      }
    }
  }

  if (!clips.has("idle")) {
    throw new Error(`[grudge6Runtime] no locomotion clips for ${raceId}/${animPack}`);
  }

  return { root, model, mixer, clips, roles, animPack };
}
