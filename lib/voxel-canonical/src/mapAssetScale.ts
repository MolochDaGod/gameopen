/**
 * Map vs prop asset evaluation + scale so map voxels match generated blocks.
 *
 * Fleet contract (Mine-Loader modelLibrary + kit pieces):
 *   **1 voxel block = 1 world unit (metre).**
 *
 * Seed/catalog GLBs often arrive as:
 *   · **props** — barrels, benches, modular walls (fit by targetHeight)
 *   · **map chunks** — castles, islands, full scenes (must NOT be crushed to 2–3 m tall)
 *
 * Applying prop-style `targetHeight / size.y` to a 350-unit castle yields scale ≈ 0.01
 * and the "little asset" bug. Maps use {@link scaleMapToBlockGrid} instead.
 */

/** World metres per generated block (Mine-Loader / Open voxel SSOT). */
export const VOXEL_BLOCK_METERS = 1;

/** Axis-aligned size of a mesh AABB in native file units. */
export type NativeBounds = { x: number; y: number; z: number };

export type AssetRole =
  | "prop"
  | "map_chunk"
  | "structure"
  | "kit_module"
  /** Converted voxel / blocky playable character (SI ~1.8 m) */
  | "character"
  /** Boss / elite — taller than hero, never prop-crushed */
  | "boss"
  /** Animals, creeps, AI brain units */
  | "creature"
  | "unknown";

export type AssetEvalInput = {
  /** File basename or catalog id, e.g. castle_eltz.glb */
  name: string;
  /** Optional byte size of the GLB. */
  fileBytes?: number;
  /** Optional native AABB size (file units before scale). */
  bounds?: NativeBounds;
  /** Optional free tags from catalog. */
  tags?: string[];
  /** If true, force map_chunk. */
  forceMap?: boolean;
  /** If true, force prop (never map scale). */
  forceProp?: boolean;
};

export type AssetEvalResult = {
  role: AssetRole;
  /** Human reason for the classification (logs / UI). */
  reason: string;
  /** Suggested uniform scale so placement matches block grid. */
  scale: number;
  /** Estimated footprint in blocks after scale (XZ). */
  footprintBlocks: { w: number; d: number; h: number };
  /** True when prop height-fit must not be applied. */
  forbidPropHeightFit: boolean;
};

/** Names that almost always mean full map / chunk / scene, not a hand prop. */
const MAP_NAME_RE =
  /castle|fortress|citadel|keep|palace|town|city|village|island|overworld|realm|world|map|chunk|level|dungeon|temple|cathedral|smeltery|skycastle|eltz|retreat|biome|landscape|terrain|stronghold|siege|grotto|cavern|canyon|koth|arena|bay|harbor|harbour|mountain|geonosis|dalaran|faction.?spawn|lobby.?spawn|awesome.?realm|dragon.?head|glowstone|pirat/i;

/** Names that are small props even if large files (textures/atlases). */
const PROP_NAME_RE =
  /torch|barrel|crate|chest|bench|table|chair|fence|gate|hay|pumpkin|sword|axe|hammer|tool|icon|atlas|kit_wall|kit_floor/i;

/** Voxel / converted character kits (fit to ~1.8 m human). */
const CHARACTER_NAME_RE =
  /character|hero|player|avatar|warlord|voxel.?char|steve|alex|npc_human|crew|sailor|pirate_human/i;

/** Bosses — taller SI fit, never map-scale or prop-crush. */
const BOSS_NAME_RE =
  /boss|dragon|golem|titan|behemoth|lich|warlord.?boss|elite|raid|hellmaw|karate.?warlord|ogre.?king/i;

/** Creatures / AI brain units / jungle creeps. */
const CREATURE_NAME_RE =
  /zombie|skeleton|creep|animal|wolf|bear|chicken|cow|pig|horse|spider|slime|goblin|orc.?foe|jungle|unit|mob|enemy|ai.?brain|minion/i;

/** SI height targets for converted GLB roles (metres). */
export const VOXEL_ROLE_HEIGHT_M: Record<"character" | "boss" | "creature", number> = {
  character: 1.8,
  boss: 2.6,
  creature: 1.5,
};

/**
 * Classify a GLB for seed / editor placement.
 * Prefer explicit tags/force flags; fall back to name + size + bytes.
 */
