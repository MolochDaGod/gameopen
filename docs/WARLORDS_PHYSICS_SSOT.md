# Warlords-era physics SSOT

**Canonical package:** `@workspace/grudge-physics`  
**Path:** `lib/grudge-physics/`  
**Owner product:** Open (`open.grudge-studio.com`) — every Warlords-era scene host must use this stack.

## One stack for all scenes

| Surface | Host | Uses |
|---------|------|------|
| Danger Room | `Studio` | `createScenePhysics({ kind: "danger-room", ground, player })` + KCC + room bounds |
| Dungeon | `Dungeon` + Studio | Trimesh bake + KCC (same capsule constants) |
| Voxel arena | `VoxelArena` | Trimesh + KCC |
| Brawler | `BrawlerScene` | Ground plane + shared Controller / Physics |
| Island / zone / instance | fleet games | Import `@workspace/grudge-physics` — do **not** fork Rapier versions |
| Editor playtest | `EditorScene` | Same bootstrap |

## Stack (pinned)

| Layer | Package | Notes |
|-------|---------|-------|
| Renderer | `three@^0.184` | Engine owns WebGLRenderer |
| Physics | `@dimforge/rapier3d-compat@^0.19.3` | Wasm; fixed 60 Hz |
| Dense mesh raycast | `three-mesh-bvh@^0.8` (optional) | Islands / dungeon pick / camera |
| Character body | Kinematic capsule KCC | `PLAYER_CAPSULE` r=0.35 halfH=0.55 |
| Combat contact | Swept capsules | `@workspace/grudge-physics` + BladeCollisionSystem |
| Locomotion anim | Open clipCatalog + LocomotionBlend | Not physics — bridges via Controller speed |

**Do not introduce** Cannon, Ammo, or a second Rapier major version in Warlords hosts.

## API surface

```ts
import {
  createScenePhysics,
  PhysicsWorld,
  CharacterCapsuleKcc,
  probeWallAnalytic,
  probeLedge,
  screenCenterRay,
  screenAimRay,
  raycastScene,
  installMeshBvh,
  accelerateObject3D,
  PLAYER_CAPSULE,
  GRAVITY_Y,
  type CollisionProvider,
} from "@workspace/grudge-physics";
```

### Bootstrap (preferred)

```ts
const { physics, playerKcc } = await createScenePhysics({
  kind: "danger-room", // | "dungeon" | "island" | "zone" | "instance" | ...
  gravityY: GRAVITY_Y, // dungeon mesh KCC may use 0 if Controller owns vertical
  ground: true,
  player: { x: 0, y: 0, z: 0 },
  meshBvh: true,
});
controller.setCollision(playerKcc, spawn, { keepRoomBounds: true }); // arena
// or controller.setCollision(dungeon.collision, spawn); // mesh world

// each frame
physics.step(dt);
controller.update(dt);
```

### CollisionProvider contract

- Input: **feet** position + attempted delta  
- Output: corrected feet position + `grounded`  
- Implemented by `CharacterCapsuleKcc` and dungeon/arena wrappers

## Migration rules for other repos

1. **Open is SSOT** — copy or npm-link `@workspace/grudge-physics` (or git submodule later).  
2. Align `three` to `^0.184` and Rapier to `^0.19.3`.  
3. Replace flat Y=0-only player move with `createScenePhysics` + KCC.  
4. Bake environment colliders as **trimesh** (or boxes) via convert pipeline; living NPCs may stay circle obstacles.  
5. Aim: `screenCenterRay` / `screenAimRay` + `raycastScene`; install mesh-bvh for large GLBs.  
6. Ragdoll: use tumble/launch clips until bone `Ragdoll` ships on top of `ragdollMath`.  
7. RTS-Grudge / Tactical-Infinity: migrate off dual cannon+rapier toward this package only.

## Constants

| Name | Value |
|------|--------|
| PHYSICS_HZ | 60 |
| GRAVITY_Y | −12 |
| PLAYER_CAPSULE | r 0.35 / halfH 0.55 / offset 0.08 |
| PLAYER_HEIGHT_M | 1.8 |

## File map

| File | Role |
|------|------|
| `lib/grudge-physics/src/PhysicsWorld.ts` | Rapier world |
| `lib/grudge-physics/src/CharacterCapsuleKcc.ts` | Player KCC |
| `lib/grudge-physics/src/bootstrap.ts` | `createScenePhysics` |
| `lib/grudge-physics/src/probes.ts` | Wall / ledge analytic |
| `lib/grudge-physics/src/aimRay.ts` | Aim rays |
| `lib/grudge-physics/src/meshBvh.ts` | Optional BVH |
| `lib/grudge-physics/src/sweptCapsule.ts` | Combat geometry |
| `artifacts/animator/src/three/PhysicsSystem.ts` | Thin re-export facade |
| `artifacts/animator/src/three/Studio.ts` | Danger Room consumer |
| `artifacts/animator/src/three/Controller.ts` | `setCollision` + keepRoomBounds |

## Checklist for a new scene

- [ ] `await createScenePhysics({ kind, ground/trimesh, player })`
- [ ] `controller.setCollision(...)` with correct `keepRoomBounds`
- [ ] `physics.step(dt)` each frame
- [ ] Capsule sizes from `PLAYER_CAPSULE` only
- [ ] Optional `installMeshBvh` + `accelerateObject3D` for dense meshes
- [ ] No parallel physics engine
