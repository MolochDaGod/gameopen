/**
 * Harvest production catalog — recipes, skill trees, ops, maps, codex API, systems design.
 * Used by HarvestProductionUI (Danger Room harvest/build mode).
 */
import { MINE_LOADER_LIVE, buildMineLoaderUrl } from "../auth/mineLoaderConfig";
import { getStoredToken } from "../lib/grudgeAuth";
import { MAP_TEMPLATES } from "../three/voxel/templates";
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
  { id: "characters", label: "Characters", blurb: "Explorer & user avatars", glyph: "👤" },
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

export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  tier: number;
  requires: string[];
  cost: number;
}
export interface SkillTree {
  id: string;
  name: string;
  color: string;
  nodes: SkillNode[];
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
  kind: "arena" | "dungeon" | "scene" | "island" | "voxel";
  blurb: string;
}

export interface CharacterImportRow {
  id: string;
  name: string;
  source: "fleet" | "avatar" | "explorer";
  raceId?: string;
  blurb: string;
  avatarConfig?: unknown;
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
  },
];

/** Voxel editor templates + static maps for the Maps tab. */
export function listMapLibrary(): MapAsset[] {
  const voxels: MapAsset[] = MAP_TEMPLATES.map((t) => ({
    id: `voxel-${t.id}`,
    name: t.label,
    path: `voxel/templates:${t.id}`,
    kind: "voxel" as const,
    blurb: t.desc,
  }));
  return [...voxels, ...MAP_LIBRARY];
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

export async function loadSkillTrees(): Promise<SkillTree[]> {
  const data = await tryJson<{ trees?: SkillTree[] }>([
    "/api/content/harvest/skill-trees.json",
    "/content/harvest/skill-trees.json",
  ]);
  return data?.trees?.length ? data.trees : FALLBACK_TREES;
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

/** Fleet / explorer characters from GameSession. */
export function listFleetCharacters(): CharacterImportRow[] {
  const snap = gameSession.snapshot;
  const list = snap.characters ?? [];
  return list.map((c) => ({
    id: c.id,
    name: c.name || c.id,
    source: c.id.includes("explorer") ? "explorer" : "fleet",
    raceId: c.raceId,
    blurb: c.raceId ? `Race ${c.raceId}` : "Fleet character",
  }));
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

export function loadSkillUnlocks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(UNLOCK_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function unlockSkillNode(id: string): string[] {
  const cur = new Set(loadSkillUnlocks());
  cur.add(id);
  const arr = [...cur];
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
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

/** CD multiplier from weapon master node. */
export function weaponSkillCdMul(unlocks = loadSkillUnlocks()): number {
  return unlocks.includes("w_master") ? 0.85 : 1;
}

/** Minecraft-like harvest yields into bag (local until Railway bag). */
export function applyHarvestYield(
  opId: string,
  bag: Record<string, number> = loadBag(),
  yields?: string[],
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
  for (const id of list) {
    next[id] = (next[id] ?? 0) + 1 + (Math.random() < 0.25 ? 1 : 0);
  }
  saveBag(next);
  return next;
}
