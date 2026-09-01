# Danger Room — goals, loaders, dependencies, environment (SSOT)

**Live:** https://open.grudge-studio.com/danger  
**Engine:** `artifacts/animator/src/three/Studio.ts`  
**Animation law:** [`ANIMATION_FLEET_SSOT.md`](./ANIMATION_FLEET_SSOT.md) · `three/anim/fleetAnimSsot.ts`  
**Updated:** 2026-08-02 (fleet anim lanes + grudge6 mesh SSOT)

---

## 1. Goals (product)

| Goal | Status | Notes |
|------|--------|-------|
| All-era combat lab (`?era=`) | **Live** | Warlords Toon · Voxel Mixamo · nexus/armada Mixamo until dedicated mesh |
| GRUDOX voxel Danger stays on GRUDOX | **Live** | `grudox…/voxgrudge/tvs-showcase.html` — not Open `/danger` |
| Third-person combat sandbox (sparring, bosses, skills) | **Live** | Studio + SparringCombat + arsenal |
| SI world scale (1.8 m human) | **Partial** | Characters convert ~1.7 m; weapons no height-normalize |
| Hand weapons + shield on Bip001 containers | **Live** | `R_hand_container` / `L_shield_container` |
| Full armor equip (closed plate, no skin) | **Partial** | Catalog + Meshy armor-only; grudge6 mesh_ids |
| Back items (cape/quiver) | **Gap** | Slot in armor schema; few/no back meshes |
| Parallel REST + CDN warmup before ENTER | **Live** | `warmupProductionSurface("danger")` |
| Free agentic AI (Danger Room Master) | **Live** | `danger-ai` worker: xAI → Groq → …; tools in dock |
| Fleet SSO + characters from Railway | **Live** | same-origin `/api/*` |

---

## 2. Loaders (mandatory)

| Asset type | Loader | Never |
|------------|--------|-------|
| GLB/glTF | **`sharedGltfLoader()` / `makeGltfLoader()`** | `new GLTFLoader()` alone |
| Compressed GLB | Draco + Meshopt (+ KTX2 after `bindKtx2(renderer)`) | Skip shared pipeline |
| FBX | `FBXLoader` + `loadFbxFirst` multi-host | Fan-out Mixamo 404 spam when pack missing |
| Resolve paths | `resolveAssetCandidates` / `loadGltfFirst` | `assets…/gameopen/*` prefix |

**Source:** `src/three/loaders/gltf.ts`, `fleetAssetResolver.ts`, `assets.ts`.

**Corrected 2026-07-29 to use shared loader:**

- `equipment/armorStand.ts`
- `components/DoorsHeroStage.tsx`
- `three/PunchingBags.ts` (Danger bags)
- `three/explorer/loader.ts`
- `three/lobby/etherealSky.ts`
- `three/voxgrudgeBattle/VoxGrudgeBattleScene.ts`

**Still may use bare loader (non-critical parse paths):** `editor/EditorScene.ts` (parseAsync for user uploads) — prefer `makeGltfLoader()` when touching.

---

## 3. Dependencies (animator)

| Package | Version | Role |
|---------|---------|------|
| `three` | ^0.184.0 | Render |
| `@dimforge/rapier3d-compat` | ^0.19.3 | **Runtime physics (browser)** |
| `@dimforge/rapier3d` | ^0.19.3 | Alias / tooling — prefer **compat** in app code |
| `postprocessing` | ^6.39.2 | Post stack |
| `three-mesh-bvh` | ^0.8.3 | Raycast / BVH |
| `yuka` | ^0.7.8 | AI steering |
| `react` / `react-dom` | ^19 | Shell HUD |
| `vite` | ^6.3 | Build |

**Conflict rule:** Do not import both rapier entrypoints in one module. Dungeon/VoxelArena already use **compat**.

---

## 4. Environment

| Piece | SSOT |
|-------|------|
| Room look | `RoomPresets` — `holo` \| `foundry` \| `colosseum` |
| Shell geometry | `DangerRoom.ts` (door + DJ alcove fixed coords) |
| Test worlds | `setTestWorld` / outdoor packs (CDN) |
| Map import | voxel/arena JSON → `enterArena` |
| Physics | Rapier SI, fixed step; punching bags + sparring |
| Audio | CombatSfx + optional ElevenLabs via danger-ai worker |
| AI | `dangerTools` + `/api/danger-ai` |