export function evaluateAssetRole(input: AssetEvalInput): AssetEvalResult {
  const name = input.name || "unknown";
  const tags = (input.tags || []).map((t) => t.toLowerCase());
  const bounds = input.bounds ?? { x: 0, y: 0, z: 0 };
  const maxDim = Math.max(bounds.x, bounds.y, bounds.z, 0);
  const horiz = Math.max(bounds.x, bounds.z, 0);
  const bytes = input.fileBytes ?? 0;

  if (input.forceProp || tags.includes("prop") || tags.includes("furniture")) {
    const scale = 1;
    return finish("prop", "forced prop / furniture tag", scale, bounds);
  }
  if (input.forceMap || tags.includes("map") || tags.includes("map_chunk") || tags.includes("world")) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish("map_chunk", "forced map / map_chunk tag", scale, bounds);
  }
  if (tags.includes("kit") || tags.includes("kit_module") || /kit[_-]/i.test(name)) {
    // Kit pieces are authored at 1 unit = 1 block already
    return finish("kit_module", "building-kit module", 1, bounds);
  }

  // Converted characters / bosses / creatures — height-fit, never map block grid
  if (
    tags.includes("character") ||
    tags.includes("hero") ||
    tags.includes("boss") ||
    tags.includes("creature") ||
    tags.includes("enemy") ||
    BOSS_NAME_RE.test(name) ||
    CHARACTER_NAME_RE.test(name) ||
    CREATURE_NAME_RE.test(name)
  ) {
    const role: AssetRole = tags.includes("boss") || BOSS_NAME_RE.test(name)
      ? "boss"
      : tags.includes("character") || tags.includes("hero") || CHARACTER_NAME_RE.test(name)
        ? "character"
        : "creature";
    const targetH = VOXEL_ROLE_HEIGHT_M[role];
    const scale =
      maxDim > 0.001
        ? scalePropToHeight(bounds, targetH)
        : 1;
    return finish(role, `${role} SI height-fit → ${targetH} m`, scale, bounds);
  }

  if (PROP_NAME_RE.test(name) && maxDim < 25 && bytes < 8_000_000) {
    return finish("prop", "prop-like name + modest size", 1, bounds);
  }

  // Large files + map-ish names → map
  if (MAP_NAME_RE.test(name) && (bytes >= 8_000_000 || maxDim >= 40 || horiz >= 30)) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish(
      "map_chunk",
      `map name + large extent (max=${maxDim.toFixed(1)}, bytes=${bytes})`,
      scale,
      bounds,
    );
  }

  // Huge horizontal extent even without name → map
  if (horiz >= 80 || maxDim >= 120 || bytes >= 40_000_000) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish(
      "map_chunk",
      `extent/size implies full map (horiz=${horiz.toFixed(1)}, max=${maxDim.toFixed(1)})`,
      scale,
      bounds,
    );
  }

  // Medium buildings: structure, still not prop-height-crushed if wide
  if (MAP_NAME_RE.test(name) || (horiz >= 15 && maxDim >= 20)) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish("structure", "structure-scale building", scale, bounds);
  }

  return finish("prop", "default prop", 1, bounds);
}

/**
 * Uniform scale so map voxels/units align with generated blocks.
 *
 * Rules:
 * 1. Native max dim in (20..2000) → treat as metres already → scale 1
 * 2. Native max dim > 2000 → likely centimetres → scale 0.01
 * 3. Known voxel-export pitch (e.g. Rascals 0.008) → scale = 1/pitch
 * 4. Tiny max dim (< 2) with huge mesh count is rare; leave scale 1
 *
 * Never uses prop `targetHeight` — that collapses continents to tables.
 */
export function scaleMapToBlockGrid(
  bounds: NativeBounds,
  opts?: {
    /** If known (Mineways / voxel export), override auto unit detect. */
    sourceBlockPitch?: number;
    targetBlockMeters?: number;
  },
): number {
  const target = opts?.targetBlockMeters ?? VOXEL_BLOCK_METERS;
  if (opts?.sourceBlockPitch && opts.sourceBlockPitch > 0) {
    return target / opts.sourceBlockPitch;
  }
  const maxDim = Math.max(bounds.x, bounds.y, bounds.z, 1e-6);
  // Centimetre-authored CAD / some Unity exports
  if (maxDim > 2000) return target * 0.01;
  // Already in metres / Minecraft-ish units (1 unit ≈ 1 block)
  if (maxDim >= 8) return target; // scale 1 when target is 1
  // Sub-meter diorama mistaken for map — still don't explode
  if (maxDim < 2) return target;
  return target;
}

/**
 * Prop height fit (existing editor behaviour) — only for role === prop.
 * Maps must call {@link scaleMapToBlockGrid} instead.
 */
