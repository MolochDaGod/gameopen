/**
 * Minecraft-like seed worlds + portal → dungeon deployments.
 *
 * Same seed ⇒ same open-world base + same portal placements.
 * Dungeons are NOT free-roam overlays — they are reached by finding portals
 * in the overworld (triggers.kind = "portal").
 *
 * Authority for multiplayer seed worlds remains Mine-Loader (WorldSnapshot.seed).
 * Open authors deployments and playtests; promote scenes with portal triggers.
 */

import type { SceneTrigger, Vec3i, VoxelRealmsScene } from "./types";
import { VOXEL_REALMS_SCENE_VERSION } from "./types";

function emptyScene(): VoxelRealmsScene {
  return {
    version: VOXEL_REALMS_SCENE_VERSION,
    props: [],
    npcs: [],
    colliders: [],
    triggers: [],
    paths: [],
    blockEdits: [],
    spawn: null,
    map: null,
  };
}

/** Stable format id for seed deployment JSON. */
export const SEED_WORLD_FORMAT = "grudge.seed-world.v1" as const;

/**
 * Must match Mine-Loader `voxelEngine.CHUNK_SIZES` indices (0..7 only).
 * chunkIdx 8+ is invalid and collapses to undefined world size at runtime.
 */
export const CHUNK_SIZES = [16, 32, 64, 96, 128, 256, 512, 1024] as const;
export const CHUNK_IDX_MIN = 0;
export const CHUNK_IDX_MAX = CHUNK_SIZES.length - 1; // 7
/** Default playable seed world size (256 blocks) — index 5. */
export const DEFAULT_CHUNK_IDX = 5;

/** Clamp catalog / query chunkIdx into the engine table. */
export function clampChunkIdx(idx: number | undefined | null): number {
  const n = Math.trunc(Number(idx));
  if (!Number.isFinite(n)) return DEFAULT_CHUNK_IDX;
  return Math.max(CHUNK_IDX_MIN, Math.min(CHUNK_IDX_MAX, n));
}

/** World side length in blocks for a chunkIdx. */
export function chunkBlocks(chunkIdx: number | undefined | null): number {
  return CHUNK_SIZES[clampChunkIdx(chunkIdx)]!;
}

/** Hash any string (or number) into a 32-bit world seed. */
export function hashSeed(input: string | number): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input >>> 0;
  }
  const s = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — deterministic 0..1 stream from a seed. */
export function makeSeedRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x6d2b79f5), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export type SeedWorldBiome =
  | "plains"
  | "forest"
  | "mountains"
  | "desert"
  | "swamp"
  | "tundra"
  | "coast"
  | "mixed";

export type DungeonDifficulty = "easy" | "normal" | "hard" | "elite";

/**
 * Destination when a player enters a portal found in the open-world seed.
 * Engine loads a dungeon map (Mine-Loader genDungeon / dungeon-spec) from this.
 */
export interface PortalDungeonTarget {
  kind: "dungeon";
  /** Stable id for this dungeon instance within the deployment. */
  dungeonId: string;
  name: string;
  /** Derived dungeon seed (default: mix(worldSeed, portalId)). */
  seed: number;
  /** Optional pre-made template id (Mine-Loader reference / Open MAP_TEMPLATES). */
  templateId?: string;
  /** Optional theme prompt for AI dungeon gen. */
  theme?: string;
  difficulty?: DungeonDifficulty;
  /** When true, dungeon exit returns near the overworld portal. */
  returnToPortal?: boolean;
}

/**
 * A discoverable portal in the open world.
 * Placed as a scene trigger (kind: "portal") + optional beacon blocks.
 */
export interface SeedPortal {
  id: string;
  name: string;
  /** World-space position (integer cells). */
  position: Vec3i;
  /** Visual / lore blurb for UI. */
  blurb?: string;
  dungeon: PortalDungeonTarget;
  /** Radius for auto-enter (blocks). Default 1.5. */
  radius?: number;
}

export interface SeedWorldMeta {
  id: string;
  name: string;
  blurb: string;
  /** Display seed (string ok — hashed for gen). */
  seed: string | number;
  /** Numeric seed used by generators / WorldSnapshot. */
  seedNumber: number;
  chunkIdx: number;
  biome: SeedWorldBiome;
  /** Mine-Loader world room id if deployed (e.g. "main" or private id). */
  worldId?: string;
  /** Featured in library / production Maps tab. */
  featured?: boolean;
  /** Deploy surface. */
  deploy: "mine-loader" | "open-playtest" | "both";
}

/**
 * Full seed-world deployment: open world identity + portals into dungeons.
 * Same seed ⇒ same portal coordinates and dungeon seeds.
 */
export interface SeedWorldDeployment {
  format: typeof SEED_WORLD_FORMAT;
  version: 1;
  world: SeedWorldMeta;
  portals: SeedPortal[];
  /** Optional authored scene overlay (props, spawn) merged at deploy. */
  sceneOverlay?: Partial<VoxelRealmsScene> | null;
}

