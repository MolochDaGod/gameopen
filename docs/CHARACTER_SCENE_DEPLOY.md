# Character scene deployment — XZ, Y, facing (Three.js)

**Live surfaces:** https://open.grudge-studio.com/play · `/danger`  
**Code SSOT:** `artifacts/animator/src/three/characterDeploy.ts`  
**Mesh delivery:** [CHARACTER_MESH_DELIVERY.md](./CHARACTER_MESH_DELIVERY.md)  
**Skills:** **`grudge-character-correctness`** (required — hip-float / sideways / packs), `threejs-production-best-practices`, `grudge6-modular-characters`, `grudge-warlords-assets`

---

## 1. Three.js world frame (docs)

| Concept | Three.js default | Grudge Open |
|---------|------------------|---------------|
| Up axis | **+Y** (`Object3D.up`) | Same |
| Ground plane | **XZ** | Feet on `y = groundY` (usually 0) |
| Units | Author choice | **1 unit = 1 metre** |
| Camera look | −Z | TPS orbit; not character art-forward |
| Character art-forward | Author | **Local +Z** when `root.rotation.y = 0` |

Controller body facing:

```ts
forward = (sin(yaw), 0, cos(yaw))  // yaw=0 → +Z
// Avatar.root.rotation.y = body yaw
// model / holder.rotation.y = art offset (modelYaw) only
```

Docs:

- [Object3D](https://threejs.org/docs/#api/en/core/Object3D) — hierarchy, `up`, matrices  
- [Box3](https://threejs.org/docs/#api/en/math/Box3) — AABB; use after `updateWorldMatrix`  
- [SkinnedMesh](https://threejs.org/docs/#api/en/objects/SkinnedMesh) — `frustumCulled = false` near camera  
- [WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) — `outputColorSpace = SRGBColorSpace`, ACES  

---

## 2. Deploy pipeline (required order)

```
1. Load kit (Arena GLB → R2 GLB → FBX fallback)
2. unifySkeletons (grudge6 multi-skeleton kits)
3. fitCharacterHeight (~1.8 m, decade unit snap, clamps)
4. Materials (GLB baked restore / FBX atlas rebind)
5. Gear visibility (mesh_ids / class preset)
6. reGroundAfterEquip (AABB may change)
7. Load baked Bip001 clips
8. Sample idle once → reGroundAfterEquip again
9. validateCharacterDeploy
10. Parent under Avatar.root; Controller owns world XZ + Y
11. ensureHumanScale on spawn (gross-error guard)
```

**Never** scale `Avatar.root` for height — fit the **model** under `holder`.

---

## 3. XZ best practices

| Do | Don't |
|----|--------|
| Center on **Bip001 Pelvis** world XZ | Center on full bbox including spears / banners |
| Keep play near scene origin | Float characters at world 10⁴ (precision) |
| Controller moves **root** only | Write locomotion into bone local positions |
| Place spawn with `placeAvatarRoot(root, {x,z}, yaw)` | Mix model.position with root for walk |

API: `centerXZOnPelvis`, `findPelvisBone` (also in `fitCharacterHeight.ts`).

---

## 4. Y best practices

| Do | Don't |
|----|--------|
| `groundFeetLocal` from **skinned body** `min.y` | Assume pelvis.y = 0 is feet |
| Re-ground after **idle pose** and **equip** | One bind-pose measure only |
| Flat Danger Room: groundY = 0 | Hardcode root.y = 1.0 as “stand” |
| Foot IK (`FootGrounder`) for terrain later | Fight IK with wrong sole offset |

Classic bug: world-space skinned AABB used as local height → **~100×** scale. Fixed by `fitCharacterHeight` unit snap + clamps.

---

## 5. Direction / facing best practices

| Do | Don't |
|----|--------|
| Art-forward **+Z** for Controller | Assume FBX export faces camera |
| FBX Toon RTS: `rotation.y = π/2` once (`artForwardSet`) | Apply π/2 every frame |
| Arena GLB: leave baked facing (usually +Z) | Rebind FBX atlas on GLB (scrambles UVs) |
| `modelYaw` on **holder** only | Add modelYaw into Controller yaw |

Moonwalk = art-forward opposite to `forward()` → flip modelYaw by π.

---

## 6. Asset deployment (production)

| Layer | Host |
|-------|------|
| Race GLB (combat) | `open…/cdn/assets/characters/*` → arena |
| Race FBX / textures | `assets.grudge-studio.com` + Open rewrites |
| Baked anims | `public/anims/baked/**` same-origin, then arena |
| Player row | Railway `/api/characters` → mesh_ids |

Verify:

```bash
node scripts/verify-fleet-assets.mjs --cdn-only
node scripts/verify-fleet-assets.mjs --base https://open.grudge-studio.com
```

Magic-byte / content-type reject HTML fake-200 before parse.

---

## 7. Graphics (materials + lights)

| Setting | Value |
|---------|--------|
| Renderer | `SRGBColorSpace` + `ACESFilmicToneMapping` |
| Albedo maps | `colorSpace = SRGBColorSpace`, mipmaps, anisotropy |
| Data maps | linear / NoColorSpace |
| grudge6 FBX atlas | `flipY = false`, ClampToEdge, MeshStandard |
| Lights | hemi + key dir + rim (see `studioLighting.ts`) |
| Metal without env | neutralize metalness ≤ 0.15 |

---

## 8. Agent checklist (`/play` characters)

- [ ] Character is grudge6 kit or catalog GLB — not capsule forever  
- [ ] Height ≈ 1.7–1.9 m after deploy  
- [ ] Feet on floor (no sink / float > 15 cm)  
- [ ] Walk direction matches body facing (no moonwalk)  
- [ ] Atlas colors correct (not pink/black chrome)  
- [ ] Idle + walk + run clips load  
- [ ] Console: `grudge6 ready` + optional `deploy` log  

---

## Related

- `three/characterDeploy.ts` — deploy API  
- `three/fitCharacterHeight.ts` — scale + pelvis  
- `three/grudge/grudge6Runtime.ts` — load + validate  
- `three/Studio.ts` — spawn + `ensureHumanScale`  
- [FLEET_ASSET_DEPLOYMENT.md](./FLEET_ASSET_DEPLOYMENT.md)  
- [UMMORPG_ENGINE_PRACTICES.md](./UMMORPG_ENGINE_PRACTICES.md)  
