import type {
  BlockData,
  DeployableData,
  Difficulty,
  PieceShape,
  VoxelMap,
} from "./types";
import { VOXEL_MAP_VERSION, colorForBlockType } from "./types";
import type { WeaponId } from "../types";
import type { BlockTypeId } from "@workspace/voxel-canonical";
import { buildBiomeRoadBlocks } from "./roadPack";

/**
 * Code-defined starting-map templates for the Voxel Editor (`/voxel`).
 * Includes premade Danger Room–style layouts for combat playtest.
 *
 * Promote path (production worlds / lobby):
 *   export interchange → Mine-Loader scene API
 *   SSOT: https://github.com/MolochDaGod/mine-loader
 *   Contract: docs/MINE_LOADER_SSOT.md · docs/VOXEL_CANONICAL.md
 *
 * Physics playtest on Open uses Rapier (PhysicsSystem + VoxelArena) with
 * productionRuntime constants (capsule, gravity, fixed 60 Hz).
 *
 * Each template ALWAYS includes a player start so "Test" works immediately.
 * Block types: `@workspace/voxel-canonical` (not free hex alone).
 */

/** Palette mapped to terrain block types (editor + Realms). */
const C = {
  blue: colorForBlockType("ice"),
  green: colorForBlockType("grass"),
  orange: colorForBlockType("sand"),
  red: colorForBlockType("brickRed"),
  purple: colorForBlockType("diamond"),
  canvas: colorForBlockType("blockBlank"),
  grey: colorForBlockType("stone"),
  dark: colorForBlockType("brickDark"),
} as const;

const COLOR_TO_TYPE: Record<number, BlockTypeId> = {
  [C.blue]: "ice",
  [C.green]: "grass",
  [C.orange]: "sand",
  [C.red]: "brickRed",
  [C.purple]: "diamond",
  [C.canvas]: "blockBlank",
  [C.grey]: "stone",
  [C.dark]: "brickDark",
};

/** Small fluent builder so each template reads like a level recipe. */
class MapBuilder {
  private blocks: BlockData[] = [];
  private deployables: DeployableData[] = [];
  private n = 0;
  dungeon = false;

  /** Place a single piece at integer cell (x,y,z). */
  block(
    x: number,
    y: number,
    z: number,
    color: number,
    shape: PieceShape = "block",
    rotation = 0,
  ): this {
    const type = COLOR_TO_TYPE[color] ?? "stone";
    this.blocks.push({ x, y, z, shape, color, rotation, type });
    return this;
  }

