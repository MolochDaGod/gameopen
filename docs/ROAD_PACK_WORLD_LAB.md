# Road pack → `/world` voxel lab

**Source:** `D:\Games\Models\road_pack.glb` (Sketchfab “Road Pack”, Mineways-style)  
**CDN:** `https://assets.grudge-studio.com/models/packs/road_pack.glb`  
**Catalog:** `content/worlds/road-pack-catalog.json`  
**Code:** `artifacts/animator/src/three/voxel/roadPack.ts`

## What the pack actually is

Not Kenney modular 8 m tiles. **32 meshes**, each one **Minecraft material cluster**:

| Role | Materials (examples) | Lab use |
| --- | --- | --- |
| **Roads / paths** | Cobblestone, Stone_Slab, Double_Stone_Slab, Clay, Dirt, Mossy_Cobble | Spoke + ring connectors |
| **Biomes** | Grass_Block, Dirt, Snow, Red_Sandstone, Netherrack, Soul_Sand | 4 wedge biomes under spokes |
| **Trees** | Oak_Log, Oak_Leaves, Acacia_Log, mushrooms | Pillars + GLB canopy accents |
| **Buildings** | Oak_Planks, Quartz, Terracotta, Wool | Structure trim (catalog only for now) |
| **Connections** | Rail, Quartz_Stairs, slabs | Path markers / industry accent |

## Where it applies

| Surface | Behavior |
| --- | --- |
| **`/world` lab** | Auto-applies biome road layout on mount; **Biome roads** button re-applies |
| **`/voxel` templates** | **Biome Roads Lab** template in picker |
| **Full VoxGrudge** | Still uses **Kenney City Kit** 8 m roads on CDN (`voxgrudge/models/kenney/roads/`) for zone rings/spokes |

## Runtime

1. `buildBiomeRoadBlocks()` — pure voxel cells (works offline).  
2. `scatterRoadPackAccents()` — isolates mesh clusters from R2 pack (roads at junctions, trees in wedges).  
3. Material → `voxel-canonical` block types for palette continuity.

## Upload

```bash
# After placing bake under public/models/packs/road_pack.glb
node scripts/retry-failed-glb.mjs models/packs/road_pack.glb
# or full production pipeline
npm run assets:production:upload
```

Do **not** commit the ~14 MB GLB (gitignored under `public/models/packs/*.glb`).
