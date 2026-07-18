/**
 * Harvest production catalog — recipes, skill trees, ops, maps, codex API, systems design.
 * Used by HarvestProductionUI (Danger Room harvest/build mode).
 */
import { MINE_LOADER_LIVE, buildMineLoaderUrl } from "../auth/mineLoaderConfig";
import { getStoredToken } from "../lib/grudgeAuth";
import {
  enrichSkillNodeIcons,
  pickCatalogIconFields,
  resolveTreeHeaderIconUrl,
} from "../lib/skillTreeIcons";
import {
  getActiveSkillCharacterId,
  getActiveSkillEffects,
  getActiveSkillProgress,
  getActiveUnlocked,
  setActiveSkillProgress,
} from "../lib/grudgeSystems/skillProgressBridge";
import { MAP_TEMPLATES } from "../three/voxel/templates";
import { listMapChunks } from "../three/voxel/mapChunks";
import { gameSession } from "./GameSession";

export type HarvestTabId =
  | "ops"
  | "crafting"
  | "recipes"
  | "codex"
  | "maps"
  | "trees"
  | "characters"
  | "systems";

export const HARVEST_TABS: {
  id: HarvestTabId;
  label: string;
  blurb: string;
  glyph: string;
}[] = [
  { id: "ops", label: "Operations", blurb: "Gather, mine, skin, place", glyph: "⚙" },
  { id: "crafting", label: "Crafting", blurb: "Stations & craft queue", glyph: "⚒" },
  { id: "recipes", label: "Recipes", blurb: "Full recipe book", glyph: "📜" },
  { id: "codex", label: "Codex", blurb: "Mine-Loader blocks & defs", glyph: "📘" },
  { id: "maps", label: "Maps", blurb: "World & arena library", glyph: "🗺" },
  { id: "trees", label: "Skill trees", blurb: "Harvest · craft · build", glyph: "🌳" },
  {
    id: "characters",
    label: "Characters",
    blurb: "Heroes (4-slot) · units / explorers",
    glyph: "👤",
  },
  { id: "systems", label: "Systems", blurb: "Voxel game design", glyph: "🧩" },
];

export interface CraftInput {
  id: string;
  name: string;
  qty: number;
}
export interface CraftRecipe {
  id: string;
  name: string;
  station: string;
  output: { id: string; name: string; qty: number };
  inputs: CraftInput[];
  timeSec: number;
  skill: string;
  tier: number;
  heal?: number;
}

/** Node kinds on the class path (milestone band vs bridge choices). */
export type SkillNodeKind =
  | "milestone"
  | "bridge"
  | "passive"
  | "proc"
  | "selection"
  | "form"
  | "active";

export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  /**
   * Display band 0–3 (legacy Craftpix ribbon).
   * Prefer {@link requiredLevel} for the 0/1/5/10/15/20 path.
   */
  tier: number;
  requires: string[];
  cost: number;
  /** Character level gate (0 = selection, then 1,5,10,15,20 milestones). */
  requiredLevel?: number;
  kind?: SkillNodeKind;
  /** Auto-granted when class is selected (level 0). */
  auto?: boolean;
  /** Optional flat bonuses (HP, procs, etc.) for bridge nodes. */
  bonuses?: Record<string, number>;
  formId?: string;
  passive?: boolean;
  /**
   * Original catalog icon path (e.g. /icons/skill_nobg/Warriorskill_01_nobg.png).
   * Prefer {@link iconUrl} for absolute CDN when resolved.
   */
  icon?: string;
  /** Absolute (CDN) or relative icon URL for UI &lt;img&gt;. */
  iconUrl?: string;
}
export interface SkillTree {
  id: string;
  name: string;
  color: string;
  nodes: SkillNode[];
  /** Class key when this tree is a fleet class tree (`warrior` …). */
  classKey?: string;
  /** Tree header icon (class relic / pack). */
  icon?: string;
  iconUrl?: string;
}

/** Milestone levels on the class skill path. */
export const CLASS_SKILL_MILESTONES = [0, 1, 5, 10, 15, 20] as const;

export function skillBandLabel(requiredLevel: number): string {
  if (requiredLevel <= 0) return "L0 · Select";
  if (requiredLevel === 1) return "L1 · Start";
  if (requiredLevel === 5) return "L5";
  if (requiredLevel === 10) return "L10";
  if (requiredLevel === 15) return "L15";
  if (requiredLevel === 20) return "L20";
  if (requiredLevel < 5) return `L${requiredLevel} · Bridge`;
  if (requiredLevel < 10) return `L${requiredLevel} · Bridge`;
  if (requiredLevel < 15) return `L${requiredLevel} · Bridge`;
  return `L${requiredLevel} · Bridge`;
}

export function tierFromRequiredLevel(lv: number): number {
  if (lv <= 1) return 0;
  if (lv <= 5) return 1;
  if (lv <= 10) return 2;
  return 3;
}

export interface HarvestOp {
  id: string;
  name: string;
  glyph: string;
  mode: "harvest" | "build";
  blurb: string;
  tool: string;
  yields?: string[];
  channelSec?: number;
}

export interface MapAsset {
  id: string;
  name: string;
  path: string;
  kind: "arena" | "dungeon" | "scene" | "island" | "voxel" | "map_chunk";
  blurb: string;
  /** Mine-Loader codex block ids (terrain palette hints). */
  codexBlocks?: string[];
  /** Mine-Loader definition ids. */
  codexDefs?: string[];
  /** D1 / CDN r2 key when registered. */
  r2Key?: string;
  /** asset_registry category */
  category?: string;
}

export interface CharacterImportRow {
  id: string;
  name: string;
  /**
   * hero  — user campfire roster (max 4)
   * unit  — RTS / faction troops (explorers are units)
   * fleet — legacy alias for hero from Railway
   * avatar / explorer — head/rig import helpers
   */
  source: "hero" | "unit" | "fleet" | "avatar" | "explorer";
  raceId?: string;
  blurb: string;
  avatarConfig?: unknown;
  unitType?: string;
  factionId?: string;
}

export interface DesignPillar {
  id: string;
  name: string;
  glyph: string;
  summary: string;
  inputs: string[];
  outputs: string[];
}

export interface DesignControl {
  key: string;
  action: string;
}

export interface SystemsDoc {
  pillars: DesignPillar[];
  controls: DesignControl[];
  contentPaths: string[];
}

/** Fallback recipes if content JSON fails to load. */
const FALLBACK_RECIPES: CraftRecipe[] = [
  {
    id: "rcp_torch",
    name: "Torch",
    station: "hand",
    output: { id: "itm_torch", name: "Torch", qty: 4 },
    inputs: [
      { id: "mat_stick", name: "Stick", qty: 1 },
      { id: "mat_coal", name: "Coal", qty: 1 },
    ],
    timeSec: 1,
    skill: "crafting",
    tier: 0,
  },
  {
    id: "rcp_wood_plank",
    name: "Wood planks",
    station: "workbench",
    output: { id: "mat_plank", name: "Plank", qty: 4 },
    inputs: [{ id: "mat_log", name: "Log", qty: 1 }],
    timeSec: 1.5,
    skill: "crafting",
    tier: 0,
  },
];

