/**
 * Proven biome / outdoor mesh keys for Danger Room + ForestWorld.
 *
 * HEAD truth (re-probed 2026-08-01):
 *   DEAD both hosts: island_life, fabled-zone/fabledzone, tropical_island(_dry),
 *                    bridge-town-kit, bridge_town
 *   SPA-only OK: arena, pirate village/palms, shipwreck, forest_mountains
 *   CDN+SPA OK: sailtest, forest-map, small/breeze, warlords tropical_small /
 *               pirate_island_pack / low_poly / ice / medieval_camp, voxel biomes
 *
 * Policy: proven 200 keys FIRST (no 404 stall). Dead keys LAST (future upload only).
 * Never invent keys. Labels in testWorlds must match what actually loads.
 */

export type BiomeKind =
  | "tropical"
  | "mountain"
  | "forest"
  | "coast"
  | "sail"
  | "ice"
  | "plains"
  | "desert"
  | "volcanic"
  | "arena"
  | "town"
  | "pirate";

export type BiomeMeshChain = {
  biome: BiomeKind;
  label: string;
  /** Relative keys tried in order by loadGltfFirst. */
  meshKeys: string[];
  /** Where primary asset lives when healthy. */
  primaryHost: "spa" | "cdn" | "either";
  notes?: string;
};

/** SPA Danger maps (open.grudge-studio.com after deploy; not all on R2). */
export const SPA_MAP_KEYS = {
  forestMountains: "models/maps/forest_mountains/forest_mountains.glb",
  shipwreck: "models/maps/shipwreck/shipwreck_island.glb",
  arena: "models/maps/arena/arena.glb",
  pirateVillage: "models/maps/pirate/village.glb",
  piratePalms: "models/maps/pirate/palm_trees.glb",
  pirateDatePalm: "models/maps/pirate/date_palm.glb",
  tropicalDry: "models/maps/tropical/tropical_island_dry.glb",
  tropicalFull: "models/maps/tropical/tropical_island.glb",
} as const;

/** R2-proven outdoor worlds (HEAD 200 on assets.grudge-studio.com). */
export const CDN_WORLD_KEYS = {
  sailtest: "models/worlds/sailtest.glb",
  forestMap: "models/worlds/forest-map.glb",
  smallIsland: "models/worlds/small_island.glb",
  breezeIsland: "models/worlds/breeze-island.glb",
  /** Missing on CDN as of 2026-07-29 — keep for future upload only. */
  islandLife: "models/worlds/island_life.glb",
  fabledZone: "models/worlds/fabled-zone.glb",
  fabledZoneAlt: "models/worlds/fabledzone.glb",
} as const;

/** Warlords-era world packs on R2 (HEAD 200). */
export const CDN_WARLORDS_WORLD = {
  tropicalSmall: "models/warlords-era/worlds/tropical_island_small.glb",
  pirateIslandPack: "models/warlords-era/worlds/pirate_island_pack.glb",
  lowPolyIsland: "models/warlords-era/worlds/low_poly_island.glb",
  iceWorld: "models/warlords-era/worlds/ice_world.glb",
  medievalCamp: "models/warlords-era/worlds/medieval_camp.glb",
} as const;

/** Voxel map chunks on R2 (HEAD 200) — biome stand-ins. */
export const CDN_VOXEL_BIOME = {
  glowstoneMountain: "models/voxel/maps/glowstone_mountain.glb",
  glowstoneMountainOriental: "models/voxel/maps/glowstone_mountain_oriental.glb",
  lowPolyCanyon: "models/voxel/maps/low_poly_canyon.glb",
  geonosisArena: "models/voxel/maps/geonosis_arena.glb",
  floatingMountains: "models/voxel/maps/floating_islands_dwarves_haven.glb",
  pirateBay: "models/voxel/maps/pirat_bay.glb",
  animalLobbyPlains: "models/voxel/maps/animal_company_lobby.glb",
} as const;

