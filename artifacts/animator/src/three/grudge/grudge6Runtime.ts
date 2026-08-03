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
  TRAVERSAL_CLIPS,
  MOBILITY_CLIPS,
  NEVER_ALIAS_TO_ATTACK,
  SPRINT_LOCO_MULT,
  asAnimPack,
  loadBakedClip,
  isNonLoopingLocoClip,
  isUnsuitableLocoCycle,
  resolveAnimPackClips,
  CANONICAL_LOCO,
  type AnimPack,
} from "./anims";
// re-export for Studio weapon→pack swaps
export { animPackForWeapon } from "./anims";
import { RACE_ASSETS, type RaceId } from "./raceAssets";
import { getPreset, type PresetId } from "./gearPresets";
import {
  applyBodyTexture,
  applyGearPreset,
  hideEquippableMeshes,
  meshKey,
} from "./loadCharacter";
import { loadBodyTexture } from "./texture";
import { unifySkeletons, rematchClipToSkeleton } from "./skeleton";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight, restoreCharacterMaterials } from "../fitCharacterHeight";
import {
  deployCharacterModel,
  reGroundAfterEquip,
  validateCharacterDeploy,
  diagnoseCharacterLook,
  sampleClipAndReground,
  liftForClipFootClearance,
} from "../characterDeploy";
import { FLEET_ASSET_HOSTS, resolveAssetCandidates } from "../fleetAssetResolver";
import { PLAYER_HEIGHT_M } from "../../lib/productionRuntime";
import {
  grudge6RaceMeshCandidates,
  isForbiddenPrimaryUrl,
  tagMixerRoot,
  type Grudge6RaceKey,
} from "../anim/fleetAnimSsot";

/**
 * Historical arena path fragments only — NOT mesh SSOT.
 * @deprecated Prefer R2 models/grudge6/races via fleetAnimSsot.
 */
export const ARENA_RACE_DIR: Record<RaceId, string> = {
  "western-kingdoms": "human",
  barbarians: "barbarian",
  "high-elves": "elf",
  dwarves: "dwarf",
  orcs: "orc",
  undead: "undead",
};

/** Filenames match R2 models/grudge6/races/*_Characters.glb */
export const ARENA_RACE_GLB: Record<RaceId, string> = {
  "western-kingdoms": "WK_Characters.glb",
  barbarians: "BRB_Characters.glb",
  "high-elves": "ELF_Characters.glb",
  dwarves: "DWF_Characters.glb",
  orcs: "ORC_Characters.glb",
  undead: "UD_Characters.glb",
};

/** @deprecated Arena origin is fallback-only; fleet SSOT is assets.grudge-studio.com */
export const ARENA_ORIGIN = FLEET_ASSET_HOSTS.arena;