const FALLBACK_OPS: HarvestOp[] = [
  {
    id: "gather",
    name: "Gather",
    glyph: "🌿",
    mode: "harvest",
    blurb: "Forage plants and surface nodes.",
    tool: "hand",
    yields: ["mat_herb"],
  },
  {
    id: "mine",
    name: "Mine",
    glyph: "⛏",
    mode: "harvest",
    blurb: "Mine ore and stone.",
    tool: "pick",
    yields: ["mat_stone", "mat_coal"],
  },
  {
    id: "chop",
    name: "Chop",
    glyph: "🪓",
    mode: "harvest",
    blurb: "Fell trees for logs.",
    tool: "axe",
    yields: ["mat_log", "mat_stick"],
  },
  {
    id: "place",
    name: "Place",
    glyph: "▣",
    mode: "build",
    blurb: "Place hotbar block (Mine-Loader LMB place).",
    tool: "build",
  },
  {
    id: "demolish",
    name: "Demolish",
    glyph: "🗑",
    mode: "build",
    blurb: "Mine / break with pick, shovel, or axe.",
    tool: "build",
  },
  {
    id: "craft-bench",
    name: "Craft",
    glyph: "⚒",
    mode: "build",
    blurb: "Forge bench (E at blacksmith forge in Realms).",
    tool: "build",
  },
];

const FALLBACK_TREES: SkillTree[] = [
  {
    id: "harvest",
    name: "Harvest",
    color: "#7ee7a8",
    nodes: [
      { id: "h_gather", name: "Gatherer", desc: "Pick plants faster.", tier: 0, requires: [], cost: 1 },
      { id: "h_mine", name: "Miner", desc: "Mine ore veins.", tier: 1, requires: ["h_gather"], cost: 2 },
    ],
  },
  {
    id: "crafting",
    name: "Crafting",
    color: "#ffd28a",
    nodes: [
      { id: "c_hand", name: "Handcraft", desc: "Hand recipes.", tier: 0, requires: [], cost: 1 },
      { id: "c_bench", name: "Workbench", desc: "Workbench recipes.", tier: 1, requires: ["c_hand"], cost: 2 },
    ],
  },
];

const FALLBACK_SYSTEMS: SystemsDoc = {
  pillars: [
    {
      id: "gather-loop",
      name: "Gather loop",
      glyph: "⛏",
      summary: "Operations yield materials into the bag for crafting.",
      inputs: ["World voxels", "Nodes"],
      outputs: ["Material bag"],
    },
    {
      id: "craft-loop",
      name: "Craft loop",
      glyph: "⚒",
      summary: "Stations consume bag mats and emit tools and kits.",
      inputs: ["Bag", "Stations"],
      outputs: ["Tools", "Build kits"],
    },
    {
      id: "codex-ssot",
      name: "Mine-Loader Codex",
      glyph: "📘",
      summary: "Blocks and definitions from Mine-Loader API.",
      inputs: ["/api/blocks", "/api/definitions"],
      outputs: ["Place types", "Mechanics"],
    },
  ],
  controls: [
    { key: "Q", action: "Cycle combat → harvest → build" },
    { key: "Hold Tab", action: "Radial tool wheel" },
    { key: "P", action: "Toggle production UI" },
    { key: "Esc", action: "Close production UI" },
  ],
  contentPaths: ["content/harvest/*"],
};

