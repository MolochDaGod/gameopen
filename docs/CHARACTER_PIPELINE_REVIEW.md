# Character pipeline review — skeletons · mixer · anim library · convert

**Skills:** `grudge6-full-stack` · `grudge-character-correctness` · `grudge-world-scale` · `grudge6-combat-runtime`  
**Code SSOT (Open):** `three/characterDeploy.ts` · `fitCharacterHeight.ts` · `grudge/grudge6Runtime.ts` · `grudge/skeleton.ts` · `grudge/anims.ts` · `anim/AnimDatabase.ts`

---

## 1. Architecture (one path)

```
Load race KIT (R2 GLB → arena → FBX atlas)
  → cloneSkinned
  → unifySkeletons          (one Bip001 skeleton for all SkinnedMeshes)
  → hide equippable + mesh_ids visibility
  → fitCharacterHeight(1.8) + forceUniformScale
  → deployCharacterModel    (face +Z, pelvis XZ, feet Y)
  → materials (atlas only if fbx-atlas)
  → reGroundAfterEquip
  → load baked packs        (/anims/baked/{pack}/*.json)
  → rematchClipToSkeleton   (Bip001 names, strip .position/.scale)
  → sample idle/attack      (AnimationMixer sample + reGround)
  → validate + diagnoseCharacterLook
  → AnimationMixer on model (GrudgeAvatar / Studio) every frame
```

| Layer | Responsibility |
|-------|----------------|
| **Avatar.root / Group** | World XZ, feet Y from controller, body yaw |
| **model** | SI scale, art-forward, local ground |
| **AnimationMixer** | On **model** (not world root) |
| **Clips** | Bip001 rotation-only after rematch |

---

## 2. Skeleton uniformity

| Gate | Pass | Code |
|------|------|------|
| One skeleton for all skins | `skeletonIds.size === 1` | `unifySkeletons` before clips |
| Bone names | `Bip001 Pelvis` / `Bip001 R Hand` (space or underscore) | `buildBoneNameLookup` |
| No Mixamo on grudge6 | no `mixamorig*` tracks on Bip001 kit | `rematchClipToSkeleton` drops unmatched |
| Hand attach | `R_hand_container` preferred | equip + skills |

**Convert bake must:** run skeleton unify in glb2glb when multi-skin Toon kits ship disconnected bones.

---

## 3. AnimationMixer updates

| Rule | Detail |
|------|--------|
| Owner | One mixer per model; `mixer.update(dt)` every frame |
| Sample before play | `sampleClipAndReground(model, idleClip)` after pack load |
| No position tracks | `stripPositionAndScaleTracks` / rematch default |
| Loco ban list | Never `locomotion/running` as run (roll) — `BANNED_LOCOMOTION_CLIPS` |
| Sprint | Clone of pack **run** + time scale — never separate roll JSON |
| One-shot attacks | `requestOneShot` / action with clampWhenFinished — not permanent idle replace |

---

## 4. Animation library (SSOT)

| Source | Role |
|--------|------|
| `/anims/baked/{pack}/…json` | Production Bip001 clips (preferred) |
| `three/anim/data/database.json` | Role → bake path registry (`AnimDatabase`) |
| `grudge/anims.ts` `ANIM_PACK_CLIPS` | Pack → idle/walk/run/attack paths |
| Mixamo FBX under `public/anim` | Explorer voxel only; **not** grudge6 |

**Packs:** `sword_shield` · `longbow` · `magic` · `polearm` · `unarmed` · (`twohand`/`rifle`/`crossbow` → fallback until baked)

**Agent rule:** Prefer `AnimDatabase.resolve()` for new surfaces; keep `ANIM_PACK_CLIPS` in sync when baking.

---

## 5. Converted assets — scale & direction

### Scale (SI)

| Kind | Target | Fit? |
|------|--------|------|
| Character | **1.55–2.05 m** (fit **1.8 m**) | **yes** skinned body only |
| Weapon / arrow | relative to hand (~0.5–1.2 m) | **never** character height fit |
| Prop | content-driven | category deploy checks |

Convert checklist:

```
[ ] glb2glb / bake sets unit = metres (not cm)
[ ] Post-bake Box3 height ≈ 1.8 m OR documented unitFix
[ ] No non-uniform root scale
[ ] Embed textures sRGB; no 1×1 placeholders
```

### Direction (facing)

| Pipeline | Facing rule |
|----------|-------------|
| `fbx-atlas` | **Always** `rotation.y = π/2` (export +X → controller +Z) |
| `glb-baked` | Set `artForwardProven=true` if convert orients to +Z; else Open applies auto yaw for `*_Characters.glb` |
| Controller | World yaw on **Avatar.root**; art-forward on **model** only once |

**Convert bake should write:**

```json
{ "userData": { "artForwardProven": true, "importPipeline": "glb-baked", "siHeightM": 1.8 } }
```

---

## 6. Confirmation gates (before ship)

```
[ ] unifySkeletons → single skeleton
[ ] height ∈ [1.55, 2.05]
[ ] |feet minY| < 0.08 after idle sample
[ ] artForwardSet OR artForwardProven
[ ] pelvis found
[ ] idle + walk + run + attack load (pack)
[ ] no banned loco clips
[ ] diagnoseCharacterLook.ok
[ ] attack not sideways; feet not hip-float
```

### Runtime API

```ts
import {
  deployCharacterModel,
  diagnoseCharacterLook,
  sampleClipAndReground,
  validateCharacterDeploy,
} from "./three/characterDeploy";
import { rematchClipToSkeleton, unifySkeletons } from "./three/grudge/skeleton";
import { loadGrudge6CombatRig } from "./three/grudge/grudge6Runtime";

const rig = await loadGrudge6CombatRig(raceId, presetId, { meshIds });
console.log(diagnoseCharacterLook(rig.model));
// each frame: rig.mixer.update(dt)
```

---

## 7. Known gaps / next convert work

| Gap | Action |
|-----|--------|
| `twohand` / `rifle` / `crossbow` packs incomplete | Bake JSON under `/anims/baked/` + register in AnimDatabase |
| GLB facing inconsistent across races | Orient bake + set `artForwardProven` |
| Explorer voxel vs grudge6 dual stack | Keep separate; never Mixamo tracks on Bip001 |
| Arena CDN secondary host | Prefer `assets…/models/grudge6/races/*_Characters.glb` |
| Campfire lobby seats | Explorer rig (Mixamo topology) — not grudge6; SI height via `CHARACTER_HEIGHT_M` |

---

## 8. Anti-patterns (reject)

1. Pelvis Y = 0 as feet  
2. Double art-forward (model + root both π/2)  
3. Character height fit on weapons  
4. Multiple skeletons without unify  
5. Mixamo tracks on Bip001  
6. Position tracks on grounded kit  
7. `locomotion/running` as run cycle  
8. Second character host for grudge6 (arena-only without R2)  