/** Same-origin historical path — last-resort only. */
export function arenaCharacterGlbUrl(raceId: RaceId): string {
  const dir = ARENA_RACE_DIR[raceId];
  const file = ARENA_RACE_GLB[raceId];
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

    // Fleet SSOT: R2 grudge6 races → same-origin resolve → FBX atlas.
    // NEVER 30characters.glb. Arena /cdn/assets/characters is LAST RESORT only.
    {
      const rel = `models/grudge6/races/${file}`;
      const primary = [
        ...grudge6RaceMeshCandidates(raceId as Grudge6RaceKey, file),
        ...resolveAssetCandidates(rel),
      ];
      const lastResort = [
        arenaCharacterGlbUrl(raceId),
        arenaCharacterGlbUrlAbsolute(raceId),
      ];
      const urls = [...new Set([...primary, ...lastResort])].filter(
        (u) => !/30characters/i.test(u),
      );
      const loader = sharedGltfLoader();
      for (const url of urls) {
        if (url.includes("assets.grudge-studio.com/cdn/assets/")) continue;
        if (/30characters/i.test(url)) continue;
        try {
          const gltf = await loader.loadAsync(url);
          if (isForbiddenPrimaryUrl(url)) {
            console.warn(
              `[grudge6Runtime] loaded ${raceId} from non-SSOT host (fallback): ${url}`,
            );
          } else {
            console.info(`[grudge6Runtime] race kit GLB ready ${raceId} ${url}`);
          }
          tagMixerRoot(gltf.scene, {
            lane: "bip001-baked",
            surface: "danger",
            raceId,
          });
          return { object: gltf.scene, pipeline: "glb-baked", url };
        } catch (e) {
          lastErr = e;
        }
      }
    }

    // FBX modular kit — only path that should rebind Toon RTS atlas.
    try {
      const { loadCharacterModel } = await import("./loadCharacter");
      const race = RACE_ASSETS[raceId];
      const loaded = await loadCharacterModel(race.modelUrl);
      console.info(`[grudge6Runtime] race kit FBX ready ${raceId} ${race.modelUrl}`);
      tagMixerRoot(loaded.group, {
        lane: "bip001-baked",
        surface: "danger",
        raceId,
      });
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
 * Force uniform root scale (non-uniform scale = "stretched" heroes).
 */
function forceUniformScale(root: THREE.Object3D): void {
  const s = (Math.abs(root.scale.x) + Math.abs(root.scale.y) + Math.abs(root.scale.z)) / 3;
  const u = Number.isFinite(s) && s > 1e-6 ? s : 1;
  root.scale.set(u, u, u);
}

/**
 * Normalize race mesh to ~1.8 m, XZ on pelvis, feet on y=0, art-forward +Z.
 * Uses {@link deployCharacterModel} (Three.js Y-up / XZ ground SSOT).
 *
 * MUST run **after** gear visibility so bodyBox only measures the equipped
 * skinned parts (not every armor variant + every weapon).
 */
function normalizeSkinned(root: THREE.Object3D, pipeline: RaceImportPipeline): void {
  root.userData.importPipeline = pipeline;
  // Always re-fit from identity for clean SI human — modular kits ship Unity 2.54
  // bone/mesh scale; measuring with full wardrobe visible warps height.
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.userData.grudgeHeightFit = false;

  const fit = fitCharacterHeight(root, TARGET_HEIGHT, 1);
  root.userData.grudgeHeightFit = true;
  forceUniformScale(root);
  if (fit.unitFix !== 1 || fit.scale > 3 || fit.scale < 0.05) {
    console.info(
      `[grudge6Runtime] height fit pipeline=${pipeline} native=${fit.nativeHeight.toFixed(3)} unitFix=${fit.unitFix} scale=${fit.scale.toFixed(4)} target=${TARGET_HEIGHT}`,
    );
  }

  const deployed = deployCharacterModel(root, {
    targetHeightM: TARGET_HEIGHT,
    groundY: 0,
    facePlusZ: "auto",
    refitIfAbsurd: true,
  });
  forceUniformScale(root);
  if (Math.abs(deployed.groundDeltaY) > 0.02 || deployed.facingApplied) {
    console.info(
      `[grudge6Runtime] deploy pipeline=${pipeline} h=${deployed.heightM.toFixed(3)} ` +
        `dy=${deployed.groundDeltaY.toFixed(4)} dXZ=(${deployed.centerDeltaX.toFixed(3)},${deployed.centerDeltaZ.toFixed(3)}) ` +
        `face=${deployed.facingApplied} pelvis=${deployed.pelvis?.name ?? "bbox"}`,
    );
  }
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

/**
 * Production materials for Danger Room grudge6 heroes.
 * Fixes yellow/grey wash (ACES + black tint + missing maps) and ensures atlas.
 */
export async function ensureGrudge6Materials(
  model: THREE.Object3D,
  raceId: RaceId,
  pipeline: RaceImportPipeline,
  allowAtlasRebind = true,
): Promise<void> {
  // Always normalize metal / color spaces first
  restoreCharacterMaterials(model, { neutralizeMetal: true });

  let meshCount = 0;
  let mappedMeshes = 0;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshCount++;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let meshHasMap = false;
    for (const m of mats) {
      if (!m) continue;
      if (m instanceof THREE.MeshBasicMaterial) {
        m.toneMapped = false;
        if (m.map) {
          meshHasMap = true;
          m.color.setHex(0xffffff);
        }
        m.needsUpdate = true;
      } else if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
        if (m.map) {
          meshHasMap = true;
          m.color.setHex(0xffffff);
        } else {
          // Unmapped skins read as plastic yellow under ACES — nudge toward neutral grey
          // until atlas rebind lands (or stay if rebind fails).
          const c = m.color.getHex();
          if (c === 0x000000 || c === 0xffffff || c > 0xe8d080) {
            m.color.setHex(0xc8c8c8);
          }
        }
        m.metalness = Math.min(m.metalness, 0.08);
        m.roughness = Math.max(m.roughness, 0.62);
        m.envMapIntensity = 0.35;
        m.needsUpdate = true;
      }
    }
    if (meshHasMap) mappedMeshes++;
  });

  const mapRatio = meshCount > 0 ? mappedMeshes / meshCount : 0;
  // HARD: modular Toon RTS / grudge6 always uses the race atlas (sRGB, flipY=false).
  // Sparse/broken GLB maps still count as "mapped" and used to skip rebind → orange sludge.
  // One path: rebind whenever allowAtlasRebind (default true from loadGrudge6CombatRig).
  if (allowAtlasRebind) {
    const mat = await rebindRaceAtlas(model, raceId);
    if (mat) {
      console.info(
        `[grudge6Runtime] atlas bound race=${raceId} pipeline=${pipeline} mapRatio=${mapRatio.toFixed(2)}`,
      );
    } else {
      // Atlas failed — still neutralize so we don't ship yellow plastic
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial && m.map) {
            m.color.setHex(0xffffff);
            m.metalness = Math.min(m.metalness, 0.08);
            m.roughness = Math.max(m.roughness, 0.55);
            m.needsUpdate = true;
          }
        }
      });
      console.warn(
        `[grudge6Runtime] atlas rebind FAILED race=${raceId} mapRatio=${mapRatio.toFixed(2)} — materials neutralized only`,
      );
    }
  }
}

