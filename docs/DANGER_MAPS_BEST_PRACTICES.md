# Danger maps — best practices (nav, collider, pinata, health, assets, D1)

**Live:** https://open.grudge-studio.com/danger  
**Health:** `GET /api/health` (proxy → grudge-api / gameopen-api)  
**Map catalog REST:** `GET /content/maps/danger-maps.json` (static SPA; no auth)

---

## 1. Layered architecture (what goes where)

| Concern | SSOT | Not |
|---------|------|-----|
| **Player characters / bag / professions XP** | Railway **Postgres** via `/api/characters`, `/api/account/*` | D1, Puter KV alone, localStorage for production heroes |
| **Item / material / profession definitions** | ObjectStore **D1 index** + JSON on Pages (`info…/api/v1/*`) | Inventing ids in the client |
| **Binary GLB / FBX / icons** | **R2** `assets.grudge-studio.com` | Committing 100MB+ maps to git long-term |
| **Asset search metadata** | D1 `asset_registry` (category, r2_key, bones) | Using D1 as file store |
| **Combat / bag runtime** | Open SPA + Railway | ObjectStore writes |

**Rule:** D1 = catalog/search. Postgres = player state. R2 = bytes.

---

## 2. Navmesh best practices

| Practice | Detail |
|----------|--------|
| **Source mesh** | Bake from **terrain/ground only** (`GamePlayLayer.TERRAIN` / navSources) — never foliage Dupli |
| **Agent** | 2 m orc: radius ~0.52 m, height ~2.1 m, door ≥ 2.45 m, step 0.4 m, slope ≤ 45° |
| **Library** | `three-pathfinding` zones offline when possible; runtime `Pathfinding.createZone` only for small arenas |
| **Height sample** | Always pair nav with `createTerrainHeightSampler` for CCT feet (L0) |
| **Updates** | Dirty nav only on terrain edit / build solid place — not every harvest break |
| **AI** | Yuka FollowPath on pathfinding points; repath throttle 0.2–0.5 s |

**Current status:** Height samplers on outdoor maps; full Recast bake optional offline for forest-mountains / arena.

---

## 3. Collider best practices

| Layer | Collider type | Sensor? |
|-------|---------------|---------|
| TERRAIN / OCEAN_FLOOR | Trimesh (capped tris) or heightfield | No |
| WORLD / solid buildings | Trimesh or compound cuboids | No |
| HARVESTABLE trees/rocks | **Convex hull** or cuboid | No (or soft) |
| CLIMB / SWIM / BURN / CLAIM / ENEMY_ZONE | Box / cylinder | **Yes** |
| DEBRIS pinata | Sphere | Yes |
| PLAYER / NPC / MONSTER / BOSS | Capsule CCT / dynamic | Per body |

**Stack:** `@workspace/grudge-physics` · fixed 1/60 · SI metres · `HarvestPhysicsBake` / `ForestHarvestBake`.

**Do not:** ConvexObjectBreaker as production harvest; full trimesh on every leaf; mix cm and m without bake scale.

---

## 4. Pinata / Valheim harvest

| Step | Practice |
|------|----------|
| Identity | `hrvd_` def · `hrvl_` location · `hrvi_` instance |
| Hit | Tool gate + profession XP · stage scales |
| Break | Instanced debris pool · magnet absorb → bag |
| Net | Host HP only; never serialize shards |
| Anim | `playerSwing` roles: harvestChop / Mine / Gather |

**SSOT:** `three/harvest/*` · ObjectStore materials for loot ids.

---

## 5. Health (ops + player)

### Ops health (deploy gates)

```bash
curl -s https://open.grudge-studio.com/api/health
# expect status healthy / database connected (or gameopen ok)

curl -s https://gameopen-production.up.railway.app/api/health
```

Smoke: `npm run smoke:prod:open` · `npm run verify:assets:open`.

### Player HP

- Studio / Targets / sparCtx — combat only  
- Not stored in D1; character progress on Railway when signed in  

---

## 6. Asset deployment

| Size | Practice |
|------|----------|
| **&lt; ~15 MB** | Ship in SPA `public/` OK for Danger maps (shipwreck, forest mtn, pirate) |
| **~20 MB** | arena OK with git-LFS or CDN |
| **&gt; 50 MB** (tropical ~69 MB) | Prefer **R2** + `loadGltfFirst` keys; avoid bloating Vercel |