export function scalePropToHeight(
  bounds: NativeBounds,
  targetHeight: number,
  footprint?: { w: number; d: number },
): number {
  const sy = Math.max(bounds.y, 1e-6);
  let scale = (targetHeight > 0 ? targetHeight : 2) / sy;
  if (footprint && footprint.w > 0 && footprint.d > 0) {
    const sx = Math.max(bounds.x, 1e-6);
    const sz = Math.max(bounds.z, 1e-6);
    scale = Math.min(scale, (footprint.w / sx) * 1.02, (footprint.d / sz) * 1.02);
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  return Math.min(32, Math.max(0.01, scale));
}

/**
 * Single entry: evaluate role then return correct scale for placement.
 */
export function placementScaleForAsset(
  input: AssetEvalInput,
  propTargetHeight?: number,
): AssetEvalResult {
  const evaled = evaluateAssetRole(input);
  if (evaled.role === "prop" && propTargetHeight != null && input.bounds) {
    const scale = scalePropToHeight(input.bounds, propTargetHeight);
    return {
      ...evaled,
      scale,
      footprintBlocks: footprintAfterScale(input.bounds, scale),
      forbidPropHeightFit: false,
    };
  }
  return evaled;
}

function footprintAfterScale(bounds: NativeBounds, scale: number) {
  return {
    w: Math.max(1, Math.round((bounds.x * scale) / VOXEL_BLOCK_METERS)),
    d: Math.max(1, Math.round((bounds.z * scale) / VOXEL_BLOCK_METERS)),
    h: Math.max(1, Math.round((bounds.y * scale) / VOXEL_BLOCK_METERS)),
  };
}

function finish(
  role: AssetRole,
  reason: string,
  scale: number,
  bounds: NativeBounds,
): AssetEvalResult {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    role,
    reason,
    scale: s,
    footprintBlocks: footprintAfterScale(bounds, s),
    forbidPropHeightFit:
      role === "map_chunk" || role === "structure" || role === "character" || role === "boss" || role === "creature",
  };
}

/**
 * Clip name → AI brain / locomotion pattern for converted voxel characters & bosses.
 * Used by Open combat AI, jungle camps, and brawler waves.
 */
export type VoxelAnimPattern =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "attack2"
  | "hit"
  | "death"
  | "spawn"
  | "roar"
  | "cast"
  | "unknown";

const ANIM_PATTERN_RULES: Array<{ pattern: VoxelAnimPattern; re: RegExp }> = [
  { pattern: "death", re: /death|die|dead|ko|fall/i },
  { pattern: "hit", re: /hit|hurt|react|flinch|damage/i },
  { pattern: "spawn", re: /spawn|appear|rise|emerge/i },
  { pattern: "roar", re: /roar|scream|howl|taunt/i },
  { pattern: "cast", re: /cast|spell|magic|channel/i },
  { pattern: "attack2", re: /attack.?2|combo|heavy|skill|special/i },
  { pattern: "attack", re: /attack|slash|bite|swing|melee|strike/i },
  { pattern: "run", re: /run|sprint|chase/i },
  { pattern: "walk", re: /walk|move|locomotion|patrol/i },
  { pattern: "idle", re: /idle|stand|breath|rest|tpose|t-pose/i },
];

export function matchVoxelAnimPattern(clipName: string): VoxelAnimPattern {
  for (const rule of ANIM_PATTERN_RULES) {
    if (rule.re.test(clipName)) return rule.pattern;
  }
  return "unknown";
}

/**
 * Build an AI brain anim table from clip names (converted GLB animations).
 * Prefers first match per pattern; useful for DeckCrew / creep AI / bosses.
 */
export function buildVoxelAnimBrain(
  clipNames: string[],
): Partial<Record<VoxelAnimPattern, string>> {
  const out: Partial<Record<VoxelAnimPattern, string>> = {};
  for (const name of clipNames) {
    const p = matchVoxelAnimPattern(name);
    if (p === "unknown") continue;
    if (!out[p]) out[p] = name;
  }
  return out;
}

/**
 * Scale a converted voxel GLB into the world using role + optional measured bounds.
 * Prefer this over ad-hoc Box3 height fits in scenes.
 */
