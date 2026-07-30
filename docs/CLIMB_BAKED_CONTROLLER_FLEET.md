# Climb / hang / mantle — baked assets → controller → games (P0–P2)

**Updated:** 2026-07-30

## P0 done (Open)

| Step | Result |
|------|--------|
| Bake Mixamo → Bip001 JSON | `npm run anims:bake:mobility` → `public/anims/baked/climb/*.json` + `swim/*` |
| Database status | climb + swim clips → **`ready`** in all three database copies |
| SurfaceLocomotion | `wantClimb` / `verticalGrab` / `wantMantle` on resolve |
| Controller | F/E grab · W/S climb · Space drop · mantle at top · roles `climbUp/Down/hang/wallRun` |
| Climb walls | Invisible holds; `setClimbProbe` from Studio |
| Anim roles | `AnimRole` extended for mobility |

### Bake map

| bakeRel | role | source FBX |
|---------|------|------------|
| climb/climbing | climb | anim/climb/climbing.fbx |
| climb/up | climbUp | climbing-up-wall.fbx |
| climb/down | climbDown | climbing-down-wall.fbx |
| climb/to_top | mantle | climbing-to-top.fbx |
| climb/hang_idle | hang | hanging-idle.fbx |
| climb/jump_to_hang | grab | jump-to-freehang.fbx |
| climb/stand_to_hang | standToHang | stand-to-freehang.fbx |
| climb/wall_run | wallRun | wall-run.fbx |
| climb/freehang_climb | freehangClimb | freehang-climb.fbx |
| swim/swimming | swim | anim/swim/swimming.fbx |
| swim/treading | tread | treading-water.fbx |
| swim/to_edge | swimExit | swimming-to-edge.fbx |

Skeleton: **Bip001** · quaternion tracks only · controller owns root XYZ.

### Player controls (Danger Room)

| Input | Action |
|-------|--------|
| **F** or **E** near wall/holds | Grab → hang / climb mode |
| **W/S** while climbing | Climb up / down |
| **A/D** | Lateral along wall |
| **Space** while climbing | Drop off wall |
| Near top holds + W | Mantle one-shot → hop up |

## P1 — pass to other games

1. **Same paths:** every game loads `anims/baked/{bakeRel}.json` via `loadBakedClip` / `bakedClipCandidates` (same-origin first, then arena/CDN).
2. **Upload R2 (ops):**  
   `models` style keys → `anims/baked/climb/*` and `anims/baked/swim/*` to `assets.grudge-studio.com`.
3. **Controller contract:** host must call `resolveSurfaceLocomotion` with `wantClimb` when near holds, and play roles from `MOBILITY_CLIPS` (already in `grudge/anims.ts` + `grudge6Runtime`).
4. **Do not** ship FBX for production locomotion (Vercel bans `**/*.fbx`).

### Game checklist

```
[ ] public or CDN: anims/baked/climb/*.json HEAD 200
[ ] MOBILITY_CLIPS load on character (grudge6Runtime)
[ ] Controller publishes surfaceMode climb|wallRun|swim
[ ] Optional: ClimbWallSystem or equivalent hold probe
[ ] AnimDatabase climb clips status ready
```

## P2 — quality

| Item | Status |
|------|--------|
| Hold graph + hand/foot selection rules | **Done** (`climbHolds.ts`) |
| Mantle from top-row holds | **Done** (probe `atTop`) |
| Bone IK sticks hands/feet to peg IDs | **Partial** — selection ready; full two-bone arm IK still optional polish |
| Playtest gate | `climbHolds.test.ts` + `anims:bake:mobility` |

Debug: `studio.toggleClimbHoldDebug()` · `studio.getClimbWallReview()`.

## Commands

```bash
# Re-bake after FBX changes
npm run anims:bake:mobility

# Unit tests
npm --prefix artifacts/animator test -- src/three/climb/climbHolds.test.ts

# Deploy Open (ships baked JSON + climb walls + DJ)
npm run deploy:prod
```

## Rule (fleet)

**Controller owns surface · AnimDatabase owns bakeRel · games only load `anims/baked/{bakeRel}.json`.**
