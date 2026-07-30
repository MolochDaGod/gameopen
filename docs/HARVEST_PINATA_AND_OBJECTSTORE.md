# Warlords harvest · professions · tools · pinata · ObjectStore

**Live definitions:** [info.grudge-studio.com](https://info.grudge-studio.com) · API base `https://info.grudge-studio.com/api/v1/`  
**CDN icons/meshes:** `https://assets.grudge-studio.com/`  
**Player bag / professions XP:** Railway Postgres (`grudge-api-production-0d46`) — **not** ObjectStore  

Open runtime (Danger): `artifacts/animator/src/three/harvest/*` + `game/inventory/*`

---

## 1. SSOT map (what owns what)

| Truth | Source | Clients must |
|-------|--------|--------------|
| Materials, recipes, professions trees, consumables, master items | ObjectStore JSON `api/v1/*` | GET + cache; never invent ids |
| Icons (9,724 ICON-\*) | `icon-registry` + shards · CDN `game-assets/icons/…` | `resolveIconUrl` / shard `cdnUrl` |
| 3D harvest meshes / nature | R2 `models/nature/*`, `models/environment/island_*` | Prefer organized nature; ban megakit |
| Character bag, account vault, island harvest state | Railway `/api/characters`, `/api/account/*`, `/api/island/*` | JWT write path |
| Voxel/block harvest defs | Mine-Loader `lib/harvest/defs.ts` (`hrvd_*`) | Align tools/HP/drops |
| Danger outdoor nodes | ForestWorld + tropical/pirate loaders | Tag `userData.harvest` → pinata |

### Do not use

- `api.grudge-studio.com` as character/bag SSOT  
- ConvexObjectBreaker as production harvest (demos only)  
- Local emoji-only materials without ObjectStore icon path  
- Puter KV alone as bag/XP  

---

## 2. Professions & gathering (ObjectStore)

`GET /api/v1/professions.json`

### Craft professions (5)

| Id | Role | Icon shard |
|----|------|------------|
| **miner** | Weaponsmith / armorsmith (metal) | `icons/professions/miner_profession_game_icon.png` |
| **forester** | Bowyer / leatherworker | `forester_profession_game_icon.png` |
| **mystic** | Staves / cloth / enchants | `mystic_profession_game_icon.png` |
| **chef** | Foods / potions | `chef_profession_game_icon.png` |
| **engineer** | Guns / crossbows / mech | `engineer_profession_game_icon.png` |

### Gathering tracks (`professions.gathering`)

| Track | Feeds into | Tiered resources (examples) |
|-------|------------|-----------------------------|
| **Mining** | Miner, Engineer, Mystic | Iron/Copper ore T1 → Infinity Ore T8 |
| **Logging** | Forester, Engineer | Pine/Oak log T1 → Godwood T8 |
| **Skinning** | Forester | Rawhide → hardened leather |
| **Fishing** | Chef | Fish tiers |
| **Herbalism** | Mystic, Chef | Herbs / essences |
| **Scavenging** | Engineer, Miner | Scrap / wash-up |

Open bag tools (`harvestTools.ts`) map activity tools to profession XP tracks:

| Tool | Profession track | Activity tool |
|------|------------------|---------------|
| Hatchet | logging | axe / chop |
| Pickaxe | mining | pick / mine |
| Sickle | gathering | sickle / forage |
| Skinning knife | skinning | knife |
| Fishing rod | fishing | rod |
| Hoe | farming | hoe |

**Rule:** one-time craft tools; power scales with profession level (not separate tool XP).

---

## 3. Materials & icons

`GET /api/v1/materials.json` — categories:  
`ore, ingot, wood, plank, fabric, component, herb, cloth, leather, essence, gem`

`GET /api/v1/icon-shards/material.json` — **86** icons, e.g.:

| Material id | Path |
|-------------|------|
| `iron-ore` | `/icons/materials/iron-ore.png` |
| `oak-log` | `/icons/materials/oak-log.png` |
| `oak-plank` | `/icons/materials/oak-plank.png` |
| `rawhide` | `/icons/materials/rawhide.png` |
| `copper-ore` | `/icons/materials/copper-ore.png` |

CDN resolve:

```
https://assets.grudge-studio.com/game-assets/icons/materials/{slug}.png
```

Open helpers: `src/lib/objectStore.ts`  
Bag short ids ↔ ObjectStore: `wood` → `oak-log`, `ore` → `iron-ore`, …

Also use:

| Endpoint | Use |
|----------|-----|
| `consumables.json` | Foods / potions icons |
| `master-recipes.json` | Craft graph |
| `refine-recipes.json` | Smelt / mill / weave |
| `icon-shards/consumable.json` | Consumable icons |
| `icon-category-index.json` | Browse categories (9724 total) |
| `ICON_BROWSER.html` | Human search |

---

## 4. Registered systems to use (info / fleet)

| System | URL / package | Harvest role |
|--------|---------------|--------------|
| ObjectStore definitions | `info…/api/v1/*` | Materials, professions, recipes |
| Grudge SDK | `objectstore…/sdk/grudge-sdk.js` | `getWeapons`, search, tier colors |
| Railway game API | `grudge-api-production-0d46…` | Bag deposit, professions persist |
| Grudge ID | `id.grudge-studio.com` | JWT |
| Crafting Puter | `grudge-crafting.puter.site` | Account bag craft UX |
| Home island contract | `home-island-contract.json` | 1024 m, 4 h regen, foundations |
| Biome ecosystems | `biome-ecosystems.json` | Animals / tree policy |
| Organized nature | `organized-nature-manifest.json` | Allowed tree/rock GLBs |
| Mine-Loader harvest | `mine-loader/…/lib/harvest/*` | Defs, layers, debris, IK |
| Island3D / client | `client.grudge-studio.com` | Production island harvest |
| Open pinata (new) | `three/harvest/pinataHarvest.ts` | Danger map pinata absorb |

### Nature policy (home / production)

**Banned:** `CommonTree_*`, megakit rocks/pines under lowpoly paths.  
**Use:** `models/nature/organized/*`, `models/environment/island_{tree,rock}.glb`, `gem_cluster.glb`.

---

## 5. Pinata Three.js system (prepared)

**Not** ConvexObjectBreaker. **Valheim-style** staged HP + InstancedMesh debris (skill: `threejs-helpers-physics-terrain`).

### Modules (Open)

| File | Role |
|------|------|
| `three/harvest/layers.ts` | Bitmask WORLD / HARVESTABLE / TOOL / DEBRIS … |
| `three/harvest/colliders.ts` | Cuboid/sphere/trimesh plans for Rapier bake |
| `three/harvest/debrisPool.ts` | Physics pool + magnet absorb |
| `three/harvest/pinataHarvest.ts` | Node HP stages → burst → bag |
| `lib/objectStore.ts` | Icons + bag↔material mapping |

### Flow

```
LMB select harvest node (ForestWorld / tropical / pirate)
  → register Pinata node (hp, tool, materialId)
  → hit with tool gate (axe/pick/…)
  → stage scale: full → cracked → half → stub → depleted
  → break: hide mesh, spawn DebrisPool burst (pinata chunks)
  → settle ~0.55s → magnet toward player (or unit absorb pos)
  → absorb: harvestIntoBag(characterId, bagId, qty)
  → flash + optional HUD icon from materialIconCdn
```

### Colliders (prepare for Rapier)

```ts
colliderPlanForHarvestObject(mesh)
// HARVESTABLE → cuboid halfExtents from Box3
// DEBRIS → sphere sensor
// ground/nav → trimesh
// colliderPlans() on PinataHarvestSystem for batch bake
```

Layers match Mine-Loader `TOOL_HIT_MASK` / `MOVE_COLLIDE_MASK`.

### Absorb into player / unit

- **Player:** `harvestIntoBag` → 3×3 character bag (deposit to account vault separately).  
- **Unit (RTS worker):** pass `getUnitAbsorbPos` so chunks magnet to unit, same bag or unit inventory callback.  
- Do **not** double-count: pinata break skips full `applyHarvestYield` on final break; partial hits may chip small yield for feel.

---

## 6. Implementation status (recommended order)

| # | Work | Status |
|---|------|--------|
| 1 | Rapier bake from `colliderPlans()` | **Done** — `HarvestPhysicsBake` + `PhysicsWorld.addStaticCuboid/Sphere` |
| 2 | Prefetch materials + icon shard on harvest UI | **Done** — `prefetchObjectStoreMaterials` |
| 3 | Expand bag templates to ObjectStore ids | **Done** — static seed + live hydrate |
| 4 | Profession XP on absorb (+ Railway PATCH) | **Done** — `professionXp.ts` |
| 5 | Unit worker magnet vacuum | **Done** — camp claim roster near selected node |
| 6 | Respawn timers | **Done** — Danger 45s; sailtest/island/fabled 4h |
| — | Network host HP / tool mesh IK | Still open |

---

## 7. Quick agent checklist

1. Definitions? → `info…/api/v1/materials.json` + `professions.json`  
2. Icon? → `icon-shards/material.json` or `materialIconCdn(id)`  
3. Mesh? → R2 organized nature / island harvest packs  
4. Break VFX? → `PinataHarvestSystem` / Mine-Loader `DebrisPool`  
5. Bag? → `harvestIntoBag` then deposit → Railway  
6. Never? → ConvexObjectBreaker as SSOT; invent material ids without ObjectStore  

---

## 8. Tropical island style + geometric ore (Valheim)

| Piece | Role |
|-------|------|
| `three/maps/tropicalOreStyle.ts` | Extract `RocksBig`/`RocksSmall` textures; style beach/palms; **geometric ore clusters** |
| Ore veins | `copper-ore`, `iron-ore`, `steel-ore`, `mithril-ore`, `scrap-ore` (ObjectStore ids) |
| Look | Angular rock chips (island albedo) + crystal icosa/octa facets + vein emissive |
| Pinata debris | Octahedron instances tinted per material id |
| Map | Test Map **Tropical Harvest** — pick ore → stage crack → pinata break → absorb |

Strange island rocks (RocksBig/Small assemblies) are retagged as minable ore veins; scatter adds pure geometric chunks for clear Valheim mining Q&A.

## 9. Related docs

- `mine-loader/docs/HARVEST_SYSTEM.md`  
- `docs/DANGER_MAP_MOBILITY_AND_PIRATE_VILLAGE.md`  
- ObjectStore docs: Creation of Truth, Production Wiring, Nature Assets  
- Skills: `grudge-warlords-assets`, `grudge-rapier`, `threejs-helpers-physics-terrain`, `grudge-production-wiring`
