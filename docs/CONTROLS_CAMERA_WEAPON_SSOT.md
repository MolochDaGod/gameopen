# Controls · Camera · Weapon reticle SSOT

**Product:** https://open.grudge-studio.com  
**Package:** `@workspace/grudge-physics` (`lib/grudge-physics`)  
**Host app:** `artifacts/animator` (single Vercel deploy for Danger, Play, Brawl, Survival, Genesis, …)

## Goal

Changing controls / camera feel / reticle / free-mouse on Open **once** updates **every native mode** in the same SPA. External fleet games (DCQ, RTS, Island) import the same package when they onboard.

## TPS locomotion + combat (industry, existing Controller)

Do **not** add three-player-controller or a second camera writer. Extend `Controller.ts` + `@workspace/grudge-physics` `tpsMoveBasis`.

| Law | Value |
|-----|--------|
| Character local | **+Z** art-forward · **+X** right · **+Y** up (laterality box) |
| Walk WASD | Camera-relative: **W** = flattened camera look, **D** = camera world +X (screen-right) |
| Matrix | `camera.updateMatrixWorld(true)` before sampling — stale identity looks **−Z** and inverts W/A |
| Face | Yaw to wish unless target-lock; lock-on → body faces foe, A/D is a **strafe** |
| Traversal | One capsule KCC (`CollisionProvider` / Rapier) + same height field as foot IK |
| Camera | One TPS writer (`Controller.updateCamera`). OrbitControls never writes in combat |
| Combat | One mixer. Weapon pack gait + attack overlay. Skills 1–4 / C parry / X dodge / Alt slide |
| Aim | Center-screen ray (`screenAimRay`) + DirectionStick — not a second aim system |

Toon play kits: yaw **0** (already +Z). `modelYaw: π` is only for catalog heroes whose author faces the camera. Never stack π on `applyArtForwardPlusZ`.

## Architecture

```
@workspace/grudge-physics
├── aim/AimSystem.ts       Recoil, fovKick, AIM_* free-aim limits
├── aimRay.ts              screenCenterRay / screenAimRay / raycastScene
├── controls/
│   ├── pointerPresence.ts   UI vs play-locked vs free-mouse layers
│   ├── reticleProfiles.ts   sword=dot · bow=X · gun=+ · staff=ring
│   ├── rangedPrimary.ts     anim-synced projectile release
│   ├── cameraProfiles.ts    combat soft/hard · swim · climb · harvest/build
│   └── controlsStorage.ts   localStorage key grudge:controls
└── LOCOMOTION / PLAYER_CAPSULE / GRAVITY  (physics constants)

artifacts/animator
├── three/Controller.ts      uses loadControls + setCameraOpts(profile)
├── three/Studio.ts          reticle + ranged + camera from package
├── three/controlsSettings.ts  load/save via controlsStorage
├── components/Crosshair.tsx   weapon shapes
├── components/CursorManager.tsx
├── components/TouchControls.tsx  mobile pad (Kenney Mobile Controls 1 chrome)
├── lib/kenneyMobile.ts           CDN + prefab URLs
└── three/aim/* · pointerPresence.ts   thin re-exports (compat)
```

## One storage blob

| Key | Status |
|-----|--------|
| `grudge:controls` | **Canonical** |
| `dangerroom:controls` | Legacy — read on load, deleted on save |

`loadControls()` / `saveControls()` are used by **Studio**, **BrawlerScene**, and any other native host. Do **not** invent a second localStorage key per mode.

## Rules (purge list)

| Do | Don’t |
|----|--------|
| Import reticle / pointer / camera profiles from `@workspace/grudge-physics` | Fork a second Crosshair CSS ring in Brawl / Survival |
| Use `loadControls()` for mouse sens / FOV / invertY | Hardcode sensitivity in a mode |
| Use `resolveCameraProfileKey` + `cameraProfileOpts` | Copy-paste setCameraOpts blocks per mode |
| Use `rangedPrimaryTune` + delayed release for LMB ranged | Instant bolt with no anim lead |
| Keep thin re-exports under `three/aim/*` only for back-compat | Add new logic only in the package |

## External games (DCQ, RTS, Island)

Best practice:

1. Depend on `@workspace/grudge-physics` (or copy the package into monorepo workspace).
2. Wire `screenAimRay` + reticle profiles + camera profiles — do not re-implement soft lock.
3. Persist controls under the same `grudge:controls` key if sharing browser origin; otherwise mirror schema in that game’s settings UI.

## Phone / Kenney pad

Open play on `data-device=phone` uses **`TouchControls`** + Kenney Mobile Controls 1.0  
(`public/ui/kenney/mobile-controls-1/` · `src/lib/kenneyMobile.ts`).

| On canvas | In edge tabs |
|-----------|----------------|
| Move stick, jump/block/parry/dodge, skill stick, mini hotbar | Sprint, crouch, harvest/combat, bag, build, maps, skills |

Steam header hides on phone Danger/Play/Brawl/Survival — Kenney menu FAB opens the existing sheet. Do **not** invent TouchControls2.

## Deploy

```bash
cd C:\Users\nugye\Documents\gameopen
# edit lib/grudge-physics or animator host
npm run deploy:prod
# or push main → Vercel project gameopen
```

One production URL = all native Open instances updated.

## Related

- `docs/THIRD_PERSON_CONTROLLER.md` — Controller camera polish  
- `docs/DANGER_ROOM_COMBAT_STACK.md` — combat SSOT  
- `docs/WARLORDS_PHYSICS_SSOT.md` — physics package overview  
- Skill `grudge-combat-targeting` — LMB/RMB soft/hard focus contract  
