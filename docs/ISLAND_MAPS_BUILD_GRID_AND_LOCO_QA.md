# Island maps · build grid · climb/swim/build Q&A

**Maps reviewed (mesh-by-mesh):**
| File | Path in Open | Size | Meshes |
|------|----------------|------|--------|
| `arena (1).glb` | `public/models/maps/arena/arena.glb` | ~19 MB | ~1624 |
| `shipwreck_island.glb` | `public/models/maps/shipwreck/shipwreck_island.glb` | ~1 MB | 19 |

**Loaders:** `three/maps/arenaMap.ts`, `shipwreckIslandMap.ts`, `islandMapLayers.ts`  
**Build overlay:** `three/build/BuildGridOverlay.ts` (1 m SI snap + ground raycast)  
**Ghost build:** `CampBuildSystem` — LMB place · RMB continue · **R rotate** · Esc cancel  

---

## 1. Shipwreck island — mesh roles

| Node / material | Role | Game use |
|-----------------|------|----------|
| **World** (Sprytile tilemap) | **ground** | Nav height, **build grid raycast**, loco |
| **Water**, **Waterfallend** | **swim** | `setWaterBand`, swim/wade Q&A |
| **Ladders** | **climb** | Climb sensor / SurfaceLocomotion |
| **Palmtree_*** , **Tree** | **harvest** wood | Axe · pinata · `oak-log` |
| **Rock** | **harvest** ore | Pick · pinata · `iron-ore` |
| **Lighthouse.*** | **solid** | Collider / block build |
| **Ship** | **vehicle** | `vehicleKind=boat` |
| **Grave**, **lily** | **prop** / light interact | Atmosphere |

**Scale:** default `1.0` (SI). Adjust if props vs 2 m orc feel wrong.  
**Q&A focus:** climb ladders → swim water → axe palm → pick rock → board ship → **build mode** 1 m grid on World.

---

## 2. Arena — mesh roles (summary)

| Material / name pattern | Role | Notes |
|-------------------------|------|--------|
| **Sand**, **Grass**, Arène_base, Décors grass | **ground** | Combat floor + **build grid** |
| **Rock** / Rock1–4 spheres | **harvest** | Minable; not chains |
| **Tore*** + **Chaine*** (Metal) | **prop** | Chain rings — **not** ore |
| **Escalier** / stairs | **climb** | Stairs as climb volumes |
| **Barrière**, Rail, boxes, barrels | **solid** / **interact** | Barriers; tonneau/boite interact |
| Helmets, shields, flags | **prop** | Flavor |
| Cameras / Proj. libre | **exclude** | Hidden |

**Scale:** default `1.0`. Measure human props if 100× unit risk.  
**Q&A focus:** combat on sand · stairs climb · rock pick · ghost **bench/wall/forge** on 1 m grid.

---

## 3. Colliders & nav

| Layer | Collider plan | Nav |
|-------|---------------|-----|
| ground | trimesh (height sampler) | `navSources` → `createTerrainHeightSampler` |
| solid / vehicle | trimesh or cuboid | blocking |
| climb / swim | sensor_box | SurfaceLocomotion |
| harvest / interact | cuboid | pinata / E interact |

Bake via `HarvestPhysicsBake` + pinata plans after map load (same as tropical).

---

## 4. Build grid overlay (islands)

```
Build mode (Q → build)
  → BuildGridOverlay visible (1 m SI)
  → raycast camera/forward → ground meshes
  → snap XZ to snapM
  → CampBuildSystem ghost follows hit
  → R rotate · LMB place · RMB place+continue
```

Placeables (benches, walls, forge, claim flag, storage, …): `three/camp/placeables.ts`  
Claim gate: claim flag within radius for most structures.

---

## 5. Voxel assets · characters · controllers · AI (inventory for Q&A)

| System | Where | Use for Q&A |
|--------|--------|-------------|
| **Voxel placeables** | Mine-Loader blocks · `voxelAiTools` · `content/harvest` | Dig/build voxels vs island mesh build |
| **Animation-ready heroes** | grudge6 / GameSession / Foundry · Bip001 packs | Climb/swim/harvest anim roles |
| **Controller** | `Controller.ts` wall-run, water band, ground height | Climb/swim/wade gates |
| **Camp build** | `CampBuildSystem` + ghost | Rotate + click-to-snap buildings |
| **Pinata harvest** | `three/harvest/*` | Ore/wood break on maps |
| **AI workers** | Danger Master tools · `playtest_*` · `set_test_world` | Switch maps, run loco suites |
| **Professions / bag** | ObjectStore + `professionXp` + bag | Learn gather → craft → place |

**Playtest suites:** locomotion, pathfinding, tropical-harvest, map-scale — extend with climb/swim/build checks on shipwreck/arena.

---

## 6. Test maps (Admin / `set_test_world`)

| Id | Default mode |
|----|----------------|
| `shipwreck-island` | build (grid on) |
| `arena` | build (grid on) |
| `tropical-harvest` | harvest |
| `pirate-village` | harvest |
| `danger-room` | combat |

---

## 7. Learning loop (AI / Q&A)

1. **Climb** — shipwreck Ladders; arena Escalier · expect climb state, not free fall  
2. **Swim** — shipwreck Water · water band · swim/tread clips  
3. **Build** — ghost blue valid / red invalid · R rotate 45° · snap 1 m · benches/walls/forge from placeables  
4. **Harvest** — pick/axe · pinata absorb · profession XP  
5. **Characters** — swap grudge6 hero · verify scale vs door/ladder (orc 2 m)  

Danger Master: `set_test_world id=shipwreck-island` · `set_test_world id=arena`