export function scaleConvertedVoxelAsset(input: {
  name: string;
  bounds: NativeBounds;
  tags?: string[];
  forceRole?: AssetRole;
  /** Override SI height for character/boss/creature */
  targetHeightM?: number;
}): AssetEvalResult {
  if (input.forceRole === "map_chunk" || input.forceRole === "structure") {
    return placementScaleForAsset({
      name: input.name,
      bounds: input.bounds,
      tags: input.tags,
      forceMap: true,
    });
  }
  if (
    input.forceRole === "character" ||
    input.forceRole === "boss" ||
    input.forceRole === "creature"
  ) {
    const h =
      input.targetHeightM ??
      VOXEL_ROLE_HEIGHT_M[input.forceRole];
    const scale = scalePropToHeight(input.bounds, h);
    return finish(input.forceRole, `forced ${input.forceRole} @ ${h}m`, scale, input.bounds);
  }
  return placementScaleForAsset(
    {
      name: input.name,
      bounds: input.bounds,
      tags: input.tags,
    },
    input.targetHeightM,
  );
}

/** Catalog row for a seed-placeable map chunk (castle, island, fort). */
export type MapChunkDef = {
  id: string;
  label: string;
  /** Public / CDN path relative to models root */
  file: string;
  /** Role always map_chunk for this registry */
  role: "map_chunk";
  /** Optional known source pitch (Mineways etc.) */
  sourceBlockPitch?: number;
  /** Tags for filters */
  tags?: string[];
  /** Approx native bounds if measured offline */
  nativeBounds?: NativeBounds;
  /** File size hint for classification */
  fileBytes?: number;
  blurb?: string;
};

/**
 * Seed / warlords map chunks — never place via prop targetHeight.
 * castle_eltz: measured ~408×350×136 native units → scale 1 (metres already).
 */
