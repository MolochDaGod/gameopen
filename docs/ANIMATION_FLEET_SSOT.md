# Fleet Animation SSOT — mixer · packs · loaders · deploys

**Status:** HARD LAW for Open Danger, GRUDOX, controller Vercel, Foundry, Warlords.  
**Live Danger binary (target):** `open.grudge-studio.com/danger`  
**GRUDOX Animator:** https://grudox.grudge-studio.com/animator/ · library/math/agent: [GRUDOX_ANIMATOR_LIBRARY_MATH_SSOT.md](./GRUDOX_ANIMATOR_LIBRARY_MATH_SSOT.md)  
**Code:** `artifacts/animator/src/three/anim/fleetAnimSsot.ts`  
**Content:** `content/anims/*` + `/anims/baked/{pack}/*.json`

---

## 1. The problem we are killing

| Symptom | Cause |
|---------|--------|
| T-pose / wrong attacks on grudge6 | Mixamo tracks or Explorer FBX bound to **Bip001** kit |
| Hip-float / sideways | Position tracks + wrong facePlusZ / Box3 ground |
| “Baked totally wrong” | Banned loco (`running` = run-to-roll), wrong pack folder, arena secondary host |
| Three different Danger Rooms | Open / controller / GRUDOX each fork skills + anim paths |

**Never** invent a fourth anim loader. Extend this SSOT only.

---

## 2. Two rig lanes (never mix)

| Lane id | Skeleton | Clip source | Used by |
|---------|----------|-------------|---------|
| **`bip001-baked`** | Bip001 (Toon RTS / grudge6) | `/anims/baked/{rel}.json` (rotation-only) | grudge6 heroes, Warlords, Danger playable, Railway characters |
| **`mixamo-explorer`** | 25-bone Mixamo | `/anim/animations/{pack}/*.fbx` or baked retarget **onto Mixamo only** | Explorer avatar, voxel explorer, thrcc gun packs |

```
❌ bip001 kit  + mixamorig tracks
❌ mixamo avatar + Bip001 baked sword_shield JSON without retarget
✅ bip001 kit  + stripPositionTracks(Bip001 bake)
✅ explorer    + Mixamo FBX / explorer clipCatalog
```

---

## 3. AnimationMixer ownership

| Surface | One mixer on | Director |
|---------|--------------|----------|
| grudge6 / Danger hero | **race kit root** (skinned) | `ummorpg/AnimationDirector` (gait + one-shot) via `grudge6Runtime` / `Grudge6CombatCharacter` |
| Controller Character | `Character.model` | `PlayerAnimationDirector` → Character clips |
| Explorer | `VoxelCharacter.skeletonRoot` | `explorer/Animator` |
| Cinema / props | that mesh root | local mixer only — **not** player packs |

**Rules:**

1. **One mixer per skinned body** for player poses.  
2. Attack = **one-shot overlay**, never permanently replaces idle.  
3. Pack swap: **load clips first → rebuild director** (never dispose mid-attack without queue).  
4. After idle/attack sample: **reGround** (`characterDeploy.sampleClipAndReground`).  
5. **Weapon equip / class swap:** fade to **idle** only — equip/draw flourishes with root keys tip/spin the body.  
6. **Stabilize every clip before `clipAction`:** `stabilizeClipForMixer` in `clipTracks.ts` (filter → strip limb/scale pos → hip X/Z lock → sanitize NaN).

### 3.2 Feet IK on terrain (all play characters)

**Code:** Open `anim/legIk.ts` + `terrainFootSample.ts` · ObjectStore / Casting `grudge6-foot-ik.js`  
**Contract:** `warlordsPlayContract.footIk` stamp `2026-08-21.foot-ik.1`

| Rule | Value |
|------|--------|
| When | After mixer, every frame, every play kit |
| Sampler | **Same** `heightAt(x,z)` as Rapier CCT / body Y / grass roots |
| Bones | Bip001 L/R Thigh · Calf · Foot + **Pelvis** (never `L Hip`) |
| Order | `beginFrame()` → `mixer.update(dt)` → `apply(dt)` |
| Map change | Rebind sampler only — keep Controller, mixer, weapon |
| Flat lab | `FLAT_FOOT_SAMPLER` y=0 (no-op if already planted) |

Ban: pelvis-as-feet, IK before mixer, second mixer, second physics.

Rapier CCT: kinematic capsule, fixed 1/60, SI, `@dimforge/rapier3d-compat ^0.19`. TPS camera owned by combat Controller — never OrbitControls during combat.

TPS blend: idle/walk/run **weights** on one mixer; attack = one-shot overlay; generate clips by baking Mixamo → **Bip001 rotation-only** packs (`grudge-asset-convert`), not Mixamo tracks on play kits.

### 3.1 Weapon spin / dive-into-ground (fixed pattern)

| Symptom | Cause | Fix |
|---------|--------|-----|
| Spin on weapon select | Limb **position** tracks from foreign Mixamo pack on procedural skeleton | `stripLimbPositionTracks` / `stripPositionTracks({ keepRootPosition: true })` |
| Point feet into ground / tip | **Scale** tracks or NaN hip Y | `stripScaleTracks` + `sanitizeClipTracks` |
| Walk off pedestal | Hip XZ = clip frame 0 (off-origin retarget) | `lockHorizontalRoot(clip, bindHip)` — never pin to frame 0 |
| Second mixer “fix” | Parallel `AnimationMixer` on same body | **Forbidden** — one mixer; use action weights + crossFade |