/** Static world maps library (Open public + scenes). */
export const MAP_LIBRARY: MapAsset[] = [
  {
    id: "arena-war-zone",
    name: "War Zone Arena",
    path: "models/arena-war-zone.glb",
    kind: "arena",
    blurb: "Open combat arena mesh.",
  },
  {
    id: "dungeon",
    name: "Dungeon",
    path: "models/dungeon.glb",
    kind: "dungeon",
    blurb: "Sealed depths / pit geometry.",
  },
  {
    id: "combat-sandbox",
    name: "Combat sandbox scene",
    path: "content/scenes/combat-sandbox.gfscene.json",
    kind: "scene",
    blurb: "Forge scene template for sparring.",
  },
  {
    id: "catalog-plaza",
    name: "Catalog plaza",
    path: "content/scenes/catalog-plaza.gfscene.json",
    kind: "scene",
    blurb: "Weapon / asset showcase plaza.",
  },
  {
    id: "weapon-lab",
    name: "Weapon lab",
    path: "content/scenes/weapon-lab.gfscene.json",
    kind: "scene",
    blurb: "Skill and weapon lab layout.",
  },
  {
    id: "realms-island",
    name: "GRUDOX Realms island",
    path: "mine-loader:#/play",
    kind: "island",
    blurb: "Live voxel world (Mine-Loader authority).",
    codexBlocks: ["grass", "dirt", "stone", "water"],
    codexDefs: ["overworld"],
  },
  // --- last-30 voxel map chunks (see content/worlds/voxel-last30-catalog.json) ---
  {
    id: "castle_eltz",
    name: "Castle Eltz",
    path: "models/warlords-era/worlds/castle_eltz.glb",
    kind: "map_chunk",
    blurb: "Map chunk · scale 1 block = 1 m · codex stone_brick castle.",
    r2Key: "models/warlords-era/worlds/castle_eltz.glb",
    category: "voxel_map",
    codexBlocks: ["stone_brick", "cobble", "wood_plank", "glass", "roof_tile"],
    codexDefs: ["castle", "stronghold", "seed_world"],
  },
  {
    id: "grotto_cavern_cave",
    name: "Grotto Cavern",
    path: "models/voxel/maps/grotto_cavern_cave.glb",
    kind: "map_chunk",
    blurb: "Cave chunk · stone/ore palette via Codex /api/blocks.",
    r2Key: "models/voxel/maps/grotto_cavern_cave.glb",
    category: "voxel_map",
    codexBlocks: ["stone", "cobble", "dirt", "gravel", "water", "iron_ore"],
    codexDefs: ["cave", "dungeon_entrance"],
  },
  {
    id: "dragon_head_cave",
    name: "Dragon Head Cave",
    path: "models/voxel/maps/dragon_head_cave.glb",
    kind: "map_chunk",
    blurb: "Boss lair cavern · lava/obsidian codex.",
    r2Key: "models/voxel/maps/dragon_head_cave.glb",
    category: "voxel_map",
    codexBlocks: ["stone", "obsidian", "lava", "netherrack", "gold_ore"],
    codexDefs: ["boss_lair", "dragon_den"],
  },
  {
    id: "geonosis_arena",
    name: "Geonosis Arena",
    path: "models/voxel/maps/geonosis_arena.glb",
    kind: "map_chunk",
    blurb: "PvP arena floor · sand/sandstone codex.",
    r2Key: "models/voxel/maps/geonosis_arena.glb",
    category: "voxel_map",
    codexBlocks: ["sand", "sandstone", "stone", "red_sand"],
    codexDefs: ["arena", "pvp_ring"],
  },
  {
    id: "floating_islands_dwarves_haven",
    name: "Dwarves Haven Floating Islands",
    path: "models/voxel/maps/floating_islands_dwarves_haven.glb",
    kind: "map_chunk",
    blurb: "Sky island Realms seed.",
    r2Key: "models/voxel/maps/floating_islands_dwarves_haven.glb",
    category: "voxel_map",
    codexBlocks: ["grass", "dirt", "stone", "wood_plank", "cloud"],
    codexDefs: ["sky_island", "dwarf_haven"],
  },
  {
    id: "glowstone_mountain",
    name: "Glowstone Mountain",
    path: "models/voxel/maps/glowstone_mountain.glb",
    kind: "map_chunk",
    blurb: "Glowstone mountain · codex glowstone block.",
    r2Key: "models/voxel/maps/glowstone_mountain.glb",
    category: "voxel_map",
    codexBlocks: ["glowstone", "stone", "dirt"],
    codexDefs: ["glow_mountain"],
  },
  {
    id: "glowstone_mountain_oriental",
    name: "Glowstone Mountain (Oriental)",
    path: "models/voxel/maps/glowstone_mountain_oriental.glb",
    kind: "map_chunk",
    blurb: "Oriental glowstone mountain variant.",
    r2Key: "models/voxel/maps/glowstone_mountain_oriental.glb",
    category: "voxel_map",
    codexBlocks: ["glowstone", "stone", "dirt", "grass", "lantern"],
    codexDefs: ["glow_mountain", "oriental_theme"],
  },
  {
    id: "tower_koth",
    name: "Tower KOTH",
    path: "models/voxel/maps/tower_koth.glb",
    kind: "map_chunk",
    blurb: "King-of-the-hill tower · control point def.",
    r2Key: "models/voxel/maps/tower_koth.glb",
    category: "voxel_map",
    codexBlocks: ["stone_brick", "wood_plank", "ladder", "torch"],
    codexDefs: ["koth", "control_point"],
  },
  {
    id: "pirat_bay",
    name: "Pirate Bay",
    path: "models/voxel/maps/pirat_bay.glb",
    kind: "map_chunk",
    blurb: "Coastal pirate bay · sand/water/wood codex.",
    r2Key: "models/voxel/maps/pirat_bay.glb",
    category: "voxel_map",
    codexBlocks: ["sand", "water", "wood_plank", "barrel", "palm_log"],
    codexDefs: ["pirate_bay", "harbor"],
  },
  {
    id: "low_poly_canyon",
    name: "Low Poly Canyon",
    path: "models/voxel/maps/low_poly_canyon.glb",
    kind: "map_chunk",
    blurb: "Canyon desert seed.",
    r2Key: "models/voxel/maps/low_poly_canyon.glb",
    category: "voxel_map",
    codexBlocks: ["sandstone", "sand", "stone", "cactus"],
    codexDefs: ["canyon", "desert_biome"],
  },
  {
    id: "animal_company_lobby",
    name: "Animal Company Lobby",
    path: "models/voxel/maps/animal_company_lobby.glb",
    kind: "map_chunk",
    blurb: "Lobby spawn hub v3.",
    r2Key: "models/voxel/maps/animal_company_lobby.glb",
    category: "voxel_map",
    codexBlocks: ["grass", "wood_plank", "stone", "fence"],
    codexDefs: ["lobby", "spawn_hub"],
  },
  {
    id: "koth_bundle",
    name: "KOTH Bundle",
    path: "models/voxel/maps/koth_bundle.glb",
    kind: "map_chunk",
    blurb: "Multi-arena KOTH pack.",
    r2Key: "models/voxel/maps/koth_bundle.glb",
    category: "voxel_map",
    codexBlocks: ["stone_brick", "grass", "wood_plank"],
    codexDefs: ["koth", "multi_arena"],
  },
  {
    id: "island_life",
    name: "Island Life",
    path: "models/worlds/island_life.glb",
    kind: "map_chunk",
    blurb: "Mineways full island · multipart CDN · overworld codex.",
    r2Key: "models/worlds/island_life.glb",
    category: "voxel_map",
    codexBlocks: ["grass", "dirt", "sand", "water", "log", "leaves", "ore_iron"],
    codexDefs: ["overworld", "island_life"],
  },
  {
    id: "dalaran_fantasy_island",
    name: "Dalaran Fantasy Island",
    path: "models/voxel/maps/dalaran_fantasy_island.glb",
    kind: "map_chunk",
    blurb: "Fantasy island challenge map.",
    r2Key: "models/voxel/maps/dalaran_fantasy_island.glb",
    category: "voxel_map",
    codexBlocks: ["stone_brick", "grass", "water", "wood_plank", "crystal"],
    codexDefs: ["fantasy_island", "challenge_map"],
  },
  {
    id: "queen_annes_revenge",
    name: "Queen Anne's Revenge",
    path: "models/voxel/content/queen_annes_revenge.glb",
    kind: "map_chunk",
    blurb: "Pirate flagship structure (map-scale, not prop).",
    r2Key: "models/voxel/content/queen_annes_revenge.glb",
    category: "voxel_content",
    codexBlocks: ["wood_plank", "barrel", "rope", "cannon", "sail"],
    codexDefs: ["ship", "pirate_flagship"],
  },
];