export const MAP_CHUNKS: Record<string, MapChunkDef> = {
  castle_eltz: {
    id: "castle_eltz",
    label: "Castle Eltz",
    file: "models/warlords-era/worlds/castle_eltz.glb",
    role: "map_chunk",
    nativeBounds: { x: 408.228, y: 350, z: 136 },
    fileBytes: 163_443_404,
    tags: ["map", "castle", "chunk", "warlords", "voxel-last30"],
    blurb: "Full castle map chunk — scale so 1 unit = 1 voxel block (not prop height).",
  },
  castle: {
    id: "castle",
    label: "Castle",
    file: "models/warlords-era/buildings/castle.glb",
    role: "map_chunk",
    tags: ["map", "castle", "building"],
    blurb: "Castle scene — evaluate as map_chunk before prop fit.",
  },
  skycastle: {
    id: "skycastle",
    label: "Sky Castle",
    file: "models/warlords-era/buildings/skycastle.glb",
    role: "map_chunk",
    tags: ["map", "castle", "sky"],
  },
  entrance_to_fort: {
    id: "entrance_to_fort",
    label: "Fort Entrance",
    file: "models/warlords-era/buildings/entrance_to_fort.glb",
    role: "map_chunk",
    tags: ["map", "fort", "structure"],
  },
  rascals_retreat: {
    id: "rascals_retreat",
    label: "Rascals Retreat Collection",
    file: "models/worlds/rascals_retreat_collection.glb",
    role: "map_chunk",
    /** Documented Mineways-style pitch in SEED_WORLD_DEPLOY.md */
    sourceBlockPitch: 0.008,
    tags: ["map", "island", "rascals", "seed"],
    blurb: "Voxelize pitch 0.008 → scale = 125 so cells match 1 m blocks.",
  },
  // --- voxel last-30 map chunks (D1 sourceSet voxel-last30-downloads) ---
  grotto_cavern_cave: {
    id: "grotto_cavern_cave",
    label: "Grotto Cavern",
    file: "models/voxel/maps/grotto_cavern_cave.glb",
    role: "map_chunk",
    fileBytes: 61_148_000,
    tags: ["map", "cave", "voxel-last30", "codex:stone"],
    blurb: "Cavern map chunk — stone/ore codex palette.",
  },
  dragon_head_cave: {
    id: "dragon_head_cave",
    label: "Dragon Head Cave",
    file: "models/voxel/maps/dragon_head_cave.glb",
    role: "map_chunk",
    fileBytes: 59_990_000,
    tags: ["map", "cave", "boss", "voxel-last30"],
    blurb: "Dragon-head cavern arena.",
  },
  geonosis_arena: {
    id: "geonosis_arena",
    label: "Geonosis Arena",
    file: "models/voxel/maps/geonosis_arena.glb",
    role: "map_chunk",
    fileBytes: 22_870_000,
    tags: ["map", "arena", "pvp", "voxel-last30"],
  },
  floating_islands_dwarves_haven: {
    id: "floating_islands_dwarves_haven",
    label: "Dwarves Haven Floating Islands",
    file: "models/voxel/maps/floating_islands_dwarves_haven.glb",
    role: "map_chunk",
    fileBytes: 40_160_000,
    tags: ["map", "sky", "island", "voxel-last30"],
  },
  glowstone_mountain: {
    id: "glowstone_mountain",
    label: "Glowstone Mountain",
    file: "models/voxel/maps/glowstone_mountain.glb",
    role: "map_chunk",
    fileBytes: 21_400_000,
    tags: ["map", "glowstone", "voxel-last30", "codex:glowstone"],
  },
  glowstone_mountain_oriental: {
    id: "glowstone_mountain_oriental",
    label: "Glowstone Mountain (Oriental)",
    file: "models/voxel/maps/glowstone_mountain_oriental.glb",
    role: "map_chunk",
    fileBytes: 21_500_000,
    tags: ["map", "glowstone", "voxel-last30"],
  },
  tower_koth: {
    id: "tower_koth",
    label: "Tower KOTH",
    file: "models/voxel/maps/tower_koth.glb",
    role: "map_chunk",
    fileBytes: 21_380_000,
    tags: ["map", "koth", "voxel-last30"],
  },
  pirat_bay: {
    id: "pirat_bay",
    label: "Pirate Bay",
    file: "models/voxel/maps/pirat_bay.glb",
    role: "map_chunk",
    fileBytes: 26_140_000,
    tags: ["map", "pirate", "coast", "voxel-last30"],
  },
  low_poly_canyon: {
    id: "low_poly_canyon",
    label: "Low Poly Canyon",
    file: "models/voxel/maps/low_poly_canyon.glb",
    role: "map_chunk",
    fileBytes: 13_240_000,
    tags: ["map", "canyon", "desert", "voxel-last30"],
  },
  animal_company_lobby: {
    id: "animal_company_lobby",
    label: "Animal Company Lobby",
    file: "models/voxel/maps/animal_company_lobby.glb",
    role: "map_chunk",
    fileBytes: 60_450_000,
    tags: ["map", "lobby", "spawn", "voxel-last30"],
  },
  koth_bundle: {
    id: "koth_bundle",
    label: "KOTH Bundle",
    file: "models/voxel/maps/koth_bundle.glb",
    role: "map_chunk",
    fileBytes: 66_300_000,
    tags: ["map", "koth", "voxel-last30"],
  },
  island_life: {
    id: "island_life",
    label: "Island Life",
    file: "models/worlds/island_life.glb",
    role: "map_chunk",
    fileBytes: 450_700_000,
    tags: ["map", "overworld", "mineways", "voxel-last30"],
    blurb: "Full island_life world — multipart R2; scale via evaluateAssetRole.",
  },
  dalaran_fantasy_island: {
    id: "dalaran_fantasy_island",
    label: "Dalaran Fantasy Island",
    file: "models/voxel/maps/dalaran_fantasy_island.glb",
    role: "map_chunk",
    fileBytes: 133_900_000,
    tags: ["map", "fantasy", "island", "voxel-last30"],
  },
  faction_spawn_castle_town: {
    id: "faction_spawn_castle_town",
    label: "Faction Spawn Castle Town",
    file: "models/voxel/maps/faction_spawn_castle_town.glb",
    role: "map_chunk",
    fileBytes: 462_700_000,
    tags: ["map", "faction", "castle", "voxel-last30"],
  },
  awesome_realm_world: {
    id: "awesome_realm_world",
    label: "Awesome Realm World",
    file: "models/voxel/maps/awesome_realm_world.glb",
    role: "map_chunk",
    fileBytes: 359_700_000,
    tags: ["map", "realm", "overworld", "voxel-last30"],
  },
  queen_annes_revenge: {
    id: "queen_annes_revenge",
    label: "Queen Anne's Revenge",
    file: "models/voxel/content/queen_annes_revenge.glb",
    role: "map_chunk",
    fileBytes: 53_900_000,
    tags: ["map", "ship", "pirate", "voxel-last30"],
    blurb: "Flagship structure — treat as map/structure, not prop height-fit.",
  },
};

/** Resolve scale for a known map chunk id (or evaluate by name). */
export function scaleForMapChunkId(id: string, measured?: NativeBounds): number {
  const def = MAP_CHUNKS[id];
  const bounds = measured ?? def?.nativeBounds ?? { x: 100, y: 50, z: 100 };
  if (def?.sourceBlockPitch) {
    return scaleMapToBlockGrid(bounds, { sourceBlockPitch: def.sourceBlockPitch });
  }
  return evaluateAssetRole({
    name: def?.file ?? id,
    bounds,
    fileBytes: def?.fileBytes,
    tags: def?.tags,
    forceMap: true,
  }).scale;
}