/** Nature / harvest packs on R2 (HEAD 200). */
export const CDN_NATURE = {
  trees: "models/nature/stylized/biome/nature_vegetation.glb",
  treesAlt: "models/nature/stylized/biome/realistic_trees.glb",
  tropicalPlants: "models/nature/stylized/biome/tropical_plants.glb",
  rocks: "models/nature/stylized/rocks/stylised_rocks.glb",
  flowers: "models/nature/stylized/harvest/flowers_pack.glb",
  foliage: "models/nature/stylized/harvest/foliage_pack.glb",
  ore: "models/nature/stylized/harvest/ore_nodes.glb",
  minerals: "models/nature/stylized/harvest/minerals_pack.glb",
} as const;

/** Plains / farm scatter packs. */
export const CDN_PLAINS = {
  amidaFields: "models/packs/fields_near_the_city_of_amida.glb",
  lowPolyFarm: "models/packs/low_poly_farm.glb",
  roadPack: "models/packs/road_pack.glb",
} as const;

/**
 * Full biome → mesh key chains for TestWorld / loaders.
 * Order = try first (best) → last (fallback).
 */
export const BIOME_MESH_CHAINS: Record<string, BiomeMeshChain> = {
  tropical: {
    biome: "tropical",
    label: "Tropical / beach harvest",
    primaryHost: "cdn",
    notes:
      "Live mesh: tropical_island_small (CDN). SPA dry/full 404 on prod — kept last for local/future only.",
    meshKeys: [
      CDN_WARLORDS_WORLD.tropicalSmall,
      CDN_WARLORDS_WORLD.lowPolyIsland,
      CDN_WORLD_KEYS.smallIsland,
      CDN_WORLD_KEYS.breezeIsland,
      // Future / local-only (both hosts 404 on prod 2026-08-01)
      SPA_MAP_KEYS.tropicalDry,
      SPA_MAP_KEYS.tropicalFull,
    ],
  },
  mountain: {
    biome: "mountain",
    label: "Forest mountains harvest",
    primaryHost: "spa",
    meshKeys: [
      SPA_MAP_KEYS.forestMountains,
      CDN_WORLD_KEYS.forestMap,
      CDN_VOXEL_BIOME.glowstoneMountain,
      CDN_VOXEL_BIOME.floatingMountains,
    ],
  },
  forest: {
    biome: "forest",
    label: "Dark forest harvest",
    primaryHost: "cdn",
    meshKeys: [CDN_WORLD_KEYS.forestMap, SPA_MAP_KEYS.forestMountains, CDN_NATURE.trees],
  },
  coast: {
    biome: "coast",
    label: "Coast / shipwreck / pirate bay",
    primaryHost: "either",
    meshKeys: [
      SPA_MAP_KEYS.shipwreck,
      CDN_VOXEL_BIOME.pirateBay,
      CDN_WORLD_KEYS.sailtest,
      CDN_WORLD_KEYS.smallIsland,
    ],
  },
  sail: {
    biome: "sail",
    label: "Dual-island sailtest",
    primaryHost: "cdn",
    meshKeys: [
      CDN_WORLD_KEYS.sailtest,
      CDN_WORLD_KEYS.smallIsland,
      CDN_WORLD_KEYS.breezeIsland,
      CDN_WARLORDS_WORLD.lowPolyIsland,
    ],
  },
  ice: {
    biome: "ice",
    label: "Ice world lab",
    primaryHost: "cdn",
    meshKeys: [CDN_WARLORDS_WORLD.iceWorld, CDN_WORLD_KEYS.smallIsland],
  },
  plains: {
    biome: "plains",
    label: "Plains / fields / farm",
    primaryHost: "cdn",
    notes: "No full plains terrain island — Amida fields + farm pack + camp",
    meshKeys: [
      CDN_PLAINS.amidaFields,
      CDN_PLAINS.lowPolyFarm,
      CDN_VOXEL_BIOME.animalLobbyPlains,
      CDN_WARLORDS_WORLD.medievalCamp,
      CDN_WORLD_KEYS.smallIsland,
    ],
  },
  desert: {
    biome: "desert",
    label: "Desert / canyon / glow mountain",
    primaryHost: "cdn",
    meshKeys: [
      CDN_VOXEL_BIOME.lowPolyCanyon,
      CDN_VOXEL_BIOME.glowstoneMountain,
      CDN_VOXEL_BIOME.glowstoneMountainOriental,
      CDN_VOXEL_BIOME.geonosisArena,
    ],
  },
  volcanic: {
    biome: "volcanic",
    label: "Volcanic stand-in (no dedicated island mesh on CDN)",
    primaryHost: "cdn",
    notes: "Uses desert arena + canyon; boss mesh models/enemies/volcano/minecraft-ghast.prod.glb separate",
    meshKeys: [
      CDN_VOXEL_BIOME.geonosisArena,
      CDN_VOXEL_BIOME.lowPolyCanyon,
      CDN_VOXEL_BIOME.glowstoneMountain,
    ],
  },
  arena: {
    biome: "arena",
    label: "Viking combat arena",
    primaryHost: "spa",
    meshKeys: [SPA_MAP_KEYS.arena, CDN_VOXEL_BIOME.geonosisArena],
  },
  pirate: {
    biome: "pirate",
    label: "Pirate village loco",
    primaryHost: "spa",
    meshKeys: [
      SPA_MAP_KEYS.pirateVillage,
      SPA_MAP_KEYS.piratePalms,
      SPA_MAP_KEYS.pirateDatePalm,
      CDN_WARLORDS_WORLD.pirateIslandPack,
      CDN_WORLD_KEYS.sailtest,
    ],
  },
  town: {
    biome: "town",
    label: "Town stand-in (fabled mesh not on CDN)",
    primaryHost: "cdn",
    notes:
      "Live mesh: pirate_island_pack. fabled-zone.glb 404 both hosts — last only.",
    meshKeys: [
      CDN_WARLORDS_WORLD.pirateIslandPack,
      CDN_WARLORDS_WORLD.medievalCamp,
      CDN_WORLD_KEYS.sailtest,
      // Future upload only (404 both hosts 2026-08-01)
      CDN_WORLD_KEYS.fabledZone,
      CDN_WORLD_KEYS.fabledZoneAlt,
    ],
  },
  /** Bridge / dock kit — primary kit GLBs 404; coastal stand-ins proven. */
  docks: {
    biome: "town",
    label: "Dock / harbor stand-in",
    primaryHost: "cdn",
    notes:
      "bridge-town-kit + bridge_town 404 both hosts. Live: pirate pack + sailtest + medieval camp.",
    meshKeys: [
      CDN_WARLORDS_WORLD.pirateIslandPack,
      CDN_WORLD_KEYS.sailtest,
      CDN_WARLORDS_WORLD.medievalCamp,
      CDN_WORLD_KEYS.smallIsland,
      // Future kit upload only
      "models/towns/bridge-town-kit.glb",
      "models/worlds/bridge_town.glb",
    ],
  },
  survival: {
    biome: "coast",
    label: "Survival coast (island_life mesh not on CDN)",
    primaryHost: "cdn",
    notes: "Live mesh: sailtest. island_life.glb 404 — last only for future upload.",
    meshKeys: [
      CDN_WORLD_KEYS.sailtest,
      CDN_WORLD_KEYS.smallIsland,
      CDN_WORLD_KEYS.breezeIsland,
      CDN_WARLORDS_WORLD.lowPolyIsland,
      // Future upload only (404 both hosts 2026-08-01)
      CDN_WORLD_KEYS.islandLife,
    ],
  },
};

/** Helper for test worlds / loaders. */
export function meshKeysForBiome(id: keyof typeof BIOME_MESH_CHAINS): string[] {
  return BIOME_MESH_CHAINS[id]?.meshKeys.slice() ?? [];
}
