/**
 * Asset purpose classifier — maps file path/name → production role.
 *
 * Roles drive convert flags, scale checks, Draco timing, and AI/game contracts.
 * Keep pure (no I/O) so classify CLI + manifest + convert all share one SSOT.
 */

/** @typedef {'character'|'npc'|'weapon'|'map'|'prop'|'texture'|'animation'|'vfx'|'icon'|'audio'|'data'|'unknown'} AssetPurpose */

/**
 * Purpose → production defaults for grudge-convert.
 * Draco is always applied LAST (after scale bake + skeleton/anim integrity).
 */
export const PURPOSE_PIPELINE = {
  character: {
    label: "Player / race character",
    height: 1.7,
    cmToM: true,
    yHip: true,
    colliders: true,
    flatten: false, // never flatten skinned modular kits
    textureSize: 1024,
    textureFormat: "webp",
    draco: true,
    meshopt: true,
    anims: true,
    /** AI / combat contract */
    ai: {
      needsSkeleton: true,
      requiredClipRoles: ["idle", "walk", "run", "attack", "hurt", "death"],
      preferredAnimPacks: ["sword_shield", "longbow", "magic", "rifle", "2h_melee"],
      handBones: ["Bip001_R_Hand", "Bip001_L_Hand", "R_hand_container", "L_hand_container"],
      brainRole: "player_or_hostile",
    },
  },
  npc: {
    label: "NPC / enemy unit",
    height: 1.7,
    cmToM: true,
    yHip: true,
    colliders: true,
    flatten: false,
    textureSize: 1024,
    textureFormat: "webp",
    draco: true,
    meshopt: true,
    anims: true,
    ai: {
      needsSkeleton: true,
      requiredClipRoles: ["idle", "walk", "attack", "hurt", "death"],
      preferredAnimPacks: ["sword_shield", "longbow", "magic", "rifle"],
      handBones: ["Bip001_R_Hand", "R_hand_container"],
      brainRole: "hostile_or_civilian",
    },
  },
  weapon: {
    label: "Weapon / equip mesh",
    height: null, // never height-normalize weapons to 1.7
    cmToM: false,
    yHip: false,
    colliders: false,
    flatten: true,
    textureSize: 512,
    textureFormat: "webp",
    draco: true,
    meshopt: true,
    anims: false,
    ai: {
      needsSkeleton: false,
      requiredClipRoles: [],
      weaponMount: "hand",
      brainRole: "equip_visual",
    },
  },
  map: {
    label: "Map / arena / environment",
    height: null,
    cmToM: false,
    yHip: true, // ground at y=0
    colliders: true,
    flatten: true,
    textureSize: 1024,
    textureFormat: "webp",
    draco: true,
    meshopt: true,
    anims: false,
    ai: {
      needsSkeleton: false,
      navmesh: true,
      brainRole: "level_geometry",
    },
  },
  prop: {
    label: "Prop / deployable / furniture",
    height: null,
    cmToM: false,
    yHip: true,
    colliders: true,
    flatten: true,
    textureSize: 512,
    textureFormat: "webp",
    draco: true,
    meshopt: true,
    anims: false,
    ai: {
      needsSkeleton: false,
      brainRole: "cover_or_interactable",
    },
  },
  texture: {
    label: "Texture / atlas",
    height: null,
    convert: false,
    ai: { brainRole: "material" },
  },
  animation: {
    label: "Animation bank / FBX clip pack",
    height: null,
    cmToM: true,
    yHip: false,
    colliders: false,
    flatten: false,
    draco: false, // clip banks: preserve tracks; compress after retarget
    meshopt: false,
    anims: true,
    ai: {
      needsSkeleton: true,
      preserveClipNames: true,
      brainRole: "anim_bank",
    },
  },
  vfx: {
    label: "VFX mesh / projectile shell",
    height: null,
    colliders: false,
    flatten: true,
    textureSize: 512,
    draco: true,
    anims: true,
    ai: { brainRole: "fx" },
  },
  icon: {
    label: "UI icon",
    convert: false,
    ai: { brainRole: "ui" },
  },
  audio: {
    label: "Audio",
    convert: false,
    ai: { brainRole: "sfx" },
  },
  data: {
    label: "JSON / manifest / gamedata",
    convert: false,
    ai: { brainRole: "data" },
  },
  unknown: {
    label: "Unclassified",
    height: null,
    convert: false,
    ai: { brainRole: "review" },
  },
};