export interface SeedPortalPlan {
  portalCount: number;
  /** Half-extent of portal scatter ring in blocks (XZ). */
  radiusMin: number;
  radiusMax: number;
  /** Portal Y (surface-ish). */
  surfaceY: number;
  themes?: string[];
}

const DEFAULT_PLAN: SeedPortalPlan = {
  portalCount: 4,
  radiusMin: 24,
  radiusMax: 96,
  surfaceY: 2,
  themes: ["ruins", "crypt", "mine", "temple"],
};

/**
 * Deterministically place portals around spawn (0, surfaceY, 0) from world seed.
 */
export function placePortalsFromSeed(
  worldSeed: number,
  plan: Partial<SeedPortalPlan> = {},
  worldId = "seed-world",
): SeedPortal[] {
  const p = { ...DEFAULT_PLAN, ...plan };
  const rng = makeSeedRng(mixSeed(worldSeed, 0x70f7a1));
  const themes = p.themes?.length ? p.themes : DEFAULT_PLAN.themes!;
  const portals: SeedPortal[] = [];

  for (let i = 0; i < p.portalCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = p.radiusMin + rng() * (p.radiusMax - p.radiusMin);
    const x = Math.round(Math.cos(angle) * dist);
    const z = Math.round(Math.sin(angle) * dist);
    const y = p.surfaceY;
    const theme = themes[i % themes.length]!;
    const portalId = `portal_${worldId}_${i}_${theme}`;
    const dungeonSeed = mixSeed(worldSeed, hashSeed(portalId));
    const dungeonId = `dungeon_${worldId}_${i}_${theme}`;

    portals.push({
      id: portalId,
      name: `${capitalize(theme)} portal`,
      position: { x, y, z },
      blurb: `Enter the ${theme} dungeon · seed ${dungeonSeed}`,
      radius: 1.5,
      dungeon: {
        kind: "dungeon",
        dungeonId,
        name: `${capitalize(theme)} depths`,
        seed: dungeonSeed,
        templateId: themeToTemplate(theme),
        theme,
        difficulty: difficultyFromIndex(i),
        returnToPortal: true,
      },
    });
  }

  return portals;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function themeToTemplate(theme: string): string {
  switch (theme) {
    case "crypt":
      return "arena3";
    case "mine":
      return "challenge1";
    case "temple":
      return "arena2";
    case "ruins":
    default:
      return "arena1";
  }
}

function difficultyFromIndex(i: number): DungeonDifficulty {
  if (i === 0) return "easy";
  if (i === 1) return "normal";
  if (i === 2) return "hard";
  return "elite";
}

/** Build a SeedWorldDeployment from human-friendly fields. */
export function buildSeedDeployment(opts: {
  id: string;
  name: string;
  blurb?: string;
  seed: string | number;
  chunkIdx?: number;
  biome?: SeedWorldBiome;
  portalPlan?: Partial<SeedPortalPlan>;
  deploy?: SeedWorldMeta["deploy"];
  worldId?: string;
  featured?: boolean;
  /** Fixed portals override auto-placement (still dungeon seeds mix from world). */
  portals?: SeedPortal[];
  sceneOverlay?: Partial<VoxelRealmsScene> | null;
}): SeedWorldDeployment {
  const seedNumber = hashSeed(opts.seed);
  const chunkIdx = clampChunkIdx(opts.chunkIdx ?? DEFAULT_CHUNK_IDX);
  const portals =
    opts.portals?.length ?
      opts.portals.map((portal) => ({
        ...portal,
        dungeon: {
          ...portal.dungeon,
          seed: portal.dungeon.seed || mixSeed(seedNumber, hashSeed(portal.id)),
        },
      }))
    : placePortalsFromSeed(seedNumber, opts.portalPlan, opts.id);

  return {
    format: SEED_WORLD_FORMAT,
    version: 1,
    world: {
      id: opts.id,
      name: opts.name,
      blurb: opts.blurb ?? `Seed world · ${opts.seed}`,
      seed: opts.seed,
      seedNumber,
      chunkIdx,
      biome: opts.biome ?? "mixed",
      worldId: opts.worldId,
      featured: opts.featured,
      deploy: opts.deploy ?? "both",
    },
    portals,
    sceneOverlay: opts.sceneOverlay ?? null,
  };
}

/** Scene triggers for portal discovery (Mine-Loader / Open interchange). */
export function portalsToTriggers(portals: SeedPortal[]): SceneTrigger[] {
  return portals.map((p) => ({
    id: p.id,
    kind: "portal",
    x: p.position.x,
    y: p.position.y,
    z: p.position.z,
    name: p.name,
    radius: p.radius ?? 1.5,
    target: {
      type: "dungeon",
      dungeonId: p.dungeon.dungeonId,
      seed: p.dungeon.seed,
      templateId: p.dungeon.templateId,
      theme: p.dungeon.theme,
      difficulty: p.dungeon.difficulty,
      returnToPortal: p.dungeon.returnToPortal !== false,
      returnPosition: { ...p.position, y: p.position.y + 1 },
    },
  }));
}

/**
 * Build a Realms scene for deploy: spawn + portal triggers + optional overlay.
 * Terrain itself is regenerated from seed + chunkIdx on the world authority.
 */
export function deploymentToScene(dep: SeedWorldDeployment): VoxelRealmsScene {
  const base = emptyScene();
  const overlay = dep.sceneOverlay ?? {};
  const triggers = [
    ...portalsToTriggers(dep.portals),
    ...(Array.isArray(overlay.triggers) ? overlay.triggers : []),
  ];

  // Marker blocks under each portal so explorers see a beacon.
  const portalBlocks = dep.portals.flatMap((p) => [
    { x: p.position.x, y: p.position.y, z: p.position.z, type: "diamond" as const },
    { x: p.position.x, y: p.position.y + 1, z: p.position.z, type: "exclamation" as const },
  ]);

  return {
    version: base.version,
    props: Array.isArray(overlay.props) ? overlay.props : [],
    npcs: Array.isArray(overlay.npcs) ? overlay.npcs : [],
    colliders: Array.isArray(overlay.colliders) ? overlay.colliders : [],
    triggers,
    paths: Array.isArray(overlay.paths) ? overlay.paths : [],
    blockEdits: [
      ...(Array.isArray(overlay.blockEdits) ? overlay.blockEdits : []),
      ...portalBlocks,
    ],
    spawn: overlay.spawn ?? { x: 0, y: 2, z: 0 },
    map: {
      kind: "seed-overworld",
      seed: dep.world.seedNumber,
      chunkIdx: dep.world.chunkIdx,
      biome: dep.world.biome,
      portals: dep.portals.map((p) => ({
        id: p.id,
        dungeonId: p.dungeon.dungeonId,
        dungeonSeed: p.dungeon.seed,
      })),
    },
  };
}

/** Payload for Mine-Loader share / private world create (opaque data blob). */
export function deploymentToSharePayload(dep: SeedWorldDeployment): {
  name: string;
  data: {
    format: typeof SEED_WORLD_FORMAT;
    seed: number;
    chunkIdx: number;
    biome: SeedWorldBiome;
    scene: VoxelRealmsScene;
    portals: SeedPortal[];
    deploymentId: string;
  };
} {
  return {
    name: dep.world.name,
    data: {
      format: SEED_WORLD_FORMAT,
      seed: dep.world.seedNumber,
      chunkIdx: dep.world.chunkIdx,
      biome: dep.world.biome,
      scene: deploymentToScene(dep),
      portals: dep.portals,
      deploymentId: dep.world.id,
    },
  };
}

/** Parse / normalize unknown JSON into a deployment when possible. */
export function normalizeSeedDeployment(raw: unknown): SeedWorldDeployment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const world = o.world as Record<string, unknown> | undefined;
  if (!world || typeof world.id !== "string" || typeof world.name !== "string") {
    // Flat shape: { id, name, seed, portals? }
    if (typeof o.id === "string" && typeof o.name === "string" && o.seed != null) {
      return buildSeedDeployment({
        id: o.id,
        name: o.name,
        blurb: typeof o.blurb === "string" ? o.blurb : undefined,
        seed: o.seed as string | number,
        chunkIdx: typeof o.chunkIdx === "number" ? o.chunkIdx : undefined,
        biome: o.biome as SeedWorldBiome | undefined,
        featured: !!o.featured,
        portals: Array.isArray(o.portals) ? (o.portals as SeedPortal[]) : undefined,
      });
    }
    return null;
  }

  const seed = (world.seed as string | number) ?? world.seedNumber ?? 0;
  const seedNumber =
    typeof world.seedNumber === "number" ? world.seedNumber : hashSeed(seed);

  return {
    format: SEED_WORLD_FORMAT,
    version: 1,
    world: {
      id: world.id,
      name: world.name,
      blurb: String(world.blurb ?? ""),
      seed,
      seedNumber,
      chunkIdx: typeof world.chunkIdx === "number" ? world.chunkIdx : 7,
      biome: (world.biome as SeedWorldBiome) || "mixed",
      worldId: typeof world.worldId === "string" ? world.worldId : undefined,
      featured: !!world.featured,
      deploy: (world.deploy as SeedWorldMeta["deploy"]) || "both",
    },
    portals: Array.isArray(o.portals) ? (o.portals as SeedPortal[]) : [],
    sceneOverlay: (o.sceneOverlay as Partial<VoxelRealmsScene>) ?? null,
  };
}