/**
 * Alias missing combat roles to pack attack so LMB combo + skills 1–4 always animate.
 * (sword_shield / magic / longbow often ship a single attack cycle.)
 */
export function aliasCombatRoles(clips: Map<string, THREE.AnimationClip>, roles: Map<string, string>): void {
  const attack = clips.get("attack");
  if (!attack) return;
  const aliases = [
    "attack2",
    "attack3",
    "attack4",
    "attack5",
    "meleeCombo1",
    "meleeCombo2",
    "meleeCombo3",
    "skill1",
    "skill2",
    "skill3",
    "skill4",
    "combo",
    "special",
    "power",
    "slash",
    "thrust",
    "overhead",
    "sig1",
    "sig2",
    "sig3",
    "sig4",
  ];
  for (const a of aliases) {
    if (clips.has(a)) continue;
    clips.set(a, attack);
    roles.set(a, a);
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
  /**
   * Force anim pack (combat style picker: samurai / knight / spearman / …).
   * When set, overrides class gear-preset animPack.
   */
  animPack?: AnimPack | string;
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
  const requestedPack = asAnimPack(
    opts?.animPack ? String(opts.animPack) : preset.animPack,
  );
  // twohand/crossbow/rifle may not have baked JSON yet (Explosive FREE teasers only)
  const resolved = resolveAnimPackClips(requestedPack);
  const animPack = resolved.pack;
  const pack = resolved.clips;
  if (resolved.fallbackFrom) {
    console.info(
      `[grudge6Runtime] anim pack "${resolved.fallbackFrom}" not fully baked — using "${animPack}"`,
    );
  } else if (opts?.animPack) {
    console.info(`[grudge6Runtime] combat style pack override → ${animPack}`);
  }
  const meshIds =
    opts?.meshIds && opts.meshIds.length >= 2 ? opts.meshIds : preset.visibleMeshes;

  const template = await loadRaceTemplate(raceId);
  const model = cloneSkinned(template.object);
  model.userData.importPipeline = template.pipeline;
  model.userData.importUrl = template.url;

  // Arena modular kits ship multiple disconnected skeletons — unify so clips deform all meshes.
  unifySkeletons(model);

  // ── EQUIP BEFORE FIT (sturdy MMO proportions) ────────────────────────────
  // Modular race GLBs ship every armor/weapon variant visible. Fitting while
  // the full wardrobe is on inflates the skinned AABB → wrong scale / "stretch".
  // SSOT: hide ALL kit meshes → exclusive mesh_ids only → then SI height fit.
  hideEquippableMeshes(model);
  applyGearVisibility(model, meshIds);
  // Count visible skinned — wardrobe bomb = wrong loadout, force class preset once
  let vis = 0;
  model.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.visible) vis++;
  });
  if (vis === 0 || vis > 14) {
    console.error(
      `[grudge6Runtime] equip failed visSkinned=${vis} — forcing class preset ${presetId}`,
    );
    applyGearVisibility(model, preset.visibleMeshes);
  }
  model.userData.equipMeshIds = meshIds.slice();
  model.userData.equipSource = opts?.meshIds?.length ? "account" : "class_preset";
  model.userData.physicsLayer = "character";

  normalizeSkinned(model, template.pipeline);
  model.userData.characterDeployed = true;

  // Materials / colors:
  //  - FBX modular kits: always rebind Toon RTS atlas (flipY=false MeshStandard).
  //  - GLB-baked: fix embedded maps first; if most skins have no albedo, rebind
  //    the race atlas (broken/untextured GLB → yellow/grey wash without this).
  await ensureGrudge6Materials(model, raceId, template.pipeline, opts?.rebindAtlas !== false);

  // Gear hide/show changes skinned AABB — re-ground so feet stay on y=0
  reGroundAfterEquip(model, 0);

  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map<string, THREE.AnimationClip>();
  const roles = new Map<string, string>();

  /** Last-resort gait — never torch run or banned sword_shield run. */
  const SAFE_LOCO_FALLBACK: Record<string, string> = {
    idle: "magic/standing idle",
    walk: CANONICAL_LOCO.walk,
    run: CANONICAL_LOCO.run,
    sprint: CANONICAL_LOCO.run,
    attack: "dual_wield/attack",
  };

  const isLocoRole = (role: string) => role === "walk" || role === "run" || role === "sprint";

  const loadRole = async (role: string, rel: string) => {
    const tryLoad = async (path: string) => {
      let clip = await loadBakedClip(path);
      // Walk/run/sprint: reject roll transitions AND long full-take dumps (Madarame ~5s)
      if (isLocoRole(role) && isUnsuitableLocoCycle(clip, path)) {
        throw new Error(
          `rejected unsuitable loco ${path} for ${role} dur=${clip.duration.toFixed(2)}`,
        );
      }
      if (isNonLoopingLocoClip(clip, path) && isLocoRole(role)) {
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
        if (isLocoRole(role) && isUnsuitableLocoCycle(clip, rel)) {
          throw new Error(`rejected unsuitable arena loco ${rel} for ${role}`);
        }
        if (isNonLoopingLocoClip(clip, rel) && isLocoRole(role)) {
          throw new Error(`rejected non-looping arena ${rel}`);
        }
        clip = rematchClipToSkeleton(model, clip);
        clips.set(role, clip);
        roles.set(role, role);
        return clip;
      } catch (e2) {
        // Last resort: CANONICAL standing walk / run_forward (never roll / tip-walk / torch)
        const fb = SAFE_LOCO_FALLBACK[role];
        if (fb && fb !== rel) {
          try {
            const clip = await tryLoad(fb);
            console.warn(`[grudge6Runtime] ${role} fell back to ${fb} (was ${rel})`, e1, e2);
            clips.set(role, clip);
            roles.set(role, role);
            return clip;
          } catch (e3) {
            // Second soft: samurai run if primary run_forward 404
            if (role === "run" || role === "sprint") {
              try {
                const clip = await tryLoad(CANONICAL_LOCO.runAlt);
                console.warn(
                  `[grudge6Runtime] ${role} fell back to ${CANONICAL_LOCO.runAlt} (was ${rel})`,
                  e3,
                );
                clips.set(role, clip);
                roles.set(role, role);
                return clip;
              } catch (e4) {
                console.warn(`[grudge6Runtime] clip failed ${role} ${rel}`, e1, e2, e3, e4);
                return null;
              }
            }
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

  // Pack extras (weapon skill one-shots only — never swap mesh weapons)
  if (pack.extras?.length) {
    await Promise.all(
      pack.extras.map(async (rel) => {
        const stem = (rel.split("/").pop() || rel).replace(/\.(json|glb)$/i, "");
        // Normalize prod stems → combat roles (skill1, attack2, block, …)
        let role = stem;
        const mAttack = stem.match(/attack[-_]?(\d+)/i);
        if (mAttack) role = mAttack[1] === "1" ? "attack" : `attack${mAttack[1]}`;
        else if (/block[-_]?idle/i.test(stem)) role = "blockIdle";
        else if (/block/i.test(stem) && !/impact|react/i.test(stem)) role = "block";
        else if (/combo/i.test(stem)) role = clips.has("combo") ? stem : "combo";
        else if (/slash/i.test(stem) && !clips.has("slash")) role = "slash";
        else if (/thrust/i.test(stem) && !clips.has("thrust")) role = "thrust";
        else if (/overhead/i.test(stem) && !clips.has("overhead")) role = "overhead";
        else if (/parry/i.test(stem)) role = "parry";
        else if (/skill[-_]?(\d+)/i.test(stem)) {
          const sm = stem.match(/skill[-_]?(\d+)/i);
          if (sm) role = `skill${sm[1]}`;
        } else if (/gs_samurai_combo_a/i.test(stem)) role = clips.has("attack") ? "attack2" : "attack";
        else if (/gs_samurai_combo_b|combo_b/i.test(stem)) role = "skill1";
        else if (/gs_samurai_dash|dash_opener/i.test(stem)) role = "skill2";
        else if (/teleport_strike/i.test(stem)) role = "skill3";
        else if (/gs_samurai_jump_sword/i.test(stem)) role = "skill4";
        else if (/gs_samurai_jump$/i.test(stem) && !clips.has("jump")) role = "jump";
        else if (/charged-pistol|pistol-whip/i.test(stem)) role = clips.has("skill1") ? "skill2" : "skill1";
        else if (/reloading|reload/i.test(stem)) role = "reload";
        else if (/firing|gunplay|fire/i.test(stem) && !clips.has("attack")) role = "attack";
        // Don't overwrite core roles already loaded
        if (clips.has(role) && role !== stem) {
          // still store under stem for Studio name lists
          if (!clips.has(stem)) {
            await loadRole(stem, rel);
          }
          return;
        }
        if (clips.has(role)) return;
        await loadRole(role, rel);
      }),
    );
  }

  // Universal traversal — dodge L/R/F, jump, climb-adjacent clips for ALL heroes
  // so AA/DD dash, X roll, wall jump, and jump work on every race/weapon option.
  await Promise.all(
    TRAVERSAL_CLIPS.map(async ({ role, rel }) => {
      if (clips.has(role)) return;
      await loadRole(role, rel);
    }),
  );
  // Alias roll → dodge cycle so Studio fallthrough lists resolve
  if (!clips.has("roll") && clips.has("dodge")) {
    clips.set("roll", clips.get("dodge")!);
    roles.set("roll", "roll");
  }
  if (!clips.has("jumpAway") && clips.has("jump")) {
    clips.set("jumpAway", clips.get("jump")!);
    roles.set("jumpAway", "jumpAway");
  }
  if (!clips.has("mantle") && (clips.has("climb") || clips.has("jump"))) {
    clips.set("mantle", (clips.get("climb") || clips.get("jump"))!);
    roles.set("mantle", "mantle");
  }
  // Climb / swim aliases for controller state names
  if (!clips.has("climbing") && clips.has("climb")) {
    clips.set("climbing", clips.get("climb")!);
    roles.set("climbing", "climbing");
  }
  if (!clips.has("swimming") && clips.has("swim")) {
    clips.set("swimming", clips.get("swim")!);
    roles.set("swimming", "swimming");
  }
  if (!clips.has("crouch") && clips.has("crawl")) {
    clips.set("crouch", clips.get("crawl")!);
    roles.set("crouch", "crouch");
  }

  // Sprint from true run cycle only (time-scale applied by AnimationDirector /
  // GrudgeAvatar when sprint flag / high speed band is set).
  // NEVER load locomotion/running — that is run-to-roll.
  const ensureSprintFromRun = () => {
    if (!clips.has("run")) return;
    const runClip = clips.get("run")!;
    if (isUnsuitableLocoCycle(runClip, runClip.name || "run")) {
      console.error(
        "[grudge6Runtime] RUN CLIP UNSUITABLE (roll/full-take) — stripping; CANONICAL run_forward fallback",
      );
      clips.delete("run");
      roles.delete("run");
      return;
    }
    const sprintClip = runClip.clone();
    sprintClip.name = "sprint";
    clips.set("sprint", sprintClip);
    roles.set("sprint", "sprint");
    sprintClip.userData = {
      ...(sprintClip.userData || {}),
      locoMult: SPRINT_LOCO_MULT,
      source: "clone:run",
    };
  };
  ensureSprintFromRun();
  if (!clips.has("run")) {
    await loadRole("run", SAFE_LOCO_FALLBACK.run);
    ensureSprintFromRun();
    if (clips.has("sprint")) {
      clips.get("sprint")!.userData = {
        ...(clips.get("sprint")!.userData || {}),
        locoMult: SPRINT_LOCO_MULT,
        source: "clone:run-fallback",
      };
    }
  }

  // LMB combo + weapon skills 1–4 need named roles even when pack ships one attack
  aliasCombatRoles(clips, roles);

  // Re-ground feet AFTER idle pose so animated bind doesn't sink soles.
  // Position/scale tracks stripped in rematchClipToSkeleton; sample still needed
  // so rotation-only idle sits soles on y=0 (uniform mixer path).
  //
  // HARD RULE: permanent model Y = idle plant + walk/run foot clearance only.
  // Never re-ground on attack — raised slash feet permanently lower the kit so
  // idle/walk soles tunnel through the floor (classic Danger "walk into ground").
  // Slight idle float after walk lift is OK — FootGrounder plants soles.
  if (clips.has("idle")) {
    try {
      const dy = sampleClipAndReground(model, clips.get("idle")!);
      if (Math.abs(dy) > 1e-4) {
        console.info(
          `[grudge6Runtime] post-idle re-ground dy=${dy.toFixed(4)} race=${raceId} pack=${animPack}`,
        );
      }
      for (const role of ["walk", "run"] as const) {
        const c = clips.get(role);
        if (!c) continue;
        const lift = liftForClipFootClearance(model, c, { groundY: 0, samples: 8 });
        if (lift > 1e-3) {
          console.info(
            `[grudge6Runtime] post-${role} foot lift dy=${lift.toFixed(4)} race=${raceId}`,
          );
        }
      }
    } catch (e) {
      console.warn("[grudge6Runtime] post-idle re-ground failed", e);
    }
  }

  // HARD GATE — never ship wrong mesh / scale / T-pose. Fail the load entirely.
  const check = validateCharacterDeploy(model);
  const look = diagnoseCharacterLook(model);
  model.userData.diagnoseCharacterLook = look;
  const hardErrors: string[] = [];
  if (!clips.has("idle")) hardErrors.push("missing idle clip");
  if (!clips.has("walk") && !clips.has("run")) hardErrors.push("missing walk/run loco");
  if (!clips.has("attack")) hardErrors.push("missing attack clip");
  if (!(check.heightM >= 1.45 && check.heightM <= 2.25)) {
    hardErrors.push(`height ${check.heightM.toFixed(3)}m outside SI human band`);
  }
  if (look.errors?.length) hardErrors.push(...look.errors);
  if (check.issues?.length && !check.ok) hardErrors.push(...check.issues);
  if (hardErrors.length) {
    console.error(
      `[grudge6Runtime] HARD FAIL race=${raceId} preset=${presetId} pack=${animPack}`,
      hardErrors,
    );
    mixer.stopAllAction();
    throw new Error(
      `[grudge6Runtime] refuse broken kit ${raceId}/${presetId}: ${hardErrors.join("; ")}`,
    );
  }
  model.userData.deployValidated = true;
  model.userData.grudge6Ssot = "loadGrudge6CombatRig";
  if (look.warnings?.length) {
    console.info(`[grudge6Runtime] deploy ok with warnings race=${raceId}`, look.warnings);
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

  // 2H hammer / mace — SC_SC jab / charge / sweep / summon role aliases
  if (animPack === "hammer") {
    const alias = (from: string, to: string) => {
      if (!clips.has(to) && clips.has(from)) {
        clips.set(to, clips.get(from)!);
        roles.set(to, to);
      }
    };
    alias("attack", "attack1");
    alias("attack", "jab");
    alias("attack2", "charge");
    alias("attack2", "skill1");
    alias("attack3", "sweep");
    alias("attack3", "skill");
    alias("attack3", "skill2");
    alias("skill2", "skill3");
    alias("skill-summon", "skill4");
    alias("skill-summon", "special");
    alias("backstep", "dodgeB");
    alias("hit", "hurt");
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
  // NEVER alias mobility / defense / hurt onto attack (sprint-was-roll class bugs).
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
    ];
    for (const name of skillAliases) {
      if (!clips.has(name) && !NEVER_ALIAS_TO_ATTACK.has(name)) {
        clips.set(name, atk);
        roles.set(name, name);
      }
    }
  }

  // Soft-load mobility (crawl/climb/swim) — fail quietly until bake pipeline ships JSON.
  await Promise.all(
    MOBILITY_CLIPS.map(async ({ role, bakeRel }) => {
      if (clips.has(role)) return;
      try {
        await loadRole(role, bakeRel);
      } catch {
        /* placeholder until bake */
      }
    }),
  );

  // Mantle prefers climb-to-top when present; else keep jump alias from above.
  if (clips.has("climb") && !clips.has("mantle")) {
    // mantle may already be set from MOBILITY_CLIPS loadRole
  }

  if (!clips.has("idle")) {
    throw new Error(`[grudge6Runtime] no locomotion clips for ${raceId}/${animPack}`);
  }

  return { root, model, mixer, clips, roles, animPack };
}
