# Codex & Voxel Asset Generation Guide

**Live Codex UI:** https://mine-loader.vercel.app/#/defs  
**Open entry:** Realms / Mine-Loader → Codex · `open.grudge-studio.com` → library  
**Repo SSOT:** `Mine-Loader` (`artifacts/voxelcraft` + `lib/asset-catalog` + `lib/db`)

This document maps the **Codex**, **simple block face art**, and the **offline generators** you use to produce:

| Want | Layer | Format | Generator / SSOT |
|------|--------|--------|------------------|
| Single placeable block | Block catalog | Face tile + `cat:<id>` | `catalog_atlas.png` + `blockCatalogData.ts` |
| Codex thumbnail | Block icons | 128px PNG nearest | `build_block_icons.mjs` |
| RPG stats / roles | Block metadata | TS + DB seed JSON | `build_block_metadata.mjs` |
| Browseable item icons (benches, weapons, armour, vehicles, structures) | Item catalog | 128px PNG + CSV meta | `build_item_catalog.mjs` (550 / 22 packs) |
| 3×3 modular walls/floors | Building kit | GLB | `build_kit_pieces.mjs` (module **M=3**) |
| Held tools / weapons (pixel extrude) | Tools | GLB + 16×16 src | `build_pixel_tools.mjs` |
| Crafting benches / stations (3D) | Props / stations | GLB / OBJ | `public/assets/stations`, blacksmith OBJs |
| Structures / vehicles | Props | GLB / FBX | `structures/*`, `Boat.fbx`, `dwarven_minecart.glb` |
| Voxel characters | Characters | GLB / FBX | `box_hero`, TVS packs, TPose set |
| Cosmetics / armour visuals | Cosmetics | GLB | hats, cape, helmets |

---

## 1. What the Codex is

In-game page: `artifacts/voxelcraft/src/pages\Defs.tsx` (`#/defs`).

Three tabs:

| View | Content | Source |
|------|---------|--------|
| **Mechanics** | Map gen, physics, modes, rules (prose + props) | `api-server/src/data/gameDefs.ts` → `GET /api/definitions` |
| **Catalog** | 550 item icons (stations, gear, fantasy/tactical sets, FX) | `itemCatalogData.ts` + `public/assets/item-icons/<pack>/` |
| **Blocks** | 250 RPG blocks | `blockCatalogData.ts` + `block-icons/<id>.png` |

**Important:** Item catalog is currently a **browseable reference** (Codex only). Comment in `itemCatalog.ts`:

> Items are NOT yet wired into blocks/recipes/inventory — that is a later, opt-in phase.

Blocks **are** wired: place as `cat:<slug>`, meshed from the **same** atlas faces as the icons.

Open/fleet contract: `gameopen/docs/VOXEL_CANONICAL.md` · `GET /api/blocks`.

---

## 2. Simple block generation art (single block)

### 2.1 Single source of truth

```
public/assets/blocks/catalog_atlas.png   ← face art grid (COLS × TILE)
src/lib/blockCatalogData.ts              ← ordered { id, name, category }
        │
        ├─ runtime voxelEngine slices tiles → in-world faces
        └─ build_block_icons.mjs        → public/assets/block-icons/<id>.png (128px nearest)
```

**Practice:** Never maintain a separate isometric Codex crop. Atlas face **is** Codex look (nearest upscale).

### 2.2 Add a new single block

1. **Art:** Add one TILE×TILE face into `catalog_atlas.png` at the next free cell (same packing as `CATALOG_ATLAS_COLS` / `CATALOG_TILE` in `blockCatalogData.ts`).  
2. **Data:** Append `{ id: "my-block", name: "My Block", category: "Structural Tech" }` to `BLOCK_CATALOG` in order matching the atlas index.  
3. **Icons:**  
   `node artifacts/voxelcraft/scripts/build_block_icons.mjs`  
4. **Metadata (jobs, rarity, hooks):**  
   `node artifacts/voxelcraft/scripts/build_block_metadata.mjs`  
5. **Optional CDN:**  
   `node artifacts/voxelcraft/scripts/upload_blocks_r2.mjs`  
6. Place in-world as type `cat:my-block`.

Categories already used (profiles in metadata script): Utility Cores, Reactor Cores, Containment Labs, Mining Rigs, Industrial, Heavy Machinery, Structural Tech, Ruins & Relics, Stone & Crystal, Ores & Minerals.

Keyword families auto-assign roles (light, ore, station/processing, boss arena, beacon, …) so “crafting station” style blocks get processing jobs when names match (e.g. *furnace*, *compressor*, *repair station*).

### 2.3 Terrain palette (not Codex)

Editor/world-gen bare ids: `grass`, `stone`, `woodPlanks`, … (see VOXEL_CANONICAL). Separate small `atlas.png` for classic terrain — not the 250 sci-fi catalog.

---

## 3. Item catalog art (benches, weapons, armour, structures, vehicles)

### 3.1 Packs (22 × ~25 icons = 550)