**Warmup (`SURFACE_LOAD_PLAN.danger`):**

- REST: health, characters (`era` from picker), account  
- Mesh HEAD: `sword.glb`, `shield.glb`, `bow.glb`, `punching-bag.glb`, `arena-war-zone.glb`

---

## 5. Conflicts resolved

| Conflict | Resolution |
|----------|------------|
| Design catalog icons vs runtime meshes | Prefabs + local/CDN GLB are combat truth; design JSON is stats/icons |
| `voxel/00.obj` 404 on iron sword | → `models/weapons/sword.glb` + resolver alias |
| Bare GLTFLoader vs compressed CDN | Force `sharedGltfLoader` on Danger-critical paths |
| Meshy heroes banned vs armor gen | Meshy **armor-only no skin** via danger-ai |
| ObjectStore vs info catalogs | Prefer `info.grudge-studio.com` / multi-host `fleetSsot` |
| Dual Rapier packages | App physics = **rapier3d-compat** |

---

## 6. Gaps remaining (priority)

| P | Gap | Next action |
|---|-----|-------------|
| P0 | Back item meshes empty | Author/import cape/quiver GLBs; bind spine |
| P0 | Full armor not grudge6 mesh_ids | Wire armor catalog → modular equip |
| P1 | `hunter-rifle.glb` size / scale QA | AABB + LOD + grip |
| P1 | EditorScene bare loaders | `makeGltfLoader()` |
| P1 | Crossbow prefab → rifle.glb stand-in | Dedicated crossbow mesh |
| P2 | Design weapons lack model fields | Seed mesh paths from prefab family map |
| P2 | Cane craft weapons grip SSOT | Extend `Weapons.ts` GRIPS |

---

## 7. Scale math (attach + mesh)

See also `docs/HAND_ARMOR_BACK_ASSET_REVIEW.md`, `docs/ASSET_PRODUCTION_PIPELINE.md`.

- Characters: `--height 1.7 --cm-to-m`  
- Weapons: **no** height normalize; length bands 0.2–2.8 m by family  
- Armor full shell: ~1.65–1.90 m; **no skin**  
- Back: spine parent, not hand

---

## 8. Animation + best-practice development (HARD)

Same law as [`ANIMATION_FLEET_SSOT.md`](./ANIMATION_FLEET_SSOT.md). Do not invent a second mixer or Mixamo-on-Bip001.

| Lane | When | Body | Clips |
|------|------|------|-------|
| `bip001-baked` | `era=warlords` | `loadRaceKit` / GrudgeAvatar Toon GLB | `/anims/baked/{pack}` rotation-only |
| `mixamo-explorer` | `era=voxel` (and nexus/armada until dedicated) | `ExplorerCharacter` (`id=explorer`) | Mixamo clips through `stabilizeClipForMixer` |

**Every clip before `clipAction`:**

1. Filter unbound tracks  
2. **Strip `.position` tracks** (hips included)  
3. Freeze leftover hip XYZ to bind after feet sit  
4. One mixer on the skinned body  
5. After `mixer.update`: `groundFeetLocal` + IK on the **same** `heightAt` as Rapier  

Sprint = clone `run` × 1.75 — never bind `locomotion/running` (run-to-roll). Never alias jump/dodge onto attack.

Playtests: `artifacts/animator` `npm test -- src/playtest/` · `src/lib/dangerPlayableCharacter.test.ts` · `src/lib/entryCatch.test.ts`.  

---

## 8. Related docs

| Doc | Topic |
|-----|--------|
| `DANGER_ROOM.md` | Combat UX + AI tools list |
| `DANGER_ROOM_MASTER_AI.md` | Free AI worker |
| `MESHY_ARMOR_ONLY.md` | Armor-only Meshy |
| `GAME_AUDIO_ELEVENLABS_AND_DOCKER.md` | SFX/VO + Docker CI |
| `HAND_ARMOR_BACK_ASSET_REVIEW.md` | Inventory + scale bands |
| `UNITY_TO_OPEN_ASSET_MIGRATION.md` | Unity race kits → bones, back, harvest, textures |
| `productionSystemsPattern.ts` | Warmup + kill list |
