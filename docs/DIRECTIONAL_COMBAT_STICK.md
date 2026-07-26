# Directional combat stick · melee zone · weapon deploy

## Goal

Mouse aim, character facing, **weapon blade (grip→tip)**, and **projectile barrel** stay coherent so:

- Strikes feel **right at the mouse / reticle**
- Melee arcs follow the **steel**, not the hips
- Bullets / bolts / slash waves leave **near the tip / barrel**
- Combos keep a **sticky** facing (no mid-swing flip from noise)

## SSOT modules

| Module | Role |
|--------|------|
| `three/combat/directionStick.ts` | Sticky forward, sample (aim/weapon/muzzle/impact), zone of impact, barrel spawn |
| `three/combat/meleeStrikeFx.ts` | Per-family FX + `meleeImpactRadiusBonus` (1H / 2H / polearm / **shield**) |
| `three/Weapons.ts` | Mesh-fitted colliders + tip socket for trails |
| `three/weaponTuning.ts` | Grip / size / hit authoring persistence |
| `@workspace/grudge-physics` aim | Crosshair ray, reticle profiles, ranged release lead |
| `docs/CONTROLS_CAMERA_WEAPON_SSOT.md` | Camera / reticle package |

## Weapon families

| Group | Combo feel | Impact zone |
|-------|------------|-------------|
| **melee-1h** (sword, axe, dagger, mace) | 3-hit | Mid tip bias, medium radius |
| **melee-2h** (greatsword, greataxe, hammer2h) | 4-hit Madarame | Wider, stronger AoE finishers |
| **polearm** | 4-hit thrust chain | Far tip bias, thinner sphere |
| **shield** | Bash → slam → finisher | Short, wide knock |
| **ranged** | Clip-synced release lead | Muzzle = tip + aim nudge |

## Impact zone math

```
sample = sampleCombatDirection(body, mouseAim, tip, grip)
zone   = meleeImpactZone(sample, reach, stage, aoe, group)
hitR   = max(zone.radius, strike.radius) + meleeImpactRadiusBonus(...)
```

Hit centre is **tip-biased** (default 0.72 along grip→tip), not root+reach alone.

## Deploy (Open)

```bash
cd F:\GitHub\gameopen
# verify if present
npx vitest run artifacts/animator/src/three/weaponsMeshFit.test.ts
# production
# git push main → Vercel gameopen / open.grudge-studio.com
# or npm run deploy:prod when configured
```

## Assets (characters · weapons · buildings)

| Class | Deploy path |
|-------|-------------|
| Characters | CDN `models/grudge6` + `models/voxels/tvs` · FLEET_ASSET_DEPLOYMENT.md |
| Weapons GLB | arsenal pack + `mountWeaponModel` · tip for muzzle |
| Shields / 1H / 2H | same mount + group-driven FX family |
| Buildings / TVS env | `npm run convert:tvs` + `upload:tvs` in voxgrudge · R2 `models/voxels/tvs` |
| Armor sets | `models/voxels/armor/minecraft-realistic/*` |

## Related

- `MELEE_SLASH_FX.md` — deterministic arcs  
- `HEAVY_2H_AND_ANNIHILATE.md` — 2H combos  
- Skill `grudge-fleet-combat` · `grudge-combat-targeting`  
