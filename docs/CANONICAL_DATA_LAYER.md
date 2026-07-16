# Canonical data layer — consolidations & connections

**Open:** https://open.grudge-studio.com  
**Code SSOT:** `artifacts/animator/src/lib/fleetSsot.ts` + `lib/fleet.ts`  
**Probed:** 2026-07-16

This document **corrects** older docs that pointed catalogs at `objectstore.grudge-studio.com` (many `/api/v1/*` files **404**). Live definitions are on **info.grudge-studio.com**.

---

## 1. Five layers (never invert)

| Layer | Authority | Examples | Open access |
|-------|-----------|----------|-------------|
| **1. Player state** | Railway Postgres `grudge-api-production` | characters, account bag, wallet, island | same-origin `/api/characters`, `/api/account`, … |
| **2. Definitions** | **info.grudge-studio.com/api/v1** | weapons, skills, gear presets, races, recipes | `contentUrl()` / `fetchCatalogJson()` / `/api/objectstore/v1/*` rewrite |
| **3. Binaries** | **assets.grudge-studio.com** (R2) | grudge6 FBX/GLB, atlases, icons, partial anims | `fleetAssetResolver` + vercel rewrites |
| **4. Asset index** | D1 `grudge-assets-db` (registry only) | r2Key → metadata | optional; **never** player bag/characters |
| **5. Worlds** | Mine-Loader Railway **1 replica** | seed, block_edits, lobby | `/api/blocks`, `/api/worlds` → mine-loader-api |

**Dead / do not use for new work:** `api.grudge-studio.com` (old tunnel).  
**Legacy host:** `objectstore.grudge-studio.com` — keep as last fallback only until dual-published.

---

## 2. Corrections applied (Open)

| Before (wrong/stale) | After (correct) |
|----------------------|-----------------|
| Catalogs → objectstore…/api/v1/* | Catalogs → **info…/api/v1/** |
| `FLEET.objectStore` = objectstore | `FLEET.definitions` = info; `objectStore` alias |
| vercel `/api/objectstore/*` → objectstore | → **info.grudge-studio.com** |
| gear presets hard URL objectstore | `fetchCatalogJson("grudge6GearPresets")` multi-host |
| master-weaponSkills single host | `contentCandidates()` multi-host |

---

## 3. Connection matrix (Open browser)

```
open.grudge-studio.com
  │
  ├─ /api/auth/*              → id.grudge-studio.com
  ├─ /api/characters*         → Railway Builder Postgres
  ├─ /api/account*|/wallet*   → Railway
  ├─ /api/objectstore/v1/*    → info.grudge-studio.com/api/v1/*
  ├─ /api/blocks|/worlds      → Mine-Loader Railway
  ├─ /models/grudge6|/textures/grudge6|/anims/baked → R2 / arena
  └─ public/*                 → same-origin lab pack (portraits, local icons)
```

---

## 4. Asset database vs player database

| Store | Role | Character? | Mesh file? |
|-------|------|------------|------------|
| Railway `characters` | Hero row + avatarUrl + model_3d + equipment | **Yes SSOT** | No (refs only) |
| D1 asset_registry | Index of R2 keys | No | Metadata only |
| R2 grudge-assets | Binary blobs | No | **Yes** |
| info API JSON | Design catalogs | Race defs only | Paths/icons in JSON |
| Mine-Loader DB | World cells | Membership cache | Voxel blocks |

Join: `character.race_id` → `RACE_ASSETS` / gear preset → R2 FBX + atlas.

---

## 5. Catalog files Open needs (info host verified 200)

- `races.json`, `weapons.json`, `equipment.json`, `materials.json`, `armor.json`
- `master-items.json`, `master-recipes.json`, `master-weaponSkills.json`
- `grudge6-gear-presets.json`, `grudge6-canonical.json`
- `professions.json`

Fetch via:

```ts
import { fetchCatalogJson, FLEET_CATALOGS } from "./lib/fleetSsot";
const skills = await fetchCatalogJson(FLEET_CATALOGS.masterWeaponSkills);
```

---

## 6. Consolidation rules for agents

1. **One player SSOT** — Railway; namespace `saveData.open` / `saveData.warlords`.  
2. **One definitions host** — info; multi-host fallback ok.  
3. **One binary CDN** — assets.grudge-studio.com.  
4. **D1 is index only** — do not invent character rows in D1 for Open play.  
5. **Portraits ≠ meshes** — avatarUrl/race PNG vs grudge6 kit ([CHARACTER_AVATARS](./CHARACTER_AVATARS.md), [CHARACTER_MESH_DELIVERY](./CHARACTER_MESH_DELIVERY.md)).  
6. **Account bag ≠ character equip** — bag on `/api/account/*`; mesh_ids from character equipment.  
7. **Worlds** — Mine-Loader only for Realms authority.

---

## 7. Smoke (connections)

```bash
curl -sI https://info.grudge-studio.com/api/v1/master-weaponSkills.json
curl -sI https://info.grudge-studio.com/api/v1/grudge6-gear-presets.json
curl -sI https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.fbx
curl -sI https://grudge-api-production-0d46.up.railway.app/api/health
curl -sI https://open.grudge-studio.com/api/objectstore/v1/weapons.json   # after deploy
```

Expect: definitions + binaries + health **200**. After Open deploy, same-origin objectstore proxy returns weapons JSON from info.

---

## 8. Related docs

| Doc | Topic |
|-----|--------|
| [GAMEPLAY_LOAD_STACK.md](./GAMEPLAY_LOAD_STACK.md) | Runtime boot |
| [CHARACTER_MESH_DELIVERY.md](./CHARACTER_MESH_DELIVERY.md) | R2 mesh/atlas/anims |
| [CHARACTER_AVATARS.md](./CHARACTER_AVATARS.md) | 2D portraits |
| [SEED_WORLD_DEPLOY.md](./SEED_WORLD_DEPLOY.md) | Worlds + chunkIdx |
| [OPEN_PRODUCT.md](./OPEN_PRODUCT.md) | Steam shell product |
