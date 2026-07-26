# ExplosiveLLC Warrior packs — review for Open / grudge6

**Source:** `C:\Users\nugye\Desktop\grudgeproduction\grudgenew\FRESH GRUDGE\Assets\ExplosiveLLC`  
**Vendor:** Explosive LLC (Unity Asset Store “Warrior” Mecanim free bundle)  
**Reviewed:** 2026-07-24

---

## Executive summary

| Need | FREE pack on disk | Usable now? | Recommendation |
|------|-------------------|-------------|----------------|
| **2H weapons** | Bundle 2: `2Handed@Attack1` only | Partial (1 attack) | Buy **2 Handed Warrior full** (or Bundle 2 paid) for idle/walk/run/combo/skills |
| **Crossbow** | Bundle 3: folder only, **no FBX** | **No** | Buy **Crossbow Warrior** full pack |
| **Rifle** | **Not in ExplosiveLLC** (no rifle class) | **No** | Keep Open `anim/rifle/*` Mixamo + bake; or third-party gun pack |
| **Unarmed** | Bundle 1: **Brute** idle/run/jump/attack1 | Partial (brute, not striker) | Buy **Karate** full for true unarmed; use Open `striker` + baked `unarmed` today |
| **1H sword** | Bundle 3 Swordsman Attack1; Bundle 2 Knight Attack1 | Partial | Full **Swordsman/Knight** paid |
| **Hammer 2H** | Bundle 3 Hammer Attack1 | Partial | Full **Hammer** paid |
| **Spear** | Bundle 3 Spearman folder empty | **No** | Full **Spearman**; Open already has baked **polearm** (Madarame) |
| **Bow** | Bundle 2 Archer folder empty | **No** | Full **Archer**; Open has baked **longbow** |
| **Magic** | Mage/Sorceress folders empty | **No** | Full Mage/Sorceress; Open has baked **magic** |

**Critical:** The “FREE” Asset Store samples ship **1–4 teaser clips per class**, not the full locomotion + skill libraries. Crossbow / Spearman / Archer / Mage / Ninja / Karate / Sorceress folders under FREE often have **Scenes only** (no `Animations/*.FBX`).

---

## What’s actually on disk (FBX inventory)

### Warrior Pack Bundle 1 FREE

| Pack | Clips present |
|------|----------------|
| **Brute** (unarmed / heavy fist) | `Brute@Idle`, `Brute@Run`, `Brute@Jump`, `Brute@Attack1` + character FBX |
| Karate / Ninja / Sorceress | **No animation FBX** (scenes only) |

### Warrior Pack Bundle 2 FREE

| Pack | Clips present |
|------|----------------|
| **2 Handed** | `2Handed@Attack1` + character |
| **Knight** | `Knight@Attack1` + character |
| Archer / Mage | **No animation FBX** |

### Warrior Pack Bundle 3 FREE (user focus)

| Pack | Clips present | Open weapon target |
|------|----------------|--------------------|
| **Crossbow** | **None** | `crossbow` skills already in T0 kit |
| **Hammer** | `Hammer@Attack1` + character | `hammer` / `hammer2h` |
| **Spearman** | **None** | `spear` / polearm bake |
| **Swordsman** | `Swordsman@Attack1` + character | `sword` / sword_shield |

**Total usable FREE animation FBX:** 9 motion files + 5 character meshes.

---

## Scripts review (what to port vs ignore)

### Keep / port concepts (not Unity C# wholesale)

| Script | Value for Open / Three.js |
|--------|---------------------------|
| **`WarriorData.cs`** | Class enum: Archer, Brute, Crossbow, Hammer, Karate, Knight, Mage, Ninja, Sorceress, Spearman, Swordsman, **TwoHanded** → maps cleanly to Open weapon families |
| **`WarriorTiming.cs`** | Per-class **attack1 lock times** (0.6–1.25s) — use as `comboLock` / hit-window defaults when baking |
| **`IKHands.cs`** | **Left-hand IK** for 2H, Hammer, Crossbow, Spearman — matches Open `TwoHandGrip` / off-hand grip on grudge6 |
| **`WarriorController.cs`** | States Idle/Move/Jump/Fall; animator params `Moving`, `Velocity`, `Jumping`, triggers Jump/Attack — same as Explorer Animator intent |
| **`AnimatorParentMove.cs`** | Root-motion parent apply — Open should **strip root position** on grudge6 (already `stripPositionTracks`) |
| **`WarriorMovementController.cs`** | Accel/friction/jump — SuperCharacter style; Open already has Controller + SurfaceLocomotion |

