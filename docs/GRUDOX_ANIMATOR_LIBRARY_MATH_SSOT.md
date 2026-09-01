# GRUDOX Animator — animation library · bone traces · math · agent language

**Live:** https://grudox.grudge-studio.com/animator/  
**Source:** `gameopen/artifacts/animator` (package `@workspace/animator-app` → GRUDOX `/animator/`)  
**Anim AI worker:** https://anim-ai-worker.grudge.workers.dev (v2.0.0) · UI: Open `/anim-ai` + in-app `AiAnimatorPanel`  
**Fleet anim law:** [ANIMATION_FLEET_SSOT.md](./ANIMATION_FLEET_SSOT.md)  
**Three.js base skill:** `threejs-animation` (mixer · clip · action · skeletal)

---

## 1. What the live surface is

| Layer | Role |
|-------|------|
| **Explorer / Mixamo lane** | 25-bone Mixamo · FBX packs under `/anim/animations/{pack}/` |
| **Clip library UI** | Verbs → `ActionKey` → class clip · categories (Melee, Movement, …) |
| **Animator** | One `AnimationMixer` on skeleton root · loco blend + one-shots |
| **LocomotionBlend** | Idle/walk/run weights + **phase-synced stride** |
| **Anim debugger** | Bind coverage, play log, combat **verb + character XYZ** |
| **AI worker** | Text → Mixamo unit quats frames · IK · weapon presets · optimize |
| **SkeletonHelper** | Live bone sticks (debug) |
| **hxyz / bone traces** | `three/anim/boneTraceMath.ts` — hip XYZ path + spine line |

**Rig law (never mix):**

| Lane | Skeleton | Clips |
|------|----------|--------|
| `mixamo-explorer` | Mixamo | `/anim/animations/**` (this host’s main library) |
| `bip001-baked` | Bip001 grudge6 | `/anims/baked/**` — Warlords / Danger playable, **not** raw Mixamo FBX |

---

## 2. Animation library map (on-disk / deploy)

Path: `dist/animator/anim/animations/` (~**161** files on current GRUDOX stage)

| Pack folder | ~count | Role (language) |
|-------------|--------|-----------------|
| **bow** | 33 | Universal **locomotion** fallback (8-dir walk/run) + archer aim/draw + dodges |
| **sword** | 21 | 1H + shield stance loco, attacks, block, run/strafe/turn |
| **pistol** | 28 | Gunslinger loco (arc walk/run), whip, kneel, uppercut |
| **rifle** | 10 | Aim idle, crouch, directional run, turns |
| **magic** / **magic-loco** | 5+13 | Cast / area attack + magic stance walk/run |
| **knife** | 4 | Dual dagger stab / combo |
| **striker** | 7 | Unarmed / kick / flip finishers |
| **reactions** | 9 | Hit, fall, get-up, parry, stun |
| **climb** | 4 | Wall climb / top-out |
| **swim** | 3 | Swim / tread |
| **farming** | 5 | Dig, plant, water (profession) |
| **extra** | 19 | Acrobatics — flips, corkscrew, slide, grenade throw |

**Catalog SSOT (code):** `src/three/explorer/clipCatalog.ts`

- `UNIVERSAL_LOCO` — idle + 8-dir walk/run (from **bow** pack)  
- `UNIVERSAL_MOVEMENT` — dodge, dash, jump air/land, rolls, flips  
- `WEAPON_SETS` — per-class attack/block/equip overrides  
- `BASE_PACK_FALLBACKS` — animated-base-character GLB gap-fill  

**UI verbs:** `ExplorerCharacter.ts` → `VERBS` + `CLIP_CATEGORIES` + `PREVIEW_VERB_KEYS`

| Category | Example words agents should use |
|----------|----------------------------------|
| Melee | attack, stab, slash, combo, overhead, inside/outside slash |
| Defense | block, guard, parry, block react |
| Movement | walk, run, sprint, dash, roll, slide, jump, wall run |
| Acrobatics | flip, corkscrew, aerial evade, kip-up |
| Magic | cast, channel, area attack |
| Gunslinger | aim, charged shot, pistol whip |
| Reactions | hit, knocked up, get up, death |
| Gestures | acknowledge, cocky, relieved sigh |

---

## 3. Math system (locomotion + clips)

### 3.1 Three.js primitives (skill `threejs-animation`)

```
AnimationClip  → tracks (Quaternion / Vector / Number)
AnimationMixer → one per skinned body (skeletonRoot)
AnimationAction → weight, timeScale, loop, crossfade
SkeletonHelper → visual bones
```

Update every frame: `mixer.update(dt)`.

### 3.2 Locomotion blend (`LocomotionBlend.ts`)

| Symbol | Meaning |
|--------|---------|
| `speed` ∈ [0,1] | Intent intensity (WASD magnitude) |
| `IDLE_AT=0.06` · `WALK_AT=0.45` · `RUN_AT=0.9` | Weight breakpoints |
| Stride phase φ | Shared for walk+run; `action.time = φ * duration` |
| Crouch | Forces run weight → walk; cadence ×0.5 |

Weights (see `locoWeightsFromSpeed` in `boneTraceMath.ts`):

```
speed ≤ walk:  idle↔walk
speed > walk:  walk↔run
```

### 3.3 Hip XYZ / root lock (“hxyz”)

