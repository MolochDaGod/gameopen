# Voxel last-30 downloads → D1 + Codex

**Date:** 2026-07-18  
**Catalog SSOT:** `content/worlds/voxel-last30-catalog.json`  
**Scope:** Maps · animals · content/props · VFX from the newest Documents downloads (not Warlords hero era).

## Goal

1. Review last ~30 downloaded GLBs for **voxel** use.
2. Register every asset in **D1** `grudge-assets-db` / `asset_registry`.
3. Stage under R2 path prefix `models/voxel/{maps,animals,content,vfx}/` (plus existing `castle_eltz` / `island_life` keys).
4. Wire **clear Codex connections** to Mine-Loader:
   - Blocks: `/api/blocks` (Open proxy + `mine-loader.vercel.app`)
   - Definitions: `/api/definitions`

## Codex connection model

Each catalog row has a `codex` object:

| Field | Meaning |
|-------|---------|
| `kind` | `terrain` \| `station` \| `creature` \| `vfx` \| `kit` \| `weapon` |
| `blocks[]` | Suggested Mine-Loader block ids (palette / place hints) |
| `defs[]` | Suggested definition / mechanic ids |
| `hint` | Human blurb for Maps / Codex UI |

D1 `animation_packs` JSON stores the same payload plus:

- `cdnUrl` → `https://assets.grudge-studio.com/<r2Key>`
- `codexApis` → fleet block/def endpoints
- `sourceSet` → `voxel-last30-downloads`
- `forceMap` / `forceProp` → `mapAssetScale` flags

### Runtime consumers

| Surface | How codex links show up |
|---------|-------------------------|
| Production UI **Maps** tab | `listMapLibrary()` — map_chunk rows + `codexBlocks` / `codexDefs` |
| Production UI **Codex** tab | `fetchCodexBlocks()` / `fetchCodexDefinitions()` live API |
| Map placement | `MAP_CHUNKS` + `loadMapChunk(id)` — **never** prop height-fit |
| Deep link helper | `codexLinksForMap(asset)` in `harvestCatalog.ts` |

```
Documents GLB
    → stage public/models/voxel/**
    → R2 grudge-assets
    → D1 asset_registry (grudgeUuid = sha1 grudge-asset:r2Key)
    → MAP_CHUNKS / MAP_LIBRARY / VOXEL_CODEX_ASSETS
    → Codex /api/blocks + /api/definitions (Mine-Loader)
```

## Inventory summary

| Category | Count | D1 `category` | CDN prefix |
|----------|------:|---------------|------------|
| Map chunks | ~16 | `voxel_map` | `models/voxel/maps/` (+ castle_eltz, island_life) |
| Animals / creatures | ~7 | `voxel_animal` | `models/voxel/animals/` |
| Content / kits / gear | ~9 | `voxel_content` | `models/voxel/content/` |
| VFX | ~6 | `voxel_vfx` | `models/voxel/vfx/` |

### Maps (map_chunk — 1 block = 1 m)

| id | Notes | Upload |
|----|-------|--------|
| grotto_cavern_cave | cave / ore | stage ≤90MB |
| dragon_head_cave | boss lair | stage |
| geonosis_arena | PvP | stage |
| floating_islands_dwarves_haven | sky seed | stage |
| glowstone_mountain (+ oriental) | glowstone block | stage |
| tower_koth · koth_bundle | KOTH | stage |
| pirat_bay · low_poly_canyon | coast / desert | stage |
| animal_company_lobby | lobby spawn | stage |
| castle_eltz | scale **1**, already staged | staged_local |
| dalaran_fantasy_island | ~128MB | multipart if > wrangler |
| island_life · faction_spawn · awesome_realm | 340–440MB | **multipart R2 only** |

### Animals

chaotic_marine_life · hanu_animated · dragon_three_loops · dragon_run_loop · wing_animated · crystal_pangolin · brute_minion_p2  

*(Not Warlords grudge6 heroes — Realms wildlife / dungeon mobs.)*

### Content

anvil · desert_portal · brick_modular_kit · xyz_buildings_draft · warning_bell · balloons · t0_crossbow · queen_annes_revenge · phantom_seal_altar

### VFX

tornado_vortex · energy_particle_stream · wind_rasenshuriken · kaens_spike · fire_hurricane · unstable_antimatter  

→ skill defs (`wind_skill`, `fire_aoe`, `ultimate`, …).

## Commands

```bash
# 1. Copy Documents → public (skips >90MB / multipart by default)
npm run assets:voxel-last30:stage

# 2. Upload staged models/voxel/** via wrangler R2
npm run assets:voxel-last30:upload

# 3. Generate SQL + optional apply
npm run assets:voxel-last30:seed-d1
npm run assets:voxel-last30:seed-d1:apply

# Full pipeline (stage + upload voxel prefix + D1 apply)
npm run assets:voxel-last30:pipeline
```

Reports:

- `reports/voxel-last30-d1-seed.sql`
- `reports/voxel-last30-d1-rows.json`

## Large files

Wrangler object put is capped (~300 MiB). For island_life / faction_spawn / awesome_realm / dalaran:

1. D1 row is still inserted (metadata + codex links).
2. Upload with S3 multipart (`upload-outdoor-r2.mjs` / production R2 keys) when credentials available.
3. Runtime already falls back for island_life (sailtest / small_island).

## Scale rules

- Map chunks: `evaluateAssetRole` + `MAP_CHUNKS` — **forbid prop height-fit**.
- Kits: `role: kit_module` → scale 1.
- Props / VFX: `forceProp` → scale 1, place as attachments / stations.

See `lib/voxel-canonical/src/mapAssetScale.ts` and `docs/SEED_WORLD_DEPLOY.md`.

## Verify

```bash
# D1 sample (remote)
npx wrangler d1 execute grudge-assets-db --remote \
  --command "SELECT name, category, r2_key FROM asset_registry WHERE category LIKE 'voxel_%' LIMIT 20"

# CDN head
curl -I https://assets.grudge-studio.com/models/voxel/vfx/tornado_vortex.glb

# Codex
curl -s "https://mine-loader.vercel.app/api/blocks?limit=3"
curl -s "https://open.grudge-studio.com/api/blocks?limit=1"
```

Open production UI **P** → **Maps** / **Codex** to see library rows with block/def hints.

## Deployments purge / update

```bash
npm run assets:voxel-last30:deployments
```

Writes:

- `content/worlds/voxel-map-chunk-deployments.json` — all 16 map chunks + animals/VFX/content CDN index  
- `content/worlds/seed-deployments.json` **v4** — featured core seeds + last-30 map chunks; Rascals demoted  
- `content/worlds/island-life-deployments.json` — wildlife → last-30 animals  
- Mirrors under `artifacts/animator/public/content/worlds/`

UI: Production **Maps** seed cards show 🗺 for map chunks, codex block/def chips, and `mapChunkId`.