/** Path / name heuristics → purpose (order matters: first match wins). */
const RULES = [
  // textures first (extension + path)
  { purpose: "texture", re: /\.(webp|png|jpg|jpeg|ktx2|basis)$/i },
  { purpose: "texture", re: /\/textures?\//i },
  { purpose: "icon", re: /\/icons?\//i },
  { purpose: "audio", re: /\.(ogg|mp3|wav|m4a)$/i },
  { purpose: "data", re: /\.(json|csv|toml|yaml|yml)$/i },

  // animation packs
  { purpose: "animation", re: /\/anims?\//i },
  { purpose: "animation", re: /\/animation/i },
  { purpose: "animation", re: /\/locomotion\//i },
  { purpose: "animation", re: /_anim(s|ation)?\./i },
  { purpose: "animation", re: /mixamo|rokoko|paragon/i },

  // characters / races
  { purpose: "character", re: /\/characters?\//i },
  { purpose: "character", re: /\/heroes?\//i },
  { purpose: "character", re: /\/races?\//i },
  { purpose: "character", re: /\/grudge6\//i },
  {
    purpose: "character",
    re: new RegExp("\\b(WK_|BRB_|ELF_|DWF_|ORC_|UD_)[A-Za-z]+_Characters", "i"),
  },
  { purpose: "character", re: /\/voxels?\/tvs\//i },
  { purpose: "character", re: /voxel-knights|champion|hero/i },

  // NPCs / enemies
  { purpose: "npc", re: /\/npc(s)?\//i },
  { purpose: "npc", re: /\/enem(y|ies)\//i },
  { purpose: "npc", re: /\/monsters?\//i },
  { purpose: "npc", re: /\/hostiles?\//i },
  { purpose: "npc", re: /skeleton|zombie|goblin|bandit|dummy/i },

  // weapons
  { purpose: "weapon", re: /\/weapons?\//i },
  { purpose: "weapon", re: /\/equip(ment)?\//i },
  { purpose: "weapon", re: /\b(sword|axe|bow|rifle|pistol|shotgun|staff|dagger|spear|hammer|mace|scythe|crossbow|gunblade|revolver|shield)\b/i },

  // maps / arenas
  { purpose: "map", re: /\/maps?\//i },
  { purpose: "map", re: /\/arenas?\//i },
  { purpose: "map", re: /\/levels?\//i },
  { purpose: "map", re: /\/dungeons?\//i },
  { purpose: "map", re: /\/environments?\//i },
  { purpose: "map", re: /arena|dungeon|war-zone|plaza|island|terrain|navmesh/i },

  // vfx
  { purpose: "vfx", re: /\/vfx\//i },
  { purpose: "vfx", re: /\/fx\//i },
  { purpose: "vfx", re: /\/effects?\//i },
  { purpose: "vfx", re: /slash|explosion|projectile|muzzle|beam|glyph/i },

  // props
  { purpose: "prop", re: /\/props?\//i },
  { purpose: "prop", re: /\/decor/i },
  { purpose: "prop", re: /barrel|crate|chest|torch|rock|tree|nature|furniture/i },
];

/**
 * @param {string} relPath path relative to public/ or absolute-ish posix path
 * @returns {{ purpose: AssetPurpose, confidence: number, pipeline: object, reasons: string[] }}
 */
export function classifyAsset(relPath) {
  const p = String(relPath || "").replace(/\\/g, "/");
  const reasons = [];
  for (const rule of RULES) {
    if (rule.re.test(p)) {
      reasons.push(`matched ${rule.re}`);
      const purpose = /** @type {AssetPurpose} */ (rule.purpose);
      return {
        purpose,
        confidence: purpose === "unknown" ? 0.2 : 0.85,
        pipeline: PURPOSE_PIPELINE[purpose],
        reasons,
        path: p,
      };
    }
  }
  // extension fallback for 3D files
  if (/\.(glb|gltf|fbx|obj|blend)$/i.test(p)) {
    reasons.push("3d extension without path cues → unknown (review)");
    return {
      purpose: "unknown",
      confidence: 0.35,
      pipeline: PURPOSE_PIPELINE.unknown,
      reasons,
      path: p,
    };
  }
  reasons.push("no rule matched");
  return {
    purpose: "unknown",
    confidence: 0.1,
    pipeline: PURPOSE_PIPELINE.unknown,
    reasons,
    path: p,
  };
}

/**
 * Build grudge-convert argv flags for a classified asset.
 * Order: scale/units → mesh/anim bake → texture → quantize/meshopt → **draco last**.
 *
 * @param {AssetPurpose} purpose
 * @param {{ out?: string, texture?: string, forceCm?: boolean, draco?: boolean }} [opts]
 */
export function convertFlagsForPurpose(purpose, opts = {}) {
  const pipe = PURPOSE_PIPELINE[purpose] || PURPOSE_PIPELINE.unknown;
  if (pipe.convert === false) {
    return { skip: true, reason: `${purpose} is not a 3D convert target`, flags: [] };
  }
  /** @type {string[]} */
  const flags = [];
  if (pipe.cmToM || opts.forceCm) flags.push("--cm-to-m");
  if (typeof pipe.height === "number") flags.push("--height", String(pipe.height));
  if (pipe.yHip === false) flags.push("--no-y-hip");
  if (pipe.flatten === false) flags.push("--no-mesh-bake");
  if (pipe.colliders === false) flags.push("--no-colliders");
  if (pipe.anims === false) flags.push("--no-anims");
  if (pipe.textureSize) flags.push("--texture-size", String(pipe.textureSize));
  if (pipe.textureFormat) flags.push("--texture-format", pipe.textureFormat);
  if (opts.texture) flags.push("--texture", opts.texture);
  if (pipe.meshopt === false) flags.push("--no-meshopt");
  // Draco LAST — only after scale + skeleton/anim integrity
  const wantDraco = opts.draco !== false && pipe.draco !== false;
  if (wantDraco) flags.push("--draco");
  return { skip: false, flags, pipeline: pipe };
}

/**
 * Named grudge-convert pipeline from extension.
 * @param {string} filePath
 */
export function namedPipelineForFile(filePath) {
  const ext = (filePath.split(".").pop() || "").toLowerCase();
  if (ext === "fbx") return "fbx2gltf";
  if (ext === "obj") return "obj2glb";
  if (ext === "blend") return "blend2glb";
  if (ext === "gltf") return "gltf2glb";
  if (ext === "glb") return "glb2glb";
  return "glb2glb";
}
