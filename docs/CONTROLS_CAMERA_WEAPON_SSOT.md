# Controls · Camera · Weapon reticle SSOT

**Product:** https://open.grudge-studio.com  
**Package:** `@workspace/grudge-physics` (`lib/grudge-physics`)  
**Host app:** `artifacts/animator` (single Vercel deploy for Danger, Play, Brawl, Survival, Genesis, …)

## Goal

Changing controls / camera feel / reticle / free-mouse on Open **once** updates **every native mode** in the same SPA. External fleet games (DCQ, RTS, Island) import the same package when they onboard.

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