**`.vercelignore` (deploy gate):** default ban is `**/*.glb` + `models/maps/**`. Exceptions ship Danger maps:

- **Include:** `maps/shipwreck`, `maps/forest_mountains`, `maps/arena`, `maps/pirate`, `equipment/wing_animated.glb`
- **Exclude (R2-only):** `maps/tropical/**` (~70 MB ×2)

Pipeline:

1. Place GLB under `public/models/maps/...` or upload R2  
2. Register `MAP_REGISTRY` + `TEST_WORLDS`  
3. `upgradeMapPresentation({ toon: true })`  
4. Classify layers · bake colliders · height sample  
5. Ensure `.vercelignore` exception if SPA-hosted  
6. `npm run build` · `npm run deploy:prod` (or git push → Vercel)  
7. Smoke: `npm run verify:danger-maps` · `npm run verify:danger-maps -- --prod`  

---

## 7. Database schema (player vs catalog)

| Table / API (concept) | Store |
|----------------------|--------|
| characters, progress, professions | Postgres Railway |
| account resources / bag vault | Postgres `/api/account/resources` |
| home_islands seed / harvest state | Postgres `/api/island/*` |
| weapons, materials, recipes, icons index | ObjectStore D1 + JSON |
| asset_registry (uuid → r2_key) | D1 grudge-assets-db |

Open never writes character rows to D1.

---

## 8. D1 usage (correct)

**Use D1 for:** asset index search, icon search, static catalog shards, ObjectStore registry.

**Do not use D1 for:** player bag, XP, island seeds, wallet.

Client: `info.grudge-studio.com/api/v1/*` or same-origin `/api/objectstore/*`.

---

## 9. Game load best practices (Three + Vite)

| Practice | Implementation |
|----------|----------------|
| **Loading curtain** | `HelpersLoadScreen` during map switch |
| **Progress stages** | start → glb → classify → physics bake → ready |
| **Parallel** | Character already loaded; only swap map group |
| **Dispose** | Clear previous ForestWorld / pinata / bake colliders |
| **Toon** | After load, one material pass (not per frame) |
| **Cache** | GLTFLoader cache; dead URL mark in loadGltfFirst |
| **Mobile** | Cap harvest colliders (maxHarvest); LOD later |
| **REST catalog** | `/content/maps/danger-maps.json` for tools/UI |

Avoid: full page reload per map; serial REST before first paint of load screen.

---

## 10. Danger map options (verify list)

Biome mesh SSOT: `artifacts/animator/src/three/maps/biomeMeshKeys.ts` (HEAD-proven only).

| testWorldId | Biome / primary key | Fallback chain | Prod |
|-------------|---------------------|----------------|------|
| danger-room | procedural | — | live |
| forest-mountains | SPA forest_mountains | forest-map · glowstone_mountain | **SPA 200** |
| tropical-harvest | SPA tropical dry | **tropical_island_small** · low_poly_island · small_island | CDN fallback |
| shipwreck-island | SPA shipwreck | pirat_bay · sailtest | **SPA 200** |
| arena | SPA arena | geonosis_arena | **SPA 200** |
| pirate-village | SPA pirate/* | pirate_island_pack | **SPA 200** |
| sailtest | R2 sailtest | small · breeze | **CDN 200** |
| forest-map | R2 forest-map | SPA forest_mountains | **CDN 200** |
| island-life | island_life (missing) | sailtest chain | fallback |
| fabled-zone | fabled (missing) | pirate_island_pack · camp | fallback |
| ice-world | R2 ice_world | small_island | **CDN 200** |
| plains-fields | Amida fields · farm | animal lobby · camp | **CDN 200** |
| desert-canyon | low_poly_canyon · glow mountain | geonosis | **CDN 200** |
| volcanic-standin | geonosis · canyon (no volcano island mesh) | glow | **CDN 200** |
| wing_animated.glb | equipment/ | — | **SPA 200** |

REST: **GET** `{origin}/content/maps/danger-maps.json`  
Health: **GET** `{origin}/api/health`  
Verify: `npm run verify:danger-maps` · `npm run verify:danger-maps -- --prod`

---

## 11. Related code

- `mapRegistry.ts` · `testWorlds.ts` · `GamePlayLayers.ts`  
- `forestHarvestBake` · `harvestPhysicsBake` · `PinataHarvest`  
- `HelpersLoadScreen` · `DEPLOY.md` · `OPEN_STACK.md`  