/** Codex-linked content props / animals / VFX from last-30 catalog (D1 registered). */
export const VOXEL_CODEX_ASSETS: MapAsset[] = [
  {
    id: "anvil_station",
    name: "Anvil (smith station)",
    path: "models/voxel/content/anvil.glb",
    kind: "scene",
    blurb: "Forge station · defs anvil/smithing · Codex craft.",
    r2Key: "models/voxel/content/anvil.glb",
    category: "voxel_content",
    codexBlocks: ["anvil", "iron_block"],
    codexDefs: ["anvil", "smithing", "repair"],
  },
  {
    id: "desert_portal",
    name: "Desert Portal",
    path: "models/voxel/content/desert_portal.glb",
    kind: "scene",
    blurb: "Portal prop · Realms door / dimension gate.",
    r2Key: "models/voxel/content/desert_portal.glb",
    category: "voxel_content",
    codexBlocks: ["portal_frame", "sandstone", "obsidian"],
    codexDefs: ["portal", "dimension_gate"],
  },
  {
    id: "brick_modular_kit",
    name: "Brick modular kit",
    path: "models/voxel/content/brick_modular_kit.glb",
    kind: "voxel",
    blurb: "1 block = 1 m modular brick · build kit.",
    r2Key: "models/voxel/content/brick_modular_kit.glb",
    category: "voxel_content",
    codexBlocks: ["brick", "stone_brick", "mortar"],
    codexDefs: ["build_kit", "modular_wall"],
  },
  {
    id: "t0_crossbow",
    name: "T0 Crossbow",
    path: "models/voxel/content/t0_crossbow.glb",
    kind: "scene",
    blurb: "Gear mesh · codex ranged_t0.",
    r2Key: "models/voxel/content/t0_crossbow.glb",
    category: "voxel_content",
    codexBlocks: ["crossbow", "string", "iron_ingot"],
    codexDefs: ["crossbow", "ranged_t0"],
  },
  {
    id: "chaotic_marine_life",
    name: "Chaotic Marine Life",
    path: "models/voxel/animals/chaotic_marine_life.glb",
    kind: "scene",
    blurb: "Water fauna pack · fishing / shores.",
    r2Key: "models/voxel/animals/chaotic_marine_life.glb",
    category: "voxel_animal",
    codexBlocks: ["water", "kelp", "sand"],
    codexDefs: ["fish", "marine", "water_fauna"],
  },
  {
    id: "hanu_animated",
    name: "Hanu (animated)",
    path: "models/voxel/animals/hanu_animated.glb",
    kind: "scene",
    blurb: "Forest creature · not grudge6 hero.",
    r2Key: "models/voxel/animals/hanu_animated.glb",
    category: "voxel_animal",
    codexBlocks: ["grass", "leaves"],
    codexDefs: ["hanu", "primate", "forest_fauna"],
  },
  {
    id: "dragon_three_loops",
    name: "Dragon (3 motion loops)",
    path: "models/voxel/animals/dragon_three_loops.glb",
    kind: "scene",
    blurb: "Dragon boss / flying mount animations.",
    r2Key: "models/voxel/animals/dragon_three_loops.glb",
    category: "voxel_animal",
    codexBlocks: ["obsidian", "lava"],
    codexDefs: ["dragon", "boss", "flying_mount"],
  },
  {
    id: "crystal_pangolin",
    name: "Crystal Pangolin",
    path: "models/voxel/animals/crystal_pangolin.glb",
    kind: "scene",
    blurb: "Crystal beast creature.",
    r2Key: "models/voxel/animals/crystal_pangolin.glb",
    category: "voxel_animal",
    codexBlocks: ["crystal", "stone"],
    codexDefs: ["pangolin", "crystal_beast"],
  },
  {
    id: "vfx_tornado",
    name: "VFX Tornado Vortex",
    path: "models/voxel/vfx/tornado_vortex.glb",
    kind: "scene",
    blurb: "Wind skill AOE · /api/definitions wind.",
    r2Key: "models/voxel/vfx/tornado_vortex.glb",
    category: "voxel_vfx",
    codexDefs: ["tornado", "wind_skill", "aoe_vortex"],
  },
  {
    id: "vfx_energy_stream",
    name: "VFX Energy Stream",
    path: "models/voxel/vfx/energy_particle_stream.glb",
    kind: "scene",
    blurb: "Channel / beam skill VFX.",
    r2Key: "models/voxel/vfx/energy_particle_stream.glb",
    category: "voxel_vfx",
    codexDefs: ["energy_stream", "channel", "beam"],
  },
  {
    id: "vfx_rasenshuriken",
    name: "VFX Wind Rasenshuriken",
    path: "models/voxel/vfx/wind_rasenshuriken.glb",
    kind: "scene",
    blurb: "Charged wind projectile VFX.",
    r2Key: "models/voxel/vfx/wind_rasenshuriken.glb",
    category: "voxel_vfx",
    codexDefs: ["rasenshuriken", "wind_projectile", "charged_shot"],
  },
  {
    id: "vfx_kaens_spike",
    name: "VFX Kaen's Spike",
    path: "models/voxel/vfx/kaens_spike.glb",
    kind: "scene",
    blurb: "Earth ground-rise skill VFX.",
    r2Key: "models/voxel/vfx/kaens_spike.glb",
    category: "voxel_vfx",
    codexDefs: ["spike", "earth_skill", "ground_rise"],
  },
  {
    id: "vfx_fire_hurricane",
    name: "VFX Fire Hurricane",
    path: "models/voxel/vfx/fire_hurricane.glb",
    kind: "scene",
    blurb: "Fire AOE anime VFX.",
    r2Key: "models/voxel/vfx/fire_hurricane.glb",
    category: "voxel_vfx",
    codexBlocks: ["fire", "magma"],
    codexDefs: ["fire_hurricane", "fire_aoe", "anime_vfx"],
  },
  {
    id: "vfx_antimatter",
    name: "VFX Unstable Antimatter",
    path: "models/voxel/vfx/unstable_antimatter.glb",
    kind: "scene",
    blurb: "Ultimate void burst VFX.",
    r2Key: "models/voxel/vfx/unstable_antimatter.glb",
    category: "voxel_vfx",
    codexDefs: ["antimatter", "void_burst", "ultimate"],
  },
];