  /** Fill a solid rectangle of pieces on the X/Z plane at height `y`. */
  fill(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    color: number,
    shape: PieceShape = "block",
  ): this {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) this.block(x, y, z, color, shape);
    return this;
  }

  /** Hollow rectangular border (one piece thick) at height `y`. */
  border(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    color: number,
    shape: PieceShape = "block",
  ): this {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x++) {
      this.block(x, y, az, color, shape);
      this.block(x, y, bz, color, shape);
    }
    for (let z = az + 1; z < bz; z++) {
      this.block(ax, y, z, color, shape);
      this.block(bx, y, z, color, shape);
    }
    return this;
  }

  /** A vertical column of pieces from y0..y1 at (x,z). */
  column(x: number, z: number, y0: number, y1: number, color: number): this {
    for (let y = y0; y <= y1; y++) this.block(x, y, z, color);
    return this;
  }

  /** The (single) player start. `y` is the cell it stands on. */
  start(x: number, z: number, y = 0): this {
    this.deployables.push({ id: `t${this.n++}`, kind: "start", x, y, z, rotation: 0 });
    return this;
  }

  /** An armed NPC opponent. */
  npc(x: number, z: number, weapon: WeaponId, difficulty: Difficulty = "normal", y = 0): this {
    this.deployables.push({
      id: `t${this.n++}`,
      kind: "npc",
      x,
      y,
      z,
      rotation: 0,
      weapon,
      difficulty,
    });
    return this;
  }

  /** A static training bag. */
  bag(x: number, z: number, physics = false, y = 0): this {
    this.deployables.push({
      id: `t${this.n++}`,
      kind: physics ? "physicsBag" : "heavyBag",
      x,
      y,
      z,
      rotation: 0,
    });
    return this;
  }

  build(): VoxelMap {
    return {
      version: VOXEL_MAP_VERSION,
      dungeon: this.dungeon,
      blocks: this.blocks,
      deployables: this.deployables,
    };
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

/** A square canvas with corner posts and a rope-line border — a boxing ring. */
function boxingRing(): VoxelMap {
  const b = new MapBuilder();
  const r = 6; // half-width of the canvas
  b.fill(-r, -r, r, r, 0, C.canvas); // the mat
  b.border(-r, -r, r, r, 1, C.red); // rope line
  // Corner posts (3 high).
  for (const [x, z] of [
    [-r, -r],
    [r, -r],
    [-r, r],
    [r, r],
  ] as [number, number][]) {
    b.column(x, z, 1, 3, C.dark);
  }
  b.start(-3, 2);
  b.npc(3, -2, "none", "normal");
  return b.build();
}

/** A compact walled arena with a little cover and two foes. */
function arena1(): VoxelMap {
  const b = new MapBuilder();
  const r = 9;
  b.fill(-r, -r, r, r, 0, C.grey); // arena floor
  b.border(-r, -r, r, r, 1, C.dark); // low wall
  b.border(-r, -r, r, r, 2, C.dark);
  // A few scattered cover blocks.
  b.block(-3, 0, 3, C.blue).block(-3, 1, 3, C.blue);
  b.block(4, 0, -2, C.blue).block(4, 1, -2, C.blue);
  b.start(-6, -6);
  b.npc(5, 5, "sword", "normal");
  b.npc(-5, 5, "spear", "normal");
  return b.build();
}

/** A larger arena with center pillars and raised firing platforms. */
function arena2(): VoxelMap {
  const b = new MapBuilder();
  const r = 11;
  b.fill(-r, -r, r, r, 0, C.grey);
  b.border(-r, -r, r, r, 1, C.dark);
  b.border(-r, -r, r, r, 2, C.dark);
  // Four center pillars.
  for (const [x, z] of [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ] as [number, number][]) {
    b.column(x, z, 0, 3, C.purple);
  }
  // Raised corner platforms with ramps up.
  b.fill(-r, -r, -r + 3, -r + 3, 1, C.orange);
  b.block(-r + 4, 0, -r + 1, C.orange, "ramp", 1);
  b.fill(r - 3, r - 3, r, r, 1, C.orange);
  b.block(r - 4, 0, r - 1, C.orange, "ramp", 3);
  b.start(0, -8);
  b.npc(8, 8, "greatsword", "hard");
  b.npc(-8, 6, "bow", "normal");
  b.npc(6, -8, "axe", "normal");
  return b.build();
}

/** A big multi-level arena (custom dungeon) with elite opposition. */
function arena3(): VoxelMap {
  const b = new MapBuilder();
  b.dungeon = true;
  const r = 13;
  b.fill(-r, -r, r, r, 0, C.dark);
  b.border(-r, -r, r, r, 1, C.grey);
  b.border(-r, -r, r, r, 2, C.grey);
  b.border(-r, -r, r, r, 3, C.grey);
  // Central raised dais with a ramp.
  b.fill(-4, -4, 4, 4, 1, C.red);
  b.fill(-3, -3, 3, 3, 2, C.red);
  b.block(0, 0, 6, C.orange, "ramp", 0);
  b.block(0, 1, 5, C.orange, "ramp", 0);
  // Perimeter cover columns.
  for (const [x, z] of [
    [-9, 0],
    [9, 0],
    [0, -9],
    [0, 9],
  ] as [number, number][]) {
    b.column(x, z, 0, 2, C.purple);
  }
  b.start(0, -11);
  b.npc(0, 0, "greataxe", "elite", 3);
  b.npc(-9, 9, "sword", "hard");
  b.npc(9, 9, "spear", "hard");
  b.npc(9, -9, "bow", "normal");
  b.npc(-9, -9, "staff", "normal");
  return b.build();
}

/** A linear parkour run of platforms, gaps and ramps. */
function challenge1(): VoxelMap {
  const b = new MapBuilder();
  // Start pad.
  b.fill(-2, -10, 2, -8, 0, C.green);
  // Stepping platforms climbing toward the goal.
  b.fill(-1, -6, 1, -5, 1, C.blue);
  b.fill(-1, -3, 1, -2, 2, C.blue);
  b.fill(-1, 0, 1, 1, 3, C.blue);
  b.fill(-1, 3, 1, 4, 2, C.blue);
  b.fill(-1, 6, 1, 7, 1, C.blue);
  // Goal pad with a beacon column.
  b.fill(-2, 9, 2, 11, 0, C.orange);
  b.column(0, 10, 1, 4, C.red);
  b.start(0, -9);
  return b.build();
}

/** A harder course: narrow beams, higher jumps and switchbacks. */
function challenge2(): VoxelMap {
  const b = new MapBuilder();
  // Start pad.
  b.fill(-2, -11, 2, -9, 0, C.green);
  // Narrow beam (one cell wide).
  for (let z = -7; z <= -2; z++) b.block(0, 1, z, C.blue);
  // Switchback platforms at rising heights.
  b.fill(-6, 0, -3, 1, 2, C.purple);
  b.fill(3, 3, 6, 4, 3, C.purple);
  b.fill(-6, 6, -3, 7, 4, C.purple);
  // Ramp bridge to the goal.
  b.block(-2, 4, 8, C.orange, "ramp", 2);
  b.block(-1, 3, 8, C.orange, "ramp", 2);
  b.fill(-2, 9, 2, 11, 0, C.orange);
  b.column(0, 10, 1, 5, C.red);
  b.start(0, -10);
  return b.build();
}

/** Static metadata for a selectable starting-map template. */
export interface MapTemplate {
  id: string;
  label: string;
  desc: string;
  build: () => VoxelMap;
}

/** Road pack → spokes/rings/biome wedges for /world lab (see roadPack.ts). */
function biomeRoadLab(): VoxelMap {
  const blocks = buildBiomeRoadBlocks({ half: 18 });
  return {
    version: VOXEL_MAP_VERSION,
    dungeon: false,
    blocks,
    deployables: [
      {
        id: "start",
        kind: "start",
        x: 0,
        y: 0,
        z: -16,
        rotation: 0,
      },
    ],
  };
}

/** Selectable templates, in picker order. */
export const MAP_TEMPLATES: MapTemplate[] = [
  {
    id: "biomeRoadLab",
    label: "Biome Roads Lab",
    desc: "Road pack breakdown — spokes, rings, biome wedges, tree accents",
    build: biomeRoadLab,
  },
  { id: "boxingRing", label: "Boxing Ring", desc: "Roped canvas + corner posts, 1-on-1", build: boxingRing },
  { id: "arena1", label: "Arena 1", desc: "Walled pit with light cover · 2 foes", build: arena1 },
  { id: "arena2", label: "Arena 2", desc: "Pillars + raised platforms · 3 foes", build: arena2 },
  { id: "arena3", label: "Arena 3", desc: "Multi-level dungeon · elite boss", build: arena3 },
  { id: "challenge1", label: "Challenge Course 1", desc: "Parkour platforms to the goal", build: challenge1 },
  { id: "challenge2", label: "Challenge Course 2", desc: "Narrow beams + switchbacks", build: challenge2 },
];
