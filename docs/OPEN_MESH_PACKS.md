# Open mesh packs — isolate, don’t fuse

**System extended:** Open camp catalogs (`placeables.ts` / `campAssetCatalog.ts`) + Danger dungeon picker (`DungeonMaps.ts`).  
**Not invented:** no second dungeon generator (Kenney modular kit stays the seeded generator). These are **tile/prop packs** for camp build + two picker maps.

Author sources on `D:\Games\Models\`. Runtime keys: `public/models/packs/` → R2 `models/packs/…`.

## What each GLB actually is

| File | Meshes | Unique pieces | What they are **not** |
|------|--------|---------------|------------------------|
| `minecraft_world_npc_village.glb` (9.6 MB) | 28 | 28 **block-type layers** | Not houses. Mineways fused every Oak_Planks / Chest / Fence in the world into one mesh per material. |
| `free_modular_low_poly_dungeon_pack (1).glb` (4.9 MB) | 263 | ~90 parent groups | Showcase with **gaps**. Material children (`_dark grey_0` + `_grey_0`) are one tile. |
| `stylised_planks_materials.glb` (32 MB) | 3 | 3 cubes (`Cube`, `Cube_1`, `Cube_2`) | Author 200 m cubes (cm-as-m). Isolated to **1 m**. |
| `grave_stone_collection.glb` (20 MB) | 4 | `Grave1`–`Grave4` | Author ~cm (Grave1 ~2.4 m after ×0.01). Isolate parent, fit **1.4 m**. |
| `dungeon_essential_kit.glb` (113 MB) | 58 | 54 parent groups | Author often cm (walls ~2–3 m after ×0.01). **Do not copy into the SPA** — textures explode. |

Village layer names (isolateNode): Anvil `Object_2`, Chest `Object_4`, Furnace `Object_13`, Oak_Planks `Object_21`, Cobblestone `Object_5`, Wheat `Object_29`, … full table in `models/packs/npc-village/catalog.json`.

Dungeon essential isolate parents (local only): `Wall_1`, `Wall_Corner`, `Floor`, `Arch_Door_L`, `Barrel_Dungeon_Props1`, `Crate_Dungeon_Props1`, `Cage`, `BookCase_Set5`, … see `models/packs/dungeon-essential/catalog.json`.

## Gaps (fixed)

Showcase dungeon tiles sit apart in the Sketchfab scene. Isolation used to export **one material slice** (walls 0.3 m tall). Now:

1. Isolate by **parent group** (all material children).
2. Blender after glTF is **Z-up** — height is Z, not Y.
3. Scale floor/wall plan to **2 m**, plant feet.
4. Assemble `assembled-crypt.glb` — 5×5 floors + perimeter walls + south door, 2 m snap.

## Open wiring

| Surface | Ids / files |
|---------|-------------|
| Dungeon picker | `modular-crypt`, `npc-village` in `DungeonMaps.ts` (`keepSi` — do not grow to 46 m) |
| **Play modular + boss** | https://grudge-dungeons.vercel.app/ · boss `?linear=1` |
| Camp placeables | `dungeon_floor`, `dungeon_wall`, `dungeon_door_wall`, `dungeon_chest`, `dungeon_barrel`, `dungeon_torch`, `grave_stone`, `grave_slab`, `plank_block` / `_b` / `_c` |
| TS index | `src/three/packs/openMeshPacks.ts` |
| Loader | existing `loadCampAsset` `isolateNode` (graves) |

## Hard rules

- ❌ Load a whole multipack as one play mesh / map tile  
- ❌ Explode `dungeon_essential_kit.glb` into `public/` (113 MB → 500+ MB with duplicated textures)  
- ❌ Treat village `Oak_Planks` as a 1 m cube — it is the **entire village’s planks**  
- ✅ Kenney modular dungeon remains the **seeded** crypt generator (`kenney-modular-dungeon`)  
- ✅ SI: 1 unit = 1 m; if AABB > 40 treat as cm (×0.01)  
- ✅ `models/packs/` resolve **same-origin first** until R2 has the keys  
- ✅ Camp bindings read `OPEN_MESH_PACKS` (`fromPack`) — do not duplicate mesh paths

## Bake scripts

- `scripts/inspect-open-mesh-packs.py` — mesh/node tables  
- `scripts/isolate-open-parents.py` — parent-group isolate + crypt assemble  
- `scripts/isolate-dungeon-props.py` — barrel / torch / chest / candle at prop height  

## Verify

```text
# Admin dungeon picker → Modular Crypt / NPC Village
# Camp build → Dungeon Floor / Wall / Door / Chest / Barrel / Torch, Grave Stone, Planks A
# HEAD local: artifacts/animator/public/models/packs/modular-dungeon/assembled-crypt.glb
```

Not on CDN until an intentional R2 put of `models/packs/`.
