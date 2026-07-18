# Projectiles: projectilebomb.glb (not witch hut)

**Projectile / skill mesh:** `C:\Users\nugye\Documents\projectilebomb.glb`  
**CDN:** `https://assets.grudge-studio.com/models/vfx/projectilebomb.glb`  
**Code:** `three/fx/projectileBomb.ts` · `Vfx.castBombProjectile`

**Witch hut swamp** (`witch_hut_in_a_swamp.glb`) is an **island / environment only**  
(`models/worlds/witch_hut_in_a_swamp.glb`) — do **not** use it for skill projectiles.

## Authored scales

| Variant | Scale | Skill kinds |
| --- | --- | --- |
| Arrow | `0.1276 · 2.0858 · 0.1011` | `witchArrow` (+ default bolt path) |
| Missile | `0.22 · 1.4 · 0.18` | `witchMissile` |
| Disk AOE | `3.9617 · 0.1837 · 3.3952` | `witchDisk` |

Position/rotation origin; arrow/missile align local +Y to travel. Disk spins on Y along path.

## Material + mesh animation

- Keeps `projectilebomb` textures (`MAT_0_0` / `MAT_0_1`)
- Emissive pulse + UV scroll per variant (`emberScroll` / `arcanePulse` / `swampGlow`)
- Plays embedded **Idle** clip when present (spinning mesh)

## Weapon skills

| Kit | Skills | Variant |
| --- | --- | --- |
| Ranger | Aimed Shot, Piercing Arrow | arrow |
| Mage | Elemental Blast, Bolt | missile |
| Mage | Cataclysm, Arcane Nova | disk |

## D1

`asset_registry` key `models/vfx/projectilebomb.glb` · category `vfx` ·  
`animation_packs` JSON: variants + `skillKinds` + weapon bindings.
