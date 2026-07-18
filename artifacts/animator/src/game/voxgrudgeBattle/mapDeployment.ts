/**
 * VoxGrudge Battle map deployment catalog.
 * Authority for listing = Open content + Mine-Loader-style deployment rows.
 * Full Hunger Games GLB is ~752 MB — load from R2/CDN path or local models cache, never commit.
 */

import type { BiomeKitId } from "./types";

export interface BattleMapAsset {
  id: string;
  label: string;
  role: "primary_arena" | "biome_kit" | "prop" | "animal" | "projectile";
  /** Relative public path once uploaded */
  publicPath: string;
  /** Authoring absolute path on studio machine */
  sourcePath?: string;
  bytesHint?: number;
  notes?: string;
}

export interface BattleMapDeployment {
  id: string;
  name: string;
  blurb: string;
  mode: "singles" | "duos" | "both";
  featured: boolean;
  mapId: string;
  primaryArena: string;
  biomeKits: BiomeKitId[];
  maxPlayers: number;
  deploy: "open" | "mine-loader" | "both";
  spawnRing: { radius: number; y: number };
  shrink: { startSec: number; endRadius: number };
  animals: string[];
  tags: string[];
}

/** Asset registry for battle maps + wildlife (fleet paths). */
export const BATTLE_ASSETS: readonly BattleMapAsset[] = [
  {
    id: "hunger-games-arena",
    label: "The Hunger Games Arena",
    role: "primary_arena",
    publicPath: "models/battle/the_hunger_games_arena.glb",
    sourcePath: "D:/Games/Models/the_hunger_games_arena.glb",
    bytesHint: 752_137_760,
    notes: "Primary BR map. Prefer Draco/meshopt CDN build for web.",
  },
  {
    id: "practice-15-arenas",
    label: "Practice 15 Arenas biome kit",
    role: "biome_kit",
    publicPath: "models/battle/practice_15_arenas.glb",
    sourcePath: "D:/Games/Models/practice__15_arenas.glb",
    bytesHint: 55_572_132,
    notes: "Terrains, walls, trees, buildings, faction/enemy walls, boats.",
  },
  {
    id: "animal-wolf",
    label: "Wolf (Blockbench)",
    role: "animal",
    publicPath: "models/battle/animals/wolf.glb",
    sourcePath: "D:/Games/Models/animated_evilwolf__blockbench.glb",
    notes: "Voxel/Blockbench only — no COTW animals in voxel games.",
  },
  {
    id: "animal-bear",
    label: "Bear (Blockbench)",
    role: "animal",
    publicPath: "models/battle/animals/bear.glb",
    sourcePath: "D:/Games/Models/polarbear_blockbench.glb",
    notes: "Voxel/Blockbench only.",
  },
  {
    id: "animal-deer",
    label: "Deer (Blockbench)",
    role: "animal",
    publicPath: "models/battle/animals/deer.glb",
    sourcePath: "D:/Games/Models/animated_deer__blockbench.glb",
  },
  {
    id: "animal-buffalo",
    label: "Buffalo (Minecraft voxel)",
    role: "animal",
    publicPath: "models/battle/animals/buffalo.glb",
    sourcePath: "D:/Games/Models/buffalo_minecraft.glb",
    notes: "Voxel only. Alt Kenney: animal-bison.glb — never COTW.",
  },
  {
    id: "animal-pack-minecraft",
    label: "Minecraft Animals (Blockbench pack)",
    role: "animal",
    publicPath: "models/battle/animals/minecraft-animals.glb",
    sourcePath: "D:/Games/Models/minecraft_animals__blockbench.glb",
  },
  {
    id: "projectile-bolt",
    label: "Skill bolt",
    role: "projectile",
    publicPath: "models/vfx/skill-bolt.glb",
    notes: "Falls back to procedural sphere if missing.",
  },
] as const;

export const VOXGRUDGE_BATTLE_DEPLOYMENTS: readonly BattleMapDeployment[] = [
  {
    id: "voxgrudge-battle-hunger-singles",
    name: "VoxGrudge Battle — Singles",
    blurb:
      "Hunger Games Arena · last fighter standing · 16 max · bots fill · Danger Room weapon skills + sidearm.",
    mode: "singles",
    featured: true,
    mapId: "hunger-games-arena",
    primaryArena: "models/battle/the_hunger_games_arena.glb",
    biomeKits: ["hunger-center", "forest-pocket", "ruins-plaza", "river-bend"],
    maxPlayers: 16,
    deploy: "both",
    spawnRing: { radius: 48, y: 0.1 },
    shrink: { startSec: 90, endRadius: 12 },
    animals: ["gator", "fox", "wolf", "buffalo", "bear"],
    tags: ["VoxGrudge Battle", "BR", "Singles", "Bots", "Map:Hunger"],
  },
  {
    id: "voxgrudge-battle-hunger-duos",
    name: "VoxGrudge Battle — Duos",
    blurb:
      "Same arena · teams of 2 · play until one team remains · shared revive window + ally AI.",
    mode: "duos",
    featured: true,
    mapId: "hunger-games-arena",
    primaryArena: "models/battle/the_hunger_games_arena.glb",
    biomeKits: ["hunger-center", "faction-fort", "enemy-wall", "coast-docks"],
    maxPlayers: 16,
    deploy: "both",
    spawnRing: { radius: 48, y: 0.1 },
    shrink: { startSec: 100, endRadius: 14 },
    animals: ["gator", "wolf", "bear"],
    tags: ["VoxGrudge Battle", "BR", "Duos", "Bots", "Map:Hunger"],
  },
  {
    id: "voxgrudge-battle-practice-biomes",
    name: "VoxGrudge Battle — Practice Biomes",
    blurb:
      "Practice 15 Arenas kit — trees, walls, boats, faction buildings. Smaller ring for loadout drills.",
    mode: "both",
    featured: false,
    mapId: "practice-15-arenas",
    primaryArena: "models/battle/practice_15_arenas.glb",
    biomeKits: ["forest-pocket", "faction-fort", "enemy-wall", "coast-docks", "ruins-plaza"],
    maxPlayers: 8,
    deploy: "open",
    spawnRing: { radius: 28, y: 0.1 },
    shrink: { startSec: 60, endRadius: 8 },
    animals: ["fox", "wolf"],
    tags: ["VoxGrudge Battle", "Practice", "Biomes"],
  },
] as const;

export function getBattleDeployment(id: string): BattleMapDeployment | undefined {
  return VOXGRUDGE_BATTLE_DEPLOYMENTS.find((d) => d.id === id);
}

export function featuredBattleDeployments(): BattleMapDeployment[] {
  return VOXGRUDGE_BATTLE_DEPLOYMENTS.filter((d) => d.featured);
}

/** Spawn points on a ring — deterministic from seed. */
export function buildSpawnRing(
  count: number,
  radius: number,
  y: number,
  seed: string,
): { id: string; x: number; y: number; z: number; yaw: number; team: number }[] {
  const n = Math.max(2, Math.min(16, count));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const phase = ((h % 1000) / 1000) * Math.PI * 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const yaw = a + Math.PI; // face center
    out.push({
      id: `spawn-${i}`,
      x,
      y,
      z,
      yaw,
      team: i,
    });
  }
  return out;
}