### SuperCharacterController

| Use | Notes |
|-----|--------|
| Reference for **capsule + ground clamp + slope** | Open uses **Rapier KCC** (`CharacterCapsuleKcc`) — don’t dual-stack SCC |
| `PlayerMachine` state pattern | Similar to XState / activity modes already in Studio |

### Demo Elements (`CameraController`, `GUIControls`)

Demo only — ignore for production Open camera (Controller TPS owns camera).

### Verdict on scripts

- **Do not** import C# into Vercel SPA.
- **Do** copy **timing tables**, **class→weapon map**, and **IK on for 2H/crossbow/spear**.
- Root motion: **rotation-only** on Bip001 kits (Explosive packs are typically Mixamo-compatible humanoid).

---

## Map Explosive classes → Open systems

| Explosive `Warrior` | Open weapon id(s) | Open `AnimPack` (grudge6 baked) | Explorer Mixamo folder | T0 skills |
|---------------------|-------------------|----------------------------------|------------------------|-----------|
| TwoHanded | greatsword, greataxe | **new** `twohand` or reuse `polearm` heavy | `anim/greatsword/*` | greatsword kit |
| Hammer | hammer, hammer2h, mace | `twohand` / polearm slam | `anim/mace/*` | hammer2h kit |
| Crossbow | crossbow | **new** `crossbow` (or longbow + aim clips) | — | crossbow kit |
| Spearman | spear, javelin | **polearm** (already Madarame) | `anim/spear/*` | spear kit |
| Swordsman / Knight | sword | **sword_shield** | `anim/sword/*` | sword kit |
| Brute / Karate | none / unarmed | **unarmed** | `anim/striker/*` | unarmed / striker |
| Archer | bow | **longbow** | `anim/bow/*` | bow kit |
| Mage / Sorceress | staff* | **magic** | `anim/magic*` | staff kits |
| Ninja | dagger | unarmed / sword light | `anim/knife/*` | dagger kit |
| — | rifle, hunter-rifle, shotgun, pistol | **new** `rifle` / gun | `anim/rifle/*`, `anim/pistol/*` | gunClass kits |

### Open gaps vs Explosive (anim pack registry)

Today grudge6 `AnimPack` = `magic | sword_shield | longbow | unarmed | polearm` only.

Missing dedicated packs for:

1. **`twohand`** — greatsword / greataxe / hammer2h loco + attacks  
2. **`crossbow`** — aim idle, reload, shoot, dodge  
3. **`rifle`** / gun — already partially in Mixamo `public/anim/rifle` (not on Vercel; needs bake or R2)

---

## Conversion pipeline (when full packs land)

```
Explosive FBX (Mixamo humanoid)
  → Blender / fbx2gltf OR Three FBXLoader
  → Remap mixamorig* → Bip001 (retargetMap / retargetLibrary)
  → stripPositionTracks (grounded kit)
  → THREE.AnimationClip → JSON
  → public/anims/baked/{pack}/{clip}.json
  → ANIM_PACK_CLIPS[pack] + weaponSkillPacks clipPath
  → R2 optional; same-origin first on Open
```

### Clip role naming (SSOT)

| Role | Typical Explosive names | Open role |
|------|-------------------------|-----------|
| idle | `*@Idle`, `Idle` | `idle` |
| walk | `*@Walk`, `WalkForward` | `walk` |
| run | `*@Run` | `run` |
| attack / combo | `*@Attack1..N` | `attack`, `attack2`… |
| skill1–4 | specials / charged | `skill1`…`skill4` |
| jump | `*@Jump` | `jump` |
| hurt / death | if present | `hurt`, `death` |

### FREE sample import priority (do first)