| Pack id | Theme (examples) |
|---------|------------------|
| `crafting-stations` | Crafting & sci-fi **benches / stations** |
| `mining-ops` | Shafts, carts, drill heads, **structures**, UI |
| `mining-blocks` / `mining-gear` | Blocks + gear |
| `industrial-gear` / `heavy-gear` | Industrial kit |
| `ops-tier-1` … `ops-tier-6` | Field-ops armour/weapons lines |
| `fantasy-common` … `fantasy-legendary` | Fantasy gear |
| `tactical-common` … `tactical-legendary` | Tactical gear |
| `command-actions` | RTS/RPG UI actions |
| `projectiles-fx` | Projectiles / combat FX |

Each item has: `category` (block / weapon / station / gear / structure / ui-action / …), `slot` (head/chest/weapon/tool), `tier`, `craftRole`, crafting notes.

### 3.2 Regenerate from source zip

```
attached_assets/icons*.zip
  icons/<pack>/<slug>.png
  voxel-icons.csv   # name, category, slot, craft_role, pack, slug, …
```

```bash
# from Mine-Loader repo root
node artifacts/voxelcraft/scripts/build_item_catalog.mjs
```

Outputs:

- `public/assets/item-icons/<pack>/<slug>.png` (128px)  
- `src/lib/itemCatalogData.ts` (do not hand-edit)

### 3.3 Using catalog art to *generate* gameplay assets

| Goal | Approach using Codex art |
|------|---------------------------|
| **Crafting bench prop** | Icon from `crafting-stations` → model: place `stations/*` or blacksmith `forge`/`anvil` OR generate simple GLB box stack + attach icon as UI |
| **3×3 block module** | Use kit generators (below) or stamp 3×3×N `cat:` cells from a structure recipe |
| **Single-block item** | Map item slug → new block id + atlas tile (copy palette from icon via sharp) |
| **Weapon held** | Prefer `build_pixel_tools.mjs` style 16×16 extrude, or OBJ in `rpg_weapons/` |
| **Armour on character** | Cosmetics GLBs (hats/cape) + equipment slots; item catalog `slot=head/chest` for UI only until equip pipeline binds models |
| **Vehicle** | Existing `Boat.fbx`, `Rowboat.fbx`, `dwarven_minecart.glb` as props; new vehicle = GLB + `ModelDef` in asset-catalog |
| **Structure** | `structures/*.glb` + `structure: { footprint, door }` on `ModelDef` for site-prep |

---

## 4. Offline 3D generators (procedural, committed GLBs)

Run from repo root unless noted.

### 4.1 3×3 modular building kit

```bash
node artifacts/voxelcraft/scripts/build_kit_pieces.mjs
```

- Module size **M = 3 blocks** (snaps to editor 3-block grid).  
- Outputs: `kit_floor`, `kit_wall`, `kit_wall_corner`, `kit_wall_door`, `kit_wall_window`, `kit_roof`.  
- Flat PBR colours (no textures) — good base for “simple voxel” buildings.

### 4.2 Pixel-extruded tools / weapons

```bash
node artifacts/voxelcraft/scripts/build_pixel_tools.mjs
```

- Author 16×16 grids in script (or PNG under `scripts/pixel_tools_src/`).  
- Extrudes opaque pixels like Minecraft held items.  
- Tiers: wood / stone / gold / diamond for axe, pickaxe, shovel, sword.  
- Output: `public/assets/tools/*.glb`.

**Pattern for new weapons:** add sprite grid + palette → regenerate → register key in `@workspace/asset-catalog` TOOLS/WEAPONS list.

### 4.3 Other scripts

| Script | Role |
|--------|------|
| `build_ui_icons.mjs` | HUD UI icons |
| `bake_tvs_packs.mjs` | Village/knights/… character GLBs |
| `optimize_models.mjs` | Meshopt compress GLBs |
| `extract_hats.mjs` | Cosmetics from packs |
| `upload_blocks_r2.mjs` | Push block-icons + atlas to R2 |

---

## 5. 3D model library (for characters & gear)

SSOT: `lib/asset-catalog/src/modelCatalog.ts`  
Loader: `voxelcraft/src/lib/modelLibrary.ts` (`ASSET_BASE` / `VITE_ASSET_BASE_URL`).

| Kind | Examples | `targetHeight` (blocks) |
|------|----------|-------------------------|
| **character** | `box_hero`, TVS villagers/knights/wizards, TPose set | ~2.4–2.6 |
| **prop** | forge, anvil, chest, boat, houses, dungeon pieces | varies |
| **tool** | pixel tools | held scale |
| **animal / creature** | animals + creatures GLBs | varies |

**StructureMeta** on large props:

```ts
structure: { footprint: { w, d }, door: { side: "-z", offset: 0 } }
```

Used by site-prep so houses sit on leveled pads with door facing walkable ground.

**Stations already onboarded (GLB):**

- `antique_loom`, `blast_furnace` (+ animated), `campfire`, `dwarven_minecart`, `torch`  
- Blacksmith OBJ set: forge, anvil, grindstone, bellow, stand, weapon_rack, barrel  

**Cosmetics / armour-like:**