/** Voxel editor templates + static maps + map chunks for the Maps tab. */
export function listMapLibrary(): MapAsset[] {
  const voxels: MapAsset[] = MAP_TEMPLATES.map((t) => ({
    id: `voxel-${t.id}`,
    name: t.label,
    path: `voxel/templates:${t.id}`,
    kind: "voxel" as const,
    blurb: t.desc,
  }));
  const chunks: MapAsset[] = listMapChunks().map((c) => ({
    id: `chunk-${c.id}`,
    name: c.label,
    path: c.file,
    kind: "map_chunk" as const,
    blurb: c.blurb || `Map chunk · 1 block = 1 m · tags: ${(c.tags || []).join(", ")}`,
    r2Key: c.file,
    category: "voxel_map",
  }));
  // Dedupe by id (MAP_LIBRARY already lists many last-30 ids)
  const seen = new Set<string>();
  const out: MapAsset[] = [];
  for (const m of [...voxels, ...MAP_LIBRARY, ...VOXEL_CODEX_ASSETS, ...chunks]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/**
 * Resolve Mine-Loader Codex URLs for a library row (blocks + defs).
 * Used by production Maps/Codex panels to deep-link.
 */
export function codexLinksForMap(asset: MapAsset): {
  blocksUrl: string;
  defsUrl: string;
  blockIds: string[];
  defIds: string[];
} {
  const base = MINE_LOADER_LIVE.replace(/\/+$/, "");
  return {
    blocksUrl: `${base}/api/blocks`,
    defsUrl: `${base}/api/definitions`,
    blockIds: asset.codexBlocks || [],
    defIds: asset.codexDefs || [],
  };
}

async function tryJson<T>(urls: string[]): Promise<T | null> {
  for (const u of urls) {
    try {
      const r = await fetch(u, { credentials: "omit" });
      if (!r.ok) continue;
      return (await r.json()) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Load recipes from Open content API / static. */
export async function loadHarvestRecipes(): Promise<{
  recipes: CraftRecipe[];
  stations: { id: string; name: string; glyph: string }[];
}> {
  const data = await tryJson<{
    recipes?: CraftRecipe[];
    stations?: { id: string; name: string; glyph: string }[];
  }>([
    "/api/content/harvest/recipes.json",
    "/content/harvest/recipes.json",
    "https://info.grudge-studio.com/api/v1/content/harvest/recipes.json",
    "https://objectstore.grudge-studio.com/api/v1/content/harvest/recipes.json",
  ]);
  return {
    recipes: data?.recipes?.length ? data.recipes : FALLBACK_RECIPES,
    stations: data?.stations?.length
      ? data.stations
      : [
          { id: "hand", name: "Hand", glyph: "✋" },
          { id: "campfire", name: "Campfire", glyph: "🔥" },
          { id: "workbench", name: "Workbench", glyph: "🧰" },
          { id: "forge", name: "Forge", glyph: "⚒" },
          { id: "loom", name: "Loom", glyph: "🧵" },
        ],
  };
}

type BridgeFile = {
  level0?: Record<
    string,
    Array<{
      id: string;
      name: string;
      description?: string;
      effect?: string;
      kind?: SkillNodeKind;
      auto?: boolean;
      formId?: string;
      bonuses?: Record<string, number>;
    }>
  >;
  bridges?: Record<
    string,
    Array<{
      id: string;
      name: string;
      requiredLevel: number;
      requires?: string[];
      kind?: SkillNodeKind;
      description?: string;
      effect?: string;
      cost?: number;
      bonuses?: Record<string, number>;
      formId?: string;
    }>
  >;
};

/**
 * Map fleet `master-skillTrees.json` (character.grudge-studio.com / info SSOT)
 * into the SkillTree shape used by ClassSkillTreePanel.
 * Optionally merges additive bridge nodes (levels between 1/5/10/15/20).
 */
function mapMasterSkillTrees(raw: unknown, bridges: BridgeFile | null): SkillTree[] {
  const root = raw as {
    skillTrees?: Record<
      string,
      {
        className?: string;
        color?: string;
        icon?: string;
        iconUrl?: string;
        tiers?: Array<{
          name?: string;
          requiredLevel?: number;
          skills?: Array<Record<string, unknown>>;
        }>;
      }
    >;
  };
  if (!root?.skillTrees) return [];
  const out: SkillTree[] = [];
  for (const [classId, cls] of Object.entries(root.skillTrees)) {
    const treeId = `class-${classId}`;
    const nodes: SkillNode[] = [];

    // Level 0 — granted at class selection (one class from the row)
    for (const s of bridges?.level0?.[classId] || []) {
      const rawNode = s as unknown as Record<string, unknown>;
      const ic = pickCatalogIconFields(rawNode);
      nodes.push(
        enrichSkillNodeIcons(
          {
            id: s.id,
            name: s.name,
            desc: [s.description, s.effect].filter(Boolean).join(" — ") || s.name,
            tier: 0,
            requiredLevel: 0,
            requires: [],
            cost: 0,
            kind: s.kind || "passive",
            auto: s.auto !== false,
            formId: s.formId,
            bonuses: s.bonuses,
            passive: s.kind === "passive" || s.kind === "form",
            icon: ic.icon,
            iconUrl: ic.iconUrl,
          },
          treeId,
        ),
      );
    }

    // Milestone tiers from existing master-skillTrees (1 / 5 / 10 / 15 / 20)
    (cls.tiers || []).forEach((tier, tierIdx) => {
      const reqLv = typeof tier.requiredLevel === "number" ? tier.requiredLevel : [1, 5, 10, 15, 20][tierIdx] ?? 1;
      const skills = tier.skills || [];
      skills.forEach((s, skillIdx) => {
        const id = typeof s.id === "string" ? s.id : "";
        const name = typeof s.name === "string" ? s.name : "";
        if (!id || !name) return;
        const passive = !!s.passive;
        const procEffect = s.procEffect;
        const kind: SkillNodeKind = passive ? "passive" : procEffect ? "proc" : "milestone";
        const ic = pickCatalogIconFields(s);
        const requires = typeof s.requires === "string" ? [s.requires] : Array.isArray(s.requires) ? (s.requires as string[]) : [];
        nodes.push(
          enrichSkillNodeIcons(
            {
              id,
              name,
              desc:
                [s.description, s.effect].filter((x) => typeof x === "string").join(" — ") || name,
              tier: tierFromRequiredLevel(reqLv),
              requiredLevel: reqLv,
              requires,
              cost: typeof s.maxPoints === "number" ? (s.maxPoints as number) : 1,
              kind,
              passive,
              bonuses: (s.bonuses as Record<string, number>) || undefined,
              auto: reqLv === 1 && skillIdx === 0 ? false : undefined,
              icon: ic.icon,
              iconUrl: ic.iconUrl,
            },
            treeId,
          ),
        );
      });
    });

    // Bridge nodes between milestones (selections, passives, procs, health, …)
    for (const b of bridges?.bridges?.[classId] || []) {
      const rawB = b as unknown as Record<string, unknown>;
      const ic = pickCatalogIconFields(rawB);
      nodes.push(
        enrichSkillNodeIcons(
          {
            id: b.id,
            name: b.name,
            desc: [b.description, b.effect].filter(Boolean).join(" — ") || b.name,
            tier: tierFromRequiredLevel(b.requiredLevel),
            requiredLevel: b.requiredLevel,
            requires: b.requires || [],
            cost: b.cost ?? 1,
            kind: b.kind || "bridge",
            bonuses: b.bonuses,
            formId: b.formId,
            passive: b.kind === "passive" || b.kind === "proc",
            icon: ic.icon,
            iconUrl: ic.iconUrl,
          },
          treeId,
        ),
      );
    }

    // Stable order: by requiredLevel then name
    nodes.sort((a, b) => (a.requiredLevel ?? 0) - (b.requiredLevel ?? 0) || a.name.localeCompare(b.name));

    if (!nodes.length) continue;
    const treeIcons = pickCatalogIconFields(cls as unknown as Record<string, unknown>);
    const treeEnriched = enrichSkillNodeIcons(
      {
        id: treeId,
        icon: treeIcons.icon || cls.icon,
        iconUrl: treeIcons.iconUrl || cls.iconUrl,
        classKey: classId,
      },
      treeId,
    );
    out.push({
      id: treeId,
      name: cls.className || classId,
      color: cls.color || "#d4a400",
      classKey: classId,
      icon: treeEnriched.icon,
      iconUrl: treeEnriched.iconUrl,
      nodes,
    });
  }
  return out;
}

/** Class combat skill trees from fleet SSOT + additive bridges. */
export async function loadClassSkillTreesFromFleet(): Promise<SkillTree[]> {
  const [data, bridgeData] = await Promise.all([
    tryJson<unknown>([
      "/api/objectstore/v1/master-skillTrees.json",
      "https://info.grudge-studio.com/api/v1/master-skillTrees.json",
      "https://objectstore.grudge-studio.com/api/v1/master-skillTrees.json",
    ]),
    tryJson<BridgeFile>([
      "/api/objectstore/v1/class-skill-bridges.json",
      "https://info.grudge-studio.com/api/v1/class-skill-bridges.json",
      "https://objectstore.grudge-studio.com/api/v1/class-skill-bridges.json",
      // Local fallback copy if published under content later
      "/content/class-skill-bridges.json",
    ]),
  ]);
  return mapMasterSkillTrees(data, bridgeData);
}

/**
 * Grant level-0 (selection) nodes for a class — free, always.
 * Call when the player picks one class from the row (Worge includes Bear start).
 */
export function grantClassSelectionSkills(classKey: string): string[] {
  const key = classKey.replace(/^class-/, "");
  const cur = new Set(loadSkillUnlocks());
  // Known L0 ids from bridges (also re-applied after trees load)
  const defaults: Record<string, string[]> = {
    warrior: ["w_l0_warbound"],
    mage: ["m_l0_leyline"],
    ranger: ["r_l0_log"],
    worge: ["wr_l0_bear"],
  };
  for (const id of defaults[key] || []) cur.add(id);
  const arr = [...cur];
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  return arr;
}

/** Unlock every `auto` node on a loaded class tree (level 0 + any flagged). */
export function grantAutoNodesFromTree(tree: SkillTree | undefined): string[] {
  if (!tree) return loadSkillUnlocks();
  const cur = new Set(loadSkillUnlocks());
  for (const n of tree.nodes) {
    if (n.auto || n.requiredLevel === 0) cur.add(n.id);
  }
  const arr = [...cur];
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  return arr;
}

/**
 * Production skill trees:
 * 1) Local harvest/craft/build/weapon-combat content (skill-trees.json)
 * 2) Fleet master-skillTrees (Warrior / Mage / Ranger / Worge) — character skills page SSOT
 */
/** Ensure every node on a tree has icon + resolved iconUrl (original catalog preferred). */
export function enrichTreeIcons(tree: SkillTree): SkillTree {
  const nodes = (tree.nodes || []).map((n) =>
    enrichSkillNodeIcons(
      {
        ...n,
        icon: n.icon,
        iconUrl: n.iconUrl,
      },
      tree.id,
    ),
  );
  const header = resolveTreeHeaderIconUrl(tree.id, tree.iconUrl || tree.icon);
  return {
    ...tree,
    icon: tree.icon || header,
    iconUrl: tree.iconUrl || header,
    nodes,
  };
}

export async function loadSkillTrees(): Promise<SkillTree[]> {
  const data = await tryJson<{ trees?: SkillTree[] }>([
    "/api/content/harvest/skill-trees.json",
    "/content/harvest/skill-trees.json",
  ]);
  const rawLocal = data?.trees?.length ? data.trees : FALLBACK_TREES;
  const local = rawLocal.map(enrichTreeIcons);
  const classTrees = (await loadClassSkillTreesFromFleet()).map(enrichTreeIcons);
  if (!classTrees.length) return local;
  // Prefer class trees first, then keep harvest/weapon content without id clash
  const seen = new Set(classTrees.map((t) => t.id));
  const rest = local.filter((t) => !seen.has(t.id));
  return [...classTrees, ...rest];
}

export async function loadOperations(): Promise<HarvestOp[]> {
  const data = await tryJson<{ operations?: HarvestOp[] }>([
    "/api/content/harvest/operations.json",
    "/content/harvest/operations.json",
  ]);
  return data?.operations?.length ? data.operations : FALLBACK_OPS;
}

export async function loadSystemsDoc(): Promise<SystemsDoc> {
  const data = await tryJson<{
    pillars?: DesignPillar[];
    controls?: DesignControl[];
    contentPaths?: string[];
  }>([
    "/api/content/harvest/systems.json",
    "/content/harvest/systems.json",
  ]);
  if (!data?.pillars?.length) return FALLBACK_SYSTEMS;
  return {
    pillars: data.pillars,
    controls: data.controls ?? FALLBACK_SYSTEMS.controls,
    contentPaths: data.contentPaths ?? FALLBACK_SYSTEMS.contentPaths,
  };
}

export interface CodexBlockRow {
  id: string;
  name: string;
  category: string;
}

export interface CodexDefRow {
  id: string;
  name: string;
  body?: string;
}

/** Mine-Loader Codex API (proxied on Open vercel.json + live host). */
export async function fetchCodexBlocks(): Promise<{
  ok: boolean;
  count: number;
  sample: CodexBlockRow[];
  categories: string[];
  source: string;
  error?: string;
}> {
  const apiDirect =
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_API as string | undefined)?.replace(/\/+$/, "")) ||
    "https://mine-loader-api-production.up.railway.app";
  const urls = [
    "/api/blocks",
    `${MINE_LOADER_LIVE.replace(/\/+$/, "")}/api/blocks`,
    `${apiDirect}/api/blocks`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = (await r.json()) as unknown;
      const list = Array.isArray(j)
        ? j
        : Array.isArray((j as { blocks?: unknown[] })?.blocks)
          ? (j as { blocks: unknown[] }).blocks
          : Array.isArray((j as { items?: unknown[] })?.items)
            ? (j as { items: unknown[] }).items
            : [];
      const sample = list.map((b) => {
        const o = b as Record<string, unknown>;
        return {
          id: String(o.id ?? o.slug ?? o.key ?? ""),
          name: String(o.name ?? o.label ?? o.id ?? "block"),
          category: String(o.category ?? o.group ?? o.role ?? "General"),
        };
      });
      const catSet = new Set(sample.map((s) => s.category || "General"));
      return {
        ok: true,
        count: list.length,
        sample,
        categories: [...catSet].sort(),
        source: u,
      };
    } catch {
      /* next */
    }
  }
  return {
    ok: false,
    count: 0,
    sample: [],
    categories: [],
    source: "none",
    error: "Codex API unreachable — open Mine-Loader or check /api/blocks proxy",
  };
}

export async function fetchCodexDefinitions(): Promise<{
  ok: boolean;
  count: number;
  sample: CodexDefRow[];
  source: string;
}> {
  const apiDirect =
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_API as string | undefined)?.replace(/\/+$/, "")) ||
    "https://mine-loader-api-production.up.railway.app";
  const urls = [
    "/api/definitions",
    `${MINE_LOADER_LIVE.replace(/\/+$/, "")}/api/definitions`,
    `${apiDirect}/api/definitions`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = (await r.json()) as unknown;
      const list = Array.isArray(j)
        ? j
        : Array.isArray((j as { definitions?: unknown[] })?.definitions)
          ? (j as { definitions: unknown[] }).definitions
          : Array.isArray((j as { categories?: unknown[] })?.categories)
            ? (j as { categories: unknown[] }).categories
            : Array.isArray((j as { entries?: unknown[] })?.entries)
              ? (j as { entries: unknown[] }).entries
              : Array.isArray((j as { items?: unknown[] })?.items)
                ? (j as { items: unknown[] }).items
                : [];
      return {
        ok: true,
        count: list.length,
        sample: list.slice(0, 48).map((d) => {
          const o = d as Record<string, unknown>;
          return {
            id: String(o.id ?? o.key ?? ""),
            name: String(o.name ?? o.title ?? o.id ?? "def"),
            body: String(o.body ?? o.summary ?? o.description ?? "").slice(0, 160),
          };
        }),
        source: u,
      };
    } catch {
      /* next */
    }
  }
  return { ok: false, count: 0, sample: [], source: "none" };
}

