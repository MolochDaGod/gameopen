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
  SPRINT_LOCO_MULT,
  asAnimPack,
  loadBakedClip,
  isNonLoopingLocoClip,
  type AnimPack,
} from "./anims";
// re-export for Studio weapon→pack swaps
export { animPackForWeapon } from "./anims";
import { RACE_ASSETS, type RaceId } from "./raceAssets";
import { getPreset, type PresetId } from "./gearPresets";
import { applyBodyTexture, applyGearPreset, meshKey } from "./loadCharacter";
import { loadBodyTexture } from "./texture";
import { unifySkeletons, rematchClipToSkeleton } from "./skeleton";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight, restoreCharacterMaterials } from "../fitCharacterHeight";
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

/**
 * How the race mesh was imported — drives material pipeline.
 *  - `glb-baked`: Arena / R2 production GLB with correct UVs + materials. Do NOT
 *    rebind the Toon RTS FBX atlas or skins look scrambled.
 *  - `fbx-atlas`: modular race FBX kit; requires Toon RTS atlas rebind.
 */
export type RaceImportPipeline = "glb-baked" | "fbx-atlas";

export interface RaceTemplate {
  object: THREE.Object3D;
  pipeline: RaceImportPipeline;
  url: string;
}

const meshCache = new Map<RaceId, Promise<RaceTemplate>>();