| Term | Math / code |
|------|-------------|
| **Bind hip** | Local hips position at T-pose / bind (`bindHipX/Y/Z` on `Animator`) |
| **Hip XYZ path** | Sampled hips position over clip time `t ∈ [0, duration]` |
| **Planar drift** | max ‖(x,z) − (x₀,z₀)‖ — large → clip has root motion |
| **Vertical bob** | max \|y − y₀\| — keep for walk cycle feel |
| **Root lock** | Re-baseline hip **X/Z → bind**; keep relative **Y bob** so cycle stays in place |
| **Spine line** | World positions of hips→spine→neck→head after mixer |

Code: `src/three/anim/boneTraceMath.ts`

```ts
import {
  sampleHipXyzTrace,
  buildTraceLine,
  describeHipTrace,
  locoWeightsFromSpeed,
} from "./three/anim/boneTraceMath";

const trace = sampleHipXyzTrace(clip, 32, { x: bindX, y: bindY, z: bindZ });
// graphical: scene.add(buildTraceLine(trace));
// agent QA: describeHipTrace(trace)
```

### 3.4 Combat one-shots

- Attacks = **LoopOnce** overlays; never permanently replace idle.  
- `isBusy()` while one-shot plays.  
- Combo index advances on chained attacks.  
- Debugger records **verb** + character **world XYZ** (`animDebug` pos).

### 3.5 AI clip contract (worker)

- Max **64** frames · Mixamo **posable bones** only  
- Pose = **local unit quaternion** `[x,y,z,w]` per bone  
- Identity = `[0,0,0,1]`  
- Loco requests: author **in-place** cycle; engine may bake travel on hips  
- Validate: `clipContract.ts` / frontend `aiClipContract.ts`

---

## 4. Graphical traces (spine / bone lines)

| Visualization | Source |
|---------------|--------|
| Skeleton sticks | `THREE.SkeletonHelper(model)` on Character / Explorer |
| Clip hip path | `sampleHipXyzTrace` → `buildTraceLine` (green) |
| Live spine | `buildLiveSpineLine(skeletonRoot)` each frame after mixer |
| Anim debugger feed | validate/play/verb rows + issues |

Agents should describe motion in **words** (slash, plant feet, wind-up) while tools use **numbers** (weights, drift m, quats).

---

## 5. Agentic AI — language + math

### 5.1 Surfaces

| Agent | Endpoint | Job |
|-------|----------|-----|
| Anim AI worker | `anim-ai-worker.grudge.workers.dev` | generate/edit/pose/ik/weapon/optimize/chat |
| In-app panel | `AiAnimatorPanel` | User text → worker |
| Companion guide | `companionPrompt.appGuideSystemPrompt` | Navigate animator systems (not clip JSON) |

### 5.2 Basic language → system mapping

| User says | System / tool |
|-----------|----------------|
| idle, stand, breathe | idle loco / pose |
| walk, run, sprint, crouch | LocomotionBlend + UNIVERSAL_LOCO |
| strafe left/right | directional walk/run L/R |
| dodge, roll, dive | UNIVERSAL_MOVEMENT dodge/dash |
| slash, stab, overhead, combo | melee verbs / sword set |
| block, parry, guard | defense verbs |
| cast, fireball, channel | magic pack |
| aim, shoot, reload (gun) | pistol/rifle |
| hit, stagger, get up | reactions |
| flip, kip-up, corkscrew | acrobatics |
| plant feet, no sliding | root lock + phase sync |
| wind-up / recovery | attack timing language for generate |
| hip bob / root motion | hip XYZ trace metrics |

### 5.3 Math the agent must respect

1. **One mixer** per body.  
2. Quaternions are **unit**; never Euler-in-JSON for Mixamo AI output.  
3. Loco cycles **in place** unless travel is explicitly requested (then bake hip path).  
4. SI: 1 unit = 1 m; human ~1.8 m; hip height ~1 m bind.  
5. Do not mix **Bip001** track names into Mixamo explorer clips.  
6. Prefer existing **library verbs** before inventing new clip ids.

### 5.4 Worker system prompt (strengthened)

See `worker/src/index.ts` `systemPrompt()` — includes combat/loco vocabulary + hip/root-lock rules.

---

## 6. Live smoke (2026-08)

| Check | Result |
|-------|--------|
| `GET grudox…/animator/` | 200 |
| `GET anim-ai-worker…/health` | 200 · tools generate/edit/pose/ik/weapon/optimize/chat/clips |
| Pack folders on deploy | bow, sword, pistol, rifle, magic*, knife, striker, reactions, climb, swim, farming, extra |

---

## 7. Code index

| File | Role |
|------|------|
| `explorer/clipCatalog.ts` | Pack ids, universal loco, weapon sets |
| `explorer/Animator.ts` | Mixer, hip bind, loco + one-shots |
| `explorer/LocomotionBlend.ts` | Weight + phase math |
| `ExplorerCharacter.ts` | VERBS, categories, labels |
| `anim/boneTraceMath.ts` | Hip XYZ / spine traces / loco weights |
| `debug/animDebug.ts` | Record validate/play/verb + XYZ |
| `worker/src/index.ts` | AI generate/chat routing |
| `worker/src/clipContract.ts` | Frame/bone validation |
| `docs/ANIMATION_FLEET_SSOT.md` | Fleet-wide mixer law |

---

## 8. Anti-patterns

| Bad | Good |
|-----|------|
| Mixamo FBX on grudge6 Bip001 | Bake JSON for bip001 lane |
| Second mixer for attacks | One mixer; attack = action weight |
| Snap idle→run without blend | LocomotionBlend weights |
| AI emits Euler degrees | Unit quaternions |
| “Home island” anim library for voxel | Explorer Mixamo packs on GRUDOX animator |
| Agent invents clip paths | Map to VERBS / UNIVERSAL_LOCO / pack folders |
