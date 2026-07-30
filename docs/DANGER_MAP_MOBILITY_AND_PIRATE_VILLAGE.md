# Danger Room: Mobility Locomotion + Pirate Village Map (Orc 2 m base)

**Live target:** https://open.grudge-studio.com/danger  
**Test assets (Documents):**
- `test_low_poly_pirates_village_life_pack.glb` (~7.3 MB, Sketchfab village)
- `date_palm.glb` (~7 MB, multi-tree, **cm-scale raw**)
- `palm_trees.glb` (~4.6 MB, **SI metres**, good hero props)

---

## 1. Research — Three.js locomotion patterns (web + forums)

### Character physics (authoritative)

| Source | Pattern for Grudge |
|--------|-------------------|
| [Rapier Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/) | **Use for ground/climb/ladder steps** — autostep, snap-to-ground, obstacle slide. SI metres, fixed 1/60. |
| Medium / JS Alliance Rapier WASD tutorials | Kinematic body + CharacterController for doorways; enableAutostep ~0.3–0.4 m for orc step-up. |
| Fleet `Controller.ts` | Already has **wall-run** (Shift+air+wall probe), wall jump, SurfaceLocomotion (ground/wade/swim/climb/boat). |

### Navigation

| Source | Pattern |
|--------|---------|
| [donmccurdy/three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | Bake **walkable floor only** to a navmesh GLB/OBJ (+Y up). `Pathfinding.createZone(geometry)`, `findPath`, `clampStep` for FPS. |
| three.js forum R3F + pathfinding | Path cache + recalc on player move throttle; separation for many agents — pair with **Yuka** FollowPathBehavior. |
| Agent sizing | **2 m orc** → nav agent radius **0.5–0.55 m**, height **2.0–2.2 m**, door clear **≥ 2.45 m**. Multiple navmeshes or edge-width filtering if mixed human/orc. |

### Mobility animation (clip roles, not one mega-state-machine)

Industry / web practice for Three:

| Mode | Physics | Clip roles (bake Bip001) | Notes |
|------|---------|--------------------------|-------|
| **Wall run** | Stick to wall normal, reduce gravity, lateral along tangent | `wallRun` loop | Controller already; **do not** use as ground sprint. |
| **Wall jump** | Impulse off wall normal + up | `jump` / `jumpAway` one-shot | Space during wall-run. |
| **Climb / ladder** | Snap to climb volume, move along up axis | `climb` / `climbUp` / `climbDown` | Ladder = climb layer collider (sensor + constraint). |
| **Mantle / top-out** | Short root motion or tele + one-shot | `mantle` | End of climb when head clears ledge. |
| **Swim** | Buoyancy / reduced gravity, planar move | `swim` loop | Water volume top plane. |
| **Tread** | Near-zero speed in water | `tread` | Idle in swim surface. |
| **Swim → ledge** | Exit volume + mantle | `swimExit` then `mantle` | Tool: swim-to-edge Mixamo. |
| **Crawl** | Lower capsule height, slower | `crawl` / `crouchWalk` | Capsule half-height drop. |
| **Fall** | Airborne vertical < 0 | `jumpAir` / fall loop | Bow pack already has `fall-a-loop`. |
| **Land** | Grounded edge from air | `land` / `landRoll` | Short land vs roll if fall speed > threshold. |
| **Dive to water** | Airborne over water volume + look down / high fall | `dive` then `swim` | Raycast water band before land. |
| **Hit reaction** | Additive or upper-body layer | `hurt` / directional hits | Cross-fade 0.06–0.1; recover to loco. |
| **Ragdoll knockback** | Heavy force / poise break | Switch rigid body to **dynamic multi-body** or root impulse + `hitfly`/`death` clip | Full ragdoll rare on web — hybrid: **impulse + hitfly clip** then get-up. |

### Hit blends & ragdoll (practical web)

From Three/web practice and our fleet:

1. **Light hit** — additive `hurt` on upper body or full-body 0.2–0.35 s interrupt (interruptible).  
2. **Medium** — full `hurt` + small root impulse (Controller.applyImpulse).  
3. **Heavy knockback** — `hitfly` / `hitback` (polearm bake has these) + large impulse; optional **soft ragdoll** (dynamic capsule + limbs delayed).  
4. **True multi-body ragdoll** — expensive; use only on death / finisher. Prefer **animation-driven ragdoll blend** (hitfly → death).  

Never use banned gait clips (`locomotion/running` = run-to-roll) for fall/land.

---

## 2. Pirate village asset audit (measured)

### `test_low_poly_pirates_village_life_pack.glb`

| Metric | Value |
|--------|-------|
| Source | Sketchfab export |
| World bbox (gltf-transform scene) | ~9.7 × **1.86** × 10.1 m (miniature) |
| Raw mesh extents | ~970 × 184 × 1008 (parent scale applied in scene) |
| Mesh count | **105** |
| Content tags | Water×1, Boat×1, Raft, Rock×14+, Palm×20, Tree×17, Mangrove, Barrel×3, Landscape, Huts, Stairs, Tower, Torches, Boxes, Bags… |

**Issue:** Whole island height ≈ **human height** → doorways unusable for **2 m orc**.

### Recommended production scale (2 m orc base)

| Constant | Value | Why |
|----------|-------|-----|
| `ORC_HEIGHT_M` | **2.0** | Base character |
| `DOOR_CLEAR_M` | **2.45** | Pass under lintel |
| `AGENT_RADIUS_M` | **0.52** | Orc width + armor |
| `VILLAGE_UNIFORM_SCALE` | **4.0** | 1.86 m × 4 ≈ **7.4 m** vertical budget for huts/tower; doors ~2.4–2.8 m if authored proportionally |
| Island footprint after scale | ~**39 × 40 m** | Playable Danger arena slice |

Tune after first load: measure `Hut_*` / `Stairs_*` door opening in Blender/Forge; set  
`scale = DOOR_CLEAR_M / measured_door_height`.

### Palm replacements

| Asset | Size (raw) | Use |
|-------|------------|-----|
| `palm_trees.glb` | ~4.7 × **3.2** × 6.4 m | **Prefer SI** — place as harvest trees |
| `date_palm.glb` | ~546 × 734 × 521 | **Likely cm** → scale **0.01** → ~5.5 × 7.3 m hero palms |

**Recipe:** Hide/delete village `Palm_2_*` / weak `Tree_*` instances; instance `palm_trees` / scaled `date_palm` at those transforms with harvest tags.

### Mesh → gameplay layers (name rules)

| Name match | Layer | Collider | Interact |
|------------|-------|----------|----------|
| `Water_*` | **swim** | Sensor volume (no solid) | Enter swim / dive |
| `Landscape_*`, `Sand_*`, terrain | **ground** | Trimesh / height | Walk navmesh |
| `Rock_*`, `Big_Rock_*` | **solid** + **mine** | Convex/trimesh | Harvest ore |
| `Palm_*`, `Tree_*`, `Mangrove_*` | **solid** + **chop** | Capsule trunk | Harvest wood |
| `Hut_*`, `Tower_*`, `Cell_*`, `Fence_*` | **solid** | Trimesh | Block nav |
| `Stairs_*` | **ground** + climbable | Trimesh + autostep | Walk |
| `Boat_*`, `Raft_*` | **boat** / vehicle | Hull trimesh + float | Sail test |
| `Barrel_*`, `Box_*`, `Bag_*`, `Coconut_*` | **prop** + harvest | Convex | Loot / break |
| Ladder (add if missing) | **climb** | Ladder volume | Climb up/down |

Village has **no ladder mesh** — add ladder prop (Kenney / pirate-kit) on tower/hut side.

---

## 3. Systems to implement (Danger)

### A. Map production loader

`three/maps/pirateVillageMap.ts` (code SSOT):

1. Load village GLB (same-origin `/models/maps/pirate-village.glb` after copy).  
2. Apply `VILLAGE_UNIFORM_SCALE` + Y re-ground (feet of landscape at y=0).  
3. Classify meshes → `userData.gameLayer`, `userData.harvest`, `userData.nav`.  
4. Build Rapier colliders by layer.  
5. Replace palms with better GLBs.  
6. Spawn ore nodes on rock cluster centroids.  
7. Water band from Water mesh AABB → Controller `waterBand`.  
8. Optional: extract Landscape mesh → simplify → **navmesh** for three-pathfinding.

### B. Mobility clips (bake queue)

Already mapped in `content/anims/bake-plan.json` + `MOBILITY_CLIPS`. Extend:

| Role | Mixamo / pack | Trigger |
|------|---------------|---------|
| wallRun | climb/wall-run | Controller wall run |
| jump / jumpAway | locomotion/jump | Jump / wall jump |
| fall / jumpAir | bow fall-a-loop | Airborne falling |
| land | fall-a-land | Land soft |
| landRoll | striker roll | Fall speed > threshold |
| dive | bow standing-dive-forward | Enter water from air |
| swim / tread / swimExit | anim/swim/* | Water surface |
| climb* / mantle / hang | anim/climb/* | Climb volumes |
| crawl | reactions/running-crawl (temp) | Crawl mode |
| hurt / hitfly / death | polearm bake | Poise / heavy KB |

### C. Navmesh bake notes

1. After scale, export **Landscape + Stairs** only (no props) as walkable.  
2. Blender: remesh / Decimate → NavMesh bake (or Recast CLI).  
3. Agent: height 2.1, radius 0.52, max slope 45°, step 0.4.  
4. Doorways: ensure nav portal width ≥ **1.2 m** for orc.  
5. `three-pathfinding` zone id `danger-pirate`.  
6. Yuka vehicle follows path waypoints; repath every 0.5–1 s.

### D. Sailing

- Tag Boat/Raft → `vehicleKind: "boat"`.  
- Controller already has vehicle surface mode — mount, planar move, no wall-run.  
- Production HUD: mount prompt, speed, dismount.

### E. Production HUD + characters

- Danger deployed characters: `loadGrudge6CombatRig` + gear presets (orc = BRB/ORC race 2 m fit).  
- Harvest HUD: already activity modes harvest/build/combat (Q).  
- Crosshair variants for swim/climb exist in App.

---

## 4. Collider & layer bitmasks (suggested)

```
LAYER_GROUND   = 0x0001
LAYER_SOLID    = 0x0002
LAYER_CLIMB    = 0x0004
LAYER_SWIM     = 0x0008
LAYER_HARVEST  = 0x0010
LAYER_TRIGGER  = 0x0020  // doors open volume
LAYER_VEHICLE  = 0x0040
LAYER_PLAYER   = 0x0100
LAYER_NPC      = 0x0200
```

Player CCT collides with GROUND|SOLID|VEHICLE; queries CLIMB|SWIM as sensors.

---

## 5. Immediate ops checklist

1. Copy assets into `artifacts/animator/public/models/maps/pirate/`  
2. Set village scale **4** (or measure door → formula)  
3. Palm swap: instance `palm_trees.glb` + `date_palm.glb * 0.01`  
4. Tag rocks mineable, trees choppable  
5. Water band from Water mesh  
6. Add ladder mesh + climb volume on Tower  
7. Bake navmesh from Landscape  
8. Bake mobility clips P1 from bake-plan  
9. ~~Wire map into Danger~~ → **live as Test Map `pirate-village`** (Admin → Test Maps / AI `set_test_world`)  
10. Playtest: orc walk doorways, climb ladder, swim, sail boat, mine rock, chop palm  
11. Still open: Rapier colliders from `colliderPlanForObject`, navmesh bake, boat sail HUD  

---

## 6. Tropical island harvest nodes (Q&A map)

**Source:** `Documents/tropical_island.glb` (~69 MB)

| Action | Result |
|--------|--------|
| Remove | Water (`Material.001` / Armature plane), Skybox |
| Generative harvest | 12× palms (Cat/Areca/Tropical), Palme + fronds, driftwood, forest root, RocksBig, RocksSmall |
| Ground | BeachBaked |
| Scale | **1.0** default (beach ~60×47 m); pass `scale: 0.01` only if cm export |

```bash
cd artifacts/animator
node scripts/extract-tropical-island-harvest.mjs
# → public/models/maps/tropical/{tropical_island,tropical_island_dry}.glb + harvest-catalog.json
```

**Runtime:** `loadTropicalHarvestTestMap({ scatter: true })` via ForestWorld when Test Map = `tropical-harvest`  
**Playtest:** `run_playtest_suite suite=tropical-harvest` / tool `playtest_tropical_harvest`  
**Live switch:** Admin **Test Maps** → Tropical Harvest · Danger Master tool `set_test_world id=tropical-harvest`

Scatter ore/wood instances for controller loco (walk/run/crawl among props) and harvest Q&A.

---

## 6b. Live wiring (shipped in Open SPA)

| TestWorldId | Loader | Controller |
|-------------|--------|------------|
| `tropical-harvest` | `loadTropicalHarvestTestMap` (local public GLB) | hide chamber, ground height from Beach, **no water band**, harvest mode + nodes |
| `pirate-village` | `loadPirateVillageMap` (village + better palms + ladder) | hide chamber, water band from Water mesh, harvest nodes, expanded bound |

SSOT: `src/three/testWorlds.ts` · load: `ForestWorld.ts` · apply: `Studio.setTestWorld`  
UI: Admin panel **Test Maps** · AI: `set_test_world`

## 7. References

- Rapier Character Controller docs  
- three-pathfinding README (createZone / findPath / clampStep)  
- Fleet: `Controller.ts` wall-run + SurfaceLocomotion  
- `docs/DANGER_PLAYTESTERS.md`, `content/anims/bake-plan.json`  
- SI: `grudge-world-scale` (1.8 m human; orc 2.0 m base)  
