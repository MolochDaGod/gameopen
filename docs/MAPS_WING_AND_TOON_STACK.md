# Maps bake · toon style · wing back slot

## 1. Map access (best practice)

**Registry:** `three/maps/mapRegistry.ts` — lists every Open map with assets, bake status, layers, stack modules.

**Live switch:** Admin Test Maps · AI `set_test_world` · `TEST_WORLDS` in `testWorlds.ts`.

**Stack / services**

| Concern | Service / module |
|---------|------------------|
| Definitions | info.grudge-studio.com/api/v1 |
| Binaries | assets.grudge-studio.com · public/models/maps/* |
| Physics | @workspace/grudge-physics Rapier |
| Layers | GamePlayLayers (terrain, climb, swim, burn, claim, …) |
| Harvest | pinata + forest UUIDs + ObjectStore materials |
| Build | CampBuild ghost + BuildGridOverlay 1 m |
| Characters | grudge6 + WingBackRig back slot |
| Player bag | Railway |

### Bake checklist (all new maps)

1. Copy GLB → `public/models/maps/<id>/`  
2. Mesh classify → GamePlayLayers tags  
3. Terrain height sampler  
4. Harvest UUIDs (where dense)  
5. Colliders: trimesh terrain · convex/cuboid harvest · sensors climb/swim/burn/claim  
6. `upgradeMapPresentation(root, { toon: true })` for grudge6 parity  
7. Register in `MAP_REGISTRY` + `TEST_WORLDS`  
8. Pinata / camp build / water band as needed  

Maps marked `toonStyle: true` should call `upgradeMapPresentation` on load (ForestWorld hooks).

---

## 2. Toon style

`three/materials/toonStyle.ts`

- `applyToonStyle(root)` → MeshToonMaterial + 4-step gradient  
- `upgradeMapPresentation(root, { toon: true })` → sRGB/anisotropy + optional toon  
Matches grudge6 cel look without full outline pipeline.

---

## 3. Wing asset review (`wing_animated.glb`)

| Field | Value |
|-------|--------|
| Path | `public/models/equipment/wing_animated.glb` |
| Size | ~1.3 MB |
| Meshes | 29 |
| Skinned | **No** — rigid hierarchy clips |
| Materials | Mat.3, wing, base, Mat.1, base_0 |

### Hierarchy

- **middel / Cylinder_*** — **static circle pack** (only this visible when closed)  
- **left_wing / right_wing** — plane membranes + segment chain `begin…einde`  
- **open/expand/dispand/close_wing_type_1|2** — animation root groups  

### Clips (8)

| Clip | Use |
|------|-----|
| open wing type 1/2 | Parachute / sail open |
| expand wing type 1/2 | Glide / flight |
| dispand wing type 1/2 | Mid collapse |
| close wing type 1/2 | Return to circle pack |

### Runtime: `WingBackRig`

- Attach to **Bip001 Spine2** (or Mixamo Spine2)  
- **Stowed:** hide wing planes; show base circle on back  
- **Modes:** stowed · parachute · glide · flight · **sail**  
- Physics assist: drag / glide / lift / maxFall  
- **Sail** mode adds wind from SailEnvironment (open ocean + waterboard)  

### Back-slot items

| Item id | Mode |
|---------|------|
| back_wing_pack | stowed |
| back_parachute | parachute |
| back_glider | glide |
| back_flight_rig | flight |
| back_sail_deploy | sail → waterboard / ocean |

---

## 3b. Ocean coupling

When `mode === "sail"` and player is on water / waterboard:

1. Wings stay open (open clip)  
2. `applyAirAssist` uses SailEnvironment wind  
3. Future: parent sail mesh to waterboard; wings provide wind catch visual  

---

## 4. Map list (registry)

| Id | Kind | Bake |
|----|------|------|
| danger-room | combat | runtime |
| forest-mountains | harvest | partial (convex bake) |
| tropical-harvest | harvest | runtime |
| shipwreck-island | mixed | runtime |
| arena | build | runtime |
| pirate-village | loco | runtime |
| sailtest | sail | CDN |
| forest-map | harvest | CDN |
| island-life | mixed | CDN |
| fabled-zone | town | CDN |

Full fields: `MAP_REGISTRY` in `mapRegistry.ts`.