| Priority | File | Target bake path |
|----------|------|------------------|
| P0 | `Brute@Idle/Run/Jump/Attack1` | `anims/baked/unarmed/brute_*` (extras; keep fight_idle as default) |
| P0 | `2Handed@Attack1` | `anims/baked/twohand/attack` |
| P1 | `Hammer@Attack1` | `anims/baked/twohand/hammer_attack` |
| P1 | `Swordsman@Attack1` / `Knight@Attack1` | extras under sword_shield |
| P2 | Character FBX | **Do not** replace grudge6 race kits — Mixamo bodies only for retarget source |

---

## Packages to acquire (Asset Store)

For full locomotion + skills, buy the **individual paid Warrior packs** (not FREE teasers):

| Pack | Why |
|------|-----|
| **2 Handed Warrior** | Greatsword / 2H axe loco + multi-attacks |
| **Crossbow Warrior** | Crossbow aim/reload/fire (user priority) |
| **Hammer Warrior** | 2H hammer / mace heavy |
| **Spearman Warrior** | Only if polearm bake insufficient |
| **Karate Warrior** | True unarmed combos (Brute is brawler-only) |
| **Archer Warrior** | Only if longbow bake needs more variants |
| **Swordsman / Knight** | 1H expansions |

**Rifle / gun:** ExplosiveLLC FREE tree has **no rifle class**. Prefer:

- Existing Open Mixamo `anim/rifle/*` + `anim/pistol/*` → bake to `anims/baked/rifle/`
- Or a dedicated low-poly FPS anim pack

---

## Effects note

ExplosiveLLC packs are **animation + demo characters**, not VFX. Open VFX stays:

- `three/Vfx.ts`, sandbox hotkeys, slash projectiles, forcefield  
- Pair warrior hit frames with existing `slashBlaster` / `muzzle` / `slam` kinds from T0 skills  

No Explosive “effects” assets required for skills.

---

## Immediate Open wiring (code targets)

1. Extend `AnimPack` with `twohand | crossbow | rifle` when first baked JSON exists.  
2. `animPackForWeapon`:  
   - greatsword/greataxe/hammer2h → `twohand`  
   - crossbow → `crossbow` (fallback longbow until bake)  
   - rifle/shotgun/pistol → `rifle` (fallback unarmed/longbow temporarily)  
3. `weaponSkillPacks`: add `crossbow` / `rifle` / `greatsword` clip paths under `anims/baked/…` once converted.  
4. TwoHandGrip: keep IK for spear / 2H / crossbow (matches Explosive IKHands list).  

---

## Folder map (quick)

```
ExplosiveLLC/
  Warrior FREE/Code/          ← controllers, IK, timing (reference only)
  SuperCharacterController/   ← capsule controller reference only
  Demo Elements/              ← ignore
  Warrior Pack Bundle 1 FREE/ ← Brute full mini-set; others empty
  Warrior Pack Bundle 2 FREE/ ← 2Handed + Knight attack only
  Warrior Pack Bundle 3 FREE/ ← Hammer + Swordsman attack; Crossbow/Spearman empty
```

---

## Recommended next steps

1. **Acquire paid Crossbow + 2 Handed packs** (or full Bundle 3 paid if available).  
2. Drop full `Animations/*.FBX` under e.g. `gameopen/raw/explosive/{class}/`.  
3. Run bake → `public/anims/baked/{twohand|crossbow|…}/`.  
4. Wire `ANIM_PACK_CLIPS` + skill clip paths.  
5. Optionally convert FREE Brute + 2Handed@Attack1 now as smoke tests of Mixamo→Bip001 bake.

Until full packs are present, **Open should keep using**:

- **2H:** polearm bake + heavyWeaponCombat / greatsword Mixamo skills  
- **Crossbow:** longbow aim clips + T0 crossbow VFX  
- **Rifle:** `anim/rifle` Mixamo (local) or gun procedural  
- **Unarmed:** baked `unarmed` + striker Mixamo  

---

## Related Open docs

- `docs/ANNIHILATE_DEMO.md` — grudge6 pack boot  
- `docs/HEAVY_2H_AND_ANNIHILATE.md` — greatsword skills  
- `artifacts/animator/src/three/grudge/anims.ts` — `ANIM_PACK_CLIPS`  
- `artifacts/animator/src/three/arsenal/t0WeaponSkills.ts` — skill labels/VFX  