async function loadRaceTemplate(raceId: RaceId): Promise<RaceTemplate> {
  let p = meshCache.get(raceId);
  if (p) return p;
  p = (async (): Promise<RaceTemplate> => {
    let lastErr: unknown;
    const file = ARENA_RACE_GLB[raceId];
    const dir = ARENA_RACE_DIR[raceId];

    // 1) Arena combat GLB first — production-proven skinned kits (Danger Room SSOT).
    //    Keep baked materials; atlas rebind from FBX UV layout ruins these.
    {
      const rel = `cdn/assets/characters/${dir}/${file}`;
      const urls = [
        ...resolveAssetCandidates(rel),
        arenaCharacterGlbUrlAbsolute(raceId),
      ];
      const loader = sharedGltfLoader();
      for (const url of [...new Set(urls)]) {
        try {
          const gltf = await loader.loadAsync(url);
          console.info(`[grudge6Runtime] race kit Arena GLB ready ${raceId} ${url}`);
          return { object: gltf.scene, pipeline: "glb-baked", url };
        } catch (e) {
          lastErr = e;
        }
      }
    }

    // 2) R2 production GLB (smaller meshopt bake) — still glb-baked materials.
    {
      const r2Glb = `https://assets.grudge-studio.com/models/grudge6/races/${file}`;
      const rel = `models/grudge6/races/${file}`;
      const urls = [...resolveAssetCandidates(rel), r2Glb];
      const loader = sharedGltfLoader();
      for (const url of [...new Set(urls)]) {
        try {
          const gltf = await loader.loadAsync(url);
          console.info(`[grudge6Runtime] race kit R2 GLB ready ${raceId} ${url}`);
          return { object: gltf.scene, pipeline: "glb-baked", url };
        } catch (e) {
          lastErr = e;
        }
      }
    }

    // 3) FBX modular kit — only path that should rebind Toon RTS atlas.
    try {
      const { loadCharacterModel } = await import("./loadCharacter");
      const race = RACE_ASSETS[raceId];
      const loaded = await loadCharacterModel(race.modelUrl);
      console.info(`[grudge6Runtime] race kit FBX ready ${raceId} ${race.modelUrl}`);
      return {
        object: loaded.group,
        pipeline: "fbx-atlas",
        url: race.modelUrl,
      };
    } catch (e) {
      lastErr = e;
      console.warn(`[grudge6Runtime] FBX kit failed ${raceId}`, e);
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
function normalizeSkinned(root: THREE.Object3D, pipeline: RaceImportPipeline): void {
  // Force bind matrices current before measuring skinned AABB
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh && sk.skeleton) {
      sk.skeleton.update();
    }
  });
  root.updateWorldMatrix(true, true);

  // FBX path already height-fits in loadCharacter.normalizeCharacterGroup —
  // only re-fit if still absurd. GLB always fit once via fitCharacterHeight.
  const already = root.userData?.grudgeHeightFit === true;
  if (!already || pipeline === "glb-baked") {
    const fit = fitCharacterHeight(root, TARGET_HEIGHT, 1);
    root.userData.grudgeHeightFit = true;
    if (fit.unitFix !== 1 || fit.scale > 3 || fit.scale < 0.05) {
      console.info(
        `[grudge6Runtime] height fit pipeline=${pipeline} native=${fit.nativeHeight.toFixed(3)} unitFix=${fit.unitFix} scale=${fit.scale.toFixed(4)} target=${TARGET_HEIGHT}`,
      );
    }
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

/**
 * Equipment = child-mesh visibility (grudge6-modular-characters).
 * Delegates to {@link applyGearPreset} (fuzzy meshKey matching).
 */
export function applyGearVisibility(root: THREE.Object3D, visibleMeshes: string[]): void {
  applyGearPreset(root, visibleMeshes);
}

export { meshKey };

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
  const model = cloneSkinned(template.object);
  model.userData.importPipeline = template.pipeline;
  model.userData.importUrl = template.url;

  // Arena modular kits ship multiple disconnected skeletons — unify so clips deform all meshes.
  unifySkeletons(model);
  normalizeSkinned(model, template.pipeline);

  // Materials:
  //  - FBX modular kits need Toon RTS atlas rebind (UV contract matches FBX).
  //  - Arena/R2 GLBs already have correct baked materials — rebinding the FBX
  //    atlas onto them scrambles UVs and is the main "messed up models" bug.
  if (template.pipeline === "fbx-atlas" && opts?.rebindAtlas !== false) {
    await rebindRaceAtlas(model, raceId);
  } else {
    restoreCharacterMaterials(model, { neutralizeMetal: true });
    // Unlit MeshBasic mats must not be ACES-crushed (yellow/grey wash).
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshBasicMaterial) {
          m.toneMapped = false;
          if (m.map) m.color.setHex(0xffffff);
          m.needsUpdate = true;
        } else if (m instanceof THREE.MeshStandardMaterial && m.map) {
          m.color.setHex(0xffffff);
          m.metalness = Math.min(m.metalness, 0.12);
          m.roughness = Math.max(m.roughness, 0.55);
          m.needsUpdate = true;
        }
      }
    });
  }

  applyGearVisibility(model, meshIds);
  model.userData.equipMeshIds = meshIds.slice();
  model.userData.equipSource = opts?.meshIds?.length ? "account" : "class_preset";
  model.userData.physicsLayer = "character";

  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map<string, THREE.AnimationClip>();
  const roles = new Map<string, string>();

  const SAFE_LOCO_FALLBACK: Record<string, string> = {
    walk: "magic/Standing Walk Forward",
    run: "uploads_2026_06/locomotion/torch run forward",
    sprint: "uploads_2026_06/locomotion/torch run forward",
  };

  const loadRole = async (role: string, rel: string) => {
    const tryLoad = async (path: string) => {
      let clip = await loadBakedClip(path);
      if (isNonLoopingLocoClip(clip, path) && (role === "walk" || role === "run" || role === "sprint")) {
        throw new Error(`rejected non-looping ${path} for ${role}`);
      }
      clip = rematchClipToSkeleton(model, clip);
      return clip;
    };
    try {
      const clip = await tryLoad(rel);
      clips.set(role, clip);
      roles.set(role, role);
      return clip;
    } catch (e1) {
      try {
        let clip = await loadBakedClip(rel, ARENA_ORIGIN);
        if (isNonLoopingLocoClip(clip, rel) && (role === "walk" || role === "run" || role === "sprint")) {
          throw new Error(`rejected non-looping arena ${rel}`);
        }
        clip = rematchClipToSkeleton(model, clip);
        clips.set(role, clip);
        roles.set(role, role);
        return clip;
      } catch (e2) {
        // Last resort: known-good standing walk / torch run (never roll / tip-walk)
        const fb = SAFE_LOCO_FALLBACK[role];
        if (fb && fb !== rel) {
          try {
            const clip = await tryLoad(fb);
            console.warn(`[grudge6Runtime] ${role} fell back to ${fb} (was ${rel})`, e1, e2);
            clips.set(role, clip);
            roles.set(role, role);
            return clip;
          } catch (e3) {
            console.warn(`[grudge6Runtime] clip failed ${role} ${rel}`, e1, e2, e3);
            return null;
          }
        }
        console.warn(`[grudge6Runtime] clip failed ${role} ${rel}`, e1, e2);
        return null;
      }
    }
  };

  // Core locomotion + weapon pack attack (player-parity combat base).
  // NEVER load SPRINT_CLIP / locomotion/running — that JSON is run-to-roll.
  // Sprint = clone of pack run (arena bakedAnimLoader parity).
  await Promise.all([
    loadRole("idle", pack.idle),
    loadRole("walk", pack.walk),
    loadRole("run", pack.run),
    loadRole("attack", pack.attack),
  ]);

  // Pack extras (polearm combo / skills from Madarame bake, etc.)
  if (pack.extras?.length) {
    await Promise.all(
      pack.extras.map(async (rel) => {
        const role = rel.split("/").pop() || rel;
        // Don't overwrite core roles already loaded
        if (clips.has(role)) return;
        await loadRole(role, rel);
      }),
    );
  }

  // Sprint from true run cycle only (time-scale applied by AnimationDirector /
  // GrudgeAvatar setLocomotionRate when speed band is high).
  // NEVER load locomotion/running — that is run-to-roll.
  if (clips.has("run") && !isNonLoopingLocoClip(clips.get("run")!)) {
    const runClip = clips.get("run")!;
    const sprintClip = runClip.clone();
    sprintClip.name = "sprint";
    clips.set("sprint", sprintClip);
    roles.set("sprint", "sprint");
    sprintClip.userData = {
      ...(sprintClip.userData || {}),
      locoMult: SPRINT_LOCO_MULT,
      source: "clone:run",
    };
  } else if (clips.has("run") && isNonLoopingLocoClip(clips.get("run")!)) {
    console.error("[grudge6Runtime] RUN CLIP IS NON-LOOPING (roll) — stripping; torch run fallback");
    clips.delete("run");
    roles.delete("run");
    await loadRole("run", SAFE_LOCO_FALLBACK.run);
    if (clips.has("run")) {
      const sprintClip = clips.get("run")!.clone();
      sprintClip.name = "sprint";
      clips.set("sprint", sprintClip);
      roles.set("sprint", "sprint");
      sprintClip.userData = { locoMult: SPRINT_LOCO_MULT, source: "clone:run-fallback" };
    }
  }

  // Re-ground feet AFTER idle pose evaluation so animated bind doesn't sink soles.
  // Bind-pose fit alone leaves feet underground once hips rotate in walk/run.
  if (clips.has("idle")) {
    try {
      const tmpMixer = new THREE.AnimationMixer(model);
      const act = tmpMixer.clipAction(clips.get("idle")!);
      act.play();
      tmpMixer.update(0);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3();
      let n = 0;
      model.traverse((o) => {
        const sk = o as THREE.SkinnedMesh;
        if (sk.isSkinnedMesh && sk.visible) {
          box.expandByObject(sk);
          n++;
        }
      });
      if (n > 0 && Number.isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
        model.position.y -= box.min.y;
        model.updateMatrixWorld(true);
        console.info(
          `[grudge6Runtime] post-idle re-ground dy=${(-box.min.y).toFixed(4)} race=${raceId}`,
        );
      }
      tmpMixer.stopAllAction();
      tmpMixer.uncacheRoot(model);
    } catch (e) {
      console.warn("[grudge6Runtime] post-idle re-ground failed", e);
    }
  }

  // Role aliases for T0 weapon skills / Studio multiPart names
  if (animPack === "polearm") {
    const alias = (from: string, to: string) => {
      if (!clips.has(to) && clips.has(from)) {
        clips.set(to, clips.get(from)!);
        roles.set(to, to);
      }
    };
    // Madarame: 1_1=attack, 1_2=attack2, 1_3=attack3, 1_4=attack4, 1_5=attack5, skill2_1=skill2
    alias("attack", "combo");
    alias("attack", "thrust");
    alias("attack", "attack1");
    alias("attack2", "slash");
    alias("attack4", "overhead"); // drive-in +MM
    alias("attack5", "skill1"); // lunging skill
    alias("skill2", "skill2");
    alias("skill3", "skill3");
    alias("skill4", "skill4");
    alias("skill4", "power");
    alias("special", "special");
    alias("attack", "sig1");
    alias("attack5", "sig2");
    alias("skill2", "sig3");
    alias("special", "sig4");
  }

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
