/**
 * Playable races, enemies, allies, bosses — asset paths + default AI.
 * Uses merged gameopen public pack under /models/*
 */

import type { StrategyProfileId } from "./modes";
import { assetUrl } from "../lib/fleet";

export type EntityKind = "hero" | "enemy" | "ally" | "boss";

export interface CatalogEntity {
  id: string;
  name: string;
  kind: EntityKind;
  /** GLB path relative to public/ */
  model: string;
  /** Optional race key for grudge6 equip. */
  raceId?: string;
  defaultStrategy: StrategyProfileId;
  tags: string[];
}

export const RACES: readonly CatalogEntity[] = [
  { id: "human", name: "Human", kind: "hero", model: "models/races/human.glb", raceId: "human", defaultStrategy: "cautious-duelist", tags: ["playable", "grudge6"] },
  { id: "orc", name: "Orc", kind: "hero", model: "models/races/orc.glb", raceId: "orc", defaultStrategy: "aggressive-rusher", tags: ["playable", "grudge6"] },
  { id: "undead", name: "Undead", kind: "hero", model: "models/races/undead.glb", raceId: "undead", defaultStrategy: "flanker", tags: ["playable", "grudge6"] },
  { id: "barbarian", name: "Barbarian", kind: "hero", model: "models/races/barbarian.glb", raceId: "barbarian", defaultStrategy: "aggressive-rusher", tags: ["playable", "grudge6"] },
  { id: "dwarf", name: "Dwarf", kind: "hero", model: "models/races/dwarf.glb", raceId: "dwarf", defaultStrategy: "tank-guard", tags: ["playable", "grudge6"] },
  { id: "high_elf", name: "High Elf", kind: "hero", model: "models/races/high_elf.glb", raceId: "high_elf", defaultStrategy: "ranged-skirmisher", tags: ["playable", "grudge6"] },
] as const;

export const ENEMIES: readonly CatalogEntity[] = [
  { id: "zombie-1", name: "Voxel Zombie", kind: "enemy", model: "models/enemies/voxel-zombies/voxel-zombie-1.glb", defaultStrategy: "swarm-horde", tags: ["horde", "melee"] },
  { id: "zombie-2", name: "Voxel Zombie II", kind: "enemy", model: "models/enemies/voxel-zombies/voxel-zombie-2.glb", defaultStrategy: "swarm-horde", tags: ["horde", "melee"] },
  { id: "zombie-3", name: "Voxel Zombie III", kind: "enemy", model: "models/enemies/voxel-zombies/voxel-zombie-3.glb", defaultStrategy: "swarm-horde", tags: ["horde", "melee"] },
  { id: "orc-foe", name: "Orc Raider", kind: "enemy", model: "models/orc.glb", defaultStrategy: "aggressive-rusher", tags: ["melee"] },
  { id: "skeleton", name: "Skeleton Warrior", kind: "enemy", model: "models/skeleton-warrior.glb", defaultStrategy: "cautious-duelist", tags: ["melee", "undead"] },
  { id: "sanji", name: "Rival Fighter", kind: "enemy", model: "models/sanji.glb", defaultStrategy: "flanker", tags: ["elite"] },
] as const;

export const ALLIES: readonly CatalogEntity[] = [
  { id: "ally-hero", name: "Companion Hero", kind: "ally", model: "models/heroes/hero.glb", defaultStrategy: "tank-guard", tags: ["companion"] },
  { id: "ally-human", name: "Militia", kind: "ally", model: "models/races/human.glb", raceId: "human", defaultStrategy: "support-healer", tags: ["companion"] },
] as const;

export const BOSSES: readonly CatalogEntity[] = [
  { id: "karate-boss", name: "Karate Boss", kind: "boss", model: "models/karate-boss.glb", defaultStrategy: "boss-phased", tags: ["boss", "weak-points"] },
  { id: "yellow-bot", name: "Yellow Bot", kind: "boss", model: "models/heroes/hero.glb", defaultStrategy: "boss-phased", tags: ["boss", "weak-points", "danger-room"] },
] as const;

export const MAPS = {
  "danger-room": { label: "Danger Room", glb: null as string | null },
  "arena-war-zone": { label: "Arena War Zone", glb: "models/arena-war-zone.glb" },
  "agama-map": { label: "Agama Survival Map", glb: "models/agama-map.glb" },
  dungeon: { label: "Dungeon", glb: "models/dungeon.glb" },
  "pirate-black-tide": { label: "Black Tide", glb: "models/pirate/black-tide.glb" },
  "haunting-door": { label: "Haunting Door", glb: "models/haunting-door.glb" },
} as const;

export function modelUrl(rel: string): string {
  return assetUrl(rel);
}

export function allCatalog(): CatalogEntity[] {
  return [...RACES, ...ENEMIES, ...ALLIES, ...BOSSES];
}
