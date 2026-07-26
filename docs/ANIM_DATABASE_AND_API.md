# Animation database + state API

**SSOT:** `content/anims/database.json` + `content/anims/states.json`  
**Runtime:** `artifacts/animator/src/three/anim/AnimDatabase.ts` + `AnimStateMachine.ts`  
**Physics surfaces:** `lib/grudge-physics` `SurfaceLocomotionMode`

## Goals

One registry for **all** clips (baked Bip001, Mixamo FBX, Explosive, harvest, swim, climb) lined up with:

| System | How it uses the DB |
|--------|---------------------|
| **State management** | `AnimStateMachine.tick` / `requestAction` → state id → clip |
| **Weapon skills** | `combat.skill1–4` + pack/weapon scoring |
| **Locomotion** | `loco.idle/walk/run/sprint` from speed on ground/wade |
| **Harvest** | `activity.harvest*` roles (chop/gather/plant) |
| **Swimming** | `loco.swim` / `loco.tread` when surface = swim |
| **Climbing** | `traversal.climb*` |
| **Vertical grab** | hang / freehang / grab on walls, boats, wide trees (`verticalGrab` or mantle) |

## Layers

```
activity (harvest/build)
  action (attack, skills, jump, dodge, hurt)
    traversal (climb, hang, mantle, wallRun)
      loco (idle/walk/run/swim/tread)
```

Higher priority layers interrupt lower ones per state `priority` / `interruptible`.

## Resolve query

```ts
import { getAnimDatabase, AnimStateMachine } from "@/three/anim";

const db = getAnimDatabase();
const r = db.resolve({
  stateId: "combat.attack",
  weaponId: "spear",
  surface: "ground",
  activity: "combat",
});
// r.bakeRel → "polearm/attack" → load /anims/baked/polearm/attack.json

const sm = new AnimStateMachine(db);
const frame = sm.tick({
  surface: "climb",      // or ground | swim | wallRun | mantle
  activity: "combat",
  weaponId: "sword",
  speed: 0.2,
  verticalGrab: true,    // grab wall/tree/boat lip
});
// frame.stateId === "traversal.hang"
// frame.resolve.clip.sourceRel === "anim/climb/hanging-idle.fbx"
```

## Surface → state (default)

| SurfaceLocomotion | Anim state |
|-------------------|------------|
| ground / wade | loco.* from speed |
| swim | loco.swim / tread |
| climb | traversal.climb |
| wallRun | traversal.wallRun |
| mantle (anim-only) | traversal.mantle |
| verticalGrab flag | traversal.hang |

## Packs

| Pack | Status | Notes |
|------|--------|--------|
| polearm | ready (many bakes) | Madarame 2H/spear |
| longbow | partial ready | walk/run/dodge |
| unarmed / magic / sword_shield | partial | some placeholder |
| twohand / crossbow / rifle | missing bake | fallbacks polearm/longbow/unarmed |
| swim / climb / harvest | Mixamo source | needs Bip001 bake for grudge6 |

## Bake pipeline

1. Author FBX (Mixamo / Explosive) under `public/anim/*` or `raw/explosive/*`  
2. Retarget → Bip001, strip position tracks  
3. Write `public/anims/baked/{bakeRel}.json`  
4. Set clip `status: "ready"` in `database.json`  
5. Sync embed: copy to `src/three/anim/data/` + `public/content/anims/`  

Banned loco: `locomotion/running` (run-to-roll) — listed in `bannedBakeRels`.

## Host integration checklist

- [ ] Studio: on SurfaceLocomotion change → `AnimStateMachine.tick`  
- [ ] GrudgeAvatar: load `db.bakeRelsForWeaponPack(pack)`  
- [ ] Harvest LMB: `requestAction({ kind: "harvest", tool })`  
- [ ] Wall/tree/boat probe: set `verticalGrab` or surface `climb`/`mantle`  
- [ ] Weapon skill F/1–4: `requestAction({ kind: "skill", slot })`  

## Files

| Path | Role |
|------|------|
| `content/anims/database.json` | Clip registry |
| `content/anims/states.json` | State defs |
| `content/schemas/anim_*.schema.json` | JSON schemas |
| `content/manifests/anims.index.json` | Index |
| `src/three/anim/AnimDatabase.ts` | Resolve API |
| `src/three/anim/AnimStateMachine.ts` | Intent → state |
| `src/three/anim/data/*` | Bundled embed |
| `public/content/anims/*` | Fetchable mirror |
