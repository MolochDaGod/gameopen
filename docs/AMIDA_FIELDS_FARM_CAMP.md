# Amida fields → farm / camp / codex

**Source:** `C:\Users\nugye\Desktop\grudgeproduction\voxgrudge\fields_near_the_city_of_amida.glb`  
**Sketchfab:** [Fields near the city of Amida](https://sketchfab.com/3d-models/fields-near-the-city-of-amida-17b4f6ac0ac44f7cbe75674b7df121e2) (CC-BY-4.0, galiendArcy)  
**CDN:** `https://assets.grudge-studio.com/models/packs/fields_near_the_city_of_amida.glb`  
**Catalog:** `content/worlds/amida-fields-catalog.json`  
**Code:** `artifacts/animator/src/three/voxel/amidaFields.ts`

## What the pack is

Mineways multi-mesh farm/camp (~57 MB, **62 meshes**, **5 materials**):

| Material | Role |
| --- | --- |
| **Fence / Fence_0** | Texture-atlas clusters (walls, fields, fences, crops) — not named per block |
| **Glass_Pane** | Window / glass accents |
| **Redstone_Torch_active(_0)** | Camp lights |

Roles are curated by **meshIndex** (Object_0…61) + size heuristics, then mapped to voxel-canonical terrain and Mine-Loader codex hints.

## Usable pieces

| Group | Uses | Terrain map (examples) |
| --- | --- | --- |
| **field** | Surface grass/dirt patches | `grass`, `dirt` |
| **farm** | Crop stacks, beds, props | `leaves`, `dirt` |
| **fence** | Posts / rails | `log`, `woodPlanks` |
| **camp** | Pad, torches, crates | `woodPlanks`, `exclamation`, `blockSquare` |
| **structure** | Wall / building shells | `woodPlanks`, `brickYellow` |
| **path** | Slab paths | `stone` |

## Codex connection

1. Offline: each role has `codexTerrain` → placeable terrain in `@workspace/voxel-canonical`.  
2. Online: `resolveAmidaCodexBindings()` hits `/api/blocks` (Mine-Loader) and upgrades roles to `cat:slug` when slug/name/category matches `AMIDA_CODEX_HINTS`.  
3. Harvest Production UI **Codex** tab still uses the same `/api/blocks` catalog — Amida layout prefers catalog types when bound.

## Where it applies

| Surface | Behavior |
| --- | --- |
| **`/world` lab** | Default seed = **Amida farm camp**; buttons **Amida farm** / **Biome roads** |
| **`/voxel` templates** | **Amida Farm Camp** template in picker |
| **Full VoxGrudge** | Use Kenney + production world CDN; Amida pack as prop/accent source |

## Runtime API

```ts
buildAmidaFarmBlocks()           // pure voxel cells (offline)
scatterAmidaCampProps(parent)    // isolate GLB clusters (R2)
extractAmidaPiece(meshIndex)     // single placeable cluster
resolveAmidaCodexBindings()      // terrain + cat: from /api/blocks
loadAmidaReferenceScene()        // full-scene scaled preview (heavy)
```

## Upload (R2 + D1 — do not commit GLB)

```bash
# Stage local (gitignored)
mkdir -p artifacts/animator/public/models/packs
cp "/c/Users/nugye/Desktop/grudgeproduction/voxgrudge/fields_near_the_city_of_amida.glb" \
   artifacts/animator/public/models/packs/

# Upload single key
node scripts/retry-failed-glb.mjs models/packs/fields_near_the_city_of_amida.glb

# Or production pipeline (max-mb ≥ 60)
node scripts/upload-production-glbs-r2.mjs --only packs --max-mb 80
node scripts/seed-production-glbs-d1.mjs --apply
```

Env: `CLOUDFLARE_ACCOUNT_ID` / `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=grudge-assets`.

Do **not** commit the ~57 MB GLB (`artifacts/animator/public/models/packs/*.glb` is gitignored).
