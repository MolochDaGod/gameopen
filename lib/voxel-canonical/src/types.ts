/**
 * Voxel Realms / Mine Loader — canonical voxel schema.
 *
 * SSOT live catalog: https://mine-loader.replit.app/api/blocks
 * Codex UI:          https://mine-loader.replit.app/#/defs
 *
 * All GRUDOX cabinets, voxel editors (gameopen `/voxel`, `/world`), and voxel
 * games should speak this format so maps, block edits, and the RPG catalog
 * round-trip across surfaces.
 */

/** Scene document version used by Voxel Realms (`function Pl()` in mine-loader). */
export const VOXEL_REALMS_SCENE_VERSION = 1 as const;

/** Open-editor map version (gameopen VoxelMap). Bumped when `type` became required on write. */
export const OPEN_VOXEL_MAP_VERSION = 2 as const;

/** Terrain / placeable ids used by the Voxel Realms editor palette + world gen. */
export type TerrainBlockId =
  | "grass"
  | "dirt"
  | "stone"
  | "sand"
  | "snow"
  | "log"
  | "woodPlanks"
  | "leaves"
  | "brickRed"
  | "brickGrey"
  | "brickDark"
  | "brickYellow"
  | "ice"
  | "diamond"
  | "coal"
  | "question"
  | "exclamation"
  | "blockSquare"
  | "blockBlank"
  /** World-gen only (not always in the place palette). */
  | "deep"
  | "water"
  | "lava"
  | "pinelog";

/**
 * Catalog blocks from `/api/blocks` use the `cat:` prefix in cell storage
 * (mine-loader `getTexKey`: `e.startsWith("cat:")`).
 */
export type CatalogBlockId = `cat:${string}`;

/** Any block type string the runtime may store in a cell. */
export type BlockTypeId = TerrainBlockId | CatalogBlockId | (string & {});

/** One voxel edit in a Voxel Realms scene (`blockEdits[]`). */
export interface BlockEdit {
  x: number;
  y: number;
  z: number;
  /** Block type id, or `null` to clear the cell. */
  type: BlockTypeId | null;
}

export interface Vec3i {
  x: number;
  y: number;
  z: number;
}

export interface SceneProp {
  id?: string;
  kind?: string;
  model?: string;
  x: number;
  y: number;
  z: number;
  rotation?: number;
  [key: string]: unknown;
}

export interface SceneNpc {
  id?: string;
  model?: string;
  x: number;
  y: number;
  z: number;
  rotation?: number;
  [key: string]: unknown;
}

export interface SceneCollider {
  id?: string;
  x: number;
  y: number;
  z: number;
  [key: string]: unknown;
}

export interface SceneTrigger {
  id?: string;
  kind?: string;
  x: number;
  y: number;
  z: number;
  [key: string]: unknown;
}

export interface ScenePath {
  id?: string;
  points?: Vec3i[];
  [key: string]: unknown;
}

/**
 * Voxel Realms authored scene (`Pl()` / `xo()` in mine-loader).
 * This is the interchange format for editors ↔ play clients ↔ zone servers.
 */
export interface VoxelRealmsScene {
  version: typeof VOXEL_REALMS_SCENE_VERSION | number;
  props: SceneProp[];
  npcs: SceneNpc[];
  colliders: SceneCollider[];
  triggers: SceneTrigger[];
  paths: ScenePath[];
  blockEdits: BlockEdit[];
  spawn: Vec3i | null;
  /** Arena / dungeon generator config (opaque passthrough). */
  map: unknown | null;
}

/** Lightweight place-palette entry (matches mine-loader `dV`). */
export interface TerrainPaletteEntry {
  id: TerrainBlockId;
  name: string;
  emoji: string;
  /** Solid color fallback for editors without the block atlas. */
  color: number;
  /** CSS hex for UI swatches. */
  css: string;
  /** Whether the Voxel Realms place brush exposes this id. */
  placeable: boolean;
  solid: boolean;
}

/** One entry from `GET /api/blocks` (Codex / defs). */
export interface CatalogBlock {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  job: string;
  imageKey: string;
  imageUrl: string;
  stats: {
    hardness: number;
    blastResistance: number;
    luminance: number;
    toolTier: string;
    stackSize: number;
    mass: number;
    flammable: boolean;
  };
  resources: {
    drops: Array<{ item: string; min: number; max: number; chance: number }>;
    smeltsTo: string | null;
    usedFor: string[];
  };
  rpg: {
    rarity: string;
    value: number;
    role: string;
    xp: number;
  };
  mission: {
    objective: string;
    questHook: string;
    target: number;
  };
  editor: {
    placeable: boolean;
    solid: boolean;
    collision: boolean;
    group: string;
    rotatable: boolean;
  };
  multiplayer: {
    synced: boolean;
    authority: string;
    interactable: boolean;
    shared: boolean;
  };
  ui: {
    icon: string;
    tint: string;
    category: string;
  };
  customCode: {
    hook: string;
    handler: string;
    note: string;
  };
  tags: string[];
}

export interface CatalogResponse {
  blocks: CatalogBlock[];
  total: number;
  categories: string[];
  roles: string[];
  rarities: string[];
}

/**
 * Gameopen / Danger Room open-editor map (extended with optional `type`).
 * Prefer writing `type` so exports to Voxel Realms stay lossless.
 */
export interface OpenVoxelBlock {
  x: number;
  y: number;
  z: number;
  shape: "block" | "slab" | "wall" | "pillar" | "ramp";
  color: number;
  rotation: number;
  /** Canonical block type — required on new writes (v2+). */
  type?: BlockTypeId;
}

export interface OpenVoxelDeployable {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  weapon?: string;
  difficulty?: string;
  prop?: string;
  px?: number;
  py?: number;
  pz?: number;
  yaw?: number;
  scale?: number;
}

export interface OpenVoxelMap {
  version: number;
  dungeon: boolean;
  blocks: OpenVoxelBlock[];
  deployables: OpenVoxelDeployable[];
}
