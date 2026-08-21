/**
 * Isolated Sketchfab / Mineways multipacks for Open.
 * Never load a whole pack as one hero or one fused map tile.
 *
 * Author disk:
 *   D:\Games\Models\minecraft_world_npc_village.glb
 *   D:\Games\Models\free_modular_low_poly_dungeon_pack (1).glb
 *   D:\Games\Models\stylised_planks_materials.glb
 *   D:\Games\Models\grave_stone_collection.glb
 *   D:\Games\Models\dungeon_essential_kit.glb   — catalog only (113 MB)
 *
 * Runtime: public/models/packs/  (R2 key prefix models/packs/)
 * Load pieces through camp isolateNode / dedicated GLB — not the showcase scene.
 */
export type PackRole =
  | "floor"
  | "wall"
  | "door"
  | "prop"
  | "grave"
  | "plank"
  | "block"
  | "map";

export type PackPiece = {
  id: string;
  name: string;
  pack: string;
  role: PackRole;
  file: string;
  isolateNode?: string;
  snap_m: number;
  targetHeightM?: number;
  /** Camp placeable id when this piece is claim-buildable. */
  placeableId?: string;
  /** False = catalogued locally, not copied into the SPA. */
  shipped?: boolean;
};

export const OPEN_MESH_PACKS: PackPiece[] = [
  {
    id: "mod-floor",
    name: "Dungeon floor",
    pack: "modular-dungeon",
    role: "floor",
    file: "models/packs/modular-dungeon/floor-001.glb",
    snap_m: 2,
    targetHeightM: 0.24,
    placeableId: "dungeon_floor",
  },
  {
    id: "mod-wall",
    name: "Brick wall",
    pack: "modular-dungeon",
    role: "wall",
    file: "models/packs/modular-dungeon/brick-wall.glb",
    snap_m: 2,
    targetHeightM: 2.9,
    placeableId: "dungeon_wall",
  },
  {
    id: "mod-wall-door",
    name: "Brick wall with door",
    pack: "modular-dungeon",
    role: "door",
    file: "models/packs/modular-dungeon/brick-wall-with-door.glb",
    snap_m: 2,
    targetHeightM: 2.1,
    placeableId: "dungeon_door_wall",
  },
  {
    id: "mod-chest",
    name: "Dungeon chest",
    pack: "modular-dungeon",
    role: "prop",
    file: "models/packs/modular-dungeon/chest-bottom.glb",
    snap_m: 0.5,
    targetHeightM: 0.55,
    placeableId: "dungeon_chest",
  },
  {
    id: "mod-barrel",
    name: "Dungeon barrel",
    pack: "modular-dungeon",
    role: "prop",
    file: "models/packs/modular-dungeon/barrel.glb",
    snap_m: 0.5,
    targetHeightM: 0.9,
    placeableId: "dungeon_barrel",
  },
  {
    id: "mod-torch",
    name: "Dungeon candle",
    pack: "modular-dungeon",
    role: "prop",
    file: "models/packs/modular-dungeon/torch.glb",
    snap_m: 0.5,
    targetHeightM: 0.7,
    placeableId: "dungeon_torch",
  },
  {
    id: "mod-crypt",
    name: "Assembled crypt (gapless 5×5)",
    pack: "modular-dungeon",
    role: "map",
    file: "models/packs/modular-dungeon/assembled-crypt.glb",
    snap_m: 2,
  },
  {
    id: "grave-1",
    name: "Grave 1",
    pack: "graves",
    role: "grave",
    file: "models/packs/graves/grave-stone-collection.glb",
    isolateNode: "Grave1",
    snap_m: 0.5,
    targetHeightM: 1.4,
    placeableId: "grave_slab",
  },
  {
    id: "grave-2",
    name: "Grave 2",
    pack: "graves",
    role: "grave",
    file: "models/packs/graves/grave-stone-collection.glb",
    isolateNode: "Grave2",
    snap_m: 0.5,
    targetHeightM: 1.4,
    placeableId: "grave_stone",
  },
  {
    id: "grave-3",
    name: "Grave 3",
    pack: "graves",
    role: "grave",
    file: "models/packs/graves/grave-stone-collection.glb",
    isolateNode: "Grave3",
    snap_m: 0.5,
    targetHeightM: 1.4,
  },
  {
    id: "grave-4",
    name: "Grave 4",
    pack: "graves",
    role: "grave",
    file: "models/packs/graves/grave-stone-collection.glb",
    isolateNode: "Grave4",
    snap_m: 0.5,
    targetHeightM: 1.4,
  },
  {
    id: "planks-1",
    name: "Stylised planks A",
    pack: "stylised-planks",
    role: "plank",
    file: "models/packs/stylised-planks/cube.glb",
    snap_m: 1,
    targetHeightM: 1,
    placeableId: "plank_block",
  },
  {
    id: "planks-2",
    name: "Stylised planks B",
    pack: "stylised-planks",
    role: "plank",
    file: "models/packs/stylised-planks/cube-1.glb",
    snap_m: 1,
    targetHeightM: 1,
    placeableId: "plank_block_b",
  },
  {
    id: "planks-3",
    name: "Stylised planks C",
    pack: "stylised-planks",
    role: "plank",
    file: "models/packs/stylised-planks/cube-2.glb",
    snap_m: 1,
    targetHeightM: 1,
    placeableId: "plank_block_c",
  },
  {
    id: "vil-map",
    name: "NPC village (fused block layers)",
    pack: "npc-village",
    role: "map",
    file: "models/packs/npc-village/npc-village.glb",
    snap_m: 1,
  },
];

export function piecesForPack(pack: string): PackPiece[] {
  return OPEN_MESH_PACKS.filter((p) => p.pack === pack);
}

export function packPieceById(id: string): PackPiece | undefined {
  return OPEN_MESH_PACKS.find((p) => p.id === id);
}
