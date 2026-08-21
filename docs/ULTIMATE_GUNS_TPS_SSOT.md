# Ultimate Guns + Arc Raiders-like TPS SSOT

## Pack

| Item | Value |
|------|--------|
| Zip | `D:\Games\Models\Ultimate Guns Pack-glb.zip` |
| Preview | https://static.poly.pizza/listimg/CkWIv7GwRfo6uopKE33h.webp |
| Runtime | `public/models/weapons/ultimate-guns/` |
| Catalog | `ultimate-guns/catalog.json` |
| Code | `arsenal/ultimateGuns.ts`, `gunLoot.ts`, `gunTpsController.ts` |
| Extends | `gunClass.ts` + `gunCombat.ts` (no second combat stack) |

## Meshes (normalized)

| File | Family | Ammo |
|------|--------|------|
| `revolver.glb` / `pistol.glb` | pistol | light |
| `submachine-gun.glb` | rifle (SMG feel) | light |
| `assault-rifle.glb` / `bullpup.glb` | rifle | medium |
| `sniper-rifle.glb` | sniper (`hunter-rifle`) | heavy |
| `shotgun.glb` / sawed-off / short-stock | shotgun | shell |
| `scope` / `bipod` / `bayonet` / `tripod` | attachments | — |

Canonical family models (gunClass):

- pistol → `ultimate-guns/revolver.glb`
- rifle → `ultimate-guns/assault-rifle.glb`
- sniper → `ultimate-guns/sniper-rifle.glb`
- shotgun → `ultimate-guns/shotgun.glb`

## Ammo

| Type | Stack max | Used by |
|------|-----------|---------|
| `light` | 120 | pistol, SMG |
| `medium` | 90 | AR, bullpup |
| `heavy` | 40 | sniper |
| `shell` | 36 | shotguns |

`GunTpsController.grantAmmo` + loot pickups fill **reserve**; F-reload fills **clip** from reserve.

## Dropables

`GunLootField` (Studio / openworld):

- `dropWeapon(skinId, pos)` / `dropAmmo(type, n, pos)`
- `dropRandomLoot(pos, "world_common" | "raid_cache")`
- `tryPickupNear(playerPos, sink, 1.6)` — E / interact

Markers bob on ground disc (XZ).

## TPS (Arc Raiders-like)

From session Fortnite-like TPS + pen feel:

| Control | Action |
|---------|--------|
| LMB | Primary fire (burst from loadout) |
| RMB hold | ADS (FOV 68→52, tighter spread) |
| F tap | Reload |
| Focus | Soft-lock + crosshair (existing Studio focus) |
| Sprint | Blocks fire; hip spread penalty |

`GunTpsController`:

- ADS blend 0.18 s  
- Hip/ADS spread from pack skin  
- Clip + reserve bags  
- Auto-reload on empty  

Host: blend camera FOV to `desiredFov`; call existing gun projectile path when `update().fire`.

## Voxel (VoxGrudge)

```js
const rig = HandWeaponRig.create({ THREE });
rig.bind(playerModel);
rig.setStance("off"); // gun stance
rig.loadGunGlb(HandWeaponRig.ultimateGunPath("rifle")); // or full path
// aim: rig.update(dt, { aimWorld: hitPoint });
```

## Deploy paths

| Host | Path |
|------|------|
| Open / gameopen | `artifacts/animator/public/models/weapons/ultimate-guns/` |
| client public | `client/public/models/weapons/ultimate-guns/` |
| voxgrudge | `models/weapons/ultimate-guns/` + `public/models/weapons/ultimate-guns/` |

## Verify

1. HEAD `/models/weapons/ultimate-guns/assault-rifle.glb` on deploy  
2. Equip pistol/rifle/shotgun — mesh is pack, not cube  
3. LMB empties clip; F reloads from reserve  
4. RMB ADS narrows FOV / spread  
5. Loot drop near player + pickup grants ammo/weapon  

## Not inventing

- No second physics body for bullets  
- No second AnimationMixer for gun  
- One GUN class ladder (T0–T5) remains in gunClass  