/** Optional Mine-Loader worlds list for Maps tab. */
export async function fetchMineLoaderWorlds(): Promise<{
  ok: boolean;
  count: number;
  sample: { id: string; name: string }[];
  source: string;
}> {
  const urls = [
    "/api/worlds",
    `${MINE_LOADER_LIVE.replace(/\/+$/, "")}/api/worlds`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = (await r.json()) as unknown;
      const list = Array.isArray(j)
        ? j
        : Array.isArray((j as { worlds?: unknown[] })?.worlds)
          ? (j as { worlds: unknown[] }).worlds
          : [];
      return {
        ok: true,
        count: list.length,
        sample: list.slice(0, 12).map((w) => {
          const o = w as Record<string, unknown>;
          return {
            id: String(o.id ?? o.code ?? o.slug ?? ""),
            name: String(o.name ?? o.title ?? o.id ?? "world"),
          };
        }),
        source: u,
      };
    } catch {
      /* next */
    }
  }
  return { ok: false, count: 0, sample: [], source: "none" };
}

/** User avatar builds from LED Mask / Avatar Edit localStorage. */
export function listUserAvatarCharacters(): CharacterImportRow[] {
  const rows: CharacterImportRow[] = [];
  try {
    const led = localStorage.getItem("ledmask:avatarConfig:v1");
    if (led) {
      const cfg = JSON.parse(led) as { race?: string };
      rows.push({
        id: "avatar-ledmask",
        name: `LED Mask · ${cfg.race ?? "human"}`,
        source: "avatar",
        raceId: cfg.race,
        blurb: "Voxel head from LED Mask design tab",
        avatarConfig: JSON.parse(led),
      });
    }
  } catch {
    /* ignore */
  }
  try {
    const builds = localStorage.getItem("avatarEdit:builds:v1");
    if (builds) {
      const o = JSON.parse(builds) as Record<string, { race?: string }>;
      for (const [race, cfg] of Object.entries(o)) {
        rows.push({
          id: `avatar-edit-${race}`,
          name: `Avatar Edit · ${race}`,
          source: "avatar",
          raceId: race,
          blurb: "Saved cube head from Avatar Edit door",
          avatarConfig: cfg,
        });
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem("avatarEdit:playerHead:v1");
    if (raw) {
      const cfg = JSON.parse(raw) as { race?: string };
      rows.push({
        id: "avatar-player-head",
        name: `Explorer head · ${cfg.race ?? "saved"}`,
        source: "avatar",
        raceId: cfg.race,
        blurb: "Currently saved head for Explorer in-game",
        avatarConfig: JSON.parse(raw),
      });
    }
  } catch {
    /* ignore */
  }
  return rows;
}

/**
 * User heroes for the 4-slot campfire scene.
 * SSOT: GameSession merge (grudox slots → local drafts → Railway warlords roster).
 * Explorers are NOT heroes — use {@link listUnitCharacters}.
 */
export function listHeroCharacters(maxSlots = 4): CharacterImportRow[] {
  const snap = gameSession.snapshot;
  const list = (snap.characters ?? []).filter(
    (c) => c?.id && !String(c.id).includes("explorer") && !String(c.id).startsWith("unit-"),
  );
  return list.slice(0, maxSlots).map((c) => ({
    id: c.id,
    name: c.name || c.id,
    source: "hero" as const,
    raceId: c.raceId,
    blurb: c.raceId
      ? `Hero · ${c.raceId}${c.classId ? ` · ${c.classId}` : ""}`
      : "Campfire hero",
  }));
}

/** @deprecated Prefer listHeroCharacters — fleet rows are heroes, not explorers. */
export function listFleetCharacters(): CharacterImportRow[] {
  return listHeroCharacters(4).map((c) => ({ ...c, source: c.source === "hero" ? "fleet" : c.source }));
}

/**
 * Units catalog for Production / RTS / Explorer play.
 * Explorer rig is a **unit** (same as faction troops), not a user hero.
 */
export function listUnitCharacters(
  factionUnits: Array<{
    id: string;
    name: string;
    type?: string;
    factionId?: string;
    factionName?: string;
    description?: string;
  }> = [],
): CharacterImportRow[] {
  const units: CharacterImportRow[] = [
    {
      id: "explorer",
      name: "Explorer",
      source: "unit",
      blurb: "Playable unit rig · cube body + avatar head · same catalog role as troops",
      unitType: "explorer",
    },
  ];
  for (const u of factionUnits) {
    units.push({
      id: u.id.startsWith("unit-") ? u.id : `unit-${u.id}`,
      name: u.name,
      source: "unit",
      blurb: u.description || `${u.factionName || u.factionId || "faction"} · ${u.type || "troop"}`,
      unitType: u.type,
      factionId: u.factionId,
    });
  }
  return units;
}

export function openMineLoaderCodex(): string {
  return buildMineLoaderUrl({
    surface: "codex",
    token: getStoredToken(),
    characterId: gameSession.snapshot.selectedCharacterId,
  });
}

export function openMineLoaderPlay(): string {
  return buildMineLoaderUrl({
    surface: "play",
    token: getStoredToken(),
    characterId: gameSession.snapshot.selectedCharacterId,
  });
}

export function openMineLoaderEditor(): string {
  return buildMineLoaderUrl({
    surface: "editor",
    token: getStoredToken(),
    characterId: gameSession.snapshot.selectedCharacterId,
  });
}

/** Bag mat counts (local stub inventory until Railway bag is bound). */
const BAG_KEY = "harvest:bag:v1";

export function loadBag(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BAG_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function saveBag(bag: Record<string, number>) {
  try {
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));
  } catch {
    /* ignore */
  }
}

export function canCraft(recipe: CraftRecipe, bag: Record<string, number>): boolean {
  return recipe.inputs.every((i) => (bag[i.id] ?? 0) >= i.qty);
}

export function craftRecipe(
  recipe: CraftRecipe,
  bag: Record<string, number>,
): { ok: boolean; bag: Record<string, number>; reason?: string } {
  if (!canCraft(recipe, bag)) return { ok: false, bag, reason: "missing materials" };
  const next = { ...bag };
  for (const i of recipe.inputs) next[i.id] = (next[i.id] ?? 0) - i.qty;
  next[recipe.output.id] = (next[recipe.output.id] ?? 0) + recipe.output.qty;
  saveBag(next);
  return { ok: true, bag: next };
}

/** Seed starter mats for first-run UX. */
export function ensureStarterBag(): Record<string, number> {
  const bag = loadBag();
  if (Object.keys(bag).length > 0) return bag;
  const seed: Record<string, number> = {
    mat_stick: 12,
    mat_coal: 6,
    mat_log: 6,
    mat_stone: 12,
    mat_raw_meat: 2,
    mat_leather: 2,
    mat_cloth: 2,
    mat_iron_ore: 4,
    mat_herb: 4,
    mat_fiber: 6,
    mat_berry: 4,
    mat_dirt: 8,
    mat_sand: 4,
    mat_clay: 2,
    mat_mushroom: 2,
    mat_resin: 1,
    mat_fish: 1,
  };
  saveBag(seed);
  return seed;
}

const UNLOCK_KEY = "harvest:skillUnlocks:v1";

/**
 * Active character unlocks (skill progress bridge) with legacy global LS fallback.
 * Prefer character systems bag via GrudgeSystemsPanel / setActiveSkillProgress.
 */
export function loadSkillUnlocks(): string[] {
  const active = getActiveUnlocked();
  if (active.length) return active;
  try {
    return JSON.parse(localStorage.getItem(UNLOCK_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Legacy free unlock (no point spend). Prefer activateNode via skill progress.
 * Still used by older call sites; merges into active character progress when set.
 */
export function unlockSkillNode(id: string): string[] {
  const cur = new Set(loadSkillUnlocks());
  cur.add(id);
  const arr = [...cur];
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  const prog = getActiveSkillProgress();
  if (prog && !prog.unlocked.includes(id)) {
    setActiveSkillProgress(getActiveSkillCharacterId(), {
      ...prog,
      unlocked: [...prog.unlocked, id],
    });
  }
  return arr;
}

export function prettyMatId(id: string): string {
  return id.replace(/^(mat_|itm_|build_|tool_|armor_)/, "").replace(/_/g, " ");
}

/** Weapon-combat tree nodes → skill slot gates (1–4 + power). */
export const WEAPON_TREE_SLOT_GATES: Record<number, string> = {
  0: "w_combo",
  1: "w_special",
  2: "w_ranged",
  3: "w_power",
};

/**
 * Whether signature skill slot index (0–3) is unlocked by the weapon-combat tree.
 * No weapon-tree progress → all slots open (first-run UX).
 * Once any `w_*` node is unlocked, require `w_basic` + the slot's node.
 */
export function isWeaponSkillSlotUnlocked(slotIndex: number, unlocks = loadSkillUnlocks()): boolean {
  const weaponNodes = unlocks.filter((u) => u.startsWith("w_"));
  if (weaponNodes.length === 0) return true;
  if (!unlocks.includes("w_basic")) return false;
  const gate = WEAPON_TREE_SLOT_GATES[slotIndex];
  if (!gate) return true;
  return unlocks.includes(gate);
}

/** CD multiplier from weapon master node + skill-tree effect stack. */
export function weaponSkillCdMul(unlocks = loadSkillUnlocks()): number {
  let m = unlocks.includes("w_master") ? 0.85 : 1;
  const fx = getActiveSkillEffects();
  if (fx?.cdMul && fx.cdMul > 0 && fx.cdMul <= 1) m *= fx.cdMul;
  return Math.max(0.5, Math.min(1, m));
}

/** Minecraft-like harvest yields into bag (local until Railway bag). */
/**
 * Map production mat_* ids → character bag resource ids (stack ≤100).
 * Character bag holds harvest until quick-deposit to account inventory.
 */
const MAT_TO_CHAR_BAG: Record<string, string> = {
  mat_log: "wood",
  mat_stick: "sticks",
  mat_stone: "stone",
  mat_coal: "coal",
  mat_iron_ore: "ore",
  mat_raw_meat: "meat",
  mat_leather: "hide",
  mat_fiber: "fiber",
  mat_clay: "clay",
  mat_dirt: "clay",
  mat_sand: "stone",
  mat_herb: "fiber",
  mat_berry: "fiber",
  mat_mushroom: "fiber",
  mat_resin: "wood",
  mat_fish: "meat",
  mat_cloth: "fiber",
};

export function applyHarvestYield(
  opId: string,
  bag: Record<string, number> = loadBag(),
  yields?: string[],
  /** Active character id — writes into 3×3 character bag as well as craft bag. */
  characterId?: string,
): Record<string, number> {
  const next = { ...(Object.keys(bag).length ? bag : loadBag()) };
  const list =
    yields && yields.length
      ? yields
      : opId === "mine"
        ? ["mat_stone", "mat_coal"]
        : opId === "chop"
          ? ["mat_log", "mat_stick"]
          : opId === "gather" || opId === "forage"
            ? ["mat_herb", "mat_berry"]
            : opId === "skin"
              ? ["mat_raw_meat", "mat_leather"]
              : opId === "dig"
                ? ["mat_dirt", "mat_clay"]
                : opId === "fish"
                  ? ["mat_fish"]
                  : opId === "farm"
                    ? ["mat_fiber", "mat_berry"]
                    : ["mat_stick"];
  const charAdds: Record<string, number> = {};
  for (const id of list) {
    const amt = 1 + (Math.random() < 0.25 ? 1 : 0);
    next[id] = (next[id] ?? 0) + amt;
    const bagId = MAT_TO_CHAR_BAG[id] || id.replace(/^mat_/, "");
    charAdds[bagId] = (charAdds[bagId] || 0) + amt;
  }
  saveBag(next);
  // Character 3×3 bag (not account vault until deposit)
  if (characterId) {
    try {
      // Dynamic to avoid circular import at module load
      void import("./inventory/store").then(({ harvestIntoBag }) => {
        for (const [id, qty] of Object.entries(charAdds)) {
          harvestIntoBag(characterId, id, qty);
        }
      });
    } catch {
      /* ignore */
    }
  }
  return next;
}
