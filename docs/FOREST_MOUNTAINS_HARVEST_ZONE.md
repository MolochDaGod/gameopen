# Forest Mountains — dense harvest node zone

**Source:** `D:\Games\Models\the_landscape_is_a_forest_in_the_mountains (1).glb`  
**Open asset:** `public/models/maps/forest_mountains/forest_mountains.glb` (~11 MB)  
**Loader:** `three/maps/forestMountainsMap.ts`  
**Bake:** `three/harvest/forestHarvestBake.ts` + `PhysicsWorld.addStaticConvexHull`  
**Test map:** `forest-mountains` (Admin / `set_test_world`)

---

## 1. Why geometry classification (not names)

This pack is AI / carve.photos style: **546 meshes**, **10 materials**, **944 nodes**.  
Node names are hashes and `Dupli|N` instances — English keywords (`tree`, `rock`) do **not** appear.

| Signal | Use |
|--------|-----|
| **Footprint × height aspect** | Terrain vs wood vs ore vs forage |
| **Material key** | Cluster same asset variants |
| **Largest footprint** | Heightmap / nav layer |
| **Dupli instances** | Generative field of same prop |

### Geometry rules (SI after scale=1)

| Role | Heuristic |
|------|-----------|
| **ground** | Large footprint (≥ ~12% of largest) and relatively flat |
| **wood** | Height ≥ 2.2 m and tall aspect (or height ≥ 3.5 m) |
| **ore** | Mid height 0.45–5 m, squat aspect, medium footprint |
| **forage** | Low height & small footprint |
| **skip** | Tiny debris |

### Harvest definitions (`hrvd_*`)

| Def | Kind | Tool | Material | Collider | Anim roles |
|-----|------|------|----------|----------|------------|
| `hrvd_fm_pine_tree` | wood | axe | pine-log | convex | harvestChop |
| `hrvd_fm_canopy_tree` | wood | axe | oak-log | convex | harvestChop |
| `hrvd_fm_boulder` | ore | pick | iron-ore | convex | harvestMine |
| `hrvd_fm_ore_rock` | ore | pick | copper-ore | cuboid | harvestMine |
| `hrvd_fm_forage` | forage | hand | cotton-thread | cuboid | harvestGather |

---

## 2. UUID identity (Mine-Loader aligned)

| Prefix | Meaning | Example |
|--------|---------|---------|
| `hrvd_` | Definition template | `hrvd_fm_pine_tree` |
| `hrvl_` | Location (deterministic cell) | worldSeed + floor(x,y,z) + slug |
| `hrvi_` | Live instance | seed + mesh key |

Helpers: `three/harvest/harvestIds.ts`  
On mesh `userData`: `harvestId` / `harvestInstanceId` / `harvestLocationId` / `harvestDefId` / `playerSwing` / `breakFx` / `chunkCount` / `colliderType`.

---

## 3. Terrain layer + heightmap

1. Sort meshes by XZ footprint  
2. Keep largest as **terrain** (nav + receiveShadow)  
3. `createTerrainHeightSampler(terrainMeshes)` → Controller `setGroundHeightAt`  
4. Feet raycast for loco on mountain shell  

---

## 4. Raycasting

| Use | API |
|-----|-----|
| Loco feet | `heightAt(x,z)` |
| Harvest pick | `raycastForestHarvest(map, raycaster)` or ForestWorld `pickHarvest` via `harvestId` |
| Build grid | not primary (harvest zone); optional ground set |

---

## 5. Convex “null” / hull colliders (bake)

Not empty null meshes — **convex hull colliders** from sampled world verts:

- Trees / boulders → `RAPIER.ColliderDesc.convexHull(points)`  
- Small rocks / forage → cuboid half-extents  
- Terrain → static trimesh (capped tris)  

`ForestHarvestBake.bake(map)` after load · Studio `rebakeHarvestPhysics()`.

Pinata: same `hrvi_` ids registered → stage HP → chunk burst → bag absorb.

---

## 6. Generative harvest field

The GLB already is a **baked generative field** (hundreds of Dupli instances on terrain).  
Loader does **not** re-scatter randomly; it **identifies** each instance as a harvest node with stable UUIDs so:

- Co-op peers share the same `hrvl_` pins  
- Pinata / AI tools can target by id  
- Respawn can re-enable the same location  

Cap: `maxHarvest` default 200 for runtime perf.

---

## 7. Q&A learning loop

1. Load **Forest Mountains** → flash stats wood/ore/forage  
2. Walk heightmap (no fall-through)  
3. Aim axe at tall trees · pick at boulders · hand forage  
4. Pinata break → material bag + profession XP  
5. AI: `set_test_world id=forest-mountains` · inspect `userData.harvestLocationId`  

---

## 8. Files

| Path | Role |
|------|------|
| `maps/forestMountainsMap.ts` | Load · classify · UUID nodes · raycast |
| `harvest/harvestIds.ts` | hrvl/hrvi/hrvd |
| `harvest/forestHarvestBake.ts` | Rapier convex/trimesh bake |
| `PhysicsWorld.addStaticConvexHull` | Hull bodies |
| `public/models/maps/forest_mountains/` | GLB + mesh-catalog.json |

---

## 9. Follow-ups

- Offline bake JSON export (`exportHarvestBakeManifest`) → R2 for co-op  
- LOD: hide distant Dupli, keep collider  
- Navmesh bake from terrain for AI path between nodes  
- TwoBone IK harvest swings (Mine-Loader)  