- `miner_helmet`, `crown`, `chef_hat`, `pirate_hat`, `straw_hat`, `cape`, hat packs  

---

## 6. Crafting benches (gameplay vs art)

| Layer | What exists |
|-------|-------------|
| **UI crafting** | `CraftingBench.tsx` + pure `gridCraft.ts` (5×5 shape) + `recipes.ts` |
| **3D stations** | Props above + Codex **item** icons under `crafting-stations` |
| **Block “stations”** | Catalog blocks with processing jobs (`nano-furnace`, `repair-station-block`, …) |

To **ship a new craft bench end-to-end**:

1. Icon in item catalog pack `crafting-stations` (or generate).  
2. GLB under `stations/` or procedural kit.  
3. `ModelDef` entry + editor palette.  
4. Recipe list or grid recipes consuming materials.  
5. Optional: multiblock 3×3 recipe that places `cat:` cells + prop on top.

---

## 7. Recommended generation recipes (practical)

### A. New “simple voxel bench” (fastest)

1. Generate a 1–2 block tall station mesh (kit boxes or Blockbench → GLB).  
2. `targetHeight: 1.5–2.2`.  
3. Use a Codex `crafting-stations` icon in UI only.  
4. Wire open-on-use → existing `CraftingBench` UI.

### B. New 3×3 structure from blocks only

1. Design 3×3×H pattern of `cat:` or terrain ids.  
2. Store as scene template / structure stamp (mapTemplates or worldSites).  
3. No new atlas needed if reusing existing faces.

### C. New single-block ore / station face

1. Paint TILE×TILE nearest-neighbour PNG.  
2. Pack into atlas + catalog row + metadata + icons script.  
3. Upload R2 if CDN is used in prod.

### D. New weapon for voxel character

1. 16×16 pixel art → `build_pixel_tools` pattern → tools GLB.  
2. Or use `rpg_weapons/*.obj` + palette.  
3. Held item state / equipment keys.  
4. Optional: item-catalog fantasy/tactical pack icon for inventory UI.

### E. New armour look

1. Prefer cosmetics GLB (hat/helm) + character equipment slots.  
2. Full armour mesh: TVS character variants already encode gear looks per model.  
3. Item-catalog `ops-tier-*` / fantasy packs supply UI icons until mesh swap is bound.

### F. New vehicle

1. GLB at voxel scale (`targetHeight` from bbox).  
2. Register prop; optional seat/path later.  
3. Codex structure/logistics icons for UI (load-cart, minecart).

---

## 8. Scale & art rules (don’t break the mine)

1. **1 world unit ≈ 1 voxel block.**  
2. Characters ~2.4–2.6 blocks tall.  
3. Block faces: **nearest** filter always (Codex + engine).  
4. Atlas order **must** match `blockCatalogData` index order.  
5. Kit module = **3×3** footprint for building kit.  
6. Prefer meshopt GLBs (`optimize_models.mjs`) before large packs.  
7. CDN: set `VITE_ASSET_BASE_URL` to R2 root preserving `assets/` layout.

---

## 9. API / fleet surface

| Endpoint / helper | Role |
|-------------------|------|
| `GET /api/blocks` | Full block catalog + meta (Codex Blocks, Open voxel) |
| `GET /api/definitions` | Mechanics codex entries |
| `@workspace/voxel-canonical` `fetchBlockCatalog()` | Open/gameopen consumers |
| `@workspace/asset-catalog` | ModelDef lists for engine + distribution API |

---

## 10. Gaps / next wiring (for generation pipeline)

| Gap | Opportunity |
|-----|-------------|
| Item catalog ↛ inventory | Map `CatalogItem` → `items.ts` / recipes by slug |
| Item icon ↛ 3D auto | Script: icon → extruded pixel GLB (extend pixel tools) |
| Multiblock benches | Data: 3×3 recipe + station prop key |
| Armour mesh swap | Equip system: slot → cosmetic/model key |
| Open voxel editor | Already uses Codex via `/api/blocks`; posters only |

---

## 11. Quick file index

```
Mine-Loader/
  artifacts/voxelcraft/
    src/pages/Defs.tsx                 # Codex UI
    src/lib/blockCatalogData.ts        # 250 blocks order
    src/lib/blockCatalogMeta.ts        # generated RPG meta
    src/lib/itemCatalogData.ts         # 550 items
    src/lib/modelLibrary.ts            # load 3D
    src/lib/gridCraft.ts / recipes.ts  # crafting logic
    public/assets/
      blocks/catalog_atlas.png
      block-icons/*.png
      item-icons/<pack>/*.png
      kit/*.glb
      tools/*.glb
      stations/*.glb
      structures/*.glb
      characters/*.glb
      cosmetics/*.glb
    scripts/build_*.mjs
  lib/asset-catalog/src/modelCatalog.ts
  lib/db/src/seed/blockCatalog.generated.json
  artifacts/api-server/src/data/gameDefs.ts
```

---

*When generating new voxel content, start from the Codex pack that matches the role (crafting-stations, fantasy-*, ops-tier-*), then pick the lightest geometry path: block face → kit 3×3 → pixel tool → full GLB.*