Explorer bind path: `Animator.action()` → `stabilizeClipForMixer` → single `this.mixer.clipAction`.

---

## 4. Loader SSOT (meshes + clips)

### 4.1 glTF / GLB (characters, weapons, worlds)

| Must use | Must not |
|----------|----------|
| `sharedGltfLoader()` / `makeGltfLoader()` from `three/loaders/gltf.ts` | bare `new GLTFLoader()` for fleet assets |
| Draco + Meshopt (already on shared) | skip decoders “for speed” |
| `SkeletonUtils.clone` / forceSkinned instance | `scene.clone()` on skinned kits |

### 4.2 grudge6 race kit order (mesh)

```
1. https://assets.grudge-studio.com/models/grudge6/races/{WK|BRB|ELF|DWF|ORC|UD}_Characters.glb
2. same-origin resolveAssetCandidates(models/grudge6/races/…)
3. FBX modular kit + atlas rebind (pipeline fbx-atlas)
4. LAST resort only: historical arena /cdn/assets/characters/…  (never SSOT)
```

**Never** secondary host as primary. Never Meshy capsules for grudge6.

### 4.3 Bip001 clip order (`loadBakedClip`)

```
1. same-origin /anims/baked/{rel}.json
2. https://open.grudge-studio.com/anims/baked/{rel}.json
3. reject BANNED_LOCOMOTION_CLIPS (run-to-roll, tipping walk)
4. toRotationOnlyClip + rematch Bip001 names on bind
```

`assets.grudge-studio.com/prod/anims/*` and `*.glb` play probes are **dead** (404). Do not add them back. Walk/run/sprint loco rejection stays in `grudge6Runtime`, not on dodge/climb/skill JSON.

Authoring FBX under `public/anim/**` is **bake input only**, not production player bind for grudge6.

### 4.4 Explorer Mixamo order

```
1. clipCatalog UNIVERSAL_LOCO / WEAPON_SETS ids
2. /anim/animations/{pack}/… (or public/anim mirror)
3. base/animated-base-character.glb gap-fill
```

---

## 5. Content SSOT (edit once)

| Path | Role |
|------|------|
| `content/anims/database.json` | All clips + roles |
| `content/anims/weapon-live-packs.json` | Weapon → live roles |
| `content/anims/states.json` | State machine |
| `scripts/anims:*` | sync + integrity SHA |
| `artifacts/animator/src/three/grudge/anims.ts` | Runtime pack maps + `loadBakedClip` |
| `…/anim/AnimDatabase.ts` | Query layer over content |

```bash
npm run anims:sync
npm run anims:verify:write
npm run anims:verify:strict
```

---

## 6. Deploy map (one Danger binary)

| Host | Role after unification |
|------|------------------------|
| **open.grudge-studio.com** | **Canonical** Danger + library + editors |
| **gameopen.vercel.app** | Alias of Open |
| **threejs-rapier-…controll.vercel.app** | Redirect or **same Open animator build** — no fork |
| **grudox.grudge-studio.com** | Hub only → deep-link Open `/danger?characterId=&weapon=` |

**Vector / game deploys:** every game that plays a grudge6 hero imports **this** lane + `characterDeploy` + epicfight — not a local anim table.

---

## 7. Wrong-bake recovery checklist

When a grudge6 hero “looks baked wrong”:

1. Confirm kit is **R2 race GLB/FBX**, not Mixamo mannequin.  
2. Confirm clips are **Bip001 JSON** under `/anims/baked/sword_shield|longbow|magic|…`.  
3. Confirm **not** using `locomotion/running` or bare `running` as run.  
4. `stripPositionTracks` + `facePlusZ: auto` + Box3 feet.  
5. Atlas: glb-baked keep materials; fbx-atlas rebind webp `flipY=false`.  
6. Re-bake only if JSON tracks are mixamorig or have root position; otherwise fix **bind**, not re-upload.

---

## 8. Confirmation gates (CI / human)

```
[ ] Rig lane chosen bip001-baked XOR mixamo-explorer
[ ] sharedGltfLoader for fleet GLB
[ ] grudge6 mesh from assets.grudge-studio.com/models/grudge6/races
[ ] Clips from /anims/baked or prod/anims — no banned loco
[ ] One AnimationDirector/Animator owns gait + one-shots
[ ] Height 1.55–2.05 m; feet |min.y| < 0.08 after idle sample
[ ] Open /danger and controller URL play same pack ids
```

---

## 9. Related docs

- `docs/DANGER_ROOM_SSOT.md` — Danger room goals  
- `docs/CANONICAL_COMBAT.md` — epicfight  
- `docs/ANIM_DATABASE_AND_API.md` — content DB  
- `docs/WEAPON_LIVE_ANIMS.md` — weapon readiness  
- Skills: `grudge6-full-stack`, `grudge-character-correctness`, `grudge6-combat-runtime`
